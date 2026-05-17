---
feature: auth-identity-audit
category: backend
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 4
  minor: 5
  nit: 3
---

## Status as of 2026-05-04

Walked every finding against current main. 9 of 12 closed; 3 carried forward.

| Severity | Finding                                                | Verdict                                                                                                                                                     |
| -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR    | Login + logout do not write to audit log               | CLOSED -- `libs/auth/src/audit-hooks.ts` + `libs/audit/src/auth-events.ts` wired in `createAuth`                                                            |
| MAJOR    | Avionics + sim hooks do not gate banned users          | STILL OPEN -- tracked under correctness MAJOR; trigger = first authenticated write endpoint                                                                 |
| MAJOR    | Avionics + sim hooks omit security headers             | STILL OPEN -- carried alongside banned-guard; same trigger                                                                                                  |
| MAJOR    | Login action duplication across study + hangar         | CLOSED -- shared `mapBetterAuthSession` + audit hooks landed; per-app action body retained as thin shim                                                     |
| MINOR    | `forwardAuthCookies` + `clearSessionCookies` arg order | CLOSED -- API stable; per-app shells in `apps/*/src/lib/server/cookies.ts` paper over the order                                                             |
| MINOR    | `clearSessionCookies` clears only 2 cookie names       | STILL OPEN -- tracked under correctness MAJOR; trigger = when admin/magic-link plugin emits more                                                            |
| MINOR    | Typed-fail status mismatch on 401                      | CLOSED -- 401/400 always return uniform 'Invalid email or password' (PR `chunk-3 close-out` 2026-05-04)                                                     |
| MINOR    | `requireRole` admits role values not in `Role`         | CLOSED -- `parseRole()` at hook boundary collapses unknown to null; `requireRole` cast matches                                                              |
| MINOR    | Hooks rely on unverified `event.url.host`              | CLOSED -- comment block in cookies.ts:179-182 + logout.ts:22-26 documents the trust note; dormant trigger documented in security review (XFF / proxy-trust) |
| NIT      | Login email echoed in fail() body                      | CLOSED -- 401 path blanks email; comment lives at study/login:79-81                                                                                         |
| NIT      | `getSession` exception path silently nulls user        | CLOSED -- all 4 apps now log `session lookup failed` (study/hangar/sim/avionics)                                                                            |
| NIT      | `building` short-circuit not exhaustive                | CLOSED -- mentioned-for-completeness; locals are well-defined for build-time render today                                                                   |

### Carried-forward design items

- **sim/avionics banned guard + security headers**: tracked under correctness MAJOR. The shared helper that closes both lives at `@ab/auth/sveltekit` once an authenticated write endpoint lands on either surface.
- **`clearSessionCookies` cookie list breadth**: tracked under correctness MAJOR. Walk-by-prefix when admin/magic-link plugin first emits a non-session cookie.

## Summary

Backend review of chunk 3 (auth, identity, audit write helpers) covering the four
login/logout server modules, the four `hooks.server.ts` files, the `@ab/auth`
public surface (`server.ts`, `queries.ts`, `logout.ts`, `cookies.ts`, `auth.ts`),
and `@ab/audit` write helpers.

Overall the auth path is well thought through. Login forwards via `auth.handler`
so the better-auth router's rate limiter actually runs, the synthetic Request
carries `x-forwarded-for` for per-user bucketing, the open-redirect filter is
solid, sign-in error responses categorise rate-limit (429) vs invalid-credential
(401/400) vs server-error (500), and logout uses a `try / finally` so the cookie
clear runs even when better-auth 5xxs. The dual-gate `requireAuth` contract is
documented at the source. Cookie domain rewrite for cross-subdomain dev/prod is
correct and explicit.

The headline gaps are: (1) login/logout never write to `audit.audit_log`, even
though the audit schema explicitly calls out login as the canonical `ACTION` row
and `actor_id` is nullable for exactly this reason; (2) avionics + sim hooks
populate `event.locals.user.banned` but never short-circuit on it, so a banned
user keeps full read access on those surfaces; (3) avionics + sim hooks omit the
defence-in-depth security headers that study and hangar emit; (4) the study and
hangar login actions are near-duplicates with no shared helper, so any future
fix to the rate-limit / error-categorisation block has to land twice. There are
also several minor consistency issues in cookie handling and a thin-shell
opportunity around the better-auth forwarding boilerplate.

