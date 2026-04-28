---
title: 'Tasks: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: tasks
status: unread
review_status: pending
---

# Tasks: Avionics App Scaffold

Ordered by dependency. Each phase ends with `bun run check` clean and a suggested commit. The implementing agent should not skip phases or reorder them.

## Phase 0 -- Pre-flight

Read these files before writing anything. The point is to copy patterns, not invent them.

- [ ] [docs/products/avionics/work-packages/avionics-app-scaffold/spec.md](spec.md)
- [ ] [docs/products/avionics/work-packages/avionics-app-scaffold/design.md](design.md)
- [ ] `apps/sim/svelte.config.js` -- canonical CSP + alias block to mirror
- [ ] `apps/sim/src/app.html` -- canonical `data-app-id`, `data-theme`, `data-appearance` shape
- [ ] `apps/sim/src/app.d.ts` -- `App.Locals` shape
- [ ] `apps/sim/src/hooks.server.ts` -- request-id, session hydration, theme pre-hydration
- [ ] `apps/sim/src/lib/server/auth.ts` and `apps/sim/src/lib/server/cookies.ts`
- [ ] `apps/sim/src/routes/+layout.server.ts` and `apps/sim/src/routes/+layout.svelte`
- [ ] `apps/sim/package.json` -- workspace deps shape
- [ ] `apps/sim/vite.config.ts`
- [ ] `apps/hangar/svelte.config.js` -- second exemplar of the same pattern
- [ ] `libs/bc/sim/package.json` and `libs/bc/sim/src/index.ts` -- BC-package shape
- [ ] `libs/bc/sim/src/types.ts` -- type-doc style to follow
- [ ] `libs/constants/src/routes.ts`, `ports.ts`, `hosts.ts`, `schemas.ts`
- [ ] `libs/themes/sim/glass/index.ts` -- the theme avionics will use
- [ ] `libs/themes/resolve.ts` (or equivalent) -- the route-safety lock to extend
- [ ] `apps/sim/src/lib/instruments/AttitudeIndicator.svelte` and `Asi.svelte` -- prior-art on instrument SVG composition (do not extract; the PFD tape style is its own thing -- but borrow what's good)
- [ ] `apps/sim/src/lib/panels/KeyboardCheatsheet.svelte` -- legend pattern
- [ ] `scripts/dev.ts`, `scripts/check.ts`, `scripts/setup.ts`
- [ ] `docs/agents/best-practices.md`
- [ ] `docs/agents/reference-sveltekit-patterns.md`
- [ ] `docs/agents/common-pitfalls.md`

## Phase 1 -- Constants and workspace wiring

Land the typed contract surface first so every later phase imports clean names.

- [ ] `libs/constants/src/ports.ts` -- add `AVIONICS: 9630`
- [ ] `libs/constants/src/hosts.ts` -- add `HOSTS.AVIONICS`, `HOST_PREFIXES.AVIONICS`
- [ ] `libs/constants/src/schemas.ts` -- add `AVIONICS: 'avionics'` plus a docblock matching the existing entries' style
- [ ] `libs/constants/src/routes.ts` -- new "Avionics" block, ordered alphabetically with the existing app blocks. Entries:
  - `AVIONICS_HOME: '/'` (surface index)
  - `AVIONICS_PFD: '/pfd'` (PFD demo)
  - `AVIONICS_MFD: '/mfd'` (placeholder)
  - `AVIONICS_SCAN: '/scan'` (placeholder)
  - `AVIONICS_AIRCRAFT: '/aircraft'` (aircraft selector)
- [ ] If `libs/constants/src/units.ts` does not exist, create it with `MPS_TO_KNOTS = 1.943_844_492` (used by avionics for FDM-config -> knots conversion). If it exists, add the constant there.
- [ ] Verify `libs/constants/src/index.ts` re-exports the new constants (it already wildcards each file -- confirm)
- [ ] Root `tsconfig.json` -- add `@ab/bc-avionics` and `@ab/bc-avionics/*` path entries next to `@ab/bc-sim`
- [ ] `apps/study/svelte.config.js` -- alias `@ab/bc-avionics` and `@ab/bc-avionics/*`
- [ ] `apps/sim/svelte.config.js` -- alias `@ab/bc-avionics` and `@ab/bc-avionics/*`
- [ ] `apps/hangar/svelte.config.js` -- alias `@ab/bc-avionics` and `@ab/bc-avionics/*`
- [ ] `bun run check` -- clean
- [ ] Commit: `chore(constants): reserve avionics host/port/schema/routes + MPS_TO_KNOTS`

## Phase 2 -- BC scaffold

Provision the BC contract surface before the app needs to import from it.

- [ ] `libs/bc/avionics/package.json` -- mirror `libs/bc/sim/package.json` exactly: `name: '@ab/bc-avionics'`, `private: true`, `type: 'module'`, exports `.`, `./*`, `./package.json`. Deps: `@ab/auth`, `@ab/constants`, `@ab/db`, `@ab/utils` (`workspace:*` each)
- [ ] `libs/bc/avionics/src/types.ts` -- define `Attitude`, `AirData`, `NavData`, `AvionicsTelemetry`. Plain interfaces, structured-clone-safe, doc-commented in the same style as `libs/bc/sim/src/types.ts`
- [ ] `libs/bc/avionics/src/index.ts` -- barrel re-exporting the four types as named exports
- [ ] `bun install` -- workspace picks up the new package
- [ ] `bun run check` -- clean
- [ ] Commit: `feat(bc-avionics): scaffold BC with attitude/airdata/navdata types`

## Phase 3 -- App scaffold (no PFD yet)

Stand up the empty avionics app proving auth, theme, chrome, and dev wiring.

- [ ] `apps/avionics/package.json` -- `@ab/avionics`, port 9630 dev script, deps mirror `apps/sim/package.json` minus `three` (avionics doesn't render 3D today): `@ab/auth`, `@ab/bc-avionics`, `@ab/constants`, `@ab/db`, `@ab/utils`. No `three`.
- [ ] `apps/avionics/svelte.config.js` -- copy from `apps/sim/svelte.config.js`. Keep CSP block identical. Alias section: every alias sim has, plus `@ab/bc-avionics` (replacing `@ab/bc-sim` is wrong -- avionics should still be able to import sim BC types in case the FDM coupling lands later; mirror sim's full alias list and add `@ab/bc-avionics`).
- [ ] `apps/avionics/vite.config.ts` -- mirror sim's, swap `HOSTS.SIM` for `HOSTS.AVIONICS`
- [ ] `apps/avionics/tsconfig.json` -- mirror sim's
- [ ] `apps/avionics/static/favicon.svg` -- copy sim's for now (a per-app favicon is its own polish task)
- [ ] `apps/avionics/src/app.html` -- copy sim's; change `data-app-id="avionics"` and the `<title>airboss avionics</title>`. Do NOT hardcode `data-theme` / `data-appearance`; the pre-hydration script writes them based on the user's preference (avionics participates in the full light/dark theme system).
- [ ] `apps/avionics/src/app.d.ts` -- copy sim's (`App.Locals` identical)
- [ ] `apps/avionics/src/lib/server/auth.ts` -- copy sim's
- [ ] `apps/avionics/src/lib/server/cookies.ts` -- copy sim's verbatim (already encodes the `Domain=.airboss.test` cross-subdomain scope)
- [ ] `apps/avionics/src/hooks.server.ts` -- copy sim's; only the docblock changes ("avionics hooks" instead of "sim hooks")
- [ ] `apps/avionics/src/routes/+layout.server.ts` -- copy sim's (already surfaces `studyLoginUrl`, `appearance`, `theme`, `isAuthenticated`); add `selectedAircraftId` resolution from a cookie (default `SIM_AIRCRAFT_IDS.C172`)
- [ ] `apps/avionics/src/routes/+layout.svelte` -- copy sim's; change brand label to `airboss / avionics`. Keep auth banner. Keep theme picker fully functional (no lock).
- [ ] `apps/avionics/src/routes/+page.svelte` -- placeholder (will be replaced in Phase 5 with the real card grid). For now: a stub `<h1>` so the app renders.
- [ ] `apps/avionics/src/routes/+page.ts` -- empty load (no redirect; `/` is the home page, not a redirect target)
- [ ] `scripts/dev.ts` -- add `avionics` entry to `DEV_URLS`
- [ ] `scripts/check.ts` -- add an `svelte-check` run for `apps/avionics/`
- [ ] `bun install` -- pick up the new app
- [ ] `bun run check` -- clean
- [ ] Manual smoke: add `127.0.0.1 avionics.airboss.test` to `/etc/hosts`, run `bun run dev avionics`, visit `https://avionics.airboss.test`, expect the placeholder `/` to render in both light and dark appearance (toggle via the picker)
- [ ] Commit: `feat(avionics): scaffold app shell with auth, theme, chrome`

## Phase 4 -- Avionics theme tokens (light + dark)

The PFD must look correct in both appearances. This phase lands the tokens before any instrument component reads them.

- [ ] Inspect the existing `sim/glass` token set; note any `--sim-pointer` / `--sim-arc-*` tokens
- [ ] Add `--avionics-sky`, `--avionics-ground`, `--avionics-pointer`, `--avionics-arc-white`, `--avionics-arc-green`, `--avionics-arc-yellow`, `--avionics-arc-red` to the global theme token set, defined for both light and dark appearances. Values per the table in [design.md](design.md#pfd-rendering-light-and-dark).
- [ ] Regenerate `libs/themes/generated/tokens.css`
- [ ] Update or add a contract test in `libs/themes/__tests__/` that asserts every `--avionics-*` token is present in both appearances
- [ ] `bun run check` -- clean
- [ ] Commit: `feat(themes): add avionics token roles for light + dark`

## Phase 5 -- Home page, placeholder pages, aircraft selector

The full route surface lands before the PFD so the home page links are real on day one.

### 5a. Home page (card grid)

- [ ] `apps/avionics/src/routes/+page.svelte` -- replace the Phase 3 stub with the card grid. Cards link to `ROUTES.AVIONICS_PFD`, `ROUTES.AVIONICS_MFD`, `ROUTES.AVIONICS_SCAN`, `ROUTES.AVIONICS_AIRCRAFT`. Each card has a heading and a one-line description. All copy final-draft. Token-driven; no hex.
- [ ] `apps/avionics/src/routes/+page.ts` -- empty load (no redirect)

### 5b. MFD placeholder

- [ ] `apps/avionics/src/routes/mfd/+page.svelte` -- polished placeholder. Layout: page title "Multi-Function Display", a paragraph explaining what an MFD is (map, traffic, weather, system pages) and how it complements the PFD, a "coming soon" section listing planned slices (map page, traffic, weather), a "back to avionics" link to `ROUTES.AVIONICS_HOME`. Copy is final-draft, not lorem ipsum. Token-driven.
- [ ] `apps/avionics/src/routes/mfd/+page.ts` -- empty load

### 5c. Scan trainer placeholder

- [ ] `apps/avionics/src/routes/scan/+page.svelte` -- polished placeholder. Layout: page title "Instrument Scan", a paragraph explaining the cross-check sweep across the six instruments and why a glass surface needs its own scan trainer (different scan pattern from round-dial), a "coming soon" section describing what the scored drill will look like (target dwell, sequence checks, calibration to learner pace), a "back to avionics" link. Final-draft copy.
- [ ] `apps/avionics/src/routes/scan/+page.ts` -- empty load

### 5d. Aircraft selector

- [ ] `apps/avionics/src/routes/aircraft/+page.svelte` -- list aircraft from `listAircraftConfigs()` / `AIRCRAFT_REGISTRY` (from `@ab/bc-sim`). Show C172 as selectable (radio or button); show PA28 (and any other entries) as disabled with "coming soon" note. Display the currently selected aircraft prominently. Form submits to the page action.
- [ ] `apps/avionics/src/routes/aircraft/+page.server.ts` -- form action that writes the `avionics_selected_aircraft` cookie (scoped to `Domain=avionics.airboss.test` -- per-app, not cross-subdomain). Validate the submitted id is a member of `SIM_AIRCRAFT_IDS` and is in the allow-list (today: only C172).
- [ ] Update `apps/avionics/src/routes/+layout.server.ts` to read the cookie and expose `selectedAircraftId` on the page data; default `SIM_AIRCRAFT_IDS.C172`.

### 5e. PFD shell (no instruments yet)

Land the PFD page, the layout, the slider strip, and the rAF loop. No instruments yet -- just the chrome that holds them.

- [ ] `apps/avionics/src/lib/pfd/pfd-types.ts` -- local view types: `PfdInputBindings`, `PfdEasingConfig`
- [ ] `apps/avionics/src/lib/pfd/pfd-tick.svelte.ts` -- rAF loop, per-channel critically-damped low-pass, easing constants object documented as the "feel" surface, visibility-API pause, `$effect`-based cleanup
- [ ] `apps/avionics/src/lib/pfd/Pfd.svelte` -- layout shell. Grid: ASI tape | Attitude | ALT tape + VSI; heading strip across the bottom. Each cell gets a placeholder `<div>` for now.
- [ ] `apps/avionics/src/lib/pfd/PfdInputs.svelte` -- slider strip with the six inputs from the [spec](spec.md#inputs). Use `@ab/ui` form primitives.
- [ ] `apps/avionics/src/lib/pfd/PfdKeyboardLegend.svelte` -- `?`-toggled overlay; copy the structure from `apps/sim/src/lib/panels/KeyboardCheatsheet.svelte`, swap the bindings.
- [ ] Wire keyboard handlers in `Pfd.svelte` for the bindings in [spec.md](spec.md#inputs); reuse `apps/sim/src/lib/control-handler.ts`-style approach where it fits but live inside the avionics app for now
- [ ] `apps/avionics/src/routes/pfd/+page.svelte` -- renders `<Pfd />` full-bleed; reads `selectedAircraftId` from page data and passes it to `<Pfd>` (for V-speed sourcing in Phase 6)
- [ ] `apps/avionics/src/routes/pfd/+page.ts` -- empty load
- [ ] `bun run check` -- clean
- [ ] Manual smoke: visit `/`, click each card, confirm every route renders. Visit `/pfd`, see the empty grid, confirm sliders move, confirm `?` toggles legend, confirm keyboard shortcuts wiggle the bound state values. Visit `/aircraft`, confirm C172 is selected by default and the cookie persists across reloads.
- [ ] Commit: `feat(avionics): home grid, MFD/scan placeholders, aircraft selector, PFD shell`

## Phase 6 -- Instruments

One instrument per task. Each compiles, types clean, renders against current bindings, and ships green-arc/yellow-arc/red-line where the instrument calls for it. Order by dependency-of-debugging: attitude first (it's the centerpiece), then airspeed (most arc complexity), then altitude (rolled counter is the trickiest readout), then heading, then VSI.

- [x] `tools/theme-lint/rules.ts` -- register `--avionics-*` token vocab via `KNOWN_PREFIXES` so PFD components can reference the theme tokens without theme-lint failing.
- [x] `apps/avionics/src/lib/pfd/AttitudeIndicator.svelte` -- pitch ladder every 5deg, labels every 10, sky-blue/ground-brown halves with the horizon line, bank pointer arc with 10/20/30/45/60 ticks. Props: `pitchDeg: number`, `rollDeg: number`. SVG only. All colors via theme tokens.
- [x] `apps/avionics/src/lib/pfd/airspeed-arcs.ts` -- export `AirspeedArcBands` interface and `arcBandsFromConfig(cfg: AircraftConfig): AirspeedArcBands`. Reads `vS0`, `vS1`, `vFe`, `vNo`, `vNe` from the config (m/s) and converts to knots using `MPS_TO_KNOTS` from `@ab/constants`. No magic numbers; no aircraft-specific hardcodes.
- [x] `apps/avionics/src/lib/pfd/AirspeedTape.svelte` -- vertical tape, current value boxed at center, arc bands (white = flap-extended range Vs0..Vfe, green = normal Vs1..Vno, yellow = caution Vno..Vne, red line = Vne) drawn against the tape edge. Props: `airspeedKnots: number`, `arcs: AirspeedArcBands`. The component is aircraft-agnostic; the band positions come from the prop.
- [x] `apps/avionics/src/lib/pfd/Pfd.svelte` -- import `getAircraftConfig` from `@ab/bc-sim` and `arcBandsFromConfig` from the local module; resolve `arcs` from the page-data `selectedAircraftId` and pass to `<AirspeedTape arcs={...} />`.
- [x] `apps/avionics/src/lib/pfd/AltitudeTape.svelte` -- vertical tape, hundreds at the digits, thousands rendered as a rolled-counter (use a translateY on a stack of digits clipped by an aperture). Props: `altitudeFeet: number`.
- [x] `apps/avionics/src/lib/pfd/HeadingIndicator.svelte` -- horizontal compass strip across the bottom, current heading boxed at top-center, cardinal labels at N/E/S/W, ticks every 10deg with major label every 30deg. Props: `headingDegMag: number`.
- [x] `apps/avionics/src/lib/pfd/VsiIndicator.svelte` -- vertical strip, +/-2000 fpm scale with major ticks at 1000 fpm, current pointer animates smoothly. Props: `verticalSpeedFpm: number`.
- [x] `apps/avionics/src/lib/pfd/Pfd.svelte` -- replace the five placeholder cells with the real instruments. Bindings flow: `<PfdInputs>` -> `$state` targets -> `pfd-tick.svelte.ts` rendered values -> instrument props.
- [x] `bun run check` -- clean after every instrument; final pass after the full integration (clean modulo pre-existing libs/ui handbooks tests)
- [ ] Manual smoke: drag every slider, confirm every instrument responds, confirm the rAF easing makes movement feel smooth (no stair-stepping), confirm the keyboard shortcuts work
- [x] Commit per instrument: `feat(avionics): {instrument} component`. Final commit: `feat(avionics): wire PFD instruments + tick loop`

## Phase 7 -- Polish + theme audit

- [ ] Grep `apps/avionics/` for inline hex (`#[0-9a-f]{3,6}`) -- expect zero matches. Any hit moves to a token in the `sim/glass` theme.
- [ ] Grep `apps/avionics/` for path strings starting with `/` outside `routes.ts` -- expect zero matches outside the routes constant
- [ ] Grep `apps/avionics/` for magic numbers in instrument code (literals not pulled from a named constant) -- expect zero matches in the easing/arcs domains; layout literals (e.g., SVG viewport sizes) are fine inline
- [ ] Run `bunx biome format --write` on staged files
- [ ] `bun run check` -- clean
- [ ] Commit: `chore(avionics): polish and token audit`

## Phase 8 -- Resolve the deferred extract-sim-instruments WP

The user-zero rule: no undecided "considerations for future work". This WP triggers the deferred `extract-sim-instruments` WP, so resolve it now.

- [ ] Edit `docs/work-packages/extract-sim-instruments/spec.md`:
  - Keep `status: deferred`
  - Change `trigger:` from "when `apps/avionics/` is created" to "when PFD components have a second consumer (sim glass-cockpit overlay, avionics MFD, or another tape-style instrument page)"
  - Rename the heading to "Promote PFD components to `libs/activities/pfd/`"
  - Replace the existing "Scope" section with the promotion-not-extraction approach: move `apps/avionics/src/lib/pfd/` -> `libs/activities/pfd/` once a second consumer materialises. Sim's round-dial instruments are not in scope; they remain in `apps/sim/`.
  - Add a "Resolved by" line crediting this WP for the rewrite
- [ ] Commit: `docs(extract-sim-instruments): rewrite trigger as second-consumer-of-PFD`

## Phase 9 -- Manual QA

The user runs through the [test plan](test-plan.md) end-to-end before the WP can close. The agent does not check off the user-controlled items.

- [ ] User adds `127.0.0.1 avionics.airboss.test` to `/etc/hosts`
- [ ] User walks the test-plan happy path
- [ ] User walks at least one item from each test-plan section
- [ ] User signs off `status: done` on each WP doc

## Out-of-repo developer action

- [ ] `/etc/hosts` entry: `127.0.0.1 avionics.airboss.test` (one-time)

## Definition of done

- All phase-1 through phase-8 commits land on the feature branch
- `bun run check` clean
- Manual QA per Phase 9 confirms the surface is alive
- `docs/products/avionics/work-packages/avionics-app-scaffold/*.md` flipped to `status: done` by the user, `review_status: done` by the agent after `/ball-review-full` runs clean
