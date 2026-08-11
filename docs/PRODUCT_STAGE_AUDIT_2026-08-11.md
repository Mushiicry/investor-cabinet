# Аудит стадии продукта и путь к мобильному приложению

Дата среза: 2026-08-11  
Проект: Investor Cabinet / Mushi Invest  
Главная цель следующего горизонта: мобильное приложение, чтобы кабинет был полноценно читаем и полезен с телефона.

---

## 1. Использованные источники

### Активные документы

- `docs/MUSHI_INVEST_FIX_ROADMAP_RU_2026-08-03.md` — основной актуальный roadmap фиксов.
- `docs/MUSHI_INVEST_SYSTEM_SNAPSHOT_2026-07-30.md` — исторический системный snapshot.
- `docs/HANDOFF.md` — живой статус-борд задач и анти-паттернов.
- `docs/INVESTOR_CABINET_ROADMAP.md` — master product roadmap.
- `docs/TECHNICAL_ROADMAP.md` — техническая стабилизация MVP.
- `docs/RISK_HEALTH_IMPLEMENTATION_ROADMAP.md` — порядок реализации risk/health.
- `docs/RISK_AND_PORTFOLIO_HEALTH_MANIFEST.md` — продуктовая конституция risk-first.
- `docs/KNOWN_ISSUES.md` и `docs/PATCH_LOG.md` — история закрытых проблем и mobile-wave фиксов.

### Текущая live-проверка

- GitHub: `main` содержит коммит `51f84c0 Fix canonical gold Apps Script sync`.
- Production API main: `https://investor-cabinet.vercel.app/api/investor` возвращает `success:true`.
- Production API wife: `https://investor-cabinet.vercel.app/api/investor-wife` возвращает `success:true`.
- Main portfolio сейчас отдает 14 строк, без `GOLD LONG` и `BTC LONG`.
- `GOLD` отдается как `asset:GOLD`, `ticker:GOLD`, с live-ценой из Hyperliquid `xyz:GOLD`.

---

## 2. Главный вывод

Продукт уже не находится в стадии "прототипа".

Текущая стадия:

```text
Working personal investor operating system
-> stabilization / hardening
-> mobile-ready web shell
-> mobile app preparation
```

Это рабочий web-продукт с live-данными, аккаунтами main/wife, Google Sheets source of truth, Apps Script API, Vercel proxy, V2 UI, risk/health моделью, сигналами, отчетами, ДНК, стратегиями и кошельковыми импортами.

Но это еще не mobile app и не production-grade mobile product.

Главная проблема сейчас не в том, что "нет экранов". Экраны есть. Главная проблема в том, что перед мобильным приложением нужно стабилизировать источник данных, контракт, stale/cache поведение и mobile critical flows.

---

## 3. Что уже готово

### 3.1 Data layer

Готово:

- Google Sheets остается source of truth.
- Apps Script API отдает portfolio / overview / risk / history / transactions.
- Vercel proxy работает как публичная граница сайта.
- Main и wife разделены.
- Живые цены, кошельковые балансы и Hyperliquid данные подключены.
- Сегодня исправлена ошибка с `GOLD LONG`: каноническая строка теперь `GOLD`.

Оценка готовности: 75%.

Не хватает:

- жесткого live JSON contract main/wife;
- теста на пустые optional-поля;
- формального описания обязательных полей для мобильного клиента;
- гарантии, что stale/cache состояние всегда понятно пользователю.

### 3.2 Risk / Health core

Готово:

- V2 Health модель с шестью лучами.
- Резерв, диверсификация, концентрация, контроль риска, выживаемость, дисциплина.
- Фьючерсный блок учитывает лимит 10% активной торговли.
- Risk-first рекомендации уже влияют на UI.
- Есть pre-trade / gate логика.

Оценка готовности: 70%.

Не хватает:

- одного канонического Health Score между Sheets/API/UI;
- полной фиксации, какие health поля legacy, а какие продуктовые;
- связки signal/DCA/recommendation с risk gate как абсолютным приоритетом на всех экранах;
- отдельного mobile-friendly представления "что делать сейчас".

### 3.3 V2 web UI

Готово:

- Overview.
- Portfolio.
- Health.
- Risk.
- Reports.
- Signals.
- Scenarios.
- Gate / Проверка.
- Settings.
- DNA.
- Education shell.
- Mobile tab bar.
- Mobile sidebar drawer.
- Большой слой `v2-mobile.css` уже существует.

Оценка готовности web UI: 80%.

Оценка готовности mobile web UI: 55-65%.

Почему не выше:

- есть mobile CSS, но нет свежего полного visual QA по iPhone/Android после последних правок;
- часть экранов имеет сложные таблицы и плотные блоки;
- mobile задача сейчас решена как responsive web, а не как приложение;
- нет PWA/native оболочки, push notifications и offline/degraded UX.

### 3.4 Mobile application layer

Сейчас не начат как отдельный слой.

В репозитории нет:

- Capacitor;
- React Native / Expo;
- PWA manifest;
- service worker;
- push notification pipeline;
- mobile app shell;
- app-store packaging.

Оценка готовности native/mobile-app слоя: 0-10%.

Оценка готовности к старту mobile-app работ: 45-55%.

---

## 4. Что мешает сразу идти в мобильное приложение

### P0. Data contract еще не заморожен

Mobile client нельзя строить на плавающем JSON.

Нужно зафиксировать:

- `overview`;
- `portfolio`;
- `risk`;
- `signals`;
- `history`;
- `transactions`;
- `progress`;
- `investorDNA`;
- account-specific поля main/wife.

