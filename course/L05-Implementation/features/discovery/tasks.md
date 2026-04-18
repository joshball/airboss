---
title: "Tasks: Discovery"
product: sim
feature: discovery
type: tasks
status: done
---

# Tasks: Discovery

## Pre-flight

- [x] Read `docs/agents/best-practices.md` (forms, validation, Svelte 5 state)
- [x] Review `libs/bc/enrollment/src/schema.ts` -- understand existing tables
- [x] Review `libs/bc/enrollment/src/write.ts` -- understand write pattern
- [x] Review `libs/constants/src/competency.ts` -- confirm `COMPETENCY_DOMAIN_LABELS` exists

## Implementation

### 1. Types

- [x] Create `libs/types/src/schemas/discovery.ts` -- `learnerBackgroundSchema`, `selfAssessmentSchema`, inferred types
- [x] Export `LearnerBackground`, `SelfAssessment` from `libs/types/src/index.ts`
- [x] Run `bun run check` -- 0 errors

### 2. Schema

- [x] Add `learnerProfile` table to `libs/bc/enrollment/src/schema.ts`
- [x] Run `bun scripts/db.ts push` -- verify table created
- [x] Run `bun run check` -- 0 errors, commit

### 3. BC functions

- [x] Add `createLearnerProfile()` to `libs/bc/enrollment/src/write.ts`
- [x] Add `getLearnerProfile()` to `libs/bc/enrollment/src/write.ts`
- [x] Export from `libs/bc/enrollment/src/index.ts`
- [x] Run `bun run check` -- 0 errors, commit

### 4. Route + load

- [x] Create `apps/sim/src/routes/discovery/+page.server.ts` -- load (check existing profile, redirect if complete) + action (submit all steps)
- [x] Add `ROUTES.SIM_DISCOVERY` to `libs/constants/src/routes.ts` if not already added
- [x] Run `bun run check` -- 0 errors

### 5. Page component

- [x] Create `apps/sim/src/routes/discovery/+page.svelte`
  - [x] Step 1: background form (radio groups, checkboxes, toggle)
  - [x] Step 2: self-assessment sliders (8 domains, 0-5 + "Not sure")
  - [x] Step 3: goals multi-select + optional text + submit
  - [x] "Skip for now" link on step 1
  - [x] localStorage save/restore on step change
- [x] Run `bun run check` -- 0 errors, commit

### 6. Settings integration

- [x] Add "Complete your profile" prompt to `/settings` if profile incomplete
- [x] Add "Redo profile intake" link on `/settings` if profile complete (deletes and restarts)
- [x] Run `bun run check` -- 0 errors, commit

### 7. Course redirect check

- [x] In `/login` success handler (or `/course` load): redirect to `/discovery` if no completed profile
- [x] Verify redirect only happens once (skip sets no-profile state, not stuck in loop)
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update TASKS.md (mark discovery complete)
- [x] Commit docs updates
