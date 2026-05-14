---
id: command-palette
title: Global search + command palette (Cmd+K / Cmd+P / Cmd+Shift+P)
product: platform
category: platform
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - search
  - palette
  - navigation
  - cross-app
legacy_fields:
  trigger: docs/work/plans/2026-05-10-command-palette-design.md
  source: design note 2026-05-10 + Phase 1 PR #817 (commit 059d93e3)
  related:
    - docs/work/plans/2026-05-10-command-palette-design.md
    - docs/work/plans/2026-05-10-palette-mockup.html
shipped_prs: [822, 831, 857, 921, 925, 929, 930, 933, 936, 937, 940, 942, 957]
---

# Global search + command palette

## Problem

Today's palette (opened by `/` or `Cmd+K`, in [HelpSearchPalette.svelte](../../../libs/help/src/ui/HelpSearchPalette.svelte)) indexes two registries: ~100 help pages and the aviation reference list. Phase 1 (PR #817) backfilled the aviation registry with 250 FAA doc rows, a 100-entry synonym map, and a doc-code detector. The mechanics now match the corpus -- but the UI is still a two-bucket list, has no result-type taxonomy, no detail pane, no command/quick-open modes, and no per-app boosting.

A pilot who types `weather` should get the AvWX handbook hoisted, with PHAK Ch. 12 / AFH Ch. 2 / AC 00-6 sections clustered below, our own weather course / KB nodes on the right, and tools like aviationweather.gov in a separate column -- and they should get this same shape from any app (`study`, `sim`, `hangar`, `flightbag`, `avionics`).

A pilot who types `FAA-H-8` should get a vscode-style dropdown of matching handbooks. Enter opens the doc; `Cmd+Enter` sets a `doc:` filter chip and returns the cursor.

A pilot who hits `Cmd+Shift+P` should get a command-only list scoped to actions ("New plan", "Start sim", "Open audit log"), with the current app's commands first.

A pilot who hits `Cmd+P` should get a quick-open list of recent + known things.

This WP delivers all four behaviours across four phases. Phase 1 already shipped on `main`; this WP scopes Phases 2-5.

## Goals

- One palette component, three modes (`search` / `quickopen` / `command`), bound to `Cmd+K` / `Cmd+P` / `Cmd+Shift+P`.
- One ranker, one query parser, one result type taxonomy, one synonym pass.
- 7+ typed result groups, presented as up to four columns + optional detail pane.
- Hoist banner when a query has a single tier-1 match.
- Doc-code autocomplete via the [doc-code-detector](../../../libs/aviation/src/doc-code-detector.ts) shipped in Phase 1.
- Per-app boost: launching from `study` puts study results / commands first; everything else still shows, lower.
- All five surfaces (`study`, `sim`, `hangar`, `flightbag`, `avionics` when it lands) open the same palette and pass their surface id for boosting.

## Phases

| Phase | Branch / PR        | Scope                                                                                                                                                                                                                                                                                                                                                    | Status             |
| ----- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1     | #817               | FAA doc registry, synonyms, doc-code detector, regression test fixture                                                                                                                                                                                                                                                                                   | shipped 2026-05-10 |
| 2     | #831               | Result taxonomy + multi-column palette + 11 loaders + AIM scanner + `/api/palette/search` endpoint                                                                                                                                                                                                                                                       | shipped 2026-05-11 |
| 3     | #857 + #921 + #925 | CommandPalette + PaletteDetailPane + DocCodeAutocomplete + 3 dev variants + theme accents + `@ab/sources` barrel split                                                                                                                                                                                                                                   | shipped 2026-05-12 |
| 3.5   | TBD                | **Ranker + layout redesign**. Three-intent search model (I-1 scoped / I-2 broad / I-3 phrase-FTS). Vertical type nav + top-hits strip + book-level collapse + inline-prefix sub-groups. Autocomplete extracted to its own lib (`@ab/autocomplete`) -- orthogonal to the search modal. Rename "FAA Resources" -> "Library". See `design/mockups/search/`. | this WP, NEXT      |
| 4     | TBD                | Cmd+Shift+P + per-app command registries. Built on top of the Phase 3.5 shape.                                                                                                                                                                                                                                                                           | this WP            |
| 5     | TBD                | Cmd+P quick-open + recents tracker. Built on top of the Phase 3.5 shape.                                                                                                                                                                                                                                                                                 | this WP            |

Phase exit checklist (per phase):

1. `bun run check branch` clean.
2. Relevant `bun test` packages green.
3. `/ball-review-full` run end-to-end; every finding fixed in the same PR; re-run to confirm.
4. **Walk the feature in a real browser** on every affected surface, on the parent repo with `.env` loaded -- NOT a worktree. Agent self-reports of "page hydrates fine" are not sufficient gates (Phase 3 cost 3 wrong-fix PRs by relying on those). See [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md).
5. PR description: what / why / manual test plan as a checklist.
6. Squash-merge after Joshua walks and approves.

