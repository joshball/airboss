---
title: "Spec: Sim App Shell"
product: sim
feature: sim-shell
type: spec
status: done
---

# Spec: Sim App Shell

Auth-protected SvelteKit shell for the sim app. Login, persistent nav, theme system, learner self-service.

## What It Does

Provides the authenticated frame every other sim feature lives inside. Handles login/logout, session persistence, page-level route guards, app nav, and basic learner settings (theme, password). All routes except `/login` require a valid session.

## Data Model

**No new schema.** Uses existing libs:

| Source                  | What it provides                                               |
| ----------------------- | -------------------------------------------------------------- |
| `@firc/auth`            | `requireAuth(locals)`, session hydration in `hooks.server.ts`  |
| `identity.*`            | `bauth_user`, `bauth_session` (managed by auth lib)            |
| `enrollment.enrollment` | Read-only check: is the user enrolled? Shown in nav/dashboard. |

**Theme preference:** `localStorage` only. Same pattern as hangar (`data-theme-mode` on `<html>`).

## Route Structure

| Route       | Purpose                        | Guard                                                   |
| ----------- | ------------------------------ | ------------------------------------------------------- |
| `/login`    | Email + password login         | Public (redirect to `/course` if already authenticated) |
| `/`         | Root -- redirect to `/course`  | Auth required                                           |
| `/course`   | Course dashboard (module list) | Auth required                                           |
| `/settings` | Theme toggle, change password  | Auth required                                           |

Other sim routes (discovery, scenario, debrief, progress) are added by their respective features but share the root layout guard.

## Behavior

### Login

- Form: email + password
- Form action calls better-auth handler server-side
- On success: redirect to `/course` (or `/discovery` if no learner profile)
- On failure: return `{ error: 'Invalid email or password' }` to re-render form
- Cookie: `httpOnly`, `sameSite: lax`, `secure: !isDev`

### Session persistence

- `hooks.server.ts` hydrates `locals.user` and `locals.session` on every request
- `+layout.server.ts` calls `requireAuth(locals)` -- redirects to `/login` on failure

### Logout

- Form action (POST, not GET) -- clears session cookie
- Redirect to `/login`

### Nav

- Persistent top bar across all pages
- Links: **Course** | **Progress** | **Settings** | **Logout**
- User display name shown (first name or email prefix)
- Sim branding (app-id = `sim`, amber accent)

### Settings

- Theme: light / dark toggle (writes `data-theme-mode` to `<html>`, persists in localStorage)
- Change password: current + new + confirm form action

## Validation

| Field                     | Rule                    |
| ------------------------- | ----------------------- |
| Email (login)             | Required, valid format  |
| Password (login)          | Required                |
| Current password (change) | Required                |
| New password (change)     | Required, min 8 chars   |
| Confirm password (change) | Must match new password |

## Edge Cases

- Session expired mid-session -> next navigation redirects to `/login`
- Already logged in, visit `/login` -> redirect to `/course`
- No enrollment record -> user can still access shell (enrollment check is advisory, not a gate)
- Theme toggle before login -> localStorage persists, applied on login
- Invalid/tampered session cookie -> auth lib rejects, redirect to `/login`

## Patterns

- Follow [hangar auth feature](../../hangar/features/auth/) exactly (form actions, hooks, requireAuth guard)
- `src/$lib/server/auth.ts` for the `requireAuth` wrapper (or use `@firc/auth` directly)
- No client-side auth calls -- all auth via form actions
