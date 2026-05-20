# PATCH LOG

---

# PATCH 1.0

Initial MVP architecture.

Stack:
- React
- TypeScript
- Vite
- Google Sheets
- Apps Script
- Vercel

Main pages:
- Overview
- Portfolio
- Risk
- Scenarios

---

# PATCH 1.1

Stabilization patch.

Changes:
- fixed build issues
- fixed unused imports
- stabilized deployment
- connected Vercel production build

Status:
stable

---

# PATCH 1.2

Live Fear & Greed integration.

Goal:
show live Fear & Greed index instead of static value.

Details:
- changed file: `src/App.tsx`
- fallback: 14
- API: `https://api.alternative.me/fng/?limit=1`
- build: successful
- `App.css` was not changed
- `vite.config.ts` was not changed

Safety:
- keep fallback 14
- isolated state
- no geometry changes
- no App.tsx rewrite
- no API contract changes

Status:
completed

---

# PATCH 1.3

Architecture Baseline.

Type:
documentation

Goal:
freeze the current working architecture before future refactoring.

Changes:
- added `docs/ARCHITECTURE_BASELINE.md`
- documented current React/Vite, Google Sheets, Apps Script, Vercel and Fear & Greed architecture
- documented current data flows
- documented known limitations and safe patch rules

Build:
not required, code was not changed

Status:
completed

---

# PATCH 1.4

Extract Types.

Type:
code organization

Goal:
move TypeScript portfolio/dashboard types from `src/App.tsx` into a dedicated type layer without changing runtime behavior.

Changes:
- updated `src/types/portfolio.ts`
- replaced local App type declarations with type-only imports
- kept UI, fetch logic, state logic, calculations and styling unchanged

Build:
successful

Status:
completed

---

# PATCH 1.5

Production API Fix.

Type:
deployment routing

Purpose:
make production `/api/investor` work on Vercel and return live Apps Script data.

Files changed:
- `vercel.json`
- `docs/PATCH_LOG.md`

Details:
- added Vercel rewrite for `/api/investor`
- destination matches the current Apps Script `/exec` URL used by the Vite local proxy
- no UI, Google Sheets, Apps Script, Fear & Greed, helpers or refactor changes

Build:
successful

Status:
completed

---

# PATCH 1.6

Extract Helpers / Formatters.

Type:
code organization

Goal:
move pure helper and formatter functions out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/lib/formatters.ts`
- `src/lib/uiHelpers.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- extracted currency and percent formatters
- extracted pure UI helper functions
- kept JSX, UI, CSS, API behavior, state, fetch, fallback data and calculations unchanged
- did not touch `vercel.json` or `vite.config.ts`

Build:
successful

Status:
completed

---

# PATCH 1.7

API Layer Separation.

Type:
code organization

Goal:
move API fetch/parsing boundaries out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/api/investor.ts`
- `src/api/fearGreed.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- added `fetchInvestorData()` returning raw `/api/investor` JSON
- added `fetchFearGreedValue()` returning `number | null`
- kept investor merge logic, state updates, intervals, fallback data and Fear & Greed behavior in `src/App.tsx`
- did not touch UI, JSX, CSS, `vite.config.ts`, `vercel.json`, calculations or page components

Build:
successful

Status:
completed

---

# PATCH 1.8

Constants Separation.

Type:
code organization

Goal:
move static configuration constants out of `src/App.tsx` and API modules without changing runtime behavior.

Files changed:
- `src/config/constants.ts`
- `src/App.tsx`
- `src/api/investor.ts`
- `src/api/fearGreed.ts`
- `docs/PATCH_LOG.md`

Details:
- extracted test login constants
- extracted market cycle date constants as `new Date(...)`
- extracted API URL constants
- extracted refresh interval constants without changing values
- kept UI, JSX, API behavior, state, fetch semantics, fallback data, calculations and login behavior unchanged
- did not touch `App.css`, `vite.config.ts` or `vercel.json`

Build:
successful

Status:
completed

---

# PATCH 1.9

Investor Data Hook.

Type:
code organization

Goal:
move investor data state/effect from `src/App.tsx` into `src/hooks/useInvestorData.ts` without changing runtime behavior.

Files changed:
- `src/hooks/useInvestorData.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `useInvestorData(fallbackData)`
- moved investor data `useState`, `useEffect`, `fetchInvestorData()`, `json?.success` check, merge logic, interval and cleanup into the hook
- kept fallbackData construction, raw data, calculations and Fear & Greed behavior in `src/App.tsx`
- kept UI, JSX, CSS and API contract unchanged

Build:
successful

Status:
completed

---

# PATCH 2.0

Extract Fear & Greed Hook.

Type:
code organization

Goal:
move Fear & Greed state/effect from `src/App.tsx` into `src/hooks/useFearGreed.ts` without changing runtime behavior.

Files changed:
- `src/hooks/useFearGreed.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `useFearGreed()`
- moved Fear & Greed fallback object, label thresholds, state, effect, fetch call, interval and cleanup into the hook
- preserved fallback value `14`
- preserved label thresholds
- kept Gauge UI unchanged
- did not touch investor data hook
- kept UI, JSX, CSS and API contract unchanged

