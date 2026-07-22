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

# PATCH 4.7

Allocation Reference Labels.

Type:
visual UI refinement / allocation metadata

Goal:
bring the allocation block closer to the reference by adding the missing institutional labels and category guardrail text without changing allocation calculations or pie geometry.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- changed the right chart HUD from category count to `PORTFOLIO / DISTRIBUTION`
- added the lower-left chart HUD `BALANCE / STATUS: ACTIVE`
- added category display labels for stablecoins and spot crypto
- added target allocation ranges and `OK` / `LOW` status text to the right category rows
- added a display-only zero `Акции` row so the category stack matches the reference structure
- changed the `Акции` category display palette to orange for the allocation row
- kept Canvas pie data, hover behavior, device pixel ratio rendering and dynamic category calculations unchanged
- `src/App.tsx`, API, hooks, calculations, Google Sheets bindings, Fear & Greed, background and external panel layout were not changed

Risks:
- the fifth category row makes the allocation row stack denser on small panel heights

Rollback:
- revert this patch in `HologramAllocationChart.tsx`, the `PATCH 4.7` CSS block in `src/App.css`, and this log entry

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 4.8

Allocation Row Icons And Scale.

Type:
visual UI refinement / allocation category rows

Goal:
make the allocation category rows closer to the reference by restoring category icons, colored percentages and larger readable metric text while keeping the current panel geometry.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- removed the `(стейблы)` and `(спот)` suffixes from category names
- added compact category icons for cash, crypto, futures, metals and stocks
- colored each category percentage with its own category color and glow
- slightly increased the metric typography inside the allocation category rows
- increased the Canvas pie display area by roughly 35px in width and height
- preserved dynamic allocation data, pie calculations, hover behavior and the existing external allocation panel size
- `src/App.tsx`, API, hooks, calculations, Google Sheets bindings, Fear & Greed and page layout were not changed

Risks:
- larger row typography and icons make the right category stack denser, especially on smaller viewports

Rollback:
- revert the `PATCH 4.8` CSS block and the small metadata/icon edits in `HologramAllocationChart.tsx`

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 4.9

Allocation Portal WebP Layer.

Type:
visual UI refinement / allocation hologram base

Goal:
add the glowing portal under the Canvas allocation pie using the provided WebP reference asset without restoring the old canvas/platform oval artifacts.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `src/assets/hologram/allocation-portal.webp`
- `docs/PATCH_LOG.md`

Details:
- added the provided portal WebP as a dedicated decorative image asset
- rendered the portal as an `aria-hidden` image layer underneath the Canvas pie
- positioned the portal inside the existing canvas wrapper so the external allocation panel size stays unchanged
- used screen blending, cyan saturation and a controlled glow filter to integrate the portal with the dark dashboard
- kept the Canvas pie renderer, dynamic categories, hover behavior, API, hooks and calculations unchanged
- did not re-enable the old SVG/canvas platform, shared oval strokes or cylinder base

Risks:
- the bitmap layer may need visual position tuning after browser inspection on the target viewport

Rollback:
- remove the portal image import/render line, the `PATCH 4.9` CSS block and the asset file

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.0

Allocation Row Alignment And Wider Cards.

Type:
visual UI refinement / allocation row layout

Goal:
fix category row text collisions after adding icons and colored percentages by widening the right allocation stack toward the pie and giving each row stable internal columns.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- widened the right allocation category column toward the chart without changing the external panel size
- reduced the gap between the pie area and the category rows
- gave row content fixed columns for dot, icon, label/value and percentage
- tightened row spacing so five category rows still fit in the allocation panel
- kept the Canvas pie renderer, portal image, dynamic data, hover behavior, API, hooks and calculations unchanged
- `src/App.tsx`, Fear & Greed, page layout and Google Sheets bindings were not changed

Risks:
- the allocation card stack remains dense and may need viewport-specific tuning after visual review

Rollback:
- revert the `PATCH 5.0` CSS block and this log entry

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.1

Allocation Pie Thickness Toward Reference.

Type:
visual UI refinement / canvas pie geometry

Goal:
reduce the overly tall sector body after the portal and scale changes so the allocation pie reads closer to the reference holographic suspended slices instead of a thick cylinder.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- reduced Canvas pie physical depth from 64 to 42 units
- tightened the lower wall ellipse scale so side walls become shallower and cleaner
- preserved individual slice bodies, per-slice rims, portal image layer and hover behavior
- kept dynamic category data, API, hooks, calculations, right cards, panel size and page layout unchanged
- did not restore shared cylinder strokes, common oval contours or the old canvas platform

