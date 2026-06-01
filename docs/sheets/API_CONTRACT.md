# API_CONTRACT

## SITE API PATCH 1.2

Главный API проекта.

Frontend получает данные через:

/api/investor


---

# ROOT STRUCTURE

API должен возвращать:

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

Структуру нельзя ломать.

Допустимые fallback-правила frontend:
- если root response сломан, используется предыдущий state;
- если `portfolio` не массив, используется предыдущий portfolio state;
- если отдельные числовые поля невалидны, frontend использует fallback values;
- `success` должен быть boolean, если поле присутствует.


---

# UNITS

Денежные поля:
- только number;
- валюта подразумевается USD;
- строки вида "$100" не использовать.

Проценты в API:
- `overview.pnlPct`, `overview.health`, `risk.reserveShare`, `risk.largestRiskShare`, `risk.cryptoShare`, `risk.health` приходят как прямые проценты: `82.6`, а не `0.826`;
- frontend нормализует эти поля в ratio `0..1` там, где это нужно UI;
- `portfolio.pnlPct` и `portfolio.share` используются таблицей как прямые проценты: `12.2`.

Текстовые поля:
- должны приходить строками;
- пустая строка допустима как fallback, но лучше отдавать осмысленное risk-first описание.


---

# OVERVIEW

overview используется:
- верхними карточками
- risk summary
- overview page
- portfolio summary

Обязательные поля:

{
  "portfolioValue": 0,
  "invested": 0,
  "pnl": 0,
  "pnlPct": 0,
  "reserve": 0,
  "positionsCount": 0,
  "health": 0,
  "state": "",
  "signal": "",
  "action": "",
  "bestPosition": {
    "asset": "",
    "pnl": 0,
    "pnlPct": 0
  },
  "worstPosition": {
    "asset": "",
    "pnl": 0,
    "pnlPct": 0
  }
}

Нельзя переименовывать:
- portfolioValue
- invested
- pnl
- pnlPct
- reserve
- positionsCount
- health
- state
- signal
- action
- bestPosition
- worstPosition

Важно:
- frontend пересчитывает best/worst по открытым risk positions, если они есть;
- stale `overview.bestPosition` и `overview.worstPosition` используются только как fallback.


---

# PORTFOLIO

portfolio используется:
- portfolio page
- overview allocation
- top positions

Frontend ожидает массив объектов:

{
  "asset": "",
  "category": "",
  "quantity": 0,
  "avgEntry": 0,
  "currentPrice": 0,
  "invested": 0,
  "currentValue": 0,
  "pnl": 0,
  "pnlPct": 0,
  "share": 0,
  "status": ""
}

Нельзя менять naming полей.

Допустимые category values:
- "Крипта"
- "Металлы"
- "Фьючерсы"
- "Акции"
- "Свободные деньги"

Допустимый legacy alias:
- "Кэш / Стейблы" нормализуется во frontend как "Свободные деньги".

Status values:
- "Reserve" / "Резерв"
- "Accumulate" / "Накапливать"
- "Watch" / "Наблюдать"
- "Hedge" / "Хедж"
- "Speculation" / "Спекуляция"
- "Hold" / "Держать"

Closed position markers:
- "CLOSED"
- "FIXED"
- "EXITED"

Закрытые позиции не должны ломать frontend. Если позиция закрыта и `currentValue` равен 0, frontend исключает ее из active portfolio display.

USDC HL:
- относится к category "Свободные деньги";
- используется frontend как futures cash bucket;
- входит в `futuresDeployableCash`, а не в spot deployable cash.


---

# RISK

risk используется:
- risk page
- health system
- reserve analysis
- deployable cash logic

Frontend ожидает:

{
  "portfolioValue": 0,
  "health": 0,
  "reserve": 0,
  "reserveShare": 0,
  "deployableCash": 0,
  "futuresDeployableCash": 0,
  "spotDeployableCash": 0,
  "largestRiskAsset": "",
  "largestRiskShare": 0,
  "cryptoShare": 0,
  "stocksShare": 0,
  "metalsShare": 0,
  "futuresShare": 0,
  "cashShare": 0,
  "state": "",
  "signal": "",
  "summary": ""
}

Deployable cash:
- `deployableCash` остается legacy/general field;
- `futuresDeployableCash` показывает capital bucket для фьючерсов;
- `spotDeployableCash` показывает капитал, который можно использовать в spot без нарушения reserve floor.
- frontend не должен использовать legacy `deployableCash` как fallback для `futuresDeployableCash`.

