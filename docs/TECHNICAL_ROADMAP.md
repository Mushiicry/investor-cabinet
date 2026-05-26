# INVESTOR CABINET - TECHNICAL ROADMAP

Version: MVP Core Stabilization Roadmap  
Status: Active Development  
Current stage: Functional Premium MVP -> Stabilization + Risk Core Completion  
Last updated: 2026-05-26

---

# 0. Product Definition

Investor Cabinet is an investor operating system.

It is not a trading casino, not a meme-trader dashboard, and not an aggressive leverage terminal.

The product exists to help the investor:

- control portfolio structure;
- control risk before chasing PnL;
- manage reserve and deployable capital;
- understand spot and futures exposure;
- maintain emotional discipline;
- analyze market cycles;
- convert portfolio data into clear decisions;
- build a long-term capital management system.

Core product principle:

Risk layer is more important than PnL layer.

Every future patch must preserve:

- clarity;
- emotional stability;
- premium institutional look;
- risk-first logic;
- survivability;
- maintainability;
- future migration path.

---

# 1. Current Project Status

Current state:

Functional Premium MVP on the transition into Stabilization + Risk Core Completion.

This means:

- the product already works as a real dashboard;
- it already has live portfolio data;
- the UI already has a premium terminal direction;
- the data architecture exists but needs hardening;
- the risk engine exists but is not complete enough yet;
- the frontend architecture is functional but too monolithic;
- the next stage should not be a visual rewrite;
- the next stage should stabilize the core and strengthen risk logic.

Current milestone:

MVP Core Stabilized.

MVP Core Stabilized means:

- stable API contract;
- clean portfolio table;
- unified calculation logic;
- modular frontend foundations;
- live risk engine;
- stable reserve and deployable cash logic;
- normalized status/category handling;
- reliable fallback states;
- production deploy from GitHub/Vercel.

---

# 2. Roadmap Summary

| Stage | Name | Status | Progress | Priority |
| --- | --- | --- | --- | --- |
| Stage 1 | Functional Premium MVP | Almost complete | 80-85% | Current foundation |
| Stage 2 | Stabilization + Risk Core Completion | Current stage | 45-55% | Highest |
| Stage 3 | Professional Dashboard / Analytics | Next major layer | 25-35% | High after stabilization |
| Stage 4 | Decision Engine | Early concept | 15-20% | Medium-high |
| Stage 5 | Automation + Smart Alerts | Partial | 40-50% | Medium |
| Stage 6 | Backend Migration | Future, not now | 0-5% | Later |
| Stage 7 | AI Assistant Layer | Concept only | 0-5% | Later |
| Stage 8 | Multiuser / SaaS | Future | 0-5% | Later |
| Stage 9 | Mobile App | Not started | 0% | Later |

Important correction:

Risk Engine Core is not a separate later stage. It is part of the current stabilization stage because risk-first logic is the main value of the product.

---

# 3. Stage 1 - Functional Premium MVP

Status:
Almost complete.

Progress:
80-85%.

Current stack:

- React;
- TypeScript;
- Vite;
- App.css;
- Google Sheets;
- Apps Script SITE API;
- Apps Script price update layer;
- Vercel deployment;
- local Vite proxy;
- Fear & Greed external API proxy.

Already implemented:

- premium dark dashboard UI;
- sidebar navigation;
- overview page;
- portfolio page;
- risk page;
- scenarios and decisions page;
- login screen with test credentials;
- live portfolio API fetch;
- portfolio overview cards;
- portfolio table;
- allocation chart;
- reserve tracking;
- futures tracking;
- spot/futures deployable capital split;
- health factor display;
- Fear & Greed widget with live value;
- buy ladder for market mood;
- Google Sheets data source;
- Apps Script JSON backend;
- Vercel rewrite for `/api/investor`;
- Vercel rewrite for `/api/fear-greed`;
- fallback state for frontend safety.

Remaining MVP cleanup:

- finish table readability and row styling;
- ensure status colors are consistent;
- normalize stable rows visually;
- confirm production deployment after current patch set;
- preserve the current visual geometry.

Definition of done for Stage 1:

- production site reflects current local behavior;
- portfolio table is clean and readable;
- overview data is correct;
- Fear & Greed is live;
- build and lint pass;
- current changes are committed and deployed.

---

# 4. Stage 2 - Stabilization + Risk Core Completion

Status:
Current main stage.

Progress:
45-55%.

