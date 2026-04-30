---
title: Hangar Roadmap
product: hangar
type: roadmap
status: current
date: 2026-04-30
---

# Hangar Roadmap

Per-phase roadmap for `apps/hangar/`. Aligned with [docs/platform/ROADMAP.md](../../platform/ROADMAP.md).

For the why, see [VISION.md](VISION.md). For shipped surfaces, see [PRD.md](PRD.md). For the FIRC-era dormant scope, see [.archive/products/hangar/PRD.md](../../.archive/products/hangar/PRD.md) and [ADR 017](../../decisions/017-firc-compliance-dormant.md).

## Where we are

Hangar ships an authoring + admin surface today: dashboard with three tiles (Content, People, System), source pipeline (`/sources`, `/sources/[id]`), glossary registry (`/glossary`, `/glossary/[id]`), read-only user explorer (`/users`, `/users/[id]`), background job log (`/jobs`), and audit-ping scaffold (`/admin/audit-ping`). Layout-level role gating is in place.

## Active

- **Real audit explorer.** Replaces `/admin/audit-ping` as the System -> Audit destination. Filter by actor, target, op, time window. First non-scaffold System surface.

## Queued

| Item                        | Notes                                                                                                                  | Trigger to start                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `/users` editing            | Role assignment, ban/unban, session revoke. First admin-write surface; dual-gate `requireRole(ADMIN)` on load + action | After audit explorer ships                                  |
| Invite flow                 | Better Auth invite token, email send (infra exists in `libs/auth/src/email/`), accept route on study side              | After `/users` editing lands the admin-write pattern        |
| Scenarios authoring         | Follows the scenario tick model from `airboss-firc/libs/engine/`                                                       | After engine migrates into airboss                          |
| Cards authoring             | Cards (study) are seeded today; admin authoring UI is downstream of stable card spec                                   | After card spec stabilizes in study                         |

## Future

- **Knowledge-graph node authoring.** Atomic ADR-011 nodes currently live in `apps/study/`; an authoring surface in hangar earns its place once node count + edit frequency demand it.
- **Content workflow + versioning UI.** Cross-cutting authoring concerns (draft/review/publish, diff, rollback). Likely earns a non-FIRC home as a platform feature.
- **Reference-document linking surface.** Beyond the existing `/sources` pipeline -- a UI for relating sources to cards, knowledge nodes, and scenarios.

## What's NOT on the roadmap

- **FIRC-specific submission surfaces.** Scenario editor, student model editor, module editor, competency registry, knowledge-check editor, micro-lesson editor, content-validation engine, traceability matrix editor, TCO editor, FAA package generator, submission tracker, regulatory-change monitor, compliance dashboard. All dormant per [ADR 017](../../decisions/017-firc-compliance-dormant.md). Trigger to reawaken: a FIRC content pack (or any Part 141 / WINGS module) ships and demands FAA-traceable submission.
- **Project / task management.** GitHub Issues handles this.
- **Public-facing content.** That's the runway app.
- **Learner experience.** That's study, spatial, audio, etc.

## References

- [VISION.md](VISION.md)
- [PRD.md](PRD.md)
- [ADR 017 -- FIRC compliance dormant](../../decisions/017-firc-compliance-dormant.md)
- [docs/platform/ROADMAP.md](../../platform/ROADMAP.md)
- [.archive/products/hangar/PRD.md](../../.archive/products/hangar/PRD.md) -- dormant FIRC-era scope
