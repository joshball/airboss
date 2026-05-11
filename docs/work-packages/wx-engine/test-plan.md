---
id: wx-engine
title: 'Test Plan: Truth-Aware Weather Scenario Engine'
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
  - test-plan
legacy_fields:
  feature: wx-engine
  type: test-plan
---

# Test Plan: Truth-Aware Weather Scenario Engine

Manual acceptance tests for [spec.md](./spec.md). Prefix `WXENG-`. Scenarios are grouped by phase (substrate, then per-layer, then per-scenario) plus CLI / round-trip / check-pipeline coverage at the bottom.

## Setup

- `bun install` clean.
- `bun run check all` passes on the branch.
- Dev cache exists at `~/Documents/airboss-handbook-cache/wx/scenarios/` (override via `AIRBOSS_HANDBOOK_CACHE`).
- The spike output is available for cross-reference: `data/wx-scenarios/frontal-xc-march/` and `data/charts/wx/wx-scenario-frontal-xc-march-*/` carry the spike's recorded outputs (committed by PR #801).
- The wx-charts CLI is available: `bun run charts list` shows entries; `bun run charts build wx-scenario-frontal-xc-march-surface-analysis` (after Phase A scaffolds the engine) renders the SVG.
- A modern browser is available for visually inspecting rendered chart SVGs.

## Per-scenario fixtures (referenced across phases)

| Slug                                  | Phase | Stations | Expected products | Expected charts | Expected callouts |
| ------------------------------------- | ----- | -------- | ----------------- | --------------- | ----------------- |
| `frontal-xc-march`                    | A     | 5        | 5 / 5 / 3 / 1 / 3 | 17              | ~10               |
| `summer-thunderstorms-tx`             | E     | 5        | 5 / 5 / 4 / 1 / 4 | 17              | ~12               |
| `winter-icing-great-lakes`            | E     | 5        | 5 / 5 / 4 / 1 / 3 | 17              | ~11               |
| `mountain-wave-rockies`               | E     | 5        | 5 / 5 / 3 / 1 / 4 | 17              | ~11               |
| `marine-stratus-pacific-nw`           | E     | 5        | 5 / 5 / 2 / 1 / 2 | 17              | ~9                |
| `dense-fog-radiation-central-valley`  | E     | 5        | 5 / 5 / 2 / 1 / 2 | 17              | ~9                |

Product columns read: METARs / TAFs / AIRMETs / FB grids / PIREPs.

---

## Substrate (Phase A: scaffold + truth model + spike-lift scenario)

### WXENG-1: truthModelSchema accepts the lifted spike scenario

1. Import `loadScenario` from `@ab/wx-engine/server`.
2. Call `loadScenario('frontal-xc-march')`.
3. **Expected:** returns the validated `TruthModel`; no Zod errors thrown; `truth.synoptic.fronts.length === 1`; `truth.airMasses.length >= 2`; `Object.keys(truth.stations).length === 5`.

### WXENG-2: truthModelSchema rejects malformed literals

1. Construct a synthetic literal with `polygon: [[0, 0], [1, 1]]` (2 points) for an air mass; pass through `truthModelSchema.parse`.
2. **Expected:** throws with a Zod error naming the offending polygon path (`airMasses[0].polygon`).
3. Repeat with a station at `lon: 5, lat: 80` (outside CONUS bounds).
4. **Expected:** throws with `stations.<icao>` path.
5. Repeat with a hazard zone missing `severity`.
6. **Expected:** throws with `hazardZones[*].severity` path.

### WXENG-3: advanceTruth is pure and translates by motion

1. Import `advanceTruth` from `@ab/wx-engine/server`. Call `advanceTruth(loadScenario('frontal-xc-march'), 0)`.
2. **Expected:** returns a deep-equal copy of the input; input is unmodified.
3. Call `advanceTruth(truth, 12)`.
4. **Expected:** every `truth.synoptic.pressureSystems[*].lon` and `.lat` translated by the system's `(motionDegTrue, motionKt) * 12 hours`; every `truth.synoptic.fronts[*].points` translated likewise; `truth.validAt` is the input's validAt + 12 hours; input is unmodified.