Risks:
- thinner side walls may need one more visual tuning pass for the exact reference balance

Rollback:
- restore the previous `PIE.depth` and lower wall ellipse scale values in `HologramAllocationChart.tsx`

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.2

Low Profile Holographic Pie And Portal Rebuild.

Type:
visual UI refinement / Canvas pie geometry and portal composition

Goal:
move the allocation pie away from the thick barrel look and closer to the reference: thin semi-transparent glass slices floating over a larger holographic portal.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- rebuilt the Canvas pie proportions to be wider, lower and visually lighter
- reduced sector extrusion depth from 42 to 18 units
- reduced slice gaps and exploded offsets for a tighter premium composition
- made top faces and side walls more transparent with softer glass-like alpha values
- reduced heavy shadows, lower rim thickness and wall opacity
- kept per-slice geometry, neon rims and hover behavior
- enlarged the WebP portal layer and added cyan bloom plus a vertical projection beam
- preserved right allocation rows, typography, page layout, data, API, hooks and calculations
- did not restore shared cylinder strokes, common oval outlines or the old platform renderer

Risks:
- this is a larger visual geometry shift and may need viewport-specific tuning after local inspection

Rollback:
- restore the previous `PIE` constants, wall/top alpha values and remove the `PATCH 5.2` CSS block

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.3

Medium Glass Pie Balance.

Type:
visual UI refinement / Canvas pie volume and portal integration

Goal:
restore premium medium-depth glass volume after PATCH 5.2 made the pie too flat and small, while avoiding the previous thick barrel/cylinder look.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- increased Canvas pie depth from 18 to 30 units for controlled medium glass thickness
- adjusted lower wall ellipse scale so side faces are visible but not dominant
- increased top face opacity, side wall opacity and neon edge glow moderately
- enlarged the canvas composition by roughly 18-25% inside the existing allocation panel
- lifted and enlarged the portal layer so it connects visually with the pie
- strengthened the vertical beam and portal cyan bloom
- preserved right allocation cards, typography, page layout, data, API, hooks and calculations
- did not restore heavy cylinder geometry, shared oval strokes or old platform rendering

Risks:
- final visual balance still depends on browser viewport and may need a small follow-up position/scale pass

Rollback:
- restore PATCH 5.2 pie constants and remove the `PATCH 5.3` CSS block

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.4

Raise Allocation Portal.

Type:
visual UI refinement / portal positioning

Goal:
move the holographic portal closer to the allocation pie after the medium-depth pie balance pass.

Files changed:
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- raised the WebP portal image layer by roughly 180px
- raised the portal cyan glow layer by the same amount
- adjusted the vertical beam upward so it continues to visually connect the portal with the pie center
- follow-up tuning lowered the portal stack by 40px, leaving a net upward shift of roughly 140px
- follow-up tuning lowered the portal stack by another 20px, leaving a net upward shift of roughly 120px
- follow-up tuning shifted only the Canvas pie image 15px to the right
- preserved Canvas pie geometry, right allocation cards, data, API, hooks, calculations and page layout

Risks:
- portal may need a small follow-up vertical tuning after browser review

Rollback:
- remove the `PATCH 5.4` CSS block

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 5.5

Glass Slice Closure And Highlights.

Type:
visual UI refinement / Canvas slice material

Goal:
fix open-looking slice seams and make each allocation sector read as a cohesive glass 3D object rather than a transparent flat fill.

Files changed:
- `src/components/charts/HologramAllocationChart.tsx`
- `docs/PATCH_LOG.md`

Details:
- introduced shared lower ellipse scale constants so lower wall points, wall paths and lower strokes use identical geometry
- removed skipped top-edge segments that caused visible breaks on larger slices
- added a closed perimeter seam stroke over each side wall path to cover micro-gaps between top, wall and lower layers
- enabled lower edge rendering for all sectors, improving the purple/yellow bottom readability
- added a subtle glossy white highlight along the illuminated top edge of each sector
- preserved current pie scale, portal positioning, right allocation cards, data, API, hooks and calculations
- did not increase pie depth or restore thick barrel/cylinder geometry

Risks:
- glossy highlights may need opacity tuning after visual review on the target display

Rollback:
- revert the lower scale constants, perimeter seam stroke and gloss edge helper changes in `HologramAllocationChart.tsx`

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 6.0

Investor Terminal Visual System.

Type:
visual UI refinement / dashboard shell and overview diagnostics

Goal:
save the completed premium investor terminal visual pass before moving from visual work to internal logic and system behavior.

