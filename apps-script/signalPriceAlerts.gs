var IC_SIGNAL_ALERT_SPREADSHEET_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
var IC_SIGNAL_ALERT_SHEET = 'Сигналы';
var IC_SIGNAL_ALERT_INFO_URL = 'https://api.hyperliquid.xyz/info';
var IC_SIGNAL_ALERT_HANDLER = 'syncSignalPriceAlerts';

function setupSignalPriceAlertTelegram(token, chatId) {
  if (!token) throw new Error('Missing Telegram bot token');
  if (!chatId) throw new Error('Missing Telegram chat id');

  PropertiesService.getScriptProperties().setProperties({
    TELEGRAM_BOT_TOKEN: String(token),
    TELEGRAM_CHAT_ID: String(chatId)
  });

  return {
    ok: true,
    telegramConfigured: true,
    chatId: String(chatId)
  };
}

function installSignalPriceAlertTrigger() {
  removeSignalPriceAlertTrigger();

  ScriptApp.newTrigger(IC_SIGNAL_ALERT_HANDLER)
    .timeBased()
    .everyMinutes(1)
    .create();

  return auditSignalPriceAlertConfig();
}

function removeSignalPriceAlertTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === IC_SIGNAL_ALERT_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  return { ok: true, removed: true };
}

function auditSignalPriceAlertConfig() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(IC_SIGNAL_ALERT_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(IC_SIGNAL_ALERT_SHEET);
  var triggerCount = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === IC_SIGNAL_ALERT_HANDLER;
  }).length;

  return {
    ok: true,
    sheetFound: !!sheet,
    signalRows: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
    telegramTokenConfigured: !!props.getProperty('TELEGRAM_BOT_TOKEN'),
    telegramChatIdConfigured: !!props.getProperty('TELEGRAM_CHAT_ID'),
    triggerCount: triggerCount
  };
}

// Статусы, которые скрипт считает своими и вправе перезаписывать. Любая другая
// пометка в колонке H (например PAUSED) — ручное решение инвестора, оно сохраняется.
var IC_SIGNAL_ALERT_OWNED_STATUSES = ['', 'ARMED', 'TRIGGERED', 'ERROR'];

// Возврат сигнала на дежурство после срабатывания или ошибки: сбрасывает
// Telegram-статус в PENDING, чтобы алерт снова мог сработать.
function rearmSignalPriceAlert(signalId) {
  if (!signalId) throw new Error('Missing signal id');

  var sheet = SpreadsheetApp.openById(IC_SIGNAL_ALERT_SPREADSHEET_ID)
    .getSheetByName(IC_SIGNAL_ALERT_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_SIGNAL_ALERT_SHEET);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, rearmed: 0 };

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var rearmed = 0;

  ids.forEach(function(row, index) {
    if (String(row[0]).trim() !== String(signalId).trim()) return;
    sheet.getRange(index + 2, 8).setValue('ARMED');
    sheet.getRange(index + 2, 10, 1, 2).setValues([['', 'PENDING']]);
    rearmed += 1;
  });

  return { ok: rearmed > 0, rearmed: rearmed };
}

function syncSignalPriceAlerts() {
  // Минутный триггер может наложиться сам на себя, если Sheets или Telegram
  // отвечают медленно — это дало бы дубли алертов. Пропускаем прогон молча.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return { ok: true, skipped: 'locked' };

  try {
    return IC_SIGNAL_ALERT_run_();
  } finally {
    lock.releaseLock();
  }
}

function IC_SIGNAL_ALERT_run_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = props.getProperty('TELEGRAM_CHAT_ID');
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN script property');
  if (!chatId) throw new Error('Missing TELEGRAM_CHAT_ID script property');

  var ss = SpreadsheetApp.openById(IC_SIGNAL_ALERT_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(IC_SIGNAL_ALERT_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_SIGNAL_ALERT_SHEET);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, rows: 0, sent: [] };

  var range = sheet.getRange(2, 1, lastRow - 1, 12);
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var primaryMids = IC_SIGNAL_ALERT_fetchInfo_({ type: 'allMids' });
  var xyzMids = IC_SIGNAL_ALERT_fetchInfo_({ type: 'allMids', dex: 'xyz' });
  var timestamp = IC_SIGNAL_ALERT_timestamp_();
  var sent = [];
  var failed = [];

  // Копим правки в памяти и пишем их одним setValues на весь диапазон:
  // 23 отдельные записи в минуту съедали дневную квоту времени триггеров.
  var priceStatusCheck = values.map(function(row) {
    return [row[6], row[7], row[8]];
  });
  var triggeredTelegram = values.map(function(row) {
    return [row[9], row[10]];
  });
  var dirty = false;

  values.forEach(function(row, index) {
    var displayRow = displayValues[index];
    var id = String(row[0] || displayRow[0] || '').trim();
    if (!id) return;

    var asset = String(row[1] || displayRow[1] || '').trim();
    var action = String(row[2] || displayRow[2] || '').trim();
    var amount = IC_SIGNAL_ALERT_toNumber_(row[3], displayRow[3]);
    var triggerPrice = IC_SIGNAL_ALERT_toNumber_(row[4], displayRow[4]);
    var source = String(row[5] || displayRow[5] || '').trim();
    var manualStatus = String(row[7] || displayRow[7] || '').trim().toUpperCase();
    var telegramStatus = String(row[10] || displayRow[10] || '').trim();
    var comment = String(row[11] || displayRow[11] || '').trim();

    var scriptOwnsStatus = IC_SIGNAL_ALERT_OWNED_STATUSES.indexOf(manualStatus) >= 0;

    var currentPrice = IC_SIGNAL_ALERT_priceForSignal_(id, asset, source, primaryMids, xyzMids);
    if (!currentPrice || !triggerPrice) return;

    priceStatusCheck[index][0] = currentPrice;
    priceStatusCheck[index][2] = timestamp;
    if (scriptOwnsStatus) {
      priceStatusCheck[index][1] = telegramStatus === 'SENT' ? 'TRIGGERED' : 'ARMED';
    }
    dirty = true;

    // Ручная пометка статуса = сигнал снят с дежурства инвестором.
    if (!scriptOwnsStatus) return;
    if (telegramStatus !== 'PENDING') return;
    if (!IC_SIGNAL_ALERT_shouldTrigger_(id, action, currentPrice, triggerPrice)) return;

    var text = IC_SIGNAL_ALERT_buildMessage_(
      id,
      asset,
      action,
      amount,
      triggerPrice,
      displayRow[4],
      comment
    );

    // Падение на одной строке не должно ронять весь прогон: остальные сигналы
    // обязаны быть проверены в эту же минуту.
    try {
      IC_SIGNAL_ALERT_sendTelegram_(token, chatId, text);
      priceStatusCheck[index][1] = 'TRIGGERED';
      triggeredTelegram[index] = [timestamp, 'SENT'];
      sent.push(id);
    } catch (error) {
      priceStatusCheck[index][1] = 'ERROR';
      failed.push({ id: id, error: String(error && error.message ? error.message : error) });
    }
  });

  if (dirty) {
    sheet.getRange(2, 7, values.length, 3).setValues(priceStatusCheck);
    sheet.getRange(2, 10, values.length, 2).setValues(triggeredTelegram);
  }

  return {
    ok: failed.length === 0,
    rows: values.length,
    sent: sent,
    failed: failed,
    timestamp: timestamp
  };
}

