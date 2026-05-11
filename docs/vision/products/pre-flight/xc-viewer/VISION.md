---
name: Cross-Country Viewer + Scenario Engine
id: vision:pre:xc-viewer
tagline: The universal pre-flight stage -- route + sectional + weather + aircraft + scenarios composed into one live view that lessons mount
status: vision (not greenlit)
priority: tbd
prd_depth: vision
category: pre-flight / infrastructure
captured: 2026-05-11
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - commercial-pilot
complexity: large
personal_need: 5
depends_on:
  - libs/wx-engine/
  - libs/wx-charts/
  - apps/spatial/ (creates)
related:
  - vision:pre:weather-scenario-engine (truth-aware wx output that this viewer consumes)
  - vision:pre:route-walkthrough (the pedagogy of "walk the flight before you fly it")
  - vision:pre:diversion-drill (consumer; wires into the timed event layer in v2+)
  - vision:pre:notam-triage (notam overlay consumer when notam-engine ships)
  - apps/sim/ (the FLY surface; xc-viewer is the PLAN/BRIEF surface)
  - apps/flightbag/ (the LIBRARY view of FAA references; xc-viewer is the OPERATIONAL view)
  - DESIGN_PRINCIPLES.md §2 (Decisions Under Pressure)
  - DESIGN_PRINCIPLES.md §7 (Three-Stage Skill Ladder)
  - ADR 011 (knowledge graph)
content_reuse:
  - data/wx-scenarios/ (output of libs/wx-engine/)
  - course/sectionals/ (FAA digital sectional vector data ingest, new)
  - course/aircraft/ (hand-authored a/c spec literals for v1)
  - course/knowledge/weather/, course/knowledge/aerodynamics/, course/knowledge/airspace/
last_worked: null
---

# Cross-Country Viewer + Scenario Engine

The XC viewer is the **universal pre-flight stage**. A pilot composes a flight (route + aircraft + date/time + weather scenario) and the system renders a live, navigable surface that overlays everything: sectional cartography with route line + airports + airspace + terrain, wx-engine briefing products at every leg waypoint, dynamic chart layers (radar, surface analysis, AIRMET overlays, prog), plates for each airport, weight-and-balance and performance projections forward in time, and a scenario layer that injects events ("thunderstorm forms over your route", "alternator failure 30 nm out", "destination ceiling drops below mins") as time advances.

The killer feature: **when the wx-engine knows the truth, the route knows the geometry, and the aircraft knows the performance, every claim the viewer makes is grounded.** "You'll arrive at KMEM with 23 minutes of fuel reserve in 1,200 ft ceiling and 15 kt direct crosswind on 27" is not generated text -- it is a derived fact from layer composition. This is the FlightAware / ForeFlight equivalent that **cannot lie**, because the truth is upstream and computable. Every callout, every minimum, every diversion suggestion has a known reason that traces back to a parameterized layer.

## Status

**Vision, not greenlit.** First-slice work package authored at [docs/work-packages/xc-viewer-v1/](../../../../work-packages/xc-viewer-v1/) -- the v1 cap is one sectional region, three airports, one route, one aircraft, one wx-engine scenario, no scenario events. v2+ adds editor UI, scenario perturbation events, multi-region sectional library, real aircraft POH ingest, and the diversion / go-no-go / postflight drills that mount the viewer.

## Why this matters

Pre-flight is the largest underserved surface in pilot training. The 20-30 minutes before a flight where a pilot looks at the route, the weather, the aircraft, and the airports together is exactly where decision quality is set. ForeFlight plans the route and shows raw products. CloudAhoy reviews the flight after it happens. **Nobody owns the moment between -- the moment where the pilot composes everything into a single mental model and rehearses the flight.**

