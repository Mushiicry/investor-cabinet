# Roadmap реализации Risk & Portfolio Health

Дата: 2026-07-21  
Статус: рабочий roadmap реализации  
Основание: `docs/RISK_AND_PORTFOLIO_HEALTH_MANIFEST.md`

## 0. Главный принцип реализации 

Реализация должна идти не с красивого UI, а с риск-модели.

Правильный порядок:

```text
Data contract
        ↓
Pure calculations
        ↓
Risk decisions
        ↓
UI presentation
        ↓
Journal / feedback
        ↓
Behavior correction
```

Запрещено:

1. хардкодить портфельные данные во frontend;
2. менять структуру Google Sheets без отдельного согласования;
3. менять API contract без отдельного согласования;
4. делать визуальную переделку Health без готовой модели лучей;
5. внедрять trading-функции, которые обходят risk gate;
6. считать PnL главным показателем качества решения.

## 1. Целевая архитектура

Каноническая цепочка:

```text
Portfolio Health
        ↓
Survival Engine
        ↓
Decision Engine
        ↓
Pre-Trade Engine
        ↓
Execution
        ↓
Trade Journal
        ↓
Behavior Engine
        ↓
Health пересчитывается
```

Реализовывать нужно именно в этом порядке. Если начать с журнала или красивого калькулятора до Survival Engine, система снова станет dashboard-ом, а не risk-first decision system.

## 2. Этап 0 - Freeze текущих правил

Цель: зафиксировать, что является источником правды и что нельзя ломать.

Что сделать:

1. Проверить текущий API shape `/api/investor`.
2. Проверить текущие поля `risk`, `overview`, `portfolio`, `futures`, `prices`.
3. Проверить текущую модель `portfolioHealth`.
4. Проверить текущий Health UI и откуда он берет компоненты.
5. Зафиксировать текущий контракт в docs перед изменениями.

Файлы-кандидаты для чтения:

1. `docs/sheets/API_CONTRACT.md`;
2. `docs/DATA_SOURCE_OF_TRUTH.md`;
3. `docs/ACCOUNTING_RULES.md`;
4. `src/lib/portfolioHealth.ts`;
5. `src/config/riskRules.ts`;
6. `src/v2/components/V2HealthPage.tsx`;
7. `src/v2/components/V2HealthCore.tsx`;
8. `src/v2/lib/preTradeGate.ts`;

Критерий готовности:

1. понятно, какие поля уже есть;
2. понятно, чего не хватает;
3. понятно, какие изменения требуют Google Sheets/API;
4. нет runtime-изменений.

## 3. Этап 1 - Health Hexagon v2

Цель: сохранить центральный гексагон, но убрать дублирование лучей.

Новые 6 лучей:

1. `Liquidity & Reserve`;
2. `Allocation Structure`;
3. `Concentration Risk`;
4. `Speculative Risk`;
5. `Scenario Survival`;
6. `Discipline Integrity`.

Что сделать:

1. Описать точную формулу каждого луча.
2. Разделить `score component` и `hard blocker`.
3. Убрать идею, что 10% futures/trading sleeve - цель.
4. Перевести active trading block в модель `used / remaining / breach`.
5. Добавить `topRiskDriver`.
6. Добавить `healthStatus`: `CONTROL / WATCH / RISK / BLOCKED`.

Что не делать:

1. не менять UI-геометрию до готовности формул;
2. не добавлять новые визуальные блоки ради красоты;
3. не смешивать Fear & Greed с Health.

Критерий готовности:

1. каждый луч отвечает на отдельный вопрос;
2. изменение одного фактора не двигает 3 луча одновременно без причины;
3. Health показывает не только score, но и главный риск;
4. 10% active trading отображается как hard cap.

## 4. Этап 2 - Survival Engine

Цель: добавить проверку выживаемости капитала после сильного падения рынка.

Сценарии v1:

1. BTC -20%;
2. BTC -40%;
3. market -60%;
4. altcoin -80%;
5. reserve shock;
6. futures liquidation stress.

Расчеты:

1. portfolio value after shock;
2. loss in USD;
3. loss in %;
4. reserve after shock;
5. largest loss driver;
6. breached limits after shock;
7. survival result.

