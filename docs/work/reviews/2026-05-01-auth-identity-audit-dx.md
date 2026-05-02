---
feature: auth-identity-audit
category: dx
date: 2026-05-01
branch: main
status: unread
review_status: pending
counts:
  critical: 0
  major: 4
  minor: 6
  nit: 4
  total: 14
---

## Summary

Auth and audit are mostly in solid 2am-shape: every login/logout path threads `requestId` into structured logs, the cookie-clear path runs in `finally` so a failed sign-out still ends signed-out, the rate-limit story is documented and exercised by an integration test that survives a "process restart", and `auditWrite` accepts an explicit `db` so writes commit transactionally with the mutation they describe. Error messages on the user-visible auth path are also defensive (no internal error text, raw email redacted from logs). The gaps that remain are operability gaps, not correctness ones:

- Sim and avionics swallow session-lookup errors silently. When `event.locals.user` mysteriously goes null in prod, on-call has nothing to grep.
- Logger has no transport for `metadata` in pretty mode beyond a single un-prefixed line; structured fields like `path`, `status`, `ms` lose their request correlation in dev because `meta:` is logged as a separate console line.
- The `userId: undefined` rewrite in the JSON logger silently drops anonymous-request correlation, but `name` (anonymous) and `path` are not in the structured shape, so anonymous-request spelunking has to be done by `requestId` alone.
- `clearSessionCookies` has a hard-coded list of two cookie names. If better-auth adds a third (it has done this between versions), logout will leak it forever and there is no test that catches the drift.
- Cross-app drift: identical `$lib/server/auth.ts` and `$lib/server/cookies.ts` shims in study and hangar; sim and avionics duplicate the 25-line user-hydration block that hooks.server.ts in study/hangar already has, with subtle behavior drift (silent vs logged catch).
- One naming / comment papercut: the action `requireRole` returns user but never says it returns the user that matched the role, and `requireVerifiedEmail` is documented as "not wired into any route today" - that is a dead-code smell on a chokepoint, not a feature.

No critical findings. Logging and error paths are sound; the issues below are about making the next 2am call faster, not about whether the call is recoverable today.

## Issues

### MAJOR: sim and avionics hooks silently swallow session-lookup errors

File: `apps/sim/src/hooks.server.ts:66`, `apps/avionics/src/hooks.server.ts:65`

Problem: Both apps' `try { auth.api.getSession(...) } catch { event.locals.session = null; event.locals.user = null; }` blocks have a bare `catch` with no logger call and no `requestId` correlation. The same code in study/hangar logs `'session lookup failed'` with `requestId`, `path`, and the underlying error. When a learner reports "I'm signed in on study but sim says I'm not", on-call has zero signal in the sim logs to distinguish "DB flap during session lookup", "cookie domain misconfigured", "better-auth raised on a malformed session row", or "the session legitimately expired". The justifying comment ("Degrade gracefully") describes the user-facing behavior but ignores the operability cost.

Fix: Mirror the study/hangar pattern - import `createLogger` and `createErrorHandler`, instantiate `const log = createLogger('sim')` (and `'avionics'`), and replace the bare `catch` with `catch (err) { log.error('session lookup failed', { requestId, metadata: { path: event.url.pathname } }, err instanceof Error ? err : undefined); ... }`. Also add the `handleError` export so SvelteKit-level errors flow through the same logger.

### MAJOR: clearSessionCookies hard-codes the better-auth cookie name list

File: `libs/auth/src/logout.ts:17`

Problem: `SESSION_COOKIE_NAMES = [BETTER_AUTH_COOKIES.SESSION_TOKEN, BETTER_AUTH_COOKIES.SESSION_DATA]` is a manually maintained list. Better-auth has added cookies between minor versions (e.g. `dont_remember`, `csrf_token` in some configurations); when that happens, sign-out will silently leak whichever new cookie the lib added because we never iterate over the current cookie jar. There is no test that fails on drift - the rate-limit test exercises sign-in but no test exercises sign-out and asserts the post-logout cookie set is empty. At 2am, "I clicked sign out and `request.headers.cookie` still says I'm logged in" is a hard bug to reproduce locally because dev and prod cookie sets differ.

