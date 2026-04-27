---
title: Sim Roadmap
product: sim
type: roadmap
status: current
date: 2026-04-26
supersedes: ../../.archive/products/sim/ROADMAP.md
---

# Sim Roadmap

Per-phase roadmap for `apps/sim/`. Aligned with [docs/platform/ROADMAP.md](../../platform/ROADMAP.md).

For the why, see [VISION.md](VISION.md). For shipped + queued features, see [PRD.md](PRD.md). For the canonical spec, see [docs/work-packages/flight-dynamics-sim/spec.md](../../work-packages/flight-dynamics-sim/spec.md).

## Where we are

Phases 0-6 of the [staged plan](../../work/plans/20260422-flight-dynamics-sim-plan.md) are complete. Phase 7 (3D horizon view) is in flight per [ADR 015](../../decisions/015-sim-surface-loose-coupling.md). Multiple shipped PRs in the 2026-04-25 NOW.md sweep delivered debrief, scrubber, scenario grading, additional scenarios, PA-28 profile, engine sound, annunciator, theme tokens.

## Active

- **Phase 7 -- 3D horizon view.** Surface-loose-coupled per ADR 015. Continuing visual fidelity work; instrument-strip composition refinement.
- **Cockpit panel extraction.** Per ADR 015 follow-up: extract `CockpitPanel.svelte` from the fat cockpit page so the dual page can render the full panel (not just four gauges).

## Queued

| Phase | Work                                          | Trigger to start                                                                  |
| ----- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| 8     | Cherokee variant aircraft profile             | After Phase 7 stable                                                              |
| 9     | More scenarios (crosswind, gust front, etc.)  | Continuous; lands as scenarios are authored                                       |
| 10    | Complex / HP aircraft profile                 | After Cherokee profile proves the multi-profile authoring flow                    |
| 11    | Glass cockpit profile                         | Likely overlaps with `apps/avionics/` becoming a real surface                     |
| 12    | Pre-brief surface                             | When VISION's "core loop" needs the brief side built out                          |

## Future

- **`apps/avionics/` glass cockpit trainer.** A separate surface that may share components with sim's cockpit page (per ADR 015's "no edits to existing pages -- additive" pattern).
- **Multiplayer (one pilot + one observer)**. Not before v1 ships.
- **Recording playback as content.** Pilot's run becomes a teaching artifact for another learner.

## What's NOT on the roadmap

- **3D scenery / world rendering.** Sim is instruments-first; the horizon is minimal by design.
- **AI traffic / ATC.**
- **FAA log credit / anti-cheating machinery.** Out of scope per [PRD.md](PRD.md).
- **Hardware integration (yokes, rudders, panels).** Browser keyboard / mouse only.

## References

- [VISION.md](VISION.md)
- [PRD.md](PRD.md)
- [docs/work-packages/flight-dynamics-sim/spec.md](../../work-packages/flight-dynamics-sim/spec.md)
- [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../../work/plans/20260422-flight-dynamics-sim-plan.md)
- [ADR 015](../../decisions/015-sim-surface-loose-coupling.md)
