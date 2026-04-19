---
title: "Tasks: Cross-App Analytics"
product: ops
feature: cross-app-analytics
type: tasks
status: done
---

# Tasks: Cross-App Analytics

## Pre-flight

- [ ] Read `docs/agents/best-practices.md` -- Svelte 5 patterns
- [ ] Read `docs/agents/reference-sveltekit-patterns.md` -- DB query patterns
- [ ] Review existing ops analytics dashboard (`apps/ops/src/routes/(app)/analytics/`)
- [ ] Review `libs/bc/enrollment/src/read.ts` -- enrollment queries
- [ ] Review `libs/bc/evidence/src/read.ts` -- evidence queries
- [ ] Review `libs/bc/compliance/src/read.ts` -- compliance queries
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants + types

- [ ] Create `libs/constants/src/cross-analytics.ts` -- `ANALYTICS_SECTION`, `TIME_RANGE`, `STRUGGLE_THRESHOLD`, `DISCRIMINATION_THRESHOLD`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Add cross-analytics routes to `ROUTES` in `libs/constants/src/routes.ts`
- [ ] Create `libs/types/src/cross-analytics.ts` -- `LearnerAnalytics`, `ContentEffectiveness`, `OperationalMetrics`, `CrossAnalyticsReport`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. BC query functions -- learner analytics

- [ ] Add `getLearnerAnalytics(timeRange)` to `libs/bc/evidence/src/read.ts`
  - [ ] Completion rate from enrollment statuses
  - [ ] Average course duration from time logs
  - [ ] Scenario pass rate and average score
  - [ ] Struggle points from score dimensions
  - [ ] Mode distribution from scenario runs
  - [ ] Drop-off points from lesson attempts
  - [ ] Time by FAA topic
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 3. BC query functions -- content effectiveness

- [ ] Add `getContentEffectiveness(timeRange)` to `libs/bc/evidence/src/read.ts`
  - [ ] Difficulty calibration (actual pass rate vs authored difficulty)
  - [ ] Question discrimination index computation
  - [ ] Time accuracy (actual vs estimated)
  - [ ] Knowledge check accuracy by module
  - [ ] Adaptive engine coverage
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 4. BC query functions -- operational metrics

- [ ] Add `getOperationalMetrics(timeRange)` to `libs/bc/enrollment/src/read.ts`
  - [ ] Enrollment counts by status
  - [ ] Enrollment velocity (grouped by week/month)
  - [ ] Certificate issuance rate
  - [ ] Compliance status from last regulatory check
  - [ ] Content freshness from last publish date
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Learner analytics page

- [ ] Create `apps/ops/src/routes/(app)/analytics/learner/+page.server.ts`
- [ ] Create `apps/ops/src/routes/(app)/analytics/learner/+page.svelte`
- [ ] Show all learner metrics with time range filter
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Content effectiveness page

- [ ] Create `apps/ops/src/routes/(app)/analytics/content/+page.server.ts`
- [ ] Create `apps/ops/src/routes/(app)/analytics/content/+page.svelte`
- [ ] Show difficulty calibration, discrimination, time accuracy tables
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Operational metrics page

- [ ] Create `apps/ops/src/routes/(app)/analytics/operational/+page.server.ts`
- [ ] Create `apps/ops/src/routes/(app)/analytics/operational/+page.svelte`
- [ ] Show enrollment stats, velocity, compliance status
- [ ] Run `bun run check` -- 0 errors, commit

### 8. Analytics tab navigation

- [ ] Update `apps/ops/src/routes/(app)/analytics/+layout.svelte` -- add tabs for Learner, Content, Operational
- [ ] Ensure existing analytics page redirects to `/analytics/learner` (or becomes the learner tab)
- [ ] Time range filter in URL search params, preserved across tab switches
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass
- [ ] Request implementation review
- [ ] Update ops TASKS.md
- [ ] Commit docs updates
