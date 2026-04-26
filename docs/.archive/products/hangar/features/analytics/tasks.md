---
title: "Tasks: Hangar Analytics"
product: hangar
feature: analytics
type: tasks
status: done
---

# Tasks: Hangar Analytics

## Pre-flight

- [ ] Read `docs/agents/best-practices.md` -- Svelte 5 patterns, SSR off
- [ ] Read `docs/agents/reference-sveltekit-patterns.md` -- constants, DB patterns
- [ ] Review `libs/bc/course/src/read.ts` -- existing query patterns
- [ ] Review `libs/constants/src/compliance.ts` -- validation thresholds to reuse
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants + types

- [ ] Create `libs/constants/src/analytics.ts` -- `COVERAGE_DEPTH`, `RETIREMENT_WARNING_MONTHS`, `ANALYTICS_TABS`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Add `ANALYTICS_QUESTIONS` and `ANALYTICS_TIME` to `ROUTES` in `libs/constants/src/routes.ts`
- [ ] Create `libs/types/src/analytics.ts` -- `CoverageCell`, `CoverageReport`, `InventoryReport`, `QuestionBankReport`, `TimeProjectionReport`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. BC query functions

- [ ] Add `getCoverageReport()` to `libs/bc/course/src/read.ts` -- aggregates scenario/module/competency data into `CoverageReport`
- [ ] Add `getInventoryReport()` -- aggregates scenario counts by status, topic, competency, difficulty
- [ ] Add `getQuestionBankReport()` -- aggregates question counts, pool depths, retirement candidates
- [ ] Add `getTimeProjectionReport()` -- computes per-topic time vs minimums
- [ ] Write Vitest unit tests for each report function
- [ ] Run `bun run check` -- 0 errors, commit

### 3. Coverage dashboard page

- [ ] Create `apps/hangar/src/routes/(app)/analytics/coverage/+page.server.ts` -- load `getCoverageReport()`
- [ ] Create `apps/hangar/src/routes/(app)/analytics/coverage/+page.svelte` -- heat map table, competency gaps, topic gaps
- [ ] Run `bun run check` -- 0 errors, commit

### 4. Inventory dashboard page

- [ ] Create `apps/hangar/src/routes/(app)/analytics/inventory/+page.server.ts` -- load `getInventoryReport()`
- [ ] Create `apps/hangar/src/routes/(app)/analytics/inventory/+page.svelte` -- status breakdown, topic/competency/difficulty tables
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Question bank stats page

- [ ] Create `apps/hangar/src/routes/(app)/analytics/questions/+page.server.ts` -- load `getQuestionBankReport()`
- [ ] Create `apps/hangar/src/routes/(app)/analytics/questions/+page.svelte` -- status breakdown, pool depth flags, retirement warnings
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Time projection page

- [ ] Create `apps/hangar/src/routes/(app)/analytics/time/+page.server.ts` -- load `getTimeProjectionReport()`
- [ ] Create `apps/hangar/src/routes/(app)/analytics/time/+page.svelte` -- per-topic bars, total comparison, warning highlights
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Analytics tab navigation

- [ ] Create shared analytics tab bar component in `libs/ui/` or inline in layout
- [ ] Create `apps/hangar/src/routes/(app)/analytics/+layout.svelte` -- tab bar with 4 tabs
- [ ] Verify tab navigation works across all 4 dashboards
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass
- [ ] Request implementation review
- [ ] Update hangar TASKS.md (mark analytics complete)
- [ ] Commit docs updates
