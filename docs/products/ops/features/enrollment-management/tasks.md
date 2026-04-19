---
title: Enrollment Management -- Tasks
product: ops
feature: enrollment-management
type: tasks
status: done
---

# Enrollment Management -- Tasks

Depends on: ops-shell (feature 1), user-management (feature 2).

## Pre-flight

- [x] Design review completed and approved
- [x] Read `docs/agents/best-practices.md`
- [x] Read `docs/agents/reference-sveltekit-patterns.md`
- [x] Confirm ops app shell exists with auth + layout

## Constants and Types

- [x] Add ops enrollment routes to `ROUTES` in `libs/constants/src/routes.ts`
- [x] Add `EnrollmentWithUser` type to `libs/bc/enrollment/src/manage.ts`
- [x] Add enrollment filter type to `libs/bc/enrollment/src/manage.ts`
- [x] Add enrollment Zod schemas to `libs/types/src/schemas.ts`
- [x] Add `ENROLLMENT_ACTIONS` audit constants to `libs/constants/src/audit.ts`

## BC Layer

- [x] Add `listReleases()` to `@firc/bc/course/read`
- [x] Add `listEnrollmentsWithUser(filters)` to `@firc/bc/enrollment/manage`
- [x] Add `getEnrollmentWithUser(id)` to `@firc/bc/enrollment/manage`
- [x] Add `getModuleProgress(enrollmentId)` to `@firc/bc/enrollment/manage`
- [x] Add `getLessonAttempts(enrollmentId)` to `@firc/bc/enrollment/manage`
- [x] Add `getTimeSummary(enrollmentId)` to `@firc/bc/enrollment/manage`
- [x] Add `hasActiveEnrollment(userId, releaseId)` duplicate check
- [x] Add status transition validation to `updateEnrollmentStatus`

## Routes (apps/ops)

- [x] `GET /enrollments` -- list page with server-side filters
- [x] `GET /enrollments/new` -- create form (user picker + release picker)
- [x] `POST /enrollments/new` -- form action: create enrollment
- [x] `GET /enrollments/[id]` -- detail page (progress, time, attempts)
- [x] `POST /enrollments/[id]` -- form action: update status

## UI Components

- [x] Enrollment list table with search and filter controls
- [x] Create enrollment form (user select + release select)
- [x] Enrollment detail header (user info, status, dates)
- [x] Module progress section
- [x] Time breakdown section (FAA-qualified vs total, per-topic)
- [x] Lesson attempts section
- [x] Status change with ConfirmDialog

## Integration

- [x] Audit logging for status changes via `@firc/audit`
- [x] Audit logging for enrollment creation via `@firc/audit`
- [x] Role guard (OPERATOR/ADMIN only) on all enrollment routes
- [x] Enrollment nav link already in ops sidebar

## Verification

- [x] `bun run check` passes (0 errors, 0 warnings)
- [ ] Manual test plan executed
- [x] Docs updated (tasks.md, spec.md)