### WXENG-4: geometry helpers classify the spike's stations correctly

1. For the spike scenario, call `findAirMass(truth, station.coords)` for each of `KSTL`, `KCPS`, `KSPI`, `KMLI`, `KORD`.
2. **Expected:** KSTL + KCPS in the warm/maritime sector mass; KSPI + KMLI + KORD in the post-frontal cold mass (or per the scenario literal's authored intent).
3. Call `samplePressureMb` at each station.
4. **Expected:** post-frontal stations sample lower pressure than warm-sector stations (consistent with the surface low position); per-station altimeter readings derived from these samples match the spike's METAR outputs at `data/wx-scenarios/frontal-xc-march/products/metars.txt`.

### WXENG-5: spike-lift end-to-end (Phase A close)

1. Run `bun -e "import('./libs/wx-engine/src/engine').then(({generateScenario, writeScenarioBundle}) => writeScenarioBundle(generateScenario({kind:'frontal-xc-march'}), {repoRoot:process.cwd()}))"` (Phase A: products + charts + commentary are stubbed; bundle carries truth + empty arrays).
2. **Expected:** writes `data/wx-scenarios/frontal-xc-march/truth.json` matching the lifted scenario; products / charts / commentary directories empty or absent. Existing spike outputs at `data/wx-scenarios/frontal-xc-march/products/*` are NOT touched (the Phase A writer skips empty bundles per design).
3. Diff the generated `truth.json` against the spike's `data/wx-scenarios/frontal-xc-march/truth.json`. **Expected:** equal (the production lib's write is a regression on the spike).

---

## Phase B -- product derivations

### WXENG-10: deriveMetar for warm-sector station

1. Import `deriveMetar` from `@ab/wx-engine/server`. Call `deriveMetar(spikeTruth, 'KSTL')`.
2. **Expected:** result `.parsed.warnings.length === 0`; wind direction in [150, 210] (S-SSW); dewpoint > 10C (warm/moist); altimeter consistent with the spike's recorded value within 0.02 inHg.
3. Same for KCPS. **Expected:** comparable warm-sector pattern.

### WXENG-11: deriveMetar for post-frontal station

1. Call `deriveMetar(spikeTruth, 'KMLI')`.
2. **Expected:** `.parsed.warnings.length === 0`; wind direction in [280, 350] (NW-NNW); wind contains a `G`-prefixed gust group (post-frontal cold-sector); dewpoint < surface temp by >= 10C (drier post-frontal mass).

### WXENG-12: deriveMetar handles convective cells

1. Construct a synthetic truth literal with one convective cell at the same coords as a station.
2. **Expected:** `deriveMetar` adds `+TSRA` weather group + `BKN015CB` cloud layer to the emitted string; round-trip parses cleanly.

### WXENG-13: deriveTaf produces FM transition at projected front-arrival

1. Call `deriveTaf(spikeTruth, 'KORD', { validHours: 12 })`.
2. **Expected:** `.parsed.warnings.length === 0`; the parsed TAF contains exactly one `FM` group whose hour is within +/- 1 hour of the projected front-arrival time at KORD (compute via `advanceTruth`); the FM group's wind direction matches the post-frontal mass's wind.
3. Call `deriveTaf(spikeTruth, 'KSTL', { validHours: 12 })`.
4. **Expected:** TAF has no FM group (KSTL is in the warm sector and the front passes east).

### WXENG-14: deriveAirmets enumerates hazard zones one-to-one

1. Call `deriveAirmets(spikeTruth)`.
2. **Expected:** length equals `spikeTruth.hazardZones.length` (3 in the spike); every advisory's `fromHazardZoneId` resolves to a real zone id; every ring's first/last point match exactly; family mapping is correct (Sierra for `ifr`/`mountain-obscuration`, Tango for `turbulence`, Zulu for `icing`).

### WXENG-15: deriveFbGrid emits per-station per-altitude rows

1. Call `deriveFbGrid(spikeTruth, ['KSTL','KORD','KMSP','KIND','KDSM'])`.
2. **Expected:** `.parsed.warnings.length === 0`; 5 stations x 9 altitudes (= 45 rows) -- minus skipped rows for high-elevation stations; every row's direction in [0, 360); every speed in [0, 199]; format columns are FAA fixed-width.

