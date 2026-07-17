// ═══════════════════════════════════════════════════════════════════
// BNB Chain (BSC) wallet import — токенизированные акции + USDT-резерв.
//
// Отслеживает кошелёк на BNB Chain и синхронизирует КОЛИЧЕСТВА в «Расчеты»:
//   • USDT (BSC)  → строка 'USDT BNB'  (резерв · неприкосновенный)
//   • Токен акций → строка тикера (категория «Акции»)
//
// Принципы безопасности (после инцидентов с прошлыми импортами):
//   1. Только количество (колонка C). Средний вход (D) НЕ трогаем — его
//      задаёт владелец при покупке; PnL считается от его цифры.
//   2. Сбой RPC → скип актива, НИКОГДА не пишем 0 из-за сетевой ошибки.
//      (Честный 0 с работающего RPC — валиден: значит токены реально ушли.)
//   3. Нет строки актива в «Расчетах» → лог и скип, не создаём и не падаем.
//   4. RPC-failover: несколько публичных нод + ретраи (паттерн Solana).
// ═══════════════════════════════════════════════════════════════════

var IC_BNB_CALCULATIONS_SHEET = 'Расчеты';
var IC_BNB_BALANCES_SHEET = 'BNB_WALLET_BALANCES';
var IC_BNB_WALLET_ADDRESS = '0xFEc18D4474826afd65d578ff931F4ff2926ee0c3';
var IC_BNB_CHAIN_ID = 56;

var IC_BNB_RPC_URLS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed.binance.org',
  'https://bsc.drpc.org'
];

// ── Отслеживаемые токены ──────────────────────────────────────────
// USDT (BEP-20), 18 знаков — резерв
var IC_BNB_USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

// Токенизированные акции: SPCXB — SpaceX tokenized (BEP-20).
var IC_BNB_STOCK_SYMBOL = 'SPCXB';   // тикер = имя строки в «Расчетах» (колонка A)
var IC_BNB_STOCK_CONTRACT = '0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1';
var IC_BNB_STOCK_DECIMALS = 18;

// USDC (Binance-Peg, BEP-20) — ВНИМАНИЕ: 18 знаков, не 6 как в других сетях.
// Нужен для детекта покупок акций за USDC, пополнений и обменов (кейс
// 2026-07-17: мост Arbitrum->BNB + покупка SPCXB на Uniswap прошли мимо учёта).
var IC_BNB_USDC_CONTRACT = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
var IC_BNB_USDC_CALC_ASSET = 'USDC BNB'; // строка в «Расчетах» (создаётся при需)
var IC_BNB_IMPORT_SHEET = 'Транзакции_IMPORT';
var IC_BNB_WALLET_ID = 'metamask-bnb-main';

// Максимально правдоподобные количества — защита от мусорного ответа RPC.
var IC_BNB_SANE_LIMITS = { 'USDT BNB': 100000, 'USDC BNB': 100000, STOCK: 1000000 };

function setupBnbWalletImport() {
  IC_BNB_getOrCreateBalancesSheet_(SpreadsheetApp.getActiveSpreadsheet());
}

function syncBnbWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calculations = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!calculations) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);
  var balances = IC_BNB_getOrCreateBalancesSheet_(ss);
  var importSheet = ss.getSheetByName(IC_BNB_IMPORT_SHEET);
  var syncStartedAt = new Date();
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  var updated = [];

  var prev = IC_BNB_readLastBalances_(balances);

  // USDT (BSC) → 'USDT BNB'
  var usdt = IC_BNB_fetchErc20Balance_(IC_BNB_WALLET_ADDRESS, IC_BNB_USDT_CONTRACT, 18);
  if (usdt !== null) {
    IC_BNB_assertSane_('USDT BNB', usdt, IC_BNB_SANE_LIMITS['USDT BNB']);
    IC_BNB_appendBalanceRow_(balances, 'USDT BNB', usdt, IC_BNB_USDT_CONTRACT, syncAt);
  } else {
    Logger.log('BNB sync: USDT RPC не ответил — скип (позицию не трогаем)');
  }

  // USDC (BSC) → 'USDC BNB' (нужен для классификации покупок/пополнений)
  var usdc = IC_BNB_fetchErc20Balance_(IC_BNB_WALLET_ADDRESS, IC_BNB_USDC_CONTRACT, 18);
  if (usdc !== null) {
    IC_BNB_assertSane_(IC_BNB_USDC_CALC_ASSET, usdc, IC_BNB_SANE_LIMITS['USDC BNB']);
    IC_BNB_appendBalanceRow_(balances, IC_BNB_USDC_CALC_ASSET, usdc, IC_BNB_USDC_CONTRACT, syncAt);
  } else {
    Logger.log('BNB sync: USDC RPC не ответил — скип');
  }

  // Токен акций
  var stock = null;
  if (IC_BNB_STOCK_CONTRACT) {
    stock = IC_BNB_fetchErc20Balance_(IC_BNB_WALLET_ADDRESS, IC_BNB_STOCK_CONTRACT, IC_BNB_STOCK_DECIMALS);
    if (stock !== null) {
      IC_BNB_assertSane_(IC_BNB_STOCK_SYMBOL, stock, IC_BNB_SANE_LIMITS.STOCK);
      IC_BNB_appendBalanceRow_(balances, IC_BNB_STOCK_SYMBOL, stock, IC_BNB_STOCK_CONTRACT, syncAt);
    } else {
      Logger.log('BNB sync: ' + IC_BNB_STOCK_SYMBOL + ' RPC не ответил — скип');
    }
  }

  // ── Классификация дельт (до записи количеств) ──
  var hasPrev = prev && Object.keys(prev).length > 0;
  if (hasPrev) {
    IC_BNB_classifyDeltas_(calculations, importSheet, prev, {
      'USDT BNB': usdt, 'USDC BNB': usdc, STOCK: stock
    }, syncStartedAt);
  }

  // ── Количества в «Расчеты» (истина остаётся он-чейн) ──
  if (usdt !== null && IC_BNB_setQuantity_(calculations, 'USDT BNB', usdt)) updated.push('USDT BNB=' + usdt);
  if (usdc !== null && usdc > 0.005) {
    IC_BNB_ensureStableRowExists_(calculations, IC_BNB_USDC_CALC_ASSET);
    if (IC_BNB_setQuantity_(calculations, IC_BNB_USDC_CALC_ASSET, usdc)) updated.push('USDC BNB=' + usdc);
  }
  if (stock !== null && IC_BNB_setQuantity_(calculations, IC_BNB_STOCK_SYMBOL, stock)) updated.push(IC_BNB_STOCK_SYMBOL + '=' + stock);

  Logger.log('BNB sync: ' + (updated.length ? updated.join(', ') : 'изменений нет'));
  return updated.length;
}

// Последний известный баланс каждого актива из журнала BNB_WALLET_BALANCES.
function IC_BNB_readLastBalances_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var out = {};
  values.forEach(function(row) {
    var asset = String(row[0]).trim();
    if (asset) out[asset] = Number(row[1]) || 0; // последняя запись перезапишет
  });
  return out;
}