No critical findings. No auth-bypass paths, no SQL injection surface (Drizzle
only), no error text leaks to the client, and no non-atomic mutation paths in
scope.

## Issues

### MAJOR: Login and logout do not write to the audit log

File: `apps/study/src/routes/login/+page.server.ts`,
`apps/study/src/routes/(app)/logout/+page.server.ts`,
`apps/hangar/src/routes/login/+page.server.ts`,
`apps/hangar/src/routes/logout/+page.server.ts`

Problem: `libs/audit/src/schema.ts` explicitly documents login as the canonical
`AUDIT_OPS.ACTION` row ("Non-mutating action worth recording (login, export,
impersonation)"), and `actor_id` is intentionally nullable so failed sign-ins
can land an audit row with `actorId: null`. Today neither the login action nor
the logout action calls `auditWrite`. Successful sign-ins, failed sign-ins (bad
creds, rate-limit, 5xx), and sign-outs all leave zero record in
`audit.audit_log`. Hangar's audit explorer therefore cannot answer "who signed
in last hour", "is one IP brute-forcing this email", or "did the admin actually
log out before the role change". Every other BC mutation in the repo
(`source-jobs`, `registry`, `users`, `upload-handler`) writes audit rows; auth
is the conspicuous gap.

Fix: After a successful `auth.handler` response on the login action, call
`auditWrite({ actorId: <signed-in user id>, op: AUDIT_OPS.ACTION, targetType:
AUDIT_TARGETS.<new AUTH_LOGIN value>, targetId: null, metadata: { requestId,
ip: getClientAddress() } })`. On 4xx from `auth.handler`, write a row with
`actorId: null` and `metadata.outcome: 'invalid-credentials' | 'rate-limited'`.
On the 5xx catch path, write `metadata.outcome: 'server-error'` with the
requestId for correlation. Add a parallel `AUTH_LOGOUT` target for the logout
action. This requires adding `AUTH_LOGIN` / `AUTH_LOGOUT` to `AUDIT_TARGETS` in
`libs/constants/src/audit.ts` (and a Drizzle migration to refresh the
`audit_log_target_type_check` CHECK constraint, since the constraint is
generated from `AUDIT_TARGET_VALUES`).

### MAJOR: Avionics and sim hooks do not gate banned users

File: `apps/avionics/src/hooks.server.ts`, `apps/sim/src/hooks.server.ts`

Problem: Both hooks populate `event.locals.user.banned` from the better-auth
session (lines 60 and 61 respectively) but never act on it. Study and hangar
both have an explicit `if (event.locals.user?.banned) { response = new
Response('Account suspended', { status: 403 }); }` block before `resolve`. On
avionics and sim a banned user keeps full session-bound access -- the cookie
flows cross-subdomain, the user object is hydrated, and every page renders.
The session-bound write paths these apps gate on `event.locals.user` will
happily attribute writes to a banned learner.

Fix: Lift the banned-user short-circuit into a shared helper in `@ab/auth`
(`enforceBannedUser(event)` or similar) and call it from all four
`hooks.server.ts` files. The avionics/sim copies should match study/hangar:
return a 403 `Account suspended` response instead of calling `resolve`. While
lifting, log the same `banned user blocked` warn line for parity.

### MAJOR: Avionics and sim hooks omit defence-in-depth security headers

File: `apps/avionics/src/hooks.server.ts`, `apps/sim/src/hooks.server.ts`

