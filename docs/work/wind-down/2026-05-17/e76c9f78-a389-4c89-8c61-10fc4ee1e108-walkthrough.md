---
session: e76c9f78-a389-4c89-8c61-10fc4ee1e108
date: 2026-05-17
branch: main
type: walkthrough
---

# Walkthrough -- weather encoded-text + content census

This session shipped two bodies of work: the weather encoded-text learning
surface (catalog, drill, practice, mastery, authoring sandbox, temporal
scenario engine) and the hangar content-census dashboard. All routes below
are verified to exist on `main`.

## Encoded-text catalog examples page

**URL**: `http://localhost:5173/reference/wx/products/metar/examples`
(also `taf`, `pirep`, `fb`, `airmet-sigmet`)

**How to test manually**:

1. Sign in to the study app.
2. Navigate to the URL above.
3. Verify a browsable list of >=10 METAR example cards renders.
4. Click a token-family filter chip (e.g. `wind-gust`) -- the list narrows;
   every visible card carries that family.
5. Click an example to expand -- token-by-token decode annotations render.
6. Use the search box -- filtering by `TSRA` narrows to thunderstorm examples.

**What to look for**: the filter chips AND-combine; expand-to-decode shows
per-token annotations from `@ab/wx-explain`.

**Known caveats**: AIRMET/SIGMET expand shows a "parser not yet shipped" note
-- those are structured advisories, not single-line text.

## Practice -- token-walk drill

**URL**: `http://localhost:5173/practice/wx/drill`

**How to test manually**:

1. On the setup screen pick product(s), a tier (1-10), item count.
2. Start the drill -- it walks one question per token of each product.
3. Answer each; rationale shows after each answer.
4. Finish -- the summary shows per-token-family right/wrong.

**What to look for**: passive (mastered) token families are shown but not
quizzed; the end summary reflects per-family mastery.

## Practice -- mastery dashboard

**URL**: `http://localhost:5173/practice/wx/mastery`

**How to test manually**:

1. Navigate to the URL (after running at least one drill).
2. Verify the per-token-family grid + heatmap render.
3. Filter by product and by state (active/passive/demoted/never-seen).
4. Click "Drill my weak families" -- it opens the drill pre-seeded.

## Practice -- scenario replay

**URL**: `http://localhost:5173/practice/wx/replay?scenario=frontal-pressure-march`

**How to test manually**:

1. Pick a temporal scenario; step through it hour by hour.
2. At each hour the METAR/TAF/chart updates; make a go/no-go call.
3. Finish -- a decision summary shows.

**Known caveats**: requires the timeline bundle built --
`bun run wx-scenario build frontal-pressure-march --timeline`.

## Authoring sandbox (admin only)

**URL**: `http://localhost:5173/practice/wx/test-page`

**How to test manually**:

1. Sign in as an admin (the page is `requireRole(ADMIN)`-gated).
2. Drag the truth-model sliders; the derived METAR/TAF + chart update live.
3. "Save as catalog example" writes a candidate sidecar for review.

## Hangar content census

**URL**: `http://localhost:5183/content` (hangar app)
**Drill-down**: `http://localhost:5183/content/wx-catalog`,
`http://localhost:5183/content/knowledge-nodes`

**How to test manually**:

1. Sign in to the hangar app.
2. `/content` -- verify 14 corpus rows, each with a count + explained health.
3. `/content/wx-catalog` -- the reference drill-down: inventory, gap view,
   next-list. Every metric explains what it measures, why it matters, what
   to do.
4. `/content/knowledge-nodes` -- the Phase-3 drill-down: skeleton/cardless/
   draft/dangling-link gaps with the same explanatory triad.
5. Other corpora render a real Layer-1 census (inventory + metrics); their
   gap/intent views show an honest "Phase 3 pending" placeholder.

**What to look for**: no bare numbers -- every metric carries the
what/why/do explanation. Stub-free: a corpus with no Phase-3 work shows a
labelled placeholder, never fabricated data.

## CLI

- `bun run wx-scenario drill --count 20 --products metar,taf --output drill`
  -- generates a drill pack (JSON + MD).
- `bun run wx-scenario build <slug> --timeline` -- builds a temporal bundle.
- `bun run wx-scenario coverage` -- reports catalog<->scenario coverage
  (now 20/155 examples, 43 token families, 6 of 7 scenarios contributing).
- `bun run wx-scenario check-catalog` -- round-trip validates the catalog.
