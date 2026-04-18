---
title: Analytics Dashboard -- Spec
product: ops
feature: analytics-dashboard
type: spec
status: done
---

# Analytics Dashboard -- Spec

Dashboard showing aggregate metrics: completion rates, average scores, time distribution, struggle points, enrollment trends.

## Route

`/analytics` -- route constant `OPS_ANALYTICS`.

## Data Sources

| Source     | Schema       | Tables                                      | Access              |
| ---------- | ------------ | ------------------------------------------- | ------------------- |
| Enrollment | `enrollment` | `enrollment`, `module_progress`, `time_log` | `enrollment/manage` |
| Evidence   | `evidence`   | `scenario_run`, `score_dimension`           | `evidence/manage`   |

## Dashboard Sections

### 1. Summary Cards

Top-level metrics displayed as stat cards:

| Metric              | Calculation                                  |
| ------------------- | -------------------------------------------- |
| Total enrollments   | Count of `enrollment` rows                   |
| Active enrollments  | Count where `status = 'active'`              |
| Completion rate     | Completed / total enrollments (%)            |
| Average score       | Mean of `scenario_run.score` across all runs |
| Total training time | Sum of `time_log.durationSeconds`            |

### 2. Enrollment Trends

Line chart (or table) showing enrollments over time:

- X axis: month
- Y axis: count of new enrollments
- Stacked or colored by status (active, completed, withdrawn)
- Default range: last 12 months

### 3. Completion Rates by Module

Bar chart (or table) showing per-module completion:

| Column          | Source                                                  |
| --------------- | ------------------------------------------------------- |
| Module title    | `module_progress.moduleId` -> published module          |
| Completion rate | Completed / total `module_progress` for that module (%) |
| Average time    | Mean `time_log.durationSeconds` by topic                |

### 4. Struggle Points

Scenarios with high failure rates. Helps operators identify training effectiveness issues.

| Column         | Source                                          |
| -------------- | ----------------------------------------------- |
| Scenario title | `scenario_run.scenarioId` -> published scenario |
| Run count      | Count of `scenario_run` rows for this scenario  |
| Failure rate   | Runs with `outcome = 'unsafe'` / total runs (%) |
| Average score  | Mean `score` for this scenario                  |

Sorted by failure rate descending. Top 10 shown by default.

### 5. Time Distribution

How learners spend their time across FAA topics:

| Column              | Source                        |
| ------------------- | ----------------------------- |
| Topic               | `time_log.topic`              |
| Total time          | Sum `durationSeconds`         |
| Learner count       | Count distinct `enrollmentId` |
| Average per learner | Total time / learner count    |

## BC Functions

### Existing

- `enrollment/manage.listEnrollments()` -- all enrollments
- `evidence/manage.listRunsByUser(userId)` -- runs per user

### Needed

| Function                      | BC                  | Purpose                                               |
| ----------------------------- | ------------------- | ----------------------------------------------------- |
| `getEnrollmentStats()`        | `enrollment/manage` | Aggregate counts: total, active, completed, withdrawn |
| `getModuleCompletionRates()`  | `enrollment/manage` | Per-module completion percentage                      |
| `getTimeDistribution()`       | `enrollment/manage` | Time by topic, aggregated                             |
| `getEnrollmentTrends(months)` | `enrollment/manage` | Enrollments grouped by month                          |
| `getScenarioFailureRates()`   | `evidence/manage`   | Per-scenario run count, failure rate, avg score       |
| `getAverageScore()`           | `evidence/manage`   | Mean score across all runs                            |

All aggregate functions use Drizzle `sql` for `COUNT`, `AVG`, `SUM`, `GROUP BY`. No raw SQL strings.

## Chart Strategy

Initial implementation: tables only. Charts added later if needed. Tables are accessible, printable, and work without JS charting libraries. If charts are added, use a lightweight library (decision deferred).

## FAA Relevance

Not directly FAA-required. Helps operators identify training effectiveness issues, which supports continuous improvement of the FIRC program.