Files changed:
- `src/components/layout/Sidebar.tsx`
- `src/App.tsx`
- `src/App.css`
- `src/assets/health/ChatGPT Image 24 мая 2026 г., 20_54_33.webp`
- `src/assets/health/health-shield.webp`
- `docs/PATCH_LOG.md`

Details:
- rebuilt Sidebar without the old shared `Panel` wrapper so it behaves as a dedicated glass hardware shell
- added live HTML navigation icons, active state surfaces, HUD accents, micro details and layered sci-fi glass depth
- rebuilt the `Портфель сегодня` block into a premium terminal panel with colored glass cards, icon orbs, sparklines and dynamic PnL display
- preserved investor data, API fetches, portfolio calculations, fallback state and page switching logic
- upgraded the `Здоровье портфеля` block into the same glass/neon system with calmer diagnostic blue/green colors
- replaced the text status badge with the provided `PROTECTED` WebP asset and cleaned the decorative image layer
- aligned the top overview panels and their mini cards on a shared horizontal grid
- kept Allocation, Fear & Greed, Mood, API contracts and Google Sheets bindings unchanged by this patch

Build:
successful

Risks:
- this patch is visually broad and may need small viewport-specific CSS tuning after deployment review
- the protected WebP is a bitmap asset and may need future cropping or transparency cleanup if the source image changes

Rollback:
- revert the `PATCH 6.0` Sidebar/App JSX changes, the appended overview/sidebar/health CSS blocks and the health image assets

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 6.1

Fear & Greed live index repair.

Type:
data integration / safety fallback / lint cleanup

Goal:
restore the Fear & Greed widget to the current live value and prevent the UI from falling back into an overly aggressive `14` buy state when the external request fails.

Files changed:
- `src/config/constants.ts`
- `src/hooks/useFearGreed.ts`
- `vite.config.ts`
- `vercel.json`
- `src/api/investor.ts`
- `src/hooks/useInvestorData.ts`
- `docs/ARCHITECTURE_BASELINE.md`
- `docs/KNOWN_ISSUES.md`
- `docs/PATCH_LOG.md`

Details:
- routed Fear & Greed through `/api/fear-greed` for local Vite and Vercel deployments
- confirmed `alternative.me` returns `34` on 2026-05-26
- changed fallback from `14` to `34` so a failed request does not visually trigger maximum aggressive-buy mode
- preserved the existing widget geometry, buy ladder, API naming and Google Sheets contract
- removed two explicit `any` usages in investor API typing so lint passes

Build:
successful

Risks:
- `/api/fear-greed` depends on the external alternative.me response format staying compatible with `{ data: [{ value }] }`

Rollback:
- restore `FEAR_GREED_API_URL` to the direct external URL and fallback value if the proxy route creates deployment issues

Deployment impact:
requires a normal build and push to GitHub; Vercel must deploy the updated rewrite for `/api/fear-greed`.

---

# PATCH 6.2

Overview risk-position and deployable cash split.

Type:
data normalization / risk UI correction

Goal:
prevent closed or zero-value positions from being shown as the best position, and split the deployable capital card into futures cash and spot cash limits.

Files changed:
- `src/hooks/useInvestorData.ts`
- `src/types/portfolio.ts`
- `src/lib/portfolioCalculations.ts`
- `src/lib/calculations.ts`
- `src/App.tsx`
- `src/App.css`
- `docs/PATCH_LOG.md`

Details:
- derive best and worst overview positions from open non-reserve risk positions instead of trusting stale `overview.bestPosition` values from the API
- exclude `EXITED`, `FIXED`, `CLOSED`, reserve and cash rows from best/worst position selection
- treat `USDC HL` as futures deployable cash and keep it separate from spot stable reserves
- calculate spot deployable cash as spot reserve minus the 30% minimum portfolio reserve rule
- render the overview “Можно пустить в работу” card as two lines: `Фьючерсы` and `Спот`
- mirror the split in the Risk page mini-card without changing the Google Sheets or Apps Script API contract

Build:
successful

Risks:
- spot deployable cash depends on the current 30% reserve rule documented in the risk sheet; if the strategy target changes, this constant should move to API/settings
- futures cash detection currently relies on the `USDC HL` asset naming

Rollback:
- restore best/worst selection to the API `overview.bestPosition`/`worstPosition` fields and render `risk.deployableCash` as a single value

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

---

# PATCH 8.1

Transfer live overview metrics into V2 Lab.

Type:
data mapping / visual-lab integration

Goal:
start moving the correct Investor Cabinet live calculations into the new `/v2-lab` visual without changing the visual geometry or API contract.