### WXENG-16: derivePireps centroids match hazard zones

1. Call `derivePireps(spikeTruth)`.
2. **Expected:** at least one PIREP per hazard zone with severity >= moderate; every PIREP's location is inside the referenced zone polygon OR within 5 nm of the referenced convective cell; round-trip parses cleanly.

### WXENG-17: spike-parity products match recorded outputs

1. Run `generateScenario({ kind: 'frontal-xc-march' })`.
2. **Expected:** `bundle.products.metars.map(m => m.raw)` equals the lines of `data/wx-scenarios/frontal-xc-march/products/metars.txt`; same for `tafs.txt`, `pireps.txt`; `bundle.products.fbGrid.raw` equals `data/wx-scenarios/frontal-xc-march/products/fb-bulletin.txt`; `bundle.products.airmets` deep-equals `data/wx-scenarios/frontal-xc-march/products/airmets.json`.

---

## Phase C -- chart-spec derivations

### WXENG-20: every emitted chart spec passes the wx-charts schema

1. Run `generateScenario({ kind: 'frontal-xc-march' })`.
2. For each `bundle.charts[*]`, look up `CHART_RENDERERS[chart.spec.type].schema` from `@ab/wx-charts/server`; call `schema.parse(chart.spec)`.
3. **Expected:** no schema throws; every chart spec is valid input to its renderer.

### WXENG-21: chart count matches deterministic ordering

1. **Expected:** `bundle.charts.length === 17` for the spike scenario (1 surface-analysis + 1 prog + 1 advisory-overlay + 1 metar-plot + 1 pirep-plot + 1 winds-aloft + 5 taf-timeline + 1 gfa + 1 convective-outlook + 1 cva + 1 freezing-level + 1 g-airmet-icing + 1 g-airmet-turbulence).
2. Slugs follow the `wx-scenario-<scenario-id>-<chart-kind>[-<station>]` convention; no slug collisions across the 17.

### WXENG-22: surface-analysis chart renders cleanly

1. After Phase C completes, run `bun run charts build wx-scenario-frontal-xc-march-surface-analysis`.
2. **Expected:** exits 0 with `built` (or `unchanged` on re-run); `chart.svg` exists and opens in a browser; visible CONUS basemap with isobars, H/L markers, the cold front with triangle pips on the correct side; title carries the scenario narrative subtitle.
3. Visually compare against the spike's recorded output at `data/charts/wx/wx-scenario-frontal-xc-march-surface-analysis/chart.svg`. **Expected:** matches (the production lib regenerates the spike's rendering byte-for-byte modulo chrome-version drift).

### WXENG-23: GFA chart composites AIRMET polygons + TAF summaries

1. Run `bun run charts build wx-scenario-frontal-xc-march-gfa`.
2. **Expected:** chart.svg shows the CONUS basemap with the 3 AIRMET polygons overlaid; per-station TAF flight-category dots at the registered stations; layer-band ordering preserved per the wx-charts contract.

### WXENG-24: CVA chart shades flight-category polygons

1. Run `bun run charts build wx-scenario-frontal-xc-march-cva`.
2. **Expected:** chart.svg shows VFR / MVFR / IFR / LIFR colored regions over the CONUS basemap; the IFR region overlaps the post-frontal hazard zone; a small VFR region centered on the warm-sector stations.

### WXENG-25: freezing-level chart renders gridded contour

1. Run `bun run charts build wx-scenario-frontal-xc-march-freezing-level`.
2. **Expected:** chart.svg shows a contoured 0 deg C isotherm-height surface; warmer (higher freezing level) over the warm sector; lower over the post-frontal cold mass; numeric labels on the contours are reasonable (3000-9000 ft for a March scenario).

### WXENG-26: G-AIRMET icing + turbulence charts split AIRMETs by family

