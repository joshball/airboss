---
title: "Test Plan: Deployment Hardening"
product: ops
feature: deployment-hardening
type: test-plan
status: done
---

# Test Plan: Deployment Hardening

## Setup

```bash
bun scripts/dev.ts sim    # or any app
```

---

## HEALTH-1: Health check returns ok

1. Start any app
2. `curl http://localhost:{port}/health`
3. **Expected:** 200 response with JSON body
4. **Expected:** `status: 'ok'`, `database: 'ok'`, `diskSpace: 'ok'`
5. **Expected:** `version` field present
6. **Expected:** `uptime > 0`

## HEALTH-2: Health check with DB down

1. Stop the database (or misconfigure `DATABASE_URL`)
2. `curl http://localhost:{port}/health`
3. **Expected:** 503 response
4. **Expected:** `status: 'down'`, `database: 'error'`

## HEALTH-3: Health check on all apps

1. Start sim, hangar, ops, runway
2. Hit `/health` on each
3. **Expected:** All return valid health check responses

---

## LOG-1: Structured logging in development

1. Start an app with `LOG_LEVEL=debug`
2. Make a request
3. **Expected:** Pretty-printed log output in console
4. **Expected:** Includes timestamp, level, message, app name

## LOG-2: Structured logging in production format

1. Set `NODE_ENV=production`, start an app
2. Make a request
3. **Expected:** Single-line JSON log entries
4. **Expected:** Each line is valid JSON with all `LogEntry` fields

## LOG-3: Request ID propagation

1. Make a request
2. **Expected:** Log entries for that request all share the same `requestId`
3. **Expected:** Error responses include the request ID

## LOG-4: Log level filtering

1. Start with `LOG_LEVEL=warn`
2. Make a normal request
3. **Expected:** No `debug` or `info` messages in output
4. **Expected:** Warnings and errors still appear

---

## ERR-1: Custom error page

1. Navigate to a non-existent route (e.g., `/this-does-not-exist`)
2. **Expected:** Custom 404 page shown (not SvelteKit default)
3. **Expected:** Request ID visible on the error page

## ERR-2: Server error handling

1. Trigger a server error (e.g., malformed form submission)
2. **Expected:** 500 error page shown with request ID
3. **Expected:** No stack trace visible in the browser
4. **Expected:** Error logged server-side with stack trace

## ERR-3: Form action error

1. Submit a form with invalid data
2. **Expected:** Form returns validation error (not a 500)
3. **Expected:** Error logged at `warn` level

---

## DB-1: Connection pool configuration

1. Start an app, check logs
2. **Expected:** Log entry showing pool size, timeouts at startup

## DB-2: Graceful shutdown

1. Start an app
2. Send SIGTERM (`kill -TERM {pid}`)
3. **Expected:** App logs "Shutting down..."
4. **Expected:** App closes within 30s
5. **Expected:** No "connection refused" errors for in-flight requests

## DB-3: Invalid DATABASE_URL

1. Set `DATABASE_URL` to an invalid value
2. Start an app
3. **Expected:** App fails to start with clear error message about database config
4. **Expected:** No cryptic connection error

---

## BACKUP-1: Create a backup

1. Run `bun scripts/db/backup.ts`
2. **Expected:** Compressed SQL file created in `data/backups/`
3. **Expected:** Filename includes timestamp
4. **Expected:** File is non-empty

## BACKUP-2: Restore from backup

1. Create a backup
2. Modify some data in the database
3. Run `bun scripts/db/restore.ts data/backups/{file} --confirm`
4. **Expected:** Data restored to backup state
5. **Expected:** Modified data reverted

## BACKUP-3: Restore without confirm flag

1. Run `bun scripts/db/restore.ts data/backups/{file}` (no `--confirm`)
2. **Expected:** Script exits with message: "Use --confirm to proceed. This will overwrite existing data."
3. **Expected:** Database unchanged

## BACKUP-4: Cleanup retention

1. Create 35 backup files (or simulate with touch)
2. Run `bun scripts/db/cleanup-backups.ts`
3. **Expected:** Only 30 most recent daily backups remain
4. **Expected:** Weekly backups (if any) also retained per policy

---

## ENV-1: Missing required env var

1. Unset `DATABASE_URL`
2. Start an app
3. **Expected:** Clear error message: "Required environment variable DATABASE_URL is not set"
4. **Expected:** App does not start

## ENV-2: .env.example complete

1. Open `.env.example`
2. **Expected:** All documented env vars listed with descriptions
3. **Expected:** Matches the spec's env var table
