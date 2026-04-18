---
title: "Tasks: Deployment Hardening"
product: ops
feature: deployment-hardening
type: tasks
status: done
---

# Tasks: Deployment Hardening

## Pre-flight

- [ ] Read `docs/devops/DEPLOYMENT_OPTIONS.md` -- current deployment strategy
- [ ] Read `docs/devops/LOCAL_DEV.md` -- current dev setup
- [ ] Read `docs/agents/reference-sveltekit-patterns.md` -- constants, monorepo patterns
- [ ] Review `libs/db/src/` -- current database connection setup
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants

- [ ] Create `libs/constants/src/deployment.ts` -- all pool sizes, timeouts, disk thresholds
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Add `HEALTH` route to `ROUTES` in `libs/constants/src/routes.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. Environment configuration

- [ ] Create `libs/constants/src/env.ts` -- `getEnv`, `getEnvInt`, `getEnvBool`, `requireEnv`
- [ ] Write Vitest unit tests for env helpers (valid, missing, invalid format)
- [ ] Create `.env.example` at repo root with all documented variables
- [ ] Run `bun run check` -- 0 errors, commit

### 3. Structured logger

- [ ] Create `libs/utils/src/logger.ts` -- `createLogger(app)`, returns `debug/info/warn/error` methods
- [ ] JSON output format with all `LogEntry` fields
- [ ] Pretty-print mode for development (detect `NODE_ENV`)
- [ ] Request ID support (accept as parameter)
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 4. Health check endpoints

- [ ] Create health check handler as shared utility
- [ ] Add `GET /health` route to sim
- [ ] Add `GET /health` route to hangar
- [ ] Add `GET /health` route to ops
- [ ] Add `GET /health` route to runway
- [ ] Each checks database connectivity and disk space
- [ ] Write Vitest unit tests for health check logic
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Error handling hooks

- [ ] Create shared error handler utility (logs error, generates request ID)
- [ ] Add/update `hooks.server.ts` in sim with `handleError`
- [ ] Add/update `hooks.server.ts` in hangar with `handleError`
- [ ] Add/update `hooks.server.ts` in ops with `handleError`
- [ ] Add/update `hooks.server.ts` in runway with `handleError`
- [ ] Create custom `+error.svelte` in each app (shows error code, message, request ID)
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Database connection hardening

- [ ] Update `libs/db/src/` to use pool configuration from constants/env
- [ ] Configure pool size, connect timeout, idle timeout, max lifetime
- [ ] Add graceful shutdown handler (SIGTERM/SIGINT -> drain pool)
- [ ] Test: app starts with valid DB config
- [ ] Test: app shows clear error with invalid DB config
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Backup and restore scripts

- [ ] Create `scripts/db/backup.ts` -- pg_dump wrapper with timestamp naming
- [ ] Create `scripts/db/restore.ts` -- pg_restore wrapper with `--confirm` flag
- [ ] Create `scripts/db/cleanup-backups.ts` -- retention policy (30 daily, 12 weekly)
- [ ] Test backup: run script, verify output file exists and is valid
- [ ] Test restore: restore from backup, verify data integrity
- [ ] Run `bun run check` -- 0 errors, commit

### 8. Replace console.log

- [ ] Search all `console.log` / `console.error` / `console.warn` in apps/ and libs/
- [ ] Replace with structured logger calls
- [ ] Verify no bare console usage remains
- [ ] Run `bun run check` -- 0 errors, commit

### 9. Documentation

- [ ] Update `docs/devops/DEPLOYMENT_OPTIONS.md` with health check, logging, backup info
- [ ] Update `docs/devops/LOCAL_DEV.md` with new env vars
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass
- [ ] Request implementation review
- [ ] Update ops TASKS.md
- [ ] Commit docs updates
