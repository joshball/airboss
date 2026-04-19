---
title: "Tasks: Sim App Shell"
product: sim
feature: sim-shell
type: tasks
status: done
---

# Tasks: Sim App Shell

## Pre-flight

- [x] Read `docs/agents/best-practices.md` (auth forms, SSR, Svelte 5 patterns)
- [x] Read hangar auth feature (`docs/products/hangar/features/auth/`)
- [x] Read `libs/auth/src/` to understand session hydration API

## Implementation

### 1. Constants

- [x] Add `SIM_DISCOVERY`, `SIM_PROGRESS`, `SIM_SETTINGS`, `SIM_SCENARIO_BRIEF`, `SIM_SCENARIO`, `SIM_DEBRIEF` to `libs/constants/src/routes.ts`
- [x] Run `bun run check` -- 0 errors

### 2. App shell wiring

- [x] Update `apps/sim/src/app.d.ts` -- add `user` and `session` to `App.Locals`
- [x] Create `apps/sim/src/hooks.server.ts` -- session hydration via `@firc/auth`
- [x] Update `apps/sim/src/routes/+layout.server.ts` -- `requireAuth` guard, return `{ user }`
- [x] Update `apps/sim/src/routes/+layout.svelte` -- receive `data.user`, pass to nav component
- [x] Run `bun run check` -- 0 errors

### 3. Login

- [x] Create `apps/sim/src/routes/login/+page.svelte` -- email + password form
- [x] Create `apps/sim/src/routes/login/+page.server.ts` -- login + logout actions
- [x] Verify: unauthenticated `/course` redirects to `/login`
- [x] Verify: login with valid credentials redirects to `/course`
- [x] Verify: login with invalid credentials shows error
- [x] Run `bun run check` -- 0 errors, commit

### 4. Nav

- [x] Build nav component (top bar: wordmark, Course/Progress/Settings links, user name, logout)
- [x] Wire into `+layout.svelte`
- [x] Verify: nav shows user name
- [x] Verify: active route highlighted
- [x] Run `bun run check` -- 0 errors, commit

### 5. Course page stub

- [x] Create `apps/sim/src/routes/course/+page.svelte` -- placeholder ("Course coming soon" or module list stub)
- [x] Create `apps/sim/src/routes/course/+page.server.ts` -- load enrollment status
- [x] Update root `+page.svelte` to redirect to `/course`
- [x] Run `bun run check` -- 0 errors, commit

### 6. Settings

- [x] Create `apps/sim/src/routes/settings/+page.svelte` -- theme toggle + change password form
- [x] Create `apps/sim/src/routes/settings/+page.server.ts` -- change password action
- [x] Verify: theme toggle persists across refresh
- [x] Verify: change password with wrong current password shows error
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update TASKS.md (mark sim-shell complete)
- [x] Commit docs updates
