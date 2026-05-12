---
title: 'Out of Scope: Hangar Audit Explorer'
product: hangar
feature: hangar-audit-explorer
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Audit Explorer

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                     | Status       | Trigger to revisit                                                       |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Writes to `audit.audit_log` (edit / delete / backfill)   | Rejected     | Never -- see detail below                                                |
| Retire `/admin/audit-ping` + `AUDIT_TARGETS.HANGAR_PING` | Follow-on WP | First hangar mutation surface that emits its own audit rows lands        |
| Visual diff renderer for before / after on update rows   | Deferred     | Admin reports side-by-side jsonb is hard to read on a real investigation |
| Search inside `metadata` jsonb (e.g. by `requestId`)     | Deferred     | First investigation that needs to trace a single request across BCs      |
| CSV / JSON export of filtered rows                       | Deferred     | First incident response that needs more than 100 rows out of the UI      |
| Numbered / count-aware pagination                        | Deferred     | Audit volume exceeds ~10 cursor pages per typical admin session          |
| Index on `audit_log(timestamp desc)` alone               | Deferred     | Unfiltered list query latency exceeds 200ms in production                |
| Cross-app federation                                     | Rejected     | Never -- see detail below                                                |
| Realtime tail mode                                       | Deferred     | Live-debugging an in-progress incident becomes a recurring need          |
| Mobile-specific layout                                   | Deferred     | Mobile audit triage becomes a real admin workflow                        |

## Writes to `audit.audit_log` (edit / delete / backfill)

Status: Rejected

What was deferred / rejected / postponed:
Any UI affordance to edit, delete, or backfill rows in
`audit.audit_log`.

Why:
The audit trail is append-only by design (ADR 004). Editing or deleting
audit rows would defeat the entire substrate's purpose. Backfilling
historical rows from another source is a one-off scripted operation,
not a UI surface.

References:

- [ADR 004 -- Audit substrate](../../decisions/004-audit-substrate.md)
- [spec.md](./spec.md) "Out of Scope (explicit)" first bullet

## Retire `/admin/audit-ping` + `AUDIT_TARGETS.HANGAR_PING`

Status: Follow-on WP

What was deferred / rejected / postponed:
Removing the scaffold-era `/admin/audit-ping` heartbeat route and
deciding whether `AUDIT_TARGETS.HANGAR_PING` stays or goes. Routing the
hangar dashboard's "System -> Audit" tile to `/admin/audit` instead of
`/admin/audit-ping`.

Why:
This WP creates the new surface but deliberately leaves the old heartbeat
in place. Removing the predecessor is a separate cleanup pass that needs
its own walk of the dashboard tiles, the `ROUTES.HANGAR_ADMIN_AUDIT_PING`
constant, and the `AUDIT_TARGETS.HANGAR_PING` usage. Tasks.md Phase 6
already names the follow-up: `retire-audit-ping`.

Trigger to revisit:
First hangar mutation surface (user-edit, role-change, ban, revoke) that
emits its own audit rows. Once a real mutation writes through the BC,
the ping route stops being the only proof-of-life and can retire.

Implementation pattern when triggered:
Mirror the WP-spec template at
[docs/work-packages/hangar-audit-explorer/spec.md](./spec.md). The follow-on
WP is small: re-route the dashboard tile, delete the route, decide on
`AUDIT_TARGETS.HANGAR_PING` retention vs removal based on whether any
other code path still emits that target. Search the codebase for the
constant before deletion.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" second bullet
- [tasks.md](./tasks.md) Phase 6: "Open follow-up WP: retire-audit-ping"
- [docs/work-packages/hangar-scaffold/spec.md](../hangar-scaffold/spec.md) for the origin of `/admin/audit-ping`

## Visual diff renderer for before / after on update rows

Status: Deferred

What was deferred / rejected / postponed:
A real diff renderer (deep-object diff, highlighted adds / removes /
changes) on the detail page for `update` rows. v1 ships side-by-side
pretty-printed jsonb.

Why:
Decision #3 in the spec: "Update-row rendering: side-by-side
pretty-printed jsonb. No real diff renderer in v1." Side-by-side
pretty-printed JSON with copy-to-clipboard is the safe minimum. A diff
component adds non-trivial UX scope (which keys are arrays vs objects,
how to render nested adds / removes, color tokens for added / removed /
changed) that isn't justified before the first real investigation
proves side-by-side is unworkable.

Trigger to revisit:
First investigation where an admin reports that side-by-side jsonb is
hard to read on a real `update` row (typically a deeply nested object
with one or two leaf changes).

Implementation pattern when triggered:
New component under `libs/ui/` (e.g. `JsonDiffPane`) that takes
`before` and `after` jsonb and renders a unified diff with token-driven
adds / removes / changes. Mount on the detail page alongside the
existing side-by-side panes (toggle, not replace). Mirror the help-page
update once the toggle ships.

References:

- [spec.md](./spec.md) Decisions section #3
- [design.md](./design.md) risk: "before / after jsonb panes are illegible for deeply nested updates"

## Search inside `metadata` jsonb (e.g. by `requestId`)

Status: Deferred

What was deferred / rejected / postponed:
Filtering by values inside the `metadata` (or `before` / `after`) jsonb
columns. v1 filters are top-level columns only (actor, target type,
target id, op, time window).

Why:
A jsonb-internal filter requires GIN indexes and a different query path
(jsonb path operators, key-presence vs value-equality semantics). The
v1 filter set already answers "who did what when," and the request-id
correlation use case (trace one HTTP request across multiple BC writes)
is rare enough that it doesn't justify the index + UI cost up front.

