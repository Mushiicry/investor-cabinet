var IC_SIGNAL_ALERT_SPREADSHEET_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
var IC_SIGNAL_ALERT_SHEET = 'Сигналы';
var IC_SIGNAL_ALERT_INFO_URL = 'https://api.hyperliquid.xyz/info';
var IC_SIGNAL_ALERT_HANDLER = 'syncSignalPriceAlerts';
var IC_SIGNAL_ALERT_DAILY_LIMIT = 3;
var IC_SIGNAL_ALERT_REPEAT_AFTER_HOURS = 6;
var IC_SIGNAL_ALERT_DAILY_STATE_KEY = 'SIGNAL_ALERT_DAILY_STATE';
var IC_SIGNAL_ALERT_DISCIPLINE_PAUSE_KEY = 'SIGNAL_ALERT_DISCIPLINE_PAUSE';
var IC_SIGNAL_ALERT_CANDLE_INTERVAL = '1m';
var IC_SIGNAL_ALERT_CANDLE_LOOKBACK_MINUTES = 3;

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

function setSignalPriceAlertDisciplinePause(active) {
  PropertiesService.getScriptProperties().setProperty(
    IC_SIGNAL_ALERT_DISCIPLINE_PAUSE_KEY,
    active ? 'TRUE' : 'FALSE'
  );

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
    dailyLimit: IC_SIGNAL_ALERT_DAILY_LIMIT,
    repeatAfterHours: IC_SIGNAL_ALERT_REPEAT_AFTER_HOURS,
    disciplinePauseActive: props.getProperty(IC_SIGNAL_ALERT_DISCIPLINE_PAUSE_KEY) === 'TRUE',
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
  var now = new Date();
  var timestamp = IC_SIGNAL_ALERT_timestamp_();
  var dailyState = IC_SIGNAL_ALERT_readDailyState_(props, now);
  dailyState.count = Math.max(
    dailyState.count,
    IC_SIGNAL_ALERT_countSentToday_(values, displayValues, now)
  );
  var dailyStateDirty = false;
  var disciplinePauseActive = props.getProperty(IC_SIGNAL_ALERT_DISCIPLINE_PAUSE_KEY) === 'TRUE';
  var sent = [];
  var failed = [];
  var skipped = [];
  var candleCache = {};

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
    var lastCheck = String(row[8] || displayRow[8] || '').trim();
    var telegramStatus = String(row[10] || displayRow[10] || '').trim();
    var telegramStatusUpper = telegramStatus.toUpperCase();
    var comment = String(row[11] || displayRow[11] || '').trim();

    var scriptOwnsStatus = IC_SIGNAL_ALERT_OWNED_STATUSES.indexOf(manualStatus) >= 0;

    var currentPrice = IC_SIGNAL_ALERT_priceForSignal_(id, asset, source, primaryMids, xyzMids);
    if (!currentPrice || !triggerPrice) return;

    priceStatusCheck[index][0] = currentPrice;
    priceStatusCheck[index][2] = timestamp;
    if (scriptOwnsStatus) {
      priceStatusCheck[index][1] = telegramStatusUpper === 'SENT' ? 'TRIGGERED' : 'ARMED';
    }
    dirty = true;

    // Ручная пометка статуса = сигнал снят с дежурства инвестором.
    if (!scriptOwnsStatus) return;
    if (disciplinePauseActive) {
      skipped.push({ id: id, reason: 'discipline_pause' });
      return;
    }

    var direction = IC_SIGNAL_ALERT_direction_(id, action);

    // Направление не читается однозначно — молчим и зовём человека. Ложный
    // алерт в неверную сторону хуже, чем его отсутствие.
    if (!direction) {
      priceStatusCheck[index][1] = 'CHECK';
      failed.push({ id: id, error: 'Направление сигнала не распознано: "' + action + '"' });
      return;
    }

    var conditionMet = IC_SIGNAL_ALERT_conditionMet_(
      direction,
      currentPrice,
      triggerPrice,
      id,
      asset,
      source,
      candleCache,
      now,
      skipped
    );
    if (!conditionMet) return;

    // Сигнал должен сначала встать на дежурство при невыполненном условии.
    // Если при первом же знакомстве со строкой условие уже выполнено — это не
    // касание цены, а ошибка ввода (перепутано направление либо устаревший
    // уровень). Ставим CHECK: этот статус скрипт не перезаписывает, сигнал
    // остаётся снятым с дежурства до решения инвестора.
    if (!lastCheck) {
      priceStatusCheck[index][1] = 'CHECK';
      failed.push({
        id: id,
        error: 'Новый сигнал сработал бы сразу при заведении (цена ' + currentPrice +
          ' против триггера ' + triggerPrice + ') — проверьте направление и уровень'
      });
      return;
    }

    var repeatEligible = IC_SIGNAL_ALERT_canRepeat_(
      telegramStatusUpper,
      String(row[9] || displayRow[9] || '').trim(),
      now
    );
    if (telegramStatusUpper !== 'PENDING' && !repeatEligible) return;
    if (dailyState.count >= IC_SIGNAL_ALERT_DAILY_LIMIT) {
      skipped.push({ id: id, reason: 'daily_limit' });
      return;
    }

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
      dailyState.count += 1;
      dailyStateDirty = true;
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

  if (dailyStateDirty) {
    IC_SIGNAL_ALERT_writeDailyState_(props, dailyState);
  }

  return {
    ok: failed.length === 0,
    rows: values.length,
    sent: sent,
    skipped: skipped,
    dailyLimit: IC_SIGNAL_ALERT_DAILY_LIMIT,
    dailySent: dailyState.count,
    failed: failed,
    timestamp: timestamp
  };
}

