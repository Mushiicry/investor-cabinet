// ═══════════════════════════════════════════════════════════════════
// Восстановление учёта ETH по данным блокчейна (2026-07-21).
//
// Импорт читал балансы разными RPC-запросами с 'latest', снимок собирался
// наполовину, и учёт сделок разъехался с реальностью. Корень починен
// (единый блок на прогон), эта функция чинит уже записанные данные.
//
// Источник истины — архивная нода Arbitrum: подняты все свопы кошелька
// 0xFEc18D…e0c3 за 25.05–21.07.2026 (value транзакции + Transfer-логи USDC).
//
// Делает три вещи:
//   1. Строка 21.07 в «Транзакции_IMPORT»: «Пополнение USDC 26,98»
//      → «Продажа ETH 0,014 × 1927,38». Своп записался как приход стейбла.
//   2. Строка 14.07: количество 0,0188 → 0,282251, цена 27 776,21 → 1 851,86.
//      Импорт взял верную сумму USDC, но приписал ей разницу балансов между
//      своими прогонами вместо реального объёма свопа — отсюда цена-артефакт.
//   3. «Расчеты», блок закрытых позиций O:U: строка ETH с реализованной
//      прибылью по всем восьми продажам.
//
// Количества в «Расчетах» НЕ трогаем: они берутся из баланса кошелька
// напрямую и всё это время были верны — разъехался только учёт операций.
//
// Идемпотентна. Сухой прогон — previewEthAccountingRestore().
// ═══════════════════════════════════════════════════════════════════

var IC_FIX_ETH = {
  importSheet: 'Транзакции_IMPORT',
  calcSheet: 'Расчеты',

  // Продажа 21.07, записанная как приход стейбла.
  lostSale: {
    wrongId: 'EVM_STABLE_FLOW:ARBITRUM:20260721T101852:ПОПОЛНЕНИЕ:USDC:26.983255',
    stamp: '20260721T101852',
    quantity: 0.014,
    proceeds: 26.983255
  },

  // Продажа 14.07 с искажённым объёмом. Реальные цифры — из цепочки.
  brokenSale: {
    idPart: '20260714T155834',
    quantity: 0.282250861,
    proceeds: 522.688231
  },

  // Итог по всем восьми продажам ETH за период (блокчейн).
  // Средняя входа — по покупкам за USDC на Arbitrum: $205,30 / 0,120523936 ETH.
  realized: {
    quantityClosed: 0.433247498,
    avgEntry: 1703.396079,
    exitPrice: 1841.653659,
    profitUsd: 59.899751,
    profitPct: 0.08116584
  }
};

function previewEthAccountingRestore() {
  return IC_FIX_ETH_run_(true);
}

function restoreEthAccounting() {
  return IC_FIX_ETH_run_(false);
}