Fix: Either (a) walk `cookies.getAll()` and delete every cookie whose name starts with `better-auth.` / matches a known-prefix pattern, or (b) add a unit test that pins the better-auth cookie set the lib emits on sign-out (snapshot test against `auth.api.signInEmail` -> `auth.api.signOut` headers). Option (a) is more robust; option (b) at least breaks loudly on upgrade.

### MAJOR: study and hangar hooks duplicate ~80 lines of session-hydration verbatim

File: `apps/study/src/hooks.server.ts:64-163`, `apps/hangar/src/hooks.server.ts:95-185`

Problem: The two `handle` functions are line-for-line identical from `requestId` resolution through `applySecurityHeaders` through the `log.info` access-log line, except the `log = createLogger(...)` tag and the auxiliary boot block (study's `maybeRunDiscovery`, hangar's `bootWorker`). Sim and avionics also duplicate the user-hydration block but with a silently-failing catch. The DX cost is that any auth change has to be applied four times and easily skews (the existing skew is the silent catch in sim/avionics noted above; another skew is that study and hangar log access lines but sim and avionics do not). When investigating a regression, "is this behavior consistent across surface apps?" is currently a per-app code read.

Fix: Extract `createAuthHandle({ logger, transformPageChunk?, onUserHydrated? })` in `@ab/auth` and let each app compose: `export const handle = sequence(authHandle, themeHandle, appSpecificHandle)`. This is also called out in the existing `2026-04-27-full-codebase-architecture.md` review on the `getAuth()` factory; the same closure pattern fits the hooks themselves. Deferring is fine, but the convergent finding should land as one fix when it does.

### MAJOR: requireVerifiedEmail is unused dead code on a security chokepoint

File: `libs/auth/src/auth.ts:101`

Problem: The JSDoc says "Not wired into any route today - no current route demands `emailVerified === true` - but declared here so the first admin / sensitive-write route adds one line". Per project rules ("zero tolerance for known issues", "no legacy in airboss - retire on sight"), an unused security guard is a known issue. It also fails the 2am test: when an admin route lands and the author copies the snippet from the JSDoc, they have no way to know whether the comment is still accurate or whether the function was secretly retired. The risk is that an unused guard rusts and stops doing what its name says (e.g. the `email_verified` column gets a default `true` migration somewhere and the check becomes a no-op without anyone noticing).

Fix: Delete it. The first admin route that genuinely needs the gate can write the four-line check (`if (!user.emailVerified) error(403, ...)`) inline, or re-introduce the helper at that point with a real call site and a real test. Don't ship an unwired chokepoint with a "but it's documented" defense.

### MINOR: pretty-mode logger drops metadata onto a separate console.log line

File: `libs/utils/src/logger.ts:76`

Problem: In dev (non-prod), the formatter emits the main line via `console.log(line)` and `metadata` via a follow-up `console.log('  meta: ${JSON.stringify(...)}')`. When two requests interleave (e.g. background job tick + interactive request), the `meta:` line for request A can land between the main line for request B and B's `meta:` line, breaking the `requestId` -> `metadata` correlation that was the whole point of structuring it. Also, the access-log line `${method} ${path} ${status}` has its `ms` measurement only in `metadata`, so reading the dev console gives "GET /memory 200 req=abc" with no latency until you eyeball the meta line two log entries later.

Fix: Either inline `metadata` into the formatted line (`${ts} [${app}] INFO GET /memory 200 req=abc ms=42`) or use one `console.log` call with all fields concatenated so atomicity is preserved. The structured-prod path is fine; this is a dev-debugging papercut.

### MINOR: anonymous request access-log lines have userId omitted but no anonymous-request marker

File: `libs/utils/src/logger.ts:58`, `apps/study/src/hooks.server.ts:158`

