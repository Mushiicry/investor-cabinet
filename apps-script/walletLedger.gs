// ═══════════════════════════════════════════════════════════════════
// walletLedger — общее ядро учёта для всех кошельковых импортов.
//
// Единственный источник истины для операций, которые раньше дублировались
// между сетями (Arbitrum, BNB) и создавали скрытую зависимость bnb->arbitrum:
//   • поиск строки актива в «Расчетах»
//   • дозапись в «Транзакции_IMPORT» без дублей (по importId)
//   • расширение валидаций листа импорта (Действие / Chain)
//   • создание строки стейбла без insertRow (HANDOFF §3.8)
//   • усреднение входа при покупке
//   • аудит-строки: стейбл-поток (Пополнение/Вывод/Обмен) и сделка (Покупка/Продажа)
//
// Этот файл НИ ОТ ЧЕГО не зависит. Сетевые импорты зависят только от него —
// ни один сетевой файл не должен вызывать функции другого сетевого файла.
//
// Инварианты (HANDOFF §3.7–3.8): формулы только с ";"; строки в «Расчеты»
// пишем в первую пустую строку, insertRow не используем.
// ═══════════════════════════════════════════════════════════════════

function IC_LEDGER_round_(value, digits) {
  var factor = Math.pow(10, digits);
  return Math.round((Number(value) || 0) * factor) / factor;
}

function IC_LEDGER_normalizeAssetSymbol_(asset) {
  var symbol = String(asset || '').trim();
  if (symbol.toUpperCase() === 'USDCOIN') return 'USDC';
  return symbol;
}

function IC_LEDGER_isStable_(asset) {
  var symbol = IC_LEDGER_normalizeAssetSymbol_(asset).toUpperCase();
  return symbol === 'USDC' || symbol === 'USDT';
}

// Поиск строки актива в «Расчетах» по колонке A (регистронезависимо,
// с нормализацией USDCoin -> USDC). 0 = не найдено.
function IC_LEDGER_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var target = IC_LEDGER_normalizeAssetSymbol_(asset).toUpperCase();
  for (var index = 0; index < values.length; index += 1) {
    if (IC_LEDGER_normalizeAssetSymbol_(values[index][0]).toUpperCase() === target) return index + 1;
  }
  return 0;
}

// Индекс уже записанных importId в листе импорта (защита от дублей).
function IC_LEDGER_readExistingImportIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().reduce(function(index, row) {
    var importId = String(row[0] || '').trim();
    if (importId) index[importId] = true;
    return index;
  }, {});
}

function IC_LEDGER_appendRows_(sheet, rows) {
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

// Колонки листа импорта защищены списками значений (наследие TON-импорта:
// «Действие» без Пополнения/Вывода, «Chain» только TON). Дописываем нужное
// значение в правило всей колонки, не ломая существующий список.
function IC_LEDGER_ensureListValidationAllows_(sheet, colLetter, value) {
  var lastRow = Math.max(sheet.getMaxRows(), 1000);
  var range = sheet.getRange(colLetter + '2:' + colLetter + lastRow);
  // Правило ищем по ПОСЛЕДНЕЙ строке данных +1 (куда будет писаться новая):
  // старые строки могли быть заполнены до появления валидации.
  var probeRow = sheet.getLastRow() + 1;
  var rule = sheet.getRange(colLetter + probeRow).getDataValidation() ||
             sheet.getRange(colLetter + '2').getDataValidation();
  if (!rule) return;
  if (String(rule.getCriteriaType()) !== 'VALUE_IN_LIST') return;

  var args = rule.getCriteriaValues();
  var list = (args[0] || []).map(String);
  if (list.indexOf(value) >= 0) return;

  list.push(value);
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(list, args.length > 1 ? args[1] !== false : true)
      .setAllowInvalid(false)
      .build()
  );
}

// Новая стейбл-строка в «Расчетах»: первая ПУСТАЯ строка колонки A в 2..30
// (диапазоны формул 2:100 её подхватят). insertRow НЕ используем — вставка
// сдвигает служебные блоки L-O и W-X (HANDOFF §3.8). Формулы только с ";".
function IC_LEDGER_createStableRow_(sheet, asset) {
  var values = sheet.getRange(2, 1, 29, 1).getValues();
  var rowIndex = 0;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === '') { rowIndex = i + 2; break; }
  }
  if (!rowIndex) return 0;

  sheet.getRange(rowIndex, 1, 1, 4).setValues([[asset, 'Кэш / Стейблы', 0, 1]]);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
  sheet.getRange(rowIndex, 6).setValue(1);
  sheet.getRange(rowIndex, 7).setFormula(
    '=IF(OR(C' + rowIndex + '="";F' + rowIndex + '="");"";C' + rowIndex + '*F' + rowIndex + ')'
  );
  sheet.getRange(rowIndex, 8).setFormula('=G' + rowIndex + '-E' + rowIndex);
  sheet.getRange(rowIndex, 9).setFormula('=IF(E' + rowIndex + '=0;0;H' + rowIndex + '/E' + rowIndex + ')');
  sheet.getRange(rowIndex, 10).setFormula('=IF(G' + rowIndex + '=0;0;G' + rowIndex + '/SUM($G$2:$G$100))');
  sheet.getRange(rowIndex, 11).setValue('Reserve');
  return rowIndex;
}