Build:
successful

Status:
completed

---

# PATCH 2.1

Extract Static Data.

Type:
code organization

Goal:
move static portfolio mock arrays out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/mocks/portfolioData.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `src/mocks/portfolioData.ts`
- moved `rawPositions`, `decisionsData` and `scenariosData` out of `src/App.tsx`
- array values were not changed
- array order was not changed
- calculations and `buildPortfolioState` stayed in `src/App.tsx`
- UI, JSX, CSS and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 2.2

Extract Portfolio Calculations.

Type:
code organization

Goal:
move pure portfolio calculations out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/lib/portfolioCalculations.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `src/lib/portfolioCalculations.ts`
- moved pure portfolio calculations out of `src/App.tsx`
- formulas, rounding, category order and risk thresholds were not changed
- `buildPortfolioState` behavior was not changed
- UI, JSX, CSS and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 2.3

Extract Mood Data.

Type:
code organization

Goal:
move mood and market sentiment logic out of `src/App.tsx` without changing runtime behavior.

Files changed:
- `src/lib/moodData.ts`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `src/lib/moodData.ts`
- moved mood and sentiment logic out of `src/App.tsx`
- buy window and halving logic were not changed
- recommendation and emotional texts were not changed
- UI, JSX, CSS and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.0

Extract Sidebar Component.

Type:
component extraction

Goal:
move `Panel` and `Sidebar` out of `src/App.tsx` without changing behavior or visual structure.

Files changed:
- `src/components/shared/Panel.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `src/components/shared/Panel.tsx`
- created `src/components/layout/Sidebar.tsx`
- moved `Panel` out of `src/App.tsx`
- moved `Sidebar` out of `src/App.tsx`
- nav behavior was not changed
- className and UI structure were not changed
- `App.css` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.1

Atmosphere Layer.

Type:
visual polish

Goal:
strengthen the premium cinematic fintech sci-fi atmosphere without changing layout, JSX or behavior.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- strengthened cosmic background through CSS
- added and improved ambient glow layers
- enhanced `scene-orb` and `scene-plane` effects
- added subtle long-cycle animations
- UI, JSX, layout, data and API behavior were not changed
- `src/App.tsx` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.2

Visual Depth.

Type:
visual polish

Goal:
strengthen interface depth, block separation and text readability without changing layout or JSX.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- strengthened panel and card layer depth
- improved border, shadow and text depth readability
- added subtle edge highlights
- layout, JSX, data and API behavior were not changed
- `src/App.tsx` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.3

Typography & Cosmic Focal Element.

Type:
visual polish

Goal:
improve typographic expressiveness, large-number readability, long asset names, PnL visibility and add one cosmic focal element.

Files changed:
- `src/App.css`
- `src/App.tsx`
- `docs/PATCH_LOG.md`

Details:
- connected `Space Grotesk`
- strengthened typographic hierarchy
- improved rendering for long asset names such as `BTC SHORT`
- strengthened PnL readability
- added a CSS-only cosmic focal element in the lower-left corner
- business logic, data, API and calculations were not changed
- layout geometry was not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.1

Fix Typography and Wormhole Regression.

Type:
visual fix

Goal:
restore normal composition after PATCH 3.3, fix long asset names, improve PnL readability and reduce the cosmic focal element.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- rolled body font back to `Inter, system-ui, sans-serif`
- kept `Space Grotesk` only for headings and numbers
- fixed clipping for long asset names such as `BTC SHORT`
- strengthened PnL readability
- reduced the wormhole and moved it lower and further left
- layout, data and API behavior were not changed
- `src/App.tsx` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.2

Reposition Cosmic Nebula Element.

Type:
visual fix

Goal:
turn the cosmic focal element into a lower-left purple/blue nebula glow that matches the site atmosphere.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- fixed the cosmic focal element
- removed the eye-like effect
- moved the element lower into the lower-left sector
- changed it into a soft purple/blue nebula glow
- layout, JSX, data and API behavior were not changed
- `src/App.tsx` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.3

Purple Milky Way Placement.

Type:
visual fix

Goal:
replace the portal-like cosmic element with a lower-left diagonal purple/blue Milky Way style nebula.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- replaced the circular/portal visual model for `.space-wormhole`
- removed central dark-eye styling and hard radial rays
- moved the element further lower-left
- changed the effect into an elongated purple/blue nebula trail
- layout, JSX, data and API behavior were not changed
- `src/App.tsx` was not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.4

Build Real Purple Milky Way Layer.

Type:
visual fix

Goal:
make the lower-left cosmic element read as a bright purple-blue Milky Way layer with a nebula stream and star dust.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- strengthened the purple-blue Milky Way element
- added a bright core in the lower-left
- added a diagonal nebula stream
- added star dust without an eye or portal effect
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.5

Use Nebula Image Asset.

Type:
visual fix

Goal:
match the lower-left purple Milky Way reference more closely by using a real bitmap nebula asset instead of CSS-only gradients.

Files changed:
- `src/assets/backgrounds/purple-milky-way.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- created a purple-blue Milky Way bitmap asset from the provided reference
- connected the asset to `.space-wormhole`
- kept CSS gradients only as a soft bloom layer
- removed the CSS-only portal/plate look
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.6

