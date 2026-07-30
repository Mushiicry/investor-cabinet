# MUSHI INVEST SYSTEM SNAPSHOT 2026-07-30

Status: canonical system snapshot and patch plan  
Scope: Investor Cabinet / Кабинет инвестора / Mushi Invest platform  
Mode: consolidation after read-only audits  
Runtime code, Google Sheets data, Apps Script, triggers, API contract, Vercel config: not changed by this document

---

# 1. Главный вывод

Mushi Invest уже перешел из стадии визуального dashboard в стадию личной risk-first operating system инвестора.

Система работает:

- сайт открывается и подтягивает live-данные;
- Google Sheets `Кабинет инвестора` является фактическим source of truth;
- Apps Script отдает portfolio/risk/history/transactions/signals;
- Vercel proxy защищает `/api/investor` и `/api/investor-wife`;
- main и wife логически разделены;
- Portfolio Health, strategy/profile, pre-trade gate, decision engine, signals, reports, education shell и DNA UI уже существуют.

Но система еще не готова называться стабильной production-grade платформой.

Ключевая причина:

данные, код, Apps Script deployment, API contract, Google Sheets и UI уже близко связаны, но не полностью синхронизированы.

Главный принцип дальнейших патчей:

Risk first. Discipline first. PnL second.

---

# 2. Источники этого среза

Этот документ объединяет и заменяет отдельные audit/plan документы:

- code/security/accounting audit 2026-07-30;
- visual site audit 2026-07-30;
- Google Sheets source-of-truth audit 2026-07-30;
- combined patch plan 2026-07-30;
- старые audit-срезы July 2026;
- незавершенную задачу `Добавить портрет инвестора`;
- DOCX-файлы с рабочего стола:
  - `/Users/oxmyshii/Desktop/01_Investor_Profile_50_Questions.docx`;
  - `/Users/oxmyshii/Desktop/02_Investor_Profile_50_Answers.docx`;
  - `/Users/oxmyshii/Desktop/03_Investor_Profile_Full_Audit.docx`.

---

# 3. Текущая архитектура

Основная цепочка:

```text
Google Sheets
-> Apps Script SITE API
-> Vercel API proxy
-> React / Vite / V2 frontend
-> Investor Cabinet UI
```

Google Sheets остается финансовым source of truth.

Frontend может:

- нормализовать;
- отображать;
- считать derived risk/health guidance;
- защищать UX от stale/cache ошибок.

Frontend не должен:

- становиться источником портфельных данных;
- хардкодить позиции;
- заменять Google Sheets accounting;
- менять API naming без отдельного contract patch.

---

# 4. Состояние проекта на 30 июля

Сейчас в системе есть:

- live Google Sheets source of truth;
- Apps Script API;
- Vercel auth proxy;
- main/wife account separation;
- account-specific strategy;
- account-specific investor profile;
- Investor DNA shell;
- portfolio health model;
- pre-trade gate;
- decision/scenario pages;
- BTC/fear-greed/signal views;
- reports/history/transactions surfaces;
- wallet sync layers;
- education shell;
- visual V2 cabinet.

Текущая стадия:

late MVP hardening.

Это уже рабочая основа платформы, но перед масштабированием нужно закрыть P0/P1 риски.

---

# 5. Что работает

## 5.1 Site / frontend

PASS:

- сайт открывается;
- live-данные видны;
- UI подтягивает portfolio/invested/reserve/positions;
- V2 навигация работает;
- вкладки видны и связаны;
- визуальная система цельная;
- risk-first направление продукта читается.

Observed live UI:

- portfolio today around `$590-$591`;
- invested around `$632.60`;
- reserve around `$365.11`;
- positions count `9`;
- visual portfolio health around `77`;
- risk page health around `90`;
- signals and recommendations отображаются.

## 5.2 Vercel proxy

PASS:

