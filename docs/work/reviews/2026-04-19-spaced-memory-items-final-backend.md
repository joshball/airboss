---
title: 'Final Backend Review: spaced-memory-items'
date: 2026-04-19
branch: build/spaced-memory-items
scope: backend (server code, BC, auth, db, utils, scripts)
review_status: done
status: unread
---

# Final Backend Review -- spaced-memory-items

Scope: `git diff docs/initial-migration..HEAD`, server side only. Files covered:

- `apps/study/src/hooks.server.ts`
- `apps/study/src/lib/server/{auth,cookies}.ts`
- `apps/study/src/routes/(app)/+layout.server.ts`
- `apps/study/src/routes/(app)/memory/{+page,[id]/+page,browse/+page,new/+page,review/+page}.server.ts`
- `apps/study/src/routes/(app)/logout/+page.server.ts`
- `apps/study/src/routes/login/+page.server.ts`
- `libs/bc/study/src/{cards,reviews,stats,srs,validation,schema,index}.ts`
- `libs/auth/src/{server,cookies,logout,auth,schema,index,email/transport,email/templates}.ts`
- `libs/db/src/connection.ts`
- `libs/utils/src/{logger,error-handler,ids}.ts`
- `libs/constants/src/{env,deployment,auth,study,dev,hosts}.ts`
- `scripts/db/seed-dev-users.ts`, `scripts/smoke/study-bc.ts`

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 3     |
| Minor    | 9     |
| Nit      | 6     |

Headline: the previously-critical FSRS `lastReview: null` bug is fixed (`libs/bc/study/src/reviews.ts:94` now passes `row.state.lastReviewedAt`, and `card_state` carries a `last_reviewed_at` column to back it). Transactions, FOR UPDATE locks, idempotency, and request-id correlation are in good shape. Remaining issues are around unauth pathing, a handful of narrow race/correctness gaps, and some minor logging/shutdown hygiene.

## Feature-level checklist against the spec

| Spec item                                                             | Status                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Card creation inside a tx with `study.card` + `study.card_state` seed | Done (`cards.ts:89-127`)                                           |
| Review flow: FSRS run + review insert + card_state upsert in one tx   | Done (`reviews.ts:62-144`)                                         |
| 5-second idempotency window for duplicate submits                     | Done, row lock first then dedupe query (`reviews.ts:65-84`)        |
| `CardNotFoundError` is a typed class callers can catch                | Done (`reviews.ts:48-56`, caught at `review/+page.server.ts:102`)  |
| Deterministic ~50 percent confidence sample                           | Done (`review/+page.server.ts:22-34`), djb2 on `cardId + dayKey`   |
| Dashboard read fan-out + streak computation                           | Done (`stats.ts:97-146`), UTC-day-keyed streak walk                |
| Cross-product read interfaces (mastery, domain breakdown, review)     | Exported (`index.ts:12-19`)                                        |
| Mastery threshold via constant                                        | Done (`MASTERY_STABILITY_DAYS` = 30 days)                          |
| Read interfaces scoped to user                                        | Done (every BC function takes `userId` and filters on it)          |

## Findings

### [Major] Unauth request on `(app)/memory/...` redirects to `/login` instead of calling `requireAuth`, losing `redirectTo`

**Files:**

- `apps/study/src/routes/(app)/memory/+page.server.ts:7-10`
- `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:26-27`, `:58-59`, `:107-108`
- `apps/study/src/routes/(app)/memory/browse/+page.server.ts:40-41`
- `apps/study/src/routes/(app)/memory/new/+page.server.ts:18-19` (load), `:30-32` (action)
- `apps/study/src/routes/(app)/memory/review/+page.server.ts:37-38`, `:65-66`

**Issue:** every (app) route re-implements the unauth check as `if (!user) redirect(302, ROUTES.LOGIN)`. The `(app)/+layout.server.ts` already calls `requireAuth(event)` which encodes `redirectTo=<pathname>` into the login URL. By short-circuiting in the child load/action with a bare redirect to `ROUTES.LOGIN`, we drop the `redirectTo` param on precisely the deep-link case it was designed for. Result: logging in after a redirect always drops the user on home instead of the memory page they were trying to reach.

