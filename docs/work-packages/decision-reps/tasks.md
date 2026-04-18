---
title: 'Tasks: Decision Reps'
product: study
feature: decision-reps
type: tasks
status: unread
---

# Tasks: Decision Reps

Depends on: Spaced Memory Items (schema, constants, BC structure must exist).

## Pre-flight

- [ ] Verify Spaced Memory Items is complete -- schema exists, constants exported, BC structure in place.
- [ ] Read `libs/bc/study/src/schema.ts` -- understand existing tables.
- [ ] Read `libs/constants/src/study.ts` -- understand existing constants.

## Implementation

### 1. Constants additions

- [ ] Add `DIFFICULTIES`, `PHASES_OF_FLIGHT` to `libs/constants/src/study.ts`.
- [ ] Add ID prefix `rep_` and `rat_` helpers to utils (if not already present).
- [ ] Export new constants from `libs/constants/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 2. Schema additions

- [ ] Add `scenario` and `repAttempt` tables to `libs/bc/study/src/schema.ts`.
- [ ] Push schema: `bunx drizzle-kit push`.
- [ ] Verify tables exist in DB.
- [ ] Run `bun run check` -- 0 errors, commit.

### 3. Scenario BC functions

- [ ] Create `libs/bc/study/src/scenarios.ts` -- `createScenario()`, `getScenarios()`, `getNextScenarios()`, `submitAttempt()`, `getRepAccuracy()`, `getRepStats()`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 4. Scenario unit tests

- [ ] Create `libs/bc/study/src/scenarios.test.ts`:
  - Validate options array (2-5 options, exactly 1 correct)
  - `getNextScenarios` prioritizes unattempted over attempted
  - `submitAttempt` correctly records is_correct based on chosen option
  - Accuracy calculation is correct
- [ ] Run `bun test` -- all pass, commit.

### 5. Scenario creation route

- [ ] Create `apps/study/src/routes/(app)/reps/new/+page.server.ts` -- form action.
- [ ] Create `apps/study/src/routes/(app)/reps/new/+page.svelte` -- form with title, situation (textarea), dynamic options builder (add/remove options, mark one correct, outcome + whyNot per option), teaching point, domain, difficulty, phase_of_flight.
- [ ] Run `bun run check` -- 0 errors.

### 6. Scenario browse route

- [ ] Create `apps/study/src/routes/(app)/reps/browse/+page.server.ts` -- load with filters.
- [ ] Create `apps/study/src/routes/(app)/reps/browse/+page.svelte` -- scenario list with filters.
- [ ] Run `bun run check` -- 0 errors, commit.

### 7. Reps dashboard

- [ ] Create `apps/study/src/routes/(app)/reps/+page.server.ts` -- load dashboard stats.
- [ ] Create `apps/study/src/routes/(app)/reps/+page.svelte` -- available scenarios, attempts today, accuracy by domain, "Start Session" button.
- [ ] Run `bun run check` -- 0 errors.

### 8. Rep session flow

- [ ] Create `apps/study/src/routes/(app)/reps/session/+page.server.ts` -- load scenario batch. Form action: `submitAttempt`.
- [ ] Create `apps/study/src/routes/(app)/reps/session/+page.svelte` -- situation display -> confidence (50%) -> options -> reveal outcome/teaching point -> next. Session summary at end.
- [ ] Run `bun run check` -- 0 errors, commit.

### 9. Navigation

- [ ] Update `apps/study/src/routes/(app)/+layout.svelte` -- add Reps nav item linking to `/reps`.
- [ ] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Request implementation review
- [ ] Commit docs updates
