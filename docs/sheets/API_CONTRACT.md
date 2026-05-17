# API_CONTRACT

## SITE API PATCH 1.1

Главный API проекта.

Frontend получает данные через:

/api/investor


---

# ROOT STRUCTURE

API должен возвращать:

{
  "overview": {},
  "portfolio": [],
  "risk": {},
  "decisions": [],
  "scenarios": []
}

Структуру нельзя ломать.


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
  "action": ""
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
  "currentValue": 0,
  "pnl": 0,
  "pnlPct": 0,
  "share": 0,
  "status": ""
}

Нельзя менять naming полей.


---

# RISK

risk используется:
- risk page
- health system
- reserve analysis
- deployable cash logic

Frontend ожидает:

{
  "health": 0,
  "reserve": 0,
  "reserveShare": 0,
  "deployableCash": 0,
  "futuresExposure": 0,
  "commentary": ""
}


---

# DECISIONS

decisions используются:
- decisions page
- strategic commentary

Формат:

{
  "title": "",
  "description": "",
  "action": ""
}


---

# SCENARIOS

scenarios используются:
- scenarios page
- market planning

Формат:

{
  "scenario": "",
  "probability": "",
  "strategy": ""
}


---

# IMPORTANT NOTES

Frontend сейчас:
- частично использует API
- частично использует local fallback state

Некоторые portfolio calculations
все еще собираются внутри App.tsx.

Risk page
частично использует API,
частично fallback values.


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