function IC_FIX_ETH_run_(dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var importSheet = ss.getSheetByName(IC_FIX_ETH.importSheet);
  var calcSheet = ss.getSheetByName(IC_FIX_ETH.calcSheet);
  if (!importSheet) throw new Error('Нет листа ' + IC_FIX_ETH.importSheet);
  if (!calcSheet) throw new Error('Нет листа ' + IC_FIX_ETH.calcSheet);

  var report = {
    dryRun: !!dryRun,
    lostSale: IC_FIX_ETH_fixLostSale_(importSheet, dryRun),
    brokenSale: IC_FIX_ETH_fixBrokenSale_(importSheet, dryRun),
    realized: IC_FIX_ETH_addClosedRow_(calcSheet, dryRun)
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// ── 1. 21.07: «Пополнение USDC» → «Продажа ETH» ─────────────────────
function IC_FIX_ETH_fixLostSale_(sheet, dryRun) {
  var cfg = IC_FIX_ETH.lostSale;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'EMPTY_SHEET' };

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var newId = 'EVM_BALANCE_DELTA:ARBITRUM:' + cfg.stamp + ':ETH_TO_USDC:' +
    cfg.quantity + ':' + cfg.proceeds;
  var exitPrice = cfg.proceeds / cfg.quantity;

  var targetRow = 0;
  for (var i = 0; i < ids.length; i += 1) {
    var id = String(ids[i][0]).trim();
    if (id === newId) return { status: 'ALREADY_FIXED', row: i + 2 };
    if (id === cfg.wrongId) targetRow = i + 2;
  }
  if (!targetRow) return { status: 'ROW_NOT_FOUND' };

  var before = sheet.getRange(targetRow, 1, 1, 19).getDisplayValues()[0];
  if (dryRun) return { status: 'WOULD_FIX', row: targetRow, before: before, exitPrice: exitPrice };

  sheet.getRange(targetRow, 1).setValue(newId);
  sheet.getRange(targetRow, 4).setValue('ETH');
  sheet.getRange(targetRow, 5).setValue('Крипта');
  sheet.getRange(targetRow, 6).setValue('Продажа');
  sheet.getRange(targetRow, 7).setValue(cfg.quantity);
  sheet.getRange(targetRow, 8).setValue(exitPrice);
  sheet.getRange(targetRow, 9).setValue(cfg.proceeds);
  sheet.getRange(targetRow, 10).setValue('Arbitrum wallet balance delta; already applied to Расчеты');
  sheet.getRange(targetRow, 15).setValue('SWAP');
  sheet.getRange(targetRow, 17).setValue('ETH -> USDC');
  sheet.getRange(targetRow, 18).setValue(cfg.quantity + ' -> ' + cfg.proceeds);
  sheet.getRange(targetRow, 19).setValue(
    'Восстановлено по блокчейну 2026-07-21: своп записался как «Пополнение USDC» ' +
    'из-за расщеплённого снимка балансов.'
  );

  return { status: 'FIXED', row: targetRow, before: before, exitPrice: exitPrice };
}

// ── 2. 14.07: объём 0,0188 → 0,282251, цена 27 776 → 1 851,86 ───────
function IC_FIX_ETH_fixBrokenSale_(sheet, dryRun) {
  var cfg = IC_FIX_ETH.brokenSale;
  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var exitPrice = cfg.proceeds / cfg.quantity;

  var targetRow = 0;
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]).indexOf(cfg.idPart) >= 0) { targetRow = i + 2; break; }
  }
  if (!targetRow) return { status: 'ROW_NOT_FOUND' };

  var currentQty = Number(sheet.getRange(targetRow, 7).getValue()) || 0;
  if (Math.abs(currentQty - cfg.quantity) < 1e-6) return { status: 'ALREADY_FIXED', row: targetRow };

  var before = sheet.getRange(targetRow, 1, 1, 19).getDisplayValues()[0];
  if (dryRun) return { status: 'WOULD_FIX', row: targetRow, before: before, exitPrice: exitPrice };

  sheet.getRange(targetRow, 1).setValue(
    'EVM_BALANCE_DELTA:ARBITRUM:' + cfg.idPart + ':ETH_TO_USDC:' + cfg.quantity + ':' + cfg.proceeds
  );
  sheet.getRange(targetRow, 7).setValue(cfg.quantity);
  sheet.getRange(targetRow, 8).setValue(exitPrice);
  sheet.getRange(targetRow, 9).setValue(cfg.proceeds);
  sheet.getRange(targetRow, 18).setValue(cfg.quantity + ' -> ' + cfg.proceeds);
  sheet.getRange(targetRow, 19).setValue(
    'Объём и цена восстановлены по блокчейну 2026-07-21: импорт записал разницу ' +
    'балансов между прогонами (0,0188) вместо реального объёма свопа.'
  );

  return { status: 'FIXED', row: targetRow, before: before, exitPrice: exitPrice };
}

