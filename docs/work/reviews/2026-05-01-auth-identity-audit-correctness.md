---
feature: auth-identity-audit
category: correctness
date: 2026-05-01
branch: main
status: unread
review_status: pending
counts:
  critical: 1
  major: 4
  minor: 5
  nit: 3
---

## Summary

Reviewed `libs/auth/src/`, `libs/audit/`, login/logout endpoints in `apps/study` and `apps/hangar`, and `hooks.server.ts` for study/hangar/sim. The auth surface is well-considered overall (DB-backed rate-limit, dual-gate doc, deliberate `sameSite=strict`, defense-in-depth cookie clear in finally). The two highest-impact correctness defects are:

1. `forwardAuthCookies` overrides every Set-Cookie's `maxAge` with `SESSION_MAX_AGE_SECONDS` (7 days), silently extending the 5-minute `bauth_session_data` cookie cache to 7 days. This neutralizes the comment in `server.ts` that says cookie cache is short "so ban / revoke propagates quickly". Bans now propagate in up to 7 days, not 5 minutes.
2. `auditRecent` ignores `targetType` whenever `targetId` is supplied, returning rows from any target type that happens to share the id. Two BCs that mint id-shaped strings collide here.

A handful of medium/minor issues round out the list: silent ban bypass in sim, fragile cookie-expiration detection, partial cookie clear on logout, type-laundering casts on `role`, and stale-cookie-cache windows.

## Issues

### CRITICAL: forwardAuthCookies clobbers cookie-cache TTL with the 7-day session TTL

File: `libs/auth/src/cookies.ts:34-49`, applied at `libs/auth/src/cookies.ts:74-96`

Problem: `authCookieOptions` always sets `maxAge: maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS` (7 days, per `libs/constants/src/deployment.ts:11`). The function applies these options to **every** Set-Cookie header better-auth emits, including the `bauth_session_data` cookie cache that better-auth deliberately scopes to 5 minutes (`libs/auth/src/server.ts:71-74`):

```ts
cookieCache: { enabled: true, maxAge: 5 * 60 },
```

Better-auth issues the data cookie with `Max-Age=300`. We discard better-auth's `Max-Age` (we only parse `name=value` from `parts[0]` and never read attributes), then set `Max-Age=604800`. The cookie cache now lives 2,016x longer than intended.

Trigger: any successful sign-in that goes through `forwardAuthCookies` (study `/login`, hangar `/login`). After the sign-in response, the browser holds `bauth_session_data` for 7 days. While that cookie is fresh, `auth.api.getSession()` returns the cached user object without re-reading `bauth_session` (the whole point of cookie cache). Practical consequences:

- Banning a user via the admin plugin keeps them logged in for up to 7 days instead of 5 minutes. The hooks `if (event.locals.user?.banned)` guard kicks in only after the cache expires, because the cached user object reflects the pre-ban state.
- Manual session revocation (admin "kick this session") has the same delay.
- Role changes (promote LEARNER -> AUTHOR, demote AUTHOR -> LEARNER) take up to 7 days to take effect.

Fix: do not stomp on better-auth's `Max-Age` / `Expires` for cookies it controls. Either parse and forward the original `Max-Age` / `Expires` from the Set-Cookie header, or special-case the `BETTER_AUTH_COOKIES.SESSION_DATA` cookie to skip the maxAge override. Cleanest path is to forward attributes verbatim and only override `Domain` (which is the only attribute we actually need to rewrite per-request). The `maxAgeSeconds` parameter on `forwardAuthCookies` is unused at every call site (study + hangar both pass 3 args via the app wrapper) and can be dropped along with the override.

### MAJOR: auditRecent ignores targetType when targetId is provided

File: `libs/audit/src/log.ts:50-61`

Problem:

```ts
const filtered =
    input.targetId != null
        ? base.where(eq(auditLog.targetId, input.targetId))
        : base.where(eq(auditLog.targetType, input.targetType));
```

When the caller supplies both `targetType` and `targetId`, the query filters on `targetId` only. `targetType` is silently discarded.

Trigger: an admin call like `auditRecent({ targetType: 'study.card', targetId: 'card_X' })` returns rows for any target type that shares that id. `targetId` is generated as `prefix_ULID` per project rules, so collisions across BC namespaces are unlikely today, but:

- `targetId` is `text` and nullable in the schema -- nothing forces it to be a prefixed id.
- Future BCs that store domain-shaped ids (e.g. plain ULIDs without prefix, or short slugs as targetId) collide.
- The function signature documents both fields, so the test suite (`log.test.ts:104`) already passes both. The current pass works only because `TEST_RUN_ID` is uniquely scoped.

Fix:

```ts
const conditions = [eq(auditLog.targetType, input.targetType)];
if (input.targetId != null) conditions.push(eq(auditLog.targetId, input.targetId));
return base.where(and(...conditions)).orderBy(desc(auditLog.timestamp)).limit(limit);
```

