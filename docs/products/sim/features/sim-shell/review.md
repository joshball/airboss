---
title: "Review: Sim App Shell"
product: sim
feature: sim-shell
type: review
status: done
review_status: done
reviews:
  - type: design
    date: 2026-03-27
    status: Changes required
  - type: code
    date: 2026-03-28
    status: Changes required
---

---

# Code Review: Sim App Shell (2026-03-28)

## UX Review

### [MEDIUM] Error page uses wrong CSS custom property names

**File:** apps/sim/src/routes/+error.svelte:31-35
**Issue:** `var(--color-text-muted, #666)` and `var(--color-link, #0066cc)` use `--color-*` naming instead of theme tokens. Hardcoded hex fallbacks will always be used since the custom properties don't exist.
**Recommendation:** Use `var(--ink-muted)` for muted text and `var(--link-default)` for the link color (see [docs/platform/theme-system/QUICK_REFERENCE.md](../../../../platform/theme-system/QUICK_REFERENCE.md)).

### [MEDIUM] Nav active state uses exact path matching -- breaks on child routes

**File:** apps/sim/src/routes/(app)/+layout.svelte:151
**Issue:** `class:active={page.url.pathname === link.href}` uses strict equality. Child routes like `/course/mod-1/check` don't highlight parent nav item.
**Recommendation:** Use `page.url.pathname.startsWith(link.href)` with proper prefix check.

### [LOW] Dashboard redirect has no HTML fallback

**File:** apps/sim/src/routes/(app)/+page.svelte
**Issue:** Root route uses `goto('/course')` in `if (browser)` guard. Blank page until JS executes.
**Recommendation:** Add minimal HTML fallback link.

### [LOW] Discovery not in nav links

**File:** apps/sim/src/routes/(app)/+layout.svelte:132-136
**Issue:** Nav links are Course, Progress, Settings. Discovery not represented. May be intentional (one-time flow).
**Recommendation:** Consider nav-level indicator for incomplete discovery.

## Engineering Review

### [MEDIUM] Error page has non-layout CSS and wrong tokens

**File:** apps/sim/src/routes/+error.svelte:22-36
**Issue:** Route file has `font-size`, `font-weight`, `color`, `opacity` -- per best-practices, route files may only have layout-flow CSS.
**Recommendation:** Move styling to a UI component or use theme tokens.

### [LOW] Settings page cross-posts to discovery without use:enhance

**File:** apps/sim/src/routes/(app)/settings/+page.svelte:27
**Issue:** Form action posts to `/discovery?/deleteProfile` without `use:enhance`. Full page reload.
**Recommendation:** Add `use:enhance` or accept as intentional.

---

# Design Review: Sim App Shell

**Reviewer:** Design Review Agent
**Date:** 2026-03-27
**Status:** Changes required

## Summary

The spec, user stories, and design are well-scoped and follow the right general approach. The auth guard intent is correct, the SSR decision is already in place, and the route structure is sensible. However, the design contains several concrete implementation errors that will cause broken behavior if followed literally: a wrong `requireAuth` call signature, a missing route group structure (required by the hangar pattern), an under-specified `createAuth` call that defaults to the hangar port, and a theme toggle description that bypasses the theme system already established in the codebase. These must be resolved before implementation begins.

---

## Findings

### [CRITICAL] `requireAuth` call signature is wrong

**File:** `docs/products/sim/features/sim-shell/design.md`, line 56

The design snippet shows:

```typescript
const user = requireAuth(locals);
```

The actual signature in `libs/auth/src/auth.ts` line 28 is:

```typescript
export function requireAuth(event: RequestEvent): AuthUser;
```

It takes the full `RequestEvent`, not `locals`. The correct call is:

```typescript
export const load = async (event) => {
  const user = requireAuth(event);
  return { user };
};
```

Using `locals` will fail at compile time (`bun run check` will error). Fix the design snippet before implementation.

---

