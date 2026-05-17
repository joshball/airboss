---
id: hangar-content-census
title: Hangar Content Census -- Design
product: hangar
category: feature
status: draft
created: 2026-05-17
owner: agent
legacy_fields:
  feature: hangar-content-census
  type: design
  review_status: pending
---

# Hangar Content Census -- Design

How the census is built. Read [spec.md](spec.md) first.

## Architecture: the corpus-adapter pattern

The 14 corpora are wildly heterogeneous -- markdown files with frontmatter, TOML
seeds, JSON registries, TypeScript modules, DB rows. A census needs ONE shape out of
all of them. The design is a **corpus adapter**: one module per corpus, all
implementing a common interface, all producing a common `CorpusCensus` shape.

```typescript
// libs/content-census/src/types.ts  (browser-safe types)

/** A single managed-content corpus, fully described for the dashboard. */
interface CorpusCensus {
  id: string;                       // 'knowledge-nodes', 'wx-catalog', ...
  label: string;                    // 'Knowledge nodes'
  whatItIs: string;                 // one-line plain-language description
  location: string;                 // the path/glob it lives at
  docs: DocLink[];                  // ADRs / plans / specs that govern it
  items: CensusItem[];              // the inventory
  metrics: CensusMetric[];          // derived + explained numbers
  gaps: CensusGap[];                // what's missing, explained
}

interface CensusItem {
  id: string;
  label: string;
  derivedState: string;             // 'complete' | 'skeleton' | corpus-specific
  intent?: ContentIntent;           // Layer 2, present once the corpus has it
  href?: string;                    // link to the item if it has a surface
}

/** Every metric carries its own explanation -- the explanatory-surface rule. */
interface CensusMetric {
  key: string;
  label: string;
  value: number | string;
  whatItMeasures: string;           // plain-language definition
  whyItMatters: string;             // the consequence
  whatToDo?: { text: string; href?: string };  // the action
}

interface CensusGap {
  title: string;
  whatItMeasures: string;
  whyItMatters: string;
  whatToDo: { text: string; href?: string };
  severity: 'structural' | 'thin' | 'nice-to-have';
}

interface ContentIntent {           // Layer 2 -- from frontmatter
  contentStatus: 'complete' | 'draft' | 'skeleton' | 'stub';
  planned: string[];
  wanted: string[];
  value: 'high' | 'standard' | 'low';
  notes?: string;
}
```

Each adapter is a function `() => CorpusCensus` (server-side -- it reads the
filesystem / DB). The dashboard's server load calls every registered adapter and
renders the results. Adding a corpus = writing one adapter + registering it. No
dashboard-code change.

### Why a lib, not app-local

`libs/content-census/` so the adapters are reusable: the `bun run track` CLI can
print the same census in the terminal, and a future scheduled job can watch for
drift. The lib has two entry points (mirroring `@ab/bc-study`): a browser-safe
runtime barrel (the `CorpusCensus` types + pure metric helpers) and a `/server`
barrel (the adapters, which touch `node:fs` and the DB).

## The explanation lives in the adapter, in code

The what/why/do triad is authored once, per metric, inside the adapter -- not in the
Svelte component. The component is a dumb renderer of `CensusMetric` / `CensusGap`.
This means:

- The explanation is testable (a unit test asserts every metric has a non-empty
  `whatItMeasures` + `whyItMatters`).
- A lint/test guard can FAIL the build if an adapter ships a metric with an empty
  explanation -- enforcing the explanatory-surface rule mechanically.
- The CLI census and the dashboard show identical explanations.

## Surfaces

### `/content` overview

`apps/hangar/src/routes/(app)/content/+page.server.ts` calls all adapters,
returns `CorpusCensus[]`. `+page.svelte` renders the row-per-corpus table with the
intro prose. Each row links to `/content/<corpus-id>`.

### `/content/[corpus]` drill-down

`apps/hangar/src/routes/(app)/content/[corpus]/+page.server.ts` calls the one
adapter for `[corpus]`, returns its `CorpusCensus`. `+page.svelte` renders
overview prose + inventory + gap view + intent view + next. One generic component
renders every corpus -- the heterogeneity is absorbed by the adapter, not the UI.