// ── Классификация движений кошелька BNB ────────────────────────────
// USDC↓ + акции↑  → Покупка (усреднение входа + аудит)
// USDC↑ + акции↓  → Продажа (вход не меняется, аудит)
// USDT↔USDC       → Обмен (нейтрально)
// стейбл без пары → Пополнение / Вывод
function IC_BNB_classifyDeltas_(calc, importSheet, prev, cur, syncStartedAt) {
  var usdcDelta = cur['USDC BNB'] === null ? 0 : (cur['USDC BNB'] || 0) - (prev['USDC BNB'] || 0);
  var usdtDelta = cur['USDT BNB'] === null ? 0 : (cur['USDT BNB'] || 0) - (prev['USDT BNB'] || 0);
  var stockDelta = cur.STOCK === null ? 0 : (cur.STOCK || 0) - (prev[IC_BNB_STOCK_SYMBOL] || 0);

  var usdcSpent = -usdcDelta;
  var impliedBuy = stockDelta > 0 ? usdcSpent / stockDelta : 0;
  if (usdcSpent > 0.5 && stockDelta > 0.000001 && impliedBuy >= 1 && impliedBuy <= 100000) {
    IC_BNB_applyStockPurchase_(calc, IC_BNB_STOCK_SYMBOL, stockDelta, usdcSpent);
    if (importSheet) IC_BNB_appendTradeAuditRow_(importSheet, 'Покупка', IC_BNB_STOCK_SYMBOL,
      stockDelta, impliedBuy, usdcSpent, 'USDC -> ' + IC_BNB_STOCK_SYMBOL, syncStartedAt);
    return;
  }

  var impliedSell = stockDelta < 0 ? usdcDelta / -stockDelta : 0;
  if (usdcDelta > 0.5 && stockDelta < -0.000001 && impliedSell >= 1 && impliedSell <= 100000) {
    if (importSheet) IC_BNB_appendTradeAuditRow_(importSheet, 'Продажа', IC_BNB_STOCK_SYMBOL,
      -stockDelta, impliedSell, usdcDelta, IC_BNB_STOCK_SYMBOL + ' -> USDC', syncStartedAt);
    return;
  }

  // Обмен стейбл-в-стейбл
  var swapTolerance = Math.max(1, Math.abs(usdcDelta) * 0.02);
  if (Math.abs(usdtDelta) > 0.5 && Math.abs(usdcDelta) > 0.5 &&
      usdtDelta * usdcDelta < 0 && Math.abs(usdtDelta + usdcDelta) <= swapTolerance) {
    if (importSheet) {
      var toAsset = usdtDelta < 0 ? 'USDC' : 'USDT';
      var toQty = usdtDelta < 0 ? usdcDelta : usdtDelta;
      var fromQty = usdtDelta < 0 ? -usdtDelta : -usdcDelta;
      IC_EVM_appendStableFlowAuditRow_(importSheet, 'Обмен', toAsset, toQty, fromQty,
        (usdtDelta < 0 ? 'USDT -> USDC' : 'USDC -> USDT') + ' (BNB)', syncStartedAt, 'BNB', IC_BNB_WALLET_ID);
    }
    return;
  }

  // Пополнение / вывод стейблов
  [['USDT', usdtDelta], ['USDC', usdcDelta]].forEach(function(pair) {
    if (Math.abs(pair[1]) > 0.5 && importSheet) {
      IC_EVM_appendStableFlowAuditRow_(importSheet,
        pair[1] > 0 ? 'Пополнение' : 'Вывод',
        pair[0], Math.abs(pair[1]), Math.abs(pair[1]),
        (pair[1] > 0 ? 'Приход ' : 'Уход ') + pair[0] + ' (BNB)', syncStartedAt, 'BNB', IC_BNB_WALLET_ID);
    }
  });
}