## Result type taxonomy (the Phase 2 contract)

Every search result carries a `type` field. The type drives column placement, detail-pane affordances, and cross-column priority. Taxonomy is locked here so adding a new content domain later is "define type, register loader, assign column" -- not "rewrite the ranker."

The taxonomy itself ships in Phase 2 and is correct. Phase 3.5 renames the `FAA Resources` group to `Library` (per OQ2) and changes presentation (vertical type nav, top-hits strip, book-level collapse, inline-prefix sub-groups) -- but does NOT change the result type IDs themselves.

| Type                   | Source                                            | Group                                                |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `faa.handbook`         | FAA-H-* root rows in aviation registry            | Library                                              |
| `faa.handbook.chapter` | `study.reference_section` where `kind=HANDBOOK`   | Library                                              |
| `faa.cfr.part`         | `regulations/cfr-14/`, `cfr-49/` registry entries | Library                                              |
| `faa.cfr.sect`         | `study.reference_section` where `kind=CFR`        | Library                                              |
| `faa.aim`              | `aim/2026-04/*` index                             | Library                                              |
| `faa.ac`               | AC registry rows                                  | Library                                              |
| `faa.acs`              | ACS docs in aviation registry                     | Library                                              |
| `airboss.course`       | `course/courses/*/` + `course/weather/` etc.      | Airboss Content                                      |
| `airboss.knode`        | `study.knowledge_node`                            | Airboss Content                                      |
| `airboss.glossary`     | aviation registry entries that aren't FAA docs    | Airboss Content                                      |
| `airboss.lesson`       | study lesson pages                                | Airboss Content                                      |
| `airboss.help`         | help registry                                     | App Help (hidden by default; surfaces when filtered) |
| `mine.card`            | `study.card` for current user                     | Mine                                                 |
| `mine.rep`             | `study.review` (decision reps) for current user   | Mine                                                 |
| `mine.plan`            | `study.study_plan` for current user               | Mine                                                 |
| `web.tool`             | `libs/aviation/src/external-tools.ts`             | Tools                                                |
| `cmd.action`           | declarative command registry (Phase 4)            | Commands                                             |
| `cmd.goto`             | route registry (Phase 4)                          | Commands                                             |

`mine.note` and `airboss.lesson` are scaffolded in the type union but their loaders remain stubs; they land when the upstream surfaces do.

### Sub-group rule (Phase 3.5)

When a group has natural sub-groups (CFRs: 14 CFR vs 49 CFR) AND the count is small (<= 4 distinct sub-groups), prefix the sub-group inline on each row rather than creating a nested column. Example: `14 CFR Part 91`, `49 CFR Part 175`. Same row, no nested nav. Same rule applies anywhere it fits.

## Mode contract (the Phase 4/5 contract)

```ts
type PaletteMode = 'search' | 'quickopen' | 'command';

const ELIGIBLE: Record<PaletteMode, ReadonlySet<SearchResultType>> = {
  search:    ALL_TYPES,
  quickopen: new Set(['faa.handbook', 'faa.cfr.part', 'airboss.course', 'airboss.knode', 'mine.plan', 'cmd.goto']),
  command:   new Set(['cmd.action', 'cmd.goto']),
};
```

Same input box, ranker, and registry serve all three modes. Mode is selected by the keybinding that opened the palette.

## Three-intent search model (Phase 3.5 contract)

Within `search` mode, a query has THREE distinct intents. The intent classifier picks one per query; the ranker and the result-panel shape both vary per intent.

| Intent             | Triggered by                                                                                                                      | Ranker variation                                                                               | Result shape                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **I-1 scoped**     | User Tab-committed an autocomplete entry; `doc:<code>` filter chip is set                                                         | All results filtered to the doc; sort: headline first, then citations grouped by source        | Headline doc card + "References to this doc" panel (lessons, knowledge nodes, cards citing it)                                     |
| **I-2 broad**      | Short query (<=3 words), no operators, prefix-matches at least one known title -- OR -- user dismissed autocomplete and hit Enter | Composite: `type_tier + title_match + body_match - depth_penalty`. Whole docs outrank chapters | Top-hits strip (3 rows) + vertical type-nav + result column (one row per book/doc) + detail pane (chapters/sections clickable)     |
| **I-3 phrase-FTS** | Long query (4+ words) OR quoted phrase OR no title-prefix match                                                                   | Inverted: section-level types boosted; depth REWARDED; Postgres `ts_rank_cd` lift              | Passage cards with highlighted snippet text. No top-hits strip; no type-nav. Each card links to the section's anchor in flightbag. |