Goal:
Make the MVP stable enough to become the foundation for future analytics, decision systems, AI assistant, backend migration, and SaaS architecture.

This stage must not become a visual-only polishing loop.

Main principle:

Every stabilization patch must either:

- reduce data risk;
- reduce calculation duplication;
- strengthen risk logic;
- make frontend architecture safer;
- improve maintainability;
- preserve UI geometry.

## 4.1 Data Contract Stabilization

Status:
In progress.

Progress:
55%.

Goal:
Create a stable JSON contract between Google Sheets, Apps Script, and frontend.

Already present:

- `/api/investor`;
- root JSON sections: `overview`, `portfolio`, `risk`, `decisions`, `scenarios`;
- documentation in `docs/sheets/API_CONTRACT.md`;
- frontend normalizers in hooks;
- safe fallback state.

Needed:

- freeze all field names;
- document optional vs required fields;
- document units: percent as `82.6` vs `0.826`;
- document money fields as numbers only;
- document status values;
- document category values;
- define how closed positions are represented;
- define where `USDC HL` belongs;
- define `deployableCash`, `futuresDeployableCash`, `spotDeployableCash`;
- remove ambiguous API values like stale `overview.bestPosition` when possible;
- create validation layer for incoming JSON.

Risk:

If API contract stays loose, frontend will keep patching symptoms and calculations can desync.

## 4.2 API Layer Stabilization

Status:
In progress.

Progress:
65%.

Already present:

- fetch from `/api/investor`;
- fetch from `/api/fear-greed`;
- local Vite proxy;
- Vercel rewrites;
- refresh intervals;
- basic fallback behavior.

Needed:

- timeout logic;
- error state handling;
- loading states;
- invalid data protection;
- retry rules;
- API response validation;
- centralized API service folder;
- typed response interfaces;
- stable refresh synchronization;
- separate API errors from calculation errors.

Recommended future structure:

- `src/services/investorApi.ts`;
- `src/services/fearGreedApi.ts`;
- `src/services/apiValidation.ts`;
- `src/types/api.ts`.

## 4.3 State Management

Status:
Early in progress.

Progress:
40%.

Current state:

- `useInvestorData()` stores portfolio state;
- `useFearGreed()` stores market mood state;
- fallback state is still important;
- some derived values are calculated in hooks/frontend.

Needed:

- central portfolio state contract;
- shared derived data selectors;
- stable cache strategy;
- clear loading/error/ready states;
- fetch deduplication;
- avoid recalculating derived metrics in multiple places;
- separate raw API data from normalized UI data.

Do not add heavy state libraries yet unless needed.

## 4.4 Frontend Modularization

Status:
Needed.

Progress:
25-35%.

Current issue:

- `src/App.tsx` is too large;
- `src/App.css` is too large;
- pages, UI, calculations and normalizers are too close together.

Safe modularization plan:

1. Extract pure helpers first.
2. Extract small UI components.
3. Extract pages one by one.
4. Extract CSS by feature only after components are stable.

Recommended extraction order:

- `PortfolioTable`;
- `StatusBadge`;
- `OverviewPage`;
- `RiskPage`;
- `FearGreedGauge`;
- `HealthPanel`;
- `AllocationSection`;
- `formatters/status helpers`;
- `portfolio selectors`.

Forbidden:

- full rewrite of `App.tsx`;
- large CSS rewrite;
- changing page geometry while extracting;
- changing API naming during component extraction.

---

# 5. Risk Engine Core

Status:
Core development inside Stage 2.

Progress:
45%.

Goal:
Make Investor Cabinet a true risk-first system.

The risk engine is the main product value. It should not be postponed behind frontend cleanup.

## 5.1 Already Implemented

- reserve tracking;
- reserve share;
- deployable cash display;
- spot/futures deployable split;
- health factor;
- largest risk asset;
- category distribution;
- futures exposure display;
- visual risk indicators;
- portfolio health block;
- stable reserve logic;
- basic risk summary.

## 5.2 Exposure Engine

Status:
In progress.

Progress:
30%.

Needed:

- crypto exposure;
- futures exposure;
- stable reserve ratio;
- leverage pressure;
- correlated asset risk;
- concentration risk;
- max category limits;
- max single-asset limits;
- spot vs futures distinction;
- reserve after planned deployment.

Key output examples:

