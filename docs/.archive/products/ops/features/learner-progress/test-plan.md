---
title: Learner Progress -- Test Plan
product: ops
feature: learner-progress
type: test-plan
status: done
---

# Learner Progress -- Test Plan

Manual test plan. Run with ops dev server (`bun run dev` in `apps/ops`).

## Prerequisites

- PostgreSQL running (OrbStack)
- Database migrated with enrollment and evidence schemas
- At least one enrollment with module progress, time logs, and scenario runs seeded
- Ops app running locally

## Tests

### 1. Progress Page Load

| Step | Action                                                                    | Expected                                                                        |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1.1  | Navigate to `/enrollments/[enrollmentId]/progress` for a valid enrollment | Page loads with enrollment header showing learner email, release, status, dates |
| 1.2  | Navigate with non-existent enrollmentId                                   | 404 error page                                                                  |
| 1.3  | Verify overall completion %                                               | Correct ratio of completed modules to total modules                             |

### 2. Module Progress Table

| Step | Action                          | Expected                                                    |
| ---- | ------------------------------- | ----------------------------------------------------------- |
| 2.1  | View module table               | All modules listed in sort order with status, dates, time   |
| 2.2  | Verify status badges            | not_started = grey, in_progress = blue, completed = green   |
| 2.3  | Module with no progress records | Shows "not_started" with no dates                           |
| 2.4  | Module with time logs           | Time column shows summed seconds formatted as hours:minutes |

### 3. Time Accumulation

| Step | Action                       | Expected                                                 |
| ---- | ---------------------------- | -------------------------------------------------------- |
| 3.1  | View time section            | Total time displayed, FAA-qualified time displayed       |
| 3.2  | Topic breakdown              | Each topic shows accumulated seconds, FAA-qualified flag |
| 3.3  | Enrollment with no time logs | Time section shows 0:00, empty topic table               |

### 4. Scenario Runs

| Step | Action                    | Expected                                                        |
| ---- | ------------------------- | --------------------------------------------------------------- |
| 4.1  | View scenario runs list   | Runs listed with scenario title, outcome, score, duration, date |
| 4.2  | Click/expand a run        | Score dimensions appear: dimension name, score, maxScore, notes |
| 4.3  | Run with outcome "unsafe" | Outcome displayed with warning styling                          |
| 4.4  | Enrollment with no runs   | Shows "No scenario runs yet" empty state                        |

### 5. Knowledge Check Results

| Step | Action                  | Expected                   |
| ---- | ----------------------- | -------------------------- |
| 5.1  | View knowledge checks   | Pass/fail shown per module |
| 5.2  | Module with no attempts | Shows "Not attempted"      |

### 6. Edge Cases

| Step | Action                          | Expected                               |
| ---- | ------------------------------- | -------------------------------------- |
| 6.1  | Withdrawn enrollment            | Page loads, status shows "withdrawn"   |
| 6.2  | Completed enrollment            | Page loads, completedAt date displayed |
| 6.3  | Enrollment with many runs (20+) | All runs displayed, page doesn't break |
