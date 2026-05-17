# DEPLOYMENT

## Current stack

Frontend:

* React
* Vite
* TypeScript

Hosting:

* Vercel

Repository:

* GitHub

Database:

* Google Sheets

Backend/API:

* Google Apps Script

Price providers:

* Hyperliquid API
* CryptoCompare API

---

## Deployment flow

Local development:
MacBook -> VS Code -> Vite local server

Production flow:
VS Code
-> GitHub push
-> Vercel auto deploy
-> production website

---

## Environment architecture

Frontend:

* receives JSON from Apps Script API
* partially uses local fallback state
* renders portfolio dashboard

Google Sheets:

* stores portfolio data
* stores formulas
* stores calculations
* stores scenarios
* stores risk system

Apps Script:

* converts Sheets into JSON API
* updates prices
* handles scheduler triggers

---

## Important deployment rules

Never:

* break API naming
* rename JSON root fields
* change Apps Script endpoint structure
* hardcode production URLs randomly

Always:

* preserve compatibility
* test local before deploy
* validate API JSON before patch
* keep fallback state during migrations

---

## Current deployment philosophy

Investor Cabinet
must remain:

* lightweight
* modular
* scalable
* easy to migrate
* easy to maintain

Future migration possible:
Google Sheets
-> Supabase/PostgreSQL/backend

without rebuilding whole frontend.

---

# REAL PRODUCTION SERVICES

## GitHub Repository

Repository:
Mushiicry/investor-cabinet

Branch:
main

Purpose:
- source control
- version history
- deployment source for Vercel

---

## Vercel Project

Project:
investor-cabinet

Production domain:
https://investor-cabinet.vercel.app

Auto deploy:
enabled

Deployment flow:
GitHub main push
-> automatic Vercel production deploy

---

## Current Production State

Environment:
Production

Hosting:
Vercel

Framework:
Vite + React + TypeScript

Build system:
Vercel CI/CD

---

## Important Infrastructure Notes

Frontend is currently:

- stateless
- lightweight
- frontend-only architecture

Backend logic currently lives inside:
- Google Sheets
- Apps Script
- frontend calculations

---

## Current Architecture Type

Current project architecture:

Google Sheets
-> Apps Script JSON API
-> React frontend
-> Vercel deployment

---

## Future Infrastructure Possibilities

Potential future upgrades:

- Supabase
- PostgreSQL
- Node backend
- Auth system
- User accounts
- Portfolio sync
- AI analytics
- Mobile application

Without rewriting frontend architecture.