// Покупка акций: усреднение входа. invested = C*D + потрачено; qty = C + куплено.
function IC_BNB_applyStockPurchase_(sheet, asset, quantityBought, usdcSpent) {
  var rowIndex = IC_BNB_findAssetRow_(sheet, asset);
  if (!rowIndex) return;
  var prevQty = Number(sheet.getRange(rowIndex, 3).getValue()) || 0;
  var prevAvg = Number(sheet.getRange(rowIndex, 4).getValue()) || 0;
  var newQty = prevQty + quantityBought;
  var newAvg = newQty > 0 ? (prevQty * prevAvg + usdcSpent) / newQty : prevAvg;
  sheet.getRange(rowIndex, 3).setValue(newQty);
  sheet.getRange(rowIndex, 4).setValue(IC_BNB_round_(newAvg, 4));
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

// Аудит-строка сделки (Покупка/Продажа) в Транзакции_IMPORT, chain BNB.
function IC_BNB_appendTradeAuditRow_(sheet, action, asset, quantity, price, usdcAmount, pairLabel, syncStartedAt) {
  IC_EVM_ensureListValidationAllows_(sheet, 'F', action);
  IC_EVM_ensureListValidationAllows_(sheet, 'L', 'BNB');
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = ['BNB_BALANCE_DELTA', 'BNB', syncId, action.toUpperCase(), asset,
    IC_BNB_round_(quantity, 12)].join(':');
  if (IC_EVM_readExistingImportIds_(sheet)[importId]) return;

  IC_EVM_appendRows_(sheet, [[
    importId, 'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset, 'Акции', action, quantity, price, usdcAmount,
    'BNB wallet balance delta; учёт уже применён к Расчетам',
    IC_BNB_WALLET_ID, 'BNB', 'BALANCE_DELTA', '', 'SWAP', '',
    pairLabel, IC_BNB_round_(quantity, 12) + ' ' + asset,
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") +
      (action === 'Покупка' ? '. Средний вход усреднён автоматически.' : '. Средний вход не менялся.')
  ]]);
}

// Строка стейбла в «Расчетах» (если её нет). Без insertRow — HANDOFF §3.8.
function IC_BNB_ensureStableRowExists_(sheet, asset) {
  if (IC_BNB_findAssetRow_(sheet, asset)) return;
  IC_EVM_createStableRow_(sheet, asset);
}

function IC_BNB_round_(value, digits) {
  var factor = Math.pow(10, digits);
  return Math.round((Number(value) || 0) * factor) / factor;
}

// ── Одноразово: создать строку SPCXB в «Расчетах» ──────────────────
// Клонирует строку-образец GOLD LONG (формулы цены/стоимости/PnL едут с ней)
// и заполняет данные покупки. Идемпотентно: если SPCXB уже есть — скип.
//
// Данные покупки (2026-07-16, биржа, 2 ордера + 2 вывода в сеть BNB):
//   куплено 2×0.03726 SPCXB по 135.80/135.78  = 10.1191 USDT потрачено
//   торговый сбор 2×0.00003726 SPCXB, комиссия вывода 2×0.004 SPCXB
//   пришло на кошелёк: 0.06644548 SPCXB
//   эффективный вход (все издержки в цене): 10.1191/0.06644548 = 152.2913 $
function setupSpcxbPortfolioRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);
  if (IC_BNB_findAssetRow_(sheet, IC_BNB_STOCK_SYMBOL)) {
    Logger.log('SPCXB уже есть в Расчетах — ничего не делаю');
    return;
  }
  var templateRow = IC_BNB_findAssetRow_(sheet, 'GOLD LONG');
  if (!templateRow) throw new Error('Нет строки-образца GOLD LONG в Расчетах');

  sheet.insertRowAfter(templateRow);
  var newRow = templateRow + 1;
  var width = sheet.getLastColumn();
  sheet.getRange(templateRow, 1, 1, width).copyTo(sheet.getRange(newRow, 1, 1, width));

  sheet.getRange(newRow, 1).setValue(IC_BNB_STOCK_SYMBOL);            // A: актив
  sheet.getRange(newRow, 2).setValue('Акции');                        // B: категория
  sheet.getRange(newRow, 3).setValue(0.06644548);                     // C: количество (дальше ведёт импорт)
  sheet.getRange(newRow, 4).setValue(152.2913);                       // D: эффективный вход с комиссиями
  sheet.getRange(newRow, 5).setFormula('=C' + newRow + '*D' + newRow); // E: вложено

  // Формула цены (F): если в образце тикер захардкожен — подменяем на SPCXB.
  var priceCell = sheet.getRange(newRow, 6);
  var priceFormula = priceCell.getFormula();
  if (priceFormula && priceFormula.indexOf('GOLD') >= 0) {
    priceCell.setFormula(priceFormula.replace(/GOLD LONG|GOLD/g, IC_BNB_STOCK_SYMBOL));
  }

  Logger.log('SPCXB добавлен в Расчеты, строка ' + newRow + '. Проверь колонку F (цена) глазами.');
}

// ── Одноразово: починить формулы строки SPCXB ───────────────────────
// setupSpcxbPortfolioRow клонировал GOLD LONG, но GOLD — ФЬЮЧЕРСНАЯ строка
// (маржинальные формулы стоимости/PnL). Для спотовой акции формулы должны
// быть как у ETH: цена по имени актива из «Цены», стоимость = C×F, PnL = G−E.
// Копируем формулы колонок F..конец из спотовой строки ETH (относительные
// ссылки сами перестроятся на строку SPCXB). A–E не трогаем.
function fixSpcxbRowFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);

  var spcxbRow = IC_BNB_findAssetRow_(sheet, IC_BNB_STOCK_SYMBOL);
  if (!spcxbRow) throw new Error('Нет строки SPCXB — сначала setupSpcxbPortfolioRow');
  var templateRow = IC_BNB_findAssetRow_(sheet, 'ETH');
  if (!templateRow) throw new Error('Нет спотовой строки-образца ETH в Расчетах');

  // Только F..K (цена..примечание). Правее K начинаются СЛУЖЕБНЫЕ блоки листа
  // (L-O агрегаты, W-X фьючерсный учёт) — копировать туда нельзя (инцидент 2026-07-16).
  var fromCol = 6;  // F
  var toCol = 11;   // K
  sheet.getRange(templateRow, fromCol, 1, toCol - fromCol + 1)
       .copyTo(sheet.getRange(spcxbRow, fromCol, 1, toCol - fromCol + 1));

  // Учёт по решению владельца (2026-07-16): вход = биржевой средний 135.79
  // (10.1191 USDT / 0.07452 куплено), комиссии за кадром. Дальше покупки
  // планируются напрямую в сети BNB — там издержки ниже.
  sheet.getRange(spcxbRow, 4).setValue(135.79);

  Logger.log('SPCXB (строка ' + spcxbRow + '): спотовые формулы ETH применены, ' +
             'вход 135.79 (биржевой). Цена ищется по имени SPCXB в «Цены».');
}

