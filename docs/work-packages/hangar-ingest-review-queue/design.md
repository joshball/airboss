---
title: 'Design: Hangar Ingest-Review Queue'
product: hangar
feature: hangar-ingest-review-queue
type: design
status: unread
review_status: pending
---

# Design: Hangar Ingest-Review Queue

The decisions and shapes the build phase will reach for. The [spec](./spec.md) covers WHY and WHAT; this doc covers HOW.

## Module map

```text
libs/bc/ingest-review/
  src/
    schema.ts           Drizzle tables (hangar.ingest_issue, hangar.ingest_override)
    types.ts            IssueRecord, OverrideRecord, Candidate, plugin types
    queries.ts          server-only DB helpers (upsert, listIssues, applyOverride)
    plugin.ts           registry + types
    producer.ts         runProducers helper (server-only)
    plugins/
      index.ts          registers all plugins
      handbook-shared.ts          warnings.json + manifest.json reader (server-only)
      handbook-caption-orphan.ts  caption-orphan plugin
      handbook-image-orphan.ts    image-orphan plugin
    index.ts            BROWSER-SAFE runtime barrel: types, Drizzle table objects,
                        type-only re-exports of every server module
    server.ts           SERVER-ONLY barrel: queries, producer, plugin registry,
                        every value that touches @ab/db/connection

apps/hangar/src/routes/(app)/ingest-review/
  +layout.server.ts
  +layout.svelte
  +page.server.ts
  +page.svelte
  [issueId]/
    +page.server.ts
    +page.svelte

apps/hangar/src/lib/ingest-review/
  OrphanCard.svelte
  CandidateStrip.svelte
  ActionBar.svelte
  pdf-link.ts

scripts/ingest-review/
  run-producers.ts
  import-overrides.ts
  export-overrides.ts
  yaml-sidecar.ts        shared YAML helpers
  yaml-sidecar.test.ts

tools/handbook-ingest/ingest/
  overrides_loader.py    reads ifh-overrides.yaml and applies overrides during extract
  figures.py             (edit) calls overrides_loader as a final pairing tier
```

## Why a new BC instead of extending `libs/bc/hangar/`

Considered: putting `ingest_issue` + `ingest_override` next to `hangar.review_item` in `libs/bc/hangar/src/schema.ts`.

Rejected because:

- `bc/hangar/` is the runtime mirror of the TOML content registry (`reference`, `source`, `sync_log`). Its scope is "hangar's own canonical edit surface."
- The ingest-review queue serves multiple corpora (handbook today, regs / knowledge tomorrow). Coupling it to the hangar BC would mean every future corpus has to grow `bc/hangar` to accept its plugin.
- The runtime barrel for `bc/hangar` is already large and load-bearing for the hangar app. Adding plugin-registry side effects + producer pipeline pulls in ingest infra the rest of the hangar BC has no need for.

A separate `libs/bc/ingest-review/` keeps the contract narrow, lets non-hangar surfaces consume it later (a study-side data-quality alert that uses the same plugin pattern, for example), and isolates the plugin-registration side effects.

The Postgres tables stay in the `hangar` namespace (`SCHEMAS.HANGAR`) because they are operationally hangar's responsibility -- the audience is the hangar AUTHOR / OPERATOR roles -- and crossing to a fresh schema namespace is overkill for two tables.

## DB schema (Drizzle)

Full table definitions land in `libs/bc/ingest-review/src/schema.ts`. Sketch:

