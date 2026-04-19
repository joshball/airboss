---
title: "Tasks: Game Modes"
product: sim
feature: game-modes
type: tasks
status: done
---

# Tasks: Game Modes

## Pre-flight

- [ ] Read `docs/agents/best-practices.md` -- Svelte 5 patterns, forms
- [ ] Read `docs/agents/reference-engine-patterns.md` -- engine purity
- [ ] Review scenario player implementation (`apps/sim/src/routes/(app)/scenario/`)
- [ ] Review knowledge check implementation (`apps/sim/src/routes/(app)/course/[moduleId]/check/`)
- [ ] Review adaptive engine spec (`docs/products/sim/features/adaptive-engine/spec.md`)
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants + types

- [ ] Create `libs/constants/src/game-modes.ts` -- `GAME_MODE`, `DRILL_DEFAULT_COUNT`, `DRILL_MAX_COUNT`, `FREE_PLAY_TIME_QUALIFIED`, `DRILL_TIME_QUALIFIED`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Add game mode routes to `ROUTES` in `libs/constants/src/routes.ts`
- [ ] Create `libs/types/src/game-modes.ts` -- `DrillSession`, `DrillQuestion`, `DrillAnswer`, `DrillResults`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. Schema update

- [ ] Add `mode` column to `evidence.scenario_run` (text, NOT NULL, default `'course'`)
- [ ] Regenerate initial migration, reset DB
- [ ] Run `bun run check` -- 0 errors, commit

### 3. Drill engine functions

- [ ] Implement `createDrillSession()` in `libs/engine/src/drill.ts` -- selects questions using adaptive engine
- [ ] Implement `scoreDrillAnswer()` -- checks answer, returns correct/incorrect + explanation
- [ ] Implement `computeDrillResults()` -- aggregates drill session into results
- [ ] Write Vitest unit tests:
  - [ ] Test question selection respects count and filters
  - [ ] Test scoring returns correct answer status
  - [ ] Test results computation (accuracy, by-domain breakdown)
- [ ] Run `bun run check` -- 0 errors, commit

### 4. Free Play browse page

- [ ] Create `apps/sim/src/routes/(app)/free-play/+page.server.ts` -- load all published scenarios with filters
- [ ] Create `apps/sim/src/routes/(app)/free-play/+page.svelte` -- scenario grid with filters (topic, domain, difficulty)
- [ ] Show completion badges and last score for previously played scenarios
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Free Play scenario flow

- [ ] Create `apps/sim/src/routes/(app)/free-play/[id]/+page.server.ts` -- reuse scenario load, complete action with `mode = 'free_play'`
- [ ] Create `apps/sim/src/routes/(app)/free-play/[id]/+page.svelte` -- reuse scenario player component
- [ ] Create `apps/sim/src/routes/(app)/free-play/[id]/brief/+page.server.ts` -- briefing
- [ ] Create `apps/sim/src/routes/(app)/free-play/[id]/brief/+page.svelte` -- briefing page
- [ ] Ensure debrief "Back" link returns to `/free-play`
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Drill Mode setup page

- [ ] Create `apps/sim/src/routes/(app)/drill/+page.server.ts` -- load available question count, topic/domain options
- [ ] Create `apps/sim/src/routes/(app)/drill/+page.svelte` -- count selector, filters, "Start Drill" button
- [ ] On submit: create drill session (server action), redirect to `/drill/:sessionId`
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Drill Mode play page

- [ ] Create `apps/sim/src/routes/(app)/drill/[sessionId]/+page.server.ts` -- load drill session, answer action
- [ ] Create `apps/sim/src/routes/(app)/drill/[sessionId]/+page.svelte` -- question display, answer buttons, feedback, progress bar
- [ ] Client-side state for current question and answers (same pattern as scenario player)
- [ ] On final question: submit all answers, redirect to results
- [ ] Run `bun run check` -- 0 errors, commit

### 8. Drill Mode results page

- [ ] Create `apps/sim/src/routes/(app)/drill/[sessionId]/results/+page.server.ts` -- compute and load results
- [ ] Create `apps/sim/src/routes/(app)/drill/[sessionId]/results/+page.svelte` -- accuracy, time, domain breakdown
- [ ] Record evidence: `scenario_run` with `mode = 'drill'`, time log
- [ ] Update adaptive memory for each question
- [ ] Run `bun run check` -- 0 errors, commit

### 9. Navigation integration

- [ ] Add "Free Play" and "Drill" links to sim navigation
- [ ] Add mode badges to nav to distinguish from course flow
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass
- [ ] Request implementation review
- [ ] Update sim TASKS.md
- [ ] Commit docs updates