Trigger to revisit:
First investigation that needs to trace a single request across
multiple BCs (e.g. correlating an enrollment write with the audit row
its handler emitted via `metadata.requestId`).

Implementation pattern when triggered:
Add a GIN index on `audit_log.metadata` (probably `jsonb_path_ops`).
Extend `AuditFilters` with `metadataMatch?: { path: string[]; value:
unknown }`. Surface a new filter field in the filter bar (initially
constrained to `requestId` only; broaden once the pattern proves out).

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "Search inside jsonb payloads"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table

## CSV / JSON export of filtered rows

Status: Deferred

What was deferred / rejected / postponed:
A "Download last 7d" / "Export filtered rows" button that streams the
current filtered result set out as CSV or JSON.

Why:
Adds a write-to-disk path and a rate-limit concern (export queries can
be expensive on a growing append-only table). v1 keeps the surface
read-only-in-UI; offline analysis is still possible via direct DB
access. Cost is small (~30 lines) but the surface needs deliberate UX
(filename, format choice, large-export warning) that isn't justified
without real demand.

Trigger to revisit:
First incident response that needs more than 100 rows of audit data out
of the UI (e.g. legal / compliance evidence dump, post-mortem timeline
analysis).

Implementation pattern when triggered:
Add an `+server.ts` endpoint under `/admin/audit/export` that streams
NDJSON (or CSV) using the same `AuditFilters` shape as `listAuditEntries`,
gated behind `requireRole(ROLES.ADMIN)`. UI: "Export current view"
button next to "Show more". Cap the stream at a sane row count and
return a warning header when truncated.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "CSV / JSON export"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table

## Numbered / count-aware pagination

Status: Deferred

What was deferred / rejected / postponed:
"Page 1 of N" numbered pagination with a known total row count.

Why:
A numbered pager needs a `count(*)` round-trip per page change, which
is wasteful on a growing append-only table. Cursor-based "Show more" is
the right v1 affordance (and matches how `/users` paginates).

Trigger to revisit:
When typical admin sessions routinely click "Show more" ten or more
times -- at that volume the cursor flow starts to feel slow and a
numbered jump-to-page is worth its `count(*)` cost.

Implementation pattern when triggered:
Add an optional `includeCount: boolean` to `AuditFilters`. When set,
`listAuditEntries` returns `nextCursor` plus a `totalCount`. The page
component renders numbered pagination when the count is provided.
Either run the count query in parallel with the page query, or compute
it from a materialized view if the row count grows past low millions.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "Numbered pagination"
- [spec.md](./spec.md) Decisions: "Pagination: cursor 'Show more'"

## Index on `audit_log(timestamp desc)` alone

Status: Deferred

What was deferred / rejected / postponed:
A dedicated index on `audit_log.timestamp desc` to make the unfiltered
default-window query (all actors, all targets, last 24h) fast.

Why:
The existing `audit_log_actor_idx` and `audit_log_target_idx` cover the
common filtered cases. The unfiltered case is a sequence scan + sort
that's acceptable while row count stays modest. Adding the index now is
premature.

Trigger to revisit:
Unfiltered list query latency exceeds 200ms in production (or the
analytics show users typically hit the unfiltered default and bounce on
slowness).

Implementation pattern when triggered:
Edit `libs/audit/src/schema.ts` to add the index (`index('audit_log_timestamp_idx').on(table.timestamp.desc())`).
Regenerate `drizzle/0000_initial.sql`. Reseed locally; production
schema is greenfield so no migration phasing applies.

References:

- [spec.md](./spec.md) "Indexes already in place" section
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table
- [design.md](./design.md) risk: "Unfiltered scans get slow as `audit_log` grows"

## Cross-app federation

Status: Rejected

What was deferred / rejected / postponed:
A federation layer that aggregates audit rows from per-app silos into
this surface.

Why:
There are no per-app audit silos to federate. `audit.audit_log` already
aggregates every BC's writes by design (ADR 004). The system has one
cross-cutting table; the right answer is to keep it that way. If a
future system writes to a separate audit store, the answer is to route
its writes back through `audit.audit_log`, not to build a federation
layer.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "Cross-app federation"
- [ADR 004 -- Audit substrate](../../decisions/004-audit-substrate.md)

## Realtime tail mode

Status: Deferred

What was deferred / rejected / postponed:
A "live follow" mode that streams new audit rows into the list without
a manual reload.

Why:
v1 refresh path is "reload or change a filter." Realtime tail adds a
websocket / SSE channel, a "pause / resume tail" UX, and edge cases
(new row arrives while the user is scrolled mid-list). None of that
earns its cost without recurring need.

Trigger to revisit:
Live-debugging an in-progress incident becomes a recurring admin
workflow (e.g. watching a deploy roll out, watching a bulk import write
through several BCs).

Implementation pattern when triggered:
Add an SSE endpoint that emits new `audit_log` rows as they're written
(plug into the BC's audit-write helper). UI: a "Live" toggle next to
"Show more"; when on, new rows prepend with a brief flash. Pause when
the user scrolls.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "Realtime tail"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table

## Mobile-specific layout

Status: Deferred

What was deferred / rejected / postponed:
A mobile-first or mobile-optimised layout for the audit list and detail
pages. v1 is desktop-first.

Why:
The whole hangar app is desktop-first today; mobile is not a primary
admin context. Optimising one route for mobile out of order would
create surface inconsistency.

Trigger to revisit:
Mobile audit triage becomes a real admin workflow, OR a broader
hangar-mobile pass picks up.

Implementation pattern when triggered:
Roll the audit explorer into whatever the hangar-wide mobile pass
delivers; don't bespoke the audit surface alone.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)": "Mobile-specific layout"