```ts
import { hangarSchema } from '@ab/bc-hangar/schema';
import { bauthUser } from '@ab/auth/schema';
import { timestamps } from '@ab/db';
import {
  CORPUS_VALUES,
  INGEST_ISSUE_KIND_VALUES,
  INGEST_OVERRIDE_ACTION_VALUES,
  INGEST_STATUS_VALUES,
  inList,
} from '@ab/constants';
import { check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const ingestIssue = hangarSchema.table(
  'ingest_issue',
  {
    id: text('id').primaryKey(),
    corpus: text('corpus').notNull(),
    sourceId: text('source_id').notNull(),
    edition: text('edition'),
    pageNum: integer('page_num'),
    kind: text('kind').notNull(),
    externalId: text('external_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('unresolved'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => ({
    uqKindExternal: uniqueIndex('ingest_issue_kind_external_id_uq').on(table.kind, table.externalId),
    ixCorpusSource: index('ingest_issue_corpus_source_ix').on(table.corpus, table.sourceId),
    ixStatus: index('ingest_issue_status_ix').on(table.status),
    chkCorpus: check('ingest_issue_corpus_chk', inList(table.corpus, CORPUS_VALUES)),
    chkKind: check('ingest_issue_kind_chk', inList(table.kind, INGEST_ISSUE_KIND_VALUES)),
    chkStatus: check('ingest_issue_status_chk', inList(table.status, INGEST_STATUS_VALUES)),
  }),
);

export const ingestOverride = hangarSchema.table(
  'ingest_override',
  {
    id: text('id').primaryKey(),
    issueId: text('issue_id')
      .notNull()
      .references(() => ingestIssue.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    payload: jsonb('payload').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => bauthUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqIssue: uniqueIndex('ingest_override_issue_id_uq').on(table.issueId),
    chkAction: check('ingest_override_action_chk', inList(table.action, INGEST_OVERRIDE_ACTION_VALUES)),
  }),
);
```

Indexes are mandatory from day one. Even at 21 live rows the queue page will filter on `(corpus, source_id, status)`; the indexes prevent a scan from showing up the first time a future plugin pushes the table to thousands of rows.

## Constants

New file `libs/constants/src/ingest-review.ts`:

```ts
export const CORPUS_VALUES = ['handbook', 'regs', 'knowledge'] as const;
export type Corpus = (typeof CORPUS_VALUES)[number];

export const INGEST_ISSUE_KIND_VALUES = [
  'handbook.caption-orphan',
  'handbook.image-orphan',
] as const;
export type IngestIssueKind = (typeof INGEST_ISSUE_KIND_VALUES)[number];

export const INGEST_OVERRIDE_ACTION_VALUES = [
  // caption-orphan actions
  'pair',
  'mark-no-figure',
  'mark-false-caption',
  // image-orphan actions
  'mark-extraneous',
  'mark-decorative',
] as const;
export type IngestOverrideAction = (typeof INGEST_OVERRIDE_ACTION_VALUES)[number];

export const INGEST_STATUS_VALUES = ['unresolved', 'resolved', 'stale', 'dismissed'] as const;
export type IngestStatus = (typeof INGEST_STATUS_VALUES)[number];

export const INGEST_REVIEW = {
  KINDS: {
    HANDBOOK_CAPTION_ORPHAN: 'handbook.caption-orphan',
    HANDBOOK_IMAGE_ORPHAN: 'handbook.image-orphan',
  },
  ACTIONS: {
    PAIR: 'pair',
    MARK_NO_FIGURE: 'mark-no-figure',
    MARK_FALSE_CAPTION: 'mark-false-caption',
    MARK_EXTRANEOUS: 'mark-extraneous',
    MARK_DECORATIVE: 'mark-decorative',
  },
  STATUS: {
    UNRESOLVED: 'unresolved',
    RESOLVED: 'resolved',
    STALE: 'stale',
    DISMISSED: 'dismissed',
  },
  CORPUSES: {
    HANDBOOK: 'handbook',
    REGS: 'regs',
    KNOWLEDGE: 'knowledge',
  },
} as const;
```

`pair` shows up in both the caption-orphan and image-orphan action sets but means the inverse direction. The plugin's `applyAction` typechecks the payload against its kind, so a `pair` payload bound to a caption-orphan issue carries `{ image_page, image_xref }`; the same action on an image-orphan issue carries `{ caption_external_id, caption_page }`.

## Plugin interface

Living in `libs/bc/ingest-review/src/types.ts` and `plugin.ts`:

```ts
export interface IssueRecord<P = unknown> {
  id: string;
  corpus: Corpus;
  sourceId: string;
  edition: string | null;
  pageNum: number | null;
  kind: IngestIssueKind;
  externalId: string;
  payload: P;
  status: IngestStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface OverrideRecord<A = unknown> {
  id: string;
  issueId: string;
  action: IngestOverrideAction;
  payload: A;
  createdByUserId: string;
  createdAt: Date;
}

export interface Candidate {
  id: string;            // stable; from the plugin's view of the manifest
  pageNum: number;
  thumbnailUrl: string;  // resolved against in-tree /figures/ path or /api/<...>
  width: number;
  height: number;
  label: string;         // human-readable summary
  payload: unknown;      // plugin-defined; round-trips into applyAction
}

export interface YamlSidecarEntry {
  external_id: string;
  action: IngestOverrideAction;
  payload: Record<string, unknown>;
}

export interface IngestIssuePlugin<P = unknown, A = unknown> {
  kind: IngestIssueKind;
  produceIssues(ctx: ProducerContext): AsyncIterable<IssueInput<P>>;
  findCandidates(issue: IssueRecord<P>, ctx: CandidateContext): Promise<Candidate[]>;
  applyAction(issue: IssueRecord<P>, action: ActionInput<A>, ctx: ActionContext): Promise<void>;
  serializeForYaml(issue: IssueRecord<P>, override: OverrideRecord<A>): YamlSidecarEntry;
}
```

`ProducerContext`, `CandidateContext`, `ActionContext` carry the shared deps each plugin needs (DB, filesystem reader, audit logger). They are constructed in the server barrel and passed in; plugin code never imports the DB connection itself.

## YAML sidecar shape

One sidecar per handbook source, at `scripts/sources/config/handbooks/<slug>-overrides.yaml`. Stable byte-identical output across runs (sorted keys, two-space indent, single trailing newline).

```yaml
# Manual ingest overrides for IFH (FAA-H-8083-15B).
#
# Authored via the hangar /ingest-review queue and exported with
# `bun scripts/ingest-review/export-overrides.ts --corpus handbook --source ifh`.
# Read by tools/handbook-ingest/ingest/figures.py during re-extraction.
overrides:
  - external_id: b8fa45834d84872b
    kind: handbook.caption-orphan
    action: pair
    payload:
      image_page: 82
      image_xref: 1234
  - external_id: 6cbeaa346a6108b9
    kind: handbook.caption-orphan
    action: mark-no-figure
    payload: {}
  - external_id: 9ab1f04d7e2c8350
    kind: handbook.image-orphan
    action: pair
    payload:
      caption_external_id: 4f7a2b8c91d4e612
      caption_page: 168
```

The `kind` field is redundant with the queue's view (`external_id` is unique within a kind already), but its presence in the YAML lets the figure-pairing pipeline route to the right override applier without an out-of-band lookup table.

## Hangar route layout

```text
/ingest-review                       (queue: filterable list of issues)
  ?corpus=handbook
  ?source=ifh
  ?status=unresolved
  ?kind=handbook.caption-orphan

/ingest-review/<issueId>             (detail: orphan card + actions)
  ?/pair                             (form action -> plugin.applyAction)
  ?/markNoFigure                     (form action)
  ?/markFalseCaption                 (form action)
  ?/markExtraneous                   (form action)
  ?/markDecorative                   (form action)
  ?/dismiss                          (status -> dismissed)
  ?/reopen                           (status -> unresolved; clears override)
```

Routes added to `libs/constants/src/routes.ts`:

```ts
HANGAR_INGEST_REVIEW: '/ingest-review',
HANGAR_INGEST_REVIEW_ISSUE: (issueId: string) =>
  `/ingest-review/${encodeURIComponent(issueId)}` as const,
HANGAR_INGEST_REVIEW_PAIR_ACTION: '?/pair',
HANGAR_INGEST_REVIEW_MARK_NO_FIGURE_ACTION: '?/markNoFigure',
HANGAR_INGEST_REVIEW_MARK_FALSE_CAPTION_ACTION: '?/markFalseCaption',
HANGAR_INGEST_REVIEW_MARK_EXTRANEOUS_ACTION: '?/markExtraneous',
HANGAR_INGEST_REVIEW_MARK_DECORATIVE_ACTION: '?/markDecorative',
HANGAR_INGEST_REVIEW_DISMISS_ACTION: '?/dismiss',
HANGAR_INGEST_REVIEW_REOPEN_ACTION: '?/reopen',
```

## Orphan-card layout (ASCII)

