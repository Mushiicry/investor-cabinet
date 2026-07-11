# Аудит Investor Cabinet от 2026-07-10

## 1. Что прочитано

Получены и просмотрены:
- исходники React/Vite/TypeScript: `src/main.tsx`, `src/v2/*`, `src/hooks/*`, `src/lib/*`, `src/services/*`, `src/types/*`;
- Apps Script и импорты кошельков: `WIFE_APPS_SCRIPT.js`, `apps-script/*.gs`;
- документация: `PROJECT_CONTEXT.md`, `docs/PROJECT_MAP.md`, `docs/DATA_SOURCE_OF_TRUTH.md`, `docs/KNOWN_ISSUES.md`, `docs/sheets/*`, `docs/vision/*`;
- CSV-экспорты Google Sheets: `docs/sheets_exports/*.csv`;
- локальный сайт через Vite dev server: `http://127.0.0.1:5173/`;
- API через dev-proxy: `/api/investor`, `/api/fear-greed`;
- проверки: `npm run build`, `npm run lint`, desktop/mobile browser inspection.

Не хватило:
- живого authenticated доступа к production-аккаунту Supabase;
- прямого доступа к текущей Google Sheets таблице, кроме локальных CSV-экспортов;
- production/Vercel runtime logs;
- актуального ответа `/api/investor`: локальный proxy за 20 секунд не получил body.

## 2. Карта проекта

Текущая система:

Google Sheets -> Apps Script SITE API -> `/api/investor` -> validation/cache/normalization -> React V2 UI.

Ключевые слои:
- `docs/sheets/*`: контракт, структура листов, формулы;
- `WIFE_APPS_SCRIPT.js`, `apps-script/*.gs`: API, wallet import, history snapshot, futures sync;
- `src/services/*`: validation, cache, investor state build, daily snapshots;
- `src/lib/*`: portfolio/risk/history/transaction normalizers, health, selectors, presentation helpers;
- `src/hooks/*`: investor data, auth, blockchain balances, live prices, F&G, staking;
- `src/v2/*`: фактический интерфейс продукта.

Входная точка сейчас `src/main.tsx` -> `InvestorCabinetV2Lab`. Старый `App.tsx`, упомянутый в документации, в актуальной карте проекта не является entrypoint.

## 3. Итоговая оценка

| Направление | Оценка | Вывод |
|---|---:|---|
| Product fit | 8/10 | Сильная risk-first идея, понятная долгосрочная ниша. |
| UX | 6/10 | Основные разделы логичны, но locked/onboarding и пустые состояния слабые. |
| UI | 7/10 | Premium dark/institutional ощущение есть, но mobile overflow и blur-gate ухудшают ясность. |
| Маркетинг | 4/10 | Продукт не продает себя до входа; почти нет trust/onboarding/value proof. |
| Копирайтинг | 6/10 | Tone правильный, но часть текстов слишком резкая или техническая для новичка. |
| Обучение | 5/10 | Есть подсказки и risk wording, но нет пошагового обучения. |
| Архитектура | 6/10 | Слои уже выделены, но source-of-truth местами дублируется. |
| Код | 5/10 | Build сейчас не проходит; lint имеет 17 errors. |
| Производительность | 6/10 | UI тяжелый, есть двойное scaling-решение, API timeout влияет на first paint. |
| Финансовая логика | 6/10 | Risk-first логика хорошая, но есть конфликты единиц и realized PnL approximation. |
| Масштабируемость | 4/10 | Google Sheets + Apps Script годится для личного use case, но не для SaaS на 10k+. |
| Безопасность | 6/10 | Supabase gate есть, private keys не используются, но тестовые креды в коде и публичный Apps Script endpoint требуют уборки/контроля. |
| Общая зрелость | 6/10 | Сильный продуктовый фундамент, но production readiness пока ниже SaaS-уровня. |

Общий рейтинг: 6/10.

## 4. Главные критические findings

### F1. Production build сейчас сломан

`npm run build` падает:

`src/v2/InvestorCabinetV2Lab.tsx(435,18): TS2367`

Причина: условие `!investorData.status === "ready"` сравнивает boolean со строкой. Должно быть `investorData.status !== "ready"`.

Последствия:
- Vercel deploy не пройдет;
- production-цепочка заблокирована;
- wife snapshot logic невалидна.

Критичность: critical.

### F2. Lint не проходит

`npm run lint`:
- 17 errors, 4 warnings;
- основные группы: `react-hooks/set-state-in-effect`, `no-explicit-any`, Fast Refresh export rules, `Date.now()` during render, useless escape.

