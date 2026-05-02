---
feature: auth-identity-audit
date: 2026-05-01
branch: main
reviewers_run: 10
total_issues: 119
critical: 4
major: 35
minor: 50
nit: 30
---

# 10x Review -- Chunk 3: auth, identity, audit

10 reviewers, all complete. **The security-critical chunk** -- 4 criticals.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total | File |
|--------------|---------:|------:|------:|----:|------:|------|
| correctness  |        1 |     4 |     5 |   3 |    13 | [link](2026-05-01-auth-identity-audit-correctness.md) |
| security     |        1 |     5 |     7 |   4 |    17 | [link](2026-05-01-auth-identity-audit-security.md) |
| perf         |        0 |     3 |     5 |   3 |    11 | [link](2026-05-01-auth-identity-audit-perf.md) |
| architecture |        0 |     1 |     4 |   3 |     8 | [link](2026-05-01-auth-identity-audit-architecture.md) |
| a11y         |        0 |     2 |     5 |   4 |    11 | [link](2026-05-01-auth-identity-audit-a11y.md) |
| patterns     |        0 |     2 |     4 |   2 |     8 | [link](2026-05-01-auth-identity-audit-patterns.md) |
| testing      |        0 |     6 |     5 |   3 |    14 | [link](2026-05-01-auth-identity-audit-testing.md) |
| dx           |        0 |     4 |     6 |   4 |    14 | [link](2026-05-01-auth-identity-audit-dx.md) |
| schema       |        2 |     4 |     3 |   2 |    11 | [link](2026-05-01-auth-identity-audit-schema.md) |
| backend      |        0 |     4 |     5 |   3 |    12 | [link](2026-05-01-auth-identity-audit-backend.md) |
| **TOTAL**    |    **4** |**35** |**49** |**31**|**119**| |

## CRITICAL findings (4) -- read these first

### 1. (security) Public sign-up is enabled on a private product

`libs/auth/src/server.ts:132-139` ships `emailAndPassword.enabled: true` with no `disableSignUp` and `requireEmailVerification: false`. `/api/auth/sign-up/email` is unguarded -- anyone with the URL can register. Seed script doesn't depend on the public endpoint. **Fix is one line.**

### 2. (correctness) `forwardAuthCookies` extends short-lived cookies to 7 days

`libs/auth/src/cookies.ts:34-49, 74-96` overrides every Set-Cookie's `Max-Age` with `SESSION_MAX_AGE_SECONDS` (7 days). Better-auth issues `bauth_session_data` with `Max-Age=300` (5 min) for the cookie-cache; we silently extend it 2,016x. **Neutralizes ban/role-change propagation -- a banned user stays cached for up to 7 days instead of the documented 5 minutes.** Stacks with the security finding below: at base, banned-user ban-propagation is gated by 5-min cache, but this bug extends it to 7 days.

### 3. (schema) `bauth_session.user_id` is unindexed

Every revoke/list operation seq-scans the session table. Better-auth ban-by-user, list-sessions, revoke-all-for-user all hit this column. Schema rubric explicitly calls it out.

### 4. (schema) `bauth_session.expires_at` is unindexed

Better-auth's session sweeper seq-scans the table on every tick. Append-only growing table. Confirmed against migrations 0000-0005 -- not added later.

## Convergent / root-cause findings

### Cross-app session-hydration drift (4 reviewers)
- **architecture (major)**: `hooks.server.ts` duplicated 4x with subtle drift -- sim/avionics swallow errors, study/hangar log; differing `Role` import-vs-import-type style.
- **patterns (major)**: 20-line `session.user -> AuthUser` mapping (with `as Record<string, unknown>` casts) byte-for-byte in all 4 hooks files.
- **backend (major)**: study + hangar login actions byte-for-byte duplicates; logout same. Violates "thin shells calling `@ab/auth`" rule.
- **dx (major)**: sim/avionics bare-catch with no logger; study/hangar log with `requestId`.
- **Root cause**: hoist `hydrateLocals(event, auth, log)` and `mapBetterAuthSession` and `handleEmailLoginAction(event, { logTag })` into `@ab/auth`. One extraction closes 4 majors across 4 reviewers.

