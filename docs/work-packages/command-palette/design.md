---
title: Command palette -- design + contracts
parent: spec.md
---

# Design

Companion to [spec.md](spec.md) and [tasks.md](tasks.md). Captures the file layout, the contracts each phase ships, and the cross-cutting concerns (keybindings, color tokens, accessibility).

## File layout

```text
libs/aviation/src/
  references/
    faa-docs.ts            (Phase 1)
    aim-docs.ts            (Phase 2 -- generated)
  external-tools.ts        (Phase 2)
  doc-code-detector.ts     (Phase 1)
  synonyms.ts              (Phase 1)

libs/help/src/
  commands/
    registry.ts            (Phase 4)
    types.ts               (Phase 4)
  recents.ts               (Phase 5)
  schema/
    result-types.ts        (Phase 2 -- the SearchResultType union)
  loaders/
    aviation-refs.ts       (Phase 2 -- wraps @ab/aviation registry)
    handbook-sections.ts   (Phase 2 -- study.reference_section kind=HANDBOOK)
    cfr-sections.ts        (Phase 2 -- study.reference_section kind=CFR)
    aim-sections.ts        (Phase 2 -- aim manifest + sections)
    knowledge-nodes.ts     (Phase 2 -- study.knowledge_node)
    glossary.ts            (Phase 2 -- aviation registry, non-FAA-doc rows)
    cards.ts               (Phase 2 -- study.card for current user)
    reps.ts                (Phase 2 -- study.review for current user)
    plans.ts               (Phase 2 -- study.study_plan for current user)
    courses.ts             (Phase 2 -- course/* directories)
    help-pages.ts          (Phase 2 -- wraps help registry, type-tagged)
  search-core.ts           (Phase 2 -- 3-bucket ranker, no change to existing helpers)
  search.ts                (Phase 2 -- typed multi-group facade)
  query-parser.ts          (Phase 2 -- adds `doc:`, `mine` parsing)
  ui/
    CommandPalette.svelte         (Phase 3 -- new, replaces HelpSearchPalette as default)
    DocCodeAutocomplete.svelte    (Phase 3 -- the vscode-style dropdown)
    PaletteColumn.svelte          (Phase 3 -- one column = one group cluster)
    PaletteDetailPane.svelte      (Phase 3 -- right pane)
    FilterChips.svelte            (Phase 2 -- chips above input)
    HelpSearchPalette.svelte      (Phase 2 -- extended to multi-column; replaced in Phase 3)

scripts/
  generate-faa-doc-registry.ts    (Phase 1; Phase 2 adds AIM scanner)

apps/{study,sim,hangar,flightbag}/src/
  lib/palette/
    commands.ts               (Phase 4 -- per-app command file)
  routes/
    +layout.svelte            (Phase 4 -- bind Cmd+P / Cmd+Shift+P globally)

apps/study/src/routes/(app)/dev/palette/
  wide/                       (Phase 3 -- Variant C prototype; kept as reference)
  list/                       (Phase 3 -- Variant A prototype; kept as reference)
  raycast/                    (Phase 3 -- Variant B prototype; kept as reference)

libs/autocomplete/             (Phase 3.5 -- generic input autocomplete; orthogonal to the modal)
  src/
    Autocomplete.svelte       (generic dropdown component)
    types.ts                  (AutocompleteSource interface, AutocompleteEntry)
    DocCodeSource.ts          (bundled source -- doc-code patterns)
    TitlePrefixSource.ts      (bundled source -- title-prefix trie)
    index.ts

libs/help/src/                (Phase 3.5 additions / replacements)
  intent-classifier.ts        (Phase 3.5 -- classifyIntent: scoped | broad | phrase-fts)
  loaders/
    fts-passages.ts           (Phase 3.5 -- Postgres FTS for I-3 phrase intent)
  ui/
    PaletteTypeNav.svelte     (Phase 3.5 -- vertical group nav with counts)
    PaletteTopHits.svelte     (Phase 3.5 -- 3-row compact strip)
    PaletteRow.svelte         (Phase 3.5 -- shared row template; always shows doc code)
    PaletteScopedView.svelte  (Phase 3.5 -- I-1 doc headline + references-to panel)
    PalettePassageView.svelte (Phase 3.5 -- I-3 passage cards with highlighted snippets)
    DocCodeAutocomplete.svelte  (DELETED Phase 3.5 -- logic moves to autocomplete sources)
    PaletteColumn.svelte        (DELETED Phase 3.5 -- superseded by PaletteTypeNav)
```

