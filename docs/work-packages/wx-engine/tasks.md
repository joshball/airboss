---
id: wx-engine
title: 'Tasks: Truth-Aware Weather Scenario Engine'
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
  - tasks
legacy_fields:
  feature: wx-engine
  type: tasks
---

# Tasks: Truth-Aware Weather Scenario Engine

Phased plan for [spec.md](./spec.md). Order is dependency-driven: scaffold + truth + spike-lift scenario (Phase A), then product derivations (B), then chart-spec derivations (C), then commentary (D), then the five additional scenarios (E), then CLI hardening + the round-trip check + the consumer directive contract (F). Each phase ships its own PR titled `feat(wx-engine): <phase> -- <summary>`.

Depends on: [wx-chart-symbology-library](../wx-chart-symbology-library/) (the chart renderers this engine produces specs for; in flight). The engine can land before every wx-chart phase ships -- Phase C below produces specs for the 13 chart types whose renderers are registered in the wx-charts registry. Chart types not yet shipped surface a clear "not yet registered" message; the engine treats this as a deferred concern.

## Pre-flight

- [ ] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) end-to-end.
- [ ] Read [docs/vision/products/pre-flight/weather-scenario-engine/VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) -- the killer-feature thesis.
- [ ] Read [docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) end-to-end. This is the architectural source of truth for the truth-model schema, per-layer derivation contracts, and S1-vs-S2/S3 substitution path.
- [ ] Read [docs/vision/products/pre-flight/weather-scenario-engine/architecture.md](../../vision/products/pre-flight/weather-scenario-engine/architecture.md) -- pre-spike thinking; partially superseded by DESIGN.md but useful for the lib-decomposition rationale.
- [ ] Read [spikes/wx-engine/01-frontal-xc/spike-notes.md](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) end-to-end. The Phase A scaffold + scenario lift takes the spike's working code as the starting shape.
- [ ] Read [spikes/wx-engine/src/](../../../spikes/wx-engine/src/) end-to-end (truth/, products/, charts/, commentary/, engine.ts, cli.ts). The Phase A through D code lifts the spike modules into `libs/wx-engine/`.
- [ ] Read [docs/work-packages/wx-chart-symbology-library/spec.md](../wx-chart-symbology-library/spec.md) -- the chart-renderer contract this engine produces specs for; understand the per-chart Zod spec schema and the `cache://` source-resolution convention.
- [ ] Read [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md) -- the cache-vs-repo policy that drives where the engine writes source bytes.
- [ ] Read [docs/decisions/011-knowledge-graph-learning-system/decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md) -- the discovery-first pedagogy the commentary layer follows.
- [ ] Read `libs/constants/src/source-cache.ts` -- the canonical lazy-load pattern for browser-bundled libs that need Node built-ins. The engine's filesystem writer uses the same pattern.
- [ ] Read `libs/bc/study/src/index.ts` and `libs/bc/study/src/server.ts` -- the runtime/server barrel split. `libs/wx-engine/` follows the same shape.
- [ ] Read [docs/agents/best-practices.md](../../agents/best-practices.md) and [docs/agents/reference-engine-patterns.md](../../agents/reference-engine-patterns.md).
- [ ] Verify the dev cache directory exists: `ls ~/Documents/airboss-handbook-cache/wx/scenarios/` (create if missing).
- [ ] Verify the spike output directory exists for cross-reference during Phase A: `ls data/wx-scenarios/frontal-xc-march/` and `ls data/charts/wx/wx-scenario-frontal-xc-march-*/`.
- [ ] Run `bun run check` -- 0 errors before starting.

## Implementation

### Phase A: scaffold + truth + spike-lift scenario (foundation)

Foundational; blocks Phases B/C/D/E/F. Ships the library scaffold (`libs/wx-engine/` with runtime + server barrels), the constants in `libs/constants/src/wx-engine.ts`, the truth-model types (`TruthModel` + helpers + `advanceTruth`), the scenario registry contract, and the spike-lift scenario `frontal-xc-march` -- the same TS literal as the spike, hardened against the Zod `TruthModel` schema. Also retires the spike directory in this same PR -- the production lib supersedes it; the spike-notes.md is referenced from this WP and stays untouched at its current path.

PR title: `feat(wx-engine): Phase A -- scaffold + truth model + frontal-xc-march scenario`.

#### A.1 Constants

- [ ] Create `libs/constants/src/wx-engine.ts` with `WX_SCENARIOS`, `WX_SCENARIO_VALUES`, `WxScenario`, `WX_SCENARIO_LABELS`, `AIRMET_FAMILIES`, `AIRMET_FAMILY_VALUES`, `AirmetFamily` per spec.md "Constants" section. Include all six scenario id literals; Phase A only references `WX_SCENARIOS.FRONTAL_XC_MARCH`, but the enum is closed at all six so subsequent phases append nothing.
- [ ] Re-export from `libs/constants/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(constants): wx-engine scenario and AIRMET-family constants`).

#### A.2 Library scaffold

