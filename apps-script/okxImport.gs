// ─── OKX CEX Trade Sync ──────────────────────────────────────────────────────
//
// ПЕРВОНАЧАЛЬНАЯ НАСТРОЙКА (один раз):
//   1. Extensions → Apps Script → Project Settings → Script Properties
//   2. Добавь три ключа:
//        OKX_API_KEY     = твой API Key
//        OKX_SECRET_KEY  = твой Secret Key
//        OKX_PASSPHRASE  = твой Passphrase
//   3. Запусти setupOkxConnection() — убедись что в логах "OKX connection OK"
//   4. Запусти syncOkxTrades() вручную первый раз
//   5. После этого он вызывается автоматически из syncInvestorCabinetWallets

var IC_OKX_BASE_URL = 'https://www.okx.com';
var IC_OKX_IMPORT_SHEET = 'Транзакции_IMPORT';
var IC_OKX_CALCS_SHEET = 'Расчеты';
var IC_OKX_LOG_SHEET = 'OKX_SYNC_LOG';
var IC_OKX_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

// ─── Аутентификация OKX ──────────────────────────────────────────────────────

function IC_OKX_getCredentials_() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('OKX_API_KEY');
  var secretKey = props.getProperty('OKX_SECRET_KEY');
  var passphrase = props.getProperty('OKX_PASSPHRASE');

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error(
      'OKX credentials missing. ' +
      'Добавь OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE в Script Properties.'
    );
  }

  return { apiKey: apiKey, secretKey: secretKey, passphrase: passphrase };
}

function IC_OKX_sign_(timestamp, method, requestPath, secretKey) {
  var message = timestamp + method.toUpperCase() + requestPath;
  var signature = Utilities.computeHmacSha256Signature(message, secretKey);
  return Utilities.base64Encode(signature);
}