1. Run `bun run charts build wx-scenario-frontal-xc-march-g-airmet-icing`.
2. **Expected:** chart.svg shows only the Zulu AIRMET polygon + altitude band; no Tango/Sierra polygons.
3. Same for `wx-scenario-frontal-xc-march-g-airmet-turbulence`. **Expected:** only the Tango polygon.

### WXENG-27: convective-outlook tier polygons

1. Run `bun run charts build wx-scenario-frontal-xc-march-convective-outlook`.
2. **Expected:** chart.svg shows SPC outlook tier polygons (TSTM/MRGL/SLGT/etc.) -- the spike's frontal-XC scenario has minimal convection, so expect a TSTM-only outlook over the front; the summer-thunderstorms-tx scenario should show MRGL/SLGT/ENH tiers.

---

## Phase D -- Socratic commentary + knowledge-node binding

### WXENG-30: deriveCommentary produces 8-15 callouts per scenario

1. Run `generateScenario({ kind: 'frontal-xc-march' })`.
2. **Expected:** `bundle.commentary.length` in [8, 15]; each callout carries a non-empty `question`, `observation`, `reason`, `knowledgeNodeIds[*]`.

### WXENG-31: every callout's chart-slug pin resolves

1. For each `callout` in `bundle.commentary` with `target.chartSlug !== undefined`:
2. **Expected:** `bundle.charts.some(c => c.slug === callout.target.chartSlug)` is true.

### WXENG-32: every knowledge-node id resolves against course/knowledge/weather/

1. For each `callout.knowledgeNodeIds[*]`, check `course/knowledge/weather/<id>/` exists.
2. **Expected:** every id resolves; no missing nodes.
3. Construct a synthetic callout with `knowledgeNodeIds: ['wx-nonexistent-node']`; pass through `validateAllKnowledgeNodes`.
4. **Expected:** returns `['wx-nonexistent-node']`.

### WXENG-33: spike-parity commentary

1. Compare `bundle.commentary` (for `frontal-xc-march`) line-by-line against `data/wx-scenarios/frontal-xc-march/commentary.json`.
2. **Expected:** equal modulo callout id renumbering. The spike's recorded commentary is the regression baseline.

### WXENG-34: socratic mode questions are discovery-first

1. Sample 3 callouts with `mode: 'socratic'`.
2. **Expected:** each `question` is open-ended (starts with "What", "Why", "How"); each `reason` cites a specific truth-model element (named pressure system, specific air mass, named hazard zone, named convective cell). No template placeholders ("the front", "the air mass") -- specific references only.

---

## Phase E -- per-scenario walkthroughs

For each of the 5 new scenarios (summer-thunderstorms-tx, winter-icing-great-lakes, mountain-wave-rockies, marine-stratus-pacific-nw, dense-fog-radiation-central-valley):

### WXENG-40 to WXENG-44: scenario generates cleanly

1. Run `bun run wx-scenario build <slug>`.
2. **Expected:** exits 0; `data/wx-scenarios/<slug>/{truth.json, products/*, charts/*, commentary.{md,json}}` populated; chart specs mirrored under `data/charts/wx/wx-scenario-<slug>-*/`; cache mirror under `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/`.

### WXENG-50 to WXENG-54: per-scenario consistency

For each scenario, verify the per-archetype invariants:

- **summer-thunderstorms-tx**: convective-outlook chart shows ENH or higher tier; PIREPs cluster near cells; commentary cites `wx-thunderstorm-hazards`.
- **winter-icing-great-lakes**: freezing-level chart shows freezing-level near or below FL080; Zulu AIRMET dominates; commentary cites `wx-icing-types-and-avoidance` and `wx-freezing-level`.
- **mountain-wave-rockies**: PIREPs cluster east of the Rockies with SEV chop; jet axis crosses the AIRMET-Tango polygon; commentary cites `wx-turbulence-types`.
- **marine-stratus-pacific-nw**: METAR ceilings at coastal stations are <= 1500 ft AGL; CVA shades coast as IFR/LIFR; commentary cites `wx-fog-and-visibility-obstructions` and `wx-stability-and-instability` (for the subsidence inversion).
- **dense-fog-radiation-central-valley**: METAR visibilities at scenario validAt < 1 SM; TAFs forecast LIFR -> VFR transition (FM group at projected solar-warming hour); commentary cites `wx-fog-and-visibility-obstructions` and walks the diurnal cycle.

