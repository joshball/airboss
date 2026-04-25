---
title: Enrollment Management -- Spec
product: ops
feature: enrollment-management
type: spec
status: done
---

# Enrollment Management -- Spec

Operators create and manage learner enrollments. Each enrollment ties a user to a specific published release -- this is the root FAA record that tracks who completed what version of the course.

## Data Model

Enrollment lives in the `enrollment` schema (ADR-004). Tables already exist.

| Table             | Purpose             | Key fields                                         |
| ----------------- | ------------------- | -------------------------------------------------- |
| `enrollment`      | Root record         | userId, releaseId, status, enrolledAt, completedAt |
| `module_progress` | Per-module tracking | enrollmentId, moduleId, status                     |
| `lesson_attempt`  | Per-lesson runs     | enrollmentId, lessonId, releaseVersion             |
| `time_log`        | FAA time tracking   | enrollmentId, faaQualified, durationSeconds, topic |
| `learner_profile` | Intake data         | userId, backgroundData, selfAssessment             |

**Status values:** `active`, `completed`, `withdrawn` (from `ENROLLMENT_STATUS` in `@firc/constants`).

## Behavior

### Enrollment List

- Default: all enrollments, newest first
- Filter by: status, releaseId, date range
- Search by: user name or email (joined from `bauth_user`)
- Shows: user name, email, release version, status, enrolled date

### Enrollment Detail

- Header: user info (name, email), enrollment status, enrolled date
- Sections: module progress, time breakdown, lesson attempts
- Time breakdown: total seconds, FAA-qualified seconds, per-topic breakdown
- Module progress: list of modules with status (not_started/in_progress/completed)

### Create Enrollment

- Select user (from `bauth_user` where role = learner)
- Select published release (from `published.release`, newest first)
- Validates: user not already enrolled in same release
- Creates enrollment record with status `active`

### Update Status

- Operator changes status: active -> completed, active -> withdrawn
- `completed` sets `completedAt` timestamp
- Status changes are audited via `@firc/audit`
- No re-activation of withdrawn enrollments (create new instead)

## Validation Rules

| Rule                                                              | Enforcement                   |
| ----------------------------------------------------------------- | ----------------------------- |
| One active enrollment per user per release                        | Unique check before insert    |
| Status transitions: active -> completed, active -> withdrawn only | BC function validates         |
| Release must exist and be published                               | FK constraint + BC check      |
| User must exist and not be banned                                 | BC check against `bauth_user` |

## FAA Implications

- Enrollment is the root FAA record -- "which person completed which version"
- Status changes (especially to `completed` or `withdrawn`) must be audited
- Time logs distinguish FAA-qualified from non-qualified time (displayed, not editable here)
- Records retained 24+ months per FAA, 5+ years for TSA-applicable records