## Contracts

### `SearchResultType` (Phase 2)

```ts
export type SearchResultType =
  | 'faa.handbook' | 'faa.handbook.chapter'
  | 'faa.cfr.part' | 'faa.cfr.sect'
  | 'faa.aim'      | 'faa.ac'    | 'faa.acs'
  | 'airboss.course' | 'airboss.knode'
  | 'airboss.glossary' | 'airboss.lesson' | 'airboss.help'
  | 'mine.card' | 'mine.rep' | 'mine.plan' | 'mine.note'
  | 'web.tool' | 'cmd.action' | 'cmd.goto';

export type ResultColumn =
  | 'faa-resources' | 'airboss-content' | 'app-help'
  | 'my-stuff' | 'external-tools' | 'commands';

export const COLUMN_BY_TYPE: Record<SearchResultType, ResultColumn> = {
  // ... locked mapping from spec.md taxonomy table
};
```

### `SearchResult` (Phase 2)

```ts
export interface SearchResult {
  readonly id: string;                 // stable, dedup key
  readonly type: SearchResultType;
  readonly title: string;
  readonly subtitle?: string;          // "Chapter 12 / PHAK / FAA-H-8083-25C"
  readonly snippet?: string;           // body match (FTS) -- empty for tier 1/2
  readonly href: string;               // pre-resolved navigation target
  readonly rankBucket: 1 | 2 | 3 | 4 | 5;
  readonly parentDocCode?: string;     // for clustering chapters under a handbook
  readonly tier?: 'validated' | 'community'; // web.tool only
  readonly source?: 'recents' | 'index';     // Phase 5
}
```

### `GroupedResults` (Phase 2)

```ts
export interface GroupedResults {
  readonly bannerHit: SearchResult | null;  // single tier-1 match -> hoist banner
  readonly columns: Record<ResultColumn, readonly SearchResult[]>;
  readonly clusters: readonly DocCluster[]; // for FAA Resources clustering
  readonly synonymsApplied: readonly { from: string; to: string }[]; // chip rendering
  readonly filters: readonly ParsedFilter[]; // for chip rendering
  readonly totalCount: number;
}

export interface DocCluster {
  readonly parent: SearchResult;     // the handbook / CFR Part card
  readonly children: readonly SearchResult[]; // chapters / sections under it
}
```

### `PaletteCommand` (Phase 4)

```ts
export type PaletteCommandType = 'cmd.action' | 'cmd.goto';

export interface PaletteCommand {
  readonly id: string;
  readonly type: PaletteCommandType;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly surface: AppSurface;       // which app registered this command
  readonly handler: () => void | Promise<void>;
  readonly icon?: string;
}

export interface PaletteCommandRegistry {
  register(cmd: PaletteCommand): void;
  unregister(id: string): void;
  list(): readonly PaletteCommand[];
  search(query: ParsedQuery, hostSurface: AppSurface): readonly PaletteCommand[];
}
```

### `SearchIntent` (Phase 3.5)

```ts
export type SearchIntent = 'scoped' | 'broad' | 'phrase-fts';

export function classifyIntent(
  parsed: ParsedQuery,
  autocompleteCommitted: boolean,
): SearchIntent {
  // I-1 scoped: user Tab-committed an autocomplete entry which set the doc filter
  if (parsed.filters.some((f) => f.key === 'doc')) return 'scoped';

  // I-3 phrase-FTS: quoted, OR long, OR no title-prefix match
  if (parsedRawIsQuoted(parsed)) return 'phrase-fts';
  if (wordCount(parsed.freeText) >= 4) return 'phrase-fts';
  if (!hasAnyTitlePrefixMatch(parsed.freeText)) return 'phrase-fts';

  // I-2 broad: default
  return 'broad';
}
```

### `SearchResult` (Phase 3.5 extends Phase 2)

The Phase 2 `SearchResult` ships as a 5-bucket-rank shape. Phase 3.5 replaces `rankBucket` with a composite `score: number` and adds `children` for book-level collapse + `passageHighlight` for I-3:

