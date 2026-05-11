---
id: wx-engine
title: 'Spec: Truth-Aware Weather Scenario Engine'
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
  - spike-derived
  - truth-aware
  - infrastructure
legacy_fields:
  feature: wx-engine
  type: spec
---

# Spec: Truth-Aware Weather Scenario Engine

A pure-code TypeScript library at `libs/wx-engine/` that generates a complete pre-flight briefing pack -- products, charts, and Socratic commentary -- from a single canonical atmospheric truth state. Outputs land at `data/wx-scenarios/<slug>/` (truth + products + chart sources + commentary) and `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml` (mirrored chart specs that the [wx-chart-symbology-library](../wx-chart-symbology-library/spec.md) renders into SVG via `bun run charts build`).

## Why this WP exists

[Spike 01](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) -- merged via PR #801 -- proved the killer-feature hypothesis end-to-end. From a 300-line hand-coded `TruthModel` literal for a frontal-XC scenario, the engine derived 5 product kinds (5 METARs, 5 TAFs, 3 AIRMETs, 1 FB grid with 45 rows, 3 PIREPs), 11 chart specs, and 10 Socratic callouts -- all mutually consistent, and every chart rendered through wx-charts without a single library modification. Round-trip parse warnings: 0 across every product the engine emitted.

That spike answered the architecture question. This WP lifts the spike code into a production library, expands the scenario set from 1 to 6, completes the chart-derivation coverage to 13 of the 17 wx-chart-symbology-library renderers, and wires `bun run wx-scenario build <slug>` into the course-step `:::scenario slug=...` directive so a course author can write one line and get a complete truth-aware briefing pack rendered into the lesson.

## Killer-feature framing

See [VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md). The killer feature is **the engine knows the truth**: every isobar, every TAF FM transition, every AIRMET polygon, every gust value has a known reason because the engine authored it from a parameterized atmospheric state. Real-world briefing tools cannot do this -- they read products without the truth that produced them. This engine inverts the relationship: truth first, products derived, commentary tied back to the truth via knowledge-graph node references. That makes it possible to author Socratic prompts like "why are gusts strong here on a clear post-frontal afternoon?" with a real answer pinned to the underlying physics, not a templated explanation.

## Scope

### In

