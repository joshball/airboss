---
title: weather-comprehensive course -- manual walkthrough (weather curriculum)
date: 2026-05-16
wp: none
status: ready-for-walk
machine: scaffold
branch: scaffold
prompt: scaffold the owed weather-comprehensive course manual-test walkthrough from course content + NOW.md
---

# weather-comprehensive course -- manual walkthrough

Walk this end-to-end to verify the weather course shipped complete. This is a scaffold.

There is **no work package directory** for this effort -- `docs/work-packages/` carries no `weather-comprehensive` folder. The course shipped as content PRs, not a WP. The steps below are drafted from the course content under `course/courses/weather-comprehensive/`, the weather knowledge nodes under `course/knowledge/weather/`, the wx product reference corpus under `course/weather/references/products/`, and the `weather-comprehensive` line in [NOW.md](../NOW.md). Joshua runs the test and signs off. Because there is no WP, sign-off here means "the course content is verified live" -- not a frontmatter flip.

After each step, check one box:

- [ ] **PASS** -- behaves as the expected-result column says
- [ ] **ISSUE** -- file via `bun run bug new <slug>` and report
- [ ] **REJECT** -- the content shape itself is wrong; re-discuss before sign-off

## What this verifies

The weather course is the working pilot's weather curriculum. Per [NOW.md](../NOW.md), three things shipped and owe this walkthrough:

