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

// ════════════════════════════════════════════════════════════════════
// РЕВИЗИЯ, ВОЛНА 2 (2026-07-16, все пункты апрувнуты владельцем):
// 1) «Фьючерсы»: закрыть BTC SHORT, добавить MNT LONG, перевесить GOLD
//    и резерв на «Расчеты», тоталы по категории вместо тикера
// 2) «Риск»: 6 компонент здоровья формулами = модель сайта (portfolioHealth.ts)
// 3) Удалить лист «Портфель» (legacy-зеркало) и «HL_DEBUG» (мусор)
// 4) «точки выхода»: добить ATOM / GOLD LONG / SPCXB (цели заполняет владелец)
// ════════════════════════════════════════════════════════════════════

function applySheetRevisionWave2_20260716() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];

  // ── 1. Фьючерсы ──
  var fut = ss.getSheetByName('Фьючерсы');
  if (fut) {
    var futNames = fut.getRange(1, 1, fut.getLastRow(), 1).getDisplayValues();
    for (var r = 0; r < futNames.length; r++) {
      var nm = String(futNames[r][0]).trim();
      if (nm.indexOf('BTC SHORT') === 0 &&
          fut.getRange(r + 1, 11).getDisplayValue() === 'Открыто') {
        fut.getRange(r + 1, 11).setValue('Закрыто');
        log.push('Фьючерсы: ' + nm + ' -> Закрыто');
      }
      if (nm === 'GOLD LONG') {
        var gr = r + 1;
        fut.getRange(gr, 5).setFormula('=IFERROR(VLOOKUP("GOLD LONG";\'Расчеты\'!A:D;4;FALSE);"")');   // entry
        fut.getRange(gr, 7).setFormula('=IFERROR(VLOOKUP("GOLD LONG";\'Расчеты\'!A:E;5;FALSE);"")');   // margin
        fut.getRange(gr, 6).setFormula('=G' + gr + '*C' + gr);                                          // notional
        fut.getRange(gr, 9).setFormula('=IFERROR(VLOOKUP("GOLD LONG";\'Расчеты\'!A:H;8;FALSE);"")');   // pnl
        fut.getRange(gr, 10).setFormula('=IFERROR(VLOOKUP("GOLD LONG";\'Расчеты\'!A:G;7;FALSE);"")');  // current
        log.push('Фьючерсы: GOLD LONG перевешен на «Расчеты»');
      }
      if (nm === 'HL USDC RESERVE') {
        fut.getRange(r + 1, 6, 1, 2).setFormulas([["='Расчеты'!X30", "='Расчеты'!X30"]]);
        log.push('Фьючерсы: HL USDC RESERVE -> X30 (реально свободный USDC на HL)');
      }
    }
    // MNT LONG — живая спекулятивная позиция, отсутствовала на листе
    var hasMnt = futNames.some(function(row) { return String(row[0]).trim() === 'MNT LONG'; });
    if (!hasMnt) {
      var reserveRow = 0;
      for (var i = 0; i < futNames.length; i++) {
        if (String(futNames[i][0]).trim() === 'HL USDC RESERVE') { reserveRow = i + 1; break; }
      }
      var newRow = reserveRow || fut.getLastRow() + 1;
      fut.insertRowBefore(newRow);
      fut.getRange(newRow, 1, 1, 16).setValues([[
        'MNT LONG', 'Лонг', 2, 'MNT', '', '', '', '', '', '', 'Открыто',
        'MNT long x2, Hyperliquid. Количество/маржа/PnL живут в «Расчетах», лист — витрина.',
        '', 'Hyperliquid', 'Фьючерсы', 'Средний'
      ]]);
      fut.getRange(newRow, 5).setFormula('=IFERROR(VLOOKUP("MNT LONG";\'Расчеты\'!A:D;4;FALSE);"")');
      fut.getRange(newRow, 7).setFormula('=IFERROR(VLOOKUP("MNT LONG";\'Расчеты\'!A:E;5;FALSE);"")');
      fut.getRange(newRow, 6).setFormula('=G' + newRow + '*C' + newRow);
      fut.getRange(newRow, 8).setFormula('=IFERROR(VLOOKUP("MNT";\'Цены\'!B:C;2;FALSE);"")');
      fut.getRange(newRow, 9).setFormula('=IFERROR(VLOOKUP("MNT LONG";\'Расчеты\'!A:H;8;FALSE);"")');
      fut.getRange(newRow, 10).setFormula('=IFERROR(VLOOKUP("MNT LONG";\'Расчеты\'!A:G;7;FALSE);"")');
      log.push('Фьючерсы: MNT LONG добавлен (строка ' + newRow + ')');
    }
    // Тоталы: по категории и статусу, а не по тикеру BTC-PERP
    var totalNames = fut.getRange(1, 1, fut.getLastRow(), 1).getDisplayValues();
    var dataEnd = 0; // последняя строка данных перед первым TOTAL
    for (var q = 0; q < totalNames.length; q++) {
      if (String(totalNames[q][0]).indexOf('TOTAL') >= 0) break;
      if (totalNames[q][0]) dataEnd = q + 1;
    }
    var span = function(col) { return col + '2:' + col + dataEnd; };
    var totalFormula = function(col, category) {
      return '=SUMIFS(' + span(col) + ';' + span('K') + ';"Открыто";' +
             span('O') + ';"' + category + '")';
    };
    for (var t = 0; t < totalNames.length; t++) {
      var tn = String(totalNames[t][0]).trim();
      if (tn === 'SPEC FUTURES TOTAL (BTC ONLY)' || tn === 'SPEC FUTURES TOTAL') {
        fut.getRange(t + 1, 1).setValue('SPEC FUTURES TOTAL');
        ['F', 'G', 'I', 'J'].forEach(function(col) {
          fut.getRange(col + (t + 1)).setFormula(totalFormula(col, 'Фьючерсы'));
        });
        log.push('Фьючерсы: SPEC TOTAL по категории «Фьючерсы» (было: только BTC-PERP)');
      }
      if (tn === 'GOLD METALS TOTAL (INFO ONLY)') {
        ['F', 'G', 'I', 'J'].forEach(function(col) {
          fut.getRange(col + (t + 1)).setFormula(totalFormula(col, 'Металлы'));
        });
        log.push('Фьючерсы: GOLD TOTAL по категории «Металлы»');
      }
    }
  }

  // ── 2. Риск: здоровье = модель сайта, 6 компонент формулами ──
  var risk = ss.getSheetByName('Риск');
  if (risk) {
    var comps = [
      // [строка, метка, формула (0..100), описание]
      [21, 'Резерв (20%)',
       '=ROUND(IF(B4<=0;0;IF(B4<0,3;B4/0,3*100;IF(B4<=0,6;100;MAX(0;(1-B4)/(1-0,6)*100))));0)',
       'Коридор 30–60% = 100. Ниже — не хватает подушки, выше — капитал простаивает.'],
      [22, 'Сопротивление волатильности (17%)',
       '=ROUND(MAX(0;MIN(100;(0,9-B8)/(0,9-0,6)*100));0)',
       'Экспозиция в волатильных активах против лимита 60%.'],
      [23, 'Фьючерсы (15%)',
       '=IFERROR(ROUND(MAX(0;100-MIN(\'Расчеты\'!X2/\'Обзор\'!B2/0,1;1)*20-MAX(0;\'Расчеты\'!X2/\'Обзор\'!B2/0,1-1)*50-COUNTIFS(\'Расчеты\'!B2:B100;"Фьючерсы";\'Расчеты\'!G2:G100;">0")*5-MAX(0;COUNTIFS(\'Расчеты\'!B2:B100;"Фьючерсы";\'Расчеты\'!G2:G100;">0")-3)*20);0);100)',
       'Маржа ≤10% от вложенного + штраф за каждую позицию (плечо детально считает сайт).'],
      [24, 'Концентрация (18%)',
       '=ROUND(MAX(0;MIN(100;(0,5-B7)/(0,5-0,2)*100));0)',
       'Нет перегруза одним активом (лимит 35%).'],
      [25, 'Диверсификация (15%)',
       '=IFERROR(ROUND((1-(SUMIF(\'Расчеты\'!B2:B100;"Крипта";\'Расчеты\'!G2:G100)^2+SUMIF(\'Расчеты\'!B2:B100;"Металлы";\'Расчеты\'!G2:G100)^2+SUMIF(\'Расчеты\'!B2:B100;"Акции";\'Расчеты\'!G2:G100)^2)/(SUMIF(\'Расчеты\'!B2:B100;"Крипта";\'Расчеты\'!G2:G100)+SUMIF(\'Расчеты\'!B2:B100;"Металлы";\'Расчеты\'!G2:G100)+SUMIF(\'Расчеты\'!B2:B100;"Акции";\'Расчеты\'!G2:G100))^2)/(1-1/3)*100;0);0)',
       'Нормализованный HHI рискового капитала: крипта / металлы / акции. Кэш и фьючерсы не входят.'],
      [26, 'Гибкость (15%)',
       '=ROUND(MAX(0;MIN(100;B4/0,5*100));0)',
       'Свободный кэш против комфортной зоны 50%.']
    ];
    comps.forEach(function(c) {
      risk.getRange(c[0], 1).setValue(c[1]);
      risk.getRange(c[0], 2).setFormula(c[2]);
      risk.getRange(c[0], 4).setValue(c[3]);
    });
    risk.getRange('B9').setFormula(
      '=ROUND(B21*20%+B22*17%+B23*15%+B24*18%+B25*15%+B26*15%;0)'
    );
    risk.getRange('D9').setValue(
      'Единый Health Factor — та же 6-компонентная модель, что на сайте (portfolioHealth.ts).'
    );
    log.push('Риск: здоровье пересобрано по модели сайта, хардкоды 84 заменены формулами');
  }

  // ── 3. Удаления ──
  var portfolioSheet = ss.getSheetByName('Портфель');
  if (portfolioSheet) { ss.deleteSheet(portfolioSheet); log.push('Лист «Портфель» удалён (legacy-зеркало)'); }
  var hlDebug = ss.getSheetByName('HL_DEBUG');
  if (hlDebug) { ss.deleteSheet(hlDebug); log.push('Лист «HL_DEBUG» удалён (936 строк мусора)'); }

  // ── 4. точки выхода ──
  var exits = ss.getSheetByName('точки выхода');
  if (exits) {
    var existing = exits.getRange(1, 1, exits.getLastRow(), 1).getDisplayValues()
      .map(function(row) { return String(row[0]).trim(); });
    ['ATOM', 'GOLD LONG', 'SPCXB'].forEach(function(asset) {
      if (existing.indexOf(asset) === -1) {
        exits.appendRow([asset, '']);
        log.push('точки выхода: добавлен ' + asset + ' (цель заполняет владелец)');
      }
    });
  }

  Logger.log(log.join('\n'));
  return log;
}