Выход:

```text
SURVIVES
CAUTION
DOES_NOT_SURVIVE
```

Что сделать:

1. Создать чистую расчетную функцию без UI.
2. Подключить ее к Health v2.
3. Показать `Scenario Survival` как отдельный луч.
4. Добавить краткий текст: `что ломает выживаемость`.

Критерий готовности:

1. любая планируемая покупка может быть проверена через shock scenario;
2. Health ухудшается, если после покупки survival падает;
3. система может сказать `не покупать`, даже если сигнал хороший.

## 5. Этап 3 - Decision Engine

Цель: сделать слой, который переводит состояние портфеля в действие, запрет или ожидание.

Decision Engine не должен торговать сам. Он должен отвечать:

```text
ALLOW
ALLOW_WITH_LIMIT
CAUTION
BLOCK
WAIT
REDUCE_RISK
```

Порядок проверки:

1. разрешен ли токен;
2. входит ли в CoinMarketCap Top-100;
3. есть ли Binance Monitoring Tag;
4. есть ли деньги на покупку;
5. сохранится ли резерв;
6. не превышен ли лимит актива;
7. не превышен ли лимит класса;
8. не превышен ли 10% active trading cap;
9. что будет при BTC -40% / market -60%;
10. как изменится Health;
11. есть ли нарушение дисциплины;
12. не превышен ли дневной лимит сделок;
13. не превышен ли дневной лимит просадки;
14. стоит ли вообще покупать.

Что сделать:

1. Описать тип `DecisionResult`.
2. Описать тип `DecisionReason`.
3. Разделить `hardBlockReasons` и `warnings`.
4. Добавить `maxAllowedBuyUsd`.
5. Добавить `recommendedAction`.

Критерий готовности:

1. система может объяснить каждый запрет;
2. нет черного ящика;
3. пользователь видит не просто `BLOCK`, а причину;
4. любое разрешение ограничено размером и риском.

## 6. Этап 4 - Forbidden Tokens Gate

Цель: запретить покупки активов, которые не проходят базовый quality gate.

Hard block v1:

1. токен вне CoinMarketCap Top-100;
2. токен в Binance Monitoring List.

Важно:

Forbidden lists нельзя хардкодить в UI. Источник должен быть контролируемым:

1. Google Sheets tab;
2. Apps Script API;
3. backend/data layer в будущем.

Порядок реализации:

1. Сначала определить источник данных.
2. Затем добавить read-only API field.
3. Затем добавить pure gate function.
4. Затем подключить к Decision Engine.
5. Только потом показывать в UI.

Критерий готовности:

1. forbidden token блокируется до расчета покупки;
2. причина запрета понятна;
3. UI не содержит захардкоженный список токенов;
4. разрешенный токен все равно проходит остальные risk checks.

## 7. Этап 5 - Pre-Trade Calculator

Цель: перед покупкой показать, что изменится в портфеле.

Ввод:

1. asset;
2. сумма покупки;
3. цена покупки;
4. direction;
5. stop-loss для активной сделки;
6. setup tag;
7. emotion tag;

Расчет:

1. новая quantity;
2. новая средняя цена;
3. новая доля актива;
4. новая доля класса;
5. изменение резерва;
6. изменение Health;
7. изменение survival status;
8. изменение risk budget;
9. max allowed buy size.

Формула усреднения:

```text
newAvgEntry = (currentCostBasis + newBuyUsd) / (currentQty + newBuyUsd / newBuyPrice)
```

Критерий готовности:

1. пользователь видит Health before/after;
2. пользователь видит новую среднюю цену;
3. пользователь видит, почему покупка разрешена или запрещена;
4. SELL не пересчитывает avgEntry через proceeds.

## 8. Этап 6 - Trade Journal

Цель: фиксировать не только сделку, но и качество решения.

Trade Journal должен хранить:

1. дату;
2. актив;
3. direction;
4. сумму;
5. цену;
6. setup;
7. stop-loss;
8. take-profit;
9. Health before;
10. Health after;
11. Decision result;
12. эмоцию;
13. скриншот сетапа;
14. нарушение правил;
15. результат;
16. результат в R;
17. была ли сделка по правилам.

Статистика:

