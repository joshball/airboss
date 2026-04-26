---
title: "Test Plan: Traceability Matrix Editor"
product: hangar
feature: traceability-matrix
type: test-plan
status: done
---

# Test Plan: Traceability Matrix Editor

## Setup

- Hangar app running (`bun dev` from `apps/hangar/`)
- Database seeded with competencies and modules (`bun run db seed`)
- At least 2-3 scenarios created with different FAA topics
- Logged in as admin or author role

---

## TM-1: Empty matrix displays 13 rows

1. Ensure no traceability entries exist (fresh DB)
2. Navigate to `/compliance/traceability`
3. **Expected:** 13 rows shown, one per FAA topic (A.1-A.13). Each row shows topic code + internal name. All cells empty. Status shows "missing" for all rows.

## TM-2: FAA topic labels correct

1. Navigate to `/compliance/traceability`
2. Hover over (or expand) the A.1 row topic cell
3. **Expected:** Full FAA title shown: "Navigating in the 21st Century: Pilotage to Global Positioning System (GPS), Automation, and Technically Advanced Aircraft (TAA)". Matches AC 61-83K Appendix A verbatim.

## TM-3: Sync from Content auto-populates

1. Create 2 scenarios: one with faaTopics `[FAA_TOPIC.A_1, FAA_TOPIC.A_4]`, one with faaTopics `[FAA_TOPIC.A_4, FAA_TOPIC.A_11]`
2. Navigate to `/compliance/traceability`
3. Click "Sync from Content"
4. **Expected:** A.1 row shows 1 scenario. A.4 row shows 2 scenarios. A.11 row shows 1 scenario. Competencies auto-populated based on faaTopic matching. Time computed from scenario durations. Other topics remain empty with status "missing".

## TM-4: Edit modules

1. On the A.1 row, open the modules multi-select
2. Select Module 1 and Module 2
3. Save the row
4. **Expected:** A.1 row shows both modules. Persisted on reload.

## TM-5: Edit scenarios manually

1. On the A.7 row (currently empty), open the scenarios multi-select
2. Select a scenario
3. Save the row
4. **Expected:** A.7 row shows the selected scenario. Time updates to that scenario's duration.

## TM-6: Structured assessment methods

1. On any row, open the assessment methods picker
2. Select "Scenario" and "Knowledge Check"
3. Type in the notes field: "Module 2 knowledge check covers theory"
4. Save the row
5. **Expected:** Assessment shows both methods and notes. Persisted on reload.

## TM-7: Notes field

1. On any row, type a note in the notes field
2. Save the row
3. **Expected:** Note persisted. Visible on reload.

## TM-8: Time auto-computes from scenarios

1. Create a scenario with duration = 30 minutes, faaTopics includes A.5
2. Create another with duration = 20 minutes, faaTopics includes A.5
3. Sync from Content
4. **Expected:** A.5 row shows 50 minutes. Time column is not manually editable.

## TM-9: Coverage -- complete

1. Set up A.3 row with: 1 scenario (duration >= 45 min), 1 competency
2. Save the row
3. **Expected:** Status shows "complete"

## TM-10: Coverage -- partial (missing competencies)

1. Set up a row with 1 scenario (duration >= 45 min) but no competencies
2. Save
3. **Expected:** Status shows "partial"

## TM-11: Coverage -- partial (time below threshold)

1. Set up a row with 1 scenario (duration 30 min) and 1 competency
2. Save
3. **Expected:** Status shows "partial" (time < 45 min)

## TM-12: Coverage -- missing

1. Remove all scenarios and competencies from a row
2. Save
3. **Expected:** Status shows "missing"

## TM-13: Sync overwrites manual edits

1. Manually add a scenario to A.2 and save
2. Click "Sync from Content"
3. **Expected:** A.2 row reflects only scenarios that have A.2 in their faaTopics. Manual addition replaced if the scenario doesn't match.

## TM-14: Deleted scenario flagged

1. Link a scenario to A.1 in the matrix and save
2. Soft-delete that scenario via the scenarios list
3. Navigate to `/compliance/traceability`
4. **Expected:** The deleted scenario appears in A.1 row but flagged as "(deleted)"

## TM-15: Sync removes deleted scenarios

1. With a deleted scenario in the A.1 row (from TM-14)
2. Click "Sync from Content"
3. **Expected:** Deleted scenario removed from A.1 row. Time and status recalculated.

## TM-16: Live validation display

1. Navigate to `/compliance/traceability`
2. **Expected:** Matrix completeness validation result shown inline. Topics with incomplete entries highlighted.

## TM-17: Auth guard

1. Log out or use a user without author/admin role
2. Navigate to `/compliance/traceability`
3. **Expected:** Redirected to login or authorization error.

## TM-18: Audit logging

1. Save a row edit
2. Click "Sync from Content"
3. Check the audit log (via ops or DB query)
4. **Expected:** Both actions logged with user ID, action type, and details.