### [CRITICAL] `createAuth` defaults to hangar port -- sim must pass its own baseURL

**File:** `libs/auth/src/server.ts`, lines 26-29

`createAuth` defaults `baseURL` to `http://localhost:${PORTS.HANGAR}` (port 7610). Sim runs on port 7600 (`PORTS.SIM`). The sim's `$lib/server/auth.ts` must pass the correct base URL:

```typescript
createAuth({ secret, baseURL: `http://localhost:${PORTS.SIM}` });
```

This is not mentioned anywhere in the design. Missing this causes better-auth to generate callback and cookie URLs pointing at hangar's port, which will silently break session handling in any environment where the two apps run concurrently.

---

### [HIGH] Route group structure is absent -- login route will be guarded

**Files:** `docs/products/sim/features/sim-shell/design.md` (route file list, line 3-16)

The design proposes flat routes (`routes/login/+page.svelte`). Hangar's established pattern uses SvelteKit route groups:

- `routes/(public)/login/` -- outside the auth guard
- `routes/(app)/` -- inside the auth guard, guarded by `(app)/+layout.server.ts`

Without route groups, the root `+layout.server.ts` guard must special-case `/login`. Hangar does this via `route.id?.startsWith('/(public)')`. A flat structure either (a) requires that same guard logic, or (b) calls `requireAuth` on the login route and creates a redirect loop.

The design must either:

1. Adopt the `(public)` / `(app)` route group structure (matches hangar exactly), or
2. Explicitly describe how the root layout guard distinguishes the login route from protected routes.

Option 1 is strongly preferred -- it is the established pattern and avoids any ambiguity.

---

### [HIGH] Login and logout actions belong in separate files

**File:** `docs/products/sim/features/sim-shell/design.md`, line 15

The design puts both `login` and `logout` actions in `routes/login/+page.server.ts`. Hangar separates them: login lives in `(public)/login/+page.server.ts`, logout in `(app)/logout/+page.server.ts`. There is a functional reason for this: logout requires an active session and must live inside the `(app)` guard. Putting logout inside the public login page is a conceptual mismatch and breaks the route group pattern.

The design also references `ROUTES.LOGOUT = '/logout'`, which already exists in constants. Use a dedicated `routes/(app)/logout/+page.server.ts` as in hangar.

---

### [HIGH] Theme toggle description bypasses the established theme system

**File:** `docs/products/sim/features/sim-shell/design.md`, lines 56-57 (theme section); `spec.md` line 19

The spec says: "Theme preference: `localStorage` only. Same pattern as hangar (`data-theme-mode` on `<html>`)."

The design says: "Theme toggle: light/dark toggle (writes `data-theme-mode` to `<html>`, persists in localStorage)."

The actual hangar pattern (implemented in `apps/hangar/src/routes/(app)/+layout.svelte`) is substantially more involved:

- Uses `THEME_PREFERENCES.STORAGE_KEYS.THEME_MODE` (from `@firc/constants`) for the localStorage key -- not a bare string.
- Uses `THEME_PREFERENCES.STORAGE_KEYS.THEME_ID` and `STORAGE_KEYS.SCALE` as well.
- Sets `data-theme`, `data-appearance`, and `data-layout` on `<html>` via a `$effect`, plus a user-scale custom property.
- Provides a `ThemeControl` context (`THEME_CONTROL_CONTEXT`) consumed by `ThemeEditor` in settings.
- Handles legacy scale migration.

The design must either:

1. Reuse the same `ThemeControl` context + `ThemeEditor` pattern as hangar (recommended -- shared pattern, works with existing `@firc/ui` components), or
2. Explicitly document that sim uses a simplified subset and specify exactly which localStorage keys it uses (must use `THEME_PREFERENCES.STORAGE_KEYS.*` constants, not raw strings).

If option 2 is chosen, the settings page cannot use hangar's `ThemeEditor` component unchanged, because that component uses `getContext(THEME_CONTROL_CONTEXT)` and expects the full context to be set.

---

### [MEDIUM] Duplicate route constants -- `COURSE` vs `SIM_COURSE`

**File:** `docs/products/sim/features/sim-shell/design.md`, lines 79-86; `libs/constants/src/routes.ts` lines 10-14

`ROUTES.COURSE = '/course'` already exists. The design proposes adding `SIM_COURSE: '/course'` -- an exact duplicate. The design note on line 88 acknowledges this: "Clarify ownership or add `SIM_` prefix."

This is not a minor note; it must be resolved before constants are added. Two options:

1. Keep `ROUTES.COURSE` as the canonical sim route, and rename `SCENARIO`, `DEBRIEF`, `PROGRESS` with `SIM_` prefix only if they conflict with hangar routes.
2. Rename all existing sim-flavored constants (`COURSE`, `SCENARIO`, `DEBRIEF`, `PROGRESS`) to `SIM_` prefix for clarity.

Option 1 is lower-churn. Check each existing constant against hangar routes to determine which actually conflict before adding anything.

`ROUTES.SETTINGS = '/settings'` also already exists and is used by hangar. Sim also has a `/settings` route. These are per-app routes on different ports -- there is no actual conflict -- but the design should confirm this intentional sharing rather than leave it ambiguous.

---

### [MEDIUM] `forwardAuthCookies` call signature not addressed

**File:** `docs/products/sim/features/sim-shell/design.md` (auth pattern section)

Hangar's login action calls `forwardAuthCookies(authResponse, cookies)` via a thin app-local wrapper (`apps/hangar/src/lib/server/cookies.ts`) that injects `dev`. The underlying `@firc/auth` function signature is `forwardAuthCookies(authResponse, cookies, isDev, maxAgeSeconds?)`.

Sim needs the same app-local wrapper in `apps/sim/src/lib/server/cookies.ts`. The design does not mention this. Without it, developers will either call the `@firc/auth` function directly with three args (fine, but inconsistent) or omit `isDev` (wrong -- cookies will be flagged `secure` in dev and sessions will silently fail).

---

### [MEDIUM] `test-plan.md` referenced but does not exist

**File:** `docs/products/sim/features/sim-shell/tasks.md`, line 58

Tasks step "Full manual test plan per `test-plan.md`" references a file that does not exist in the feature dir. Per `WORKFLOW.md`, nothing merges without a manual test plan, and it should be written before or during implementation. Create `docs/products/sim/features/sim-shell/test-plan.md` before starting implementation.

---

### [LOW] `app.d.ts` must declare both `session` and `user` in `App.Locals`

**File:** `apps/sim/src/app.d.ts` (currently a stub)

The current `app.d.ts` has all interfaces commented out. Hangar's `app.d.ts` declares both `session` and `user` in `App.Locals`. The design mentions adding only `user` and `session` (tasks step 2), which is correct, but should use the `AuthSession` and `AuthUser` types from `@firc/auth` rather than re-declaring inline shapes. Hangar inlines the shapes; sim should import the exported types to stay in sync with the auth lib:

```typescript
import type { AuthSession, AuthUser } from "@firc/auth";
// ...
interface Locals {
  session: AuthSession | null;
  user: AuthUser | null;
}
```

This is a minor improvement over the hangar approach, not a blocker, but worth getting right on the first pass.

---

### [LOW] Nav logout button must use a form POST -- not an anchor

**File:** `docs/products/sim/features/sim-shell/design.md`, nav bar section (line 30)

The design mentions "user name + logout button" in the nav. Best-practices.md rule 2 and hangar's pattern both require logout via `<form method="POST">`, not a link or client-side call. The `Header` component in `@firc/ui` already accepts `logoutAction` prop (used by hangar). Verify the sim nav uses the same component and pattern rather than building a new logout link.

---

## Approved items

- **SSR disabled** -- `apps/sim/src/routes/+layout.ts` already has `export const ssr = false`. No change needed.
- **`data-app-id="sim"`** -- `apps/sim/src/app.html` already has `data-app-id="sim"`. Amber accent is applied automatically. No change needed.
- **`data-theme="sim/glass"` and `data-appearance="dark"`** -- already set in `app.html`. Correct defaults.
- **Theme imports in `+layout.svelte`** -- the `sim/glass` theme tokens are emitted into `libs/themes/generated/tokens.css` and applied automatically; no per-app import is needed.
- **No schema changes** -- spec correctly identifies that sim-shell adds no new DB tables. Identity tables are managed by better-auth.
- **`AUTH_INTERNAL_ORIGIN`** -- constant exists in `@firc/constants` and is the right way to construct internal auth requests. Good.
- **No registration in sim** -- correct architectural boundary. Learner accounts are created via ops/runway.
- **Enrollment check is advisory** -- correctly scoped. Not a gate, just informational.
- **Redirect-after-login** -- `redirectTo` query param pattern is already implemented in `requireAuth` (adds param) and in hangar's login action (reads and validates it). Sim must replicate the same open-redirect protection: `rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//')`.
- **No raw SQL, no `any`** -- spec relies entirely on auth lib and Drizzle. Good.
- **FAA compliance** -- sim-shell is infrastructure only, no content. No direct FAA compliance implications beyond the requirement that sessions persist reliably (which the auth lib handles).