Files changed:
- `src/v2/InvestorCabinetV2Lab.tsx`
- `src/v2/components/V2TopMetrics.tsx`
- `src/v2/components/V2Shell.tsx`
- `docs/INVESTOR_CABINET_ROADMAP.md`
- `docs/PATCH_LOG.md`

Details:
- connected V2 Lab top overview metrics to the existing `useInvestorData` flow and `/api/investor` source
- kept mock data as fallback for the rest of the V2 visual
- mapped live `overview.portfolioValue`, `overview.reserve`, `overview.pnl`, `overview.pnlPct`, `overview.state`, `overview.signal`, `overview.positionsCount`
- mapped `risk.deployableCash` into the existing Deployable Capital top card
- kept Health Reactor, right column, lower cards, grid and CSS geometry unchanged
- reapplied numeric font processing when live V2 data refreshes

Build:
successful

Risks:
- V2 Lab still has demo values below the top metric row until later transfer patches
- first render can briefly show cache/fallback before the live API refresh completes

Rollback:
- restore `InvestorCabinetV2Lab` to render `mockData` directly and restore the previous V2 top metric labels

Deployment impact:
requires a normal build and push to GitHub; Vercel should deploy from `main` after push.

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

---

## 2026-07-16 — Ревизия источника истины + мобильная волна 2

Apps Script (деплой /exec @43, URL прежний):
- sheetRevision.gs: две волны фиксов таблицы (см. трекер), идемпотентны
- historySnapshot.gs: F&G пишет живое значение alternative.me в Настройки
- Код.js: overview.realizedPnl / realizedPnlPct (поиск по метке O-колонки)

Frontend (коммиты 57fa128, 7a4d743):
- riskRules.ts: лимиты классов + RESERVE_FLOOR_SHARE 10%
- portfolioHealth.ts: пол резерва (10% = 30 баллов), meta диверсификации
  с конкретикой ребаланса ($ и классы)
- рекомендации Обзор/Здоровье: живые цифры вместо абстрактных фраз
- v2-mobile.css: симулятор, breakdown, DCA-зоны, BTC-график full-bleed,
  стейблы, стейк-карта, разделители блоков позиций

---

## 2026-07-21 — Price alerts «Зона интереса»: Sheets → Apps Script → Telegram → сайт

Назначение:
детерминированные ценовые алерты по зонам интереса. Лист «Сигналы» —
источник истины, минутный триггер сверяет цены Hyperliquid, шлёт Telegram
и отмечает срабатывание в таблице. Ордера не выставляются: alert-only,
исполнение остаётся ручным решением инвестора.

Затронутые файлы:
- apps-script/signalPriceAlerts.gs (новый) — setup/install/remove/audit/sync/rearm
- apps-script/appsscript.json — executionApi.access = MYSELF
- apps-script/Код.js — getSignals(), блок `signals` в JSON API
- src/types/api.ts, src/types/portfolio.ts — контракт InterestSignal
- src/services/investorState.ts, src/services/apiValidation.ts — нормализация и валидация
- src/lib/portfolioCalculations.ts, src/v2/lib/v2LabData.ts — пустой signals в базовом состоянии
- src/v2/components/V2Shell.tsx, V2SignalsPage.tsx — рендер списка «Зона интереса»
- src/v2/styles/v2-btc-chart.css — потолок высоты списка на мобиле

Контракт API:
`signals.interest` (первый сигнал) и `signals.interestList` (все строки листа).
Поля: id, asset, action, amountUsd, triggerPrice, source, currentPrice,
status, lastCheck, triggeredAt, telegram, comment.

Логика срабатывания:
- продажа (id содержит `-SELL-` либо действие «Продать») — при цене >= триггера
- покупка — при цене <= триггера
- отправка только при Telegram-статусе PENDING; после отправки SENT + TRIGGERED
- цены: Hyperliquid allMids; GOLD и SPCXB — через dex=xyz (`xyz:GOLD`, `xyz:SPCX`);
  BTC SHORT сверяется по цене BTC

Аудит 2026-07-21 — исправлено в этом же патче:
- запись в лист батчем (было 23 отдельных setValues в минуту — риск выбрать
  дневную квоту времени триггеров на consumer-аккаунте)
- LockService против наложения минутных прогонов (защита от дублей алертов)
- убрана сверка `result.text` в ответе Telegram: ложное несовпадение оставляло
  сигнал в PENDING и давало дубль каждую минуту
