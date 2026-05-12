---
title: Command palette -- test plan
parent: spec.md
---

# Test plan

Phase exits only when **every box in the relevant section is checked**, both automated and manual.

## Phase 2 -- automated (SHIPPED, PR #831)

| File                                                         | Asserts                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `libs/aviation/src/__tests__/global-search-coverage.test.ts` | Every "Build it for these queries" row returns expected type + column      |
| `libs/help/src/search.test.ts`                               | `GroupedResults` shape -- banner / clusters / synonymsApplied / filters    |
| `libs/help/src/loaders/aviation-refs.test.ts`                | Splits handbook root vs chapter; maps to correct `SearchResultType`        |
| `libs/help/src/loaders/handbook-sections.test.ts`            | DB-backed loader matches title / code / body; respects user-scoped filters |
| `libs/help/src/loaders/cfr-sections.test.ts`                 | `91.103` -> single `faa.cfr.sect` result; `Part 91` -> `faa.cfr.part`      |
| `libs/help/src/loaders/aim-sections.test.ts`                 | `AIM 7-1` -> AIM chapter 7 section 1 result                                |
| `libs/help/src/loaders/knowledge-nodes.test.ts`              | Matches `name` + `aliases`; respects lifecycle filter                      |
| `libs/help/src/loaders/cards.test.ts`                        | Empty when unauthenticated; matches owner-scoped cards otherwise           |
| `libs/help/src/loaders/external-tools.test.ts`               | Validated + community tier; `kind:web.validated` filter narrows correctly  |
| `libs/help/src/query-parser.test.ts`                         | `doc:`, `mine` token, alias resolution                                     |

## Phase 2 -- manual walk

Walk each surface in a real browser, devtools open. Screenshot per query.

| Surface   | Query                    | Expected                                                           |
| --------- | ------------------------ | ------------------------------------------------------------------ |
| study     | `FAA-H-8083-28`          | Banner hoist to AvWX handbook; Enter opens                         |
| study     | `8083-28`                | Same                                                               |
| study     | `H-8083-28`              | Same                                                               |
| study     | `AvWX`                   | Same                                                               |
| study     | `Aviation Weather`       | AvWX + AC 00-6 + PHAK Ch.12 + weather course + wx KB nodes         |
| study     | `wx`                     | Same set + chip "wx == weather"                                    |
| study     | `weather`                | Same set                                                           |
| study     | `91.103`                 | 14 CFR 91.103 section in FAA Resources                             |
| study     | `Part 91`                | 14 CFR Part 91 banner                                              |
| study     | `Va`                     | Va glossary entry in Airboss Content                               |
| study     | `density altitude`       | Glossary + handbook sections + KB nodes citing it                  |
| study     | `METAR`                  | Glossary + AvWX chapters + cards that ask about it                 |
| study     | `doc:FAA-H-8083-28 turb` | Only turbulence sections inside AvWX                               |
| study     | `kind:cfr 91.103`        | Only the CFR section, no handbook discussion                       |
| sim       | (same battery)           | Equivalent results; sim help / scenarios appear in App Help column |
| hangar    | (same battery)           | Equivalent; hangar help in App Help column                         |
| flightbag | (same battery)           | Equivalent; flightbag-rendered links resolve                       |

Also:

- Hoist banner appears only for true tier-1 single match.
- Cluster expansion under FAA Resources shows "+N more" when >3 children.
- Filter chips appear and are removable.
- Empty palette + closed via Escape preserves prior page focus.
- 5-line viewport: columns stack vertically.

## Phase 3 -- automated (SHIPPED, PRs #857 + #921 + #925)

| File                                           | Asserts                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `tests/e2e/command-palette.spec.ts`            | Four-query suite: `weather`, `FAA-H-8083-28`, `91.103`, `wx`   |
| `libs/help/src/ui/DocCodeAutocomplete.test.ts` | Trigger detection, key handling, Esc, Cmd+Enter chip           |
| `libs/help/src/ui/CommandPalette.test.ts`      | Mode prop selects eligible types; detail pane toggles on Cmd+\ |

## Phase 3 -- manual walk