The layout guard fires before the page load so this is mostly belt-and-suspenders today -- but for form actions, the layout does not re-run, so the inline check is load-bearing and the drop of `redirectTo` is observable (POST with expired session -> `/login` no context).

**Recommendation:** replace all the inline checks with `const user = requireAuth(event);`. One import from `@ab/auth`, consistent redirect target including `redirectTo`, and the load function stops accepting `null` user.

---

### [Major] `submitReview` idempotency window uses `reviewedAt >= windowStart` but action may be retried cross-session with stale card state

**File:** `libs/bc/study/src/reviews.ts:78-84`

**Issue:** the dedupe guard returns the most recent review within 5s if one exists. But the client may legitimately re-submit within 5s for a different card -- we already filter by `cardId`, so this is fine. The real concern: when the dedupe path fires, we return the **existing** review row without updating `card_state`. This is correct on the happy path (the first winner already upserted card_state). But if the first submit's transaction commits the review insert and then fails during the `card_state` update (e.g. connection drop), the next retry will see the review row, return early, and never re-apply the card_state update. The row lock (FOR UPDATE on card_state) makes a partial commit less likely, but the review insert and the state update are both inside the same tx -- if the tx fails, neither row persists, and if it succeeds, both do. So the corner case is effectively: "a review row exists without a matching card_state update" -> impossible under the current single-tx structure.

Provided the tx structure is kept (which this review recommends preserving), the dedupe is safe. Calling out explicitly so a later refactor that splits the two writes doesn't silently break idempotency.

**Recommendation:** add a unit test asserting "submitting twice within window returns first review and card_state reflects first result" and a code comment reiterating "both writes must stay inside the same tx to keep dedupe safe." No change needed today; guardrail for later.

---

### [Major] `getCard` and `updateCard` surface "not found" vs "not editable" via `.includes(...)` string match on error message

**Files:**

- `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:89-94`, `:119-121`
- `libs/bc/study/src/cards.ts:149-150`, `:255`

**Issue:** the route maps BC errors by substring (`err.message.includes('not editable')`, `err.message.includes('not found')`) to HTTP statuses 403/404. This is fragile: renaming the message in the BC will silently break the routing to a 500. Elsewhere in the BC we already have a typed error class (`CardNotFoundError`). The pattern exists; it's just not used for update/setStatus paths.

**Recommendation:** introduce `CardNotEditableError` in `reviews.ts` or a shared `errors.ts` in the BC, throw those from `updateCard` / `setCardStatus`, and catch by class in the route. Same for "card not found" in update/setStatus paths -- reuse `CardNotFoundError`. Ticket this as a follow-up rather than blocking; today's route code does not mis-classify known messages.

---

### [Minor] `login/+page.server.ts` forwards cookies even on `!authResponse.ok`

**File:** `apps/study/src/routes/login/+page.server.ts:47-57`

**Issue:** on a failed sign-in, better-auth may still emit CSRF or rate-limit cookies. We currently `return fail(...)` before `forwardAuthCookies`, so those cookies are dropped -- which is fine for security, but can interact with better-auth's CSRF rotation if it issues a fresh token on failure. Low risk today because the admin/magic-link plugins don't depend on returning those. Worth monitoring once the login page adopts signed double-submit or magic-link success flows.

**Recommendation:** consider forwarding cookies on any response that has `Set-Cookie` headers, regardless of success, but only when the value is not a session token. Simpler alternative: keep as-is and document.

---

### [Minor] `logout` action: if `auth.handler` throws, we still clear cookies -- correct -- but we do not redirect to `/login` with a flash

**File:** `apps/study/src/routes/(app)/logout/+page.server.ts:14-33`

**Issue:** silent-cleanup-on-failure is fine. But `log.error` fires with no `userId` in context (it is taken from `locals` but `locals.user` is not injected here). Add `userId: locals.user?.id` to the log context so a failed logout is traceable.

---

### [Minor] `auth` lazy init (`apps/study/src/lib/server/auth.ts`) short-circuits with `undefined` during `building`

**File:** `apps/study/src/lib/server/auth.ts:14-15`

