---
title: 'Phase 0 Backend Review: spaced-memory-items'
date: 2026-04-19
phase: 0
category: backend
---

# Phase 0 Backend Review

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 1     |
| Major    | 4     |
| Minor    | 7     |
| Nit      | 4     |

## Findings

### [CRITICAL] `/api/auth` handler response is returned without awaiting

**File:** apps/study/src/hooks.server.ts:17-20
**Issue:** `auth.handler(event.request)` is async (returns `Promise<Response>`), but the code assigns it to `response` without `await`. Because the outer `handle` function is declared `async`, returning a Promise inside it is equivalent to awaiting it, so SvelteKit will still see a resolved Response at the end. That part is fine in isolation. The real problem is that `handle` is `async` and has already captured `start = performance.now()` at line 15 -- but the early return bypasses the request-logging call entirely. That is intentional per the code comment, but it also means errors thrown inside `auth.handler` propagate through the async wrapper without the banned-user guard, logger context, or request-id header being attached. More importantly, because the response body is never consumed and `auth.handler` may internally hold open DB connections until the response stream is actually read by the client, any synchronous exception in `auth.handler` (e.g. DB down at boot) will surface as a bare SvelteKit 500 with no structured log line. Compare with the pattern in airboss-firc/apps/sim/src/hooks.server.ts: identical bug, so it was inherited as-is rather than introduced here, but the port should not propagate the defect.
**Impact:** Any error on `/api/auth/*` (login, sign-out, magic-link callback) surfaces as a generic 500 with no logger output. In production this means auth failures are effectively invisible.
**Fix:** Wrap the auth handler in a try/catch (or at minimum `await` the result so `handleError` can attribute the failure):

```typescript
if (event.url.pathname.startsWith(ROUTES.API_AUTH)) {
  try {
    return await auth.handler(event.request);
  } catch (err) {
    log.error('auth handler failed', { path: event.url.pathname }, err instanceof Error ? err : undefined);
    throw err;
  }
}
```

Also consider whether the request-log info line should run on the auth path -- right now `/api/auth/*` requests are invisible in server logs.

### [MAJOR] `building` escape hatch in `auth.ts` returns `undefined as unknown as Auth`

**File:** apps/study/src/lib/server/auth.ts:15
**Issue:** During SvelteKit build analysis (`svelte-kit sync`, prerender pass, or `bun run build`), any code path that imports `$lib/server/auth` and reaches `auth.api.getSession` or `auth.handler` will call a method on `undefined` and throw `TypeError: Cannot read properties of undefined (reading 'api')`. Right now that is OK because no load function prerenders while reading the session. But the hook itself is still executed during `vite build` for any route with prerender enabled (prerender invokes `handle`). If anyone adds `export const prerender = true` to a page under `(app)/` or any route that hits the hook, the build will crash with an opaque TypeError.
**Impact:** Latent footgun. The first developer to try prerendering a public page (e.g. a marketing landing page) will get a confusing crash at build time.
**Fix:** Either (a) guard the hook so it no-ops during `building`:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  if (building) return resolve(event);
  // ...
};
```

or (b) return a typed stub from `auth.ts` that throws with a clear message: `new Proxy({}, { get() { throw new Error('auth accessed during build'); } })`. The Proxy stub is more defensive and will surface the exact call site if it ever fires.

### [MAJOR] `auth.api.getSession` not caught on transient DB failure

**File:** apps/study/src/hooks.server.ts:22-24
**Issue:** `getSession` performs a DB query. If the DB pool is saturated or the connection is lost, it throws. The hook has no try/catch, so the error propagates to `handleError`. That is technically fine -- the error is logged -- but every request will fail with a 500 even though an unauthenticated user could reasonably still see public routes (e.g. `/login`). A DB blip during login therefore cascades into "the whole site is down" instead of "already-authenticated users see an error, anonymous users can still reach /login."
**Impact:** Poor degradation: DB flap blocks anonymous users from reaching `/login` to re-authenticate.
**Fix:** Wrap in try/catch, log, and fall through with `session = null` / `user = null`:

```typescript
let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
try {
  session = await auth.api.getSession({ headers: event.request.headers });
} catch (err) {
  log.error('session lookup failed', { path: event.url.pathname }, err instanceof Error ? err : undefined);
}
```

### [MAJOR] Seed script shares `hashPassword` scrypt output across users

**File:** scripts/db/seed-dev-users.ts:25, 50-58
**Issue:** `hashPassword(DEV_PASSWORD)` is called once at the top of the loop, then the resulting hash string is written into every dev user's `bauthAccount.password`. The review question asks whether scrypt's random salt makes this OK because the output is unique per call. It would be -- if `hashPassword` were called per user. It is not. Both users in `DEV_ACCOUNTS` share the exact same hashed password row value. This is functionally correct (login works for both) but leaks a property: an attacker (or a developer peeking at the DB) can see that two accounts have identical hashes, which implies identical plaintexts. For a dev-only seed with a well-known password this is harmless, but the pattern is trap-laden: if this script is ever adapted for non-dev seeding (e.g. demo tenants), it will silently produce correlated password hashes.
**Impact:** Latent privacy/security anti-pattern. Harmless for current dev-only use, but would be a real leak if reused.
**Fix:** Move the `hashPassword` call inside the loop:

```typescript
for (const account of DEV_ACCOUNTS) {
  // ...
  if (!existing[0]) {
    const hashedPassword = await hashPassword(DEV_PASSWORD);
    // ...
  }
}
```

Also consider adding a comment to the import: `// better-auth's scrypt derives a per-call salt; call once per user.`

