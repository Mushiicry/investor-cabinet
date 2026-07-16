# Cleanup Candidates

Дата аудита: 2026-07-14

Режим: read-only аудит. Код, Apps Script, API, конфиги и данные не менялись.

## Что проверял

- `git status --short --branch`
- `rg --files`
- статический import graph от `src/main.tsx`
- `rg` по импортам, ассетам, экспортам, dependency names и устаревшим словам в docs
- `git ls-files` для проверки tracked docs/export artifacts

Ограничение: статический граф может не видеть динамические импорты, строки URL и будущие planned-компоненты. Поэтому у каждого кандидата указан риск удаления.

## 1. Неиспользуемые файлы

| Путь | Доказательство | Уверенность | Риск удаления |
|---|---|---:|---:|
| `src/assets/react.svg` | В статическом import graph отсутствует. `rg "react\.svg"` по репозиторию без `node_modules/dist` не нашёл source-ссылок. | высокая | низкий |
| `src/assets/vite.svg` | В статическом import graph отсутствует. `rg "vite\.svg"` не нашёл source-ссылок. | высокая | низкий |
| `src/assets/hero.png` | В статическом import graph отсутствует. `rg "hero\.png"` не нашёл source-ссылок. | высокая | низкий |
| `src/assets/fear-greed/gauge-bg.webp` | В статическом import graph отсутствует. `rg "gauge-bg\.webp"` нашёл только `docs/PATCH_LOG.md`, не runtime import. | средняя | средний |
| `src/assets/hologram/allocation-portal.webp` | В статическом import graph отсутствует. `rg "allocation-portal\.webp"` нашёл только `docs/PATCH_LOG.md`. | средняя | средний |
| `src/assets/backgrounds/cosmic-dashboard-bg.png` | В статическом import graph отсутствует. Source-ссылок через `rg "cosmic-dashboard-bg"` не найдено. | средняя | средний |
| `src/assets/health/ChatGPT Image 24 мая 2026 г., 20_54_33.webp` | В статическом import graph отсутствует. Source-ссылок через `rg "20_54_33|ChatGPT Image 24 мая"` не найдено. | средняя | средний |
| `src/assets/health/health-shield.webp` | В статическом import graph отсутствует. Source-ссылок через `rg "health-shield"` не найдено. | средняя | средний |
| `src/assets/health/v2-portfolio-health-reactor.webp` | В статическом import graph отсутствует. Source-ссылок через `rg "v2-portfolio-health-reactor"` не найдено. | средняя | средний |
| `src/data/portfolio.ts` | В статическом import graph отсутствует. `rg "src/data/portfolio|../data/portfolio|./data/portfolio"` нашёл только упоминания в docs. | высокая | средний |
| `src/hooks/useLivePrices.ts` | В статическом import graph отсутствует. `rg "useLivePrices"` нашёл только сам export. | высокая | средний |
| `src/lib/formatters.ts` | В статическом import graph отсутствует. Экспорты `currency`, `percent`, `percentDirect` не найдены как imports. | высокая | низкий-средний |
| `src/lib/moodData.ts` | В статическом import graph отсутствует. `rg "getMoodData"` нашёл только сам export. | высокая | низкий-средний |
| `src/lib/portfolioPresentation.ts` | В статическом import graph отсутствует. `rg "getPortfolioStatusBadgeClass|getPortfolioPnlClass"` нашёл только exports. | высокая | средний |
| `src/lib/riskPresentation.ts` | В статическом import graph отсутствует. `rg "buildRiskMarketBars|RISK_BAR_COLORS|RISK_BAR_LABELS"` нашёл только exports. | высокая | средний |
| `src/v2/components/V2Allocation3D.tsx` | В статическом import graph отсутствует. `rg "V2Allocation3D"` нашёл только сам export. | средняя | средний-высокий |
| `src/v2/components/V2AllocationRing.tsx` | В статическом import graph отсутствует. `rg "V2AllocationRing"` нашёл только сам export. | средняя | средний-высокий |
| `src/v2/components/V2DecisionsPage.tsx` | В статическом import graph отсутствует. `rg "V2DecisionsPage"` нашёл только сам export. | средняя | средний-высокий |
| `src/v2/components/V2FearGreed.tsx` | В статическом import graph отсутствует. Импортов компонента не найдено. | средняя | средний-высокий |
| `src/v2/components/V2FearGreedStrategy.tsx` | В статическом import graph отсутствует. `rg "V2FearGreedStrategy"` нашёл только сам export. | средняя | средний-высокий |
| `src/v2/components/V2MarketMood.tsx` | В статическом import graph отсутствует. Импортов компонента не найдено. | средняя | средний-высокий |
| `src/v2/components/V2MarketPsychology.tsx` | В статическом import graph отсутствует. `rg "V2MarketPsychology"` нашёл только сам export. | средняя | средний-высокий |
| `src/v2/components/V2PortfolioHealth.tsx` | В статическом import graph отсутствует. Импортов компонента не найдено. | средняя | средний-высокий |
| `src/v2/components/V2RiskSignals.tsx` | В статическом import graph отсутствует. Импортов компонента не найдено. | средняя | средний-высокий |
| `src/v2/components/V2TopPositions.tsx` | В статическом import graph отсутствует. `rg "V2TopPositions"` нашёл только сам export. | средняя | средний-высокий |
| `public/portfolio-health.pdf` | `rg "portfolio-health\.pdf"` не нашёл runtime/source-ссылок. | высокая | низкий-средний |
| `public/icons.svg` | `rg "icons\.svg"` не нашёл runtime/source-ссылок. | высокая | низкий-средний |
| `WIFE_APPS_SCRIPT.js` | `rg "WIFE_APPS_SCRIPT"` нашёл только old audit docs. Основная Apps Script зона сейчас в `apps-script/`. | средняя | высокий |
| `SETUP_WIFE_SHEETS.gs` | `rg "SETUP_WIFE_SHEETS"` нашёл только self/header. Похоже на одноразовый setup script. | средняя | средний-высокий |

