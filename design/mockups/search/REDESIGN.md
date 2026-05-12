---
title: Command palette -- redesign after Phase 3 walk
date: 2026-05-12
parent: docs/work-packages/command-palette/
status: draft (capturing user feedback before Phase 4)
---

# Command palette redesign

After Joshua walked Phase 3 (PR #857 + #921 + #925), the visual model the design note assumed isn't right. This doc captures what's wrong, what to change, and the open questions to resolve before Phase 4.

## Symptoms from the walk

1. **Ranking is broken.** Typing `weather` returns `14 CFR 121.101`, `14 CFR 119`, `AFH 14.5 weather vaning`, `AFH 17.8 wx consideration`, an AC, two AIM, `AFH 0.6 intro` -- the **Aviation Weather Handbook** (the whole book named after the query) is not in the top hits, or isn't visible at all. Section-level body matches are outranking the canonical book.
2. **No result counts.** Columns don't show how many hits each holds.
3. **Section-level pollution.** Typing `FAA-H-8083-28` returns the book PLUS every chapter as separate rows in the FAA Resources column. A book-level hit should collapse to ONE row; chapters belong in the detail pane.
4. **Airboss Content gets buried.** When a query has many section hits, the user has to scroll far to find Airboss Content / Knowledge / Mine. Two-column-by-side-by-side doesn't help.
5. **Autocomplete and search results are mashed together.** Typing `FAA-H-808` should pop a doc-code dropdown below the input (`FAA-H-8083-28 -- Aviation Weather Handbook`), separately from the multi-column results. Currently both live in the same column display.
6. **"FAA Resources" is a misnomer.** Not everything in the bucket is FAA-authored (NTSB, sectionals, some industry refs).
7. **App Help shouldn't be in default view.** Only when filtered to it.

## New visual model

### Anatomy (sketch)

```text
+---------------------------------------------------------------------------+
| > FAA-H-808                                                          [x]  |  <- input
|   +-------------------------------------------------------------+         |
|   | FAA-H-8083-28  Aviation Weather Handbook                    |         |  <- autocomplete dropdown (below input, only when input matches a doc-code pattern OR a known title)
|   | FAA-H-8083-25  Pilot's Handbook (PHAK)                      |         |     tab/enter completes, esc dismisses
|   | FAA-H-8083-3   Airplane Flying Handbook (AFH)               |         |
|   +-------------------------------------------------------------+         |
+---------------------------------------------------------------------------+
|                                                                           |
| TOP HITS                                                                  |  <- 3-5 best-overall rows, ranker-decided, mixed types
|  FAA-H-8083-28  Aviation Weather Handbook                  [Handbook]    |
|  AC 00-6B       Aviation Weather (Advisory Circular)       [AC]           |
|  Weather (study course)                                    [Course]       |
|                                                                           |
+----+----------------------------------------------------+-----------------+
| Handbooks (7)    | === selected group's results ===     |  detail pane    |
| > CFRs (38)      |                                      |                 |
| AIM (4)          | One row per book/document            |  Title          |
| AC (3)           | (no section-level pollution)         |  Full citation  |
| Knowledge (15)   |                                      |  Snippet        |
| Mine (2)         | Selection bound to detail pane,      |  Actions        |
| Tools (2)        | which expands sub-results            |  - Open         |
| App Help (1)     | (chapters / sections / etc.)         |  - Search       |
|                  |                                      |    inside       |
| (filter chips    |                                      |  - Cite this    |
|  vertically)     |                                      |  - Pin (P4)     |
+------------------+--------------------------------------+-----------------+
```

### Decisions Joshua confirmed in chat (2026-05-12)

| #   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Top hits strip:** 3-5 best results across all types. Mixed. Ranker-decided. Compact.                                                                                                                                                                                                                                                                                                                                                                                                    |
| R2  | **Group nav lives in left column (vertical), not top row.** Each row = one type bucket + count. Click to filter.                                                                                                                                                                                                                                                                                                                                                                          |
| R3  | **One row per book/document** in the result column. Chapters / sections collapse into the detail pane, clickable.                                                                                                                                                                                                                                                                                                                                                                         |
| R4  | **Group labels track the same hierarchy as type filters** -- Handbooks / CFRs / AIM / AC / Knowledge / Mine / Tools / App Help. Sub-groups appropriate to each (e.g. CFRs: by Title).                                                                                                                                                                                                                                                                                                     |
| R5  | **Group filter is by chip + by selecting the left-column row.** "App Help" hidden from defaults; only when filtered.                                                                                                                                                                                                                                                                                                                                                                      |
| R6  | **"FAA Resources" label is wrong.** Need a replacement. Trying "Published Resources" / "References" / "Library" -- TBD.                                                                                                                                                                                                                                                                                                                                                                   |
| R7  | **Autocomplete is a separate dropdown under the input, NOT in the column view.** Bidirectional: doc-code -> title AND title -> doc-code. Tab to commit; Esc dismisses.                                                                                                                                                                                                                                                                                                                    |
| R8  | **Doc IDs always visible and prominent** on every published-resource row -- showing the title without the code is incomplete.                                                                                                                                                                                                                                                                                                                                                             |
| R9  | **Mockups + plan live at `design/mockups/search/`.**                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R10 | **Autocomplete is a generic input affordance, NOT a modal component.** It's a separate lib (`@ab/autocomplete` or part of `@ab/ui`) that wraps any text input. The search modal hosts an autocomplete-wrapped input; it doesn't own the dropdown. Modal opens only on Enter or click of a "search" button; Tab commits to the input and keeps the modal closed. Same autocomplete reused by future surfaces (header search bar, `/library` filter, command palette commands, quick-open). |

### Closed questions (2026-05-12)

| #   | Question                                                                                                                                                       | Decision                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ1 | Top hits strip: 3 vs 5? Bigger "chiclets" vs single rows?                                                                                                      | 3 compact rows. Conserve vertical space; users can scroll the buckets for the rest.                                                                                       |
| OQ2 | Top-row group label for the "Published Resources" bucket -- what's the actual word? Options: `Library` / `References` / `Published` / `Sources` / `Documents`. | `Library` (recommended). Short, accurate. `Sources` collides with `@ab/sources` lib name.                                                                                 |
| OQ3 | Sub-groups inside each top-level type. E.g. for CFRs: 14 CFR / 49 CFR. For Handbooks: by series? For AIM: by chapter range?                                    | **No sub-columns when count <= 4.** For CFR (only 2 titles), prefix the title inline: `14 CFR Part 91`, `49 CFR Part 175`. Same row, no nested nav. Same rule everywhere. |
| OQ4 | Autocomplete triggers -- on what, and what's the search shape after?                                                                                           | See below: search is two-stage. Autocomplete drives "scoped" search; raw Enter drives "broad" search. Phrase-level FTS for "I remember a fact" queries.                   |

### Two-stage search model (OQ4 expanded)

A query has THREE distinct intents. The UI should route each to a different search shape rather than collapsing them all into "ranked list of mixed results."

| Intent                                                                    | How it's triggered                                                                                                                                                         | Result shape                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I-1: I want a specific known thing.**                                   | User types prefix of a title or doc code, autocomplete dropdown opens, user Tab-commits an entry. The committed doc becomes a `doc:<code>` filter chip.                    | **Scoped search.** The result panel shows the doc itself as the headline, then the references TO that doc (citations from lessons, knowledge nodes that cite it, user's own cards that link it). Equivalent to "open this thing + show me everything that points at it." |
| **I-2: I want to find a thing by name.**                                  | User types a phrase that's title-shaped (a few words, no operators), and hits Enter WITHOUT autocompleting. Or types and the autocomplete fires but they dismiss it (Esc). | **Broad mixed search.** Ranker outputs by composite score: exact title matches > prefix title matches > body matches. Books/whole docs outrank chapters; chapters outrank paragraphs. Default current model, but with the redesigned ranker.                             |
| **I-3: I have a fuzzy memory of a fact and want to find where it lives.** | User types a phrase that's NOT title-shaped (longer, includes operators or quotes, "I remember reading something about dusk vs sunset"). Enter runs.                       | **Phrase-level FTS across body text.** Returns sections / paragraphs / lesson fragments ranked by relevance, with snippets highlighting the matched text. Whole-doc results are deranked or omitted because the user clearly wants a specific passage, not a document.   |

