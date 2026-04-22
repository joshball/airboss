---
title: 'Design: Help Library'
product: study
feature: help-library
type: design
status: unread
---

# Design: Help Library

## Library shape: shared primitives + per-app content

**Question:** Where does help content live -- shared library or per-app?

**Options considered:**

- **All in `libs/help/`.** Every app's content sits next to the library. Simple imports, but app boundaries leak (the study app's dashboard explainer lives in a library that ships to spatial, audio, avionics).
- **All in `apps/<app>/`.** No library. Every app reinvents schema, search, UI. Drift guaranteed.
- **Library holds primitives + registry; apps hold content, register at boot.** Architecture-doc-aligned. Apps compose the library; the library is content-agnostic.

**Chosen:** Library holds primitives + registry; apps register content at boot.

**Why:**

- Symmetric with `libs/aviation/` (decision #5 of the architecture doc locks the library name and symmetry).
- Per-app content stays in the app that owns it. When `apps/spatial/` lands, it writes its own `src/lib/help/content/` without touching study.
- Cross-library search has a clear story: one registry per library, search facade joins them at query time.
- The cost (registration ceremony at boot) is one-time setup in each app's root layout. Cheap.

## Registration flow

When `apps/study` starts:

```text
apps/study/src/routes/+layout.ts
         |
         v
imports apps/study/src/lib/help/register.ts
         |
         v
calls registerPages(studyHelpPages) from @ab/help
         |
         v
libs/help's in-memory registry now knows the seven study pages
         |
         v
HelpSearch can now return hits from both @ab/aviation and registered help
```

Registration runs once per server process (SvelteKit `+layout.ts` load functions are deduped per request, but module-init happens once -- `register.ts` uses top-level side-effect so it runs on module first-import). Re-registering the same page id replaces rather than appends; the registry is a `Map<id, HelpPage>` under the hood.

For a future app with its own help content, the same pattern: `apps/spatial/src/lib/help/register.ts` calls `registerPages(spatialHelpPages)`, and search immediately returns hits from spatial content without further wiring.

## Content authoring ergonomics

**Decision:** TypeScript data files with a markdown `body` field.

**Why:** The architecture doc recommends TS-with-markdown-body, and the ergonomics hold up. The TS wrapper lets validation gates run (required tag axes, id uniqueness, route-path-shape on `documents`). The markdown body is what the author actually writes for most sections -- no YAML front-matter parsing, no separate build step, no duplicate schema definitions.

Authoring example for `apps/study/src/lib/help/content/calibration.ts`:

```typescript
import type { HelpPage } from '@ab/help';

export const calibration: HelpPage = {
  id: 'calibration',
  title: 'Calibration',
  summary: 'How airboss measures the gap between your confidence and your accuracy, and what to do about it.',
  documents: '/calibration',
  tags: {
    appSurface: 'calibration',
    helpKind: 'concept',
  },
  sections: [
    {
      id: 'what-is-it',
      title: 'What calibration measures',
      body: `
A well-calibrated pilot's confidence matches their accuracy. When you
say you are 80% sure, you should be right 80% of the time. The
calibration score summarizes how closely that holds across all the
reviews airboss has seen from you.

The score is 0.0 to 1.0. Higher is better.
      `,
    },
    {
      id: 'reading-the-buckets',
      title: 'Reading the confidence buckets',
      body: `
Each bucket holds reviews where you picked the same confidence level.
An "overconfident" bucket means you said you were sure but got them
wrong more than the confidence level predicts. "Underconfident" means
the reverse: you hedged but you were right.

Overconfident is the dangerous one. See [[ADM::term-adm]] for why.
      `,
    },
    // ...
  ],
};
```

Markdown bodies pipe through `@ab/aviation`'s `ReferenceText.svelte`, so `[[ADM::term-adm]]` resolves to the aviation glossary at render time. Authors never hand-write anchor hrefs.

## Search algorithm

**Question:** How does cross-library search rank results?

Per decision #4 of the architecture doc: faceted, explicitly labeled, no hidden cross-library ranking. Within each category, rank by exact-match then alias-match then keyword-match. Between categories, group and label; do not interleave.

### Within-category ranking

For a query `q`:

1. **Exact** -- `entry.displayName.toLowerCase() === q.toLowerCase()` or `entry.aliases` includes `q`. Rank 1.
2. **Alias** -- `q` substring-matches `entry.displayName` or any alias, case-insensitive. Rank 2.
3. **Keyword** -- `q` substring-matches `entry.tags.keywords`, `entry.summary`, or any section body (for help pages). Rank 3.
4. Ties within a rank broken alphabetically by displayName.

No semantic search, no fuzzy edit-distance, no TF-IDF. Deterministic, auditable, fast enough for the dataset (175 + ~7 entries today, growing to ~400 + ~30 help pages over the year).

### Between-category behavior

Results return as `{ aviation: Result[], help: Result[] }`. The UI renders them in a fixed order (aviation first, help second) and lets the user collapse either group. Order is not ranking; it is layout. Users who want help-first can toggle the library filter.

## Query parser grammar

`libs/help/src/query-parser.ts` handles power-user queries.

```text
query       := term*
term        := facet | free-text | quoted-phrase
facet       := name ':' value
name        := 'tag' | 'rules' | 'source' | 'library' | 'kind' | 'surface'
value       := word+ (comma-separated allowed: tag:weather,ifr)
quoted-phrase := '"' word+ '"'
free-text   := word
```

Examples:

- `tag:weather rules:ifr` -- `aviationTopic: ['weather']` AND `flightRules: 'ifr'`
- `source:cfr "fuel reserves"` -- `sourceType: 'cfr'` AND free-text "fuel reserves"
- `library:help surface:calibration` -- help library, `appSurface: 'calibration'` only
- `metar` -- free-text only, no filters

Facet names are case-insensitive, whitespace-tolerant. Unknown facet names (`foo:bar`) parse as free-text `foo:bar` rather than erroring, so authors' typos do not produce empty result sets.

## Search widget placement

**Question:** Permanent top-nav input, or Cmd+K command palette?

**Chosen:** Both. Top-nav button (with visible label "Search") plus Cmd+K to open the same widget as a palette.

**Why:**

- The 2026-04-22 UX review has a pattern of discoverability problems: undocumented keyboard shortcuts, hidden affordances, inconsistent navigation. Shipping Cmd+K as the only entrypoint repeats that pattern.
- A visible top-nav button teaches the feature exists. Cmd+K is the power-user shortcut for users who learn it exists from the help page.
- Both paths open the same `HelpSearch` component. No code duplication -- the top-nav button is a one-line invocation.
- Input focus ring and the Escape-to-close contract are the same in both paths.

## Result render: labels, grouping, snippets

Each result card:

```text
+----------------------------------------------------+
| [aviation - cfr]                                   |
| 14 CFR 91.155                                      |
| VFR cloud clearance and visibility minimums...     |
| tags: weather, regulations, vfr                    |
+----------------------------------------------------+
```

- Library label leftmost, explicit (`aviation` or `help`), always shown.
- Source-type subtag follows (`cfr`, `aim`, `authored`, `concept`, `how-to`, etc.).
- Display name as the main heading.
- Snippet: for aviation, the first line of paraphrase; for help, the page's `summary`.
- Tag chips along the bottom for quick facet scanning.

Groups have a header (`Aviation (12)`, `Help (3)`) and are collapsible. Keyboard navigation moves focus within a group with arrow keys and jumps between groups with `[` / `]`.

## Route layout

`/help` index renders a grouped card list. Groups are by `appSurface`: Dashboard, Memory, Reps, Calibration, Knowledge, Session, Global. Each card shows title, summary, and a "opens at /memory" footer line derived from `documents`.

`/help/[slug]` renders through `HelpLayout`:

```text
+--------------------+----------------------------+
| Table of contents  | Page title                 |
|                    | One-line summary           |
| - Section A        +----------------------------+
| - Section B        | [first section, no heading]|
| - Section C        |                            |
|                    | ## Section B                |
| [Search: /]        | body...                    |
|                    |                            |
|                    | ## Section C                |
|                    | body...                    |
+--------------------+----------------------------+
```

TOC is sticky on desktop, collapses above the content on mobile. Search lives in the sidebar below the TOC so users can jump laterally without returning to the nav.

## Content coverage plan

Seven pages first, chosen because each closes a specific UX-review gap:

| Page                  | UX-review issues closed                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getting-started`     | Login dev-accounts noise / no signup path in prod; no first-time orientation                                                                             |
| `dashboard`           | h1 vs nav label mismatch; unexplained panels; deep-link filter chips                                                                                     |
| `memory-review`       | Review rating undo gap; confidence-prompt randomness; Again semantics                                                                                    |
| `reps-session`        | Undocumented keyboard shortcuts; Skip-permanently fat-finger risk; confidence-sampling predictability                                                    |
| `calibration`         | Calibration page has no explainer once filled; overconfident vs underconfident reading; what to do about a gap                                           |
| `knowledge-graph`     | 7-phase stepper without completion tracking narrative; dual-gate mastery; discovery-first pedagogy                                                        |
| `keyboard-shortcuts`  | Every undocumented shortcut in the app (Cmd+Enter on new card; review rating keys; session `/` `[` `]` Escape)                                            |

Pages are ordered roughly by how often a new user would hit them. `getting-started` first because it is the entry point a brand-new user needs. `keyboard-shortcuts` last because it is reference material, not first-read.

Later work packages add help pages for new surfaces as they land (spatial, audio, avionics). Each gets its own content folder in its app. The library does not change.

## Key decisions

### Registry is in-memory, not persisted

Help content is static: authored, committed, shipped. No user-authored help, no runtime mutation. An in-memory `Map<id, HelpPage>` is the whole store. Server restart re-populates from `register.ts`. No migration, no database, no cache invalidation story.

### Validation runs in `bun run check`, not on registration

Validation gates (required tags, unique ids, wiki-link resolution, `documents` path shape) run once at build time, not on every `registerPages` call. Runtime registration trusts the content because the build already validated it. Keeps the hot path cheap.

### Search widget is library-owned, not app-owned

`HelpSearch.svelte` is a primitive in `libs/help/`, not `apps/study/`. When spatial ships, it reuses the same widget with the same keyboard shortcuts, the same grouping, the same labels. Reinventing per-app was the alternative and would diverge within two apps.

### Help uses aviation; aviation does not use help

`@ab/help` depends on `@ab/aviation`. `@ab/aviation` never imports from `@ab/help`. This keeps aviation a leaf library (it can be consumed by any app, no help required) and puts the composition inside `@ab/help`. One-way dependency, no cycles.

### No cross-library implicit ranking, ever

Decision #4 forbids it. The alternative (semantic or TF-IDF ranking across both libraries) hides decisions the user cannot see. Faceting with explicit labels gives the user control. When a user wants help results first, they filter by library. When they want only aviation, same. The system never guesses.