**Issue:** `auth = building ? (undefined as ...) : getAuth()`. The `handle` hook already early-returns during `building`, so `auth.handler` is never called at build time from the hook. But any module that imports `$lib/server/auth` at top-level and eagerly calls `auth.handler` (e.g. in `login/+page.server.ts` or `logout/+page.server.ts`) will see `undefined` during prerender if SvelteKit ever prerenders those pages. Today none of those routes are prerendered, so the crash does not fire. Still, the type pretends `auth` is always a real `Auth` while the runtime knows otherwise -- a footgun.

**Recommendation:** replace with a lazy getter `export function getAuth()` or a `Proxy` that asserts not in building mode. Second best: annotate the type as `Auth | undefined` and assert in each caller. Lowest lift: add a `if (!auth) throw` at use sites.

---

### [Minor] `requireEnv(ENV_VARS.DATABASE_URL)` at module load can fail SvelteKit build

**File:** `libs/db/src/connection.ts:17`

**Issue:** this module throws on import if `DATABASE_URL` is unset. SvelteKit's build-time analysis imports every server module. The `auth.ts` guard (above) uses `building` to defer -- connection.ts does not. If `bun run build` runs in a context without a `.env` (e.g. CI running `check`), the build explodes at `vite build` time, not with a clean "missing env" error.

**Recommendation:** wrap the `postgres(...)` call behind a lazy singleton (`getDb()` / `getClient()`), or guard with SvelteKit's `building` check. The BC functions default to `db as defaultDb`; a lazy accessor keeps the BC call-sites untouched. Port the airboss-firc pattern if present.

---

### [Minor] `hooks.server.ts`: `handleError` creates a brand-new `errorHandler` per module load, not per request

**File:** `apps/study/src/hooks.server.ts:8`

**Issue:** `errorHandler = createErrorHandler({ logger: log })` at module scope is fine and efficient. But the `handleError` closure reads `event.locals.requestId` which may be undefined if `handle` threw before setting locals (e.g. during `building`, or if the auth path short-circuits). The fallback `event.locals.requestId ?? resolveRequestId(event.request)` mitigates. Sanity: covered.

One tidy-up: `event.locals.user?.id` in `handleError` can still be `null` (the type is `AuthUser | null`); `errorHandler`'s `userId` param accepts `string | null | undefined`, so safe -- but the logger's `userId ?? undefined` in prod mode collapses `null` to undefined. That is what we want. No action; call out for readers.

---

### [Minor] Streak computation window is 366 days hard-coded

**File:** `libs/bc/study/src/stats.ts:67-68`

**Issue:** `computeStreakDays` looks back 366 days. A user with a 400-day streak would have their streak truncated at 366. Today no user has more than a few months of data, so this is theoretical. Worth noting so it doesn't surprise someone a year from now. A self-extending scan (fetch oldest day, expand window if streak reaches the edge) is overkill; simplest fix is to bump the lookback to e.g. `5 * 365` and forget about it.

---

### [Minor] `getDomainBreakdown` and `getCardMastery` use string interpolation for `now.toISOString()` inside SQL fragments

**Files:**

- `libs/bc/study/src/stats.ts:158`, `:195`

**Issue:** `sql\`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)\`` -- Drizzle parameterizes `${...}` interpolations, so this is not a SQL injection risk. Side effect: the parameter is sent as a string, and Postgres implicitly casts to `timestamptz`. That cast is locale-/connection-dependent in some setups. Safer: use `sql\`... <= ${now}\`` (Drizzle serializes Date directly) or wrap in `sql\`${now}::timestamptz\``.

**Recommendation:** pass `now` (Date) directly, or cast explicitly. Belt-and-suspenders; current code works.

---

### [Minor] `getCards` does not paginate results of `search` query in a way that uses indexes

**File:** `libs/bc/study/src/cards.ts:222-226`

**Issue:** `ilike(card.front, pattern)` / `ilike(card.back, pattern)` scans without trigram support. There is no GIN/trigram index on `front`/`back`. Under a dev-scale deck this is fine; at 10k cards it will get slow. Noted here because it is the only non-indexed read path in the BC.

**Recommendation:** defer. Add a Phase 2 follow-up ticket: `CREATE INDEX ... USING gin (front gin_trgm_ops)` guarded behind an extension migration, or switch to tsvector with stemming.

---

### [Minor] `submitReview` `answerMs` coerces `null`/empty to `null`, but no upper bound

**Files:**

