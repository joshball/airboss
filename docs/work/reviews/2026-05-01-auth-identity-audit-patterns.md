---
feature: auth-identity-audit
category: patterns
date: 2026-05-01
branch: main
counts:
  critical: 0
  major: 2
  minor: 4
  nit: 2
status: unread
review_status: pending
---

## Summary

Locked scope: `libs/auth/src/`, `libs/audit/`, login/logout endpoints in `apps/study` + `apps/hangar`, and `apps/{study,hangar,sim,avionics}/src/hooks.server.ts`.

Overall the auth + audit libs hew closely to project conventions: every literal string that needs to be shared (`AUTH_INTERNAL_ORIGIN`, `BETTER_AUTH_ENDPOINTS`, `BETTER_AUTH_COOKIES`, `COOKIE_DOMAIN_*`, `SCHEMAS.AUDIT`, `AUTH_RATE_LIMIT.*`, `AUDIT_OPS`, `ROLES`, `ENV_VARS.*`, `MAIL_FROM_NOREPLY`, `SESSION_MAX_AGE_SECONDS`, `DB_ADAPTER_PROVIDER`) is sourced from `@ab/constants`. ID generation goes through `@ab/utils` (`generateAuthId`, `generateAuditLogId`) -- no raw `nanoid()`/`ulid()` at call sites. Drizzle is used throughout; the only `sql.raw` lives in the audit-log CHECK constraint and is fed from `AUDIT_OP_VALUES` / `AUDIT_TARGET_VALUES` constants, so no string-typed enum values are inlined. Cross-lib imports use `@ab/*` aliases without exception. Login/logout pages reference design tokens (`var(--surface-page)`, `var(--ink-body)`, etc.) and avoid raw hex.

The findings below are all about a few lingering literals in hooks/login flows that escaped the constants/routes net, plus a duplicated session-mapping block across all four hooks.server.ts files.

## Issues

### MAJOR: `requireAuth` inlines the `redirectTo` query param instead of using `QUERY_PARAMS.REDIRECT_TO`

File: `/Users/joshua/src/_me/aviation/airboss/libs/auth/src/auth.ts` (line 70)

Problem: The redirect URL is built as `` `${ROUTES.LOGIN}?redirectTo=${redirectTo}` ``. The literal `redirectTo` query key is exactly the case the constants registry has already covered: `QUERY_PARAMS.REDIRECT_TO = 'redirectTo'` (`libs/constants/src/routes.ts:79`), and the login server actions read it via `url.searchParams.get(QUERY_PARAMS.REDIRECT_TO)`. The producer here is the only side still hardcoded, so a rename of the constant would silently desync producer/consumer.

Rule: CLAUDE.md "All literal values in `libs/constants/`. ... All routes go through `ROUTES`. ... no magic strings."

Fix: Import `QUERY_PARAMS` and build the URL from it: `` `${ROUTES.LOGIN}?${QUERY_PARAMS.REDIRECT_TO}=${redirectTo}` ``.

### MAJOR: Session-to-`AuthUser` mapping is duplicated verbatim across all four `hooks.server.ts` files (with `as Record<string, unknown>` casts)

