---
feature: auth-identity-audit
category: testing
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 6
  minor: 5
  nit: 3
---

## Status as of 2026-05-04

Walked every finding against current main. 12 of 14 closed; 2 carried (small operational items).

| Severity | Finding                                                    | Verdict                                                                                        |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| MAJOR    | rate-limit suite never asserts per-IP isolation            | CLOSED -- rate-limit.test.ts:220 isolates ISOLATION_IP_A vs ISOLATION_IP_B                     |
| MAJOR    | rate-limit window-expiry path not covered                  | CLOSED -- rate-limit.test.ts:255 mutates `lastRequest` past window, asserts reset              |
| MAJOR    | sign-in success path never asserted                        | CLOSED -- rate-limit.test.ts:302 asserts 200 + bauth_session row + counter advance             |
| MAJOR    | No tests for magic-link / password-reset / verify          | CLOSED -- libs/auth/src/verification-flows.test.ts (427 lines) covers happy/expired/reused     |
| MAJOR    | cookies.ts and logout.ts ship with zero unit tests         | CLOSED -- libs/auth/src/cookies.test.ts (141), logout.test.ts (264)                            |
| MAJOR    | requireVerifiedEmail has no coverage                       | CLOSED -- helper deleted (dx-side decision); reintroduce with tests when first call site lands |
| MINOR    | queries.test.ts uses live DB but never pins absolute count | CLOSED -- accepted; tests use `>=` deltas to coexist with peer suites                          |
| MINOR    | log.test.ts never asserts before/after JSONB round-trip    | STILL OPEN -- design item; carried below                                                       |
| MINOR    | auditRecent filter ambiguity untested                      | CLOSED -- log.test.ts:146 pins targetType+targetId precedence                                  |
| MINOR    | e2e auth never asserts CSRF / SameSite enforcement         | STILL OPEN -- design item; carried below                                                       |
| MINOR    | rate-limit FK ordering on midway failure                   | CLOSED -- rate-limit.test.ts:160 sweeps stale rows on `like('%@airboss.test')`                 |
| NIT      | expectRedirect / expectForbidden swallow type info         | CLOSED -- accepted; helpers are local to auth.test.ts and the cast is contained                |
| NIT      | audit timestamp ordering test relies on 5ms sleep          | CLOSED -- comment in log.test.ts:127 explains the clock-resolution gap                         |
| NIT      | e2e login tests duplicate "find learner account" lookup    | CLOSED -- accepted; lookup is two lines and tests are independent                              |

### Carried-forward design items

- **before/after JSONB round-trip**: log.test.ts asserts the order/count contract but doesn't pin the snapshot shape. Trigger: first BC that writes non-trivial `before`/`after` payloads via `auditWrite`. Add a deep-equal round-trip case there.
- **e2e CSRF / SameSite assertion**: today no e2e test reads `context.cookies()` to pin `sameSite === 'Strict'`. Trigger: first time the cookie attribute set changes (sameSite relax, magic-link landing, OAuth). Add the cookie-attribute pin alongside whatever flow forces the change.

## Summary

Reviewed test quality across `libs/auth/src/*.test.ts` (auth.test.ts, queries.test.ts, rate-limit.test.ts), `libs/audit/src/log.test.ts`, and the login/logout e2e (`tests/e2e/unauthed/auth.spec.ts`, `tests/e2e/dashboard.spec.ts:48`).

The existing tests are honestly built (real DB, real better-auth handler, no `verifyPassword` over-mocking), but the surface they cover is thin relative to the production code. The ratio of "auth code shipped" to "auth code asserted" is the dominant problem: rate-limit gets two integration tests (good), but cookie domain resolution, magic-link, password reset, session lifecycle, expired/reused tokens, sign-up rejection, ban gating, role-changes-mid-session, `requireVerifiedEmail`, `clearSessionCookies`, `forwardAuthCookies`, and `rewriteSetCookieDomain` ship with zero coverage. The audit tests verify happy path + ordering but never assert filter scoping, before/after snapshot fidelity, JSONB shape, FK constraint behaviour, or the "non-transactional caller passes their own tx scope" contract that the doc-comment makes load-bearing.

