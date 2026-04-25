---
title: "Tasks: Ops App Shell"
product: ops
feature: ops-shell
type: tasks
status: done
---

# Tasks: Ops App Shell

## Pre-flight

- [x] Read `docs/agents/best-practices.md` (auth forms, SSR, Svelte 5 patterns)
- [x] Read hangar auth feature files (hooks, layout, login page, auth.ts)
- [x] Read `libs/auth/src/` to understand `requireRole` API
- [x] Read `libs/ui/` to confirm available components (AuthCard, AuthBrand, sidebar patterns)
- [x] Design review (Large feature -- required before implementation)

## Implementation

### 1. Constants

- [x] Add `OPS_DASHBOARD`, `OPS_USERS`, `OPS_ENROLLMENTS`, `OPS_CERTIFICATES`, `OPS_RECORDS`, `OPS_ANALYTICS`, `OPS_SETTINGS` to `libs/constants/src/routes.ts`
- [x] Run `bun run check` -- 0 errors

### 2. App foundation

- [x] Create `apps/ops/src/app.d.ts` -- Locals interface (session + user), identical to hangar
- [x] Create `apps/ops/src/lib/server/auth.ts` -- `createAuth()` wrapper, identical to hangar
- [x] Create `apps/ops/src/lib/server/cookies.ts` -- cookie forwarding, identical to hangar
- [x] Create `apps/ops/src/hooks.server.ts` -- session hydration + ban check, identical to hangar
- [x] Create `apps/ops/src/routes/+layout.server.ts` -- public vs app route split
- [x] Run `bun run check` -- 0 errors, commit

### 3. Role guard

- [x] Create `apps/ops/src/routes/(app)/+layout.server.ts` -- `requireRole(event, ROLES.OPERATOR, ROLES.ADMIN)`
- [x] Run `bun run check` -- 0 errors

### 4. Login

- [x] Create `apps/ops/src/routes/(public)/login/+page.svelte` -- login form (mark: "O", name: "Ops")
- [x] Create `apps/ops/src/routes/(public)/login/+page.server.ts` -- login action
- [x] Run `bun run check` -- 0 errors, commit

### 5. Nav + layout

- [x] Create `apps/ops/src/routes/(app)/+layout.svelte` -- ThemeControl, sidebar, AppShell
- [x] Wire nav links to ROUTES constants
- [x] Run `bun run check` -- 0 errors, commit

### 6. Dashboard + stubs

- [x] Create `apps/ops/src/routes/(app)/+page.svelte` -- dashboard stub
- [x] Create stub pages: `users/`, `enrollments/`, `certificates/`, `records/`, `analytics/`
- [x] Run `bun run check` -- 0 errors, commit

### 7. Settings

- [x] Create `apps/ops/src/routes/(app)/settings/+page.svelte` -- theme toggle + change password
- [x] Create `apps/ops/src/routes/(app)/settings/+page.server.ts` -- change password action
- [x] Run `bun run check` -- 0 errors, commit

### 8. Logout

- [x] Create `apps/ops/src/routes/(app)/logout/+page.server.ts` -- POST logout, redirect to /login
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update `docs/products/ops/TASKS.md` (mark ops-shell complete)
- [x] Commit docs updates