// Корни, а не точные слова: «Продать», «Продажа», «Продай», «Фиксация»,
// «Сократить» должны читаться одинаково. Признаки инструмента (шорт/лонг)
// сюда намеренно не входят — «закрыть шорт» это покупка, а «добавить в шорт»
// продажа, так что по названию позиции направление не выводится.
var IC_SIGNAL_ALERT_SELL_STEMS = [
  'прода', 'продай', 'фиксир', 'фиксац', 'зафиксир', 'сократ', 'сокращ',
  'разгруз', 'выход', 'выйти', 'тейк', 'профит', 'sell', 'take', 'profit', 'tp'
];

var IC_SIGNAL_ALERT_BUY_STEMS = [
  'купи', 'покупк', 'докуп', 'подкуп', 'добор', 'добра', 'добав', 'набор',
  'набра', 'вход', 'войти', 'откуп', 'buy', 'bid', 'dca'
];

// Возвращает 'SELL', 'BUY' или null, если направление неоднозначно.
// null — сознательный отказ угадывать: вызывающий код помечает строку CHECK
// и не шлёт алерт.
function IC_SIGNAL_ALERT_direction_(id, action) {
  var fromId = IC_SIGNAL_ALERT_directionFromId_(id);
  var fromAction = IC_SIGNAL_ALERT_directionFromAction_(action);

  if (fromId && fromAction && fromId !== fromAction) return null;
  return fromId || fromAction || null;
}

function IC_SIGNAL_ALERT_directionFromId_(id) {
  var normalized = String(id || '').toUpperCase();
  var isSell = normalized.indexOf('-SELL-') >= 0;
  var isBuy = normalized.indexOf('-BUY-') >= 0;

  if (isSell && isBuy) return null;
  if (isSell) return 'SELL';
  if (isBuy) return 'BUY';
  return null;
}

