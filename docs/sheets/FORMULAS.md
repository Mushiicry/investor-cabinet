# FORMULAS

## OVERVIEW

portfolioValue
= spot portfolio currentValue
+ futures currentValue
+ stable reserve

invested
= сумма всех вложенных средств в spot
+ сумма всех margin во futures

pnl
= portfolioValue - invested

pnlPct
= (pnl / invested) * 100

reserve
= сумма всех стейблов и свободного кэша

positionsCount
= количество активных spot и futures позиций

health
= общий health score портфеля

health зависит от:
- reserve %
- futures exposure
- diversification
- drawdown
- свободного кэша
- risk load

state
= текстовое состояние портфеля:
- Отлично
- Хорошо
- Нормально
- Опасно

signal
= краткий вывод по состоянию портфеля

action
= рекомендованное действие


---

## PORTFOLIO

currentValue
= quantity × currentPrice

pnl
= currentValue - investedValue

pnlPct
= (pnl / investedValue) * 100

share
= (currentValue / portfolioValue) * 100


---

## FUTURES

positionValue
= margin × leverage

PnL во futures считается
от полного объема позиции,
а не от margin.

Risk считается
от полного объема позиции.

currentValue
= margin + pnl

LONG pnl
= ((currentPrice - entryPrice) / entryPrice)
× positionValue

SHORT pnl
= ((entryPrice - currentPrice) / entryPrice)
× positionValue

liqPrice
= приблизительный уровень ликвидации позиции

futuresExposure
= сумма всех futures positionValue

futuresShare
= (futuresExposure / portfolioValue) * 100


---

## RISK

riskScore
зависит от:
- доли futures
- доли reserve
- концентрации активов
- volatility exposure
- drawdown
- leverage load

Высокий reserve
= снижает риск.

Высокий leverage
= повышает риск.

Высокая концентрация
в одном активе
= повышает риск.


---

## CATEGORY ALLOCATION

cryptoShare
= cryptoValue / portfolioValue

metalsShare
= metalsValue / portfolioValue

futuresShare
= futuresExposure / portfolioValue

cashShare
= reserve / portfolioValue


---

## PRICES

currentPrice
подтягивается через:
- Hyperliquid API
- manual override
- fallback sources

Обновление цен:
каждые 5 минут.

Источник цены хранится отдельно.


---

## API

SITE API PATCH 1.1
отдает:

overview
portfolio
risk
decisions
scenarios

Frontend читает:
- overview
- risk
- partially portfolio

portfolio сейчас частично собирается
локально внутри App.tsx fallback state.


---

## IMPORTANT LOGIC

Investor Cabinet
не является trading terminal.

Главная цель:
- контроль риска
- дисциплина
- управление капиталом
- эмоциональная стабильность инвестора

PnL
не является главным показателем.

Главный показатель:
способность продолжать стратегию
в любых фазах рынка.