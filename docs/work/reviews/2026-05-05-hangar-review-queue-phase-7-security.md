---
title: 'Phase 7 Security Review: Hangar Review Queue'
reviewer: security
date: 2026-05-05
diff: 371626fd...f95d5588
---

# Phase 7 Security Review: Hangar Review Queue

## Summary

- Files reviewed: 14
- Critical: 0
- Major: 1
- Minor: 4
- Nit: 3

Phase 7 lands the admin loader page, bucket CRUD, and the open-review nav badge. The dual-gate authorization model is correctly enforced: the parent `(app)/+layout.server.ts` gates AUTHOR | OPERATOR | ADMIN at the layout, and every admin page load and form action calls `requireRole(event, ROLES.ADMIN)` directly so a form POST cannot bypass the role check by skipping the layout load. The advanced JSON predicate path is the obvious threat surface; it lands safely because `validateBucketFilterCriteria` is the only writer, rejects unknown keys per Phase 1 retro, and the predicate is interpreted in TypeScript by `filterItemsByCriteria` rather than translated to dynamic SQL, so neither prototype pollution nor SQL injection is reachable. CSP, CSRF (via SvelteKit's default origin check on form actions), and form-action self-origin are all configured at the app level. The main gap is missing audit log writes for bucket CRUD and loader runs, plus a few error-message and data-exposure rough edges.

## Findings

### Critical

(none)

### Major

#### MAJOR: Bucket CRUD and loader runs are not written to the audit log

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/new/+page.server.ts:30-58`, `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:46-95`, `apps/hangar/src/routes/(app)/review/admin/loader/+page.server.ts:30-62`, `libs/bc/hangar/src/review.ts:368-405`
- **Problem**: `createBucket`, `updateBucket`, `deleteBucket`, and the loader `runLoader` action all mutate global configuration that controls what every reviewer sees on the board, but none of them call `auditWrite` from `@ab/audit`. The hangar BC already uses this pattern (e.g. `libs/bc/hangar/src/invitations.test.ts` extensively asserts `auditWrite` is called for invitation lifecycle events; the audit explorer page help even calls out "card edits, source ingests, job lifecycle events, sync flips, role changes -- everything"). A malicious or careless admin can: create a bucket whose advanced JSON predicate hides a class of items (e.g. `noPassingSession: true` on every kind), edit an existing default bucket out of recognition, or delete a bucket -- and the audit explorer will show no record. Bucket CRUD is admin-scoped configuration with quiet visibility consequences for every other reviewer; the audit gap is exactly the threat model audit logs exist for.
- **Why it matters**: Configuration tampering by a compromised admin account is the textbook "audit-trail-or-it-didn't-happen" case. Without a row, you can't tell *who* deleted the WP-Specs-unread bucket on 2026-05-04 vs. who flipped its predicate; you also can't reconstruct what the predicate was before. The same applies to `runLoader`: an admin pressing "Run loader now" walks the whole filesystem and rewrites items + FTS; that's a heavy, observable side-effecting operation that should leave a trail.
- **Fix**: Add `auditWrite` calls to each mutation in the BC layer (so the BC primitive owns the audit semantics) using a new `AUDIT_OP` like `bucket.created` / `bucket.updated` / `bucket.deleted` and `loader.ran`. Pass `actorId: event.locals.user.id` from the route, with `before` / `after` for update and `before` for delete. The `auditWrite` invocation can run inside the same transaction as the mutation so a rolled-back create doesn't leave a phantom audit row. For the loader, log `actorId` + the result counts (added / updated / removed / errorCount) as `metadata`; the loader BC primitive shouldn't auto-audit unattended boot scans, so audit only on the admin-triggered path (route layer) until a separate decision is made about scheduled scans.

### Minor

#### MINOR: Raw exception messages from BC and DB layer are surfaced to the admin UI

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/new/+page.server.ts:55`, `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:74,89`, `apps/hangar/src/routes/(app)/review/admin/loader/+page.server.ts:58`
- **Problem**: All four error fallbacks pass `err.message` straight back to the form result and onto the page (`errors._form = err instanceof Error ? err.message : '...'`). When that `err` originates from Drizzle / postgres-js, the message can include the raw SQL fragment, the constraint name, and the offending value (e.g. PG `23502` not-null violation messages embed the column and table name; foreign-key violations embed the constraint name). The audience is admin-only, so this is information disclosure to an already-trusted user; the leak still matters because (a) admins can be phished or credential-stuffed and the error text is now part of the post-compromise reconnaissance kit, (b) a screenshot pasted into a bug report ends up in a less-trusted channel, and (c) the existing pattern elsewhere wraps DB errors into user-friendly strings.
- **Fix**: Wrap each `err.message` fallback in a UI-safe message: log the raw `err` via `log.error(...)` (already done) and set `errors._form = 'Bucket update failed. Check the server logs for details.'` (or the equivalent for create / delete / loader). Reserve raw `err.message` for the typed branches that already exist (the `RangeError` from the validator, which is intentionally human-readable and safe).

#### MINOR: Loader error list rendered to admin page can include filesystem paths

- **File**: `apps/hangar/src/routes/(app)/review/admin/loader/+page.svelte:1505-1513`
- **Problem**: The page renders `<li><code>{err.kindId}/{err.ref}</code> -- {err.message}{err.code ? ` (${err.code})` : ''}</li>` for each `DiscoveryError` in the last-run cache. `err.message` is whatever the discovery / FS code threw; in the loader these can include absolute filesystem paths from `node:fs/promises` (`ENOENT: no such file or directory, open '/Users/.../course/...'`). The audience is admin-only, but the path layout of the developer / deploy host is leaked, and any error from a user-controlled file (a corrupted frontmatter parse) may include the path the file lives at on disk.
- **Why it matters**: Admin-only does not equal log-level safe. Same rationale as the previous finding -- screenshots, future role broadening, log shipping.
- **Fix**: In the loader's discovery error normalization, strip the absolute path prefix down to the repo-relative path before stuffing it into `err.message`, or render only `err.kindId / err.ref / err.code` in the admin UI and put the full message behind a debug-mode toggle. Alternative: keep the message but replace any absolute path that starts with `REPO_ROOT` with a `<repo>` placeholder before returning.

#### MINOR: Nav badge and (app) layout call `getOrCreateBoard()` for every authenticated user load

- **File**: `apps/hangar/src/routes/(app)/+layout.server.ts:21-22`
- **Problem**: Every authenticated request to any hangar surface now runs `getOrCreateBoard()` + `countReviewQueueOpen(board.id)`. The badge count is fine to expose to AUTHOR / OPERATOR / ADMIN (the layout is already gated to that set), but `getOrCreateBoard()` is a write-capable operation: on the first ever request after a clean DB it inserts a board row + seeds default columns + seeds review kinds, all attributed to no actor. An AUTHOR user can therefore trigger admin-grade schema seeding by being the first to load any page after a DB wipe.
- **Why it matters**: This is a small surface (idempotent, race-safe via the unique index, defaults are well-defined) but the seeding side effect is invisible. If the seed list is ever changed in a way that depends on an admin reviewing it, an AUTHOR-triggered first-call would lock in the new defaults silently.
- **Fix**: Either (a) restrict the badge to ADMIN / OPERATOR and have AUTHOR see a static "Review" link without count -- skipping the board lookup entirely for AUTHOR -- and accept that AUTHOR sees the un-seeded label until an admin loads the page once; or (b) split the function into `getBoard()` (read-only, returns `null` if missing) and `getOrCreateBoard()` (admin-only writer), and have the layout call `getBoard()` then short-circuit the badge to 0 when missing.

#### MINOR: Bucket name maxlength is enforced client-side and on length only; charset is not constrained

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.ts:71-73`, `_lib/BucketForm.svelte:786`
- **Problem**: Server-side validation rejects empty names and names over 200 chars but does not constrain the charset. A name containing newline / NUL / control bytes / RTL override / Unicode look-alikes will pass through to the DB and render in nav lists, breadcrumbs, and the bucket table. Svelte interpolation auto-escapes HTML metacharacters so XSS is not in scope, but an admin can intentionally craft a homoglyph or RTL-override name to mimic another bucket ("WP Specs" with a Cyrillic 'a'), and a NUL byte in a name will land in `bucket.name` and break tools that read it later.
- **Why it matters**: This is admin-self-service: only admins can write the field. Damage scope is "an admin can confuse another admin." Defense-in-depth.
- **Fix**: Reject names containing control characters (anything below U+0020 except whitespace, plus U+007F and the bidi-override U+202A-202E / U+2066-2069). Trim leading / trailing whitespace (already done) and reject collapsed-empty (already done). Optionally normalize to NFC before storing so visually-identical names collide on the unique index instead of coexisting.

### Nit

#### NIT: Action handler order: auth check then formData() is correct, but the pattern is duplicated four times

- **File**: All four admin route action handlers
- **Problem**: Every action redeclares `requireRole(event, ROLES.ADMIN); const fd = await event.request.formData();`. The order is right (auth before any I/O on the request body) so this isn't an exploit, but the duplication invites a future regression where one action accidentally swaps the order or skips the gate. The `(app)` layout's docstring already calls out the dual-gate rule; consider a tiny helper like `requireAdminAction(event)` in the local `_lib/` to centralize the pattern.
- **Fix**: Optional. Extract the admin-gate prelude into a helper in `_lib/bucket-form.ts` (or a new `_lib/admin-gate.ts`) that both routes share so the gate cannot be lost in a refactor.

#### NIT: Loader run uses `data.lastRun.ranAt` (process-local cache) -- a process restart loses the audit-trail-by-proxy

- **File**: `libs/bc/hangar/src/review-loader.ts:55-63`
- **Problem**: The loader's last-run summary is a module-level `let lastLoaderRun` with no persistence. The spec calls this out as a v1 simplification, and it isn't a security issue per se -- but if the audit-write fix above does not land, the in-memory cache is the only post-hoc evidence that a loader run happened, and a process restart wipes it. This is the second "no audit trail" angle on the same root cause.
- **Fix**: Resolved by the MAJOR audit-log fix; if that fix lands, the in-memory cache remains a UI convenience and this nit goes away.

#### NIT: `event.params.bucketId` flows directly into BC functions without a shape check

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:32,39,80`
- **Problem**: `bucketId` from the URL is passed straight to `getBucket(bucketId)`, `updateBucket(bucketId, ...)`, `deleteBucket(bucketId)`. Drizzle parameterizes the value so SQL injection is not possible, and a non-matching id makes `getBucket` return `null` (-> 404) and `updateBucket` throw "bucket not found" -- both correct behaviours. The nit is that there's no upfront shape validation (e.g. ULID prefix `hrb_` followed by 26 Crockford base32 chars) so a malformed param hits the DB and burns a query before the typed error fires.
- **Fix**: Optional. Add a `if (!bucketId.startsWith('hrb_')) throw error(404)` early-return so probing the route with garbage params doesn't hit the DB. This is purely defense-in-depth / DoS-budget; current behaviour is not exploitable.

## Areas verified clean

- **AuthN/AuthZ dual gate**: `(app)/+layout.server.ts` enforces AUTHOR / OPERATOR / ADMIN at the layout, and every admin `load` plus every `action` (`runLoader`, bucket `default` create action, `update`, `delete`) calls `requireRole(event, ROLES.ADMIN)` before any other I/O. A POST cannot bypass the role check by skipping the layout load.
- **Predicate validator (Phase 1 retro fix in place)**: `validateBucketFilterCriteria` (`libs/bc/hangar/src/review.ts:293`) rejects unknown keys, requires the input be a non-array object, and validates each known key's type strictly (`kind` string, `frontmatterStatus` and `reviewStatus` arrays of allowed enum values, `noPassingSession` boolean). Tests at `libs/bc/hangar/src/review.test.ts:409+` confirm `evilExtra: 1` -> "unknown key", `kind: 42` -> typed rejection, `null` / `[]` / `'foo'` -> structured-object rejection. The validator runs on every `createBucket` and `updateBucket` call, including the advanced JSON path, so an admin cannot smuggle an unknown predicate key into the row.
- **No SQL-injection-via-predicate**: `filterItemsByCriteria` (`libs/bc/hangar/src/review.ts:683`) is a pure-TypeScript filter; the bucket predicate is never compiled to dynamic SQL. The BC's own queries (`countReviewQueueOpen`, `listItems`, `listItemsWithPassingSession`) use Drizzle expression builders or parameterized `sql` template literals -- no string interpolation of user-supplied values.
- **No `eval` / `new Function` on the advanced JSON path**: `JSON.parse` only, with try/catch, and the parsed object is run through the validator before reaching the DB.
- **No prototype pollution path**: even if `__proto__` or `constructor` were jammed into the JSON, the validator's `Object.keys(obj)` + allow-set check rejects them with "unknown key" before any property assignment to a typed accumulator (`out`).
- **CSP and CSRF**: `apps/hangar/svelte.config.js` configures `default-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`. SvelteKit's default `csrf.checkOrigin` is intact (no override). `?/runLoader` and bucket actions are POST form actions, not GET endpoints, so CSRF is enforced by the framework.
- **Output encoding / XSS**: no `{@html}` anywhere in `apps/hangar/src/routes/(app)/review/admin/`. Bucket name, kind, filter summary, and the loader error list all render via Svelte interpolation, which is HTML-escaped by default. No `href` interpolation with dynamic protocols.
- **Path traversal in loader**: `loadReviewItems(REPO_ROOT, db)` uses the server-resolved `REPO_ROOT` constant from `libs/bc/hangar/src/source-jobs.ts:43`, not user input. The admin form has no input that influences the scan path.
- **Concurrency on loader**: in-flight singleton via `WeakMap<Db, Promise<LoaderResult>>` in `review-loader.ts:70`. Concurrent admin clicks share the same promise; a stampede on boot does not fan out N parallel filesystem walks. The transaction wraps the upsert + soft-prune so external readers see one snapshot.
- **Concurrent bucket-name race**: PG 23505 unique-violation is caught and surfaced as an inline `errors.name` message; no 500 leak.
- **Nav badge sensitivity**: the count is shown to AUTHOR / OPERATOR / ADMIN, all already trusted with the underlying data; the count is an aggregate (not per-item), so it does not leak any item that the user couldn't already see on `/review`.
- **Form ordering**: `requireRole` is called before `event.request.formData()` in every action, so an unauthorized POST is rejected before request body parsing -- no resource consumption from unauthenticated callers.
- **No browser-bundled `node:*` regression**: route handlers are server-only (`+page.server.ts`); `_lib/bucket-form.ts` imports only from `@ab/constants` and `@ab/bc-hangar` types, no node built-ins; `_lib/BucketForm.svelte` likewise.
- **No new session / cookie handling**: Phase 7 does not touch auth lib internals; existing better-auth session flow handles cookies + invalidation.
- **No file uploads / downloads**: admin forms are pure text + structured data; no `multipart/form-data`, no `sendFile`.
