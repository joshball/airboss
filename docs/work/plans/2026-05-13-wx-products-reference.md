---
title: 'Plan: aviation weather products reference'
type: plan
status: in-progress
created: 2026-05-13
---

## Why

The `weather-comprehensive` course assumes vocabulary it never teaches. Section s1 name-drops METAR, frontal passage, and "broken" ceilings as if the reader already owns them. The fix the user landed on:

- Every aviation weather product gets its own dedicated reference page: what it is, how to read it, annotated examples, common gotchas.
- The course scenarios link into the reference layer for every domain term.
- A framing note on s1 tells the reader "you may not know these terms yet -- we will teach you, every term links to a reference page."

Reference content is course-agnostic and reusable by future surfaces (sim, flightbag), so it lives in `course/weather/references/products/`, not inside the course.

## Scope rule

Every product in the catalog must exist as a page. Stubs are acceptable for the long tail in this pass; tier 1 (~10 products) gets full treatment. This work is not done until every product page exists.

## Where pages live

`course/weather/references/products/`

```text
products/
  README.md                 index + status table for every product
  _template.md              page skeleton (frontmatter + section structure)
  metar/                    each product is a directory
    page.md                 the reference page
    examples/               annotated example artifacts (raw text, decoded breakouts)
  taf/
  airmet/
  sigmet/
  ...
```

A directory per product gives room for `examples/`, `images/`, and future deep-dive sub-pages (METAR especially needs multi-page treatment).

## Page structure (per _template.md)

Frontmatter:

```yaml
---
id: wx-ref-{slug}
title: {Product full name} ({short code})
short_code: {METAR/TAF/...}
category: surface-obs | terminal-forecast | area-product | hazard-advisory | winds-temps | pirep | chart | radar-sat | icing-turb | tfr-notam
tier: 1 | 2
status: stub | draft | done
authoritative_sources:
  - source: AC 00-45H
    section: ...
  - source: AIM
    section: ...
  - source: FAA-H-8083-28
    section: ...
related_knowledge_nodes:
  - wx-reading-metars-tafs
  - wx-go-nogo-decision
related_products:
  - taf
  - speci
---
```

Body sections (in order):

1. **What it is** -- one-paragraph plain-English description. What it answers, who issues it, how often.
2. **When you read it** -- preflight, en route, both. What decision it informs.
3. **How to read it** -- field-by-field decode. Use a table for fixed-format products.
4. **Annotated example(s)** -- raw product text, then decoded line by line.
5. **Common gotchas** -- the field that bites people, the unit trap, the time-zone trap.
6. **Triage** -- what to look for first. What changes the go/no-go.
7. **Related products** -- siblings in the same family, linked.
8. **Authoritative sources** -- AC / AIM / handbook section citations.

## Product catalog (tier 1 + tier 2)

### Tier 1 -- full treatment in this pass

| # | Slug                  | Short code   | Category           |
|---|-----------------------|--------------|--------------------|
| 1 | metar                 | METAR        | surface-obs        |
| 2 | taf                   | TAF          | terminal-forecast  |
| 3 | gfa                   | GFA          | area-product       |
| 4 | airmet                | AIRMET       | hazard-advisory    |
| 5 | sigmet                | SIGMET       | hazard-advisory    |
| 6 | convective-sigmet     | WST          | hazard-advisory    |
| 7 | pirep                 | UA / UUA     | pirep              |
| 8 | winds-temps-aloft     | FB           | winds-temps        |
| 9 | surface-analysis      | (chart)      | chart              |
| 10| prog-chart            | (chart)      | chart              |

### Tier 2 -- stub pages in this pass, full treatment later

| #  | Slug                       | Short code   | Category           |
|----|----------------------------|--------------|--------------------|
| 11 | speci                      | SPECI        | surface-obs        |
| 12 | cwa                        | CWA          | hazard-advisory    |
| 13 | g-airmet                   | G-AIRMET     | hazard-advisory    |
| 14 | radar-mosaic               | (chart)      | radar-sat          |
| 15 | satellite                  | (chart)      | radar-sat          |
| 16 | icing-fip-cip              | FIP / CIP    | icing-turb         |
| 17 | turbulence-gtg             | GTG          | icing-turb         |
| 18 | ceiling-visibility-analysis| CVA          | chart              |
| 19 | freezing-level             | FZLVL        | chart              |
| 20 | convective-outlook         | (SPC outlook)| chart              |
| 21 | sigwx-prog                 | (high alt)   | chart              |
| 22 | volcanic-ash-advisory      | VAA          | hazard-advisory    |
| 23 | tropical-cyclone-advisory  | TCA          | hazard-advisory    |
| 24 | weather-tfr                | TFR          | tfr-notam          |
| 25 | weather-notam              | NOTAM-D wx   | tfr-notam          |

## Execution

### Step 1 -- infrastructure (do first, single agent)

- Create `course/weather/references/products/README.md` (index + status table)
- Create `course/weather/references/products/_template.md` (page skeleton)
- Create stub `page.md` for every product (tier 1 + tier 2) -- frontmatter + one-line "What it is" + status: stub
- Update `course/weather/references/README.md` to point at the products index

### Step 2 -- detail tier 1 (10 parallel agents)

Each agent owns one product directory. No shared files outside its own directory. Brief:

- Read `_template.md` and the existing stub.
- Read the existing knowledge node for the product if one exists under `course/knowledge/weather/product-*/` -- the node is the pedagogical treatment; the reference page is the encyclopedic treatment. Do not duplicate the discovery walk; cite the node.
- Author the full page per the structure above.
- Provide at least 2 annotated examples for fixed-format products (METAR, TAF, PIREP, winds aloft). Charts get 1 annotated example with callouts described in prose (image generation is out of scope for this pass; the description anchors the future image).
- Cite AC 00-45H, AIM 7, and FAA-H-8083-28 specifically (section numbers, not "see AC 00-45").
- Update the page's frontmatter `status: draft` when done.

### Step 3 -- review

User reads the 10 pages. Then we pick up tier 2 details in subsequent passes.

### Step 4 (out of scope for this plan, captured for follow-up)

- Wire scenario prose -> reference pages with inline links across `weather-comprehensive` sections.
- Add "you may not know these terms yet" framing to s1.
- Build a course section that surfaces the reference index as a browsable encyclopedia.
- Long-term: migrate `course/weather/references/products/` into the `apps/flightbag/` reference reader when that ships.

## Anti-scope

- No new course sections in this plan.
- No scenario rewrites in this plan.
- No images / figure generation.
- No knowledge node edits.
- No app routing / page rendering work -- this is markdown content authoring.