```text
+------------------------------------------------------------------------------+
| /ingest-review/issue_01HPABZ...                       handbook.caption-orphan |
+------------------------------------------------------------------------------+
| Source:   IFH (FAA-H-8083-15B)            Page: 83          Status: unresolved|
+------------------------------------------------------------------------------+
| CAPTION                                                                      |
|                                                                              |
|   "Figure 4-7. Koch chart sample."                                           |
|                                                                              |
|   from warnings.json id b8fa45834d84872b                                     |
|   detected mode: image-extracted-elsewhere                                   |
+------------------------------------------------------------------------------+
| CANDIDATES (page 81-85, 4 unpaired images)                                   |
|                                                                              |
|  [thumb 81] [thumb 82*] [thumb 84] [thumb 85]                                |
|   p.81       p.82        p.84      p.85                                      |
|   240x180    480x320     120x240   240x180                                   |
|                                                                              |
|  * selected                                                                  |
+------------------------------------------------------------------------------+
| ACTIONS                                                                      |
|                                                                              |
|   [ Pair with selected ]   [ Mark no figure ]   [ Mark false caption ]       |
|                                                                              |
|   [ View page 83 in PDF -> ]   [ Dismiss ]                                   |
+------------------------------------------------------------------------------+
```

The candidate strip is horizontal, scrollable, and shows page number + dimensions under each thumb. The PDF link uses `pdf-link.ts` to build a `file://...#page=83` URL against `~/Documents/airboss-handbook-cache/handbooks/ifh/FAA-H-8083-15B/FAA-H-8083-15B.pdf`.

## Authorisation

Every form action calls `requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN)` -- mirrors `apps/hangar/src/routes/(app)/review/+page.server.ts`. The queue list is visible to STUDENT for transparency (read-only), but only the higher roles can act. Switch to author-only if STUDENT visibility surfaces problems during the manual test pass.

## Browser-bundle safety

`libs/bc/ingest-review/` follows the established pattern (per [CLAUDE.md](../../../CLAUDE.md) "Critical Rules"):

- `src/index.ts` (runtime barrel) re-exports types and Drizzle table objects only. Every value re-export of a server-only module is `export type {...}`.
- `src/server.ts` re-exports `queries.ts`, `producer.ts`, `plugin.ts`, and the plugin registrations. Every consumer that touches the DB imports from `@ab/bc-ingest-review/server`.
- `apps/hangar/src/routes/(app)/ingest-review/+page.server.ts` and `[issueId]/+page.server.ts` import from `/server`. The `.svelte` files import types from the runtime barrel.
- The producer reads filesystem (`warnings.json`, `manifest.json`); those reads stay inside `producer.ts`, never imported transitively from a `.svelte` file.
- `scripts/ingest-review/*` are Bun-launched server scripts; they import from `/server` directly.
- `pdf-link.ts` resolves the cache root via `@ab/constants` `SOURCE_CACHE.cacheRoot()` (already lazy-loaded -- per `libs/constants/src/source-cache.ts`).

`scripts/check-browser-globals.ts` is the runtime guardrail; it walks the new runtime barrel and confirms no value re-export reaches `@ab/db/connection` or `node:*`.

## Producer scheduling

Producers don't auto-run on a schedule in v1. They run via:

- `bun scripts/ingest-review/run-producers.ts --corpus handbook --source ifh` -- after a re-extract.
- An empty-state nudge on `/ingest-review` -- a button that POSTS to a `?/runProducers` form action -- mirrors the loader-refresh pattern in `apps/hangar/src/routes/(app)/review/+page.server.ts`.

A scheduled run lives behind the existing `scripts/scheduler/` infra if it becomes useful; deferred until the next plugin lands and the cadence question is non-hypothetical.

## Migration sequencing

The Phase 1 Drizzle migration adds two tables to `hangar`. Index choices documented above. The migration is reversible (drop both tables, drop the indexes, drop the check constraints); no data loss concerns since the queue starts empty.

For developers with existing local data after the merge:

- Run `bun run db migrate` to apply the new tables.
- Run `bun scripts/ingest-review/run-producers.ts --corpus handbook` to populate the issue table from the live `warnings.json` files.
- Optionally run `bun scripts/ingest-review/import-overrides.ts` if any sidecar files have been hand-authored before merge.
