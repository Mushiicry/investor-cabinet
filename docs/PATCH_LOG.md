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

# PATCH 3.6.4

Polish Hologram Allocation Chart.

Type:
visual refinement

Goal:
reduce empty space in the allocation block, add dynamic total value and make the hologram chart feel more glassy and premium.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- tightened the allocation chart layout and reduced empty vertical space
- added dynamic total value inside the hologram chart area above the diagram
- added a cyan hologram platform with soft concentric glow under the chart
- made sectors more translucent and glass-like
- preserved unified sector hover with subtle lift and neon glow
- preserved dynamic rebuild from `overview.categories`
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.5

Improve Hologram Allocation Chart Visual.

Type:
visual refinement

Goal:
bring the live hologram allocation chart closer to the premium sci-fi/Bloomberg reference without changing data behavior.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- improved the hologram/glass styling of the allocation pie
- added stronger cyan hologram platform treatment under the diagram
- added subtle HUD details around the chart
- improved category rows with progress/glow accents
- kept the chart dynamic from `overview.categories`
- `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.6

Crop Allocation Panel Height.

Type:
visual layout fix

Goal:
crop the external allocation panel height to fit the hologram chart content and remove the large empty lower area.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- reduced the allocation panel height to fit its content
- removed the empty lower air inside the allocation block
- preserved the current 3D hologram chart
- preserved the dynamic total value and right category rows
- preserved width and scroll behavior
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.7

Fix Allocation Proportions After Crop.

Type:
visual layout fix

Goal:
restore correct hologram pie proportions after cropping the allocation panel height.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- restored more natural hologram pie proportions after the compact crop
- kept the allocation panel height compact
- constrained the chart stage width and height to avoid horizontal stretching
- improved the total value placement inside the chart area
- kept the right category rows in place
- preserved dynamic rebuild from `overview.categories`
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.8

Final Hologram Allocation Composition.

Type:
visual refinement

Goal:
improve the internal composition, color intensity and 3D hologram feel of the allocation chart without changing the external panel size.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- improved the internal allocation chart composition
- moved the diagram lower and aligned it inside the compact panel
- intensified the glass, neon and 3D effects of the sectors
- added a brighter rim layer to each dynamic sector
- strengthened the cyan hologram platform under the chart
- refined HUD labels and category row accents
- kept the external allocation panel size unchanged
- preserved dynamic rebuild from `overview.categories`
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.9

Final Allocation Chart Polish.

Type:
visual refinement

Goal:
finish the internal hologram allocation chart polish without changing the external allocation panel size.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- improved the final composition of the hologram allocation chart
- made the pie slightly smaller and moved it lower inside the block
- strengthened 3D depth, glass edges and cyan platform glow
- refined the total badge, HUD labels and category rows
- kept the external allocation panel size unchanged
- preserved dynamic rebuild from `overview.categories`
- `src/App.tsx`, API, hooks, calculations and data behavior were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.8

Perfect 3D Hologram Allocation Pie.

Type:
visual refinement

Goal:
make the live allocation pie feel like a premium 3D hologram glass object instead of a flat SVG drawing.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- strengthened 3D depth of the allocation pie
- added bottom layers, side walls, radial walls, edge highlights and a stronger hologram platform
- gave the green sector more visible volume, darker side depth and glass edge glow
- preserved whole-sector hover behavior
- kept the chart dynamic from `overview.categories`
- external layout, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.6.8.1

Hologram Pie Reference Alignment.

Type:
visual refinement

Goal:
move the live allocation chart closer to the provided premium reference without changing the external allocation panel or data behavior.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- enlarged the internal hologram pie inside the existing allocation card
- added a dedicated glowing outer arc rim for each dynamic sector
- softened the heavy internal radial walls so small sectors no longer look like dark plates
- strengthened translucent side depth, glass sheen and cyan platform glow
- preserved live rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.7

Rebuild Allocation Chart With Canvas 2D.

Type:
visual renderer rebuild

Goal:
replace the SVG allocation pie renderer with a Canvas 2D renderer for a more realistic dynamic hologram pie and cyan portal platform.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- rewrote `HologramAllocationChart` from SVG paths to a Canvas 2D renderer
- added dynamic canvas redraw from `categories` with device pixel ratio support
- added 3D side walls, translucent glass top surfaces, neon edges and hover lift
- added animated cyan hologram portal rings under the chart
- preserved the right-side category rows, progress lines and dynamic total value
- preserved rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.7.1

Tune Canvas Allocation Chart Geometry.

Type:
visual refinement

Goal:
fine-tune the Canvas 2D allocation chart geometry after the renderer rebuild.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- improved the Canvas 3D pie geometry
- strengthened side/front walls and glass depth
- improved green and cyan sector volume
- strengthened the cyan portal platform
- preserved hover behavior and dynamic rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.7.2

Rebuild Canvas Pie As Separate 3D Slices.

Type:
visual renderer refinement

Goal:
remove the shared-cylinder feeling from the Canvas allocation chart and make each category read as an individual 3D glass slice.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- rebuilt the Canvas pie draw order around separate slice shadows, side walls and top faces
- added stable per-category exploded offsets and larger gaps between slices
- reduced the shared cylinder effect by tuning pie depth and per-slice wall opacity
- sorted sector drawing by visual depth so front slices layer over back slices
- strengthened the cyan portal while keeping it below the chart
- preserved hover behavior and dynamic rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.7.3

Stylized Canvas Hologram Pie Like Reference.

Type:
visual renderer refinement

Goal:
move the Canvas allocation chart from physically literal 3D geometry toward a stylized premium fake-3D hologram pie closer to the reference.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- converted the Canvas chart toward a stylized fake-3D render
- removed the shared-cylinder/drum feeling by limiting side walls to visible front arcs
- improved individual glass wedge slices with stronger rim lights and per-slice side walls
- strengthened the cyan portal as the main light source under the pie
- preserved hover behavior and dynamic rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.7.4

Premium Sci-Fi Hologram Pie Target.

Type:
visual renderer refinement

Goal:
push the Canvas allocation chart closer to the premium sci-fi hologram reference while preserving dynamic category data and the existing allocation panel geometry.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- narrowed and deepened the Canvas pie geometry to reduce the flat cylinder feeling
- strengthened individual slice side walls, front walls, shadows and neon edge strokes
- made the green hero slice richer and more volumetric with stronger emerald glass glow
- made the cyan slice denser and more crystalline with stronger lower light interaction
- improved small violet/yellow slices so they read as physical hologram wedges
- strengthened the cyan portal glow, rings, center core and upward light beam
- preserved hover behavior and dynamic rebuild from `overview.categories`
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.8

Isolate Pie Renderer Without Portal.

Type:
visual renderer isolation

Goal:
temporarily disable the portal/platform layer so the dynamic Canvas pie sectors can be polished in isolation.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- portal layer temporarily disabled for focused pie polish
- removed active cyan portal/ring/glow rendering from the Canvas draw path
- disabled CSS-only portal/platform glow layers under the Canvas chart
- focused the Canvas renderer on dynamic 3D pie sector shadows, side walls, top faces and neon edges
- removed the continuous lower-rim stroke that contributed to the shared-cylinder feeling
- added minimum visual angles for tiny categories while preserving real category values and shares in the right rows
- dynamic categories and hover behavior preserved
- external allocation panel size, `src/App.tsx`, API, hooks and calculations were not changed

Build:
successful

Status:
completed

---

# PATCH 3.8.1

Polish Canvas Pie Sectors Only.

Type:
visual renderer refinement

Goal:
remove the shared-cylinder feeling from the isolated Canvas allocation pie and make every category read as an individual 3D glass slice.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- narrowed the pie and added more vertical depth without changing the allocation panel layout
- increased per-slice separation and minimum visual angle for small wedge readability
- tuned slice shadows so they no longer combine into one lower cylinder
- strengthened individual outer walls, radial walls and neon arc edges per sector
- made the green cash sector less acidic with a softer emerald glass render
- made the cyan crypto sector denser with a brighter front wall and arc rim
- kept violet/yellow as physical wedge sectors rather than flat plates
- preserved whole-slice hover movement and dynamic rebuild from `categories`
- portal/platform rendering remains disabled and was not intensified
- `src/App.tsx`, API, hooks, calculations, right category rows, TOTAL block, Fear & Greed and page layout were not changed

Build:
successful

Status:
completed

---

# PATCH 3.8.2

Remove Rectangular Walls From Canvas Pie.

Type:
visual renderer refinement

Goal:
remove rectangular/wireframe wall artifacts inside the isolated Canvas allocation pie while preserving dynamic category data and hover behavior.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed rectangular transparent wall behavior inside the Canvas pie
- rebuilt front walls around curved upper and lower arc paths
- reduced radial wall visibility and removed full polygon strokes that created box-like center lines
- kept only subtle top radial separators, neon upper arcs and individual outer rim glow
- improved green, cyan, violet and yellow sector edges as curved glass wedges
- increased minimum visual angle so small sectors read as wedges
- dynamic categories and whole-slice hover behavior preserved
- portal/platform rendering was not changed or intensified
- `src/App.tsx`, API, hooks, calculations, right category rows, TOTAL block, Fear & Greed and page layout were not changed

Build:
successful

Status:
completed

---

# PATCH 3.8.3

Remove Back Ellipse And Make Pie Slice-Only.

Type:
visual renderer refinement

Goal:
remove rear/bottom ellipse artifacts so the Canvas allocation chart reads as separate 3D wedge sectors instead of a shared cylinder.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed rear/bottom ellipse artifacts from the slice shadow layer
- removed shared cylinder/platform-like shadow strokes
- converted pie shadow into soft blurred per-slice radial glow without visible oval outlines
- preserved only individual wedge sector top faces, curved front walls, radial side walls and edge glow
- removed lower rim light so cyan/green/violet/yellow no longer create a shared bottom ellipse
- dynamic categories and whole-slice hover behavior preserved
- portal/platform rendering was not changed or intensified
- `src/App.tsx`, API, hooks, calculations, right category rows, TOTAL block, Fear & Greed and page layout were not changed

Build:
successful

Status:
completed

---

# PATCH 3.8.5

Separate Glass Slices And Restore Premium Depth.

Type:
visual renderer refinement

Goal:
restore premium 3D depth while keeping the Canvas allocation chart slice-only, with no shared portal, platform or oval cylinder artifacts.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- increased visual gap and exploded offset between allocation sectors
- increased minimum visual angle so yellow and violet read as glass wedges instead of thin strips
- strengthened per-slice shadows without adding shared contours
- made the cyan sector denser as its own glass slice instead of a shared lower tray
- made the green cash sector less flat with stronger emerald top/side contrast and brighter visible rim
- restored subtle radial side walls for selected visible boundaries without drawing shared walls
- increased contrast between top faces and side walls
- dynamic categories and whole-slice hover behavior preserved
- portal/platform rendering was not changed or intensified
- `src/App.tsx`, API, hooks, calculations, right category rows, TOTAL block, Fear & Greed, background and page layout were not changed

Build:
successful

Status:
completed

---

# PATCH 4.1

Refine Existing Canvas Pie Toward Reference.

Type:
visual renderer refinement

Goal:
move the existing Canvas allocation pie closer to the premium holographic 3D reference without rebuilding the block or changing layout/data.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- tightened pie perspective into a thicker compact suspended glass object
- increased visual slice gaps and minimum wedge readability for yellow/purple
- tuned emerald, cyan, violet and yellow render colors toward the reference palette
- added cleaner dark-glass side-wall gradients with less ambient blur
- added per-slice lower front rim accents without shared oval contours
- sharpened top/front neon rims for each sector
- reduced jelly/blob softness by lowering broad shadow blur and strengthening physical edges
- preserved current Canvas renderer, dynamic categories and hover behavior
- portal/platform rendering was not changed or intensified
- `src/App.tsx`, `App.css`, API, hooks, calculations, right category rows, TOTAL block, Fear & Greed, background and page layout were not changed

Build:
successful

Status:
completed

---

# PATCH 4.2

Rollback Failed 4.1 And Restore Previous Best Pie Brightness.

Type:
visual rollback / renderer refinement

Goal:
visually roll back the dark, heavy PATCH 4.1 material treatment and restore the brighter best-known Canvas pie look while preserving slice-only geometry.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- visually rolled back PATCH 4.1 darkening inside the Canvas pie renderer
- restored brighter emerald cash, neon cyan crypto and saturated violet/yellow sector treatment
- restored stronger rim glow on green outer edge, cyan front edge and small sector rims
- lightened side-wall gradients so slices read as clean glass instead of dirty black mass
- removed the PATCH 4.1 lower front rim accent that made the object feel heavier
- preserved no rear/bottom oval artifacts, no shared cylinder, no rectangular wall panels and no extra internal arcs
- preserved dynamic categories and whole-slice hover behavior
- `src/App.tsx`, `App.css`, API, hooks, calculations, layout, right category rows, TOTAL block, Fear & Greed, background and portal/platform rendering were not changed

Build:
successful

Status:
completed

---

# PATCH 4.3

Move Pie Right And Restore Neon Slice Borders.

Type:
visual renderer refinement

Goal:
move only the Canvas pie geometry slightly to the right and restore brighter premium neon borders for each individual glass slice.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- shifted only the pie slice rendering and hover hitbox to the right inside the existing canvas
- kept DATA FLOW, TOTAL, right category rows, panel size, layout and portal/platform unchanged
- reduced exploded slice spacing so sectors sit closer together while remaining separate objects
- increased emerald/cyan/violet/yellow color saturation for clearer glass-slice readability
- lightened side-wall gradients so green and cyan read as transparent crystal volume instead of dark blotches
- restored stronger per-slice neon rims along top arcs, visible front/lower arcs, radial boundaries and outer vertical edges
- replaced the compact-sector inner arc accent with wedge boundary strokes to avoid internal semicircle artifacts
- preserved no shared oval contours, no shared cylinder, no rectangular wall panels, dynamic categories and hover behavior
- `src/App.tsx`, `App.css`, API, hooks, calculations, data, right category cards, TOTAL block, Fear & Greed, background and allocation panel size were not changed

Build:
successful

Status:
completed

---

# PATCH 4.4

Final Slice Borders And Base Lines.

Type:
visual renderer refinement

Goal:
finish the Canvas allocation pie by tightening slice spacing, moving only the pie body farther right and adding readable per-slice neon base lines.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- shifted only the Canvas pie geometry and matching hover hitbox farther right
- reduced slice gap and exploded offset so the pie reads as a closer premium object while preserving separate wedges
- added per-slice lower/base rim strokes for green, cyan, violet and yellow without drawing a shared oval or cylinder
- widened green and compact slice wall rendering so their lower glass body is visible within each slice boundary
- increased green saturation and dark emerald glass volume without adding internal arcs
- brightened violet and yellow wedge bodies and restored stronger neon outlines on their visible edges
- kept cyan front rim and made side walls remain crystal-like rather than black
- preserved no common oval contours, no portal/platform, no internal semicircle artifacts, no rectangular panels, dynamic categories and hover behavior
- `src/App.tsx`, `App.css`, API, hooks, calculations, data, right category cards, TOTAL, DATA FLOW labels, layout, allocation panel size, portal and background were not changed

Build:
successful

Status:
completed

---

# PATCH 4.5

Remove Wrong Cyan Arc And Add Missing Segment Base Lines.

Type:
visual renderer refinement

Goal:
remove the stray inner cyan/green arc while keeping external rims and strengthening missing per-slice base lines for small sectors.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed the long green lower-base arc that appeared as a wrong internal semicircle across the cyan/green area
- kept the bright external cyan rim and cyan lower base line
- changed green base rendering to short per-edge lower rim segments instead of a full internal lower arc
- preserved and strengthened full lower wedge base lines for violet and yellow small slices
- kept current right-shifted pie position, compact slice spacing, bright green top, hover logic and dynamic category data
- preserved no shared oval contours, no shared cylinder, no portal/platform, no rectangular panels and no decorative inner guide arcs
- `src/App.tsx`, `App.css`, API, data, hooks, calculations, layout, cards, TOTAL, DATA FLOW labels, right rows, allocation panel size, portal and background were not changed

Build:
successful

Status:
completed

---

# PATCH 4.5.1

Clean Segment Edge Artifacts.

Type:
visual renderer fix

Goal:
remove remaining green edge artifacts and close small neon border gaps without changing layout or data behavior.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed green lower base arc segments that created the right-side hook artifact
- prevented the left green radial edge from appearing inside the violet slice
- kept only the visible right green vertical edge where the cash slice body needs definition
- added rounded line caps and joins to reduce small gaps between cyan rim and vertical edges
- added short lower radial connectors for compact violet/yellow slices so their bottom wedge borders read as connected
- preserved current pie position, compact slice spacing, cyan rim/base line, hover behavior and dynamic category data
- `src/App.tsx`, `App.css`, API, data, hooks, calculations, layout, cards, TOTAL, DATA FLOW labels, right rows, allocation panel size, portal and background were not changed

Build:
successful

Status:
completed

---

# PATCH 4.5.2

Remove Extra Violet Lower Connector Lines.

Type:
visual renderer fix

Goal:
remove extra lower connector strokes inside the violet slice while keeping only the lower wedge base line.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- removed the compact-slice lower radial connector helper
- removed the extra internal horizontal connector strokes that appeared inside the violet wall
- preserved the violet lower base edge as the only lower boundary line
- preserved green/cyan artifact cleanup, current pie position, hover behavior and dynamic category data
- `src/App.tsx`, `App.css`, API, data, hooks, calculations, layout, cards, TOTAL, DATA FLOW labels, right rows, allocation panel size, portal and background were not changed

Build:
successful

Status:
completed

---

# PATCH 4.5.3

Allocation Pie Checkpoint.

Type:
checkpoint / release stabilization

Goal:
freeze the current allocation Canvas pie state as the next stable working point before continuing visual refinement.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- preserved the current premium holographic Canvas pie state
- kept the latest right-shifted composition, compact slice spacing and cleaned violet lower connector lines
- preserved dynamic category data, hover behavior and device pixel ratio canvas rendering
- preserved current allocation panel geometry, TOTAL, DATA FLOW labels and right category rows
- `src/App.tsx`, API, data, hooks, calculations, portfolio logic, Fear & Greed, portal and background behavior were not changed
- ready to push to GitHub and trigger Vercel deployment from `main`

Build:
successful

Status:
completed

---

# PATCH 4.6

Fear & Greed Market Mood Block.

Type:
visual UI checkpoint / Overview refinement

Goal:
freeze the current Fear & Greed block as a completed premium market mood widget before moving to the next development step.

Files changed:
- `src/App.tsx`
- `src/App.css`
- `src/assets/fear-greed/gauge-bg.webp`
- `docs/PATCH_LOG.md`
- `docs/vision/OADMAP.md`

Details:
- replaced the previous `react-gauge-component` usage inside `FearGreedGauge` with a WebP premium speedometer background
- kept the Fear & Greed API, `data.value`, fallback behavior and needle angle formula unchanged
- added a dynamic neon needle driven by the current index value
- added the current index value inside a glass sphere over the speedometer
- added the buy ladder table under the gauge with active row highlighting based on `data.value`
- added the weekly purchase clarification note with a custom neon calendar icon
- widened and shifted the Fear & Greed block on desktop while keeping the rest of Overview intact
- preserved Portfolio page, Risk page, Sidebar, allocation calculations, Google Sheets bindings, API contracts and business logic

Build:
successful

Status:
completed

Deployment impact:
requires push to GitHub; Vercel should deploy from `main` after push.

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
