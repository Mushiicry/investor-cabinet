# System Hardening Roadmap — 2026-07-13

Status: active  
Scope: privacy, data reliability, mobile-readiness, maintainability  

## P0 — Privacy Boundary

1. Apps Script shared secret
   - Vercel serverless proxy appends `apiKey` from server-only env.
   - Apps Script rejects direct calls when matching Script Property is configured.
   - Rotate Apps Script deployment URLs after both sides are live.

2. Local/prod API parity
   - Local development must not silently bypass the serverless auth proxy.
   - Preferred path: `vercel dev` for authenticated API checks.
   - Alternative path: local Vite proxy mirrors the serverless auth/secret flow.

## P1 — Mobile Foundation

3. Mobile shell
   - Split desktop and mobile layout responsibilities.
   - Preserve current desktop geometry.
   - Avoid adding more global CSS overrides on top of the 1920px desktop shell.

4. Bundle and CSS weight
   - Add view-level code splitting before adding more mobile screens.
   - Keep heavy charts and reports lazy-loaded.

5. Mobile regression checks
   - Add repeatable viewport checks for desktop, tablet, and phone.
   - Validate text fit, no horizontal overflow, and auth/data states.

## P2 — Data Reliability

6. Apps Script importer resilience
   - Rate-limit and retry RPC calls.
   - Log per-chain health.
   - Keep wallet imports pending/reviewed where accounting impact is ambiguous.

7. Live API smoke checks
   - Add a read-only smoke script for `/api/investor` and `/api/investor-wife`.
   - Keep sanitized fixtures for contract tests.

## P3 — Maintainability

8. Documentation refresh
   - Update architecture docs from old rewrite model to Supabase + serverless proxy.
   - Mark V2/segmentation as current baseline.

9. Legacy cleanup
   - Remove or quarantine old mock login constants.
   - Keep Google Sheets as source of truth.

10. Component and style segmentation
   - Continue extracting shared V2 logic into `src/v2/lib`.
   - Break large CSS files only after mobile shell boundaries are clear.
