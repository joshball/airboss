# Wiki-links in course content

Course prose (anything authored as `body_md` in `course/courses/*/sections/*.yaml`) should make weather, regulatory, and aerodynamic terms traversable. A learner who reads "METAR / frontal passage / broken" without a path to where those terms are taught is reading dead ink.

This doc describes the convention.

## Two link surfaces, one syntax

Course markdown is parsed by `libs/help/src/markdown/` and rendered through `CourseStepMarkdown.svelte`. The parser supports two link forms:

| Form                        | Where it goes                                      | Use for                                                            |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `[display](/reference/...)` | Plain markdown link to a study-app reference route | The course-content convention (knowledge nodes + glossary entries) |
| `[[display::page-id]]`      | Help-page wiki-link (resolved by `@ab/help`)       | Help pages (`libs/help/src/pages/`) and `aviation-reference` ids   |

For course `body_md` we use the **plain markdown link form**. It's how the s2 surface-analysis introduction was authored in PR #811 and is the convention the rest of the weather course adopts.

## Canonical homes

A term's canonical home is the single page where the concept is taught. Two kinds:

### Knowledge nodes

Atomic teachable concepts (ADR-011). One node per concept. URL:

```text
/reference/knowledge/<node-id>
```

The node id is the `id:` frontmatter field in `course/knowledge/<domain>/<slug>/node.md` -- weather nodes are all prefixed `wx-` (for example `wx-airmasses-and-fronts`, `wx-reading-metars-tafs`).

### Glossary entries

Short-form lookups -- terminology definitions that don't need a full ADR-011 node body. Backed by `libs/help/src/glossary/entries.ts` + `libs/help/src/glossary/content/<key>.md`. URL:

```text
/reference/glossary/<key>
```

Today the weather-specific glossary has one entry (`surface-analysis-chart`). Add more entries here when a term shows up across multiple sections but doesn't warrant a full knowledge node (cloud-cover abbreviations, METAR codes, VFR/MVFR/IFR/LIFR tiers, and so on).

## Authoring rules

1. **Link the first occurrence of a term in each step's `body_md`.** Subsequent uses in the same step stay plain prose. Per-step, not per-section: each step is a discoverable unit (a learner may land directly on `s4.2`).
2. **Link the same term again in a different step.** Cross-step discoverability matters more than over-link avoidance; a learner reading `s4.2` does not see what you linked in `s2.1`.
3. **Never link a term inside the step that IS the term's canonical home.** If a step's `knowledge_node_id` is `wx-reading-metars-tafs`, don't wiki-link "METAR" inside that step's `body_md`. The step's authored framing already points at the node; linking inside its own prose creates a self-loop.
4. **Preserve prose verbatim except for the link wrapping.** No paraphrase, no reordering.
5. **Use the natural in-prose phrase as the display text.** Don't title-case mid-sentence to match a node title; link `[surface analysis chart](...)` (lower-case in context), not `[Surface Analysis Chart](...)`.
6. **Never replace an existing wiki-link.** Some sections already carry hand-authored links from earlier PRs (see s2.1).
7. **Never link a term that does not have a canonical home.** If the term should be teachable but has no node and no glossary entry, add it to the gap list at `docs/work/todos/<date>-wx-wikilink-gaps.md` for follow-up authoring -- do not invent a target.

## Weather term map

Use this as the lookup table while authoring. Each row is a single weather concept -> its canonical home id. The display text in prose is left to the author; the target id is fixed.

| Term family                         | Target                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| air mass, front, frontal passage    | `/reference/knowledge/wx-airmasses-and-fronts`             |
| cold front, warm front, occluded    | `/reference/knowledge/wx-airmasses-and-fronts`             |
| briefing, brief, weather brief      | `/reference/knowledge/wx-briefing-execution`               |
| surface analysis chart              | `/reference/glossary/surface-analysis-chart`               |
| reading the surface analysis        | `/reference/knowledge/wx-chart-type-surface-analysis`      |
| cloud types, cumulus, stratus       | `/reference/knowledge/wx-clouds-and-precipitation`         |
| precipitation, rain, snow           | `/reference/knowledge/wx-clouds-and-precipitation`         |
| ADS-B weather, FIS-B, XM weather    | `/reference/knowledge/wx-data-sources`                     |
| density altitude                    | `/reference/knowledge/wx-density-altitude`                 |
| weather data lag, NEXRAD age        | `/reference/knowledge/wx-equipment-and-data-limitations`   |
| flight deck weather display         | `/reference/knowledge/wx-flight-deck-weather-displays`     |
| fog, radiation fog, advection       | `/reference/knowledge/wx-fog-and-visibility-obstructions`  |
| visibility, obscuration             | `/reference/knowledge/wx-fog-and-visibility-obstructions`  |
| freezing level                      | `/reference/knowledge/wx-freezing-level`                   |
| go/no-go decision                   | `/reference/knowledge/wx-go-nogo-decision`                 |
| icing, rime, clear, SLD             | `/reference/knowledge/wx-icing-types-and-avoidance`        |
| personal minimums                   | `/reference/knowledge/wx-personal-minimums`                |
| AIRMET, SIGMET, Sierra, Tango, Zulu | `/reference/knowledge/wx-product-airmets-sigmets`          |
| convective outlook, SPC             | `/reference/knowledge/wx-product-convective-outlook`       |
| GFA, Graphical Forecast             | `/reference/knowledge/wx-product-gfa`                      |
| PIREP, UA, UUA                      | `/reference/knowledge/wx-product-pireps`                   |
| CVA, ceiling and visibility         | `/reference/knowledge/wx-product-surface-analysis-and-cva` |
| FB, winds aloft                     | `/reference/knowledge/wx-product-winds-aloft`              |
| METAR, TAF, SPECI                   | `/reference/knowledge/wx-reading-metars-tafs`              |
| stability, instability, CAPE        | `/reference/knowledge/wx-stability-and-instability`        |
| thunderstorm, microburst            | `/reference/knowledge/wx-thunderstorm-hazards`             |
| turbulence, CAT, mountain wave      | `/reference/knowledge/wx-turbulence-types`                 |
| wind, gust, shear                   | `/reference/knowledge/wx-wind-systems`                     |

## When a term has no canonical home

Some terms have no node and no glossary entry today. Examples:

- Cloud-cover codes: BKN / SCT / OVC / FEW (and the long forms broken / scattered / overcast / few).
- VFR / MVFR / IFR / LIFR flight-condition tiers.
- Ceiling, visibility (as standalone METAR fields).
- TSRA / FZRA / SHRA precipitation abbreviations.

Add the term to `docs/work/todos/<date>-wx-wikilink-gaps.md` with a one-line rationale ("authoring opportunity: glossary entry for METAR cloud-cover abbreviations") and leave the prose untouched until the canonical home exists. Never invent a target id and link to a 404 page.
