// ════════════════════════════════════════════════════════════════════
// РЕВИЗИЯ ТАБЛИЦЫ 2026-07-16 — точечные фиксы по итогам полного аудита
// источника истины. Каждый фикс идемпотентен. Запуск: applySheetRevision20260716()
// ВАЖНО: все формулы — только ";"-разделители (русская локаль, HANDOFF §3.7).
// ════════════════════════════════════════════════════════════════════

function applySheetRevision20260716() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calc = ss.getSheetByName('Расчеты');
  var risk = ss.getSheetByName('Риск');
  var prices = ss.getSheetByName('Цены');
  if (!calc || !risk || !prices) throw new Error('Нет ключевых листов');
  var log = [];

  // ── Фикс 1. Риск B37:B40 съехали на 1 после вставки строки SPCXB ──
  // (ссылки авто-сдвинулись на X25..X28, а учёт пишет метрики на фикс.
  // позициях X24..X27 → «BTC current notional» показывал резерв 205,51)
  risk.getRange('B37').setFormula("='Расчеты'!X24");
  risk.getRange('B38').setFormula("='Расчеты'!X25");
  risk.getRange('B39').setFormula("='Расчеты'!X26");
  risk.getRange('B40').setFormula("='Расчеты'!X27");
  log.push('Риск B37:B40 -> X24:X27 (выровнены)');

  // ── Фикс 2. Расчеты Y/Z (meaning/source X-блока) съехали на 1 вниз ──
  // от строки 13 после вставки. Возвращаем на место сдвигом вверх.
  // Идемпотентность: двигаем только если Y15 пуст, а Y16 описывает X15.
  var y15 = calc.getRange('Y15').getValue();
  var y16 = String(calc.getRange('Y16').getValue());
  if (!y15 && y16.indexOf('GOLD margin + unrealized') === 0) {
    calc.getRange('Y13:Z13').deleteCells(SpreadsheetApp.Dimension.ROWS);
    log.push('Расчеты Y13:Z13 удалены со сдвигом вверх (описания X-блока выровнены)');
  } else {
    log.push('Расчеты Y/Z: сдвиг не обнаружен, пропуск');
  }

  // ── Фикс 3. Диапазоны 2:16 -> 2:100 (тихая поломка при 17-й строке) ──
  // Доля J: знаменатель SUM($G$2:$G$16) не увидит новые активы ниже 16.
  for (var row = 2; row <= 16; row++) {
    calc.getRange(row, 10).setFormula(
      '=IF(G' + row + '=0;0;G' + row + '/SUM($G$2:$G$100))'
    );
  }
  // Агрегаты L/M-таблицы (M5 — производная, не трогаем)
  calc.getRange('M2').setFormula('=SUM(G2:G100)');
  calc.getRange('M3').setFormula('=SUM(E2:E100)');
  calc.getRange('M4').setFormula('=SUM(H2:H100)');
  calc.getRange('M6').setFormula('=SUMIF(B2:B100;"Кэш / Стейблы";G2:G100)');
  calc.getRange('M7').setFormula('=SUMIF(B2:B100;"Крипта";G2:G100)');
  calc.getRange('M8').setFormula('=SUMIF(B2:B100;"Металлы";G2:G100)');
  calc.getRange('M9').setFormula('=SUMIF(B2:B100;"Фьючерсы";G2:G100)');
  // activeSpotInvested
  calc.getRange('X6').setFormula('=SUMIF(B2:B100;"Крипта";E2:E100)');
  log.push('Диапазоны J2:J16, M2:M9, X6 переведены на 2:100');

  // ── Фикс 4. Косметика: заголовок K и паспорт новых строк «Цены» ──
  if (calc.getRange('K1').getValue() === 'Столбец 1') {
    calc.getRange('K1').setValue('Метка');
    log.push('Расчеты K1: «Столбец 1» -> «Метка»');
  }
  var priceRows = { 'GRAM LIVE': ['Medium', 'spot'], 'SPCXB': ['Medium', 'stock'] };
  var lastPriceRow = prices.getLastRow();
  var priceAssets = prices.getRange(1, 1, lastPriceRow, 1).getDisplayValues();
  for (var r = 0; r < priceAssets.length; r++) {
    var passport = priceRows[String(priceAssets[r][0]).trim()];
    if (passport && !prices.getRange(r + 1, 9).getValue()) {
      prices.getRange(r + 1, 9, 1, 2).setValues([passport]);
      log.push('Цены ' + priceAssets[r][0] + ': приоритет/тип заполнены');
    }
  }

  Logger.log(log.join('\n'));
  return log;
}
