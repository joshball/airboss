---
feature: full-codebase
category: security
date: 2026-04-22
branch: main
issues_found: 4
critical: 0
major: 1
minor: 2
nit: 1
---

## Summary

Overall posture is solid. Every `(app)` route is gated by `requireAuth` at the layout level, every BC function that takes a `userId` constrains the subsequent query to that user (including joins through `session_item_result` and `card_state`), form actions validate inputs against Zod or constant enums before hitting the BC, and mutation is restricted to SvelteKit form actions (no custom API endpoints, so the framework-provided origin/CSRF check remains in effect). Drizzle is used exclusively; the one `sql.raw` usage only interpolates compile-time constants from `@ab/constants`. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in non-dev, with the Domain attribute resolved per-request so session fixation via a spoofed Host is scoped to the configured dev/prod domain. Dev seed users are explicitly refused when `DATABASE_URL` is not a local dev host, the dev-account quick-fill UI is `{#if dev}`-gated in the page template, and `DEV_PASSWORD` is a static string imported only in dev contexts. Main gap is the absence of any `Content-Security-Policy` or related security headers. A few smaller items are called out below.

## Issues

### major: No Content-Security-Policy or security-header middleware

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts (full file); /Users/joshua/src/_me/aviation/airboss/apps/study/svelte.config.js:1-36
- **Problem**: `hooks.server.ts` does not set `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `X-Content-Type-Options`, or `Referrer-Policy`. `svelte.config.js` also has no `kit.csp` block, so SvelteKit's built-in CSP is not configured either. The app renders user-authored card `front`/`back` text and `tags` (personal cards) and author-controlled markdown via `{@html renderMarkdown(...)}` in `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:238,249` and `.../learn/+page.svelte:113`. `renderMarkdown` escapes before re-emitting a narrow tag set, so it is not itself an XSS vector today, but with no CSP there is zero defense-in-depth if any future renderer change (or a third-party component) introduces an unescaped sink. No HSTS also means a downgrade-to-http request on a new device hits the server unsigned before any cookie is set.
- **Fix**: Add response-header middleware in `hooks.server.ts` (or `kit.csp` in `svelte.config.js`) that sets, at minimum: `Content-Security-Policy` with `default-src 'self'`, `script-src 'self' 'nonce-<...>'` (SvelteKit supports CSP nonces natively), `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and in prod `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Apply inside the non-`isAuthPath` branch so better-auth's own responses pass through unmodified.

### minor: Login action logs the submitted email to server logs on 5xx path

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts:60-66
- **Problem**: When the login handler throws (DB outage, better-auth bug), the catch logs `metadata: { email }`. The 500 branch is the only path where an unauthenticated caller's raw email gets written to structured logs. An attacker who knows a target email can therefore correlate log noise against identity enumeration by triggering 500s from the login endpoint. Similar concern (lower): the `metadata: { email }` format means an ops operator reading logs sees every failed-login email in plaintext.
- **Fix**: Drop `email` from the 500-log metadata (the `requestId` is already sufficient to correlate the DB/auth failure). If you want identity in the log for debugging, hash it: `metadata: { emailHash: createHash('sha256').update(email).digest('hex').slice(0,16) }`. Or log the email only when `dev` is true.

### minor: `addSkipNode` does not validate nodeId against the knowledge-graph table

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/plans/[id]/+page.server.ts:154-166; /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/plans.ts:250-260
- **Problem**: The form action only checks `nodeId` is a non-empty string, then calls `addSkipNode(planId, userId, nodeId)` which persists it to `plan.skip_nodes` with no foreign-key or existence check. A user can therefore poison their own plan with arbitrary strings. This is an own-account-only data-integrity issue, not a cross-user exposure -- the plan is scoped to `userId` and the skip list only narrows the engine's own-user pool -- but it still violates "validate all user input against an allowlist" because `nodeId` effectively names a row in a different table.
- **Fix**: In `plans.ts:addSkipNode`, look up the node via `getNodesByIds([nodeId])` (or equivalent) before appending, and throw a `KnowledgeNodeNotFoundError` if it does not resolve. Alternatively, add a zod string-shape check (`z.string().regex(/^node_[A-Z0-9]{26}$/)`) so only well-formed ULIDs are stored, and let the engine silently skip unknown ids. The form action should map the error to a `fail(400, ...)`.

### nit: Cookie `sameSite` is `lax`, not `strict`, on the session cookie

- **File**: /Users/joshua/src/_me/aviation/airboss/libs/auth/src/cookies.ts:40
- **Problem**: `authCookieOptions` hard-codes `sameSite: 'lax'`. `lax` permits the cookie on top-level GET navigations from other origins, which is the right default for most apps (preserves "click a link from email and stay signed in"), but the app has no public content and all mutation goes through POST form actions (which SameSite never relaxes). `strict` would close the small residual gap where an attacker's `<a href=https://study.example/...>` causes a side-effect on a GET request (e.g. a future `+server.ts` GET handler that changes state).
- **Fix**: Consider tightening to `sameSite: 'strict'` now while there are no cross-origin entry points. If magic-link email sign-in lands and needs the link to land signed-in, downgrade at that point. The better-auth default is also `lax`; if you downgrade better-auth's own cookies via `rewriteSetCookieDomain` you can also rewrite `SameSite=Strict` there. No exploit path today -- flagging as a hardening opportunity.
