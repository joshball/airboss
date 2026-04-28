---
title: 'Design: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: design
status: unread
review_status: done
---

# Design: Avionics App Scaffold

Architectural decisions and the why behind them. The spec lists what; this lists why.

## Surface placement

### Avionics is its own app

Three forces argue against folding avionics into `apps/sim/`:

1. **Visual identity divergence.** Sim renders round-dial steam-gauge instruments (`apps/sim/src/lib/instruments/Asi.svelte`, `Altimeter.svelte`, `AttitudeIndicator.svelte` -- all SVG round dials). Avionics renders tape-style glass. A single app's chrome and route layout cannot smoothly host both without a routing-driven wholesale style swap, which is what surface apps are for.
2. **Product-shape divergence.** Sim is a flight-scenario runner -- a list of scenarios on the home page, a cockpit per scenario, a debrief, a history. Avionics is a panel-trainer -- a list of panels on the home page (eventually), a study mode per panel, scan drills. The information architecture barely overlaps.
3. **Architecture doc says so.** [MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) commits to surface-typed apps. Folding here is the precedent we'd later regret.

### Theme: avionics is light + dark, not surface-locked

Avionics participates in the full airboss theme system. The picker on `/avionics/*` is the same picker `/study/*` and `/hangar/*` use. No surface-locked theme registry, no forced appearance. A learner who likes light gets light; dark gets dark; auto follows the system.

This reverses an earlier design that proposed locking `/avionics/*` to `sim/glass` dark via a generalised route-prefix registry. The earlier reasoning was "glass cockpits are dark". The new reasoning is "airboss is one product to a learner moving between surfaces, and the theme picker is part of the platform identity". Locking the picker on a per-surface basis fragments that identity and gates an accessibility/preference choice behind a route.

### PFD rendering: light and dark

The PFD must render correctly in both appearances. This is non-negotiable acceptance for the WP. Glass-cockpit aesthetics typically assume dark, but a token-driven instrument is appearance-agnostic by construction. Every visible color in the PFD comes through a theme token; the same SVG structure recolors in light vs dark via `currentColor` and `var(--token)` references. No hex.

The token map the PFD reads:

| Role                   | Dark appearance reads from        | Light appearance reads from                       |
| ---------------------- | --------------------------------- | ------------------------------------------------- |
| Instrument backplate   | `--surface-panel` (deep black)    | `--surface-panel` (light grey)                    |
| Sky half (attitude)    | `--avionics-sky` (steel blue)     | `--avionics-sky` (lighter steel blue)             |
| Ground half (attitude) | `--avionics-ground` (warm brown)  | `--avionics-ground` (lighter warm brown)          |
| Pitch ladder lines     | `--ink-body`                      | `--ink-body`                                      |
| Pointer / readout box  | `--avionics-pointer` (yellow)     | `--avionics-pointer` (deeper yellow for contrast) |
| Tape minor ticks       | `--ink-muted`                     | `--ink-muted`                                     |
| ASI white arc          | `--avionics-arc-white`            | `--avionics-arc-white`                            |
| ASI green arc          | `--avionics-arc-green`            | `--avionics-arc-green`                            |
| ASI yellow arc         | `--avionics-arc-yellow`           | `--avionics-arc-yellow`                           |
| ASI red line           | `--avionics-arc-red`              | `--avionics-arc-red`                              |

The `--avionics-*` tokens are added to the global theme token set in this WP (one entry per role per appearance). They live alongside the existing `--surface-*` and `--ink-*` tokens; the light/dark branch is handled by the theme system the same way every other token already is. The PFD components reference token names only; the theme defines the values.

If the existing `sim/glass` theme already exports a usable `--sim-pointer`, `--sim-arc-*`, etc., this WP renames them to `--avionics-*` (or aliases) so the PFD doesn't read `--sim-*` from a non-sim surface. Decision recorded in tasks.md Phase 4.

### Theme picker: no per-surface lock, including for avionics