### [MAJOR] Orphaned `bauth_user` with no `bauth_account` is never repaired

**File:** scripts/db/seed-dev-users.ts:29-63
**Issue:** The script only inserts into `bauth_account` inside the `if (!existing[0])` branch. If a prior run created a `bauth_user` row but crashed before inserting the account (or if someone manually deleted the account row), re-running the seed logs `exists:` and moves on. The user can never log in: no account row means no password.
**Impact:** Idempotency is broken in a partial-failure scenario. A developer debugging "I can't log in as the dev user even though seed ran" has no easy diagnostic.
**Fix:** Check for both rows and insert whichever is missing:

```typescript
const existingAccount = existing[0]
  ? await db
      .select({ id: bauthAccount.id })
      .from(bauthAccount)
      .where(and(eq(bauthAccount.userId, userId), eq(bauthAccount.providerId, 'credential')))
      .limit(1)
  : [];

if (!existing[0]) {
  // insert user
}
if (!existingAccount[0]) {
  // insert account
}
```

### [MINOR] `emailVerification.sendOnSignUp: true` + `requireEmailVerification: false` ships verification emails with no gating

**File:** libs/auth/src/server.ts:73, 81
**Issue:** On sign-up, better-auth sends a verification email (because `sendOnSignUp: true`), but the account is immediately usable without clicking the link (because `requireEmailVerification: false`). Verification links still auto-sign-in the user when clicked (per `autoSignInAfterVerification: true`), but clicking is optional. The inline comment `// Enable later when email is fully tested` confirms this is deliberately half-wired, but right now it means (a) every sign-up sends an email whether Resend is configured or not, and (b) the link has no gating effect -- it just reconfirms a session that may already be active.
**Impact:** Noise: users get an unnecessary email. Not a security issue, but a confusing UX.
**Fix:** Either disable `sendOnSignUp` until verification is required, or gate it behind `getEnvBool('EMAIL_VERIFICATION_ENABLED', false)`. At minimum expand the comment to reference the deferral ticket.

### [MINOR] Fire-and-forget email sends swallow errors silently