Problem: The access-log line in `handle` uses `userId: event.locals.user?.id ?? null`. When the user is anonymous, `null` is normalized to `undefined` in `formatPretty` (no `uid=` suffix) and to `omitted` in JSON. That means a 2am `grep "uid="` in dev to find a learner's session reveals nothing for anonymous requests, which is fine - but a 2am query "who hit /login in the last hour, broken down by anonymous vs authenticated" can't be written from the JSON logs because the field is absent in both the anonymous case and (if a future caller forgets to thread `userId` in) the broken case. There's no way to tell "no userId because the request was anonymous" from "no userId because the call site forgot the field".

Fix: Either log `userId: 'anonymous'` for the explicit-anonymous case, or add a sibling `authenticated: boolean` field to the access-log entry so the negative case is positively recorded. The JSON shape is the load-bearing one; the pretty mode can stay as-is.

### MINOR: login action conflates 401 and other non-OK statuses into "Invalid email or password"

File: `apps/study/src/routes/login/+page.server.ts:80`, `apps/hangar/src/routes/login/+page.server.ts:67`

Problem: After `if (authResponse.status === 429)`, the catch-all is `return fail(authResponse.status === 401 ? 401 : 400, { error: data?.message ?? 'Invalid email or password', email })`. Better-auth returns 403 for banned users (`session.banned` path), 400 for malformed input, and other 4xx for verification states; those all become "Invalid email or password" to the user. From a DX perspective the dev side is the issue: there's no `log.warn` of the non-OK better-auth response, so when a learner reports "I'm getting bad-creds errors but I know the password is right" on-call has no signal beyond the 429 / 401 / 400 status code that leaked through `data?.message` (which can also be null). A banned user silently looks identical to a wrong-password user in the logs.

Fix: Add `log.warn('login non-ok response', { requestId: locals.requestId, metadata: { status: authResponse.status, betterAuthMessage: data?.message } })` immediately before the `fail(...)` returns. Keep the user-facing message generic to avoid identity-enumeration; the dev-side signal is what's missing today.

### MINOR: handleError safe-message-for-status doesn't cover 429

File: `libs/utils/src/error-handler.ts:20`

Problem: `safeMessageForStatus(429)` falls through to "An unexpected error occurred". Rate-limited responses thrown via `error(429, ...)` (a future addition - sign-in already returns `fail(429)`, but other surfaces could `throw error(429)`) will render as a generic 5xx-style message to the user, which is the wrong UX (the right message is "Too many requests, please slow down") and the wrong DX (a real 5xx and a 429 read identically in the SvelteKit error overlay).

Fix: Add `if (status === 429) return 'Too many requests, please slow down'` to `safeMessageForStatus`. While there, consider 400 ("Invalid request") and 410 if any future flow needs it; the table is small and the cost of an extra branch is zero.

### MINOR: auditWrite swallows the actor-id provenance behind "actorId: string | null"

File: `libs/audit/src/log.ts:18`

Problem: `actorId: string | null` is correct as a column type but ambiguous as a function parameter: `null` could mean "system action with no actor" or "the caller forgot to thread the user through". There is no runtime check, no comment in the function signature, and no `metadata.systemSource` convention. When a 2am query "who deleted this row?" returns `actor_id IS NULL`, on-call has to grep call sites to figure out whether that's a migration (legitimate null) or a forgotten `requireAuth` (bug). The schema file documents the convention but the function takes the same shape with no enforcement.

Fix: Make the system-vs-user distinction explicit at the call boundary - either a discriminated union (`{ actor: { kind: 'user'; userId: string } | { kind: 'system'; source: string } }`) or a required `metadata.systemSource` when `actorId` is null, validated in `auditWrite`. This is also a mild correctness gap (today you can pass `actorId: null` from any path with no audit-side signal that the call site is broken).

### MINOR: countAllUsers helper has no banned/deleted-user filter and the comment doesn't say so

File: `libs/auth/src/queries.ts:15`

