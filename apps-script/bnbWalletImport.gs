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

// Нативный BNB (газовый токен сети BNB Chain) — крипто-позиция, лимит 10%.
// Покупка обычно кросс-чейн (USDC ушёл на Arbitrum через мост Aori), поэтому
// локального USDC↓ на BNB-цепи нет — цену для суммы берём из листа «Цены»
// (его наполняет HL-синк по primaryMids['BNB'], как GRAM/ATOM/GOLD/SPCXB).
// Приход BNB (сверх газового шума) классифицируем как «Покупка BNB».
// BNB↓ игнорируем (это газ на транзакции, не продажа).
var IC_BNB_NATIVE_SYMBOL = 'BNB';
var IC_BNB_NATIVE_MIN_USD = 0.5; // ниже — газовый шум, не сделка
var IC_BNB_PRICES_SHEET = 'Цены';

// Максимально правдоподобные количества — защита от мусорного ответа RPC.
var IC_BNB_SANE_LIMITS = { 'USDT BNB': 100000, 'USDC BNB': 100000, STOCK: 1000000, BNB: 100000 };

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

  // Нативный BNB (газовый токен = крипто-позиция)
  var bnb = IC_BNB_fetchNativeBalance_(IC_BNB_WALLET_ADDRESS);
  if (bnb !== null) {
    IC_BNB_assertSane_(IC_BNB_NATIVE_SYMBOL, bnb, IC_BNB_SANE_LIMITS.BNB);
    IC_BNB_appendBalanceRow_(balances, IC_BNB_NATIVE_SYMBOL, bnb, 'NATIVE', syncAt);
  } else {
    Logger.log('BNB sync: нативный BNB RPC не ответил — скип');
  }

  // ── Классификация дельт (до записи количеств) ──
  var hasPrev = prev && Object.keys(prev).length > 0;
  if (hasPrev) {
    IC_BNB_classifyDeltas_(calculations, importSheet, prev, {
      'USDT BNB': usdt, 'USDC BNB': usdc, STOCK: stock, BNB: bnb
    }, syncStartedAt);
  }

  // ── Количества в «Расчеты» (истина остаётся он-чейн) ──
  if (usdt !== null && IC_BNB_setQuantity_(calculations, 'USDT BNB', usdt)) updated.push('USDT BNB=' + usdt);
  if (usdc !== null && usdc > 0.005) {
    IC_BNB_ensureStableRowExists_(calculations, IC_BNB_USDC_CALC_ASSET);
    if (IC_BNB_setQuantity_(calculations, IC_BNB_USDC_CALC_ASSET, usdc)) updated.push('USDC BNB=' + usdc);
  }
  if (stock !== null && IC_BNB_setQuantity_(calculations, IC_BNB_STOCK_SYMBOL, stock)) updated.push(IC_BNB_STOCK_SYMBOL + '=' + stock);
  if (bnb !== null && IC_BNB_setQuantity_(calculations, IC_BNB_NATIVE_SYMBOL, bnb)) updated.push('BNB=' + bnb);

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

  // ── Нативный BNB: приход → «Покупка BNB» по цене из «Цены» (HL) ──
  // Покупка кросс-чейн (USDC ушёл на Arbitrum), локального USDC↓ нет — цену
  // берём из листа «Цены» (HL-синк). BNB↓ игнорируем (газ, не продажа). Средний
  // вход усредняется; строка попадает в отчёты и запускает кулдаун стратегии
  // (сумма совпадёт со ступенью откупа). Не return — стейбл-потоки независимы.
  var bnbDelta = cur.BNB === null ? 0 : (cur.BNB || 0) - (prev.BNB || 0);
  if (bnbDelta > 0.000001) {
    var bnbPrice = IC_BNB_readHlPrice_(IC_BNB_NATIVE_SYMBOL);
    var bnbUsd = bnbPrice ? bnbDelta * bnbPrice : 0;
    if (bnbPrice && bnbUsd >= IC_BNB_NATIVE_MIN_USD) {
      IC_LEDGER_averageInPurchase_(calc, IC_BNB_NATIVE_SYMBOL, bnbDelta, bnbUsd);
      if (importSheet) IC_LEDGER_appendTradeRow_(importSheet, {
        action: 'Покупка', asset: IC_BNB_NATIVE_SYMBOL, category: 'Крипта',
        quantity: bnbDelta, price: bnbPrice, amount: bnbUsd,
        pairLabel: 'Приход BNB (мост/DEX)', syncStartedAt: syncStartedAt,
        chain: 'BNB', walletId: IC_BNB_WALLET_ID });
    } else {
      Logger.log('BNB sync: приход BNB ' + bnbDelta + ' — цена недоступна/ниже порога, покупку не пишу');
    }
  }

  var usdcSpent = -usdcDelta;
  var impliedBuy = stockDelta > 0 ? usdcSpent / stockDelta : 0;
  if (usdcSpent > 0.5 && stockDelta > 0.000001 && impliedBuy >= 1 && impliedBuy <= 100000) {
    IC_LEDGER_averageInPurchase_(calc, IC_BNB_STOCK_SYMBOL, stockDelta, usdcSpent);
    if (importSheet) IC_LEDGER_appendTradeRow_(importSheet, {
      action: 'Покупка', asset: IC_BNB_STOCK_SYMBOL, category: 'Акции',
      quantity: stockDelta, price: impliedBuy, amount: usdcSpent,
      pairLabel: 'USDC -> ' + IC_BNB_STOCK_SYMBOL, syncStartedAt: syncStartedAt,
      chain: 'BNB', walletId: IC_BNB_WALLET_ID });
    return;
  }

  var impliedSell = stockDelta < 0 ? usdcDelta / -stockDelta : 0;
  if (usdcDelta > 0.5 && stockDelta < -0.000001 && impliedSell >= 1 && impliedSell <= 100000) {
    if (importSheet) IC_LEDGER_appendTradeRow_(importSheet, {
      action: 'Продажа', asset: IC_BNB_STOCK_SYMBOL, category: 'Акции',
      quantity: -stockDelta, price: impliedSell, amount: usdcDelta,
      pairLabel: IC_BNB_STOCK_SYMBOL + ' -> USDC', syncStartedAt: syncStartedAt,
      chain: 'BNB', walletId: IC_BNB_WALLET_ID });
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
      IC_LEDGER_appendStableFlowRow_(importSheet, {
        action: 'Обмен', asset: toAsset, quantity: toQty, usdAmount: fromQty,
        pairLabel: (usdtDelta < 0 ? 'USDT -> USDC' : 'USDC -> USDT') + ' (BNB)',
        syncStartedAt: syncStartedAt, chain: 'BNB', walletId: IC_BNB_WALLET_ID });
    }
    return;
  }

  // Пополнение / вывод стейблов
  [['USDT', usdtDelta], ['USDC', usdcDelta]].forEach(function(pair) {
    if (Math.abs(pair[1]) > 0.5 && importSheet) {
      IC_LEDGER_appendStableFlowRow_(importSheet, {
        action: pair[1] > 0 ? 'Пополнение' : 'Вывод',
        asset: pair[0], quantity: Math.abs(pair[1]), usdAmount: Math.abs(pair[1]),
        pairLabel: (pair[1] > 0 ? 'Приход ' : 'Уход ') + pair[0] + ' (BNB)',
        syncStartedAt: syncStartedAt, chain: 'BNB', walletId: IC_BNB_WALLET_ID });
    }
  });
}

