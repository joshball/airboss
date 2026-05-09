---
id: wx-chart-symbology-library
title: 'Out of Scope: Weather Chart Symbology Library'
product: cross-product
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-09
owner: agent
depends_on:
  - course-reader-and-editor
unblocks: []
tags:
  - weather
  - charts
  - library
  - out-of-scope
legacy_fields:
  feature: wx-chart-symbology-library
  type: out-of-scope
---

# Out of Scope: Weather Chart Symbology Library

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope. The deeper rationale lives in the three spike notes ([01-surface-analysis](../../../spikes/wx-charts/01-surface-analysis/spike-notes.md), [02-radar-mosaic](../../../spikes/wx-charts/02-radar-mosaic/spike-notes.md), [03-metar-plot-grid](../../../spikes/wx-charts/03-metar-plot-grid/spike-notes.md)) and in [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md).

## Summary

| Item                                              | Status       | Trigger to revisit                                                              |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Real-time chart updates (live data fetch on read) | Deferred     | When a course needs charts that update inside a learner session                 |
| Satellite charts                                  | Deferred     | When a course needs satellite imagery (different rendering paradigm)            |
| IFR enroute charts                                | Deferred     | When a course covers enroute IFR navigation visually                            |
| Terminal area charts (TAC / sectional terminals)  | Deferred     | When a course covers terminal-area airspace visually                            |
| Animation / time-scrubber UI                      | Deferred     | When a course needs to show wx evolution within a single chart                  |
| Hangar editor for chart specs                     | Follow-on WP | When YAML authoring friction is documented as blocking content velocity         |
| Per-chart pedagogical overlays                    | Follow-on WP | When a specific course step needs a substrate-supported overlay (per-overlay)   |
| Color palette variants (colorblind, print)        | Deferred     | When a learner files an accessibility request or the design system grows themes |
| Truth-aware wx engine                             | Follow-on WP | When wx scenario generation moves past the chart-rendering stage                |
| Scenario DSL + translator                         | Follow-on WP | After the truth-aware engine ships and an authoring DSL is needed               |
| Data tree consolidation (`ac/` -> `data/`, etc.)  | Follow-on WP | When the multi-root data layout creates a documented authoring friction         |

## Real-time chart updates (live data fetch on read)

Status: Deferred

What was deferred:
A "fetch latest chart" path inside the consumer at render time. The library is build-time only; the CLI captures source data manually into the dev cache, builds a deterministic SVG, and commits it. There is no live IEM / NCEI / NOAA fetch at chart-build time, and no on-page live update inside `<CourseStepChart slug="..." />`.

Why:
Per [spec.md](./spec.md) Scope -> Out and the three spikes' "manual capture" pattern: determinism is load-bearing for the pedagogical model. A learner reading a course step about a 2024-12-23 surface analysis needs to see the same chart their instructor saw, not a chart that mutates with current weather. Deterministic chart-build also lets `meta.json.content_hash` sit at the center of the idempotency contract -- adding live fetch would make every build non-deterministic and break the "git diff is empty if nothing changed" guarantee.

Trigger to revisit:
When a specific course needs a chart that updates inside a learner session (e.g., a "current conditions" feature for in-flight pre-flight prep). The trigger has two parts: (1) a course-content use case that's poorly served by static charts, AND (2) a clear product decision that the determinism we'd give up is worth the trade.

Implementation pattern when triggered:
Add a separate "live chart" surface peer to `<CourseStepChart slug="..." />`, e.g., `<LiveWxChart kind="metar-plot-grid" extent="conus" />`, that calls a server endpoint at render time. The endpoint fetches from the appropriate live data source, runs the same library renderers (the renderers are pure functions; the endpoint is just an I/O layer), and returns SVG bytes. The static-chart path stays unchanged. Cache the live fetch with a short TTL to avoid hammering external APIs.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) "Behavior" -> "Chart authoring flow" (manual capture)
- All three spike notes' "Why static charts" sections

## Satellite charts (visible / IR / water vapor)

Status: Deferred

What was deferred:
Satellite chart renderers (visible-light, IR, water vapor). The v1 chart inventory has ten charts; satellite is not among them.

Why:
Per [spec.md](./spec.md) Scope -> Out: satellite charts use a different rendering paradigm (raster-only, no vector overlay other than chrome + state borders) that the v1 substrate technically supports but did not need to ship. The PPL ACS Task C K2 cluster does not require satellite reading at the leaf-knowledge level (it surfaces in flight planning context, not as a standalone reading skill).