The reason nobody owns it is that the moment requires composition. A real pre-flight tool has to know the route geometry, the aircraft performance, the weather products, the airspace structure, the plates, the W&B envelope, the personal minimums -- and reason about them together. That requires a **truth-aware substrate** so the tool's claims are derivable, not invented. The wx-engine ([VISION.md](../weather-scenario-engine/VISION.md)) is that substrate for weather; this viewer composes the wx-engine output with sectional cartography, route geometry, and aircraft performance into one stage where every lesson can mount and inhabit.

## The four composable layers

Mirrors the wx-engine four-layer framing. Each layer is independently authored; layers compose into a `ScenarioBundle` consumed by the viewer.

| Layer          | What lives there                                                                                                 | Authored where                                                 | Owned by                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| 1 -- Geography | Sectional cartography, airports, airspace, terrain, plates, frequencies, navaids                                 | `course/sectionals/` (vector ingest from FAA digital products) | `libs/spatial-engine/`       |
| 2 -- Flight    | Route (waypoints + altitudes + speeds), aircraft spec (perf polar, fuel-burn curve, W&B envelope), pilot profile | `libs/spatial-engine/src/flight/scenarios/<slug>.ts`           | `libs/spatial-engine/`       |
| 3 -- Weather   | wx-engine output at every (waypoint, time) tuple -- METAR/TAF/winds-aloft/AIRMETs/PIREPs/charts                  | `data/wx-scenarios/<slug>/` (already exists)                   | `libs/wx-engine/` (consumed) |
| 4 -- Scenario  | Time-indexed perturbation events (wx changes, a/c failures, ATC changes, NOTAM activations, PIREP drops)         | `libs/spatial-engine/src/scenario/scenarios/<slug>.ts`         | `libs/spatial-engine/` (v2+) |

Layer 1 is authored once per region and reused across every flight in that region. Layer 2 is the flight composition. Layer 3 references an existing wx-engine scenario by slug (no re-derivation). Layer 4 is the timeline of events that perturb layers 1-3 as scenario time advances.

## Three data-anchoring stages (mirrors wx-engine S1/S2/S3)

| Stage | Substrate                                                                                                     | Status                                   |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| S1    | Authored: one sectional region, a few known airports, hand-defined aircraft, hand-authored wx scenarios       | v1 (this WP)                             |
| S2    | Catalogued: multi-region sectional library, FAA NASR airport database, real aircraft POH ingest, scenario lib | Follow-on WP (`xc-viewer-s2-catalogue`)  |
| S3    | Composable / dynamic: pilot picks any route + any aircraft + any wx + any scenario; timeline orchestration    | Follow-on WP (`xc-viewer-s3-composable`) |

The architecture is shaped so S2/S3 substitution is mechanical: layer-1 ingesters fill the same `Region` / `Airport` / `Airspace` shape; layer-2 aircraft spec readers fill the same `AircraftSpec`; layer-3 already substitutes via the wx-engine scenario slug. Nothing in the viewer's renderer depends on whether the data was hand-authored or sampled.

## DSL principles -- every authored thing is a typed primitive

The composition is the product. Authoring is direct TS literal editing for v1; map-based polygon / route editing in the hangar app is a follow-on (see [xc-viewer-v1/OUT-OF-SCOPE.md](../../../../work-packages/xc-viewer-v1/OUT-OF-SCOPE.md)).

