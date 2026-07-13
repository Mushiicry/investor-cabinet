# CODEX TRACKER 2026-07-11

Status: current through 2026-07-13 canonical frontend/apps-script merge
Scope: Codex-owned isolated audit/fix track  
Product mode: personal investor operating system, no SaaS/marketing expansion

---

# Ownership Boundary

Codex owns:
- documentation fixes;
- API contract documentation;
- accounting/risk rules documentation;
- security baseline documentation;
- read-only verification;
- isolated tests/fixtures after Claude stabilizes current `src/` changes.

Claude owns for active frontend/blockchain phases:
- `src/` frontend feature work;
- blockchain hooks/cards;
- build fix already started there;
- lint cleanup in files he touched;
- serverless proxy/auth patch;
- mobile/layout/UI patches;
- large Apps Script deploy code.

User owns ops:
- Vercel env changes;
- Apps Script authorization and redeploy;
- sensitive Google Sheets formula edits;
- production deploy approvals.

Rule:
one file, one agent at a time. Codex does not edit Claude-active `src/`, Apps Script or Vercel routing files without a handoff.

---

# Task Board

| ID | Priority | Task | Owner | Status | Files |
|---|---:|---|---|---|---|
| C-01 | P0 | Fix percent/unit contract in API docs | Codex | done | `docs/sheets/API_CONTRACT.md` |
| C-02 | P0 | Add security baseline for personal-tool path | Codex | done | `docs/SECURITY_BASELINE.md` |
| C-03 | P0 | Add accounting rules baseline | Codex | done | `docs/ACCOUNTING_RULES.md` |
| C-04 | P0 | Add Codex/Claude/user tracker | Codex | done | `docs/CODEX_TRACKER_2026-07-11.md` |
| C-05 | P1 | Refresh project map for V2/current ownership | Codex | done | `docs/PROJECT_MAP.md` |
| C-06 | P1 | API contract fixtures for live `/api/investor` shape | Codex | done | `docs/api-fixtures/investor-live-shape-2026-07-11.json`, `test/contracts/apiShape.fixture.test.ts` |
| C-07 | P1 | Vitest finance/accounting tests | Codex | done | `test/contracts/*.test.ts` |
| C-08 | P1 | Dependency audit/fix plan | Codex | done | `package-lock.json` only |
| C-09 | P1 | Local/prod wife URL verification | Codex | done | `vite.config.ts` aligned to production wife deployment ID |
| C-10 | P2 | `clasp logs` / GCP log access verification | Codex + User | done | Apps Script linked to GCP project `shaped-buttress-448017-g2`; `npx clasp logs --json` works |
| C-11 | P0 | Vercel serverless auth proxy for investor APIs | Codex | done | `api/`, `src/api/investor.ts`, `vercel.json`, `test/contracts/investorProxy.test.ts` |
| C-12 | P2 | Replace stale daily snapshot trigger | User + Codex | done | removed missing `recordDailySnapshot` trigger; installed `syncInvestorCabinetDailySnapshot` |
| C-13 | P2 | Install hourly Cosmos transaction trigger | User + Codex | done | `syncCosmosWalletTransactions` time trigger installed; manual run imported 11 tx rows |
| C-14 | P1 | Merge canonical frontend/apps-script checkpoint | Claude + User | done | `claude/frontend-appscript-checkpoint-2026-07-12` merged as PR #4 |
| C-15 | P2 | Close duplicate Codex branches covered by canonical/main | Codex | done | `codex/solana-rpc-fallback-2026-07-11`, `codex/frontend-cosmos-checkpoint-2026-07-11`, `codex/vercel-api-runtime-hotfix-2026-07-11` |

---

# Findings To Keep Visible

## Wife API routing

Observed mismatch:
- local `vite.config.ts` `/api/investor-wife` target uses one Apps Script deployment ID;
- production `vercel.json` `/api/investor-wife` uses another Apps Script deployment ID.

Impact:
local and production can read different wife API versions.

Status:
fixed for local dev proxy by aligning `vite.config.ts` to the production wife Apps Script deployment ID.

## Apps Script UrlFetch authorization

Observed production symptom:
wife API returned Apps Script permission error for `UrlFetchApp.fetch`.

Required ops action:
open Apps Script project, run the function that calls `UrlFetchApp`, pass authorization, then redeploy the web app.

## Vercel env

Observed gap:
`VITE_HL_ADDRESS` was missing in Vercel env during audit.

Required ops action:
add the env var in Vercel and redeploy.

## Google Sheets formulas

Live sheet check confirmed:
- `overview.pnlPct` is decimal fraction via `Обзор!D2 = IFERROR(C2/B2;0)`;
- `FearGreedRules.buyPct` is decimal fraction;
- `Кэш / Стейблы` still exists as a Sheets/API category alias and must normalize to `Свободные деньги`.

---

# Next Codex Work

1. Keep contract tests green while Claude continues UI/frontend work.
2. Add deeper accounting tests only after accounting reducer/helper implementation exists.
3. Do not add extra Apps Script URL guards again without explicit approval.
4. Do not start parallel `src/v2` segmentation work; Claude owns `claude/segmentation-empty-account-2026-07-13`.

---

# Verification Log

## 2026-07-11

