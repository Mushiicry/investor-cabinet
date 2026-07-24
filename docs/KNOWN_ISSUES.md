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

## 4. Fear & Greed source stability

Current value:
34

Issue:
live source is connected through `/api/fear-greed`; fallback must stay conservative and be reviewed if the external source changes.

Planned patch:
monitor after deployment

Priority:
low.

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

---

# STATUS UPDATE — 2026-07-16

Разделы выше описывают эпоху v1 (App.tsx / App.css монолит) и устарели:
продукт живёт в src/v2/** с модульной структурой (компоненты, lib, styles),
мобильная адаптация завершена. Монолитные App.tsx/App.css остаются только
как legacy-обёртка и не являются активной зоной разработки.

Актуальные открытые темы (владелец — Claude, см. docs/HANDOFF.md §5):
- Симулятор Health: рычаги покрывают не все грани модели.
- Cosmos import: ждёт первой живой транзакции для прогона.
- Коридор для компоненты «Гибкость» (сейчас монотонно растёт от кэша).

Закрыто в июле 2026 (детали — CODEX_TRACKER_2026-07-11.md):
инцидент guard/Apps Script, health-модель с достижимой соткой,
полная ревизия таблицы (0 ошибок), F&G-обновлятор, мобильная адаптация,
SPCXB onboard, реализованный профит в API/на сайте, P2 code-split бандла
(React и Supabase вынесены в отдельные chunks, предупреждение >500 kB закрыто).
