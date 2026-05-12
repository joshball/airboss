---
title: 'Out of Scope: Hangar Registry'
product: hangar
feature: hangar-registry
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Registry

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The sources are the "Out of scope" section of [spec.md](./spec.md) and the "Deferred (surface only, not implemented here)" section of [tasks.md](./tasks.md). The deeper rationale lives in the locked plan [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md) and the orchestrator [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md).

## Summary

| Item                                        | Status       | Trigger to revisit                                                          |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Interactive `/sources` flow diagram         | Follow-on WP | When `hangar-sources-v1` builds the interactive source flow                 |
| Fetch / upload / extract / build / diff job | Follow-on WP | When `hangar-sources-v1` lands the source pipeline job runners              |
| Chart / plate / diagram preview rendering   | Follow-on WP | When `hangar-non-textual` ships visual-source previews                      |
| Presence indicators                         | Deferred     | When two authors collide on the same reference in real authoring sessions   |
| Cron-based automatic sync                   | Deferred     | When pending dirty rows pile up because nobody clicks "Sync all pending"    |
| Multi-file conflict resolution UI           | Rejected     | Never -- see detail below                                                   |
| Bulk approve / revert                       | Deferred     | When a single sync routinely touches 10+ rows and per-row review is tedious |
| SSE for `/jobs` live progress               | Deferred     | When polling at 1 Hz feels sluggish under real load                         |
| Public (non-admin) job log view             | Deferred     | When a non-admin role legitimately needs read access to job output          |

## Interactive `/sources` flow diagram

Status: Follow-on WP

What was postponed:
The `/sources` page in hangar that renders an interactive flow diagram for each registered source (fetch -> extract -> build -> validate). This WP ships a placeholder sources surface as a sibling tab to `/glossary` ([spec.md Sources edit UI](./spec.md)), enough to edit `sources.toml` rows but not the visual pipeline.

Why:
Per [spec.md](./spec.md) Out of scope and the locked plan: the interactive flow diagram is the centerpiece of `hangar-sources-v1`. Building it here would mix two distinct surfaces (registry editing vs source pipeline operation) and make the registry WP too large to ship cleanly. Registry edits need *a* surface immediately; the production flow surface waits for its own WP.

Trigger that fires the follow-on:
[hangar-sources-v1](../hangar-sources-v1/spec.md) is signed off (status: `signed-off`) and ready to build. When that WP lands, the placeholder `/glossary/sources` tab gets superseded by the full `/sources` flow.

References:

- [spec.md Out of scope](./spec.md)
- [hangar-sources-v1/spec.md](../hangar-sources-v1/spec.md) section `/sources index -- interactive flow diagram`
- [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md) (Registry strategy)

## Fetch / upload / extract / build / diff job kinds

Status: Follow-on WP

What was postponed:
The job *runners* (handler functions registered against `@ab/hangar-jobs`) for `fetch`, `upload`, `extract`, `build`, `diff`, `validate`, and `size-report`. The job *queue* + worker + `sync-to-disk` runner ship here ([spec.md Job queue + worker](./spec.md)). The other kinds get their enum slots in `libs/constants/src/jobs.ts` but no implementation.

Why:
Per [spec.md](./spec.md) Out of scope and the locked plan: the queue + worker infrastructure is the load-bearing piece both WPs need; isolating it in this WP avoids a same-day refactor when `hangar-sources-v1` builds. The runners are domain-specific to source ingestion and belong with the surface that consumes them.

Trigger that fires the follow-on:
[hangar-sources-v1](../hangar-sources-v1/spec.md) authors the runners. Each runner mirrors the `sync-to-disk` handler registration pattern at `apps/hangar/src/lib/server/jobs.ts` (per Phase 5 of [tasks.md](./tasks.md)).

References:

- [spec.md Out of scope](./spec.md)
- [hangar-sources-v1/spec.md](../hangar-sources-v1/spec.md) (source pipeline jobs)
- Phase 5 implementation pattern: `apps/hangar/src/lib/server/jobs.ts`

## Chart / plate / diagram preview rendering

Status: Follow-on WP