Docs patch verification:
- `npm run build`: passed.
- `npm run lint`: failed in Claude-active `src/` and V2 hook/component files; no doc-related lint impact.
- Codex-edited files stayed inside `docs/`.

Dependency verification:
- `npm audit --omit=dev`: initially found 3 production vulnerabilities in `echarts`, `postcss` and `vite`.
- `npm audit fix`: changed only `package-lock.json`.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npm run build`: passed after lockfile update.
- `npm run lint`: still failed in Claude-active `src/` and V2 hook/component files.

Read-only API fixture verification:
- production `/api/investor`: `200`, about 4.9 seconds, shape captured without private values.
- direct investor Apps Script endpoint: `200`, same response size and same root keys as production.
- production `/api/fear-greed`: `200`, about 0.4 seconds.
- production `/api/investor-wife`: `200`, but payload contains `_chain._errors`.
- production and local wife Apps Script endpoints both return compatible root shape, but route config still points to different deployment IDs.
- added sanitized fixture: `docs/api-fixtures/investor-live-shape-2026-07-11.json`.
- added test plan: `docs/API_CONTRACT_TEST_PLAN.md`.
- fixture JSON parse check: passed.
- `npm audit --omit=dev`: passed after fixture/test-plan work.
- `npm run build`: passed after fixture/test-plan work.
- `npm run lint`: still failed in Claude-active `src/` and V2 hook/component files.

Executable test harness:
- added `vitest` dev dependency.
- added `npm run test`.
- added `test/contracts/apiShape.fixture.test.ts`.
- added `test/contracts/portfolioUnits.test.ts`.
- added `test/contracts/fearGreedStrategy.test.ts`.
- `npm run test`: passed, 14 tests across 3 files.
- API contract docs updated for live optional fields: `transactions`, `overview.*Label`, `portfolio[].ticker`.

Post-Claude lint-fix verification:
- `npm run test`: passed, 14 tests across 3 files.
- `npm run lint`: passed, 0 errors and 0 warnings.
- `npm run build`: passed on Vite 8.1.4.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.

Config/proxy work:
- aligned local `/api/investor-wife` Vite proxy with production wife Apps Script deployment ID.
- Historical at this point: `npx clasp logs --json` was still blocked with `GCP project ID is not set`; resolved on 2026-07-12.
- `npx clasp status --json`: works and shows Apps Script files pending push.
- added Vercel serverless functions for `/api/investor` and `/api/investor-wife`.
- frontend now forwards Supabase access token in `Authorization` for investor API requests.
- `vercel.json` no longer rewrites investor APIs directly to Apps Script; API functions handle those routes.
- added proxy tests for 401, 403 and successful upstream proxy.
- `npm run test`: passed, 17 tests across 4 files.
- `npm run lint`: passed, 0 errors and 0 warnings.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- serverless API typecheck: passed with `tsc --ignoreConfig`.

Post-Claude mobile/lint work verification:
- `vite.config.ts` and production serverless fallback now use the same wife Apps Script deployment ID.
- `npm run test`: passed, 17 tests across 4 files.
- `npm run lint`: passed, 0 errors and 0 warnings.
- `npm run build`: passed on Vite 8.1.4.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- serverless API typecheck: passed.

Additional contract coverage:
- added `test/contracts/accountingRules.test.ts` for BUY/SELL/TRANSFER/SWAP accounting rules.
- added `test/contracts/configConsistency.test.ts` to prevent wife local/prod deployment drift and direct production rewrites.
- `npm run test`: passed, 24 tests across 6 files.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- Historical at this point: `npx clasp logs --json` was still blocked with `GCP project ID is not set`; resolved on 2026-07-12.

## 2026-07-12

Ops verification refresh:
- Apps Script GCP project is linked to `shaped-buttress-448017-g2`.
- `npx clasp logs --json`: works and returns Cloud Logging entries.
- wife Apps Script was authorized/redeployed by the user; Vercel env was updated and production redeployed.
- stale `recordDailySnapshot` trigger failed with `Script function not found: recordDailySnapshot`.
- stale trigger was removed and replaced with `syncInvestorCabinetDailySnapshot`.
- `syncCosmosWalletTransactions` hourly trigger was installed; manual run logged `Cosmos tx import: +11 транзакций`.
- Remaining P0 security gap: direct Apps Script URLs should still be protected by shared secret/rotation.

## 2026-07-13

Canonical frontend/apps-script merge:
- `claude/frontend-appscript-checkpoint-2026-07-12` is the canonical source for Signals empty-state, Cosmos self-heal, Solana RPC failover and neutral empty-state work in Risk/Health/allocation/top metrics.
- Canonical branch was merged to `main` as PR #4.
- Solana Apps Script changes were pushed with `clasp push` by Claude/user flow.
- Apps Script deployment URL was not changed during that push.
- Duplicate Codex branches were not merged because they are covered by canonical/main:
  - `codex/solana-rpc-fallback-2026-07-11`;
  - `codex/frontend-cosmos-checkpoint-2026-07-11`;
  - `codex/vercel-api-runtime-hotfix-2026-07-11`.

Post-merge verification:
- `npm run test`: passed, 24 tests across 6 files.
- `npm run lint`: passed.
- `npm run build`: passed on Vite 8.1.4.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