---

## Decision

**Changes required before implementation.**

The following must be addressed before starting the implementation tasks:

1. Fix `requireAuth(event)` call signature in `design.md`.
2. Add `baseURL: \`http://localhost:${PORTS.SIM}\``to sim's`createAuth` call.
3. Adopt `(public)` / `(app)` route group structure, or explicitly document the alternative and update the route file list.
4. Move logout to a dedicated `(app)/logout/+page.server.ts`.
5. Clarify the theme system approach: full `ThemeControl` context (matches hangar) or simplified subset with explicit localStorage key constants.
6. Resolve the `COURSE` / `SIM_COURSE` constant naming before touching `routes.ts`.
7. Create `test-plan.md` before implementation begins.

Items 3, 4, and 5 require updating `design.md`. Items 1, 2, and 6 are quick corrections. Item 7 is a new file.

## Fix Log (2026-03-28)

### Code Review

- [MEDIUM] Error page uses wrong CSS custom property names -- verified fixed (pre-existing)
- [MEDIUM] Nav active state uses exact path matching -- verified fixed (pre-existing)
- [LOW] Dashboard redirect has no HTML fallback -- fixed in 5beef9b
- [LOW] Discovery not in nav links -- accepted, Phase 2 appropriate (intentional one-time flow)
- [MEDIUM] Error page has non-layout CSS and wrong tokens -- verified fixed (pre-existing)
- [LOW] Settings page cross-posts to discovery without use:enhance -- fixed in 6fda4e6

### Design Review

- [CRITICAL] `requireAuth` call signature is wrong -- verified fixed (pre-existing)
- [CRITICAL] `createAuth` defaults to hangar port -- verified fixed (pre-existing)
- [HIGH] Route group structure is absent -- verified fixed (pre-existing)
- [HIGH] Login and logout actions belong in separate files -- verified fixed (pre-existing)
- [HIGH] Theme toggle description bypasses established theme system -- verified fixed (pre-existing)
- [MEDIUM] Duplicate route constants -- verified fixed (pre-existing)
- [MEDIUM] `forwardAuthCookies` call signature not addressed -- verified fixed (pre-existing)
- [MEDIUM] `test-plan.md` referenced but does not exist -- verified fixed (pre-existing)
- [LOW] `app.d.ts` must declare both `session` and `user` in `App.Locals` -- fixed in 0daf37c
- [LOW] Nav logout button must use a form POST -- verified fixed (pre-existing)
