---
title: "Test Plan: Hangar Analytics"
product: hangar
feature: analytics
type: test-plan
status: done
---

# Test Plan: Hangar Analytics

## Setup

```bash
bun db reset --force   # fresh DB with all seeds + test enrollment
bun scripts/dev.ts hangar
```

Requires: at least one published scenario, a few questions with `purpose = 'faa'`.

---

## COV-1: Coverage dashboard loads

1. Navigate to `/analytics/coverage`
2. **Expected:** Heat map table with 13 FAA topic rows
3. **Expected:** Module columns shown
4. **Expected:** Cells colored by coverage depth (red/yellow/green)

## COV-2: Competency gaps shown

1. On coverage dashboard, scroll to competency section
2. **Expected:** Competencies with 0 scenarios listed as gaps
3. **Expected:** Competencies with scenarios show count

## COV-3: Empty state

1. Delete all scenarios (or use empty DB)
2. Navigate to `/analytics/coverage`
3. **Expected:** All cells red. Gap list shows all topics and competencies.

---

## INV-1: Inventory dashboard loads

1. Navigate to `/analytics/inventory`
2. **Expected:** Scenario counts by status visible
3. **Expected:** Counts by topic, competency, difficulty shown

## INV-2: Status breakdown accurate

1. Create 2 draft scenarios and 1 published scenario
2. Navigate to `/analytics/inventory`
3. **Expected:** Draft: 2, Published: 1 (or appropriate numbers matching DB)

---

## QB-1: Question bank stats load

1. Navigate to `/analytics/questions`
2. **Expected:** Question counts by status shown
3. **Expected:** FAA vs lesson breakdown shown

## QB-2: Shallow pool detection

1. Create 2 FAA questions in the same pool (below MIN_POOL_DEPTH of 3)
2. Navigate to `/analytics/questions`
3. **Expected:** Pool flagged as shallow

## QB-3: Retirement warning

1. Create a question with `createdAt` > 18 months ago (via direct DB insert for testing)
2. Navigate to `/analytics/questions`
3. **Expected:** Question appears in "approaching retirement" list

---

## TIME-1: Time projection loads

1. Navigate to `/analytics/time`
2. **Expected:** Per-topic time bars shown
3. **Expected:** 45-min minimum line visible for each topic
4. **Expected:** Total course time vs 16-hour minimum shown

## TIME-2: Under-threshold warning

1. Ensure a topic has < 45 min of scenario time
2. Navigate to `/analytics/time`
3. **Expected:** Topic shown in fail/red state

## TIME-3: Warning zone

1. Ensure a topic has between 45-54 min (above min, below warning threshold)
2. Navigate to `/analytics/time`
3. **Expected:** Topic shown in warning/yellow state

---

## NAV-1: Tab navigation

1. Navigate to `/analytics/coverage`
2. Click "Inventory" tab
3. **Expected:** Navigate to `/analytics/inventory`
4. Click "Questions" tab
5. **Expected:** Navigate to `/analytics/questions`
6. Click "Time" tab
7. **Expected:** Navigate to `/analytics/time`
8. **Expected:** Active tab highlighted on each page

## NAV-2: Direct URL access

1. Navigate directly to `/analytics/time`
2. **Expected:** Time projection page loads, "Time" tab active