```typescript
// libs/spatial-engine/src/flight/types.ts (sketch -- final shapes in the WP design.md)

export interface RouteSpec {
  id: string;                       // e.g. 'kmem-kmkl-kolv'
  waypoints: Waypoint[];            // ordered list; first is departure, last is destination
  altitudeProfile: AltitudeStep[];  // per-leg target altitude (ft MSL)
  speedProfile: SpeedStep[];        // per-leg target TAS (kt)
  alternate?: string;               // ICAO of declared alternate
}

export interface AircraftSpec {
  id: string;                       // e.g. 'c172n-skyhawk'
  model: string;                    // 'Cessna 172N Skyhawk'
  perfPolar: PerformancePolar;      // climb / cruise / descent rates as f(altitude, weight, ISA dev)
  fuelBurnCurve: FuelBurnCurve;     // gph as f(power setting, altitude)
  wbEnvelope: WeightBalanceEnvelope; // forward / aft CG limits as f(weight)
  equipment: EquipmentList;         // VOR / GPS / IFR / ADS-B / etc.
}

export interface ScenarioSpec {
  id: string;                       // e.g. 'kmem-kmkl-kolv-frontal-march'
  routeId: string;
  aircraftId: string;
  wxScenarioSlug: WxScenario;       // references libs/wx-engine/ output by slug
  events: TimedEvent[];             // v2+; v1 ships zero events
  pilot?: PilotProfile;             // currency, personal mins; optional
  validAt: string;                  // UTC ISO timestamp the scenario is "now"
}

export type TimedEvent =
  | WxChangeEvent                   // wx-engine state perturbation at time T
  | AcFailureEvent                  // alternator / engine / vacuum / radio / etc.
  | AtcChangeEvent                  // reroute, hold, frequency change
  | NotamActivationEvent            // a NOTAM activates (or expires) mid-flight
  | PirepDropEvent;                 // a fresh PIREP appears on the briefing
```

All authored as YAML or TS literals. All serialize round-trip. All compose: a `ScenarioSpec` references a `RouteSpec` + `AircraftSpec` + a wx-engine slug; the viewer reads the composition and renders the stage.

## What this enables (8-12 surfaces that mount the viewer)

The viewer is a substrate, not a destination. Every entry below is a lesson, drill, or product surface that mounts the viewer via a `:::xc-viewer slug="..."` markdown directive (or via a study-app drill that reads the same `ScenarioBundle`).

| Surface                       | What mounts                                                                                                  | Pedagogy                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Weather course step           | "Look at this front cross your route -- what does the TAF say at KMEM at arrival?"                           | Discovery-first; chart -> question -> reveal          |
| PPL ACS Task XII (Postflight) | Show the route flown, weather encountered, decisions made                                                    | Debrief; ties decisions to measurable outcomes        |
| Personal-minimums lesson      | Load YOUR last 5 flights, overlay YOUR personal-mins thresholds, see which flights were close                | Calibration; self-vs-mins gap                         |
| Go/no-go decision drill       | Present the briefing on a real route, force the call, then advance time and reveal what happened             | Decisions under pressure; confirmation/contradiction  |
| Cross-country planning lesson | Author the route step by step inside the viewer, see legs / fuel / W&B update live                           | Discovery; route changes propagate visibly            |
| Diversion drill               | Wx triggers at midpoint, learner picks alternate, viewer shows route + wx + fuel for the alternate           | Decisions under pressure; visible consequences        |
| Flight bag drill              | Mount the viewer at a waypoint, click any product (METAR, TAF, plate, sectional zoom), explain what you'd do | Triage skill ladder (DESIGN_PRINCIPLES §7)            |
| Replay mode                   | Step time forward minute by minute, watch products + airspace + fuel update                                  | Mental rehearsal; build the picture before the flight |
| Postflight reflection         | Compare what the pilot expected (briefed) vs what they got (encountered)                                     | Calibration; close the loop on judgment               |
| Instructor brief surface      | CFI walks the student through a route on the viewer; pre-flight discussion has a shared visual               | Shared mental model; the brief is the artifact        |
| FIRC scenario debrief         | Replay the FIRC scenario route + the student's decision points + the wx that drove them                      | Same surface for the instructor track                 |
| Cert-prep capstone            | Multi-step rehearsal: brief the route, fly the decisions, debrief against personal mins                      | The full pre-flight loop in one stage                 |