- [ ] Create `libs/wx-engine/` with `package.json` (deps: `zod`, `yaml`; types: `@ab/wx-charts` for parser types), `tsconfig.json` (extend the repo's lib tsconfig), `src/`.
- [ ] Add `@ab/wx-engine` and `@ab/wx-engine/server` path aliases to the root `tsconfig.base.json`. Mirror the `@ab/wx-charts` pattern.
- [ ] Add the lib to the workspace root config (root `package.json` workspaces); run `bun install`.
- [ ] Create `libs/wx-engine/src/index.ts` (runtime barrel; type-only re-exports). Pending Phase A primitives below.
- [ ] Create `libs/wx-engine/src/server.ts` (server-only barrel). Tag with `// @browser-globals: server-only -- never imported by client .svelte` at the top.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-engine): scaffold lib + workspace alias + barrels`).

#### A.3 Truth-model types and Zod schema

- [ ] Create `libs/wx-engine/src/truth/types.ts` exporting the `TruthModel` interface + sub-interfaces (`StationRegistry`, `SynopticState`, `PressureSystem`, `Front`, `AirMass`, `UpperLevelState`, `WindByAltitudeRow`, `ConvectionState`, `ConvectiveCell`, `FrontalPrecipBand`, `DiurnalCycle`, `HazardZone`, `TerrainState`) per spec.md "Data model" + DESIGN.md "Truth model schema". Lift the spike's `spikes/wx-engine/src/truth/types.ts` verbatim; the spike validated this shape.
- [ ] Re-export every type from the runtime barrel as `type` re-exports.
- [ ] Create `libs/wx-engine/src/truth/schema.ts` exporting `truthModelSchema` (Zod). Validates polygons (>= 3 points), CONUS bounds for stations, motion vectors present on pressure systems, ring closure for hazard polygons.
- [ ] Re-export `truthModelSchema` from the runtime barrel (Zod schemas are runtime values; safe because Zod itself is browser-safe).
- [ ] Create `libs/wx-engine/src/truth/geometry.ts` -- `pointInPolygon`, `distanceKm`, `distanceNm`, `findAirMass`, `distanceToPolylineKm`, `sideOfFront`, `samplePressureMb`, `pressureGradientMbPer100km`. Lift verbatim from the spike's `truth/types.ts` (the spike colocates types + helpers; the production lib splits types from helpers).
- [ ] Create `libs/wx-engine/src/truth/advance.ts` -- `advanceTruth(truth, hours): TruthModel`. Lift from the spike. Pure function.
- [ ] Re-export the helpers from the server barrel (they're values, not types; runtime barrel keeps types only).
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-engine): truth-model types + Zod schema + geometry helpers + advanceTruth`).

#### A.4 Scenario registry + first scenario lift