- `/api/investor` без bearer token возвращает `401 Unauthorized`;
- `api/_investorProxy.js` проверяет Supabase bearer token;
- main/wife owner email разделены;
- POST actions whitelisted;
- frontend не содержит service role key;
- dangerous DOM patterns не найдены.

## 5.3 Google Sheets

PASS:

Spreadsheet:

- title: `Кабинет инвестора`;
- id: `1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8`;
- locale: `ru_RU`;
- timezone: `Europe/Moscow`.

Key tabs present:

- `Обзор`;
- `Расчеты`;
- `Риск`;
- `Цены`;
- `Фьючерсы`;
- `Транзакции`;
- `Транзакции_IMPORT`;
- `История`;
- `Решения`;
- `Сценарии`;
- `Сигналы`;
- `Качество активов`;
- `FearGreedRules`;
- `FearGreedHistory`;
- `Прогресс`;
- `TON_WALLETS`;
- `TON_WALLET_BALANCES`;
- `EVM_WALLETS`;
- `EVM_WALLET_BALANCES`;
- `SOLANA_WALLETS`;
- `SOLANA_WALLET_BALANCES`;
- `COSMOS_WALLETS`;
- `COSMOS_WALLET_BALANCES`;
- `BNB_WALLET_BALANCES`;
- `ДНК_Профили`;
- `ДНК_Рекомендации`;
- `ДНК_Вопросы`;
- `ДНК_Ответы`;
- `ДНК_Результаты`.

Live values observed:

- `Обзор` portfolioValue: `591,37`;
- `Обзор` invested: `632,6`;
- `Обзор` pnl: `-41,2`;
- `Обзор` reserve: `365,11`;
- `Обзор` positionsCount: `9`;
- `Риск` reserveShare: `61,7%`;
- `Риск` largest risk asset: `TON`;
- `Риск` cryptoShare: `28,10%`;
- `Сигналы` last check: `2026-07-30 17:34:28 MSK`;
- `История` latest completed daily snapshot: `2026-07-29`.

## 5.4 Wallet sync

PASS:

- TON wallets active; last sync `2026-07-30 17:33:35`;
- EVM/Arbitrum wallet active; last sync `2026-07-30 17:34:18`;
- Solana wallet active; last sync `2026-07-30 17:34:30`;
- Cosmos wallet active; last sync `2026-07-30 17:35:02`;
- balance snapshot tabs contain current quantities and sources;
- wallet imports remain review/staging layer, not direct accounting truth.

## 5.5 Main/wife separation

PASS:

- main uses `/api/investor`;
- wife uses `/api/investor-wife`;
- proxy checks owner email separately;
- strategy/profile/DNA selected by slot;
- cache keys separate;
- wife strategy forbids futures;
- wife has protective long-term accumulator profile.

Conclusion:

твои лимиты, твоя стратегия, твой портрет и твои live-цифры не должны пересекаться с аккаунтом Полины. Общие только codebase, UI components и market data layers.

---

# 6. Главные проблемы

## P0. Direct Apps Script exposure

Direct Apps Script `/exec` URLs return private JSON without Supabase/Vercel auth.

Impact:

- portfolio value exposed;
- allocation exposed;
- transaction/wallet context exposed;
- wife portfolio can also be exposed if URL is known;
- direct write actions become part of attack surface.

Current `appsscript.json` webapp mode:

```json
"executeAs": "USER_DEPLOYING",
"access": "ANYONE_ANONYMOUS"
```

Required fix:

- Apps Script must require upstream secret/token from Vercel proxy;
- direct anonymous `/exec` should return `403`;
- old public deployment URLs should be rotated/contained where needed.

## P0. Apps Script deploy drift

`npx clasp status --json` reports all 17 local Apps Script files as `filesToPush`.

Meaning:

- local repo has newer script logic than live Google Apps Script project;
- live deployment does not match local code/tests/docs;
- DNA/save/progress/runtime audit features cannot be claimed fully live until `clasp push + redeploy`.