Files:
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts` (lines ~98-120)
- `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/hooks.server.ts` (lines ~122-144)
- `/Users/joshua/src/_me/aviation/airboss/apps/sim/src/hooks.server.ts` (lines ~44-65)
- `/Users/joshua/src/_me/aviation/airboss/apps/avionics/src/hooks.server.ts` (lines ~43-64)

Problem: The 20-line block that maps `session.user` -> `AuthUser` is byte-for-byte identical in all four apps, including the doubled cast `((session.user as Record<string, unknown>).firstName as string) ?? ''`. This is the canonical "ports the better-auth shape into our `AuthUser`" operation -- it belongs in `@ab/auth` next to the `AuthUser` type, not copy-pasted into every surface app. The duplication is also the reason the casts are uncommented (Critical Rules: "no `as` without comment"): if the mapping lived in one place, the rationale ("better-auth's additionalFields are typed as `unknown` on the session payload, so we widen and narrow at the boundary") could live with the function once instead of being elided four times.

Rule: CLAUDE.md "no magic strings"; Critical Rules "no `as` without comment"; intent of `@ab/auth` ("Infrastructure: same interface for all apps").

Fix: Add a `mapBetterAuthSession(session): { session: AuthSession | null; user: AuthUser | null }` helper to `@ab/auth` (export from `index.ts`). Move the `as Record<string, unknown>` cast inside, with a comment explaining why better-auth's `additionalFields` shape needs widening. Each `hooks.server.ts` then does `const { session, user } = mapBetterAuthSession(rawSession);`.

### MINOR: `REQUEST_ID_HEADER = 'x-request-id'` is duplicated as a local const in all four hooks

Files: same four `hooks.server.ts` files as above.

Problem: Each file declares `const REQUEST_ID_HEADER = 'x-request-id'` and an identical `REQUEST_ID_PATTERN` + `resolveRequestId(req)` helper. The header name is a cross-cutting protocol identifier (it appears in logs, in the CSP allowlist conversation, in any future tracing skin). It is the textbook case for `libs/constants/`.

Rule: CLAUDE.md "no magic strings ... All literal values in `libs/constants/`."

Fix: Add `REQUEST_ID_HEADER` (and `REQUEST_ID_PATTERN`) to `libs/constants/`, or expose a shared `resolveRequestId` from `@ab/utils` since the four implementations are identical.

### MINOR: `'cookie'`, `'x-forwarded-for'`, `'content-type'` header names hardcoded in login/logout actions

Files:
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts` (lines 59-60)
- `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/login/+page.server.ts` (lines 46-47)
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/logout/+page.server.ts` (line 20)
- `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/logout/+page.server.ts` (line 20)

Problem: The "forward to better-auth" pattern inlines header names in both apps, in two endpoints each. Beyond the magic-string rule, the four call sites are nearly identical: each builds a `new Request(${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${ENDPOINT}, {...})` and forwards client headers. This is a candidate for a `forwardToAuthHandler(authRequest, opts)` helper in `@ab/auth` so a future endpoint addition lands in one place rather than four.

Rule: CLAUDE.md "no magic strings"; Prime Directive ("port from sibling repo or library when implementation exists").

Fix: Add `HTTP_HEADERS` (or similar) to `@ab/constants` for the three names, or factor a small helper into `@ab/auth` that builds the internal `Request` with the right headers from the inbound `RequestEvent`. The login + logout actions then call `await callAuthHandler(event, BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL, body)` -- one helper, four sites, no header literals at the call site.

### MINOR: Logger names `'study'`, `'hangar'`, `'study:login'`, `'hangar:login'`, `'study:logout'`, `'hangar:logout'`, `'email'` are inlined

Files: `apps/{study,hangar}/src/hooks.server.ts`, `apps/{study,hangar}/src/routes/{login,logout}/+page.server.ts`, `libs/auth/src/email/transport.ts`.

Problem: Logger namespace strings are repeated and have an implicit convention (`{app}` and `{app}:{surface}`). They are not in `@ab/constants` and there is no helper that derives them. Renaming an app would touch every `createLogger('app:...')` call.

Rule: CLAUDE.md "no magic strings ... All literal values in `libs/constants/`."

Fix: Either add `LOGGERS` to `@ab/constants` (`LOGGERS.STUDY`, `LOGGERS.STUDY_LOGIN`, ...), or expose a per-app `appLog = createLogger(APP_NAME)` from a shared module so feature-level loggers extend it (`appLog.child('login')`). Even just `APP_NAMES = { STUDY: 'study', HANGAR: 'hangar', SIM: 'sim', AVIONICS: 'avionics' } as const` and `createLogger(APP_NAMES.STUDY)` would close it.

### MINOR: Security-header values are repeated as string literals in `applySecurityHeaders` (study + hangar)

Files:
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts` (lines 45-53)
- `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/hooks.server.ts` (lines 76-84)

Problem: The four security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, and the dev-gated `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) are duplicated across the two non-trivial hooks files. Sim + avionics don't apply them at all -- a likely separate gap, but in scope for the duplication symptom.

Rule: CLAUDE.md "no magic strings ... All literal values in `libs/constants/`"; "Infrastructure: same interface for all apps."

Fix: Extract a `applySecurityHeaders(response, { dev })` helper into a shared module (e.g. `@ab/utils` or a new `@ab/security` slice) with a `SECURITY_HEADERS` constants table. All four hooks then import the helper, which fixes both the duplication and the silent inconsistency between study/hangar (have headers) and sim/avionics (don't).

### NIT: `requireAuth` builds the redirect URL with `encodeURIComponent` rather than going through `ROUTES.LOGIN` + a `QUERY_PARAMS` builder

File: `/Users/joshua/src/_me/aviation/airboss/libs/auth/src/auth.ts` (line 70)

Problem: Per the routes constants doc-block, "Routes with parameters are typed functions" (`MEMORY_CARD_EDIT(id)`, etc.). The redirectTo path is functionally a parameterized route ("login with a return-to"). It would be more consistent if `ROUTES` exposed `LOGIN_WITH_REDIRECT(path)` so this was a single source of truth, matching `MEMORY_CARD_EDIT(id)` style. (Linked to MAJOR-1 but covered separately because the fix is a route-builder, not just a query-key swap.)

Rule: CLAUDE.md "All routes go through `ROUTES` ... Routes with parameters are typed functions."

Fix: Add `ROUTES.LOGIN_WITH_REDIRECT = (target: string) => `${LOGIN}?${QUERY_PARAMS.REDIRECT_TO}=${encodeURIComponent(target)}`` and call it from `requireAuth`.

### NIT: `apps/study/src/lib/server/auth.ts` casts `undefined` through `as unknown as ReturnType<typeof createAuth>` without a comment

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/lib/server/auth.ts` (line 19)

Problem: `export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();` is the build-time-skip pattern, but Critical Rules say "no `as` without comment". The mirror file in `apps/hangar/src/lib/server/auth.ts` and `apps/{sim,avionics}/src/lib/server/auth.ts` very likely has the same idiom.

Rule: Critical Rules: "no `as` without comment".

Fix: Add a one-line comment immediately above the cast: `// SvelteKit's build pass imports this module; auth isn't initialized until runtime, so we satisfy the type with a build-time placeholder. Any caller during build is itself buggy.` Apply to all four sibling files.
