# Sim Phase 2: Sim Core

Six features. Implement in order. Test each before moving to the next.

## Setup

```bash
bun db reset --force            # fresh DB with schema, all seeds, published release + test enrollment
bun scripts/dev.ts sim          # start sim at localhost:7600
```

Sign in with `joshua@ball.dev` / `Pa33word!` (seeded dev user).

**Prerequisites:**

- Phase 1 (Hangar) must be complete and merged to main.
- At least one published release must exist in hangar before testing scenario player or knowledge checks.
- An enrollment record must exist for the dev user (create manually in ops or via seed script -- ops enrollment feature is Phase 3).
- Demo scenario seed script creates a playable scenario for testing.

## Features

| #   | Feature                                 | Size   | Work package                                 | Status | Test plan                                      | Tested |
| --- | --------------------------------------- | ------ | -------------------------------------------- | ------ | ---------------------------------------------- | ------ |
| 1   | [Sim App Shell](sim-shell/)             | Large  | spec, user-stories, design, tasks, test-plan | Done   | [test-plan.md](sim-shell/test-plan.md)         | [x]    |
| 2   | [Discovery](discovery/)                 | Large  | spec, user-stories, design, tasks, test-plan | Done   | [test-plan.md](discovery/test-plan.md)         | [x]    |
| 3   | [Progress Tracking](progress-tracking/) | Medium | spec, tasks, test-plan                       | Done   | [test-plan.md](progress-tracking/test-plan.md) | [x]    |
| 4   | [Knowledge Checks](knowledge-checks/)   | Medium | spec, tasks, test-plan                       | Done   | [test-plan.md](knowledge-checks/test-plan.md)  | [x]    |
| 5   | [Scenario Player](scenario-player/)     | Large  | spec, user-stories, design, tasks, test-plan | Done   | [test-plan.md](scenario-player/test-plan.md)   | [x]    |
| 6   | [Debrief](debrief/)                     | Large  | spec, user-stories, design, tasks, test-plan | Done   | [test-plan.md](debrief/test-plan.md)           | [x]    |

## Test Order

Test in this order -- later features depend on earlier ones having data.

1. **Sim App Shell** -- log in, navigate, log out, theme toggle. Everything else requires auth.
2. **Discovery** -- complete profile intake. Sets learner_profile, required before progress tracking shows meaningful data.
3. **Progress Tracking** -- view module progress, FAA time, completion checklist. Requires enrollment record.
4. **Knowledge Checks** -- answer questions. Requires published release with questions.
5. **Scenario Player** -- play a scenario. Requires published release with at least one scenario + student model.
6. **Debrief** -- review the run. Requires a completed scenario run from step 5.

## Test Notes

- **Enrollment record required for steps 3-6.** Until Phase 3 (ops), create one manually:
  ```sql
  INSERT INTO enrollment.enrollment (id, user_id, release_id, status)
  VALUES ('test-enrollment-1', '<dev-user-id>', '<latest-release-id>', 'active');
  ```
- **Published release required for steps 4-6.** Publish from hangar first.
- **Scenario player requires tick script in published scenario.** The demo seed script adds a complete scenario with a 4-tick script.
- **Discovery can be skipped.** Profile intake has a skip button. Engine uses default parameters when profile is absent.
- **All routes except /login are auth-protected.** Unauthenticated access redirects to /login.

## Exit Criteria

- [x] All 6 features pass their manual test plans
- [x] A learner can log in, complete discovery, play a scenario, see a debrief, and view progress
- [x] FAA time logging records qualified vs. exploratory time correctly
- [x] `bun run check` passes with 0 errors, 0 warnings
- [x] `bun run test` passes (196 tests, 0 failures)
- [x] No regressions in hangar or other apps

## Deferred

- Automated enrollment creation (Phase 3 -- ops manages enrollments)
- Adaptive student model (Phase 6 -- scripted engine only for Phase 2)
- Certificate display (Phase 3)
- Greenie board (Phase 6)
- Replay debrief mode (Phase 6)
- Tier A sequential IDs via Postgres SEQUENCE (ADR-010 migration deferred)
