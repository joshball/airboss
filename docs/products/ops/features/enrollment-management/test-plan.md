---
title: Enrollment Management -- Test Plan
product: ops
feature: enrollment-management
type: test-plan
status: done
---

# Enrollment Management -- Test Plan

Manual test steps. Run all before approving merge.

**Prerequisites:** ops app running (`bun dev`), at least one published release exists, at least two user accounts (one operator, one learner).

## Enrollment List

1. Navigate to `/enrollments`
2. Verify: page loads, shows table (empty or with data)
3. Create a few enrollments first (see Create section), then return here
4. Verify: enrollments show user name, email, release version, status, date
5. Use status filter -- verify list updates to show only matching status
6. Use search box -- type partial user name, verify results filter
7. Use release filter -- verify only enrollments for that release appear

## Create Enrollment

1. Navigate to `/enrollments/new`
2. Verify: user picker shows learner accounts, release picker shows published releases
3. Select a user and release, submit
4. Verify: redirects to enrollment list or detail, new enrollment appears with status `active`
5. Try creating a duplicate (same user + same release)
6. Verify: error message, no duplicate created

## Enrollment Detail

1. Click an enrollment from the list
2. Verify: header shows user name, email, enrollment status, enrolled date
3. Verify: module progress section shows all modules with correct statuses
4. Verify: time breakdown shows total time, FAA-qualified time
5. Verify: lesson attempts section shows attempts (if any exist)

## Status Changes

1. From detail page, change status to `completed`
2. Verify: status updates, `completedAt` date appears
3. Verify: status change is recorded (check audit log if accessible)
4. Create another enrollment, change status to `withdrawn`
5. Verify: status updates, no `completedAt` set
6. Verify: cannot change a withdrawn enrollment back to active

## Edge Cases

1. Try to create enrollment for a banned user -- verify rejection
2. Navigate to `/enrollments/nonexistent-id` -- verify 404 or error handling
3. Access enrollment routes as a non-operator role -- verify role guard blocks access

## Automated Tests

Automated tests live in the codebase, not this doc. Verify they pass:

```
bun test libs/bc/enrollment/
bun run check
```