- ошибка на одной строке больше не роняет прогон: статус ERROR, остальные идут дальше
- ручные статусы в колонке H (например PAUSED) переживают синк и снимают сигнал
  с дежурства — раньше затирались на ARMED каждую минуту
- rearmSignalPriceAlert(id) — возврат сигнала на дежурство
- фронт: точность триггера по величине цены (0,3068 вместо 0,31), русские статусы
- мобайл: список ограничен 300px со скроллом (панель занимала 1014px)

Риски:
- квота времени триггеров на gmail-аккаунте (90 мин/сут) — после батча запас ~3x,
  но при росте числа сигналов следить за журналом выполнений
- распознавание продажи завязано на `-SELL-` в id или точное слово «Продать»:
  новые строки нужно заводить в этом же формате
- SPCXB тянется только если колонка «Источник» содержит `xyz:SPCX`

Rollback:
- удалить триггер `syncSignalPriceAlerts` (removeSignalPriceAlertTrigger)
- вернуть в V2SignalsPage статичную заглушку «Диапазоны отключены»
- убрать `signals` из doGet — фронт переживает отсутствие ключа (fallback на пустой список)

Deployment impact:
clasp push + деплой Apps Script; сборка и push в GitHub, Vercel деплоит с `main`.

---

## 2026-07-21 (2) — Сигналы: приоритизация по близости + защита от неверного направления

Назначение:
превратить «Зону интереса» из справки в инструмент приоритизации и убрать
мину, при которой неудачная формулировка действия давала алерт в обратную сторону.

Затронутые файлы:
- apps-script/signalPriceAlerts.gs — распознавание направления, статус CHECK
- src/v2/lib/interestSignals.ts (новый) — расстояние и порядок списка
- test/contracts/interestSignals.test.ts (новый) — 7 тестов
- src/v2/components/V2SignalsPage.tsx — расстояние в строке, сортировка
- src/v2/styles/v2-btc-chart.css — вёрстка третьей колонки

Направление сигнала:
- по корням слов, а не точному совпадению: «Продать/Продажа/Продай/Фиксация/
  Зафиксировать/Сократить/Разгрузить/Выход/Тейк/Профит/SELL/TP» → продажа;
  «Купить/Покупка/Докупить/Добор/Добрать/Добавить/Набор/Вход/Откуп/BUY/DCA» → покупка
- маркеры `-SELL-` / `-BUY-` в id имеют равный вес; расхождение id и действия = отказ
- признаки инструмента (шорт/лонг) намеренно НЕ участвуют: «закрыть шорт» это
  покупка, а «добавить в шорт» продажа — по названию позиции направление не выводится
- неоднозначность («Продать/добавить») → null, алерт не уходит
- проверено 25 кейсами, все 23 боевых сигнала распознаются верно

Защита от ошибки заведения (главное):
если строка ещё ни разу не проверялась (пустой `Последняя проверка`), а условие
срабатывания уже выполнено — это не касание цены, а ошибка ввода. Статус `CHECK`,
алерт не уходит. `CHECK` не входит в список статусов скрипта, поэтому строка
остаётся снятой с дежурства до решения инвестора. Эта проверка ловит неверное
направление независимо от формулировки.

UI «Зона интереса»:
- в строке расстояние до срабатывания: `↑ 1,2%  $23,75` (стрелка = куда должна
  идти цена), под ним статус и текущая цена
- ближе 3% — акцентная подсветка (один холодный цвет, без радуги)
- порядок: сломанные (CHECK/ERROR) → ждущие по близости → без цены → сработавшие.
  Порядок строк таблицы для приоритизации бесполезен

Риски:
- при заведении нового сигнала ждать одного прогона триггера: если строка сразу
  получила CHECK — проверить направление и уровень, затем rearmSignalPriceAlert(id)
- словарь корней не покрывает произвольные формулировки; нераспознанное молчит,
  а не гадает

Rollback:
- вернуть IC_SIGNAL_ALERT_shouldTrigger_ и убрать ветки CHECK
- в V2SignalsPage рендерить interestSignals напрямую без sortByProximity

Deployment impact:
clasp push + сборка и push в GitHub, Vercel деплоит с `main`.

---

## 2026-07-21 (3) — Зона интереса: сетка монет вместо списка из 23 строк

Назначение:
23 строки подряд читались тяжело. Теперь панель — сетка из 10 монет
(эмблема + тикер + близость ближайшей точки), детали раскрываются по нажатию.