What was postponed:
Render surfaces for non-textual source types -- sectional charts, IAP plates, airport diagrams. The registry can record a source row of type `chart` / `plate` / `diagram` with the standard locator + checksum + format fields, but no UI displays a preview thumbnail or interactive viewer.

Why:
Per [spec.md](./spec.md) Out of scope: non-textual rendering is a distinct UI concern with its own tooling (raster vs vector, georeferencing, plate-overlay primitives). The registry surface needs to be type-agnostic; the rendering surface lives where the visual primitives live.

Trigger that fires the follow-on:
[hangar-non-textual](../hangar-non-textual/spec.md) is signed off (status: `signed-off`). When it lands, the registry detail page can link out to the preview surface.

References:

- [spec.md Out of scope](./spec.md)
- [hangar-non-textual/spec.md](../hangar-non-textual/spec.md)

## Presence indicators

Status: Deferred

What was deferred:
A "someone else is editing this reference" indicator on `/glossary/[id]`. The optimistic lock ([spec.md Edit UI](./spec.md) "form submits carry rev; server rejects stale writes with a 409 and a diff preview") catches the collision after the fact; presence would warn before.

Why:
Per [spec.md](./spec.md) Out of scope and [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md) ("post-MVP"): the optimistic-lock + diff-preview UX is sufficient for the small author team today (effectively one user). Presence requires server-side ephemeral state (Redis or a heartbeat table) plus a real-time channel; both are infrastructure cost the current cardinality doesn't justify.

Trigger to revisit:
When two authors collide on the same reference in real authoring sessions and the 409 + diff-preview flow proves disruptive enough to be worth pre-empting.

Implementation pattern when triggered:
Add a `hangar.edit_presence` row keyed by `(reference_id, actor_id)` with a `last_heartbeat_at` column. Detail page emits a 30-second heartbeat while the form is open. Page-load query surfaces "user X started editing N seconds ago" if any non-self row is fresh. Use polling (same 1 Hz cadence as the jobs log) before introducing SSE.

References:

