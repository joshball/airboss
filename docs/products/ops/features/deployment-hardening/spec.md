---
title: "Spec: Deployment Hardening"
product: ops
feature: deployment-hardening
type: spec
status: done
---

# Spec: Deployment Hardening

Cross-cutting infrastructure work to prepare all four apps for production deployment. Covers health checks, structured logging, error handling, database connection management, backup strategy, and basic monitoring. Not a user-facing feature -- this is the plumbing that makes everything reliable.

## What It Does

Ensures all four apps (sim, hangar, ops, runway) are production-ready: they report health, log structured data, handle errors gracefully, manage database connections properly, and support backup/restore of critical data.

## Components

### 1. Health Checks

Every app exposes a `/health` endpoint that reports service status.

**Response format:**

```typescript
interface HealthCheck {
  status: "ok" | "degraded" | "down";
  version: string; // git SHA or package version
  uptime: number; // seconds
  checks: {
    database: "ok" | "error";
    diskSpace: "ok" | "warning" | "error";
  };
  timestamp: string; // ISO 8601
}
```

**Behavior:**

- `GET /health` returns 200 if status is `ok` or `degraded`, 503 if `down`
- Database check: simple SELECT query with 5s timeout
- Disk space check: warn if < 1 GB free, error if < 100 MB
- No authentication required (load balancer/monitoring must reach it)
- Response is JSON, no HTML

### 2. Structured Logging

Replace `console.log` with structured JSON logging across all apps and libs.

**Log format:**

```typescript
interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  app: string; // 'sim' | 'hangar' | 'ops' | 'runway'
  requestId?: string; // from request header or generated
  userId?: string; // if authenticated
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}
```

**Implementation:**

- Logger utility in `libs/utils/src/logger.ts`
- Each app initializes with its app name
- Request ID generated per request (middleware), passed through context
- Log level configurable via environment variable `LOG_LEVEL`
- In development: pretty-printed. In production: single-line JSON.

### 3. Error Handling

Consistent error handling across all apps.

**SvelteKit error hooks:**

- `hooks.server.ts` `handleError`: logs the error, returns a safe error page
- Never expose stack traces to clients in production
- All errors get a request ID for correlation

**Error page:**

- Custom `+error.svelte` in each app
- Shows error code + user-friendly message
- Shows request ID for support reference
- No technical details visible

**Form action errors:**

- Return `fail()` with structured error data
- Never throw unhandled in form actions
- Log all form action failures at `warn` level

### 4. Database Connection Management

**Connection pooling:**

- Configure Drizzle/pg connection pool properly
- Pool size: 10 connections per app (configurable via env)
- Connection timeout: 10s
- Idle timeout: 30s
- Max lifetime: 600s (10 min)

**Graceful shutdown:**

- On SIGTERM/SIGINT: drain connection pool, close cleanly
- Pending requests complete (30s timeout), then force-close
- Health check returns `degraded` during drain period

**Constants:**

```typescript
// libs/constants/src/deployment.ts
export const DB_POOL_SIZE = 10;
export const DB_CONNECT_TIMEOUT_MS = 10_000;
export const DB_IDLE_TIMEOUT_MS = 30_000;
export const DB_MAX_LIFETIME_MS = 600_000;
export const SHUTDOWN_TIMEOUT_MS = 30_000;
export const HEALTH_CHECK_DB_TIMEOUT_MS = 5_000;
export const DISK_WARN_BYTES = 1_073_741_824; // 1 GB
export const DISK_ERROR_BYTES = 104_857_600; // 100 MB
```

### 5. Database Backup Strategy

**Automated backups:**

- A `scripts/db/backup.ts` script that runs `pg_dump` with Bun
- Output: compressed SQL file with timestamp in filename
- Retention: keep last 30 daily backups, last 12 weekly backups
- Backup directory: `data/backups/` (configurable)

**Restore:**

- A `scripts/db/restore.ts` script that applies a backup file
- Validates backup file format before applying
- Requires explicit confirmation flag (`--confirm`)

**Not automated scheduling.** Cron or external scheduler triggers the backup script. The script is the tool, not the scheduler.

### 6. Environment Configuration

Centralize all environment variable reading.

**New file: `libs/constants/src/env.ts`**

```typescript
export function getEnv(key: string, fallback?: string): string;
export function getEnvInt(key: string, fallback: number): number;
export function getEnvBool(key: string, fallback: boolean): boolean;
export function requireEnv(key: string): string; // throws if missing
```

**Required env vars documented in `.env.example`:**

| Variable       | Used by | Default        | Notes                  |
| -------------- | ------- | -------------- | ---------------------- |
| `DATABASE_URL` | all     | --             | Required               |
| `LOG_LEVEL`    | all     | `info`         | debug/info/warn/error  |
| `DB_POOL_SIZE` | all     | `10`           | Connections per app    |
| `NODE_ENV`     | all     | `development`  | development/production |
| `UPLOADS_DIR`  | hangar  | `data/uploads` | Reference doc uploads  |
| `BACKUPS_DIR`  | scripts | `data/backups` | Backup output          |

## Data Model

No new database tables. This feature adds scripts, utilities, and configuration.

### New constants in `libs/constants/src/deployment.ts`

See pool sizes, timeouts, and disk thresholds above.

### New routes in `libs/constants/src/routes.ts`

| Route    | Path        |
| -------- | ----------- |
| `HEALTH` | `'/health'` |

## Validation

| Field                   | Rule                                                 |
| ----------------------- | ---------------------------------------------------- |
| `LOG_LEVEL` env         | Must be `debug`, `info`, `warn`, or `error`          |
| `DB_POOL_SIZE` env      | Must be positive integer, max 50                     |
| Backup `--confirm` flag | Required for restore. Prevents accidental data loss. |

## Edge Cases

| Case                          | Behavior                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Database unreachable          | Health returns `down`, logs error. App continues running (cached pages may work).   |
| Disk full                     | Health returns `down`. Log writes may fail. App degrades.                           |
| SIGTERM during request        | Request completes (up to 30s), then shutdown.                                       |
| Multiple SIGTERM signals      | First triggers shutdown, subsequent ignored.                                        |
| Backup of empty database      | Valid -- produces empty schema dump.                                                |
| Restore to non-empty database | Drops existing data. Requires `--confirm`.                                          |
| Invalid env var format        | `getEnvInt` / `getEnvBool` throw with descriptive error at startup, not at runtime. |
| Missing required env var      | App fails to start with clear error message.                                        |

## Out of Scope

- Container orchestration (Docker, Kubernetes -- future)
- CI/CD pipeline configuration
- CDN setup
- Rate limiting (deferred, far from production)
- SSL/TLS certificate management (handled by reverse proxy)
- Monitoring service integration (Datadog, Sentry -- future)
- Auto-scaling
- Blue/green deployments
- Database replication
