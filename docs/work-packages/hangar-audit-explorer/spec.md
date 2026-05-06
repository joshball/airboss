---
id: hangar-audit-explorer
title: "Spec: Hangar Audit Explorer"
product: hangar
category: feature
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-04-30
owner: agent
depends_on: []
unblocks: []
tags:
  - audit
  - admin
legacy_fields:
  feature: hangar-audit-explorer
  type: spec
  review_status: pending
  shipped: 2026-04-30
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Spec: Hangar Audit Explorer

A read-only audit explorer in the hangar app. Filter every row in `audit.audit_log` by actor, target, op, and time window; paginate; drill into a single row's full payload (before / after / metadata).

Replaces the system role of `/admin/audit-ping`: that route is a scaffold-era heartbeat that proves the auth -> form-action -> audit-write -> audit-read path. Once this WP ships, the System -> Audit destination from the dashboard points here. Retiring `/admin/audit-ping` itself is a separate cleanup WP (see "Out of scope").

Pure read consumer of `audit.audit_log`. No writes. No new schema. The only proposed code surface change is one new BC read function (`listAuditEntries`) and a small constant addition for query-param names, both documented here -- to be authored in the build phase, not in this WP.

## Why this WP exists

| Need                                                                          | What's missing today                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| "Who touched what, when?" -- the basic admin question.                        | No surface answers it. `/admin/audit-ping` only shows `hangar.ping` rows; everything else is invisible to UI. |
| Investigate a suspect mutation: see before / after / metadata for one row.    | No detail view. The `before` and `after` jsonb columns are queryable but never rendered.                      |
| Cross-actor, cross-target time-window scan ("everything Abby did yesterday"). | `auditRecent` filters by target only; `listRecentUserAudits` filters by actor only. Nothing combines them.    |
| Anchor for follow-on admin-write surfaces (role change, ban, revoke).         | When admin writes land, every action will need a verifiable trace; this surface is that trace.                |

## Anchors

- [ADR 004 -- Audit substrate](../../decisions/004-audit-substrate.md). Schema rationale: one generic `audit_log`, jsonb before/after, nullable actor.
- [Hangar PRD](../../products/hangar/PRD.md). "In flight or imminent" lists "Real audit explorer" as the next admin surface.
- [Hangar Vision](../../products/hangar/VISION.md). Hangar is the cross-cutting admin surface; audit visibility is core to its job.
- [Predecessor WP -- hangar-scaffold](../hangar-scaffold/spec.md). Where `/admin/audit-ping` came from and why it stays until this surface lands.
- [Sibling WP -- extract-hangar-bc](../extract-hangar-bc/spec.md). The hangar BC this WP extends with `listAuditEntries`.
- [Sibling pattern -- /users read-only directory](../../products/hangar/PRD.md). PR #226 / `apps/hangar/src/routes/(app)/users/`. Match its filter-bar shape, ADMIN-only gate, server-side filtering, debounced URL sync, and pagination cap.
- [reference-sveltekit-patterns.md](../../agents/reference-sveltekit-patterns.md). Loader / route / page-server conventions.
- [common-pitfalls.md](../../agents/common-pitfalls.md). Routes through `ROUTES`, no inline literals, Svelte 5 runes only.

## In Scope

| #  | Item                                                                                                                                                                                                                          |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `/admin/audit` list route. Renders rows from `audit.audit_log` newest-first with pagination.                                                                                                                                   |
| 2  | `/admin/audit/[id]` detail route. Renders one row in full: actor, op, target, timestamp, before (jsonb), after (jsonb), metadata (jsonb), request-id link.                                                                     |
| 3  | Filter bar: actor (user search by name or email), target type (select from `AUDIT_TARGET_VALUES`), target id (free text), op (select from `AUDIT_OP_VALUES`), time window (preset + custom).                                  |
| 4  | Default time window: last 24h. Presets: 1h, 24h, 7d, 30d, all. Custom: `from` and `to` ISO datetimes.                                                                                                                          |
| 5  | All filter state lives in URL search params; deep-linkable; back/forward restores filters.                                                                                                                                     |
| 6  | Pagination: cursor-based on `(timestamp desc, id desc)` -- default page size 50, hard cap 200. Hidden behind a "Show more" button rather than numbered pages.                                                                  |
| 7  | ADMIN-only gate at the route layer (`requireRole(ROLES.ADMIN)` in `+page.server.ts`). Matches `/users`. Layout-level AUTHOR-or-better gate is too permissive for raw audit data.                                              |
| 8  | New BC read: `listAuditEntries(filters, db)` in `libs/bc/hangar/src/audit-queries.ts`. Returns rows + a `nextCursor`. Existing `auditRecent` and `listRecentUserAudits` are kept; this surface needs a third, broader read.    |
| 9  | New BC read: `getAuditEntry(id, db)` for the detail page. Returns the row joined with the actor's display name + email so the detail page doesn't need a second query.                                                         |
| 10 | Pretty rendering of `before`, `after`, `metadata`. JSON pretty-print with copy-to-clipboard. No diff view in v1 -- the two payloads render side-by-side; visual diff is a v2 follow-up unless the open question is resolved.   |
| 11 | "View all from this actor" / "View all on this target" links on the detail page that round-trip the filters back into the list.                                                                                                |
| 12 | Empty state: explicit copy when no rows match (filter active) or when the table is empty (no audit history yet).                                                                                                               |
| 13 | Help page in `apps/hangar/src/lib/help/content/audit.ts` covering filters, time window semantics, "what's an op", and the link from the detail page back to a filtered list.                                                  |
| 14 | Vitest unit coverage for `listAuditEntries` filter composition + `getAuditEntry`.                                                                                                                                              |
| 15 | Playwright e2e: list smoke, filter round-trip, detail page renders, ADMIN-only redirect for AUTHOR / OPERATOR / learner.                                                                                                       |

