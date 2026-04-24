# Sim Tasks

Product backlog for sim. Phase 2 complete.

## Completed (Phase 2)

| #   | Feature           | Size   | Link                                                       | Status |
| --- | ----------------- | ------ | ---------------------------------------------------------- | ------ |
| 1   | Sim app shell     | Large  | [features/sim-shell/](features/sim-shell/)                 | Done   |
| 2   | Discovery         | Large  | [features/discovery/](features/discovery/)                 | Done   |
| 3   | Progress tracking | Medium | [features/progress-tracking/](features/progress-tracking/) | Done   |
| 4   | Knowledge checks  | Medium | [features/knowledge-checks/](features/knowledge-checks/)   | Done   |
| 5   | Scenario player   | Large  | [features/scenario-player/](features/scenario-player/)     | Done   |
| 6   | Debrief           | Large  | [features/debrief/](features/debrief/)                     | Done   |

## Up Next (Phase 3)

- Enrollment coordination with ops (auto-create vs ops-create -- needs ADR decision)
- Certificate display in sim
- Progress visibility to operators

## Up Next (Phase 6)

- Adaptive student model
- Spaced repetition engine
- Greenie board
- Multiplayer debrief

## Notes

- Engine implemented: `libs/engine/src/tick.ts` has full scripted tick engine with 31 unit tests.
- Demo scenario: `bun db reset --force` seeds all scenarios, questions, and a test enrollment.
- All features pass `bun run check` (0 errors, 0 warnings) and `bun run test` (196 tests, 0 failures).
- Phase 2 complete -- all features implemented and manually tested.
