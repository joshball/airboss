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

- [x] Verify both features are complete and the confidence slider is working in review and rep flows.
- [ ] Have some test data: at least 20+ reviews and 10+ rep attempts with confidence values across multiple buckets and domains. (user-zero test only)

## Implementation

### 1. ConfidenceSlider component

- [x] Create `libs/ui/src/components/ConfidenceSlider.svelte` -- discrete 1-5 slider with labels (Wild Guess, Uncertain, Maybe, Probably, Certain). Props: `onSelect(value: number)`, `onSkip()`. Svelte 5 runes.
- [x] Export from `libs/ui/src/index.ts`. (imported by path to avoid pulling svelte runtime into non-UI consumers; documented in the barrel file.)
- [x] Run `bun run check` -- 0 errors.

### 2. Integrate ConfidenceSlider into existing flows

- [x] Update card review page (`(app)/memory/review/+page.svelte`) to use ConfidenceSlider component (replacing any inline implementation).
- [x] Update rep session page (`(app)/reps/session/+page.svelte`) to use ConfidenceSlider component.
- [x] Run `bun run check` -- 0 errors, commit.

### 3. Calibration BC functions

- [x] Create `libs/bc/study/src/calibration.ts` -- `getCalibration()`, `getCalibrationTrend()`, plus `getCalibrationPointCount()` for cheap empty-state detection.
- [x] Export from `libs/bc/study/src/index.ts`.
- [x] Run `bun run check` -- 0 errors.

### 4. Calibration unit tests

- [x] Create `libs/bc/study/src/calibration.test.ts`:
  - Perfect calibration data -> score = 1.0
  - All overconfident data -> score < 1.0, negative gaps (gap = actual - expected, so over = negative)
  - Bucket with < 5 data points excluded from score
  - Empty data -> null score, all buckets flagged needsMoreData
  - Combined card review + rep attempt data aggregated correctly
  - Per-domain breakdown independent per domain
  - Domain filter passes through to bucket data
  - Trend returns 30 points; null score when no bucket clears threshold
  - Point-count ignores null-confidence rows
- [x] Run `bun test` -- 11 calibration tests pass (54 repo-wide).

### 5. Calibration page

- [x] Create `apps/study/src/routes/(app)/calibration/+page.server.ts` -- load calibration data.
- [x] Create `apps/study/src/routes/(app)/calibration/+page.svelte` -- five-bucket bar chart (CSS-only), per-domain breakdown table, 30-day trend sparkline, calibration score.
- [x] Run `bun run check` -- 0 errors, commit.

### 6. Navigation

- [x] Update `apps/study/src/routes/(app)/+layout.svelte` -- add Calibration nav item linking to `/calibration`.
- [x] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per test-plan.md (user-zero walks it)
- [ ] Request implementation review
- [ ] Commit docs updates
