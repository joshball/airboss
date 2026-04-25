---
title: Enrollment Management -- Design
product: ops
feature: enrollment-management
type: design
status: done
---

# Enrollment Management -- Design

## Routes

All routes added to `ROUTES` in `@firc/constants` before use.

| Route               | Purpose              | Method                   |
| ------------------- | -------------------- | ------------------------ |
| `/enrollments`      | List + search/filter | GET                      |
| `/enrollments/new`  | Create form          | GET + POST (form action) |
| `/enrollments/[id]` | Detail view          | GET                      |
| `/enrollments/[id]` | Update status        | POST (form action)       |

## BC Changes

### New functions in `@firc/bc/enrollment/manage`

```ts
// Filter-capable list -- replaces bare listEnrollments for ops use
listEnrollmentsWithUser(filters?: {
  status?: EnrollmentStatus;
  releaseId?: string;
  search?: string;        // matches user name or email
  enrolledAfter?: Date;
  enrolledBefore?: Date;
}): Promise<EnrollmentWithUser[]>

// Single enrollment with user info
getEnrollmentWithUser(id: string): Promise<EnrollmentWithUser | null>

// Module progress for an enrollment
getModuleProgress(enrollmentId: string): Promise<ModuleProgress[]>

// Lesson attempts for an enrollment
getLessonAttempts(enrollmentId: string): Promise<LessonAttempt[]>
```

### New type in `@firc/types`

```ts
type EnrollmentWithUser = {
  id: string;
  userId: string;
  releaseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt: Date | null;
  userName: string;
  userEmail: string;
};
```

### Release lookup

Use existing `@firc/bc/course/read` functions:

- `getLatestRelease()` -- for default selection
- `getRelease(id)` -- for validation

New function needed in `@firc/bc/course/read`:

```ts
listReleases(): Promise<Release[]>  // all releases, newest first
```

## Component Breakdown

| Component              | Location             | Purpose                                   |
| ---------------------- | -------------------- | ----------------------------------------- |
| `EnrollmentList`       | `@firc/ui` or inline | Table with filters, search, status badges |
| `EnrollmentDetail`     | route component      | Header + tabbed sections                  |
| `EnrollmentCreateForm` | route component      | User picker + release picker              |
| `StatusBadge`          | `@firc/ui`           | Colored badge for enrollment status       |
| `TimeBreakdown`        | route component      | FAA-qualified vs total, per-topic table   |
| `ModuleProgressList`   | route component      | Module status cards/rows                  |

## Data Flow

```
+page.server.ts (load)
  -> @firc/bc/enrollment/manage  (enrollment data)
  -> @firc/bc/course/read        (release data)
  -> @firc/auth                  (user data via join)

+page.server.ts (actions)
  -> @firc/bc/enrollment/manage  (create, update status)
  -> @firc/audit                 (log status changes)
```

## Audit Integration

Status changes call `@firc/audit` to record:

- Who made the change (operator userId from session)
- What changed (enrollment id, old status -> new status)
- When (timestamp)

## Key Decisions

1. **Joins over separate queries.** `listEnrollmentsWithUser` joins `enrollment` + `bauth_user` in one query rather than N+1.
2. **Filters are server-side.** URL search params drive `+page.server.ts` load, not client-side filtering.
3. **No pagination in v1.** Enrollment counts will be small initially. Add pagination if needed.
4. **Status transitions validated in BC.** The `updateEnrollmentStatus` function validates allowed transitions, not the route handler.
5. **issueCertificate stays in manage.ts** but is not exposed in this feature's UI -- it belongs to the certificate-issuance feature.
