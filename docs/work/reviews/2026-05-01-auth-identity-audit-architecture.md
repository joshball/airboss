---
feature: auth-identity-audit
category: architecture
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 1
  minor: 4
  nit: 3
---

## Summary

Auth + audit architecture is mostly clean and ADR-aligned. `@ab/auth` cleanly encapsulates better-auth (only `libs/auth/src/server.ts` imports the vendor SDK), guards (`requireAuth`, `requireRole`, `requireVerifiedEmail`) live in the lib, the `auditColumns` helper sits next to `bauthUser` to keep `@ab/db` auth-free, and the audit lib is a tight three-file BC. Apps consume only the documented surface, BC code drives all admin user writes, and `@ab/bc-hangar` properly mediates between `@ab/auth` (schema) and `@ab/audit` (logging).

The findings below are mostly DRY/placement issues. The one major item is duplicated session-hydration in every app's `hooks.server.ts` -- a single `hydrateLocalsFromSession` helper in `@ab/auth` would close ~80 lines of copy-paste and remove four divergence vectors.

Two ADR cross-references worth noting:

- ADR 004 reserves a Postgres `identity` schema, but `bauth_*` tables sit in `public` because better-auth's vendor code doesn't support pg schemas. The `schema.ts` comment documents this; not a bug.
- The `@ab/auth/schema` deep-import (used by ~20 sibling files via the tsconfig `@ab/auth/*` mapping) bypasses the curated `index.ts` barrel. This is a minor surface-hygiene issue, not a circular dep.

## Issues

### MAJOR: Session hydration is duplicated four times across `hooks.server.ts`

**File:** `apps/study/src/hooks.server.ts:96-131`, `apps/hangar/src/hooks.server.ts:120-153`, `apps/sim/src/hooks.server.ts:42-72`, `apps/avionics/src/hooks.server.ts:41-71`

**Problem:** Every app reproduces the same ~30 lines:

- `auth.api.getSession({ headers })`
- map session -> `event.locals.session = { id, userId, expiresAt }`
- map user -> `event.locals.user = { id, email, name, firstName, lastName, emailVerified, role: (... as Role) ?? null, image, banned, createdAt, updatedAt }`
- catch + degrade to nulls + log

Each copy independently casts `session.user.firstName` through `as Record<string, unknown>` to dodge the better-auth user type, and casts `role` through `as Role`. If a new field lands on `AuthUser` (or better-auth changes its surface), four files must be edited in lockstep -- and three of them already drift: study and hangar log on session-lookup failure (`log.error('session lookup failed', ...)`), sim and avionics swallow silently. The four files also disagree on whether `Role` is `import` or `import type` (study/hangar do `import { ROUTES, type Role }`, sim/avionics do `import type { Role }`).

**Rule:** Auth concerns belong in `@ab/auth`. Session-locals shape is owned by the auth lib (`AuthSession`/`AuthUser` already live there); the *act of hydrating those locals* should too.

**Fix:** Add a helper to `@ab/auth/server.ts` (or a new `hooks.ts`) that takes a `RequestEvent` plus the per-app `auth` instance and populates `event.locals.session` / `event.locals.user`, with a uniform `try/catch` and a logger injected by the caller. Each app's `hooks.server.ts` becomes one call site. While there, normalize the firstName/lastName access so the `as Record<string, unknown>` cast lives in one place. Same treatment for `isAuthPath`, `REQUEST_ID_PATTERN`, `resolveRequestId`, and `applySecurityHeaders`, which are also exact duplicates between study and hangar -- those are `@ab/utils` candidates, not auth, but the cleanup belongs in the same pass.

### MINOR: `@ab/audit/schema` reaches across libs into `@ab/auth/schema`

**File:** `libs/audit/src/schema.ts:18`

**Problem:** `import { bauthUser } from '@ab/auth/schema'` deep-imports past the `@ab/auth` barrel. `@ab/auth/index.ts` already re-exports `bauthUser`, so the deep path is functionally equivalent but bypasses the curated public surface. This is the same shape as the BC-side deep imports below; flagging the `@ab/audit` one separately because it's the lib whose API surface you most want to keep tight (audit is consumed by every BC).

**Rule:** Cross-lib imports should go through the lib's `index.ts`. The `@ab/auth/*` tsconfig path is a convenience escape hatch; deep-importing schema tables from a sibling lib is the kind of access that should walk through the curated barrel so the auth lib can change its internal layout without breaking dependents.

**Fix:** Change `from '@ab/auth/schema'` to `from '@ab/auth'`. Same change applies to `libs/bc/hangar/src/schema.ts:23` and `libs/bc/hangar/src/audit-queries.ts:24`, plus the ~14 BC-study test files that do the same. (The non-test BC files in bc-hangar already use the barrel: `users.ts`, `user-writes.ts`. The schema files are the outliers.)

### MINOR: `auditColumns` helper is in `@ab/auth` but logically belongs to the audit story

**File:** `libs/auth/src/columns.ts`

**Problem:** `auditColumns()` returns `createdBy` / `updatedBy` FK columns to `bauth_user`. The header comment justifies the placement ("lives in `@ab/auth` rather than `@ab/db` so the helper sits next to the `bauthUser` schema it references"). That reasoning is sound for "where is `bauthUser` defined" but it splits the audit story into two libs: writers go to `@ab/audit`, but the FK-column helper sits in `@ab/auth`. A consumer authoring a new BC table that needs both the `audit_log` write AND the `created_by` columns has to import from both libs.