## Out of Scope (explicit)

- **Writes.** No edit, delete, or backfill of audit rows. The audit trail is append-only by design (ADR 004).
- **Retiring `/admin/audit-ping`.** That route stays as a heartbeat diagnostic until a follow-up cleanup WP. Note in spec body: this WP makes the new surface; a separate WP routes the dashboard's System -> Audit tile here, removes audit-ping, and cleans up `ROUTES.HANGAR_ADMIN_AUDIT_PING` + `AUDIT_TARGETS.HANGAR_PING` if the pattern is no longer needed.
- **Visual diff between before / after.** v1 ships side-by-side jsonb. A real diff renderer (deep object diff, highlighted adds/removes) is deferred to v2 unless the open question pulls it in. Side-by-side jsonb is the safe minimum.
- **Search inside jsonb payloads.** "Find every row whose `metadata.requestId` is X" requires GIN indexes and a different query path. Deferred. v1 filters are top-level columns only.
- **CSV / JSON export.** "Download last 7d" is a recurring admin ask; it's a 30-line follow-up but adds a write-to-disk path and rate-limit concern. Deferred unless the open question pulls it in.
- **Numbered pagination.** Cursor-based "Show more" is enough for v1. Numbered pages need a `count(*)` round-trip per page change, which is wasteful on a growing table.
- **Cross-app federation.** This surface reads `audit.audit_log` only -- the one cross-cutting table that already aggregates every BC's writes. There's no per-app audit silo to federate.
- **Realtime tail.** No "live follow" mode in v1. Manual reload or filter-change is the refresh path.
- **Mobile-specific layout.** Desktop-first per the rest of hangar.

## BC reads consumed (proposed -- not added in this WP)

| Function                                              | File                                       | Used on                  | Status            |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------ | ----------------- |
| `listAuditEntries(filters, db)`                       | `libs/bc/hangar/src/audit-queries.ts` (new) | `/admin/audit` list      | New, build-phase  |
| `getAuditEntry(id, db)`                               | `libs/bc/hangar/src/audit-queries.ts` (new) | `/admin/audit/[id]`      | New, build-phase  |
| `searchActorIds(searchTerm, limit, db)`               | `libs/bc/hangar/src/audit-queries.ts` (new) | Filter bar -- actor lookup | New, build-phase  |
| `auditRecent`                                         | `libs/audit/src/log.ts`                    | unchanged                | Kept              |
| `listRecentUserAudits`                                | `libs/bc/hangar/src/users.ts`              | unchanged                | Kept              |

`listAuditEntries` signature (proposed):

```typescript
export interface AuditFilters {
  /** Actor user id; null = system-write filter; undefined = any. */
  actorId?: string | null;
  /** Match against `bauth_user.name` or `bauth_user.email` (ilike). */
  actorSearch?: string;
  /** AUDIT_TARGETS value, e.g. 'hangar.source'. */
  targetType?: string;
  /** Exact match on the target row id. */
  targetId?: string;
  /** AUDIT_OPS value: 'create' | 'update' | 'delete' | 'action'. */
  op?: string;
  /** Inclusive lower bound on `audit_log.timestamp`. */
  from?: Date;
  /** Inclusive upper bound on `audit_log.timestamp`. */
  to?: Date;
  /** Cursor: `${timestampISO}::${id}` from the previous page. */
  cursor?: string;
  /** Default 50; hard cap 200. */
  limit?: number;
}

export interface AuditEntryRow {
  id: string;
  timestamp: Date;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  op: string;
  targetType: string;
  targetId: string | null;
  /** Truncated to a preview on the list page; full payload on detail. */
  metadataPreview: Record<string, unknown>;
}

export interface AuditEntriesPage {
  rows: AuditEntryRow[];
  nextCursor: string | null;
}
```