How the UI distinguishes I-2 from I-3:

- I-2: the query is short (1-3 words) AND prefix-matches at least one known title or alias.
- I-3: the query is long (4+ words) OR contains operators/quotes OR doesn't prefix-match any title.

The user can override by adding inline operators:

- `"dusk vs sunset"` (quoted) -> force I-3 even if short.
- `kind:cfr 91.103` -> force scoped search to CFR sections.
- `doc:FAA-H-8083-28 turbulence` -> force I-1 scope to AvWX + free-text "turbulence" inside it.

Autocomplete trigger rules (revised):

| Input                            | Dropdown fires?                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `FAA-H-`                         | Yes -- doc-code pattern.                                                                     |
| `AC 00`                          | Yes -- doc-code pattern.                                                                     |
| `Part 91`                        | Yes -- doc-code pattern.                                                                     |
| `aviation`                       | Yes -- title prefix >=4 chars.                                                               |
| `weather`                        | Yes -- title prefix >=4 chars (matches "Aviation Weather Handbook" via the "weather" token). |
| `wx`                             | No -- 2 chars, synonym. Enter runs broad search; the result panel surfaces a synonym chip.   |
| `something about dusk vs sunset` | No -- 6 words, no title-prefix match. Enter runs I-3 phrase-FTS.                             |
| `"dusk vs sunset"` (quoted)      | No -- quoted forces I-3.                                                                     |

