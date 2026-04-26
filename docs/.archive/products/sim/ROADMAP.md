# Sim Roadmap

Feature phases for the sim app. Aligned with [platform roadmap](../../platform/ROADMAP.md).

## Current Work

**Phase 2 -- Sim Core** `[DONE]`
Next: Phase 3 (Ops Integration) -- see [TASKS.md](TASKS.md)
Phase index: [features/PHASE2.md](features/PHASE2.md)

## Phase 2 -- Sim Core `[DONE]`

Learner-facing course execution. Depends on published content from hangar.

| Feature                                          | Size   | Status      |
| ------------------------------------------------ | ------ | ----------- |
| [Sim app shell](features/sim-shell/)             | Large  | Implemented |
| [Discovery](features/discovery/)                 | Large  | Implemented |
| [Scenario player](features/scenario-player/)     | Large  | Implemented |
| [Debrief](features/debrief/)                     | Large  | Implemented |
| [Progress tracking](features/progress-tracking/) | Medium | Implemented |
| [Knowledge checks](features/knowledge-checks/)   | Medium | Implemented |

**Exit criteria:** A learner can log in, complete discovery, play a published scenario, see a debrief, and track progress. FAA time tracking works.

## Phase 3 -- Ops Integration `[NOT STARTED]`

After ops foundation exists, sim gets:

- Enrollment auto-creation on first login (or ops-managed, TBD by ADR)
- Certificate display (issued by ops)
- Progress visible to operators

## Phase 4 -- Advanced Engine `[NOT STARTED]`

Adaptive layer on top of scripted scenarios:

- Student model adaptation (behavior varies based on prior runs)
- Spaced repetition (resurface missed competencies)
- Difficulty scaling

## Phase 5 -- Social + Polish `[NOT STARTED]`

- Greenie board (anonymous, comparative)
- Multiplayer debrief mode (watch + comment on another learner's tape)
- Performance analytics for the learner
