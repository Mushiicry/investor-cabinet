// ═══════════════════════════════════════════════════════════════════
// Разовое восстановление продажи ETH от 2026-07-21.
//
// Своп 0.014 ETH → 26.983255 USDC попал в журнал как «Пополнение USDC»:
// балансы читались разными RPC-запросами, снимок собрался наполовину и
// пара дельт ETH↓/USDC↑ разошлась по разным прогонам. Корень починен
// (единый блок на прогон), эта функция чинит уже записанные данные.
//
// Делает две вещи:
//   1. «Транзакции_IMPORT» — строка потока стейбла переписывается в продажу ETH
//      в том же формате, что и остальные ETH_TO_USDC строки импорта.
//   2. «Расчеты», блок закрытых позиций O:U — добавляется строка ETH
//      с реализованной прибылью, итог realizedProfitUsd пересчитывается.
//
// Количества в «Расчетах» НЕ трогаем: они уже верные (баланс кошелька —
// источник истины, он синхронизировался штатно).
//
// Функция идемпотентна: повторный запуск ничего не задвоит.
// Сухой прогон — previewEthSaleRestore20260721().
// ═══════════════════════════════════════════════════════════════════

var IC_FIX_ETH_SALE = {
  importSheet: 'Транзакции_IMPORT',
  calcSheet: 'Расчеты',
  wrongImportId: 'EVM_STABLE_FLOW:ARBITRUM:20260721T101852:ПОПОЛНЕНИЕ:USDC:26.983255',
  quantity: 0.014,
  proceeds: 26.983255,
  dateLabel: '21.07.2026',
  stamp: '20260721T101852',
  walletId: 'metamask-arbitrum-main'
};

function previewEthSaleRestore20260721() {
  return IC_FIX_ETH_SALE_run_(true);
}

function restoreEthSale20260721() {
  return IC_FIX_ETH_SALE_run_(false);
}