1. winrate;
2. average R;
3. result by setup;
4. violation rate;
5. loss streak;
6. revenge/FOMO markers.

Критерий готовности:

1. можно отличить хорошее решение с плохим результатом от плохого решения с хорошим результатом;
2. Behavior Engine получает данные;
3. Market Psychology Engine получает данные;
4. журнал не ломает Google Sheets source of truth.

## 9. Этап 7 - Behavior Engine

Цель: превратить дисциплину в измеримую систему.

Behavior Engine должен отслеживать:

1. 3 убытка подряд;
2. overtrading;
3. превышение дневного лимита сделок;
4. превышение дневной просадки;
5. увеличение плеча после убытка;
6. FOMO buy;
7. panic sell;
8. revenge trading;
9. сделку против gate;
10. усреднение сверх risk plan.

Блокеры:

1. `cooldown`;
2. `stop trading mode`;
3. `reduce risk only`;
4. `no leverage increase`;
5. `journal required`.

Критерий готовности:

1. система блокирует не пользователя, а опасное поведение;
2. прибыльная сделка против правил все равно считается нарушением;
3. убыточная сделка по правилам не считается поведенческой ошибкой;
4. дисциплина влияет на Health.

## 10. Этап 8 - Market Psychology Engine

Цель: анализировать поведение инвестора в рыночном контексте.

Не задача:

1. предсказывать рынок;
2. давать эмоциональный score;
3. подменять Health.

Задача:

1. связать Market Regime с поведением;
2. усилить осторожность в greed;
3. разрешать аккуратное использование резерва в fear;
4. повышать риск-флаг при низком резерве;
5. выявлять FOMO/revenge/panic patterns;
6. передавать сигналы в Behavior Engine.

Критерий готовности:

1. Market Psychology Engine влияет на gate decisions;
2. резерв влияет на психологический риск;
3. рынок не улучшает Health напрямую;
4. поведение влияет на дисциплинарный слой.

## 11. Этап 9 - Live Data & Alerts

Цель: оживить активные торговые экраны без потери source of truth.

Что можно подключать:

1. live prices;
2. price alerts;
3. signal freshness;
4. daily limits;
5. Telegram alerts;
6. setup reminders.

Что нельзя:

1. заменять live-данными учетную истину;
2. писать сделки без подтверждения;
3. отправлять агрессивные buy prompts;
4. обходить Decision Engine.

Критерий готовности:

1. live data помогает решать, но не заменяет учет;
2. alerts проходят priority/throttling;
3. Telegram не провоцирует overtrading;
4. каждый сигнал идет через gate.

## 12. Этап 10 - UI Integration

Цель: внедрить все это в продукт без ломки текущей геометрии.

Порядок UI:

1. Health Hexagon v2;
2. Health details;
3. Survival block;
4. Decision result block;
5. Pre-Trade Calculator;
6. Trade Journal;
7. Behavior status;
8. Market Psychology context;
9. Alerts.

Правила UI:

1. не делать casino/trader aesthetic;
2. не делать PnL визуально главным;
3. не перегружать главный экран;
4. показывать главный риск одной строкой;
5. показывать запрет конкретно;
6. сохранять premium institutional dashboard style.

Критерий готовности:

1. пользователь за 10 секунд понимает главный риск;
2. пользователь видит, можно ли добавлять риск;
3. пользователь видит, что запрещено;
4. пользователь видит, почему лучше ничего не делать.

## 13. Рекомендуемый порядок задач

### Sprint 1 - Архитектурная фиксация

1. Утвердить manifesto как главный документ.
2. Утвердить этот roadmap как implementation plan.
3. Провести read-only audit текущих полей API/Sheets/Health.
4. Составить `HealthFactorV2` schema draft.

Результат:

```text
Есть точная схема данных и нет изменений runtime-кода.
```

### Sprint 2 - Health Hexagon v2 core

1. Переписать модель лучей.
2. Убрать futures target funding.
3. Добавить active trading cap model.
4. Добавить top risk driver.
5. Покрыть расчет тестами.

Результат:

```text
Health стал честной моделью риска, а не набором похожих баров.
```

### Sprint 3 - Survival Engine