Current live main deployment observed:

- `AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA @62 - Asset quality proxy final`;
- direct response still says `SITE API - PATCH 1.1`.

## P1. API contract drift

Observed mismatches:

- docs say `SITE API PATCH 1.2`, live says `PATCH 1.1`;
- main live `/exec @62` did not include `investorDNA`;
- `signals` is object `{ interest, interestList }`, not array;
- `risk` omits target fields:
  - `futuresDeployableCash`;
  - `spotDeployableCash`;
  - `stocksShare`;
  - `metalsShare`;
  - `futuresShare`;
  - `cashShare`;
- docs describe `Портфель` as primary tab, but live spreadsheet has no visible `Портфель`; API portfolio currently comes from `Расчеты`.

## P1. Health source split

Three health values exist:

- `overview.health = 0`;
- `risk.health = 90`;
- frontend V2 portfolio health around `77`.

Required decision:

- either Sheets/API owns final Health;
- or frontend V2 owns final Health;
- but product must not silently show/export three conflicting health values.

Recommended current direction:

- frontend V2 owns final Health score;
- Sheets/API exports raw inputs and legacy `risk.health` as informational until contract catches up.

## P1. Runtime cache crash risk

Prior runtime audit found stale/cached state can crash V2 when `signals.interestList` is missing.

Required fix:

- normalize signals at state boundary:
  - missing `signals` -> `{ interest: null, interestList: [] }`;
  - missing `interestList` -> `[]`;
- add cached-state migration test.

## P1. URLFetch / Hyperliquid quota errors

Apps Script logs show repeated:

- `Script delayed (1.0 min) waiting for quota for URLFETCH`;
- `getLivePrices Hyperliquid error: Служба была вызвана слишком много раз за день: urlfetch.`

Meaning:

- price/signal/wallet automation can degrade under daily quota;
- UI may continue showing last values, but automation is not clean.

Required fix:

- consolidate Hyperliquid fetches;
- cache `allMids`;
- avoid duplicated price fetches across triggers;
- add backoff and runtime audit.

## P1. Risk gate priority conflict

Visual audit found:

- signals/scenarios can say buy/accumulate;
- risk layer can say asset is above limit or blocked.

Required product rule:

risk gate overrides:

- buy signal;
- DCA ladder;
- recommendations;
- scenario text;
- decision text;
- CTA.

## P2. Trigger inventory not fully verified

Some triggers are clearly running:

- wallet sync tabs update;
- signals update;
- history snapshots exist.

But exact live trigger inventory was blocked:

`npx clasp run auditSignalPriceAlertConfig` returned permission error.

Required fix:

- add read-only `auditInvestorCabinetRuntime()` Apps Script function;
- owner-run or fix `clasp run` permission;
- report trigger counts and last sync timestamps without secrets.

## P2. BNB sync freshness

`BNB_WALLET_BALANCES` visible rows show repeated snapshots from `2026-07-28`, while other wallet tabs updated on `2026-07-30`.

Required fix:

- targeted BNB sync audit;
- confirm BNB/SPCXB feed `Расчеты`;
- check whether BNB sheet appends duplicates instead of replacing current snapshot.

## P2. Dependency vulnerabilities

Prior audit found:

- `brace-expansion <=5.0.7`;
- `postcss <=8.5.17`.

Required fix:

- run `npm audit`;
- patch only safe dependency chain;
- re-run lint/test/build.

## P2. Wife accounting row drift

Prior live spot invariant found wife account row mismatches above tolerance.

Required fix:

- focused wife accounting cross-check against source transactions;
- do not fix from frontend.

---

# 7. Investor profile / DNA unfinished task

## 7.1 Desktop documents found

The required investor profile documents exist on Desktop:

- `01_Investor_Profile_50_Questions.docx`;
- `02_Investor_Profile_50_Answers.docx`;
- `03_Investor_Profile_Full_Audit.docx`.

