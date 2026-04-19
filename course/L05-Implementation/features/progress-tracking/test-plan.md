---
title: "Test Plan: Progress Tracking"
product: sim
feature: progress-tracking
type: test-plan
status: done
---

# Test Plan: Progress Tracking

## Setup

```bash
bun scripts/dev.ts sim
```

Requires: enrollment record for dev user. Complete at least one scenario before testing time logging.

---

## PROG-1: Not enrolled state

1. Navigate to `/progress` with a user that has no enrollment record
2. **Expected:** Page shows "not enrolled" message, no module or time data

## PROG-2: Enrolled, no activity

1. With enrollment but no scenario completions or time logs:
2. Navigate to `/progress`
3. **Expected:** Enrollment card shows "Active"
4. **Expected:** All 6 modules show "Not Started"
5. **Expected:** All 13 FAA topics show "0 min"
6. **Expected:** Total FAA time shows "0:00" / "16:00"
7. **Expected:** Completion checklist: all items unchecked

## PROG-3: Module progress after scenario completion

1. Complete a scenario in Module 3 (LOC) via the scenario player
2. Navigate to `/progress`
3. **Expected:** Module 3 shows "In Progress" (at minimum)
4. **Expected:** Other modules still show "Not Started"

## PROG-4: FAA time after scenario completion

1. After completing at least one scenario:
2. Navigate to `/progress`
3. **Expected:** FAA-qualified time > 0:00
4. **Expected:** The topic matching the completed scenario's FAA topic shows time logged
5. **Expected:** Exploratory time shows 0:00 (all Phase 2 scenarios are FAA-qualified)

## PROG-5: FAA topic coverage indicators

1. Navigate to `/progress` after enough scenario runs to exceed 45 min on one topic
   (or manually insert time_log entries with duration >= 2700 seconds for one topic)
2. **Expected:** That topic row shows "Covered" status
3. Other topics show "In Progress" or "Not Started"

## PROG-6: Completion checklist (16h goal)

1. Navigate to `/progress`
2. Check the completion checklist:
   - "16 hours FAA-qualified" -- shows progress bar with actual time
3. **Expected:** Item unchecked (not at 16h yet) with accurate time shown

## PROG-7: Exploratory vs FAA-qualified split

1. If there are any `faa_qualified = false` entries in time_log:
2. **Expected:** Exploratory time shows separately from FAA-qualified time
3. **Expected:** Exploratory time does NOT contribute to the 16h requirement

## PROG-8: Module titles from published content

1. Navigate to `/progress`
2. **Expected:** Module titles match the published content (not hardcoded strings)
3. Example: "Module 3 -- Loss of Control Lab" (from published.module.title)
