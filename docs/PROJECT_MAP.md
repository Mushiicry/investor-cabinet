# PROJECT MAP

## ROOT STRUCTURE

Investor Cabinet/

Contains:

- frontend
- styles
- local data
- project docs
- deployment configs
- architecture docs

---

# FRONTEND

Main frontend files:

src/main.tsx
- React entry point
- Supabase auth/session bootstrap

src/App.tsx
- main dashboard logic
- rendering
- cards
- pages
- layout
- portfolio state

src/v2/
- current V2 dashboard shell and pages
- active frontend feature work area
- do not edit during Claude-owned parallel frontend work unless coordinated

src/App.css
- global styles
- dashboard UI
- animations
- risk blocks
- overview blocks
- responsive behavior

src/assets/
- images
- icons
- static assets

src/hooks/
- data hooks
- wallet/staking hooks
- active Claude-owned work area during the 2026-07-11 parallel phase

src/services/
- API/client services
- cache/snapshot logic
- active Claude-owned work area during the 2026-07-11 parallel phase

src/data/
- fallback local data
- mock portfolio state

src/types/
- TypeScript models

src/lib/
- helper logic
- utils
- future shared functions

---

# DOCUMENTATION

docs/

Contains project documentation.

---

## docs/sheets/

Contains:

- formulas
- sheet structure
- API contract
- Google Sheets architecture

Files:

SHEETS_STRUCTURE.md
FORMULAS.md
API_CONTRACT.md

## Current baseline docs

CODEX_TRACKER_2026-07-11.md
- current Codex/Claude/user task boundary and progress tracker

SECURITY_BASELINE.md
- personal-tool security baseline
- current privacy risks and target API protection model

ACCOUNTING_RULES.md
- accounting and percent-unit rules
- BUY/SELL/TRANSFER/IMPORT/SWAP behavior

---

## docs/sheets_exports/

CSV exports of Google Sheets.

Purpose:
- backup
- structure recovery
- migration
- AI context
- formula understanding

---

## docs/vision/

Product philosophy and architecture.

Files:

PRODUCT_PHILOSOPHY.md
- why project exists

ARCHITECTURE_FINANCE.md
- portfolio logic
- risk logic
- calculations

UI_PRINCIPLES.md
- UI behavior
- visual philosophy
- UX rules

USER_PSYCHOLOGY.md
- investor emotions
- emotional UX
- behavior logic

DEPLOYMENT.md
- hosting
- deploy structure
- backend architecture

PROJECT_MAP.md
- central project map

---

# DEPLOYMENT

GitHub:
- repository storage
- version control

Vercel:
- production hosting
- auto deploy from GitHub

Flow:

VS Code
-> GitHub push
-> Vercel deploy

---

# BACKEND

Google Sheets
acts as database.

Google Apps Script
acts as backend/API layer.

Apps Script:
- converts sheets into JSON
- updates prices
- handles scheduler logic

---

# API

Current API source:
Google Apps Script endpoint.

Main API sections:

- overview
- portfolio
- risk
- decisions
- scenarios

Frontend partially:
- reads API
- uses fallback local state

---

# PRICE SYSTEM

Prices come from:

- Hyperliquid API
- CryptoCompare API

Update interval:
every 5 minutes.

---

# IMPORTANT RULES

Never break:

- API naming
- JSON structure
- overview fields
- root object naming

Frontend heavily depends
on current naming.

---

# LONG TERM GOAL

Investor Cabinet
must evolve into:

- institutional-grade portfolio system
- family office dashboard
- capital operating system

Potential future migration:

Google Sheets
-> Supabase/PostgreSQL/backend

without rebuilding frontend.
