---
feature: hangar-cluster
category: patterns
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 0
  minor: 6
  nit: 4
  total: 10
scope:
  - apps/hangar/src/
  - libs/hangar-jobs/
  - libs/hangar-sync/
  - libs/bc/hangar/src/
---

## Summary

The hangar cluster is in strong project-pattern shape. All cross-lib imports use `@ab/*` aliases, route URLs flow through `ROUTES`, IDs go through `createId()`-backed factories in `@ab/utils`, the schema lives under `SCHEMAS.HANGAR`, design tokens are used everywhere (no hex/rgb in svelte styles), Svelte 5 runes are used exclusively (no `export let`/`<slot>`/`writable`/`$:`/`$app/stores`), and the BC keeps its boundary clean (audit_log is read-only via `@ab/audit`). No `any` outside test mocks, no non-null assertions in production code. Drizzle's `sql.raw` use is confined to schema check-constraint construction; `sql\`...\`` template fragments in BC code are parameterised, not raw SQL strings.

Findings are limited to a handful of magic-string and bare-cast nits: one `redirectTo` query-param literal that should reference `QUERY_PARAMS.REDIRECT_TO`, one `'event'` log-stream string that should use `JOB_LOG_STREAMS.EVENT`, one `?sinceSeq=` URL fragment that should compose `QUERY_PARAMS.SINCE_SEQ`, two un-commented `as unknown as ReadableStream` casts on Node fs streams, and a couple of inline tuning numbers (drain-loop sleep, client-side poll interval) that should follow the existing module-scoped-constant pattern.

## Issues

### MINOR: `redirectTo` query-param key hardcoded in hangar layout guard

File: `apps/hangar/src/routes/+layout.server.ts:37`
Problem: The unauthenticated bounce composes the login URL with a literal `?redirectTo=` segment. `QUERY_PARAMS.REDIRECT_TO` exists in `libs/constants/src/routes.ts:79` precisely to cover this, and the matching login action at `apps/hangar/src/routes/login/+page.server.ts:81` already reads via `QUERY_PARAMS.REDIRECT_TO`, so the two ends are out of sync.
Rule: "No magic strings. Use `libs/constants/`." plus the targeted `REDIRECT_TO` constant added 2026-04-27.
Fix: `redirect(302, \`${ROUTES.LOGIN}?${QUERY_PARAMS.REDIRECT_TO}=${redirectTo}\`)`.

### MINOR: `stream: 'event'` magic string in `appendJobLog` call

File: `libs/hangar-jobs/src/enqueue.ts:162`
Problem: `recoverOrphanedRunning` writes a recovery log line with `stream: 'event'` as a literal. Every other call site in the cluster routes through `JOB_LOG_STREAMS.EVENT`/`STDOUT`/`STDERR` (see `worker.ts:129-135`).
Rule: "No magic strings."
Fix: `await appendJobLog({ jobId: id, stream: JOB_LOG_STREAMS.EVENT, line: 'recovered from worker restart' }, db);` and import `JOB_LOG_STREAMS` from `@ab/constants`.

### MINOR: `?sinceSeq=` query string composed inline on the job-detail polling client

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:42`
Problem: The poll URL is built as `${ROUTES.HANGAR_JOB_LOG(data.job.id)}?sinceSeq=${latestSeq}` with the param name as a literal. `QUERY_PARAMS.SINCE_SEQ` is defined exactly for this endpoint (`libs/constants/src/routes.ts:81`).
Rule: "All literal values in `libs/constants/`." plus the targeted `SINCE_SEQ` constant.
Fix: `${ROUTES.HANGAR_JOB_LOG(data.job.id)}?${QUERY_PARAMS.SINCE_SEQ}=${latestSeq}` and add `QUERY_PARAMS` to the import.

### MINOR: Un-commented `as unknown as ReadableStream` casts on Node fs streams

Files:
- `apps/hangar/src/routes/(app)/sources/[id]/thumbnail/+server.ts:50`
- `apps/hangar/src/routes/(app)/sources/[id]/download/+server.ts:47`
- `apps/hangar/src/routes/(app)/sources/[id]/files/raw/+server.ts:87`

Problem: Each stream-binding endpoint wraps a Node `createReadStream(...)` result with `stream as unknown as ReadableStream` and no inline justification. The Node→web stream coercion is a real type gap, but the project rule is no `as` without an explanatory comment (`apps/hangar/src/routes/(app)/users/[id]/+page.server.ts:32` is the existing pattern -- it has a doc comment explaining the better-auth gap).
Rule: "No `as` without comment" / "No `any`. Prefer proper types, generics, `unknown` with guards."
Fix: Either add a one-line comment on each cast (e.g. `// Node fs Readable -> web ReadableStream coercion; SvelteKit accepts the runtime shape.`), or factor the coercion into a single helper (e.g. `nodeStreamToWeb(stream)`) so the cast lives in one annotated place.

### MINOR: Worker drain-loop sleep is a bare `25` ms literal

