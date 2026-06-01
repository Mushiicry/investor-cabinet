# DATA SOURCE OF TRUTH

Status: Stage 2 stabilization baseline  
Scope: Google Sheets + Apps Script + React frontend  

This document defines where portfolio information originates, where it is calculated, and what the frontend is allowed to derive temporarily.

The goal is to reduce duplicated calculations and keep Investor Cabinet migration-safe for a future backend/database layer.

---

# Core Principle

Google Sheets is the current system of record.

Frontend is not the source of truth for portfolio state. It can normalize, validate and display data, but it should not become a competing calculation engine.

Current data flow:

Google Sheets -> Apps Script SITE API -> `/api/investor` -> frontend validation -> frontend normalization -> UI

External market mood flow:

alternative.me Fear & Greed -> `/api/fear-greed` -> frontend fallback-safe widget

Current caveat:
Cryptorank may publish a newer daily Fear & Greed value earlier than `alternative.me`.
The frontend must not present stale fallback/cache values as current live market mood.

---

# Ownership Map

## Google Sheets

Owns:
- manual portfolio inputs;
- transactions;
- pending wallet imports;
- active spot positions;
- active futures positions;
- price registry;
- formula output zones;
- portfolio calculations;
- risk calculations;
- reserve logic;
- decision and scenario source content;
- historical snapshots.

Sheets should remain the source of truth until a backend/database migration is explicitly started.

Do not duplicate sheet formulas in frontend unless the duplication is temporary, documented and protected by fallback logic.

## Apps Script SITE API

Owns:
- reading the current sheet state;
- exporting stable JSON;
- preserving API field names;
- preserving root structure;
- hiding internal sheet layout from frontend.

The SITE API should not rename frontend-facing fields without an API contract patch.

## Apps Script Wallet Import

Owns:
- read-only public blockchain fetches;
- TON wallet transaction normalization;
- Arbitrum wallet balance normalization;
- Solana wallet balance normalization;
- transaction import deduplication by chain, address, hash and logical time;
- writing pending rows into `Транзакции_IMPORT`;
- updating wallet sync metadata.

Apps Script Wallet Import must not:
- request private keys or seed phrases;
- sign transactions;
- execute trades;
- write directly into `Портфель`;
- write directly into `Транзакции` before manual review.

## Frontend API Layer

Owns:
- request timeout protection;
- JSON parsing;
- root shape validation;
- last successful live response cache for first paint;
- preserving previous state when API data is invalid;
- typed API response boundaries.
- last successful same-day Fear & Greed cache for first paint.
- explicit data sync status: initial loading, refreshing, ready, stale and error.
- structured validation errors before API data enters normalized portfolio state.

Frontend API layer does not own financial truth.
Mock fallback data must not be presented as current live portfolio data during initial loading.
Fear & Greed fallback data must not activate buy-ladder signals during initial loading.

## Frontend Normalization Layer

Owns:
- legacy alias normalization;
- category normalization;
- closed-position filtering for display state;
- numeric fallback coercion;
- empty/invalid API number fallback to previous stable state;
- percent-like API values normalized to frontend ratio values;
- stable frontend state shape.

Normalization must not invent new business meaning. It only protects UI from malformed or legacy data.

## Frontend Selector Layer

Owns temporary derived UI values:
- open risk positions;
- best/worst open risk position for overview display;
- futures deployable cash derived from `USDC HL`;
- spot deployable cash after reserve floor;
- category shares for UI consistency.

These selectors are migration candidates. When Sheets/API becomes authoritative for the same fields, frontend selectors should become fallback only.

## UI Components

Own:
- rendering;
- visual classes;
- presentation-only sorting where already required by current screens.

UI components must not calculate portfolio truth.

---

# Current Metric Ownership

## Portfolio

Source of truth:
- Sheets `Портфель`;
- Sheets `Фьючерсы`;
- Sheets `Цены`;
- Sheets `Расчеты`.

API fields:
- `portfolio[].asset`;
- `portfolio[].category`;
- `portfolio[].quantity`;
- `portfolio[].avgEntry`;
- `portfolio[].currentPrice`;
- `portfolio[].invested`;
- `portfolio[].currentValue`;
- `portfolio[].pnl`;
- `portfolio[].pnlPct`;
- `portfolio[].share`;
- `portfolio[].status`.

Frontend may normalize:
- `"Кэш / Стейблы"` -> `"Свободные деньги"`;
- reserve USDC/USDT rows into cash category;
- closed zero-value rows out of active display state.

## Transactions

Source of truth:
- Sheets `Транзакции`.