### P0. Stale/cache UX должен быть предсказуемым

На телефоне пользователь не будет отлаживать ошибку.

Если данные устарели, приложение должно ясно сказать:

- live;
- обновляется;
- stale;
- cache;
- ошибка upstream;
- когда было последнее успешное обновление.

### P1. Mobile critical flows не зафиксированы

Для мобильного приложения главный экран не должен быть мини-версией desktop.

Минимальные mobile flows:

1. Открыл приложение -> понял состояние портфеля.
2. Увидел главный риск.
3. Понял, можно ли добавлять риск.
4. Увидел свободную маржу / фьючерсный лимит.
5. Получил alert, открыл экран, понял действие.
6. Проверил сделку перед покупкой.
7. Посмотрел портфель без горизонтального хаоса.

### P1. Push alerts еще не продуктовый слой

Telegram alerts уже есть, но mobile app требует другой слой:

- push notifications;
- deep link в нужный экран;
- silent/degraded state;
- дедупликация;
- настройки уведомлений;
- дисциплинарные паузы.

---

## 5. Рекомендуемая дорожная карта от текущего состояния к mobile app

### Этап 0. Зафиксировать текущий web production

Цель:
не тащить старые хвосты в mobile.

Сделать:

1. Разобрать текущие незакоммиченные frontend изменения.
2. Отделить готовые UI-фиксы от экспериментов.
3. Довести `main` до понятной чистой точки.
4. Проверить production после GitHub/Vercel.

Критерий готовности:

- `git status --short` чистый или намеренно содержит только известную рабочую ветку;
- build/lint/test проходят;
- main/wife API live;
- Google Sheets совпадает с сайтом.

### Этап 1. Contract Freeze для мобильного клиента

Цель:
mobile app должен читать стабильный контракт.

Сделать:

1. Снять live JSON main.
2. Снять live JSON wife.
3. Описать required/optional поля.
4. Добавить contract tests.
5. Нормализовать пустые `signals`, `history`, `transactions`, `investorDNA`.
6. Зафиксировать версию API contract.

Критерий готовности:

- мобильный клиент может открыть пустой/частичный payload без падения;
- main/wife не смешиваются;
- stale/cache состояние типизировано.

### Этап 2. Mobile Web QA вместо новых фич

Цель:
сначала доказать, что текущий web работает с телефона.

Проверить:

- iPhone SE / 390px;
- iPhone 14/15 width;
- Android 360px;
- tablet 768px;
- Safari iOS;
- Chrome Android.

Обязательные экраны:

- Overview;
- Portfolio;
- Health;
- Risk;
- Reports;
- Signals;
- Gate;
- Settings/account switch.

Критерий готовности:

- нет горизонтального overflow на корне;
- таблицы читаемы;
- модалки открываются в зоне внимания;
- нижняя навигация не перекрывает ключевые действия;
- health hexagon и круги читаемы;
- кнопки нажимаются пальцем;
- long text не ломает карточки.

### Этап 3. Mobile-first Home

Цель:
не переносить весь desktop на телефон, а сделать главный мобильный экран.

Первый экран мобильного приложения должен отвечать:

1. Портфель живой или устарел?
2. Сегодня все в норме или есть блокировка?
3. Главный риск какой?
4. Можно добавлять риск или нет?
5. Что одно главное действие сейчас?

Это должен быть не dashboard, а risk command card.

### Этап 4. PWA shell

Цель:
получить поведение приложения без App Store.

Сделать:

- `manifest.webmanifest`;
- app icons;
- installable web app;
- safe-area handling;
- offline/degraded screen;
- last-known-good cache;
- clear update state.

Критерий готовности:

- приложение можно поставить на Home Screen;
- оно открывается как standalone;
- без сети показывает последнее состояние и предупреждение, что это не live.

### Этап 5. Native wrapper / Capacitor

Только после этапов 1-4.

Сделать:

- Capacitor iOS/Android shell;
- deep links;
- push notifications;
- biometric/local lock при необходимости;
- release pipeline.

Критерий готовности:

- web core не ломается;
- mobile shell не становится вторым продуктом;
- Google Sheets/API остается source of truth.

---

## 6. Новая оценка готовности

| Блок | Оценка |
| --- | ---: |
| Product concept | 90% |
| Web MVP | 80-85% |
| Live data path | 75% |
| Main/wife separation | 80% |
| Accounting source of truth | 75% |
| Risk/Health model | 70% |
| Decision layer | 45-55% |
| Alerts | 45-55% |
| Reports/history | 55-60% |
| Mobile web readiness | 55-65% |
| PWA readiness | 10-15% |
| Native app readiness | 0-10% |

Итог:

```text
Для web: late MVP / stabilization.
Для mobile: preparation stage, not implementation stage.
```

---

## 7. Следующая правильная точка

Не начинать сразу Capacitor / iOS / Android.

Следующая точка:

```text
Mobile Readiness Sprint 0:
API contract freeze + mobile critical-flow audit.
```

Порядок:

1. Закрыть хвосты dirty worktree.
2. Зафиксировать current production baseline.
3. Снять main/wife JSON contract.
4. Сделать mobile visual audit по 8 ключевым экранам.
5. Составить список P0 mobile blockers.
6. Только потом выбирать PWA или Capacitor.

Главный принцип:

```text
Сначала надежный телефонный web-app.
Потом installable PWA.
Потом native wrapper.
```

Так мы не построим мобильное приложение поверх плавающих данных и нестабильного UX.
