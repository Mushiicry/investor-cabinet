# PATCH LOG

---

# PATCH 1.0

Initial MVP architecture.

Stack:
- React
- TypeScript
- Vite
- Google Sheets
- Apps Script
- Vercel

Main pages:
- Overview
- Portfolio
- Risk
- Scenarios

---

# PATCH 1.1

Stabilization patch.

Changes:
- fixed build issues
- fixed unused imports
- stabilized deployment
- connected Vercel production build

Status:
stable

---

# PATCH 1.2

Live Fear & Greed integration.

Goal:
show live Fear & Greed index instead of static value.

Details:
- changed file: `src/App.tsx`
- fallback: 14
- API: `https://api.alternative.me/fng/?limit=1`
- build: successful
- `App.css` was not changed
- `vite.config.ts` was not changed

Safety:
- keep fallback 14
- isolated state
- no geometry changes
- no App.tsx rewrite
- no API contract changes

Status:
completed

---

# PATCH 1.3

Architecture Baseline.

Type:
documentation

Goal:
freeze the current working architecture before future refactoring.

Changes:
- added `docs/ARCHITECTURE_BASELINE.md`
- documented current React/Vite, Google Sheets, Apps Script, Vercel and Fear & Greed architecture
- documented current data flows
- documented known limitations and safe patch rules

Build:
not required, code was not changed

Status:
completed

---

# PATCH 1.4

Extract Types.

Type:
code organization

Goal:
move TypeScript portfolio/dashboard types from `src/App.tsx` into a dedicated type layer without changing runtime behavior.

Changes:
- updated `src/types/portfolio.ts`
- replaced local App type declarations with type-only imports
- kept UI, fetch logic, state logic, calculations and styling unchanged

Build:
successful

Status:
completed

---

# PATCH 1.5

Production API Fix.

Type:
deployment routing

Purpose:
make production `/api/investor` work on Vercel and return live Apps Script data.

Files changed:
- `vercel.json`
- `docs/PATCH_LOG.md`

Details:
- added Vercel rewrite for `/api/investor`
- destination matches the current Apps Script `/exec` URL used by the Vite local proxy
- no UI, Google Sheets, Apps Script, Fear & Greed, helpers or refactor changes

Build:
successful

Status:
completed

---

# PATCH 1.6

Extract Helpers / Formatters.

Type:
code organization

Goal:
move pure helper and formatter functions out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/lib/formatters.ts`
- `src/lib/uiHelpers.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- extracted currency and percent formatters
- extracted pure UI helper functions
- kept JSX, UI, CSS, API behavior, state, fetch, fallback data and calculations unchanged
- did not touch `vercel.json` or `vite.config.ts`

Build:
successful

Status:
completed

---

# PATCH 1.7

API Layer Separation.

Type:
code organization

Goal:
move API fetch/parsing boundaries out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/api/investor.ts`
- `src/api/fearGreed.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- added `fetchInvestorData()` returning raw `/api/investor` JSON
- added `fetchFearGreedValue()` returning `number | null`
- kept investor merge logic, state updates, intervals, fallback data and Fear & Greed behavior in `src/App.tsx`
- did not touch UI, JSX, CSS, `vite.config.ts`, `vercel.json`, calculations or page components

Build:
successful

Status:
completed

---

# PATCH 1.8

Constants Separation.

Type:
code organization

Goal:
move static configuration constants out of `src/App.tsx` and API modules without changing runtime behavior.

Files changed:
- `src/config/constants.ts`
- `src/App.tsx`
- `src/api/investor.ts`
- `src/api/fearGreed.ts`
- `docs/PATCH_LOG.md`

Details:
- extracted test login constants
- extracted market cycle date constants as `new Date(...)`
- extracted API URL constants
- extracted refresh interval constants without changing values
- kept UI, JSX, API behavior, state, fetch semantics, fallback data, calculations and login behavior unchanged
- did not touch `App.css`, `vite.config.ts` or `vercel.json`

Build:
successful

Status:
completed

---

# PATCH RULES

Every patch must include:

- purpose
- affected files
- risks
- rollback possibility
- deployment impact

Never:
- rewrite entire App.tsx
- break geometry
- change API naming
- remove fallback blindly
- merge huge unstable patches