These documents represent the unfinished task `Добавить портрет инвестора`.

## 7.2 Questions document

`01_Investor_Profile_50_Questions.docx` contains 50 profile questions across:

- financial base;
- goals and horizon;
- risk and drawdowns;
- behavioral risk;
- portfolio structure;
- risk capacity.

This is the source questionnaire for full investor DNA/IPS.

## 7.3 Answers document

`02_Investor_Profile_50_Answers.docx` contains normalized answers.

Key facts:

- current liquid investment portfolio was described around `$650`;
- net worth is not fully captured because land in Crimea exists;
- no separate emergency reserve;
- annual investable contribution: `120 000 ₽`;
- active income around `140 000 ₽/month`;
- mandatory expense answer `80 000 ₽/month`, but obligations need reconciliation;
- mortgage payment: `50 000 ₽/month`;
- other credit/bike/utility obligations require clarification;
- portfolio dependency for living expenses: `0%`;
- if active income is lost: `0 months` without selling investments;
- target emergency reserve: `3 months`;
- target capital: `$100 000`;
- target timeframe: `5 years`, but as ambitious benchmark, not hard requirement;
- horizon: lifetime / no planned withdrawal;
- willingness for drawdowns is high;
- hidden bias exists around not wanting to realize losses;
- trading should be separate and max `10%` capital;
- preferred structure: `70%` long-term / `30%` active management;
- desired markets: crypto, stocks, gold/commodities, real estate, DeFi;
- crypto allocation early stage: `50-75%`, decreasing as capital grows;
- liquid investment reserve: `10-30%` depending on market/macro;
- skills self-score:
  - crypto `8/10`;
  - stocks `4/10`;
  - macro `4/10`;
  - fundamental analysis `7/10`;
  - technical analysis `6/10`;
  - risk management `5/10`.

## 7.4 Full audit document

`03_Investor_Profile_Full_Audit.docx` concludes:

Working profile:

```text
AGGRESSIVE GROWTH / ACTIVE ALLOCATOR
```

Core thesis:

take enough risk for long-term capital growth, but never take risk that removes the ability to keep investing.

Risk profile:

- Risk Willingness: high, around `80-85/100`;
- Risk Capacity: currently limited, around `35-45/100`;
- psychological drawdown tolerance: around `-30% to -40%`;
- declared extreme tolerance: `-60%+`;
- panic-selling tendency: low;
- counter-cyclical buying tendency: high;
- leverage self-assessment: `1.5-2x`, but only with controlled risk;
- horizon: lifetime.

Critical mismatch:

high risk willingness + low current financial buffer.

Primary near-term improvement:

not higher yield, but stronger financial resilience and risk management.

Required separation:

1. Emergency Reserve:
   - life and obligations;
   - never used to buy market drawdowns.
2. Investment / Opportunity Reserve:
   - liquidity inside investment system;
   - used for rebalance and attractive assets.

Key restrictions for IPS:

- do not treat price decline as value by itself;
- average down only after thesis re-check;
- do not use emergency reserve as dry powder;
- do not allow leverage to create liquidation risk;
- do not combine maximum concentration, maximum crypto allocation and maximum leverage at the same time;
- separate trading capital from long-term capital;
- write IPS and keep decision journal before scaling capital.

## 7.5 Current Google Sheets DNA state

Live Google Sheets:

- `ДНК_Профили` exists;
- `main` profile exists:
  - `main-aggressive-growth-active-allocator`;
  - `Агрессивный рост / Активный распределитель капитала`;
- `wife` profile exists:
  - `wife-protective-long-term-accumulator`;
  - `Защитный долгосрочный накопитель`;
- `ДНК_Ответы` has headers only;
- `ДНК_Результаты` has headers only.

Conclusion:

profile seed exists, but the 50 historical answers from DOCX have not yet been imported into live Sheets answer/result audit history.