- Variant A/B/C all load at `/dev/palette/{wide,list,raycast}` in study.
- Production mount uses Variant C (or whatever Joshua picks); detail pane on right.
- `Cmd+\` toggles detail pane; below ~900px detail pane hides.
- Doc-code dropdown fires on `FAA-H-8`, `AC 00`, `Part 91`, `14 CFR`, `§91`, `AvWX`.
- Animations smooth at 120ms / 80ms / 160ms; `prefers-reduced-motion` honored.
- Theme switch (light / dark / high-contrast) -- all column accents legible.

## Phase 3.5 -- automated

| File                                              | Asserts                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `libs/help/src/intent-classifier.test.ts`         | `classifyIntent` returns `scoped` / `broad` / `phrase-fts` per the threshold table; quoted forces I-3; doc filter forces I-1 |
| `libs/help/src/search-core.test.ts`               | `scoreResult` composite: type tier + title bonus + body bonus - depth penalty; per-intent variations                         |
| `libs/help/src/search.test.ts`                    | `searchGrouped` returns `topHits` (3 rows), bucketed `groups`, intent-shaped panel data; book-level collapse                 |
| `libs/help/src/loaders/fts-passages.test.ts`      | DB-backed FTS loader; `websearch_to_tsquery` + `ts_headline` snippet highlighting; intersects three source tables            |
| `libs/help/src/__tests__/ranker-fixtures.json`    | Every query in the manual walk table has an expected top-3 set; runner asserts each fixture                                  |
| `libs/autocomplete/src/Autocomplete.test.ts`      | Dropdown opens on source match; Tab commits; Esc dismisses; APG combobox semantics                                           |
| `libs/autocomplete/src/DocCodeSource.test.ts`     | Each doc-code pattern fires; bidirectional code <-> title                                                                    |
| `libs/autocomplete/src/TitlePrefixSource.test.ts` | Title-prefix >= 4 chars fires; synonym tokens (`wx`, 2 chars) do not                                                         |
| `libs/help/src/ui/CommandPalette.test.ts`         | Hosts `<Autocomplete>`; Tab commit does NOT run search; Enter (dropdown closed) DOES run search                              |

## Phase 3.5 -- manual walk

Per Decision #16, dispatched in a real browser on the parent repo with `.env` loaded. Not a worktree, not a Playwright probe alone.

### Intent I-2 (broad search) -- ranker correctness

| Query              | Expect (top hit -- must be in top 3)                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `weather`          | Aviation Weather Handbook (FAA-H-8083-28) in top 3; book card collapsed (NO chapter rows in column) |
| `Aviation Weather` | Same -- AvWX top of Top Hits                                                                        |
| `wx`               | Same set; chip `wx -> weather` visible                                                              |
| `FAA-H-8083-28`    | AvWX top hit; ONE row in Library group; chapters in detail pane                                     |
| `8083-28`          | Same                                                                                                |
| `91.103`           | 14 CFR §91.103 top hit (not Part 91)                                                                |
| `Part 91`          | 14 CFR Part 91 row, inline-prefixed as `14 CFR Part 91`                                             |
| `Va`               | Va glossary in Airboss Content                                                                      |
| `density altitude` | Glossary + handbook chapters + KB nodes -- composite ranker should put glossary or KB node top      |
| `METAR`            | Glossary + AvWX + AIM chapter; chapters NOT separate rows under AvWX                                |

### Intent I-1 (scoped search via autocomplete commit)

| Action                                                                         | Expect                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Type `FAA-H-808`, Tab on highlighted `FAA-H-8083-28 Aviation Weather Handbook` | Input becomes `FAA-H-8083-28`; modal stays in current state; pressing Enter runs scoped search        |
| Type `Aviation Weath`, Tab on dropdown row                                     | Input becomes `Aviation Weather Handbook`; pressing Enter runs scoped search                          |
| Run scoped search                                                              | Doc headline card + "References to this doc" panel (lessons / KB nodes / cards / cross-doc citations) |
| Cmd+Enter on dropdown                                                          | Sets `doc:FAA-H-8083-28` chip; clears input; runs scoped search immediately                           |

### Intent I-3 (phrase-FTS)

| Query                                       | Expect                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `"dusk vs sunset"` (quoted)                 | Passage cards with hit-words highlighted; sections like 14 CFR §1.1 (defines "night"), AIM 4-3 etc. |
| `something about pilot rest before night`   | Same shape (word count >= 4 forces I-3)                                                             |
| `regs say something about cruise altitudes` | I-3; passage cards from CFR sections                                                                |
| `VFR minimums in class B`                   | I-3; passages from 14 CFR §91.155, AIM 3-2 etc.                                                     |

### Layout + interaction

- [ ] Left type-nav: counts per group; click filters to that group; greyed buckets with 0 hits still visible
- [ ] App Help bucket hidden by default; surfaces only when filtered
- [ ] `Library` label (NOT `FAA Resources`) on the group
- [ ] Top Hits strip: 3 rows, mixed types; hidden in I-3 mode
- [ ] Inline-prefix: `14 CFR Part 91`, `49 CFR Part 175` -- same column, no nested CFR Title nav
- [ ] Book-level collapse: NO query returns a book + its chapters as separate column rows; chapters live in the detail pane
- [ ] Doc IDs prominent on every Library row
- [ ] Autocomplete dropdown is a separate overlay below the input -- NOT inside the column display
- [ ] Tab from dropdown does NOT run the search; only Enter (with dropdown closed) runs the search
- [ ] Detail pane: `Cmd+\` toggles; < 900px hides; clickable sub-results (chapters/sections) for collapsed-book rows
- [ ] All 4 apps (study, sim, hangar, flightbag) -- same palette behavior

### Browser verification (per Decision #16)

- [ ] `bun scripts/dev.ts study` in parent repo, env loaded
- [ ] Devtools console clean on the affected pages (no `node:fs externalized`, no `Buffer is not defined`, no new pageerrors)
- [ ] [tests/e2e/browser-hydration-smoke.spec.ts](../../../tests/e2e/browser-hydration-smoke.spec.ts) passes on the canonical surfaces

## Phase 4 -- automated

| File                                          | Asserts                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `libs/help/src/commands/registry.test.ts`     | Register / unregister / search; host-surface boost ordering    |
| `apps/study/src/lib/palette/commands.test.ts` | Study commands present; handler invocations recorded           |
| (same for `sim`, `hangar`, `flightbag`)       | Each app's commands appear top when launched from that surface |

## Phase 4 -- manual walk

- Cmd+Shift+P in study lists "New plan" first.
- Cmd+Shift+P in sim lists "Start new sim" first; study commands still visible, lower.
- Cmd+Shift+P in hangar / flightbag similar.
- Mode hint in input placeholder reflects "Command palette".

## Phase 5 -- automated

| File                                       | Asserts                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `libs/help/src/recents.test.ts`            | Record / list / clear; cap at 50; LRU decay; date bucketing |
| `libs/help/src/search.test.ts` (quickopen) | Mode filters eligible types; empty input returns recents    |

## Phase 5 -- manual walk

- Cmd+P empty -> recents render with their type accents.
- Open a few results; reopen Cmd+P; same results at top.
- Cmd+P with typed text filters across recents + index.
- Clear recents via dev panel (or page reload + localStorage clear); empty state shows hint.

## Cross-phase regression checks

Every phase re-runs:

- `bun run check branch` clean.
- `bun test` green in `libs/aviation`, `libs/help`, `libs/bc-study`, every touched app.
- No new console errors on palette open across all surfaces.
- No new accessibility violations from axe-core on the open palette.

## Out-of-scope, defer triggers

| Item                                      | Trigger to revisit                     |
| ----------------------------------------- | -------------------------------------- |
| Server-side FTS                           | If any in-memory rank exceeds 50ms p95 |
| `mine.note` (reflection journal)          | When reflection surface ships          |
| Recents-weighted doc-picker order         | When telemetry exists                  |
| Voice / NL queries                        | Not soon                               |
| Search-inside-an-app-tour ("how do I X?") | After help corpus growth justifies     |
