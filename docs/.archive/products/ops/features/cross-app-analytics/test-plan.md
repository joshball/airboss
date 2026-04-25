---
title: "Test Plan: Cross-App Analytics"
product: ops
feature: cross-app-analytics
type: test-plan
status: done
---

# Test Plan: Cross-App Analytics

## Setup

```bash
bun db reset --force   # fresh DB with all seeds + test enrollment
bun scripts/dev.ts ops
```

Requires: at least one enrollment with some scenario runs and knowledge check completions. Ideally 3+ enrollments with varying performance for meaningful aggregation.

---

## LA-1: Learner analytics loads

1. Navigate to `/analytics/learner`
2. **Expected:** Completion rate percentage shown
3. **Expected:** Average course duration shown
4. **Expected:** Scenario pass rate and average score shown

## LA-2: Struggle points identified

1. Ensure scenario runs exist with low scores in a specific competency domain
2. Navigate to `/analytics/learner`
3. **Expected:** That domain appears in struggle points list with average score below threshold

## LA-3: Mode distribution

1. Ensure runs exist with different modes (course, free_play, drill)
2. Navigate to `/analytics/learner`
3. **Expected:** Mode breakdown shows correct counts

## LA-4: Time range filter

1. On `/analytics/learner`, select "Week" time range
2. **Expected:** Metrics reflect only the last 7 days of data
3. Select "All Time"
4. **Expected:** Metrics reflect all historical data
5. **Expected:** URL contains `?range=week` or `?range=all`

---

## CE-1: Content effectiveness loads

1. Navigate to `/analytics/content`
2. **Expected:** Difficulty calibration table shown
3. **Expected:** Scenarios listed with authored difficulty and actual pass rate

## CE-2: Difficulty miscalibration visible

1. Ensure a "hard" scenario has a high pass rate (or vice versa)
2. Navigate to `/analytics/content`
3. **Expected:** Scenario appears with visible discrepancy between difficulty and pass rate

## CE-3: Question discrimination

1. Ensure enough scenario runs for top/bottom 27% split (need 4+ distinct learners minimum)
2. Navigate to `/analytics/content`
3. **Expected:** Questions with poor discrimination flagged
4. If insufficient data: **Expected:** "Insufficient data" message instead of index

## CE-4: Time accuracy

1. Navigate to `/analytics/content`
2. **Expected:** Table showing estimated vs actual duration per scenario
3. **Expected:** Large discrepancies highlighted

---

## OP-1: Operational metrics loads

1. Navigate to `/analytics/operational`
2. **Expected:** Enrollment counts by status shown
3. **Expected:** Last regulatory check date shown

## OP-2: Enrollment velocity

1. Create enrollments across multiple weeks
2. Navigate to `/analytics/operational`
3. **Expected:** Velocity chart/table shows enrollments per period

## OP-3: Compliance status

1. Ensure regulatory check exists (or doesn't)
2. Navigate to `/analytics/operational`
3. **Expected:** If no check: "Never checked" with warning
4. **Expected:** If check > 90 days ago: overdue warning
5. **Expected:** If recent check: days since check with green status

## OP-4: Content freshness

1. Navigate to `/analytics/operational`
2. **Expected:** Shows days since last content publish
3. **Expected:** If no publish exists, shows "Never published"

---

## NAV-1: Tab navigation

1. Navigate to `/analytics/learner`
2. Click "Content" tab
3. **Expected:** Navigate to `/analytics/content`
4. Click "Operational" tab
5. **Expected:** Navigate to `/analytics/operational`

## NAV-2: Time range preserved across tabs

1. On `/analytics/learner`, set time range to "Quarter"
2. Click "Content" tab
3. **Expected:** URL contains `?range=quarter`
4. **Expected:** Content data reflects quarterly range

## NAV-3: Empty state

1. Start with empty DB (no enrollments, no runs)
2. Navigate to `/analytics/learner`
3. **Expected:** All metrics show zero or "No data". No errors.
