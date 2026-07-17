# ACCOUNTING RULES

Status: baseline  
Scope: Google Sheets + Apps Script + frontend contract  
Last updated: 2026-07-11

---

# Core Rule

Google Sheets is the accounting source of truth.

Frontend can normalize and display accounting state, but it must not become the primary accounting engine.

---

# Units

Money:
- numeric USD values;
- no formatted strings in API numbers.

PnL percent:
- `overview.pnlPct` is decimal fraction;
- `history.pnlPct` should also be decimal fraction;
- example: `-0.0004` displays as `-0.04%`.

Portfolio row percent:
- `portfolio[].pnlPct` is direct percent for table display;
- `portfolio[].share` is direct percent for table display;
- example: `12.2` displays as `12.2%`.

Risk shares:
- current API exports risk share fields as direct percent;
- frontend may normalize them to ratio for visual components.

Fear & Greed buy percentage:
- `fearGreedStrategy.rules[].buyPct` is decimal fraction;
- example: `0.01` means `1%` of portfolio value.

---

# Position Accounting

## BUY

BUY increases:
- `quantity`;
- `invested`;
- `costBasis`.

Average entry after BUY:

`newAvgEntry = newCostBasis / newQuantity`

## SELL

SELL decreases:
- `quantity`;
- `costBasis` by old average entry cost of sold units.

SELL does not recalculate remaining average entry from sale proceeds.

Partial SELL rule:

`remainingCostBasis = oldCostBasis - soldQuantity * oldAvgEntry`

`remainingAvgEntry = oldAvgEntry`

Realized PnL:

`realizedPnL = saleProceeds - soldQuantity * oldAvgEntry`

## TRANSFER

TRANSFER does not change cost basis by itself.

Allowed effects:
- move asset between wallets/accounts;
- update location metadata;
- add network fee if explicitly tracked.

## IMPORT

Imported blockchain data is raw fact evidence, not approved accounting state.

Rules:
- import rows start in `Транзакции_IMPORT`;
- pending rows do not change portfolio truth;
- only reviewed/approved rows can become accounting rows in `Транзакции`;
- unknown assets, dust, spam and unclear swaps stay pending or skipped.

## SWAP

SWAP is accounting shorthand only.

It must be represented as:
- SELL disposed asset;
- BUY acquired asset.

Reason:
cost basis, realized PnL and average entry must stay auditable.

---

# Closed Positions

Closed markers:
- `CLOSED`;
- `FIXED`;
- `EXITED`.

Closed zero-value rows:
- can remain in Sheets for history;
- must not distort active portfolio allocation;
- should be excluded from active risk display.

---

# Futures And Metals

`USDC HL`:
- category target: `Свободные деньги`;
- represents Hyperliquid futures cash bucket;
- belongs to `futuresDeployableCash`;
- must not be counted as normal spot deployable cash.

`GOLD LONG`:
- currently lives in futures-style infrastructure;
- risk category is `Металлы`;
- should not be treated as speculative crypto futures exposure unless explicitly reclassified.

Speculative futures:
- must remain separately visible from spot portfolio;
- should be constrained by risk limits before PnL emphasis.

---

# Risk-First Display Rules

UI must not:
- hide losses by changing units;
- present stale cached values as live;
- show aggressive deploy signals when API state is stale/error;
- treat unreviewed imports as portfolio truth.

UI may:
- derive open-risk best/worst positions if API values are stale;
- normalize legacy category aliases;
- show fallback only with clear stale/error state.

---

# Test Targets

Future isolated tests should cover:
- BUY average entry recalculation;
- partial SELL preserving average entry;
- realized PnL on SELL;
- TRANSFER not changing cost basis;
- SWAP as SELL + BUY;
- decimal fraction formatting for `overview.pnlPct`;
- direct percent formatting for `portfolio[].pnlPct`;
- cash alias normalization;
- closed position filtering;
- futures cash separation from spot cash.

---

# Invariants (проверено сверкой 2026-07-16)

Инварианты для любых будущих сверок цифр (см. SHEET_CROSSCHECK_2026-07-16.md):

1. Спот-позиция: quantity × avgEntry ≈ invested (допуск — округление
   отображения, до 0.05$).
2. Фьючерс-позиция: invested = начальная МАРЖА, не номинал.
   Номинал = quantity × avgEntry ≈ invested × leverage.
   Проверка qty × entry == invested к фьючерсам НЕ применима.
3. Категория «Кэш / Стейблы» в таблице отдаётся API как «Свободные деньги»
   (normalizePortfolioCategoryForApi). Сверки резерва по API ищут
   «Свободные деньги», не русское имя листа.
4. overview.invested / portfolioValue = ROUND(SUM(raw);2) — может отличаться
   от суммы построчных display-значений на ≤0.05$. Это не ошибка учёта.
5. Формулы в таблицу пишутся ТОЛЬКО с ";"-разделителями (русская локаль,
   "," — десятичный разделитель; формулы с запятыми дают #ERROR!).
6. Реализованный профит живёт в «Расчеты» O:U (realizedProfitUsd/Pct),
   в API — overview.realizedPnl / realizedPnlPct. В текущий PnL не входит.

# Class Limits (политика владельца, 2026-07-16)

Полная картина рынка — всё куплено по лимитам:
крипта 60% + акции 10% + металлы 10% + фьючерсы 10% + резерв 10% = 100%.
Резерв: цель 30% (коридор 30–60% = 100 баллов), пол 10% — ниже не опускаем.
Источник в коде: src/config/riskRules.ts; в таблице: Риск B14-B16, B21, B27.

---

# Wallet Flow Types (типы операций кошельковых импортов, 2026-07-17)

Кошельковые импорты (Arbitrum, BNB) детектируют операции по дельте баланса
между синками и пишут аудит-строки в «Транзакции_IMPORT». На сайте (страница
«Отчёты» → «История сделок») они показываются цветными чипами:

| Действие | Когда | Влияние на портфель | Чип на сайте |
|---|---|---|---|
| Покупка | стейбл↓ + актив↑ | средний вход усредняется, вложено растёт | синий (tx-buy) |
| Продажа | стейбл↑ + актив↓ | вход не меняется, фиксируется PnL | красный (tx-sell) |
| Пополнение | приход стейбла без встречной пары | резерв растёт | зелёный (tx-in) |
| Вывод | уход стейбла без встречной пары | резерв падает | оранжевый (tx-out) |
| Обмен | стейбл↓ + другой стейбл↑ (~поровну, допуск 2%) | нейтрально | голубой (tx-swap) |

Ключевые факты:
- Обмен и стейбл-потоки PnL не создают (поле «PnL сделки» = «—»).
- Средний вход при Покупке усредняется автоматически (не задаётся вручную).
- USDC на BNB Chain имеет 18 знаков (не 6, как в других сетях) — частая ловушка.
- Все аудит-строки идут со статусом PENDING и меткой importId (защита от дублей).
- Общее ядро всех импортов: apps-script/walletLedger.gs (IC_LEDGER_*).
  Новый сетевой импорт зависит только от ядра, не от других сетевых файлов.
- Классификация дельт живёт в сетевом файле (Arbitrum = ETH-спот,
  BNB = токенизированные акции).