### Routes

`ROUTES.CONTENT_CENSUS` and `ROUTES.CONTENT_CENSUS_CORPUS(id)` in
`libs/constants/src/routes.ts`.

## Layer 1 derived-state rules (per corpus)

Each adapter defines its own derived-state rule. Initial rules:

| Corpus          | Derived states              | Rule                                                            |
| --------------- | --------------------------- | --------------------------------------------------------------- |
| Knowledge nodes | complete / draft / skeleton | skeleton = no Discover+Reveal body; draft = body but < N phases |
| Cards           | rich / thin / none          | per-node card count vs a threshold                              |
| wx catalog      | matched / unmatched         | example has a `scenario-matches.json` entry                     |
| wx scenarios    | contributing / dormant      | scenario appears in `scenario-matches.json` coverage map        |
| Regulations     | full / partial              | week has lessons + drills + orals all present                   |
| Handbooks       | ingested / partial          | sections-extracted vs chapters-expected                         |
| ACS             | current / stale             | publication_date vs known-latest                                |
| Sources         | linked / orphan             | manifest_path exists + cross-references resolve                 |
| Glossary        | defined / referenced-only   | term has a seed entry vs only node references                   |

Rules live in the adapter and are themselves explained (the `whatItMeasures` of the
state-distribution metric states the rule verbatim).

## Layer 2 -- content-intent frontmatter

Authored per the new ADR. The adapter reads the optional `intent` block from each
item's frontmatter (or, for non-markdown corpora like sim TS modules, from a
co-located `<corpus>.intent.yaml` -- decided per corpus in the ADR). Absent block =
`intent: undefined` = "no plan captured" in the UI.

## Phasing -- breadth first, then depth

Per the user's directive: vision-first, capture everything, breadth before depth,
placeholders for what's beyond reach.

- **Phase 1 -- Vision + reference drill-down.** The `libs/content-census/` lib +
  adapter interface. The wx-catalog adapter built FULLY (real inventory, real gap
  view with the what/why/do triad, real next-list). The `/content` overview and
  `/content/[corpus]` route shells. The content-intent ADR authored. `/content`
  lists all 14 corpora but only wx-catalog has a complete adapter; the other 13
  show a "stub adapter" -- name, count, "drill-down pending" placeholder. This is
  the breadth-visible, depth-on-one cut the spec's success criteria name.
- **Phase 2 -- Breadth pass.** A real Layer-1 derived-state adapter for all 13
  remaining corpora -- inventory + derived state + the explained metrics, but gap
  view and intent view may stay as honest placeholders ("Layer 2 not yet authored
  for this corpus"). After Phase 2 every corpus has a real census; no fakes.
- **Phase 3 -- Depth, per corpus.** One corpus at a time: author its content-intent
  frontmatter (Layer 2), build its real gap view and next-list. Knowledge nodes
  first (highest item count, highest value), then cards, then the rest. Each corpus
  is its own sub-phase, shippable independently.

Phase 1 is this WP's first PR and matches the user's "Plan + overview + one corpus
drill-down" scope. Phases 2-3 are tracked in [tasks.md](tasks.md).

## Placeholder honesty

A "stub adapter" in Phase 1 must be visibly, honestly a stub -- the UI says
"drill-down pending (Phase 2)" with a link to this WP. It must NOT show fabricated
counts or fake states. A placeholder that looks like real data is a spec violation.
The only fabrication allowed is the explicit, labelled "pending" state.

## Testing

- Unit: every adapter produces a schema-valid `CorpusCensus`; every `CensusMetric` /
  `CensusGap` has non-empty `whatItMeasures` + `whyItMatters` (the explanatory-rule
  guard).
- Unit: the wx-catalog adapter's derived counts match the known `catalog.json` /
  `scenario-matches.json` numbers.
- e2e: `/content` renders 14 rows; `/content/wx-catalog` renders inventory + gap
  view + the explanation text.
- Manual: a reader with no context can explain what each wx-catalog number means
  after reading the page (the explanatory-surface acceptance test).