function IC_SIGNAL_ALERT_shouldTrigger_(id, action, currentPrice, triggerPrice) {
  var isSell = String(id).indexOf('-SELL-') >= 0 || String(action).toLowerCase() === 'продать';
  if (isSell) return currentPrice >= triggerPrice;
  return currentPrice <= triggerPrice;
}

function IC_SIGNAL_ALERT_priceForSignal_(id, asset, source, primaryMids, xyzMids) {
  if (source.indexOf('xyz:SPCX') >= 0) return IC_SIGNAL_ALERT_toNumber_(xyzMids['xyz:SPCX']);
  if (source.indexOf('xyz:GOLD') >= 0) return IC_SIGNAL_ALERT_toNumber_(xyzMids['xyz:GOLD']);

  var normalized = String(asset || '').toUpperCase().replace(' SHORT', '').trim();
  if (String(id).indexOf('BTC-SHORT-') === 0) normalized = 'BTC';
  if (normalized === 'GOLD') return IC_SIGNAL_ALERT_toNumber_(xyzMids['xyz:GOLD']);

  return IC_SIGNAL_ALERT_toNumber_(primaryMids[normalized]);
}

function IC_SIGNAL_ALERT_buildMessage_(id, asset, action, amount, triggerPrice, displayTrigger, comment) {
  var priceAsset = String(id).indexOf('BTC-SHORT-') === 0 ? 'BTC' : String(asset || '').trim();
  var priceText = IC_SIGNAL_ALERT_formatPrice_(triggerPrice, displayTrigger);
  var tail = String(comment || '').replace(/^Цена\s+коснулась\s*[—-]\s*/i, '');
  if (!tail) {
    var actionWord = String(action).toLowerCase() === 'продать' ? 'продажа' : 'покупка';
    tail = 'время взглянуть на график; ' + actionWord + ' $' + amount + ' ' + asset + ' по плану';
  }
  return 'Цена ' + priceAsset + ' коснулась ' + priceText + ' — ' + tail + '.';
}

function IC_SIGNAL_ALERT_formatPrice_(value, displayValue) {
  var display = String(displayValue || '').replace(/\u00a0/g, ' ').trim();
  var compact = display.replace(/\s/g, '');
  var raw = compact.replace(/^\$/, '');

  if (raw && value < 1000) {
    return '$' + raw.replace(',', '.');
  }

  if (value >= 1000) {
    return '$' + Math.round(value).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  }

  return '$' + String(value);
}

function IC_SIGNAL_ALERT_sendTelegram_(token, chatId, text) {
  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
  var statusCode = response.getResponseCode();
  var body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Telegram send failed: ' + statusCode + ' ' + body);
  }

  // Сверять result.text с отправленным нельзя: Telegram нормализует текст, и
  // ложное несовпадение оставило бы сигнал в PENDING — то есть дубль каждую минуту.
  var parsed = JSON.parse(body);
  if (!parsed.ok || !parsed.result) {
    throw new Error('Telegram send rejected: ' + body);
  }
}

function IC_SIGNAL_ALERT_fetchInfo_(payload) {
  var response = UrlFetchApp.fetch(IC_SIGNAL_ALERT_INFO_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });
  var statusCode = response.getResponseCode();
  var body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Hyperliquid request failed: ' + statusCode + ' ' + body);
  }
  return JSON.parse(body);
}

function IC_SIGNAL_ALERT_toNumber_(value, displayValue) {
  if (typeof value === 'number' && isFinite(value)) return value;
  var source = value !== null && value !== undefined && value !== '' ? value : displayValue;
  var normalized = String(source || '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.+-]/g, '');
  var parsed = Number(normalized);
  return isFinite(parsed) ? parsed : 0;
}

function IC_SIGNAL_ALERT_timestamp_() {
  return Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd HH:mm:ss') + ' MSK';
}