Attach Nebula To Scene Scroll.

Type:
visual fix

Goal:
make the purple Milky Way layer behave like part of the full cosmic background instead of a fixed decorative viewport sticker.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- changed `.space-wormhole` from fixed viewport positioning to an absolute scene layer
- positioned the nebula inside `.cyber-scene` so it scrolls with the page
- increased the nebula canvas size to read more like a background galaxy
- preserved pointer safety and z-index below the UI
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.7

Blend Nebula Into Background.

Type:
visual fix

Goal:
remove the visible rectangular seam around the purple Milky Way layer so the full screen reads as one unified cosmic background.

Files changed:
- `src/assets/backgrounds/purple-milky-way.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- softened the nebula asset alpha so dark image edges no longer create a pasted rectangle
- removed the rectangular glow/shadow around `.space-wormhole`
- added a radial mask so the nebula fades into the site background
- kept the nebula attached to the scrolling scene
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.8

Remove Vertical Seam Near Nebula.

Type:
visual fix

Goal:
remove the visible vertical seam near the nebula layer without changing its position, size or scroll behavior.

Files changed:
- `src/assets/backgrounds/purple-milky-way.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- removed the vertical seam / edge artifact near the nebula layer
- strengthened the right-edge fade through `mask-image`
- updated `purple-milky-way.png` with a stronger transparent right edge
- preserved the nebula position, size and scroll behavior
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.9

Final Nebula Edge Fade.

Type:
visual fix

Goal:
fully remove the remaining vertical edge artifact on the right side of the nebula layer.

Files changed:
- `src/assets/backgrounds/purple-milky-way.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- strengthened the right-edge fade of the nebula layer
- removed the remaining vertical edge artifact
- simplified the mask to one aggressive horizontal fade
- added a soft right-edge blending layer
- preserved the nebula position, size and scroll behavior
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.3.10

Restore Nebula Soft Edge Balance.

Type:
visual fix

Goal:
restore a softer, fuller nebula trail after the aggressive right-edge fade from PATCH 3.3.9.

Files changed:
- `src/assets/backgrounds/purple-milky-way.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- softened the aggressive right-edge fade from PATCH 3.3.9
- restored a fuller nebula trail with a more gradual transparent edge
- removed the dark right-edge blending layer
- preserved the nebula position, size and scroll behavior
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.4

Full Cosmic Background Asset.

Type:
visual background replacement

Goal:
replace the separate nebula layer with one full-page cosmic background asset to remove seams, rectangular edges and pasted-layer artifacts.

