---
title: 'Out of Scope: WP-CITE-FLIGHTBAG -- citation chip migration'
product: flightbag
feature: wp-citation-chips-to-flightbag
type: out-of-scope
status: unread
---

# Out of Scope: WP-CITE-FLIGHTBAG -- citation chip migration

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                    | Status       | Trigger to revisit                                            |
| --------------------------------------- | ------------ | ------------------------------------------------------------- |
| Building the flightbag routes           | Follow-on WP | The flightbag scaffold WP -- already a separate, in-flight WP |
| Hangar admin dashboard                  | Follow-on WP | The hangar admin WP -- already a separate, in-flight WP       |
| Authoring new reference content         | Rejected     | Never -- this WP is a rewire, not a content authoring effort  |
| Deletion of study `/library/...` routes | Follow-on WP | After full migration soak period -- separate cleanup WP       |

## Building the flightbag routes

Status: Follow-on WP

What was deferred:
The actual `apps/flightbag/` SvelteKit routes that render canonical FAA references. This WP assumes those routes already exist; it only rewires citation chip URL generation to point at them.

Why:
Scope discipline. The flightbag scaffold is a separate, in-flight WP. Rolling it into this rewire WP would couple two unrelated risks (app scaffolding correctness vs URL generation rewire) and make the migration impossible to sequence.

Trigger to revisit:
The flightbag scaffold WP itself -- see [docs/work-packages/flightbag-scaffold/](../flightbag-scaffold/). When that WP lands, this WP becomes unblocked.

Implementation pattern when triggered:
This WP is the trigger's downstream. Once flightbag scaffold + content (section-tree promotions) are live, this WP runs as the migration step that wires study's citation chips to the new canonical URLs via `urlForReference(uri)`.

References:

- [spec.md](./spec.md) -- "Out of scope" originally listed this; "Sequencing" calls flightbag scaffold a prerequisite
- [docs/work-packages/flightbag-scaffold/](../flightbag-scaffold/) -- the scaffold WP

## Hangar admin dashboard

Status: Follow-on WP

What was deferred:
The hangar admin dashboard surface that audits content / citation URL changes. This WP does not touch hangar.

Why:
Hangar is a separate product surface with its own admin-write WPs. This WP is the study-side rewire of URL generation; hangar's role (auditing URL changes, content authoring) sits behind its own admin pattern (mirrors `hangar-users-editing`).

Trigger to revisit:
The hangar admin dashboard WP. When that lands, citation surfaces gain audit visibility for URL rewrites; today those rewrites are code-only.

Implementation pattern when triggered:
Mirror the dual-gate audit + form-action pattern established by `hangar-users-editing`. Surfacing citation URL audit rows in a hangar tile is a downstream consumer of audit data already emitted by source-management WPs.

References:

- [spec.md](./spec.md) -- "Out of scope" originally listed this; "Sequencing" notes hangar admin dashboard as a prerequisite
- [docs/work-packages/hangar-users-editing/spec.md](../hangar-users-editing/spec.md) -- the dual-gate pattern hangar admin writes follow

## Authoring new reference content

Status: Rejected

What was rejected:
Adding new handbook chapters, regulation parts, or other reference corpora as part of this WP.

Why:
This WP is a mechanical rewire. Every URL generation site today calls `ROUTES.LIBRARY_*` or constructs `/library/...` paths; the rewire replaces those calls with `urlForReference(uri)`. New content authoring is an entirely different effort (ingestion pipeline, section extraction, source registry updates) and belongs to source-ingest WPs, not to URL generation rewires.

Trigger to revisit:
Never via this WP. New reference content lands through the source-ingestion pipeline ([docs/ingestion-pipeline/](../../ingestion-pipeline/)) and its own dedicated WPs.

References:

- [spec.md](./spec.md) -- "Out of scope" originally listed this

## Deletion of study `/library/...` routes

Status: Follow-on WP

What was deferred:
Removing the `apps/study/src/routes/(app)/library/**` routes after the migration completes. This WP marks them deprecated (Phase 5 emits an audit log warning when a user reaches a study `/library/` route) but does not delete them.

Why:
Soak discipline. Citation surfaces may have stale links pasted into notes, scenario debriefs, bookmarks, or external docs. Keeping the deprecated routes alive during a soak period catches the long tail before any 404s land in user-facing experiences. Cutting both the rewire and the route deletion into a single WP collapses the soak window to zero.

Trigger to revisit:
After flightbag has feature parity AND the deprecation audit log shows the route hit count has fallen to effectively zero across a meaningful observation window.

Implementation pattern when triggered:
Author a follow-on WP `wp-study-library-routes-retire`. Delete the `apps/study/src/routes/(app)/library/**` directory tree. Remove `ROUTES.LIBRARY_*` entries from [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts). Update REFERENCES.md and any remaining documentation.

References:

- [spec.md](./spec.md) -- Phase 5 "Deprecate study /library/ routes" + "Out of scope" note that deletion is a follow-up WP after soak
