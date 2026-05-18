---
id: xc-viewer-v1
title: 'Out of Scope: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
product: sim
category: feature
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on:
  - wx-engine
unblocks: []
tags:
  - xc-viewer
  - spatial
  - out-of-scope
legacy_fields:
  feature: xc-viewer-v1
  type: out-of-scope
---

# Out of Scope: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope and the "What this is not" + "Out of scope for the vision" sections of [VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md).

## Summary

| Item                                                                   | Status       | Trigger to revisit                                                                                                    |
| ---------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Timed scenario events (wx perturbation, a/c failures, ATC, NOTAMs)     | Follow-on WP | When user-zero asks to step time forward and watch products evolve, OR a diversion-drill consumer needs events        |
| Hangar UI for scenario / route / aircraft authoring (map-based)        | Follow-on WP | When TS literal authoring is documented as the bottleneck for scenario velocity (>= 12 scenarios authored)            |
| Raster sectional tile ingest + render                                  | Follow-on WP | When pedagogical demand for FAA-photographic-identical sectional is documented, OR vector rendering limits hit        |
| Multi-region sectional library (S2 cataloguing)                        | Follow-on WP | When a second region is needed for a course step or a new scenario archetype                                          |
| Real POH PDF ingest for aircraft specs                                 | Follow-on WP | When >= 3 aircraft are needed AND hand-transcription is documented as the bottleneck                                  |
| IFR enroute charts (Low / High altitude)                               | Follow-on WP | When the IR-rated course material needs an enroute-chart surface for IFR-flight pedagogy                              |
| FAA AeroNav plates rendering                                           | Follow-on WP | When plate-reading pedagogy is needed at the viewer level (currently flightbag's domain for static plate reading)     |
| Live wx feed integration                                               | Rejected     | Never -- out of pedagogical scope; the engine's value is curation, not live data                                      |
| 3D terrain visualization                                               | Deferred     | When mountain-route pedagogy needs realistic terrain rendering AND a `spatial-3d` lib is justified                    |
| Touch / mobile interactions                                            | Deferred     | When a mobile-pre-flight product is greenlit and the viewer is the natural target surface                             |
| ForeFlight / Garmin Pilot / EFB integration                            | Rejected     | Never -- airboss is a closed pedagogical platform; no third-party API integration                                     |
| Multi-leg routing optimization (find best route given constraints)     | Rejected     | Never -- this is route planning (ForeFlight's job), not pre-flight rehearsal                                          |
| Multi-pilot concurrent editing or shared sessions                      | Deferred     | When social / community surfaces are real and a co-authored brief is a real use case                                  |
| Variation grid (NOAA WMM-derived per-point magnetic variation)         | Deferred     | When multi-region routing or transcontinental scenarios surface the v1 flat-per-region variation as inaccurate        |
| Wind interpolation at sub-leg granularity (long-leg gradient handling) | Deferred     | When long-leg scenarios (>50 nm legs across strong gradients) show measurable accuracy drift in the performance table |
| Comparative scenario panel (two scenarios side-by-side)                | Deferred     | When user-zero asks to compare two scenarios in real use ("what if this were winter weather instead?")                |
| Postflight reflection drill (mount viewer with the flown route)        | Follow-on WP | After v1 + sim BC has scenario evidence packets that can be loaded into the viewer for review                         |

---

## Timed scenario events (wx perturbation, a/c failures, ATC, NOTAMs)

Status: Follow-on WP (`xc-scenario-events`)

What was deferred:
The Layer-4 (scenario) `TimedEvent` union -- `WxChangeEvent`, `AcFailureEvent`, `AtcChangeEvent`, `NotamActivationEvent`, `PirepDropEvent`. v1's `ScenarioSpec.events` field is always `[]`; the union type is declared so v2+ adds events without a schema migration.

Why:
Events are the v2+ unlock -- they turn the viewer from a static brief into a time-stepped scenario. Building them requires (1) a time-stepping renderer (the viewer must re-render on `t` advance), (2) a per-event-kind side effect on the bundle (a `WxChangeEvent` mutates the wx view; an `AcFailureEvent` mutates the aircraft equipment list; a `NotamActivationEvent` adds a NOTAM polygon), (3) UX for "step time forward" + "show what changed" + "the call you have to make". All three are real design surfaces; v1 cannot afford them while also proving the substrate.

The static composition in v1 is the meaningful first slice. It proves layer composition works; v2 adds the time axis.

Trigger that fires the follow-on:
Either of two paths:
(a) User-zero asks to step time forward and watch the wx + AIRMETs + airspace evolve while looking at the viewer. The diversion-drill ([PRD](../../vision/products/pre-flight/diversion-drill/PRD.md)) is the canonical consumer.
(b) A course step authored against the v1 viewer surfaces the need for a "what changed" affordance (e.g. "the briefing was VFR; here's what it looks like 2 hours later when the front arrived" -- two static bundles would be heavy; one bundle + an event would be cleaner).

Implementation pattern when triggered:
A separate WP `xc-scenario-events`. Promote `TimedEvent` from declared-but-empty to fully implemented. Per-event-kind handlers in `libs/spatial-engine/src/scenario/events/`. The renderer adds a time-slider control + per-event animation. The composeBundle function grows an `applyEventsThroughTime(bundle, events, t)` helper. The wx-engine's `advanceTruth` is the primitive the WxChangeEvent uses to perturb the truth state.

References:

- [spec.md](./spec.md) Scope -> In (`events: []` in v1) + Scope -> Out
- [VISION.md "The four composable layers"](../../vision/products/pre-flight/xc-viewer/VISION.md)
- [VISION.md "What this enables (consumer surfaces)"](../../vision/products/pre-flight/xc-viewer/VISION.md) -- diversion drill, go/no-go drill, replay mode

## Hangar UI for scenario / route / aircraft authoring (map-based)

Status: Follow-on WP (`xc-editor-v1`)

What was postponed:
A hangar-app authoring surface for `RouteSpec`, `AircraftSpec`, `ScenarioSpec` literals. Today, all three are TS-by-hand under `libs/spatial-engine/src/flight/` and `.../scenario/`; the hangar app does not surface an editor.

Why:
Polygon geometry, route-line geometry, and aircraft polars are unforgiving when edited as raw lon/lat / numeric literals. A map-based polygon + route editor would help, but the friction is documented (the C172N spec is a one-shot transcription, the v1 route has 5 waypoints) rather than systematically blocking content velocity. The TS literal pattern is acceptable for v1.

Trigger that fires the follow-on:
When the user (Joshua, or a future co-author) documents that TS literal authoring is the bottleneck for scenario velocity. Concretely: more than 12 scenarios authored AND the author asks for a UI affordance to (a) drag route waypoints on a sectional, (b) live-preview the derived performance + wx as the author tunes the literal, (c) place polygons by clicking rather than typing coords.

Implementation pattern when triggered:
Mirror the course-reader-and-editor hangar pattern: a `/xc-scenarios` index, a `/xc-scenarios/[slug]` editor with a Leaflet / MapLibre canvas (or re-use the v1 SVG canvas) for route + polygon editing + a form-action save -> writes a TS literal to disk via a canonical TS emit pattern. The form fields derive from the Zod schemas. Live preview calls `composeBundle` server-side and renders the bundle in a side panel. Aircraft editor is form-driven against `aircraftSpecSchema`; route editor is map-based.

References:

- [spec.md](./spec.md) Scope -> Out
- [VISION.md "Editor too -- same primitives, composed via UI"](../../vision/products/pre-flight/xc-viewer/VISION.md)

## Raster sectional tile ingest + render

Status: Follow-on WP (`xc-viewer-raster-tiles`)

What was deferred:
FAA digital sectional raster tile ingest + a `<SectionalRasterLayer>` component that renders tiles under the vector layer (or as a toggle alternative).

Why:
Per [design.md "Why vector sectional for v1 (not raster)"](./design.md): vector gives us styled-tokens, accessibility, per-feature isolation, and lower build complexity. Raster adds photographic accuracy at the cost of (a) tile pyramid storage / cache eviction policy, (b) tile server or static tile mount infrastructure, (c) FAA cycle update workflow (the raster tiles drift every 56 days), (d) no per-feature programmatic isolation. v1 ships the vector substrate first; raster is the photographic-accuracy layer on top.

Trigger to revisit:
When pedagogical demand for FAA-photographic-identical sectional is documented (a lesson where the visual identity of the FAA chart matters), OR when vector rendering shows measurable performance limits at the zoom levels learners actually use.

Implementation pattern when triggered:
Add `libs/spatial-engine/src/geography/raster-ingest.ts` (server-only) that downloads / processes the FAA dCS raster TMS tiles into the cache. Add `libs/spatial-ui/src/SectionalRasterLayer.svelte` that renders a tile mount under the vector layer. The vector layer remains the source-of-truth for interactivity; the raster is photographic chrome only.

References:

- [design.md "Why vector sectional for v1 (not raster)"](./design.md)

## Multi-region sectional library (S2 cataloguing)

Status: Follow-on WP

What was deferred:
Ingest of additional sectional regions beyond Memphis: Atlanta, Denver, Los Angeles, etc. The architecture is multi-region-ready (per-region projection table, per-region airport / airspace / navaid data, per-region cache path) but v1 ships only Memphis.

Why:
v1's cap is one region. Each additional region is one ingest pass + a region entry in `XC_REGIONS` + a CITATION recording the FAA dCS cycle. Mechanically simple but not load-bearing for proving the substrate.

Trigger to revisit:
When a second region is needed for a course step or a new scenario archetype. Concretely: a winter-icing-great-lakes scenario (already on the wx-engine roadmap) needs the Chicago sectional region.

Implementation pattern when triggered:
Run `bun run sectionals ingest <region>` for the new region. Add the region slug to `XC_REGIONS`. Author the per-airport records. Commit the geography. No engine or renderer changes.

References:

- [spec.md](./spec.md) Scope -> In (one region cap)
- [VISION.md "Three data-anchoring stages"](../../vision/products/pre-flight/xc-viewer/VISION.md) (S2 cataloguing)

## Real POH PDF ingest for aircraft specs

Status: Follow-on WP (`xc-poh-ingest`)

What was deferred:
A PDF ingest pipeline for Cessna / Piper / Cirrus POH files. v1 hand-transcribes the C172N POH into a TS literal with citations; subsequent aircraft would benefit from PDF ingest if many are needed.

Why:
PDF ingest is non-trivial. POH layouts vary by manufacturer + model + year; performance tables come in many shapes; W&B envelopes are sometimes graphical, sometimes tabular. Building a robust ingest pipeline for 1-2 aircraft is over-engineering; hand-transcription with citations is the right tool at small scale.

Trigger to revisit:
When >= 3 aircraft are needed AND hand-transcription is documented as the bottleneck. Concretely: when the user (or co-author) asks for a Piper Cherokee + a Cirrus SR22 spec in addition to the C172N, and the third transcription proves the friction.

Implementation pattern when triggered:
A separate WP `xc-poh-ingest`. Add `libs/spatial-engine/src/flight/aircraft/poh-ingest.ts` (server-only) that reads a POH PDF + emits an `AircraftSpec` literal + a CITATION.md. Per-manufacturer parsers for the most-common formats. Hand-edit fallback for one-off shapes.

References:

- [spec.md](./spec.md) Scope -> Out
- [design.md "Aircraft spec authoring discipline"](./design.md)

## IFR enroute charts (Low / High altitude)

Status: Follow-on WP (`xc-viewer-ifr-enroute`)

What was deferred:
Vector ingest + render of FAA IFR enroute Low and High charts. v1 ships VFR sectional only.

Why:
IFR enroute charts are a different chart family with different conventions (airways with magnetic courses + MEAs / MOCAs, fixes, NAVAID frequencies, controlled airspace boundaries, sector altitudes). Building them is its own WP -- the data ingest, the symbology, the rendering are all distinct. v1 is VFR-focused per the cap.

Trigger to revisit:
When the IR-rated course material needs an enroute-chart surface for IFR-flight pedagogy. Concretely: when a course step asks "look at the J22 airway from KAUS to KSAT and identify the MEA changes".

Implementation pattern when triggered:
Separate WP. Add `course/enroute/<region>/` directories with FAA dEnroute vector data. Add `<EnrouteCanvas>` component family in `libs/spatial-ui/`. Extend `RouteSpec` with IFR-specific fields (airway, MEA-required, equipment-required).

References:

- [spec.md](./spec.md) Scope -> Out

## FAA AeroNav plates rendering

Status: Follow-on WP (`xc-viewer-plates`)

What was deferred:
Full instrument approach / taxi / departure plate rendering in the viewer. v1 ships airport metadata (frequencies + runway info) in the `<PlateStub>` side panel only.

Why:
FAA AeroNav plates are PDF (and the data underlying them is in the FAA d-TPP zip format). Ingest + render is non-trivial: per-plate layout parsing, per-symbol vector extraction (or PDF rasterization with metadata overlay), plate-cycle update workflow. The flightbag app is the natural home for static plate reading; this WP focuses on the operational view (route + wx + performance).

Trigger to revisit:
When plate-reading pedagogy is needed at the viewer level (currently flightbag's domain for static plate reading). Concretely: a course step where the learner clicks a runway on the viewer and gets the approach plate inline rather than deep-linking to flightbag.

Implementation pattern when triggered:
Separate WP. Add `libs/spatial-engine/src/geography/plate-ingest.ts` (server-only) that ingests d-TPP. Add `<PlateRenderer>` component in `libs/spatial-ui/`. Deep-link affordance from `<PlateStub>` to `<PlateRenderer>`.

References:

- [spec.md](./spec.md) Scope -> Out

## Live wx feed integration

Status: Rejected

What was rejected:
A "fetch live weather" path inside the viewer -- pulling current METAR / TAF / radar / AIRMET from IEM / NCEI / NOAA at render time.

Why:
Same pedagogical rejection as the wx-engine ([VISION.md "What this is not"](../../vision/products/pre-flight/weather-scenario-engine/VISION.md)): the viewer is not a real pre-flight tool. Pilots must never use the viewer's output for actual flight planning. Live data violates the pedagogical model in two ways: (1) it would tempt the consumer pattern of "use the viewer for real" which is dangerous, and (2) it would defeat the killer-feature thesis -- the viewer's value is that the wx-engine KNOWS the truth, which it cannot do from a feed that has no underlying parameterized model.

Trigger to revisit:
Never. The viewer composes truth-aware substrates; live data is the opposite of truth-aware.

References:

- [spec.md](./spec.md) Scope -> Out
- [VISION.md "What this is not"](../../vision/products/pre-flight/xc-viewer/VISION.md)
- [memory:project_truth_aware_generators](memory:project_truth_aware_generators)

## 3D terrain visualization

Status: Deferred

What was deferred:
3D terrain rendering (e.g. exaggerated relief, hill shading, ridge highlighting in 3D) for mountain-route pedagogy.

Why:
v1 renders 2D vector sectional only. 3D terrain requires a DEM ingest pipeline + a WebGL renderer + per-scenario terrain query. Mechanically large, pedagogically marginal for the v1 audience.

Trigger to revisit:
When mountain-route pedagogy needs realistic terrain rendering AND a `spatial-3d` lib is justified by multiple consumers. Concretely: a course step on mountain XC where the learner asks "show me the lee side of the ridge in 3D".

Implementation pattern when triggered:
A separate WP `spatial-3d`. Add `libs/spatial-3d/` with a WebGL renderer. Add `<Terrain3dLayer>` component in `libs/spatial-ui/`. Toggle 2D / 3D via the LayerToggle control.

References:

- [spec.md](./spec.md) Scope -> Out

## Touch / mobile interactions

Status: Deferred

What was deferred:
Touch-friendly pan / zoom + tap-to-open detail drawer + responsive layout below 768 px width.

Why:
v1 is a desktop pre-flight surface. The learner sits at a desk, looks at the viewer on a laptop or monitor, walks through the lesson. Mobile is a separate UX problem -- the pre-flight rehearsal use case is fundamentally desk-based.

Trigger to revisit:
When a mobile-pre-flight product is greenlit and the viewer is the natural target surface. Concretely: an "iPad pre-flight" companion that mounts the viewer.

Implementation pattern when triggered:
Add touch event handlers to the pan / zoom controls. Add a responsive layout to `<XcViewer>` that re-flows the drawer + performance band on narrow viewports.

References:

- [spec.md](./spec.md) Scope -> Out

## ForeFlight / Garmin Pilot / EFB integration

Status: Rejected

What was rejected:
Importing a route or flight plan from ForeFlight, Garmin Pilot, or another EFB. Exporting a viewer scenario to an EFB.

Why:
airboss is a closed pedagogical platform. We do not integrate with third-party APIs because (a) the APIs are not stable (ForeFlight is closed; Garmin Pilot is closed), (b) integration would create the "use airboss for real flight planning" path that violates the pedagogical model, (c) the route shape is simple enough that hand-authoring in YAML / TS is acceptable for v1.

Trigger to revisit:
Never. Users who want EFB integration use the EFB.

## Multi-leg routing optimization

Status: Rejected

What was rejected:
"Given a departure, destination, aircraft, and weather, find the best route" -- automatic routing.

Why:
That is ForeFlight's job. The viewer's job is rehearsing a route the pilot has chosen, not choosing the route.

Trigger to revisit:
Never.

## Multi-pilot concurrent editing or shared sessions

Status: Deferred

What was deferred:
Two or more pilots editing or viewing the same scenario simultaneously (Google-Docs-style collaboration; or a shared brief between instructor and student).

Why:
Out of the v1 audience profile. v1 is single-pilot study + brief. Social / collaborative surfaces are a separate product direction.

Trigger to revisit:
When social / community surfaces are real and a co-authored brief is a real use case. Concretely: when an instructor wants to walk a brief with a student over a shared link.

Implementation pattern when triggered:
A separate WP. Likely involves a real-time backend (CRDT or operational-transform). Out of architectural scope here.

References:

- [VISION.md "What this is not"](../../vision/products/pre-flight/xc-viewer/VISION.md) ("Not multi-pilot")

## Variation grid (NOAA WMM-derived per-point magnetic variation)

Status: Deferred

What was deferred:
A NOAA World Magnetic Model-derived per-point magnetic variation lookup. v1 uses a single per-region constant (East 4 deg for Memphis as of 2026).

Why:
v1's flat variation is accurate to within ~0.5 deg across the Memphis region. The error in the magnetic heading is below the real-flight tolerance (+/- 2 deg). When routes cross regional bounds or when transcontinental scenarios surface, the variation drift becomes meaningful.

Trigger to revisit:
When multi-region routing or transcontinental scenarios surface the v1 flat variation as inaccurate. Concretely: when a scenario crosses the variation isogonic from 4E to 6E (visible in the rendered viewer as a discontinuity).

Implementation pattern when triggered:
Add `libs/spatial-engine/src/flight/variation.ts` that loads the NOAA WMM coefficients + computes per-point variation. Update `applyWind` to query the grid at the leg midpoint.

## Wind interpolation at sub-leg granularity

Status: Deferred

What was deferred:
Long-leg wind integration -- splitting a long leg into sub-segments to handle wind gradients accurately.

Why:
v1 uses leg-midpoint wind. For legs <50 nm in mild gradients (the v1 scenario's legs), the error is below 2 kt in ground speed and below 0.5 gal in fuel. Acceptable.

Trigger to revisit:
When long-leg scenarios (>50 nm legs across strong gradients) show measurable accuracy drift in the performance table. Concretely: when a scenario's route crosses a frontal boundary mid-leg and the per-leg fuel reads more than 1 gal off vs hand-calculation.

Implementation pattern when triggered:
Add `derivePerformance` an option to integrate per-sub-leg (e.g. 10 nm sub-segments). Each sub-segment gets its own wind interpolation. Sum per-leg for the table.

## Comparative scenario panel (two scenarios side-by-side)

Status: Deferred

What was deferred:
A consumer-side UI that shows two scenarios side-by-side -- e.g., the same route with `frontal-xc-march` vs a hypothetical clear-day wx scenario -- so a learner can compare the impact of weather on a single decision.

Why:
The data contract supports this trivially (two scenario bundles, two viewer panels). The UX -- how to lay out two complete pre-flight panels without overwhelming the learner -- is the design surface, and we have no real use to design against.

Trigger to revisit:
When user-zero (or another learner) asks to compare two scenarios in real use.

Implementation pattern when triggered:
Add a `compareWith` option to the `:::xc-viewer` directive (`:::xc-viewer slug="X" compareWith="Y"`). The consumer renders two stacked panels with synchronized scroll on the canvas band.

References:

- [spec.md](./spec.md) Scope -> Out
- [wx-engine OUT-OF-SCOPE "Multi-scenario diff/compare UI"](../wx-engine/OUT-OF-SCOPE.md) (same pattern)

## Postflight reflection drill (mount viewer with the flown route)

Status: Follow-on WP

What was deferred:
A consumer surface where a learner reviews a flight after the fact -- the viewer mounts with the route the pilot actually flew (from `apps/sim/` evidence packet or a logbook import) + the wx the pilot encountered + the decisions the pilot made.

Why:
v1 is the static rehearsal surface. Postflight integration depends on (a) the sim BC's evidence packet schema being stable, (b) a logbook import schema being defined. Neither is in flight today.

Trigger to revisit:
After v1 + sim BC has scenario evidence packets that can be loaded into the viewer for review. Concretely: when `apps/sim/` records the route + decisions of a flown scenario and the user asks "show me the brief vs what I actually did".

Implementation pattern when triggered:
A separate WP. The viewer grows a "flown vs briefed" overlay mode that renders the briefed route in one color + the flown route in another + decision markers at the divergence points.

References:

- [VISION.md "What this enables"](../../vision/products/pre-flight/xc-viewer/VISION.md) -- postflight reflection surface
