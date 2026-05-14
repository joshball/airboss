# Weather Engine

A truth-aware synthetic weather engine. The first instance of the [truth-aware generators](../../../platform/IDEAS.md) pattern -- four layers (truth -> products -> charts -> commentary), three anchoring stages (S1 hand-coded, S2 archive-sampled, S3 real-day replay). Only S1 ships today.

Status: end-to-end shipped (six production scenarios, CLI, `:::scenario` markdown directive). Walkthrough owed per [NOW.md](../../NOW.md). Final close: run `/ball-review-full` over `libs/wx-engine/` + `scripts/wx-scenario/` + `data/wx-scenarios/`, fix findings, flip status.

Spec: [docs/work-packages/wx-engine/](../../../work-packages/wx-engine/).

## The killer feature

Real briefing tools read products (METARs, TAFs, AIRMETs, charts) without knowing the truth that produced them. The wx-engine inverts that: a parameterized `TruthModel` produces every product and every chart, and every Socratic callout pins back to the parameter that caused the observation.

A learner reading "this lesson's METAR has 25-knot post-frontal gusts" can ask why and get an answer rooted in the same model that emitted the METAR. Real-world products lack that explanatory chain.

## The four layers

| Layer         | What                                                                                                                                                                         | Where                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1: Truth      | Hand-coded `TruthModel` literal. Pressure systems, fronts, air masses, convection, upper-level wind, diurnal cycle, hazard zones, terrain, station registry, narrative.      | [libs/wx-engine/src/truth/](../../../../libs/wx-engine/src/truth/)           |
| 2: Products   | Pure derivations `f(truth, station, time)`. Five product types: METAR, TAF, AIRMET, winds-aloft FB, PIREP. Each round-trips through the wx-charts parser with zero warnings. | [libs/wx-engine/src/products/](../../../../libs/wx-engine/src/products/)     |
| 3: Charts     | Pure chart-spec derivations `f(truth, products) -> spec + sources`. Thirteen chart types via the wx-charts library schemas.                                                  | [libs/wx-engine/src/charts/](../../../../libs/wx-engine/src/charts/)         |
| 4: Commentary | Rule-based Socratic callouts pinned to truth-model rationales. Each callout cites real knowledge-graph node ids from `course/knowledge/weather/`.                            | [libs/wx-engine/src/commentary/](../../../../libs/wx-engine/src/commentary/) |

## The three anchoring stages

| Stage | What                                                                                                         | Status    |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------- |
| S1    | Hand-coded `TruthModel` literals per scenario (~250-330 lines each).                                         | Shipped   |
| S2    | Archive-sampled parameters from historical METAR/TAF/reanalysis distributions. Same shape, different anchor. | Follow-on |
| S3    | Real-day replay with perturbation -- seed from archive, modify one variable, regenerate consistently.        | Follow-on |

Only S1 is in production. The architecture stays identical for S2/S3; the data source for layer 1 swaps.

## The six production scenarios

All under [libs/wx-engine/src/truth/scenarios/](../../../../libs/wx-engine/src/truth/scenarios/):

| Slug                                 | Story                          | Route        | Season |
| ------------------------------------ | ------------------------------ | ------------ | ------ |
| `frontal-xc-march`                   | Cold front passage, Midwest XC | KSTL -> KORD | March  |
| `summer-thunderstorms-tx`            | Pop-up convection              | KAUS -> KIAH | Summer |
| `winter-icing-great-lakes`           | Lake-effect icing              | KCLE -> KORD | Winter |
| `mountain-wave-rockies`              | Lee-side mountain wave         | KASE -> KDEN | Winter |
| `marine-stratus-pacific-nw`          | Coastal marine layer           | KMRY -> KSFO | Spring |
| `dense-fog-radiation-central-valley` | Nocturnal radiation fog        | KFAT -> KSCK | Winter |

Each scenario literal is ~230-330 lines. Each one exercises every product derivation and most chart derivations. Six was deliberately the number that exercises every code path at least twice.

## The author journey

1. Write `libs/wx-engine/src/truth/scenarios/<slug>.ts` exporting a `TruthModel` literal (synoptic state, upper-level state, convection, diurnal cycle, hazard zones, station registry, narrative).
2. Register the slug in [libs/wx-engine/src/truth/scenarios/registry.ts](../../../../libs/wx-engine/src/truth/scenarios/registry.ts) and in `WX_SCENARIOS` in [libs/constants/src/wx-engine.ts](../../../../libs/constants/src/wx-engine.ts).
3. Run `bun run wx-scenario build <slug>`. The CLI:
   - Loads the `TruthModel` via `loadScenario(slug)`.
   - Calls `generateScenario({ kind: slug })` -> derives 5 products + 13 chart specs + 8-15 commentary callouts.
   - Validates: round-trip parses every product (zero warnings), checks cross-product consistency, validates schema conformance, resolves every knowledge-node id.
   - Writes the bundle to `data/wx-scenarios/<slug>/`.
   - Mirrors chart specs into `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml`.
   - Mirrors source bytes into `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/`.
