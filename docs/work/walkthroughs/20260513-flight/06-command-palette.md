# Command Palette

A unified search + command launcher for airboss. Not a generic palette: it has an intent classifier that switches between three search models (scoped, broad, phrase-FTS), a composite ranker, per-intent rendering panels, per-app command registries, and an autocomplete dropdown for doc codes and title prefixes.

Status: Phase 3.5 shipped (PRs #857, #921, #925, #930, #933, #936, #940). Phases 4 (Cmd+Shift+P command mode) and 5 (Cmd+P quick-open + recents) still pending. Walkthrough owed per [NOW.md](../../NOW.md).

Spec: [docs/work-packages/command-palette/](../../../work-packages/command-palette/).

## The trigger

Three keybindings, all global, installed by [libs/help/src/ui/HelpSearch.svelte](../../../../libs/help/src/ui/HelpSearch.svelte) on `<svelte:window onkeydown>`:

| Keys                           | Mode        | Phase | What                                     |
| ------------------------------ | ----------- | ----- | ---------------------------------------- |
| `Cmd+K` / `Ctrl+K` / `/`       | `search`    | 3.5   | Default cross-library search. Lives now. |
| `Cmd+P` / `Ctrl+P`             | `quickopen` | 5     | Recents + jump targets. Future.          |
| `Cmd+Shift+P` / `Ctrl+Shift+P` | `command`   | 4     | App-scoped commands only. Future.        |

`/` only triggers the palette when the user is not focused in an input.

## The three intents

The intent classifier in [libs/help/src/intent-classifier.ts](../../../../libs/help/src/intent-classifier.ts) dispatches on query shape:

| Intent       | Triggered by                                                         | Returns        |
| ------------ | -------------------------------------------------------------------- | -------------- |
| `scoped`     | A `doc:` filter chip set OR an autocomplete entry committed via Tab. | `'scoped'`     |
| `broad`      | Short query (<= 3 words), no quotes, matches a title prefix.         | `'broad'`      |
| `phrase-fts` | A quoted phrase, OR 4+ words, OR no title-prefix match.              | `'phrase-fts'` |

Constants (from `@ab/constants`):

- `PHRASE_FTS_WORD_COUNT_THRESHOLD = 4`
- `TITLE_PREFIX_MIN_NEEDLE_LENGTH = 4`

### I-1 scoped search

What it looks like: the user Tab-commits a doc code (`FAA-H-8083-28`) or title prefix from the autocomplete dropdown, or pastes a `doc:` filter chip. The input becomes the doc code in canonical form, a chip appears, and the query reruns with the filter active.

Renders [PaletteScopedView.svelte](../../../../libs/help/src/ui/PaletteScopedView.svelte): a doc headline card with full citation at the top, then a "References to this doc" section grouping lessons, knowledge nodes, cards, and cross-doc citations. No type-nav, no top-hits, no detail pane.

Ranker variation: filter only; sort headline-first, then citations grouped by source.

### I-2 broad search (default)

What it looks like: the user types a short query (<= 3 words) that matches a known title prefix. The screen splits:

- **Input row** with autocomplete dropdown overlay.
- **Filter chips** (synonym expansions like `wx -> weather`, `doc:` chips, `kind:` chips). Each chip removable.
- **Top-hits strip** -- three best ranker-decided results, mixed type.
- **Left vertical type-nav** with counts per group (`Handbooks 12`, `CFRs 5`, `Knowledge nodes 8`, ...). Click to filter. App Help hidden by default; surfaces only when explicitly filtered.
- **Middle result column** -- one row per book/doc (no chapter pollution; chapters live in the detail pane). Inline-prefix sub-groups for `14 CFR Part 91`, `49 CFR Part 175`.
- **Right detail pane** -- collapsible via `Cmd+\`. Hidden below ~900 px viewport. Shows chapters/sections of the selected row as clickable sub-results.

Ranker variation: `type_tier + title_match_tier + body_match_tier - depth_penalty`. Type tiers from `TYPE_TIER` in [search-core.ts](../../../../libs/help/src/search-core.ts): handbooks 100, CFR parts 90, ACs 90, knowledge nodes 80, glossary 75, chapters/sections 50, commands 30, tools 10. Depth penalty keeps deep sections from outranking parents.

Result type buckets:

- **Library** (faa-resources): handbooks, CFR parts/sections, AIM, ACs, ACS.
- **Airboss Content**: courses, knowledge nodes, glossary, lessons.
- **App Help**: help pages (hidden by default).
- **My Stuff**: cards, reps, plans.
- **External Tools**: validated + community tiers, both visible by default.
- **Commands**: actions + goto routes (Phase 4 surface).

Renders [PaletteTopHits.svelte](../../../../libs/help/src/ui/PaletteTopHits.svelte) + [PaletteTypeNav.svelte](../../../../libs/help/src/ui/PaletteTypeNav.svelte) + the main column + [PaletteDetailPane.svelte](../../../../libs/help/src/ui/PaletteDetailPane.svelte).

### I-3 phrase-FTS (full-text search)

What it looks like: the user typed a quoted phrase, 4+ words, or anything with no title-prefix match. Renders passage cards with highlighted snippet text (2 fragments max, 25 words max per fragment). No top-hits strip, no type-nav. Horizontal layout optimized for reading. Each card links to the section's anchor in flightbag.

Ranker variation: Postgres `ts_rank_cd` lift. Type tier inverted (sections rank higher than books). Depth rewarded (deeper = more specific = higher relevance). Body matches heavily boosted.

FTS sources queried by [libs/help/src/loaders/fts-passages.ts](../../../../libs/help/src/loaders/fts-passages.ts):

1. `study.reference_section.content_md` -- handbook chapters, CFR sections, AIM paragraphs.
2. `study.knowledge_node.content_md` -- ADR-011 nodes.
3. `study.course_step.body_md` -- course tree bodies (Phase 3.5+ surface).

Renders [PalettePassageView.svelte](../../../../libs/help/src/ui/PalettePassageView.svelte).

Server-only loader. DEFAULT_LIMIT = 30. `HEADLINE_OPTIONS`: `StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=25, MinWords=10`. No special tsvector index in Phase 3.5 -- raw `to_tsvector` on `content_md`. Indexes deferred until p95 exceeds 50 ms.

## Per-app command registries

Phase 4 surface. Already scaffolded:

| App       | Commands file                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------- |
| study     | [apps/study/src/lib/palette/commands.ts](../../../../apps/study/src/lib/palette/commands.ts)         |
| sim       | [apps/sim/src/lib/palette/commands.ts](../../../../apps/sim/src/lib/palette/commands.ts)             |
| hangar    | [apps/hangar/src/lib/palette/commands.ts](../../../../apps/hangar/src/lib/palette/commands.ts)       |
| flightbag | [apps/flightbag/src/lib/palette/commands.ts](../../../../apps/flightbag/src/lib/palette/commands.ts) |

Example study commands:

- `study.new-plan` -> `ROUTES.PROGRAM_PLANS_NEW`
- `study.todays-reps` -> `ROUTES.REPS`
- `study.memory-inbox` -> `ROUTES.MEMORY`
- `study.dashboard` -> `ROUTES.INSIGHTS`
- `study.new-card` -> `ROUTES.MEMORY_NEW`

Each command is a `PaletteCommand` object:

```typescript
{
  id: 'study.new-card',
  type: 'cmd.action' | 'cmd.goto',
  label: 'New card',
  keywords: ['create', 'add', 'card'],
  surface: APP_IDS.STUDY,
  handler: () => goto(ROUTES.MEMORY_NEW),
}
```

Registry singleton in [libs/help/src/commands/registry.ts](../../../../libs/help/src/commands/registry.ts) -- in-memory `Map<id, PaletteCommand>`. Methods: `register()`, `unregister()`, `list()`, `search(parsed, hostSurface)` (returns matches sorted by host-surface boost, then alpha). Commands are keyed by `surface` so they sort above commands from other apps when launched from their home app.

Lifecycle: `registerStudyCommands()` runs on layout mount; `unregister()` runs on destroy.

## Modal keybindings

Inside the open palette ([CommandPalette.svelte](../../../../libs/help/src/ui/CommandPalette.svelte)):

| Keys                      | Action                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `Esc`                     | Close palette.                                                           |
| `Up` / `Down`             | Move selection within result column or top-hits.                         |
| `Tab` / `Shift+Tab`       | Move focus across type-nav / result column / detail pane (I-2 mode).     |
| `Enter` (dropdown open)   | Commit autocomplete entry.                                               |
| `Enter` (dropdown closed) | Activate selected result.                                                |
| `Cmd+Enter`               | Open result in new tab, or set `doc:` filter chip from a dropdown entry. |
| `Cmd+\`                   | Toggle detail-pane visibility.                                           |

## Code map

| Concern            | Lives at                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Main palette       | [libs/help/src/ui/CommandPalette.svelte](../../../../libs/help/src/ui/CommandPalette.svelte) (~28 KB)                                           |
| Global keybindings | [libs/help/src/ui/HelpSearch.svelte](../../../../libs/help/src/ui/HelpSearch.svelte) -- lines 64-95                                             |
| Intent classifier  | [libs/help/src/intent-classifier.ts](../../../../libs/help/src/intent-classifier.ts) + `.test.ts`                                               |
| Composite ranker   | [libs/help/src/search-core.ts](../../../../libs/help/src/search-core.ts) -- `scoreResult(needle, r, intent)` + `TYPE_TIER`                      |
| Ranker fixtures    | [libs/help/src/__tests__/ranker-fixtures.json](../../../../libs/help/src/__tests__/ranker-fixtures.json)                                        |
| Scoped view (I-1)  | [libs/help/src/ui/PaletteScopedView.svelte](../../../../libs/help/src/ui/PaletteScopedView.svelte)                                              |
| Passage view (I-3) | [libs/help/src/ui/PalettePassageView.svelte](../../../../libs/help/src/ui/PalettePassageView.svelte)                                            |
| Top hits (I-2)     | [libs/help/src/ui/PaletteTopHits.svelte](../../../../libs/help/src/ui/PaletteTopHits.svelte)                                                    |
| Type-nav (I-2)     | [libs/help/src/ui/PaletteTypeNav.svelte](../../../../libs/help/src/ui/PaletteTypeNav.svelte)                                                    |
| Row                | [libs/help/src/ui/PaletteRow.svelte](../../../../libs/help/src/ui/PaletteRow.svelte)                                                            |
| Detail pane        | [libs/help/src/ui/PaletteDetailPane.svelte](../../../../libs/help/src/ui/PaletteDetailPane.svelte)                                              |
| Command registry   | [libs/help/src/commands/registry.ts](../../../../libs/help/src/commands/registry.ts) + [types.ts](../../../../libs/help/src/commands/types.ts)  |
| FTS loader         | [libs/help/src/loaders/fts-passages.ts](../../../../libs/help/src/loaders/fts-passages.ts) (server-only)                                        |
| Other loaders      | [libs/help/src/loaders/](../../../../libs/help/src/loaders/) -- aviation-refs, handbook-sections, cfr-sections, aim-sections                    |
| Autocomplete lib   | [libs/autocomplete/src/Autocomplete.svelte](../../../../libs/autocomplete/src/Autocomplete.svelte) + `DocCodeSource.ts`, `TitlePrefixSource.ts` |
| Smoke test         | [tests/e2e/command-palette-smoke.spec.ts](../../../../tests/e2e/command-palette-smoke.spec.ts)                                                  |
| Phase 3 test       | [tests/e2e/command-palette-phase3.spec.ts](../../../../tests/e2e/command-palette-phase3.spec.ts)                                                |

## Key decisions

| #   | Decision                                                                                                                 | Why                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Default surface boost: launching app's commands and results first; others still visible.                                 | Task locality > cross-app comprehensiveness.                                                                                                                                       |
| 2   | External Tools split into Validated + Community tiers; both visible by default.                                          | Trust (FAA-validated) plus openness (community).                                                                                                                                   |
| 3   | Detail pane on the right; collapses with `Cmd+\`; hidden below ~900 px viewport.                                         | Desktop-first. Narrow viewports need the column space.                                                                                                                             |
| 4   | Synonyms seeded from Appendix A (~100 entries) + alias expansion.                                                        | `wx` should find `weather` content.                                                                                                                                                |
| 5   | Phase 3 variant C superseded by Phase 3.5 redesign.                                                                      | Phase 3 walk revealed: side-by-side columns fail when buckets are uneven; section-level pollution overwhelms doc hits. Phase 3.5 replaces with vertical type-nav + top-hits strip. |
| 6   | Empty doc-picker order: alphabetical for first session; recents later.                                                   | Cold-start simplicity, warm-start personalization deferred to Phase 5.                                                                                                             |
| 7   | `REFERENCE_SOURCE_TYPES` expansion: AVWX, IPH, RMH, AIH, HFH, GFH, BFH as discrete enum values.                          | Handbook-specific boosting + filtering.                                                                                                                                            |
| 8   | New layout (Phase 3.5): top-hits strip + vertical type-nav + result column + detail pane.                                | Design walk 2026-05-12 + user testing proved layout reduces scroll/clutter vs Phase 3 variant C.                                                                                   |
| 9   | Composite ranker: `type_tier + title_match + body_match - depth_penalty`; per-intent variations.                         | I-1 scoped: filter only. I-2 broad: standard composite. I-3 phrase-FTS: inverted tier (sections > books) + depth reward + `ts_rank_cd` lift.                                       |
| 10  | Three-intent model: I-1 scoped, I-2 broad, I-3 phrase-FTS.                                                               | Autocomplete commit -> I-1. Default Enter routes to I-2 or I-3 per query shape. Each intent has a custom ranker and result panel.                                                  |
| 11  | Book-level collapse: ONE row per book; chapters become `result.children` in the detail pane.                             | Eliminates the "book + 14 chapter rows" pollution; declutters the result column.                                                                                                   |
| 12  | Rename "FAA Resources" group label to "Library".                                                                         | Not all entries are FAA-authored (NTSB, sectionals, industry refs). Type ids (`faa.*`) stay stable.                                                                                |
| 13  | Autocomplete is orthogonal to the modal: generic lib `@ab/autocomplete`; modal hosts it; dropdown never opens the modal. | Reusability. Future header search, /library filter, command palette, quick-open all use the same component.                                                                        |
| 14  | Doc ids always visible and prominent on every published-resource row.                                                    | Bidirectional autocomplete: typing the code OR the title surfaces the same dropdown row showing both.                                                                              |
| 15  | Phrase-level FTS loader: Postgres `websearch_to_tsquery` against three sources + `ts_headline` highlighting.             | Server-side. Deferred index strategy until p95 exceeds 50 ms.                                                                                                                      |
| 16  | Browser-load verification mandatory before merge (Phase 3.5+).                                                           | Phase 3 incident: agent "page hydrates fine" reports were wrong. Required pattern: dispatcher loads the affected page in a real browser, devtools clean, before clicking merge.    |

## Operator notes

### Open the palette

```text
Cmd+K              search mode (default)
Cmd+P              quickopen mode (Phase 5 -- not yet shipped)
Cmd+Shift+P        command mode (Phase 4 -- not yet shipped)
/                  search mode (when not in an input)
```

### Add a command to a registry

1. Open the relevant per-app commands file (paths above).
2. Add a `PaletteCommand` object to the `COMMANDS` array:

   ```typescript
   {
     id: 'study.new-thing',
     type: 'cmd.action',                       // or 'cmd.goto'
     label: 'New thing',
     keywords: ['create', 'add'],
     surface: APP_IDS.STUDY,
     handler: () => goto(ROUTES.STUDY_NEW_THING),
   }
   ```

3. `registerStudyCommands()` registers all on layout mount; no separate call.

### Add a new intent

1. Edit [intent-classifier.ts](../../../../libs/help/src/intent-classifier.ts):
   - Add a new value to the `SearchIntent` union.
   - Add a branch in `classifyIntent()` to detect it.
2. Edit [search-core.ts](../../../../libs/help/src/search-core.ts):
   - Add a branch in `scoreResult(needle, result, intent)` for the new intent's ranker.
3. Add a result-panel component (e.g., `PaletteNarrowView.svelte`) and wire it into `CommandPalette.svelte`'s intent switch.

### Run e2e

```bash
bunx playwright test command-palette-smoke.spec.ts
bunx playwright test command-palette-phase3.spec.ts
bun test libs/help                                # everything help-side
```

### Seed data for FTS

The phrase-FTS loader queries:

- `study.reference_section`
- `study.knowledge_node`
- `study.course_step`

For FTS to return results, those tables must be populated via migrations + seeds in `@ab/bc-study`. Postgres `websearch_to_tsquery` is built-in (no extension required). No tsvector index in Phase 3.5; deferred until perf budget exceeded.

## Deferred / follow-ups

From [docs/work-packages/command-palette/OUT-OF-SCOPE.md](../../../work-packages/command-palette/OUT-OF-SCOPE.md):

| Item                                            | Status   | Trigger                                                                                                |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Server-side full-text search                    | Deferred | When any in-memory query exceeds 50 ms p95 OR corpus grows beyond in-memory budget.                    |
| Personalisation beyond recents                  | Deferred | When recents-only ranking proves insufficient.                                                         |
| Indexing user reflection journals (`mine.note`) | Deferred | When reflection journals ship as a surface AND a loader corpus exists.                                 |
| Recents decay: LRU vs time-based                | Deferred | Phase 5 walk + user telemetry.                                                                         |
| Ranker constant tuning                          | Deferred | Phase 3.5 walk fixture-based tuning once redesign lands.                                               |
| `@ab/autocomplete` lib vs folding into `@ab/ui` | Deferred | Phase 3.5 decision; resolved by shipping as separate lib for reusability.                              |
| Phrase-FTS index strategy                       | Deferred | Phase 3.5 perf review. Start with `websearch_to_tsquery` on raw text; add GIN tsvector if recall poor. |
| Intent classifier word-count threshold          | Deferred | Tune via fixtures (currently 4 words for I-3 boundary).                                                |

### Rejected (not planned)

| Item                                  | Why rejected                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Cross-tenant / cross-org search       | Single-user, single-tenant product.                                                     |
| Localisation                          | English-only platform; localisation deferred to a platform-wide decision.               |
| Voice / NL queries                    | Different product (expensive LLM, latency mismatch vs keyboard-driven indexed palette). |
| Alfred-style multi-step workflows     | Out of scope for a launcher/locator.                                                    |
| Reskin of hangar `/docs` admin search | Different surface for different users; don't force one UI to do two jobs.               |

## Phase roadmap

| Phase | PRs                    | Scope                                                                                                                                                                         |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | #817                   | FAA doc registry, synonyms, doc-code detector.                                                                                                                                |
| 2     | #831                   | Result taxonomy, multi-column palette, 11 loaders, `/api/palette/search` endpoint.                                                                                            |
| 3     | #857, #921, #925       | CommandPalette component, detail pane, doc-code autocomplete, three dev variants (Variant C production).                                                                      |
| 3.5   | #930, #933, #936, #940 | **Live.** Intent classifier, composite ranker, layout redesign (top-hits + type-nav), book-level collapse, autocomplete lib extraction, phrase-FTS loader, per-intent panels. |
| 4     | TBD                    | Cmd+Shift+P, per-app command registries, host-surface boost.                                                                                                                  |
| 5     | TBD                    | Cmd+P quick-open, recents tracker, LRU decay.                                                                                                                                 |

## Related docs

- [docs/work-packages/command-palette/](../../../work-packages/command-palette/) -- spec, design, tasks, test-plan, OUT-OF-SCOPE

## Read next

You're at the end. If you have flight left, swing back to [00 -- architecture tour](00-architecture-tour.md) section 12 ("What's where" cheat sheet) and trace anything that's still fuzzy from your editor. Or open [docs/work/NOW.md](../../NOW.md) and look at "Walkthroughs owed" -- after this set, the list collapses.