// Строка стейбла в «Расчетах» (если её нет) — общее ядро (walletLedger).
function IC_BNB_ensureStableRowExists_(sheet, asset) {
  IC_LEDGER_ensureStableRow_(sheet, asset);
}

function IC_BNB_round_(value, digits) {
  return IC_LEDGER_round_(value, digits);
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

// ── Одноразово: строка BNB в «Расчетах» (категория «Крипта») ───────
// БЕЗ insertRow — переиспользуем первую пустую строку (как createStableRow_),
// чтобы не сдвигать служебные блоки L-O/W-X (инцидент 2026-07-16 с SPCXB).
// Формулы F..K копируем со спотовой строки ETH (цена по имени из «Цены»).
// Количество ведёт импорт; средний вход усредняется при первой покупке.
// Строку BNB в лист «Цены» заводит HL-синк цен (primaryMids['BNB']) —
// вручную «Цены» трогать не нужно, достаточно один раз прогнать HL-синк.
function setupBnbPortfolioRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);
  if (IC_BNB_findAssetRow_(sheet, IC_BNB_NATIVE_SYMBOL)) {
    Logger.log('BNB уже есть в Расчетах — ничего не делаю');
    return;
  }
  var ethRow = IC_BNB_findAssetRow_(sheet, 'ETH');
  if (!ethRow) throw new Error('Нет спотовой строки-образца ETH в Расчетах');

  var lastRow = sheet.getLastRow();
  var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var blankRow = 0;
  for (var i = 0; i < colA.length; i += 1) {
    if (String(colA[i][0]).trim() === '') { blankRow = i + 2; break; }
  }
  if (!blankRow) {
    Logger.log('BNB setup: нет пустой строки в Расчетах — добавь строку BNB вручную ' +
               '(A=BNB, B=Крипта, C=0, D=0), потом скопируй формулы F..K со строки ETH.');
    return;
  }

  sheet.getRange(blankRow, 1).setValue(IC_BNB_NATIVE_SYMBOL);                 // A актив
  sheet.getRange(blankRow, 2).setValue('Крипта');                            // B категория
  sheet.getRange(blankRow, 3).setValue(0);                                   // C количество (ведёт импорт)
  sheet.getRange(blankRow, 4).setValue(0);                                   // D средний вход (усреднится)
  sheet.getRange(blankRow, 5).setFormula('=C' + blankRow + '*D' + blankRow); // E вложено
  // F..K — спотовые формулы ETH (правее K служебные блоки, копировать нельзя).
  sheet.getRange(ethRow, 6, 1, 6).copyTo(sheet.getRange(blankRow, 6, 1, 6));

  Logger.log('BNB добавлен в Расчеты, строка ' + blankRow + ' (спотовые формулы ETH). ' +
             'ДАЛЬШЕ: прогони HL-синк цен (заведёт BNB в «Цены» по primaryMids), ' +
             'затем syncBnbWalletBalances. Проверь колонку F глазами.');
}

