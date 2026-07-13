var IC_HISTORY_SPREADSHEET_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
var IC_HISTORY_SHEET = 'История';
var IC_FEAR_GREED_HISTORY_SHEET = 'FearGreedHistory';
var IC_HISTORY_TRIGGER_HANDLER = 'syncInvestorCabinetDailySnapshot';
var IC_HISTORY_LEGACY_TRIGGER_HANDLERS = ['recordDailySnapshot'];

function syncInvestorCabinetDailySnapshot() {
  var ss = SpreadsheetApp.openById(IC_HISTORY_SPREADSHEET_ID);
  var overviewSheet = ss.getSheetByName('Обзор');
  var historySheet = ss.getSheetByName(IC_HISTORY_SHEET);
  if (!overviewSheet || !historySheet) throw new Error('Missing Обзор or История sheet');

  var overview = getOverview(overviewSheet);
  var now = new Date();
  var timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Europe/Moscow';
  var todayKey = Utilities.formatDate(now, timezone, 'dd.MM.yyyy');
  var targetRow = IC_HISTORY_findDateRow_(historySheet, todayKey);

  if (!targetRow) targetRow = historySheet.getLastRow() + 1;

  historySheet.getRange(targetRow, 1, 1, 12).setValues([[
    now,
    overview.portfolioValue,
    overview.invested,
    overview.pnl,
    overview.pnlPct,
    overview.reserve,
    overview.positionsCount,
    'дневной снимок',
    'автоматический снимок дня',
    'daily',
    'авто',
    'Состояние на конец дня; одна точка на дату'
  ]]);
  historySheet.getRange(targetRow, 1).setNumberFormat('dd.MM.yyyy');
  historySheet.getRange(targetRow, 5).setNumberFormat('0.00%');
  var fearGreedSnapshot = IC_HISTORY_syncFearGreedSnapshot_(ss, now, timezone);

  return {
    row: targetRow,
    date: todayKey,
    portfolioValue: overview.portfolioValue,
    invested: overview.invested,
    pnl: overview.pnl,
    fearGreed: fearGreedSnapshot
  };
}

function recordDailySnapshot() {
  return syncInvestorCabinetDailySnapshot();
}

function syncFearGreedDailyHistory() {
  var ss = SpreadsheetApp.openById(IC_HISTORY_SPREADSHEET_ID);
  var timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Europe/Moscow';
  return IC_HISTORY_syncFearGreedSnapshot_(ss, new Date(), timezone);
}

function setupInvestorCabinetDailySnapshotTrigger() {
  removeInvestorCabinetDailySnapshotTrigger();

  ScriptApp.newTrigger(IC_HISTORY_TRIGGER_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(55)
    .create();

  return syncInvestorCabinetDailySnapshot();
}

function removeInvestorCabinetDailySnapshotTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (
      handler === IC_HISTORY_TRIGGER_HANDLER ||
      IC_HISTORY_LEGACY_TRIGGER_HANDLERS.indexOf(handler) >= 0
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function IC_HISTORY_findDateRow_(sheet, dateKey) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var dates = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (var index = dates.length - 1; index >= 0; index -= 1) {
    if (dates[index][0] === dateKey) return index + 2;
  }

  return 0;
}

function IC_HISTORY_syncFearGreedSnapshot_(ss, now, timezone) {
  var sheet = IC_HISTORY_getOrCreateFearGreedHistorySheet_(ss);
  var limit = sheet.getLastRow() < 2 ? 30 : 2;
  var response = UrlFetchApp.fetch(
    'https://api.alternative.me/fng/?limit=' + limit + '&format=json',
    { muteHttpExceptions: true }
  );

  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    var payload = JSON.parse(response.getContentText() || '{}');
    var points = Array.isArray(payload.data) ? payload.data : [];
    points.forEach(function(point) {
      var timestamp = Number(point.timestamp || 0);
      var value = Number(point.value);
      if (!timestamp || !isFinite(value)) return;
      var pointDate = new Date(timestamp * 1000);
      IC_HISTORY_upsertFearGreedPoint_(
        sheet,
        pointDate,
        value,
        String(point.value_classification || IC_HISTORY_fearGreedLabel_(value)),
        'alternative.me',
        now,
        timezone
      );
    });
  }

  var currentValue = getFearGreedCurrentIndex(ss);
  var targetRow = IC_HISTORY_upsertFearGreedPoint_(
    sheet,
    now,
    currentValue,
    IC_HISTORY_fearGreedLabel_(currentValue),
    'Настройки',
    now,
    timezone
  );

  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).sort({ column: 1, ascending: true });
  }

  return {
    row: targetRow,
    date: Utilities.formatDate(now, timezone, 'dd.MM.yyyy'),
    value: currentValue
  };
}

function IC_HISTORY_getOrCreateFearGreedHistorySheet_(ss) {
  var sheet = ss.getSheetByName(IC_FEAR_GREED_HISTORY_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(IC_FEAR_GREED_HISTORY_SHEET);
  sheet.getRange(1, 1, 1, 5).setValues([[
    'Дата',
    'Значение',
    'Состояние',
    'Источник',
    'Сохранено'
  ]]);
  sheet.setFrozenRows(1);
  return sheet;
}

function IC_HISTORY_upsertFearGreedPoint_(sheet, date, value, label, source, savedAt, timezone) {
  var dateKey = Utilities.formatDate(date, timezone, 'dd.MM.yyyy');
  var targetRow = IC_HISTORY_findDateRow_(sheet, dateKey) || sheet.getLastRow() + 1;

  sheet.getRange(targetRow, 1, 1, 5).setValues([[
    date,
    Math.max(0, Math.min(100, Math.round(value))),
    label,
    source,
    savedAt
  ]]);
  sheet.getRange(targetRow, 1).setNumberFormat('dd.MM.yyyy');
  sheet.getRange(targetRow, 5).setNumberFormat('dd.MM.yyyy HH:mm');
  return targetRow;
}

function IC_HISTORY_fearGreedLabel_(value) {
  if (value <= 24) return 'Экстремальный страх';
  if (value <= 44) return 'Страх';
  if (value <= 54) return 'Нейтрально';
  if (value <= 74) return 'Жадность';
  return 'Крайняя жадность';
}