Problem: The function's JSDoc says "Count of all `bauth_user` rows (no filter)". On the hangar admin home this becomes the "users" tile - but it counts banned and (when soft-delete lands) deleted users. At 2am when an admin asks "why does the dashboard say 1,200 users when active sessions show 800", the helper's name is the only signal and "All" is doing a lot of work. The test `queries.test.ts` calls it `countAllUsers` and asserts non-negative integers, so any future "active only" semantics shift would be silent.

Fix: Either rename to `countAllUsersIncludingBanned` (the verbose name documents itself), or split into `countActiveUsers` and `countBannedUsers` and let the dashboard sum them. The 2am cost of the rename is one find-replace; the cost of the silent semantics drift is harder to bound.

### NIT: requireRole JSDoc doesn't mention the redirect-to-login path

File: `libs/auth/src/auth.ts:79`

Problem: The JSDoc says "Guard: require one of the specified roles". The first thing the function does is call `requireAuth`, which redirects to `/login`. A reader skimming the JSDoc to understand "what does this throw?" sees only the 403 path. Test `requireRole > redirects to login first when not authenticated` verifies the behavior, so it's correct - but the doc should match.

Fix: Add one line: "If the user is not authenticated, redirects to `/login` first; otherwise throws 403 if the role does not match."

### NIT: forwardAuthCookies has a `decodeCookieValue` fallback that silently swallows decoding errors

File: `libs/auth/src/cookies.ts:53`

Problem: `try { return decodeURIComponent(raw) } catch { return raw }` is a reasonable defensive fallback, but the catch swallows the parse error with no logger. If better-auth ever emits a malformed `Set-Cookie` (or a future cookie value contains an unescaped `%` byte), the silent fallback writes the raw form to the browser and the symptom surfaces only when the next request fails to parse the same cookie back. There's no log-quality signal that the fallback fired.

Fix: At minimum, add a `console.warn` (or pass a logger through) when the catch fires. Even a one-line `// FIXME: log if this catch fires` would help the next reader see that the silent path is intentional.

### NIT: AUDIT_TARGETS keeps a retired enum value with a "do not reuse" comment

File: `libs/constants/src/audit.ts:22`

Problem: `HANGAR_PING: 'hangar.ping'` is documented as "retired scaffold-era heartbeat" with a "do not reuse this string" warning. The audit_log CHECK constraint requires it to stay (append-only data), but the JS-side enum doesn't - the constant could be deleted from `AUDIT_TARGETS` and the constraint would still allow `'hangar.ping'` because `AUDIT_TARGET_VALUES` is what feeds the constraint. Keeping a retired value as a normal-looking enum entry is a 2am hazard: a new author copying the AUDIT_TARGETS list as a "menu of valid actions" picks up the retired one. The "do not reuse" comment depends on every reader noticing the comment.

Fix: Move `HANGAR_PING` to a sibling `AUDIT_TARGETS_RETIRED` constant so `AUDIT_TARGETS` only lists current-use targets, and union both into `AUDIT_TARGET_VALUES` for the DB CHECK. Tests in `libs/audit/src/log.test.ts` would import from the right side. The retire-on-sight rule applies to JS-visible surface; the CHECK constraint can keep the historical superset.

### NIT: rate-limit test uses a random IP and "should not collide" reasoning

File: `libs/auth/src/rate-limit.test.ts:32`

Problem: `const SUITE_IP = \`198.51.100.${Math.floor(Math.random() * 250) + 2}\`` is documented as "random so parallel test runs don't share a rate-limit bucket". Random-per-suite is fine, but a 1/250 collision in CI when two PRs land in parallel will read as a flaky test ("rate limit was already exhausted from another suite"). The afterAll cleanup is keyed on `like('%${SUITE_IP}%')` which means a collision would also clean up the other suite's row mid-run. Running the test under high concurrency would surface this as "sometimes the second test fails because the row was wiped".

Fix: Either widen the IP space (`198.51.100.${...}` is a /24, but `198.18.0.0/15` is a far larger TEST-NET-2 block reserved for benchmarking) or stamp a per-process suffix into the rate-limit key via a custom `getIp` so collisions are statistically zero. Low priority because CI rarely runs this suite in parallel, but the assumption is load-bearing for test isolation.