Always filter by `targetType`; AND in `targetId` when provided. Add a test that writes rows under two different `targetType`s with the same `targetId` and asserts the read returns only the requested type.

### MAJOR: sim hooks have no banned-user guard

File: `apps/sim/src/hooks.server.ts:42-72`

Problem: study and hangar both reject requests when `event.locals.user?.banned` is true (`apps/study/src/hooks.server.ts:133-145`, `apps/hangar/src/hooks.server.ts:155-167`). Sim hydrates `event.locals.user` from the cross-subdomain session cookie but never checks `banned`. A banned user retains full access to every sim route, including the upcoming attempt-persistence endpoint.

Trigger: ban a user via better-auth's admin plugin while they have a valid session cookie. They cannot reach study (banned guard fires) but can keep posting to sim. Anything sim writes becomes attributable to a user the platform has decided to suspend.

Fix: lift the banned-user guard from study/hangar into a shared helper (e.g. `applyBannedGuard(event)` exported from `@ab/auth`) and call it from sim's hooks before `resolve(event)`. While there, sim is also missing the security-headers pass (`X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, HSTS in prod) that study and hangar apply -- factor those into the same helper so all surfaces stay aligned.

### MAJOR: forwardAuthCookies uses substring/case-sensitive checks for cookie-clear detection

File: `libs/auth/src/cookies.ts:88-95`

Problem: the "is this header clearing the cookie?" detection is:

```ts
const rawLower = raw.toLowerCase();
const isExpiring = rawLower.includes('max-age=0') || rawLower.includes('expires=thu, 01 jan 1970');
```

Two issues:

1. The literal `'expires=thu, 01 jan 1970'` matches one specific RFC 1123 wording. RFC 7231 also allows `Thu, 01-Jan-1970` (RFC 850 obsolete-but-tolerated form) and `Thu Jan  1 00:00:00 1970` (asctime). Better-auth uses `new Date(0).toUTCString()` today, which yields `Thu, 01 Jan 1970 00:00:00 GMT` and matches. If better-auth ever switches to a different format, the substring miss silently turns "delete" into "set, 7-day TTL" -- the cookie is *kept* with the explicit-zero value rather than deleted.
2. `max-age=0` substring match catches `max-age=0` but also a hypothetical `max-age=01` if any future code path emits leading-zero values. Low-probability but worth tightening.

Trigger: better-auth library upgrade changes the Set-Cookie expiry format on sign-out. The browser sees a "delete" header that we treat as a "set" header with our default 7-day TTL, and we issue a fresh long-lived cookie pointing at the now-empty session token.

Fix: parse Set-Cookie attributes properly (or use a small parser like `cookie` / `set-cookie-parser`), then check `attrs.maxAge === 0` or `attrs.expires && attrs.expires.getTime() <= Date.now()`. Drops the substring fragility entirely.

### MAJOR: clearSessionCookies clears only 2 cookies; better-auth emits more

File: `libs/auth/src/logout.ts:17, 28-33`

Problem: the cookie-clear set is hard-coded to `[SESSION_TOKEN, SESSION_DATA]`. Better-auth's admin plugin emits an `admin_token` cookie when impersonation is active, and the magic-link plugin emits short-lived state cookies during the link flow. Neither is cleared on logout. After sign-out, those cookies linger until expiry.

Trigger: an admin who impersonates user X, then signs out. The impersonation token cookie persists. Re-login as a different account would race with whatever leftover state these cookies represent. Less severe than a session cookie, but it's a defense-in-depth violation -- we explicitly added `clearSessionCookies` because better-auth's response Set-Cookies aren't reliable, then only enumerate two of them.

Fix: walk every cookie name beginning with the configured better-auth prefix (`better-auth.*`) and delete each, OR enumerate every cookie name better-auth is documented to emit (session_token, session_data, admin_token, magic-link state) in `BETTER_AUTH_COOKIES`. The walk-by-prefix approach is robust to plugin churn.

### MINOR: hooks cast role to Role without validating against ROLES

File: `apps/study/src/hooks.server.ts:114`, `apps/hangar/src/hooks.server.ts:138`, `apps/sim/src/hooks.server.ts:59`

Problem: `role: (session.user.role as Role) ?? null`. The DB column is `text` with no CHECK constraint (`libs/auth/src/schema.ts:21`). Any string -- including legacy or typo values -- is laundered into the `Role` type via `as`. Downstream `requireRole` does an `includes` check on the supplied roles list, so it would reject an unknown value, but `event.locals.user.role === ROLES.ADMIN` comparisons inside features may end up comparing against an unsanitized string.

Trigger: a stray DB write (data import, manual SQL, third-party integration) lands a role like `'super-admin'`. The hook hands it to features as if it were a valid `Role`. Type system is silent about it.

Fix: validate against `ROLE_VALUES` at the hook boundary -- either coerce to `null` for unknown values or log+reject. A small helper like `parseRole(raw: unknown): Role | null` lives naturally in `@ab/auth` next to the type.

### MINOR: hooks ban-check happens after cookie cache, so banned users float for cookie-cache TTL

