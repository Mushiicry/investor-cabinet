# КАБИНЕТ ИНВЕСТОРА - ПОЛНАЯ ДОРОЖНАЯ КАРТА ПРОЕКТА

Версия: Product Roadmap / Master Plan  
Статус: Active Development  
Текущий этап: Functional Premium MVP -> Stabilization + Risk Core Completion  
Дата фиксации: 2026-05-26

---

# 0. Главная Формула Проекта

Кабинет инвестора - это операционная система инвестора.

Это не биржевой терминал.  
Это не crypto casino.  
Это не dashboard ради красивых цифр.  
Это не система, которая провоцирует трейдинг.

Главная задача:

создать premium investment terminal для долгосрочного контроля капитала, риска, дисциплины и решений.

Ключевая формула:

Risk first. Discipline first. PnL second.

---

# 1. Зачем Проект Существует

Большинство инвесторов теряет деньги не потому, что у них нет информации.

Они теряют деньги потому что:

- нет системы;
- нет контроля риска;
- нет дисциплины;
- нет понимания полной структуры капитала;
- нет понимания exposure;
- нет понятной логики добора;
- нет правил по резерву;
- есть FOMO;
- есть panic selling;
- есть хаотичные сделки;
- есть эмоциональное усреднение;
- есть переоценка PnL и недооценка риска.

Обычные portfolio trackers показывают:

- цену;
- PnL;
- график;
- список активов.

Но они не отвечают на главные вопросы:

- насколько безопасен портфель;
- можно ли сейчас добирать;
- где перегруз;
- где риск;
- сколько капитала можно пустить в работу;
- сколько нужно оставить в резерве;
- что делать, если рынок падает;
- что делать, если рынок резко растет;
- какая текущая рыночная фаза;
- не принимает ли инвестор эмоциональное решение.

Кабинет инвестора должен отвечать именно на эти вопросы.

---

# 2. Продуктовая Идея

Кабинет инвестора должен создавать ощущение:

"Я понимаю, что происходит.  
Я контролирую риск.  
Я знаю, что делать дальше."

Даже во время:

- сильной волатильности;
- просадки;
- медвежьего рынка;
- страха;
- эйфории;
- резких новостей;
- давления рынка.

Интерфейс должен снижать:

- тревожность;
- импульсивность;
- желание срочно что-то сделать;
- FOMO;
- panic selling;
- overtrading;
- excessive leverage.

Интерфейс должен усиливать:

- контроль;
- дисциплину;
- системность;
- спокойствие;
- стратегическое мышление;
- способность пережить цикл.

---

# 3. Текущий Статус Проекта

Текущий статус:

Functional Premium MVP -> Stabilization + Risk Core Completion

Это означает:

- продукт уже работает;
- есть live-данные;
- есть премиальный visual direction;
- есть Google Sheets как источник данных;
- есть Apps Script API;
- есть React/Vite frontend;
- есть Vercel deployment;
- есть Overview;
- есть Portfolio;
- есть Risk;
- есть Allocation;
- есть Fear & Greed;
- есть Decisions/Scenarios;
- есть reserve tracking;
- есть futures tracking;
- есть split spot/futures deployable capital;
- есть portfolio table;
- есть текущая UI-геометрия, которую нужно беречь.

Но:

- архитектура еще хрупкая;
- App.tsx слишком большой;
- App.css слишком большой;
- часть расчетов дублируется;
- API contract еще нужно жестче зафиксировать;
- risk engine еще не завершен;
- historical analytics еще не построена;
- decision engine пока ранний;
- AI layer еще не время;
- backend migration еще не время;
- mobile еще не начинали.

Главный ближайший milestone:

MVP Core Stabilized.

---

# 4. Основные Слои Системы

Кабинет инвестора состоит из нескольких продуктовых слоев.

## 4.1 Capital Layer

Отвечает на вопрос:

Сколько капитала есть и где он находится?

Включает:

- spot;
- stables;
- futures;
- metals;
- cash;
- portfolio value;
- invested;
- current value;
- PnL.

Статус:
частично реализован.

## 4.2 Risk Layer

Отвечает на вопрос:

Насколько портфель безопасен?

Включает:

- health factor;
- reserve share;
- deployable cash;
- spot deployable capital;
- futures deployable capital;
- largest risk asset;
- category exposure;
- futures pressure;
- concentration risk;
- position size risk.

