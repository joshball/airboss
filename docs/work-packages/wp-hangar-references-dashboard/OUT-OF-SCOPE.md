---
title: 'Out of Scope: WP-HANGAR-REFS'
product: hangar
feature: wp-hangar-references-dashboard
type: out-of-scope
status: unread
---

# Out of Scope: WP-HANGAR-REFS

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                     | Status       | Trigger to revisit                                          |
| ---------------------------------------- | ------------ | ----------------------------------------------------------- |
| The flightbag app itself                 | Follow-on WP | Tracked as a separate scaffold WP                           |
| Cross-corpus search inside the dashboard | Deferred     | When admins repeatedly hit the limits of per-corpus filters |
| Bulk-action API (force-reingest-many)    | Deferred     | When v1 single-action force-reingest becomes a bottleneck   |

## The flightbag app itself

Status: Follow-on WP

What was deferred:

Building or modifying the public flightbag reader app (`apps/flightbag/`).
The architecture decision in [docs/platform/REFERENCES.md](../../platform/REFERENCES.md)
splits "references admin" (in hangar) from "public reader" (in flightbag).
This WP delivers only the admin side.

Why:

Hangar already has admin auth (`hangar.role === 'admin'`), the audit log,
and the content-authoring mission. Flightbag is admin-free by design
(public reader; eventually maybe public web). Building both surfaces in
one WP would entangle the two auth models and stretch review scope.

Trigger to revisit (Follow-on WP):

When the flightbag scaffold WP is scheduled. The reader UX work already
in motion (e.g. wp-flightbag-reader-ux, wp-flightbag-rich-reader) is the
relevant locus.

Implementation pattern when triggered:

Follow [wp-flightbag-reader-ux/](../wp-flightbag-reader-ux/) and the
companion `wp-flightbag-rich-reader/` for the reader surface. The
`getOpenWarningsForReference` BC primitive this WP defines is consumed
only by the admin dashboard; the flightbag reader does not consume
warnings.

References:

- [spec.md](./spec.md) -- "Why hangar (not flightbag)" and "Out of scope" item 1
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md)

## Cross-corpus search inside the dashboard

Status: Deferred

What was deferred:

A search box on `/admin/references/` that searches across all corpora at
once (rather than the per-corpus + text filters this WP ships).

Why:

Per-corpus filters + text search inside a corpus is sufficient for v1.
Cross-corpus search is a nice-to-have UI affordance, not a blocker for
the dashboard's mission (catalogued-reference triage + TOC validation +
health summary). Adding it now would expand the BC layer's query shape
and the UI's complexity without clear admin demand.

Trigger to revisit (Deferred):

When admins repeatedly hit the limits of per-corpus filters (e.g. trying
to find a section across all handbooks at once, or matching reference IDs
that span corpora). Concrete signal: a recurring admin workflow that the
v1 filters can't satisfy.

Implementation pattern when triggered:

Add the cross-corpus query to `listReferencesForAdmin(filters)` in
`libs/bc/hangar/src/references-admin.ts`. The dashboard already composes
filters; widen the input shape and the join surface in the BC layer.

References:

- [spec.md](./spec.md) -- "Out of scope" item 2

## Bulk-action API (force-reingest-many)

Status: Deferred

What was deferred:

A bulk variant of `forceReingest(id, reviewerId)` that operates on multiple
references at once (e.g. "re-ingest every PHAK chapter," "re-ingest every
AC matching pattern X").

Why:

Single-action force-reingest is sufficient for v1. The admin workflow
this WP supports (per-reference detail + per-action audit log) is
inherently one-at-a-time. Bulk action would multiply audit-log
implications (one row vs. N rows? batched? failure handling?) and stretch
review scope.

Trigger to revisit (Deferred):

When v1 single-action force-reingest becomes a bottleneck. Concrete
signal: an admin repeatedly clicking through many references in a row
because a known substrate fix needs to land across a corpus. The
WP-HANDBOOK-RE-EXTRACTION-V2 Phase 2 re-runs are NOT this trigger; they
ship as one PR per doc, not via the admin dashboard.

Implementation pattern when triggered:

Add a `bulkForceReingest(ids: SourceId[], reviewerId)` to
`libs/bc/hangar/src/references-admin.ts`. Decide on audit-log shape (one
batch row + N per-reference rows, or N rows only) at design time. Mirror
the audit pattern already in use for single force-reingest.

References:

- [spec.md](./spec.md) -- "Out of scope" item 3