function IC_FIX_ETH_SALE_run_(dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var importSheet = ss.getSheetByName(IC_FIX_ETH_SALE.importSheet);
  var calcSheet = ss.getSheetByName(IC_FIX_ETH_SALE.calcSheet);
  if (!importSheet) throw new Error('Нет листа ' + IC_FIX_ETH_SALE.importSheet);
  if (!calcSheet) throw new Error('Нет листа ' + IC_FIX_ETH_SALE.calcSheet);

  var avgEntry = IC_FIX_ETH_SALE_readEthAvgEntry_(calcSheet);
  if (!avgEntry) throw new Error('Не нашёл среднюю цену входа ETH в «Расчетах»');

  var exitPrice = IC_FIX_ETH_SALE.proceeds / IC_FIX_ETH_SALE.quantity;
  var costBasis = IC_FIX_ETH_SALE.quantity * avgEntry;
  var realizedUsd = IC_FIX_ETH_SALE.proceeds - costBasis;
  var realizedPct = avgEntry ? exitPrice / avgEntry - 1 : 0;

  var report = {
    dryRun: !!dryRun,
    avgEntry: avgEntry,
    quantity: IC_FIX_ETH_SALE.quantity,
    exitPrice: exitPrice,
    costBasis: costBasis,
    realizedUsd: realizedUsd,
    realizedPct: realizedPct
  };

  report.journal = IC_FIX_ETH_SALE_fixJournalRow_(importSheet, exitPrice, dryRun);
  report.realized = IC_FIX_ETH_SALE_addClosedRow_(calcSheet, avgEntry, exitPrice, realizedUsd, realizedPct, dryRun);

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Сдвигать итоги можно, только если строки под ними (O..U) реально пустые.
function IC_FIX_ETH_SALE_canShiftTotals_(sheet, totalRow) {
  var below = sheet.getRange(totalRow + 1, 15, 3, 7).getValues();
  var landing = below[2]; // строка, куда уедет вторая итоговая (realizedProfitPct)
  var occupied = landing.filter(function(cell) { return String(cell).trim() !== ''; });
  if (occupied.length) return { ok: false, reason: 'строка ' + (totalRow + 3) + ' в O:U не пуста' };
  return { ok: true };
}

function IC_FIX_ETH_SALE_shiftTotalsDown_(sheet, totalRow) {
  // Двигаем снизу вверх, чтобы не затереть ещё не перенесённую строку.
  for (var offset = 1; offset >= 0; offset -= 1) {
    var from = totalRow + offset;
    var to = from + 1;
    var formulas = sheet.getRange(from, 15, 1, 7).getFormulas()[0];
    var values = sheet.getRange(from, 15, 1, 7).getValues()[0];

    for (var col = 0; col < 7; col += 1) {
      var target = sheet.getRange(to, 15 + col);
      if (formulas[col]) target.setFormula(IC_FIX_ETH_SALE_growRange_(formulas[col]));
      else target.setValue(values[col]);
    }
  }
  sheet.getRange(totalRow, 15, 1, 7).clearContent();
}

// Итог суммирует строки блока: раз блок вырос на строку, конец диапазона
// в формуле тоже должен сдвинуться (T2:T7 → T2:T8).
function IC_FIX_ETH_SALE_growRange_(formula) {
  return String(formula).replace(/([A-Z]{1,2})(\d+):([A-Z]{1,2})(\d+)/g, function(_, c1, r1, c2, r2) {
    return c1 + r1 + ':' + c2 + (Number(r2) + 1);
  });
}

function IC_FIX_ETH_SALE_readEthAvgEntry_(calcSheet) {
  var lastRow = calcSheet.getLastRow();
  var assets = calcSheet.getRange(1, 1, lastRow, 4).getValues();
  for (var i = 0; i < assets.length; i += 1) {
    if (String(assets[i][0]).trim() === 'ETH') return Number(assets[i][3]) || 0;
  }
  return 0;
}

// ── 1. Журнал: «Пополнение USDC» → «Продажа ETH» ────────────────────
function IC_FIX_ETH_SALE_fixJournalRow_(sheet, exitPrice, dryRun) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'EMPTY_SHEET' };

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var newId = 'EVM_BALANCE_DELTA:ARBITRUM:' + IC_FIX_ETH_SALE.stamp + ':ETH_TO_USDC:' +
    IC_FIX_ETH_SALE.quantity + ':' + IC_FIX_ETH_SALE.proceeds;

  var targetRow = 0;
  for (var i = 0; i < ids.length; i += 1) {
    var id = String(ids[i][0]).trim();
    if (id === newId) return { status: 'ALREADY_FIXED', row: i + 2 };
    if (id === IC_FIX_ETH_SALE.wrongImportId) targetRow = i + 2;
  }

  if (!targetRow) return { status: 'SOURCE_ROW_NOT_FOUND' };

  var before = sheet.getRange(targetRow, 1, 1, 19).getDisplayValues()[0];
  if (dryRun) return { status: 'WOULD_FIX', row: targetRow, before: before, newId: newId };

  // Формат в точности как у штатных строк ETH_TO_USDC этого импорта.
  sheet.getRange(targetRow, 1).setValue(newId);
  sheet.getRange(targetRow, 4).setValue('ETH');
  sheet.getRange(targetRow, 5).setValue('Крипта');
  sheet.getRange(targetRow, 6).setValue('Продажа');
  sheet.getRange(targetRow, 7).setValue(IC_FIX_ETH_SALE.quantity);
  sheet.getRange(targetRow, 8).setValue(exitPrice);
  sheet.getRange(targetRow, 9).setValue(IC_FIX_ETH_SALE.proceeds);
  sheet.getRange(targetRow, 10).setValue('Arbitrum wallet balance delta; already applied to Расчеты');
  sheet.getRange(targetRow, 15).setValue('SWAP');
  sheet.getRange(targetRow, 17).setValue('ETH -> USDC');
  sheet.getRange(targetRow, 18).setValue(IC_FIX_ETH_SALE.quantity + ' -> ' + IC_FIX_ETH_SALE.proceeds);
  sheet.getRange(targetRow, 19).setValue(
    'Восстановлено вручную 2026-07-21: своп записался как «Пополнение USDC» ' +
    'из-за расщеплённого снимка балансов. Количества в «Расчетах» были верны.'
  );

  return { status: 'FIXED', row: targetRow, before: before, newId: newId };
}

