---
title: 'Spec: Hangar scaffold'
product: hangar
feature: hangar-scaffold
type: spec
status: unread
review_status: pending
---

# Spec: Hangar scaffold

Stand up `apps/hangar/` as the airboss admin app with auth, role gates, login/logout, audit logging, and the dev wiring to make `bun run dev hangar` work end-to-end. No data-management features yet -- this is the skeleton the later data-management WPs (`wp-hangar-registry`, `wp-hangar-sources-v1`, `wp-hangar-non-textual`) build on.

Plan: [docs/work/todos/20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md) ("wp-hangar-scaffold (first)" section).

## In scope

- `apps/hangar/` workspace -- `@ab/hangar`, port 9620, host `hangar.airboss.test`
- Hooks, session hydration, banned-user guard, security headers (mirrors `apps/study/`)
- CSP via `svelte.config.js` (auto-nonce for inline scripts, same directives as study)
- Root `+layout.server.ts` guard: redirect unauthenticated to `/login`; `requireRole(AUTHOR, OPERATOR, ADMIN)` for everyone else
- `/login` and `/logout` -- cross-subdomain cookie shared with study via `.airboss.test`
- Home page (`/`) proves the whole stack: a form action calls `auditWrite(...)` with `targetType: 'hangar.ping'`; the page's `load` reads the last 10 rows via `auditRecent`
- `libs/audit/` extracted from `@ab/db`; exports `auditWrite`, `auditRecent`, `auditLog`, `AUDIT_OPS`, types
- Constants: `HOSTS.HANGAR`, `PORTS.HANGAR`, `ROUTES.HANGAR_HOME`, `AUDIT_TARGETS.HANGAR_PING`
- `scripts/dev.ts` multi-spawns hangar alongside study and sim
- `scripts/check.ts` runs `svelte-check` against the hangar app
- `scripts/setup.ts` picks up `HOSTS.HANGAR` automatically (it iterates `HOSTS.values`)

## Out of scope

- Data-management surfaces (sources, references, jobs) -- landing in `wp-hangar-registry` and `wp-hangar-sources-v1`
- Nav between admin sections -- nothing to navigate to yet
- User administration / invite flow -- lives in ops when it lands
- FIRC compliance UI / carrier language -- not being ported

## Architecture

### Why extract `libs/audit/` from `@ab/db`

Airboss already had `auditWrite` in `libs/db/src/audit.ts`. Plan calls for `libs/audit/` as its own lib because audit is a cross-cutting capability every BC depends on, not a helper that belongs under the DB-connection lib. Hangar is the first consumer; extraction now keeps the import story clean (`@ab/audit`, not `@ab/db`) and sets up for the multi-table audit/sync plumbing that lands in `wp-hangar-registry`.

`@ab/db` keeps what it should: the shared Drizzle connection (`db`, `client`), column-fragment helpers (`timestamps`, `auditColumns`), and `escapeLikePattern`. Zero consumer call sites referenced the audit exports from `@ab/db`, so the extraction is a clean move.

### Role gate lives at the root layout

Study uses an `(app)` route group to separate the signed-in surface from `/login`. Hangar has no public routes beyond `/login` and `/api/auth/*`, so the gate lives on the root `+layout.server.ts` with an early return for `/login`. `/api/auth/*` bypasses the layout because it's handled directly in `hooks.server.ts`.

Per the dual-gate contract in `libs/auth/src/auth.ts`, form actions that write MUST still call `requireRole(...)` themselves -- the layout load does not run for POST action dispatches. The scaffold's `?/ping` action does exactly this.

### Why the heartbeat page instead of a placeholder

The plan gates the scaffold on "auditable stub action on the empty home page to prove the logging path." A real button that writes a real audit row and a real read-back list is the minimum that demonstrates: auth redirect -> role gate -> form action -> DB write -> DB read -> render. If any of those links is broken, the heartbeat page makes it obvious. Replaced wholesale by the interactive flow diagram in `wp-hangar-sources-v1`.

## Roles

Airboss already has the 4-role enum (`LEARNER`, `AUTHOR`, `OPERATOR`, `ADMIN`) in `libs/constants/src/roles.ts`. Hangar gates to `AUTHOR | OPERATOR | ADMIN`. `LEARNER` cannot enter; they get a redirect-to-login then a 403 if they sign in anyway.

## Data model changes

| Table              | Change                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `audit.audit_log`  | No schema change. Existing table moves from `@ab/db` to `@ab/audit`; same columns, same rows. |

No migration needed: the table and its Drizzle definition are identical to what previously lived in `libs/db/src/audit.ts`.

## Developer setup

One-time: `127.0.0.1 hangar.airboss.test` in `/etc/hosts`. `bun run setup` iterates `HOSTS.values` and prints the missing entries; adding `HOSTS.HANGAR` makes setup surface the new line automatically.

After that:

```bash
bun install             # wires @ab/hangar into the workspace
bun run dev hangar      # start just hangar
bun run dev             # multi-spawn study + sim + hangar
```

## Risks

| Risk                                                         | Mitigation                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Shared cookie domain misconfiguration between study + hangar | Mirrors study's `forwardAuthCookies` / `rewriteSetCookieDomain` exactly        |
| Layout guard 403ing legitimate logout attempts               | `/logout` is a POST action, never walks the layout load; guard doesn't fire   |
| Banned-user path regression                                  | `hooks.server.ts` is copy-equivalent to study's; adding a hangar test is a WP-hangar-sources-v1 concern |