- `apps/study/src/routes/(app)/memory/review/+page.server.ts:78-79`, `:92`
- `libs/bc/study/src/validation.ts:61`

**Issue:** `answerMs: z.number().int().min(0).nullish()` has no upper bound. A malicious client could POST `answerMs: 2^52` and we'd store it. Not dangerous (Postgres `integer` range: -2,147,483,648 to 2,147,483,647), but we'd throw a DB error on overflow rather than a clean 400. Add `.max(3_600_000)` or similar (one-hour cap) to reject obviously nonsense values before hitting Postgres.

---

### [Minor] `seed-dev-users` deletes nothing when dev account already exists with mismatched profile

**File:** `scripts/db/seed-dev-users.ts:53-88`

**Issue:** if `DEV_ACCOUNTS` changes (e.g. role bumped from learner to admin), re-running the seed does not update the existing row. It reports `exists` and moves on. The "repair" path only fires when the user exists but the credential account does not.

**Recommendation:** when `existingUser[0]` is present, upsert name/role/firstName/lastName/emailVerified to the current constant values. Idempotency then covers "constant changed" as well as "user missing."

---

### [Nit] `hooks.server.ts` logs every response including 2xx as `info` level

**File:** `apps/study/src/hooks.server.ts:109-113`

**Issue:** one log line per request is standard for access logs, but it ships through the structured logger and floods production logs. Consider `level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'` and emitting at `debug` for successful static-asset fetches. Low urgency -- at current scale, fine.

---

### [Nit] `resolveRequestId` regex `^[a-zA-Z0-9_-]{1,64}$` is stricter than W3C trace spec

**File:** `apps/study/src/hooks.server.ts:10`

**Issue:** fine for the current internal use. If we ever integrate with OTEL / W3C traceparent, relax to allow `.` and `/`.

---

### [Nit] `srs.ts` keeps a shared `defaultScheduler` -- stateless per ts-fsrs contract

**File:** `libs/bc/study/src/srs.ts:67-75`

**Issue:** the comment "Shared default FSRS instance. Stateless; safe for concurrent use." is correct (verified against ts-fsrs sources -- `fsrs()` returns a pure function wrapper around the parameters). Worth adding a vitest assertion that two concurrent `.next(...)` calls with different cards don't leak state between them. Lightweight test; guards against a future ts-fsrs upgrade that accidentally introduces caching.

---

### [Nit] `escapeLikePattern` defined locally in `cards.ts` and also exported from `@ab/db/escape`

**Files:**

- `libs/bc/study/src/cards.ts:68-70`
- `libs/db/src/escape.ts` (exported via `@ab/db/index.ts`)

**Issue:** two copies drift over time. Use the shared one.

---

### [Nit] `logout/+page.server.ts`: `new Request(...)` uses `AUTH_INTERNAL_ORIGIN = http://localhost` (no port)

**File:** `libs/constants/src/hosts.ts:8`, used at `apps/study/src/routes/(app)/logout/+page.server.ts:17`

**Issue:** the "internal origin" for the sign-out round-trip is `http://localhost` with no port. Better-auth's handler does not care (we call it directly, not over HTTP), but the resulting `Request.url` is `http://localhost/api/auth/sign-out` which is surprising in logs. Consider setting to something unambiguous (e.g. `http://auth.internal`) so log grep does not confuse it with a real local request.

---

### [Nit] `seed-dev-users.ts` imports from relative paths (`../../libs/...`) instead of `@ab/*`

**File:** `scripts/db/seed-dev-users.ts:16-26`

**Issue:** CLAUDE.md rule: "cross-lib imports use `@ab/*` aliases, never relative paths." Scripts at `scripts/` are outside the apps folder but the rule applies. `scripts/smoke/study-bc.ts` has the same issue (`:14-26`). If tsconfig paths aren't wired for the scripts folder, wire them; the alternative of suppressing the rule just for scripts is a known-issue per the Prime Directive.

## Cross-cutting observations