function IC_SIGNAL_ALERT_directionFromAction_(action) {
  var normalized = String(action || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
  if (!normalized) return null;

  var words = normalized.split(' ');
  var matches = function(stems) {
    return words.some(function(word) {
      return stems.some(function(stem) {
        return word.indexOf(stem) === 0;
      });
    });
  };

  var isSell = matches(IC_SIGNAL_ALERT_SELL_STEMS);
  var isBuy = matches(IC_SIGNAL_ALERT_BUY_STEMS);

  // «Продать/добавить» по шорту — обе стороны в одной формулировке.
  // Угадывать нельзя, отдаём решение человеку.
  if (isSell && isBuy) return null;
  if (isSell) return 'SELL';
  if (isBuy) return 'BUY';
  return null;
}

function IC_SIGNAL_ALERT_priceForSignal_(id, asset, source, primaryMids, xyzMids) {
  var coin = IC_SIGNAL_ALERT_coinForSignal_(id, asset, source);
  if (coin === 'xyz:SPCX') return IC_SIGNAL_ALERT_toNumber_(xyzMids['xyz:SPCX']);
  if (coin === 'xyz:GOLD') return IC_SIGNAL_ALERT_toNumber_(xyzMids['xyz:GOLD']);

  return IC_SIGNAL_ALERT_toNumber_(primaryMids[coin]);
}

function IC_SIGNAL_ALERT_coinForSignal_(id, asset, source) {
  if (source.indexOf('xyz:SPCX') >= 0) return 'xyz:SPCX';
  if (source.indexOf('xyz:GOLD') >= 0) return 'xyz:GOLD';
  var normalized = String(asset || '').toUpperCase().replace(' SHORT', '').trim();
  if (String(id).indexOf('BTC-SHORT-') === 0) normalized = 'BTC';
  if (normalized === 'GOLD') return 'xyz:GOLD';
  return normalized;
}

function IC_SIGNAL_ALERT_conditionMet_(
  direction,
  currentPrice,
  triggerPrice,
  id,
  asset,
  source,
  candleCache,
  now,
  skipped
) {
  var midTouched = direction === 'SELL'
    ? currentPrice >= triggerPrice
    : currentPrice <= triggerPrice;
  if (midTouched) return true;

  var coin = IC_SIGNAL_ALERT_coinForSignal_(id, asset, source);
  var candleState = IC_SIGNAL_ALERT_candlesForCoin_(coin, candleCache, now);
  if (candleState.error) {
    skipped.push({ id: id, reason: 'candle_error', error: candleState.error });
    return false;
  }

  return candleState.candles.some(function(candle) {
    var high = IC_SIGNAL_ALERT_toNumber_(candle.h);
    var low = IC_SIGNAL_ALERT_toNumber_(candle.l);
    if (direction === 'SELL') return high >= triggerPrice;
    return low > 0 && low <= triggerPrice;
  });
}

function IC_SIGNAL_ALERT_candlesForCoin_(coin, candleCache, now) {
  if (Object.prototype.hasOwnProperty.call(candleCache, coin)) {
    return candleCache[coin];
  }

  var endTime = now.getTime();
  var startTime = endTime - IC_SIGNAL_ALERT_CANDLE_LOOKBACK_MINUTES * 60 * 1000;

  try {
    var candles = IC_SIGNAL_ALERT_fetchInfo_({
      type: 'candleSnapshot',
      req: {
        coin: coin,
        interval: IC_SIGNAL_ALERT_CANDLE_INTERVAL,
        startTime: startTime,
        endTime: endTime
      }
    });
    candleCache[coin] = {
      candles: Array.isArray(candles) ? candles : [],
      error: ''
    };
  } catch (error) {
    candleCache[coin] = {
      candles: [],
      error: String(error && error.message ? error.message : error)
    };
  }

  return candleCache[coin];
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

function IC_SIGNAL_ALERT_canRepeat_(telegramStatus, triggeredAt, now) {
  if (telegramStatus !== 'SENT') return false;

  var previous = IC_SIGNAL_ALERT_parseTimestamp_(triggeredAt);
  if (!previous) return false;

  var repeatAfterMs = IC_SIGNAL_ALERT_REPEAT_AFTER_HOURS * 60 * 60 * 1000;
  return now.getTime() - previous >= repeatAfterMs;
}

function IC_SIGNAL_ALERT_readDailyState_(props, now) {
  var today = IC_SIGNAL_ALERT_mskDayKey_(now);
  var state = { day: today, count: 0 };
  var raw = props.getProperty(IC_SIGNAL_ALERT_DAILY_STATE_KEY);

  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.day === today && isFinite(Number(parsed.count))) {
        state.count = Math.max(0, Number(parsed.count));
      }
    } catch (error) {
      state = { day: today, count: 0 };
    }
  }

  return state;
}

function IC_SIGNAL_ALERT_countSentToday_(values, displayValues, now) {
  var today = IC_SIGNAL_ALERT_mskDayKey_(now);
  return values.reduce(function(count, row, index) {
    var displayRow = displayValues[index];
    var telegramStatus = String(row[10] || displayRow[10] || '').trim().toUpperCase();
    if (telegramStatus !== 'SENT') return count;

    var triggeredAt = IC_SIGNAL_ALERT_parseTimestamp_(String(row[9] || displayRow[9] || '').trim());
    if (!triggeredAt) return count;

    var triggeredDay = IC_SIGNAL_ALERT_mskDayKey_(new Date(triggeredAt));
    return triggeredDay === today ? count + 1 : count;
  }, 0);
}

function IC_SIGNAL_ALERT_writeDailyState_(props, state) {
  props.setProperty(IC_SIGNAL_ALERT_DAILY_STATE_KEY, JSON.stringify({
    day: state.day,
    count: state.count
  }));
}

function IC_SIGNAL_ALERT_parseTimestamp_(value) {
  var raw = String(value || '').trim();
  if (!raw) return 0;

  var msk = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*MSK$/i);
  if (msk) {
    return Date.UTC(
      Number(msk[1]),
      Number(msk[2]) - 1,
      Number(msk[3]),
      Number(msk[4]) - 3,
      Number(msk[5]),
      Number(msk[6] || 0)
    );
  }

  var parsed = Date.parse(raw);
  return isFinite(parsed) ? parsed : 0;
}

function IC_SIGNAL_ALERT_mskDayKey_(date) {
  return Utilities.formatDate(date, 'Europe/Moscow', 'yyyy-MM-dd');
}

function IC_SIGNAL_ALERT_timestamp_() {
  return Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd HH:mm:ss') + ' MSK';
}