## 7.6 Required DNA patch steps

This task must happen after Apps Script deploy drift is fixed.

Patch steps:

1. `clasp push` local Apps Script source.
2. Redeploy web app.
3. Verify live `/exec` returns `investorDNA` for `accountId=main`.
4. Verify frontend receives DNA through `/api/investor`.
5. Convert DOCX answers into structured rows for:
   - `ДНК_Ответы`;
   - `ДНК_Результаты`.
6. Preserve original meaning of answers.
7. Do not mix main answers with wife account.
8. Add import source metadata:
   - `source=docx_import_2026-07-30`;
   - source file name;
   - audit type `full_50_questions`.
9. Verify UI DNA page shows:
   - investor type;
   - risk willingness;
   - risk capacity;
   - profile recommendations;
   - audit history.
10. Add tests for:
   - main/wife DNA isolation;
   - missing DNA fallback;
   - saved answers normalization;
   - API contract shape.

Do not:

- manually overwrite portfolio data;
- change main/wife strategy limits in this patch;
- write answers into wrong accountId;
- treat DOCX answers as fresh live submission without marking source.

---

# 8. Visual audit findings

## Strong areas

- visual identity is coherent;
- dark premium dashboard direction works;
- health radar is strong;
- risk-first narrative is visible;
- account/profile/DNA layer is meaningful;
- sidebar/navigation is clear;
- signals and decision layers are connected to actual portfolio context.

## Problems to fix later

1. First viewport is dense.
2. `Обзор` shows many simultaneous signals.
3. `ДНК` needs stronger explanation of `83/100` willingness vs `40/100` capacity.
4. `Сигналы` needs stronger hierarchy when risk blocks buying.
5. `Отчёты` must visually separate raw import noise from approved accounting.
6. Futures near-limit should be caution/yellow, not simply green OK.
7. Typo: `Контрольриска` -> `Контроль риска`.
8. Capital ladder horizontal scroll should be intentional/obvious.

Do not redesign visual geometry before P0/P1 data/security fixes.

---

# 9. Patch roadmap

## Phase 1. P0 security and deployment boundary

Goal:

protect private data and align live Apps Script with repo.

Patch:

1. Add Apps Script access guard.
2. Pass upstream secret/token only from Vercel proxy.
3. Direct `/exec` without token returns `403`.
4. Review local `apps-script/*`.
5. `clasp push`.
6. Create new deployment/version.
7. Update Vercel env only if URL changes.
8. Verify main and wife proxy routes.

Verification:

- direct main Apps Script blocked;
- direct wife Apps Script blocked;
- `/api/investor` authorized works;
- `/api/investor-wife` authorized works;
- unauthenticated proxy remains 401;
- `clasp status --json` clean.

## Phase 2. API contract and stale cache

Goal:

make data shape stable.

Patch:

1. Freeze current intended API contract.
2. Document `signals.interestList` object shape.
3. Normalize missing signals.
4. Add cached-state migration test.
5. Add main/wife contract tests.
6. Add live sanitized fixture.

Verification:

- no ErrorBoundary from stale cache;
- `npm run test`;
- `npm run build`;
- site renders with missing/empty signals.

## Phase 3. Health source

Goal:

one coherent Health contract.

Patch:

1. Decide canonical Health owner.
2. Recommended: frontend V2 owns final health for now.
3. Deprecate or relabel `overview.health`.
4. Treat `risk.health` as informational until API catches up.
5. Add tests around `computePortfolioHealth`.

Verification:

- no page silently shows `0`, `77`, `90` as the same metric;
- Overview/Health/Risk copy is clear.

## Phase 4. Automation and triggers

Goal:

make sync observable and reduce quota failures.

Patch:

1. Add read-only `auditInvestorCabinetRuntime()`.
2. Return expected tab presence.
3. Return trigger handlers/counts.
4. Return latest sync timestamps.
5. Return Script Properties configured flags without secrets.
6. Consolidate Hyperliquid fetch/cache.
7. Add quota backoff.
8. Audit BNB sync freshness.

