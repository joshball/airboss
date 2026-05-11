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
  wide/                       (Phase 3 -- Variant C prototype)
  list/                       (Phase 3 -- Variant A prototype)
  raycast/                    (Phase 3 -- Variant B prototype)
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

| Binding                        | Action                                         |
| ------------------------------ | ---------------------------------------------- |
| `Cmd+K` / `Ctrl+K` / `/`       | Open palette in `search` mode (default)        |
| `Cmd+P` / `Ctrl+P`             | Open palette in `quickopen` mode               |
| `Cmd+Shift+P` / `Ctrl+Shift+P` | Open palette in `command` mode                 |
| `Cmd+\`                        | Toggle detail pane visibility (when open)      |
| `Cmd+Enter`                    | Open in new tab OR set `doc:` filter chip      |
| `Esc`                          | Close palette (or dismiss doc-picker dropdown) |
| `↑` / `↓`                      | Move selection within column                   |
| `Tab` / `Shift+Tab`            | Move selection across columns                  |
| `[` / `]`                      | (Phase 2 back-compat) bucket jump              |

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

| Item                                                                                   | Decide in   |
| -------------------------------------------------------------------------------------- | ----------- |
| Should `airboss.lesson` ship a real loader in Phase 2 or stub until lesson pages land? | Phase 2 mid |
| Detail-pane "Cite this" action -- copy `airboss-ref:` URI or open citation picker?     | Phase 3     |
| Per-app command boost weight -- exact multiplier vs section-first ordering?            | Phase 4     |
| Recents decay -- LRU pop after N, or time-based decay function?                        | Phase 5     |
