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

For the why, see [VISION.md](VISION.md). For the FIRC-era PRD (425 lines of dormant submission machinery), see [.archive/products/hangar/PRD.md](../../.archive/products/hangar/PRD.md).

## Shipped

| Surface             | What it does                                                                                    | Spec                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/` dashboard       | Three tiles -- Content, People, System -- with live counts                                      | --                                                                   |
| `/sources`          | Reference-document pipeline: register, fetch, extract, diff, validate                           | [hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)   |
| `/sources/[id]`     | Source detail + filesystem browser                                                              | [hangar-sources-v1](../../work-packages/hangar-sources-v1/spec.md)   |
| `/glossary`         | Term registry: definitions, citations, knowledge-kind taxonomy                                  | [hangar-non-textual](../../work-packages/hangar-non-textual/spec.md) |
| `/glossary/[id]`    | Term detail + edit                                                                              | [hangar-non-textual](../../work-packages/hangar-non-textual/spec.md) |
| `/users`            | Read-only user list (ADMIN-only): name, email, role, last seen, banned                          | --                                                                   |
| `/users/[id]`       | Read-only user detail (ADMIN-only): sessions + audit by actor                                   | --                                                                   |
| `/jobs`             | Background-job log with 1Hz live polling                                                        | [hangar-registry](../../work-packages/hangar-registry/spec.md)       |
| `/admin/audit-ping` | Scaffold-era heartbeat -- kept as System -> Audit destination until a real audit explorer lands | [hangar-scaffold](../../work-packages/hangar-scaffold/spec.md)       |
| Auth gate           | Layout-level `requireRole(AUTHOR                                                                | OPERATOR                                                             |

## In flight or imminent

| Item                                                          | State       | Notes                                                                                                                    |
| ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Real audit explorer                                           | Not started | Replaces audit-ping as the System -> Audit destination. Filter by actor / target / op / window.                          |
| `/users` editing (role assignment, ban/unban, session revoke) | Not started | First admin-write surface. Should follow dual-gate pattern: load + every form action `requireRole(ADMIN)`.               |
| Invite flow                                                   | Not started | Email infra exists in `libs/auth/src/email/`. Onboard: Better Auth invite token, email send, accept route on study side. |
| Scenarios authoring                                           | Not scoped  | Will follow the scenario tick model from `airboss-firc/libs/engine/`. Stand up only after engine migrates.               |
| Cards authoring                                               | Not scoped  | Cards (study) are seeded today; admin authoring UI is downstream of stable card spec.                                    |

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