The surfaces above are not v1 deliverables. They are the design horizon -- the reason the viewer is built as a composable substrate rather than as a one-off route-walkthrough page. v1 (this WP's scope) ships the substrate + one mounted course step that proves the composition.

## Editor too -- same primitives, composed via UI

In the hangar app (follow-on), the same primitives are edited via UI: a route editor (drag waypoints on a sectional), a scenario timeline editor (drag events along a time axis), an aircraft spec editor (form-driven against the `AircraftSpec` Zod schema). The reader and the editor share the same `ScenarioBundle` shape -- the editor writes a TS literal that the reader loads. Mirrors the course-reader-and-editor split that already exists in hangar today.

## Killer feature, restated

The wx-engine knows the **atmospheric truth**. The route knows the **geometry**. The aircraft spec knows the **performance**. Composition produces verifiably consistent claims. Lessons mount this substrate and reason about it. **Discovery-first pedagogy ([ADR 011](../../../../decisions/011-knowledge-graph-learning-system/decision.md)) gets a stage instead of a static chart.**

The killer property is: ask the viewer "what is my fuel reserve at the alternate at the projected arrival time?" and the answer is a derived value (route distance + aircraft fuel-burn curve at the cruise altitude + the projected wind aloft from the wx-engine's `windByAltitude` at the alternate's lon/lat at validAt + the descent profile from the aircraft spec) -- not text scraped from a briefing. **Every claim is reachable to its truth source.** That is the property real-world tools cannot provide because they read products without the model that produced them.

## Architecture overview

Three libraries; one new app.

| Lib / app              | Role                                                                                                           | Browser-safety                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `libs/spatial-engine/` | Server-only: composes layers 1-4 into a `ScenarioBundle`; reads sectional vector data + scenario literals      | `@ab/spatial-engine/server` carries every value |
| `libs/spatial-ui/`     | Browser-safe: renders the bundle (sectional canvas, route overlay, weather chips, leg labels, plate viewer)    | `@ab/spatial-ui` is types + components only     |
| `libs/wx-engine/`      | Existing; consumed by `spatial-engine` via the `ScenarioBundle.weather` field referencing a wx scenario slug   | unchanged (`@ab/wx-engine/server`)              |
| `apps/spatial/`        | New SvelteKit app at `/spatial/xc/<scenario-slug>`; reads bundle via `+page.server.ts`, renders via spatial-ui | standard SvelteKit pattern                      |

```text
                      +---------------------------+
                      |   apps/spatial/           |
                      |   /spatial/xc/<slug>      |
                      +-------------+-------------+
                                    |
                                    | reads bundle via +page.server.ts
                                    v
                      +---------------------------+
                      |   libs/spatial-engine/    |
                      |   composes 4 layers       |
                      +-------------+-------------+
                                    |
                +-------------------+-------------------+
                |                   |                   |
                v                   v                   v
       +----------------+  +----------------+  +----------------+
       | sectional      |  | flight specs   |  | wx-engine      |
       | vector ingest  |  | (route, a/c)   |  | scenario       |
       | course/        |  | libs/spatial-  |  | data/wx-       |
       | sectionals/    |  | engine/.../    |  | scenarios/     |
       +----------------+  +----------------+  +----------------+
              ^                                        ^
              |                                        |
              | FAA digital sectional ingest           | libs/wx-engine/ output
              | (vector geometry, airspace, airports)  | (already exists for
              |                                        |  frontal-xc-march)
```

## Substrate decisions (v1)

- **Sectional rendering: vector, not raster.** v1 ingests the FAA digital sectional vector data (state outlines, roads, cities, airspace boundaries, terrain shading hatch) and renders via SVG. Raster tile ingest is a follow-on WP -- the vector substrate is enough to prove composition + lets us style with design tokens. See [xc-viewer-v1/spec.md](../../../../work-packages/xc-viewer-v1/spec.md) "Why vector for v1".
- **Projection: Lambert Conformal Conic.** Same projection family as `libs/wx-charts/src/projection.ts` (FAA convention: standard parallels 33 / 45 for CONUS). Per-region the parallels narrow (Memphis sectional region uses tighter parallels). Re-uses the projection helper in `libs/spatial-engine/`; shared with wx-charts via a small shared geometry primitive.
- **Aircraft spec: hand-authored polar, not POH ingest.** v1 ships one C172N spec as a TS literal. POH ingest is a follow-on WP gated on documented authoring friction.
- **Weather: scenario reference, not live feed.** v1 mounts an existing wx-engine scenario by slug. Live feed is rejected per [xc-viewer-v1/OUT-OF-SCOPE.md](../../../../work-packages/xc-viewer-v1/OUT-OF-SCOPE.md) (same pedagogical rejection as the wx-engine VISION).
- **Scenario events: zero in v1.** Static composition only. Timed events come in `xc-scenario-events` WP per [xc-viewer-v1/OUT-OF-SCOPE.md](../../../../work-packages/xc-viewer-v1/OUT-OF-SCOPE.md).
- **Plates: deferred.** Plate rendering depends on FAA AeroNav plate ingest -- its own WP. v1 ships airport metadata + frequency + runway info; full plate viewer in `xc-viewer-plates` follow-on.

## What this is not

- **Not a real pre-flight tool.** Pilots must never use the viewer's output for actual flight planning. The wx-engine output is synthetic; the aircraft spec is hand-tuned; the sectional may be stale. Same disclaimer the wx-engine ships.
- **Not a replacement for ForeFlight.** ForeFlight plans real flights against real data. The viewer rehearses synthetic flights against truth-aware data. Different products, different pedagogy.
- **Not a flight simulator.** Sim is in `apps/sim/`. The viewer is the PLAN/BRIEF surface; sim is the FLY surface; flightbag is the LIBRARY surface. Three apps, three roles.
- **Not a 3D visualization.** v1 is 2D vector sectional. 3D terrain is deferred per OUT-OF-SCOPE.
- **Not multi-pilot.** No concurrent editing, no shared sessions. v1 is single-pilot study + brief.

## Looks-pro rendering

The viewer renders SVG with token-based stylesheets. Sectional cartography matches FAA visual conventions: airport symbols (open / filled circles by surface; runway diagrams at high zoom), airspace boundaries (Class B blue, Class C magenta dashed, Class D dashed blue, MOA / restricted area hatched), terrain shading (Natural Earth-style green-to-tan hypsometric tint at 500-ft contour intervals), navaid symbols (VOR star, NDB dotted circle), waypoint labels.

Route overlay paints over the sectional: route line in route-color token, waypoints as filled diamonds, leg labels (distance / true course / fuel) as anchored callouts. Weather overlay paints chips at each waypoint summarizing the wx-engine product (METAR flight category, TAF arrival category at projected arrival time, AIRMET coverage band).

Performance band: a sticky footer-strip shows current leg's fuel-remaining + W&B / CG indicator + projected ETA + projected wx at next waypoint. Scrubs as the user steps time forward (v2+).

We stop short of "indistinguishable from operational" for v1 -- no real terrain elevation, simplified airspace topology in the FAA digital file, no plate raster overlay. The marginal cost over ugly-correct is small; the reuse value across every consumer is high.

## Promotion criteria

Move from vision to greenlit work package when:

- The first-slice WP at [xc-viewer-v1/](../../../../work-packages/xc-viewer-v1/) has been walked end-to-end by user-zero and signed off
- A second consumer (beyond the weather-course step) is committed -- e.g. a personal-minimums lesson or a postflight reflection drill
- The wx-engine ([VISION.md](../weather-scenario-engine/VISION.md)) has shipped at least 2 production scenarios so the viewer can mount more than one wx state
- A clear authoring path is documented for the next sectional region (Northeast, Pacific, etc.) so the substrate is not stuck on Memphis

Until then: vision doc captures the design space; the v1 WP delivers the proof-of-substrate; no further WPs greenlit.

## Relationship to other surfaces

**Explicit interface contracts**, not loose coupling.

- **wx-engine** -- this WP consumes the wx-engine's `ScenarioBundle` output by slug. The wx-engine emits products + chart specs + commentary at canonical paths under `data/wx-scenarios/<slug>/`. The viewer reads `truth.json` (for waypoint-time wx queries), `products/*.json` (for METAR/TAF/AIRMET chips), and the rendered chart SVGs from `data/charts/wx/wx-scenario-<slug>-*/chart.svg`. No cross-lib code dependency: the contract is filesystem-backed.
- **apps/sim/** -- sim is the FLY surface. When a pilot flies a scenario in sim, the sim BC's evidence packet records every decision; postflight, the same scenario can be loaded into the xc-viewer (via the same `ScenarioBundle`) for review. Sim's evidence packet schema must remain compatible with the viewer's "show what happened" mode (post-v1).
- **apps/flightbag/** -- flightbag is the LIBRARY view of FAA references. From any waypoint or chart in the xc-viewer, a citation chip can deep-link into flightbag (e.g. clicking the AIRMET decoder opens flightbag at the AC 00-45H section). The viewer never duplicates flightbag's content; it cites it.
- **course-reader-and-editor** -- the existing markdown directive system grows a `:::xc-viewer slug="<scenario-slug>"` directive that mounts the viewer inline in a course step. The directive resolver lives in the course-reader; this WP defines the data contract (what's at `data/xc-scenarios/<slug>/` and how the viewer page reads it).
- **libs/spatial/** -- the future shared spatial data lib (airport / airspace / terrain primitives) emerges from `libs/spatial-engine/` once a second consumer (avionics? in-flight?) needs the same primitives. v1 keeps everything in `libs/spatial-engine/` to avoid speculative decomposition.
- **course/knowledge/** -- weather, aerodynamics, airspace knowledge nodes are cited by viewer callouts (same chip pattern as wx-engine commentary). Discovery-first prompts mount via the existing knowledge-graph navigation.

## Out of scope for the vision (deferred to follow-on WPs)

Captured here so the vision is finite. Detailed deferral rationale + revisit-triggers live in [xc-viewer-v1/OUT-OF-SCOPE.md](../../../../work-packages/xc-viewer-v1/OUT-OF-SCOPE.md).

- Full IFR enroute charts (Low / High altitude) -- separate WP `xc-viewer-ifr-enroute`
- Oceanic, Class A enroute, military and special-use airspace topology beyond v1's VFR-only sectional
- FAA AeroNav taxi diagrams + plate raster ingest -- separate WP `xc-viewer-plates`
- Real-time live wx feed -- rejected for the same pedagogical reason as the wx-engine
- 3D terrain visualization -- deferred to a `spatial-3d` WP if user-zero requests it
- Multi-pilot concurrent editing or shared sessions -- not in the v1 audience profile
- Touch / mobile interactions -- desktop pre-flight surface first; mobile is a separate UX problem
- POH PDF ingest -- hand-authored aircraft specs for v1; ingest follow-on
- Sectional raster tile ingest -- v1 vector-only; raster is its own follow-on WP

## Related

- [xc-viewer-v1/spec.md](../../../../work-packages/xc-viewer-v1/spec.md) -- first-slice work package (the v1 cap)
- [xc-viewer-v1/OUT-OF-SCOPE.md](../../../../work-packages/xc-viewer-v1/OUT-OF-SCOPE.md) -- full deferral list with triggers
- [weather-scenario-engine/VISION.md](../weather-scenario-engine/VISION.md) -- the truth-aware wx engine that this viewer composes with
- [route-walkthrough/PRD.md](../route-walkthrough/PRD.md) -- the pedagogy this viewer makes possible at scale
- [diversion-drill/PRD.md](../diversion-drill/PRD.md) -- consumer; mounts the viewer with a wx-perturbation event in v2
- [DESIGN_PRINCIPLES.md §2](../../../../platform/DESIGN_PRINCIPLES.md) -- decisions under pressure; the scenario-events layer (v2+) is built around this principle
- [DESIGN_PRINCIPLES.md §7](../../../../platform/DESIGN_PRINCIPLES.md) -- the three-stage skill ladder; the viewer is where Stage 3 (triage) lessons mount
- [ADR 011](../../../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy; viewer callouts cite real knowledge nodes
- [MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- `apps/spatial/` is the natural home for this surface
