---
id: wx-engine
title: 'Out of Scope: Truth-Aware Weather Scenario Engine'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-10
owner: agent
depends_on:
  - wx-chart-symbology-library
unblocks: []
tags:
  - weather
  - engine
  - library
  - out-of-scope
legacy_fields:
  feature: wx-engine
  type: out-of-scope
---

# Out of Scope: Truth-Aware Weather Scenario Engine

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope. The deeper rationale lives in [VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md), [DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md), [architecture.md](../../vision/products/pre-flight/weather-scenario-engine/architecture.md), and the [spike notes](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md).

## Summary

| Item                                                            | Status       | Trigger to revisit                                                                                        |
| --------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| S2 historical calibration (real-archive sampling)               | Follow-on WP | When a real METAR / reanalysis archive ingest pipeline is needed AND v1 climatological feel is the gap    |
| S3 replay-with-perturbation (real-day seeding + variable tweak) | Follow-on WP | After S2 ships AND scenario-overlay UX is designed                                                        |
| Real-time weather ingest (live feed at build / read time)       | Rejected     | Never -- out of pedagogical scope; the engine's value is curation, not live data                          |
| Multi-scenario diff/compare UI                                  | Deferred     | When user-zero (or another learner) asks to compare two scenarios side-by-side in real use                |
| Satellite chart derivations (GOES IR / VIS / WV)                | Deferred     | When satellite-chart pedagogy is exercised AND the geostationary projection synthesis effort is justified |
| Per-altitude turbulence/icing severity grids (FIP / CIP / GTG)  | Deferred     | When AIRMET polygon coverage is documented as insufficient for a course step                              |
| Radar-mosaic chart derivation (synthetic NEXRAD PNG)            | Follow-on WP | When wx-charts ships a polygon-radar variant OR a synthetic-radar PNG generator is justified              |
| LLM-generated commentary callouts                               | Rejected     | Never -- the rule-based commentary is what makes truth-binding load-bearing                               |
| Hangar UI for scenario authoring (map-based polygon editor)     | Follow-on WP | When TS literal authoring friction is documented as blocking content velocity                             |
| Convective SIGMET / CWA derivation                              | Deferred     | When a course step needs explicit Convective SIGMET decoding pedagogy                                     |
| Multi-cycle TAF amendments (AMD / COR cycles)                   | Deferred     | When TAF amendment pedagogy is exercised in a course step                                                 |
| Multi-leg PIREP routing                                         | Deferred     | When PIREP pedagogy needs cross-route route-segment specificity                                           |
| Real-terrain elevation in the truth model                       | Deferred     | When mountain-wave / orographic-effect pedagogy needs realistic terrain rather than coarse ridges         |

## S2 historical calibration (real-archive sampling)

Status: Follow-on WP

What was deferred:
A truth-model parameter set whose values are sampled from real conditional distributions (region x season x time-of-day x narrative-tag) built from historical archives (NCEI archived METAR / TAF / upper-air data, AWC archived AIRMETs / SIGMETs / surface analysis, Iowa State Mesonet bulk archives, ERA5 / NARR reanalysis). The truth model interface stays unchanged; the data anchor swaps.

Why:
Per [spec.md](./spec.md) Scope and [DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) "S1 vs S2/S3": v1 is hand-coded parameters (S1). The architecture leaves the door open to S2 substitution by enforcing that derive functions read only from `TruthModel` -- a real-archive sampler can fill the same shape without any layer-2/3/4 changes. Building S2 in v1 would couple the engine to ingest infrastructure that has its own design surface (DB schema, ingest jobs, calibration distribution storage) and would expand the v1 PR scope by 5x.

Trigger that fires the follow-on:
When a real METAR / reanalysis archive ingest pipeline (`libs/wx-data/`) is needed for ANOTHER product reason (e.g., real-METAR drill cards in apps/study/, real-archive verification of the calibration distributions), AND the v1 hand-coded scenarios are documented as feeling "too synthetic" for learners. Both conditions matter: the ingest infrastructure deserves its own WP regardless of the engine; once it exists, S2 substitution is a small follow-on rather than a full rebuild.

Implementation pattern when triggered:
A separate WP `wx-engine-s2-calibration`. Add `libs/wx-data/` per [VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) "Lib decomposition". The new lib carries the ingest schema (Drizzle tables for archived obs, calibration distributions), the per-source ingesters, and a `sample(region, season, narrative): TruthModel` helper. Add a sibling scenario file per archetype (e.g., `frontal-xc-march-from-archive.ts`) that calls the sampler and returns the same `TruthModel` shape; the registry exposes both S1 and S2 variants. The seed grows a `dataAnchor: 's1' | 's2'` discriminator (default `s1`).

