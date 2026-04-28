---
title: 'Design: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: design
status: unread
review_status: pending
---

# Design: Avionics App Scaffold

Architectural decisions and the why behind them. The spec lists what; this lists why.

## Surface placement

### Avionics is its own app

Three forces argue against folding avionics into `apps/sim/`:

1. **Visual identity divergence.** Sim renders round-dial steam-gauge instruments (`apps/sim/src/lib/instruments/Asi.svelte`, `Altimeter.svelte`, `AttitudeIndicator.svelte` -- all SVG round dials). Avionics renders tape-style glass. A single app's chrome and route layout cannot smoothly host both without a routing-driven wholesale style swap, which is what surface apps are for.
2. **Product-shape divergence.** Sim is a flight-scenario runner -- a list of scenarios on the home page, a cockpit per scenario, a debrief, a history. Avionics is a panel-trainer -- a list of panels on the home page (eventually), a study mode per panel, scan drills. The information architecture barely overlaps.
3. **Architecture doc says so.** [MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) commits to surface-typed apps. Folding here is the precedent we'd later regret.

### Why reuse `sim/glass`, not fork it

`sim/glass` already encodes:

- Dark-only with appearance lock
- Deep-black instrument backgrounds
- Indicator-yellow pointer / cyan accent role tokens
- Mono-dense chrome
- A layout slot named `cockpit` that maps the chrome strip plus full-bleed instrument area

These are exactly the avionics surface's needs today. Forking now duplicates tokens with zero concrete divergence pressure. The first time avionics needs a token sim shouldn't have (e.g., a G1000-cyan that sim's panel doesn't want), we fork to `avionics/g1000` and the divergence is small and meaningful. Until then, one theme keeps both surfaces in tune; design changes to either ripple consistently.

### Theme resolver route lock

`libs/themes/resolve.ts` (or wherever the route-safety lock is implemented for `/sim/*`) needs to recognise `/avionics/*` paths and force `sim/glass` + dark appearance the same way. Two implementation paths:

- **A. Generalise the lock.** Replace the `/sim/*` test with a "surfaces that lock to `sim/glass`" registry. Cleanest, costs one config edit when a new locked surface appears.
- **B. Add `/avionics/*` to the existing predicate.** Smaller diff today, costs another edit at every future locked surface.

Pick A. The registry lives next to the existing predicate; one entry per locked surface. Implementation lands in this WP since the demo isn't viable without it.

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
  AirspeedTape.svelte          vertical tape + boxed readout
  AltitudeTape.svelte          vertical tape + rolled-counter readout
  HeadingIndicator.svelte      horizontal compass strip
  VsiIndicator.svelte          vertical pointer +/-2000 fpm
  PfdInputs.svelte             slider strip
  PfdKeyboardLegend.svelte     `?`-toggled cheatsheet
  pfd-tick.svelte.ts           rAF loop + easing constants
  pfd-types.ts                 local view types (input bindings, easing config)
```

Each instrument takes scalar props (pitch, bank, airspeed, ...), no objects, no callbacks. They're pure renderers: identical inputs always produce identical SVG. That's the property that makes promotion to `libs/activities/pfd/` clean later.

### Theme tokens used

The PFD reads only role tokens defined in `sim/glass`:

- `--surface-page` background
- `--surface-panel` instrument backplate
- `--ink-body` digit color
- `--ink-muted` minor labels
- `--sim-pointer` pointer fill (yellow)
- `--sim-arc-green`, `--sim-arc-yellow`, `--sim-arc-red`, `--sim-arc-white` -- airspeed arc bands

If `sim/glass` is missing a token (e.g., a sky-blue for the attitude indicator's upper half, ground-brown for the lower), the WP adds it to the `sim` slot of `sim/glass` and regenerates `tokens.css`. No inline hex anywhere in PFD components. The contract-test in `libs/themes/__tests__/contract.ts` enforces this.

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
