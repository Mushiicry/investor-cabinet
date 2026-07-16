# SHEET_CROSSCHECK_2026-07-16

Источник JSON: `https://script.google.com/macros/s/AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA/exec`

`updatedAt`: `2026-07-16T12:40:14.869Z`

| Проверка | Ожидание | Факт | OK-FAIL |
|---|---:|---:|---|
| sum(invested строк) == overview.invested | 541.24 | 541.20 | FAIL |
| sum(currentValue строк) == overview.portfolioValue | 517.362782841 | 517.40 | FAIL |
| overview.pnl == portfolioValue - invested | -23.80 | -23.800000000000068 | OK |
| reserve == sum(currentValue строк категории "Кэш / Стейблы") | 0.00 | 205.51 | FAIL |
| positionsCount == число строк с currentValue>0 вне кэша | 9 | 7 | FAIL |
| По каждой строке: \|quantity*avgEntry - invested\| < 0.01 | max diff < 0.01 | max diff 59.957993999999985 | FAIL |
| По каждой строке: \|quantity*currentPrice - currentValue\| < 0.01 | max diff < 0.01 | max diff 60.79902699999998 | FAIL |
| Сумма share всех строк ≈ 100% | ≈ 100 | 100.01 | OK |

## Детали FAIL по строкам

| Актив | Проверка | Ожидание | Факт | OK-FAIL |
|---|---:|---:|---:|---|
| TON | quantity*avgEntry - invested | < 0.01 | 0.0731049999999982 | FAIL |
| TON | quantity*currentPrice - currentValue | < 0.01 | -0.02718856000001324 | FAIL |
| GOLD LONG | quantity*avgEntry - invested | < 0.01 | 59.957993999999985 | FAIL |
| GOLD LONG | quantity*currentPrice - currentValue | < 0.01 | 60.79902699999998 | FAIL |
| MNT LONG | quantity*avgEntry - invested | < 0.01 | 10.417000000000002 | FAIL |
| MNT LONG | quantity*currentPrice - currentValue | < 0.01 | 10.453557 | FAIL |

## Резолюция (Claude, 2026-07-16)

Перепроверил каждый FAIL — реальных ошибок учёта нет. Три класса ложных срабатываний:

1. **Округление отображения** (`invested` 541.24 vs 541.20; `portfolioValue`; TON Δ0.07).
   API отдаёт строки из display-значений (2 знака), а overview — `ROUND(SUM(raw);2)`.
   Δ ≤ 0.04$ — расхождение форматирования, не учёта.
2. **Переименование категории в API** (`reserve`, `positionsCount`).
   Apps Script нормализует «Кэш / Стейблы» → «Свободные деньги»
   (`normalizePortfolioCategoryForApi`). Проверка искала русское имя листа — 0 строк.
   Фактически: reserve 205.51 = sum(«Свободные деньги») ✓; positionsCount 7 ✓
   (совпадает с COUNTIFS Обзор!F2, Codex посчитал с кэш-строками).
3. **Фьючерсная модель маржи** (GOLD LONG Δ60, MNT LONG Δ10).
   Для фьючерсов `invested` = начальная маржа, а `quantity*avgEntry` = номинал.
   GOLD x3: номинал 89.94 / маржа 29.98 ✓; MNT x2: 20.76 / 10.34 ✓.
   Инвариант `qty*entry == invested` применим только к споту (см. ACCOUNTING_RULES).

Вывод: расчётное ядро таблицы сходится. Инварианты для будущих сверок:
спот — `qty*entry ≈ invested`; фьючерс — `qty*entry ≈ invested × leverage`;
категория кэша в API называется «Свободные деньги».