function IC_OKX_request_(method, path) {
  var creds = IC_OKX_getCredentials_();
  var timestamp = new Date().toISOString();
  var signature = IC_OKX_sign_(timestamp, method, path, creds.secretKey);

  var response = UrlFetchApp.fetch(IC_OKX_BASE_URL + path, {
    method: method,
    headers: {
      'OK-ACCESS-KEY':       creds.apiKey,
      'OK-ACCESS-SIGN':      signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': creds.passphrase,
      'Content-Type':        'application/json'
    },
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('OKX API HTTP error ' + statusCode + ': ' + response.getContentText().slice(0, 200));
  }

  var json = JSON.parse(response.getContentText());
  if (json.code && json.code !== '0') {
    throw new Error('OKX API error code ' + json.code + ': ' + json.msg);
  }

  return json;
}

// ─── Проверка соединения ──────────────────────────────────────────────────────

function setupOkxConnection() {
  try {
    var result = IC_OKX_request_('GET', '/api/v5/account/balance');
    Logger.log('✅ OKX connection OK. Валюты: ' +
      (result.data && result.data[0] && result.data[0].details
        ? result.data[0].details.map(function(d) { return d.ccy; }).join(', ')
        : 'нет данных')
    );
    return true;
  } catch (e) {
    Logger.log('❌ OKX connection FAILED: ' + e.message);
    return false;
  }
}

// ─── Получение сделок с OKX ──────────────────────────────────────────────────

function IC_OKX_fetchSpotFills_() {
  var result = IC_OKX_request_('GET', '/api/v5/trade/fills-history?instType=SPOT&limit=100');
  return (result && Array.isArray(result.data)) ? result.data : [];
}

// ─── Нормализация тикера OKX → тикер портфеля ────────────────────────────────

function IC_OKX_normalizeAsset_(instId) {
  return String(instId || '')
    .replace(/-USDT$/, '')
    .replace(/-USDC$/, '')
    .replace(/-BTC$/, '')
    .replace(/-ETH$/, '')
    .toUpperCase();
}

// ─── Строка для Транзакции_IMPORT ─────────────────────────────────────────────
// Колонки (19 штук) совпадают со схемой, которую читает autoMarkFearGreedFromRecentStrategyImport:
// [0]importId [1]walletId [2]date [3]asset [4]quantity [5]action
// [6]category [7]assetPrice [8]amount [9]comment [10]fee [11]chain
// [12-17]reserved [18]note (ISO-дата для parseFearGreedImportDate)

function IC_OKX_buildImportRow_(fill) {
  var tradeId  = String(fill.tradeId || fill.billId || '');
  var importId = 'OKX_SPOT_TRADE_' + tradeId;
  var asset    = IC_OKX_normalizeAsset_(fill.instId);
  var side     = String(fill.side || '');
  var action   = side === 'buy' ? 'Покупка' : 'Продажа';
  var qty      = parseFloat(fill.fillSz) || 0;
  var price    = parseFloat(fill.fillPx) || 0;
  var amount   = Math.round(qty * price * 100) / 100;
  var fee      = Math.abs(parseFloat(fill.fee) || 0);
  var ts       = parseInt(fill.ts, 10) || Date.now();
  var date     = new Date(ts);
  var dateStr  = Utilities.formatDate(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");

  return [
    importId,                                   // [0]  importId
    'okx-spot',                                 // [1]  источник
    dateStr,                                    // [2]  дата сделки
    asset,                                      // [3]  актив
    qty,                                        // [4]  количество
    action,                                     // [5]  Покупка / Продажа
    'Крипта',                                  // [6]  категория
    price,                                      // [7]  цена актива
    amount,                                     // [8]  сумма в USD
    'OKX spot: ' + fill.instId + ' ' + side,   // [9]  комментарий
    fee,                                        // [10] комиссия
    'OKX',                                      // [11] chain/биржа
    '', '', '', '', '', '',                     // [12-17] зарезервировано
    dateStr                                     // [18] note (для parseFearGreedImportDate)
  ];
}

// ─── Обновление позиции в Расчеты (средняя + количество) ──────────────────────

function IC_OKX_updateCalculationsPosition_(sheet, asset, addedQty, addedPrice) {
  if (!sheet || !asset || !addedQty || !addedPrice) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return false;

  var lastCol = sheet.getLastColumn();
  var allValues = sheet.getRange(1, 1, lastRow, Math.max(lastCol, 5)).getValues();
  var headers = allValues[0].map(function(h) { return String(h || '').trim().toLowerCase(); });

  // Ищем индексы колонок по заголовку
  var colAsset    = IC_OKX_findCol_(headers, ['asset', 'актив', 'ticker', 'тикер'], 0);
  var colAvgEntry = IC_OKX_findCol_(headers, ['avgentry', 'средняя входа', 'средняя', 'avg entry'], 1);
  var colQty      = IC_OKX_findCol_(headers, ['quantity', 'количество', 'qty'], 2);

  var normalizedAsset = asset.toUpperCase();

  for (var i = 1; i < allValues.length; i += 1) {
    var rowAsset = String(allValues[i][colAsset] || '').trim().toUpperCase();
    if (rowAsset !== normalizedAsset) continue;

    var rowIndex = i + 1; // 1-based
    var oldQty      = IC_OKX_toNum_(allValues[i][colQty]);
    var oldAvgEntry = IC_OKX_toNum_(allValues[i][colAvgEntry]);

    var newQty      = oldQty + addedQty;
    var newAvgEntry = newQty > 0
      ? (oldQty * oldAvgEntry + addedQty * addedPrice) / newQty
      : addedPrice;

    newQty      = Math.round(newQty * 1000000) / 1000000;
    newAvgEntry = Math.round(newAvgEntry * 10000) / 10000;

    sheet.getRange(rowIndex, colAvgEntry + 1).setValue(newAvgEntry);
    sheet.getRange(rowIndex, colQty + 1).setValue(newQty);

    Logger.log(
      'OKX position update — ' + asset +
      ': qty ' + oldQty + ' → ' + newQty +
      ', avgEntry ' + oldAvgEntry + ' → ' + newAvgEntry
    );
    return true;
  }

  Logger.log('OKX: asset "' + asset + '" not found in ' + IC_OKX_CALCS_SHEET + ', position not updated');
  return false;
}

function IC_OKX_findCol_(headers, aliases, fallback) {
  for (var i = 0; i < headers.length; i += 1) {
    if (aliases.indexOf(headers[i]) >= 0) return i;
  }
  return fallback;
}

function IC_OKX_toNum_(value) {
  var parsed = parseFloat(String(value || '0').replace(',', '.').replace(/\s/g, ''));
  return isFinite(parsed) ? parsed : 0;
}

// ─── Главный синк ─────────────────────────────────────────────────────────────

function syncOkxTrades() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var importSheet = ss.getSheetByName(IC_OKX_IMPORT_SHEET);
  var calcsSheet  = ss.getSheetByName(IC_OKX_CALCS_SHEET);

  if (!importSheet) {
    IC_OKX_log_(ss, 'ERROR: sheet "' + IC_OKX_IMPORT_SHEET + '" not found');
    return;
  }

  var fills = IC_OKX_fetchSpotFills_();
  if (!fills.length) {
    IC_OKX_log_(ss, 'OKX: no fills returned');
    return;
  }

  // Существующие importId чтобы не дублировать
  var lastRow = importSheet.getLastRow();
  var existingIds = {};
  if (lastRow >= 2) {
    importSheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id) existingIds[id] = true;
    });
  }

  var newRows = [];
  var strategyBuys = [];  // покупки в диапазоне стратегии
  var positionUpdates = []; // все покупки для обновления позиций

  fills.forEach(function(fill) {
    var tradeId  = String(fill.tradeId || fill.billId || '');
    var importId = 'OKX_SPOT_TRADE_' + tradeId;
    if (existingIds[importId]) return;

    // Фильтр: только свежие сделки (защита от старых при первом запуске)
    var ts = parseInt(fill.ts, 10) || 0;
    if (ts && (Date.now() - ts) > IC_OKX_LOOKBACK_MS) return;

    var row = IC_OKX_buildImportRow_(fill);
    newRows.push(row);

    if (String(fill.side) === 'buy') {
      var asset  = IC_OKX_normalizeAsset_(fill.instId);
      var qty    = parseFloat(fill.fillSz) || 0;
      var price  = parseFloat(fill.fillPx) || 0;
      var amount = Math.round(qty * price * 100) / 100;
      var date   = new Date(parseInt(fill.ts, 10) || Date.now());

      positionUpdates.push({ asset: asset, qty: qty, price: price, amount: amount, date: date });
      strategyBuys.push({ amount: amount, date: date });
    }
  });

  // 1. Записываем новые строки в Транзакции_IMPORT
  if (newRows.length) {
    var insertAt = Math.max(importSheet.getLastRow(), 1) + 1;
    importSheet.getRange(insertAt, 1, newRows.length, 19).setValues(newRows);
  }

  // 2. Обновляем позиции в Расчеты (avgEntry + qty)
  if (calcsSheet && positionUpdates.length) {
    positionUpdates.forEach(function(upd) {
      IC_OKX_updateCalculationsPosition_(calcsSheet, upd.asset, upd.qty, upd.price);
    });
  }

  // 3. Отмечаем стратегические покупки (F&G cooldown)
  strategyBuys.forEach(function(buy) {
    try {
      var result = markFearGreedStrategyBuy(ss, buy.amount, buy.date);
      Logger.log('OKX F&G mark: amount=' + buy.amount + ' → ' + JSON.stringify(result));
    } catch (e) {
      Logger.log('OKX F&G mark error: ' + e.message);
    }
  });

  var msg = 'OKX sync: ' + newRows.length + ' new trades, ' + positionUpdates.length + ' position updates';
  IC_OKX_log_(ss, msg);
  Logger.log(msg);

  return { newTrades: newRows.length, positionUpdates: positionUpdates.length };
}

// ─── Лог ─────────────────────────────────────────────────────────────────────

function IC_OKX_log_(ss, message) {
  var logSheet = ss.getSheetByName(IC_OKX_LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(IC_OKX_LOG_SHEET);
    logSheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
  }

  logSheet.appendRow([Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd HH:mm:ss"), message]);

  // Держим не более 500 строк
  var total = logSheet.getLastRow();
  if (total > 502) logSheet.deleteRows(2, total - 502);
}