Затронутые файлы:
- src/v2/lib/interestSignals.ts — groupByAsset()
- test/contracts/interestSignals.test.ts — 3 теста на группировку (всего 10)
- src/v2/components/V2SignalsPage.tsx — сетка монет, раскрытие, подсказка
- src/v2/styles/v2-btc-chart.css — стили сетки; удалены мёртвые
  .v2-sig-int-head и .v2-sig-int-asset

Поведение:
- порядок монет — по близости их ближайшей точки; монета со снятой с дежурства
  строкой (CHECK/ERROR) поднимается наверх с пометкой «проверить»
- на кнопке: логотип (CryptoLogo, GOLD берёт эмблему GOLD LONG; GRAM и SPCXB
  идут через глиф-фолбэк), тикер, близость. Ближе 3% — акцентная рамка
- повторное нажатие сворачивает
- пока ничего не выбрано, под сеткой строка «Ближайшая точка» — панель
  отвечает «за чем следить сегодня» без единого клика
- сработавшие точки не считаются ждущими и не задают близость актива

Проверено:
- десктоп 1280×720: сетка 3 ряда, кнопки одной высоты (84px), геометрия
  страницы прежняя, соседние панели не поехали
- мобиль 375×812: 4 монеты в ряд, переполнений нет, горизонтальной прокрутки нет
- tsc, lint, 81 тест — зелёные

Риски:
- новые активы без эмблемы в CryptoLogo получают глиф из первой буквы;
  при добавлении монеты стоит завести логотип

Rollback:
- вернуть рендер orderedSignals списком (sortByProximity) и убрать сетку

Deployment impact:
только фронтенд: сборка и push в GitHub, Vercel деплоит с `main`.
Apps Script не затронут.

---

## 2026-07-21 (4) — Итог дня: сигналы, мобайл, ясность данных, масштаб десктопа

Сводка изменений за сессию. Все проверки зелёные: lint, tsc, 86 тестов,
API отвечает, минутный триггер алертов работает.

### Слой сигналов
- price alerts Sheets → Apps Script → Hyperliquid → Telegram: батч-запись,
  LockService, устойчивое распознавание направления, статус CHECK против
  ошибок заведения, `rearmSignalPriceAlert(id)`
- «Зона интереса» на сайте: расстояние до срабатывания (% и $), сортировка
  по близости, сетка монет с раскрытием точек

### Учёт
- корень потери сделок: балансы читались разными RPC-запросами с 'latest',
  снимок собирался наполовину. Теперь единый блок на прогон (Arbitrum и BNB)
- восстановление продажи ETH от 21.07 и объёма сделки 14.07 по блокчейну

### Мобильная версия
- отчёты: карточки вместо горизонтального свайпа (было видно 2 колонки из 10)
- боковое меню: box-sizing и safe-area — панель была на 28px шире экрана
- модалка health-фактора, полоса факторов, «Свободные деньги» — обрезанный текст
- нижнее меню: 4 раздела плашками-ячейками с неоновой подсветкой активной

### Ясность и доверие (по итогам кастдэва)
- метки происхождения данных: расчёт / внешний API / ручной ввод.
  Вскрылось, что в интерфейсе два разных числа реализованной прибыли
  из разных источников — теперь помечены оба
- настройки: язык/валюта/тема переключались, но никуда не сохранялись —
  заменены на факты
- база шкалы рядом с индексом страха: «25 / 100»
- диверсификация калибрована по манифесту: идеальный по политике портфель
  давал 75 и компонент горел вечно. Теперь 100. На живых данных 48 → 64,
  Health Factor 83 → 85

### Панель уведомлений и Escape
- колокольчик открывает список горящего: точки интереса, перевес позиций,
  просадка Health Factor, резерв. Единый движок с страницей «Сигналы»
- Escape закрывает все модалки (общий хук useEscapeClose)

### Десктопный масштаб (правка Codex, проверена)
- `Math.min(1, ...)` снят: большие экраны масштабируют сцену вверх
- проверено: 1920×1057 → scale 0.9787, сайдбар 38px (эталон владельца);
  2560×1440 → 1.333; 3840×2160 → 2. Горизонтального overflow нет

### Надёжность загрузки
- AbortError больше не логируется как ошибка (штатная отмена запроса)
- одна повторная попытка на 5xx: транзиентный 502 прокси больше не роняет
  данные в кэш/fallback

---

## 2026-07-21 (5) — V2 baseline перед Patch 3: Risk & Health manifesto

Назначение:
зафиксировать рабочую версию 2 сайта перед началом большого Patch 3 по
Risk & Portfolio Health. Этот патч не меняет runtime-код, API, Apps Script,
Google Sheets или UI. Он сохраняет архитектурную точку, от которой безопасно
начинать длинную переработку фактора здоровья, движка выживаемости, движка
решений, предварительного калькулятора сделки, журнала сделок и поведенческого
движка.

