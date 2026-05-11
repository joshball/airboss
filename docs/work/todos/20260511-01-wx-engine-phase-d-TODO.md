# 2026-05-11 - wx-engine Phase D (Socratic commentary + knowledge-node binding)

Branch: `feat/wx-engine-phase-d`
PR title: `feat(wx-engine): Phase D -- Socratic commentary + knowledge-node binding`

## Goals

1. D.1 -- `commentary/types.ts` (CommentaryCallout) + `commentary/knowledge-link.ts` (resolver, validator)
2. D.2 -- `commentary/socratic.ts` rule set (10 categories, closed)
3. D.3 -- engine wires `deriveCommentary` after charts; writer emits `commentary.md` + `commentary.json`; validate knowledge-node ids on write
4. D.4 -- unit + integration tests + scenario regeneration

## Knowledge-node directory <-> id convention

Node id `wx-foo-bar` -> `course/knowledge/weather/foo-bar/`. The `wx-` prefix
is stripped to map to the directory.

## Available weather knowledge nodes (24)

airmasses-and-fronts, briefing-execution, chart-type-surface-analysis,
clouds-and-precipitation, data-sources, density-altitude,
equipment-and-data-limitations, flight-deck-weather-displays,
fog-and-visibility-obstructions, freezing-level, go-nogo-decision,
icing-types-and-avoidance, personal-minimums, product-airmets-sigmets,
product-convective-outlook, product-gfa, product-pireps,
product-surface-analysis-and-cva, product-winds-aloft, reading-metars-tafs,
stability-and-instability, thunderstorm-hazards, turbulence-types,
wind-systems.

## Rule set (10 closed categories)

1. front-crossing -- station compares pre/post air mass via fronts (one per station that crossed; in spike none has crossed mid-scenario explicitly, but the post-frontal stations crossed before validAt)
2. pre-frontal warm-sector -- southernmost warm-sector station
3. post-frontal gust -- deepest cold-sector station
4. TAF FM transition -- per arrival airport whose TAF contains an FM group
5. AIRMET callout (sierra/tango/zulu distinct)
6. surface-analysis isobar gradient
7. convective cell (per cell)
8. PIREP corroboration (PIREP -> matched AIRMET)
9. winds-aloft jet exit (jetMaxKt > 80)
10. diurnal nocturnal inversion (when nocturnalInversion === true)

## Final acceptance

- 8-15 callouts for frontal-xc-march
- Every knowledgeNodeId resolves to real directory
- Every target.chartSlug matches an entry in bundle.charts
- commentary.{md,json} regenerate cleanly
- `bun run check branch` 0/0
- PR opened
