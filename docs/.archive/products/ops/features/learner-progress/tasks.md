---
title: Learner Progress -- Tasks
product: ops
feature: learner-progress
type: tasks
status: done
---

# Learner Progress -- Tasks

## Implementation

| #   | Task                                                                                                                                              | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Route constant: `OPS_ENROLLMENT_PROGRESS` in `libs/constants/src/routes.ts`                                                                       | [x]    |
| 2   | BC: `getModuleProgress(enrollmentId)` in `libs/bc/enrollment/src/manage.ts`                                                                       | [x]    |
| 3   | BC: `getLessonAttempts(enrollmentId)` in `libs/bc/enrollment/src/manage.ts`                                                                       | [x]    |
| 4   | BC: `listRunsByEnrollment(enrollmentId)` in `libs/bc/evidence/src/manage.ts` -- filter by userId + releaseId from enrollment                      | [x]    |
| 5   | Server load: `apps/ops/src/routes/(app)/enrollments/[id]/progress/+page.server.ts` -- fetch enrollment, module progress, time logs, scenario runs | [x]    |
| 6   | Page component: `+page.svelte` -- enrollment header, module table, time accumulation, scenario runs, knowledge checks                             | [x]    |
| 7   | Score drill-down: expand/collapse for score dimensions on each scenario run row                                                                   | [x]    |
| 8   | Time topic breakdown: table with topic name, seconds, FAA-qualified flag, progress bar                                                            | [x]    |
| 9   | Link to progress from enrollment detail page                                                                                                      | [x]    |
| 10  | `bun run check` passes                                                                                                                            | [x]    |

## File Inventory

| File                                                                            | Purpose                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `libs/constants/src/routes.ts`                                                  | Route constant                           |
| `libs/bc/enrollment/src/manage.ts`                                              | `getModuleProgress`, `getLessonAttempts` |
| `libs/bc/evidence/src/manage.ts`                                                | `listRunsByEnrollment`                   |
| `apps/ops/src/routes/(app)/enrollments/[enrollmentId]/progress/+page.server.ts` | Data loading                             |
| `apps/ops/src/routes/(app)/enrollments/[enrollmentId]/progress/+page.svelte`    | Progress view UI                         |