Затронутые файлы:
- `docs/RISK_AND_PORTFOLIO_HEALTH_MANIFEST.md`
- `docs/RISK_HEALTH_IMPLEMENTATION_ROADMAP.md`
- `docs/RISK_HEALTH_STAGE0_AUDIT_2026-07-21.md`
- `docs/PORTFOLIO_HEALTH_AUDIT_2026-07-21.md` удалён как устаревшая форма
  разового аудита
- `docs/HANDOFF.md`
- `docs/INVESTOR_CABINET_ROADMAP.md`
- `docs/CODEX_TRACKER_2026-07-19.md`
- `docs/PATCH_LOG.md`

Что зафиксировано:
- старый аудит превращён в главный документ проекта:
  `RISK_AND_PORTFOLIO_HEALTH_MANIFEST.md`
- создана дорожная карта внедрения по этапам от фактора здоровья v2 до
  поведенческого движка
- выполнен аудит этапа 0 только на чтение текущих полей программного интерфейса,
  таблиц, здоровья, риска и проверки сделки
- выбрана следующая безопасная зона работы:
  этап 1А — контроль риска
- подтверждено: 10% активной торговли — жёсткий лимит, а не цель пополнения
- подтверждено: таблицы и программный интерфейс остаются источником фактов
- подтверждено: интерфейс и код не тронуты до готовности расчётной модели

Откат / контрольная точка:
- git tag: `v2-baseline-pre-patch3-2026-07-21`
- откат к состоянию перед патчем 3: перейти или откатиться к этому тегу/коммиту
- откат исполняемого кода не требуется, потому что патч только документальный

Влияние на публикацию:
только документы. Отправка в GitHub нужна как сохранение базовой точки; публикация
Vercel с `main` не должна менять поведение сайта.

---

## 2026-07-22 — Патч 3, этап 1А: контроль риска

Назначение:
исправить трактовку 10% активной торговли. Это максимально допустимая рисковая
часть капитала, а не цель для обязательного пополнения.

Что изменено:
- свободный остаток до лимита 10% больше не снижает здоровье портфеля;
- штраф начинается только при превышении лимита, нарушении плеча, лишних позициях
  или близкой ликвидации;
- рекомендации больше не предлагают «пополнить фьючерсный счёт до 10%»;
- вместо этого система показывает, сколько занято, сколько осталось до лимита
  и насколько лимит превышен;
- подробный анализ здоровья объясняет фьючерсы через контроль риска, а не через
  выполнение плана пополнения;
- луч переименован в «Контроль риска»;
- в метаданные луча добавлены формула, предупреждения и жёсткие блокировки;
- жёсткие блокировки: превышение 10%, превышение плеча, больше 3 активных
  позиций, слишком близкая ликвидация;
- тесты закрепляют новое правило: 0%, 5% и 10% лимита не штрафуются, превышение
  лимита штрафуется, блокировки попадают в расчёт.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю;
- расчёт покупок, продаж и средней цены входа.

Критерий готовности этапа:
фьючерсный блок перестал быть целью пополнения и стал лучом «Контроль риска»
с формулой, предупреждениями и жёсткими блокировками.

---

## 2026-07-22 — Патч 3, этап 1Б: резерв

Назначение:
довести луч «Резерв» до правил гексагона здоровья: формула, предупреждения,
жёсткие блокировки и понятное объяснение в подробном анализе.

Что изменено:
- резерв закреплён как коридор: пол 10%, цель 30%, норма 30–60%;
- ниже 10% включается жёсткая блокировка;
- 10–30% показывает предупреждение о недоборе до цели;
- выше 60% показывает предупреждение о простаивающем капитале;
- в метаданные луча добавлены формула, предупреждения, блокировки, дефицит до
  пола, дефицит до цели и сумма сверх верхней границы;
- подробный анализ луча показывает формулу и причины;
- тесты закрепляют три состояния: ниже пола, норма, выше коридора.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю.

---

## 2026-07-22 — Патч 3, этап 1Г: концентрация

Назначение:
довести луч «Концентрация» до правил гексагона здоровья: он должен показывать
не просто общий балл, а конкретный актив, его лимит, степень использования лимита
и запрет на докупку/усреднение сверх лимита.

