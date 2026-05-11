---
id: wx-engine
title: 'Design: Truth-Aware Weather Scenario Engine'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-10
owner: agent
tags:
  - design
  - weather
  - engine
legacy_fields:
  feature: wx-engine
  type: design
---

# Design: Truth-Aware Weather Scenario Engine

WP-specific design notes. **Source of truth for the architecture, schema, and per-layer derivation contracts is the spike's design doc:** [docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md). Read that first; this doc only adds the production-WP shape on top of it (library decomposition, browser-safety contract, test seams, parallel-phase wiring).

## Library shape derives from Spike 01, not from a clean-sheet design

Spike 01 (PR #801) shipped working code that derived 5 product kinds + 11 chart specs + 10 Socratic callouts from one `TruthModel` literal, and every emitted artifact round-tripped through the wx-charts parsers with zero warnings. The production library is **extraction + hardening + scenario-set expansion**, not invention.

The reasons this matters:

- The spike's geometry primitives (`findAirMass`, `samplePressureMb`, `sideOfFront`, `pressureGradientMbPer100km`, `distanceToPolylineKm`, `pointInPolygon`, `advanceTruth`) are correct. Re-deriving them risks reintroducing the bugs the spike fixed (the cross-product sign issue in `sideOfFront`, the polygon-edge bug that put KSTL on the wrong side of the front, the FB fixed-width formatting issue).
- The per-layer derivation contracts (`f(truth, ...args) -> Product` / `ChartArtifact` / `Callout`) held cleanly through 5 + 7 + 10 implementations. The shape is proven; the lib is the same shape, just split into the canonical module layout.
- The chart-source-bytes-into-cache convention (`~/Documents/airboss-handbook-cache/wx/scenarios/<slug>/<kind>.json` resolved from the chart spec's `cache://scenarios/...` URI) worked perfectly. The wx-charts CLI already resolves `cache://` paths -- nothing changes on the renderer side.

If a derivation function reaches for a primitive the spike's shape did not anticipate, that primitive earns a place in `libs/wx-engine/src/truth/geometry.ts`. The shape evolves; it does not get rewritten.

## Six-phase plan: scaffold first, parallel mid, polish last

Phasing is the load-bearing design decision. The user wants:

1. End-to-end proof as fast as possible (one scenario shipped, mountable into a course)
2. Parallel work on products + charts wherever possible
3. Production scenarios authored only after the derivation pipeline is stable
4. CLI hardening + the round-trip check wired into `bun run check` last

Six phases shape that intent into shippable PRs:

| Phase | Deliverable                                  | Why this grouping                                                                                                                             |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Scaffold + truth + spike-lift scenario       | Substrate cannot be partially shipped. The spike-lift scenario is the regression baseline for B/C/D and the smallest viable end-to-end demo   |
| B     | Five product derivations                     | All five lift cleanly from the spike; round-trip parse is the per-product correctness test. Parallelizable internally (one agent per product) |
| C     | 13 chart-spec derivations                    | Spike covers 7; the 6 new ones are mechanical against the wx-charts schemas. Parallelizable in two clusters (C-spike lift, C-new authoring)   |
| D     | Socratic commentary + knowledge-node binding | Lifts the spike's rule set; adds the resolver against `course/knowledge/weather/`. Sequential after B+C because callouts pin to chart slugs   |
| E     | Five additional production scenarios         | Each scenario is an independent TS literal; perfectly parallel (one agent per scenario in different worktrees)                                |
| F     | CLI hardening + check-round-trip + directive | Polish + the `bun run check` integration. The `:::scenario` directive contract is documented; the implementation lives in the consumer WP     |

Each phase opens its own PR titled `feat(wx-engine): <phase> -- <summary>`. Each PR includes:

- Code changes for that phase
- Per-phase regression baseline (Phase A: spike scenario passes; Phase B: spike-parity test on products; Phase C: every chart spec passes wx-charts schema validation; Phase D: every callout's knowledge-node ids resolve; Phase E: every new scenario generates cleanly; Phase F: `bun run check` includes the round-trip step and runs green)
- Test additions per the test-plan.md scenarios for that phase
- `bun run check` clean

A blocks everything. B and C ship in parallel. D follows B+C. E parallelizes (one agent per scenario). F runs last.

## Strict separation: code in libs/wx-engine/, data in data/, source bytes in cache

The spec mandates the engine is pure code; outputs land at `data/wx-scenarios/<slug>/`, raw scenario source bytes (not currently exercised in v1; reserved for S2/S3) would land in the cache. The reasons:

- **Browser-bundle hygiene**: `libs/wx-engine/` is server-only because the bundle writer touches the filesystem and because scenario literals are large (~300 lines per scenario; six scenarios = ~1800 lines of TS literals that have no business in any browser bundle). The runtime barrel `@ab/wx-engine` re-exports types only; the server barrel `@ab/wx-engine/server` carries every value.
- **Bytes don't belong in code review**: a scenario authoring change should diff cleanly as one TS file (the literal); the generated bundle (`data/wx-scenarios/<slug>/`) is a derived artifact. The bundle is committed (small, deterministic) so course steps can reference it without a build dependency, but reviewers focus on the literal -- the bundle is verified by spot-checking the round-trip output.
- **Cache vs commit**: scenario truth + products + commentary are committed (small, stable, load-bearing for course content). Chart-spec mirrors are committed under `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml` so the wx-charts CLI can build them via `bun run charts build`. Source-bytes-into-cache is the wx-charts library's existing convention; this engine just produces files at the right paths.

The CLI is the bridge. It loads `TruthModel` literals via the registry, calls `generateScenario` + `writeScenarioBundle`, lands files at the canonical paths the consumer expects. The consumer (course-reader-and-editor) reads the files at runtime via the `:::scenario` directive resolver -- no cross-lib import.

## Browser-safety contract

Read [CLAUDE.md "Critical Rules"](../../../CLAUDE.md) and [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md) before authoring any code in this lib. The summary:

- `libs/wx-engine/src/index.ts` (the runtime barrel) is `import type` only. Every value re-export is rejected by the `check-browser-globals.ts` lint.
- `libs/wx-engine/src/server.ts` (the server-only barrel) carries `generateScenario`, `writeScenarioBundle`, `loadScenario`, every product / chart / commentary derivation function, and the geometry helpers. Tagged with `// @browser-globals: server-only -- never imported by client .svelte` at the top.
- The bundle writer (`writeScenarioBundle` in `libs/wx-engine/src/engine.ts`) lazy-loads `node:fs`, `node:path`, `node:os` via `process.getBuiltinModule(...)` inside the function body, gated behind a `typeof process !== 'undefined'` check. Canonical pattern: `libs/constants/src/source-cache.ts`.
- The knowledge-node resolver (`libs/wx-engine/src/commentary/knowledge-link.ts`) follows the same lazy-load pattern for its `node:fs` access.
- The course-step `:::scenario` directive consumer reads files at runtime via SvelteKit's `+page.server.ts` data load -- the consumer never imports `@ab/wx-engine` from a `.svelte` file.

The `check-browser-globals.ts` lint walks every value re-export from `libs/wx-engine/src/index.ts` and confirms the transitive import chain stays browser-safe. A `frontal-xc-march.ts` literal accidentally re-exported through the runtime barrel would import `truth/types.ts` -> `truth/geometry.ts` -> at runtime, but neither of those touches `node:*`. The literal itself is a pure object; safe to ship to the browser at the type-level. Why we still keep it server-only: scenario literals are ~300 lines each and bloat the bundle, AND the bundle writer + scenario registry have node:* dependencies. Disciplined separation prevents accidental leak.

## Truth-state evolution as a first-class primitive

The spike's `advanceTruth(truth, hours)` was the load-bearing helper for both the prog chart AND the TAF FM detection. The production lib promotes it to the only sanctioned way to move time forward. Direct mutation of `truth.validAt` is forbidden because layer-1 would diverge from the layer-2/3/4 derivations.

Phase A lifts `advanceTruth` from the spike. Phase B's TAF derivation walks 1-hour `advanceTruth` steps to detect FM transitions. Phase C's prog-chart derivation calls `advanceTruth(truth, +12)` to project the synoptic state forward. Phase D's commentary cites the projected front-arrival time computed via `advanceTruth`. The function appears in three derivations; one source-of-truth primitive ensures they never disagree.

The function is pure. Production keeps the spike's semantics (translates pressure systems + fronts + cells + air-mass polygons + hazard zones by their motion vectors; air-mass polygons drag with the average front motion as a barotropic approximation; does not regenerate hazard zones from the projected synoptic state -- that's a deferred enhancement).

## TruthModel as the only inbound layer state

The spike enforced this informally (every derive function takes `truth + a few args`). The lib makes it formal: derive functions accept a `TruthModel` (or a `TruthSnapshot` view in S2/S3 if needed) and a small set of derivation args (station id, time, options). They never reach back into the scenario seed, the registry, or engine internals. This is what makes the S2/S3 substitution path work: replace the scenario literal with an archive sampler that fills the same `TruthModel` shape, and every downstream layer is unchanged.

The Zod schema (`truthModelSchema`) is the lock-in. Phase A wires it. Every scenario literal validates through it on load. The schema is the contract.

## Test seams: round-trip is the load-bearing check

Vitest unit tests cover individual derivation functions with synthetic truth states (small literal). Integration tests assert the full bundle (`generateScenario({ kind: 'frontal-xc-march' })`) against the spike's recorded outputs at `data/wx-scenarios/frontal-xc-march/products/` -- the spike is the regression baseline.

The cross-cutting check is **round-trip parse**. For every product the engine emits, parse it back through the wx-charts parser and assert `warnings.length === 0`. The check runs:

- Inside per-product unit tests (B.2 through B.6)
- Inside the integration spike-parity test (B.8)
- Inside the Phase F `bun run wx-scenario check-round-trip --all` step
- Inside `bun run check` (Phase F wires the step into the pipeline)

The check is what enforces the guarantee "the engine cannot ship a product the wx-charts library can't parse cleanly." It is the closest thing to a typed contract between this lib and the wx-charts lib.

Cross-product consistency checks (winds-vs-isobars dot product, FM time vs front motion, AIRMET ring vs hazard polygon, PIREP location vs hazard centroid) live in `libs/wx-engine/src/validate/consistency.ts`. They run inside `bun run wx-scenario validate <slug>` and `bun run wx-scenario check-round-trip --all`. They are not unit tests -- they are scenario-level invariants. Failing one is a bug in the scenario literal OR a bug in the derivation; the validator surfaces enough context to triage.

## Per-layer module layout (`libs/wx-engine/src/`)

```text
libs/wx-engine/src/
  index.ts                                     runtime barrel: TYPE-only re-exports
  server.ts                                    server-only barrel: every value
  truth/
    types.ts                                   TruthModel + sub-interfaces
    schema.ts                                  truthModelSchema (Zod)
    geometry.ts                                pointInPolygon, distanceKm, findAirMass,
                                               distanceToPolylineKm, sideOfFront,
                                               samplePressureMb, pressureGradientMbPer100km
    advance.ts                                 advanceTruth(truth, hours)
    scenarios/
      registry.ts                              loadScenario(slug) + lazy imports
      frontal-xc-march.ts                      Phase A scenario literal
      summer-thunderstorms-tx.ts               Phase E
      winter-icing-great-lakes.ts              Phase E
      mountain-wave-rockies.ts                 Phase E
      marine-stratus-pacific-nw.ts             Phase E
      dense-fog-radiation-central-valley.ts    Phase E
  products/
    types.ts                                   DerivedMetar, DerivedTaf, AirmetAdvisory,
                                               DerivedFbGrid, DerivedPirep
    metar.ts                                   Phase B
    taf.ts                                     Phase B
    airmet.ts                                  Phase B
    winds-aloft.ts                             Phase B
    pirep.ts                                   Phase B
  charts/
    types.ts                                   ChartArtifact
    surface-analysis.ts                        Phase C (lift)
    prog-chart.ts                              Phase C (lift)
    airmet-overlay.ts                          Phase C (lift)
    metar-plot.ts                              Phase C (lift)
    pirep-plot.ts                              Phase C (lift)
    winds-aloft.ts                             Phase C (lift)
    taf-timeline.ts                            Phase C (lift)
    gfa.ts                                     Phase C (new)
    convective-outlook.ts                      Phase C (new)
    cva.ts                                     Phase C (new)
    freezing-level.ts                          Phase C (new)
    g-airmet-icing.ts                          Phase C (new)
    g-airmet-turbulence.ts                     Phase C (new)
  commentary/
    types.ts                                   CommentaryCallout
    socratic.ts                                Phase D rule set
    knowledge-link.ts                          Phase D resolver against course/knowledge/weather/
  validate/
    consistency.ts                             Phase F cross-product invariants
    round-trip.ts                              Phase F parse-after-emit harness
  engine.ts                                    generateScenario + writeScenarioBundle
  __tests__/                                   Vitest specs (per phase)
```

## CLI dispatcher (`scripts/wx-scenario.ts`)

Mirrors `scripts/charts.ts`. Subcommands:

- `bun run wx-scenario list` -- enumerate registered scenarios from `WX_SCENARIO_VALUES` with their human labels
- `bun run wx-scenario build <slug>` -- generate + write bundle + mirror chart specs into `data/charts/wx/`
- `bun run wx-scenario build --all` -- walk every scenario, build each
- `bun run wx-scenario validate <slug>` -- run consistency + round-trip checks without writing to disk
- `bun run wx-scenario check-round-trip --all` -- the `bun run check`-wired step

The dispatcher reads `process.argv.slice(2)`, switches on the first arg, prints help when called with no args / `help` / `-h` / `--help`. No colons in script names per repo discipline.

## Knowledge-node binding strategy

The spike's commentary callouts cite real knowledge-node ids from `course/knowledge/weather/` directly. The production lib does the same. The resolver (`libs/wx-engine/src/commentary/knowledge-link.ts`) checks that each `knowledgeNodeIds[*]` corresponds to a directory under `course/knowledge/weather/<id>/`.

When a knowledge-node id renames, the round-trip check fails loud. The fixer is to update every commentary callout's `knowledgeNodeIds` to the new id (atomic, mechanical -- run a one-off `grep -rl "old-id" libs/wx-engine/src/commentary/` + sed update). The validator does not auto-rewrite -- authoring intent is preserved by an explicit fix-up.

The 21 weather knowledge nodes the rule set draws from (current as of 2026-05-10):

- `wx-airmasses-and-fronts`, `wx-wind-systems`, `wx-clouds-and-precipitation`, `wx-stability-and-instability`
- `wx-go-nogo-decision`, `wx-personal-minimums`, `wx-briefing-execution`
- `wx-icing-types-and-avoidance`, `wx-thunderstorm-hazards`, `wx-fog-and-visibility-obstructions`, `wx-turbulence-types`
- `wx-freezing-level`, `wx-density-altitude`
- `wx-product-airmets-sigmets`, `wx-product-pireps`, `wx-product-winds-aloft`, `wx-product-surface-analysis-and-cva`, `wx-product-gfa`, `wx-product-convective-outlook`
- `wx-reading-metars-tafs`
- `wx-data-sources`, `wx-equipment-and-data-limitations`, `wx-flight-deck-weather-displays`, `wx-chart-type-surface-analysis`

If the rule set wants to cite a node that doesn't yet exist, file a follow-on against `course/knowledge/weather/` rather than authoring placeholder ids. The check fails loud is the right behavior.

## Output discoverability

One scenario = one slug = one directory under `data/wx-scenarios/` = one TruthModel literal under `libs/wx-engine/src/truth/scenarios/`. Adding a new scenario:

1. Drop a `<slug>.ts` file under `truth/scenarios/`
2. Register the slug in `truth/scenarios/registry.ts`
3. Add the slug to `WX_SCENARIOS` in `libs/constants/src/wx-engine.ts`
4. Run `bun run wx-scenario build <slug>`
5. Commit the literal + the generated bundle + the chart spec mirrors

Removing a scenario: reverse the order. The validator catches dangling chart slugs / cache mirrors / commentary references during the next `bun run check`.

## Per-scenario chart count

For a 5-station scenario: ~17 chart artifacts.

| Chart               | Count |
| ------------------- | ----- |
| surface-analysis    | 1     |
| prog-chart          | 1     |
| advisory-overlay    | 1     |
| metar-plot-grid     | 1     |
| pirep-plot-grid     | 1     |
| winds-aloft-fb      | 1     |
| taf-timeline        | 5     |
| gfa                 | 1     |
| convective-outlook  | 1     |
| cva                 | 1     |
| freezing-level      | 1     |
| g-airmet-icing      | 1     |
| g-airmet-turbulence | 1     |
| **Total**           | 17    |

Across six scenarios: ~100 chart-spec mirrors under `data/charts/wx/wx-scenario-*`. Each renders to a single SVG via `bun run charts build`. The wx-charts library's idempotency contract (re-run with unchanged spec produces zero writes) means the chart-build pass for the engine output is a no-op once the SVGs are up-to-date.

## What the production lib does NOT do (in scope)

For completeness; cross-reference with [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for the full deferral list:

- Does not call `bun run charts build` itself. The engine produces specs; the wx-charts CLI renders. Two separate commands; two separate idempotency contracts.
- Does not maintain the `course/knowledge/weather/` corpus. The engine cites it; authoring lives elsewhere.
- Does not author `:::scenario` directive resolver code -- that's the course-reader-and-editor consumer's responsibility. This WP defines the data contract (CONSUMER-CONTRACT.md in Phase F.3).
- Does not implement any UI. Hangar UI for scenario authoring is a separate WP (see OUT-OF-SCOPE.md). Authoring is direct TS literal editing for v1.
- Does not synthesize NEXRAD radar PNG. The radar-mosaic chart family is deferred until either (a) a polygon-radar chart variant is added to wx-charts, or (b) a synthetic-radar generator is added to the engine. See OUT-OF-SCOPE.md "Radar-mosaic chart derivation".
- Does not synthesize satellite imagery. Satellite chart family (IR / VIS / WV) is deferred -- the geostationary projection + brightness-temp-to-color palette synthesis is non-trivial and not load-bearing for v1 pedagogy. See OUT-OF-SCOPE.md "Satellite chart derivations".

## Open design questions resolved during the spike

The DESIGN.md "Open questions for the production WP" section lists three; this WP resolves them:

1. **Where does the truth-state evolution clock live?** Resolved: `advanceTruth(truth, hours)` is the only sanctioned way to move time forward. `TruthModel` is a snapshot; the projected snapshot for a future time is `advanceTruth(truth, +N)`. Production keeps the spike's design.
2. **How does authoring specify a narrative?** Resolved: TS literal seed files in `libs/wx-engine/src/truth/scenarios/<slug>.ts` for v1. Hangar UI authoring is a follow-on WP gated on documented YAML-authoring friction (see OUT-OF-SCOPE.md).
3. **Round-trip parsing as a `bun run check` step?** Resolved: yes. Phase F wires `bun run wx-scenario check-round-trip --all` into `bun run check` so the engine cannot ship a product the wx-charts library cannot parse.

No new open design questions surface from the production-WP framing. The spike's recommendations are absorbed into the phased plan.