- "Futures exposure is low";
- "ETH is the largest risk asset";
- "Reserve is above target";
- "Spot deployable capital available without breaking structure";
- "Do not increase futures block".

## 5.3 Position Sizing System

Status:
Early.

Progress:
25%.

Needed:

- risk per position;
- target position size;
- max position size;
- add size guidance;
- accumulation ladder;
- overexposure warnings;
- category-specific position limits;
- reserve-aware buy sizing;
- futures margin discipline.

Important:

Position sizing must be conservative and discipline-oriented.

## 5.4 Drawdown System

Status:
Not yet built.

Progress:
15%.

Needed:

- max drawdown;
- rolling drawdown;
- portfolio stress test;
- volatility tracking;
- drawdown by category;
- drawdown by asset;
- drawdown impact on future deployment.

## 5.5 Cycle Model

Status:
Concept.

Progress:
20%.

Needed:

- halving cycle integration;
- Fear & Greed weighting;
- market phase model;
- accumulation/distribution phase logic;
- macro overlay;
- risk-on/risk-off mode;
- cycle-based deployment limits.

---

# 6. Google Sheets System

Status:
In progress.

Progress:
75%.

Role:
Current source of truth.

Already implemented:

- portfolio sheets;
- overview calculations;
- risk calculations;
- category allocations;
- transactions;
- history sheets;
- prices;
- futures sheet;
- decisions;
- scenarios;
- Apps Script exports;
- Telegram reporting;
- live formulas.

## 6.1 Sheet Structure Normalization

Status:
In progress.

Progress:
60%.

Needed:

- stable naming convention;
- fixed ranges;
- protected formula zones;
- stable sheet structure docs;
- protected API output area;
- clear manual input zones;
- clear formula output zones;
- migration-safe column names.

Do not:

- change sheet structure without dependency check;
- rename keys without frontend API check;
- change formulas without understanding dependencies.

## 6.2 Formula Engine

Status:
In progress.

Progress:
70%.

Already present:

- PnL calculations;
- current value;
- weighted averages;
- reserve calculations;
- category calculations;
- exposure calculations;
- health score basics.

Needed:

- remove formula duplication;
- document every core formula;
- ensure Apps Script and frontend do not reimplement different logic;
- define source of truth for each metric;
- add risk coefficients;
- add future snapshot formulas.

## 6.3 Automation Layer

Status:
Partial.

Progress:
40-50%.

Already present:

- price refresh concepts;
- Apps Script update layer;
- Telegram reports;
- scheduled messaging foundation.

Needed:

- scheduled refresh hardening;
- auto recalculation confirmation;
- Telegram alerts;
- signal generation;
- portfolio snapshots;
- historical tracking;
- smart alert grouping;
- throttling.

---

# 7. UI / UX Terminal System

Status:
Active polish.

Progress:
65%.

Goal:
Maintain a serious premium investment terminal, not retail crypto aesthetics.

Already implemented:

- premium dark theme;
- sidebar glass shell;
- overview terminal cards;
- health panel;
- allocation hologram chart;
- premium Fear & Greed widget;
- portfolio table glass row styling;
- status badge system;
- responsive dashboard structure;
- live values in dashboard.

## 7.1 Design System

Status:
In progress.

Progress:
55%.

Needed:

- typography rules;
- spacing system;
- glow rules;
- color architecture;
- shadow architecture;
- card geometry rules;
- status color rules;
- table row rules;
- page layout rules.

Current design direction:

- dark;
- institutional;
- glass hardware;
- restrained neon;
- risk-first;
- premium terminal.

Avoid:

- casino feeling;
- over-neon;
- meme-trader UI;
- retail crypto visual overload;
- aggressive leverage UX.

## 7.2 Motion System

Status:
Early.

Progress:
20%.

Needed:

- restrained micro animations;
- hover dynamics;
- live transitions;
- loading animations;
- animated indicators;
- reduced-motion support.

Motion rule:

Animations should support focus and clarity, not hype.

## 7.3 Widget System

Status:
Early in progress.

Progress:
35%.

Needed:

- reusable cards;
- reusable metric tiles;
- reusable tables;
- reusable status badges;
- reusable gauges;
- reusable risk indicators;
- adaptive layouts.

---

# 8. Portfolio Analytics

Status:
In development.

Progress:
50%.

Already implemented:

- total value;
- invested;
- total PnL;
- PnL percent;
- category overview;
- best/worst positions;
- reserve metrics;
- allocation overview;
- basic portfolio table.