Последствия:
- качество patch-процесса падает;
- CI/CD нельзя считать надежным;
- React Compiler/React 19 rules выявляют реальные риски render purity.

Критичность: high.

### F3. `/api/investor` нестабилен в локальной проверке

`curl http://127.0.0.1:5173/api/investor` за 20 секунд не получил ответ.
В браузере после timeout появился console error:

`INVESTOR DATA LOAD ERROR AbortError: signal is aborted without reason`

`/api/fear-greed` при этом отвечает быстро и корректно.

Последствия:
- пользователь видит нулевое/locked/fallback состояние;
- нет явного data-status в UI;
- риск silent stale/fallback perception.

Критичность: high.

### F4. Есть конфликт API units для процентов

В `docs/sheets/API_CONTRACT.md` указано, что `overview.pnlPct` приходит как прямой процент, например `82.6`.
В правилах проекта указано, что `pnlPct` в API должен быть decimal fraction, например `-0.0004` отображается как `-0.04%`.
В `docs/sheets/FORMULAS.md` `pnlPct = (pnl / invested) * 100`.
Во frontend нормализаторы пытаются автоматически угадывать ratio/direct percent.

Последствия:
- риск двойного деления или неверного отображения PnL;
- контракт нестрогий;
- миграция на backend станет опасной.

Критичность: high.

### F5. Frontend все еще содержит финансовые fallback/calculation слои

`src/lib/portfolioCalculations.ts` рассчитывает `invested`, `currentValue`, `pnl`, `pnlPct`, allocation, risk.
Это допустимо как fallback, но противоречит принципу: Google Sheets - source of truth.

Последствия:
- frontend может стать вторым источником правды;
- при расхождении Sheets/API/UI пользователь увидит разные цифры;
- особенно опасно для sell/cost basis/realized PnL.

Критичность: high.

### F6. Realized PnL в Reports считается приближенно

`V2ReportsPage` считает realized PnL как `(sell price - current avgEntry) * quantity`.
Комментарий прямо говорит, что исторические лоты не трекаются.

Последствия:
- при частичных продажах после новых покупок realized PnL может быть неверным;
- это бухгалтерский риск;
- для продукта уровня investor OS realized PnL должен приходить из accounting layer, а UI должен только отображать.

Критичность: high.

### F7. Тестовые логин/пароль находятся в source

Найдены:
- `src/config/constants.ts`: `TEST_LOGIN`, `TEST_PASSWORD`;
- `src/data/portfolio.ts`: `TEST_LOGIN`, `TEST_PASSWORD`.

Они не используются в текущем auth-flow, но для production это лишний security smell.

Критичность: medium.

### F8. Locked/onboarding state ухудшает UX и маркетинг

При настроенной авторизации пользователь видит:
- затемненный dashboard;
- auth modal;
- нулевые значения;
- мало объяснения ценности до входа.

Это приватно и безопасно, но плохо для SaaS-продукта: новичок не понимает, что получит после входа.

Критичность: medium.

### F9. Mobile имеет горизонтальный overflow

На viewport `390x844` обнаружен `scrollWidth=400`, главный offender: `.v2-hero-reactor` шириной около `397px` при `x=3.25`.

Последствия:
- мелкий горизонтальный сдвиг;
- ощущение "неполированной" mobile-версии.

Критичность: medium.

### F10. Двойная desktop scaling-система

`src/main.tsx` масштабирует `documentElement.style.zoom` от design width 1440.
`V2Shell` отдельно считает CSS scale от 1920x1080.

Последствия:
- риск непредсказуемой геометрии на 13-14" экранах;
- сложнее тестировать responsive;
- возможны blur/overlap/incorrect hit targets.

Критичность: medium.

## 5. UX-аудит

Сильные стороны:
- навигация понятная: Обзор, Портфель, Здоровье, Сценарии, Риск, Отчеты, Сигналы, Настройки;
- risk-first порядок выдержан: здоровье/резерв/лимиты важнее PnL;
- locked-state защищает персональные данные;
- пустые состояния есть почти везде.

Проблемы:
- раздел `Сценарии` в locked/zero state почти пустой;
- `Сигналы` показывает тревоги на нулевом портфеле, что может выглядеть как ложная авария;
- закрытый dashboard не объясняет продуктовую ценность;
- нет явного статуса данных: live/cache/stale/error;
- auth modal не объясняет, что данные берутся из Google Sheets/wallet imports read-only;
- Settings содержит переключатели языка/темы/валюты, но часть "в разработке", что снижает доверие.

