---
title: Hangar Roadmap (pre-ADR-025 hand-authored copy)
product: hangar
type: roadmap
status: archived
date: 2026-04-30
archived_date: 2026-05-07
archive_reason: Replaced by generator-driven ROADMAP per ADR 025 Phase 4
---

# Hangar Roadmap (pre-ADR-025 hand-authored copy)

Archived 2026-05-07 when the per-product `ROADMAP.md` files moved to the
generator-driven view defined by [ADR 025](../../../decisions/025-wp-frontmatter-contract/decision.md).
The trigger conditions and "what's not on the roadmap" notes don't fit the
WP-frontmatter schema yet; preserved here so they remain findable.

---

# Hangar Roadmap

Per-phase roadmap for `apps/hangar/`. Aligned with [docs/platform/ROADMAP.md](../../../platform/ROADMAP.md).

For the why, see [VISION.md](../../../products/hangar/VISION.md). For shipped surfaces, see [PRD.md](../../../products/hangar/PRD.md). For the FIRC-era dormant scope, see [.archive/products/hangar/PRD.md](../hangar/PRD.md) and [ADR 017](../../../decisions/017-firc-compliance-dormant.md).

## Where we are

Hangar ships an authoring + admin surface today: dashboard with three tiles (Content, People, System), source pipeline (`/sources`, `/sources/[id]`), glossary registry (`/glossary`, `/glossary/[id]`), user explorer + editor (`/users`, `/users/[id]` -- role / ban / revoke), invitation flow (`/users/invitations`, `/users/invitations/[id]`), background job log (`/jobs`), and the cross-cutting audit explorer (`/admin/audit`, `/admin/audit/[id]`). Layout-level role gating is in place.

## Active

## Queued

| Item                | Notes                                                                                | Trigger to start                    |
| ------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Scenarios authoring | Follows the scenario tick model from `airboss-firc/libs/engine/`                     | After engine migrates into airboss  |
| Cards authoring     | Cards (study) are seeded today; admin authoring UI is downstream of stable card spec | After card spec stabilizes in study |

## Future

- **Knowledge-graph node authoring.** Atomic ADR-011 nodes currently live in `apps/study/`; an authoring surface in hangar earns its place once node count + edit frequency demand it.
- **Content workflow + versioning UI.** Cross-cutting authoring concerns (draft/review/publish, diff, rollback). Likely earns a non-FIRC home as a platform feature.
- **Reference-document linking surface.** Beyond the existing `/sources` pipeline -- a UI for relating sources to cards, knowledge nodes, and scenarios.

## What's NOT on the roadmap

- **FIRC-specific submission surfaces.** Scenario editor, student model editor, module editor, competency registry, knowledge-check editor, micro-lesson editor, content-validation engine, traceability matrix editor, TCO editor, FAA package generator, submission tracker, regulatory-change monitor, compliance dashboard. All dormant per [ADR 017](../../../decisions/017-firc-compliance-dormant.md). Trigger to reawaken: a FIRC content pack (or any Part 141 / WINGS module) ships and demands FAA-traceable submission.
- **Project / task management.** GitHub Issues handles this.
- **Public-facing content.** That's the runway app.
- **Learner experience.** That's study, spatial, audio, etc.

## References

- [VISION.md](../../../products/hangar/VISION.md)
- [PRD.md](../../../products/hangar/PRD.md)
- [ADR 017 -- FIRC compliance dormant](../../../decisions/017-firc-compliance-dormant.md)
- [docs/platform/ROADMAP.md](../../../platform/ROADMAP.md)
- [.archive/products/hangar/PRD.md](../hangar/PRD.md) -- dormant FIRC-era scope