Статус:
ядро в разработке.

Это главный слой продукта.

## 4.3 Reserve Layer

Отвечает на вопрос:

Сколько ликвидности нужно сохранить?

Резерв - это не "деньги без дела".

Резерв - это:

- стратегическая гибкость;
- защита от паники;
- возможность добора;
- защита от forced decisions;
- основа эмоциональной стабильности.

Статус:
частично реализован.

## 4.4 Allocation Layer

Отвечает на вопрос:

Как капитал распределен?

Включает:

- доля стейблов;
- доля крипты;
- доля фьючерсов;
- доля металлов;
- доля акций;
- доля каждого актива;
- перегруз по категории;
- перегруз по активу.

Статус:
визуально реализован, аналитически требует усиления.

## 4.5 Futures Layer

Отвечает на вопрос:

Фьючерсы помогают или угрожают структуре?

Фьючерсы не должны быть центром системы.

Они используются:

- для hedge;
- для tactical positions;
- для контролируемой спекуляции;
- для volatility exposure.

Фьючерсы не должны разрушать portfolio stability.

Статус:
частично реализован.

## 4.6 Decision Layer

Отвечает на вопрос:

Что делать дальше и почему?

Включает:

- почему актив удерживается;
- почему актив добирается;
- почему актив не добирается;
- какие сценарии актуальны;
- где риск;
- где нужно ничего не делать.

Статус:
ранняя концепция.

## 4.7 Scenario Layer

Отвечает на вопрос:

Что будет с портфелем при разных сценариях рынка?

Включает:

- bullish scenario;
- bearish scenario;
- neutral scenario;
- black swan scenario;
- recession scenario;
- altseason scenario;
- BTC cycle scenario;
- ETH dominance scenario.

Статус:
частично описан, логика еще не полноценная.

## 4.8 Emotional UX Layer

Отвечает на вопрос:

Помогает ли интерфейс инвестору не ошибаться эмоционально?

Включает:

- Fear & Greed;
- market mood;
- buy ladder;
- risk warnings;
- calm visual language;
- absence of hype UI;
- no aggressive leverage triggers.

Статус:
сильное визуальное начало, логика требует развития.

---

# 5. Дорожная Карта По Этапам

## Stage 1 - Functional Premium MVP

Статус:
почти завершен.

Прогресс:
80-85%.

Цель:
создать рабочую premium MVP-версию кабинета, которая показывает портфель, риск, резерв, allocation и базовые решения.

Уже сделано:

- React + Vite frontend;
- TypeScript;
- Google Sheets source of truth;
- Apps Script API;
- Vercel deployment;
- local proxy;
- Overview page;
- Portfolio page;
- Risk page;
- Decisions/Scenarios page;
- premium sidebar;
- premium overview cards;
- portfolio health block;
- allocation chart;
- Fear & Greed widget;
- live Fear & Greed value;
- portfolio table;
- status badges;
- PnL display;
- reserve metrics;
- deployable capital;
- spot/futures split.

Что осталось закрыть:

- финально стабилизировать portfolio table;
- обновить production site;
- зафиксировать текущий прогресс commit/push;
- проверить официальный сайт после деплоя;
- убрать критичные визуальные шероховатости.

Критерий завершения:

официальный сайт работает так же стабильно, как локальная версия, и текущий MVP можно считать сохраненной базовой точкой.

---

## Stage 2 - Stabilization + Risk Core Completion

Статус:
текущий главный этап.

Прогресс:
75-80%.

Цель:
сделать MVP надежной системой, а не просто красивым интерфейсом.

Главные направления:

- стабилизация API;
- стабилизация Google Sheets contract;
- стабилизация frontend state;
- завершение core risk engine;
- устранение дублирующих расчетов;
- безопасная модульность;
- сохранение визуальной геометрии.

Текущая точка сохранения:

