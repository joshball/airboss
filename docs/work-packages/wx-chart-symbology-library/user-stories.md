---
id: wx-chart-symbology-library
title: 'User Stories: Weather Chart Symbology Library'
product: platform
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
  - user-stories
legacy_fields:
  feature: wx-chart-symbology-library
  type: user-stories
---

# User Stories: Weather Chart Symbology Library

User-perspective narratives covering the three roles this library serves: chart authors (writing spec.yaml + capturing data), course authors (referencing chart slugs from course steps), and learners (seeing the rendered chart in the consumer surface). The library does not ship a UI; learner stories are about the chart's pedagogical effect, not about clicking around the library itself.

## Authoring a chart (chart author = the person capturing weather data and writing spec.yaml)

- As a chart author, I want one canonical place per chart (`data/charts/wx/<slug>/`) holding the spec, the rendered output, and the build provenance, so I never have to hunt across directories to understand what produced a chart.
- As a chart author, I want the source weather bytes to live in my dev cache (not the repo) so my git diffs stay small and the repo stays portable across machines.
- As a chart author, I want `bun run charts build <slug>` to be deterministic so I can trust that re-running on unchanged inputs produces zero writes.
- As a chart author, I want the validator to reject a malformed spec with a clear, line-actionable message so I can fix typos without reading source code.
- As a chart author, I want the validator to reject a missing source file by name so I know exactly which capture I forgot to do.
- As a chart author, I want one CLI dispatcher (`bun run charts ...`) covering build / validate / list so I have a single noun to remember.
- As a chart author, I want `bun run charts build --all` to walk every spec and rebuild only the dirty ones so I can refresh the whole catalog after a substrate change without thinking about it.
- As a chart author, I want `bun run charts list` to enumerate every existing slug so I can avoid slug collisions when authoring a new chart.
- As a chart author, I want spec.yaml to be human-friendly (YAML, not JSON / TOML) so I can write multi-line subtitles and notes without escaping.
- As a chart author capturing radar data, I want the worldfile parser to give me a clear error if the file is malformed so I can re-capture rather than chase a silent rendering bug.
- As a chart author who edited a chart's spec.yaml, I want the next build to detect the change via content_hash and only rewrite the affected files so my git diff shows exactly what changed.
- As a chart author who realized I authored two charts referencing the same source data, I want both charts to coexist and rebuild together when the source changes, so I don't have to manually orchestrate them.

## Authoring failures (chart author -- error paths)

- As a chart author who fat-fingered the slug to not match the directory name, I want the validator to surface that mismatch with a specific message rather than producing a chart at the wrong path.
- As a chart author who wrote `type: surface-analysiss` (typo), I want the validator to suggest the right value from `CHART_TYPE_VALUES` so I don't have to grep for the constants file.
- As a chart author whose source data is out-of-cache, I want the build to abort with the resolved path it tried so I can fix the cache or fix the spec without guessing.
- As a chart author whose chart output exceeded 500 KB, I want a warning that suggests raster re-compression so the output stays performant for the consumer.
- As a chart author whose chart output exceeded 5 MB, I want a hard error rather than committing a multi-megabyte SVG to the repo.
- As a chart author whose METAR contained an unparseable wind token, I want the parser to render the station with a "no shaft" glyph and surface the unparseable string in `meta.json.parser_warnings` so I can review whether to re-capture or accept the partial render.

## Pedagogical authoring (chart author -- "I want this chart to teach")

- As a chart author thinking about teaching, I want the substrate to expose a layer-band contract so I can mount a future overlay (frontal interpretation cues, hail-core annotations, flight-category rings) on top of the base chart without re-deriving the whole render.
- As a chart author capturing a thunderstorm-day surface analysis, I want the chart's chrome to carry the issuing time and source attribution so a learner reading the chart understands what they're looking at without a separate caption.
- As a chart author building a "what changed" exercise (12Z chart vs 18Z chart side by side), I want each chart at its own slug so I can reference them independently from a course step rather than conflating them into one render.

## Referencing a chart from a course step (course author)