4. Run `bun run charts build wx-scenario-<slug>-<chart>` for each chart to render SVGs.
5. Commit the scenario literal, the bundle directory, and the chart mirrors. The Phase F round-trip step in `bun run check` gates the commit.

## The learner journey

A course-step body contains the `:::scenario` directive:

```markdown
:::scenario slug="frontal-xc-march"
:::
```

The directive parser in [libs/help/src/markdown/block.ts](../../../../libs/help/src/markdown/block.ts) reads `MARKDOWN_DIRECTIVE_NAMES.SCENARIO` from [libs/constants/src/markdown-directives.ts](../../../../libs/constants/src/markdown-directives.ts), validates the `slug` attribute, and produces a `DirectiveNode`. The consumer (a `<ScenarioPanel>` Svelte component, to be implemented by the course-reader-and-editor consumer WP) calls the API to fetch the bundle.

API: `GET /api/scenarios/<slug>/bundle.json` -- [apps/study/src/routes/api/scenarios/[slug]/bundle.json/+server.ts](../../../../apps/study/src/routes/api/scenarios/%5Bslug%5D/bundle.json/+server.ts). Validates the slug against `WX_SCENARIO_VALUES`, reads `truth.json`, `commentary.json`, `products/*.json` from `data/wx-scenarios/<slug>/`, returns a `ScenarioBundle` with enumerated `chartSlugs` from the directory listing. One-hour cache header.

The panel renders:

- Header with truth narrative + `validAt` + timezone.
- Tabbed or grid product summaries (raw METAR/TAF strings + parsed shapes).
- Chart embeds via `<CourseStepChart slug="wx-scenario-<slug>-<chart>" />` -- mounts the existing wx-charts renderer.
- Socratic callouts grouped by `target.kind` (metar, taf-period, chart-feature, airmet, pirep, fb-row), each pinning to a chart element or product field, each citing knowledge nodes via the citation-chip pattern.

## Code map

### Engine library

