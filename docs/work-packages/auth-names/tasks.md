---
title: "auth-names tasks"
status: "done"
---

# auth-names -- Tasks

All tasks completed.

| #   | Task                                                                          | Status |
| --- | ----------------------------------------------------------------------------- | ------ |
| 1   | Add `first_name`, `last_name` columns to `bauthUser` schema                   | done   |
| 2   | Configure `additionalFields` in `createAuth()` (required, input)              | done   |
| 3   | Add `firstName`, `lastName` to `AuthUser` interface                           | done   |
| 4   | Update `inviteUserSchema` to require `firstName`, `lastName`, `name`          | done   |
| 5   | Split runway registration form into first/last name fields                    | done   |
| 6   | Update runway `+page.server.ts` to collect and validate both names            | done   |
| 7   | Split ops invite form into first/last name fields                             | done   |
| 8   | Update ops invite `+page.server.ts` to compute combined `name`                | done   |
| 9   | Update all 4 `hooks.server.ts` to extract `firstName`/`lastName` from session | done   |
| 10  | Update all 4 `app.d.ts` to include `firstName`/`lastName` in `Locals.user`    | done   |
| 11  | Regenerate initial migration (schema change)                                  | done   |
