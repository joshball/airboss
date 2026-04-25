---
title: "Design: Deployment Hardening"
product: ops
feature: deployment-hardening
type: design
status: done
---

# Design: Deployment Hardening

## File Structure

```text
libs/
  constants/src/
    deployment.ts             -- pool sizes, timeouts, thresholds
    env.ts                    -- environment variable helpers
  utils/src/
    logger.ts                 -- structured logging utility
    health.ts                 -- health check logic
    error-handler.ts          -- shared error handling
  db/src/
    connection.ts             -- updated with pool config + graceful shutdown

apps/{app}/src/
  hooks.server.ts             -- updated with error handling + request ID
  routes/
    health/
      +server.ts              -- GET /health endpoint
    +error.svelte             -- custom error page

scripts/db/
  backup.ts                   -- pg_dump wrapper
  restore.ts                  -- pg_restore wrapper
  cleanup-backups.ts          -- retention policy

.env.example                  -- documented env vars
```

## Logger Implementation

```typescript
// libs/utils/src/logger.ts
import { getEnv } from "@firc/constants/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogContext {
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export function createLogger(app: string) {
  const minLevel = getEnv("LOG_LEVEL", "info") as LogLevel;
  const isProd = getEnv("NODE_ENV", "development") === "production";

  function log(level: LogLevel, message: string, ctx?: LogContext, error?: Error) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      app,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
      metadata: ctx?.metadata,
    };

    if (isProd) {
      process.stdout.write(JSON.stringify(entry) + "\n");
    } else {
      // Pretty print for dev
      const prefix = `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} [${app}]`;
      const suffix = ctx?.requestId ? ` req=${ctx.requestId}` : "";
      console.log(`${prefix} ${message}${suffix}`);
      if (error?.stack) console.log(error.stack);
    }
  }

  return {
    debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
    info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
    error: (msg: string, ctx?: LogContext, err?: Error) => log("error", msg, ctx, err),
  };
}
```

## Health Check Implementation

```typescript
// libs/utils/src/health.ts
import { HEALTH_CHECK_DB_TIMEOUT_MS, DISK_WARN_BYTES, DISK_ERROR_BYTES } from "@firc/constants/deployment";

export async function checkHealth(db: DB, version: string, startedAt: number): Promise<HealthCheck> {
  const checks = {
    database: await checkDatabase(db),
    diskSpace: await checkDiskSpace(),
  };

  const status =
    checks.database === "error"
      ? "down"
      : checks.diskSpace === "error"
        ? "down"
        : checks.diskSpace === "warning"
          ? "degraded"
          : "ok";

  return {
    status,
    version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks,
    timestamp: new Date().toISOString(),
  };
}

async function checkDatabase(db: DB): Promise<"ok" | "error"> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_DB_TIMEOUT_MS);
    await db.execute(sql`SELECT 1`);
    clearTimeout(timeout);
    return "ok";
  } catch {
    return "error";
  }
}
```

## Health Check Route

Each app gets the same route:

```typescript
// apps/{app}/src/routes/health/+server.ts
import { json } from "@sveltejs/kit";
import { checkHealth } from "@firc/utils/health";
import { db } from "@firc/db";

const startedAt = Date.now();
const version = "__GIT_SHA__"; // replaced at build time

export async function GET() {
  const health = await checkHealth(db, version, startedAt);
  return json(health, {
    status: health.status === "down" ? 503 : 200,
  });
}
```

## Error Handling Hook

```typescript
// apps/{app}/src/hooks.server.ts (additions)
import { createLogger } from "@firc/utils/logger";

const logger = createLogger("sim"); // or 'hangar', 'ops', 'runway'

export const handleError = ({ error, event, status, message }) => {
  const requestId = event.request.headers.get("x-request-id") ?? crypto.randomUUID();

  logger.error(message, { requestId, userId: event.locals.user?.id }, error as Error);

  return {
    message: status === 404 ? "Page not found" : "An unexpected error occurred",
    requestId,
  };
};
```

## Database Connection Hardening

```typescript
// libs/db/src/connection.ts (updated)
import { getEnvInt } from "@firc/constants/env";
import {
  DB_POOL_SIZE,
  DB_CONNECT_TIMEOUT_MS,
  DB_IDLE_TIMEOUT_MS,
  DB_MAX_LIFETIME_MS,
} from "@firc/constants/deployment";

const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  max: getEnvInt("DB_POOL_SIZE", DB_POOL_SIZE),
  connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  maxLifetimeMillis: DB_MAX_LIFETIME_MS,
});

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down, draining connection pool...");
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

## Backup Script

```typescript
// scripts/db/backup.ts
import { $ } from "bun";
import { requireEnv, getEnv } from "@firc/constants/env";

const dbUrl = requireEnv("DATABASE_URL");
const backupsDir = getEnv("BACKUPS_DIR", "data/backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `firc-backup-${timestamp}.sql.gz`;
const filepath = `${backupsDir}/${filename}`;

await $`mkdir -p ${backupsDir}`;
await $`pg_dump ${dbUrl} | gzip > ${filepath}`;

console.log(`Backup created: ${filepath}`);
```

## Key Decisions

**Why not a monitoring service integration:** We're far from production. Structured logging + health checks are the foundation. When a monitoring service is chosen, it plugs into these interfaces. No wasted integration work.

**Why logger in libs/utils, not libs/logging:** It's a utility. A full `libs/logging/` would over-engineer a single-file concern. If it grows (log rotation, remote shipping), it can graduate to its own lib.

**Why pg_dump over application-level backup:** pg_dump is the standard, battle-tested PostgreSQL backup tool. Application-level backup would miss schema changes, sequences, and other DB-level state. pg_dump captures everything.

**Why pool config in constants + env:** Constants provide sensible defaults. Environment variables allow override per deployment. The `getEnvInt` pattern makes this explicit and type-safe.

**Why shared health/error utilities in libs/utils:** All four apps need the same logic. Duplicating it would be fragile. A shared utility with per-app initialization (app name, DB connection) keeps it DRY.
