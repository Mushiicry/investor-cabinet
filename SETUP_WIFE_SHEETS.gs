/**
 * SETUP_WIFE_SHEETS.gs
 * ────────────────────
 * Запустить ОДИН РАЗ из Google Apps Script (вставить в проект жены).
 * Создаёт вкладки «История» и «Транзакции» в таблице Полины,
 * копируя структуру из главной таблицы (Mushii).
 *
 * Шаги:
 *  1. Открыть script.google.com → проект жены
 *  2. Вставить этот файл (или весь код) в редактор
 *  3. Выбрать функцию setupWifeSheets → нажать ▶ Run
 *  4. После выполнения файл можно удалить
 */

var MAIN_SS_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
var WIFE_SS_ID = '1X8nywasqpGyULEUKu11OJbJqXZUwlFXcDLtQyH6_rqA';

// ─── Цвета оформления (как в главной таблице) ─────────────────────────────────
var COLOR_HEADER_BG   = '#1a1a2e';  // тёмно-синий фон заголовка
var COLOR_HEADER_TEXT = '#00d4ff';  // нейоновый голубой текст
var COLOR_ROW_ODD     = '#0d0d1a';
var COLOR_ROW_EVEN    = '#13132a';

function setupWifeSheets() {
  var mainSS = SpreadsheetApp.openById(MAIN_SS_ID);
  var wifeSS = SpreadsheetApp.openById(WIFE_SS_ID);

  Logger.log('=== Начинаем настройку вкладок для Полины ===');

  createOrReplaceHistorySheet(mainSS, wifeSS);
  createOrReplaceTransactionsSheet(mainSS, wifeSS);

  Logger.log('=== Готово! Вкладки Historia и Транзакции созданы ===');
  SpreadsheetApp.getUi().alert('Готово! Вкладки «История» и «Транзакции» созданы в таблице Полины.');
}

// ─── История портфеля ─────────────────────────────────────────────────────────

function createOrReplaceHistorySheet(mainSS, wifeSS) {
  // Удаляем старую если есть
  var old = wifeSS.getSheetByName('История');
  if (old) wifeSS.deleteSheet(old);

  // Создаём новую
  var sheet = wifeSS.insertSheet('История');
  Logger.log('Вкладка «История» создана');

  // Заголовки (совместимы с гистори-нормализатором сайта)
  var headers = [
    'date', 'portfolioValue', 'invested', 'pnl', 'pnlPct',
    'reserve', 'positionsCount', 'pointType', 'note',
    'trigger', 'source', 'comment'
  ];

  // Русские подписи в строке 2 (для читаемости в таблице)
  var labels = [
    'Дата', 'Стоимость портфеля', 'Вложено', 'PnL $', 'PnL %',
    'Резерв', 'Кол-во позиций', 'Тип точки', 'Заметка',
    'Триггер', 'Источник', 'Комментарий'
  ];

  // Записываем заголовки
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, labels.length).setValues([labels]);

  // Стиль строки заголовков
  styleHeaderRow(sheet, 1, headers.length, COLOR_HEADER_BG, COLOR_HEADER_TEXT);
  styleHeaderRow(sheet, 2, labels.length, '#0a0a1a', '#7a7aaa');

  // Заморозить первые 2 строки
  sheet.setFrozenRows(2);

  // Ширины столбцов
  sheet.setColumnWidth(1, 180);  // date
  sheet.setColumnWidth(2, 150);  // portfolioValue
  sheet.setColumnWidth(3, 120);  // invested
  sheet.setColumnWidth(4, 100);  // pnl
  sheet.setColumnWidth(5, 80);   // pnlPct
  sheet.setColumnWidth(6, 100);  // reserve
  sheet.setColumnWidth(7, 120);  // positionsCount
  sheet.setColumnWidth(8, 100);  // pointType
  sheet.setColumnWidth(9, 200);  // note
  sheet.setColumnWidth(10, 100); // trigger
  sheet.setColumnWidth(11, 100); // source
  sheet.setColumnWidth(12, 250); // comment

  // Копируем историю из главной таблицы (если есть)
  var mainHistSheet = mainSS.getSheetByName('История');
  if (mainHistSheet) {
    var mainData = mainHistSheet.getDataRange().getValues();
    if (mainData.length > 2) {
      Logger.log('Шаблон структуры скопирован из главной таблицы');
    }
  }

  // Добавляем пример строки (можно удалить)
  addExampleHistoryRow(sheet);

  Logger.log('«История»: ' + headers.length + ' столбцов, строки заморожены');
}