Verification:

- trigger inventory visible;
- no duplicate triggers;
- Apps Script logs clean over test window;
- Signals still update;
- TON/EVM/Solana/Cosmos/BNB sync states clear.

## Phase 5. Investor DNA full import

Goal:

finish the old `Добавить портрет инвестора` task.

Patch:

1. Use the three Desktop DOCX files as source.
2. Convert 50 answers into structured Sheets rows.
3. Store source metadata.
4. Keep accountId `main`.
5. Preserve wife account separation.
6. Verify DNA UI.
7. Verify save/read round-trip.

Verification:

- `ДНК_Ответы` contains imported 50-answer audit;
- `ДНК_Результаты` contains full audit summary;
- frontend shows profile and audit history;
- no wife data contamination.

## Phase 6. Risk-first product logic

Goal:

no UI should imply buy permission when risk blocks.

Patch:

1. Risk gate overrides signals/scenarios/decisions.
2. Signals page makes block state dominant.
3. Recommendations reflect limits first.
4. DCA ladder becomes secondary if limits violated.

Verification:

- TON/ATOM/other above-limit cases show block first;
- triggered buy is secondary under risk block;
- no CTA suggests buying above limits.

## Phase 7. Visual and reports cleanup

Goal:

clean UX without changing geometry.

Patch:

1. Fix `Контрольриска`.
2. Collapse/group raw import rows in Reports.
3. Add caution state for near-limit futures.
4. Improve DNA willingness/capacity explanation.
5. Make capital ladder scroll intentional.

Verification:

- Playwright desktop screenshot;
- mobile width check if touched;
- no overlap;
- no visual redesign.

## Phase 8. Docs/runbook alignment

Goal:

one operational truth.

Patch:

1. Update `docs/sheets/API_CONTRACT.md`.
2. Update `docs/sheets/SHEETS_STRUCTURE.md`.
3. Update `docs/ARCHITECTURE_BASELINE.md`.
4. Add deploy/runbook checklist.
5. Keep this snapshot as canonical 30 July planning document.

Verification:

- no docs reference missing `Портфель` as mandatory live tab;
- source-of-truth boundary is clear.

---

# 10. Validation checklist for every patch

Required before merge/deploy:

- `git status --short --branch`;
- `npm run lint`;
- `npm run test`;
- `npm run build`;
- API contract check;
- direct Apps Script protection check;
- `/api/investor` authorized check;
- `/api/investor-wife` authorized check;
- Google Sheets vs site numeric check:
  - portfolioValue;
  - invested;
  - pnl;
  - pnlPct;
  - reserve;
  - positionsCount;
- Overview visual check;
- Portfolio visual check;
- Risk visual check;
- Signals visual check;
- Reports visual check if touched;
- Apps Script logs check after deployment;
- `clasp status --json` clean after script push.

---

# 11. Non-goals for the next patch

Do not do in the first fix patch:

- redesign UI;
- change Google Sheets structure;
- rename API fields;
- migrate backend/database;
- change main strategy;
- change wife strategy;
- delete transaction/import history;
- rewrite formulas;
- bulk update dependencies blindly;
- push to `main` without explicit approval.

---

# 12. Immediate next action

The next implementation patch should be P0-only:

1. protect direct Apps Script access;
2. resolve Apps Script deploy drift;
3. verify API contract after deployment.

Reason:

until the data boundary is protected and live Apps Script matches repo code, UI polish and DNA import can hide the real operational risk.

---

# 13. Files intentionally superseded

This document supersedes the separate audit/plan files from previous slices.

Historical audit files should not remain as active planning sources after this snapshot. Working source docs such as accounting rules, API contract, architecture baseline, patch log, handoff, known issues and roadmaps remain separate because they are operational references, not disposable audit clutter.
