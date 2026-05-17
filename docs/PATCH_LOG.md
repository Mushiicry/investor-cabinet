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

Fear & Greed integration planned.

Goal:
replace static F&G value.

Requirements:
- keep fallback 14
- isolated state
- no geometry changes
- no App.tsx rewrite
- no API contract changes

Status:
planned

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