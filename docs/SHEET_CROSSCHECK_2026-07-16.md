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
