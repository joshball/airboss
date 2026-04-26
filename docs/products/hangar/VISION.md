---
title: Hangar Vision
product: hangar
type: vision
status: current
date: 2026-04-26
supersedes: ../../.archive/firc-era/products/hangar/VISION.md
---

# Hangar Vision

The operator app for airboss. Where the human running the platform does work that learners and pilots never see.

## What it is

One place to author content, manage people, and run platform operations -- across every learner-facing surface (study, spatial, audio, reflect, avionics, future firc). Hangar isn't tied to a content theme; it's the upstream surface every other surface depends on.

## Who it's for

| Audience              | What they do here                                                              |
| --------------------- | ------------------------------------------------------------------------------ |
| Joshua (today)        | Everything -- author, admin, ops                                               |
| Future contributors   | Author scenarios, cards, routes, glossary entries (open-source posture)        |
| Future platform admin | User management, moderation, audit review                                      |

Today these are one person. The system should work for one person doing everything and scale to a team with distinct roles.

## What it does

Three areas:

| Area        | What lives here                                                                                       | Status                            |
| ----------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Content** | Sources, glossary, scenarios, cards, routes, modules -- the upstream of every learner surface         | Sources + glossary shipped        |
| **People**  | Users, sessions, invites, bans, audit-by-actor                                                        | Read-only `/users` shipped        |
| **System**  | Job queue, audit log, diagnostics, future feature flags                                               | Jobs + audit-ping shipped         |

Each area is a section in the top nav. Sub-pages live underneath.

## What it serves

```text
                    learner surfaces
                    ┌─ study     (cards, quizzes, reps)
                    ├─ spatial   (route, airport, airspace)
hangar ──┬── feeds ─┼─ audio     (NTSB, drills, ATC)
(content)│          ├─ reflect   (journals, heatmaps)
         │          ├─ avionics  (panel trainer)
         │          └─ firc      (course, when migrated)
         │
         └── operates: users, sessions, audit, jobs (across all surfaces)
```

Authoring once feeds many surfaces. A scenario authored in hangar runs in study as a card and in audio as a narrative drill. Single-source-of-truth, surface-specific rendering.

## What it's NOT

- **Not a learner experience.** Learners use study/spatial/audio/etc.
- **Not a project management tool.** GitHub Issues / Linear handle that better. A future internal task board may live here, but only if it earns its place by serving content workflows the issue tracker can't.
- **Not an FAA-submission tool by default.** Submission machinery is dormant -- see "Dormant: FIRC compliance" below.

## Design principles

- **Audit everything.** Every authoring action and every admin action is tracked. Carries from FIRC-era requirements; still load-bearing.
- **Link everything.** Sources cite glossary terms; scenarios cite sources; cards cite scenarios. Navigate any direction.
- **Single operator-mental-model across surfaces.** One author flow, regardless of whether the artifact ends up in study or spatial or audio.
- **Validate continuously.** Citation drift, broken wiki-links, stale references caught on every change, not at submission time.
- **Simple until proven otherwise.** Form-based editing over CMS sophistication. Markdown over rich-text. Add complexity only when the simple version fails.

## Roadmap

Per-area phasing. No fixed dates.

| Area    | Now                          | Next                                                         | Later                                            |
| ------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Content | Sources, Glossary            | Scenarios authoring, Cards authoring                         | Routes, Modules, Cross-surface authoring shell   |
| People  | Read-only `/users`           | Role editing, ban/unban, session revoke, invite flow         | Per-user activity heatmap, content attribution   |
| System  | Jobs, audit-ping diagnostic  | Real audit explorer (filter by actor / target / op / window) | Feature flags, diagnostics dashboard, queue ops  |

The dashboard at `/` aggregates one stat per area. Each area gets its own surface as features land.

## Dormant: FIRC compliance

The FIRC-era hangar carried a large FAA-submission surface: TCO editor, traceability matrix, FAA package generator, submission tracker, regulatory-change monitor, content lifecycle states, content-validation engine, content versioning UI. Per [PIVOT.md](../../platform/PIVOT.md), this is **dormant, not deleted**. The schema rigor stays; the UI is archived.

| Where the dormant work lives                           | When it wakes up                                              |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| [.archive/firc-era/products/hangar/](../../.archive/firc-era/products/hangar/) | A FIRC content pack (or any Part 141 / WINGS module) ships    |
| [ADR 017](../../decisions/017-firc-compliance-dormant.md) | The decision record explaining what was dormanted and why      |

When that day comes: restore from the archive, integrate against current platform conventions, and resume.

## References

- [docs/platform/PIVOT.md](../../platform/PIVOT.md) -- why hangar's scope changed
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- surface architecture; hangar is upstream of every learner app
- [ADR 017 -- FIRC compliance dormant](../../decisions/017-firc-compliance-dormant.md) -- archival decision and reawakening trigger
- [.archive/firc-era/products/hangar/VISION.md](../../.archive/firc-era/products/hangar/VISION.md) -- the prior FIRC-era vision