// ── Одноразово: зафиксировать текущий BNB как покупку ──────────────
// Нужно, когда приход BNB прошёл мимо дельта-детекции (первый синк без цены в
// «Цены», дельта «съелась»). Ставит средний вход, пишет строку «Покупка BNB»
// в отчёты (→ запускает кулдаун ступени стратегии) и НЕ трогает количество.
// Требует: строка BNB в «Расчетах» (setupBnbPortfolioRow) + цена BNB в «Цены»
// (syncHyperliquidAccountState). Идемпотентно: если средний вход уже задан — скип.
function initBnbPositionFromChain() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calc = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!calc) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);
  var row = IC_BNB_findAssetRow_(calc, IC_BNB_NATIVE_SYMBOL);
  if (!row) throw new Error('Нет строки BNB в «Расчетах» — сначала setupBnbPortfolioRow');

  var qty = Number(calc.getRange(row, 3).getValue()) || 0;
  var avg = Number(calc.getRange(row, 4).getValue()) || 0;
  if (avg > 0) { Logger.log('BNB: средний вход уже задан (' + avg + ') — ничего не делаю'); return; }
  if (qty <= 0) { Logger.log('BNB: количество 0 — сначала syncBnbWalletBalances'); return; }

  var price = IC_BNB_readHlPrice_(IC_BNB_NATIVE_SYMBOL);
  if (!price) throw new Error('Нет цены BNB в листе «Цены» — сначала syncHyperliquidAccountState');

  var amount = qty * price;
  // Средний вход = текущая цена (приближение — фактическая покупка была рядом).
  calc.getRange(row, 4).setValue(IC_LEDGER_round_(price, 4));
  calc.getRange(row, 5).setFormula('=C' + row + '*D' + row);

  var importSheet = ss.getSheetByName(IC_BNB_IMPORT_SHEET);
  if (importSheet) IC_LEDGER_appendTradeRow_(importSheet, {
    action: 'Покупка', asset: IC_BNB_NATIVE_SYMBOL, category: 'Крипта',
    quantity: qty, price: price, amount: amount,
    pairLabel: 'Инициализация BNB (приход через мост)', syncStartedAt: new Date(),
    chain: 'BNB', walletId: IC_BNB_WALLET_ID });

  Logger.log('BNB инициализирован: qty=' + qty + ', вход=' + price + ', сумма=' + amount.toFixed(2) +
             '$. Строка «Покупка BNB» записана — кулдаун запустится. ' +
             'Если знаешь точную цену покупки — поправь D' + row + ' вручную.');
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

// Нативный баланс BNB (eth_getBalance, 18 знаков). null → RPC не ответил, скип.
function IC_BNB_fetchNativeBalance_(address) {
  var result = IC_BNB_rpcCall_('eth_getBalance', [address, 'latest']);
  if (result === null) return null;
  return IC_BNB_hexUnits_(result, 18);
}

// Цена BNB из листа «Цены» (колонка C, наполняет HL-синк). null → цены нет.
function IC_BNB_readHlPrice_(asset) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IC_BNB_PRICES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues(); // A..C
  var target = String(asset).trim().toUpperCase();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toUpperCase() === target) {
      var price = Number(values[i][2]);
      return isFinite(price) && price > 0 ? price : null;
    }
  }
  return null;
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


