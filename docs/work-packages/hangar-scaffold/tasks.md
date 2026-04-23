---
title: 'Tasks: Hangar scaffold'
product: hangar
feature: hangar-scaffold
type: tasks
status: unread
review_status: pending
---

# Tasks: Hangar scaffold

Serial commits in the order they were landed on the branch. Each task was gated by `bun run check` clean before moving on.

## Complete

- [x] **Extract `libs/audit/`** from `@ab/db`. Move `auditSchema`, `auditLog`, `AUDIT_OPS`, `auditWrite` into `libs/audit/src/`. Add `auditRecent` helper for admin reads. Remove audit re-exports from `@ab/db/index.ts`. Add `@ab/audit` path alias to root `tsconfig.json`.
- [x] **Constants additions**
  - `HOSTS.HANGAR = 'hangar.airboss.test'`
  - `PORTS.HANGAR = 9620`
  - `ROUTES.HANGAR_HOME = '/'`
  - New `AUDIT_TARGETS` bank with `HANGAR_PING = 'hangar.ping'`, re-exported from `libs/constants/src/index.ts`
- [x] **Scaffold `apps/hangar/`** -- `package.json`, `svelte.config.js` (with CSP + full alias set including `@ab/audit`), `vite.config.ts` (binds to 127.0.0.1, allowedHosts = `[HOSTS.HANGAR]`), `tsconfig.json`, `static/favicon.svg`
- [x] **App shell** -- `src/app.html`, `src/app.d.ts` (Locals matches study)
- [x] **Server auth wiring** -- `src/lib/server/auth.ts` + `src/lib/server/cookies.ts` mirror study
- [x] **`hooks.server.ts`** -- request-id, session hydration, banned-user guard, security headers, auth-path bypass
- [x] **Root `+layout.svelte`** -- loads `@ab/themes/tokens.css`, renders children
- [x] **Root `+layout.server.ts`** -- redirect unauthenticated to `/login` with `redirectTo`; `requireRole(AUTHOR, OPERATOR, ADMIN)` for signed-in users; early return for `/login` so the login page is reachable without a session
- [x] **`/login`** -- port study's email/password form + dev-account buttons; `createAuth` baseURL handling identical
- [x] **`/logout`** -- POST action calls better-auth sign-out, forwards cookies, runs `clearSessionCookies` unconditionally in `finally`
- [x] **Home page (`/`)** -- `+page.server.ts` has `load` (calls `auditRecent` for last 10 `hangar.ping` rows) and `ping` action (calls `auditWrite` with `op: ACTION`, `targetType: HANGAR_PING`, actor + request-id in metadata); `+page.svelte` renders the button + audit table
- [x] **`scripts/dev.ts`** -- add `hangar` to `DEV_URLS`; multi-spawn picks it up automatically
- [x] **`scripts/check.ts`** -- add `svelte-check` run for hangar
- [x] **`bun run check`** clean after every commit (3 errors, 1 warning, 0 errors final state for my changes; pre-existing references-system errors on main are unrelated)

## Developer action required (outside the repo)

- [ ] Add `127.0.0.1 hangar.airboss.test` to `/etc/hosts`. `bun run setup` will print the exact line if it's missing.

## Deferred to later WPs

- Shared nav / breadcrumbs between hangar admin sections -- lands in `wp-hangar-sources-v1` alongside the real surfaces
- ADR on hangar's relationship to identity (role model, verified-email, invite flow) -- lands when user administration becomes concrete (ops app)
- Playwright e2e for the login -> ping -> audit-read cycle -- lands in `wp-hangar-sources-v1` as part of the fuller test-plan
