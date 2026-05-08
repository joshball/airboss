---
title: "auth-names test plan"
status: "done"
---

# auth-names -- Test Plan

## Registration (runway)

| #   | Scenario                           | Expected                                                            |
| --- | ---------------------------------- | ------------------------------------------------------------------- |
| 1   | Submit with both names filled      | Account created, `first_name`/`last_name` stored, `name` = combined |
| 2   | Submit with first name empty       | 400: "All fields are required"                                      |
| 3   | Submit with last name empty        | 400: "All fields are required"                                      |
| 4   | Names with leading/trailing spaces | Trimmed before storage and combination                              |
| 5   | Form re-renders on error           | `firstName` and `lastName` fields retain entered values             |

## Admin Invite (ops)

| #   | Scenario                       | Expected                                                   |
| --- | ------------------------------ | ---------------------------------------------------------- |
| 6   | Invite with both names         | User created with `firstName`, `lastName`, computed `name` |
| 7   | Invite with missing first name | Validation error from `inviteUserSchema`                   |
| 8   | Invite with duplicate email    | 400: "A user with this email already exists"               |
| 9   | Non-admin attempts invite      | 403 Forbidden                                              |

## Session Resolution (all apps)

| #   | Scenario                               | Expected                                                     |
| --- | -------------------------------------- | ------------------------------------------------------------ |
| 10  | Authenticated request                  | `locals.user.firstName` and `locals.user.lastName` populated |
| 11  | User created before feature (no names) | `firstName`/`lastName` default to `''` via `?? ''` fallback  |
| 12  | Unauthenticated request                | `locals.user` is `null`                                      |
