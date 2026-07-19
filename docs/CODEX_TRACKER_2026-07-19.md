# CODEX TRACKER 2026-07-19

Status: актуально на 2026-07-19. Активная сессия Claude — «активная торговля»: pre-trade gate, per-asset лимиты крипто-блока, фазовый календарь, фиксы разводки капитала, BNB в Apps Script.
Product mode: personal investor operating system. Risk First / PnL Second.

Читать вместе с [CODEX_ONBOARDING.md](CODEX_ONBOARDING.md) и предыдущим [CODEX_TRACKER_2026-07-11.md](CODEX_TRACKER_2026-07-11.md) (ownership boundary в силе).

---

# Ownership Boundary (без изменений)

- **Codex владеет:** документация, API-контракт-доки, accounting/risk-доки, security-доки, read-only верификация, изолированные тесты/фикстуры ПОСЛЕ стабилизации `src/` Claude.
- **Claude владеет (активно сейчас):** `src/v2/**`, `src/config/marketPhases.ts`, `src/config/riskRules.ts`, `apps-script/bnbWalletImport.gs`, тесты `test/contracts/preTradeGate.test.ts`.
- **User владеет ops:** Apps Script авторизация/redeploy, чувствительные формулы Google Sheets, Vercel, прод-деплой.

Правило: один файл — один агент. Codex не редактирует Claude-активные файлы без хендоффа.

---

# Что изменил Claude в этой сессии (чтобы Codex не отставал)

## 1. Pre-trade gate — новый экран «Проверка добора»
- Новое: [src/v2/lib/preTradeGate.ts](../src/v2/lib/preTradeGate.ts) (чистое ядро `evaluateTrade`), [src/v2/components/V2GatePage.tsx](../src/v2/components/V2GatePage.tsx), [src/v2/styles/v2-gate.css](../src/v2/styles/v2-gate.css).
- Навигация: `V2Page` += `"gate"`, пункт «Проверка» в `V2Sidebar`, роут в `V2Shell`.
- Три зоны вердикта: 🟢 ok (≤ spotDeployable) · 🟡 caution (заход в подушку до пола фазы) · 🔴 block (пол фазы / лимит позиции / лимит класса).

## 2. Per-asset лимиты крипто-блока (ВНУТРИ блока, не портфеля)
- `CRYPTO_ASSET_LIMITS` в preTradeGate: **ETH 35% · BTC 20% · SOL 10% · TON/GRAM 10% · BNB 10%**; прочие альты `CRYPTO_ALT_LIMIT = 5%`.
- Раньше весь код знал только плоский `MAX_SINGLE_RISK_ASSET_SHARE = 0.35` от портфеля.
- Источник истины: манифест `MushiiInvest/Инвестиционная стратегия ….md`, раздел «Структура крипто-блока» (+ решение владельца: BNB как SOL/TON).

## 3. Альткоин-места
- Мажоры (BTC/ETH/SOL/TON/BNB) = 85% крипто-блока → на альты остаётся 15% ÷ 5% = **3 места** (`MAX_ALTCOIN_SLOTS`).
- `altcoinSlots()` считает занятые/свободные; сигнал в `V2SignalsPage` («свободно N из 3» / «нет места»).

## 4. Фазовый календарь — [src/config/marketPhases.ts](../src/config/marketPhases.ts)
- `getMarketPhase(date)` по датам манифеста: пол резерва и лимит крипты зависят от фазы.
- Сейчас (постепенное накопление, до 9 окт 2026): резерв ≥ 30%, крипта ≤ 60%.
- Агрессивное (9 окт – 31 дек 2026): резерв до 10%, крипта до 80%. Распределение (сен–ноя 2029): резерв → 80%, крипта 40%.
- Шлюз потребляет фазу (пол резерва + крипто-лимит).

## 5. Разводка капитала — фиксы в [V2DeployableCapital.tsx](../src/v2/components/V2DeployableCapital.tsx)
- Баг: стратегия-корзина считалась на стоимости портфеля (17.10$) вместо канона от вложенного (18.11$). Убрана пересборка `buildFearGreedStrategy` — используется prop `strategy`.
- Порядок водопада исправлен: **Резерв 30% → Стратегия → Фьючи (≤10% капитала) → Спот-остаток** (было: фьючи первыми).

## 6. BNB в Apps Script (ждёт прогона владельцем)
- [apps-script/bnbWalletImport.gs](../apps-script/bnbWalletImport.gs): нативный BNB (`eth_getBalance`), цена из листа «Цены» (HL-синк, `primaryMids['BNB']` — добавлено в `hyperliquidImport.gs`), приход BNB → «Покупка BNB» (усреднение входа + строка в отчёты + автозапуск кулдауна стратегии). Новая `setupBnbPortfolioRow()` (без `insertRow`).
- НЕ протестировано (крутится в Google). Нужен `clasp push` + Run владельцем.

Проверка Claude-стороны: `tsc -b` чисто · `eslint` чисто · **38 тестов** зелёные.

---

# Task Board для Codex (в его зоне: доки + тесты + верификация)

## C-1. Документация новых risk-правил (доки — зона Codex)
Обновить/создать в `docs/`:
- per-asset лимиты крипто-блока (таблица ETH/BTC/SOL/TON/BNB/альты, база = крипто-блок);
- альткоин-места (3 слота, формула 15%÷5%);
- фазовый календарь (таблица фаза → даты → пол резерва → цель → крипто-лимит);
- порядок водопада капитала (Резерв→Стратегия→Фьючи≤10%→Спот).
Свести в один раздел (напр. дополнить `docs/ACCOUNTING_RULES.md` или новый `docs/RISK_RULES.md`). НЕ трогать `src/` — только документировать.

## C-2. Изолированные consistency-тесты (после стабилизации src)
- тест: даты фаз в `marketPhases.ts` монотонны и НЕ пересекаются, покрывают ожидаемые окна;
- тест: `CRYPTO_ASSET_LIMITS` сумма мажоров (BTC+ETH+SOL+TON+BNB) = 85%, альт-лимит 5%, `MAX_ALTCOIN_SLOTS` = floor(15/5);
- тест: константы `riskRules.ts` совпадают с таблицей манифеста.
Тесты класть в `test/contracts/`, не изменяя `src/`.

## C-3. Read-only верификация (репорт, не фикс)
- сверить, что per-asset лимиты и фазовые параметры в коде соответствуют манифесту; расхождения — списком в отчёт, БЕЗ правок `src/`;
- проверить, что health-метрика «Концентрация» (`src/lib/portfolioHealth*`, `riskExposure.ts`) всё ещё использует плоские 35% портфеля и НЕ знает per-asset лимитов — это известный разрыв, который Claude закроет следующим (свод «Концентрации» на per-asset). Codex только фиксирует список мест, где плоский лимит зашит.

Порядок: C-1 (доки) можно сразу; C-2/C-3 — после того как Claude зафиксирует «Концентрацию» (сообщу хендоффом).