// Одноразовый ремонт последствий вставки строки SPCXB (2026-07-16):
// 1) вставка строки 13 сдвинула служебный W/X-блок «Расчетов» и таблицу L-O;
// 2) старая копия fixSpcxbRowFormulas намусорила в L13..X13;
// 3) авто-перезапись IC_HL_refreshPortfolioAccounting_ записала формулы
//    с запятыми-разделителями -> #ERROR! по всему «Обзору»/«Риску» (русская
//    локаль документа требует ";").
// Функция идемпотентна: чистит мусор, выравнивает подписи W, принудительно
// перезаписывает все формулы учёта в правильном (";") формате.
function repairSpcxbInsertSideEffects() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);

  var spcxbRow = IC_BNB_findAssetRow_(sheet, IC_BNB_STOCK_SYMBOL);
  if (spcxbRow) {
    // Всё правее K в строке SPCXB — мусор от старого копирования строки ETH.
    var lastCol = sheet.getLastColumn();
    if (lastCol > 11) sheet.getRange(spcxbRow, 12, 1, lastCol - 11).clearContent();
  }

  // Подписи W13:W33 как до вставки строки (сдвинулись на 1 вниз).
  var wLabels = [
    '', '', 'goldCurrentValue', 'goldPnl', 'futuresExcess',
    'futuresRebalanceAction', 'hlBalanceForReconciliation', 'hlBalanceShareForInfo',
    'hlCurrentForReconciliation', 'specFuturesExcess', '',
    'btcCurrentMargin', 'hlFreeAvailable', 'btcUnrealizedPnl', 'btcCurrentNotional',
    'totalStableReserve', 'spotStableReserve', 'hlFreeStableReserve',
    'cashBreakdownCheck', '', ''
  ];
  sheet.getRange(13, 23, wLabels.length, 1).setValues(wLabels.map(function(l) { return [l]; }));

  // Ячейки X, которые учёт не пишет: чистим осколки сдвига.
  [13, 14, 23, 33].forEach(function(row) {
    sheet.getRange(row, 24).clearContent();
  });

  // Принудительная перезапись всех формул учёта в ";"-формате.
  IC_HL_refreshPortfolioAccounting_(ss, true);

  Logger.log('Ремонт выполнен: строка SPCXB очищена правее K, W/X-блок выровнен, ' +
             'формулы Обзор/Риск/Расчеты перезаписаны с ";".');
  return 'OK';
}

// Одноразово: нажать ▶ Run — поставит синк каждые 30 минут (идемпотентно).
function installBnbWalletBalanceTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncBnbWalletBalances') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncBnbWalletBalances').timeBased().everyMinutes(30).create();
  Logger.log('Триггер syncBnbWalletBalances установлен — каждые 30 минут');
}

// ── «Расчеты»: только количество, avgEntry не трогаем ─────────────
function IC_BNB_setQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_BNB_findAssetRow_(sheet, asset);
  if (!rowIndex) {
    Logger.log('BNB sync: строки "' + asset + '" нет в Расчетах — добавьте её вручную (колонка A)');
    return false;
  }
  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
  return true;
}

function IC_BNB_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var target = String(asset).replace(/\s+/g, ' ').trim().toUpperCase();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]).replace(/\s+/g, ' ').trim().toUpperCase() === target) return i + 1;
  }
  return 0;
}

function IC_BNB_assertSane_(asset, quantity, limit) {
  if (!isFinite(quantity) || quantity < 0 || quantity > limit) {
    throw new Error('Unsafe BNB balance for ' + asset + ': ' + quantity + '. Sync stopped.');
  }
}