The Tab-commit on a dropdown entry sets `doc:<code>` as a chip and runs the I-1 scoped search. Enter on the dropdown closed runs whichever of I-2 / I-3 the input shape suggests.

This is the user's intended mental model. Three searches, one input, autocomplete is the disambiguator.

## Ranking redesign

The current ranker scores by needle-match-bucket across `displayName / aliases / keywords / body`. That's why a section body matching `weather` outranks the book titled `Aviation Weather Handbook`.

### New ranking model

For every result, compute a composite score:

```text
score = type_tier_weight(type) + title_match_tier(needle, title) + body_match_tier(needle, body) - depth_penalty(result)
```

Where:

- **`type_tier_weight`** -- a base lift for canonical document types. Books and Handbooks lift over CFR Parts, AIM chapters, etc. The "Aviation Weather Handbook" is the canonical answer to "weather", so its type tier should reflect that.
- **`title_match_tier`** -- exact title match >> title contains the needle >> alias contains the needle >> keyword match >> body match.
- **`depth_penalty`** -- a section nested 4 levels deep should NOT outrank the book it lives in. Apply a small subtract per depth level (0 for the root document, +1 per level).

### Title-match tier (worked example for `weather`)

| Result                                         | Title match? | Body match? | depth | Total                 |
| ---------------------------------------------- | ------------ | ----------- | ----- | --------------------- |
| `FAA-H-8083-28 Aviation Weather Handbook`      | YES (exact)  | -           | 0     | type:HANDBOOK + 100   |
| `AC 00-6B Aviation Weather`                    | YES (exact)  | -           | 0     | type:AC + 100         |
| `Weather` (study course title)                 | YES (exact)  | -           | 0     | type:COURSE + 100     |
| `14 CFR 121.101 weather reporting`             | partial      | yes         | 2     | type:CFR_SECTION + 50 |
| `AFH 14.5 weather vaning`                      | partial      | yes         | 3     | type:HBK_SECTION + 40 |
| `AFH 0.6 introduction` (body mentions weather) | no           | yes         | 2     | type:HBK_SECTION + 10 |

Result: the 3 canonical "weather" documents land in the top hits strip. The CFRs / sections appear in the type buckets when the user drills into them, ranked among their siblings.

### Type tier weights (proposed starting values)

| Type                           | Tier weight |
| ------------------------------ | ----------- |
| Handbook root (FAA-H-*)        | 100         |
| AC (whole document)            | 90          |
| CFR Part root (e.g. 14 CFR 91) | 90          |
| AIM Chapter                    | 85          |
| Knowledge node                 | 80          |
| Study course                   | 80          |
| Glossary term                  | 75          |
| Handbook chapter               | 50          |
| CFR Section                    | 50          |
| AIM Paragraph                  | 45          |
| User's card / rep / plan       | 40          |
| App Help page                  | 20          |
| External tool                  | 10          |

These are starting points; they get tuned as Joshua walks more queries.

## Type bucket and sub-group structure

