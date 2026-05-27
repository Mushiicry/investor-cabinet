# APPS SCRIPT HISTORY EXPORT

Status: Stage 2 preparation  
Scope: read-only export from Google Sheets `История` into `/api/investor`

This note exists because the Apps Script source is not stored in this repository yet. Do not edit sheet formulas for this patch. The next Apps Script change should only read the existing `История` sheet and add an optional `history` array to the root API response.

---

# Source Sheet

Sheet name:

`История`

Expected headers:

| Sheet header | API field |
| --- | --- |
| `Дата` | `date` |
| `Стоимость портфеля` | `portfolioValue` |
| `Вложено` | `invested` |
| `PnL $` | `pnl` |
| `PnL %` | `pnlPct` |
| `Резерв` | `reserve` |
| `Кол-во позиций` | `positionsCount` |
| `Тип точки` | `pointType` |
| `Заметка` | `note` |
| `Триггер` | `trigger` |
| `Источник` | `source` |
| `Комментарий` | `comment` |

---

# API Shape

Add `history` at root level:

```json
{
  "success": true,
  "overview": {},
  "portfolio": [],
  "history": [],
  "risk": {},
  "decisions": [],
  "scenarios": [],
  "updatedAt": ""
}
```

The field is optional during Stage 2. If it is missing, frontend keeps `history: []` or the previous valid history state.

---

# Read-Only Export Sketch

Use this as implementation guidance when patching the real Apps Script. Function names can follow the current script style, but field names must remain stable.

```js
function readHistory_(ss) {
  const sheet = ss.getSheetByName('История');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  const index = (name) => headers.indexOf(name);

  return values.slice(1)
    .filter((row) => row[index('Дата')] && row[index('Стоимость портфеля')])
    .map((row) => ({
      date: formatHistoryDate_(row[index('Дата')]),
      portfolioValue: toNumber_(row[index('Стоимость портфеля')]),
      invested: toNumber_(row[index('Вложено')]),
      pnl: toNumber_(row[index('PnL $')]),
      pnlPct: toNumber_(row[index('PnL %')]),
      reserve: toNumber_(row[index('Резерв')]),
      positionsCount: toNumber_(row[index('Кол-во позиций')]),
      pointType: String(row[index('Тип точки')] || ''),
      note: String(row[index('Заметка')] || ''),
      trigger: String(row[index('Триггер')] || ''),
      source: String(row[index('Источник')] || ''),
      comment: String(row[index('Комментарий')] || ''),
    }));
}
```

Important:
- this export should not write to `История`;
- this export should not change formulas;
- this export should not generate history from cache;
- missing sheet or empty sheet should return `[]`;
- numeric fields should be emitted as numbers where possible.

---

# Frontend State

Frontend already has:
- `PortfolioHistoryPoint`;
- optional API `history`;
- history normalizer;
- sorted history selectors and summary deltas.

After Apps Script starts returning `history`, the next frontend patch can add a read-only history card or chart without changing the API contract.