1. Добавить scenario calculations.
2. Добавить shock outputs.
3. Подключить к Health.
4. Добавить `Scenario Survival` луч.

Результат:

```text
Портфель умеет отвечать: выживу ли при сильном падении рынка.
```

### Sprint 4 - Decision Engine v1

1. Добавить pure decision function.
2. Добавить reasons/warnings/blockers.
3. Подключить reserve, concentration, trading cap, survival.
4. Вернуть `ALLOW / CAUTION / BLOCK / WAIT`.

Результат:

```text
Система умеет объяснить, можно ли покупать и почему.
```

### Sprint 5 - Forbidden Tokens + Asset Quality Gate

1. Согласовать источник forbidden data.
2. Добавить Top-100/Monitoring fields.
3. Добавить hard block.
4. Подключить к Decision Engine.

Результат:

```text
Запрещенные токены блокируются автоматически.
```

### Sprint 6 - Pre-Trade Calculator

1. Добавить amount + buy price.
2. Добавить averaging calculation.
3. Добавить Health before/after.
4. Добавить max allowed buy.
5. Добавить post-buy survival.

Результат:

```text
Перед покупкой видно, что именно изменится в портфеле.
```

### Sprint 7 - Trade Journal

1. Добавить trade ticket.
2. Добавить decision snapshot.
3. Добавить emotion/setup fields.
4. Добавить R result.
5. Добавить statistics foundation.

Результат:

```text
Система начинает учиться на решениях.
```

### Sprint 8 - Behavior Engine

1. Добавить violation detection.
2. Добавить cooldown.
3. Добавить stop trading mode.
4. Добавить no leverage increase rule.
5. Подключить к Health.

Результат:

```text
Дисциплина становится частью продукта, а не текстом в манифесте.
```

### Sprint 9 - Market Psychology Engine

1. Связать market regime с behavior.
2. Связать reserve pressure с psychology risk.
3. Добавить FOMO/revenge/panic markers.
4. Подключить к Decision Engine.

Результат:

```text
Система снижает риск эмоциональных решений.
```

### Sprint 10 - Live Data & Alerts

1. Подключить live prices как контекст.
2. Добавить alert priority.
3. Добавить daily limits.
4. Добавить Telegram discipline alerts.

Результат:

```text
Активная торговля получает живой контур, но не обходит risk-first gate.
```

## 14. Первый практический шаг

Начинать нужно не с UI и не с журнала.

Первый рабочий шаг:

```text
Read-only audit текущего Health/Risk/API contract
        ↓
HealthFactorV2 schema
        ↓
чистые расчетные функции
        ↓
тесты
        ↓
только потом UI
```

Почему так:

1. Health Hexagon - центр продукта.
2. Если его модель неверная, все последующие блоки будут ошибочными.
3. Survival Engine и Decision Engine зависят от Health.
4. Pre-Trade Calculator должен считать влияние на Health, а не жить отдельно.
5. Behavior Engine должен менять Health, а не быть декоративным журналом.

## 15. Definition of Done для всей инициативы

Инициатива считается реализованной, когда:

1. Health Factor показывает вероятность выживания капитала, а не PnL.
2. Гексагон имеет 6 независимых лучей.
3. 10% active trading sleeve работает как hard cap.
4. Любая покупка проходит Survival Engine.
5. Любая покупка проходит Decision Engine.
6. Forbidden tokens блокируются автоматически.
7. Pre-Trade Calculator показывает Health before/after.
8. Калькулятор усреднения считает новую среднюю цену.
9. Trade Journal фиксирует качество решения.
10. Behavior Engine умеет включать cooldown/blockers.
11. Market Psychology Engine анализирует поведение, а не просто рынок.
12. Live alerts не обходят risk gate.
13. Google Sheets/API остаются source of truth.
14. UI сохраняет серьезный risk-first характер.

## 16. Что делать следующим коммитом

Следующий технический scope должен быть маленьким:

1. не менять Google Sheets;
2. не менять Apps Script;
3. не менять API contract;
4. не менять UI;
5. сделать read-only audit текущей Health/Risk реализации;
6. подготовить `HealthFactorV2` schema proposal;
7. указать точные поля, которые уже есть и которых не хватает.

Только после этого можно переходить к первому code patch.
