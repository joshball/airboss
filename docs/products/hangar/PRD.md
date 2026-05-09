---
title: Hangar PRD
product: hangar
type: prd
status: current
date: 2026-04-26
supersedes: ../../.archive/products/hangar/PRD.md
---

# Hangar PRD

What hangar does today and what's queued next. Per-feature spec lives in `docs/work-packages/{feature}/`, not inline here.

For the why, see [VISION.md](VISION.md). For what's queued next, see [ROADMAP.md](ROADMAP.md). For the FIRC-era PRD (425 lines of dormant submission machinery), see [.archive/products/hangar/PRD.md](../../.archive/products/hangar/PRD.md).

## Shipped

| Surface                           | What it does                                                                                     | Spec                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `/` dashboard                     | Three tiles -- Content, People, System -- with live counts                                       | --                                                                                   |
| `/sources`                        | Reference-document pipeline: register, fetch, extract, diff, validate                            | [hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)                   |
| `/sources/[id]`                   | Source detail + filesystem browser                                                               | [hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)                   |
| `/glossary`                       | Term registry: definitions, citations, knowledge-kind taxonomy                                   | [hangar-non-textual](../../work-packages/hangar-non-textual/spec.md)                 |
| `/glossary/[id]`                  | Term detail + edit                                                                               | [hangar-non-textual](../../work-packages/hangar-non-textual/spec.md)                 |
| `/users`                          | User list (ADMIN-only): name, email, role, last seen, banned                                     | --                                                                                   |
| `/users/[id]`                     | User detail (ADMIN-only): role picker, ban / unban, session revoke, sessions + audit             | [hangar-users-editing](../../work-packages/hangar-users-editing/spec.md)             |
| `/users/invitations`              | Invitation list (ADMIN-only): pending / accepted / revoked / expired tabs + invite-user modal    | [hangar-invite-flow](../../work-packages/hangar-invite-flow/spec.md)                 |
| `/users/invitations/[id]`         | Invitation detail (ADMIN-only): full row + audit history + revoke / resend actions               | [hangar-invite-flow](../../work-packages/hangar-invite-flow/spec.md)                 |
| `/jobs`                           | Background-job log with 1Hz live polling                                                         | [hangar-registry](../../work-packages/hangar-registry/spec.md)                       |
| `/admin/audit`                    | Cross-cutting audit explorer (ADMIN-only): filter by actor / target / op / time window, paginate | [hangar-audit-explorer](../../work-packages/hangar-audit-explorer/spec.md)           |
| `/admin/audit/[id]`               | Detail view: actor card, side-by-side before/after jsonb panes, metadata, cross-links            | [hangar-audit-explorer](../../work-packages/hangar-audit-explorer/spec.md)           |
| `/ingest-review`                  | Plugin-shaped queue for residual ingest-pipeline issues (figure-pairing orphans today)           | [hangar-ingest-review-queue](../../work-packages/hangar-ingest-review-queue/spec.md) |
| `/ingest-review/[issueId]`        | Orphan-card with caption text, candidate-strip, action bar, PDF link                             | [hangar-ingest-review-queue](../../work-packages/hangar-ingest-review-queue/spec.md) |
| `/courses`                        | Course list: slug/title/kind/status/section count/updated; create + delete actions               | [course-reader-and-editor](../../work-packages/course-reader-and-editor/spec.md)     |
| `/courses/[slug]`                 | Course manifest editor + section list (reorder/delete) + orphan-row cleanup                      | [course-reader-and-editor](../../work-packages/course-reader-and-editor/spec.md)     |
| `/courses/[slug]/sections/[code]` | Section editor: section fields + step CRUD via KnowledgeNodePicker                               | [course-reader-and-editor](../../work-packages/course-reader-and-editor/spec.md)     |
| Auth gate                         | Layout-level `requireRole(AUTHOR                                                                 | OPERATOR                                                                             |

## In flight or imminent

| Item                        | State       | Notes                                                                                                                                                                                 |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hangar Playwright e2e infra | Not started | Tracked at [hangar-e2e-infrastructure](../../work-packages/hangar-e2e-infrastructure/spec.md). Prerequisite for the deferred audit-explorer + users-editing + invite-flow e2e suites. |
| Scenarios authoring         | Not scoped  | Will follow the scenario tick model from `airboss-firc/libs/engine/`. Stand up only after engine migrates.                                                                            |
| Cards authoring             | Not scoped  | Cards (study) are seeded today; admin authoring UI is downstream of stable card spec.                                                                                                 |

## Tracking

- Feature work packages: [docs/work-packages/](../../work-packages/) -- co-located spec + tasks + test-plan + design.
- Session todos: [docs/work/todos/](../../work/todos/) -- per-session, committed with the work.
- Cross-product roadmap: [docs/platform/ROADMAP.md](../../platform/ROADMAP.md).

## Dormant

The FIRC-era PRD covered a large FAA-submission surface (sections A-E in the archived doc): scenario editor, student model editor, module editor, competency registry, knowledge-check editor, micro-lesson editor, content workflow, content versioning UI, content-validation engine, traceability matrix editor, TCO editor, FAA package generator, submission tracker, regulatory-change monitor, compliance dashboard, reference-document store + linking, task board, backlog, activity log, auto-generated tasks, coverage dashboard, scenario inventory, question-bank stats, time projection.

**Status:** dormant. **Trigger to reawaken:** a FIRC content pack (or any Part 141 / WINGS module) ships and demands FAA-traceable submission. **Where the work lives:** [.archive/products/hangar/](../../.archive/products/hangar/). **Decision record:** [ADR 017](../../decisions/017-firc-compliance-dormant.md).

Some pieces (audit, content versioning, content workflow) may earn a non-FIRC home as cross-cutting platform features. That's a separate decision; not in scope here.

## Out of scope

- **Project / task management.** GitHub Issues handles this. A platform-internal task surface may earn a place in hangar later if content workflows demand it -- not now.
- **Public-facing content.** That's the runway app.
- **Learner experience.** That's study, spatial, audio, etc.
