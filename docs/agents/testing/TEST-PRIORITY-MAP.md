# Automated Test Priority Map

Code test coverage priorities -- what to test and in what order. Each row is a test file to create. This is about code tests (Vitest/Playwright), not FAA content coverage.

**Current state (2026-03-27):**

| Layer                                     | Status                       | Count                                           |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------- |
| P1: Critical path unit/integration        | Done                         | ~80 tests                                       |
| P2: Core BC integration                   | Done                         | ~65 tests                                       |
| P3 unit: Compliance, platform BCs         | Done                         | ~22 tests                                       |
| P3 E2E: Auth + login flows                | Done                         | ~11 tests (hangar)                              |
| P4 E2E: Content CRUD, task-board, publish | Done                         | ~24 tests (hangar)                              |
| P4 E2E: Sim flows                         | Written (stubs, `test.todo`) | 22 todos                                        |
| P5: Engine tests                          | Written (stubs, `it.todo`)   | 30 todos                                        |
| Coverage config                           | Done                         | `@vitest/coverage-v8` installed, thresholds set |

**To run:**

- Unit/integration: `bun test` (requires live DB)
- E2E: `bun run test:e2e` (requires hangar running on :7610, env vars set)
- Coverage: `bun run test:coverage`

---

## Priority 1 -- Critical Path

These block FAA compliance or security. Do these first.

| Test file                              | What it covers                                                  | Key cases                                                                          |
| -------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `libs/bc/course/src/publish.test.ts`   | `publishRelease()` atomicity                                    | Full success, partial failure rolls back, version assigned, counts returned        |
| `libs/types/src/schemas.test.ts`       | All Zod schemas                                                 | Valid input passes, each required field fails alone, enums, min/max, array lengths |
| `libs/ui/src/form-helpers.test.ts`     | `formString`, `formNumber`, `formStringArray`, `parseZodErrors` | Missing keys, File objects, null, empty string, array dedup                        |
| `libs/auth/src/guards.test.ts`         | `requireAuth`, `requireRole`                                    | Authenticated, unauthenticated, correct role, wrong role, multi-role OR            |
| `libs/bc/enrollment/src/write.test.ts` | Enrollment user scoping                                         | userId from session (not URL), cannot access other learner's data                  |

---

## Priority 2 -- Core Business Logic

These cover the main content authoring and evidence chains.

| Test file                               | What it covers                                    | Key cases                                                                              |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `libs/bc/course/src/manage.test.ts`     | Scenario/module/question/studentModel CRUD        | Create returns row, update sets `updatedAt`, delete removes, list returns all          |
| `libs/bc/evidence/src/write.test.ts`    | Scenario run + evidence packet + score dimensions | Outcome enum enforced, evidence captures competencies/topics, score dimensions roll up |
| `libs/bc/enrollment/src/manage.test.ts` | Enrollment lifecycle (ops)                        | Create 1:1 user-release, list by user, certificate issue                               |
| `libs/bc/course/src/read.test.ts`       | Published content reads                           | `getLatestRelease`, `getPublishedScenarios(releaseId)`, draft never returned           |

---

## Priority 3 -- Compliance and Auth Flows

These cover the FAA traceability chain and cross-app session behavior.

| Test file                                       | What it covers                          | Key cases                                                                          |
| ----------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `libs/bc/compliance/src/manage.test.ts`         | Traceability + submission state machine | Coverage enum, submission draft->submitted->approved only, no backwards transition |
| `libs/bc/enrollment/src/write.test.ts` (part 2) | Module progress state machine           | `not_started -> in_progress -> completed`, never regresses                         |
| `apps/hangar/tests/auth.spec.ts` (E2E)          | Role-based access                       | LEARNER blocked from /scenarios/new, /publish, /questions/new                      |
| `apps/hangar/tests/login.spec.ts` (E2E)         | Login flow + redirectTo                 | Valid credentials -> session, invalid -> error, open redirect rejected             |

---

## Priority 4 -- Feature E2E Smoke Tests

Convert existing manual test plans into automated Playwright flows.

| Test file                                 | Manual plan source                              | Key flows                                                    |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `apps/hangar/tests/content-crud.spec.ts`  | `hangar/features/content-crud/test-plan.md`     | Create scenario, edit, delete; create question, edit, delete |
| `apps/hangar/tests/task-board.spec.ts`    | `hangar/features/task-board/test-plan.md`       | Create task, move column, edit, delete                       |
| `apps/hangar/tests/publish.spec.ts`       | `hangar/features/published-viewer/test-plan.md` | Publish release, view published content                      |
| `apps/sim/tests/knowledge-checks.spec.ts` | `sim/features/knowledge-checks/test-plan.md`    | Answer question, pass/fail flow                              |
| `apps/sim/tests/scenario-player.spec.ts`  | `sim/features/scenario-player/test-plan.md`     | Load scenario, submit action, receive feedback               |

---

## Priority 5 -- Engine (when implemented)

The engine doesn't exist yet. These tests should be written alongside the implementation.

| Test file                             | What it covers                      | Key cases                                                                |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `libs/engine/src/commands.test.ts`    | `validateCommands`, `applyCommands` | Shape validation, ownership, stale tick rejection, state mutation        |
| `libs/engine/src/tick.test.ts`        | `advanceWorld`, tick loop           | Tick increment, timer processing, ordering: validate -> apply -> advance |
| `libs/engine/src/state.test.ts`       | `buildPublicWorldState`             | Hidden risks never in output, internal fields stripped, cues included    |
| `libs/engine/src/determinism.test.ts` | Reproducibility                     | Same seed + input = same output across N runs                            |

---

## Platform BC (Low Priority)

| Test file                             | What it covers                                              |
| ------------------------------------- | ----------------------------------------------------------- |
| `libs/bc/platform/src/manage.test.ts` | Board/column/task CRUD, column sort order, task reparenting |

---

## Coverage Targets (when infrastructure exists)

| Layer                   | Files                                        | Min coverage                  |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| Unit (schemas, helpers) | `libs/types/`, `libs/ui/src/form-helpers.ts` | 90%                           |
| Integration (BCs)       | `libs/bc/*/src/`                             | 80%                           |
| Engine                  | `libs/engine/src/`                           | 95% (determinism requirement) |
| E2E                     | Critical user flows                          | All Priority 3-4 flows above  |

---

## What NOT to Test

- Database connection setup (`libs/db/`) -- Drizzle is tested by Drizzle, not us
- Theme tokens (`libs/themes/`) -- CSS custom properties, not logic
- UI component rendering in isolation -- test through E2E flows, not unit snapshots
- Auth library internals (`better-auth`) -- test our guard wrappers, not the library itself
- SvelteKit routing -- test through E2E, not by mocking `RequestEvent`
