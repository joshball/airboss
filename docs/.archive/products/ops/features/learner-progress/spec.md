---
title: Learner Progress -- Spec
product: ops
feature: learner-progress
type: spec
status: done
---

# Learner Progress -- Spec

View a learner's progress through their enrollment: modules completed, time spent, scenario scores, knowledge check results.

## Route

`/enrollments/[enrollmentId]/progress` -- route constant `OPS_ENROLLMENT_PROGRESS(enrollmentId)`.

## Data Sources

| Source     | Schema       | Tables                                                        | Access              |
| ---------- | ------------ | ------------------------------------------------------------- | ------------------- |
| Enrollment | `enrollment` | `enrollment`, `module_progress`, `time_log`, `lesson_attempt` | `enrollment/manage` |
| Evidence   | `evidence`   | `scenario_run`, `score_dimension`                             | `evidence/manage`   |

## Page Sections

### 1. Enrollment Header

| Field                | Source                                             |
| -------------------- | -------------------------------------------------- |
| Learner name         | `enrollment.userId` -> `bauth_user.email`          |
| Release version      | `enrollment.releaseId`                             |
| Status               | `enrollment.status` (active, completed, withdrawn) |
| Enrolled date        | `enrollment.enrolledAt`                            |
| Completed date       | `enrollment.completedAt` (if completed)            |
| Overall completion % | Derived: completed modules / total modules         |

### 2. Module Progress Table

| Column       | Source                                                         |
| ------------ | -------------------------------------------------------------- |
| Module title | `module_progress.moduleId` -> published module title           |
| Status       | `module_progress.status` (not_started, in_progress, completed) |
| Started at   | `module_progress.startedAt`                                    |
| Completed at | `module_progress.completedAt`                                  |
| Time spent   | Sum of `time_log` entries for this module's topic              |

Rows sorted by module sort order.

### 3. Time Accumulation

| Field                | Source                                             |
| -------------------- | -------------------------------------------------- |
| Total time (seconds) | Sum of `time_log.durationSeconds`                  |
| FAA-qualified time   | Sum where `time_log.faaQualified = true`           |
| Time by topic        | Group `time_log` by `topic`, sum `durationSeconds` |

FAA topic time accumulation is the primary compliance metric. Display as a topic breakdown table with bars showing progress toward required minimums.

### 4. Scenario Runs

| Column         | Source                                                |
| -------------- | ----------------------------------------------------- |
| Scenario title | `scenario_run.scenarioId` -> published scenario title |
| Outcome        | `scenario_run.outcome` (safe, unsafe, incomplete)     |
| Score          | `scenario_run.score`                                  |
| Duration       | `scenario_run.durationSeconds`                        |
| Date           | `scenario_run.startedAt`                              |

Score dimension drill-down: clicking a run shows `score_dimension` breakdown (dimension, score, maxScore, notes).

### 5. Knowledge Check Results

Derived from `lesson_attempt` records where `itemType` matches knowledge check content. Shows pass/fail per module.

## BC Functions

### Existing

- `enrollment/manage.getEnrollment(id)` -- enrollment record
- `enrollment/manage.getTimeLogs(enrollmentId)` -- time log entries
- `evidence/manage.listRunsByUser(userId)` -- all scenario runs for user
- `evidence/manage.getScoreDimensions(runId)` -- score breakdown for a run

### Needed

| Function                             | BC                  | Purpose                                                       |
| ------------------------------------ | ------------------- | ------------------------------------------------------------- |
| `getModuleProgress(enrollmentId)`    | `enrollment/manage` | All module_progress rows for an enrollment                    |
| `getLessonAttempts(enrollmentId)`    | `enrollment/manage` | All lesson_attempt rows for an enrollment                     |
| `listRunsByEnrollment(enrollmentId)` | `evidence/manage`   | Scenario runs filtered by enrollment (via userId + releaseId) |

## FAA Relevance

- Shows FAA topic time accumulation (required for AC 61-83K compliance)
- Pass/fail per module feeds certificate eligibility
- Overall completion % determines graduation readiness
