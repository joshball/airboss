---
title: Analytics Dashboard -- Tasks
product: ops
feature: analytics-dashboard
type: tasks
status: done
---

# Analytics Dashboard -- Tasks

## Implementation

| #   | Task                                                                                                                      | Status                |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Route constant: `OPS_ANALYTICS` in `libs/constants/src/routes.ts`                                                         | [x] (already existed) |
| 2   | BC: `getEnrollmentStats()` in `libs/bc/enrollment/src/manage.ts` -- aggregate counts                                      | [x]                   |
| 3   | BC: `getModuleCompletionRates()` in `libs/bc/enrollment/src/manage.ts` -- per-module %                                    | [x]                   |
| 4   | BC: `getTimeDistribution()` in `libs/bc/enrollment/src/manage.ts` -- time by topic                                        | [x]                   |
| 5   | BC: `getEnrollmentTrends(months)` in `libs/bc/enrollment/src/manage.ts` -- monthly counts                                 | [x]                   |
| 6   | BC: `getScenarioFailureRates()` in `libs/bc/evidence/src/manage.ts` -- per-scenario stats                                 | [x]                   |
| 7   | BC: `getAverageScore()` in `libs/bc/evidence/src/manage.ts` -- mean score                                                 | [x]                   |
| 8   | Server load: `apps/ops/src/routes/(app)/analytics/+page.server.ts` -- fetch all stats in parallel                         | [x]                   |
| 9   | Page component: `+page.svelte` -- summary cards, enrollment trends, module completion, struggle points, time distribution | [x]                   |
| 10  | Sidebar nav: "Analytics" link in ops layout                                                                               | [x] (already existed) |
| 11  | Ops root `/` redirects to `/analytics`                                                                                    | [x]                   |
| 12  | `bun run check` passes                                                                                                    | [x]                   |

## File Inventory

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `libs/constants/src/routes.ts`                        | Route constant (pre-existing) |
| `libs/bc/enrollment/src/manage.ts`                    | Aggregate query functions     |
| `libs/bc/evidence/src/manage.ts`                      | Scenario stats functions      |
| `apps/ops/src/routes/(app)/analytics/+page.server.ts` | Data loading                  |
| `apps/ops/src/routes/(app)/analytics/+page.svelte`    | Dashboard UI                  |
| `apps/ops/src/routes/(app)/+page.server.ts`           | Root redirect to /analytics   |
| `libs/ui/src/components/SectionTitle.svelte`          | New shared component          |
| `libs/ui/src/components/DataTable.svelte`             | Added .danger cell style      |
