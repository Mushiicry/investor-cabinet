# SHEETS_STRUCTURE

## ОБЗОР

Главный dashboard проекта.

Используется для:
- overview API
- верхних карточек сайта
- health
- state
- signal
- action
- category allocation

Ключевые поля:
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

Не менять:
- структуру overview block
- naming ключевых полей


---

## ПОРТФЕЛЬ

Главный лист spot-позиций.

Содержит:
- активы
- количество
- среднюю цену входа
- текущую цену
- pnl
- долю в портфеле
- статус позиции

Используется:
- portfolio page
- calculations
- overview allocation

Источник истины:
spot portfolio.


---

## ФЬЮЧЕРСЫ

Лист futures-позиций.

Содержит:
- asset
- direction
- leverage
- entryPrice
- currentPrice
- margin
- positionValue
- pnl
- currentValue
- liqPrice

Ключевая логика:
positionValue =
margin × leverage

PnL считается
от полного объема позиции.

Источник истины:
futures exposure.


---

## ЦЕНЫ

Главный price registry проекта.

Содержит:
- ticker
- currentPrice
- api source
- auto update
- asset type

Используется:
- Apps Script
- API
- Portfolio
- Futures
- Overview

Автообновление:
Hyperliquid API.

Не менять:
- naming ticker
- API column
- auto update logic


---

## РАСЧЕТЫ

Сервисный вычислительный слой.

Содержит:
- промежуточные расчеты
- aggregation
- helper formulas
- derived metrics

Используется:
- overview
- risk
- allocations
- health


---

## РИСК

Главный risk management лист.

Содержит:
- reserve analysis
- futures exposure
- category exposure
- deployable cash
- health score
- risk commentary

Главная задача:
показывать устойчивость портфеля,
а не только прибыль.


---

## РЕШЕНИЯ

Лист логики решений инвестора.

Содержит:
- аргументацию удержания
- причины покупок
- причины продаж
- стратегические действия

Используется:
decision system.


---

## СЦЕНАРИИ

Сценарии развития рынка.

Содержит:
- bullish scenario
- bearish scenario
- black swan scenario
- expected actions

Используется:
scenario system.


---

## ТРАНЗАКЦИИ

Журнал всех операций.

Содержит:
- покупки
- продажи
- ввод средств
- вывод средств
- futures actions

Источник истории портфеля.


---

## ИСТОРИЯ

Историческое состояние портфеля.

Используется:
- historical tracking
- analytics
- future charts

Источник истины для будущего `history` API.
На этапе Stage 2 экспорт должен быть read-only:
читать существующие строки и не менять формулы.


---

## НАСТРОЙКИ

Служебный лист проекта.

Содержит:
- config
- constants
- toggles
- system variables

Не использовать
для пользовательских данных.


---

## HL_DEBUG

Сервисный debug лист.

Используется:
- Hyperliquid debug
- API validation
- ticker diagnostics

Можно очищать.
Не влияет на portfolio logic.
