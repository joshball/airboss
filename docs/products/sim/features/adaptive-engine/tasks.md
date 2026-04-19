---
title: "Tasks: Adaptive Engine"
product: sim
feature: adaptive-engine
type: tasks
status: done
---

# Tasks: Adaptive Engine

## Pre-flight

- [ ] Read `docs/agents/reference-engine-patterns.md` -- engine purity rules
- [ ] Read `docs/agents/best-practices.md` -- Svelte 5 patterns
- [ ] Review `libs/engine/src/tick.ts` -- existing engine interface
- [ ] Review `libs/bc/enrollment/src/write.ts` -- lesson attempt recording
- [ ] Review `libs/bc/evidence/src/write.ts` -- evidence recording
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants + types

- [ ] Create `libs/constants/src/adaptive.ts` -- `MEMORY_ITEM_TYPE`, `SM2_*`, `DIFFICULTY_*`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Create `libs/types/src/adaptive.ts` -- `LearnerMemory`, `DifficultyProfile`, `AdaptiveRecommendation`, `SpacedRepetitionUpdate`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. Schema

- [ ] Add `enrollment.learner_memory` table to Drizzle schema
- [ ] Add `enrollment.difficulty_profile` table to Drizzle schema
- [ ] Regenerate initial migration, reset DB
- [ ] Run `bun run check` -- 0 errors, commit

### 3. SM-2 spaced repetition engine

- [ ] Implement `computeSpacedRepetition()` in `libs/engine/src/adaptive.ts`
- [ ] Implement quality mapping from engine score (0-1) to SM-2 quality (0-5)
- [ ] Write Vitest unit tests:
  - [ ] Test perfect score -> increased interval and ease
  - [ ] Test low score -> reset interval to 1
  - [ ] Test ease factor never drops below SM2_MIN_EASE
  - [ ] Test first review (no prior memory)
  - [ ] Test multiple consecutive reviews
- [ ] Run `bun run check` -- 0 errors, commit

### 4. Difficulty adjustment engine

- [ ] Implement `adjustDifficulty()` in `libs/engine/src/adaptive.ts`
- [ ] Write Vitest unit tests:
  - [ ] Test score above difficulty -> level increases
  - [ ] Test score below difficulty -> level decreases
  - [ ] Test level bounded to 0.0-1.0
  - [ ] Test confidence increases with data points
  - [ ] Test adjustment step scales correctly
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Recommendation engine

- [ ] Implement `recommendNextScenarios()` in `libs/engine/src/adaptive.ts`
- [ ] Implement `selectQuestions()` in `libs/engine/src/adaptive.ts`
- [ ] Write Vitest unit tests:
  - [ ] Test due-for-review items prioritized
  - [ ] Test competency gaps identified
  - [ ] Test difficulty matching
  - [ ] Test pool diversity in question selection
  - [ ] Test empty memory -> all items treated as new
- [ ] Run `bun run check` -- 0 errors, commit

### 6. BC layer -- memory persistence

- [ ] Add `updateLearnerMemory()` to `libs/bc/enrollment/src/write.ts`
- [ ] Add `updateDifficultyProfile()` to `libs/bc/enrollment/src/write.ts`
- [ ] Add `getLearnerMemory()` to `libs/bc/enrollment/src/read.ts`
- [ ] Add `getDifficultyProfiles()` to `libs/bc/enrollment/src/read.ts`
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Integration -- scenario completion

- [ ] In scenario player complete action, after recording evidence:
  - [ ] Call `computeSpacedRepetition()` for the scenario
  - [ ] Call `adjustDifficulty()` for relevant competency domains
  - [ ] Write updated memory and profiles via BC
- [ ] Run `bun run check` -- 0 errors, commit

### 8. Integration -- knowledge check completion

- [ ] In knowledge check submit action, after recording results:
  - [ ] Call `computeSpacedRepetition()` for each question
  - [ ] Call `adjustDifficulty()` for relevant competency domains
  - [ ] Write updated memory and profiles via BC
- [ ] Run `bun run check` -- 0 errors, commit

### 9. Integration -- course dashboard recommendations

- [ ] In course dashboard load function, call `recommendNextScenarios()`
- [ ] Show recommended scenarios with priority badges
- [ ] Show "Due for review" indicators on previously completed scenarios
- [ ] Run `bun run check` -- 0 errors, commit

### 10. Integration -- adaptive question selection

- [ ] In knowledge check load function, call `selectQuestions()` instead of random selection
- [ ] Ensure FAA pool diversity requirements still met
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass (engine + BC)
- [ ] Request implementation review
- [ ] Update sim TASKS.md
- [ ] Commit docs updates
