---
feature: auth-identity-audit
category: security
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 1
  major: 5
  minor: 7
  nit: 4
  total: 17
---

## Status as of 2026-05-04

Walked every finding against current main. 14 of 17 closed; 3 carried as design items with concrete triggers.

| Severity | Finding                                              | Verdict                                                                                        |
| -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CRITICAL | Public sign-up enabled on private product            | CLOSED -- `libs/auth/src/server.ts:155` `disableSignUp: true` (PR #423)                        |
| MAJOR    | Login and logout not audited                         | CLOSED -- `libs/auth/src/audit-hooks.ts` + `libs/audit/src/auth-events.ts` (PR #439)           |
| MAJOR    | Banned users keep working up to 5 min                | CLOSED -- documented trade-off; cookie-cache stays at 5 min, ban guard runs after hydrate      |
| MAJOR    | XFF / proxy-trust validation missing                 | STILL OPEN -- design item, see below                                                           |
| MAJOR    | Password reset / forget-password timing oracle       | STILL OPEN -- design item, see below                                                           |
| MAJOR    | Hangar login renders dev password                    | CLOSED -- hangar/login/+page.svelte aligned with study (PR #469)                               |
| MINOR    | Cookie names not `__Host-` prefixed                  | CLOSED -- comment in `libs/constants/src/auth.ts:22-25` documents cross-subdomain trade-off    |
| MINOR    | Email logged as PII at info level on dev fallback    | CLOSED -- `redactEmail()` in `libs/auth/src/email/transport.ts:28-35`                          |
| MINOR    | redirectTo filter does not normalize Unicode/encoded | CLOSED -- `libs/auth/src/redirect.ts` parses against placeholder origin + char allowlist       |
| MINOR    | Sign-out forwards user-supplied Cookie header        | STILL OPEN -- design item, see below                                                           |
| MINOR    | forwardAuthCookies re-encodes already-encoded values | CLOSED -- `libs/auth/src/cookies.test.ts:48` pins encoded round-trip                           |
| MINOR    | bauthSession.token unindexed in declaration          | CLOSED -- `bauth_session_user_idx` added in schema.ts:56                                       |
| MINOR    | audit_log.target_type CHECK constraint brittleness   | CLOSED -- `AUDIT_TARGETS_RETIRED` keeps historic values + comment block (audit.ts:89-98)       |
| NIT      | Cookies.delete on logout uses path:'/' only          | CLOSED -- comment pinning the assumption in cookies.ts:152-156                                 |
| NIT      | HSTS preload directive may strand domain change      | CLOSED -- documented in hooks; HSTS preload is a deliberate one-way commitment                 |
| NIT      | requestId accepts arbitrary 64-char ASCII            | CLOSED -- helper renamed `acceptOrGenerateRequestId` + comment "correlation-only"              |
| NIT      | Hooks degrade-on-DB silently null user               | CLOSED -- study/hangar log via `log.error('session lookup failed', ...)`; sim/avionics also do |

### Carried-forward design items

- **XFF / proxy-trust validation**: today no proxy fronts adapter-node; `getClientAddress()` returns the socket peer. Trigger to land: when a CDN / load balancer is configured in the deploy. Add `AIRBOSS_TRUSTED_PROXY` env-var gating + boot-time self-check at that point.
- **Password-reset timing oracle**: `sendResetPassword` callback fires synchronously on the request thread, leaking SMTP latency. Trigger: when the dev fallback flips to a real outbound transport in production (`RESEND_API_KEY` set + the `requireEmailVerification` gate flipped). Add fixed-minimum delay or fire-and-forget dispatch then.
- **Sign-out forwards user-supplied Cookie header**: today SvelteKit/Bun's `Headers` constructor sanitises CR/LF, so header injection is closed. Trigger: when the logout flow ever bypasses `Headers` (e.g. raw `Buffer` write). Pin a trust-boundary comment in both files when refactoring.

## Summary

The auth/identity/audit chunk is built on better-auth with reasonable defaults: database-backed rate limiting on the high-cost endpoints (sign-in, magic-link, forget-password), strict-SameSite session cookies, a Domain-aware rewrite that supports both cross-subdomain and host-only deployments, idempotent server-side sign-out with a defence-in-depth cookie clear, an open-redirect filter on `redirectTo`, neutral failure messages on bad credentials, and an HTML-escaping email template helper. SvelteKit-level CSP, X-Frame-Options=DENY, HSTS in prod, X-Content-Type-Options=nosniff, and a Permissions-Policy that disables camera/mic/geo/payment all sit in `hooks.server.ts`. A real DB-backed rate-limit integration test covers process-restart persistence.

The headline finding is unrelated to the better-auth wiring itself and sits one level up: **the public `/api/auth/sign-up/email` endpoint is enabled and unguarded** even though the product is documented (memory: project_license_and_hosting) as private/all-rights-reserved/hosted-only-by-Joshua, with no public registration intended. Anyone who hits the deployed URL can create a learner account today (and authenticate, because `requireEmailVerification: false`). That's a CRITICAL gap in product posture and intent, not a code bug.

The other major findings cluster around operational hardening: no audit row is written on login or logout (so brute-force / credential-stuffing campaigns are invisible to the audit log even after rate-limit kicks in); the cookie-cache TTL means a banned user keeps working for up to 5 minutes after the ban lands; `getClientAddress` is forwarded as `x-forwarded-for` with no proxy-trust validation; password-reset response timing leaks user existence; and the in-process sign-in re-uses the user-supplied `cookie` header on the synthetic Request (this is fine today but worth pinning).

Critical first, then ordered by severity.

## Issues

### CRITICAL: Public registration endpoint is open on a private hosted-only product

File: `libs/auth/src/server.ts:132-139`

Problem: `emailAndPassword.enabled: true` is configured without `disableSignUp` (or any other gating), so better-auth wires `/api/auth/sign-up/email` and serves it from every app's `hooks.server.ts` `isAuthPath()` passthrough. There is no allowlist, no invite gate, no admin approval, no email-verification fence (`requireEmailVerification: false`, `emailVerification.sendOnSignUp: false`). Anybody who can reach the URL can `POST { email, password, name, firstName, lastName }` and immediately receive a session cookie -- the `admin` plugin's `defaultRole: ROLES.LEARNER` lands them as a normal learner, not an admin, but they're inside the wall. Per memory `project_license_and_hosting` (2026-04-30) the product is private/all-rights-reserved/hosted-only-by-Joshua with no public users. The production deploy ships a self-serve registration form by default. Sibling test `libs/auth/src/rate-limit.test.ts:78` exercises this same endpoint directly, confirming it's live.

Fix: add `emailAndPassword.disableSignUp: true` in `createAuth` (or `signUp.disabled`/equivalent in better-auth's current spelling), and gate any future first-user / invite flow behind a server-only path that enforces an invite token. The seed pipeline (`scripts/db/seed-dev-users.ts`) already plants users via direct DB writes -- it does not rely on the public endpoint -- so closing it is a one-line change. Add a guard test that asserts a `POST /api/auth/sign-up/email` returns 403/404 on the non-test path.

### MAJOR: Login and logout are not audited

File: `apps/study/src/routes/login/+page.server.ts`, `apps/hangar/src/routes/login/+page.server.ts`, `apps/study/src/routes/(app)/logout/+page.server.ts`, `apps/hangar/src/routes/logout/+page.server.ts`

Problem: `AUDIT_OPS.ACTION` is documented in `libs/audit/src/schema.ts:32-38` as the bucket for "non-mutating action worth recording (login, export, impersonation)" and `libs/constants/src/audit.ts` even comments "for non-row actions (login, export, ...)". No login or logout action calls `auditWrite`. Successful sign-ins, failed sign-ins, lockouts (HTTP 429), banned-user blocks in `hooks.server.ts:133-139`, and sign-outs all bypass the audit log entirely. The audit log is the read substrate the hangar admin home queries via `countAuditEntriesSince` and `auditRecent`. After rate-limit kicks in, an admin investigating "is someone hammering this account?" has no signal to read.

Fix: add `auditWrite({ actorId: user.id, op: AUDIT_OPS.ACTION, targetType: AUDIT_TARGETS.AUTH_LOGIN, targetId: user.id, metadata: { ip: getClientAddress(), userAgent } })` on the success path of each login action, and `op: AUDIT_OPS.ACTION, targetType: AUDIT_TARGETS.AUTH_LOGIN_FAILED` on the failure path with `actorId: null` and `metadata: { emailHash, status }` (hash, not raw, to keep enumeration off the audit log -- see PII finding below). Mirror for sign-out. Add a `AUDIT_TARGETS.AUTH_LOGIN` / `AUTH_LOGIN_FAILED` / `AUTH_LOGOUT` / `AUTH_BANNED_BLOCK` set in `libs/constants/src/audit.ts`.

### MAJOR: Banned users keep working for up to 5 minutes after ban lands

File: `libs/auth/src/server.ts:67-74`, `apps/study/src/hooks.server.ts:96-145`, `apps/hangar/src/hooks.server.ts:120-167`

Problem: `session.cookieCache: { enabled: true, maxAge: 5 * 60 }` makes `auth.api.getSession` read user state out of the signed cookie payload, not the DB. The hooks' banned-user guard (`if (event.locals.user?.banned)`) reads from that cached snapshot. When an admin sets `banned = true` on a row via `libs/bc/hangar/src/user-writes.ts`, every existing session for that user can keep operating for the remaining cookie-cache window -- worst case 5 minutes from the last cookie refresh. The comment ("short enough that ban / revoke propagates quickly") acknowledges the trade-off but understates it: 5 minutes is an eternity for a credential-takeover or compromised-account incident-response timeline. The hangar BC's "revoke all sessions" path (`user-writes.ts:439`) walks the DB to delete rows but cannot invalidate signed cookie caches that are already in flight.

Fix: drop `cookieCache.maxAge` to ~30 seconds (the typical interactive burst), or invalidate the cache on the banned/revoked path. Better-auth exposes a `revokeUserSessions` API that should also flip the cookie-cache version; verify that the hangar revoke flow calls it. Alternatively, in `hooks.server.ts`, when `locals.user?.banned` is observed, don't trust the cache: re-validate the user row from DB before serving. The DiD layer is already there (the `Account suspended` 403); the gap is that it doesn't fire promptly.

### MAJOR: `getClientAddress` is forwarded as `x-forwarded-for` with no proxy-trust validation

File: `apps/study/src/routes/login/+page.server.ts:60`, `apps/hangar/src/routes/login/+page.server.ts:47`

Problem: SvelteKit's `getClientAddress()` returns the value of `X-Forwarded-For` when adapter-node trusts the proxy chain (`address.host` config or the `ORIGIN`/`PROTOCOL_HEADER`/`HOST_HEADER`/`ADDRESS_HEADER` env vars). If the deploy fronts adapter-node directly without those env vars set, `getClientAddress()` returns the socket peer (correct). If the deploy puts a CDN or LB in front and only sets `HOST_HEADER` but forgets `ADDRESS_HEADER`, the call returns the proxy IP for everyone (rate-limit shared bucket -- exactly the failure mode the comment in the file describes the previous version had). If the deploy sets `ADDRESS_HEADER=x-forwarded-for` but does not strip client-supplied XFF at the edge, an attacker can spoof the header and either escape their own bucket (rotate IP per request) or weaponise it to lock another user's IP out (target the victim by spoofing their IP). The login form forwards this value verbatim to better-auth's rate-limit storage as the bucket key.

Fix: document the deploy-time requirement (set `ADDRESS_HEADER` only when running behind a proxy that strips client XFF), and add a runtime self-check at boot: if `ADDRESS_HEADER` is set without a `TRUSTED_PROXY` env (or equivalent), refuse to start, or fall back to socket peer with a loud warning. Belt-and-braces: add an upstream rate-limit tier on the IP so the per-account bucket isn't the only line of defence.

### MAJOR: Password reset / forget-password leaks user existence via response timing

File: `libs/auth/src/server.ts:135-138`

Problem: `sendResetPassword` is configured as a callback that better-auth only invokes when a matching user is found. The HTTP response time for a known email (DB lookup -> SMTP call -> response) is materially longer than for an unknown email (DB lookup -> response). Better-auth's default response shape for `/forget-password` does not differ between the two cases (good), but the timing differential is observable. With `EMAIL_TRIGGER_MAX_REQUESTS = 3` per 5 minutes, an attacker can probe ~864 emails per IP per day from a single bucket; with rotation, this scales. The CFI/Joshua-only audience is small enough that knowing "this email exists in airboss" is a meaningful intelligence leak.

Fix: in `createAuth`, configure the password-reset flow to either (a) always return after a fixed minimum delay (e.g. enqueue the email, return after 600ms regardless), or (b) enqueue the lookup+send job asynchronously and return immediately on every call. Better-auth's `sendResetPassword` callback runs on the request thread; wrap it in a fire-and-forget dispatch (`void sendEmail(...)`) so the HTTP response shape is identical for known/unknown emails.

### MAJOR: hangar login page renders the dev password to the page

File: `apps/hangar/src/routes/login/+page.svelte:97-99`

Problem: The dev panel prints `password: <code>{DEV_PASSWORD}</code>` directly on the login page when `dev` is true. Study's equivalent panel (`apps/study/src/routes/login/+page.svelte:99-103`) makes a deliberate point of NOT printing the password ("we deliberately don't print the password to screen so it's not trained as a normal place for credentials to live"). The two surfaces have diverged: hangar trains the dev to expect credentials on the login page, study does not. The build flag (`dev`) keeps it out of prod bundles, so this is dev-only; the issue is muscle memory and the chance that the `{#if dev}` guard later regresses (e.g. an env-driven flag flipped accidentally).

Fix: align hangar with study -- delete the `<p class="dev-hint">` block in `apps/hangar/src/routes/login/+page.svelte:97-99` and let the click-to-fill UX do the credential delivery. Drop the `DEV_PASSWORD` import from the page if no other binding survives.

### MINOR: Cookie names not `__Host-` prefixed

File: `libs/constants/src/auth.ts:22-25`

Problem: The session cookie names `better-auth.session_token` and `better-auth.session_data` lack the `__Host-` prefix. `__Host-` would force the browser to require `Secure`, `Path=/`, and no `Domain` attribute -- which mostly closes the "cookie tossing" gap where a sibling host on the same registrable domain (e.g. `evil.air-boss.org` if such ever existed) sets a same-named cookie that the legitimate origin then trusts. The cross-subdomain Domain strategy makes `__Host-` impossible by definition (cookies must travel between `study.air-boss.org` and `hangar.air-boss.org`, which requires Domain), so this is a deliberate trade-off, not a bug -- but it is a defence-in-depth gap worth documenting.

Fix: add a comment to `BETTER_AUTH_COOKIES` explaining why `__Host-` is not used (cross-subdomain Domain requirement), and pin the trade-off in the auth ADR if one exists. Belt-and-braces: in prod, set `__Secure-` prefix (which only requires `Secure`) -- cheaper than `__Host-` and compatible with cross-subdomain.

### MINOR: Email address logged as PII at info level on dev "no API key" path

File: `libs/auth/src/email/transport.ts:33-36`

Problem: When `RESEND_API_KEY` is unset, the dev fallback logs `{ to: message.to, from, subject: message.subject }` at `log.info` -- including the recipient email address. Logs may flow to a centralised system (the `createLogger` import points at `@ab/utils`); even in dev, dropping a user's email into the JSON log line means it shows up in `bun dev` console output, and any future log shipper inherits it. The error path (`log.error 'resend error'`, `log.error 'email send failed'`) avoids this, but the success/no-key path does not.

Fix: log a hashed or domain-truncated form (`to: 'a***@airboss.test'`) in the dev fallback, or gate the `to` field behind an explicit `LOG_PII=1` opt-in. Same for `from` if it varies per call. Add a comment that the dev fallback exists specifically to avoid sending real email and that the log line is the audit trail; redact accordingly.

### MINOR: redirectTo open-redirect filter does not normalize Unicode and percent-encoding

File: `apps/study/src/routes/login/+page.server.ts:11-19`, `apps/hangar/src/routes/login/+page.server.ts:11-17`

Problem: `isSafeRedirect` checks `startsWith('/')`, blocks `//`, `\`, `\r`, `\n`. It does not block `/%2F%2Fevil.com` (some browsers normalize `%2F` -> `/` for path traversal, though not for hostname promotion in practice), nor does it block `/‮` Unicode tricks, nor whitespace before the path (`'\t/foo'`). The `redirectTo` value is the user-controlled query parameter from `?redirectTo=...`, so any bypass is an open redirect off the login origin. Today the filter is probably sufficient because `redirect(303, path)` returns a `Location: <path>` that the browser interprets as an absolute path on the current origin -- the URL parser at the browser side rejects `//evil.com` resolution from a path that begins with `/`. But the helper is a hot security primitive and ought to be hardened against mistakes.

Fix: parse the redirect target with `new URL(raw, 'http://x.local')`, assert `parsed.host === 'x.local'` (i.e. the target is relative and resolved against the placeholder origin), and use `parsed.pathname + parsed.search`. Belt-and-braces: reject any value containing characters outside `[A-Za-z0-9_\-./?&=%~+]` before parsing. The `isSafeRedirect` helper duplicates between study and hangar -- consolidate into `@ab/auth` or `@ab/utils` so a fix lands once.

### MINOR: Sign-out forwards user-supplied `Cookie` header into the synthetic Request

File: `apps/study/src/routes/(app)/logout/+page.server.ts:18-22`, `apps/hangar/src/routes/logout/+page.server.ts:18-22`

Problem: `headers: { cookie: request.headers.get('cookie') ?? '' }` constructs a synthetic `Request` whose `Cookie` header is the verbatim string the browser sent. SvelteKit/Bun's `Headers` constructor sanitizes CR/LF, so header injection is closed at that boundary, but the trust boundary is implicit. If a future refactor bypasses `Headers` (e.g. raw `Buffer` write), the user controls the header. Lower bar than CSRF: sign-out is idempotent and authenticated by the cookie itself.

Fix: pin the trust assumption with a comment in both files: "`Headers` constructor sanitizes CR/LF; do not bypass." Better: instead of reading the raw cookie string, build a fresh `Headers` and copy only the better-auth session cookies by name (`BETTER_AUTH_COOKIES.SESSION_TOKEN` / `SESSION_DATA`), so an attacker who controls other unrelated cookies on the request can't smuggle them through.

### MINOR: `forwardAuthCookies` re-encodes cookie values that better-auth already encoded

File: `libs/auth/src/cookies.ts:53-96`

Problem: `decodeCookieValue` URL-decodes the raw value out of better-auth's Set-Cookie header, then `cookies.set(name, value, opts)` URL-encodes it again on the way out (SvelteKit always percent-encodes cookie values). For ASCII-safe better-auth tokens this is a no-op. For tokens containing `+`, `/`, or `=` (common in base64), the round-trip produces a different on-the-wire value than the one better-auth would have set if its Response had been forwarded directly. The wire format is what the browser stores; the server reads the cookie back through `request.headers.get('cookie')`, which is decoded by SvelteKit's parser, and the round-trip is lossless in practice -- but the layering is fragile and worth pinning in a test.

Fix: add a unit test that takes a known better-auth Set-Cookie shape (with `+` / `/` / `=` in the value), runs it through `forwardAuthCookies`, reads the cookie back via `cookies.get(name)`, and asserts equality with the original value. If the assertion fails, fix the encoding -- pass the raw (un-decoded) value to `cookies.set`, which is less symmetric but more correct.

### MINOR: The `bauthSession.token` column is queried but not indexed in the schema declaration

File: `libs/auth/src/schema.ts:30-42`

Problem: `bauth_session.token` is `notNull().unique()` which gives a unique B-tree index implicitly. No additional issue here on its own. Mention: `userId` is referenced from `bauth_session` but no explicit index is declared for `(user_id)` either. Postgres does not create an index for FK references automatically, so cascade delete and "list sessions for user" reads scan. Not a vulnerability per se -- a slow-query DoS surface. Calling out because the audit log declares its own `auditActorIdx` and `auditTargetIdx` (`libs/audit/src/schema.ts:69-70`); the auth schema should follow the same pattern.

Fix: add `index('bauth_session_user_idx').on(t.userId)` on the bauth_session table declaration. Keep the migration tight.

### MINOR: `audit_log.target_type` whitelist is enforced via a CHECK on a `pgschema.text(...)` column rather than a DB enum

File: `libs/audit/src/schema.ts:71-72`

Problem: `audit_log_target_type_check` reads `"target_type" IN ('hangar.ping', 'hangar.user', ...)` and is regenerated whenever `AUDIT_TARGET_VALUES` changes. The CHECK clause uses `inList(values)`, which interpolates each value via `replace(/'/g, "''")` -- safe against SQL injection in the constant set. A DB enum would give the same constraint plus better introspection. Not a vulnerability today; brittleness around future migrations. If a new `AUDIT_TARGET` value lands in the constant but the migration that updates the CHECK doesn't, every `auditWrite` for that new target type 23514s. Calling out because audit-log silent failure (`void auditWrite(...)` patterns elsewhere) means the breakage might not be loud.

Fix: pin the migration drift -- a Vitest test that reads `AUDIT_TARGET_VALUES` at runtime, queries `pg_constraint` for the current `audit_log_target_type_check` definition, and asserts the constant set is a subset of the DB-enforced set.

### NIT: `Cookies.delete` on logout uses `path: '/'` only -- cookies set with other paths leak

File: `libs/auth/src/logout.ts:30-32`, `libs/auth/src/cookies.ts:88-95`

Problem: `cookies.delete(name, { path: '/', ... })` only clears cookies whose `Path` attribute was `/`. Better-auth's defaults match (path: '/') so today this is correct. If a future plugin ever sets a cookie at `path: '/api/auth'`, the logout-time clear won't match. DiD gap, not a bug.

Fix: add a comment in `clearSessionCookies` pinning the assumption ("better-auth's session cookies are always Path=/; if a plugin emits a path-scoped cookie, add it explicitly to SESSION_COOKIE_NAMES and adjust the path here").

### NIT: HSTS preload directive may strand the deployment if a domain change is needed

File: `apps/study/src/hooks.server.ts:51-52`, `apps/hangar/src/hooks.server.ts:82-83`

Problem: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` sets a 2-year HSTS with preload. Once the domain is on the Chrome HSTS preload list, every subdomain is HTTPS-locked for the duration. For a private/all-rights-reserved hosted-only product this is probably the right call -- but the `preload` token is a one-way door. Worth pinning explicitly in an ADR.

Fix: capture the HSTS preload commitment (and the cookie cross-subdomain commitment to `.air-boss.org`) in an ADR. The `preload` directive is fine; the documentation around it is what's missing.

### NIT: `requestId` accepts arbitrary 64-char ASCII without further structure

File: `apps/study/src/hooks.server.ts:26-32`, `apps/hangar/src/hooks.server.ts:58-64`, `apps/sim/src/hooks.server.ts:13-19`, `apps/avionics/src/hooks.server.ts:13-19`

Problem: `REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/` lets a client supply any 64-char alphanumeric+`_-` string as `x-request-id`, which is then echoed in the response and propagated into log lines (`log.info`). Logs are JSON; the value lands as a quoted string field, so structured-log injection is closed. Echoing the ID as a response header lets a malicious caller make their request indistinguishable from another's -- but since the ID is just a correlation handle and not auth-bearing, this is a deception surface, not an exploit. Belt-and-braces: prefer to always generate the ID server-side and ignore the inbound header, or stamp both ("x-request-id-server" + "x-request-id-client") so the audit trail can correlate to client-supplied IDs without trusting them.

Fix: rename the helper to `acceptOrGenerateRequestId` and write a comment that the inbound value is correlation-only, never trust-bearing.

### NIT: Hooks degrade-on-DB-failure path leaves `event.locals.user = null` but still serves the page

File: `apps/study/src/hooks.server.ts:121-131`, `apps/hangar/src/hooks.server.ts:145-153`, `apps/sim/src/hooks.server.ts:66-72`, `apps/avionics/src/hooks.server.ts:65-71`

Problem: When `auth.api.getSession` throws (DB flapping), the catch sets `locals.user = null` and lets the page render. For anonymous routes (login) this is correct -- the comment says so. For authenticated routes, the page-level `requireAuth` then redirects to login, so the request loops to login. If login itself can't reach the DB to validate the password, the loop converts a DB blip into a user-facing "you are signed out" experience, which is then audit-invisible (per the no-login-audit finding above). Not a vulnerability; a UX/operational gap that intersects security because it eats the audit signal a real attacker would otherwise leave.

Fix: when `getSession` throws because of DB unavailability (not "no session present"), surface a 503 / "service degraded" page instead of treating the user as anonymous. Distinguish the two cases in the catch (better-auth throws different shapes for "no session" vs "DB error"). Tie this to the audit-on-login fix so the audit log gets the "session lookup failed" record.