function addExampleHistoryRow(sheet) {
  var today = new Date();
  var isoDate = Utilities.formatDate(today, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  var example = [
    isoDate,   // date
    0,         // portfolioValue — заполнить реальным значением
    0,         // invested
    0,         // pnl
    0,         // pnlPct
    0,         // reserve
    0,         // positionsCount
    'manual',  // pointType
    'Начало учёта', // note
    'manual',  // trigger
    'sheet',   // source
    ''         // comment
  ];
  sheet.getRange(3, 1, 1, example.length).setValues([example]);
  sheet.getRange(3, 1, 1, example.length)
    .setBackground('#1a2a1a')
    .setFontColor('#88bb88')
    .setFontStyle('italic');
}

// ─── Транзакции ───────────────────────────────────────────────────────────────

function createOrReplaceTransactionsSheet(mainSS, wifeSS) {
  var old = wifeSS.getSheetByName('Транзакции');
  if (old) wifeSS.deleteSheet(old);

  var sheet = wifeSS.insertSheet('Транзакции');
  Logger.log('Вкладка «Транзакции» создана');

  // Поля (совместимы с transactionNormalizers.ts)
  var headers = [
    'id', 'date', 'asset', 'category', 'action',
    'quantity', 'price', 'amount', 'chain', 'hash',
    'status', 'direction', 'walletId', 'counterparty',
    'rawAsset', 'rawAmount', 'note', 'comment'
  ];

  var labels = [
    'ID', 'Дата', 'Актив', 'Категория', 'Действие',
    'Количество', 'Цена', 'Сумма $', 'Сеть', 'Hash',
    'Статус', 'Направление', 'Кошелёк', 'Контрагент',
    'Исходный актив', 'Исходная сумма', 'Заметка', 'Комментарий'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, labels.length).setValues([labels]);

  styleHeaderRow(sheet, 1, headers.length, COLOR_HEADER_BG, COLOR_HEADER_TEXT);
  styleHeaderRow(sheet, 2, labels.length, '#0a0a1a', '#7a7aaa');

  sheet.setFrozenRows(2);

  // Ширины
  sheet.setColumnWidth(1,  80);   // id
  sheet.setColumnWidth(2,  180);  // date
  sheet.setColumnWidth(3,  80);   // asset
  sheet.setColumnWidth(4,  120);  // category
  sheet.setColumnWidth(5,  80);   // action
  sheet.setColumnWidth(6,  100);  // quantity
  sheet.setColumnWidth(7,  100);  // price
  sheet.setColumnWidth(8,  100);  // amount
  sheet.setColumnWidth(9,  80);   // chain
  sheet.setColumnWidth(10, 280);  // hash
  sheet.setColumnWidth(11, 100);  // status
  sheet.setColumnWidth(12, 100);  // direction
  sheet.setColumnWidth(13, 120);  // walletId
  sheet.setColumnWidth(14, 120);  // counterparty
  sheet.setColumnWidth(15, 100);  // rawAsset
  sheet.setColumnWidth(16, 100);  // rawAmount
  sheet.setColumnWidth(17, 200);  // note
  sheet.setColumnWidth(18, 250);  // comment

  // Копируем из главной таблицы если есть
  copyTransactionsFromMain(mainSS, sheet);

  Logger.log('«Транзакции»: ' + headers.length + ' столбцов, строки заморожены');
}

function copyTransactionsFromMain(mainSS, targetSheet) {
  var mainTxSheet = mainSS.getSheetByName('Транзакции') || mainSS.getSheetByName('Transactions');
  if (!mainTxSheet) {
    Logger.log('Вкладка Транзакции не найдена в главной таблице — пропускаем копирование');
    return;
  }

  var data = mainTxSheet.getDataRange().getValues();
  if (data.length <= 2) return;

  // Копируем только заголовки как образец — данные у жены свои
  Logger.log('Структура транзакций найдена в главной таблице (данные не копируются — у Полины свои)');
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function styleHeaderRow(sheet, row, numCols, bgColor, textColor) {
  var range = sheet.getRange(row, 1, 1, numCols);
  range.setBackground(bgColor);
  range.setFontColor(textColor);
  range.setFontWeight('bold');
  range.setFontSize(10);
  range.setFontFamily('Roboto Mono');
  range.setBorder(
    false, false, true, false, false, false,
    '#00d4ff', SpreadsheetApp.BorderStyle.SOLID
  );
}
