# ARCHITECTURE BASELINE

Patch: 1.3
Status: completed
Type: documentation

This document freezes the current working architecture before future refactoring.
It is a baseline, not a refactor plan.

---

# Current Architecture

## React/Vite frontend

The site is a React + Vite + TypeScript frontend.

Primary frontend responsibilities:
- render the investor dashboard UI
- request portfolio data from `/api/investor`
- keep local fallback data available
- render the Fear & Greed widget from a separate external API

Main frontend files:
- `src/App.tsx`
- `src/App.css`
- `src/main.tsx`

## Google Sheets source of truth

Google Sheets is the current source of truth for portfolio data.

It stores:
- positions
- prices
- calculations
- risk layer
- futures logic
- decisions
- scenarios
- history
- transactions

Sheet structure must not be changed without a separate patch.

## Apps Script SITE API

The SITE API Apps Script reads Google Sheets and exposes JSON for the site.

Current frontend API entry point:
- `/api/investor`

The frontend expects stable JSON naming and root structure.
API root fields must not be renamed without a dedicated API contract patch.

## Apps Script UPDATE PRICES

The UPDATE PRICES Apps Script updates market prices inside Google Sheets.

Current external price source:
- Hyperliquid

The script updates the sheet price layer, then sheet calculations use those prices.
This script must not be touched unless the patch is specifically about prices.

## Vite local proxy

Local development uses Vite proxy:

- local endpoint: `/api/investor`
- target: Google Apps Script SITE API

This proxy is a local development feature.
Production proxy behavior must be confirmed separately on Vercel.

## Vercel production

Vercel is the production hosting layer.

Current expected production domain:
- `https://investor-cabinet.vercel.app`

Build command:
- `npm run build`

Output directory:
- `dist`

## Fear & Greed external API

Fear & Greed is independent from `/api/investor`.

Source:
- `https://api.alternative.me/fng/?limit=1`

Frontend behavior:
- React state stores the current index
- frontend reads it through `/api/fear-greed`
- fallback value is `34`
- widget label is derived from the index range

---

# Data Flow

## Portfolio site data

Google Sheets
-> Apps Script SITE API
-> JSON
-> React frontend
-> UI

Meaning:
- Sheets hold portfolio state and calculations.
- SITE API converts current sheet state into JSON.
- React fetches the JSON through `/api/investor`.
- UI renders overview, risk, portfolio and related dashboard blocks.

## Price update flow

Hyperliquid
-> Apps Script UPDATE PRICES
-> sheet Prices
-> sheet calculations
-> Apps Script SITE API
-> site

Meaning:
- Hyperliquid provides market prices.
- UPDATE PRICES writes prices into the spreadsheet price layer.
- Google Sheets formulas/calculations update portfolio and risk values.
- SITE API exposes calculated results to the frontend.
- The site renders the latest available API state.

## Fear & Greed flow

alternative.me
-> `/api/fear-greed`
-> React state
-> Fear & Greed widget

Meaning:
- The widget uses a separate external API.
- It does not depend on Google Sheets.
- If the request fails, the widget falls back to `34`.

---

# Known Limitations

- Production proxy for `/api/investor` must be confirmed separately.
- Login is not real authentication yet; current credentials are client-side test access.
- Portfolio data is still partially fallback/local in the frontend.
- `src/App.tsx` is too large and should be refactored later in safe patches.
- Multi-user mode is intentionally not being built yet.
- Auth, accounts and backend migration are future topics, not current patch scope.

---

# Current Safe Patch Rules

- One patch = one task.
- First plan, then apply.
- Run build after every code change.
- Do not touch UI geometry without explicit permission.
- Do not change API naming or root structure without a dedicated API patch.
- Do not rewrite `App.tsx` as part of unrelated work.
- Do not change Google Sheets structure without a separate patch.
- Do not touch Apps Script UPDATE PRICES unless the task is about prices.
- Do not touch Apps Script SITE API unless the task is about JSON contract.
- Do not start multi-user/auth/refactor work inside unrelated patches.
