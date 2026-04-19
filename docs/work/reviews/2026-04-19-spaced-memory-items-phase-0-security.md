---
title: 'Phase 0 Security Review: spaced-memory-items'
date: 2026-04-19
phase: 0
category: security
---

# Phase 0 Security Review

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 3     |
| Minor    | 7     |
| Nit      | 2     |

## Findings

### [Major] Open redirect via backslash-prefixed `redirectTo`

**File:** apps/study/src/routes/login/+page.server.ts:46-48

**Issue:** The `redirectTo` validation is:

```typescript
const safe = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
redirect(303, safe ? rawRedirect : ROUTES.HOME);
```

This passes for values like `/\evil.com`, `/\\evil.com`, or `/\/evil.com`. Several browsers (historically Chrome, Edge, IE) normalize backslashes to forward slashes when parsing the `Location` header, turning `/\evil.com` into `//evil.com` (scheme-relative, external). The check blocks `//` but does not block `/\`.

**Impact:** Open redirect. An attacker can craft a phishing link like `https://study.air-boss.org/login?redirectTo=/\evil.com`. After the user authenticates, they land on an attacker-controlled page that mimics airboss and harvests credentials or OAuth tokens.

**Fix:** Reject backslashes (and any non-path character) up front. A stricter check:

```typescript
const safe =
  rawRedirect.startsWith('/') &&
  !rawRedirect.startsWith('//') &&
  !rawRedirect.startsWith('/\\') &&
  !rawRedirect.includes('\\') &&
  !rawRedirect.includes('\r') &&
  !rawRedirect.includes('\n');
```

Or use `URL` parsing against a known base and verify the resulting origin matches the app's origin. Also consider rejecting protocol-schemes in any component (e.g., reject if `rawRedirect` contains `:` before any `/` other than leading).

---

### [Major] Seed script has no production guard

**File:** scripts/db/seed-dev-users.ts:17

**Issue:** The script runs against whatever `DATABASE_URL` is exported in the environment, falling back to the local OrbStack URL. There is no `NODE_ENV` / environment-name check, no confirmation prompt, no allow-list of safe hosts. `package.json` exposes it as `bun db:seed`.

**Impact:** Running `bun db:seed` on a CI runner or developer machine that happens to have a prod `DATABASE_URL` set (for example, if a prod `.env` was sourced or CI secrets leak into the shell) creates two users with a hard-coded password (`Pa33word!`) in production, one of them `admin`. This is a remote-admin-account plant.

**Fix:** Guard the script:

```typescript
const url = connectionString;
const isLocal = /localhost|127\.0\.0\.1|airboss-db/.test(url);
const env = process.env.NODE_ENV ?? 'development';
if (env === 'production' || !isLocal) {
  console.error('Refusing to seed dev users: not a local dev database');
  process.exit(1);
}
```

Additionally, require an explicit opt-in env var (e.g., `AIRBOSS_ALLOW_DEV_SEED=1`) before any write.

---

### [Major] Internal error messages leaked to client on login failure

**File:** apps/study/src/routes/login/+page.server.ts:41-44