// Строка стейбла существует (создаём при отсутствии).
function IC_LEDGER_ensureStableRow_(sheet, asset) {
  var rowIndex = IC_LEDGER_findAssetRow_(sheet, asset);
  return rowIndex || IC_LEDGER_createStableRow_(sheet, asset);
}

// Усреднение входа при покупке: invested_new = C*D + потрачено; qty_new = C + куплено.
function IC_LEDGER_averageInPurchase_(sheet, asset, quantityBought, amountSpent) {
  var rowIndex = IC_LEDGER_findAssetRow_(sheet, asset);
  if (!rowIndex) return;
  var prevQty = Number(sheet.getRange(rowIndex, 3).getValue()) || 0;
  var prevAvg = Number(sheet.getRange(rowIndex, 4).getValue()) || 0;
  var newQty = prevQty + quantityBought;
  var newAvg = newQty > 0 ? (prevQty * prevAvg + amountSpent) / newQty : prevAvg;
  sheet.getRange(rowIndex, 3).setValue(newQty);
  sheet.getRange(rowIndex, 4).setValue(IC_LEDGER_round_(newAvg, 4));
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

// Прибавить/убавить количество стейбла (цена = 1). Строку создаём при отсутствии.
function IC_LEDGER_applyStableDelta_(sheet, asset, delta) {
  var rowIndex = IC_LEDGER_findAssetRow_(sheet, asset);
  if (!rowIndex && Math.abs(delta) > 0.000001) rowIndex = IC_LEDGER_createStableRow_(sheet, asset);
  if (!rowIndex) return;
  var currentQuantity = Number(sheet.getRange(rowIndex, 3).getValue()) || 0;
  sheet.getRange(rowIndex, 3).setValue(Math.max(0, currentQuantity + delta));
  sheet.getRange(rowIndex, 4).setValue(1);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

// ── Аудит-строки в «Транзакции_IMPORT» (одна лента истории сделок на сайте) ──

// Стейбл-поток: Пополнение / Вывод / Обмен. PnL не создаёт, баланс уже применён.
function IC_LEDGER_appendStableFlowRow_(sheet, opts) {
  var action = opts.action;
  var chain = opts.chain || 'ARBITRUM';
  var walletId = opts.walletId || 'metamask-arbitrum-main';
  IC_LEDGER_ensureListValidationAllows_(sheet, 'F', action);
  IC_LEDGER_ensureListValidationAllows_(sheet, 'L', chain);

  var tz = Session.getScriptTimeZone();
  var syncId = Utilities.formatDate(opts.syncStartedAt, tz, "yyyyMMdd'T'HHmmss");
  var importId = ['EVM_STABLE_FLOW', chain, syncId, action.toUpperCase(), opts.asset,
    IC_LEDGER_round_(opts.quantity, 6)].join(':');
  if (IC_LEDGER_readExistingImportIds_(sheet)[importId]) return;

  IC_LEDGER_appendRows_(sheet, [[
    importId, 'PENDING',
    Utilities.formatDate(opts.syncStartedAt, tz, 'dd.MM.yyyy'),
    opts.asset, 'Кэш / Стейблы', action,
    opts.quantity, 1, opts.usdAmount,
    'Wallet stable flow; баланс уже применён к Расчетам',
    walletId, chain, 'BALANCE_DELTA', '',
    action === 'Обмен' ? 'SWAP' : (action === 'Пополнение' ? 'IN' : 'OUT'),
    '', opts.pairLabel,
    IC_LEDGER_round_(opts.quantity, 6) + ' ' + opts.asset,
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(opts.syncStartedAt, tz, "yyyy-MM-dd'T'HH:mm:ss") +
      '. Стейбл-поток: PnL не создаёт, баланс уже применён.'
  ]]);
}

// Сделка: Покупка / Продажа актива за стейбл. Учёт уже применён к «Расчетам».
function IC_LEDGER_appendTradeRow_(sheet, opts) {
  var action = opts.action;
  var chain = opts.chain || 'ARBITRUM';
  var walletId = opts.walletId || 'metamask-arbitrum-main';
  var category = opts.category || 'Крипта';
  IC_LEDGER_ensureListValidationAllows_(sheet, 'F', action);
  IC_LEDGER_ensureListValidationAllows_(sheet, 'L', chain);

  var tz = Session.getScriptTimeZone();
  var syncId = Utilities.formatDate(opts.syncStartedAt, tz, "yyyyMMdd'T'HHmmss");
  var importId = ['LEDGER_TRADE', chain, syncId, action.toUpperCase(), opts.asset,
    IC_LEDGER_round_(opts.quantity, 12)].join(':');
  if (IC_LEDGER_readExistingImportIds_(sheet)[importId]) return;

  IC_LEDGER_appendRows_(sheet, [[
    importId, 'PENDING',
    Utilities.formatDate(opts.syncStartedAt, tz, 'dd.MM.yyyy'),
    opts.asset, category, action,
    opts.quantity, opts.price, opts.amount,
    'Wallet balance delta; учёт уже применён к Расчетам',
    walletId, chain, 'BALANCE_DELTA', '', 'SWAP', '',
    opts.pairLabel, IC_LEDGER_round_(opts.quantity, 12) + ' ' + opts.asset,
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(opts.syncStartedAt, tz, "yyyy-MM-dd'T'HH:mm:ss") +
      (action === 'Покупка' ? '. Средний вход усреднён автоматически.' : '. Средний вход не менялся.')
  ]]);
}
