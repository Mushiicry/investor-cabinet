# API CONTRACT TEST PLAN

Status: contract and accounting test harness implemented
Scope: tests/fixtures only, no active V2 UI/hook edits  
Reference fixture: `docs/api-fixtures/investor-live-shape-2026-07-11.json`

---

# Goal

Add contract tests that protect the stable `/api/investor` boundary without turning frontend code into a second accounting engine.

The tests should catch:
- broken root shape;
- renamed API keys;
- invalid numeric units;
- missing portfolio/risk/history sections;
- accidental percent-unit regressions;
- unsafe treatment of wife API chain errors.

---

# Current Read-Only Findings

Checked on 2026-07-11:

- `https://investor-cabinet.vercel.app/api/investor` returned `200` in about 4.9 seconds.
- Direct investor Apps Script returned the same response size and same root keys.
- `https://investor-cabinet.vercel.app/api/fear-greed` returned `200` quickly.
- `https://investor-cabinet.vercel.app/api/investor-wife` returned `200`, but the payload still contains `_chain._errors`.
- local and production wife routes had pointed to different Apps Script deployment IDs; this was fixed in the follow-up config/proxy work.

Important:
the fixture stores shape only. It does not store private portfolio values.

---

# Phase 1: Docs-Only Fixture Baseline

Done:
- create sanitized live-shape fixture under `docs/api-fixtures/`;
- document contract gaps before writing strict tests;
- avoid touching `src/`.

Open gaps from live shape:
- `risk.futuresDeployableCash` is documented as target but absent from live investor API;
- `risk.spotDeployableCash` is documented as target but absent from live investor API;
- `transactions` exists in live root payload but is not defined in the root contract block;
- `portfolio[].ticker` exists live but is absent from documented row shape;
- `overview.investedLabel`, `overview.pnlLabel`, `overview.portfolioLabel` exist live but are absent from documented overview shape.

Decision needed before strict tests:
mark these fields as optional/target, or update Apps Script to emit the target fields.

---

# Phase 2: Test Harness

Initial implementation added:
- `test/contracts/apiShape.fixture.test.ts`;
- `test/contracts/portfolioUnits.test.ts`;
- `test/contracts/fearGreedStrategy.test.ts`;
- `npm run test` script;
- Vitest as dev dependency.

Later additions:
- add full `test/fixtures/investor.valid.fixture.json` with sanitized sample payload;
- add live response validator test for locally saved payloads;
- add wife degraded-state tests once the UI data-status contract is stable.

Do not edit:
- active V2 UI files;
- active hooks;
- Apps Script deployment code;
- Vercel routing.

---

# Investor API Contract Tests

Minimum tests:

1. Root shape
- `success` is boolean;
- `overview` is object;
- `portfolio` is array;
- `history` is array when present;
- `risk` is object;
- `fearGreedStrategy` is object when present;
- `decisions` is array;
- `scenarios` is array;
- `updatedAt` is string or empty fallback.

2. Overview numeric fields
- `portfolioValue`, `invested`, `pnl`, `pnlPct`, `reserve`, `positionsCount`, `health` are numbers.
- `overview.pnlPct` is decimal fraction, not direct percent.
- `health` is a score `0..100`.

3. Portfolio row fields
- each row has stable keys: `asset`, `category`, `quantity`, `avgEntry`, `currentPrice`, `invested`, `currentValue`, `pnl`, `pnlPct`, `share`, `status`;
- numeric fields are numbers;
- `portfolio[].pnlPct` and `portfolio[].share` are direct percent values;
- optional `ticker` is allowed if documented.

4. Risk fields
- `portfolioValue`, `health`, `reserve`, `reserveShare`, `deployableCash`, `largestRiskShare`, `cryptoShare` are numbers;
- risk share fields are direct percent values in current API;
- `state`, `signal`, `summary` are strings;
- absent target fields `futuresDeployableCash` and `spotDeployableCash` are handled as optional until Apps Script exports them.

5. History fields
- every history item has `date`, `portfolioValue`, `invested`, `pnl`, `pnlPct`, `reserve`;
- `history.pnlPct` follows decimal fraction contract;
- history must not be reconstructed from browser cache.

6. Fear & Greed strategy
- `currentIndex` is number;
- `rules` is array;
- each `rules[].buyPct` is decimal fraction;
- `buyAmount` is number when present;
- module must not imply order execution.

---

# Wife API Contract Tests

Minimum tests:

1. Root shape should remain compatible with investor API root.
2. Empty `history`, `decisions` and `scenarios` arrays are allowed.
3. `_chain._errors` must not crash frontend rendering.
4. `_chain._errors` should surface as stale/degraded data status, not as clean live success.
5. local/prod Apps Script deployment ID drift should be flagged by a config test or documented ops check.

---

# Accounting Unit Tests

Only after accounting helpers are stable and not actively edited:

1. BUY increases quantity and cost basis.
2. Partial SELL reduces cost basis by old average entry.
3. Partial SELL does not change remaining average entry.
4. Realized PnL equals sale proceeds minus sold cost basis.
5. TRANSFER does not change cost basis.
6. SWAP is represented as SELL disposed asset plus BUY acquired asset.
7. `overview.pnlPct` formats as decimal fraction.
8. `portfolio[].pnlPct` formats as direct percent.
9. `Кэш / Стейблы` normalizes to `Свободные деньги`.
10. `USDC HL` counts toward futures cash, not spot deployable cash.

---

# Acceptance Criteria

A future test patch is acceptable only if:

- it does not edit active Claude-owned frontend files;
- it does not require live private data in repo fixtures;
- fixtures are sanitized;
- `npm run build` passes;
- `npm run lint` passes;
- `npm audit --omit=dev` remains clean.
