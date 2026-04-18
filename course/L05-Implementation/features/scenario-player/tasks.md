---
title: "Tasks: Scenario Player"
product: sim
feature: scenario-player
type: tasks
status: done
---

# Tasks: Scenario Player

**Design review required before starting implementation.** Create `review.md` after design review completes.

## Pre-flight

- [x] Read `docs/agents/reference-engine-patterns.md` -- tick engine patterns
- [x] Read `docs/agents/best-practices.md` -- Svelte 5 patterns, SSR off
- [x] Review `libs/bc/evidence/src/write.ts`
- [x] Review `libs/bc/enrollment/src/write.ts`
- [x] Review `libs/bc/course/src/read.ts` -- published scenario + student model reads
- [x] Complete design review (write findings in `review.md`)

## Implementation

### 1. Engine types

- [x] Create `libs/types/src/schemas/engine.ts` -- `TickScript`, `Tick`, `TickConsequence`, `InterventionLevel`, `RunState`, `ScoreResult`, `ScoreDimension`
- [x] Export from `libs/types/src/index.ts`
- [x] Run `bun run check` -- 0 errors

### 2. Engine constants

- [x] Create `libs/constants/src/engine.ts` -- `INTERVENTION_LEVELS`, `INTERVENTION_LABELS`, `SCORE_DIMENSIONS`
- [x] Export from `libs/constants/src/index.ts`
- [x] Run `bun run check` -- 0 errors, commit

### 3. Tick engine implementation

- [x] Implement `initRun()` in `libs/engine/src/tick.ts`
- [x] Implement `getCurrentTick()`
- [x] Implement `applyIntervention()` -- applies intervention, computes score deltas, advances to next tick
- [x] Implement `isTerminal()` -- checks for terminal_safe / terminal_unsafe
- [x] Implement `scoreRun()` -- totals dimensions, returns `ScoreResult`
- [x] Write Vitest unit tests: `libs/engine/src/tick.test.ts`
  - [x] Test initRun creates correct initial state
  - [x] Test applyIntervention with safe-window intervention -> correct score + next tick
  - [x] Test applyIntervention with over-intervention -> penalty applied
  - [x] Test isTerminal returns true on terminal ticks
  - [x] Test scoreRun produces normalized 0-1 result
- [x] Run `bun test` -- all pass
- [x] Run `bun run check` -- 0 errors, commit

### 4. Demo scenario seed script

- [x] Create demo seed script -- adds student model + scenario with 5-8 tick script (now part of `bun db reset`)
- [x] Verify: running the seed creates a complete scenario playable by the player
- [x] Run `bun run check` -- 0 errors, commit

### 5. Briefing screen

- [x] Create `apps/sim/src/routes/scenario/[id]/brief/+page.svelte` -- briefing layout
- [x] Create `apps/sim/src/routes/scenario/[id]/brief/+page.server.ts` -- load scenario
- [x] "Call the Ball" button navigates to `/scenario/:id`
- [x] Run `bun run check` -- 0 errors, commit

### 6. Player screen

- [x] Create `apps/sim/src/routes/scenario/[id]/+page.server.ts` -- load + complete action
- [x] Create `apps/sim/src/routes/scenario/[id]/+page.svelte` -- player UI
  - [x] Scene panel (scenario description)
  - [x] Student panel (speech + state)
  - [x] Intervention ladder (5 buttons)
  - [x] Timer display (visual only, no hard cutoff)
  - [x] "Call it out" abort link
- [x] Wire intervention button clicks to `applyIntervention()`, update `runState`
- [x] When `isTerminal()`: auto-submit complete form
- [x] Run `bun run check` -- 0 errors, commit

### 7. Evidence + time logging

- [x] In `complete` action: write `evidence.scenario_run` + `evidence.evidence_packet` + `evidence.score_dimension` rows
- [x] In `complete` action: write `enrollment.lesson_attempt`
- [x] In `complete` action: write `enrollment.time_log`
- [x] Redirect to `/debrief/:runId`
- [x] Verify: run visible in DB after completion
- [x] Run `bun run check` -- 0 errors, commit

### 8. Abort / incomplete

- [x] "Call it out" abort: POST to `?/abort` -- records incomplete run, redirects to `/course`
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [x] All engine unit tests pass
- [ ] Request implementation review
- [x] Update TASKS.md (mark scenario-player complete)
- [x] Commit docs updates