- [ ] Create `libs/wx-engine/src/truth/scenarios/registry.ts` exporting `loadScenario(slug: WxScenario): TruthModel` -- lazy-imports the scenario module by slug, validates the literal against `truthModelSchema`, returns the validated `TruthModel`. Throws on unknown slug or schema failure.
- [ ] Create `libs/wx-engine/src/truth/scenarios/frontal-xc-march.ts` exporting `FRONTAL_XC_MARCH: TruthModel`. Lift from `spikes/wx-engine/src/truth/scenarios/frontal-xc-march.ts` verbatim. Add a top-of-file comment citing the spike PR (#801) and DESIGN.md.
- [ ] Re-export `loadScenario` from the server barrel.
- [ ] Run `bun run check` -- 0 errors. Validate the lifted scenario via a one-off script: `bun -e "import('./libs/wx-engine/src/truth/scenarios/registry').then(r => r.loadScenario('frontal-xc-march'))"`.
- [ ] Commit (`feat(wx-engine): scenario registry + frontal-xc-march literal`).

#### A.5 Engine entrypoint stub

- [ ] Create `libs/wx-engine/src/engine.ts` exporting `generateScenario(seed: ScenarioSeed): ScenarioBundle` and `writeScenarioBundle(bundle, opts): Promise<void>`. Phase A wires `generateScenario` to load the truth via the registry and return `{ scenarioId, truth, products: emptyShape, charts: [], commentary: [] }`. Phase B fills in products; Phase C fills in charts; Phase D fills in commentary. The stub serves as the integration point so Phases B/C/D can land in parallel against a stable surface.
- [ ] Define `ScenarioSeed` as a tagged union with all six variants (so the type compiles cleanly in Phase E without retroactive edits). Each variant is `{ kind: '<scenario-slug>' }`.
- [ ] Define `ScenarioBundle`, `ScenarioProducts`, `ScenarioRunOptions` per spec.md "Engine API".
- [ ] Implement `writeScenarioBundle` per spec.md "Output layout" -- writes `data/wx-scenarios/<slug>/{truth.json, products/*, charts/*, commentary.md, commentary.json}` and mirrors chart specs into `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml` and source bytes into `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/`. Lift the spike's `engine.ts:writeScenarioBundle` shape.
- [ ] Re-export `generateScenario` and `writeScenarioBundle` from the server barrel.
- [ ] Re-export `ScenarioSeed`, `ScenarioBundle`, `ScenarioProducts`, `ScenarioRunOptions` as `type` re-exports from the runtime barrel.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-engine): engine entrypoint + bundle writer (truth-only, products/charts/commentary stubbed)`).

#### A.6 Spike retirement

- [ ] Delete `spikes/wx-engine/src/` (every file). The production library supersedes it.
- [ ] Keep `spikes/wx-engine/01-frontal-xc/spike-notes.md` (referenced from this WP and DESIGN.md; the verdict + recommendations remain useful).
- [ ] Update DESIGN.md if any path references in it point at the now-deleted spike source files (re-point to `libs/wx-engine/src/...`).
- [ ] Run `bun run check` -- 0 errors. Commit (`chore(wx-engine): retire spike src; production lib supersedes`).

#### A.7 Phase A close

- [ ] Add unit tests in `libs/wx-engine/src/__tests__/truth-schema.test.ts`:
  - `truthModelSchema` accepts the lifted `frontal-xc-march` literal
  - `truthModelSchema` rejects a polygon with 2 points
  - `truthModelSchema` rejects a station outside CONUS bounds
  - `truthModelSchema` rejects a hazard zone with `severity: undefined`
- [ ] Add unit tests in `libs/wx-engine/src/__tests__/advance-truth.test.ts`:
  - `advanceTruth(truth, 0)` returns deeply-equal copy
  - `advanceTruth(truth, 12)` translates pressure-system centers by their motion vectors
  - `advanceTruth(truth, 12)` is pure (does not mutate input)
- [ ] Add unit tests in `libs/wx-engine/src/__tests__/geometry.test.ts`:
  - `findAirMass` returns the expected mass for every station in the spike scenario
  - `samplePressureMb` returns the expected SLP for known points (cross-check against the spike output)
  - `sideOfFront` correctly classifies the spike's 5 stations
- [ ] Run `bun test libs/wx-engine` -- all green. Run `bun run check` -- 0 errors. Commit (`test(wx-engine): truth-model schema + advanceTruth + geometry`).
- [ ] Open PR `feat(wx-engine): Phase A -- scaffold + truth model + frontal-xc-march scenario`. Body summarizes the lift + retirement + the testing surface added.

### Phase B: product derivations (METAR / TAF / AIRMET / FB / PIREP)

Ships the five layer-2 product derivations as pure functions of `TruthModel + station + time`. Each derivation lifts from the spike's `spikes/wx-engine/src/products/*.ts` and adds a Zod-validated emit contract + a round-trip parse harness. The spike already validated the algorithms; this phase makes them production-shaped.

PR title: `feat(wx-engine): Phase B -- product derivations (METAR / TAF / AIRMET / FB / PIREP)`.

#### B.1 Product types

- [ ] Create `libs/wx-engine/src/products/types.ts` exporting `DerivedMetar`, `DerivedTaf`, `AirmetAdvisory`, `DerivedFbGrid`, `DerivedPirep` per the spike. Each carries `{ raw: string; parsed: ParsedX }` for round-trip verification. Use `import type { ParsedMetar, ParsedTaf, ParsedFbGrid, ParsedPirep } from '@ab/wx-charts'`.
- [ ] Re-export from the runtime barrel as `type` re-exports.

#### B.2 METAR derivation

- [ ] Create `libs/wx-engine/src/products/metar.ts` exporting `deriveMetar(truth, stationIcao, observationTime?): DerivedMetar`. Lift from the spike. Algorithm per DESIGN.md "Layer 2 derivation: products -> METAR".
- [ ] Round-trip: every emitted METAR re-parses with `warnings.length === 0`.
- [ ] Add unit tests: `deriveMetar(spikeTruth, 'KSTL')` returns the expected raw + parsed shape; warm-sector stations have S/SSW winds; post-frontal stations have NW winds with gusts; station inside an IFR hazard zone has reduced visibility + ceiling.

#### B.3 TAF derivation

- [ ] Create `libs/wx-engine/src/products/taf.ts` exporting `deriveTaf(truth, stationIcao, opts: { issueTime?, validHours }): DerivedTaf`. Lift from the spike. Algorithm per DESIGN.md "Layer 2 derivation: products -> TAF": walk 1-hour truth advances, emit FM groups when air mass under station changes, emit PROB30/40 for convective windows, emit BECMG for gradual SLP-gradient changes.
- [ ] Round-trip: every emitted TAF re-parses with `warnings.length === 0`.
- [ ] Add unit tests: KORD's TAF for the spike scenario contains an FM group at the projected front-arrival hour (within +/- 1 hour); KSTL's TAF (warm sector) contains no FM group; the FM transition's wind direction matches the post-frontal mass.

#### B.4 AIRMET derivation

- [ ] Create `libs/wx-engine/src/products/airmet.ts` exporting `deriveAirmets(truth): AirmetAdvisory[]`. Algorithm per DESIGN.md "Layer 2 derivation: products -> AIRMET": enumerate `truth.hazardZones`, map kind -> family (`ifr` and `mountain-obscuration` -> Sierra; `turbulence` -> Tango; `icing` -> Zulu), use the hazard polygon as the AIRMET ring directly.
- [ ] Add unit tests: spike scenario produces exactly 3 AIRMETs (Sierra IFR + Tango turb + Zulu icing); each ring has matched first/last point; each `fromHazardZoneId` resolves to a real `truth.hazardZones[*].id`.

#### B.5 Winds aloft (FB) derivation

- [ ] Create `libs/wx-engine/src/products/winds-aloft.ts` exporting `deriveFbGrid(truth, stationIcaos): DerivedFbGrid`. Lift from the spike. Algorithm per DESIGN.md "Layer 2 derivation: products -> Winds aloft (FB)".
- [ ] Round-trip: emitted bulletin re-parses with `warnings.length === 0`. Skip 3000 ft for stations above 2000 ft elevation (terrain rule).
- [ ] Add unit tests: spike scenario emits 5 stations x 9 altitudes = 45 rows; KASE (high-elevation) skips the 3000 ft row; all rows have direction in [0, 360) and speed in [0, 199].

#### B.6 PIREP derivation

- [ ] Create `libs/wx-engine/src/products/pirep.ts` exporting `derivePireps(truth, opts?): DerivedPirep[]`. Algorithm per DESIGN.md "Layer 2 derivation: products -> PIREP".
- [ ] Round-trip: every emitted PIREP re-parses with `warnings.length === 0`.
- [ ] Add unit tests: spike scenario emits 3 PIREPs; one near the Tango polygon centroid carries `MOD` chop; one near a convective cell carries `+TSRA SEV` turbulence; PIREP locations are inside their referenced hazard zone or within 5 nm of the referenced cell.

#### B.7 Engine wires up products

- [ ] Update `libs/wx-engine/src/engine.ts:generateScenario` to call all five derivations and populate `bundle.products`. The `ROUTE_STATIONS` and `FB_STATIONS` lists become per-scenario metadata on the `TruthModel` (add `routeStations: string[]` and `fbStations: string[]` to the type, populate in the scenario literal). Update the spike's `frontal-xc-march.ts` literal accordingly.
- [ ] Re-export `deriveMetar`, `deriveTaf`, `deriveAirmets`, `deriveFbGrid`, `derivePireps` from the server barrel.
- [ ] Run `bun run check` -- 0 errors. Run `bun -e "..."` to invoke `generateScenario({ kind: 'frontal-xc-march' })` and confirm the bundle now carries 5 METARs, 5 TAFs, 3 AIRMETs, 1 FB, 3 PIREPs (matching the spike). Commit (`feat(wx-engine): wire products into generateScenario`).

#### B.8 Phase B close

- [ ] Add an integration test in `libs/wx-engine/src/__tests__/products-spike-parity.test.ts` that asserts: `generateScenario({ kind: 'frontal-xc-march' }).products` matches the spike's recorded outputs at `data/wx-scenarios/frontal-xc-march/products/` (count + raw string equality for the 5 METARs, 5 TAFs, 3 AIRMETs, 1 FB, 3 PIREPs). The spike's outputs are the regression baseline.
- [ ] Run `bun test libs/wx-engine` -- all green. Run `bun run check` -- 0 errors.
- [ ] Open PR `feat(wx-engine): Phase B -- product derivations (METAR / TAF / AIRMET / FB / PIREP)`. Body shows the spike-parity test passing.

### Phase C: chart-spec derivations

Ships the 13 layer-3 chart-spec derivations. Each is a pure function of `(TruthModel, derived-products) -> { spec, sources[] }` whose `spec` matches the wx-charts library's per-type Zod schema. The spike covers 7; this phase extends to 13. Four chart types remain out (radar-mosaic, satellite-{ir,visible,water-vapor}); see [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

PR title: `feat(wx-engine): Phase C -- chart-spec derivations (13 of 17)`.

Phase C ships within parallel-friendly clusters. Cluster C-spike (the 7 the spike already covers) lifts directly. Cluster C-new (the 6 new) writes fresh derivations against the wx-charts schemas.

#### C.1 Chart artifact type

- [ ] Create `libs/wx-engine/src/charts/types.ts` exporting `ChartArtifact` per DESIGN.md "Layer 3 derivation: chart specs". Re-export as `type` from the runtime barrel.

#### C.2 Spike-lift charts (C-spike cluster: 7 charts)

- [ ] Lift `spikes/wx-engine/src/charts/surface-analysis.ts` -> `libs/wx-engine/src/charts/surface-analysis.ts`.
- [ ] Lift `spikes/wx-engine/src/charts/prog-chart.ts` -> `libs/wx-engine/src/charts/prog-chart.ts`.
- [ ] Lift `spikes/wx-engine/src/charts/airmet-overlay.ts` -> `libs/wx-engine/src/charts/airmet-overlay.ts`.
- [ ] Split `spikes/wx-engine/src/charts/product-charts.ts` into one file per chart:
  - `libs/wx-engine/src/charts/metar-plot.ts` -- `deriveMetarPlotChart(truth, metars, scenarioId)`
  - `libs/wx-engine/src/charts/pirep-plot.ts` -- `derivePirepPlotChart(truth, pireps, scenarioId)`
  - `libs/wx-engine/src/charts/winds-aloft.ts` -- `deriveWindsAloftChart(truth, fbGrid, stations, scenarioId)`
  - `libs/wx-engine/src/charts/taf-timeline.ts` -- `deriveTafTimelineChart(truth, taf, station, scenarioId)`
- [ ] Each derivation function returns `ChartArtifact { slug, spec, sources[] }`. The spec validates against the wx-charts per-type Zod schema (import the schemas from `@ab/wx-charts`).
- [ ] Add unit tests asserting each derivation's spec passes the wx-charts schema validation for the spike scenario.
- [ ] Commit (`feat(wx-engine): C-spike cluster -- lift 7 chart-spec derivations from spike`).

#### C.3 New chart derivations (C-new cluster: 6 charts)

- [ ] Create `libs/wx-engine/src/charts/gfa.ts` -- `deriveGfaChart(truth, airmets, tafs, scenarioId): ChartArtifact`. The GFA chart composites AIRMET polygons + per-station TAF summaries on a CONUS basemap. Source JSON shape matches the wx-charts `gfaSpecSchema`.
- [ ] Create `libs/wx-engine/src/charts/convective-outlook.ts` -- `deriveConvectiveOutlookChart(truth, scenarioId): ChartArtifact`. Maps `truth.convection.cells` + the `truth.synoptic.fronts` to SPC outlook polygons (TSTM/MRGL/SLGT/ENH/MDT/HIGH tiers based on cell density + CAPE thresholds from `truth.convection.capeJperKgByStation`).
- [ ] Create `libs/wx-engine/src/charts/cva.ts` -- `deriveCvaChart(truth, metars, scenarioId): ChartArtifact`. Maps per-station METAR ceiling/visibility to flight-category polygons (VFR/MVFR/IFR/LIFR) over the CONUS basemap.
- [ ] Create `libs/wx-engine/src/charts/freezing-level.ts` -- `deriveFreezingLevelChart(truth, scenarioId): ChartArtifact`. Computes the freezing-level surface from `truth.upperLevel.windByAltitude[*].meanTempC` interpolated through the standard lapse rate; emits a gridded scalar field of `0 deg C` isotherm height.
- [ ] Create `libs/wx-engine/src/charts/g-airmet-icing.ts` -- `deriveGAirmetIcingChart(truth, airmets, scenarioId): ChartArtifact`. Filters AIRMETs to `airmet-zulu` and emits the icing G-AIRMET polygons + altitude bands.
- [ ] Create `libs/wx-engine/src/charts/g-airmet-turbulence.ts` -- `deriveGAirmetTurbulenceChart(truth, airmets, scenarioId): ChartArtifact`. Filters AIRMETs to `airmet-tango` and emits the turbulence G-AIRMET polygons + altitude bands.
- [ ] Each derivation's spec passes the wx-charts per-type Zod schema. Add unit tests per chart.
- [ ] Commit (`feat(wx-engine): C-new cluster -- 6 new chart-spec derivations (GFA / convective outlook / CVA / freezing-level / G-AIRMET icing / turbulence)`).

#### C.4 Engine wires up charts

- [ ] Update `libs/wx-engine/src/engine.ts:generateScenario` to call every chart derivation and populate `bundle.charts`. Shape the per-scenario chart list as a deterministic ordering (surface -> prog -> AIRMET overlay -> METAR plot -> PIREP plot -> winds aloft -> TAF timelines per route station -> GFA -> convective outlook -> CVA -> freezing level -> G-AIRMET icing -> G-AIRMET turbulence). For a 5-station scenario, expect ~17 chart artifacts (12 single + 5 TAF timelines).
- [ ] Re-export every chart-derivation function from the server barrel.
- [ ] Run `bun run check` -- 0 errors. Generate the bundle for `frontal-xc-march`; verify the 17 chart-spec slugs match the deterministic ordering. Commit (`feat(wx-engine): wire charts into generateScenario`).

#### C.5 Phase C close

- [ ] Add an integration test asserting every chart spec passes the wx-charts library's schema for the spike scenario (loop over `bundle.charts`, look up `CHART_RENDERERS[spec.type].schema`, call `schema.parse(spec)`, expect no throw).
- [ ] Run `bun test libs/wx-engine` -- all green. Run `bun run check` -- 0 errors.
- [ ] Run `bun run wx-scenario build frontal-xc-march` (CLI from Phase F is not yet shipped; for Phase C the equivalent is `bun -e "..."` invoking `generateScenario` + `writeScenarioBundle`). Run `bun run charts build wx-scenario-frontal-xc-march-surface-analysis` and confirm the SVG renders cleanly.
- [ ] Open PR `feat(wx-engine): Phase C -- chart-spec derivations (13 of 17)`. Body shows the per-chart-type schema-pass test results.

### Phase D: Socratic commentary + knowledge-node binding

Ships the layer-4 commentary derivation. Each callout pins to a chart element + product field, asks a discovery-first question, supplies the truth-model rationale, and references real knowledge-node ids from `course/knowledge/weather/`. The spike implements ~10 callouts for the frontal-XC scenario; this phase extends the rule set so every scenario gets ~8-15 callouts automatically.

PR title: `feat(wx-engine): Phase D -- Socratic commentary + knowledge-node binding`.

#### D.1 Callout type and resolver

- [ ] Create `libs/wx-engine/src/commentary/types.ts` exporting `CommentaryCallout` per spec.md "Data model". Re-export as `type` from the runtime barrel.
- [ ] Create `libs/wx-engine/src/commentary/knowledge-link.ts` exporting `resolveKnowledgeNodeId(id): boolean` -- checks that `course/knowledge/weather/<id>/` exists. Use `process.getBuiltinModule('node:fs')` lazy-loaded inside the function body per the canonical pattern.
- [ ] Add a one-shot validator `validateAllKnowledgeNodes(callouts): string[]` returning unresolved ids; called by the Phase F round-trip check.

#### D.2 Socratic rule set

- [ ] Create `libs/wx-engine/src/commentary/socratic.ts` exporting `deriveCommentary(truth, products, charts): CommentaryCallout[]`. Lift the spike's rule set as the starting point. Algorithm per DESIGN.md "Layer 4 derivation: commentary":
  - One callout per station that crossed a front (METAR comparison)
  - One pre-frontal warm-sector callout at the southernmost in-warm-sector station
  - One post-frontal gust callout at the deepest cold-sector station
  - One TAF FM-transition callout per arrival airport
  - One callout per AIRMET (Sierra, Tango, Zulu families get distinct prompts)
  - One surface-analysis isobar-gradient callout
  - One callout per convective cell (when present)
  - One PIREP corroboration callout (matching a PIREP to the AIRMET that explains it)
  - One winds-aloft callout when `jetMaxKt > 80` (jet exit -> turbulence pedagogy)
  - One diurnal callout when `nocturnalInversion === true` (drives morning-fog scenarios)
- [ ] Each rule emits 0 or 1 callout depending on the truth state; the rule set is closed and authored, not LLM-generated.
- [ ] Each callout's `knowledgeNodeIds` references real nodes under `course/knowledge/weather/`. Use the existing nodes: `wx-airmasses-and-fronts`, `wx-wind-systems`, `wx-clouds-and-precipitation`, `wx-stability-and-instability`, `wx-go-nogo-decision`, `wx-icing-types-and-avoidance`, `wx-thunderstorm-hazards`, `wx-fog-and-visibility-obstructions`, `wx-turbulence-types`, `wx-freezing-level`, `wx-product-airmets-sigmets`, `wx-product-pireps`, `wx-product-winds-aloft`, `wx-reading-metars-tafs`, `wx-product-surface-analysis-and-cva`, `wx-product-gfa`, `wx-product-convective-outlook`, `wx-chart-type-surface-analysis`, `wx-data-sources`, `wx-personal-minimums`, `wx-briefing-execution`.
- [ ] Add unit tests: spike scenario emits exactly the 10 callouts the spike produced (regression baseline); each callout's `knowledgeNodeIds` array is non-empty and every id resolves; each callout's `target.chartSlug` (when present) matches a slug in `bundle.charts`.

#### D.3 Engine wires up commentary

- [ ] Update `libs/wx-engine/src/engine.ts:generateScenario` to call `deriveCommentary` and populate `bundle.commentary`. Update `writeScenarioBundle` to write `commentary.md` + `commentary.json` (the spike already does both; lift the markdown formatter).
- [ ] Re-export `deriveCommentary` and `CommentaryCallout` (value + type) from the server barrel; `CommentaryCallout` also re-exports as `type` from the runtime barrel.
- [ ] Run `bun run check` -- 0 errors. Generate `frontal-xc-march`; verify `commentary.md` matches the spike's output line-for-line. Commit (`feat(wx-engine): wire commentary into generateScenario`).

#### D.4 Phase D close

- [ ] Add an integration test asserting every commentary callout's knowledge-node ids resolve against `course/knowledge/weather/`.
- [ ] Run `bun test libs/wx-engine` -- all green. Run `bun run check` -- 0 errors.
- [ ] Open PR `feat(wx-engine): Phase D -- Socratic commentary + knowledge-node binding`. Body lists the 10 rule kinds + the 21 knowledge-node ids the rules can emit.

### Phase E: five additional production scenarios

Ships the five additional scenario literals. Each is a self-contained TS file in `libs/wx-engine/src/truth/scenarios/<slug>.ts` exporting a `TruthModel` literal hand-tuned for the pedagogical archetype. Authoring takes ~1-2 hours per scenario; the work parallelizes (one agent per scenario in different worktrees).

PR title: `feat(wx-engine): Phase E -- five production scenarios`.

For each scenario the agent:

1. Reads the relevant atmospheric science background (AC 00-6B chapter for the archetype)
2. Hand-codes the `TruthModel` literal (pressure systems, fronts, air masses, station registry, hazard zones, diurnal handle)
3. Runs `bun run wx-scenario build <slug>` (or the equivalent `bun -e "..."` for pre-Phase-F invocations)
4. Verifies: round-trip parses pass, consistency checks pass, knowledge-node ids resolve, every chart renders cleanly via `bun run charts build wx-scenario-<slug>-<chart>`, commentary callouts read sensibly when checked against the truth narrative
5. Commits the scenario literal + the generated bundle + the chart spec mirrors

#### E.1 Summer thunderstorms (TX)

- [ ] Create `libs/wx-engine/src/truth/scenarios/summer-thunderstorms-tx.ts` -- pop-up afternoon convection along the Texas Gulf Coast. Pressure: weak surface ridge over central TX; weak surface trough offshore. Air mass: mT inland (high CAPE, T 35C, Td 24C, conditionally unstable); cooler offshore. Convection: 4-6 cells along an outflow boundary moving SE at 10kt, peak dBZ 55. Stations: KAUS, KIAH, KSAT, KCLL, KCRP. Hazards: convective SIGMET-eligible Tango + Zulu; LIFR-pocket Sierra under cells. Scenario teaches CAPE / outflow boundary / cell evolution.
- [ ] Generate + verify per the per-scenario checklist above. Commit (`feat(wx-engine): summer-thunderstorms-tx scenario`).

#### E.2 Winter icing (Great Lakes)

- [ ] Create `libs/wx-engine/src/truth/scenarios/winter-icing-great-lakes.ts` -- stratus + lake-effect icing over Lake Erie. Pressure: cP behind a departing low. Air mass: cP cold + dry over MI/OH (T -10C, Td -15C, stable). Lake-induced layer: BKN/OVC stratus with tops 8000ft, freezing precip in the band downwind of Lake Erie. Stations: KCLE, KORD, KDTW, KGRR, KCAK. Hazards: Zulu icing (SFC-FL080) + Sierra IFR over the lake-effect band + Tango low-level turbulence behind the front. Scenario teaches freezing-level pedagogy + Zulu AIRMET decoding + lake-effect mechanics.
- [ ] Generate + verify. Commit (`feat(wx-engine): winter-icing-great-lakes scenario`).

#### E.3 Mountain wave (Rockies)

- [ ] Create `libs/wx-engine/src/truth/scenarios/mountain-wave-rockies.ts` -- lee-side mountain wave east of the Rockies. Pressure: deep upper-level westerly flow; jet axis aligned perpendicular to the Rockies at FL350. Wind aloft: 70kt at FL180 backing to 90kt at FL300. Terrain: Front Range ridge at 14000ft. Stations: KASE (high elevation, lee side), KDEN, KCOS, KBJC, KAPA. Hazards: Tango severe turbulence in the lee wave (SFC-FL280); Zulu icing in the rotor cloud. PIREPs: SEV chop reports near KASE. Scenario teaches lee-side wave + jet exit + PIREP turbulence-pattern recognition.
- [ ] Generate + verify. Commit (`feat(wx-engine): mountain-wave-rockies scenario`).

#### E.4 Marine stratus (Pacific NW)

- [ ] Create `libs/wx-engine/src/truth/scenarios/marine-stratus-pacific-nw.ts` -- coastal marine layer + ridge subsidence trapping IFR at the destination. Pressure: 1024mb high over the eastern Pacific; ridge axis through PNW. Air mass: marine mP along the coast (T 12C, Td 11C, stable); subsiding inland mass clearing east of the Cascades. Stations: KMRY, KSFO, KOAK, KSCK, KSAC. Marine layer top: 1500ft; ridge subsidence inversion at 3000ft. Hazards: Sierra IFR pocket along the SF Bay coastal margin; clear east of the ridge. Scenario teaches marine layer + subsidence inversion + IFR-trapped destination decision-making.
- [ ] Generate + verify. Commit (`feat(wx-engine): marine-stratus-pacific-nw scenario`).

#### E.5 Radiation fog (Central Valley)

- [ ] Create `libs/wx-engine/src/truth/scenarios/dense-fog-radiation-central-valley.ts` -- nocturnal radiation fog with morning lift along CA Central Valley. Pressure: weak ridge overhead; calm winds. Air mass: cP residual after a clear night (T 4C, Td 4C, surface inversion). Diurnal: nocturnal inversion present, mixing height 200ft at scenario validAt (10Z = 02 PST), solar noon 20Z. Stations: KFAT, KSCK, KMOD, KMER, KPRB. Hazards: Sierra LIFR over the valley floor (SFC-FL003); clearing by 16Z as the sun heats out. Scenario teaches diurnal-cycle pedagogy + LIFR-to-VFR transition timing + radiation fog mechanics.
- [ ] Generate + verify. Commit (`feat(wx-engine): dense-fog-radiation-central-valley scenario`).

#### E.6 Phase E close

- [ ] Verify all six scenarios via `bun run wx-scenario build --all` (the CLI exists in stub form by Phase E; full polish happens in Phase F).
- [ ] Run `bun test libs/wx-engine` -- all green. Run `bun run check` -- 0 errors.
- [ ] Open PR `feat(wx-engine): Phase E -- five production scenarios`. Body summarizes the pedagogical archetypes + per-scenario chart counts + commentary counts.

### Phase F: CLI hardening + check-round-trip + `:::scenario` directive contract

Ships the production CLI dispatcher, wires the round-trip check into `bun run check`, and documents the data contract that the `:::scenario slug="..."` markdown directive consumes (the directive itself ships in the course-reader-and-editor consumer WP -- this WP defines the contract).

PR title: `feat(wx-engine): Phase F -- CLI dispatcher + round-trip check + scenario directive contract`.

#### F.1 CLI dispatcher

- [ ] Create `scripts/wx-scenario.ts` mirroring `scripts/charts.ts` shape. Reads `process.argv.slice(2)`, switches on the first arg, prints help when called with no args / `help` / `-h` / `--help`.
- [ ] Create `scripts/wx-scenario/build.ts` -- `bun run wx-scenario build <slug>` and `bun run wx-scenario build --all`. Calls `generateScenario` + `writeScenarioBundle` per scenario.
- [ ] Create `scripts/wx-scenario/list.ts` -- `bun run wx-scenario list` enumerates registered scenarios from `WX_SCENARIO_VALUES`.
- [ ] Create `scripts/wx-scenario/validate.ts` -- `bun run wx-scenario validate <slug>` runs the consistency + round-trip checks without writing to disk.
- [ ] Create `scripts/wx-scenario/check-round-trip.ts` -- `bun run wx-scenario check-round-trip --all` walks every scenario, runs round-trip parse + consistency + knowledge-node resolution, exits non-zero on any failure. Designed to be invoked from `bun run check`.
- [ ] Add `wx-scenario` to `package.json` `scripts`: `"wx-scenario": "bun scripts/wx-scenario.ts"`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-engine): scripts/wx-scenario.ts dispatcher (build / validate / list / check-round-trip)`).

#### F.2 Wire check-round-trip into `bun run check`

- [ ] Add a step to `scripts/check.ts` that invokes `bun run wx-scenario check-round-trip --all` and reports a per-scenario pass/fail to `.cache/check/wx-scenario-round-trip.{stdout,stderr,exit}`. Mirror the existing graph-validator step shape.
- [ ] Verify the new step runs in the dirty / branch / quick / types / all profiles per spec. The check-round-trip step always runs full regardless of scope (per the existing graph-validator pattern).
- [ ] Run `bun run check all` -- 0 errors, 0 warnings. Commit (`chore(check): wire wx-scenario check-round-trip into the pipeline`).

#### F.3 `:::scenario` directive contract

- [ ] Create `docs/work-packages/wx-engine/CONSUMER-CONTRACT.md` documenting the data contract the `:::scenario slug="..."` directive consumes:
  - The directive resolver reads `data/wx-scenarios/<slug>/commentary.json` for callouts
  - Reads `data/wx-scenarios/<slug>/products/*.json` for per-product summaries
  - Reads `data/wx-scenarios/<slug>/truth.json` for the narrative + scenario metadata (timezone, validAt)
  - Resolves chart embeds via `<CourseStepChart slug="wx-scenario-<slug>-<chart>" />` against the existing wx-charts mounting
  - Knowledge-node references in callouts mount via the existing knowledge-node citation chip pattern
- [ ] File a follow-on issue in the course-reader-and-editor consumer WP backlog noting that the `:::scenario` directive resolver should be added per the contract above. (This WP does not implement the directive; the consumer WP does.)
- [ ] Author one course-step example demonstrating the directive at `course/courses/weather-comprehensive/sections/<existing-section>.yaml` (use whichever weather section best fits frontal passage pedagogy). The example is a markdown body containing `:::scenario slug="frontal-xc-march"`. Until the consumer renderer ships, the directive is a no-op placeholder; the example documents intent.
- [ ] Commit (`docs(wx-engine): :::scenario directive contract + course-step example`).

#### F.4 Phase F close

- [ ] Run `bun run wx-scenario build --all` -- all six scenarios generate cleanly with 0 round-trip warnings.
- [ ] Run `bun run charts build` for every chart slug under `data/charts/wx/wx-scenario-*` -- all render cleanly.
- [ ] Run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Open PR `feat(wx-engine): Phase F -- CLI dispatcher + round-trip check + scenario directive contract`. Body summarizes the dispatcher subcommands + the new `bun run check` step + the consumer-contract doc.

## Final close

- [ ] All six phases shipped. `bun run wx-scenario list` shows 6 scenarios. `data/wx-scenarios/` carries 6 directories. `data/charts/wx/wx-scenario-*` carries ~100 chart-spec mirrors (6 scenarios x 17 charts).
- [ ] Run `/ball-review-full` against the entire `libs/wx-engine/` + `scripts/wx-scenario*` + `data/wx-scenarios/` surface. Fix every finding. Re-run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Set `agent_review_status: done` on every WP file in this directory.
- [ ] Update `docs/work/NOW.md` to flag the WP as ready for human walk-through.
- [ ] Hand off to user for `human_review_status: walked` -> `signed-off`.