- Transactions: both hot-path writes (`createCard`, `submitReview`) use `db.transaction(async (tx) => { ... })`. Good.
- FOR UPDATE lock: `reviews.ts:70` locks the `card_state` row before the idempotency query and before the insert. Correct ordering -- any concurrent submit blocks on the lock, then sees the first submit's review row.
- `CardNotFoundError` is the only typed BC error today. Expanding this pattern (major finding above) would eliminate all the substring-match error routing.
- Logging: structured JSON in prod, pretty in dev. `requestId` threaded through via `locals`. No secrets in log payloads that I can see -- the one risk area was `login/+page.server.ts:62` which logs `metadata: { email }` on failure; that is PII but not secret, and is the standard convention. Not flagged.
- Auth: `requireAuth` / `requireRole` throw SvelteKit redirect/error -- correct pattern. Banned-user guard at `hooks.server.ts:90` returns `403` (no redirect to a ban page); matches spec behavior.
- Cookies: `forwardAuthCookies` handles URL-decoding and expiring cookies; `clearSessionCookies` is idempotent; both branches run on sign-out. Good.
- DB pool: `libs/db/src/connection.ts` installs SIGTERM/SIGINT handlers, drains with a 30s hard timeout, `process.exit(0)` on success. Correct shape. One caveat: in SvelteKit dev HMR, these handlers may be re-registered on every module reload. Node deduplicates by reference, and our handler is a fresh closure each reload, so you can end up with N handlers. Not harmful in dev; worth documenting.
- FSRS wrapper: `CardSchedulerState` now carries `lastReview` and `reviewCount`/`lapseCount`. The scheduler is stateless; the DB-facing state is carried in `study.card_state`. Matches design.
- Confidence sampling: djb2 hash on `${cardId}:${dayKey}`, deterministic, UTC day boundary. Same user on same card same day always gets the same prompt decision. Correct per spec. `CONFIDENCE_SAMPLE_RATE = 0.5`.

## Recommendations (priority-ordered)

1. Swap the inline `if (!user) redirect(302, ROUTES.LOGIN)` for `const user = requireAuth(event)` across every (app) load and action. One-line change per route; preserves `redirectTo` and unifies behavior.
2. Introduce typed errors for `updateCard` and `setCardStatus` (`CardNotFoundError`, `CardNotEditableError`). Remove substring-match error routing in `[id]/+page.server.ts`.
3. Guard `connection.ts` with `building` or switch to a lazy accessor so prerender/build does not require a live `DATABASE_URL`.
4. Change `auth` export to a lazy getter or proxy; drop the `undefined as unknown as Auth` sleight of hand.
5. Add an upper bound to `answerMs` in `validation.ts`.
6. Seed script: refresh existing user rows from `DEV_ACCOUNTS` on every run, not only the credential account.
7. Add a shared `escapeLikePattern` import from `@ab/db` in `cards.ts`; delete the local copy.
8. Expand `seed-dev-users.ts` and `scripts/smoke/study-bc.ts` to use `@ab/*` aliases.

## Summary of spec conformance

| Area                    | Conformance                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Card creation tx        | Yes -- `cards.ts:89`                                                                                      |
| Card editing gate       | Yes -- `isEditable` check at `cards.ts:150`                                                               |
| Browse filters          | Yes -- `browse/+page.server.ts` narrows all filter params against constant value sets                     |
| Review batch (20 cards) | Yes -- `REVIEW_BATCH_SIZE` used in `getDueCards`                                                          |
| FSRS state transitions  | Yes -- `CARD_STATES` mapped to ts-fsrs `State`, round-trip preserved                                      |
| 5s idempotency          | Yes -- `REVIEW_DEDUPE_WINDOW_MS = 5_000`, row-locked                                                      |
| Confidence sampling     | Yes -- deterministic, 50 percent, day-keyed                                                               |
| Dashboard stats         | Yes -- dueNow, reviewedToday, streakDays, stateCounts, domains                                            |
| Read interfaces         | Yes -- `getCardMastery`, `getReviewStats`, `getDomainBreakdown`                                           |
| Edge: card deleted mid-review | Yes -- `CardNotFoundError` caught in `review/+page.server.ts`, `skipped: true` returned                   |
| Edge: confidence declined     | Yes -- nullable in schema and validation                                                                   |
| Edge: new card (no reviews)   | Yes -- `fsrsInitialState` seeds `card_state`                                                              |

Backend is in solid shape. No critical issues. Address the two Majors around unauth handling and typed errors before the next review pass; the rest can ride as follow-up tickets.
