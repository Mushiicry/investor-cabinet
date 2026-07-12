# SECURITY BASELINE

Status: personal-tool baseline  
Scope: Investor Cabinet current architecture  
Last updated: 2026-07-11

---

# Security Goal

Investor Cabinet is currently a personal investor operating system.

Security priority:
protect private portfolio data and prevent accidental exposure, while keeping the system simple enough to operate alone.

This is not a public SaaS baseline. Public multi-user SaaS requirements are deferred.

---

# Current Architecture

Current flow:

Google Sheets -> Apps Script web app -> Vercel rewrite `/api/investor` -> React frontend

Auth layer:
- Supabase Auth is used by the frontend session gate;
- portfolio data is still served by Apps Script/Vercel API path;
- Supabase is not yet the portfolio database.

Important implication:
frontend auth alone does not protect the raw Apps Script endpoint if that endpoint is publicly callable.

---

# Current Data Sensitivity

Sensitive:
- portfolio value;
- invested amount;
- PnL;
- allocation;
- wallet addresses;
- transactions;
- strategy/risk commentary;
- family/wife portfolio API.

Not sensitive:
- public market prices;
- public Fear & Greed index.

Public wallet addresses are public on-chain, but tying them to a personal dashboard is still private context.

---

# Baseline Rules

## Secrets

Never commit:
- Supabase service role key;
- Apps Script secrets;
- Vercel tokens;
- Google OAuth tokens;
- private keys;
- seed phrases.

Allowed:
- Supabase anon key in frontend env when paired with RLS/Auth design;
- public wallet addresses, if intentionally tracked.

## API Access

Target state:
- browser calls only Vercel API routes;
- Vercel serverless route validates Supabase session;
- server-side route calls Apps Script;
- Apps Script URL and optional shared secret stay server-side.

Current risk:
if Apps Script web app is deployed as public/anonymous and URL is discoverable, portfolio JSON can be read without frontend login. Production `/api/investor` and `/api/investor-wife` now route through Vercel serverless functions, but direct Apps Script URLs still need operational protection/rotation when possible.

Priority:
P0 for privacy.

Current implementation:
- browser sends Supabase access token to Vercel `/api/investor` and `/api/investor-wife`;
- Vercel function validates token through Supabase Auth;
- Vercel function checks founder/wife email before proxying Apps Script;
- Apps Script target URLs can be supplied by `INVESTOR_APPS_SCRIPT_URL` and `WIFE_APPS_SCRIPT_URL`.

Required Vercel env:
- `SUPABASE_URL` or `VITE_SUPABASE_URL`;
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`;
- `FOUNDER_EMAIL` or `VITE_FOUNDER_EMAIL`;
- `WIFE_EMAIL` or `VITE_WIFE_EMAIL`;
- `INVESTOR_APPS_SCRIPT_URL` recommended;
- `WIFE_APPS_SCRIPT_URL` recommended.

Planned hardening:
- add server-only shared secret env in Vercel;
- Vercel proxy appends the secret to Apps Script upstream requests;
- Apps Script rejects requests with missing/invalid secret before returning portfolio JSON;
- rotate Apps Script deployments after secret protection is live, so old public URLs are no longer useful.

## Google Sheets

Rules:
- Sheets remain source of truth;
- do not grant broad edit access to collaborators unless needed;
- formula edits must be reviewed before applying;
- `Транзакции_IMPORT` rows are not trusted accounting truth until reviewed.

## Apps Script

Rules:
- wallet imports are read-only;
- no signing permissions;
- no seed/private-key handling;
- Apps Script deployments should be versioned;
- after adding `UrlFetchApp`, authorization must be completed before production redeploy.

## Vercel

Rules:
- production env vars must be set in Vercel, not hardcoded;
- preview/prod env drift must be checked before deploy;
- do not expose Apps Script deployment IDs in new client-side code;
- check rewrites when local and production API behavior diverge.

## Browser Cache

Rules:
- cache can improve first paint only;
- cache must not be presented as guaranteed live truth;
- logout should clear portfolio-related local/session cache;
- stale/error state must be visible to the user.

---

# Minimum Acceptance Checklist

Before treating privacy as acceptable for personal use:

- `/api/investor` returns 401/403 without a valid Supabase session.
- `/api/investor-wife` returns 401/403 without a valid Supabase session.
- Apps Script direct URL is not used by production frontend client code.
- Vercel env contains all required server-side API targets/secrets.
- Logout clears cached portfolio state.
- Build succeeds.
- Lint has no security-relevant ignored errors.

---

# Deferred SaaS Requirements

Deferred until product direction changes:
- multi-tenant database isolation;
- user-specific RLS policy matrix;
- team roles;
- billing;
- organization/workspace model;
- audit log UI;
- SOC2-style process controls.