Что изменено:
- луч использует существующий единый расчёт концентрации из проверки сделки;
- добавлены метаданные: формула, блокировки и предупреждения;
- превышение лимита конкретного актива стало жёсткой блокировкой луча;
- приближение к лимиту от 85% стало предупреждением;
- добавлено правило спота: под альткоины есть только 3 места по 5%;
- новая 4-я альтмонета блокируется в проверке сделки;
- для акций зафиксировано: класс 10%, один актив 5%, максимум 2 акции;
- для металлов зафиксировано: класс 10%, один актив 5%, максимум 2 металла;
- подробный анализ прямо пишет, какой актив нельзя докупать или усреднять;
- тесты закрепляют превышение лимита, близость к лимиту и заполненные
  альткоин-места.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю.

---

## 2026-07-22 — Патч 3, этап 1В: диверсификация

Назначение:
довести луч «Диверсификация» до правил гексагона здоровья: он должен оценивать
устойчивость распределения рискового капитала по спотовым классам, не смешиваясь
с резервом, кэшем и фьючерсами.

Что изменено:
- луч учитывает только крипту, металлы и акции;
- кэш, резерв и фьючерсы явно не входят в расчёт диверсификации;
- добавлены метаданные: крупнейший класс, доля крупнейшего класса в рисковой
  части, число активных классов, отсутствующие классы;
- добавлена жёсткая блокировка, если весь рисковый капитал находится в одном
  спотовом классе;
- добавлены предупреждения, если крупнейший класс выше 80% рисковой части или
  отсутствует один из спотовых классов;
- подробный анализ показывает формулу, блокировки и предупреждения;
- тесты закрепляют норму, один класс и отсутствующий класс.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю.

---

## 2026-07-22 — Патч 3, этап 1Д: выживаемость

Назначение:
заменить старый луч «Сопротивление волатильности» на луч «Выживаемость»,
который отвечает на главный вопрос: выдержит ли портфель сильное падение рынка
без разрушения резерва и структуры капитала.

Что изменено:
- видимый луч переименован в «Выживаемость»;
- внутренний технический ключ оставлен прежним, чтобы не ломать контракт;
- добавлены сценарии v1: крах крипты, падение акций США, обвал золота и
  металлов, общий рыночный шок;
- сценарий металлов усилен до −50%, чтобы отдельно проверять риск падения
  золота и защитных активов;
- добавлен расчёт худшего сценария, оценочной просадки, капитала после шока и
  покупательской способности после шока;
- план лимитных ордеров включён как отдельный фактор готовности; если источник
  данных ещё не подключён, луч честно показывает предупреждение;
- худший сценарий выше 60% просадки стал жёсткой блокировкой;
- отсутствие покупательской способности после шока стало жёсткой блокировкой;
- лимитные ордера, которые съедают всю покупательскую способность, стали
  жёсткой блокировкой;
- просадка выше 40%, низкая покупательская способность после шока и отсутствие
  подключённого плана лимитных ордеров стали предупреждениями;
- подробный анализ показывает формулу, блокировки и предупреждения;
- рекомендации теперь говорят не про абстрактную волатильность, а про лимитные
  ордера, покупательскую способность и устойчивость после падения;
- тесты закрепляют нормальное и блокирующее состояния луча.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю.

---

## 2026-07-22 — Патч 3, этап 1Е: дисциплина

Назначение:
заменить старый луч «Гибкость» на луч «Дисциплина», чтобы гексагон здоровья
не дублировал резерв и покупательскую способность, а отдельно показывал
целостность процесса принятия решений.

Что изменено:
- видимый луч переименован в «Дисциплина»;
- внутренний технический ключ оставлен прежним, чтобы не ломать контракт;
- добавлена формула дисциплины: журнал решений, поведение и блокеры;
- убыточная сделка по правилам не штрафуется;
- прибыльная сделка против правил считается дисциплинарным нарушением;
- добавлены поведенческие маркеры: покупка из страха упустить рост,
  сделка-месть и переторговка;
- активный дисциплинарный блокер, сделка-месть, переторговка и повторяющаяся
  покупка из страха упустить рост стали жёсткими блокировками;
- неподключённый журнал решений и неподключённые поведенческие маркеры стали
  предупреждениями, а не фальшивой нормой;
- подробный анализ показывает формулу, блокировки и предупреждения;
- рекомендации теперь говорят про журнал решений и паузу на сделки вне плана;
- лестница уровней больше не использует видимое название «Гибкость»;
- тесты закрепляют нейтральное состояние без источников данных и блокирующее
  состояние при нарушениях дисциплины.

Что не изменено:
- структура таблиц;
- контракт программного интерфейса;
- геометрия интерфейса;
- источник фактов по портфелю.