References:

- [DESIGN.md "S1 vs S2/S3"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md#s1-vs-s2s3)
- [VISION.md "The three data-anchoring stages"](../../vision/products/pre-flight/weather-scenario-engine/VISION.md)
- [architecture.md "S2: Real-world distribution calibration"](../../vision/products/pre-flight/weather-scenario-engine/architecture.md)

## S3 replay-with-perturbation (real-day seeding + variable tweak)

Status: Follow-on WP

What was deferred:
A "seed from a real historical day at a real location, modify one variable, regenerate downstream products" flow. Useful for instructor-side scenario authoring against historical templates ("take 2024-04-15, make the cloud bases 1000 ft lower, regenerate everything consistently").

Why:
Per [DESIGN.md "S1 vs S2/S3"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md#s1-vs-s2s3) and [architecture.md "S3: Replay-with-perturbation"](../../vision/products/pre-flight/weather-scenario-engine/architecture.md): S3 is a power-user feature, not pilot-facing. It depends on the S2 ingest infrastructure (you cannot replay a real day without having archived that day) AND it depends on a UX for specifying the perturbation. Neither blocker is reasonable to address before S2 ships.

Trigger that fires the follow-on:
After S2 ships AND a scenario-overlay UX exists (the "tune one variable" interaction is a meaningful UX surface, probably in the hangar app). Concretely: when an instructor authoring a scenario against a real day asks "how do I lower the cloud bases by 1000 ft and have everything else stay consistent?"

Implementation pattern when triggered:
A separate WP `wx-engine-s3-replay`. Add a `replayRealDay({ date, region, perturbVariable, delta })` helper that loads the real day from the S2 archive, applies the perturbation to the relevant `TruthModel` field, and returns the perturbed model. Layer 2/3/4 derivations are unchanged (they read from `TruthModel`). The hangar UI is the natural authoring surface; spec it as part of the WP.

References:

- [DESIGN.md "S1 vs S2/S3"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md#s1-vs-s2s3)
- [architecture.md "S3"](../../vision/products/pre-flight/weather-scenario-engine/architecture.md)

## Real-time weather ingest (live feed at build / read time)

Status: Rejected

What was rejected:
A "fetch live weather" path inside the engine -- pulling current METAR / TAF / radar / AIRMET from IEM / NCEI / NOAA at scenario-build time or directly inside the consumer at scenario-render time.

Why:
Per [VISION.md "What this is not"](../../vision/products/pre-flight/weather-scenario-engine/VISION.md): this is not a real weather tool. Pilots must never use the engine's output for actual flight planning. Live data violates the pedagogical model in two ways: (1) it would tempt the consumer pattern of "use the engine for real" which is dangerous, and (2) it would defeat the killer-feature thesis -- the engine's value is that it KNOWS the truth, which it cannot do from a feed that has no underlying parameterized model. Curation, not live data, is the offering.

Trigger to revisit:
Never -- this is a definitional rejection, not a "wait for X." If the user re-opens the question, the discussion goes back to the killer-feature framing.

References:

- [VISION.md "What this is not"](../../vision/products/pre-flight/weather-scenario-engine/VISION.md)
- [project_truth_aware_generators](memory:project_truth_aware_generators) (the truth-binding pedagogy)

## Multi-scenario diff/compare UI

Status: Deferred

What was deferred:
A consumer-side UI that shows two scenarios side-by-side -- e.g., the same flight plan with frontal-xc-march vs winter-icing-great-lakes weather -- so a learner can compare the impact of weather on a single decision.

Why:
The data contract supports this trivially (two scenario bundles, two panels). The UX -- how to lay out two complete briefing packs without overwhelming the learner -- is the design surface, and we have no real use to design against.

Trigger to revisit:
When user-zero (Joshua) or another learner asks to compare two scenarios in real use. Concretely: when a learner working through the dense-fog-radiation-central-valley scenario says "what does this look like if it were winter-icing-great-lakes weather instead?" -- a real product moment, not a hypothetical.

Implementation pattern when triggered:
The `:::scenario` directive grows a `compareWith` option (`:::scenario slug="frontal-xc-march" compareWith="winter-icing-great-lakes"`). The consumer renders two stacked panels with synchronized scroll on the chart band. Each panel reads from its own `data/wx-scenarios/<slug>/` directory; no engine changes.

References:

- [spec.md](./spec.md) Scope -> Out

## Satellite chart derivations (GOES IR / VIS / WV)

Status: Deferred

What was deferred:
Synthetic GOES IR / Visible / Water-Vapor satellite chart specs derived from `truth.airMasses[*].meanCloudCover` + `meanCloudTopFtAgl`. The wx-charts library ships satellite renderers (Phase F of wx-chart-symbology-library); the engine could produce specs for them.

Why:
Per [spec.md](./spec.md) "Out": satellite chart derivation requires (1) brightness-temperature synthesis from cloud-top heights through the standard atmosphere, (2) GOES geostationary projection placement of the synthesized raster, and (3) a per-channel (IR / VIS / WV) palette mapping from synthesized values. The first is non-trivial atmospheric physics; the second is a different projection branch from CONUS Lambert; the third is straightforward but only useful with the first two. Three pieces of work for a chart family that is not load-bearing for the v1 pedagogy (the v1 pedagogy is already covered by surface-analysis + prog + AIRMET overlays + per-station observations).

Trigger to revisit:
When a course step needs satellite-chart pedagogy AND the v1 chart inventory is documented as insufficient for it. Concretely: when an instructor authoring a "reading IR satellite" lesson asks for an engine-generated IR chart that aligns with a frontal-passage scenario.

Implementation pattern when triggered:
Add `libs/wx-engine/src/charts/satellite-ir.ts`, `satellite-visible.ts`, `satellite-water-vapor.ts`. Each function takes `truth` + `geostationaryProjection` + scenario id and emits a `ChartArtifact`. Brightness-temperature synthesis follows AC 00-6B Chapter 14; per-channel palettes match the wx-charts library's existing satellite palettes. Tracked as a follow-on WP `wx-engine-satellite-charts`.

References:

- [spec.md](./spec.md) Scope -> Out
- [wx-chart-symbology-library spec.md "Chart inventory"](../wx-chart-symbology-library/spec.md) (Phase F satellite renderers)

## Per-altitude turbulence/icing severity grids (FIP / CIP / GTG)

Status: Deferred

What was deferred:
Gridded scalar fields (per-altitude probability / intensity grids) for icing (Forecast Icing Product / Current Icing Product) and turbulence (Graphical Turbulence Guidance). The wx-charts library ships these chart renderers (Phase E of wx-chart-symbology-library); the engine could produce specs for them.

Why:
Per [spec.md](./spec.md) "Out": v1 covers icing + turbulence pedagogy via the AIRMET polygon family (`g-airmet-icing`, `g-airmet-turbulence`) and via the per-product PIREP corroboration. The gridded scalar field synthesis is non-trivial (requires per-altitude microphysics for icing, per-altitude shear computation for turbulence) and the polygon coverage is sufficient for v1 pedagogy.

Trigger to revisit:
When AIRMET polygon coverage is documented as insufficient for a course step. Concretely: when a learner asks "where in the icing AIRMET is the icing actually severe vs light?" or "what altitude is the worst turbulence in this Tango polygon?"

Implementation pattern when triggered:
Add `libs/wx-engine/src/charts/cip.ts`, `fip.ts`, `gtg.ts`. Each takes `truth` + altitude bands and emits a `ChartArtifact` whose source JSON is a gridded scalar field per altitude band. Microphysics for icing follows AC 00-6B Chapter 18; turbulence shear computation follows AC 00-6B Chapter 17. Tracked as a follow-on WP `wx-engine-gridded-hazards`.

References:

- [spec.md](./spec.md) Scope -> Out
- [wx-chart-symbology-library spec.md "Chart inventory"](../wx-chart-symbology-library/spec.md) (Phase E icing+turbulence)

## Radar-mosaic chart derivation (synthetic NEXRAD PNG)

Status: Follow-on WP

What was deferred:
A `deriveRadarMosaicChart(truth, scenarioId)` function that synthesizes a NEXRAD-style reflectivity PNG + worldfile from `truth.convection.cells` + `truth.convection.frontalBand`. The wx-charts radar-mosaic renderer expects PNG raster input; the engine works in geometry. Bridging the two is non-trivial.

Why:
Per [DESIGN.md "Why no radar mosaic (Spike 01 deferral)"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md): synthesizing a real radar PNG from the truth model means generating a colored raster, color-mapping it through the NWS reflectivity ramp, and producing a worldfile -- non-trivial and not load-bearing for v1. The spike substituted by drawing convection state through the prog-chart hazard polygons + a SIGMET advisory band, which proves the truth-aware-derivation chain end-to-end without the PNG pipeline.

Trigger that fires the follow-on:
Either of two paths:
(a) wx-charts ships a `radar-polygons` chart variant that accepts polygon reflectivity rings instead of PNG raster -- the engine then emits geometry directly. This is the recommended path per the spike notes.
(b) A specific course step needs a synthetic radar PNG that visually matches operational NEXRAD output (color ramp + station mask + 1km grid).

Implementation pattern when triggered:
For path (a): add `libs/wx-engine/src/charts/radar-polygons.ts` exporting `deriveRadarPolygonsChart(truth, scenarioId)`. The function emits `{ cells: [{lon, lat, radiusKm, peakDbz}], frontalBand: {axis, widthKm, peakDbz} }` matching the new wx-charts schema. Layer 2/3 are unchanged.

For path (b): add `libs/wx-engine/src/raster/radar-synth.ts` (server-only) that uses `sharp` to rasterize geometry into the NWS color ramp and emit a PNG + worldfile. Output bytes mirror into `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/radar.png` + `radar.wld`. The engine's chart-spec derivation references the cache path. Tracked as a follow-on WP `wx-engine-radar-synthesis` (path b only; path a is a wx-charts WP extension).

References:

- [DESIGN.md "Why no radar mosaic (Spike 01 deferral)"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md)
- [spike-notes.md "Architectural recommendations" item 6](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md)

## LLM-generated commentary callouts

Status: Rejected

What was rejected:
LLM-authored commentary callouts. The engine would prompt an LLM with the truth state + the chart slug + the lesson goal, and the LLM would emit the question + observation + reason text.

Why:
Per [VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) and the killer-feature framing: the engine's value is that the commentary cites the specific named truth-model element ("the 996mb low at 39N/-90W moves NE at 25kt"). LLM-generated commentary loses this guarantee -- it can templatize an explanation that sounds right but doesn't pin to the actual truth state, and worse, it can hallucinate truth that doesn't exist. The rule-based commentary is the load-bearing pedagogy bet.

Trigger to revisit:
Never -- this is a definitional rejection. The truth-binding is what makes the engine's commentary worth more than a real-world briefing tool's commentary.

LLMs may have an enrichment role in the future (e.g., generating richer "explain this further" follow-up text triggered by a learner click on a callout, with the truth state passed as context AND the truth-model reasons cited verbatim in the prompt). That kind of tightly-bounded enrichment is a different decision and would be evaluated as a separate WP if it ever surfaces. The blanket "LLMs author the commentary" rejection stands.

References:

- [VISION.md "Why this matters"](../../vision/products/pre-flight/weather-scenario-engine/VISION.md)
- [project_truth_aware_generators](memory:project_truth_aware_generators)

## Hangar UI for scenario authoring (map-based polygon editor)

Status: Follow-on WP

What was postponed:
A hangar-app authoring surface for scenario literals (`apps/hangar/src/routes/(app)/wx-scenarios/...`). Today, scenario authoring is TS-by-hand under `libs/wx-engine/src/truth/scenarios/<slug>.ts`; the hangar app does not surface a scenario editor.

Why:
Per [spec.md](./spec.md) Scope -> Out and the [spike notes](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) "What was hard": polygon geometry is unforgiving when edited as raw lon/lat literals. A map-based polygon editor would help, but the friction is documented (the spike's KSTL-on-the-wrong-side bug took manual debugging) rather than systematically blocking content velocity. The TS literal pattern is acceptable for the six v1 scenarios.

Trigger that fires the follow-on:
When the user (Joshua, or a future co-author) documents that TS literal authoring is the bottleneck for scenario velocity. Concretely: more than 12 scenarios authored AND the author asks for a UI affordance to (a) edit polygons on a map rather than typing coords, (b) live-preview the derived products as the author tunes the literal, (c) place fronts + pressure systems by clicking rather than typing.

Implementation pattern when triggered:
Mirror the course-reader-and-editor hangar pattern: a `/wx-scenarios` index, a `/wx-scenarios/[slug]` editor with a Leaflet / MapLibre canvas for polygon editing + a form-action save -> writes a TS literal to disk via the existing engine emit path. Re-use the `course-yaml-emit.ts` shape from course-reader-and-editor for canonical TS emit. The form fields derive from the `TruthModel` Zod schema. Live preview calls `generateScenario` server-side and renders the bundle in a side panel.

References:

- [spec.md](./spec.md) Scope -> Out
- [spike-notes.md](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) "What was hard" + "Hangar (authoring) integration"

## Convective SIGMET / CWA derivation

Status: Deferred

What was deferred:
Convective SIGMET (WST) and Center Weather Advisory (CWA) advisory derivation. The spike emits AIRMETs only.

Why:
Per [spec.md](./spec.md) Scope -> Out and the [spike notes](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) "What was cut": v1 covers convective pedagogy via AIRMETs + the convective-outlook chart derivation. Convective SIGMET is essentially a same-shape advisory with a different ring + a different label and a thunderstorm glyph; CWA is a near-real-time advisory whose pedagogy is different (it's about regional center decisions, not synoptic patterns). Bundling both adds advisory variants without a documented course step demand.

Trigger to revisit:
When a course step needs explicit Convective SIGMET decoding pedagogy (the WST product is its own decoding ladder). Concretely: when the weather-comprehensive section on convective hazards documents that AIRMETs alone are insufficient for the lesson.

Implementation pattern when triggered:
Add `libs/wx-engine/src/products/convective-sigmet.ts` exporting `deriveConvectiveSigmets(truth)`. The function enumerates `truth.convection.cells` with `peakDbz >= 50` (canonical Convective SIGMET threshold) and emits a WST advisory per cluster. CWAs derive similarly. Tracked as a follow-on WP `wx-engine-convective-advisories`.

References:

- [spec.md](./spec.md) Scope -> Out
- [spike-notes.md "What was cut"](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md)

## Multi-cycle TAF amendments (AMD / COR cycles)

Status: Deferred

What was deferred:
TAF amendment cycles -- multiple TAFs per station per issuance window with `AMD` (amended) or `COR` (corrected) tags.

Why:
Per [spec.md](./spec.md) Scope -> Out: v1 emits one TAF per station per issuance. AMD/COR pedagogy is a separable lesson (it's about decoding the relationship between an original TAF and its amendment, not about the underlying weather). Building it requires the engine to model "what changed since the prior issuance" -- a state-evolution problem that's not load-bearing for v1.

Trigger to revisit:
When a course step exercises TAF amendment pedagogy. Concretely: a "what does AMD mean and when does it fire?" lesson.

Implementation pattern when triggered:
Add a per-scenario `taf.amendments` field to the `TruthModel` (an array of `{ stationIcao, issueTimeOffset, reason }`). The engine emits the original TAF + each amendment as separate TAF objects, with the parsed shape carrying the AMD/COR tag.

## Multi-leg PIREP routing

Status: Deferred

What was deferred:
PIREP placement that follows a multi-leg route (e.g., a long XC with PIREPs at each waypoint reflecting per-segment conditions).

Why:
Per [spike-notes.md "What was cut"](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md): v1 PIREPs are hand-curated to 2-4 per scenario based on hazard zones + cells. A multi-leg routing model adds per-segment evaluation logic that's not load-bearing for the spike's pedagogical demonstration.

Trigger to revisit:
When a scenario needs to teach PIREP route-segment-specificity (e.g., "what does the PIREP at LEG-3 tell you about LEG-4?").

Implementation pattern when triggered:
Add a per-scenario `route` field to the `TruthModel` (an ordered array of waypoint coords). The PIREP derivation walks the route and emits a PIREP per leg whose location is on-route and whose contents reflect the truth at that location.

## Real-terrain elevation in the truth model

Status: Deferred

What was deferred:
Real-terrain elevation grid for the truth model. The current `TruthState.terrain` carries coarse ridge polylines + peak elevations -- sufficient for the mountain-wave scenario but not for fine-grained orographic effects (lee-side rotor placement, pass-altitude considerations).

Why:
Per [architecture.md](../../vision/products/pre-flight/weather-scenario-engine/architecture.md) "Layer 1": real terrain elevation is a downstream enhancement. The coarse-ridge model carries the load for v1 mountain-wave pedagogy. Real terrain requires a DEM ingest pipeline + per-derivation orographic computation -- meaningful work for marginal v1 pedagogical value.

Trigger to revisit:
When a course step needs realistic mountain-pass weather decisions (e.g., a Sierra-Nevada XC scenario that asks "is the pass at 8000ft flyable today?").

Implementation pattern when triggered:
Ingest a low-resolution DEM (Natural Earth or USGS) into `data/references/terrain/`. Extend `TruthState.terrain` with a `gridSourcePath` + sampling helpers. Update the windward / leeward derivation in `advanceTruth` to compute orographic lift / subsidence from the DEM rather than from coarse ridge polylines. Tracked as a follow-on WP `wx-engine-terrain-realism`.

References:

- [architecture.md "Layer 1"](../../vision/products/pre-flight/weather-scenario-engine/architecture.md)
- [DESIGN.md "TerrainState"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md)