// ── История балансов (для отладки/аудита), держим последние 500 строк ──
function IC_BNB_getOrCreateBalancesSheet_(ss) {
  var sheet = ss.getSheetByName(IC_BNB_BALANCES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(IC_BNB_BALANCES_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([[
      'Asset', 'Quantity', 'Contract', 'Synced At', 'Chain ID'
    ]]);
  }
  return sheet;
}

function IC_BNB_appendBalanceRow_(sheet, asset, quantity, contract, syncAt) {
  sheet.appendRow([asset, quantity, contract, syncAt, IC_BNB_CHAIN_ID]);
  var extra = sheet.getLastRow() - 501; // 1 заголовок + 500 строк истории
  if (extra > 0) sheet.deleteRows(2, extra);
}

// ── RPC с failover и ретраями (паттерн Solana) ────────────────────
function IC_BNB_fetchErc20Balance_(address, contractAddress, decimals) {
  var data = '0x70a08231' + '000000000000000000000000' + address.replace(/^0x/, '').toLowerCase();
  var result = IC_BNB_rpcCall_('eth_call', [{ to: contractAddress, data: data }, 'latest']);
  if (result === null) return null;
  return IC_BNB_hexUnits_(result, decimals);
}

function IC_BNB_rpcCall_(method, params) {
  var payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
  for (var urlIndex = 0; urlIndex < IC_BNB_RPC_URLS.length; urlIndex += 1) {
    for (var attempt = 1; attempt <= 2; attempt += 1) {
      try {
        var response = UrlFetchApp.fetch(IC_BNB_RPC_URLS[urlIndex], {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          payload: payload
        });
        var code = response.getResponseCode();
        if (code < 200 || code >= 300) { Utilities.sleep(300 * attempt); continue; }
        var json = JSON.parse(response.getContentText());
        if (json.error) { Utilities.sleep(300 * attempt); continue; }
        return json.result;
      } catch (e) {
        Utilities.sleep(300 * attempt);
      }
    }
  }
  return null; // все ноды недоступны — вызывающий обязан скипнуть, не писать 0
}

function IC_BNB_hexUnits_(hex, decimals) {
  if (!hex || hex === '0x') return 0;
  var value = parseInt(hex, 16);
  if (!isFinite(value)) return null;
  return value / Math.pow(10, decimals);
}


// ── Одноразовый бэкфил 2026-07-17: покупка SPCXB на Uniswap (BNB) прошла
// до внедрения дельта-классификации. Пересчитывает средний вход и пишет
// летопись: Пополнение USDC (мост с Arbitrum) + Покупка SPCXB.
// Идемпотентно: если вход уже усреднён (D < 135) — учёт не трогаем повторно.
function backfillBnbSpcxbPurchase20260717() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calc = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  var importSheet = ss.getSheetByName(IC_BNB_IMPORT_SHEET);
  var at = new Date();
  var boughtQty = 0.0850;
  var usdcSpent = 10.8516;
  var log = [];

  var rowIndex = IC_BNB_findAssetRow_(calc, IC_BNB_STOCK_SYMBOL);
  if (!rowIndex) throw new Error('Нет строки SPCXB');
  var d = Number(calc.getRange(rowIndex, 4).getValue()) || 0;
  if (d > 135) {
    IC_BNB_applyStockPurchase_(calc, IC_BNB_STOCK_SYMBOL, boughtQty, usdcSpent);
    log.push('вход усреднён: ' + calc.getRange(rowIndex, 4).getValue());
  } else {
    log.push('вход уже усреднён (' + d + '), учёт не трогаю');
  }

  IC_EVM_appendStableFlowAuditRow_(importSheet, 'Пополнение', 'USDC',
    10.8516, 10.8516, 'Мост Arbitrum -> BNB (задним числом)', at, 'BNB', IC_BNB_WALLET_ID);
  IC_BNB_appendTradeAuditRow_(importSheet, 'Покупка', IC_BNB_STOCK_SYMBOL,
    boughtQty, usdcSpent / boughtQty, usdcSpent, 'USDC -> SPCXB (Uniswap V4, задним числом)', at);
  log.push('аудит-строки записаны');
  return log.join('; ');
}
