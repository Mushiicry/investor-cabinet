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

// Максимально правдоподобные количества — защита от мусорного ответа RPC.
var IC_BNB_SANE_LIMITS = { 'USDT BNB': 100000, STOCK: 1000000 };

function setupBnbWalletImport() {
  IC_BNB_getOrCreateBalancesSheet_(SpreadsheetApp.getActiveSpreadsheet());
}

function syncBnbWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calculations = ss.getSheetByName(IC_BNB_CALCULATIONS_SHEET);
  if (!calculations) throw new Error('Missing sheet: ' + IC_BNB_CALCULATIONS_SHEET);
  var balances = IC_BNB_getOrCreateBalancesSheet_(ss);
  var syncAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  var updated = [];

  // USDT (BSC) → 'USDT BNB'
  var usdt = IC_BNB_fetchErc20Balance_(IC_BNB_WALLET_ADDRESS, IC_BNB_USDT_CONTRACT, 18);
  if (usdt !== null) {
    IC_BNB_assertSane_('USDT BNB', usdt, IC_BNB_SANE_LIMITS['USDT BNB']);
    if (IC_BNB_setQuantity_(calculations, 'USDT BNB', usdt)) updated.push('USDT BNB=' + usdt);
    IC_BNB_appendBalanceRow_(balances, 'USDT BNB', usdt, IC_BNB_USDT_CONTRACT, syncAt);
  } else {
    Logger.log('BNB sync: USDT RPC не ответил — скип (позицию не трогаем)');
  }

  // Токен акций → строка тикера
  if (IC_BNB_STOCK_CONTRACT) {
    var stock = IC_BNB_fetchErc20Balance_(IC_BNB_WALLET_ADDRESS, IC_BNB_STOCK_CONTRACT, IC_BNB_STOCK_DECIMALS);
    if (stock !== null) {
      IC_BNB_assertSane_(IC_BNB_STOCK_SYMBOL, stock, IC_BNB_SANE_LIMITS.STOCK);
      if (IC_BNB_setQuantity_(calculations, IC_BNB_STOCK_SYMBOL, stock)) updated.push(IC_BNB_STOCK_SYMBOL + '=' + stock);
      IC_BNB_appendBalanceRow_(balances, IC_BNB_STOCK_SYMBOL, stock, IC_BNB_STOCK_CONTRACT, syncAt);
    } else {
      Logger.log('BNB sync: ' + IC_BNB_STOCK_SYMBOL + ' RPC не ответил — скип');
    }
  }

  Logger.log('BNB sync: ' + (updated.length ? updated.join(', ') : 'изменений нет'));
  return updated.length;
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

  var width = sheet.getLastColumn();
  var fromCol = 6; // F: цена и всё правее
  sheet.getRange(templateRow, fromCol, 1, width - fromCol + 1)
       .copyTo(sheet.getRange(spcxbRow, fromCol, 1, width - fromCol + 1));

  Logger.log('SPCXB (строка ' + spcxbRow + '): формулы F..' + width +
             ' скопированы со спотовой ETH. Цена теперь ищется по имени SPCXB в «Цены».');
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