### sim/avionics auth gaps (3 reviewers)
- **correctness (major)**: sim hooks hydrate `event.locals.user` but never check `banned` -- banned users keep full sim access while study/hangar reject them.
- **backend (major)**: avionics + sim populate `banned` but never short-circuit; avionics + sim omit security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, HSTS) that study/hangar emit. Same session cookie flows to those subdomains.
- **Root cause**: bring sim/avionics hooks up to study/hangar parity in the same `hydrateLocals` extraction.

### No audit emission on auth events (2 reviewers)
- **backend (major)**: audit schema explicitly carves out login as canonical `ACTION` row with nullable `actor_id` for failed sign-ins. Auth is the conspicuous gap. Hangar admin home cannot answer "who signed in", "is this email being brute-forced", "did admin log out before role change."
- **security (major)**: same finding -- brute-force traffic and bans invisible to the audit log explorer.
- **Root cause**: add `AUTH_LOGIN`/`AUTH_LOGOUT` to `AUDIT_TARGETS` + CHECK-constraint migration; emit `auditWrite` on login success/fail/lockout/banned-block/logout.

### Missing FK + lookup indexes (3 reviewers, 2 critical schema findings)
- **schema (critical x2)**: `bauth_session.user_id`, `bauth_session.expires_at` (above)
- **schema (major)**: `bauth_account.user_id`, `bauth_verification.identifier`, `audit_log.timestamp` standalone, `bauth_session.impersonated_by` is plain text with no FK back to `bauth_user`
- **perf (major)**: same set -- `bauth_session.user_id`, `bauth_account.user_id`, `bauth_account(provider_id, account_id)`, `bauth_verification.identifier` all unindexed despite being better-auth's routine lookup paths
- **perf (major)**: `audit_log.timestamp` -- `countAuditEntriesSince` cannot use existing composites (timestamp is trailing column)
- **perf (major)**: `auditRecent`'s targetType-only branch can't use existing composite for `ORDER BY timestamp DESC LIMIT N` because `target_id` separates equality column from sort column
- **correctness (major)**: `auditRecent` drops `targetType` filter when `targetId` supplied -- returns rows from any target type sharing the id (exposed by undocumented filter behaviour; testing minor flagged this too)
- **Root cause**: one schema migration adds the 5 missing indexes + FK on `impersonated_by`; one logic fix to `auditRecent` filter precedence.

### `clearSessionCookies` brittleness (2 reviewers)
- **correctness (major)**: cookie-clear detection relies on literal `'expires=thu, 01 jan 1970'` substring -- if better-auth changes format, "delete" silently turns into "set with 7-day TTL".
- **correctness (major)**: only enumerates two cookies; better-auth admin/magic-link plugins emit additional cookies that linger after logout.
- **dx (major)**: hard-coded two-name list; no test pins drift; better-auth adds cookies between minor versions.
- **Root cause**: rewrite cookie-clear to enumerate all `bauth_*` cookies on the request rather than a hard-coded list; add a test that pins better-auth's cookie surface.

### `cookieCache` ban-propagation window (2 reviewers, stacks with critical #2)
- **security (major)**: `cookieCache.maxAge: 5 * 60` means banned user keeps working up to 5 min.
- **correctness (critical)**: `forwardAuthCookies` extends this to 7 days (above).
- **Root cause**: fix critical #2 (cookie max-age override). After that, the 5-min cache is the documented expected window.

### Test coverage gaps (1 reviewer, broad)
- **testing (6x major)**: per-IP isolation in rate-limit not tested (would pass with global key); window expiry never exercised; sign-in success path never asserted (all attempts use wrong password); zero tests for magic-link / password-reset / email-verification token flows; `cookies.ts` and `logout.ts` ship without unit tests; `requireVerifiedEmail` exported but not tested.
- **dx (major)**: `requireVerifiedEmail` has **zero call sites** -- known-issue dead-code on sensitive surface.
- **Root cause**: testing the missing flows will surface whether `requireVerifiedEmail` should be wired or removed.

### XFF/proxy trust (1 reviewer)
- **security (major)**: `getClientAddress()` forwarded as XFF to better-auth's rate-limit bucket key with no proxy-trust validation. Misconfigured deploy = either share one bucket across all users (lockout amplification) or accept spoofed XFF (target-the-victim).

### Password-reset timing oracle (1 reviewer)
- **security (major)**: sync `sendResetPassword` callback only fires when user exists; SMTP latency observable. User-existence enumeration.

### Login a11y (1 reviewer)
- **a11y (major x2)**: failed-submit doesn't move focus (banner alone signals); H1 says "airboss" branding instead of "Sign in" (page purpose missing from heading semantics).

