---
feature: auth-identity-audit
category: perf
date: 2026-05-01
branch: main
reviewer: ball-review-perf
status: unread
review_status: done
counts:
  critical: 0
  major: 3
  minor: 5
  nit: 3
---

## Status as of 2026-05-04

Walked every finding against current main. 9 of 11 closed; 2 carried (one open + cross-ref).

| Severity | Finding                                                | Verdict                                                                                          |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| MAJOR    | Missing index on `bauth_session.user_id`               | CLOSED -- `bauth_session_user_idx` in schema.ts:56                                               |
| MAJOR    | Missing indexes on `bauth_account.user_id` + provider  | CLOSED -- `bauth_account_user_idx` + `bauth_account_provider_account_idx` in schema.ts:86-87     |
| MAJOR    | `audit_log.timestamp` lacks standalone index           | CLOSED -- `audit_log_timestamp_idx` in audit/schema.ts:80                                        |
| MINOR    | `auditRecent` cannot use index ordering on targetType  | CLOSED -- `audit_log_target_type_time_idx` (target_type, timestamp) in audit/schema.ts:85        |
| MINOR    | `bauth_verification.identifier` not indexed            | CLOSED -- `bauth_verification_identifier_idx` in schema.ts:104                                   |
| MINOR    | `auditWrite` `.returning()` drags jsonb back           | STILL OPEN -- design item, see below                                                             |
| MINOR    | Session-hydration block duplicated across 4 hooks      | CLOSED -- `mapBetterAuthSession` extracted to `libs/auth/src/session-map.ts`; all 4 apps consume |
| MINOR    | Sim and avionics hooks have no banned-user guard       | STILL OPEN -- tracked under correctness MAJOR; see that review for the trigger                   |
| MINOR    | `forwardAuthCookies` parses every Set-Cookie on login  | CLOSED -- detection moved to parsed `parts` array via `parseCookieMaxAge` (cookies.ts:83-107)    |
| NIT      | `requireAuth` re-encodes pathname + search per call    | CLOSED -- mentioned-for-completeness; per-request cost negligible                                |
| NIT      | `crypto.randomUUID()` per request for request-id       | CLOSED -- mentioned-for-completeness; UUID kept for log correlation simplicity                   |
| NIT      | `applySecurityHeaders` runs four .set calls            | CLOSED -- mentioned-for-completeness; cost is microseconds                                       |

### Carried-forward design items

- **`auditWrite` `.returning()`**: today most callers ignore the return value; the jsonb drag is real but bounded by audit volume per request. Trigger to land: when audit-log volume per request exceeds 5+ rows (e.g. job worker batches). Switch to `.returning({ id, timestamp })` then.
- **sim/avionics banned guard**: tracked under correctness MAJOR. Trigger: first authenticated write endpoint on either surface.

## Summary

Auth hot path is well-shaped: `cookieCache` (5-min TTL) keeps the per-request
`getSession` call out of Postgres for the steady state, dual-gate `requireAuth`
reads from `event.locals` (no DB), and the audit insert is a single `INSERT
... RETURNING` that piggybacks on the caller's transaction.

The real perf risks live in the DB schema layer (`@ab/auth` and `@ab/audit`):

- `bauth_session.user_id`, `bauth_account.user_id`, `bauth_verification.identifier`
  have **no indexes**. Better-auth issues lookups against all three on routine
  paths (sign-in, account linking, magic-link, verification, ban-by-user-id,
  expired-session sweep). At any non-trivial table size these become full scans.
- `audit_log.timestamp` has no standalone index. `countAuditEntriesSince` --
  rendered on the hangar admin home -- does `WHERE timestamp >= since` and is
  forced to seq-scan or use a non-leading column on the existing composite
  indexes. The audit log is append-only and grows without bound.
- `auditRecent` for the `targetType`-only branch (no `targetId`) cannot read
  rows in `timestamp DESC LIMIT N` order from `audit_log_target_idx
  (target_type, target_id, timestamp)`; Postgres has to scan all matching rows
  and sort, because `target_id` sits between `target_type` and `timestamp` in
  the index.

