# MOBILE_AUDIT_2026-07-16

Read-only статический аудит мобильной готовности `src/v2` для iPhone 390px.

Проверялись только механические риски overflow/overlap:
- `src/v2/styles/*.css` по rg-паттернам: `width: [4-9][0-9][0-9]px|width: [0-9]{4,}px`, `margin-left: [1-9][0-9]{2,}px`, `grid-template-columns:.*[0-9]{3,}px`, `white-space: nowrap`, `position: absolute`, `flex: 1;|flex: 1 `, `min-width: [1-9][0-9]{2,}px`;
- для найденных CSS-правил проверялся мобильный оверрайд селектора в `src/v2/styles/v2-mobile.css` или `@media (max-width...)` других CSS;
- `src/v2/components/*.tsx` проверялись на inline `style={{ width/left/marginLeft }}` и длинные тексты в бейджах/чипах/заголовках.

Код, стили, таблица и данные не менялись.

## Сводка

| Метрика | Результат |
|---|---:|
| Явные fixed inline `px` в `style={{ width/left/marginLeft }}` | 0 |
| Фиксированные CSS-смещения `margin-left >= 100px` вне `@media` | 2, оба с мобильным оверрайдом |
| Фиксированные CSS-ширины `width >= 400px` вне `@media` | 3, все с мобильным оверрайдом или `max-width` без fixed width |
| Фиксированные grid-колонки `>=100px` вне `@media` | найдены, ключевые кандидаты ниже |
| Подтвержденный высокий риск по критерию `>360px без оверрайда` | 0 |

## Таблица находок