Решения:
- добавить `Data status` badge: Live / Cache / Stale / API timeout;
- разделить empty portfolio и risky portfolio: нулевой аккаунт не должен получать "тревоги" как реальный портфель;
- добавить короткий onboarding после регистрации: подключить Sheets/wallets, проверить резерв, открыть Risk;
- для locked state показывать не размытую копию кабинета, а privacy-safe product preview с 3-4 trust тезисами.

## 6. UI-аудит

Сильные стороны:
- темная premium-эстетика соответствует private/institutional dashboard;
- визуальная доминанта Health/Risk правильная;
- навигация не похожа на trading casino;
- компоненты имеют устойчивый visual language.

Проблемы:
- mobile overflow на overview;
- blur locked-state делает экран мутным и неинформативным;
- много свечения/космоса может увести в "sci-fi dashboard", а не finance OS;
- некоторые CTA/ссылки вроде `Доступно` на Uniswap выглядят ближе к trading action, чем к discipline workflow;
- часть текстов в карточках и таблицах слишком мелкая/плотная для повторного использования.

Решения:
- чинить overflow точечно, не переписывая CSS;
- снизить opacity/blur в locked-state или заменить на отдельный privacy preview;
- внешние trade links оборачивать в risk confirmation/plan context;
- для mobile оставить только ключевые блоки: Health, Reserve, Alerts, Portfolio.

## 7. Маркетинг и тексты

Текущее позиционирование сильное: "Risk First / PnL Second".
Но сайт почти не продает продукт до входа.

Что добавить:
- короткий value statement: "Показывает, сколько риска уже взято и что делать дальше без эмоциональных решений";
- trust proof: Google Sheets as source of truth, read-only wallet imports, no trading permissions;
- use cases: просадка рынка, рост жадности, ребаланс, контроль плеча;
- before/after: "до - хаотичные сделки, после - reserve/risk/playbook".

Текстовые правки:
- "Срочно пополнить" заменить на "Пополнить резерв до минимального уровня" - меньше паники;
- "Нет стейблов на споте" для нулевого аккаунта заменить на "Резерв еще не подключен";
- "Подключите реальные кошельки" уточнить: "Подключите read-only источники данных";
- "Доступно" на external DEX заменить на "Открыть площадку" или "Перейти после проверки плана".

## 8. Обучение пользователя

Новичок поймет общий смысл "риск важнее PnL", но потеряется в:
- reserve share;
- health factor;
- futures margin vs exposure;
- realized vs unrealized PnL;
- F&G buy ladder;
- deployable capital split.

Нужны:
- glossary;
- мини-объяснения на первом входе;
- "почему система говорит это" для каждого сигнала;
- примеры: "если портфель $1000, резерв 30% = $300";
- отдельный режим beginner/expert без изменения расчетов.

## 9. Архитектура

Сильные стороны:
- уже есть разделение API validation, cache, normalizers, selectors, UI;
- source-of-truth задокументирован;
- wallet imports идут через review/import слои;
- Supabase auth не хранит service_role в клиенте.

Проблемы:
- документация местами устарела: упоминает `App.tsx`, хотя фактический entrypoint V2;
- frontend still derives too much;
- API unit contract конфликтует с правилами проекта;
- Apps Script endpoint прямо захардкожен в `vite.config.ts`;
- нет typed contract tests на payload.

Целевая архитектура:
- Sheets/API owns financial truth;
- frontend owns validation, display, fallback only;
- realized PnL, cost basis, sell accounting - только accounting layer;
- contract tests на fixture API responses;
- backend migration boundary: `/api/investor` как stable adapter.

## 10. Финансовый аудит

Подтверждено:
- BUY/SELL accounting явно описан в правилах проекта;
- wallet import scripts для TON/Arbitrum/Solana содержат costBasisSold/realizedPnl logic;
- futures docs правильно различают `positionValue = margin * leverage` и `currentValue = margin + pnl`;
- risk-first target: reserve 30%, crypto 60%, futures 10%, single asset 35%.

Риски:
- frontend fallback `calculateInvested = quantity * avgEntry` подходит только для простых open positions, но не для полноценной истории;
- Reports realized PnL использует текущий avgEntry, а не исторический cost basis проданного лота;
- API/Docs конфликтуют по direct percent vs ratio;
- CSV export values локализованы запятыми/процентами, API должен отдавать number;
- `/api/investor` timeout делает актуальные расчеты недоступными.

## 11. Масштабирование

100 пользователей:
- возможно, если это mostly read-only и Apps Script не throttled;
- риск timeout уже виден.

