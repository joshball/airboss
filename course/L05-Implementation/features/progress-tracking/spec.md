---
title: "Spec: Progress Tracking"
product: sim
feature: progress-tracking
type: spec
status: done
---

# Spec: Progress Tracking

Dashboard showing enrollment status, module completion, FAA time tracking, and completion criteria. The learner's flight record.

## What It Does

The `/progress` route shows a learner everything about where they stand:

- Enrollment status and current release
- Module completion (6 modules, each with scenario and check completion)
- FAA topic coverage (13 topics, time vs. 45-min threshold)
- Total FAA-qualified time vs. 16-hour requirement
- Completion checklist
- Certificate (if issued)

## Data Model

**Reads from:**

| Source                             | What it provides                                          |
| ---------------------------------- | --------------------------------------------------------- |
| `enrollment.enrollment`            | Enrollment status, releaseId                              |
| `enrollment.module_progress`       | Per-module status (not_started / in_progress / completed) |
| `enrollment.time_log`              | Time entries: durationSeconds, faaQualified, topic        |
| `enrollment.certificate`           | Certificate if issued                                     |
| `published.module` (via releaseId) | Module titles, scenario IDs                               |

**No new tables or BC functions needed.** Uses existing `enrollment/write.ts` read functions.

**New BC read functions needed in `enrollment/write.ts`:**

- `getOwnTimeLog(enrollmentId)` -- gets all time entries for an enrollment
- `getOwnCertificate(enrollmentId)` -- gets certificate if exists

## Behavior

### Enrollment status card

- Shows: enrolled / not enrolled / completed
- Shows: release version they're enrolled in (e.g., v1.0.0)
- If not enrolled: shows notice "Contact your administrator to enroll" (ops manages enrollment in Phase 2)

### Module progress

Six module rows, each showing:

- Module title
- Status chip: Not Started / In Progress / Completed
- Progress bar: scenarios completed / total scenarios

Clicking a module navigates to `/course/:moduleId` (course dashboard feature -- shows scenario list for that module).

### FAA topic coverage

A table of all 13 FAA topics:

| Topic | Time logged | Status              |
| ----- | ----------- | ------------------- |
| LOC   | 52 min      | Covered (>= 45 min) |
| TSA   | 23 min      | In progress         |
| ACS   | 0 min       | Not started         |
| ...   |             |                     |

Time is summed from `time_log` entries where `topic` matches the FAA topic code. Topics covered = time >= 45 min.

### Total time summary

- FAA-qualified time: HH:MM (sum of `faa_qualified = true` entries)
- Target: 16:00
- Progress bar
- Exploratory time: HH:MM (sum of `faa_qualified = false`) -- shown separately, never counted toward requirement

### Completion checklist

- [ ] 16 hours FAA-qualified time
- [ ] All 13 topics >= 45 minutes
- [ ] All 6 modules completed
- [ ] All assessments passed (knowledge checks -- Phase 2 deferred: show as "not yet available")

### Certificate

If `enrollment.certificate` exists: show it with issue date and "Download" (deferred -- ops issues certificates).

## Calculations

All calculations done in the page load function (server-side), not client-side.

```typescript
// Pseudo-code for time calculations
const timeLogs = await getOwnTimeLog(enrollment.id);
const faaTime = timeLogs.filter((t) => t.faaQualified).reduce((sum, t) => sum + t.durationSeconds, 0);
const exploratoryTime = timeLogs.filter((t) => !t.faaQualified).reduce((sum, t) => sum + t.durationSeconds, 0);

const topicCoverage = FAA_TOPICS.map((topic) => ({
  topic,
  seconds: timeLogs.filter((t) => t.topic === topic).reduce((sum, t) => sum + t.durationSeconds, 0),
}));
```

## Edge Cases

- No enrollment record -> show "not enrolled" state, all other sections empty
- Enrollment exists but no time logged -> all zeros, all topics "not started"
- Some modules have no progress records -> show as "not started"
- `time_log` topic is null -> counts toward FAA total time but not any specific topic