**File:** libs/auth/src/server.ts:76, 85, 97
**Issue:** All three email-send call sites use `void sendEmail(...)`. `sendEmail` catches its own errors and logs them, so nothing crashes. But the calling code (better-auth) believes the email was dispatched. On `sendResetPassword` failure, the user sees "check your email" and the email never arrives -- no retry, no surface-level error, no way to ask the user to retry. Same for verification and magic-link. For magic-link specifically this is user-hostile: the UI claims success, nothing happens.
**Impact:** Silent email failures lock users out of their own recovery flows.
**Fix:** At minimum, `await` the send so better-auth sees the failure and can propagate it to the caller (better-auth's `sendMagicLink` et al. expect a Promise). That preserves the boolean-return contract of `sendEmail` without reading it, but lets better-auth's error path fire:

```typescript
sendResetPassword: async ({ user, url }) => {
  const { subject, html } = resetPasswordEmail(url, user.name);
  await sendEmail({ to: user.email, subject, html });
},
```

Longer term, read the boolean and `throw` on `false` so the auth flow returns a real error to the client.

### [MINOR] `getResend()` caches `null` is not the problem -- but also never caches `null`

**File:** libs/auth/src/email/transport.ts:9-15
**Issue:** The cache only stores a successful `Resend` client. If `RESEND_API_KEY` is unset, `getResend` returns `null` without caching; every `sendEmail` call re-reads `process.env.RESEND_API_KEY`. If the env var is set later (e.g. hot reload or swapping `.env`), the next call will pick it up -- which is actually desirable. The review asks "cached null persists. Acceptable?" -- answer: the code does NOT cache null, so the scenario never triggers. Behavior is correct; the prompt's concern is based on a misread of the code. Noting here for completeness.
**Impact:** None. Behavior matches expectation.
**Fix:** No change. Add a one-line comment: `// Not caching the null case: allows picking up RESEND_API_KEY set after module load (e.g. dotenv hot reload).`

### [MINOR] `requireEnv('DATABASE_URL')` at module load breaks `bun run check` if env is missing

**File:** libs/db/src/connection.ts:15
**Issue:** The moment any file imports from `@ab/db`, the connection module executes `requireEnv('DATABASE_URL')`. If the developer runs `bun run check` (which does a typecheck and Svelte sync) without `.env` loaded, and svelte-kit sync imports a file that transitively imports `@ab/db`, the check fails with "Required environment variable DATABASE_URL is not set" rather than a type error. During `vite build` the same thing happens. `auth.ts` has a `building` guard; `connection.ts` does not.
**Impact:** Developer ergonomics: CI and local check commands fail with a misleading error if env is not wired.
**Fix:** Either mirror the `building`-guard pattern from `auth.ts`, or defer `postgres()` creation to first query via a lazy wrapper. Simplest:

```typescript
import { building } from '$app/environment';
const connectionString = building ? 'postgres://build-noop' : requireEnv('DATABASE_URL');
```

(Note: `$app/environment` isn't available in the `libs/db` package. The cleaner fix is a small lazy factory exported from `libs/db`, or an environment check based on `process.env.NODE_ENV === 'build'` set in the SvelteKit config.)

### [MINOR] `getEnvInt('DB_POOL_SIZE', DB_POOL_SIZE)` usage is correct -- but not the only overridable field

**File:** libs/db/src/connection.ts:18-21
**Issue:** `DB_POOL_SIZE` is overridable via env. `connect_timeout`, `idle_timeout`, `max_lifetime` are not -- they are baked-in constants. For a production port this is fine now; noting that the asymmetry will bite when tuning is needed (e.g. slow DB requires longer connect_timeout). Consider consistency: either all four are overridable, or document why only pool size is.
**Impact:** Minor tuning inflexibility.
**Fix:** Add `getEnvInt('DB_CONNECT_TIMEOUT_MS', DB_CONNECT_TIMEOUT_MS)` for each, or note in a comment that these are intentionally non-overridable.

### [MINOR] `handleError` missing `requestId` fallback for user-facing error page

**File:** apps/study/src/hooks.server.ts:10
**Issue:** `requestId` is read from `x-request-id` header or generated. But the generated value is local to `handleError` -- it is never written to the response or set in locals. The error page (and the logger) see it, but the user has no way to correlate a support ticket to a log line. The `logger.info` call at line 59 uses the hook-local `start` + `resolve` path and does not include `requestId` at all, so regular request logs are not correlated to errors.
**Impact:** Observability gap. Errors reference a request-id the user never saw; regular request logs have no request-id to link to.
**Fix:** Generate `requestId` once in the hook, stash it in `event.locals.requestId`, set `x-request-id` on the outgoing response, and pass it to `logger.info`. Then `handleError` reads from `event.locals.requestId`.

### [MINOR] Log-line request attribution skips auth path entirely

**File:** apps/study/src/hooks.server.ts:17-20, 59-62
**Issue:** The request-log `log.info(...)` only runs after `resolve(event)`. The early-return auth path skips logging, so `/api/auth/sign-in/email`, `/api/auth/sign-out`, magic-link callbacks, and verification endpoint hits leave no trace in the access log. These are exactly the endpoints you most want audit trails for.
**Impact:** Security-relevant requests (auth) have no access log.
**Fix:** Move the log emission to a `finally` inside a top-level try or unify the two paths. Example:

```typescript
let response: Response;
if (event.url.pathname.startsWith(ROUTES.API_AUTH)) {
  response = await auth.handler(event.request);
} else {
  // ... hydrate session/user, banned check, resolve
}
const ms = Math.round(performance.now() - start);
log.info(`${event.request.method} ${event.url.pathname} ${response.status}`, { ms, userId: event.locals.user?.id ?? null });
return response;
```

### [MINOR] `clearSessionCookies` after `forwardAuthCookies` can set then delete the same cookie

**File:** apps/study/src/routes/(app)/logout/+page.server.ts:18-19
**Issue:** `forwardAuthCookies` parses the sign-out response's `Set-Cookie` headers. better-auth does emit `Set-Cookie` on sign-out with `max-age=0`, which `forwardAuthCookies` correctly routes to `cookies.delete`. Then `clearSessionCookies` deletes again. Idempotent, so not harmful, but the second call is redundant noise. More importantly: if better-auth ever stops emitting the `Set-Cookie: max-age=0`, `clearSessionCookies` is the only cleanup (per its own doc comment), so removing it would be a regression. Current ordering (`forward` then `clear`) is defensive and correct. Worth a comment explaining why both fire.
**Impact:** None currently. Comment missing.
**Fix:** Add a one-line comment above the calls:

```typescript
// Forward any Set-Cookie headers from better-auth's sign-out, then
// explicitly clear known cookie names as a backstop (better-auth sometimes
// omits Set-Cookie on sign-out).
```

### [NIT] `LogContext.userId` type inconsistency across logger and error-handler

**File:** libs/utils/src/logger.ts:5, libs/utils/src/error-handler.ts:12
**Issue:** `LogContext.userId` is `string | null | undefined`. `HandleErrorParams.userId` is `string | undefined` (no null). The hook writes `event.locals.user?.id` (`string | undefined`) -- compatible. The asymmetry is tolerable but invites confusion.
**Impact:** Cosmetic type drift.
**Fix:** Align both to `string | null | undefined` (or `string | undefined` everywhere). Prefer the former since DB-derived user IDs commonly pass through `null`.

### [NIT] `LogEntry.userId` in prod JSON silently coerces `null` to `undefined`

**File:** libs/utils/src/logger.ts:61
**Issue:** `userId: ctx?.userId ?? undefined` -- the `?? undefined` turns null into undefined before JSON.stringify. That means prod logs omit the field rather than emitting `"userId": null`. For log aggregators that filter on presence, this is the right call; documenting it avoids future "why is the field missing" investigations.
**Impact:** None. Worth a comment.
**Fix:** Add `// null -> undefined: omit the field rather than log null` above the line.

### [NIT] `formatPretty` does not flush on crash

**File:** libs/utils/src/logger.ts:67-82
**Issue:** In dev mode, the logger uses `console.log`/`console.error`, which are line-buffered in Node/Bun but auto-flushed on `process.exit`. In the shutdown path (`connection.ts:47` calls `process.exit(0)`), any buffered log lines will be flushed. In an uncaught-exception crash path, Bun and Node both flush on exit. So the concern in the prompt is not a real issue in practice.
**Impact:** None.
**Fix:** No change.

### [NIT] `handleError` returns do not include status in the shape

**File:** libs/utils/src/error-handler.ts:38, 40-43
**Issue:** Only status 404 gets a custom `safeMessage`. 401/403/500 fall into the same `'An unexpected error occurred'`. SvelteKit passes the status into `handleError`, and the returned shape is surfaced on the error page via `$page.error`. For auth-heavy apps it is helpful to show "Please sign in" on 401 and "You do not have permission" on 403. Right now both say "An unexpected error occurred" which misleads the user into thinking it is a server bug.
**Impact:** Minor UX regression on auth errors.
**Fix:** Expand the branch:

```typescript
const safeMessage =
  params.status === 404 ? 'Page not found'
  : params.status === 401 ? 'Please sign in'
  : params.status === 403 ? 'You do not have permission to view this page'
  : 'An unexpected error occurred';
```

## Clean

- **Banned-user ordering** (hooks.server.ts:51-54): correctly runs AFTER session/user hydration and BEFORE `resolve`. The question in the prompt asks whether it runs "before /api/auth bypass or after" -- the early-return for `/api/auth/*` already happens at line 17 before session hydration, so banned users can still hit auth endpoints to sign out. That is the correct and desirable behavior.
- **Login form `redirect(303, ...)` inside try/catch concern**: SvelteKit's `redirect()` throws a special `Redirect` object that is caught by SvelteKit's action runner, NOT by the try/catch visible in the code. The `redirect(303, ...)` call at line 48 is OUTSIDE the try/catch, so the question does not apply here. Correct placement.
- **Login form `forwardAuthCookies` only on success**: verified. The `!authResponse.ok` branch returns `fail(401, ...)` before the forward call. Cookies are only set on the success path.
- **Login form `url.searchParams.get('redirectTo')` sanitization** (+page.server.ts:46-48): `startsWith('/') && !startsWith('//')` correctly rejects protocol-relative open redirects (`//evil.com`) and absolute URLs (`https://evil.com`). Good.
- **Login form response body consumption**: `authResponse.json().catch(() => null)` consumes the body once on the failure path. On success, `forwardAuthCookies` reads only headers and does not consume the body. No hanging-connection risk for in-process `Request`/`Response` objects (they are not wire connections).
- **Logout GET behavior** (+page.server.ts:7-9): `load` redirects unconditionally to `/login`. Hitting `/logout` with GET does NOT sign out (that requires POST action). This is correct and intentional: CSRF protection relies on logout being a POST.
- **Graceful shutdown double-shutdown** (connection.ts:27-31): `shuttingDown` flag prevents re-entry. Sending SIGTERM then SIGINT (or vice versa) is safely idempotent.
- **Seed script using `drizzle-orm/postgres-js` directly**: reasonable. The shared `@ab/db` connection installs SIGTERM/SIGINT handlers at import time, which would interfere with the seed script's own `process.exit` shutdown. Direct client instantiation avoids that collision. Worth a code comment explaining the intent -- currently the prompt question is answerable only by reading both files side-by-side.
- **Cookie options** (libs/auth/src/cookies.ts:14-24): `httpOnly: true`, `sameSite: 'lax'`, `secure: !isDev` correct. Domain selection matches the cross-subdomain config in `server.ts`.
- **`forwardAuthCookies` URL-decoding of cookie values** (cookies.ts:50): handles better-auth's `/` and `+` encoding correctly.
- **Session/user locals hydration**: all required fields default to `null` or empty string; no undefined-via-type-assertion leaks into downstream code.
- **`ms` to seconds conversions** (connection.ts:19-21): `Math.floor(ms / 1000)` is correct for all three constants (10000/30000/600000 divide evenly, so floor is a no-op -- semantics correct either way).
- **`createAuth` configuration**: Drizzle adapter, modelName overrides, `additionalFields` for firstName/lastName, cross-subdomain cookies, admin + magic-link plugins all wired consistently with the schema.