**Issue:**

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : 'Invalid email or password';
  return fail(401, { error: message, email });
}
```

If `auth.handler` throws due to infrastructure failure (DB down, timeout, adapter bug), `err.message` can contain internal detail such as `connect ECONNREFUSED 127.0.0.1:5435`, Drizzle errors referencing table names, or better-auth internal stack text. This is rendered to the browser by `+page.svelte` in the `.error` block.

**Impact:** Information disclosure. An attacker probing the login endpoint (e.g., by forcing errors with malformed payloads) can learn about database host/port, schema names, and library versions to inform further attacks.

**Fix:** Do not expose raw error messages:

```typescript
} catch (err) {
  log.error('login handler threw', { email }, err instanceof Error ? err : undefined);
  return fail(500, { error: 'Sign-in failed, please try again', email });
}
```

Same pattern applies to the logout action -- catch the auth-handler error and still run `clearSessionCookies` + redirect.

---

### [Minor] Dev credentials shipped in the client login bundle

**File:** apps/study/src/routes/login/+page.svelte:2, 19, 82-89; libs/constants/src/dev.ts

**Issue:** `DEV_ACCOUNTS` and `DEV_PASSWORD` are imported at the top of the Svelte component. The UI that uses them is gated by `{#if dev}`, but `fillDevAccount` and the string literal `DEV_PASSWORD` are referenced outside that conditional scope at the module level. The `dev` flag from `$app/environment` is inlined as `false` at prod build time, so tree-shaking *should* drop `DEV_PASSWORD` -- but Vite/Rollup cannot always eliminate a constant that is lexically referenced from a live function, and a future refactor could accidentally re-introduce a live reference.

**Impact:** If dead-code elimination fails (or breaks in the future), the production client JS bundle includes the admin email `joshua@ball.dev`, the learner email, and the literal password `Pa33word!`. Combined with the seed-script footgun above, this is a credential leak path.

**Fix:** Move dev-only UI into a separate `<script module>`-gated component that is only imported when `import.meta.env.DEV` is true, or split into `DevLoginPanel.svelte` that is conditionally imported via `await import()` only when `dev` is true. Verify the prod bundle with `grep -r 'Pa33word' .svelte-kit/output/client` in CI.

Also consider removing the dev email/name from the shared `@ab/constants` package and sourcing it from `.env.local` or `DEV_ACCOUNTS_JSON` so that it never enters the production module graph.

---

### [Minor] `/api/auth*` path-prefix bypass can match unintended paths

**File:** apps/study/src/hooks.server.ts:17

**Issue:** `event.url.pathname.startsWith(ROUTES.API_AUTH)` where `API_AUTH = '/api/auth'`. This matches:

- `/api/auth/sign-in/email` (intended)
- `/api/auth` exactly
- `/api/authorize` (not intended)
- `/api/authfoo` (not intended)

Any future route with an `/api/auth*` prefix that is *not* part of better-auth is silently forwarded to `auth.handler` *and* bypasses the banned-user check, session hydration, and timing logs.

**Impact:** Currently no other `/api/auth*`-prefixed routes exist, so this is a defense-in-depth issue. It becomes a real problem if someone adds e.g. `/api/authorize` or `/api/auth-status` later.

**Fix:** Match a strict prefix:

```typescript
if (event.url.pathname === ROUTES.API_AUTH || event.url.pathname.startsWith(`${ROUTES.API_AUTH}/`)) { ... }
```

Or store the prefix constant as `'/api/auth/'` and compare paths explicitly.

---

### [Minor] Banned check is skipped for `/api/auth/*`

**File:** apps/study/src/hooks.server.ts:17-20, 50-54

**Issue:** The banned-user 403 block runs only after the `/api/auth/*` short-circuit. A banned user who still possesses a valid session cookie can keep calling `GET /api/auth/get-session`, `POST /api/auth/sign-out`, and any other better-auth endpoint. better-auth's admin plugin refuses *new* sign-ins for banned users (via `session.create.before`), and it bans existing sessions via `banUser`, so the practical attack surface is small. But a banned user whose sessions weren't force-revoked by the admin still can hit these endpoints.

**Impact:** Low. better-auth's admin plugin calls `revokeSessions` when a ban is set, so sessions should already be dead. This is a defense-in-depth finding only.

**Fix:** Move the `event.locals.user?.banned` check in front of the `/api/auth/*` short-circuit, or only short-circuit for unauthenticated auth endpoints (sign-in, sign-up, callbacks). Alternatively, after the hooks hydrate locals, rewrite so banned users are forcibly signed out and cookies cleared.

---

### [Minor] `forwardAuthCookies` throws on malformed percent sequences

**File:** libs/auth/src/cookies.ts:50

**Issue:**

```typescript
const value = decodeURIComponent(nameVal.substring(eqIndex + 1).trim());
```

If better-auth (or a future middleware / proxy) ever emits a cookie value containing a bare `%` or an invalid percent-escape, `decodeURIComponent` throws `URIError: URI malformed`. This propagates up through `login`/`logout`/`handle` and 500s the whole request.

**Impact:** Denial-of-service in the auth flow if any cookie value contains an unencoded `%`. Not directly a security issue, but affects availability of sign-in / sign-out.

**Fix:** Wrap in try/catch and fall back to the raw value, or skip the cookie entirely:

```typescript
let value: string;
try {
  value = decodeURIComponent(nameVal.substring(eqIndex + 1).trim());
} catch {
  value = nameVal.substring(eqIndex + 1).trim();
}
```

Also consider using `URLSearchParams` or a real Set-Cookie parser (e.g., `set-cookie-parser` npm package) to avoid re-implementing RFC 6265.

---

### [Minor] Log injection via `x-request-id` header

**File:** apps/study/src/hooks.server.ts:10; libs/utils/src/logger.ts:41-47

**Issue:** The request ID comes from the client-supplied `x-request-id` header with no validation. It is interpolated into log lines via `formatPretty`:

```typescript
return `${ts} [${app}] ${label} ${msg}${reqSuffix}${userSuffix}`;
```

A client can send `x-request-id: abc\n2026-04-19T00:00:00Z [study] INFO fake log line uid=admin` and forge log entries in the pretty/dev output.

**Impact:** Log forgery / tampering with dev-mode logs. In production mode the logger uses `JSON.stringify`, which escapes newlines, so the impact is limited to dev. Still worth sanitizing.

**Fix:** Validate `x-request-id` is a UUID/ULID pattern before trusting it, and strip control characters:

```typescript
const raw = event.request.headers.get('x-request-id');
const requestId = raw && /^[a-zA-Z0-9-]{1,64}$/.test(raw) ? raw : crypto.randomUUID();
```

---

### [Minor] Email template interpolates `name` into HTML without escaping

**File:** libs/auth/src/email/templates.ts:27, 40

**Issue:** `verificationEmail` and `resetPasswordEmail` interpolate the user's `name` directly:

```typescript
<p>Hi ${name},</p>
```

`name` is user-controlled at sign-up. If a user signs up with `name: '<img src=x onerror=...>'`, the email sends raw HTML. Most email clients sandbox/strip scripts but may still render images, links, or CSS-based attacks. The URL in `href="${url}"` could also break out if `url` ever contains `"`.

**Impact:** Email-side HTML injection. Limited because email clients restrict execution, but can be used for phishing ("your verification code is: <injected message here>") or tracking pixels.

**Fix:** Escape interpolated values:

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// usage
<p>Hi ${escapeHtml(name)},</p>
${buttonHtml(url, 'Verify Email')}
```

And in `buttonHtml`, use `encodeURI(url)` (or a URL parse/validate step) to avoid attribute-context injection.

---

### [Minor] Logout does not run cookie clearing on auth-handler failure

**File:** apps/study/src/routes/(app)/logout/+page.server.ts:12-23

**Issue:** The logout action has no try/catch. If `auth.handler(authRequest)` throws (DB down, better-auth bug), `forwardAuthCookies` and `clearSessionCookies` never run, and the user remains logged in with a valid cookie. Also, the caller sees a 500 page, not a redirect to login.

**Impact:** Fail-open: logout can silently fail while the user thinks they are signed out. If a user on a shared device clicks "Sign out" but sees a generic error, they may walk away believing they are signed out.

**Fix:** Always clear cookies and redirect, even if better-auth fails:

```typescript
try {
  const authResponse = await auth.handler(authRequest);
  forwardAuthCookies(authResponse, cookies);
} catch (err) {
  log.error('sign-out handler failed', {}, err instanceof Error ? err : undefined);
}
clearSessionCookies(cookies);
redirect(303, ROUTES.LOGIN);
```

Also consider revoking the session server-side via `auth.api.revokeSession` using the session id from locals, as a belt-and-braces defense.

---

### [Minor] `auth.api.getSession` trust boundary on every non-`/api/auth` request

**File:** apps/study/src/hooks.server.ts:22-24

**Issue:** `auth.api.getSession({ headers: event.request.headers })` is called on *every* request, including static assets, service-worker requests, and preflight. Each call hits the DB (via Drizzle). There is no caching layer, and a malicious client can force load by hammering any path. This is primarily a perf / DoS concern rather than an auth bypass, but it expands the attack surface (every request = one DB roundtrip into `bauth_session`).

**Impact:** DoS amplification (1 HTTP request -> 1 SQL select on hot path). Combined with no rate limiting, a single attacker can saturate the DB pool (default 10 connections).

**Fix:** Skip session resolution for static asset paths:

```typescript
if (event.url.pathname.startsWith('/_app/') || event.url.pathname.startsWith('/static/')) {
  return resolve(event);
}
```

And consider adding rate limiting at the edge / reverse proxy.

---

### [Nit] Email transport drops debug fields silently

**File:** libs/auth/src/email/transport.ts:34-39; libs/utils/src/logger.ts:3-7

**Issue:** When `RESEND_API_KEY` is absent, the code tries to log `{ to, from, subject }`:

```typescript
log.info('no RESEND_API_KEY -- email logged', {
  to: message.to,
  from,
  subject: message.subject,
});
```

But `LogContext` only carries `requestId`, `userId`, and `metadata`. The `to`/`from`/`subject` fields are silently dropped on both pretty and JSON output. The dev-fallback is thus effectively a no-op -- there is no magic-link URL in the dev log, so devs cannot complete the email-verification / magic-link flow without Resend.

**Impact:** Not a security issue. Developer-experience regression: the dev fallback claims to log but does not.

**Fix:** Wrap extra fields in `metadata`:

```typescript
log.info('no RESEND_API_KEY -- email logged', {
  metadata: { to: message.to, from, subject: message.subject, url: /* extract from html if needed */ }
});
```

Also: logging the magic-link / reset-password URL at `info` in prod would be a *problem* (leaks a live bearer token to logs). Keep that in mind if this is ever converted to a real log field -- it should be dev-only.

---

### [Nit] `auth.handler` is never awaited in hooks, but `response` typed as Promise

**File:** apps/study/src/hooks.server.ts:18-19

**Issue:** `const response = auth.handler(event.request); return response;` -- `auth.handler` returns a `Promise<Response>`. SvelteKit's `handle` accepts a `Promise<Response>` return, so this works, but the local naming is misleading (`response` is actually a Promise, not a Response).

**Impact:** None; purely cosmetic.

**Fix:** Either `return auth.handler(event.request);` or `return await auth.handler(event.request);`.

## Clean

Reviewed and found clean:

- **Password hashing** -- delegated to better-auth's scrypt via `hashPassword` in the seed script. No plaintext storage.
- **Password in form response** -- login action returns only `{ error, email }` on failure, never the password.
- **Email enumeration on login** -- better-auth uses the generic `INVALID_EMAIL_OR_PASSWORD` error code for both unknown-user and wrong-password cases, and hashes the provided password even when the user does not exist (see `node_modules/better-auth/dist/api/routes/sign-in.mjs`).
- **SQL injection** -- all DB access goes through Drizzle with parameterized queries. No raw SQL, no string concatenation. `escapeLikePattern` correctly escapes `\`, `%`, and `_` for LIKE/ILIKE (the order `/[\\%_]/g` is fine because the replacement adds a backslash to each matched char and the regex itself matches them as literal class members, not as backslash-escapes in the pattern -- no double-escape bug).
- **Cookie flags** -- `httpOnly: true`, `sameSite: 'lax'`, `secure: !isDev`, `path: '/'`, `maxAge: 7d`. Appropriate for session cookies.
- **BETTER_AUTH_SECRET handling** -- required, no fallback, throws on missing (`apps/study/src/lib/server/auth.ts:8`). Not logged anywhere in the reviewed code.
- **Self-signup role elevation** -- admin plugin schema sets `role`, `banned`, `banReason`, `banExpires` to `input: false`, and `parseInputData` (`node_modules/better-auth/dist/db/schema.mjs:34-83`) throws `FIELD_NOT_ALLOWED` if a sign-up body tries to set them. `defaultRole: 'learner'` cannot be overridden via the signup request.
- **Banned-user login** -- better-auth's admin plugin `session.create.before` hook throws `BANNED_USER` during session creation, and unban-on-expiry is handled. Our hooks-level check is redundant but correct.
- **SvelteKit CSRF on login/logout form actions** -- POST form actions get SvelteKit's default origin check. better-auth applies its own origin / fetch-metadata CSRF on `/api/auth/*` endpoints.
- **ID generation** -- `generateAuthId()` uses `ulidx`'s ULID with lowercase casing, sufficient entropy (80 bits random).
- **DB pool shutdown** -- SIGTERM/SIGINT handlers drain the pool before exit. Errors during drain are logged. No secret leak in logs.
- **handleError** -- returns only a safe generic message plus `requestId` to the client. Does not leak the original error to the response body.
- **Locals hydration** -- the `session.user as Record<string, unknown>` cast is ugly but typesafe enough; the `role: (session.user.role as Role) ?? null` fallback is correct. `firstName`/`lastName` default to empty strings, no injection vector.
- **Better-auth TrustedOrigins** -- default trusted origin comes from `baseURL`, which is `http://localhost:${PORTS.STUDY}` here. Any production deployment MUST override this via `BETTER_AUTH_URL` env or by passing the real `baseURL` to `createAuth`, otherwise better-auth will reject sign-in from the prod origin (functional bug, not a security issue, but worth noting for the deploy task).
- **Cookie domain scoping** -- `.airboss.test` (dev) and `.air-boss.org` (prod) are correctly fenced behind the `isDev` flag. Both have the leading dot (allowed by RFC 6265bis; modern browsers normalize).