## 2. Дубли кода

| Путь | Доказательство | Уверенность | Риск удаления |
|---|---|---:|---:|
| `src/v2/components/V2RiskEnginePage.tsx`, `src/v2/components/V2HealthDetailModal.tsx`, `src/v2/components/V2HealthPage.tsx` | `rg "function scoreColor"` нашёл три локальные реализации `scoreColor`. Названия и назначение совпадают, пороги могут отличаться. | высокая | средний |
| `src/v2/components/V2DCAStrategy.tsx`, `src/v2/components/V2FearGreedStrategy.tsx`, `src/lib/formatters.ts` | `rg "function formatMoney|formatMoneyDetailed|currency"` показывает несколько локальных money-format helpers плюс отдельный неиспользуемый `src/lib/formatters.ts`. | средняя | средний |
| `src/lib/portfolioHealth.ts`, `src/v2/components/V2HealthPage.tsx` | `rg "clamp01|clampUnit"` показывает одинаковый clamp-паттерн `Math.max(0, Math.min(1, value))`. | средняя | низкий-средний |

## 3. Мёртвые экспорты и зависимости

| Путь | Доказательство | Уверенность | Риск удаления |
|---|---|---:|---:|
| `package.json` -> `react-gauge-component` | `rg "react-gauge-component"` нашёл dependency и `docs/PATCH_LOG.md`, но не source import. Patch log говорит, что старый gauge был заменён на WebP background. | высокая | низкий-средний |
| `package.json` -> `echarts` | `rg "from ['\"]echarts|import\(['\"]echarts|echarts"` не нашёл source imports, кроме dependency name. | высокая | средний |
| `package.json` -> `echarts-for-react` | `rg "echarts-for-react"` не нашёл source imports, кроме dependency name. | высокая | средний |
| `src/data/portfolio.ts` exports | Экспорты `TEST_LOGIN`, `TEST_PASSWORD`, `rawPositions`, `decisions`, `scenarios` не попали в import graph и не найдены как source imports. | высокая | средний |
| `src/lib/formatters.ts` exports | Экспорты `currency`, `percent`, `percentDirect` не найдены как source imports. | высокая | низкий-средний |
| `src/lib/moodData.ts` export | `getMoodData` найден только в собственном файле. | высокая | низкий-средний |
| `src/lib/portfolioPresentation.ts` exports | `getPortfolioStatusBadgeClass`, `getPortfolioPnlClass` найдены только в собственном файле. | высокая | средний |
| `src/lib/riskPresentation.ts` exports | `RISK_BAR_COLORS`, `RISK_BAR_LABELS`, `buildRiskMarketBars` найдены только в собственном файле. | высокая | средний |

