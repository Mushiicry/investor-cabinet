# Investor Cabinet — актуальный audit пути к мобильному приложению

Дата среза: 2026-08-11  
Цель документа: сравнить исходные большие roadmap с текущим состоянием и зафиксировать следующий путь к рабочему мобильному приложению.  
Scope: audit / roadmap only. Без точечных runtime-фиксов.

---

## 1. Главный вывод

Мы заметно продвинулись относительно исходных roadmap.

Старые документы описывали продукт как:

```text
Functional Premium MVP
-> Stabilization + Risk Core Completion
-> MVP Core Stabilized
-> Professional Dashboard / Analytics
-> Decision Engine
-> Automation + Smart Alerts
-> Backend / SaaS
-> Mobile App
```

Текущая реальная стадия:

```text
Web MVP is live and usable
-> personal investor operating system is working
-> mobile web readiness is the next critical milestone
-> PWA/native app should start only after contract + mobile QA freeze
```

То есть mobile больше не выглядит как дальний Stage 9/10. Он стал ближайшим продуктовым горизонтом, но правильная первая цель — не сразу iOS/Android, а надежный телефонный web-app:

```text
mobile-readable production web
-> installable PWA
-> native wrapper only after the web core is stable
```

---

## 2. Использованные источники

Основные roadmap / audit документы:

- `docs/INVESTOR_CABINET_ROADMAP.md`
- `docs/TECHNICAL_ROADMAP.md`
- `docs/MUSHI_INVEST_FIX_ROADMAP_RU_2026-08-03.md`
- `docs/PRODUCT_STAGE_AUDIT_2026-08-11.md`
- `docs/HANDOFF.md`
- `docs/KNOWN_ISSUES.md`
- `docs/vision/OADMAP.md`
- `docs/notion/**`

Текущая live-проверка:

- git baseline: `b9f8c93 Fix portfolio positions count`
- `git status --short --branch`: clean
- production main API: `success:true`
- production wife API: `success:true`
- main API keys: `overview`, `portfolio`, `risk`, `history`, `transactions`, `signals`, `decisions`, `scenarios`, `fearGreedStrategy`, `investorDNA`, `progress`, `assetQuality`
- wife API keys: `overview`, `portfolio`, `risk`, `history`, `transactions`, `signals`, `decisions`, `scenarios`, `fearGreedStrategy`

Текущие live цифры на момент среза:

| Account | Portfolio rows | Positions count | Portfolio value | Invested | Reserve |
| --- | ---: | ---: | ---: | ---: | ---: |
| main | 14 | 8 | `$646.20` | `$683.00` | `$474.12` |
| wife | 7 | 6 | `$7,392.38` | `$10,061.28` | `$526.28` |

---

## 3. Сравнение: старый roadmap vs сейчас

| Блок | Было в roadmap | Сейчас | Движение |
| --- | --- | --- | --- |
| Product concept | Strong foundation / 85% | Risk-first OS уже закреплена в UI, документах и логике | выросло до 90% |
| Web MVP | Functional / 80-85% | Production работает, main/wife live, V2 стал основным продуктовым shell | выросло до 90% |
| Data source | Sheets + Apps Script есть, но хрупко | Sheets остался source of truth, Vercel proxy и retry/stale слой усилены | выросло до 80-85% |
| Main/wife | раньше отдельная ломкая wife-сущность | endpoints разделены, но структура унифицирована через канонический Apps Script/API подход | выросло до 85% |
| Portfolio accounting | много ручных и спорных мест | wallet imports, stables, futures cash, GOLD/ETH/BTC tracking приведены ближе к source-of-truth модели | выросло до 75-80% |
| Risk/Health | core development / 45% | 6 лучей Health, futures cap, reserve/deployable logic, pre-trade gate, recommendations | выросло до 75-80% |
| Decision layer | early concept / 15-20% | decisions/scenarios/gate/decision journal уже есть, но еще не mobile-first | выросло до 50-60% |
| Alerts | early / 20-25% | Signals + Telegram live, но еще не push/deep-link mobile слой | выросло до 50-60% |
| Reports/history | in development / 50% | Reports page и daily snapshots есть, но raw/import/noise еще требует структуры | выросло до 60% |
| Frontend modularity | needed / 25-35% | `src/v2/**` модульный, App.tsx legacy-shell | выросло до 75-80% |
| Mobile readiness | Not started / 0% | есть `v2-mobile.css`, mobile tab bar, drawer, safe-area CSS, но нет full QA/PWA | выросло до 60-65% mobile web |
| PWA/native | 0% | manifest/service worker/Capacitor отсутствуют | остается 0-10% |

---

## 4. Что реально уже есть для мобильного продукта

### 4.1 Экранная база

В `src/v2/components/` уже есть основные экраны, из которых можно собрать mobile app:

