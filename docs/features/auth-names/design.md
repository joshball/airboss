---
title: "auth-names design"
status: "done"
---

# auth-names -- Design Decisions

## Why additionalFields?

better-auth has a built-in `name` field on its user model. Rather than fighting the framework, `firstName` and `lastName` are declared as `additionalFields` in `createAuth()`. This tells better-auth to:

- Accept them as input on sign-up and admin-create endpoints
- Store them in the `bauth_user` table as `first_name` / `last_name`
- Return them in session data (though not in the TypeScript type -- see below)

The built-in `name` is still set to `"${firstName} ${lastName}"` for compatibility.

## Record<string, unknown> Cast

better-auth's `getSession()` TypeScript return type does not include `additionalFields` properties. The values are present at runtime, but the type system doesn't know about them. All 4 hooks use:

```ts
(session.user as Record<string, unknown>).firstName as string;
```

This is the least-bad option. Alternatives considered:

| Option                          | Why not                                                   |
| ------------------------------- | --------------------------------------------------------- |
| Extend better-auth types        | No official extension point for session user type         |
| Wrapper function with assertion | Same cast, more indirection                               |
| Use `name` only                 | FAA records need first/last separate (24-month retention) |

## Why Keep `name`?

- better-auth email templates reference `user.name`
- Display contexts that don't need split names use `name` as-is
- Removing it would require forking better-auth's sign-up flow

## Schema Impact

Two new NOT NULL columns on `bauth_user`. Since better-auth manages this table, the columns were added to both the Drizzle read-only schema (`schema.ts`) and the `additionalFields` config (`server.ts`). Initial migration regenerated from scratch.

## app.d.ts Inconsistency

sim and runway import `AuthUser` from `@firc/auth`. hangar and ops inline the same shape. Both work, but the inline versions will drift if `AuthUser` changes. This is a known minor inconsistency -- not blocking, but worth normalizing later.
