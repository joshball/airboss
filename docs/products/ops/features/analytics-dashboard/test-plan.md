---
title: Analytics Dashboard -- Test Plan
product: ops
feature: analytics-dashboard
type: test-plan
status: done
---

# Analytics Dashboard -- Test Plan

Manual test plan. Run with ops dev server (`bun run dev` in `apps/ops`).

## Prerequisites

- PostgreSQL running (OrbStack)
- Database migrated with enrollment and evidence schemas
- Seed data: multiple enrollments across several months, with varied statuses, time logs, scenario runs (mix of safe/unsafe outcomes)
- Ops app running locally

## Tests

### 1. Summary Cards

| Step | Action                   | Expected                                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------ |
| 1.1  | Navigate to `/analytics` | Five stat cards visible: total enrollments, active, completion rate, avg score, total time |
| 1.2  | Verify total enrollments | Matches count of enrollment rows in DB                                                     |
| 1.3  | Verify completion rate   | Completed / total as percentage                                                            |
| 1.4  | Verify average score     | Mean of all scenario_run.score values                                                      |
| 1.5  | Empty database           | All cards show 0 or "N/A", no errors                                                       |

### 2. Enrollment Trends

| Step | Action                       | Expected                                                     |
| ---- | ---------------------------- | ------------------------------------------------------------ |
| 2.1  | View enrollment trends table | Monthly breakdown for last 12 months                         |
| 2.2  | Verify counts                | Each month's count matches DB (group by month of enrolledAt) |
| 2.3  | Month with no enrollments    | Row shows 0                                                  |

### 3. Module Completion Rates

| Step | Action                                      | Expected                                          |
| ---- | ------------------------------------------- | ------------------------------------------------- |
| 3.1  | View module completion table                | All modules listed with completion % and avg time |
| 3.2  | Module with 100% completion                 | Shows "100%"                                      |
| 3.3  | Module with 0% completion (all not_started) | Shows "0%"                                        |
| 3.4  | No module_progress records                  | All modules show 0%                               |

### 4. Struggle Points

| Step | Action                             | Expected                            |
| ---- | ---------------------------------- | ----------------------------------- |
| 4.1  | View struggle points table         | Top 10 scenarios by failure rate    |
| 4.2  | Scenario with 100% unsafe outcomes | Shows at top, failure rate 100%     |
| 4.3  | Scenario with all safe outcomes    | Low in list or absent from top 10   |
| 4.4  | Scenario with one run              | Still appears with correct rate     |
| 4.5  | No scenario runs                   | Empty state: "No scenario data yet" |

### 5. Time Distribution

| Step | Action                       | Expected                                              |
| ---- | ---------------------------- | ----------------------------------------------------- |
| 5.1  | View time distribution table | Topics listed with total time, learner count, average |
| 5.2  | Topic with one learner       | Learner count = 1, average = total                    |
| 5.3  | No time logs                 | Empty state message                                   |

### 6. Edge Cases

| Step | Action                                    | Expected                                             |
| ---- | ----------------------------------------- | ---------------------------------------------------- |
| 6.1  | Dashboard with only 1 enrollment, no runs | Summary cards show 1 enrollment, 0 score, page loads |
| 6.2  | Dashboard with 1000+ enrollments          | Page loads without timeout                           |
| 6.3  | Scenario runs with null scores            | Excluded from average calculation, no NaN            |