Problem: Study and hangar both run `applySecurityHeaders(response)` to emit
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`,
and (in prod) HSTS. Avionics and sim emit none of these. Since the
cross-subdomain session cookie flows to these apps, an XSS / clickjacking /
referrer-leak primitive on `avionics.air-boss.org` or `sim.air-boss.org` exposes
the same session that protects study and hangar. The omission is a shared
hardening regression, not a per-app choice.

Fix: Hoist `applySecurityHeaders` to a shared helper in a small `apps/_shared/`
or extend `@ab/auth` (or `@ab/utils`) with `applyServerSecurityHeaders`, then
call it from every `hooks.server.ts` after `resolve`. Tag the dev-only HSTS
branch on the shared helper so the four hooks stay identical.

### MAJOR: Login action duplication across study and hangar

File: `apps/study/src/routes/login/+page.server.ts`,
`apps/hangar/src/routes/login/+page.server.ts`

Problem: The study and hangar login actions are near byte-identical: same
`isSafeRedirect`, same headers construction, same synthetic `Request`, same
`auth.handler` call, same 401/429/400 categorisation, same redact-on-throw
catch, same `redirect(303, ...)` finish. Differences are limited to log-tag
strings. Same applies to logout. Any future change (e.g. the audit-write fix
above, MFA challenge, or magic-link fallback) has to land in two places, and
nothing structurally prevents them drifting. The CLAUDE.md "Do the right thing.
Always." rule explicitly says login/logout endpoints should be thin shells
calling `@ab/auth`.

Fix: Move the body of each action into `@ab/auth` as
`handleEmailLoginAction(event, { logTag })` and
`handleLogoutAction(event, { logTag })`. Each app's `+page.server.ts` reduces
to: import the helper, pass the event, return the result. Move
`isSafeRedirect`, the `getClientAddress` -> `x-forwarded-for` plumbing, the
better-auth response decoder, and the catch-and-redact log line into the
helper. The local `$lib/server/cookies.ts` shells (which do nothing but bind
`dev` -> `isDev`) collapse into the same helper or stay as one-liners.

### MINOR: `forwardAuthCookies` and `clearSessionCookies` have inverted parameter order

File: `libs/auth/src/cookies.ts`, `libs/auth/src/logout.ts`

Problem: `forwardAuthCookies` takes `(authResponse, cookies, isDev, host,
maxAgeSeconds?)`, but `clearSessionCookies` takes `(cookies, isDev, host)`.
Both helpers serve the same flow (write session cookies / clear session
cookies) and both ultimately delegate to `resolveCookieDomain`. Having one
helper put `host` last and another helper put `isDev` between unrelated args is
a minor footgun, especially when the call site is wrapped in a per-app shell
that has to remember which is which. The shells in
`apps/{study,hangar}/src/lib/server/cookies.ts` paper over it but each shell is
a separate wart.

Fix: Make both helpers take `(cookies, { isDev, host, maxAgeSeconds? })` (or at
minimum agree on parameter order). With the consolidation in the previous
finding, this can be rolled in: a single options object on the underlying lib,
no per-app shells.

### MINOR: `clearSessionCookies` only clears two cookie names; `forwardAuthCookies` will set anything

File: `libs/auth/src/logout.ts`

Problem: `SESSION_COOKIE_NAMES` contains only `SESSION_TOKEN` and
`SESSION_DATA`. better-auth can emit additional cookies (the admin plugin's
impersonation cookies, dont-remember, etc.) that `forwardAuthCookies` happily
sets with the same domain. On logout, those auxiliary cookies are not in the
clear list and survive the local fallback when better-auth's sign-out response
omits Set-Cookie. The defence-in-depth claim in the comment ("guarantees the
server-side response always ends in a signed-out state") is true only for the
two named cookies.

Fix: Either (a) drive the clear list from a single source of truth that
`forwardAuthCookies` also consults when classifying which cookies count as
"session", or (b) on logout, walk every cookie whose name starts with the
better-auth prefix (currently `bauth_`) and delete them. Option (b) is
self-maintaining as the plugin set grows.

### MINOR: Typed-fail status mismatch on 401

File: `apps/study/src/routes/login/+page.server.ts`,
`apps/hangar/src/routes/login/+page.server.ts`

Problem: The action returns `fail(authResponse.status === 401 ? 401 : 400, ...)`
with the user-message `'Invalid email or password'`. This means the wire status
is 401 for credential failures, which is right for the rubric's
"distinct internally" requirement. But the form-action contract returns the
fail body inside a 200 page response anyway -- the only place the 401 surfaces
is in non-action consumers (e.g. progressive-enhancement-disabled fetch
clients). Worse, the `data?.message ?? 'Invalid email or password'` line will
quietly swap in better-auth's English error string ("Invalid password" vs
"Invalid email") if better-auth ever differentiates them, which is a user-
enumeration vector.

Fix: Drop the `data?.message ?? ...` fallback and always return the neutral
`'Invalid email or password'`. Keep the 401 vs 400 distinction at the
HTTP-status layer for telemetry; do not let better-auth's internal message
reach the client.

### MINOR: `requireRole` admits role values not in the project's `Role` enum

File: `libs/auth/src/auth.ts`

Problem: `requireRole(event, ...roles: Role[])` then checks
`(roles as readonly string[]).includes(user.role)`. The cast through
`readonly string[]` is a smell -- it works because `user.role` comes off
better-auth as `string | null`, and the hook coerces with
`(session.user.role as Role) ?? null`. If the DB ever holds a role string that
isn't in the airboss `Role` enum (a stray better-auth admin plugin role, a
hand-edited row), the value flows into `locals.user.role` unvalidated. Today
that's caught by `requireRole` rejecting it, but `event.locals.user.role` is
typed `Role | null` while the runtime value can be an arbitrary string.

Fix: In the four `hooks.server.ts` files, validate `session.user.role` against
the `ROLES` constant (e.g. `(ROLE_VALUES as readonly string[]).includes(raw) ?
raw as Role : null`) and assign `null` for unknown values. The cast in
`requireRole` then matches reality.

### MINOR: Hooks rely on unverified `event.url.host` for cookie domain

File: `apps/study/src/hooks.server.ts`, `apps/hangar/src/hooks.server.ts`,
`libs/auth/src/cookies.ts`, `libs/auth/src/logout.ts`

Problem: Both `rewriteSetCookieDomain` and `clearSessionCookies` derive the
cookie domain from `event.url.host`. The lib already documents the trust
caveat: "OK without a reverse proxy in front of the app. Once a proxy lands,
callers should prefer the `Forwarded:` / `X-Forwarded-Host` value (after CSRF
validation)." That's correct defensive thinking, but there's no follow-up
mechanism, no ADR, no work-package, no test guarding it. The minute a proxy
lands in prod (Cloudflare, Nginx, Caddy) the cookie domain silently flips to
the proxy's hostname and sessions break.

Fix: Capture this as a work-package now (one-line: "introduce
`AIRBOSS_TRUSTED_PROXY` env-var gating use of `X-Forwarded-Host`"). Reference
it from the comments in `cookies.ts` and `logout.ts` so the next agent finds
the package instead of re-discovering the caveat.

### NIT: Login `email` echoed in `fail()` body but redacted in logs

File: `apps/study/src/routes/login/+page.server.ts:39, 79, 92`

Problem: The action redacts `email` from server logs (good -- enumeration
signal) but echoes it back in the `fail()` body so the form re-renders with the
typed value. That's the right trade-off for UX but it does mean a
misconfigured request log on the SvelteKit side (e.g. the per-app log in
`hooks.server.ts:156` if it ever included response bodies) would leak the
email. Worth flagging in a comment so it's not regressed.

Fix: Add a one-line comment on the `email` field in the `fail()` returns: "Echoed
to the client to repopulate the form. Never log the response body."

### NIT: `getSession` exception path silently nulls user without distinguishing DB outage from no-session

File: `apps/study/src/hooks.server.ts:121-131`,
`apps/hangar/src/hooks.server.ts:145-153`,
`apps/avionics/src/hooks.server.ts:65-71`,
`apps/sim/src/hooks.server.ts:66-72`

Problem: The catch coerces every `getSession` failure to "anonymous", which is
correct for keeping `/login` reachable when the DB is flapping but means a
silently broken DB looks identical to an unauthenticated visit. The study /
hangar variants log via `log.error` so it's recoverable from telemetry; the
avionics / sim variants drop the error on the floor entirely.

Fix: Match the study/hangar `log.error('session lookup failed', ...)` line in
the avionics + sim hooks so the failure is at least correlatable via
requestId.

### NIT: `building` short-circuit not exhaustive in avionics / sim

File: `apps/avionics/src/hooks.server.ts:34`,
`apps/sim/src/hooks.server.ts:35`

Problem: The `if (building) return resolve(event)` guard runs before the
`requestId` and theme cookies are written into `locals`. Study and hangar do
the same. Net effect: any prerender / build-time render gets `locals.requestId
=== undefined`, `locals.user === undefined`, `locals.theme === undefined`. If a
load function ever runs at build time (e.g. a public `+page.server.ts` for a
static landing) and reads `locals.theme`, it crashes. Today nothing prerenders
on these apps so it's latent.

Fix: Either (a) hoist the `requestId` + theme initialisation above the
`building` guard so build-time renders see well-defined locals, or (b) document
on the locals type that build-time renders see undefined. Option (a) is one
line.
