// ═══════════════════════════════════════════════════════════════════
// Прогресс инвестора — источник истины по достигнутому уровню.
//
// Лестница уровней на сайте (src/v2/lib/levelLadder.ts) живёт по правилу
// «достигнутый уровень не сгорает». localStorage у каждого устройства свой,
// поэтому максимум хранится здесь, в отдельном листе «Прогресс».
//
// Принципы:
//   1. Отдельный лист — НЕ трогаем «Расчеты» (инциденты со служебными
//      блоками L-O/W-X при вставке строк).
//   2. Запись ТОЛЬКО вверх (монотонно): понизить уровень нельзя ни багом,
//      ни пустым аккаунтом. Диапазон 1..5.
//   3. Награды/выплаты здесь НЕ учитываются — пока это просто надпись на
//      карточке уровня (решение владельца 2026-07-20).
// ═══════════════════════════════════════════════════════════════════

var IC_PROGRESS_SHEET = 'Прогресс';
var IC_PROGRESS_MAX_LEVEL = 5;

function IC_PROGRESS_getOrCreateSheet_(ss) {
  var sheet = ss.getSheetByName(IC_PROGRESS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(IC_PROGRESS_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([['maxLevel', 'updatedAt']]);
    sheet.getRange(2, 1, 1, 2).setValues([[1, new Date()]]);
  }
  return sheet;
}

// Достигнутый уровень (1..5). Нет листа/мусор в ячейке → 1.
function IC_PROGRESS_readMaxLevel_(ss) {
  var sheet = ss.getSheetByName(IC_PROGRESS_SHEET);
  if (!sheet) return 1;
  var value = Number(sheet.getRange(2, 1).getValue());
  if (!isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), IC_PROGRESS_MAX_LEVEL);
}

// Монотонная запись: сохраняем только если новый уровень выше текущего.
// Возвращает актуальный максимум после операции.
function IC_PROGRESS_setMaxLevel_(ss, rawLevel) {
  var level = Number(rawLevel);
  if (!isFinite(level)) return IC_PROGRESS_readMaxLevel_(ss);
  level = Math.min(Math.max(Math.floor(level), 1), IC_PROGRESS_MAX_LEVEL);

  var sheet = IC_PROGRESS_getOrCreateSheet_(ss);
  var current = IC_PROGRESS_readMaxLevel_(ss);
  if (level > current) {
    sheet.getRange(2, 1, 1, 2).setValues([[level, new Date()]]);
    return level;
  }
  return current;
}

// Ответ на ?action=setMaxLevel&level=N (вызывается из doGet).
function IC_PROGRESS_handleSetMaxLevel_(ss, rawLevel) {
  var maxLevel = IC_PROGRESS_setMaxLevel_(ss, rawLevel);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, maxLevel: maxLevel }))
    .setMimeType(ContentService.MimeType.JSON);
}
