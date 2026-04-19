---
title: 'Final Security Review: spaced-memory-items'
date: 2026-04-19
phase: final
category: security
branch: build/spaced-memory-items
base: docs/initial-migration
reviewer: security
status: unread
review_status: done
---

# Final Security Review: spaced-memory-items

Scope: `git diff docs/initial-migration..HEAD` on branch `build/spaced-memory-items`. Feature is spaced repetition (cards, reviews, dashboards, auth scaffolding). Focus: auth, authorization, injection, XSS, CSRF, secret handling, data isolation, idempotency.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 1     |
| Minor    | 6     |
| Nit      | 3     |

No critical findings. Phase 0 Major issues (open-redirect backslash, seed prod-guard, email HTML escaping, error disclosure on login) are all fixed and verified. Remaining findings are defense-in-depth and operational hardening.

## Findings

### [Major] No production `baseURL` override for better-auth -- CSRF trustedOrigins defaults to `http://localhost:$PORT`

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/lib/server/auth.ts:11`, `/Users/joshua/src/_me/aviation/airboss/libs/auth/src/server.ts:29-33`

**Issue:** `createAuth({ secret, isDev: dev })` is called without a `baseURL`, so `createAuth` falls back to `http://localhost:${PORTS.STUDY}`. better-auth uses `baseURL` as the default trusted origin for CSRF / fetch-metadata checks and for constructing absolute URLs in email links (magic-link, verification, password reset).

In production, this means:

1. CSRF origin checks on `/api/auth/*` will compare the `Origin`/`Referer` against `http://localhost:PORT` -- any legitimate prod request fails. better-auth does degrade to using the incoming `x-forwarded-host` in some paths, but this is deployment-dependent and fragile.
2. Magic-link / password-reset / verification emails will embed URLs pointing at `http://localhost:...`, which are unreachable for the user.

This was flagged as an operational concern in Phase 0 "Clean" notes; no fix has landed. Because the feature ships with auth wired through the app layer, a prod deploy without an override is a functional break (sign-in will 403 or redirect to localhost) and a security posture regression (trustedOrigins drift between environments is historically a source of CSRF bypass CVEs in better-auth when operators try to work around it with `trustedOrigins: ['*']`).

**Impact:** Production deploy will either break sign-in entirely or force an insecure workaround. Not an immediate vulnerability on the feature branch, but blocks safe release.

**Fix:** Require an explicit `BETTER_AUTH_URL` env var and pass it through:

```typescript
// apps/study/src/lib/server/auth.ts
const baseURL = process.env[ENV_VARS.BETTER_AUTH_URL];
if (!baseURL && !dev) throw new Error('BETTER_AUTH_URL required in production');
return createAuth({ secret, baseURL, isDev: dev });
```

Add `BETTER_AUTH_URL` to `ENV_VARS` in `libs/constants/src/env.ts`. In `createAuth`, also set `trustedOrigins: [baseURL, `https://${HOSTS.STUDY_PROD}`]` explicitly so the CSRF allowlist is pinned rather than inferred.

---