- One new lib at `libs/wx-engine/` exporting a four-layer derivation pipeline (truth -> products -> charts -> commentary), one engine entrypoint (`generateScenario`), and one bundle writer (`writeScenarioBundle`)
- Stage 1 only (parameterized physics; hand-coded `TruthModel` literals per scenario). S2 (historical calibration) and S3 (replay-with-perturbation) defer to follow-on WPs -- see [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md)
- All five product derivations: METAR, TAF, AIRMET, winds-aloft FB, PIREP -- each a pure function of `TruthModel + station + time`, with round-trip parse via the wx-charts parsers as a hard correctness check
- Thirteen chart-spec derivations against the wx-chart-symbology-library renderers (the load-bearing 13 of the 17 charts in the symbology library): `surface-analysis`, `prog-chart`, `advisory-overlay`, `metar-plot-grid`, `pirep-plot-grid`, `winds-aloft-fb`, `taf-timeline`, `gfa`, `convective-outlook`, `cva`, `freezing-level`, `g-airmet-icing`, `g-airmet-turbulence`. Four chart types defer (radar-mosaic, satellite-ir, satellite-visible, satellite-water-vapor) -- see [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md)
- Socratic commentary derivation tied to existing knowledge-graph nodes under `course/knowledge/weather/`
- Six production scenarios authored as TS literals: `frontal-xc-march` (the spike, hardened), `summer-thunderstorms-tx`, `winter-icing-great-lakes`, `mountain-wave-rockies`, `marine-stratus-pacific-nw`, `dense-fog-radiation-central-valley`
- One CLI dispatcher at `scripts/wx-scenario.ts` (`bun run wx-scenario build <slug>`, `bun run wx-scenario list`, `bun run wx-scenario validate`, `bun run wx-scenario check-round-trip`)
- Output convention: `data/wx-scenarios/<slug>/{truth.json, products/*, charts/*, commentary.md, commentary.json}` plus mirror into `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml` plus mirror into `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/<kind>.json` so the chart CLI's `cache://...` resolver finds the source bytes
- Constants: `WX_SCENARIOS`, `WX_SCENARIO_VALUES`, `WX_SCENARIO_LABELS` in `libs/constants/src/wx-engine.ts`
- Browser-safety: the lib is server-only (filesystem I/O in `writeScenarioBundle`, large hand-coded scenario literals). One server-only barrel `@ab/wx-engine/server`; the runtime barrel `@ab/wx-engine` re-exports types only. Tagged with `// @browser-globals: server-only -- never imported by client .svelte` per repo discipline
- Validator: round-trip parse every product through the wx-charts parsers; cross-product consistency checks (METAR winds vs isobar gradient, TAF FM time vs front motion, AIRMET polygons vs hazard zones, PIREP locations vs hazard centroids); knowledge-node id resolution (every commentary `knowledgeNodeIds` entry must resolve to a real node)
- `bun run check check-round-trip` step: invoke `bun run wx-scenario check-round-trip` for every scenario and fail if any product re-parses with warnings, so the engine cannot ship a product the wx-charts library cannot parse cleanly
- Course-step integration: extend the existing course-step markdown directives with `:::scenario slug="<scenario-id>"` (rendered as the bundle's commentary panel + a tabbed/grid layout of the scenario's product summaries and chart slugs). Implementation lives in the course-reader-and-editor consumer; this WP defines the contract and ships the data the consumer reads
- Phasing: six phases (A through F), each ships its own PR

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) -- the why; the killer-feature thesis
- [DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) -- the spike's 548-line design doc; truth model schema + per-layer derivation contracts + S1-vs-S2/S3 substitution path. Source of truth for shapes
- [architecture.md](../../vision/products/pre-flight/weather-scenario-engine/architecture.md) -- pre-spike 4-layer x 3-stage thinking; partially superseded by DESIGN.md
- [Spike 01 notes](../../../spikes/wx-engine/01-frontal-xc/spike-notes.md) -- spike verdict + recommendations; killer-feature confirmation
- [wx-chart-symbology-library spec](../wx-chart-symbology-library/spec.md) -- the chart renderer this engine produces specs for; defines the 17 chart-type contract
- [PR #801](https://github.com/joshuaball/airboss/pull/801) -- spike merge
- [course/knowledge/weather/](../../../course/knowledge/weather/) -- knowledge nodes that commentary callouts reference

### FAA documentation set (canonical reference inventory)

The truth model is parameterized atmospheric physics. The product derivations match real-world FAA / NWS / AWC product grammars. Authors writing scenario literals reference these documents for parameter realism (S1 only; S2 will sample from archives that already encode these grammars):

- **AC 00-6B** -- Aviation Weather. Background atmospheric science: pressure systems, fronts, air-mass classifications (mT/mP/cT/cP/cA), stability, lapse rates, convection, terrain interactions. Drives the truth model's parameter set
- **AC 00-45H** -- Aviation Weather Services. Product grammars: METAR / SPECI / TAF / AIRMET / SIGMET / PIREP / FB / GFA. Drives every product-derivation function's emit format
- **FMH-1** -- Federal Meteorological Handbook No. 1 (Surface Weather Observations). The METAR / SPECI canonical standard; drives `deriveMetar`'s emit grammar
- **AIM 7-1-21** -- PIREP grammar. Drives `derivePireps`'s emit format
- **Aviation Weather Handbook (FAA-H-8083-28)** -- consolidated reference for the broader product set including AIRMET / G-AIRMET / icing forecasts (Chapter 19), turbulence forecasts (Chapter 20). Drives Phase D commentary that ties chart features back to handbook narrative
- **PHAK Chapter 12** (Weather Theory) and **Chapter 13** (Weather Services) -- pilot-side framing that the commentary layer cites as discovery prompts

The library does not consume these PDFs at build time. They are author-side references; the truth-model parameter ranges and the product-emit grammars match the specifications in these documents.

## Architecture overview

```text
data/wx-scenarios/<slug>/                           <-- per-scenario output directory
  truth.json         serialized TruthModel (debugging aid + auditor reference)
  products/
    metars.txt       raw METAR strings, one per line
    metars.json      array of ParsedMetar (post round-trip)
    tafs.txt         raw TAF strings (one per station, blank-line-separated)
    tafs.json        array of ParsedTaf
    fb-bulletin.txt  raw FB bulletin (FAA fixed-width FORTRAN format)
    fb-bulletin.json ParsedFbGrid
    pireps.txt       raw PIREP strings, one per line
    pireps.json      array of ParsedPirep
    airmets.json     array of AirmetAdvisory (engine-internal shape)
  charts/
    wx-scenario-<slug>-<chart>/
      spec.yaml      mirrors data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml
      sources/       source JSON files this spec references
        <kind>.json
  commentary.md      human-readable callout list (markdown, hand-readable)
  commentary.json    structured callout list (CommentaryCallout[])

data/charts/wx/wx-scenario-<slug>-<chart>/         <-- canonical chart-build location
  spec.yaml          mirror of the engine's chart spec output
  (chart.svg + meta.json after `bun run charts build`)

~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/   <-- source bytes (cache, per ADR 018)
  surface-analysis.json
  prog-12hr.json
  advisory-overlay.json
  metar-plot.json
  taf-timeline-<station>.json
  winds-aloft.json
  pirep-plot.json
  gfa.json
  convective-outlook.json
  cva.json
  freezing-level.json
  g-airmet-icing.json
  g-airmet-turbulence.json

scripts/wx-scenario.ts                              <-- CLI dispatcher
  bun run wx-scenario build <slug>                  generate + write bundle + mirror
  bun run wx-scenario build --all                   walk every scenario, build each
  bun run wx-scenario list                          enumerate registered scenarios
  bun run wx-scenario validate <slug>               run consistency + round-trip checks
  bun run wx-scenario check-round-trip --all        wired into `bun run check`

libs/wx-engine/src/                                 <-- pure code only
  index.ts                                          runtime barrel: types + Zod schemas only
  server.ts                                         server-only barrel: writeScenarioBundle, generators
  truth/
    types.ts                                        TruthModel + helpers (advanceTruth, geometry primitives)
    scenarios/
      registry.ts                                   { id -> () => TruthModel } + ScenarioSeed type
      frontal-xc-march.ts                           Phase A scenario literal (lifted + hardened from spike)
      summer-thunderstorms-tx.ts                    Phase E scenario
      winter-icing-great-lakes.ts                   Phase E scenario
      mountain-wave-rockies.ts                      Phase E scenario
      marine-stratus-pacific-nw.ts                  Phase E scenario
      dense-fog-radiation-central-valley.ts         Phase E scenario
  products/
    metar.ts taf.ts airmet.ts winds-aloft.ts pirep.ts
    types.ts                                        DerivedMetar, DerivedTaf, AirmetAdvisory, DerivedFbGrid, DerivedPirep
  charts/
    types.ts                                        ChartArtifact
    surface-analysis.ts prog-chart.ts airmet-overlay.ts
    metar-plot.ts pirep-plot.ts winds-aloft.ts taf-timeline.ts
    gfa.ts convective-outlook.ts cva.ts freezing-level.ts
    g-airmet-icing.ts g-airmet-turbulence.ts
  commentary/
    socratic.ts                                     callout authoring
    knowledge-link.ts                               knowledge-graph-id resolver (validates against course/knowledge/weather/)
  validate/
    consistency.ts                                  cross-product consistency rules
    round-trip.ts                                   parse-after-emit harness
  engine.ts                                         generateScenario + writeScenarioBundle (server-only)
```

The library accepts `TruthModel` as the only inbound atmospheric state -- derivation functions read from it and nothing else. Substrate data (basemaps, palettes) is owned by `wx-chart-symbology-library`; this lib produces chart specs that reference those substrates by path. No basemap or palette files live in `libs/wx-engine/`.

## Scenario inventory (v1: six production scenarios)

The six scenarios cover the highest-value pedagogical archetypes for pre-flight weather decision-making. Each ships in Phase E except the spike-lift (`frontal-xc-march`) which lands in Phase A as the substrate-validation scenario. Authors writing future scenarios extend the registry; nothing else changes downstream.

| Slug                                 | Pedagogical archetype                                                           | Phase | Region       | Season |
| ------------------------------------ | ------------------------------------------------------------------------------- | ----- | ------------ | ------ |
| `frontal-xc-march`                   | Cold front passage during a Midwest XC; warm-sector vs post-frontal contrast    | A     | KSTL -> KORD | Spring |
| `summer-thunderstorms-tx`            | Pop-up afternoon convection; CAPE / outflow boundary / cell evolution           | E     | KAUS -> KIAH | Summer |
| `winter-icing-great-lakes`           | Stratus + lake-effect icing; freezing-level pedagogy + Zulu AIRMET              | E     | KCLE -> KORD | Winter |
| `mountain-wave-rockies`              | Lee-side mountain wave; Tango AIRMET + PIREP turbulence pattern + jet exit      | E     | KASE -> KDEN | Winter |
| `marine-stratus-pacific-nw`          | Coastal marine layer + ridge subsidence; IFR-trapped destination                | E     | KMRY -> KSFO | Spring |
| `dense-fog-radiation-central-valley` | Nocturnal radiation fog with morning lift; diurnal-cycle pedagogy + LIFR -> VFR | E     | KFAT -> KSCK | Winter |

Each scenario file is a hand-coded `TruthModel` literal (~300 lines, the spike's `frontal-xc-march.ts` is the shape). A scenario author specifies pressure systems + fronts + air-mass polygons + diurnal handle + hazard zones + station registry; the engine derives everything else. Authoring takes ~1-2 hours per scenario once the geometry primitives are mastered.

Slug shape: `wx-scenario-<archetype>-<region-or-detail>`. The slug doubles as the scenario id throughout the engine, the chart-spec slug prefix (`wx-scenario-<slug>-<chart>`), and the cache subdirectory (`cache://scenarios/<slug>/`).

### Phase ordering and dependencies

| Phase | Deliverable                                                               | Depends on                 |
| ----- | ------------------------------------------------------------------------- | -------------------------- |
| A     | Library scaffold + truth model + spike-lift scenario (`frontal-xc-march`) | wx-chart-symbology-library |
| B     | All five product derivations                                              | A                          |
| C     | All thirteen chart-spec derivations                                       | A + B                      |
| D     | Socratic commentary + knowledge-node binding                              | A + B + C                  |
| E     | Five additional production scenarios                                      | A + B + C + D              |
| F     | CLI hardening + check-round-trip step + `:::scenario` directive contract  | A + B + C + D + E          |

A blocks everything. B and C ship in parallel (different agents in different worktrees) once A lands -- products and charts read from `TruthModel` independently. D follows B+C because Socratic callouts pin to chart slugs and product fields. E parallelizes (one agent per scenario) once D lands -- each scenario is a self-contained TS literal that exercises every derivation. F runs last because the round-trip check needs every product + every scenario to compare against.

## Behavior

### Scenario authoring flow

1. Author writes `libs/wx-engine/src/truth/scenarios/<slug>.ts` exporting a `TruthModel` literal (pressure systems, fronts, air masses, upper-level state, convection, diurnal cycle, hazard zones, terrain, station registry, narrative). The `frontal-xc-march.ts` spike file is the canonical shape reference
2. Author registers the slug in `libs/wx-engine/src/truth/scenarios/registry.ts` (string id + lazy import)
3. Author runs `bun run wx-scenario build <slug>`. The CLI:
   - Loads the TruthModel via `loadScenario(slug)`
   - Calls `generateScenario({ kind: slug })` to derive products + charts + commentary
   - Validates: round-trip parses every product (zero warnings or fail), runs cross-product consistency checks (winds vs isobars, FM transitions vs front motion, hazard polygon vs AIRMET ring), resolves every commentary `knowledgeNodeIds` against `course/knowledge/weather/`
   - Writes the bundle to `data/wx-scenarios/<slug>/`
   - Mirrors chart specs into `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml`
   - Mirrors source bytes into `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/`
4. Author runs `bun run charts build wx-scenario-<slug>-<chart>` for each chart slug to render the SVGs
5. Author runs `bun run check` -- 0 errors, 0 warnings (round-trip step is wired in)
6. Author commits the scenario `.ts` file, the `data/wx-scenarios/<slug>/` directory, and the `data/charts/wx/wx-scenario-<slug>-*/spec.yaml` files. The rendered `chart.svg` files are committed by the wx-charts build per its own discipline

### `bun run wx-scenario check-round-trip` (wired into `bun run check`)

Runs `generateScenario` + the round-trip parse harness for every registered scenario without writing to disk. Fails the pipeline on any of:

- A product re-parses with `warnings.length > 0`
- A consistency rule fails (winds-vs-isobars dot product < 0; AIRMET ring missing for a hazard zone; commentary references a knowledge-node id that doesn't exist; etc.)
- A scenario literal violates the `TruthModel` Zod schema

This is the load-bearing guarantee: the engine cannot ship a product that the wx-charts parser rejects, because every commit gates on the round-trip check. The spike runs this in the CLI runner; the production WP wires it into `bun run check`.

### Slug resolution into courses

The course-reader-and-editor consumer ships a markdown directive `:::scenario slug="<scenario-id>"`. At render time the directive resolves to a panel that:

- Pulls `data/wx-scenarios/<slug>/commentary.json` for the callout list
- Pulls the per-product summaries (formatted from `products/*.json`)
- Embeds each chart via the existing `<CourseStepChart slug="wx-scenario-<slug>-<chart>" />` mounting
- Shows the truth narrative as the panel header

This WP defines the data contract (what's at `data/wx-scenarios/<slug>/` and what's at the chart mirror); the consumer WP implements the directive. The engine library does not know about routes -- it only writes files at the canonical paths the consumer expects.

### Engine API

One entrypoint, one bundle writer. Mirrors the spike's API (DESIGN.md "Engine API"):

```typescript
import type { TruthModel } from '@ab/wx-engine';

export type ScenarioSeed =
  | { kind: 'frontal-xc-march' }
  | { kind: 'summer-thunderstorms-tx' }
  | { kind: 'winter-icing-great-lakes' }
  | { kind: 'mountain-wave-rockies' }
  | { kind: 'marine-stratus-pacific-nw' }
  | { kind: 'dense-fog-radiation-central-valley' };

export interface ScenarioBundle {
  scenarioId: string;
  truth: TruthModel;
  products: ScenarioProducts;
  charts: ChartArtifact[];
  commentary: CommentaryCallout[];
}

export function generateScenario(seed: ScenarioSeed): ScenarioBundle;
export async function writeScenarioBundle(bundle: ScenarioBundle, opts: ScenarioRunOptions): Promise<void>;
```

`ScenarioSeed` grows by one variant per added scenario. The `kind` discriminator drives the registry lookup; no other engine-internal change is needed.

### Layer derivation contracts

See [DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) for the per-layer algorithm specifications. Highlights:

- **Layer 1 (truth)**: `TruthModel` is the single canonical state. Every other layer reads from it via pure functions. `advanceTruth(truth, hours)` is the only sanctioned way to move the clock forward (used by prog charts and TAF FM detection)
- **Layer 2 (products)**: each product is `f(truth, station, time)`. The METAR derivation looks up the station's air mass, samples SLP at the station, applies post-frontal gust rules, formats per FMH-1 grammar, and round-trips through the wx-charts METAR parser. TAF walks 1-hour truth advances and emits FM groups when the station's air mass changes. AIRMET enumerates `truth.hazardZones` and maps kind to family (Sierra/Tango/Zulu). FB walks `truth.upperLevel.windByAltitude` per station. PIREP samples hazard-zone centroids + convective cells
- **Layer 3 (charts)**: each chart-spec derivation is `f(truth, derived-products) -> { spec, sources[] }`. The spec is the wx-charts library's Zod-shaped chart spec; the sources are the JSON files the spec's `cache://` URIs reference. The wx-charts library renders without engine-side modification
- **Layer 4 (commentary)**: each callout pins to a chart element + product field, asks a discovery-first question, supplies the truth-model rationale, and references real knowledge-node ids from `course/knowledge/weather/`. Authoring is rule-based (one callout per front passage, one per AIRMET polygon, one per TAF FM transition, etc.); LLM-generated commentary is out of scope for v1

### Truth-state evolution

`advanceTruth(truth, hours)` returns a new `TruthModel` with pressure systems, fronts, convective cells, air-mass polygons, and hazard zones translated by their motion vectors. Pure function -- does not mutate. The function is the only sanctioned way to move time forward; direct mutation of `truth.validAt` is forbidden because layer-1 would diverge from the layer-2/3/4 derivations.

Spike 01 implements +12 hour advance for the prog chart and 1-hour walk for TAF FM detection. Production keeps the same surface; the time integration is unchanged.

## Data model

No DB schema changes. The library is pure code; outputs live on the filesystem under `data/wx-scenarios/<slug>/` and `data/charts/wx/wx-scenario-<slug>-<chart>/`. The cache mirror under `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/` per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) carries source JSON for the wx-charts `cache://` resolver.

`TruthModel` is the canonical type; see [DESIGN.md "Truth model schema"](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md#truth-model-schema) and `libs/wx-engine/src/truth/types.ts` for the full TypeScript shape.

`CommentaryCallout` per DESIGN.md "Layer 4 derivation: commentary":

```typescript
export interface CommentaryCallout {
  id: string;
  target: {
    kind: 'metar' | 'taf-period' | 'chart-feature' | 'airmet' | 'pirep' | 'fb-row';
    chartSlug?: string;
    elementId?: string;
  };
  question: string;       // discovery-first prompt
  observation: string;    // the cue to look at
  reason: string;         // truth-model rationale
  knowledgeNodeIds: string[];
  mode: 'socratic' | 'glance';
}
```

### Constants (in `libs/constants/src/wx-engine.ts`)

```typescript
export const WX_SCENARIOS = {
  FRONTAL_XC_MARCH: 'frontal-xc-march',
  SUMMER_THUNDERSTORMS_TX: 'summer-thunderstorms-tx',
  WINTER_ICING_GREAT_LAKES: 'winter-icing-great-lakes',
  MOUNTAIN_WAVE_ROCKIES: 'mountain-wave-rockies',
  MARINE_STRATUS_PACIFIC_NW: 'marine-stratus-pacific-nw',
  DENSE_FOG_RADIATION_CENTRAL_VALLEY: 'dense-fog-radiation-central-valley',
} as const;

export const WX_SCENARIO_VALUES = Object.values(WX_SCENARIOS);
export type WxScenario = (typeof WX_SCENARIO_VALUES)[number];

export const WX_SCENARIO_LABELS: Record<WxScenario, string> = {
  'frontal-xc-march': 'Cold Front Passage -- Midwest XC (March)',
  'summer-thunderstorms-tx': 'Summer Pop-up Convection -- Texas',
  'winter-icing-great-lakes': 'Winter Lake-Effect Icing -- Great Lakes',
  'mountain-wave-rockies': 'Lee-side Mountain Wave -- Rockies',
  'marine-stratus-pacific-nw': 'Marine Stratus -- Pacific Northwest',
  'dense-fog-radiation-central-valley': 'Radiation Fog -- Central Valley',
};

/** AIRMET family discriminator. */
export const AIRMET_FAMILIES = {
  SIERRA: 'airmet-sierra',
  TANGO: 'airmet-tango',
  ZULU: 'airmet-zulu',
} as const;

export const AIRMET_FAMILY_VALUES = Object.values(AIRMET_FAMILIES);
export type AirmetFamily = (typeof AIRMET_FAMILY_VALUES)[number];
```

## Validation

| Field / rule                      | Rule                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TruthModel`                      | Zod-validated on scenario load. All required fields populated; polygons are valid (>= 3 points, no self-intersection); station registry has lon/lat in CONUS bounds; pressure systems carry motion        |
| `ScenarioSeed.kind`               | One of `WX_SCENARIO_VALUES`                                                                                                                                                                               |
| METAR round-trip                  | `parseMetar(emit(...))` returns `warnings.length === 0` for every emitted METAR                                                                                                                           |
| TAF round-trip                    | `parseTaf(emit(...))` returns `warnings.length === 0` for every emitted TAF                                                                                                                               |
| FB round-trip                     | `parseFbGrid(emit(...))` returns `warnings.length === 0` for the emitted bulletin                                                                                                                         |
| PIREP round-trip                  | `parsePirep(emit(...))` returns `warnings.length === 0` for every emitted PIREP                                                                                                                           |
| AIRMET ring closure               | First and last point of every ring match exactly                                                                                                                                                          |
| Wind-vs-isobar consistency        | At every reporting station, METAR wind direction is within 45 degrees of the geostrophic wind implied by the local isobar gradient (geostrophic dot product > 0). Threshold relaxed within 50 nm of front |
| TAF FM time vs front motion       | Each `FM` group's hour matches the projected front-arrival time at the station within +/- 1 hour                                                                                                          |
| AIRMET polygon vs hazard zone     | Every `truth.hazardZones[*]` produces exactly one AIRMET ring; the ring polygon equals the hazard polygon                                                                                                 |
| Commentary knowledge-node binding | Every `knowledgeNodeIds` entry resolves to an existing node directory under `course/knowledge/weather/`                                                                                                   |
| Chart spec validation             | Every emitted chart spec passes the wx-charts library's per-type Zod schema                                                                                                                               |
| Bundle filesystem layout          | Output directory matches the spec's "Output layout"; cache mirror exists; chart-mirror exists                                                                                                             |

## Edge cases

- **Station inside two air-mass polygons** (front-zone seam): `findAirMass` returns the first match. Authors should design polygons so the front-zone seam is a thin overlap (~5 km buffer), and the seam side is the post-frontal mass to drive the gust rule. Spike's polygon-debug mode (console.log "which mass contains each station") catches misplaced stations during authoring
- **Front polyline doubles back on itself**: `sideOfFront` works for monotonic polylines; arbitrarily-shaped fronts are rejected at scenario validation time. Authors compose multi-segment fronts as separate `Front` records rather than a single doubled-back polyline
- **TAF FM transition outside the valid window**: if the projected front-arrival time falls outside `validHours`, the FM group is suppressed and the scenario emits a single TEMPO/PROB instead. Engine does not extend the TAF window automatically -- the author tunes `validHours` per scenario
- **Convective cell within 5 nm of multiple stations**: each station gets a `+TSRA` METAR. The cell appears in PIREPs at the station whose vector is most aligned with the cell's track
- **Hazard zone with empty severity**: validator rejects -- severity is required (used by AIRMET label and PIREP intensity)
- **Knowledge-node id rename in `course/knowledge/weather/`**: the resolver fails the round-trip check loud. The fixer is to update every commentary callout's `knowledgeNodeIds` to the new id (atomic, mechanical). The validator does not auto-rewrite -- authoring intent is preserved
- **`wx-charts` library version bump invalidates a chart spec**: the next `bun run wx-scenario build <slug>` re-runs the chart-spec derivation; if the new spec shape is incompatible the validator surfaces the breakage. The engine version-pins to a `wx-charts` major in `package.json` and the lint script flags drift
- **Scenario literal exceeds the round-trip checker's tolerance**: the check fails the build. The author tunes the truth state (move a station out of an over-constrained polygon, smooth a front, soften a pressure gradient) until the round-trip passes. There is no override flag
- **Two scenarios reference the same chart slug**: prevented at validate time -- chart slugs are namespaced by scenario id (`wx-scenario-<scenario-id>-<chart>`), so this only happens if scenario ids collide. Scenario id collision is rejected by `WX_SCENARIO_VALUES` enum
- **Empty hazard zones**: a scenario with no hazards emits zero AIRMETs and one "no hazards in effect" commentary callout. Not an error -- valid placeholder for a clear-and-smooth scenario (deferred to a future scenario set; v1 is hazard-rich by design)
- **Cache directory missing**: the writer creates `~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/` if absent. Override the cache root via `AIRBOSS_HANDBOOK_CACHE` per ADR 018
- **Browser-bundle leak risk**: the runtime barrel `@ab/wx-engine` re-exports types only; any value re-export is rejected by the `check-browser-globals.ts` lint. The server barrel `@ab/wx-engine/server` carries every value (generators, writer, scenario literals). The course-step `:::scenario` directive consumer reads files at runtime and never imports the engine -- the data contract is filesystem-backed

## Acceptance

V1 ships when:

- All six scenarios generate cleanly via `bun run wx-scenario build --all` -- 0 round-trip warnings, all consistency checks green, all knowledge-node ids resolve
- All 13 chart-type renderers in wx-charts accept every emitted spec without modification (visual inspection of the rendered SVG matches the truth narrative for each scenario)
- `bun run wx-scenario check-round-trip --all` is wired into `bun run check` and runs green
- The course-step `:::scenario slug="..."` directive renders a complete briefing pack panel for `frontal-xc-march` in the consumer (course-reader-and-editor) -- end-to-end: course step -> directive -> data files -> rendered panel with commentary + chart embeds
- Every commentary callout pins to a real chart slug AND a real product field AND resolves to a real knowledge-node id
- `libs/wx-engine/` has 0 value re-exports in the runtime barrel (types only); server barrel carries every value; `check-browser-globals.ts` passes
- The library's public API (`generateScenario`, `writeScenarioBundle`, `TruthModel`, `ScenarioBundle`, `CommentaryCallout`, `ScenarioSeed`) is documented in the per-phase PR descriptions and re-exported cleanly from the barrels
- Scenario set covers the six pedagogical archetypes named above
- The spike directory `spikes/wx-engine/` is removed in the Phase A PR (the production lib supersedes it; spike-notes.md is referenced from this WP and stays)
- All six WP files (spec, tasks, test-plan, design, user-stories, OUT-OF-SCOPE) carry `agent_review_status: done` after the final phase ships and a clean `/ball-review-full` pass