1. **250 weather cards** live across the course tree.
2. The **weather products reference encyclopedia** at `/reference/wx/products` (PRs #956, #960, #964).
3. The **WX Scenarios course section** (s11) landed in the course (PR #948); citation migrate now pins AvWx (FAA-H-8083-28B) chapters (PRs #946, #955).

This walk confirms the eleven-section course renders end-to-end, the cards seed and surface in study, the product encyclopedia renders with examples, and the WX Scenarios section embeds the wx-engine scenarios.

The course is `course/courses/weather-comprehensive/` with eleven sections:

| Code | Title                                            |
| ---- | ------------------------------------------------ |
| s1   | Why weather matters                              |
| s2   | Air masses, fronts, and stability                |
| s3   | Clouds, precipitation, and visibility            |
| s4   | Wind, turbulence, and density                    |
| s5   | Convection and thunderstorms                     |
| s6   | Icing                                            |
| s7   | Reading weather products -- METARs, TAFs, PIREPs |
| s8   | Forecasting, planning, and products              |
| s9   | In-flight weather                                |
| s10  | Briefing and the integrated decision             |
| s11  | WX Scenarios                                     |

## Setup

Run from the **parent repo** (the worktree this walkthrough was authored in does not carry `.env`).

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main && git pull --ff-only origin main
bun install
bun run db reseed
bun scripts/dev.ts study
```

Wait for `Local: http://127.0.0.1:9600/`. Open the study app in a real browser, devtools open. Sign in as Abby (`abby@airboss.test`).

## Steps

### 1. Course landing renders all eleven sections

- **Route:** `/courses/weather-comprehensive`
- **Action:** view the course landing page
- **Expected:** the course "Weather, Comprehensive" renders with all eleven sections s1 through s11, titles matching the table above. Every section link resolves. Devtools console clean.
- [ ] PASS / ISSUE / REJECT

### 2. A physics section step renders the knowledge-node walk

- **Route:** `/courses/weather-comprehensive/s2` then a leaf step (e.g. a stability or air-mass step)
- **Action:** open the step
- **Expected:** the step prose frames the topic, then hands off to its knowledge node for the seven-phase discovery walk (per ADR 011). Embedded charts (`:::chart slug="..."`) render through wx-charts. Devtools console clean.
- [ ] PASS / ISSUE / REJECT

### 3. The products section (s7) walks METARs / TAFs / PIREPs

- **Route:** `/courses/weather-comprehensive/s7` -- "Reading weather products"
- **Action:** open the section, then the "Reading METARs", "Reading TAFs", and "PIREPs" steps
- **Expected:** each step renders, frames the product, and links to its knowledge node. Wiki-links and citations resolve (the citation migrate pins AvWx FAA-H-8083-28B chapters per PRs #946, #955).
- [ ] PASS / ISSUE / REJECT

### 4. 250 weather cards are seeded

- **Command:** `bun run db psql -c "SELECT count(*) FROM study.card WHERE domain = 'weather'"`
- **Expected:** roughly 250 weather cards. (NOW.md states 250 across the course tree; the exact figure may drift slightly with authoring -- confirm the count is in that neighbourhood and that no card count regressed to a much lower number.)
- [ ] PASS / ISSUE / REJECT

### 5. Weather cards surface in a study session

- **Route:** the study app session builder, building a session that draws on weather content for Abby
- **Action:** start a session and review a few cards
- **Expected:** weather cards appear, render front and back cleanly, and the spaced-repetition flow accepts grades without console errors.
- [ ] PASS / ISSUE / REJECT

### 6. The weather products encyclopedia index renders

- **Route:** `/reference/wx/products`
- **Action:** view the index
- **Expected:** the page renders product entries bucketed by category in this order: Surface observations, Terminal forecasts, Area products, Hazard advisories, PIREPs, Winds and temperatures, Icing and turbulence, Charts, Radar and satellite, TFRs and NOTAMs. Any category present in the corpus but missing from this order list falls into an "Other" bucket at the bottom. The corpus carries roughly 25 product pages.
- [ ] PASS / ISSUE / REJECT

### 7. A product reference page renders

- **Route:** `/reference/wx/products/surface-analysis` (and one more, e.g. `/reference/wx/products/airmet`)
- **Action:** open the product page
- **Expected:** the markdown body renders with its first-heading deduped; cross-references resolve. An unknown slug 404s.
- [ ] PASS / ISSUE / REJECT

### 8. The product examples page decodes a real product

- **Route:** `/reference/wx/products/surface-analysis/examples` (or a product with token examples, e.g. `/reference/wx/products/metar/examples` if present)
- **Action:** open the examples page; if a `?families=` filter is offered, apply one
- **Expected:** the page shows worked examples with per-token annotations (decoded via `@ab/wx-explain`). The `?families=` filter narrows the displayed token families. No console errors.
- [ ] PASS / ISSUE / REJECT

### 9. The WX Scenarios section (s11) renders

- **Route:** `/courses/weather-comprehensive/s11` -- "WX Scenarios"
- **Action:** view the section landing
- **Expected:** the section body explains the section assumes s1 through s10, then lists the scenario lessons. The body links into product knowledge nodes and `/reference/wx/products/<slug>` pages, all resolving.
- [ ] PASS / ISSUE / REJECT

### 10. A WX scenario embeds a wx-engine scenario panel

- **Route:** the `frontal-xc-march` scenario page inside s11 (the s11 section body embeds `:::scenario slug="frontal-xc-march"`)
- **Action:** open the scenario page in the reader
- **Expected:** a scenario panel renders -- the bundle streams from `/api/scenarios/frontal-xc-march/bundle.json` -- showing the scenario narrative, the METAR comparison grid, charts, and the Socratic commentary callouts. Repeat for one more scenario (e.g. `summer-thunderstorms-tx`). Devtools console clean.
- [ ] PASS / ISSUE / REJECT

### 11. The integrated-decision section (s10) ties the course together

- **Route:** `/courses/weather-comprehensive/s10` -- "Briefing and the integrated decision"
- **Action:** walk the go/no-go decision and personal-minimums steps
- **Expected:** the steps render, frame the briefing and go/no-go habit, and link to their knowledge nodes. This is the section the WX Scenarios reps assume the reader has worked.
- [ ] PASS / ISSUE / REJECT

### 12. Course validators are clean

- **Command:** `bun run check all`
- **Expected:** all steps green -- 0 errors, 0 warnings. The wiki-link validator, help-id validator, knowledge dry-run, and references validator all pass; no orphaned course-step or knowledge-node references.
- [ ] PASS / ISSUE / REJECT

## Sign-off

There is no WP frontmatter to flip. Sign-off here means: every step above is PASS, and the course content is confirmed live. If steps pass, note it in [NOW.md](../NOW.md) by removing "weather-comprehensive course" from "Walkthroughs owed". If any step is ISSUE or REJECT, file a bug and fix before considering the course done.

## Related

- Course content: `course/courses/weather-comprehensive/` (manifest plus eleven section YAML files)
- Weather knowledge nodes: `course/knowledge/weather/`
- Weather products reference corpus: `course/weather/references/products/`
- WX Scenarios section: `course/courses/weather-comprehensive/sections/s11-wx-scenarios.yaml`
- [wx-engine WP](../../work-packages/wx-engine/spec.md) -- the engine behind the `:::scenario` directive (see its own walkthrough)
- [NOW.md](../NOW.md) -- the "weather-comprehensive course" shipped line and the walkthroughs-owed list
