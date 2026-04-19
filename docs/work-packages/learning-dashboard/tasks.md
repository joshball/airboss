---
title: 'Tasks: Learning Dashboard'
product: study
feature: learning-dashboard
type: tasks
status: unread
review_status: pending
---

# Tasks: Learning Dashboard

Depends on: Spaced Memory Items, Decision Reps, Calibration Tracker -- all landed and producing data. Knowledge Graph and Study Plan + Session Engine work packages are being authored in parallel; their panels ship as gated placeholders until those features land.

## Pre-flight

- [ ] Read [spec.md](./spec.md), [design.md](./design.md), and [PRD.md](./PRD.md).
- [ ] Read `libs/bc/study/src/stats.ts` -- understand existing aggregate patterns.
- [ ] Read `libs/bc/study/src/index.ts` -- understand what is already exported.
- [ ] Read `libs/bc/study/src/calibration.ts` (if present) and `libs/bc/study/src/scenarios.ts` -- understand existing rep/calibration aggregates.
- [ ] Read `apps/study/src/routes/(app)/+page.server.ts` -- note the current `/` redirect target.
- [ ] Read `apps/study/src/routes/(app)/+layout.svelte` -- note the nav pattern.
- [ ] Confirm DB is running (OrbStack, port 5435) and the three sibling features (memory, reps, calibration) work locally at `study.airboss.test:9600`.
- [ ] Seed or create enough data to exercise every panel: 20+ cards across 3+ domains with some reviews (including confidence ratings), 10+ scenarios with attempts, at least 2 overdue cards, activity across 3+ of the last 7 days.

## Implementation

### 1. Constants + route

- [ ] Add `DASHBOARD: '/dashboard'` to `ROUTES` in `libs/constants/src/routes.ts`. Keep alphabetical within the Study section.
- [ ] Add any new constants needed (none expected; weak-area threshold and activity-window default can live in `libs/constants/src/study.ts` as `WEAK_AREA_ACCURACY_THRESHOLD = 0.70`, `WEAK_AREA_MIN_DATA_POINTS = 10`, `ACTIVITY_WINDOW_DAYS = 7`).
- [ ] Export from `libs/constants/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors, 0 warnings.

### 2. BC: getRepBacklog

- [ ] Create `libs/bc/study/src/dashboard.ts`.
- [ ] Implement `getRepBacklog(userId, db = defaultDb)` -> `{ unattempted, totalActive, byDomain }`. Query `scenario` joined to `repAttempt` to classify each active scenario as attempted or unattempted, grouped by domain.
- [ ] Export from `libs/bc/study/src/index.ts` (type + function).
- [ ] Run `bun run check` -- 0 errors.

### 3. BC: getRecentActivity

- [ ] Implement `getRecentActivity(userId, days = ACTIVITY_WINDOW_DAYS, db = defaultDb, now = new Date())` -> `{ day, reviews, attempts }[]`. Use UTC day bucketing matching `computeStreakDays`. Fill zero rows for days with no activity so the returned array always has `days` elements.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 4. BC: getWeakAreas

- [ ] Implement `getWeakAreas(userId, limit = 5, db = defaultDb, now = new Date())` -> `{ domain, reasons, link, score }[]`. See [design.md](./design.md) "Weak-areas ranking" for the formula and thresholds.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 5. BC: getDashboardPayload (aggregator)

- [ ] Implement `getDashboardPayload(userId, db = defaultDb, now = new Date())`. Fans out to `getDashboardStats`, `getCalibration`, `getRepBacklog`, `getWeakAreas`, `getRecentActivity` via `Promise.all`. Each concurrent call wrapped in try/catch, returning `{ value, error }` tuples per panel.
- [ ] Type the return as `DashboardPayload`. Each panel field is `{ value: T } | { error: string }`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 6. BC: unit tests

- [ ] Create `libs/bc/study/src/dashboard.test.ts`:
  - `getRepBacklog` on fresh user returns `{ unattempted: 0, totalActive: 0, byDomain: [] }`.
  - `getRepBacklog` correctly splits attempted vs. unattempted scenarios.
  - `getRecentActivity` returns exactly `days` elements, filled with zeros where no data exists.
  - `getRecentActivity` buckets by UTC day, matches `computeStreakDays` convention.
  - `getWeakAreas` returns `[]` with no history.
  - `getWeakAreas` respects `WEAK_AREA_MIN_DATA_POINTS` floor (does not nominate a domain with < N data points).
  - `getWeakAreas` ranks by the documented score formula on a fixed dataset.
  - `getDashboardPayload` returns panel-level error tuples when an underlying query throws (mock one to throw, others succeed).
- [ ] Run `bun test libs/bc/study/src/dashboard.test.ts` -- all pass.
- [ ] Run `bun run check` -- 0 errors, commit.

### 7. Route: /dashboard

- [ ] Create `apps/study/src/routes/(app)/dashboard/+page.server.ts`. Load function calls `getDashboardPayload(locals.user.id)`.
- [ ] Create `apps/study/src/routes/(app)/dashboard/+page.svelte` -- static server-rendered page with each panel in order. Use Svelte 5 runes; no `<slot>`. Panels are snippets rendered from a panel array so ordering changes are one-line edits.
- [ ] Each panel reads its payload entry, checks for `error`, renders empty state or data.
- [ ] Reuse existing design tokens from `@ab/themes` for colors/spacing.
- [ ] Run `bun run check` -- 0 errors.

### 8. Panel components

Build each panel as a Svelte 5 component in `apps/study/src/routes/(app)/dashboard/_panels/` (leading underscore so SvelteKit treats it as not-a-route).

- [ ] `CtaPanel.svelte` -- primary action. Props: `dueCount`, `repCount`. Label + target adapt per rules in spec section 1.
- [ ] `DueReviewsPanel.svelte` -- reviews-due summary. Props: `{ dueNow, domains }`.
- [ ] `ScheduledRepsPanel.svelte` -- rep backlog summary. Props: `{ unattempted, totalActive, byDomain }`.
- [ ] `CalibrationPanel.svelte` -- one-line score + largest gap + deep link. Props: calibration payload.
- [ ] `WeakAreasPanel.svelte` -- top N weak areas with reasons + deep links.
- [ ] `ActivityPanel.svelte` -- 7-day sparkline + average / streak / weekly total. CSS-only bars.
- [ ] `CertProgressPanel.svelte` -- placeholder rendering for v1. Shows `Cert progress unlocks with the knowledge graph` with a link to the graph WP doc.
- [ ] `MapPanel.svelte` -- placeholder rendering for v1. Same pattern as cert progress.
- [ ] `StudyPlanPanel.svelte` -- placeholder rendering for v1. Same pattern.
- [ ] Each component renders its own empty state internally (single source of truth per panel).
- [ ] Run `bun run check` -- 0 errors.

### 9. Route redirect: / to /dashboard

- [ ] Update `apps/study/src/routes/(app)/+page.server.ts` to redirect to `ROUTES.DASHBOARD` (was `ROUTES.MEMORY`).
- [ ] Grep the repo for other places that redirect to `ROUTES.MEMORY` as a landing (auth callback, login success). Update them to `ROUTES.DASHBOARD` where the intent is `send them to the app's home`. Leave references that specifically mean `take them to the memory surface` alone.
- [ ] Run `bun run check` -- 0 errors, commit.