```ts
export interface SearchResult {
  readonly id: string;
  readonly type: SearchResultType;
  readonly title: string;
  readonly docCode?: string;       // always shown on published types (R8/R14)
  readonly subtitle?: string;
  readonly snippet?: string;
  readonly href: string;
  readonly score: number;          // composite (Phase 3.5)
  readonly children?: readonly SearchResult[];  // chapters/sections under a book (Phase 3.5)
  readonly passageHighlight?: string;            // ts_headline output for I-3 (Phase 3.5)
  readonly parentDocCode?: string;
  readonly tier?: 'validated' | 'community';
  readonly source?: 'recents' | 'index';
  // rankBucket retained as a derived value during Phase 3.5 transition so existing
  // call sites don't break; removed after the redesign lands.
  readonly rankBucket?: 1 | 2 | 3 | 4 | 5;
}
```

### Ranker constants (Phase 3.5)

Live in `libs/help/src/search-core.ts` as exported `const` so they're tuneable from the ranker fixture file.

```ts
export const TYPE_TIER: Record<SearchResultType, number> = {
  'faa.handbook': 100,
  'faa.cfr.part': 90,
  'faa.ac': 90,
  'faa.aim': 85,
  'airboss.knode': 80,
  'airboss.course': 80,
  'airboss.glossary': 75,
  'faa.handbook.chapter': 50,
  'faa.cfr.sect': 50,
  'faa.aim.paragraph': 45,
  'mine.card': 40,
  'mine.rep': 40,
  'mine.plan': 40,
  'airboss.help': 20,
  'web.tool': 10,
  // commands (Phase 4)
  'cmd.action': 30,
  'cmd.goto': 30,
  // ...
} as const;

export function scoreResult(needle: string, r: SearchResult, intent: SearchIntent): number {
  // I-1 / I-2 composite per `design/mockups/search/mockup-04-ranking.md`
  // I-3 inverts type tier, boosts body, rewards depth, adds ts_rank_cd lift
  ...
}
```

### `AutocompleteSource` (Phase 3.5, lives in `@ab/autocomplete`)

```ts
export interface AutocompleteSource {
  readonly id: string;
  // Returns matching entries (capped) or null if this source doesn't apply
  // to the current input.
  match(input: string): readonly AutocompleteEntry[] | null;
}

export interface AutocompleteEntry {
  readonly id: string;
  readonly display: string;        // primary text (e.g. "Aviation Weather Handbook")
  readonly secondary?: string;     // secondary text (e.g. "FAA-H-8083-28")
  readonly canonicalForm: string;  // what replaces the input on commit
  readonly payload?: unknown;
}

export interface AutocompleteProps {
  value: string;                   // bindable
  sources: readonly AutocompleteSource[];
  onCommit: (entry: AutocompleteEntry) => void;
  placeholder?: string;
  ariaLabel?: string;
}
```

Bundled sources:

- `DocCodeSource` -- matches doc-code patterns from `libs/aviation/src/doc-code-detector.ts`.
- `TitlePrefixSource` -- trie-based title-prefix match (length >= 4) against `listReferences()` from `@ab/aviation`.

### Recents (Phase 5)

```ts
export interface RecentEntry {
  readonly resultId: string;
  readonly type: SearchResultType;
  readonly title: string;
  readonly href: string;
  readonly openedAt: number;          // epoch ms
  readonly hits: number;              // accumulated open count
}

const MAX_RECENTS = 50;
const STORAGE_KEY = 'palette.recents.v1';
```

## Keybindings

All three are bound globally at the root layout of each app. Mac uses Cmd, others use Ctrl.

### Modal bindings

