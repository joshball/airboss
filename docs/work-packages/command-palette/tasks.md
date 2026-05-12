---
title: Command palette -- tasks
parent: spec.md
---

# Tasks

One section per phase. Each line is roughly one PR-sized commit; expect more granular work inside.

Phases 2 and 3 shipped (PRs #831, #857, #921, #925). Phase 3.5 is the next slice and the redesign captured in `design/mockups/search/`. Phase 4 and 5 build on top of the Phase 3.5 shape.

## Phase 2 -- result taxonomy + multi-column palette (SHIPPED PR #831)

### 2a. Enum expansion (Decision #7)

- [ ] Expand `REFERENCE_SOURCE_TYPES` in [libs/constants/src/reference-tags.ts](../../../libs/constants/src/reference-tags.ts):
  - Add `AVWX: 'avwx'`, `IPH: 'iph'`, `RMH: 'rmh'`, `AIH: 'aih'`, `HFH: 'hfh'`, `GFH: 'gfh'`, `BFH: 'bfh'`.
  - Update `SOURCE_TYPE_LABELS` for each.
- [ ] Update [scripts/generate-faa-doc-registry.ts](../../../scripts/generate-faa-doc-registry.ts) to map doc codes to the new specific source types (FAA-H-8083-28* -> AVWX, -16* -> IPH, etc.). Keep PHAK/AFH/IFH mapping as is.
- [ ] Regenerate [libs/aviation/src/references/faa-docs.ts](../../../libs/aviation/src/references/faa-docs.ts).
- [ ] Audit all `switch (sourceType)` callers via grep; update exhaustive switches; run `bun run check branch`.

### 2b. Result type taxonomy + typed search facade

- [ ] Add `libs/help/src/schema/result-types.ts` with `SearchResultType`, `ResultColumn`, `COLUMN_BY_TYPE`, `SearchResult`, `GroupedResults`, `DocCluster` per [design.md](design.md).
- [ ] Update [libs/help/src/schema/help-registry.ts](../../../libs/help/src/schema/help-registry.ts) `SearchResult` -> add `type` field (typed back to `SearchResultType`).
- [ ] Rewrite [libs/help/src/search.ts](../../../libs/help/src/search.ts) to return `GroupedResults` instead of `{ aviation, help }`. Keep the old facade as a deprecated alias for one release cycle; remove call sites in same PR.
- [ ] Wire `expandSynonyms: true` on the aviation registry call. Track the rewrite list and surface it in `GroupedResults.synonymsApplied`.
- [ ] Compute `bannerHit` -- the single tier-1 match across all groups (none if 0 or multiple tier-1).
- [ ] Compute `clusters` -- group `faa.handbook.chapter` under their parent `faa.handbook`, `faa.cfr.sect` under their `faa.cfr.part`. Sort: parent first, then children by ordinal.

### 2c. Loaders

For each loader: pure function `loadX(query, host): readonly SearchResult[]`. SSR-safe where possible; client-side loaders go through `+page.server.ts` or `+server.ts`.

- [ ] `loaders/aviation-refs.ts` -- wraps existing `@ab/aviation` `search()` with `expandSynonyms: true`; splits handbook root rows from chapters; maps to `faa.handbook` / `faa.handbook.chapter` / `faa.cfr.*` / `faa.aim` / `faa.ac` / `faa.acs` / `airboss.glossary`.
- [ ] `loaders/handbook-sections.ts` + `loaders/cfr-sections.ts` -- `@ab/bc-study/server`'s `study.reference_section` table; needle match on `title` + `code` + `body` (use FTS column if present, else plain ILIKE).
- [ ] `loaders/aim-sections.ts` -- read [aim/2026-04/manifest.json](../../../aim/2026-04/manifest.json) + section files; index titles + body.
- [ ] `loaders/knowledge-nodes.ts` -- `study.knowledge_node`; match `name` + `aliases` + summary.
- [ ] `loaders/cards.ts` / `loaders/reps.ts` / `loaders/plans.ts` -- per-user; require `userId` in host context; empty when unauthenticated.
- [ ] `loaders/courses.ts` -- scan [course/](../../../course/) for top-level course directories + their `README.md` titles.
- [ ] `loaders/help-pages.ts` -- wraps `helpRegistry.search()`; tags every result as `airboss.help`.

### 2d. AIM scanner

- [ ] Extend [scripts/generate-faa-doc-registry.ts](../../../scripts/generate-faa-doc-registry.ts) with an AIM block: scan `aim/2026-04/*/`, emit one `Reference` per AIM chapter/section into [libs/aviation/src/references/faa-docs.ts](../../../libs/aviation/src/references/faa-docs.ts) (or split into a sibling `aim-docs.ts` -- decide based on file size).
- [ ] Confirm AIM glossary already covered by aviation registry; if not, add a one-off `aim-glossary` reference for the `aim/2026-04/glossary/` directory.

### 2e. External Tools seed

- [ ] Create `libs/aviation/src/external-tools.ts` with the tiered seed list:
  - Validated: `aviationweather.gov`, `1800wxbrief.com`, `faa.gov/notams`, `skyvector.com`.
  - Community: `foreflight.com`, `windy.com`, `ventusky.com`.
- [ ] Export `EXTERNAL_TOOLS` and `findExternalTools(query)`.
- [ ] Loader in `libs/help/src/loaders/external-tools.ts` returns `web.tool` `SearchResult`s.

### 2f. Multi-column palette UI (extending HelpSearchPalette, not yet replacing)

- [ ] Extend [HelpSearchPalette.svelte](../../../libs/help/src/ui/HelpSearchPalette.svelte) to render `GroupedResults`. Five columns: FAA Resources, Airboss Content, App Help, My Stuff, External Tools. Commands column reserved for Phase 4.
- [ ] Hoist banner row above columns when `bannerHit` is set; Enter activates it.
- [ ] Cluster rendering inside FAA Resources -- parent card + indented children with "+N more" if >3.
- [ ] FilterChips component above input -- one chip per parsed filter + one per applied synonym; X removes.
- [ ] Keep `[` / `]` bucket-jump bindings working across columns (rotate through non-empty columns).

### 2g. Query parser additions

- [ ] Add `doc` to `KNOWN_KEYS` in [query-parser.ts](../../../libs/help/src/query-parser.ts). Parse `doc:FAA-H-8083-28` and `doc:phak` (alias resolved against aviation registry).
- [ ] Add bare `mine` token recognition -- when present, scopes to `mine.*` types. (Implement as a synthetic filter `library:mine` so the chip story is consistent.)
- [ ] Update query-parser tests.

### 2h. Tests

- [ ] Extend [libs/aviation/src/__tests__/global-search-coverage.test.ts](../../../libs/aviation/src/__tests__/global-search-coverage.test.ts) so every "Build it for these queries" row from the design note asserts both result presence AND expected column.
- [ ] New `libs/help/src/loaders/*.test.ts` per loader.
- [ ] `libs/help/src/search.test.ts` -- update for the new `GroupedResults` shape: banner cases, cluster cases, synonym-rewrite cases.

### 2i. Walk the feature

- [ ] `apps/study/` -- Cmd+K, type each query from the design note's table, screenshot.
- [ ] `apps/sim/`, `apps/hangar/`, `apps/flightbag/` -- same walk, same queries.
- [ ] Manual test plan in PR description maps each design-note query to the expected outcome.

### 2j. Gate

- [ ] `bun run check branch` clean.
- [ ] `bun test` green across `libs/aviation`, `libs/help`, `libs/bc-study`.
- [ ] `/ball-review-full` -- fix every finding in same PR; re-run.

## Phase 3 -- visual variants + detail pane + doc-code autocomplete (SHIPPED PRs #857 + #921 + #925)

### 3a. Variant prototypes

- [ ] `apps/study/src/routes/(app)/dev/palette/wide/+page.svelte` -- Variant C (wide 4-column + right detail pane).
- [ ] `apps/study/src/routes/(app)/dev/palette/list/+page.svelte` -- Variant A (Linear-style sectioned list).
- [ ] `apps/study/src/routes/(app)/dev/palette/raycast/+page.svelte` -- Variant B (narrow column + always-on detail).
- [ ] All three share the underlying ranker + loaders; only render trees differ.
- [ ] Add an index page `apps/study/src/routes/(app)/dev/palette/+page.svelte` linking the three.

### 3b. New `CommandPalette.svelte`

- [ ] Build `libs/help/src/ui/CommandPalette.svelte` implementing Variant C as the production default.
- [ ] Migrate every `HelpSearchPalette` mount point to `CommandPalette`. Delete `HelpSearchPalette.svelte` -- no aliases, no shims.

### 3c. Detail pane

- [ ] `libs/help/src/ui/PaletteDetailPane.svelte` -- title, full citation, FTS snippet (when present), action buttons:
  - Open in flightbag (when `href` resolves to flightbag).
  - Open (default).
  - Search inside (sets `doc:<code>` filter chip and clears input).
  - Cite this (copies `airboss-ref:` URI to clipboard).
  - Pin to today (Phase 4-adjacent; behind `mine.plan` availability).
- [ ] Toggle visibility on `Cmd+\`. Below 900px (`--breakpoint-md`-ish), hide entirely.

### 3d. Doc-code autocomplete

- [ ] `libs/help/src/ui/DocCodeAutocomplete.svelte` -- vscode-style dropdown below the input.
- [ ] Trigger via `detectDocCodeIntent` from [libs/aviation/src/doc-code-detector.ts](../../../libs/aviation/src/doc-code-detector.ts).
- [ ] Up/Down moves through dropdown, Enter opens, Cmd+Enter sets `doc:` chip, Esc dismisses.
- [ ] Empty-doc-picker order: alphabetical (Decision #6).

### 3e. Theme + motion

- [ ] Add any missing accent tokens used by columns (amber / violet / cyan / green / rose) to [libs/themes/](../../../libs/themes/). Use existing scale tokens.
- [ ] Add 120ms / 80ms / 160ms motion classes per [design.md](design.md). Respect `prefers-reduced-motion`.

### 3f. Tests

- [ ] Playwright e2e at [tests/e2e/](../../../tests/e2e/) -- one spec, four queries (`weather`, `FAA-H-8083-28`, `91.103`, `wx`), assert hoist banner + columns + detail pane.
- [ ] Component test for `DocCodeAutocomplete.svelte` -- trigger, key handling, escape behavior.

### 3g. Walk + pick

- [ ] Walk all five surfaces; confirm `Cmd+K` and `/` both open. Detail pane collapses on narrow viewport.
- [ ] Joshua walks `dev/palette/{wide,list,raycast}` and picks production default. WP decision #5 updated.

### 3h. Gate

- [ ] `bun run check branch`, `bun test`, Playwright suite, `/ball-review-full` -> fix all.

## Phase 3.5 -- ranker + layout redesign (NEXT)

Triggered by Joshua's walk of Phase 3 on 2026-05-12. The Phase 3 layout (3-column FAA / Airboss / App Help) buries Airboss Content behind section-level pollution, the ranker treats book hits and section body matches as peers (so the Aviation Weather Handbook doesn't surface for `weather`), and the autocomplete is entangled with the result column. Phase 3.5 fixes all of that and lands BEFORE Phase 4 so commands build on the new shape.

Full mockups + ranker tables: [`design/mockups/search/`](../../../design/mockups/search/).

### 3.5a. Intent classifier

- [ ] `libs/help/src/intent-classifier.ts` (new). Pure function `classifyIntent(parsed: ParsedQuery, autocompleteCommitted: boolean): SearchIntent` returning `'scoped' | 'broad' | 'phrase-fts'`.
- [ ] Thresholds: `scoped` if `doc:` chip set; `phrase-fts` if quoted OR word count >= 4 OR no title-prefix match; `broad` otherwise.
- [ ] Sibling `.test.ts` covering each branch + edge cases.

### 3.5b. Ranker rewrite

- [ ] Replace `rankBucket` in [libs/help/src/search-core.ts](../../../libs/help/src/search-core.ts) with composite scorer: `type_tier_weight + title_match_tier + body_match_tier - depth_penalty`.
- [ ] Type-tier table per [`design/mockups/search/mockup-04-ranking.md`](../../../design/mockups/search/mockup-04-ranking.md). Constants in `libs/constants/src/`.
- [ ] Per-intent variations: I-1 filters by `doc:` chip; I-2 standard composite; I-3 inverts type-tier (section > book) + boosts body + rewards depth + adds `ts_rank_cd` lift.
- [ ] Ranker fixtures at `libs/help/src/__tests__/ranker-fixtures.json` -- one row per query in test-plan.md with the expected top-3 set.

### 3.5c. Top-hits strip

- [ ] `searchGrouped` returns `topHits: SearchResult[]` (3 rows, ranker-decided, mixed types) alongside per-group buckets.
- [ ] Hidden in I-3 phrase-FTS mode (user wants passages, not docs).

### 3.5d. Book-level collapse

- [ ] When a query matches a book AND its chapters in I-1 / I-2 modes, return ONE row for the book.
- [ ] Chapters / sections / paragraphs roll up as `result.children: SearchResult[]` on the parent row.
- [ ] Detail pane renders `result.children` as a clickable list under the parent's headline content.
- [ ] In I-3 mode, chapters/sections/paragraphs ARE the result (no collapse).

### 3.5e. Inline-prefix sub-groups

- [ ] When a group has <= 4 sub-groups that share a prefix (CFR: 14 CFR / 49 CFR), prefix the row inline (`14 CFR Part 91`, `49 CFR Part 175`) instead of creating a nested column.
- [ ] Lives in `libs/help/src/ui/PaletteRow.svelte` (new shared row template).

### 3.5f. Layout rewrite

- [ ] `libs/help/src/ui/CommandPalette.svelte` rewrites to top-hits strip + vertical type-nav (left, with counts) + result column (middle) + detail pane (right). See [mockup-02-new-layout.md](../../../design/mockups/search/mockup-02-new-layout.md).
- [ ] New `PaletteTypeNav.svelte` (vertical, click-to-filter, `App Help` hidden by default).
- [ ] New `PaletteTopHits.svelte` (3-row compact strip).
- [ ] New `PaletteRow.svelte` (shared template, always shows doc code + title for published types).
- [ ] Drop `PaletteColumn.svelte` (replaced by `PaletteTypeNav` + result column).
- [ ] Narrow viewport (< 900px): type-nav collapses to horizontal chip row; detail pane collapses entirely.

### 3.5g. Autocomplete extraction (R13)

- [ ] New lib `libs/autocomplete/` (or fold into `@ab/ui` -- decide based on whether `@ab/ui` already has dropdowns).
- [ ] `Autocomplete.svelte` -- generic dropdown component. Props: `value` (bindable), `sources: AutocompleteSource[]`, `onCommit`. Wraps any text input.
- [ ] `AutocompleteSource` interface: `match(input: string): readonly AutocompleteEntry[] | null`.
- [ ] Bundled sources: `DocCodeSource` (replaces `libs/aviation/src/doc-code-detector.ts` integration) and `TitlePrefixSource` (trie against aviation registry).
- [ ] Refactor `CommandPalette.svelte` to host `<Autocomplete sources={[DocCodeSource, TitlePrefixSource]} ... />` around its input. Modal never opens autocomplete itself; Tab commits, Enter (dropdown closed) runs the search.
- [ ] Delete `libs/help/src/ui/DocCodeAutocomplete.svelte` (logic moves to autocomplete sources).
- [ ] APG combobox semantics: `aria-controls`, `aria-expanded`, `aria-activedescendant` on input; `role="listbox"` on dropdown.
- [ ] Sibling tests for the component + each bundled source.

### 3.5h. Result-shape per intent

- [ ] I-1 scoped: render a doc-headline card + "References to this doc" panel (lessons / knowledge nodes / cards / cross-doc citations). New `PaletteScopedView.svelte`.
- [ ] I-2 broad: top-hits + type-nav + result column + detail pane (3.5f layout).
- [ ] I-3 phrase-FTS: passage cards with highlighted snippets. No top-hits; no type-nav. New `PalettePassageView.svelte`.

### 3.5i. Phrase-FTS loader

- [ ] `libs/help/src/loaders/fts-passages.ts` (new). Queries `study.referenceSection.body` + `study.knowledgeNode.contentMd` + `study.lesson.body` via Postgres `websearch_to_tsquery`.
- [ ] Returns `SearchResult`s with `snippet` populated via `ts_headline` for snippet highlighting.
- [ ] Server-side only; consumed via `/api/palette/search` endpoint already mounted in Phase 2.
- [ ] Sibling integration test seeding fixture rows in each of the three source tables.

### 3.5j. Label rename "FAA Resources" -> "Library" (R12)

- [ ] Update labels in [libs/help/src/schema/result-types.ts](../../../libs/help/src/schema/result-types.ts) `COLUMN_LABELS`. Type IDs stay stable.
- [ ] Grep app code for hardcoded "FAA Resources" strings; replace.

### 3.5k. Tests + manual walk

- [ ] Ranker fixtures cover the queries in [test-plan.md](test-plan.md) and the new I-3 cases (`"dusk vs sunset"`, `pilot rest before night flying`, etc.).
- [ ] Playwright e2e: confirm I-1 / I-2 / I-3 each render the correct shape for representative queries.
- [ ] Manual walk in a real browser (per Decision #16) across study, sim, hangar, flightbag. Every query in test-plan.md's Phase 3.5 table passes by eye + by ranker fixture.

### 3.5l. Gate

- [ ] `bun run check branch` clean.
- [ ] All tests green; ranker fixtures pass.
- [ ] `/ball-review-full` -- run end-to-end; fix every finding in same PR; re-run clean.
- [ ] **Browser load verified by Joshua in his real env** before merge -- not by agent self-report. Per Decision #16 and the 2026-05-12 incident.

## Phase 4 -- command surfaces (Cmd+Shift+P)

### 4a. Command registry

- [ ] `libs/help/src/commands/types.ts` + `registry.ts` per [design.md](design.md).
- [ ] Singleton instance exported as `paletteCommands`. Bootable from each app's `+layout.svelte`.
- [ ] Add `cmd.action` + `cmd.goto` to the search pipeline; commands rank like other results within their column.

### 4b. Per-app commands

- [ ] `apps/study/src/lib/palette/commands.ts` -- New plan, Go to today's reps, Memory inbox, Open dashboard.
- [ ] `apps/sim/src/lib/palette/commands.ts` -- Start new sim, Resume last sim, Pick scenario.
- [ ] `apps/hangar/src/lib/palette/commands.ts` -- New doc, Open audit log, Invite user.
- [ ] `apps/flightbag/src/lib/palette/commands.ts` -- Open FAA-H-8083-28, Open 14 CFR 91, AIM 7-1.
- [ ] Each app's `+layout.svelte` registers on mount, unregisters on destroy.

### 4c. Keybindings

- [ ] Add global handler at root `+layout.svelte` for each app: `Cmd+Shift+P` / `Ctrl+Shift+P` opens palette in `command` mode.
- [ ] Mode hint in the input placeholder ("Search palette", "Command palette").

### 4d. Per-app boost

- [ ] Host surface boost -- when `hostSurface === command.surface`, the command sorts before commands from other surfaces. Within a surface, alpha order.

### 4e. Tests

- [ ] Per-app test: open palette in command mode, confirm host commands top-of-list.

### 4f. Gate

- [ ] `bun run check branch`, `bun test`, Playwright suite, `/ball-review-full` -> fix all.

## Phase 5 -- Cmd+P quick-open + recents

### 5a. Recents tracker

- [ ] `libs/help/src/recents.ts` -- localStorage-backed; `record(result)`, `list()`, `clear()`. Cap at 50 entries.
- [ ] Decay: simple LRU + time-bucketed boost (entries from last 7 days outrank older ones).

### 5b. Quick-open mode

- [ ] Wire `Cmd+P` / `Ctrl+P` at each app root.
- [ ] Filter palette pipeline to `ELIGIBLE.quickopen` types.
- [ ] Empty input -> show recents; typed input -> filter recents first, then index, deduped.

### 5c. Tests

- [ ] Open palette in quickopen mode; assert recents render; typing filters; selecting records a recent.

### 5d. Gate

- [ ] `bun run check branch`, `bun test`, Playwright suite, `/ball-review-full` -> fix all.

## Cross-cutting (any phase)

- [ ] Out-of-scope extraction: when this WP signs off, extract `OUT-OF-SCOPE.md` per [docs/agents/wp-out-of-scope-extraction.md](../../agents/wp-out-of-scope-extraction.md).
- [ ] PR descriptions reference this WP; commits use conventional prefixes (`feat(palette)`, `fix(palette)`).