## 8.1 Advanced Analytics

Status:
Early.

Progress:
30%.

Needed:

- risk-adjusted returns;
- Sharpe-like metrics;
- allocation efficiency;
- performance attribution;
- capital efficiency;
- realized vs unrealized PnL;
- contribution by asset;
- contribution by category.

## 8.2 Historical System

Status:
Mostly not built.

Progress:
10%.

Needed:

- portfolio timeline;
- historical PnL;
- equity curve;
- portfolio snapshots;
- allocation history;
- portfolio replay;
- drawdown timeline.

---

# 9. Decision Engine

Status:
Early concept.

Progress:
15-20%.

Goal:
Convert portfolio state, market state, risk state and cycle state into clear human-readable decisions.

Important:

Decision Engine should guide the investor. It should not autonomously trade.

## 9.1 Decision Logic

Status:
Early.

Progress:
10%.

Needed:

- buy pressure signals;
- risk warnings;
- reserve recommendations;
- market overheating alerts;
- portfolio imbalance detection;
- futures discipline warnings;
- "do nothing" recommendations;
- priority system.

## 9.2 Scenario Analysis

Status:
Early.

Progress:
15%.

Needed:

- BTC scenario simulation;
- ETH dominance scenarios;
- recession model;
- black swan model;
- altseason simulation;
- portfolio stress under scenarios;
- reserve impact under scenarios.

## 9.3 Recommendation Layer

Status:
Early.

Progress:
10%.

Needed:

- actionable outputs;
- human-readable guidance;
- signal confidence;
- priority ranking;
- explanation of why;
- risk-first wording;
- no emotional trading triggers.

---

# 10. Telegram + Notifications

Status:
Partial ready.

Progress:
40-50%.

Already implemented:

- Telegram reports;
- integration with tables;
- scheduled messaging foundation.

## 10.1 Smart Alerts

Status:
Early.

Progress:
25%.

Needed:

- risk alerts;
- allocation alerts;
- emotional discipline alerts;
- reserve alerts;
- rebalance alerts;
- macro warnings;
- futures warnings;
- overexposure warnings.

## 10.2 Notification Engine

Status:
Early.

Progress:
20%.

Needed:

- priority system;
- throttling;
- smart timing;
- signal grouping;
- avoid alert fatigue;
- separate urgent vs informative alerts.

---

# 11. Backend Migration

Status:
Future.

Progress:
0-5%.

Current rule:

Do not start backend migration during current stabilization unless a specific blocker requires it.

Current source of truth:

Google Sheets.

Future migration path:

Google Sheets -> Backend API -> Database.

Potential stack:

- Supabase;
- PostgreSQL;
- Node backend;
- secure API layer;
- authentication;
- user accounts.

Migration reason:

Google Sheets will eventually become a bottleneck for:

- multi-user data;
- historical analytics;
- permissions;
- performance;
- secure auth;
- mobile sync.

Not now:

- multi-user backend;
- auth rewrite;
- database migration;
- subscriptions.

---

# 12. AI Assistant Layer

Status:
Concept only.

Progress:
0-5%.

AI role:

Assistant, analyst and risk coach.

AI must not be:

- autonomous trader;
- aggressive signal machine;
- leverage promoter;
- emotional hype generator.

Future AI features:

- portfolio analysis;
- emotional risk detection;
- overexposure warnings;
- panic detection;
- euphoria detection;
- smart scenario generation;
- allocation recommendations;
- cycle positioning;
- decision explanation.

Prerequisite:

Stable data layer and risk engine.

---

# 13. Multiuser / SaaS

Status:
Future.

Progress:
0-5%.

Potential future:

- user accounts;
- portfolio isolation;
- onboarding;
- subscription logic;
- family office mode;
- advisor mode;
- investor reports;
- premium analytics dashboard;
- capital management platform.

Not current priority.

---

# 14. Mobile App

Status:
Not started.

Progress:
0%.

Future platforms:

- iOS;
- Android.

Mobile priority:

Emotional monitoring and fast risk awareness.

Potential future features:

- push notifications;
- risk alerts;
- portfolio snapshots;
- market mood;
- weekly discipline report.

Not current priority.

---

# 15. Current Development Priorities

## Priority 1 - Stabilize Backend + Sheets + JSON Contract

Why:
All frontend and future analytics depend on stable data.

Tasks:

- freeze API schema;
- document fields;
- validate incoming data;
- normalize statuses;
- normalize categories;
- clarify percent units;
- clarify deployable cash logic;
- remove stale fields or handle them safely.

## Priority 2 - Complete Core Risk Engine

Why:
Risk-first logic is the main product advantage.

Tasks:

- exposure engine;
- reserve engine;
- deployable capital engine;
- futures pressure;
- position sizing;
- concentration warnings;
- drawdown foundation.

## Priority 3 - Finish Portfolio Table

Why:
Portfolio table is the most direct operating surface.

Tasks:

- stable row geometry;
- readable values;
- color rules;
- status badge rules;
- stable rows neutral PnL;
- live API correctness;
- table responsive safety.

## Priority 4 - Modularize Frontend Safely

Why:
Large `App.tsx` and `App.css` increase patch risk.

Tasks:

- extract components gradually;
- keep geometry stable;
- extract helpers first;
- avoid full rewrite;
- test after each patch.

## Priority 5 - Professional Analytics

Why:
After core stability, the product needs deeper investor intelligence.

Tasks:

- historical PnL;
- snapshots;
- allocation history;
- equity curve;
- risk-adjusted returns;
- attribution.

## Priority 6 - Decision Engine

Why:
The system should eventually tell the investor what matters now.

Tasks:

- recommendation logic;
- scenario logic;
- risk warnings;
- confidence logic;
- action priority.

---

# 16. Current Known Risk Areas

## 16.1 Duplicate Calculations

Risk:
High.

Current issue:
Some calculations exist in:

- Google Sheets;
- Apps Script;
- frontend hooks;
- fallback calculations.

Required direction:
Define one source of truth for each metric.

## 16.2 Monolithic App.tsx

Risk:
High.

Current issue:
UI, pages, state and some logic live too close together.

Required direction:
Safe modular extraction.

## 16.3 Monolithic App.css

Risk:
High.

Current issue:
Visual system is powerful but fragile.

Required direction:
Do not rewrite globally. Extract only after components become stable.

## 16.4 API Contract Ambiguity

Risk:
High.

Current issue:
Some API values can be stale or ambiguous, such as best/worst position or deployable cash.

Required direction:
Document, validate and normalize.

## 16.5 Emotional UX Drift

Risk:
Medium-high.

Current issue:
Too much color or motion can break the serious capital management feeling.

Required direction:
Keep calm, institutional and risk-first.

---

# 17. Definition Of MVP Core Stabilized

MVP Core Stabilized is complete when:

- production site is updated and stable;
- build passes;
- lint passes;
- API contract is documented;
- portfolio table is visually and logically stable;
- stable rows are neutral;
- status colors are meaningful;
- overview values are correct;
- best/worst positions ignore closed positions;
- Fear & Greed is live;
- spot/futures deployable cash is clear;
- core risk metrics are reliable;
- duplicate calculations are reduced or documented;
- frontend components can start being extracted safely.

---

# 18. Patch Discipline

Every patch must:

- be small;
- be isolated;
- preserve API naming;
- preserve Google Sheets bindings;
- preserve current UI geometry unless explicitly requested;
- preserve fallback state;
- run build after code changes;
- run lint when TypeScript or frontend code changes;
- document meaningful architecture changes.

Never:

- rewrite `App.tsx` fully without a specific reason;
- rewrite `App.css` globally;
- change sheet structure without dependency check;
- change formulas without understanding dependencies;
- remove fallback state blindly;
- make UI emotionally aggressive;
- prioritize PnL over risk.

---

# 19. Next Operational Sequence

After this roadmap is accepted:

1. Review current working tree.
2. Confirm current patch scope.
3. Run build and lint.
4. Stage current changes.
5. Commit current progress.
6. Push to GitHub.
7. Confirm Vercel production deploy.
8. Check official production site, not only localhost.
9. Move to next safe patch.

Recommended next patch after deployment:

Portfolio table final polish or API contract stabilization.

Decision should depend on what production review shows.

---

# 20. Final Current Formula

Investor Cabinet is currently:

Functional Premium MVP on the transition into Stabilization + Risk Core Completion.

The nearest milestone is:

MVP Core Stabilized.

The product direction is:

Premium Investor Terminal -> Professional Dashboard -> Risk/Decision Engine -> AI Assistant -> Backend Platform -> SaaS Ecosystem -> Mobile.

The central rule remains:

Risk first. Discipline first. PnL second.
