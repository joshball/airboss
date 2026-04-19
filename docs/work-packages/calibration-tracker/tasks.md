---
title: 'Tasks: Calibration Tracker'
product: study
feature: calibration-tracker
type: tasks
status: unread
---

# Tasks: Calibration Tracker

Depends on: Spaced Memory Items (confidence on reviews) and Decision Reps (confidence on attempts). Both must be complete and generating data.

## Pre-flight

- [ ] Verify both features are complete and the confidence slider is working in review and rep flows.
- [ ] Have some test data: at least 20+ reviews and 10+ rep attempts with confidence values across multiple buckets and domains.

## Implementation

### 1. ConfidenceSlider component

- [ ] Create `libs/ui/src/components/ConfidenceSlider.svelte` -- discrete 1-5 slider with labels (Wild Guess, Uncertain, Maybe, Probably, Certain). Props: `onSelect(value: number)`, `onSkip()`. Svelte 5 runes.
- [ ] Export from `libs/ui/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 2. Integrate ConfidenceSlider into existing flows

- [ ] Update card review page (`(app)/memory/review/+page.svelte`) to use ConfidenceSlider component (replacing any inline implementation).
- [ ] Update rep session page (`(app)/reps/session/+page.svelte`) to use ConfidenceSlider component.
- [ ] Run `bun run check` -- 0 errors, commit.

### 3. Calibration BC functions

- [ ] Create `libs/bc/study/src/calibration.ts` -- `getCalibration()`, `getCalibrationTrend()`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 4. Calibration unit tests

- [ ] Create `libs/bc/study/src/calibration.test.ts`:
  - Perfect calibration data -> score = 1.0
  - All overconfident data -> score < 1.0, positive gaps
  - Bucket with < 5 data points excluded from score
  - Empty data -> null/empty result
  - Combined card review + rep attempt data aggregated correctly
- [ ] Run `bun test` -- all pass, commit.

### 5. Calibration page

- [ ] Create `apps/study/src/routes/(app)/calibration/+page.server.ts` -- load calibration data.
- [ ] Create `apps/study/src/routes/(app)/calibration/+page.svelte` -- five-bucket bar chart (CSS-only), per-domain breakdown table, 30-day trend sparkline, calibration score.
- [ ] Run `bun run check` -- 0 errors, commit.

### 6. Navigation

- [ ] Update `apps/study/src/routes/(app)/+layout.svelte` -- add Calibration nav item linking to `/calibration`.
- [ ] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Request implementation review
- [ ] Commit docs updates