```text
Handbooks              (FAA-H-*)
  - by edition          (each FAA-H-* doc rolls up as one row; chapters in detail)
CFRs                   (14 CFR, 49 CFR)
  - 14 CFR
    - Part 91, 121, 135, etc.
  - 49 CFR
AIM
  - Chapters (10)
AC                     (Advisory Circulars)
ACS                    (Airman Certification Standards)
Knowledge              (study.knowledge_node)
  - by domain          (weather / regs / aerodynamics / ...)
Courses                (study courses + lessons)
Glossary               (terms)
Mine                   (My Stuff: cards / reps / plans)
Tools                  (External tools, validated + community tiers)
App Help               (hidden from default; appears when filter selected)
```

## Autocomplete UX

Triggers:

1. Input matches a doc-code pattern (`FAA-H-...`, `AC ...`, `14 CFR ...`, `Part ...`, `§91...`, `AvWX`, `PHAK`, etc.). Already covered by `libs/aviation/src/doc-code-detector.ts`.
2. Input is a title prefix of length >=4 against any known doc title or alias. E.g. `Avia` matches `Aviation Weather Handbook`, `Aviation Instructor's Handbook`, etc.

Dropdown content per matching doc:

```text
+---------------------------------------------------------------+
| FAA-H-8083-28   Aviation Weather Handbook                     |
| FAA-H-8083-25   Pilot's Handbook of Aeronautical Knowledge    |
| FAA-H-8083-3    Airplane Flying Handbook                      |
+---------------------------------------------------------------+
```

The doc ID is ALWAYS shown alongside the title (R8). Bidirectional: typing the title prefix or the code prefix surfaces the same dropdown.

Keyboard:

- `Up` / `Down` move the highlight in the dropdown
- `Tab` (or `Enter` when nothing else is selected) commits the highlighted entry into the input box, REPLACING what the user was typing with the canonical form (e.g. `FAA-H-808` becomes `FAA-H-8083-28`)
- After commit, the dropdown closes. A second `Enter` runs the search.
- `Esc` dismisses the dropdown but keeps the palette open with the current input value
- Typing past the trigger / past the matched prefix dismisses the dropdown automatically

For synonym queries (`wx`, `tstm`): no autocomplete trigger. The full search runs and shows the chip "wx -> weather". The user wanted `wx` to remain a search term, not a thing-to-autocomplete-to-weather.

## What to implement, ordered

This redesign lands BEFORE Phase 4. Phase 4 (Cmd+Shift+P command surfaces) is structurally orthogonal -- the command palette mode just filters the search to `cmd.*` types, but the underlying presentation should already be the new shape.