### Patterns minors
- **patterns (major)**: `requireAuth` builds `?redirectTo=` literal instead of using `QUERY_PARAMS.REDIRECT_TO` (which exists and consumers read).

### Hangar dev password leak
- **security (major)**: hangar login page prints `DEV_PASSWORD` to screen; study deliberately doesn't.

## What's clean (preserve)

- **architecture**: dep direction clean (`@ab/audit -> @ab/auth -> @ab/db/@ab/constants/@ab/utils`, nothing reverses); `better-auth` only imported in `libs/auth/src/server.ts`; admin user-writes correctly live in `@ab/bc-hangar`.
- **patterns**: all shared literals route through `@ab/constants` (`AUTH_INTERNAL_ORIGIN`, `BETTER_AUTH_ENDPOINTS`, `BETTER_AUTH_COOKIES`, `COOKIE_DOMAIN_*`, `SCHEMAS.AUDIT`, `AUTH_RATE_LIMIT.*`, `AUDIT_OPS`, `ROLES`, `ENV_VARS.*`, `MAIL_FROM_NOREPLY`, `SESSION_MAX_AGE_SECONDS`); ID generation centralized via `@ab/utils`; only `sql.raw` lives in audit's CHECK constraint and is fed from constants arrays; cross-lib imports exclusively `@ab/*`; login pages use design tokens.
- **security**: DB-backed rate limiting with process-restart proof test, strict-SameSite cookies, defence-in-depth cookie clear in logout `finally`, neutral 401 message, HTML-escaped email templates, CSP/HSTS/Permissions-Policy/X-Frame=DENY in study/hangar hooks, request-id inbound validation regex, no plaintext credentials in schema or logs.
- **testing**: real Postgres, real handlers; no mock-the-thing-you-test antipattern; rate-limit-survives-restart integration test; raw email redaction from login error logs.
- **dx**: `requestId` correlation across logger + access log + handleError; cookie-clear in `finally` defense-in-depth on logout; cross-subdomain cookie domain logic with explicit dev/host fallback in `resolveCookieDomain`.
- **a11y**: shared primitives (`TextField`, `Banner`, `Button`) carry the a11y weight correctly -- label association, `aria-invalid`/`aria-describedby` wiring, `role="alert"` on danger Banner, autocomplete tokens.
- **perf**: auth hot path itself is healthy -- `cookieCache` (5-min TTL) keeps `getSession` out of Postgres, `requireAuth` reads from `event.locals` only, audit writes single-row inserts inside caller's transaction.

## Recommended fix order

1. **Criticals first** (in order):
   - Disable public sign-up (one-line `disableSignUp: true`)
   - Fix `forwardAuthCookies` to NOT override `Max-Age` on cookies that better-auth set short
   - Add the 5 missing indexes + FK on `impersonated_by` in one migration
2. **Convergent root-causes** (one fix closes many):
   - Hoist `hydrateLocals` / `mapBetterAuthSession` / `handleEmailLoginAction` to `@ab/auth` (closes 4 majors across architecture/patterns/backend/dx + brings sim/avionics to parity)
   - Add `AUTH_LOGIN`/`AUTH_LOGOUT` to `AUDIT_TARGETS` + emit `auditWrite` on auth events (closes 2 majors)
   - Rewrite `clearSessionCookies` to enumerate all `bauth_*` request cookies + add test pin (closes 3 majors)
   - Fix `auditRecent` filter precedence (closes 2 findings)
3. **Targeted majors**: XFF proxy-trust validation; password-reset timing-oracle fix; hangar dev-password redaction; `requireAuth` `QUERY_PARAMS.REDIRECT_TO` use; `requireVerifiedEmail` wire-or-delete decision.
4. **Test coverage**: per-IP rate-limit isolation, window expiry, sign-in success path, magic-link/password-reset/email-verification token flows, `cookies.ts`/`logout.ts` unit tests, `auditWrite` JSONB round-trip.
5. **Login a11y polish**: focus on banner after failed submit, heading semantics for "Sign in".

## Severity guide

- **critical**: exploitable vuln, public-sign-up exposure, data integrity / index-missing on hot path, ban-propagation neutralized
- **major**: missing protection, won't-scale at expected load, drift across apps that breaks invariants, audit gap on regulated event
- **minor**: defense-in-depth gap, naming/comments, optional hardening
- **nit**: polish, style preference