1 000 пользователей:
- Apps Script/Sheets станет узким местом;
- нужен cache layer, backend adapter, rate limiting.

10 000 пользователей:
- Google Sheets нельзя использовать как operational DB;
- нужен Postgres/Supabase/custom backend, background jobs, queue for imports.

100 000 пользователей:
- нужна полноценная SaaS architecture: auth, tenancy, row-level security, observability, audit logs, billing, async market data, durable job queue.

## 12. Security-аудит

Плюсы:
- Supabase anon key pattern нормален;
- service_role key в клиенте не обнаружен;
- wallet imports read-only по публичным адресам;
- private keys/seed phrases в документации запрещены.

Риски:
- тестовые креды в коде;
- Apps Script endpoints публичны;
- нет явного rate limit/proxy control на client calls;
- localStorage хранит profile avatar/name и cached investor state;
- auth gate показывает dashboard под blur: для приватности лучше не рендерить чувствительный контент вообще, если user не авторизован.

## 13. QA test cases

Критический набор:
- build должен проходить без TypeScript errors;
- lint должен проходить или иметь зафиксированный baseline;
- `/api/investor` returns within 5-8 seconds or UI shows stale/error;
- invalid API root -> previous stable state;
- invalid portfolio array -> previous portfolio;
- direct percent/ratio cases for `pnlPct`, `reserveShare`, `share`;
- empty new user -> no false "critical portfolio" language;
- founder login -> live portfolio visible;
- non-founder login -> zero/private portfolio visible;
- wife login -> wife API + blockchain override + wife snapshots;
- partial sell -> avgEntry unchanged, realized PnL from accounting layer;
- transfer/import -> no cost basis mutation without approval;
- mobile 390x844 no horizontal overflow;
- desktop 1280/1440/1920 no overlap;
- auth modal validation and error handling;
- external DEX links not presented as automatic trade execution.

## 14. Roadmap

### Критично

1. Исправить TS build error в wife snapshot condition.
   Эффект: Vercel deploy снова возможен.
   Сложность: низкая.

2. Зафиксировать единицы API процентов в одном contract patch.
   Эффект: убирает риск неверного PnL.
   Сложность: средняя, потому что затрагивает Sheets/API/frontend docs.

3. Разобрать `/api/investor` timeout.
   Эффект: live data снова становится надежным.
   Сложность: средняя/высокая, нужен Apps Script/logs.

4. Убрать realized PnL approximation из UI или явно пометить как estimate.
   Эффект: снижает бухгалтерский риск.
   Сложность: средняя.

### Высокий приоритет

5. Привести lint к проходящему baseline.
   Эффект: безопаснее патчи и CI.
   Сложность: средняя.

6. Удалить тестовые креды из source.
   Эффект: security hygiene.
   Сложность: низкая.

7. Добавить data status в UI.
   Эффект: пользователь понимает live/cache/stale/error.
   Сложность: средняя.

8. Развести empty account и real risky portfolio в Signals/Health.
   Эффект: меньше ложной тревоги.
   Сложность: средняя.

### Средний приоритет

9. Починить mobile overflow точечно.
   Эффект: polished mobile.
   Сложность: низкая.

10. Упростить locked/onboarding state.
    Эффект: лучше конверсия и доверие.
    Сложность: средняя.

11. Обновить docs project map под V2 architecture.
    Эффект: меньше ошибок в будущих patch-ах.
    Сложность: низкая.

12. Добавить contract fixtures/tests для API payload.
    Эффект: ловит unit drift.
    Сложность: средняя.

### Низкий приоритет

13. Beginner/expert explanations.
    Эффект: лучше обучение новичков.
    Сложность: средняя.

14. Gradual backend migration plan.
    Эффект: SaaS scalability.
    Сложность: высокая.

15. Визуальная чистка glow/space эстетики.
    Эффект: больше institutional feeling.
    Сложность: средняя, делать только после стабилизации данных.

## 15. Проверки

Выполнено:
- `npm run build` - fail, TypeScript error в `InvestorCabinetV2Lab.tsx`;
- `npm run lint` - fail, 17 errors / 4 warnings;
- `npm run dev -- --host 127.0.0.1 --port 5173` - ok;
- browser desktop pass - ok, приложение открывается;
- browser mobile 390x844 - найден horizontal overflow;
- `/api/fear-greed` - ok, HTTP 200;
- `/api/investor` - timeout after 20 seconds;
- browser console after API timeout - `INVESTOR DATA LOAD ERROR AbortError`.

Исходники приложения не менялись. Создан только этот audit report.