### 10. Navigation

- [ ] Update `apps/study/src/routes/(app)/+layout.svelte` -- add a `Dashboard` link before `Memory`. Keep the reps / calibration nav items commented-out note or add them alongside if they exist; follow whatever the layout looks like when this task runs.
- [ ] `aria-current="page"` logic mirrors the existing `memoryActive` pattern (`page.url.pathname === ROUTES.DASHBOARD`).
- [ ] Run `bun run check` -- 0 errors, commit.

### 11. Empty-state polish

- [ ] Verify every panel renders cleanly with zero data (fresh user). Specifically: CTA still suggests a next action (create a card), weak areas shows `study a few cards to see where you're slipping`, activity shows `no activity in the last 7 days` plus a zero-filled sparkline axis.
- [ ] Verify every panel renders cleanly with partial data (cards but no reps, confidence never rated, etc. -- per spec "Edge Cases").
- [ ] Run `bun run check` -- 0 errors.

### 12. Performance pass

- [ ] With seeded data (~100 cards, ~30 scenarios, ~1000 reviews, ~200 attempts), open `/dashboard` and check server-side load time. Target < 500ms p95.
- [ ] If any panel's query exceeds 100ms, add `EXPLAIN ANALYZE` output to a comment and file an issue; do not block ship unless page total exceeds the budget.
- [ ] Run `bun run check` -- 0 errors, commit.

### 13. Docs update

- [ ] Update `docs/products/study/PRD.md` and `docs/products/study/ROADMAP.md` (if they exist) to reference the landed dashboard.
- [ ] Update `docs/work/NOW.md` to reflect completed status.
- [ ] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md) -- cover empty states, populated states, gated-panel placeholders, error path.
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Write review doc per standard workflow; set `review_status: done` once fixes are in.
- [ ] Commit final docs updates.

## Gating-panel follow-ups (separate PRs)

When the knowledge-graph and study-plan features land, revisit the three placeholder panels. These are NOT part of this work package -- they live in the corresponding work packages and land with those features.

- [ ] Knowledge Graph WP: implement `getCertProgress` and `getDomainCertMatrix` in the graph BC. Update `CertProgressPanel` and `MapPanel` to render real data.
- [ ] Study Plan WP: implement `getActivePlan`. Update `StudyPlanPanel` and the CTA target to route through the session engine.
- [ ] Re-run the dashboard test plan after each gating panel activates.