File: `apps/study/src/hooks.server.ts:96, 133`, `apps/hangar/src/hooks.server.ts:120, 155`

Problem: `auth.api.getSession({ headers })` honors the cookie cache (5 min today, but see CRITICAL above which makes it 7 days). When the cache hit returns a stale user object, `event.locals.user.banned` reflects the pre-ban state. The hook can't see a ban that happened after the last cache write.

Trigger: ban a user, they keep working until their cached session data expires. With the cookie-cache TTL bug fixed (CRITICAL), this is the documented trade-off described in `auth.ts:71-74`. Still worth flagging because the ban check appears to be load-bearing security, but it's actually a "best within cookie-cache TTL" check.

Fix: either disable cookie cache for surfaces where ban-propagation latency matters, or fall back to a fresh `bauth_user` lookup for `banned` specifically when `event.locals.user` is hydrated from cache. The simpler fix is documenting the upper-bound delay loudly in the hook and on the admin-ban surface.

### MINOR: countAllUsers / countAuditEntriesSince Number() coercion is unnecessary and hides bigint

File: `libs/auth/src/queries.ts:16`, `libs/audit/src/log.ts:69`

Problem: both functions wrap `count()` results in `Number(rows[0]?.c ?? 0)`. Drizzle's `count()` returns a `number` for Postgres `count(*)` with the `pg` driver -- the `Number(...)` cast is a no-op when the value is already a number. If the row count ever exceeds `Number.MAX_SAFE_INTEGER` (2^53 - 1), the cast silently lossy-converts a bigint to a float. Vanishingly unlikely for user count or audit count, but the cast is also redundant; the type signature `Promise<number>` is sufficient.

Trigger: never in practice. Defensive gap.

Fix: either remove the `Number(...)` cast or, if defensive bigint handling is the goal, branch explicitly: `typeof c === 'bigint' ? Number(c) : c ?? 0`. Today the cast is doing nothing the type system needed.

### MINOR: forwardAuthCookies silently drops empty-name cookies but logs nothing

File: `libs/auth/src/cookies.ts:81-83`

Problem: the parser does `if (eqIndex === -1) continue;` and `if (!name) continue;`. Both fast-paths skip the header silently. If better-auth ever emits a malformed header, the user's cookie state diverges from what better-auth thinks it set, and there's no telemetry to diagnose it.

Trigger: better-auth bug or proxy mangling Set-Cookie. Today: never.

Fix: log at debug level when a header is dropped, including a short prefix of the raw header value (truncated to avoid leaking secrets). Keeps the silent-drop behavior but leaves a breadcrumb.

### MINOR: login fail() reflects email back even on credential-stuffing 401

File: `apps/study/src/routes/login/+page.server.ts:80-83`, `apps/hangar/src/routes/login/+page.server.ts:67-70`

Problem: every error path returns `{ error, email }`. This is fine UX for typos but is also a tiny enumeration helper for attackers: the form remembers the email they tried, so they can iterate variants visually. Compare with the deliberate "redact email from logs" comment a few lines below.

Trigger: low. Mostly a defensive concern.

Fix: drop the `email` from the 401 fail. Keep it for the 400 (validation) path so the user doesn't have to retype on a typo. Or always echo it back but at least be consistent with the log redaction rationale.

### NIT: requireAuth uses 302; login action uses 303

File: `libs/auth/src/auth.ts:70`, `apps/study/src/routes/login/+page.server.ts:96`

Problem: `requireAuth` redirects with 302 (temporary redirect, semantics under-specified for method preservation). The login action redirects with 303 (POST-redirect-GET). Both work in practice because browsers downgrade 302 to GET, but RFC 7231 calls 303 the right code for "see this resource for the result of the operation."

Fix: make `requireAuth` use 303 too. Update the auth.test.ts assertion at line 53 to match.

### NIT: AuthSession expiresAt typed as Date but never used by callers

File: `libs/auth/src/auth.ts:5-9`

Problem: `AuthSession.expiresAt: Date` is hydrated in every hook but no caller in scope reads it. Better-auth's session validation already enforces expiry. The field is dead weight in `event.locals.session`.

Fix: drop `expiresAt` from `AuthSession` until something needs it. Alternatively, add a `requireFreshSession(event, maxAgeSeconds)` helper that uses it for "re-auth before sensitive write" flows -- gives the field a reason to exist.

### NIT: rateLimitEnabled default chain is awkward

File: `libs/auth/src/server.ts:107`, `apps/study/src/lib/server/auth.ts`

Problem: `enabled: options.rateLimitEnabled ?? true`. The library default is "always on", which is correct -- but the option lets a caller turn it off. No production caller does. The only consumer is the rate-limit test suite, which passes `rateLimitEnabled: true` explicitly. Removing the override would make every environment provably rate-limited.

Fix: drop the `rateLimitEnabled` parameter; hard-code `enabled: true`. Tests that need to clear the bucket can `delete from bauth_rate_limit` between cases (the test already does this on line 89). Smaller API surface.