| Файл:строка | Селектор/элемент | Паттерн риска | Есть мобильный оверрайд (да/нет, где) | Риск |
|---|---|---|---|---|
| `src/v2/styles/v2-portfolio.css:520` | `.v2-stake-toggle` | `width: 850px` + `margin: ... 336px` | да, `src/v2/styles/v2-mobile.css:356` (`width:auto`, `max-width:100%`, `margin-left:0`) | средний |
| `src/v2/styles/v2-portfolio.css:576` | `.v2-stake-card` | `width: 850px` + `margin: ... 336px` | да, `src/v2/styles/v2-mobile.css:429` (`width:auto`, `max-width:100%`, `margin-left:0`) | средний |
| `src/v2/styles/v2-portfolio.css:47` | `.v2-pline` | `grid-template-columns: 320px minmax(0, 1fr)` | да, `src/v2/styles/v2-btc-chart.css:2972` (`grid-template-columns: 1fr`) | средний |
| `src/v2/styles/v2-risk-cards.css:114` | `.v2-re-body` | `grid-template-columns: 1fr 380px` | да, `src/v2/styles/v2-risk-cards.css:600`, `src/v2/styles/v2-mobile.css:261` | средний |
| `src/v2/styles/v2-overview.css:781` | `.v2-hc-layout` | `grid-template-columns: minmax(300px, ...) ... minmax(300px, ...)` | да, `src/v2/styles/v2-mobile.css:113` | средний |
| `src/v2/styles/v2-btc-chart.css:3815` | `.v2-hp-top` | `grid-template-columns: 280px 1fr 1fr` | да, `src/v2/styles/v2-mobile.css:244` | средний |
| `src/v2/styles/v2-btc-chart.css:3958` | `.v2-hp-brow` | `grid-template-columns: 200px 1fr 52px 36px` | да, `src/v2/styles/v2-mobile.css:249` и `src/v2/styles/v2-mobile.css:387` | средний |
| `src/v2/styles/v2-feargreed.css:257` | `.v2-fg-history-row` | `grid-template-columns: 110px 54px minmax(140px, 1fr) 110px` | да, `src/v2/styles/v2-feargreed.css:284` | средний |
| `src/v2/styles/v2-feargreed.css:1388` | `.v2-donut-row` | `grid-template-columns: 180px 1fr` | да, `src/v2/styles/v2-feargreed.css:2034` | средний |
| `src/v2/styles/v2-feargreed.css:1648` | `.v2-ticker` | `grid-template-columns: 140px repeat(6, 1fr)` | да, `src/v2/styles/v2-feargreed.css:2034` | средний |
| `src/v2/styles/v2-btc-chart.css:670` | `.v2-rep-table-head` | 9 grid-колонок с fixed px (`160px 130px 80px ... 90px 110px`) | нет точного оверрайда строки таблицы; есть общий mobile рост страницы `src/v2/styles/v2-mobile.css:276` | средний |
| `src/v2/styles/v2-btc-chart.css:700` | `.v2-rep-row` | 9 grid-колонок с fixed px (`160px 130px 80px ... 90px 110px`) | нет точного оверрайда строки таблицы; есть общий mobile рост страницы `src/v2/styles/v2-mobile.css:276` | средний |
| `src/v2/styles/v2-btc-chart.css:719` | `.v2-rep-transaction-table .v2-rep-table-head, .v2-rep-transaction-table .v2-rep-row` | 10 grid-колонок с fixed px (`150px 80px 120px ... 110px`) | нет точного оверрайда строки таблицы; есть общий mobile рост страницы `src/v2/styles/v2-mobile.css:276` | средний |
| `src/v2/styles/v2-btc-chart.css:2328` | `.v2-im-stat` | `grid-template-columns: 18px 130px 1fr 32px` | нет точного оверрайда найдено | низкий |
| `src/v2/styles/v2-btc-chart.css:3251` | `.v2-metrics-left` | `grid-template-columns: repeat(2, minmax(150px, 249px))` | да, `src/v2/styles/v2-btc-chart.css:2741` | средний |
| `src/v2/styles/v2-overview.css:194` | `.v2-top-grid` | `grid-template-columns: minmax(0, 1fr) min(400px, 28%)` | да, `src/v2/styles/v2-btc-chart.css:2837` | средний |
| `src/v2/styles/v2-overview.css:378` | `.v2-health-merged-body` | `grid-template-columns: 1fr 300px` | да, `src/v2/styles/v2-mobile.css:76` | средний |
| `src/v2/styles/v2-overview.css:454` | `.v2-bar-row` | `grid-template-columns: 116px 1fr 42px` | да, `src/v2/styles/v2-feargreed.css:2077` | низкий |
| `src/v2/styles/v2-alloc-card.css:242` | `.v2-pac-svg` | `width: 432px` | да, `src/v2/styles/v2-alloc-card.css:473` (`width: min(432px, 78vw)`) | средний |
| `src/v2/styles/v2-btc-chart.css:2153` | `.v2-im-panel` | `width: 540px` | да, `src/v2/styles/v2-mobile.css:160` | средний |
| `src/v2/styles/v2-base.css:54` | `.v2-lab` | `width: 1920px` | да, `src/v2/styles/v2-btc-chart.css:2563` (`width:100%`, `zoom:1`) | средний |
| `src/v2/styles/v2-base.css:60` | `.v2-lab` | `grid-template-columns: 260px 1fr` | да, `src/v2/styles/v2-btc-chart.css:2563` (`grid-template-columns:1fr`) | средний |
| `src/v2/styles/v2-btc-chart.css:3398` | `.v2-capital-dropdown-inner` | rg-срабатывание на `max-width: 528px` | нет; это `max-width`, не fixed `width` | низкий |
| `src/v2/styles/v2-overview.css:1358` | `.v2-hdm-card` | rg-срабатывание на `max-width: 520px` | нет; это `max-width`, не fixed `width` | низкий |
| `src/v2/styles/v2-portfolio.css:27` | `.v2-port-table` | rg-срабатывание на `max-width: 1460px` | да, `src/v2/styles/v2-btc-chart.css:2968` (`padding: 4px 0`) | низкий |
| `src/v2/styles/v2-btc-chart.css:1143` | `.v2-alert-card` | `flex: 1 1 0` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-btc-chart.css:1144` | `.v2-alert-card` | `min-width: 180px` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-feargreed.css:671` | `.v2-dca-zone-title` | `white-space: nowrap` | да, `src/v2/styles/v2-mobile.css:402` (`.v2-dca-zone` wrap, `.v2-dca-zone-info` flex override) | низкий |
| `src/v2/styles/v2-feargreed.css:724` | `.v2-dca-zone-status` | `white-space: nowrap; width: 96px` | да, `src/v2/styles/v2-mobile.css:402` для строки зоны | низкий |
| `src/v2/styles/v2-overview.css:643` | `.v2-hc-chip-name` | `white-space: nowrap` | нет точного CSS-оверрайда найдено; SVG/health layout масштабируется в `src/v2/styles/v2-mobile.css:113` | средний |
| `src/v2/styles/v2-overview.css:1210` | `.v2-hc-detail-btn` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-portfolio.css:259` | `.v2-port-cat-name` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-portfolio.css:803` | `.v2-pid-staked` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-auth.css:104` | `.v2-auth-account-name` | `white-space: nowrap` + ellipsis | нет точного оверрайда найдено | низкий |
| `src/v2/styles/v2-auth.css:111` | `.v2-auth-account-email` | `white-space: nowrap` + ellipsis | нет точного оверрайдa найдено | низкий |
| `src/v2/styles/v2-sidebar.css:49` | `.v2-brand-title` | `white-space: nowrap` | мобильный sidebar заменяется шторкой/header, `src/v2/styles/v2-mobile.css:10` | низкий |
| `src/v2/styles/v2-sidebar.css:58` | `.v2-brand-subtitle` | `white-space: nowrap` | мобильный sidebar заменяется шторкой/header, `src/v2/styles/v2-mobile.css:10` | низкий |
| `src/v2/styles/v2-btc-chart.css:872` | `.v2-rep-apy-badge` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-btc-chart.css:1290` | `.v2-psy-stance` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-btc-chart.css:1509` | `.v2-sig-rule-name` | `white-space: nowrap` | нет точного оверрайда найдено | средний |
| `src/v2/styles/v2-btc-chart.css:4171` | `.v2-hp-sim-eff-lab` | `white-space: nowrap` внутри flex item | да, `src/v2/styles/v2-mobile.css:420` переводит effects в одну колонку | низкий |
| `src/v2/components/V2Sidebar.tsx:151` | inline `img` avatar | `style={{ width: "100%", height: "100%" }}` | n/a: не fixed px | низкий |
| `src/v2/components/V2HealthCore.tsx:69` | inline marker | `left: ${...}%` | n/a: процент, не fixed px | низкий |
| `src/v2/components/V2RiskEnginePage.tsx:150` | inline limit marker | `left: ${rule.limit * 100}%` | n/a: процент, не fixed px | низкий |
| `src/v2/components/V2SignalsPage.tsx:247` | inline F&G marker | `left: ${currentFG}%` | n/a: процент, не fixed px | низкий |
| `src/v2/components/V2HealthPage.tsx:407` | `.v2-hp-card-title` | длинный заголовок `Health Breakdown — из чего складывается оценка` | частично, `src/v2/styles/v2-mobile.css:384` перестраивает breakdown rows | средний |
| `src/v2/components/V2PortfolioPage.tsx:261` | `.v2-port-realized-label` | длинная подпись `Реализовано за всё время` | нет точного оверрайда найдено | средний |
| `src/v2/components/V2HealthPage.tsx:427` | `.v2-hp-sim-note` | длинный текст в модалке симулятора | да, фон/компоновка симулятора `src/v2/styles/v2-mobile.css:375` и one-column effects `src/v2/styles/v2-mobile.css:420` | низкий |
| `src/v2/components/V2StakingCard.tsx:106` | `.v2-stake-chart-title` | длинный title `Курс tsTON → GRAM · рост награды` | есть mobile stake overrides для card/toggle, точного title override не найдено | низкий |
| `src/v2/components/V2CosmosStakingCard.tsx:45` | `.v2-stake-chart-title` | длинный title `Накопление награды · проекция 30 дней` | есть mobile stake overrides для card/toggle, точного title override не найдено | низкий |

## Низкорисковые rg-срабатывания

Многочисленные `position: absolute` в декоративных псевдоэлементах, SVG/HUD-слоях, needle/marker/bar-fill элементах и screen-reader helper (`.v2-sr-only`) не имеют самостоятельной fixed ширины/смещения `>360px`. Они отмечены как низкий риск, если не связаны с fixed grid/width/nowrap в таблице выше.

Примеры низкого риска:
- `src/v2/styles/v2-alloc-card.css:35`, `:47`, `:86` — декоративные псевдоэлементы карточки;
- `src/v2/styles/v2-feargreed.css:324`, `:347`, `:372`, `:384`, `:403`, `:416`, `:431` — gauge/needle layers;
- `src/v2/styles/v2-overview.css:1539`, `:1550`, `:1563`, `:1583`, `:1612`, `:1627`, `:1686`, `:1701` — health-stage/reactor/HUD layers;
- `src/v2/styles/v2-btc-chart.css:1723`, `:1734`, `:1910`, `:2084`, `:3464`, `:3475`, `:3492`, `:3527`, `:3698` — BTC/chart/portfolio decorative layers.

## Топ-10 кандидатов на проверку вживую

1. `src/v2/styles/v2-btc-chart.css:719` — transaction table: на 390px может быть горизонтальный overflow или клип строк, если нет отдельного мобильного table layout.
2. `src/v2/styles/v2-btc-chart.css:670` — reports table header: может не совпасть с шириной body и уехать вправо.
3. `src/v2/styles/v2-btc-chart.css:700` — reports table row: может появиться горизонтальная прокрутка внутри карточки или обрезание крайних колонок.
4. `src/v2/styles/v2-portfolio.css:520` — staking toggle: если `v2-mobile.css` не применится последним, `width:850px + margin 336px` выталкивает плашку за экран.
5. `src/v2/styles/v2-portfolio.css:576` — staking card: если мобильный override не применится, раскрытая карточка уедет вправо.
6. `src/v2/styles/v2-overview.css:781` — health core 3-column layout: без override боковые колонки по 300px дадут overflow.
7. `src/v2/styles/v2-btc-chart.css:3958` — health breakdown row: без `v2-mobile.css:387` label/bar/score могут наложиться.
8. `src/v2/styles/v2-btc-chart.css:3815` — health top row: 280px + две колонки могут сжать diagnosis/prescription.
9. `src/v2/styles/v2-risk-cards.css:114` — risk body: правая колонка 380px может вытолкнуть контент на iPhone 390px без override.
10. `src/v2/components/V2PortfolioPage.tsx:261` — realized PnL label: длинная подпись может давить соседнее значение в компактной панели.