The hooks-level code itself is clean: 3 of the 4 surface apps (study, sim,
hangar, avionics) duplicate the same ~50-line session-hydration block
verbatim, which isn't a perf hit per request but does mean any future
session-shape optimization (e.g. `additionalFields` columns moving to a
separate select to shrink the cookie cache payload) has to be made in four
places.

## Issues

### MAJOR: Missing index on `bauth_session.user_id`

- **File:** `libs/auth/src/schema.ts:30-42`, `drizzle/0000_initial.sql:33-45`
- **Problem:** `bauth_session` has only the primary key (`id`) and a unique
  index on `token`. There is no index on `user_id`. Better-auth issues
  `WHERE user_id = ?` lookups for: revoking all sessions on ban (`admin`
  plugin's `banUser`), the per-user "list active sessions" UI surface,
  expired-session sweep filtered to a user, and impersonation cleanup.
- **Impact:** Won't scale past a few thousand session rows. Every ban-by-user
  flow (admin tool) and every "sign me out everywhere" call goes from
  index-lookup (~ms) to seq scan (10s of ms+ at modest scale, seconds at
  100k+ rows). Sessions accumulate fast because `cookieCache` extends the
  effective lifetime of a row to its TTL even after logout in another tab.
- **Fix:** Add `index('bauth_session_user_idx').on(t.userId)` (or
  `(userId, expiresAt)` to also accelerate the periodic expired-session
  sweep) in `libs/auth/src/schema.ts`, generate a migration, and apply.

### MAJOR: Missing index on `bauth_account.user_id` and `(provider_id, account_id)`

- **File:** `libs/auth/src/schema.ts:44-60`, `drizzle/0000_initial.sql`
- **Problem:** `bauth_account` carries only the PK on `id`. Better-auth's
  email-and-password sign-in path looks up the credentials row by
  `(provider_id='credential', account_id=<email-or-userId>)` on every
  `signInEmail` call (this is where the bcrypt-compared `password` lives), and
  the OAuth/magic-link linking flows look up `WHERE user_id = ?` to enumerate
  a user's linked accounts.
- **Impact:** Sign-in latency drifts up linearly with the user count -- exactly
  the path covered by the `SIGN_IN_*` rate limit (currently the tightest
  bucket), so the worst case is "every login does a seq scan + bcrypt." At
  10k users on a warm Postgres this is still tolerable, at 100k+ it's user-
  visible and at 1M+ it'll dominate every login.
- **Fix:** Add `index('bauth_account_user_idx').on(t.userId)` and a unique
  composite `uniqueIndex('bauth_account_provider_account_unique').on(t.providerId, t.accountId)`
  (the composite also enforces the natural key, which currently has no DB
  guard). Generate migration; verify with `EXPLAIN` that better-auth's
  credential lookup uses it.

### MAJOR: `audit_log.timestamp` has no standalone index, but `countAuditEntriesSince` filters on it

- **File:** `libs/audit/src/schema.ts:43-74`, `libs/audit/src/log.ts:67-70`,
  `apps/hangar/src/routes/(app)/+page.server.ts:11`
- **Problem:** The two indexes on `audit_log` lead with `actor_id` and
  `target_type`. `countAuditEntriesSince(since)` runs
  `WHERE timestamp >= since` with no other predicate, so neither composite
  index can be used as a leading-prefix range scan. Postgres falls back to a
  seq scan over the entire `audit_log` (or, if the planner picks a different
  index, an inefficient bitmap scan).
- **Impact:** The hangar admin home renders this count on every page load. As
  the audit log grows (it's append-only, written by every BC mutation in every
  app, every job worker tick that writes lifecycle events, every sync run),
  the dashboard tile gets slower and slower with no upper bound. At ~1M rows
  this is already a multi-hundred-ms query; the audit log is on track to hit
  that within months given the current write rate from `hangar-jobs`,
  `hangar-sync`, and `source-fetch`.
- **Fix:** Either add a dedicated `index('audit_log_timestamp_idx').on(desc(t.timestamp))`
  (BRIN is also a fit here -- timestamps insert in monotonically-increasing
  order, so BRIN gives ~constant size and good range performance), or replace
  the recent-activity tile with a rolling counter table the audit writer
  bumps. The BRIN option is the lowest-effort fix and is well-suited to
  append-only chronological data.

### MINOR: `auditRecent` cannot use index ordering when only `targetType` is filtered

- **File:** `libs/audit/src/log.ts:50-61`, `libs/audit/src/schema.ts:69`
- **Problem:** The composite `audit_log_target_idx (target_type, target_id, timestamp)`
  cannot satisfy `WHERE target_type=? ORDER BY timestamp DESC LIMIT N` as a
  pure index scan -- `target_id` separates the equality column from the sort
  column, so Postgres has to fetch all matching rows and sort. The `targetId`-
  scoped branch (line 58) is fine; the `targetType`-only branch (line 59) is
  the slow one.
- **Impact:** Scales with rows-per-target-type. For target types like `'card'`
  or `'session_item_result'` (when those start writing audit entries), the
  query degrades to "sort the entire history of that target type and take
  the top 10."
- **Fix:** Add `index('audit_log_target_type_time_idx').on(t.targetType, desc(t.timestamp))`
  -- a composite that puts the sort column directly after the equality
  column. The existing `target_idx` stays as-is for the `targetId`-scoped
  reads.

### MINOR: `bauth_verification.identifier` not indexed

- **File:** `libs/auth/src/schema.ts:62-69`
- **Problem:** Better-auth looks up verification rows by `identifier`
  (typically the user's email or magic-link token recipient) on
  password-reset confirm, magic-link consume, and email-verify endpoints.
  The schema has no index on `identifier`.
- **Impact:** Each of those endpoints does a seq scan on `bauth_verification`.
  The table is short-lived (rows expire), so the absolute size stays modest,
  but every magic-link click and every password-reset still pays a seq-scan
  cost. The `MAGIC_LINK` and `FORGET_PASSWORD` rate-limits are already
  tight so the volume is bounded, but at any meaningful sign-up rate this
  is wasted work.
- **Fix:** Add `index('bauth_verification_identifier_idx').on(t.identifier)`
  (and consider `(identifier, expiresAt)` so the "valid + matching" lookup
  is fully index-served).

### MINOR: `auditWrite` does `.returning()` on every insert, dragging `before`/`after` jsonb back through the wire

- **File:** `libs/audit/src/log.ts:29-42`
- **Problem:** Every `auditWrite` returns the full row including the
  `before` and `after` jsonb snapshots, even when the caller doesn't use the
  return value. Most call sites in `libs/bc/hangar/`, `libs/hangar-jobs/`,
  and `libs/hangar-sync/` ignore the return.
- **Impact:** For audit rows on chunky targets (e.g. a source-fetch row with
  a multi-KB metadata blob, a registry update with a big `after` payload),
  every write round-trips the payload Postgres -> Bun process for no reason.
  Not visible at current scale but adds up on workers that audit-log inside
  tight loops.
- **Fix:** Either drop `.returning()` from `auditWrite` and have it return
  `void`, or narrow it to `.returning({ id: auditLog.id, timestamp: auditLog.timestamp })`
  so callers that need a handle to the row still get one without dragging
  jsonb back. Audit the call sites to confirm none rely on `before`/`after`
  in the return value.

### MINOR: Session-hydration block duplicated across 4 hooks

- **File:** `apps/study/src/hooks.server.ts:96-131`,
  `apps/hangar/src/hooks.server.ts:120-153`,
  `apps/sim/src/hooks.server.ts:42-72`,
  `apps/avionics/src/hooks.server.ts:41-71`
- **Problem:** All four apps run the same `getSession` -> map to
  `AuthSession` / `AuthUser` -> set `event.locals.{session,user}` block, with
  the same `(session.user as Record<string, unknown>).firstName` cast and
  the same `?? ''` fallback. The structure invites drift.
- **Impact:** Per-request perf is identical. The risk is future drift: any
  optimization (e.g. lazy-loading `firstName`/`lastName` only when a route
  needs them, dropping the `Record<string, unknown>` cast in favor of a
  typed extension, or batching session+user fetches into one query when
  cookie-cache misses) has to be made in four places.
- **Fix:** Extract `hydrateSessionLocals(event, auth)` into `@ab/auth` and
  call it from each app's hook. The auth lib already owns the `AuthSession`/
  `AuthUser` shapes; the helper is a natural fit there.

### MINOR: Sim and avionics hooks have no banned-user guard

- **File:** `apps/sim/src/hooks.server.ts:42-85`,
  `apps/avionics/src/hooks.server.ts:41-84`
- **Problem:** Study and hangar both check `event.locals.user?.banned` and
  short-circuit with a 403 (study line 133, hangar line 155). Sim and
  avionics populate `locals.user` exactly the same way but never gate on
  `banned`. A banned user can still load every sim and avionics page; their
  `locals.user.banned` flag just sits there unread.
- **Impact:** Today: zero perf cost. The concern is that as sim/avionics add
  persistence endpoints and start paying DB work for authenticated requests,
  they'll be doing that work for banned users too. Per-request tax that
  scales linearly with banned-user request volume.
- **Fix:** When the shared `hydrateSessionLocals` helper from the previous
  finding lands, fold the banned-user check into it (or right after it).
  Avoids divergence and closes the gap before sim/avionics actually expose
  authenticated write paths.

### MINOR: `forwardAuthCookies` parses every Set-Cookie header on every login

- **File:** `libs/auth/src/cookies.ts:68-97`
- **Problem:** The function calls `getSetCookie()`, then for each cookie
  splits, finds `=`, decodes, and lower-cases the entire header to detect
  expiring cookies. For a typical sign-in response (3-5 Set-Cookie headers)
  this is fine. The expiring-cookie detection (`rawLower.includes('max-age=0')`,
  `rawLower.includes('expires=thu, 01 jan 1970')`) does two `String.prototype.includes`
  on the lower-cased full header per cookie.
- **Impact:** Sub-millisecond per login, but it's on the hot path of the
  most-attacked endpoint (sign-in, gated by the tightest rate limit). Doing
  the detection on `parts` (already split by `;`) instead of re-scanning
  the full header twice would be cleaner.
- **Fix:** Detect expiry by inspecting the parsed `parts` array (look for a
  part that matches `^max-age\s*=\s*0$` or starts with `expires=`) instead
  of re-lower-casing and substring-searching the full header. Same
  correctness, half the string work.

### NIT: `requireAuth` re-encodes `pathname + search` per call

- **File:** `libs/auth/src/auth.ts:64-73`
- **Problem:** On the bounce path (no user), `requireAuth` builds
  `${pathname}${search}` and `encodeURIComponent`s it. Per-call cost is
  microseconds; the value is also reconstructed in the layout's bounce
  path and in the page-level bounce path on the same request (dual-gate).
- **Impact:** Negligible. Mentioned for completeness.
- **Fix:** None warranted. Skip unless profiling shows otherwise.

### NIT: `crypto.randomUUID()` per request for request-id when none is provided

- **File:** `apps/study/src/hooks.server.ts:31`,
  `apps/hangar/src/hooks.server.ts:63`,
  `apps/sim/src/hooks.server.ts:18`,
  `apps/avionics/src/hooks.server.ts:18`
- **Problem:** Every request without a valid inbound `x-request-id` mints a
  fresh UUID via `crypto.randomUUID()`. Web Crypto's UUID is fast (sub-
  microsecond) but not free; the string is also used only as a logger key.
- **Impact:** Negligible at any plausible request rate.
- **Fix:** None warranted. A nanoid-style 12-char id would be cheaper and
  easier to read in logs, but the swap isn't worth the churn.

### NIT: `applySecurityHeaders` runs four `headers.set` calls + a `dev` branch on every response

- **File:** `apps/study/src/hooks.server.ts:44-57`,
  `apps/hangar/src/hooks.server.ts:76-88`
- **Problem:** Per-response, four `Headers.set` calls plus a `dev` check.
  Wrapped in `try/catch` because some response types have frozen headers.
- **Impact:** Microseconds per response. The `try/catch` wrapper is cheap
  but appears on every response.
- **Fix:** None warranted. The code is fine. A `Map`-based static-headers
  table copied via `Object.entries` would be marginally faster but less
  readable.
