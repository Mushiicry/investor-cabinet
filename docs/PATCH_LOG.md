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