Risk layer важнее PnL layer. Тексты `state`, `signal`, `summary` должны быть дисциплинирующими, а не провоцирующими aggressive trading.


---

# HISTORY

history используется:
- future history charts;
- portfolio value history;
- PnL history;
- reserve history;
- drawdown foundation.

Source of truth:
- Google Sheets лист `История`.

Frontend ожидает optional массив объектов:

{
  "date": "",
  "portfolioValue": 0,
  "invested": 0,
  "pnl": 0,
  "pnlPct": 0,
  "reserve": 0,
  "positionsCount": 0,
  "pointType": "",
  "note": "",
  "trigger": "",
  "source": "",
  "comment": ""
}

Важно:
- `history` optional на этапе Stage 2, чтобы не ломать текущий Apps Script;
- frontend already accepts and normalizes `history` when API starts sending it;
- frontend can read existing sheet-export decimal strings like `"438,9"` and `"2,8%"` only inside the history normalizer;
- frontend не должен строить настоящую историю из browser cache;
- browser cache можно использовать только как UX cache последнего live состояния.


---

# WALLET TRANSACTION IMPORT

Status:
planned Stage 2 integration.

Primary tracked public wallet:

`UQALTg4Pc2kWGwMY2cxv4-gSi-pmVOnvKjgK81oyb1vUhKMp`

Wallet imports are not part of `/api/investor` root state yet.

Source of truth:
- reviewed rows in Google Sheets `Транзакции`.

Pending import source:
- Google Sheets `Транзакции_IMPORT`.

Wallet config source:
- Google Sheets `TON_WALLETS`.

Important:
- wallet import must be read-only;
- no private keys;
- no seed phrases;
- no signing permissions;
- no direct writes to `Портфель`;
- no direct writes to `Транзакции` before review.

Pending import row contract:

{
  "importId": "TON:<address>:<hash>:<lt>",
  "status": "PENDING",
  "date": "",
  "asset": "",
  "category": "",
  "action": "",
  "quantity": 0,
  "price": 0,
  "amount": 0,
  "comment": "",
  "walletId": "",
  "chain": "TON",
  "hash": "",
  "lt": "",
  "direction": "",
  "counterparty": "",
  "rawAsset": "",
  "rawAmount": "",
  "reviewNote": ""
}

Allowed initial statuses:
- `PENDING`;
- `APPROVED`;
- `SKIPPED`.

Allowed initial assets:
- `TON`;
- `USDT`;
- `USDC`.

Unknown assets must stay pending or skipped until reviewed.


---

# DECISIONS

decisions используются:
- decisions page
- strategic commentary

Формат:

{
  "asset": "",
  "thesis": "",
  "whyHold": "",
  "expect": "",
  "nextAction": "",
  "reviewTrigger": "",
  "status": ""
}

Допустимые sheet-export aliases на Stage 2:
- `Asset` -> `asset`;
- `Current Thesis` -> `thesis`;
- `Why I Hold It` -> `whyHold`;
- `What I Expect` -> `expect`;
- `Next Action` -> `nextAction`;
- `Review Trigger` -> `reviewTrigger`;
- `Status` -> `status`.


---

# SCENARIOS

scenarios используются:
- scenarios page
- market planning

Формат:

{
  "asset": "",
  "base": "",
  "bull": "",
  "bear": "",
  "action": "",
  "invalidation": "",
  "status": ""
}

Допустимые sheet-export aliases на Stage 2:
- `Asset` -> `asset`;
- `Base Case` -> `base`;
- `Bull Case` -> `bull`;
- `Bear Case` -> `bear`;
- `Action Zone` -> `action`;
- `Invalidation` -> `invalidation`;
- `Status` -> `status`.


---

# IMPORTANT NOTES

Frontend сейчас:
- частично использует API
- частично использует local fallback state

Некоторые derived calculations
все еще собираются внутри hooks/frontend.

Risk page
частично использует API,
частично fallback values.

Текущие frontend safety layers:
- `fetchJsonWithTimeout`;
- root API validation;
- portfolio normalization;
- previous state fallback;
- local fallback state.


---

# PRICE SYSTEM

Цены обновляются через:
- Hyperliquid API
- Apps Script scheduler

Обновление:
каждые 5 минут.


---

# IMPORTANT RULES

Нельзя:
- ломать naming API
- менять root structure
- переименовывать overview fields
- менять типы данных

Frontend зависит
от текущего naming.