Trigger to revisit:
When a course needs satellite imagery as a primary teaching surface (not just a reference). Likely scenarios: a "wx interpretation" advanced course, a "TAFS vs satellite" reasoning exercise, or a thunderstorm-evolution module.

Implementation pattern when triggered:
Add `satellite-visible`, `satellite-ir`, `satellite-water-vapor` to `CHART_TYPES`. Each is a raster-overlay chart (re-uses Phase B's `raster/warp.ts` + `sharp-bridge.ts`) with palette functions for the IR and water-vapor color tables. Substrate stack: basemap-fill + raster-overlay + basemap-re-stroke + chrome. Mirror Phase B's radar-mosaic shape -- this is a one-PR add per chart type.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) "Chart inventory" (the v1 ten)

## IFR enroute charts

Status: Deferred

What was deferred:
IFR low / high enroute chart renderers. Different chart family (FAA pubs vs NWS / WPC / SPC products); different cartographic conventions; different symbology library (airways, fixes, MEAs, MOCAs, MAAs, COPs, holds).

Why:
Per [spec.md](./spec.md) Scope -> Out: IFR enroute charts are a fundamentally different visual product -- not weather, but navigation. The wx-charts library's substrate (CONUS Lambert + state borders + weather symbology) is wrong scaffolding for IFR enroute. Forcing them in would expand the substrate's surface area for one chart family that doesn't share inputs with the rest.

Trigger to revisit:
When the IR / Instrument Procedures product (per [docs/platform/PRODUCT_BRAINSTORM.md](../../platform/PRODUCT_BRAINSTORM.md) IFR cluster) needs visual chart support. Even then, it likely launches as a separate library `libs/ifr-charts/` rather than an extension here.

Implementation pattern when triggered:
A new library, not an extension. Mirror the layout of `libs/wx-charts/` (substrate + per-chart renderers + CLI dispatcher at `scripts/ifr-charts.ts` + outputs at `data/charts/ifr/<slug>/`). Both libraries can share the projection + sharp-bridge primitives via a third lib (`libs/chart-substrate/`) if the duplication justifies it; cross-lib extraction is a follow-on after both libraries are stable.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/platform/PRODUCT_BRAINSTORM.md](../../platform/PRODUCT_BRAINSTORM.md) IFR product cluster

## Terminal area charts (TAC / sectional terminal-area insets)

Status: Deferred

What was deferred:
Terminal Area Chart (TAC) renderers and sectional-chart terminal-area insets. Same family-mismatch reasoning as IFR enroute -- these are FAA cartographic products, not weather.

Why:
Per [spec.md](./spec.md) Scope -> Out: TAC and sectional terminal areas are airspace / ground-feature charts. Inputs are airport diagrams, airspace shapefiles, terrain data, obstruction databases -- nothing the wx-charts substrate handles or should handle.

Trigger to revisit:
When the airspace / chart-reading product (per [docs/platform/PRODUCT_BRAINSTORM.md](../../platform/PRODUCT_BRAINSTORM.md) "spatial" surface cluster) earns its own library. This is more likely to live in a future `apps/spatial/` peer rather than as a chart library at all (interactive map vs static chart trade-off is unresolved).