| #   | Slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Touches                                                                                                                                                                                                                                                   |                                                                                                |                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Intent classifier.** Add `classifyIntent(rawQuery, parsedFilters): 'scoped' \                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 'broad' \                                                                                                                                                                                                                                                 | 'phrase-fts'`. Returns one of three modes per OQ4. Used by `searchGrouped` to pick the ranker. | `libs/help/src/intent-classifier.ts` (new), `libs/help/src/search.ts` |
| 2   | **Ranker rewrite.** Add `type_tier_weight` + `title_match_tier` + `body_match_tier` + `depth_penalty`. Composite score. Per-intent variations (scoped: doc filter first; broad: standard; phrase-fts: body-weighted, depth-rewarded).                                                                                                                                                                                                                                                                                                                                                                                                                                  | `libs/help/src/search-core.ts`, `libs/help/src/search.ts`                                                                                                                                                                                                 |                                                                                                |                                                                       |
| 3   | **Top hits strip computation.** `searchGrouped` returns `topHits: SearchResult[]` (3 rows) in addition to per-bucket groups. Strip is hidden in `phrase-fts` mode (the user wants passages, not docs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `libs/help/src/search.ts`, `libs/help/src/schema/result-types.ts`                                                                                                                                                                                         |                                                                                                |                                                                       |
| 4   | **Book-level collapse.** When a query has matches in a book AND in its chapters, return ONE row for the book; expose chapters as `result.children: SearchResult[]`. Only applies in `scoped` and `broad` modes; in `phrase-fts` mode the section is the result.                                                                                                                                                                                                                                                                                                                                                                                                        | `libs/help/src/search.ts`, loaders for handbook-sections, cfr-sections, aim-sections                                                                                                                                                                      |                                                                                                |                                                                       |
| 5   | **Inline-prefix sub-groups.** When a type bucket has <= 4 entries that share a natural prefix (CFR Title, AC series, AIM chapter), prefix the row inline (`14 CFR Part 91`) instead of creating a sub-column.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `libs/help/src/search.ts`, `libs/help/src/ui/PaletteRow.svelte`                                                                                                                                                                                           |                                                                                                |                                                                       |
| 6   | **New `CommandPalette` layout.** Top strip + vertical type-chip column on left + result column + detail pane on right. Detail pane shows `result.children` when the result is a book.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `libs/help/src/ui/CommandPalette.svelte`, `libs/help/src/ui/PaletteColumn.svelte` (likely deprecate), new `PaletteTypeNav.svelte`, new `PaletteTopHits.svelte`                                                                                            |                                                                                                |                                                                       |
| 7   | **Autocomplete extracted as a generic input affordance (R10).** New `libs/autocomplete/` (or fold into `@ab/ui`). Exports `<Autocomplete>` Svelte component + `AutocompleteSource` interface. Bundled sources: `DocCodeSource`, `TitlePrefixSource`. The component wraps any text input -- no coupling to the modal. Modal hosts an `<Autocomplete>`-wrapped input; Tab commits canonical form into input + closes dropdown + modal stays where it is; Enter (dropdown closed) runs the search and opens / focuses the result modal. Modal NEVER opens autocomplete itself. Reusable: future header search bar, /library filter, command palette commands, quick-open. | New `libs/autocomplete/src/{Autocomplete.svelte,DocCodeSource.ts,TitlePrefixSource.ts,types.ts,index.ts}`, refactor `libs/help/src/ui/CommandPalette.svelte`, delete `libs/help/src/ui/DocCodeAutocomplete.svelte` (logic moves to autocomplete sources). |                                                                                                |                                                                       |
| 8   | **Always-show doc ID.** Every published-resource row template shows doc code + title.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `libs/help/src/ui/PaletteRow.svelte` (new shared row template)                                                                                                                                                                                            |                                                                                                |                                                                       |
| 9   | **Rename "FAA Resources" group to "Library".** Per OQ2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `libs/help/src/schema/result-types.ts` (label only; type IDs stay stable)                                                                                                                                                                                 |                                                                                                |                                                                       |
| 10  | **Phrase-level FTS loader.** New `loadFtsPassages(needle, limit)` queries `study.referenceSection.body` + `study.knowledgeNode.contentMd` + `study.lesson.body` with proper Postgres `to_tsquery`/`websearch_to_tsquery` and ranking. Used only in `phrase-fts` mode.                                                                                                                                                                                                                                                                                                                                                                                                  | `libs/help/src/loaders/fts-passages.ts` (new), DB-backed via `@ab/bc-study/server`                                                                                                                                                                        |                                                                                                |                                                                       |
| 11  | **Walk against the test-plan queries plus new I-3 cases.** Add fixture queries to `docs/work-packages/command-palette/test-plan.md`: `"dusk vs sunset"`, `pilot rest before night flying`, `something about VFR minimums in class B`. Tune ranker weights.                                                                                                                                                                                                                                                                                                                                                                                                             | Manual + `libs/help/src/__tests__/ranker-fixtures.json`                                                                                                                                                                                                   |                                                                                                |                                                                       |

## Mockup files in this directory

- `REDESIGN.md` (this file)
- `mockup-01-current-state.md` -- ASCII of what ships today and why it's wrong
- `mockup-02-new-layout.md` -- ASCII of the proposed layout
- `mockup-03-autocomplete.md` -- ASCII of the autocomplete dropdown UX
- `mockup-04-ranking.md` -- worked examples of the new ranker

## What changes about the WP

Once Joshua signs off on this redesign, the work package at `docs/work-packages/command-palette/` gets an addendum:

- `spec.md` -- locked decision #10: "Phase 3.5 -- ranker + layout redesign before Phase 4". Decision #5 (Variant C as production default) is superseded; the new layout is the production default.
- `tasks.md` -- new section for slices 1-8 above.
- `design.md` -- update the layout contract section to match the new shape.
- `test-plan.md` -- new manual walk table with the ranked-result expectations (e.g. `weather` MUST top-hit AvWX, AC 00-6, and the Weather course).

I'll author that addendum once you confirm the redesign.
