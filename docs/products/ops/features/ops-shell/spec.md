---
title: "Spec: Ops App Shell"
product: ops
feature: ops-shell
type: spec
status: done
---

# Spec: Ops App Shell

Auth-protected SvelteKit shell for the ops app. Login, role-gated nav, theme system, operator/admin self-service.

## What It Does

Provides the authenticated, role-gated frame every other ops feature lives inside. Handles login/logout, session persistence, role enforcement (OPERATOR + ADMIN only), page-level route guards, app nav, and basic settings (theme, password). All routes except `/login` require a valid session with an authorized role.

## Data Model

**No new schema.** Uses existing libs:

| Source            | What it provides                                                     |
| ----------------- | -------------------------------------------------------------------- |
| `@firc/auth`      | `requireAuth`, `requireRole`, session hydration in `hooks.server.ts` |
| `identity.*`      | `bauth_user`, `bauth_session` (managed by auth lib)                  |
| `@firc/constants` | `ROLES`, `PORTS`, `ROUTES`                                           |

**Theme preference:** `localStorage` only. Same pattern as hangar (`data-theme-mode` on `<html>`).

## Route Structure

| Route           | Purpose                                           | Guard                                             |
| --------------- | ------------------------------------------------- | ------------------------------------------------- |
| `/login`        | Email + password login (no registration)          | Public (redirect to `/` if already authenticated) |
| `/`             | Dashboard -- enrollments summary, recent activity | Auth + role required                              |
| `/users`        | User management (stub -- feature 2)               | Auth + role required                              |
| `/enrollments`  | Enrollment management (stub -- feature 3)         | Auth + role required                              |
| `/certificates` | Certificate issuance (stub -- feature 5)          | Auth + role required                              |
| `/records`      | FAA records (stub -- feature 6)                   | Auth + role required                              |
| `/analytics`    | Analytics dashboard (stub -- feature 7)           | Auth + role required                              |
| `/settings`     | Theme toggle, change password                     | Auth + role required                              |
| `/logout`       | POST-only logout action                           | Auth required                                     |

Stub pages are placeholders wired into nav. Each gets its own feature later.

## Behavior

### Login

- Form: email + password only. No registration link (invite-only per ADR-009).
- On success: redirect to `/` (dashboard)
- On failure: return `{ error: 'Invalid email or password' }`
- Footer text: "Contact your administrator for access."

### Role enforcement (ADR-009)

- `(app)/+layout.server.ts` calls `requireRole(event, ROLES.OPERATOR, ROLES.ADMIN)`
- A LEARNER or AUTHOR navigating to ops receives 403 "Not authorized", not a login redirect
- Ban check in `hooks.server.ts` returns 403 before any route handler runs

### Session persistence

- `hooks.server.ts` hydrates `locals.user` and `locals.session` on every request
- Root `+layout.server.ts` redirects unauthenticated users to `/login` (except public routes)

### Logout

- Form action (POST, not GET) -- clears session cookie
- Redirect to `/login`

### Nav

- Persistent sidebar (vertical nav -- ops has 7+ nav items, sidebar scales better than top bar)
- Links: **Dashboard** | **Users** | **Enrollments** | **Certificates** | **Records** | **Analytics** | **Settings**
- User display name + role badge shown at bottom of sidebar
- Ops branding (`data-app-id="ops"`)
- Logout button at bottom of sidebar

### Settings

- Theme: light/dark toggle (writes `data-theme-mode` to `<html>`, persists in localStorage)
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

- Session expired mid-use -> next navigation redirects to `/login`
- Already logged in, visit `/login` -> redirect to `/`
- LEARNER/AUTHOR tries to access ops -> 403 "Not authorized" (not redirect)
- Banned user -> 403 "Account suspended" from hooks before any route
- Theme toggle before login -> localStorage persists, applied after login

## What to Reuse

- Copy hangar auth pattern exactly: `app.d.ts`, `hooks.server.ts`, `lib/server/auth.ts`, root `+layout.server.ts`
- Copy hangar `(app)/+layout.server.ts` role guard, change roles to `OPERATOR`, `ADMIN`
- Copy hangar login page, change branding to ops (mark: "O", name: "Ops")
- Reuse `@firc/ui` components: `AuthCard`, `AuthBrand`, `Alert`, `Button`, `FormStack`, `Input`, `DevLoginPanel`, `ThemeEditor`, `AppShell`, `Header`
- Reuse `@firc/themes` for theme system