- As a course author writing a weather step, I want to embed a chart by slug (`<CourseStepChart slug="wx-surface-analysis-2024-12-23-12z" />`) so the embedding contract is decoupled from the chart's rendering details.
- As a course author, I want chart slugs to read like content (`wx-surface-analysis-2024-12-23-12z`) rather than opaque ids so I can read a step's markdown and know which chart it points at.
- As a course author who picked a slug that doesn't exist, I want the consumer to render a clear "chart not found: <slug>" placeholder rather than silently rendering nothing or breaking the page.
- As a course author teaching METAR reading, I want to reference the same METAR plot grid chart from multiple steps without authoring duplicate charts.
- As a course author iterating on a step, I want the chart to render the same way every time I navigate to the step (no cache invalidation surprises) so I can focus on the prose, not the chart.

## Browsing rendered charts (learner)

- As a learner reading a course step on weather, I want the chart to load fast so the lesson flow doesn't break.
- As a learner reading a surface analysis chart, I want the front pip shapes (cold = triangles, warm = semicircles, occluded = alternating, stationary = mixed) to match what the FAA / NWS publishes so I'm learning the production symbology, not a stylized variant.
- As a learner reading a radar mosaic chart, I want the reflectivity colors to match the NWS ramp so I can read radar in the same color language as every operational source.
- As a learner reading a METAR plot grid chart, I want each station's flight-category color to match the FAA palette (VFR green, MVFR blue, IFR red, LIFR magenta) so the visual language transfers directly to flight planning.
- As a learner reading a dense METAR plot grid, I want stations that were displaced by collision avoidance to have a leader line back to their true location so I can correlate the symbology to the right airport.
- As a learner reading an AIRMET / SIGMET overlay chart, I want each advisory type to be visually distinct (Sierra yellow, Tango orange dashed, Zulu blue dashed, SIGMET red, Convective SIGMET red with thunderstorm glyph) so I can decode at a glance which kind of advisory is in effect.
- As a learner reading a chart, I want the chart's title and subtitle to tell me what it is and when it's from so I have context without leaving the page.

## Cross-cutting: integrity and trust

- As a chart author, I want every chart to embed `library_version` and `content_hash` in `meta.json` so I can trace any rendered chart back to the exact code + data that produced it.
- As a chart author, I want bumping the library version to invalidate every chart's content_hash so substrate improvements propagate to every chart on the next `--all` rebuild without manual intervention.
- As a chart author, I want the renderer to be a pure function (bytes in, strings out) so I can unit-test charts deterministically with synthetic inputs.
- As a course author or learner, I want the chart to be a static SVG asset (not a server-render-on-demand) so the page loads with no network round trip beyond the asset fetch.

## Cross-cutting: discipline

- As any agent on this project, I want server-only code (sharp warp, fs reads) to live in the `/server` barrel and never leak to the runtime barrel, so I cannot accidentally ship sharp into the browser bundle.
- As any agent on this project, I want the layer-band enum closed at nine values so substrate changes go through one PR (bump version, regenerate every chart) rather than accumulating one-off bands per chart.
- As any agent on this project, I want chart specs to be Zod-validated at build time so a malformed spec fails loud at authoring time, not silently at consumer-render time.

## Negative stories (out of scope, captured for reference)

These belong in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), included here so the reader can see the full shape:

- As a chart author, I want the CLI to fetch live IEM / NCEI / NOAA data at build time -- deferred per OUT-OF-SCOPE (real-time chart updates).
- As a chart author, I want satellite (visible / IR / water vapor) chart renderers -- deferred per OUT-OF-SCOPE (different rendering paradigm; not in v1 inventory).
- As a chart author, I want IFR enroute or sectional terminal-area chart support -- deferred per OUT-OF-SCOPE (different chart family).
- As a learner, I want a time-scrubber UI so I can step through a 6-hour radar loop -- deferred per OUT-OF-SCOPE (single time slice per chart in v1).
- As a chart author, I want a hangar-app UI to author chart specs without writing YAML by hand -- deferred per OUT-OF-SCOPE (follow-on WP).
- As a colorblind learner, I want an alternate palette variant for reflectivity / flight-category charts -- deferred per OUT-OF-SCOPE (palette variants).
- As a course author, I want overlays bundled with each chart (flight-category rings, frontal interpretation cues) -- deferred per OUT-OF-SCOPE (per-overlay micro-WPs).
- As a chart author, I want a synthetic wx engine that generates realistic chart inputs from a high-level scenario DSL -- deferred per OUT-OF-SCOPE (truth-aware engine + DSL).
