---
title: airboss Platform Roadmap
type: roadmap
status: current
date: 2026-04-26
supersedes: ../.archive/platform/ROADMAP.md
---

# Platform Roadmap

What gets built, in what order, across the airboss platform. No fixed dates. Per-feature phasing lives in [docs/work-packages/](../work-packages/); per-app phasing lives in each app's `ROADMAP.md`.

For the why, see [VISION.md](VISION.md). For the surface architecture, see [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md).

## Where we are (2026-04-26)

Three apps active in airboss:

- **study** -- spaced cards, knowledge graph, decision reps, calibration tracker, learning dashboard, content authoring co-located. Multiple work packages shipped (see [docs/work/NOW.md](../work/NOW.md)).
- **sim** -- flight-dynamics simulator with hand-rolled C172 FDM, scenarios, debrief, scoring. Phase 4-6 push complete; Phase 7 (3D horizon) introduced surface-loose-coupling per [ADR 015](../decisions/015-sim-surface-loose-coupling.md).
- **hangar** -- operator app: sources pipeline, glossary, jobs, read-only users surface, dashboard. Three-area model (Content / People / System) per [hangar VISION](../products/hangar/VISION.md).

FIRC compliance machinery is dormant per [ADR 017](../decisions/017-firc-compliance-dormant.md).

## Near-term (next 1-3 features)

Ordered by what unblocks the most downstream work.

| Surface | Work                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| study   | Calibration improvements, more knowledge-graph content, content authoring polish                                |
| sim     | Phase 7 horizon view continuation; cockpit panel extraction (per ADR 015 follow-up note); more scenarios        |
| hangar  | Real audit explorer (replaces audit-ping); /users editing (role assign, ban/unban, session revoke); invite flow |

Specifics live in each app's roadmap and the per-feature work packages.

## Medium-term (after near-term lands and proves stable)

| Surface     | Work                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **spatial** | First map-based surface. Probably route rehearsal as the v1 hook (per [PIVOT.md](PIVOT.md) "what's worth building"). |
| **audio**   | First narrative surface. NTSB stories or daily-decision drill as the lead.                                           |
| **reflect** | Journals, heatmaps, currency tracking, decision diary.                                                               |
| sim         | Additional aircraft profiles (PA-28 done; Cherokee, complex/HP, glass).                                              |
| hangar      | Scenario authoring UI (downstream of stable scenario schema). Cards authoring (downstream of stable card spec).      |

## Long-term (v3+ horizon)

| Surface             | Work                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **avionics**        | Glass cockpit trainer (G1000 / G3000 / Garmin avionics).                                                    |
| **firc**            | Migration from airboss-firc as `apps/firc/`. Restores dormant compliance docs per ADR 017 + migration plan. |
| **runway**          | Public site -- open-source landing, free content, signup if/when applicable.                                |
| Multiplayer         | One pilot/instructor pair, or ATC + pilot + instructor roles. Not before v1 ships.                          |
| Open-source release | License (open core leaning) + first public commit. Pre-launch tasks: name, license, hosting model.          |

## Cross-cutting

These run across all surfaces and don't fit a single app's roadmap:

- **Theme system** -- shipped per [docs/platform/theme-system/](theme-system/00-INDEX.md).
- **Auth + identity** -- shipped per [ADR 007](../decisions/007-AUTH_TOPOLOGY.md). Better Auth on `*.airboss.test`. Cross-subdomain session cookie. Future: invite flow, role editing UI.
- **Audit + content versioning** -- shipped per [ADR 005](../decisions/005-PUBLISHED_CONTENT.md), [ADR 006](../decisions/006-CONTENT_VERSIONING.md). Schema rigor stays even though FIRC submission is dormant.
- **Reference / glossary pipeline** -- shipped per [docs/work-packages/hangar-sources-v1/](../work-packages/hangar-sources-v1/spec.md), [docs/platform/REFERENCE_SYSTEM_FLOW.md](REFERENCE_SYSTEM_FLOW.md).
- **Knowledge graph** -- foundation shipped per [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md). Ongoing content authoring.
- **Cert/syllabus/goal/lens model** -- foundation per [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md). Ongoing wiring across surfaces.

## What's NOT on the roadmap

- **FAA submission machinery.** Dormant per [ADR 017](../decisions/017-firc-compliance-dormant.md). Returns only if a content pack ships and a partner pursues approval.
- **Project / task management** in hangar. GitHub Issues handles this.
- **Marketing surface.** Until v1 ships, runway is a placeholder.
- **Payment / billing infrastructure.** Not before a v1 launch decides on hosting + monetization.

## Links to per-app roadmaps

- [study](../products/study/ROADMAP.md)
- [sim](../products/sim/ROADMAP.md)
- [hangar](../products/hangar/PRD.md) (per-PRD timing tables; no separate ROADMAP)

## What this doc is for

A platform-wide "what's coming" anchor. Quick context for new contributors and a sanity check that the per-app roadmaps add up. **Not** a contract -- priorities shift as user-zero (Joshua) hits new flying milestones and the platform reshapes around them.