Pending external source:
- public TON wallet address `UQALTg4Pc2kWGwMY2cxv4-gSi-pmVOnvKjgK81oyb1vUhKMp`;
- public Arbitrum wallet address `0xFEc18D4474826afd65d578ff931F4ff2926ee0c3`;
- public Solana wallet address `E5dwGSC3DKKh4A1Hdpb2BXvcSpoWrfyWWicXq8h1Sus9`;
- Apps Script read-only TON wallet import;
- Apps Script read-only Arbitrum wallet balance import;
- Apps Script read-only Solana wallet balance import;
- Sheets `Транзакции_IMPORT`;
- Sheets `TON_WALLETS`.
- Sheets `EVM_WALLETS`.
- Sheets `SOLANA_WALLETS`.

Rules:
- imported blockchain transactions are facts to review, not portfolio truth yet;
- only approved rows should become accounting rows in `Транзакции`;
- dedupe by `chain + wallet address + transaction hash + lt`;
- spam, dust, unknown jettons and unclear swaps must stay pending or skipped;
- wallet import must never require seed phrase, private key or signing permission.
- balance-delta audit rows can document already-applied wallet accounting changes, but must be protected from approval-based double counting.

## Overview

Source of truth:
- Sheets overview/calculation layer.

Frontend currently overrides or derives:
- `categories` from normalized portfolio;
- `topPositions` from normalized portfolio;
- `bestPosition` and `worstPosition` from open risk positions when available.

Reason:
The UI must avoid stale overview best/worst values and keep risk-first display based on open non-cash positions.

Long-term target:
SITE API should export authoritative open-risk best/worst values and frontend should use selectors only as fallback.

## Risk

Source of truth:
- Sheets risk layer.

Frontend currently derives:
- `futuresDeployableCash` from `USDC HL`;
- `spotDeployableCash` from spot cash reserve after reserve floor;
- category shares from normalized portfolio;
- stocks/metals/futures/cash shares where API does not yet provide them reliably.
- largest open risk asset from normalized open risk positions.
- fallback reserve health rules through `riskCore` and `riskRules`.
- temporary exposure warnings from category and single-asset policy limits.
- risk warning presentation as a discipline checklist on the Risk screen.

Reason:
Risk Core is still being stabilized and deployable capital split must not depend on stale legacy `deployableCash`.
Legacy `deployableCash` must not be used as a futures bucket fallback.
Health display tone must not be treated as leverage/risk pressure.

Long-term target:
Sheets/API should export:
- reserve floor;
- spot deployable cash;
- futures deployable cash;
- category exposure;
- largest open risk asset;
- risk warnings.

Frontend should validate and display these values, deriving only fallback values.

## History

Source of truth:
- Sheets `История`.

API target:
- optional root `history` array during Stage 2;
- required history contract in the later analytics/history stage.

Frontend may:
- validate and display history;
- normalize future API `history` into `PortfolioHistoryPoint[]`;
- normalize exported sheet-style decimal strings for the history layer only;
- derive chart-ready sorted history and summary deltas from normalized history;
- use history for charts and drawdown foundation after the API contract is live.

Frontend must not:
- build authoritative portfolio history from browser localStorage;
- treat last-live cache as historical data.

## Decisions And Scenarios

Source of truth:
- Sheets `Решения`;
- Sheets `Сценарии`.

Frontend may:
- normalize current sheet-export headers into stable playbook fields;
- preserve previous valid text for missing optional fields in a returned row.

Frontend owns:
- presentation;
- status tone classes;
- display grouping.

Frontend should not rewrite strategic thesis logic.

---

# Duplication Reduction Plan

1. Keep API contract documented and stable.
2. Keep runtime API validation separate from hooks.
3. Move normalizers out of hooks.
4. Move selectors out of hooks and components.
5. Keep `App.tsx` as routing/composition only.
6. Extract pages after data boundaries are stable.
7. Move CSS by feature only after component boundaries settle.
8. During backend migration, replace Sheets-owned metrics with backend-owned metrics without changing UI component contracts.

---

# Current Known Temporary Duplications

- Frontend recalculates category allocations for UI consistency.
- Frontend recalculates open best/worst risk positions.
- Frontend derives deployable cash split.
- Fallback local portfolio state still calculates portfolio and risk state.
- Fallback risk rules are isolated in `src/lib/riskCore.ts` and `src/config/riskRules.ts`.
- Structured exposure warning foundations are isolated in `src/lib/riskExposure.ts`; UI renders them as a calm discipline checklist.

These are allowed during Stage 2, but they must remain isolated in `lib` selectors/normalizers instead of spreading through pages and components.

---

# Do Not Do

- Do not move financial truth into UI components.
- Do not change Google Sheets formulas from frontend cleanup patches.
- Do not rename API fields without a dedicated contract patch.
- Do not remove fallback state.
- Do not treat PnL as the primary dashboard truth.
- Do not introduce backend/database assumptions before the migration stage starts.
