---
title: User Management -- Test Plan
product: ops
feature: user-management
type: test-plan
status: done
---

# User Management -- Test Plan

Manual test plan. Run with ops dev server, seeded DB, and at least two user accounts (one admin, one operator).

## Setup

1. Start DB: `bun run db up`
2. Seed DB: `bun run db seed` (ensure admin + operator + learner accounts exist)
3. Start ops: `cd apps/ops && bun run dev`
4. Log in as admin

## User List

| Step | Action                               | Expected                                                                |
| ---- | ------------------------------------ | ----------------------------------------------------------------------- |
| 1    | Go to `/users`                       | Table loads with all users. Columns: name, email, role, status, created |
| 2    | Type a name in search box            | Table filters to matching users                                         |
| 3    | Type an email fragment in search box | Table filters to matching users                                         |
| 4    | Select "admin" role filter           | Only admin users shown                                                  |
| 5    | Select "banned" status filter        | Only banned users shown (or empty state)                                |
| 6    | Clear all filters                    | Full list restored                                                      |
| 7    | Click a user row                     | Navigates to `/users/[id]`                                              |

## User Detail

| Step | Action                           | Expected                                                              |
| ---- | -------------------------------- | --------------------------------------------------------------------- |
| 1    | Navigate to a user's detail page | Profile shows: name, email, role badge, created date, verified status |
| 2    | Check status section             | Shows "Active" for non-banned user                                    |
| 3    | Check activity log               | Shows recent audit entries (or empty state if none)                   |
| 4    | Click back link                  | Returns to user list                                                  |

## Invite

| Step | Action                                    | Expected                                        |
| ---- | ----------------------------------------- | ----------------------------------------------- |
| 1    | Go to `/users/invite`                     | Form with email and role dropdown               |
| 2    | Submit empty form                         | Validation error on email                       |
| 3    | Enter invalid email "notanemail"          | Validation error: invalid email                 |
| 4    | Enter valid email, select "operator" role | Form accepts input                              |
| 5    | Submit                                    | Redirects to `/users`, new user appears in list |
| 6    | Try inviting same email again             | Error: email already registered                 |

## Role Change (admin only)

| Step | Action                                    | Expected                             |
| ---- | ----------------------------------------- | ------------------------------------ |
| 1    | On a user detail page, find role dropdown | Current role pre-selected            |
| 2    | Select a different role                   | Confirm dialog appears               |
| 3    | Cancel the dialog                         | Role unchanged                       |
| 4    | Select role again, confirm                | Role updates, page reflects new role |
| 5    | Check audit log on that user's detail     | `user.role.change` entry appears     |
| 6    | Try to change own role                    | Prevented (button disabled or error) |

## Ban / Unban (admin only)

| Step | Action                                                                   | Expected                                          |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 1    | On an active user's detail, click "Ban"                                  | Ban form appears                                  |
| 2    | Submit without reason                                                    | Validation error: reason required                 |
| 3    | Enter reason "Testing ban" (9 chars)                                     | Validation error: min 10 characters               |
| 4    | Enter reason "Policy violation - repeated abuse", leave expiration empty | Form valid                                        |
| 5    | Submit ban                                                               | User status changes to "Banned", reason displayed |
| 6    | Check user list                                                          | User shows "Banned" status                        |
| 7    | On the banned user's detail, click "Unban"                               | Confirm dialog shows original ban reason          |
| 8    | Confirm unban                                                            | User status returns to "Active"                   |
| 9    | Check audit log                                                          | Both `user.ban` and `user.unban` entries present  |
| 10   | Try to ban yourself                                                      | Prevented (button disabled or error)              |

## Permission Tests

| Step | Action                               | Expected                     |
| ---- | ------------------------------------ | ---------------------------- |
| 1    | Log in as operator                   | `/users` loads (read access) |
| 2    | Navigate to a user detail            | Profile and activity visible |
| 3    | Check for invite link                | Not visible (admin only)     |
| 4    | Check for role dropdown              | Not visible (admin only)     |
| 5    | Check for ban/unban buttons          | Not visible (admin only)     |
| 6    | Manually navigate to `/users/invite` | 403 Forbidden                |
| 7    | Log in as learner                    | `/users` returns 403         |

## Ban Enforcement

| Step | Action                                                     | Expected                                             |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Log in as admin, ban a test user                           | Ban applied                                          |
| 2    | In a separate browser/incognito, log in as the banned user | Login rejected or immediate redirect on next request |
| 3    | Unban the user                                             | Access restored on next login                        |

## Edge Cases

| Test                         | Action                                 | Expected                                         |
| ---------------------------- | -------------------------------------- | ------------------------------------------------ |
| No matching users            | Search for "zzzznonexistent"           | Empty state: "No users match your filters"       |
| Special characters in search | Search for `<script>alert(1)</script>` | No XSS, no results, no errors                    |
| Ban with expiration          | Ban user with future expiration date   | Ban reason and expiration both displayed         |
| Ban with past expiration     | Enter a past date for expiration       | Validation error: must be a future date          |
| Rapid actions                | Change role then immediately ban       | Both actions succeed, audit log has both entries |