## Constants and routes (to be added in build phase, documented here)

```typescript
// libs/constants/src/routes.ts -- add:
HANGAR_ADMIN_AUDIT: '/admin/audit',
HANGAR_ADMIN_AUDIT_DETAIL: (id: string) => `/admin/audit/${encodeURIComponent(id)}` as const,

// libs/constants/src/routes.ts QUERY_PARAMS -- add (or reuse where they already exist):
AUDIT_ACTOR: 'actor',
AUDIT_TARGET_TYPE: 'targetType',
AUDIT_TARGET_ID: 'targetId',
AUDIT_OP: 'op',
AUDIT_FROM: 'from',
AUDIT_TO: 'to',
AUDIT_WINDOW: 'window',  // preset name: '1h' | '24h' | '7d' | '30d' | 'all' | 'custom'
AUDIT_CURSOR: 'cursor',
```

`AUDIT_TARGETS` and `AUDIT_OPS` already exist in `libs/constants/src/audit.ts` and `libs/audit/src/schema.ts` respectively. The filter bar's selects bind to `AUDIT_TARGET_VALUES` and `AUDIT_OP_VALUES` directly.

## Indexes already in place

`audit.audit_log` already has:

- `audit_log_actor_idx` on `(actor_id, timestamp)` -- the actor + window filter is fast.
- `audit_log_target_idx` on `(target_type, target_id, timestamp)` -- target + window is fast.

For the unfiltered "everything in last 24h" case the query falls back to a sort by `timestamp desc`. Postgres has no index on `timestamp` alone today. If the table grows past hundreds of thousands of rows this becomes the bottleneck; v1 ships without that index and a follow-up adds it once row count justifies it. (Captured as a non-blocking risk in design.md.)

## Decisions (ratified 2026-04-30)

All five drafting-phase questions resolved in favour of the recommended defaults. No scope changes. Two implementation choices likewise ratified.

1. **Default time window: 24h.** Rare for an admin to want week-old context unfiltered; specific investigations widen the window themselves.
2. **Actor filter: free-text email or name search.** Live-search behaves like the `/users` search bar (debounced 150ms). Pick-from-list dropdown rejected -- hangar user count is small, and the filter bar already mirrors `/users`.
3. **Update-row rendering: side-by-side pretty-printed jsonb.** No real diff renderer in v1. Trigger to revisit: first investigation where side-by-side proves hard to read on a real `update` row. Until then, pretty-printed JSON with copy-to-clipboard is the safe minimum.
4. **List row click -> detail page.** Deep-linkable; no surprise scroll-jumps; matches `/users` flow. Inline expand rejected -- breaks copy-link-and-share.
5. **List columns: actorName + actorEmail (server-side joined).** Actor id alone is useless to a human. Server-side join is one query, not N+1.

Implementation choices:

- **Pagination: cursor "Show more".** Numbered pages would need `count(*)` per page change -- wasteful on a growing append-only table.
- **`audit_log(timestamp desc)` index: deferred.** The actor + target indexes already exist; only the unfiltered case is the slow path. Trigger to add: unfiltered list latency exceeds 200ms in production.

## Acceptance

- `/admin/audit` and `/admin/audit/[id]` render against the proposed BC reads with no schema changes.
- ADMIN-only gate verified: AUTHOR / OPERATOR / learner roles 403 on both routes.
- Filter state round-trips via URL: copy URL, paste in a new tab, same view.
- Time-window default is 24h; presets switch correctly; custom from/to validates.
- Pagination "Show more" appends rows; cursor encoded in URL; back/forward works.
- Detail page renders before / after / metadata for an `update` row from a real BC write.
- `bun run check` clean. Vitest + Playwright pass.
- Help page exists, validated, linked.
- Manual test plan in [test-plan.md](./test-plan.md) walked end-to-end by the user.
- `review_status: done` after `/ball-review-full` closes findings.

## Deferred (with explicit triggers)

| Item                                                          | Trigger to revisit                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Retire `/admin/audit-ping` + `AUDIT_TARGETS.HANGAR_PING`       | First hangar mutation surface (e.g. user-edit) that emits its own audit rows lands.           |
| Visual diff renderer for before / after on update rows         | Admin reports side-by-side jsonb is hard to read on a real investigation.                     |
| CSV / JSON export                                              | First incident response that needs >100 rows out of the UI.                                   |
| Search inside `metadata` jsonb (e.g. by `requestId`)            | First investigation that needs to trace a single request across multiple BCs.                 |
| Numbered / count-aware pagination                               | Audit volume on this page exceeds ~10 cursor pages per typical admin session.                 |
| Index on `audit_log(timestamp desc)` alone                      | Unfiltered list query latency exceeds 200ms in production.                                    |
| Realtime tail mode                                              | Live-debugging an in-progress incident becomes a recurring need.                              |