### WXENG-60 to WXENG-64: per-scenario rendered charts

For each scenario, run `bun run charts build` for the 17 chart slugs and visually inspect:

1. **Expected:** every chart renders cleanly; subtitles carry the scenario narrative; chart features visually match the truth narrative for the archetype (e.g., the radial-fog scenario's CVA chart shows fog over the valley floor; the mountain-wave scenario's surface-analysis shows tight isobar gradient in the lee).

---

## Phase F -- CLI + check-pipeline

### WXENG-70: `bun run wx-scenario list` enumerates 6 scenarios

1. Run `bun run wx-scenario list`.
2. **Expected:** prints 6 lines, each `<slug> -- <human label>`; matches `WX_SCENARIO_VALUES`.

### WXENG-71: `bun run wx-scenario build <slug>` is idempotent

1. Run `bun run wx-scenario build frontal-xc-march`.
2. Re-run.
3. **Expected:** second invocation produces no `git diff` change in `data/wx-scenarios/frontal-xc-march/` (deterministic generation).

### WXENG-72: `bun run wx-scenario build --all` walks every scenario

1. Run `bun run wx-scenario build --all`.
2. **Expected:** prints per-scenario status (built / unchanged); exits 0; all 6 scenarios end with status committed-or-clean.

### WXENG-73: `bun run wx-scenario validate <slug>` runs without writing

1. With a clean working tree, run `bun run wx-scenario validate frontal-xc-march`.
2. **Expected:** exits 0; prints round-trip parse counts (0 warnings) + consistency check counts (all green) + knowledge-node resolution counts (all resolved); no files modified.

### WXENG-74: `bun run wx-scenario check-round-trip --all` is wired into `bun run check`

1. Run `bun run check all`.
2. **Expected:** the `wx-scenario-round-trip` step appears in the per-step output at `.cache/check/wx-scenario-round-trip.{stdout,stderr,exit}`; exits 0; the step ran across all 6 scenarios.

### WXENG-75: round-trip check fails loud on a regression

1. Edit `libs/wx-engine/src/products/metar.ts` to emit a malformed wind token (e.g., comment out the wind-format step).
2. Run `bun run check all`.
3. **Expected:** the `wx-scenario-round-trip` step fails; the error message names which scenario + which station produced the offending METAR; `bun run check` exits non-zero.
4. Revert the change. Re-run. **Expected:** clean.

### WXENG-76: round-trip check fails loud on a knowledge-node id rename

1. Edit one commentary callout's `knowledgeNodeIds` to reference a non-existent node id (e.g., `wx-nonexistent-node`).
2. Run `bun run check all`.
3. **Expected:** the `wx-scenario-round-trip` step fails; the error message names the unresolved id + the originating scenario + callout id.
4. Revert the change.

---

## End-to-end course-step integration

### WXENG-80: `:::scenario` directive contract documented

1. Open `docs/work-packages/wx-engine/CONSUMER-CONTRACT.md`.
2. **Expected:** the doc enumerates the four data sources the directive resolver reads (truth.json, products/*.json, commentary.json, chart slugs); the resolver invokes `<CourseStepChart slug="..." />` for each chart embed; knowledge-node citations mount via the existing chip pattern.

### WXENG-81: course-step example references frontal-xc-march

1. Open the course-step file the Phase F.3 example landed at (under `course/courses/weather-comprehensive/sections/`).
2. **Expected:** the markdown body contains `:::scenario slug="frontal-xc-march"`; the file passes the existing course-step lint.

### WXENG-82: end-to-end render in the consumer (manual)

(Requires the consumer-WP `:::scenario` directive resolver to be implemented; this scenario is informational until that ships.)

1. Visit the course step in the study app's reader.
2. **Expected:** the panel shows the scenario narrative as the header; the 5 METARs in a comparison grid; the surface-analysis chart; the prog 12hr chart; the 5 TAF timelines; the 3 AIRMETs as overlay markers; the 10 commentary callouts as discovery prompts beside the relevant chart.