## 4. Устаревшие docs и архивные материалы

| Путь | Доказательство | Уверенность | Риск удаления |
|---|---|---:|---:|
| `docs/PROJECT_AUDIT_2026-07-10.md` | Сам документ содержит пометку, что документация местами устарела и упоминает `App.tsx`, хотя фактический entrypoint V2. | высокая | низкий-средний |
| `docs/TECHNICAL_ROADMAP.md` | `rg "hardening"` показывает старые roadmap-пункты про hardening/refresh, тогда как текущий `docs/HANDOFF.md` явно запрещает speculative hardening и shared-secret guard. | средняя | средний |
| `docs/INVESTOR_CABINET_ROADMAP.md` | Документ сам содержит формулировку, что некоторые API-поля могут быть устаревшими или неоднозначными. | средняя | средний |
| `docs/notion/**` | `git ls-files` показывает Notion export bundle. Похоже на импортированный архив, не runtime docs. | средняя | низкий-средний |
| `docs/sheets_exports/*.csv` | `git ls-files` показывает CSV exports. Это snapshots, не runtime source. Удалять только если есть новая canonical копия или архивная политика. | средняя | средний |
| `MushiiInvest/**` | `git ls-files` показывает старый экспорт с markdown/CSV/PNG. Похоже на исторический архив вне текущего приложения. | средняя | средний |
| `docs/vision/OADMAP.md` | Путь выглядит как опечатка `ROADMAP.md`. Нужно проверить, является ли файл актуальным или потерянным legacy-документом. | низкая | низкий-средний |

## Не кандидаты по текущему аудиту

| Путь | Почему оставить |
|---|---|
| `public/bg-space.png` | Используется в `src/v2/components/V2Shell.tsx` через `backgroundImage: 'url("/bg-space.png")'`. |
| `src/mocks/portfolioData.ts` | Используется в `src/v2/InvestorCabinetV2Lab.tsx` и `src/v2/lib/v2LabData.ts`. |
| `src/api/investor.ts`, `src/api/fearGreed.ts`, `src/api/prices.ts` | Используются hooks-слоем. Также API-зона вне этой cleanup-задачи. |
| `docs/HANDOFF.md` | Текущая координационная доска и источник правил зон ответственности. |
| `docs/CODEX_TRACKER_2026-07-11.md` | Текущий tracker фиксирует закрытый incident и актуальные запреты. |
| `docs/SECURITY_BASELINE.md` | Текущий baseline после отмены Apps Script guard. |
| `.DS_Store` | `git ls-files '*DS_Store'` не нашёл tracked `.DS_Store`. |

## Рекомендованный порядок для Claude

1. Сначала чистить низкий риск: starter assets, unused public files, явно мёртвые deps.
2. Потом проверить и удалить legacy libs/hooks, если TypeScript/build/test зелёные.
3. V2-компоненты удалять только после ручной проверки маршрутов/вкладок и planned UI.
4. Root Apps Script файлы и архивы удалять только отдельным PR с явным решением, потому что риск не в build, а в операционной истории.