| Binding                          | Action                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Cmd+K` / `Ctrl+K` / `/`         | Open palette modal in `search` mode (default)                                                       |
| `Cmd+P` / `Ctrl+P`               | Open palette modal in `quickopen` mode (Phase 5)                                                    |
| `Cmd+Shift+P` / `Ctrl+Shift+P`   | Open palette modal in `command` mode (Phase 4)                                                      |
| `Cmd+\`                          | Toggle detail pane visibility (when modal open)                                                     |
| `Cmd+Enter`                      | Open in new tab OR set `doc:` filter chip on selected result                                        |
| `Esc`                            | Close palette modal (autocomplete dropdown dismisses first if open)                                 |
| `↑` / `↓`                        | Move selection within result column (modal); within dropdown (autocomplete) -- whichever is focused |
| `Tab` / `Shift+Tab`              | Move focus across type nav / result column / detail pane                                            |
| `Enter` (modal, dropdown closed) | Activate selected result                                                                            |

### Autocomplete bindings (orthogonal to the modal; same component everywhere)

| Binding                       | Action                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Typing                        | Updates `value`; if any source returns matches, dropdown opens under input                                                      |
| `↑` / `↓`                     | Move highlight in dropdown                                                                                                      |
| `Tab`                         | Commit highlighted entry to input (replaces value with `canonicalForm`); dropdown closes; modal (if any) stays in current state |
| `Enter` (dropdown open)       | Same as Tab                                                                                                                     |
| `Enter` (dropdown closed)     | Hosted by the surface -- modal runs the search; inline search bar opens the modal pre-populated; etc.                           |
| `Esc`                         | Dismiss dropdown only; input value preserved; modal (if any) stays open                                                         |
| `Cmd+Enter` (dropdown open)   | Same as Tab, plus signals host to apply the entry as a filter chip (`doc:<code>`) and run a scoped search                       |
| Continued typing past trigger | Dismiss dropdown automatically                                                                                                  |

## Color tokens

All palette UI uses theme tokens, never hex. Per-type accent colors:

| Type prefix        | Accent token              |
| ------------------ | ------------------------- |
| `faa.*`            | `--accent-amber-*`        |
| `airboss.knode`    | `--accent-violet-*`       |
| `airboss.glossary` | `--accent-violet-*`       |
| `airboss.course`   | `--accent-cyan-*`         |
| `airboss.help`     | `--accent-cyan-*`         |
| `mine.*`           | `--accent-green-*`        |
| `web.tool`         | `--accent-rose-*`         |
| `cmd.*`            | `--ink-muted` (no accent) |

If a token doesn't yet exist in [libs/themes/](../../../libs/themes/), Phase 3 adds it as part of the visual variant work.

## Animation

- Palette open: 120ms ease-in fade (`--motion-duration-md`, `--motion-ease-in`).
- Row hover: 80ms ease (`--motion-duration-xs`).
- Detail pane slide: 160ms ease-out (`--motion-duration-md`, `--motion-ease-out`).
- Respect `prefers-reduced-motion: reduce` -- snap to final state.

## Accessibility

- `role="dialog"` `aria-modal="true"` on the palette container.
- `aria-label` on the input describing the mode ("Search palette", "Command palette", "Quick open").
- Each column is a `<section aria-labelledby>` with a visible heading.
- Selection conveyed via `aria-selected` + `aria-current` on the focused row.
- Doc-code autocomplete uses `aria-controls` + `aria-expanded` on the input, `role="listbox"` on the dropdown, `role="option"` on each entry, per APG combobox pattern.
- Focus trap inside the palette; restore previous focus on close.

## Open items (resolve before phase end)

| Item                                                                                                                  | Decide in                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `airboss.lesson` real loader vs stub                                                                                  | Phase 2 -- stubbed; revisit when lesson pages exist                       |
| Detail-pane "Cite this" -- copy `airboss-ref:` URI vs citation picker                                                 | Phase 3 -- shipped as clipboard copy                                      |
| Per-app command boost weight                                                                                          | Phase 4                                                                   |
| Recents decay -- LRU pop vs time-based                                                                                | Phase 5                                                                   |
| Ranker constants -- tune the type-tier and bonus values via the fixture file once Phase 3.5 lands                     | Phase 3.5 walk                                                            |
| `@ab/autocomplete` lib vs fold into `@ab/ui` -- decide based on whether `@ab/ui` already has a dropdown primitive     | Phase 3.5 start                                                           |
| Phrase-FTS index strategy -- Postgres `tsvector` columns vs `websearch_to_tsquery` on raw text vs pgvector embeddings | Phase 3.5 -- start with `websearch_to_tsquery`; revisit if recall is poor |
| Intent classifier word-count threshold (4 vs 5 words) for I-3 boundary                                                | Phase 3.5 walk -- tune via fixtures                                       |