The intent classifier is implemented as a pure function `classifyIntent(parsedQuery, autocompleteCommitted: boolean): SearchIntent`. See [design.md](design.md) and [test-plan.md](test-plan.md) for the threshold table and fixtures.

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                             | Source                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Default surface boost: launching app's results / commands first; others still appear                                                                                                                                                                                                                                                                                                                                                                 | design note Decisions               |
| 2   | External Tools: split into Validated + Community tiers; both visible by default                                                                                                                                                                                                                                                                                                                                                                      | design note Decisions               |
| 3   | Detail pane on right; collapses with `Cmd+\`; hidden below ~900px                                                                                                                                                                                                                                                                                                                                                                                    | design note Decisions               |
| 4   | Synonyms seeded from Appendix A (~100 entries); shipped Phase 1                                                                                                                                                                                                                                                                                                                                                                                      | PR #817                             |
| 5   | **SUPERSEDED by R8.** Phase 3 shipped Variant C as production default, but the walk showed columns side-by-side don't help when buckets are uneven and section-level results pollute the FAA Resources column. The redesign in Phase 3.5 replaces Variant C with a vertical-type-nav + top-hits-strip layout. The three dev variants stay mounted under `/dev/palette/{wide,list,raycast}` for reference.                                            | mockup + Phase 3 scope + 2026-05-12 |
| 6   | Empty doc-picker order: alphabetical for first session; recency-weighted is later                                                                                                                                                                                                                                                                                                                                                                    | design note open Q #1               |
| 7   | `REFERENCE_SOURCE_TYPES` expansion: one slot per handbook (AVWX, IPH, RMH, AIH, HFH, GFH, BFH added as discrete values)                                                                                                                                                                                                                                                                                                                              | 2026-05-11 chat                     |
| 8   | **New layout (supersedes R5):** top-hits strip (3 rows, mixed types, ranker-decided) + vertical type-nav with counts (left) + result column (middle, one row per book/document) + detail pane (right, chapters/sections clickable). Sub-groups (CFR Title, AC series) prefix inline rather than creating nested columns.                                                                                                                             | 2026-05-12 walk                     |
| 9   | **Ranker rewrite:** composite score `type_tier_weight + title_match_tier + body_match_tier - depth_penalty`. Type tiers lift handbooks/CFR-parts/ACs/AIM-chapters above their own sections; depth penalty keeps deep sections from outranking their parents. Per-intent variations (I-1 scoped / I-2 broad / I-3 phrase-FTS).                                                                                                                        | 2026-05-12 walk                     |
| 10  | **Three-intent model.** Search has three distinct intents (I-1 scoped, I-2 broad, I-3 phrase-FTS). Autocomplete commit drives I-1. Default Enter routes to I-2 or I-3 based on query shape (word count, quoted, title-prefix match). Each intent uses a different ranker variation and result-panel shape.                                                                                                                                           | 2026-05-12 chat                     |
| 11  | **Book-level collapse.** When a query matches a book AND its chapters, the result column shows ONE row for the book. Chapters become `result.children` and render in the detail pane as clickable sub-results. Eliminates "book + 14 chapter rows" pollution.                                                                                                                                                                                        | 2026-05-12 walk                     |
| 12  | **Rename "FAA Resources" group label to "Library".** Type IDs (`faa.*`) stay stable; only the user-facing group label changes. Reason: not all "FAA Resources" are FAA-authored (NTSB, sectionals, industry refs).                                                                                                                                                                                                                                   | 2026-05-12 chat                     |
| 13  | **Autocomplete is a generic input affordance, ORTHOGONAL to the search modal.** Lives in its own lib (`@ab/autocomplete` or fold into `@ab/ui`). The search modal hosts an autocomplete-wrapped input; the modal does NOT own the dropdown. Modal opens only on Enter or click. Reusable: future header search bar, /library filter, command palette, quick-open. Pluggable `AutocompleteSource` interface; doc-code + title-prefix sources bundled. | 2026-05-12 chat                     |
| 14  | **Doc IDs always visible and prominent** on every published-resource row. Bidirectional autocomplete: typing the code OR the title surfaces the same dropdown row showing BOTH `FAA-H-8083-28` and `Aviation Weather Handbook`.                                                                                                                                                                                                                      | 2026-05-12 chat                     |
| 15  | **Phrase-level FTS loader** (I-3). Postgres `to_tsquery` / `websearch_to_tsquery` against `study.referenceSection.body` + `study.knowledgeNode.contentMd` + `study.lesson.body`. Returns passage-shaped results with snippet highlighting.                                                                                                                                                                                                           | 2026-05-12 chat                     |
| 16  | **Browser-load verification is mandatory before merge** for any Phase 3.5+ PR. Per CLAUDE.md and the 2026-05-12 incident: agent reports of "page hydrates fine" are unverified. The dispatcher must `bun scripts/dev.ts <app>` in the parent repo, load the affected page in a real browser, devtools clean, before merging.                                                                                                                         | 2026-05-12 incident                 |

## Non-goals

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## See also

- [tasks.md](tasks.md) -- per-phase task lists
- [test-plan.md](test-plan.md) -- manual + automated test plan
- [design.md](design.md) -- contracts, file layout, loader signatures
- [`../../../design/mockups/search/`](../../../design/mockups/search/) -- Phase 3.5 redesign mockups (current-state, new-layout, autocomplete, ranking)
