# ADR 017 -- FIRC compliance surface dormant in hangar

**Status:** Accepted
**Date:** 2026-04-26
**Context:** Hangar VISION/PRD rewrite post-pivot

## Problem

The pre-pivot hangar PRD ([.archive/products/hangar/PRD.md](../.archive/products/hangar/PRD.md)) defined a 425-line surface with five capability areas: course content management, FAA compliance and document management, reference document library, product and task management, content analytics. Roughly 80% of that doc was FAA-submission machinery -- traceability matrix editor, TCO editor, FAA package generator, submission tracker, regulatory-change monitor, content-validation engine tied to AC 61-83K's "13 core topics × 45 min × 60+ questions" rules.

[PIVOT.md](../platform/PIVOT.md) (2026-04-14) explicitly killed FIRC as the headline product. Quote: *"TSA 5-year retention, 24-month FAA retention, TCO submission, Appendix A 90-day policy check -- all deferred to if/when a FIRC module ships."* The compliance bounded context is preserved in the schema but marked dormant by default.

Two failure modes if we don't decide explicitly:

1. The FIRC PRD stays live and pulls every future hangar feature toward FAA-traceability framing that's no longer load-bearing -- shaping schema, UI, and prioritization around dormant requirements.
2. We delete the FIRC work outright. Years of submission-machinery design disappears, and the work has to be reinvented from scratch when a FIRC pack (or any Part 141 / WINGS module) wants FAA approval later.

## Decision

**Archive the FIRC-era hangar product docs and the FIRC-era hangar feature specs to [docs/.archive/products/hangar/](../.archive/products/hangar/). Keep the compliance schema. Write a thin replacement VISION/PRD that names the dormancy explicitly.**

| What                                                                                                                                                                          | Where now                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| FIRC-era VISION, PRD, ROADMAP, TASKS                                                                                                                                          | [.archive/products/hangar/](../.archive/products/hangar/)                                     |
| FIRC-era feature specs (analytics, auth, content-crud, content-validation, content-versioning, publish, published-viewer, reference-library, task-board, traceability-matrix) | [.archive/products/hangar/features/](../.archive/products/hangar/features/)                   |
| FIRC-era PHASE1.md status doc                                                                                                                                                 | [.archive/products/hangar/features/PHASE1.md](../.archive/products/hangar/features/PHASE1.md) |
| Compliance bounded context (schema, audit columns)                                                                                                                            | Stays where it is. Dormant != deleted.                                                                          |
| New hangar VISION + PRD                                                                                                                                                       | [docs/products/hangar/VISION.md](../products/hangar/VISION.md), [PRD.md](../products/hangar/PRD.md)             |

Three areas in the new hangar: Content, People, System. Compliance is **not** a fourth area today. It becomes one when reawakened.

## Reawakening triggers

The dormant work returns under any of these:

1. A FIRC content pack ships and the team chooses to seek FAA FIRC approval.
2. A Part 141 ground-school module ships and needs the FAA submission packet.
3. A WINGS-credit module ships and needs FAA traceability.
4. Any other regulatory regime (international, military, internal compliance audits) imposes traceability requirements on any content surface.

When triggered: read the archived PRD, port the still-relevant pieces against the current platform conventions (do **not** restore wholesale -- ID strategy, route taxonomy, role model, theme tokens have all evolved), and grow the new content into hangar's existing three-area structure as a fourth "Compliance" area.

## How we remember this

Three pointers ensure rediscovery:

1. **[VISION.md](../products/hangar/VISION.md) "Dormant: FIRC compliance" section** -- linked from the live doc, points at this ADR and the archive.
2. **[PRD.md](../products/hangar/PRD.md) "Dormant" section** -- enumerates what was archived so a reader sees the surface area at a glance.
3. **[MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) FIRC migration plan** -- when `apps/firc/` migrates from airboss-firc, the migration plan gets a bullet to consider restoring archived hangar compliance docs.

Plus a memory entry (`project_firc_compliance_dormant`) so future sessions surface this when relevant.

## Consequences

**Today:**

- The new VISION/PRD describe what hangar actually is post-pivot. A reader doesn't have to mentally subtract dormant FAA machinery to understand the live surface.
- The compliance schema stays. `audit.audit_log` and content-versioning columns continue to do their cross-cutting job for non-FIRC content; nothing breaks.
- Inbound links from session-scoped docs (`docs/work/todos/*`, `docs/work/reviews/*`) point at archived paths. Those docs are session-scoped and not worth backfilling.
- [docs/platform/ROADMAP.md](../platform/ROADMAP.md) is still FIRC-phased and references archived hangar docs; PIVOT.md flagged it for rewrite. Out of scope for this ADR.

**On reawakening:**

- The archive is read-only history. New work happens in hangar under a new "Compliance" area, not by editing the archive.
- Schema changes from dormancy-period work (audit, versioning) take precedence over archive prose; the archive is design intent, not authoritative spec.
- This ADR is not amended on reawakening. A new ADR ("ADR NNN -- restore compliance surface") supersedes it.

**What this prevents:**

- The "FIRC Boss" mental model leaking into platform-shape decisions for non-FIRC features.
- Years of submission-machinery design being lost or reinvented.
- The dormant work staying invisible -- VISION/PRD/ADR/architecture-doc/memory all carry the pointer.