**Rule:** Audit concerns belong in `@ab/audit`. The lib that owns the `audit_log` table should own the cross-cutting helper that makes a BC table audit-attributable.

**Fix:** Move `auditColumns()` to `libs/audit/src/columns.ts` and re-export from `@ab/audit`. The helper still references `bauthUser` (imported from `@ab/auth`), and `@ab/audit`'s `package.json` already depends on `@ab/auth`, so the dep direction is unchanged. Keep a stub re-export from `@ab/auth` for one release, or grep + rename in one pass (only consumers today are BC schema files, which are easy to migrate).

### MINOR: Login + logout actions duplicate the same shape across study and hangar

**File:** `apps/study/src/routes/login/+page.server.ts`, `apps/hangar/src/routes/login/+page.server.ts`, `apps/study/src/routes/(app)/logout/+page.server.ts`, `apps/hangar/src/routes/logout/+page.server.ts`

**Problem:** The login actions are byte-for-byte identical aside from the logger name and one comment. Same for logout. Every change to either flow (e.g. the recent `x-forwarded-for` propagation, or the `isSafeRedirect` allowlist) has to be applied twice and stays in sync only by manual diligence.

ADR 007 says "auth lib middleware, identical in all apps" -- the topology decision was for the per-request session hydrator, but the same logic applies to the action handlers: this is auth wiring, not app logic.

**Rule:** Auth-related code that's leaked into apps belongs in `@ab/auth`. Login/logout endpoints should be thin shells calling `@ab/auth`.

**Fix:** Hoist the action bodies to `@ab/auth` as `signInWithEmailAction(event, auth)` and `signOutAction(event, auth)`. The per-app file becomes:

```ts
import { signInWithEmailAction } from '@ab/auth/sveltekit';
export const actions: Actions = { default: signInWithEmailAction(auth) };
```

`isSafeRedirect` collapses into a shared util at the same time. The `AUTH_INTERNAL_ORIGIN` synthetic-Request construction is also duplicated and is the kind of detail you don't want app authors to know about.

### MINOR: Per-app `$lib/server/cookies.ts` exists only to bind `dev` -- could be one auth lib helper

**File:** `apps/study/src/lib/server/cookies.ts`, `apps/hangar/src/lib/server/cookies.ts`

**Problem:** Both per-app `cookies.ts` files are 19-line shims that re-export `@ab/auth`'s `forwardAuthCookies` / `clearSessionCookies` / `rewriteSetCookieDomain` with the `dev` argument prebound. This works, but the indirection is hard to discover ("why is there a per-app cookies.ts?") and means the lib can't evolve its signature without touching every per-app shim.

**Rule:** Module organization -- if a wrapper exists only to bind `dev`, that's a sign the `dev` boolean should not be in the auth lib's signature.

**Fix:** Move the `dev` plumbing inside `@ab/auth`. Either (a) read `dev` from `$app/environment` inside the lib (the `@ab/themes` lib already does this), or (b) accept an `IsDev` symbol once at `createAuth` time and stash it on the returned `auth` so cookie helpers can read it back. Per-app `cookies.ts` files then disappear entirely; `hooks.server.ts` and login/logout actions import `forwardAuthCookies` directly from `@ab/auth`.

### NIT: `@ab/audit` index re-exports `auditSchema` which is internal plumbing

**File:** `libs/audit/src/index.ts:7`

**Problem:** `auditSchema` (the `pgSchema` factory) is exported alongside `auditLog` (the table). Consumers want the table; the schema factory is implementation detail used only by `audit_log`'s own definition. Exporting it widens the public surface for no reader.

**Rule:** API surface -- export only what consumers should call.

**Fix:** Drop `auditSchema` from `index.ts`. Grep confirms no external consumer references it.

### NIT: `@ab/auth` re-exports both `AuthSession`/`AuthUser` types and `bauthSession`/`bauthUser` schemas under one name pair

**File:** `libs/auth/src/index.ts:5`, `libs/auth/src/index.ts:19`

**Problem:** `AuthSession` is the `event.locals.session` type; `bauthSession` is the Drizzle table. They describe related-but-different things and live in the same barrel. A consumer reading `import { AuthSession, bauthSession } from '@ab/auth'` has to know the case-and-prefix convention to disambiguate. Not a bug -- just a minor naming friction made worse by the bare `Session` / `User` references in surrounding ADRs.

**Rule:** Naming.

**Fix:** Consider documenting the convention in `@ab/auth/index.ts` header comment ("`Auth*` = locals shape, `bauth*` = better-auth Drizzle tables"). Optional.

### NIT: `apps/sim` and `apps/avionics` swallow session-lookup errors silently

**File:** `apps/sim/src/hooks.server.ts:66`, `apps/avionics/src/hooks.server.ts:65`

**Problem:** Where study + hangar log `session lookup failed` with stack + requestId, sim + avionics catch with a bare `catch {}`. The comment says "degrade gracefully" but study/hangar also degrade gracefully *and* log -- there's no reason these two surfaces should be quieter when the DB flaps.

**Rule:** Pure-vs-IO separation aside, observability of the same operation should not vary by surface.

**Fix:** When the major-severity hydration helper above lands, the logger is injected and all four surfaces emit identically.
