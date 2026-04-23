---
feature: full-repo
category: security
date: 2026-04-22
branch: main
issues_found: 14
critical: 0
major: 3
minor: 7
nit: 4
---

## Summary

The study app's security baseline is strong: hooks.server.ts hydrates sessions once, a bans-guard short-circuits the response, security headers + CSP are applied defense-in-depth, and every BC read/write function takes `userId` and scopes its query with `and(eq(…id, id), eq(…userId, userId))`. Every `+page.server.ts` I read enforces `requireAuth` on both load and actions and passes `user.id` through to the BC rather than trusting IDs from the form. Zod schemas exist at the BC boundary and are re-used by the route actions. There are no raw SQL string-interpolations of user input, no `{@html}` sanitization bypasses, no open redirects, and no `$env/dynamic/public` leaks of secrets.

The handful of findings below are defense-in-depth and propagation risk: the app layout does not currently verify `emailVerified` or `role`, so any feature that later needs role-gating must remember to add it at the page level (and won't, because none of the current pages demonstrate the pattern). The `(app)` group's existing pattern of double-guarding every page with `requireAuth` is correct and should be preserved rather than leaning on the layout alone. The sim app is intentionally public and stateless; nothing to secure.

## Propagatable Patterns (top priority)

1. **No role/verification gate anywhere in the layout -- future admin pages will silently ship open.** `apps/study/src/routes/(app)/+layout.server.ts:15` runs `requireAuth` only. When hangar / ops land, authors will copy a sibling `+page.server.ts` as a template, see only `requireAuth`, and forget `requireRole`. Add a role-aware layout helper (e.g. an `(admin)` route group whose layout.server.ts calls `requireRole(event, ROLES.ADMIN)`) before the first admin-only page lands. Today there is no admin surface in the study app so this is latent, not exploitable, but it will be the first mistake.
2. **Layout-level `requireAuth` + per-page `requireAuth` duplication is load-bearing and undocumented.** Every child `+page.server.ts` under `(app)` re-calls `requireAuth(event)`. This is correct -- SvelteKit runs page loads even if the layout load throws in some prerender/client-nav paths, and the page actions would otherwise have no guard -- but nothing documents that removing it is unsafe. A reviewer optimizing "dead code" could delete them. Add a one-line comment at the top of `libs/auth/src/auth.ts`'s `requireAuth` explaining it must be called in every page/action, not just the layout, and that the layout call is the identity-hydration anchor for the chrome.
3. **Form-action ID-substitution pattern is enforced at the BC layer but not documented in route boilerplate.** Every BC function (`getCard`, `getPlan`, `getScenario`, `getSession`, `updateCard`, `setCardStatus`, `submitReview`, `recordItemResult`, `addSkipNode`, etc.) takes `userId` and the query is `and(eq(x.id, id), eq(x.userId, userId))`. This is the single most important pattern in the repo and it is invisible: there is no comment in the route actions saying "never call a BC function without user.id". Add an ESLint rule or, cheaper, a comment block in `docs/agents/reference-sveltekit-patterns.md` showing the allowed shape. `libs/bc/study/src/knowledge.ts:347` `getNodesByIds(ids)` deliberately has no userId because knowledge nodes are global; that exception needs to be called out or the next author will copy it.
4. **`reviewId` is threaded from the session runner into `recordItemResult` without verifying the review belongs to the session's user.** `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:247` passes `rev.id` from `submitReview` straight to `recordItemResult`. Today that's safe because `submitReview` returns a row it just inserted for the same `userId`, but the BC signature `recordItemResult(..., { reviewId })` accepts any string. A future caller that sources `reviewId` from the form would be an IDOR. Either tighten `recordItemResult` to verify `review.userId === userId` when `reviewId` is set, or add a comment pinning the contract.
5. **Session-runner `skip` action's side-effect path swallows errors silently.** `sessions/[id]/+page.server.ts:441` catches all errors in the plan/content mutation block and only logs. That's fine for availability, but if `addSkipNode` throws a `KnowledgeNodeNotFoundError` because the form supplied a `nodeId` (it doesn't today -- it comes from the slot), the skip would be silently downgraded. When future flows allow the learner to supply node ids in skip payloads, this swallow becomes an authorization hole. Guard: `skip` must only use ids from the slot row, never from `form.get('nodeId')`. Today it does; codify that in the comment.

## Issues

### MAJOR: No `emailVerified` check anywhere in the auth gate

- **File**: `apps/study/src/routes/(app)/+layout.server.ts:15-25`, `libs/auth/src/auth.ts:30-37`, `libs/auth/src/server.ts:84`
- **Problem**: `emailAndPassword.requireEmailVerification` is set to `false` in `createAuth`, `emailVerification.sendOnSignUp` is also `false`, and neither `requireAuth` nor the layout load checks `user.emailVerified`. A new user who signs up (when signup lands) is immediately treated as fully authenticated. Combined with `crossSubDomainCookies`, a self-signed-up user would get session rights across all future surface apps. This is intentional today (the comment at `server.ts:91-93` calls it out), but there is no single chokepoint that flips the gate on when email is ready. Every future `(app)` page will inherit whatever state the layout has at that time, which is "verified not required."
- **Fix**: Add `requireVerifiedEmail(event)` to `libs/auth/src/auth.ts` now, even if it's a no-op that just returns `user`. Call it from `(app)/+layout.server.ts`. When email verification goes live, toggle the body of `requireVerifiedEmail` to redirect unverified users. This reserves the chokepoint before it ships, so the first verified-required page doesn't have to introduce a new pattern.

### MAJOR: `AUTH_INTERNAL_ORIGIN` is hardcoded to `http://localhost` with no port

- **File**: `libs/constants/src/hosts.ts:9`, used in `apps/study/src/routes/login/+page.server.ts:40` and `apps/study/src/routes/(app)/logout/+page.server.ts:18`
- **Problem**: The internal request synthesized for `auth.handler` uses `http://localhost` as the origin. Better-auth reads the `Origin` header for CSRF validation against `trustedOrigins`, which in turn is derived from `BETTER_AUTH_URL`. In prod `BETTER_AUTH_URL` will be `https://study.air-boss.org`, so the synthetic request's origin will not match. Better-auth's `disableCSRFCheck` / same-origin check behaviour for programmatic `auth.handler` calls has changed between versions; if a future upgrade starts enforcing origin against trustedOrigins on all paths, login/logout will break in prod (or worse, a quick fix would be to add `http://localhost` to `trustedOrigins` permanently, opening the door to container-local spoofing). The synthetic call is already inside the form action (post-SvelteKit-CSRF), so the origin check is redundant, but the configuration is fragile.
- **Fix**: Either (a) drop the synthetic request and call better-auth's server-side API helpers directly (e.g. `auth.api.signInEmail({ body: { email, password } })`, which better-auth supports), or (b) derive the origin from `BETTER_AUTH_URL` at runtime so the synthesized request matches production trustedOrigins. Option (a) is cleaner because it also removes the `forwardAuthCookies` / `rewriteSetCookieDomain` dance.

### MAJOR: Session runner's `slotIndex` trust boundary is thin

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:213-219` (`submitReview`), `277-283` (`submitRep`), `388-395` (`skip`), `355` (`completeNode`)
- **Problem**: Every mutating action in the runner takes `slotIndex` from the form and passes it to `loadSlot`. `loadSlot` reads all the session's slots and finds the matching one via `results.find((r) => r.slotIndex === slotIndex)`, then the slot's `cardId` / `scenarioId` / `nodeId` are used from that row -- so IDOR on the target is closed. But a user can submit `slotIndex=0` when `session.current` is slot 5, effectively re-writing a completed slot. `recordItemResult` UPSERTs on `(sessionId, slotIndex)`, overwriting the prior answer. This lets a learner overwrite a past answer as long as the session is still open, which breaks the "you can't change answers after you've seen the next question" integrity property that the calibration / mastery calculation depends on.
- **Fix**: In `requireOpenSession` (or in `loadSlot`), reject a submit when `results[slotIndex].completedAt !== null`. A slot that already has a result is final. Alternatively, require `slotIndex === current.slotIndex` -- which is the actual UX contract -- and return 409 otherwise.

### MINOR: `AUTH_INTERNAL_ORIGIN` / synthetic Request can suppress better-auth rate limiting

- **File**: `apps/study/src/routes/login/+page.server.ts:38-47`
- **Problem**: Better-auth's built-in rate limiter keys by IP. The synthesized Request has no `X-Forwarded-For` / peer IP, so all login attempts bucket together under the server's loopback identity. In dev this is a non-issue; in prod behind a reverse proxy it disables the login rate limiter entirely, which is the main brute-force protection.
- **Fix**: Forward `request.headers` (at least `X-Forwarded-For`, `User-Agent`, and `Cookie`) onto the synthesized Request. Better yet, drop the synthetic request per the MAJOR above.

### MINOR: `error.message` passed via `fail(401, { error: data?.message })` can leak better-auth internals

- **File**: `apps/study/src/routes/login/+page.server.ts:49-55`
- **Problem**: The branch reads `data?.message` from better-auth's JSON response and surfaces it to the client. Better-auth's error messages are user-facing (`"Invalid email or password"`) but the shape is not contractual across versions. A future better-auth release could emit `"User abc123 is banned"` or include email-enumeration signals like `"User not found"` vs `"Wrong password"`. The fallback `"Invalid email or password"` is safe; passing through `data?.message` unconditionally is not.
- **Fix**: Allowlist: if `authResponse.status === 401` render `"Invalid email or password"`, if 403 render `"Account suspended"`, everything else render the generic. Never pass `data.message` through.

### MINOR: Response-header writes wrapped in `try / catch { /* ignore */ }` silently swallow security-header application

- **File**: `apps/study/src/hooks.server.ts:30-42`, `128-131`
- **Problem**: `applySecurityHeaders` and the `x-request-id` write both catch errors from frozen header sets. A response whose headers couldn't be written (streaming or passthrough) will ship without `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, or HSTS. The failure is silent. If a future route returns a raw `fetch()` response (proxying, SSE, file download), the headers drop and we won't know.
- **Fix**: Log a single warning when any header write throws (`log.warn('response headers frozen; security headers not applied')`). If the application strictly requires a header (HSTS), wrap the response in a new `Response(body, { headers })` fallback.

### MINOR: CSP allows `style-src 'unsafe-inline'`

- **File**: `apps/study/svelte.config.js:22`
- **Problem**: `'unsafe-inline'` on styles defeats a large chunk of CSP's XSS mitigation -- any HTML-injected `<style>` or `style="..."` attribute runs. SvelteKit scoped styles are emitted in `<style>` tags; nonces are auto-generated and would work, but the config uses `unsafe-inline` instead. The `renderMarkdown` output does not emit `style` attributes, so there's no input-driven style injection today, but an attacker who finds any reflected-XSS primitive later gets unrestricted CSS for phishing overlays.
- **Fix**: Switch to `nonce-$nonce` for styles (SvelteKit's CSP `mode: 'auto'` supports it). Confirm dev-mode HMR still works; if not, gate `'unsafe-inline'` behind `dev` only.

### MINOR: `renderMarkdown` link rendering does not HTML-escape the URL into the `href` attribute

- **File**: `libs/utils/src/markdown.ts:42-45`
- **Problem**: `renderInline` calls `escapeHtml(text)` first, which turns `"` into `&quot;` -- so a URL like `https://a.test" onmouseover="alert(1)` in source markdown arrives at the regex as `https://a.test&quot; onmouseover=&quot;alert(1)`. The `[^)\s]+` match is greedy up to whitespace or `)`, so the entire mangled string (including the already-escaped `&quot;`) is inserted into the `href` attribute. That's actually safe today because `&quot;` is not a real quote inside an attribute -- the browser reads it as a literal. But the pattern is fragile: if the escape set ever loses `"` (e.g. to support `&quot;` pre-escaped markdown), the output becomes attribute-injectable. The regex also allows `http://example.com?q=<script>` to survive verbatim into the href because `<` was already escaped to `&lt;` before the regex ran; browsers don't execute that, but a future refactor that escapes post-match would.
- **Fix**: Split the concern. Apply `renderInline` to text only; never let escaped text flow into an attribute. In the link branch, escape the captured URL with a URL-safe escape (`encodeURI` kept intact, then escape `"` and `<`). Add a test with `[x](javascript:alert(1))` (already handled by the scheme allowlist) and `[x](https://a.test" onx=y)`.

### MINOR: `rewriteSetCookieDomain` hard-codes `SameSite=Strict` on all better-auth cookies

- **File**: `libs/auth/src/cookies.ts:143-147`
- **Problem**: The rewrite strips any `SameSite=` emitted by better-auth and replaces it with `Strict`. That matches the intended policy today (no OAuth, no magic-link entry points), but `SameSite=Strict` on the `__session` cookie breaks magic-link sign-in when the user clicks an email link (the top-level navigation arrives with no cookie). The magic-link plugin is already registered at `libs/auth/src/server.ts:108-113`, so the feature is on the roadmap. When magic-link ships, users will click the email link, arrive with no session cookie, and sign in succeed will set a Strict cookie that then fails the very next navigation (the POST returned from the link handler) for the same SameSite reason.
- **Fix**: Either (a) downgrade to `SameSite=Lax` now and document that `Strict` is only safe with zero cross-origin entry points, or (b) keep `Strict` but add a conditional: for the magic-link callback path, emit a `Lax` cookie. Option (a) is simpler. The security delta vs `Lax` is small given SvelteKit's built-in origin-validated form actions.

### MINOR: `hooks.server.ts` reads `x-request-id` from the client without rate limiting

- **File**: `apps/study/src/hooks.server.ts:11-17`, `54-55`
- **Problem**: The header is accepted from the client when it matches `^[a-zA-Z0-9_-]{1,64}$`. An attacker can set a specific request id and poison logs (log-forging mitigated by the pattern, but log correlation is defeated). Acceptable when the log is a private stream, dangerous when logs are exposed to operators who pivot off request-id. Minor today because LOG_LEVEL is server-only and logs are local.
- **Fix**: Either strip the client-supplied request id and always generate server-side, or namespace it (`log.info(..., { requestId: 'client:' + raw })`) so operators can tell them apart.

### NIT: `AUTH_INTERNAL_ORIGIN` + `forwardAuthCookies` comment explains the footgun but code doesn't self-guard

- **File**: `libs/auth/src/cookies.ts:110-114`, `libs/auth/src/logout.ts:22-26`
- **Problem**: Both files have a "Trust note: once a proxy lands, callers should prefer `Forwarded:` / `X-Forwarded-Host`" comment. That's a future-me footgun; when the proxy lands, the comment will not surface in a code review. The hooks do not currently validate the proxy headers.
- **Fix**: Add a `// TODO(proxy)` with a clear trigger ("when kit.adapter-node is fronted by a proxy"), or better, centralize host resolution in a single `resolveRequestHost(event)` helper that today returns `event.url.host` and tomorrow can do the proxy-aware thing in one place.

### NIT: `better-auth` `cookieCache` enabled at 5 minutes -- ban propagation window is 5 minutes

- **File**: `libs/auth/src/server.ts:56-60`
- **Problem**: Documented in the comment; banning a user leaves them authenticated for up to 5 minutes. The hooks check `locals.user.banned` on every non-auth request, so if the cookie cache returns a stale unbanned record, the ban is skipped. For a typical learner platform this is fine; for a future admin-impersonation or data-export feature where we need instant revocation, 5 minutes is too long.
- **Fix**: Document in `libs/auth/src/server.ts` and in `docs/decisions/` that any endpoint that exfiltrates data (account deletion, export, impersonation) must call `auth.api.getSession({ query: { disableCookieCache: true } })` to bypass the cache.

### NIT: `sim` app ships no CSP and no security headers

- **File**: `apps/sim/svelte.config.js:1-29`, absence of `apps/sim/src/hooks.server.ts`
- **Problem**: The sim app is intentionally public and stateless, but it still serves HTML/JS on a domain that will share cookies with the study app via `crossSubDomainCookies` on `.airboss.test` / `.air-boss.org`. An XSS in sim (no current vector, but sim loads a Web Worker for FDM, handles keyboard input, and may grow) would expose study's session cookie -- except cookies are `httpOnly`, so the practical impact is phishing overlay, not session theft. Still: both apps should ship the same baseline headers.
- **Fix**: Add a `hooks.server.ts` to `apps/sim` that applies `applySecurityHeaders` (extract the helper into `libs/auth` or `libs/utils`). Add a CSP block to `apps/sim/svelte.config.js`. This is the "propagatable pattern" point in practice: extract it once before surface #3 (spatial, audio) gets created.

### NIT: `ipAddress` and `userAgent` on `bauthSession` are populated but never audited

- **File**: `libs/auth/src/schema.ts:36-37`
- **Problem**: Better-auth stores `ipAddress` and `userAgent` on session rows. The study app never surfaces "active sessions" to the user for review/revocation, and there is no alert on "new-device sign-in". This is a missing defense-in-depth feature, not a vulnerability.
- **Fix**: When the settings surface lands, expose a "Signed-in devices" list with a revoke action. Capture in a TODO doc today so it doesn't get forgotten behind the verification-email toggle.
