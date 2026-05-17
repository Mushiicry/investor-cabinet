# CORE DEVELOPMENT RULES

Всегда работать через safe patches.

Никогда:
- не переписывать App.tsx полностью без причины
- не ломать существующую геометрию UI
- не менять naming API
- не менять structure overview/risk без необходимости
- не удалять fallback state
- не удалять calculations без проверки
- не менять formulas в Google Sheets без понимания зависимостей

---

# UI RULES

Investor Cabinet
имеет fixed visual geometry.

Важно сохранять:

- spacing
- alignment
- proportions
- dark theme style
- premium dashboard feeling
- clean institutional look

Нельзя:
- делать UI перегруженным
- делать retail-crypto style
- делать casino feeling
- делать neon overload
- делать meme-trader aesthetic

Интерфейс должен выглядеть:
как serious capital management system.

---

# RISK FIRST PRINCIPLE

При любых изменениях:

risk layer
важнее
PnL layer.

Нельзя:
- визуально переоценивать прибыль
- провоцировать emotional trading
- делать aggressive leverage UX

Главная задача UI:
контроль риска
и дисциплина.

---

# DATA SAFETY

Перед любыми изменениями:

- проверять API contract
- проверять current naming
- проверять formulas dependencies
- проверять Google Sheets bindings

Нельзя:
- менять key names без проверки App.tsx
- менять sheet structure без проверки formulas
- менять API structure без проверки frontend usage

---

# PATCH STRATEGY

Любые изменения делать:

1. маленькими патчами
2. изолированно
3. с минимальным риском
4. без переписывания половины проекта

Сначала:
- анализ
- dependency check
- только потом patch

---

# FUTURE ARCHITECTURE

Текущая система:
Google Sheets + Apps Script + React.

В будущем возможен переход:

- backend
- database
- Supabase
- PostgreSQL
- mobile app
- AI analytics

Поэтому:

architecture
должна оставаться:
- modular
- scalable
- readable
- easy to migrate

---

# IMPORTANT

Investor Cabinet
это не pet project.

Это долгосрочная operating system инвестора.

Поэтому:
каждое изменение
должно учитывать:

- scalability
- maintainability
- emotional UX
- risk logic
- future migration