The earlier "generalise the route lock" plan is dropped. If sim is genuinely the only surface that should force a specific appearance (a separate question outside this WP's scope), the existing `/sim/*` predicate can stay as it is -- but avionics will not be added to it.

This removes one task from the WP (the resolver work) and removes one test scenario (the locked-picker check). The picker's existing locked-state UI continues to exist for sim; avionics never triggers it.

## BC layer

### Why provision the BC now

The user explicitly requested provisioning. Reinforcing reasons:

- **Path-alias proliferation cost.** Every `apps/*/svelte.config.js` adds `@ab/bc-avionics` once now, or every-app-times-N times when later we retrofit. One pass is cheaper than three.
- **Type-contract first.** The PFD reads `Attitude`, `AirData`, `NavData`. Defining those in a BC up front, rather than inline in the app, anchors the contract for the next consumer (FDM coupling, drill engine, telemetry replay).
- **Schema namespace reservation.** `avionics` claimed in `SCHEMAS` so the first migration's `CREATE SCHEMA avionics;` lands without re-litigating naming. ADR 004's "one BC = one schema" rule is locally enforced.
- **Locatability.** Future agents grep `libs/bc/avionics/` and find the BC; a missing directory is a search miss that costs time.

### What the BC owns now

```text
libs/bc/avionics/
  package.json
  src/
    index.ts            barrel
    types.ts            Attitude, AirData, NavData, AvionicsTelemetry
```

That's it. No engine, no scenarios, no persistence, no Drizzle schema. The lib exists to host shared types and to claim the alias and namespace.

### What the BC will own later

| Capability                        | When                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| Instrument calibration / setup    | When a "set up your panel" flow ships (pressure altimeter setting, etc.) |
| Failure modes / annunciator state | When avionics consumes sim's `DisplayState` for failure rendering        |
| Drill scenarios                   | When the first scan-trainer drill ships (separate WP)                    |
| Persistence (attempts, scoring)   | With the first scored drill                                              |
| Replay tape                       | If/when avionics drills want sim-style replay                            |

None of these is a TODO inside this WP. Each is a follow-on WP triggered by its own product feature.

### Type design

`Attitude`, `AirData`, `NavData` are split because they correspond to physical sensor groups in real aircraft (AHRS / ADC / VHF nav radio + GPS). The split survives whatever the demo does because real avionics products will read whatever sensor groups they need. Plain data, no functions, structured-clone-safe so a future worker boundary doesn't have to retrofit.

## Routes and surface shape

### Why a card-grid home page, not a redirect

An earlier draft made `/` redirect straight to `/pfd`. That hides the surface. A learner clicking through from `https://avionics.airboss.test` should see the full product line, even when most of it is "coming soon". The card grid is cheap to build, gives the home URL a real identity, and turns every future route addition into "list one more card" rather than "rethink the home page".

### Why placeholder pages, not 404s or "TODO"

`/mfd` and `/scan` are reachable from the home page, so they cannot be missing routes. Two failure modes the WP avoids:

1. **Dead links.** The home card grid lists MFD; clicking it must land somewhere. A 404 makes the surface read as half-built.
2. **Lorem placeholders.** A page that says "TODO" or shows fake content reads as unfinished. The placeholders are real prose explaining the product: what an MFD does, what a scan trainer does, why each lives on the avionics surface, what a learner can expect when it ships. That tone is the difference between "unfinished demo" and "first slice of a product line".

The placeholder pages compose the same chrome, layout, and theme tokens as the PFD. They are not a different design language.

### Aircraft selector lives at `/aircraft`, even with one aircraft

User answer: pin the demo to the current aircraft FDM (C172). Two paths considered:

- **A. No `/aircraft` route; hardcode C172 everywhere in the avionics app.** Smallest code today, biggest retrofit when the second aircraft lands. Every PFD reference to V-speeds is a hardcode that has to be ripped up.
- **B. Build the `/aircraft` route, the cookie, the layout-server hydration, and the `selectedAircraftId` state. List C172 only.** More code today; zero retrofit when the second aircraft lands. The PFD already reads V-speeds against the selected aircraft.

Pick B. The affordance is the load-bearing piece. C172 is what is *selectable* today; the second aircraft (PA28 -- already an FDM in `@ab/bc-sim`) lands as a one-line change to the selectable list, not a structural refactor.

### V-speeds: source from the selected aircraft's FDM, not avionics-local constants

The V-speed numbers (Vs0, Vs1, Vfe, Vno, Vne) are aircraft truth, not avionics presentation. They live with the FDM. `@ab/bc-sim` already exports `C172_CONFIG`, `PA28_CONFIG`, `getAircraftConfig()`, and `AIRCRAFT_REGISTRY`. The PFD imports `getAircraftConfig` and reads V-speeds from the resolved config.

Three options weighed:

- **A. Re-export the V-speed numbers from `@ab/bc-sim` as a separate constants module** (e.g., `C172_V_SPEEDS = { vS0: 33, ... }` in knots). Concrete and easy to import, but duplicates data that already lives in `AircraftConfig`.
- **B. Read directly from `getAircraftConfig(id)` in `@ab/bc-sim`.** No duplication; the FDM is the source of truth; the boundary is a one-call import. The conversion m/s -> knots is a single helper.
- **C. Extract V-speeds into `libs/constants/src/aircraft.ts`.** Decouples them from the FDM, but the FDM uses them too -- now there are two sources of truth.

Pick **B**. Source of truth stays in the FDM (where the physics consumes it). The PFD imports `getAircraftConfig` from `@ab/bc-sim` and uses one shared `MPS_TO_KNOTS` constant for the unit conversion at the boundary.

This pattern is also what the future "PFD coupled to FDM" feature will use when it streams telemetry from a running scenario. The data path is already shaped right.

### Cross-subdomain auth cookie

Confirmed: avionics reads the same `bauth_session_token` cookie sim reads, scoped to `Domain=.airboss.test`. No new auth surface, no new cookie, no per-app session bridging. This is the established pattern; avionics inherits it by copying sim's `lib/server/cookies.ts` and `hooks.server.ts` verbatim.

The aircraft-selection cookie (`avionics_selected_aircraft` or similar) is *not* cross-subdomain -- it is per-app. Sim and avionics may diverge on which aircraft they consider "current". Sim already pins per-scenario; avionics pins per-user-preference. Different shape, different cookie scope (`Domain=avionics.airboss.test` only). Documented here so the cookie scope decision is explicit, not implicit.

## PFD rendering

### SVG vs Canvas vs WebGL

Recommendation: **SVG** for the demo. Reasoning:

| Criterion                          | SVG                                                        | Canvas                                  | WebGL                   |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------------------- | ----------------------- |
| Declarative reactivity in Svelte 5 | Excellent: `transform={...}` updates re-render cheaply     | Manual: imperative draw loop per frame  | Manual: shader pipeline |
| Themable via CSS tokens            | Yes, native via `currentColor`, `var(--...)`, `fill`       | No, colours baked into draw calls       | No, colours baked       |
| DOM-test friendly                  | Yes, components are inspectable in Playwright              | Pixel-test only                         | Pixel-test only         |
| 60fps for 5 instruments            | Yes; DOM update budget is generous at this primitive count | Yes; usually faster but rarely needed   | Overkill                |
| Promotion to a shared lib          | Trivial; components are just SVG markup + props            | Requires draw-API discipline            | Significant             |
| Time to demo                       | Smallest                                                   | Larger; ergonomics fight Svelte's grain | Largest                 |

SVG covers everything the spec asks for. Canvas's only win (raw frame budget under heavy primitive count) does not apply to a 5-instrument PFD. WebGL is the wrong tool here.

The recommendation includes the upgrade path: any single instrument can be reimplemented in Canvas later if profiling reveals a bottleneck. The component shape (props in, frame out) is identical; the swap is local. WebGL stays out of scope until a synthetic-vision (terrain background) feature exists.

### Tick loop pattern

`requestAnimationFrame` driven from a `.svelte.ts` module owned by the PFD page (`apps/avionics/src/lib/pfd/pfd-tick.svelte.ts`).

- Targets are reactive `$state` driven by sliders/keyboard.
- Rendered values are reactive `$state` updated each rAF tick.
- Per-channel critically-damped low-pass between target and rendered. Time constants live in a constants object inside the same `.svelte.ts` (the only "feel" tuning surface).
- `$effect` registers the rAF; cleanup cancels it. Visibility-API pause when tab hidden.
- No coupling to `libs/bc/sim/`'s FDM engine -- the PFD doesn't simulate, it renders. When PFD is later coupled to FDM, the same rAF loop instead reads from the FDM worker stream; the easing layer goes away because FDM truth state is already at 60Hz.

### Component decomposition

```text
apps/avionics/src/lib/pfd/
  Pfd.svelte                   layout shell, owns the rAF tick + slider state
  AttitudeIndicator.svelte     pitch ladder + bank pointer
  AirspeedTape.svelte          vertical tape + boxed readout (reads arc bands from selected aircraft)
  AltitudeTape.svelte          vertical tape + rolled-counter readout
  HeadingIndicator.svelte      horizontal compass strip
  VsiIndicator.svelte          vertical pointer +/-2000 fpm
  PfdInputs.svelte             slider strip
  PfdKeyboardLegend.svelte     `?`-toggled cheatsheet
  airspeed-arcs.ts             arcBandsFromConfig(cfg) -- m/s -> knots conversion
  pfd-tick.svelte.ts           rAF loop + easing constants
  pfd-types.ts                 local view types (input bindings, easing config)
```

Each instrument takes scalar props (pitch, bank, airspeed, ...), no objects, no callbacks. They're pure renderers: identical inputs always produce identical SVG. That's the property that makes promotion to `libs/activities/pfd/` clean later.

`AirspeedTape.svelte` additionally takes an `arcs: AirspeedArcBands` prop computed by `arcBandsFromConfig` from the selected aircraft's `AircraftConfig`. The component itself stays a pure renderer; only the values change with aircraft.

### Theme tokens used

The PFD reads only role tokens. Layered from most-shared to most-specific:

- Platform: `--surface-page`, `--surface-panel`, `--ink-body`, `--ink-muted`
- Avionics-specific: `--avionics-sky`, `--avionics-ground`, `--avionics-pointer`
- Avionics arc bands: `--avionics-arc-white`, `--avionics-arc-green`, `--avionics-arc-yellow`, `--avionics-arc-red`

Both light and dark appearances define every `--avionics-*` token. The contract-test in `libs/themes/__tests__/contract.ts` enforces presence in both. No inline hex anywhere in PFD components.

If `sim/glass` shipped legacy `--sim-pointer` / `--sim-arc-*` tokens, this WP adds the `--avionics-*` aliases (or renames -- see tasks.md Phase 4) so a non-sim surface never reads a `--sim-` token.

## Why this is "demo-grade", not foundational

The user framed this as the surface coming alive, not a learning surface yet. Concrete consequences:

- No discovery-first pedagogy; the page does not teach. It demonstrates.
- No persistence, no scoring, no calibration tracking.
- No accessibility-grade screen-reader semantics for the synthetic vision (documented limitation).
- No production framing language about Vmc, Va, Vne -- the airspeed tape arcs are illustrative.

Demo-grade means: the gestures feel right, the chrome is the airboss platform, the BC contract is real, the surface is reachable. Real product features land on top.

## Deferred `extract-sim-instruments` resolution

[docs/work-packages/extract-sim-instruments/spec.md](../../../../work-packages/extract-sim-instruments/spec.md) was authored as a deferred WP triggered on "avionics app created". This WP is that trigger -- so the deferred WP must be resolved one way or another (the no-undecided-considerations rule).

Resolution: **rewrite that WP, don't execute it as written.**

Reasons:

- Sim's instruments are round-dial steam gauges. Avionics's instruments are tapes. They share zero pixels.
- Extracting sim's instruments to a shared lib *for avionics* would force avionics to pull a lib it doesn't render from.
- The right shared lib emerges *after* avionics ships its tapes -- if a second consumer (sim glass-cockpit overlay; a future MFD page) wants tape-style components, that's when extraction earns its place.

Action in this WP's tasks: **edit `docs/work-packages/extract-sim-instruments/spec.md`**:

- Status: still `deferred`
- Trigger: change from "avionics app created" to "PFD components have a second consumer"
- Title / scope: change from "extract sim instruments" to "promote PFD components to `libs/activities/pfd/` once a second consumer exists"
- Source line records that the rewrite happened in this WP and why

This is one focused edit (~10 lines), not a deferral. The follow-on extraction has a real trigger and the original deferred document still serves as the named home for the work whenever it lands.

## Open design questions

None. Every shape decision above is final for this WP.

## References

- [Spec](spec.md)
- [Tasks](tasks.md)
- [apps/sim/svelte.config.js](../../../../../apps/sim/svelte.config.js)
- [libs/themes/sim/glass/](../../../../../libs/themes/sim/glass/)
- [libs/bc/sim/src/types.ts](../../../../../libs/bc/sim/src/types.ts) -- the BC-types pattern this lib follows
- [docs/decisions/004-DATABASE_NAMESPACES.md](../../../../decisions/004-DATABASE_NAMESPACES.md) -- one BC, one schema namespace (referenced indirectly via the `SCHEMAS` constant)