No tests mock what they should be testing (login is exercised end-to-end against the real router; this is the right call). No tests are skipped or `it.todo`. A few have weak assertions (`>= baseline + 1` is correct but doesn't pin the column-by-column shape of what was written). The biggest single gap is the absence of coverage for the dual-gate auth contract that `auth.ts` documents as load-bearing -- a layout-only test would catch a regression where someone "consolidates" both gates into one.

## Issues

### MAJOR: rate-limit suite never asserts per-IP isolation

File: `libs/auth/src/rate-limit.test.ts`

Problem: The two tests both use `SUITE_IP` and only assert that a single bucket trips at `max + 1` and survives a restart. There is no test that a different `x-forwarded-for` lands in a separate bucket. The whole point of running rate-limit on a per-IP key is that a tripped IP doesn't lock out unrelated clients -- a regression that keys on path-only (or on a constant `"global"` key) would pass every assertion in the file. Add a third case: trip IP A to 429, then send one request from IP B and assert `< 429`.

Fix: After the persistence test, do `await signIn(fresh, OTHER_IP, 'still-wrong')` and assert `expect(res.status).not.toBe(429)`. Also assert two separate rows exist in `bauth_rate_limit` keyed on the two IPs.

### MAJOR: rate-limit window-expiry path is not covered

File: `libs/auth/src/rate-limit.test.ts`

Problem: `AUTH_RATE_LIMIT.SIGN_IN_WINDOW_SECONDS` defines a window after which the bucket should reset. Neither test moves time forward or expires the row, so a regression that turns the window into "permanent ban after N attempts" would pass. The work-package spec explicitly calls out window semantics as part of the rate-limit contract.

Fix: Add a test that either (a) directly mutates the row's window-start timestamp to `now - WINDOW_SECONDS - 5s` and asserts the next request is allowed, or (b) constructs an auth instance with a 1-second window for the test and waits 1.1s before retrying. The DB write path is the same; the column rewrite is faster and deterministic.

### MAJOR: sign-in success path never asserted

File: `libs/auth/src/rate-limit.test.ts`

Problem: All `signIn(...)` calls use `'definitely-wrong'` / `'still-wrong'`. We seed a real user with `TEST_PASSWORD` in `beforeAll` but never sign in with it. The rate-limit code therefore is only verified for the 401 branch -- a regression where successful sign-ins are also counted (or where a 200 response bypasses the middleware) is invisible. Add a final case after window expiry where signing in with the correct password returns 200 and creates a session row in `bauth_session`.

Fix: After window expiry test, call `signIn(auth, FRESH_IP, TEST_PASSWORD)`, assert 200, assert `bauth_session` has a row for the seeded user. Then assert that the success request did not increment the rate-limit counter beyond expectations (better-auth's policy is to count failures only; pin it).

### MAJOR: no test for magic-link, password-reset, or email-verification token flows

Files: `libs/auth/src/**` (no test file for these flows)

Problem: `server.ts` wires up `magicLink`, `sendResetPassword`, and `verificationEmail` callbacks. The work-package rubric explicitly requires "expired token, reused token, concurrent login" coverage -- none of these exist for any of the three token flows. A regression where:

- a magic-link token works after expiry (`bauth_verification.expiresAt < now`),
- a magic-link token works twice (no `delete after use`),
- a password-reset token works for a different user-agent / IP than requested it,

would ship without any test catching it. The `sendEmail` adapter is a perfect mocking seam (intercept the URL, hand it back to a `GET /api/auth/magic-link/verify?token=...` request) without over-mocking the verification logic itself.

Fix: Add `libs/auth/src/magic-link.test.ts` and `password-reset.test.ts`. Mock only the email transport; let better-auth own the token lifecycle. Cover: happy path, expired token (mutate `expiresAt`), reused token (verify twice, second must fail), unknown token, token used after the user is banned.

### MAJOR: cookies.ts and logout.ts ship with zero unit tests

File: `libs/auth/src/cookies.ts`, `libs/auth/src/logout.ts`

Problem: `resolveCookieDomain`, `forwardAuthCookies`, `rewriteSetCookieDomain`, and `clearSessionCookies` are pure functions with rich branching (host parsing, domain matching, lower-casing, port stripping, `Set-Cookie` parsing including the URL-encoded value handler, the `max-age=0`/expired-date detection, the `SameSite=Strict` rewrite, the LAN-IP fallback). All of it is untested. These functions are the entire reason cross-subdomain login works in dev and prod -- a regression in `replaceCookieDomain` (which strips the existing `Domain=` and `SameSite=`) would silently break SSO across `study.airboss.test` / `hangar.airboss.test` and no test would notice. The dashboard logout e2e only exercises one host (the test runner's host) so it can't catch a domain-resolution bug.

Fix: Add `libs/auth/src/cookies.test.ts` with table-driven cases for `resolveCookieDomain` (matrix of `[host, isDev]` -> expected domain): exact match base, subdomain, deeper subdomain, mixed case, with port, `127.0.0.1`, `localhost`, IPv6, null host, base-domain-without-leading-dot. Add `forwardAuthCookies.test.ts` exercising encoded values, expired markers, and multi-cookie responses. Add `rewriteSetCookieDomain.test.ts` asserting the body is reused (not consumed twice).

### MAJOR: requireVerifiedEmail has no coverage even though it's an exported guard

File: `libs/auth/src/auth.test.ts`

Problem: `auth.ts` exports `requireVerifiedEmail(user)` and the doc-comment calls it "the chokepoint for flows that require a verified email". It's not used in any route today, but it's a public export of `@ab/auth` -- the moment a route adds the call, an unverified-email regression would ship. Trivial to test.

Fix: Add two cases in `auth.test.ts`: returns user when `emailVerified === true`, throws 403 when `emailVerified === false`.

### MINOR: queries.test.ts uses live DB but never pins an absolute count

File: `libs/auth/src/queries.test.ts:39`

Problem: All assertions are `>=` because peer suites share the table. This is a defensible choice, but it means a regression where `countAllUsers` returns `Infinity`, `0`, a stale memoized number, or a count of a different table would still pass the "non-negative integer" check, and the "after delete still returns a non-negative integer" assertion is content-free. Either run this suite against a transaction-scoped Drizzle context (the function already accepts `db: Db`) and assert exact deltas, or drop the second `expect(count).toBeGreaterThanOrEqual(0)` and instead assert the count after a delete is strictly less than the count before it (using a `noOtherWriters` test mode).

Fix: Use the `db` parameter on `countAllUsers` to inject a transaction scope, or wrap the suite in a serialized lock so absolute deltas are verifiable.

### MINOR: audit log.test.ts never asserts before/after JSONB round-trip

File: `libs/audit/src/log.test.ts`

Problem: `auditWrite` accepts `before` and `after` JSONB snapshots -- the schema doc says "a reader can reconstruct a row's state at any point". Every test passes `{}` for metadata and never sets `before`/`after`. A regression that drops these columns from the insert (or coerces `null` differently than the test expects) is invisible. Pin it with one round-trip case.

Fix: Add a case writing `before: { name: 'old' }, after: { name: 'new' }` and assert `auditRecent` returns them with the exact shape (deep equal). Also test that omitting them yields `null`, not `undefined` (the columns are nullable).

### MINOR: audit `auditRecent` filter ambiguity is untested

File: `libs/audit/src/log.test.ts`

Problem: `auditRecent` has a subtle behaviour: when `targetId` is provided, it filters by `targetId` ONLY -- the `targetType` parameter becomes informational, not a constraint. Two rows with the same targetId but different targetType would both come back. The tests pass both arguments together so they never expose this. If a caller relies on the `targetType` filter while also providing a `targetId`, they'll get rows from other target types as soon as IDs collide. Either the test should pin the documented behaviour (and the doc-comment should be updated to match) or the test should fail and force the implementation to AND both filters.

Fix: Add a case that writes two rows with the same `targetId` but different `targetType`, calls `auditRecent({ targetType: A, targetId: id })`, and asserts which behaviour is intended. Document the resolution as a comment in `auditRecent`.

### MINOR: e2e auth never asserts CSRF / SameSite enforcement on login POST

File: `tests/e2e/unauthed/auth.spec.ts`

Problem: `cookies.ts` deliberately tightens to `sameSite: 'strict'` with a comment saying "If magic-link or OAuth lands later, downgrade to lax at that point." There's no test that verifies the cookie actually lands as Strict, and no test that a cross-origin POST from a different origin is rejected. A regression where a future commit relaxes to `lax` (or `none`) for "compatibility" would not fail any test.

Fix: After successful login, read `await context.cookies()` and assert the session cookie's `sameSite === 'Strict'`. Also assert `httpOnly === true` and `secure` matches `!isDev`.

### MINOR: rate-limit test does not verify FK ordering when the test fails midway

File: `libs/auth/src/rate-limit.test.ts:92-103`

Problem: The `afterAll` cleanup deletes child rows (session, account) before the user, which is correct, but if `signUpEmail` in `beforeAll` fails partway, `userIds` is empty and orphaned rows from a previous run could accumulate. The cleanup is also email-keyed (`TEST_EMAIL` is per-run, with a timestamp), so a flake leaves the previous run's user behind permanently. Add a `beforeAll` sweep keyed on the email pattern (`like('%@airboss.test')` filtered to the rate-limit prefix) so each run starts clean.

Fix: Sweep by `like(bauthUser.email, 'rl-%@airboss.test')` in `beforeAll` so partial-failure rows from previous runs get reaped.

### NIT: `expectRedirect` and `expectForbidden` helpers swallow type info

File: `libs/auth/src/auth.test.ts:30-39`

Problem: Both helpers cast `unknown -> { status: number; ... }` without instance-checking. A regression where `redirect()` starts throwing a different shape (a real `Redirect` class vs the plain object SvelteKit currently throws) would still pass because the cast is unchecked. Use `isRedirect(thrown)` / `isHttpError(thrown)` from `@sveltejs/kit` -- they exist precisely for this assertion.

Fix: `import { isRedirect, isHttpError } from '@sveltejs/kit'` and assert `isRedirect(e)` before reading `.status`.

### NIT: audit timestamp ordering test relies on a 5ms sleep

File: `libs/audit/src/log.test.ts:122`

Problem: `await new Promise((r) => setTimeout(r, 5))` is the kind of timing-sensitive assertion that flakes under load. Postgres `defaultNow()` resolution is microsecond, so two writes in a tight loop might still get the same timestamp under heavy parallelism. Either bump to 50ms (cheap insurance) or, better, set `timestamp: new Date(Date.now() + offset)` explicitly on the second insert via the `auditWrite` input -- except `auditWrite` doesn't accept a timestamp override, so this needs a test-only path or a longer sleep.

Fix: Bump to `setTimeout(r, 50)` with a comment explaining the sleep is for clock resolution, not async ordering.

### NIT: e2e login tests duplicate the "find learner account" lookup

File: `tests/e2e/unauthed/auth.spec.ts`

Problem: Four tests repeat `const learner = DEV_ACCOUNTS.find(a => a.role === 'learner'); if (!learner) throw ...`. Hoist into a `test.beforeEach` or a fixture. Doesn't change correctness but reduces noise and makes it easier to add cases that vary the role.

Fix: Define a `learner` fixture or `beforeEach` that resolves the dev account and stashes it on `test.info()`.