File: `libs/hangar-jobs/src/worker.ts:239`
Problem: The graceful-shutdown drain loop uses `await sleep(25)` with no named constant, while the sibling `DEFAULT_POLL_INTERVAL_MS` and `DEFAULT_CONCURRENCY` at the top of the file are properly named module-scoped constants.
Rule: "No magic numbers. Use `libs/constants/`." (Module-scoped constants are the established escape hatch in this file; just be consistent.)
Fix: Add `const DRAIN_POLL_INTERVAL_MS = 25;` near `DEFAULT_POLL_INTERVAL_MS` and reference it.

### MINOR: Job-detail client polling interval hardcoded at 1000 ms

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:67`
Problem: `setInterval(..., 1000)` lives inline in the component. The number ties to the worker's `DEFAULT_POLL_INTERVAL_MS = 1000` and to the spec's "UI polls at 1 Hz" claim in `worker.ts:11`. Inline literals here mean a future tuning change has to be made in two places, with no symbol search to surface them.
Rule: "No magic numbers." (Either expose a constant from `@ab/constants` shared with the worker, or hoist a top-of-file `POLL_INTERVAL_MS = 1000` in the component with a comment cross-linking to the worker.)
Fix: Add `JOB_POLL_INTERVAL_MS` to `libs/constants/src/jobs.ts` (or whichever jobs-constants file is canonical) and import on both ends; failing that, hoist a local named constant.

### NIT: `pickAllowedValue` cast-on-narrow lacks an explanatory comment

File: `apps/hangar/src/routes/(app)/admin/audit/filters.ts:82`
Problem: `return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;` does the standard "narrow-by-`includes`" trick. It is correct but the cast pair is opaque without context. Project house style elsewhere (e.g. the `auth.api as unknown as AdminAuthApi` cast) annotates these.
Rule: "No `as` without comment."
Fix: Add a one-line `// includes() guarantees value is one of T at runtime; TS just doesn't narrow generic readonly-arrays.` comment above the return.

### NIT: `as JobStatus` casts in job-detail polling response handler

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:27,52`
Problem: `data.job.status as JobStatus` and `body.status as JobStatus` both narrow a server-trusted but type-`string` value into the union. A short comment ("server values are constrained to JobStatus by the audit-checked DB enum") would document the trust boundary.
Rule: "No `as` without comment."
Fix: Add a one-line comment on first usage; the second can reference it.

### NIT: `targetId: 'registry'` sentinel string repeated in build/validate handlers

Files:
- `libs/bc/hangar/src/source-jobs.ts:321`
- `libs/bc/hangar/src/source-jobs.ts:382`

Problem: The build and validate handlers write audit rows against `targetId: 'registry'` as a literal sentinel for "registry-wide, not a single source". Repeating the string twice is a small magic-string risk; if the sentinel ever needs to change (or grow a sibling like `'index'`), nothing groups them.
Rule: "No magic strings."
Fix: Add a `REGISTRY_TARGET_ID = 'registry'` constant at the top of `source-jobs.ts` (or in `@ab/constants` next to `AUDIT_TARGETS`) and use it in both call sites.

### NIT: `recoverOrphanedRunning` cursor-base default of `-1` is bare

File: `libs/hangar-jobs/src/enqueue.ts:97`
Problem: `const sinceSeq = options.sinceSeq ?? -1;` works because `seq >= 0` for every real row, but the choice of `-1` to mean "from the beginning" is a tiny magic number worth either a constant or a one-line comment.
Rule: "No magic numbers" (lightest interpretation).
Fix: Either `const SINCE_SEQ_BEGINNING = -1;` at module scope, or a single-line comment: `// sentinel: real seq starts at 0, so -1 returns every row.`

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| MINOR: redirectTo magic-string | CLOSED | `+layout.server.ts:37` and `login/+page.server.ts:86` use `QUERY_PARAMS.REDIRECT_TO` |
| MINOR: `'event'` magic-string in appendJobLog | CLOSED | `enqueue.ts:214` uses `JOB_LOG_STREAMS.EVENT` |
| MINOR: `?sinceSeq=` inline param | CLOSED | `jobs/[id]/+page.svelte:69` uses `QUERY_PARAMS.SINCE_SEQ`; trim-notice fallback link updated to match (this audit) |
| MINOR: un-commented `as unknown as ReadableStream` casts | CLOSED | All three streaming routes carry the Node->Web stream coercion comment |
| MINOR: drain-loop sleep magic 25 | CLOSED | `worker.ts:87` `DRAIN_POLL_INTERVAL_MS` constant |
| MINOR: client poll interval magic 1000 | CLOSED | `JOB_DETAIL_POLL_INTERVAL_MS` in `@ab/constants` (`jobs.ts`) |
| NIT: pickAllowedValue cast comment | CLOSED | `filters.ts:82-85` carries the includes() narrowing rationale |
| NIT: `as JobStatus` casts | CLOSED | `jobs/[id]/+page.svelte:38-39` carries the trust-boundary rationale |
| NIT: `'registry'` sentinel duplicated | CLOSED | `REGISTRY_TARGET_ID` constant at `source-jobs.ts:51` |
| NIT: `sinceSeq ?? -1` magic | CLOSED | Inline comment at `enqueue.ts:104-106` documents the sentinel |

Total: 10 closed / 0 open. `review_status` flipped to `done`.