### [Minor] `hooks.server.ts` session lookup runs on every request, including static assets

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts:51-88`

**Issue:** Non-`/api/auth/*` requests always call `auth.api.getSession({ headers })`, which hits `bauth_session` in Postgres. There is no short-circuit for `/_app/*`, `/static/*`, `favicon.ico`, etc. SvelteKit's adapter-node serves `/_app/*` through the same handle chain, so every asset fetch costs one session query.

Because the connection pool defaults to 10 connections (`DB_POOL_SIZE`), a concurrent user can easily saturate the pool just loading a page with many small assets.

**Impact:** DoS amplification (one HTTP asset request -> one DB roundtrip). This was flagged in Phase 0 and not fixed. Combined with no edge rate-limiting, a single attacker can exhaust the pool by hammering a static path that forces SvelteKit's handle chain.

**Fix:** Skip session hydration for static/asset prefixes:

```typescript
if (
  event.url.pathname.startsWith('/_app/') ||
  event.url.pathname.startsWith('/favicon') ||
  event.url.pathname === '/robots.txt'
) {
  return resolve(event);
}
```

And consider a short in-memory LRU session cache keyed by cookie token (e.g., 30s TTL) if DB load becomes noticeable.

---

### [Minor] Review-history query on card detail page filters by `cardId` only, not `(cardId, userId)`

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts:32-47`

**Issue:** After the `getCard(params.id, user.id)` ownership check succeeds, the "Recent reviews" query is:

```typescript
const recentReviews = await db
  .select({ ... })
  .from(review)
  .where(eq(review.cardId, params.id))
  .orderBy(desc(review.reviewedAt))
  .limit(10);
```

No `eq(review.userId, user.id)` predicate. Today this is equivalent to a user-scoped query because `submitReview` only inserts rows where `review.userId == card.userId` (enforced by the transaction that joins `card` and `cardState` on userId before writing). So for any given card, all reviews belong to that card's single owner.

But this is an invariant enforced by application code, not by the schema. A schema-level leak path would be: a future migration, a script like `scripts/smoke/study-bc.ts`, or a future shared-deck feature that inserts a review for a different user's card. Defense-in-depth says the query should still carry the userId predicate so an invariant violation does not become a data-disclosure bug.

**Impact:** No leak today. A future change that breaks the review.userId == card.userId invariant becomes a cross-user review history disclosure.

**Fix:** Add the predicate:

```typescript
.where(and(eq(review.cardId, params.id), eq(review.userId, user.id)))
```

Same pattern applies anywhere reviews are queried by cardId without userId.

---

### [Minor] Dev credentials (`DEV_PASSWORD`, `DEV_ACCOUNTS`) live in shared `@ab/constants` and are imported by client code

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/constants/src/dev.ts:4-9`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.svelte:2,19,82,89`

**Issue:** `DEV_PASSWORD = 'Pa33word!'` and `DEV_ACCOUNTS` (with `joshua@ball.dev` admin) are exported from `libs/constants/src/index.ts` and imported at module scope by `+page.svelte`. The UI that uses them is gated by `{#if dev}` (which Vite can inline to `false` in prod builds), but the module-scope `import` and `fillDevAccount` function reference `DEV_PASSWORD` lexically. Vite/Rollup tree-shaking usually drops this in prod, but it depends on Rollup's ability to prove the references are only reachable from the dead `{#if dev}` block.

This was flagged in Phase 0; the fix suggested isolating dev UI into a separately-imported component. That has not happened.

**Impact:** If DCE fails (future Svelte/Vite upgrade, a refactor that moves `fillDevAccount` out of the dev block, etc.), the prod client bundle ships with the admin email and literal password. Combined with any production DB that has been seeded, this is a credential leak path.

**Fix:** Extract the dev login panel into its own component and dynamic-import it:

```typescript
// +page.svelte
let DevLoginPanel = $state<typeof import('./DevLoginPanel.svelte').default | null>(null);
$effect(() => {
  if (dev) {
    import('./DevLoginPanel.svelte').then((m) => (DevLoginPanel = m.default));
  }
});
```

And move `DEV_PASSWORD`/`DEV_ACCOUNTS` out of the shared constants module into a `libs/constants/src/dev.server.ts` that is only imported from server code (seed script, tests) -- never from Svelte components. Verify via `grep -r 'Pa33word' .svelte-kit/output/client` in CI.

---

### [Minor] Banned-user guard is skipped for `/api/auth/*` endpoints

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts:37-50,90-99`

**Issue:** The handle function short-circuits on `isAuthPath(...)` and calls `auth.handler(request)` without ever hydrating `event.locals.user` or running the `banned` check. The comment justifies this as "better-auth rejects banned users at session-creation time and sign-out must remain callable" -- which is true, but the short-circuit also skips `/api/auth/get-session`, `/api/auth/list-sessions`, `/api/auth/update-user`, `/api/auth/change-email`, etc. A banned user with a still-valid session cookie can hit these.

better-auth's admin plugin calls `revokeSessions` when a ban is set, so in practice the session is dead before the banned user can re-enter. But this is a trust-the-library assumption, and the admin plugin's behavior depends on the order of operations (a session created between `banUser` and `revokeSessions` slips through).

**Impact:** Low. Requires a banned user who has an active session that was not revoked. The accessible endpoints are mostly read-only user-info endpoints.

**Fix:** Either hydrate session + run the banned check before the `isAuthPath` short-circuit, or explicitly whitelist only the sign-in/sign-up/sign-out/callback subset for the short-circuit and run full hydration for everything else.

---

### [Minor] Login error uses `err.message` pattern for form errors

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/new/+page.server.ts:86-99`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts:87-101`

**Issue:** The memory form actions branch on `err.message.startsWith('source_ref')` / `err.message.includes('not editable')` / `err.message.includes('not found')` to map BC errors to specific HTTP responses. This is stringly-typed error dispatch:

```typescript
if (err instanceof Error && err.message.includes('not editable')) {
  return fail(403, { ... });
}
if (err instanceof Error && err.message.includes('not found')) {
  error(404, { message: 'Card not found' });
}
```

Any future BC error whose message happens to contain "not found" (e.g., a DB connection error with "relation not found") would be mapped to a 404 and swallow the real issue. More importantly, the match is fragile: changing the BC's error text silently breaks the route's error handling.

**Impact:** Not a direct vulnerability. Operational / correctness hazard that can mask real failures (a DB error presented as a 404) and makes the error classification unreliable for audit logging.

**Fix:** Use typed error classes, the same way `reviews.ts` uses `CardNotFoundError`. Add `CardNotEditableError`, `CardSourceRefRequiredError` to `libs/bc/study/src/cards.ts`, export them, and `instanceof`-check in routes. This also removes the need for the `.includes` / `.startsWith` fragility.

---

### [Minor] `x-request-id` is trusted in pretty-mode logs (log forgery)

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts:10-16`, `/Users/joshua/src/_me/aviation/airboss/libs/utils/src/logger.ts:37-43`

**Issue:** Partially fixed in Phase 0. The current regex is `^[a-zA-Z0-9_-]{1,64}$`, which blocks CR/LF. Good. But in `formatPretty`, `msg`, `ctx.userId`, and `metadata` values are still interpolated without sanitization. A card's title, a domain slug, or any metadata field passed to `log.info` can contain control characters that forge log lines when a user-controlled string flows into the log message.

Prod mode uses `JSON.stringify` (safe), so this is dev-only. The requestId fix alone is not sufficient if other fields are interpolated raw.

**Impact:** Log forgery in dev-mode logs only. Not prod-impacting because prod is JSON.

**Fix:** Either route all dev logging through `JSON.stringify` for anything user-controlled, or strip control chars (`\r\n\0`) from string values before interpolation in `formatPretty`. Acceptable to defer -- low severity.

---

### [Minor] PII in error logs: login action logs the attempted email

**File:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts:60-65`

**Issue:** When login throws, `log.error('login handler threw', { requestId: locals.requestId, metadata: { email } }, err)` logs the submitted email. An attacker probing login with enumerated emails (e.g., a password spray detection bypass attempt) plants arbitrary email strings in production logs. Not a credential leak, but:

1. PII (email addresses) in server logs expand the blast radius of a log leak.
2. Log aggregators (Datadog, Loki) typically have lower access controls than the auth DB, and log retention may exceed user-data retention requirements.

**Impact:** Low. PII exposure via log pipeline.

**Fix:** Log a hash of the email (e.g., first 8 chars of SHA-256) rather than the raw value, or just log `{ emailDomain: email.split('@')[1] }` to retain debug value without PII:

```typescript
log.error('login handler threw', {
  requestId: locals.requestId,
  metadata: { emailDomain: email.includes('@') ? email.split('@')[1] : 'invalid' },
}, err);
```

---

### [Nit] `AUTH_INTERNAL_ORIGIN` is hardcoded to `http://localhost` -- fine today, flag for future

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/constants/src/hosts.ts:8`, used in `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts:40`

**Issue:** `AUTH_INTERNAL_ORIGIN = 'http://localhost'` is used to construct the internal `Request` sent to `auth.handler` from the login / logout form actions. Because `auth.handler` only reads the path and body of the Request, the origin doesn't matter for functionality -- but it does matter for better-auth's origin/CSRF checks, which inspect the `origin` of the incoming Request.

With `baseURL = http://localhost:PORT` (same as Major finding above), the internal Request origin matches the trusted origin, so CSRF passes. In prod, when `baseURL` is set to the real prod URL, this internal Request origin will NOT match and better-auth will 403 the server-side call.

**Impact:** Couples the Major baseURL finding to an additional prod failure mode. Login / logout form actions will stop working in prod once baseURL is fixed, unless `AUTH_INTERNAL_ORIGIN` is also updated to match.

**Fix:** When fixing the Major `baseURL` issue, derive `AUTH_INTERNAL_ORIGIN` from the same `BETTER_AUTH_URL`, or add the internal origin to `trustedOrigins`. Alternatively, call `auth.api.signInEmail(...)` directly instead of going through `auth.handler` with a constructed Request -- cleaner and avoids the origin dance entirely.

---

### [Nit] `MIN_PASSWORD_LENGTH` is defined but never used

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/constants/src/identity.ts:9`

**Issue:** `MIN_PASSWORD_LENGTH = 8` is exported but no code references it. Password length policy is delegated entirely to better-auth defaults (which the `emailAndPassword` config does not override -- better-auth defaults to minPasswordLength 8, maxPasswordLength 128).

Not a security gap today, but the constant suggests an intent to enforce a policy that is not actually wired through. A future dev might add validation against this constant while better-auth silently enforces a different rule.

**Impact:** None. Dead constant.

**Fix:** Either wire it through `betterAuth({ emailAndPassword: { minPasswordLength: MIN_PASSWORD_LENGTH, ... } })` and any custom form validation, or delete the constant.

---

### [Nit] Seed script imports from relative paths, bypassing the `@ab/*` alias convention

**File:** `/Users/joshua/src/_me/aviation/airboss/scripts/db/seed-dev-users.ts:16-26`

**Issue:** The seed script uses `../../libs/auth/src/schema`, `../../libs/constants/src/index`, `../../libs/utils/src/ids` instead of `@ab/auth/schema`, `@ab/constants`, `@ab/utils`. Same for `scripts/smoke/study-bc.ts`. This violates the project's import rule (`docs/platform/CLAUDE.md` -> "Always use `@ab/*` path aliases for cross-lib imports").

Not a security issue, but inconsistency raises audit friction: a reader can't tell at a glance whether the seed script is importing the same module the app is using, or a stale copy.

**Impact:** None security-wise. Consistency / maintainability nit.

**Fix:** Configure `tsconfig.json` to resolve `@ab/*` for scripts, or drop the aliases entirely for script-level imports. Pick one pattern.

## Clean

Reviewed and found clean / confirmed fixed since Phase 0:

- **Open-redirect via backslash-prefixed `redirectTo`** -- fixed. `isSafeRedirect` at `apps/study/src/routes/login/+page.server.ts:11-19` rejects `/\`, `//`, `\r`, `\n`. Also good: `!path.startsWith('/')` catches scheme-relative and absolute URLs.
- **Seed script production guard** -- fixed. `scripts/db/seed-dev-users.ts:31-35` refuses unless `!isProd() && DEV_DB_HOST_PATTERN.test(connectionString)`. Pattern is `@(localhost|127\.0\.0\.1|airboss-db)(:|\/)` -- correctly pinned to loopback / OrbStack hostnames.
- **Login error disclosure** -- fixed. `apps/study/src/routes/login/+page.server.ts:58-66` returns the generic `'Sign-in failed, please try again'` and logs the raw error server-side only. Details never reach the browser.
- **Email HTML escaping** -- fixed. `libs/auth/src/email/templates.ts:7-14` defines `escapeHtml` and applies it to `name` and `url` in both button HTML and body text. Protects against email-side HTML injection from user-controlled `name` values.
- **Logout cookie clearing on auth-handler failure** -- fixed. `apps/study/src/routes/(app)/logout/+page.server.ts:15-32` wraps `auth.handler` in try/catch and always runs `clearSessionCookies(cookies)` + `redirect(303, ROUTES.LOGIN)` afterward. Fail-closed.
- **Cookie forwarding resilience** -- fixed. `libs/auth/src/cookies.ts:23-30` catches `decodeURIComponent` errors and falls back to the raw cookie value. No longer 500s on malformed percent-escapes.
- **`/api/auth*` prefix-bypass** -- fixed. `apps/study/src/hooks.server.ts:18-20` uses strict `pathname === ROUTES.API_AUTH || pathname.startsWith(`${ROUTES.API_AUTH}/`)`. No longer matches `/api/authorize`.
- **Authorization on every BC function** -- confirmed. `createCard`, `updateCard`, `getCard`, `getCards`, `setCardStatus`, `submitReview`, `getDueCards`, and every stats function accept a `userId` parameter and include `eq(card.userId, userId)` / `eq(cardState.userId, userId)` / `eq(review.userId, userId)` in their WHERE clauses. Inner joins between `card` and `cardState` also include `eq(card.userId, cardState.userId)`, preventing a stray row from leaking via a mismatched join.
- **Authorization on every route action** -- confirmed. Every `+page.server.ts` under `(app)/memory/` calls `requireAuth(event)` or redirects to `ROUTES.LOGIN` if `locals.user` is null. The `(app)/+layout.server.ts` also runs `requireAuth` at the group level -- belt and braces.
- **Direct-object reference protection** -- confirmed. Card ID is a URL param (`params.id`), but `getCard(params.id, user.id)` enforces ownership in the same query. Attempting to fetch another user's card returns null -> 404, not the card. Same for `updateCard`, `setCardStatus`. Cross-user edit / status change is not reachable.
- **Review history user isolation** -- confirmed at BC level. `submitReview` locks `card_state` `FOR UPDATE` with `eq(cardState.userId, input.userId)` before writing, and `getDueCards` / stats queries all carry explicit userId predicates. (See Minor finding above about the one missing predicate on the detail-page query.)
- **SQL injection surface** -- clean. All queries go through Drizzle's parameterized builder. The raw `sql\`...\`` templates in `libs/bc/study/src/stats.ts` (lines 71, 158, 159, 195, 196, 205) only interpolate Drizzle column references and trusted constants (`MASTERY_STABILITY_DAYS`, `REVIEW_RATINGS.AGAIN`, `now.toISOString()` from `new Date()`, not user input). Drizzle's `sql` template binds `${value}` as parameters, not as literal SQL. No user-controlled value flows into raw SQL anywhere.
- **CHECK constraint `sql.raw` usage** -- `libs/bc/study/src/schema.ts:42-44` uses `sql.raw(...)` for enum CHECK constraints, but the input is `inList(CARD_TYPE_VALUES)` where values come from compile-time `as const` arrays and are additionally hand-escaped for single quotes via `v.replace(/'/g, "''")`. No user input reaches `sql.raw`.
- **LIKE/ILIKE injection** -- clean. `cards.ts:68-70` defines `escapeLikePattern` that escapes `\`, `%`, `_`. `getCards` applies it before building the `%pattern%` wrapper. A search for `100%` does not match every card.
- **Input validation -- cards** -- clean. `libs/bc/study/src/validation.ts` defines zod schemas (`newCardSchema`, `updateCardSchema`, `submitReviewSchema`) with `min(1).max(10_000)` on front/back, `max(20)` on tags, enum membership checks for domain/cardType/sourceType, integer + range checks for rating (1-4) and confidence (1-5). BC functions also re-parse via zod before DB write (defense-in-depth), so a script bypassing the route still hits validation.
- **Idempotency + transaction on submitReview** -- clean. `libs/bc/study/src/reviews.ts:58-145` runs the entire read-modify-write in `db.transaction`, locks the `card_state` row `FOR UPDATE`, and returns the existing review if one exists within `REVIEW_DEDUPE_WINDOW_MS` (5s). Concurrent rapid submits serialize on the row lock and the second caller sees the first's committed row. No double-write, no split-brain between `review` insert and `card_state` update.
- **Session cookie flags** -- correct. `libs/auth/src/cookies.ts:12-21` sets `httpOnly: true`, `sameSite: 'lax'`, `secure: !isDev`, `path: '/'`, `maxAge: SESSION_MAX_AGE_SECONDS` (7 days), `domain: '.airboss.test'` or `.air-boss.org`. Cross-subdomain cookies correctly scoped with leading-dot domains. `SESSION_DATA` cookie also cleared on logout alongside `SESSION_TOKEN`.
- **CSRF on form actions** -- covered. SvelteKit enables origin checks on POST form actions by default (no `csrf: false` override anywhere in config). better-auth applies its own origin / fetch-metadata checks on `/api/auth/*`. Both layers stack.
- **XSS in rendered card content** -- clean. `{card.front}`, `{card.back}`, `{card.tags}` are rendered via Svelte text interpolation (HTML-escaped). `{card.front.slice(0, 60)}` in `<title>` is also text-interpolated. No `{@html ...}` usage on user-supplied content. Tags are rendered as individual `<span>` text nodes.
- **XSS in email templates** -- clean (post Phase 0 fix). `escapeHtml` is applied to `name` and `url` in all three email templates.
- **Error disclosure to client** -- clean. `createErrorHandler` returns only `safeMessageForStatus(status)` + `requestId`; raw error details are logged server-side. Form action `fail()` responses return static strings (`'Could not save the card. Please try again.'`, `'Could not save changes.'`, etc.) rather than `err.message`.
- **BETTER_AUTH_SECRET handling** -- clean. `apps/study/src/lib/server/auth.ts:6-9` requires the env var, throws at startup if missing, never logs it.
- **DATABASE_URL handling** -- clean. `libs/db/src/connection.ts:17` uses `requireEnv(ENV_VARS.DATABASE_URL)` -- no dev fallback at the app layer (the dev fallback is scoped to the seed script only). Never logged.
- **RESEND_API_KEY handling** -- clean. `libs/auth/src/email/transport.ts:9-15` reads on first use and caches a single Resend client. Absent key logs a no-op message and returns true so the auth flow continues. The key itself is never logged.
- **Password hashing** -- delegated to better-auth's scrypt via `hashPassword` in the seed script. No plaintext storage, per-call salts.
- **Email enumeration on login** -- better-auth returns `INVALID_EMAIL_OR_PASSWORD` for both unknown user and wrong password, and hashes the provided password even when the user does not exist (tested against better-auth v1.x source).
- **Self-signup role elevation** -- better-auth's admin plugin marks `role`, `banned`, `banReason`, `banExpires` as `input: false`. Signup bodies that try to set these are rejected with `FIELD_NOT_ALLOWED`. `defaultRole: ROLES.LEARNER` cannot be overridden via client input.
- **ID generation** -- `generateCardId`, `generateReviewId`, `generateAuthId` all use `ulidx`'s ULID (80 bits of randomness). Lowercased for consistency. No predictable sequencing.
- **DB pool shutdown** -- `libs/db/src/connection.ts:29-54` drains the pool on SIGTERM/SIGINT with a 30s timeout, logs drain errors, exits cleanly. No secret leak in shutdown path.
- **Cross-lib import hygiene in app/lib** -- BC functions use `@ab/*` aliases. The two script files (Nit above) are the only exception.
- **Redirect targets on form success** -- all redirects go to a `ROUTES.*` constant or `ROUTES.MEMORY_CARD(created.id)` where `created.id` is a ULID-prefixed server-generated value (no user control over the redirect path).
- **Review submission authorization** -- confirmed. `submitReview` requires `cardId` + `userId` match an existing `(card_state)` row via the locked SELECT; otherwise throws `CardNotFoundError`. A user cannot submit a review for another user's card even if they guess the card ID, because the join `eq(card.userId, cardState.userId)` + `eq(cardState.userId, input.userId)` fails.
- **Route parameter handling** -- `params.id` is passed directly to BC functions, which parameterize it via Drizzle. ULID format is not validated at the route, but a non-matching string returns null -> 404, which is correct behavior.
- **`setCardStatus` validation** -- the route checks `CARD_STATUS_VALUES.includes(target)` before calling the BC (`routes/(app)/memory/[id]/+page.server.ts:112-114`), preventing invalid status values from reaching the DB. The BC function also relies on the CHECK constraint as a final guard.
- **Drizzle query builder usage** -- no `.execute(sql\`...\`)` with user input anywhere in the diff. All user-controlled values flow through `eq`, `ilike`, `and`, `or`, `inArray`, `lte`, `gte`, `gt` which parameterize automatically.
