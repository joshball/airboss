# Spike 01 -- Truth-Aware Weather Engine, Frontal XC -- Notes

Throwaway prototype. Goal: prove the killer-feature hypothesis -- that
generating weather products + charts + commentary from a single canonical
truth state produces verifiably consistent outputs that no real-world
briefing tool could offer a learner.

Output:

- `data/wx-scenarios/frontal-xc-march/` (truth, products, chart sources, commentary)
- `data/charts/wx/wx-scenario-frontal-xc-march-*/` (11 rendered chart SVGs)
- [DESIGN.md](../../../docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md) -- the schema + derivation contracts

## Killer-feature hypothesis verdict

**Killer feature confirmed.** The engine generated truth, derived 5 product
kinds and 11 chart specs from it, and the wx-charts library rendered all 11
without modification. Cross-product consistency is verifiable by inspection:

- METAR wind directions agree with isobar gradient on the surface analysis chart
  (warm-sector S/SSW; post-frontal NW with gusts)
- TAF FM transitions agree with front position and motion vector
  (KORD FM21Z = 2hr after analysis; front 66km east at 25kt = 2.6h ETA)
- AIRMET ring polygons match the truth-state hazard zones one-to-one
  (Sierra over post-frontal IFR area, Tango over post-frontal turbulence area)
- PIREP locations + reported intensities match the AIRMET coverage
  (KSPI MOD chop in PRECIP corroborates Tango polygon + frontal precip band)
- Surface analysis isobar gradient + L/H positions match the per-station
  altimeter readings (KMLI 1000.9mb is consistent with proximity to 996mb L)

Round-trip parse warnings: **0 across all 5 METARs, 5 TAFs, 1 FB grid (45 rows),
3 PIREPs, and 11 chart specs**. The library accepted everything the engine
emitted without a single library modification.

## What worked

- **One truth state, four pure-derivation layers.** The architecture's biggest
  bet -- that layers 2, 3, 4 can be expressed as `f(truth, args)` -- held up
  cleanly. The `TruthModel` interface is the lock-in; everything else flows.
- **The `findAirMass` + `samplePressureMb` + `sideOfFront` helper trio.**
  Three small geometry primitives carry most of the per-station consistency.
  Once they were correct, all five stations classified themselves correctly
  and the products fell out automatically.
- **Hand-coded scenario in <300 lines.** The `frontal-xc-march.ts` literal is
  long but readable. A CFI could review it and verify "yes, the front is in
  the right place between KSPI and KCPS". S2 (archive sampling) replaces just
  this file -- everything downstream is unchanged.
- **The wx-charts library is the right substrate.** The Zod schemas + cache://
  resolution + idempotent build pipeline meant the engine had a clean target.
  Zero wx-charts changes needed; engine output dropped straight in.
- **Round-trip parse as the consistency test.** `parseMetar(emitted)` either
  parses with zero warnings or it doesn't. Every product's emitter was forced
  into shape by the parser before I trusted it.
- **Truth-state forward advance.** `advanceTruth(truth, +12h)` was 50 lines,
  reused by both the prog chart and the TAF derivation. The TAF FM detection
  literally walks 1-hour steps and asks "did the air mass under this station
  change?" -- direct expression of the physics, not a heuristic.

## What was hard

- **Polygon geometry is unforgiving.** First pass air-mass polygons put KSTL
  on the wrong side of the front because my eastern boundary was -89.5 and
  KSTL is at -90.37. Visual debugging from a console.log of "which air mass
  contains each station" was the only way to catch it. A hangar UI for
  authoring scenarios needs a map-based polygon editor; literal coords are
  too easy to get wrong.
- **The wx-charts TAF parser doesn't accept `P6SM`.** Real TAFs use `P6SM`
  ("plus 6 SM" = unrestricted visibility). My emitter uses plain `6SM` to
  round-trip. Library gap, not engine gap, but worth flagging for the
  production WP.
- **FB bulletin formatting is fixed-width FORTRAN-style.** Got it wrong twice
  before adding actual whitespace separators between tokens. The parser is
  more tolerant than the FAA spec; production should emit canonical width.
- **Front-side detection (sideOfFront) was the hardest geometry primitive.**
  Cross-product sign + pip-side cardinal vector + segment-perpendicular --
  three small bugs along the way. The current implementation works for
  monotonic front polylines; arbitrarily-shaped fronts (ones that double back
  on themselves) would fail. Not an issue at this physics scale.
- **Naming the chart slugs.** `wx-scenario-<id>-<kind>` keeps everything
  scoped, but the convention overlaps with how real charts are named. The
  production WP should pick a distinct namespace (e.g., `wx-scn-...`) to
  prevent confusion.

## What was cut

- **S2 / S3 data anchoring.** Architecture supports them; spike implements
  S1 only (hand-coded literal).
- **Radar mosaic chart.** Synthesizing a NEXRAD-style PNG + worldfile from
  the truth model is non-trivial and not load-bearing for the hypothesis.
  The spike substitutes via prog-chart hazard polygons + a SIGMET advisory
  band. Recommendation: extend wx-charts with a polygon-radar variant
  rather than have the engine emit synthetic PNGs.
- **Satellite, GFA, icing CIP/FIP, freezing-level, GTG turbulence, G-AIRMET
  charts.** Each is a `derive<X>Chart` function that follows the same
  pattern as the 7 the spike implemented. Architecture is unchanged.
- **AMD/COR TAF cycles.** Spike emits one TAF per station per issuance.
- **Convective SIGMET / CWA.** Spike emits AIRMETs only.
- **Multi-leg PIREP routing.** Spike hand-curates 3 PIREPs.
- **An authoring UI.** All scenario state is a TS literal. The hangar
  authoring surface is a separate WP.