Files changed:
- `src/assets/backgrounds/cosmic-dashboard-bg.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- added `cosmic-dashboard-bg.png` as the main background for `.cyber-scene`
- disabled the separate `.space-wormhole` layer
- removed the old nebula image dependency from `.space-wormhole`
- kept UI blocks above the background with z-index layering
- softened old scene-orb / scene-plane intensity so they do not conflict with the full background
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.4.1

Increase Cosmic Background Saturation.

Type:
visual background enhancement

Goal:
make the full cosmic background brighter, richer and closer to the vivid purple-blue reference while preserving UI readability.

Files changed:
- `src/assets/backgrounds/cosmic-dashboard-bg.png`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- increased saturation, contrast and brightness of the full background asset
- strengthened the lower-left purple/blue nebula and right-side violet glow
- added more small stars across the center and right side
- reduced the heavy dark overlay on `.cyber-scene`
- kept the full background as one continuous image with no separate nebula layer
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5

Typography Upgrade Sora/Space Grotesk.

Type:
visual typography enhancement

Goal:
make the interface typography feel more technological and premium while preserving readable body text and a classic dollar sign.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- connected `Sora` and `Space Grotesk` through Google Fonts
- kept `Inter, system-ui, sans-serif` for body text
- applied `Sora` to large numbers and key metrics
- applied `Space Grotesk` to major titles and headings
- kept currency-heavy values on `Space Grotesk` so the `$` sign stays classic and bold
- `src/App.tsx`, layout, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.1

Global UI Scale Down 15%.

Type:
visual scale adjustment

Goal:
make the UI feel about 15% more compact after the typography upgrade without using browser zoom or whole-page transform scaling.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- reduced the main container width, page padding and large layout gaps
- reduced sidebar width, nav padding and sidebar title size
- reduced panel radii, panel padding, mini-card padding and overview panel heights
- reduced major headings, metrics, PnL value, Fear & Greed value and chart wrappers
- preserved Sora / Space Grotesk typography
- `src/App.tsx`, layout structure, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.2

Compact Cards After Global Scale.

Type:
visual compactness adjustment

Goal:
tighten cards and internal panels after the global scale reduction so values and labels fit cleanly without excess whitespace.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- reduced internal padding and heights for overview, allocation, Fear & Greed, mood and risk cards
- reduced gaps between mini-panels and internal card groups
- added overflow guards for labels, values and subtext inside mini-panels
- compacted allocation rows, Fear & Greed gauge, mood cards and risk chart wrappers
- `src/App.tsx`, layout structure, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.3

Restore Safe Layout Spacing.

Type:
visual spacing adjustment

Goal:
restore safe local spacing after the compact card patch without increasing the whole UI scale again.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- restored comfortable row gaps inside overview and health mini-panel grids
- added safer vertical rhythm around allocation, Fear & Greed and mood sections
- increased local spacing where cards visually merged after compact mode
- preserved compact structure, typography, colors and background
- `src/App.tsx`, layout structure, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.4

Restore 4mm Gutters.

Type:
visual spacing adjustment

Goal:
restore visible gutters between major blocks and internal mini-panels after compact mode without increasing the whole UI scale.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- increased local gutters between Overview and Health mini-panels to roughly 14-16px
- added safer spacing between top Overview cards and lower position cards
- restored breathing room inside allocation, Fear & Greed and mood sections
- kept compact typography, colors, background and visual scale intact
- `src/App.tsx`, layout structure, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.5

Real Mini Panel Gutters.

Type:
visual spacing fix

Goal:
make the requested visible clearance between internal mini-panels actually render by removing the fixed-height conflict in the top overview panels.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- removed the effective fixed-height squeeze from the top Overview and Health panels
- restored real row and column gutters between internal mini-panels
- set safer grid rows so mini-panels do not touch or overlap
- preserved compact scale, typography, colors and background
- `src/App.tsx`, JSX, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.5.6

Match Marked Card Gutters.

Type:
visual spacing fix

Goal:
match the user-marked spacing where internal mini-cards have visible gutters and do not fill or touch the parent panel edges.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- set explicit mini-card heights for the Overview and Health grids
- increased row and column gutters to match the marked clearance between cards
- restored internal parent padding and header-to-grid spacing
- prevented internal cards from stretching into each other
- `src/App.tsx`, JSX, data and API behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6

Hologram Allocation Chart.

Type:
visual component replacement

Goal:
replace the flat allocation donut with a live dynamic hologram allocation diagram built from `overview.categories`.

Files changed:
- `src/App.tsx`
- `src/App.css`
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- created `HologramAllocationChart` as a data-driven SVG/CSS component
- replaced the old local `DonutChart` render with `HologramAllocationChart`
- sectors, category cards, shares and total value are calculated from live `overview.categories`
- added hologram depth, cyan base glow, glass reflections, HUD lines, hover lift and soft pulse animation
- kept PNG/static-image usage out of the chart
- API, hooks, calculations, portfolio data and fetch behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.1

Hologram Allocation Composition Pass.

Type:
visual refinement

Goal:
make the new hologram allocation block feel larger, clearer and closer to the premium reference while preserving live data behavior.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- enlarged the hologram chart stage and cyan base glow
- improved layout balance between the chart and category cards
- allowed long category names to wrap instead of truncating
- increased visual depth for hologram sectors and glass highlights
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.2

Unified Hologram Segment Hover.

Type:
visual interaction fix

Goal:
make each hologram allocation sector behave as one complete 3D fragment on hover instead of separating its top and side layers.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- grouped each sector side, top and glass highlight into one SVG segment
- hover now moves and scales the whole fragment together
- added a controlled neon glow to the unified hovered segment
- preserved live data-driven sector sizing and allocation cards
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.3

Clean Hologram Chart Center.

Type:
visual cleanup

Goal:
remove the center text and numbers from the hologram allocation diagram so the chart surface stays clean.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed the center `Total Portfolio` label
- removed the center portfolio value from the chart
- removed the center categories count from the chart
- kept the live allocation data, right-side category cards and sector sizing unchanged
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH RULES

Every patch must include:

- purpose
- affected files
- risks
- rollback possibility
- deployment impact

Never:
- rewrite entire App.tsx
- break geometry
- change API naming
- remove fallback blindly
- merge huge unstable patches