Implementation pattern when triggered:
A separate effort, not an extension here. The "spatial" surface in [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) is the right home; whether it ships static SVG charts (this lib's pattern) or interactive maps (a different pattern entirely) is a per-product decision.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) spatial surface

## Animation / time-scrubber UI (single time slice per chart in v1)

Status: Deferred

What was deferred:
Multi-frame chart authoring (e.g., a 6-hour radar loop) and a learner-side time-scrubber UI in the consumer. Each v1 chart is exactly one time slice; the slug encodes the time stamp.

Why:
Per [spec.md](./spec.md) Scope -> Out and design.md "Output discoverability": one chart = one slug = one directory = one SVG. Adding a frame dimension to `data/charts/wx/<slug>/` (`frame-0001.svg`, `frame-0002.svg`, ...) plus a multi-frame mounting component in the consumer doubles the output surface and changes the consumer contract. Better to keep v1 simple and add animation as a deliberate follow-on once a learner-facing use case justifies it.

Trigger to revisit:
When a course needs to show wx evolution over time as a primary teaching mechanic (not just "show me the 12Z chart, then the 18Z chart, side by side" -- the side-by-side case is already handled by referencing two slugs in the same step).

Implementation pattern when triggered:
Extend the slug convention with a frame suffix (`wx-radar-mosaic-2024-05-21-22z-frame-0001`) OR add a `frames` array to the spec.yaml that produces a sibling `frames/` directory. Update `<CourseStepChart slug="..." />` to detect a multi-frame slug and mount a scrubber UI. The library itself stays one-frame-per-renderer; the multi-frame layer sits at the spec / output / consumer layer, not in the renderer.

References:

- [spec.md](./spec.md) Scope -> Out
- [design.md](./design.md) "Output discoverability"

## Hangar editor for chart specs

Status: Follow-on WP

What was postponed:
A hangar-app authoring surface for chart specs (`apps/hangar/src/routes/(app)/charts/...`). Today, chart spec authoring is YAML-by-hand under `data/charts/wx/<slug>/spec.yaml`; the hangar app does not surface a chart editor.

Why:
Per [spec.md](./spec.md) Scope -> Out: chart specs are deliberate artifacts authored by someone who already knows the chart they want. A hangar UI would help, but there is no shape to design against until enough charts are authored to surface the friction. The authoring discipline is small enough today (one YAML file per chart) that YAML-direct is acceptable.

Trigger that fires the follow-on:
When the user (Joshua, or a future co-author) documents that YAML authoring is the bottleneck for chart velocity. Concretely: more than 5 charts authored AND the author asks for a UI affordance to (a) reduce typos, (b) preview the rendered chart inline, or (c) pick from the cache directory rather than typing `cache://` paths.

Implementation pattern when triggered:
Mirror the course-reader-and-editor hangar pattern: a `/charts` index, a `/charts/[slug]` editor with form-action save -> calls the existing CLI's build path. Re-use the `course-yaml-emit.ts` shape from course-reader-and-editor for canonical YAML emit. The form fields derive from the per-chart Zod schema in the registry.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/work-packages/course-reader-and-editor/spec.md](../course-reader-and-editor/spec.md) (template for the hangar editor pattern)

## Per-chart pedagogical overlays

Status: Follow-on WP

What was postponed:
Pedagogical overlays bundled with each chart -- e.g., flight-category rings on a METAR plot, frontal interpretation cues on a surface analysis, hail-core annotations on a radar mosaic, TAF / METAR delta panels for a "what changed?" reading exercise. The substrate supports overlays as first-class layer-band consumers; this WP does not ship per-chart overlays.

Why:
Per [spec.md](./spec.md) "Why this WP exists" and Scope -> Out: overlays are course-content-driven. The substrate must be ready to host them (it is -- the layer-band contract has open vector-symbology and point-symbology bands), but each overlay belongs in the course-content WP that needs it. Bundling overlays with the library would couple infrastructure to content and force every consumer to opt out of overlays they don't want.

Trigger that fires the follow-on:
Every time a course step needs a substrate-supported overlay that doesn't yet exist. Each is its own micro-WP -- small enough that the WP threshold (per CLAUDE.md "When to use a work package") is borderline. If the overlay is reusable across multiple courses, it earns a WP; if it's one-off for one step, it lands as part of that step's authoring.

Implementation pattern when triggered:
A new `libs/wx-charts/src/overlays/<overlay-slug>.ts` file exporting a function that takes a parsed chart input + overlay options and emits an SVG fragment in the appropriate layer-band. The chart spec.yaml declares overlays via an `overlays:` array; the renderer composes the base chart bands + the overlay bands via `composeChart`. No new layer bands are introduced (the existing nine cover overlays).

References:

- [spec.md](./spec.md) "Why this WP exists" (overlays as the pedagogical opportunity)
- [spec.md](./spec.md) "Layer band contract" (the substrate is overlay-ready)

## Color palette variants (colorblind-friendly, high-contrast print, etc.)

Status: Deferred

What was deferred:
Multiple palette variants per chart type. Today each chart ships exactly one palette per source quantity (NWS reflectivity for radar, FAA flight-category for METAR / CVA, advisory-type colors for AIRMET / SIGMET, etc.). No alternate palette swap is exposed in the spec.yaml or the renderer.

Why:
Per [spec.md](./spec.md) Scope -> Out: alternate palettes (colorblind-friendly Viridis-style ramps, high-contrast print versions, dark-mode variants) are real concerns but speculative without a documented user need. The single canonical palette per quantity matches the FAA / NWS reference exactly, which is the right default for an aviation training product.

Trigger to revisit:
When a learner files a colorblind accessibility request, OR when the design system grows print / dark-mode theme variants and charts are asked to participate, OR when a course is targeted at a specific accessibility need (e.g., a CFI training a colorblind student).

Implementation pattern when triggered:
Add a `palette: <variant>` field to each chart's spec.yaml options (default: `faa-canonical`). Each palette function in `libs/wx-charts/src/raster/palettes.ts` and `libs/wx-charts/src/symbology/*.ts` accepts the variant key and returns the right color table. Add a `bun run charts build --all --palette <variant>` flag that regenerates every chart with the alternate palette into a sibling output directory (`data/charts/wx/<slug>/chart.<variant>.svg`). The consumer picks a palette via a learner setting.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/platform/DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md) (accessibility commitments)

## Truth-aware wx engine

Status: Follow-on WP

What was postponed:
A synthetic weather engine that authors commentary from known-truth state -- the "truth-aware generators" pattern in MEMORY.md (`project_truth_aware_generators.md`). Generates synthetic METAR / TAF / radar / advisory bundles plus parallel commentary explaining what the chart shows and why.

Why:
Per [spec.md](./spec.md) Scope -> Out: the chart library renders given inputs; it does not generate the inputs. The truth-aware engine is a separate downstream concern that consumes this library's renderers (it generates spec.yaml + source bytes; the renderers turn them into charts).

Trigger that fires the follow-on:
When the wx pedagogy moves past "show me a real archived chart" into "let me read a synthetic-but-faithful chart with ground-truth commentary." This is the killer pedagogy mode per [project_truth_aware_generators.md](memory:project_truth_aware_generators.md) and is the natural follow-on once chart rendering is solved.

Implementation pattern when triggered:
A separate library `libs/wx-engine/` that generates the inputs this library accepts. The engine's outputs feed into the chart-build pipeline as if they were captured real-world bytes. The chart library does not change; the engine is its own WP. Spec the engine per the 4-layer x 3-anchoring-stage framework in MEMORY.

References:

- [spec.md](./spec.md) Scope -> Out
- MEMORY entry: project_truth_aware_generators.md

## Scenario DSL + translator

Status: Follow-on WP

What was postponed:
A high-level scenario DSL (e.g., `"morning fog burns off by 14Z, IFR -> VFR transition along the I-5 corridor"`) that translates to truth-aware engine inputs.

Why:
Per [spec.md](./spec.md) Scope -> Out: the DSL is downstream of the truth-aware engine, which is itself downstream of this WP. Even spec'ing the DSL today is premature -- the input shape depends on the engine's input shape, which depends on what authoring patterns surface during real wx-engine use.

Trigger that fires the follow-on:
After the truth-aware engine ships AND course authors document that the engine's input shape is too low-level for course-author productivity AND a higher-level DSL would let CFIs author scenarios without touching engine internals.

Implementation pattern when triggered:
A separate library `libs/wx-scenario-dsl/` that consumes the DSL and emits truth-aware engine inputs. The DSL grammar is its own design surface; mirror the existing scenario authoring patterns from `airboss-firc` (scenario library, scoring tags) where applicable. Spec the DSL per the project's WP discipline.

References:

- [spec.md](./spec.md) Scope -> Out
- MEMORY entry: project_truth_aware_generators.md

## Data tree consolidation (`ac/`, `acs/`, etc. -> `data/`)

Status: Follow-on WP

What was postponed:
Consolidating the multiple top-level data directories (`ac/`, `acs/`, `course/`, `data/`, `handbooks/`, `regulations/`) into a single `data/` tree with sub-directories. The wx chart library lands its outputs at `data/charts/wx/<slug>/` per spec, which adds one more cell to the existing patchwork rather than fixing it.

Why:
Per [spec.md](./spec.md) Scope -> Out: data tree consolidation is real cleanup work, scoped large enough to deserve its own WP. Forcing it into this library's WP would expand the diff surface and risk colliding with other agents working in those trees. The chart library's `data/charts/wx/` location is a deliberate co-location with future non-WX chart families and does not require the broader tree to be fixed first.

Trigger that fires the follow-on:
When the multi-root data layout creates a documented authoring friction -- e.g., a content author asks "where do I put X?" with no clear answer, OR a script needs to walk all data and the multi-root layout makes that fragile, OR a fresh-eyes review surfaces the layout as a navigability barrier.

Implementation pattern when triggered:
A consolidation WP that proposes a target layout (e.g., everything under `data/{references,charts,sources,...}/`), maps every existing top-level directory to a target location, runs `git mv` in one commit, updates every reference (`grep -rE "^(ac|acs|course|handbooks|regulations)/"`), and ships. This is mechanical work but high-touch -- requires coordination across in-flight agents to avoid merge conflicts.

References:

- [spec.md](./spec.md) Scope -> Out
- [CLAUDE.md](../../../CLAUDE.md) "Doc Structure" (the current multi-root reality)