- Overview / top metrics
- Portfolio
- Health
- Risk
- Reports
- Signals
- Scenarios
- Gate / Проверка
- Settings
- DNA
- Education shell
- Capital / Level ladder

Это значит: не нужно начинать мобильное приложение с нуля. Нужно стабилизировать и переупаковать текущий V2 web core.

### 4.2 Mobile foundation

Уже есть:

- `src/v2/styles/v2-mobile.css`
- mobile tab bar
- mobile sidebar drawer
- safe-area CSS через `env(safe-area-inset-*)`
- адаптации для сложных блоков вроде BTC chart

Но это пока responsive web, а не приложение.

### 4.3 Live data foundation

Уже есть:

- production `/api/investor`
- production `/api/investor-wife`
- Google Sheets как источник фактов
- Apps Script upstream
- Vercel API proxy
- cache/stale/error состояния
- contract validation layer
- account-specific separation

Для мобильного клиента это почти достаточная база, но ее нужно формально заморозить.

---

## 5. Что еще не готово для настоящего мобильного приложения

### P0. API contract freeze

Mobile app нельзя строить на плавающем JSON.

Нужно зафиксировать:

- required поля для `overview`;
- required поля для `portfolio`;
- required поля для `risk`;
- required поля для `signals`;
- required поля для `history`;
- required поля для `transactions`;
- optional поля для `investorDNA`, `assetQuality`, `progress`;
- одинаковые правила main/wife;
- поведение при пустых массивах и отсутствующих optional-блоках.

Критерий готовности:

```text
mobile client can render main/wife payload without knowing Google Sheets internals
```

### P0. Mobile stale/cache UX

На телефоне статус данных должен быть очевиден.

Нужно, чтобы пользователь сразу видел:

- live;
- refreshing;
- stale;
- cache;
- error;
- время последней успешной загрузки;
- какой аккаунт открыт;
- можно ли доверять цифрам прямо сейчас.

Это критичнее, чем новая красивая анимация.

### P0. Mobile critical-flow QA

Нужно проверить не “влезает ли сайт”, а выполняет ли телефонный сценарий:

1. Открыл приложение.
2. Понял состояние портфеля.
3. Увидел главный риск.
4. Понял, можно ли добавлять риск.
5. Увидел фьючерсный лимит, маржу и перебор/недобор.
6. Получил сигнал и понял, что делать.
7. Проверил сделку через gate.
8. Не потерялся в таблицах.

### P1. PWA layer отсутствует

Сейчас нет:

- `manifest.webmanifest`;
- service worker;
- install prompt;
- app icons;
- standalone display mode;
- offline/degraded screen;
- last-known-good mobile shell;
- app update UX.

До native shell лучше сделать PWA.

### P1. Push/deep-link слой отсутствует

Telegram alerts есть, но mobile app требует другой слой:

- push notifications;
- deep link в конкретный экран;
- notification settings;
- дедупликация;
- quiet hours / discipline pause;
- degraded behavior when API is stale.

---

## 6. Новая оценка готовности

| Блок | Оценка 2026-07 roadmap | Оценка сейчас | Комментарий |
| --- | ---: | ---: | --- |
| Product concept | 85% | 90% | Формула risk-first закреплена |
| Web MVP | 80-85% | 90% | Production работает и используется ежедневно |
| Data/API layer | 55-70% | 80-85% | Main/wife live, но нужен contract freeze |
| Accounting source of truth | 75% | 75-80% | Sheets остается правдой, но нужно меньше ручной чистки |
| Risk/Health | 45% | 75-80% | Health стал рабочим decision layer |
| Reports/history | 50% | 60% | Есть экран, но нужен mobile-friendly смысл |
| Alerts | 20-25% | 50-60% | Telegram live, push еще нет |
| Mobile web | 0% | 60-65% | Responsive база есть, нужен QA sprint |
| PWA | 0% | 5-10% | Есть только prerequisites |
| Native app | 0% | 0-5% | Пока не начинать |

Итоговая стадия:

```text
Web MVP: late MVP / stabilization
Mobile: readiness sprint, not native implementation yet
```

---

## 7. Новая дорожная карта к рабочему мобильному приложению

### Sprint 0 — Production baseline freeze

Цель: не начинать mobile поверх хвостов.

Статус: почти закрыто.

Что уже есть:

- `main` clean;
- production deployed;
- main/wife API live;
- счетчик позиций исправлен;
- GOLD/GOLD LONG дубль устранен;
- portfolio rows приведены ближе к текущей реальности.

Что еще проверить:

- один fresh mobile screenshot после hard reload;
- main/wife переключение на production;
- статус live/stale/cache на телефоне.

Done:

- `git status` clean;
- build/lint/test pass;
- production site открывает свежую сборку;
- main/wife API отвечают `success:true`.