- [spec.md Out of scope](./spec.md)
- [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
- [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md) deferred list

## Cron-based automatic sync

Status: Deferred

What was deferred:
A periodic background job that enqueues `sync-to-disk` automatically when `count(dirty = true) > 0`. Today every sync is operator-initiated via the "Sync all pending" button.

Why:
Per [spec.md](./spec.md) Out of scope and [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md): manual sync is correct for the current authoring volume. Auto-sync surfaces commits without a human reviewing the diff first, which is the wrong tradeoff while authoring patterns are still settling. The plan notes "the job kind exists so a cron runner is a small addition."

Trigger to revisit:
When pending dirty rows routinely sit unsynced because operators forget to click the button, or when authoring volume grows past the point where per-batch human review of every sync is worth the overhead.

Implementation pattern when triggered:
Add a scheduled job per [scripts/scheduler/README.md](../../../scripts/scheduler/README.md) that calls `enqueueJob({ kind: 'sync-to-disk', actorId: 'system:cron' })` when the dirty count is non-zero. The `sync-to-disk` handler ([libs/hangar-sync/src/run-sync-job.ts](../../../libs/hangar-sync/src/run-sync-job.ts)) is already idempotent (no-op outcome on empty diffs), so no handler changes required.

References:

- [spec.md Out of scope](./spec.md)
- [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
- [scripts/scheduler/README.md](../../../scripts/scheduler/README.md)

## Multi-file conflict resolution UI

Status: Rejected

What was rejected:
An in-UI 3-way merge / conflict resolver that appears when out-of-band edits to `glossary.toml` or `sources.toml` collide with pending dirty rows. The current behavior ([spec.md Sync service](./spec.md) step 5): the sync detects the conflict via on-disk SHA mismatch, aborts with `outcome: conflict`, surfaces both diffs, and leaves DB rows dirty. The user resolves by editing TOML on disk directly.

Why:
Per [spec.md](./spec.md) Out of scope: out-of-band edits are an exception path, not a workflow. Building a 3-way merge surface inside hangar would normalize the exception (signaling "this is fine, we have a tool for it") and add UI complexity with low real-world traffic. The TOML files are checked into git; the established resolution path is the developer's existing merge tooling (`git`, editor diff view, etc.).

A re-decision would have to clear a high bar: out-of-band edits happening often enough that disk-side resolution becomes a workflow chokepoint, AND a use case where the editor's diff tooling is provably insufficient. Neither has surfaced.

References:

- [spec.md Out of scope](./spec.md)
- [spec.md Sync service](./spec.md) conflict-handling flow

## Bulk approve / revert

Status: Deferred

What was deferred:
A multi-select affordance on `/glossary` that lets the operator approve or revert multiple dirty rows in a single action. Today's controls are per-row (save / revert on the detail page) plus the global "Sync all pending" trigger; there is no in-between batch operation.

Why:
Per [tasks.md](./tasks.md) Deferred section: per-row review is the correct default while authoring volume is small. Bulk operations skip the diff-per-row review pass, which is the exact moment an authoring error gets caught. Adding the affordance before the volume justifies it would normalize batch-approval as a shortcut.

Trigger to revisit:
When a single sync routinely touches 10+ rows and per-row review becomes tedious enough that operators ask for a bulk path, OR when an authoring tool (CSV import, AI-assisted bulk edit) lands and produces large dirty batches by design.

Implementation pattern when triggered:
Add a checkbox column to `/glossary` (Phase 6) and a header-bar action that operates on the selection. Server action takes an array of `(id, rev)` pairs; each item goes through the same optimistic-lock check the per-row save uses. Failed items return individually in the response; the UI surfaces "9 of 12 approved, 3 conflicts" rather than all-or-nothing.

References:

- [tasks.md Deferred](./tasks.md)

## SSE for `/jobs` live progress

Status: Deferred

What was deferred:
Server-Sent Events (or WebSockets) for the `/jobs/[id]` log stream. Today the page polls at 1 Hz while `status = running` ([spec.md `/jobs` route](./spec.md)).

Why:
Per [spec.md](./spec.md) Out of scope, [tasks.md](./tasks.md) Deferred section, and [design.md "Open questions"](./design.md) "Why polling at 1 Hz, not SSE or Websockets?": polling is simpler server-side (no long-lived connections, no reconnect logic, no proxy gotchas), good enough at `<100` active viewers. SSE adds operational complexity (per-connection memory, idle timeouts, reverse-proxy buffering) for an experience improvement nobody has measured as needed.

Trigger to revisit:
When 1 Hz polling feels sluggish under real load -- specifically, when the gap between log output and on-screen render is noticed by a user during normal job tailing.

Implementation pattern when triggered:
Add a `+server.ts` endpoint that opens an SSE stream and tails `hangar.job_log` via `LISTEN/NOTIFY` (Postgres pub/sub) or a polling loop with `pg_notify` on every insert. Keep the polling path as a fallback for clients without EventSource support.

References:

- [tasks.md Deferred](./tasks.md)
- [design.md Open questions](./design.md)
- [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md) ("SSE vs polling for /jobs live progress")

## Public (non-admin) job log view

Status: Deferred

What was deferred:
A read-only `/jobs` surface accessible to non-admin roles. Today `/jobs` and `/jobs/[id]` are admin-only ([spec.md `/jobs` route](./spec.md) implicit via hangar's existing role gate).

Why:
Per [tasks.md](./tasks.md) Deferred section and [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md) ("not until we know who reads it"): job log content includes raw stdout / stderr from runners that may legitimately leak source URLs, internal paths, or partial failure traces. Until a concrete non-admin role with a documented need exists, the right default is "admin-only and audit it."

Trigger to revisit:
When a non-admin role legitimately needs read access to job output (e.g., a content reviewer who wants to see why a build failed). The trigger must include both the role definition AND the read shape (full log vs status-only vs filtered).

Implementation pattern when triggered:
Add a role-aware filter on `/jobs/+page.server.ts` that scopes the result set (e.g., reviewer sees only jobs targeting references they own). Add a sanitization pass on `job_log` lines that strips known sensitive shapes (tokens, internal paths) per a small allowlist. Audit reads if the role isn't the actor.

References:

- [tasks.md Deferred](./tasks.md)
- [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
