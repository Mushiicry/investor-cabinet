# KNOWN ISSUES

---

# CURRENT ARCHITECTURE ISSUES

## 1. App.tsx is too large

Current issue:
App.tsx contains:
- UI
- calculations
- API logic
- fallback state
- pages
- rendering

Risk:
future patches become dangerous.

Planned solution:
modular architecture.

Priority:
high.

---

## 2. App.css is monolithic

Current issue:
all geometry and visual logic
stored in one file.

Risk:
small visual changes
can break layout globally.

Priority:
high.

---

## 3. Portfolio table still uses fallback

Current issue:
portfolio positions
still partially local.

Risk:
API data mismatch.

Priority:
medium.

---

## 4. Fear & Greed still static

Current value:
14

Issue:
not connected to live source.

Planned patch:
PATCH 1.2

Priority:
medium.

---

## 5. Risk radar partially hardcoded

Current issue:
healthScore
healthAxes
summary text

still local.

Priority:
medium.

---

## 6. Scenarios and decisions are local

Issue:
not loaded from API yet.

Priority:
low.

---

## 7. Duplicate calculations exist

Current issue:
some calculations exist:
- in Sheets
- in Apps Script
- in App.tsx

Risk:
desynchronization.

Priority:
high.

---

# UI ISSUES

## 1. Geometry is fragile

Spacing/alignment
highly sensitive.

Important:
avoid global CSS rewrites.

---

## 2. Emotional UX can be broken easily

Too many:
- colors
- animations
- gradients
- dense widgets

destroy calm premium feeling.

---

# DEPLOYMENT ISSUES

## 1. Vercel depends on stable build

Small TypeScript errors
can break production deploy.

Important:
always test build before push.

---

# DEVELOPMENT RULES

Before every patch:

- identify affected files
- estimate rollback difficulty
- isolate logic
- avoid large rewrites
- preserve fallback stability