| Path                                                                                                         | What                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [libs/wx-engine/src/index.ts](../../../../libs/wx-engine/src/index.ts)                                       | Runtime barrel. Types-only re-exports. Browser-safe.                                                                                                                                                                 |
| [libs/wx-engine/src/server.ts](../../../../libs/wx-engine/src/server.ts)                                     | Server-only barrel. Every value tagged `@browser-globals: server-only`.                                                                                                                                              |
| [libs/wx-engine/src/engine.ts](../../../../libs/wx-engine/src/engine.ts)                                     | `generateScenario(seed) -> ScenarioBundle`. `writeScenarioBundle(bundle, opts)` writes to disk (lazy-loaded `node:fs`).                                                                                              |
| [libs/wx-engine/src/truth/types.ts](../../../../libs/wx-engine/src/truth/types.ts)                           | `TruthModel`, `SynopticState`, `PressureSystem`, `Front`, `AirMass`, `UpperLevelState`, `ConvectionState`, `FrontalPrecipBand`, `DiurnalCycle`, `HazardZone`, `TerrainState`, `StationRegistry`.                     |
| [libs/wx-engine/src/truth/schema.ts](../../../../libs/wx-engine/src/truth/schema.ts)                         | `truthModelSchema` (Zod). Polygon closure, CONUS bounds, motion vectors, hazard severities.                                                                                                                          |
| [libs/wx-engine/src/truth/geometry.ts](../../../../libs/wx-engine/src/truth/geometry.ts)                     | `pointInPolygon`, `distanceKm`, `distanceNm`, `findAirMass`, `sideOfFront`, `samplePressureMb`, `pressureGradientMbPer100km`.                                                                                        |
| [libs/wx-engine/src/truth/advance.ts](../../../../libs/wx-engine/src/truth/advance.ts)                       | `advanceTruth(truth, hours) -> TruthModel`. Translates pressure systems, fronts, air-mass polygons, convective cells, hazard zones by motion vectors. Used by prog charts (+12 hr) and TAF FM detection (1-hr walk). |
| [libs/wx-engine/src/truth/scenarios/registry.ts](../../../../libs/wx-engine/src/truth/scenarios/registry.ts) | `loadScenario(slug) -> TruthModel`. Lazy-imports + validates.                                                                                                                                                        |
| [libs/wx-engine/src/truth/scenarios/*.ts](../../../../libs/wx-engine/src/truth/scenarios/)                   | One file per scenario.                                                                                                                                                                                               |

### Product derivations

| File                                                                              | Output                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [products/metar.ts](../../../../libs/wx-engine/src/products/metar.ts)             | `deriveMetar(truth, stationIcao, observationTime?) -> DerivedMetar`. Post-frontal gust rules. FMH-1 grammar. Zero-warning round-trip. |
| [products/taf.ts](../../../../libs/wx-engine/src/products/taf.ts)                 | `deriveTaf(truth, stationIcao, { issueTime?, validHours })`. Walks 1-hour advances; emits FM/PROB/BECMG.                              |
| [products/airmet.ts](../../../../libs/wx-engine/src/products/airmet.ts)           | `deriveAirmets(truth) -> AirmetAdvisory[]`. Maps hazard kind -> AIRMET family (Sierra/Tango/Zulu). Polygon = hazard polygon.          |
| [products/winds-aloft.ts](../../../../libs/wx-engine/src/products/winds-aloft.ts) | `deriveFbGrid(truth, stationIcaos) -> DerivedFbGrid`. FAA fixed-width FB. Skips 3000 ft for stations above 2000 ft elevation.         |
| [products/pirep.ts](../../../../libs/wx-engine/src/products/pirep.ts)             | `derivePireps(truth, opts?) -> DerivedPirep[]`. Samples hazard-zone centroids + convective cells.                                     |

### Chart derivations

| File                                                                        | Chart                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [charts/derive-all.ts](../../../../libs/wx-engine/src/charts/derive-all.ts) | Orchestrator. `deriveAllCharts(truth, products, scenarioId) -> ChartArtifact[]`. |
| `charts/surface-analysis.ts`                                                | Pressure systems + fronts + air-mass boundaries.                                 |
| `charts/prog-chart.ts`                                                      | +12 hr projection via `advanceTruth(truth, 12)`.                                 |
| `charts/advisory-overlay.ts`                                                | AIRMET/SIGMET polygons.                                                          |
| `charts/metar-plot.ts`                                                      | Station plots (wind barb + flight category).                                     |
| `charts/pirep-plot.ts`                                                      | PIREP symbols.                                                                   |
| `charts/winds-aloft.ts`                                                     | Wind-barb grid by altitude.                                                      |
| `charts/taf-timeline.ts`                                                    | One per route station; FM groups as timeline.                                    |
| `charts/gfa.ts`                                                             | AIRMET + TAF summaries on CONUS basemap.                                         |
| `charts/convective-outlook.ts`                                              | Cell density + CAPE -> SPC outlook polygons.                                     |
| `charts/cva.ts`                                                             | Per-station ceiling/visibility -> VFR/MVFR/IFR/LIFR.                             |
| `charts/freezing-level.ts`                                                  | Gridded 0 deg C isotherm height.                                                 |
| `charts/g-airmet-icing.ts`                                                  | Icing G-AIRMET polygons + altitude bands.                                        |
| `charts/g-airmet-turbulence.ts`                                             | Turbulence G-AIRMET polygons + altitude bands.                                   |

For a 5-station scenario, ~17 charts total (12 single + 5 TAF timelines).

### Commentary

| File                                                                                        | What                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [commentary/types.ts](../../../../libs/wx-engine/src/commentary/types.ts)                   | `CommentaryCallout { id, target: { kind, chartSlug?, elementId? }, question, observation, reason, knowledgeNodeIds[], mode }`. Modes: `socratic`, `glance`.                                                  |
| [commentary/socratic.ts](../../../../libs/wx-engine/src/commentary/socratic.ts)             | `deriveCommentary(truth, products, charts, scenarioId)`. Rule-based: one callout per front crossing, AIRMET, post-frontal gust, TAF FM, convective cell, PIREP corroboration, etc. Yields 8-15 per scenario. |
| [commentary/knowledge-link.ts](../../../../libs/wx-engine/src/commentary/knowledge-link.ts) | `resolveKnowledgeNodeId(id)` + `validateAllKnowledgeNodes(callouts)`. Checks `course/knowledge/weather/<id>/` exists.                                                                                        |

### Validation + quality gates

| File                                                                              | What                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [validate/consistency.ts](../../../../libs/wx-engine/src/validate/consistency.ts) | Cross-product invariants. Winds-vs-isobars dot product (170 deg tolerance, 180 deg near fronts). TAF FM time vs front motion (+/- 5 hours). AIRMET polygon vs hazard zone (1:1). Commentary knowledge-node id resolution.             |
| [validate/round-trip.ts](../../../../libs/wx-engine/src/validate/round-trip.ts)   | Parse-after-emit harness. Re-parses every product through wx-charts parser; asserts `warnings.length === 0`. The load-bearing gate. Runs in tests + the `bun run wx-scenario check-round-trip --all` step wired into `bun run check`. |

### CLI

[scripts/wx-scenario.ts](../../../../scripts/wx-scenario.ts) is the dispatcher. Subcommands in `scripts/wx-scenario/`:

- `list` -- enumerate registered scenarios.
- `build <slug>` / `build --all` -- generate + write.
- `validate <slug>` -- consistency + round-trip + knowledge nodes, no writes.
- `check-round-trip --all` -- wired into `bun run check`.

### Output locations

| Path                                                      | What                                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/wx-scenarios/<slug>/`                               | Per-scenario output (committed). Files: `truth.json`, `commentary.json`, `commentary.md`, `products/{metars,tafs,airmets,pireps,fb-bulletin}.{txt,json}`, `charts/<chart>/{spec.yaml,sources/*.json}`. |
| `data/charts/wx/wx-scenario-<slug>-<chart>/`              | Mirror of each chart's spec for the wx-charts build CLI. Holds `spec.yaml`, eventually `chart.svg` + `meta.json` after build.                                                                          |
| `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/` | Source bytes (per [ADR 018](../../../decisions/018-source-artifact-storage-policy/decision.md)). Resolved by the wx-charts `cache://` URI resolver.                                                    |

### Constants

[libs/constants/src/wx-engine.ts](../../../../libs/constants/src/wx-engine.ts):

- `WX_SCENARIOS` -- closed enum of all six slugs.
- `WX_SCENARIO_VALUES`, `WX_SCENARIO_LABELS`, `WxScenario` type.
- `AIRMET_FAMILIES`, `AIRMET_FAMILY_VALUES`, `AirmetFamily` -- SIERRA / TANGO / ZULU discriminator.

[libs/constants/src/markdown-directives.ts](../../../../libs/constants/src/markdown-directives.ts):

- `MARKDOWN_DIRECTIVE_NAMES.SCENARIO` + `.CHART`.
- `MARKDOWN_DIRECTIVE_REQUIRED_ATTRS` -- `scenario` requires `slug`.

## Key decisions

| Decision                                                                    | Why                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Four layers, three anchoring stages.                                        | Each layer is pure. Each stage swaps the layer-1 anchor. S2/S3 are deferred but the model is stage-agnostic.                                                                                           |
| Truth -> products -> charts -> commentary inversion.                        | Real briefing tools read products without knowing the truth. The engine reverses the relationship so commentary can pin to parameterized causes.                                                       |
| Round-trip every product through the wx-charts parser with zero warnings.   | The load-bearing gate. If the engine emits a product the wx-charts library can't parse, the engine is wrong. `bun run check` blocks the pipeline.                                                      |
| Closed scenario enum at Phase A; Phase E adds TS literals only.             | No type-level changes per scenario. Each scenario is a self-contained ~250-line TS file. Lets agents parallelize scenarios with no dependency chain.                                                   |
| Server-only lib with runtime/server barrel split.                           | Scenario literals are ~300 lines each; the bundle writer touches the filesystem; neither belongs in any browser bundle. Runtime barrel re-exports types only; server barrel carries every value.       |
| API route `/api/scenarios/[slug]/bundle.json` (PR #928).                    | The consumer (course-reader's `<ScenarioPanel>`) requests bundled data via REST, not direct module import. No runtime coupling between wx-engine and the consumer.                                     |
| Markdown directive contract (`:::scenario`, `:::chart`) shipped in PR #932. | Filesystem-backed contract; no shared TypeScript between the engine and its consumer.                                                                                                                  |
| Deterministic, reproducible builds.                                         | Re-running `bun run wx-scenario build <slug>` produces byte-identical files when the literal and engine are unchanged. Committed bundles stay in sync; consumer can read at build time or render time. |
| Rule-based commentary, not LLM.                                             | An LLM template can describe the observation but cannot pin it to the parameterized truth. Pinning is the killer feature; an LLM erodes it. Rejected.                                                  |
| Phase F wires `check-round-trip` into `bun run check`.                      | Every commit runs every scenario's full validation. One broken scenario blocks the pipeline.                                                                                                           |

## Operator notes

### Quick start

```bash
bun run wx-scenario list
bun run wx-scenario build frontal-xc-march
bun run wx-scenario build --all
bun run wx-scenario validate frontal-xc-march    # no writes
bun run wx-scenario check-round-trip --all
bun run check                                    # includes the round-trip step
```

### Inspect a scenario's truth (offline-friendly)

```bash
# Load + validate the truth model
bun -e "import('./libs/wx-engine/src/truth/scenarios/registry').then(r => r.loadScenario('frontal-xc-march')).then(t => console.log(JSON.stringify(t, null, 2)))"

# Advance time +12 hours (prog-chart pattern)
bun -e "import('./libs/wx-engine/src/truth/scenarios/registry').then(r => r.loadScenario('frontal-xc-march')).then(t => import('./libs/wx-engine/src/truth/advance').then(a => console.log(a.advanceTruth(t, 12))))"

# Generate the full bundle (in-memory, no writes)
bun -e "import('@ab/wx-engine/server').then(e => e.generateScenario({ kind: 'frontal-xc-march' })).then(b => console.log(JSON.stringify(b.products, null, 2)))"
```

### Render in the browser (when on the ground with a DB)

```bash
# Make sure the bundle is on disk
bun run wx-scenario build frontal-xc-march

# Dev server
bun run dev study

# JSON
http://localhost:9600/api/scenarios/frontal-xc-march/bundle.json
```

### Rebuild charts after scenario changes

```bash
bun run wx-scenario build frontal-xc-march
bun run charts build wx-scenario-frontal-xc-march-surface-analysis
bun run charts build wx-scenario-frontal-xc-march-prog-12hr
# ... one per chart slug in the scenario's charts/ dir
```

## Deferred / follow-ups

From [docs/work-packages/wx-engine/OUT-OF-SCOPE.md](../../../work-packages/wx-engine/OUT-OF-SCOPE.md):

| Item                                                | Status       | Trigger                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2: Historical calibration (archive-sampled params) | Follow-on WP | When a real METAR/reanalysis archive ingest is needed for another reason AND v1 hand-coded feel is documented as insufficient. Pattern: `libs/wx-data/` ingest lib + per-scenario S2 variants in the registry. |
| S3: Replay-with-perturbation                        | Follow-on WP | After S2 ships AND a scenario-overlay UX exists. Pattern: `replayRealDay({ date, region, perturbVariable, delta })` + hangar UI.                                                                               |
| Satellite charts (GOES IR/VIS/WV)                   | Deferred     | When geostationary projection synthesis + brightness-temp palette justification is load-bearing for pedagogy.                                                                                                  |
| Radar-mosaic chart (synthetic NEXRAD PNG)           | Follow-on WP | When wx-charts ships a polygon-radar variant OR a synthetic-radar PNG generator is justified.                                                                                                                  |
| Hangar UI for scenario authoring                    | Follow-on WP | When TS literal authoring is documented as blocking content velocity. Map-based polygon editor lowers the floor for non-code authors.                                                                          |
| LLM-generated commentary                            | Rejected     | Out of pedagogical scope. Rule-based authoring is what makes truth-binding load-bearing.                                                                                                                       |
| Real-time weather ingest                            | Rejected     | Out of pedagogical scope. The engine is a curation tool, not an operational briefing tool.                                                                                                                     |

## Related PRs

- #801 -- Spike 01: end-to-end proof. Demonstrated 5 products + 11 charts + 10 callouts from one `TruthModel`, zero parse warnings.
- #824 -- Phase A: scaffold + truth model + `frontal-xc-march` lift from spike.
- #921 -- Browser-safety fix: bootstrap value re-exports moved to `@ab/sources/server`.
- #925 -- Browser-safety fix: runtime barrel stops pulling server-only modules.
- #928 -- `/api/charts` route. Same pattern as `/api/scenarios/[slug]/bundle.json`.
- #932 -- `:::chart` and `:::scenario` markdown directive parsing.
- #948 -- WX Scenarios section in the weather-comprehensive course (depended on course-tree-arbitrary-depth Phase D).

## Related docs

- [docs/work-packages/wx-engine/](../../../work-packages/wx-engine/) -- spec, design, tasks, test-plan, OUT-OF-SCOPE, CONSUMER-CONTRACT
- [docs/decisions/018-source-artifact-storage-policy/decision.md](../../../decisions/018-source-artifact-storage-policy/decision.md) -- cache location for source bytes

## Read next

[06 -- command-palette](06-command-palette.md). The largest UI feature in the codebase. Intent classifier, composite ranker, per-app registries, three rendering modes. Read last because it's dense.