// ── 2. Блок закрытых позиций O:U и итог realizedProfitUsd ───────────
function IC_FIX_ETH_SALE_addClosedRow_(sheet, avgEntry, exitPrice, realizedUsd, realizedPct, dryRun) {
  var scan = sheet.getRange(1, 15, 40, 7).getValues(); // O..U
  var headerRow = 0;
  var totalRow = 0;

  for (var i = 0; i < scan.length; i += 1) {
    var label = String(scan[i][0]).trim();
    if (label === 'asset') headerRow = i + 1;
    if (label === 'realizedProfitUsd') totalRow = i + 1;
  }
  if (!headerRow || !totalRow) return { status: 'BLOCK_NOT_FOUND', headerRow: headerRow, totalRow: totalRow };

  // Идемпотентность: наша строка уже есть?
  for (var r = headerRow + 1; r < totalRow; r += 1) {
    var row = scan[r - 1];
    if (String(row[0]).trim() === 'ETH' && Math.abs(Number(row[2]) - IC_FIX_ETH_SALE.quantity) < 1e-9) {
      return { status: 'ALREADY_PRESENT', row: r };
    }
  }

  // Свободная строка внутри блока — писать в неё безопаснее всего:
  // диапазон итоговой формулы её уже охватывает.
  var freeRow = 0;
  for (var k = headerRow + 1; k < totalRow; k += 1) {
    if (!String(scan[k - 1][0]).trim()) { freeRow = k; break; }
  }

  var totalFormula = sheet.getRange(totalRow, 20).getFormula();
  var plan = {
    headerRow: headerRow,
    totalRow: totalRow,
    freeRow: freeRow,
    totalFormula: totalFormula || '(константа)',
    values: {
      asset: 'ETH', status: 'FIXED', quantityClosed: IC_FIX_ETH_SALE.quantity,
      avgEntry: avgEntry, exitPrice: exitPrice,
      realizedProfitUsd: realizedUsd, realizedProfitPct: realizedPct
    }
  };

  // Свободной строки внутри блока нет — сдвигаем две итоговые строки на одну
  // вниз и занимаем освободившееся место. insertRow НЕ используем: вставка
  // сдвинула бы служебные диапазоны всего листа (анти-паттерн HANDOFF §3.8).
  if (!freeRow) {
    var shiftCheck = IC_FIX_ETH_SALE_canShiftTotals_(sheet, totalRow);
    if (!shiftCheck.ok) {
      plan.status = 'NO_FREE_ROW';
      plan.blockedBy = shiftCheck.reason;
      return plan;
    }
    plan.shiftTotals = true;
    if (dryRun) { plan.status = 'WOULD_SHIFT_AND_ADD'; return plan; }
    IC_FIX_ETH_SALE_shiftTotalsDown_(sheet, totalRow);
    freeRow = totalRow;
    totalRow += 1;
    plan.totalRow = totalRow;
    plan.freeRow = freeRow;
    totalFormula = sheet.getRange(totalRow, 20).getFormula();
  }

  if (dryRun) { plan.status = 'WOULD_ADD'; return plan; }

  sheet.getRange(freeRow, 15, 1, 7).setValues([[
    'ETH', 'FIXED', IC_FIX_ETH_SALE.quantity, avgEntry, exitPrice, realizedUsd, realizedPct
  ]]);

  // Итог: формулу не трогаем — новая строка внутри её диапазона.
  // Если итог был константой, пересчитываем сумму по строкам блока.
  if (!totalFormula) {
    var sum = 0;
    var body = sheet.getRange(headerRow + 1, 20, totalRow - headerRow - 1, 1).getValues();
    body.forEach(function(cell) { sum += Number(cell[0]) || 0; });
    sheet.getRange(totalRow, 20).setValue(sum);
    plan.newTotal = sum;
  }

  plan.status = 'ADDED';
  return plan;
}