- **An automated test that round-trips every emitted product through the
  parser as part of `bun run check`.** Spike runs the round-trip in the
  CLI runner; production should add a check-script step.

## Architectural recommendations for the production WP

### 1. Promote the spike to `libs/wx-engine/`

The four-layer split (truth, products, charts, commentary) maps cleanly to
sub-modules:

```text
libs/wx-engine/src/
  truth/
    types.ts                   # TruthModel + helpers
    scenarios/
      <scenario-id>.ts         # one TS literal per scenario (S1)
      <scenario-id>-archive.ts # S2 sampler (when added)
  products/
    metar.ts taf.ts airmet.ts winds-aloft.ts pirep.ts
    sigmet.ts cwa.ts gfa.ts                  # add later
  charts/
    surface-analysis.ts prog-chart.ts airmet-overlay.ts
    metar-plot.ts pirep-plot.ts taf-timeline.ts winds-aloft-fb.ts
    icing-cip.ts icing-fip.ts freezing-level.ts gtg.ts g-airmet.ts  # add later
    radar-polygons.ts          # NEW chart variant for synthetic radar
  commentary/
    socratic.ts                # callout authoring
    knowledge-link.ts          # knowledge-graph-id resolver
  engine.ts                    # generateScenario + writeScenarioBundle
  cli.ts                       # bun run wx-engine generate <scenario>
```

The spike is shaped this way; the lift is mechanical.

### 2. Add `bun run wx-engine` dispatcher

Mirror `bun run charts`. Subcommands: `generate`, `list`, `validate`,
`check-round-trip`. Wire `check-round-trip` into `bun run check` so the
guarantee "every emitted product parses back via the wx-charts library
with zero warnings" becomes a hard check.

### 3. Truth-state evolution as a first-class primitive

`advanceTruth(truth, +Nh)` was the load-bearing helper for both the prog
chart AND the TAF FM detection. Production should expose it as the only
sanctioned way to move time forward in the engine. (Direct mutation of
`truth.validAt` would diverge layer 1 from the layer-2/3/4 derivations.)

### 4. Keep `TruthModel` as the only data the layers can read

The spike enforced this informally (every derive function takes truth + a
few args). The lib should make it formal -- maybe by passing only a
`TruthSnapshot` view to derive functions, with no hooks back into the
scenario seed or engine internals. This is what makes S2/S3 substitution
safe.

### 5. Grow the chart-source `cache://scenarios/...` convention

The spike writes engine outputs into both the scenario directory AND the
cache (so wx-charts can resolve `cache://scenarios/<id>/<kind>.json`). This
worked perfectly. Adopt it as the standard: any tooling that emits
chart-source data lands files into `cache://`-resolvable paths.

### 6. Add a polygon-radar chart variant to wx-charts

The current radar-mosaic is PNG-based. For synthetic data, geometry-in
geometry-out is cleaner. New chart type: `radar-polygons` that takes
`{ cells: [{lon,lat,radiusKm,peakDbz}], frontalBand: {...} }` and renders
filled circles + bands using the NWS reflectivity color ramp. Engine then
has parity for radar without the PNG synthesis pipeline.

### 7. Library gap: TAF parser should accept `P6SM`

`P6SM` ("plus 6 SM") is the FAA-canonical way to encode "visibility
unrestricted" in TAFs. The wx-charts TAF parser silently drops it
(visibility stays null). Production should add the case. Engine then emits
canonical `P6SM` instead of the workaround `6SM`.

## Pedagogical recommendations

Given that the scenario worked end-to-end, here's what the user-facing
product looks like:

### The weather course step shape

```text
A weather lesson "Recognizing Frontal Passage" pulls in:
  - The 5 METARs as a comparison grid (KSTL warm vs KMLI cold side-by-side)
  - The surface analysis chart as the "see why" visual
  - The prog 12hr chart as the "what's coming" visual
  - The 5 TAF timelines as the "what to plan for" visual
  - The 3 AIRMETs as the "where the trouble is" overlay
  - The 10 commentary callouts as the discovery prompts
```

The course author writes once: "use the `frontal-xc-march` scenario for the
frontal-passage lesson." Engine produces the artifacts. Course renders them.

### Drill engine integration

The 5 METARs become 5 spaced-rep cards in `apps/study/`:

- "What does the wind shift between KSTL and KMLI tell you?"
- "Why is dewpoint different between the warm and cold sectors?"
- "What's the AIRMET Sierra polygon and why is it where it is?"

Each card cites the truth model as the answer source -- pedagogically that's
huge, because the student can see WHY they're being asked, not just what the
correct answer happens to be.

### Sim-app integration (future)

When `apps/sim/` ships scenario flights, the wx engine generates the briefing
pack for the scenario's date/time/route. The sim debrief can reference truth:
"You decided to continue past KSPI into the post-frontal IFR. Here's the
truth-model IFR zone you flew through, and here's how the engine knew it
would be there before you launched."

### Hangar (authoring) integration

The scenario seed (`frontal-xc-march.ts`) needs a UI in the hangar app:

- Map-based polygon editor for air masses + hazard zones
- Frontal-line drawing tool with motion-vector arrows
- Pressure-system H/L click-to-place with central-pressure entry
- Live preview of derived products as the author edits
- "Validate consistency" button that runs the round-trip parser

This is its own work package.

## Time spent

~5 hours of agent work across:

- 30 min: required reading + cache layout + chart spec discovery
- 30 min: DESIGN.md authoring
- 60 min: truth model schema + scenario state + helper geometry
- 90 min: layer 2 product derivations (METAR, TAF, AIRMET, FB, PIREP)
- 60 min: layer 3 chart derivations + layer 4 commentary + engine + CLI
- 30 min: end-to-end debug + chart-build verification
- 30 min: spike-notes authoring

Within the 6h cap.