- последний сохраненный технический пакет: `987f04b feat: stabilize stage 2 data and risk core`;
- frontend больше не показывает mock portfolio fallback как live-данные при первой загрузке;
- Fear & Greed fallback больше не активирует buy-ladder до получения live/cache значения;
- `App.tsx` стал тонким shell/router вместо тяжелого монолита;
- Portfolio, Overview, Risk, Fear & Greed, Decisions/Scenarios, Auth и shared UI вынесены в feature modules;
- источник истины описан в `docs/DATA_SOURCE_OF_TRUTH.md`;
- подготовлен контракт `history` и read-only план экспорта из Google Sheets `История`;
- подготовлен контракт TON wallet import для публичного read-only чтения транзакций;
- 2026-06-01 завершен Stage 2 wallet accounting patch: TON, Arbitrum, Solana и Cosmos Hub подключены к read-only sync;
- SELL списывает cost basis по старой средней входа и не двигает avgEntry при частичной продаже;
- BUY через observable stablecoin delta увеличивает cost basis и пересчитывает avgEntry;
- live `/api/investor` проверен после синхронизации: portfolio, invested, reserve, PnL и `pnlPct` совпадают с расчетным слоем;
- decisions/scenarios подключены к API/state pipeline через normalizers;
- Risk Core получил reserve rules, deployable capital split, exposure warnings и отдельный warnings panel.

### 2.1 Data Contract

Прогресс:
75%.

Нужно:

- держать JSON schema стабильной;
- подключить live `history` export из Apps Script без изменения формул;
- довести manual approval flow из `Транзакции_IMPORT` в `Транзакции`;
- после переходного периода решить, какие поля Stage 2 становятся required;
- убрать зависимость от stale `overview.bestPosition/worstPosition`, когда API сможет отдавать authoritative open-risk values.

Закрыто:

- описаны поля API;
- определены optional/root fallback rules;
- стандартизированы percent/money units;
- описаны status/category values;
- описаны closed positions;
- описаны reserve assets и futures cash;
- описан deployable cash split;
- описан pending-review contract для TON wallet import;
- созданы wallet sync contracts для TON, Arbitrum, Solana и Cosmos Hub;
- добавлен validation layer.

### 2.2 API Layer

Прогресс:
80%.

Нужно:

- retry rules;
- stable refresh synchronization;
- отделить API errors от calculation errors;
- подготовить Apps Script к live `history`.

Закрыто:

- timeout logic;
- loading/error states;
- invalid data protection;
- typed API responses;
- validation layer;
- investor cache;
- same-day Fear & Greed cache;
- safe fallback handling.

### 2.3 State Management

Прогресс:
60%.

Нужно:

- сделать loading/error/ready states;
- продолжить отделять raw API data от normalized UI data;
- убрать оставшиеся fallback calculations по мере усиления API;
- не добавлять тяжелую state library до реальной необходимости.

Закрыто:

- созданы shared selectors;
- normalizers вынесены из hooks;
- централизован investor state merge;
- overview/risk section builders вынесены отдельно;
- caching strategy определена для investor data и Fear & Greed;
- decisions/scenarios подключены к API/state pipeline;
- history нормализуется при появлении API data.

### 2.4 Risk Core

Прогресс:
60%.

Нужно:

- leverage pressure;
- position sizing;
- drawdown foundation;
- correlated asset risk;
- planned deployment impact.

Закрыто:

- reserve safety;
- deployable cash rules;
- futures/spot capital split;
- exposure engine foundation;
- futures exposure share;
- concentration warning foundation;
- overexposure warnings;
- risk warnings panel.

### 2.5 Frontend Modularization

Прогресс:
55%.

Нужно выносить по safe patches:

- HealthPanel;
- AllocationSection;
- feature CSS, только после стабилизации компонентов.

Закрыто:

- PortfolioTable;
- StatusBadge;
- OverviewPage;
- RiskPage;
- FearGreedGauge;
- Auth page;
- Decisions/Scenarios page;
- MoodSummary;
- Sidebar;
- shared Panel;
- helper logic;
- status color logic;
- portfolio selectors.

Запрещено:

- переписать App.tsx целиком;
- переписать App.css целиком;
- менять API naming во время UI extraction;
- ломать текущую геометрию.

Критерий завершения Stage 2:

MVP Core Stabilized.

---

## Stage 3 - Professional Dashboard / Analytics

Статус:
следующий крупный слой.

Прогресс:
25-35%.

Цель:
превратить кабинет из текущего состояния портфеля в аналитическую систему.

Нужно:

- portfolio history;
- PnL history;
- equity curve;
- allocation history;
- portfolio snapshots;
- drawdown history;
- capital efficiency;
- risk-adjusted returns;
- performance attribution;
- category attribution;
- realized/unrealized PnL;
- portfolio replay.

Критерий завершения:

инвестор видит не только "что сейчас", но и "как портфель менялся, почему менялся, где были ошибки и где была эффективность".

---

## Stage 4 - Decision Engine

Статус:
ранняя концепция.

Прогресс:
15-20%.

Цель:
перевести данные в понятные решения.

Нужно:

- buy pressure signals;
- risk warnings;
- reserve recommendations;
- market overheating alerts;
- portfolio imbalance detection;
- futures discipline warnings;
- scenario-based recommendations;
- priority system;
- confidence logic;
- human-readable outputs.

Принцип:

Decision Engine не должен заставлять действовать.

Он должен помогать понимать:

- что важно;
- где риск;
- где лучше ничего не делать;
- где можно аккуратно действовать.

---

## Stage 5 - Automation + Smart Alerts

Статус:
частично готово.

Прогресс:
40-50%.

Уже есть:

- Telegram reports;
- scheduled messaging foundation;
- table integration.
- read-only wallet sync foundation для TON, Arbitrum, Solana и Cosmos Hub.

Нужно:

- manual approval flow для blockchain transaction imports;
- pending review flow перед записью в `Транзакции`;
- risk alerts;
- allocation alerts;
- reserve alerts;
- emotional discipline alerts;
- futures alerts;
- macro warnings;
- signal grouping;
- priority levels;
- throttling;
- smart timing;
- avoid alert fatigue.

Критерий завершения:

система сообщает только важное и не создает шум.

---

## Stage 6 - Backend Migration

Статус:
будущий этап.

Прогресс:
0-5%.

Текущее правило:

не начинать сейчас.

Почему позже:

Google Sheets пока достаточно как source of truth для MVP.

Миграция понадобится, когда появятся:

- multi-user;
- auth;
- большие исторические данные;
- сложная аналитика;
- мобильное приложение;
- SaaS;
- secure accounts.

Потенциальный stack:

- Supabase;
- PostgreSQL;
- Node backend;
- secure API;
- authentication.

---

## Stage 7 - AI Assistant Layer

Статус:
концепт.

Прогресс:
0-5%.

AI роль:

аналитик, риск-коуч, помощник в дисциплине.

AI не должен быть:

- автотрейдером;
- генератором агрессивных сигналов;
- промоутером плеча;
- источником эмоционального давления.

AI функции в будущем:

- portfolio analysis;
- risk explanations;
- overexposure warnings;
- panic detection;
- euphoria detection;
- scenario generation;
- allocation recommendations;
- cycle positioning.

Prerequisite:

стабильный data layer и risk engine.

---

## Stage 8 - Multiuser / SaaS

Статус:
future.

Прогресс:
0-5%.

Возможные направления:

- user accounts;
- portfolio isolation;
- onboarding;
- subscriptions;
- advisor mode;
- family office mode;
- investor reports;
- premium analytics dashboard.

Не текущий приоритет.

---

## Stage 9 - Mobile App

Статус:
не начинали.

Прогресс:
0%.

Будущие платформы:

- iOS;
- Android.

Главная роль mobile:

эмоциональный мониторинг и быстрые risk alerts.

Возможные функции:

- push notifications;
- market mood;
- risk alerts;
- weekly discipline report;
- portfolio health snapshot.

Не текущий приоритет.

---

# 6. Текущая Таблица Прогресса

| Блок | Статус | Прогресс |
| --- | --- | --- |
| Product concept | Strong foundation | 85% |
| Frontend UI | Active polish | 65% |
| Dashboard MVP | Functional | 80-85% |
| Backend/Data | In progress | 70% |
| Google Sheets system | In progress | 75% |
| API contract | Needs stabilization | 55% |
| Risk engine | Core development | 45% |
| Portfolio analytics | In development | 50% |
| Decision engine | Early concept | 15-20% |
| Automation | Partial | 40-50% |
| Smart alerts | Early | 20-25% |
| Motion system | Early | 20% |
| Modular frontend | Needed | 25-35% |
| Backend migration | Future | 0-5% |
| AI assistant | Concept | 0-5% |
| SaaS readiness | Future | 0-5% |
| Mobile readiness | Not started | 0% |

---

# 7. Главные Ближайшие Приоритеты

## Priority 1 - Зафиксировать текущий прогресс

Нужно:

- проверить рабочее дерево;
- убедиться, что build проходит;
- убедиться, что lint проходит;
- сделать commit;
- сделать push;
- дождаться Vercel deploy;
- проверить официальный сайт.