// ── 3. Блок закрытых позиций O:U ────────────────────────────────────
function IC_FIX_ETH_addClosedRow_(sheet, dryRun) {
  var cfg = IC_FIX_ETH.realized;
  var scan = sheet.getRange(1, 15, 40, 7).getValues(); // O..U
  var headerRow = 0;
  var totalRow = 0;

  for (var i = 0; i < scan.length; i += 1) {
    var label = String(scan[i][0]).trim();
    if (label === 'asset') headerRow = i + 1;
    if (label === 'realizedProfitUsd') totalRow = i + 1;
  }
  if (!headerRow || !totalRow) return { status: 'BLOCK_NOT_FOUND' };

  // Строка ETH могла быть добавлена ранней версией функции — только по одной
  // сделке 21.07 (0.014 ETH, +2.11$). Обновляем её до полного пересчёта по
  // блокчейну, а не выходим с «уже есть».
  for (var r = headerRow + 1; r < totalRow; r += 1) {
    if (String(scan[r - 1][0]).trim() !== 'ETH') continue;

    var currentQty = Number(scan[r - 1][2]) || 0;
    if (Math.abs(currentQty - cfg.quantityClosed) < 1e-6) {
      return { status: 'ALREADY_FULL', row: r, quantityClosed: currentQty };
    }
    if (dryRun) {
      return {
        status: 'WOULD_UPDATE', row: r,
        было: { quantityClosed: currentQty, realizedProfitUsd: Number(scan[r - 1][5]) || 0 },
        станет: cfg
      };
    }

    sheet.getRange(r, 15, 1, 7).setValues([[
      'ETH', 'FIXED', cfg.quantityClosed, cfg.avgEntry, cfg.exitPrice, cfg.profitUsd, cfg.profitPct
    ]]);
    var updatedTotal = IC_FIX_ETH_refreshTotal_(sheet, headerRow, totalRow);
    return { status: 'UPDATED', row: r, былоQty: currentQty, новыйИтог: updatedTotal };
  }

  var freeRow = 0;
  for (var k = headerRow + 1; k < totalRow; k += 1) {
    if (!String(scan[k - 1][0]).trim()) { freeRow = k; break; }
  }

  var totalFormula = sheet.getRange(totalRow, 20).getFormula();
  var plan = {
    headerRow: headerRow, totalRow: totalRow, freeRow: freeRow,
    totalFormula: totalFormula || '(константа)', values: cfg
  };

  // Свободной строки внутри блока нет — сдвигаем итоги на строку вниз.
  // insertRow НЕ используем: он сдвинул бы служебные диапазоны листа.
  if (!freeRow) {
    var check = IC_FIX_ETH_canShiftTotals_(sheet, totalRow);
    if (!check.ok) { plan.status = 'NO_FREE_ROW'; plan.blockedBy = check.reason; return plan; }
    plan.shiftTotals = true;
    if (dryRun) { plan.status = 'WOULD_SHIFT_AND_ADD'; return plan; }
    IC_FIX_ETH_shiftTotalsDown_(sheet, totalRow);
    freeRow = totalRow;
    totalRow += 1;
    plan.totalRow = totalRow;
    plan.freeRow = freeRow;
    totalFormula = sheet.getRange(totalRow, 20).getFormula();
  }

  if (dryRun) { plan.status = 'WOULD_ADD'; return plan; }

  sheet.getRange(freeRow, 15, 1, 7).setValues([[
    'ETH', 'FIXED', cfg.quantityClosed, cfg.avgEntry, cfg.exitPrice, cfg.profitUsd, cfg.profitPct
  ]]);

  if (!totalFormula) {
    plan.newTotal = IC_FIX_ETH_refreshTotal_(sheet, headerRow, totalRow);
  }

  plan.status = 'ADDED';
  return plan;
}

// Итог реализованного: формулу не трогаем (строка внутри её диапазона),
// константу пересчитываем по строкам блока.
function IC_FIX_ETH_refreshTotal_(sheet, headerRow, totalRow) {
  if (sheet.getRange(totalRow, 20).getFormula()) return null;

  var sum = 0;
  sheet.getRange(headerRow + 1, 20, totalRow - headerRow - 1, 1).getValues()
    .forEach(function(cell) { sum += Number(cell[0]) || 0; });
  sheet.getRange(totalRow, 20).setValue(sum);
  return sum;
}

function IC_FIX_ETH_canShiftTotals_(sheet, totalRow) {
  var below = sheet.getRange(totalRow + 1, 15, 3, 7).getValues();
  var landing = below[2];
  var occupied = landing.filter(function(cell) { return String(cell).trim() !== ''; });
  if (occupied.length) return { ok: false, reason: 'строка ' + (totalRow + 3) + ' в O:U не пуста' };
  return { ok: true };
}

function IC_FIX_ETH_shiftTotalsDown_(sheet, totalRow) {
  for (var offset = 1; offset >= 0; offset -= 1) {
    var from = totalRow + offset;
    var to = from + 1;
    var formulas = sheet.getRange(from, 15, 1, 7).getFormulas()[0];
    var values = sheet.getRange(from, 15, 1, 7).getValues()[0];
    for (var col = 0; col < 7; col += 1) {
      var target = sheet.getRange(to, 15 + col);
      if (formulas[col]) target.setFormula(IC_FIX_ETH_growRange_(formulas[col]));
      else target.setValue(values[col]);
    }
  }
  sheet.getRange(totalRow, 15, 1, 7).clearContent();
}

function IC_FIX_ETH_growRange_(formula) {
  return String(formula).replace(/([A-Z]{1,2})(\d+):([A-Z]{1,2})(\d+)/g, function(_, c1, r1, c2, r2) {
    return c1 + r1 + ':' + c2 + (Number(r2) + 1);
  });
}
