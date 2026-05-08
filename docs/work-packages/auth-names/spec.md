---
title: "auth-names"
status: "done"
type: "cross-app"
scope: "libs/auth, libs/types, all 4 apps"
---

# auth-names

Split the single `name` field into `firstName` and `lastName` across the auth system. All user creation paths (self-registration, admin invite) collect first/last separately. A combined `name` field is still computed and stored for backward compatibility with better-auth internals.

## What Changed

| Layer         | File(s)                      | Change                                                                         |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| DB schema     | `libs/auth/src/schema.ts`    | Added `first_name`, `last_name` columns to `bauth_user`                        |
| Auth config   | `libs/auth/src/server.ts`    | `additionalFields` on `user` model: `firstName`, `lastName` (required, input)  |
| Auth types    | `libs/auth/src/auth.ts`      | `AuthUser` interface includes `firstName`, `lastName`                          |
| Validation    | `libs/types/src/schemas.ts`  | `inviteUserSchema` requires `firstName`, `lastName`, `name`                    |
| Registration  | `apps/runway/.../register/`  | Split form: first name + last name side-by-side, computes `name` server-side   |
| Admin invite  | `apps/ops/.../users/invite/` | Split form: first name + last name, computes `name` server-side                |
| Session hooks | All 4 apps `hooks.server.ts` | Extract `firstName`/`lastName` from session via `Record<string, unknown>` cast |
| Type defs     | All 4 apps `app.d.ts`        | `Locals.user` includes `firstName`, `lastName`                                 |

## Combined Name Field

better-auth requires a `name` field on user creation. Both registration and invite compute it as:

```ts
const name = `${firstName.trim()} ${lastName.trim()}`;
```

This keeps `name` populated for email templates, display fallbacks, and any better-auth internal usage.

## Session Extraction Pattern

better-auth's `getSession()` return type does not include `additionalFields`. All 4 hooks extract names via cast:

```ts
firstName: ((session.user as Record<string, unknown>).firstName as string) ?? '',
lastName: ((session.user as Record<string, unknown>).lastName as string) ?? '',
```

## app.d.ts Variance

Two patterns exist across apps:

| Pattern     | Apps        | How                                     |
| ----------- | ----------- | --------------------------------------- |
| Shared type | sim, runway | `import { AuthUser } from '@firc/auth'` |
| Inline type | hangar, ops | Fields spelled out in `app.d.ts`        |

Both include `firstName` and `lastName`. The inline versions duplicate the `AuthUser` shape.