## Priority 2 - Завершить Portfolio Table

Нужно:

- финально закрепить стили строк;
- закрепить status colors;
- увеличить читаемость значений;
- сохранить шрифт заголовков;
- проверить mobile/tablet;
- убедиться, что stable rows нейтральные;
- убедиться, что PnL colors корректны.

## Priority 3 - API Contract Stabilization

Нужно:

- документировать текущий API;
- зафиксировать поля;
- добавить нормализацию;
- описать risk fields;
- убрать неоднозначности;
- описать futures/stable logic.

## Priority 4 - Risk Engine Completion

Нужно:

- exposure engine;
- reserve engine;
- futures pressure;
- position sizing;
- concentration risk;
- drawdown foundation.

## Priority 5 - Safe Modularization

Нужно:

- выносить по одному компоненту;
- не ломать геометрию;
- не менять API;
- не переписывать весь App.tsx;
- после каждого шага запускать проверки.

---

# 8. Критерии Готовности MVP Core Stabilized

MVP Core Stabilized считается готовым, когда:

- official production site обновлен;
- локальная и production версии совпадают;
- build проходит;
- lint проходит;
- текущий прогресс закоммичен;
- portfolio table стабильная;
- status colors корректны;
- stable rows нейтральные;
- overview values корректны;
- best/worst positions не берут закрытые позиции;
- Fear & Greed live;
- spot/futures deployable cash работает;
- API contract описан;
- risk core показывает реальные важные метрики;
- fallback state сохранен;
- UI не ломает premium geometry.

---

# 9. Главные Риски

## 9.1 Дубли расчетов

Риск:
очень высокий.

Проблема:

одни и те же метрики могут считаться в Sheets, Apps Script и frontend.

Решение:

для каждой метрики определить source of truth.

## 9.2 Монолитный App.tsx

Риск:
высокий.

Проблема:

любой маленький патч может задеть много логики.

Решение:

safe modular extraction.

## 9.3 Монолитный App.css

Риск:
высокий.

Проблема:

визуальная система мощная, но хрупкая.

Решение:

не делать глобальный rewrite. Выносить CSS только после стабилизации компонентов.

## 9.4 API ambiguity

Риск:
высокий.

Проблема:

некоторые API-поля могут быть устаревшими или неоднозначными.

Пример:

- stale bestPosition;
- ambiguous deployableCash;
- category mismatch;
- status mismatch.

Решение:

validation + normalization + documentation.

## 9.5 Emotional UX drift

Риск:
средне-высокий.

Проблема:

можно легко сделать интерфейс слишком ярким, азартным или перегруженным.

Решение:

сохранять serious capital management feeling.

---

# 10. Принципы Разработки

Всегда:

- маленькие патчи;
- безопасные изменения;
- сначала анализ;
- потом patch;
- потом build/lint;
- не ломать API naming;
- не ломать Google Sheets bindings;
- не удалять fallback state;
- не менять формулы без проверки;
- не переписывать App.tsx полностью;
- не переписывать App.css полностью;
- не ломать fixed visual geometry.

Каждое изменение должно учитывать:

- scalability;
- maintainability;
- emotional UX;
- risk logic;
- future migration.

---

# 11. Как Использовать Этот Документ

Этот документ нужен как визуальная карта проекта.

Перед каждым новым большим шагом нужно смотреть:

1. На каком stage мы сейчас?
2. Какой ближайший milestone?
3. Какой блок риска затрагивается?
4. Не ломает ли patch API?
5. Не ломает ли patch UI geometry?
6. Усиливает ли patch risk-first логику?
7. Приближает ли patch к MVP Core Stabilized?

Если patch не приближает к текущему milestone, его лучше отложить.

---

# 12. Финальная Карта Развития

Краткая последовательность:

1. Functional Premium MVP.
2. Stabilization + Risk Core Completion.
3. MVP Core Stabilized.
4. Professional Dashboard / Analytics.
5. Decision Engine.
6. Automation + Smart Alerts.
7. AI Assistant Layer.
8. Backend Migration.
9. Multiuser / SaaS.
10. Mobile App.

Главная ближайшая цель:

MVP Core Stabilized.

Главная долгосрочная цель:

Premium Investor Terminal + SaaS Ecosystem.

Главное правило:

Risk first. Discipline first. PnL second.