### Sprint 1 — Mobile API Contract Freeze

Цель: мобильный клиент получает стабильный контракт.

Действия:

1. Снять live JSON main/wife как fixtures.
2. Обновить `docs/sheets/API_CONTRACT.md` или создать `docs/MOBILE_API_CONTRACT.md`.
3. Разделить поля на required / optional / deprecated.
4. Добавить contract tests на main/wife payload.
5. Зафиксировать fallback rules для пустых массивов.
6. Зафиксировать status/category enums.

Done:

- mobile shell может отрисоваться при пустых `signals`, `history`, `transactions`, `investorDNA`;
- main/wife не смешиваются;
- stale/cache состояние типизировано.

### Sprint 2 — Mobile Critical Flow Audit

Цель: доказать, что текущий web usable с телефона.

Проверить viewport:

- 360 x 740;
- 390 x 844;
- 430 x 932;
- 768 x 1024.

Проверить экраны:

- Overview;
- Portfolio;
- Health detail modal;
- Risk;
- Signals;
- Gate;
- Reports;
- Settings/account switch.

Done:

- нет горизонтального overflow;
- таблицы имеют mobile-представление;
- модалки открываются перед пользователем;
- нижняя навигация не перекрывает действия;
- health hexagon читается;
- кнопки finger-friendly;
- длинный русский текст не ломает карточки.

### Sprint 3 — Mobile Home / Risk Command Card

Цель: телефонный первый экран не должен быть уменьшенным desktop.

Первый экран должен отвечать:

1. Данные live или stale?
2. Главный риск сейчас какой?
3. Можно ли добавлять риск?
4. Сколько свободной фьючерсной маржи?
5. Лимит фьючерсов, в позициях, свободно, добавить/убрать.
6. Одно главное действие сейчас.

Done:

- пользователь за 10 секунд понимает состояние портфеля;
- нет необходимости листать весь desktop dashboard;
- risk gate важнее PnL и сигналов.

### Sprint 4 — PWA Shell

Цель: получить поведение приложения без App Store.

Действия:

1. Добавить manifest.
2. Добавить icons.
3. Настроить standalone display.
4. Добавить service worker только для app shell, не для подмены live-финансовых данных.
5. Добавить offline/degraded screen.
6. Зафиксировать last-known-good с явной пометкой stale.

Done:

- можно поставить на Home Screen;
- открывается как приложение;
- без сети показывает последнее состояние и предупреждает, что данные не live.

### Sprint 5 — Push Alerts / Deep Links

Цель: превратить Telegram-alert логику в мобильный action loop.

Действия:

1. Описать notification model.
2. Настроить дедупликацию.
3. Deep link из alert в Signals/Gate.
4. Quiet hours / discipline pause.
5. Не отправлять сигнал как разрешение на сделку.

Done:

- alert ведет в проверку риска;
- пользователь видит допустимый размер действия;
- risk gate может заблокировать сигнал.

### Sprint 6 — Native wrapper decision

Только после Sprint 1-5.

Решение:

- если PWA достаточно — не делать native;
- если нужны push/deep links/biometric/release pipeline — рассмотреть Capacitor;
- React Native / Expo не начинать без отдельного решения, потому что это будет второй frontend.

---

## 8. Что не делать сейчас

Не делать сейчас:

- сразу Capacitor/iOS/Android;
- перенос на Supabase/Postgres;
- AI assistant;
- SaaS/multiuser;
- redesign V2;
- новая палитра/геометрия;
- переписывание `V2Shell` или больших CSS-файлов целиком;
- превращать mobile в отдельный продукт с другой логикой;
- хардкодить портфельные данные во frontend;
- менять API naming / JSON structure без contract patch.

---

## 9. Следующий конкретный шаг

Следующая правильная задача:

```text
Mobile Readiness Sprint 1:
freeze mobile API contract for main/wife
```

Минимальный deliverable:

1. `docs/MOBILE_API_CONTRACT_2026-08-11.md`
2. live fixtures main/wife
3. required/optional/deprecated field table
4. tests that mobile payload cannot crash on empty optional blocks
5. explicit stale/cache state contract

После этого:

```text
Mobile Readiness Sprint 2:
visual QA of 8 mobile critical screens
```

Только после этих двух спринтов стоит добавлять PWA shell.

---

## 10. Рабочая формула на следующий горизонт

```text
Do not build a native app yet.
Build a reliable phone-first investor cockpit first.
```

Порядок:

```text
contract freeze
-> mobile critical-flow QA
-> mobile-first home
-> PWA installable shell
-> push/deep links
-> native wrapper if still needed
```

Главный критерий:

```text
С телефона пользователь должен быстро понять:
живые ли данные,
что с риском,
можно ли добавлять капитал/риск,
и какое одно действие сейчас безопасно.
```
