---
feature: full-codebase
category: security
date: 2026-04-27
branch: main
issues_found: 8
critical: 1
major: 2
minor: 4
nit: 1
---

## Summary

Posture has improved materially since the 2026-04-22 sweep: CSP/HSTS/XCTO/Referrer/Permissions headers are now wired through `kit.csp` + `hooks.server.ts`, the dual-gate auth contract is documented and applied, every protected route under `(app)/` runs `requireAuth` at the layout AND in each per-page load + action, file-streaming endpoints have prefix + symlink guards, the SameSite gap was tightened to `strict`, the `addSkipNode` data-integrity gap was closed at the BC, login no longer logs raw email on 5xx, and Drizzle is used exclusively (the few `sql` template usages parameterize values; `sql.raw` is fed only compile-time constants from `@ab/constants`). The remaining issues cluster around three surfaces: (1) the new hangar admin user-detail page exposes live `bauth_session.token` values to admins, (2) the upload action writes a temp file at a path joined with the client-supplied filename without sanitization, (3) a couple of HTML sinks in the small markdown renderer interpolate URLs into attributes without quote-escaping. The CSP that landed materially shrinks the exploit surface for (3).

## Issues

### critical: Live session tokens leaked to /users/[id] payload

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/lib/server/users.ts:204-223; /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/users/[id]/+page.server.ts:36-43
- **Problem**: `listRecentUserSessions` returns `bauth_session.token` and the page server passes it through to the client payload (`token: s.token`). `bauth_session.token` is the session secret better-auth issues in the cookie -- possessing it is equivalent to possessing a logged-in cookie for that user. The page is admin-only, but admins are not auth-gods: the value flows into SSR HTML, browser dev-tools, the network tab, page caches, screenshots, and any log/observability sink that snapshots SvelteKit `data` payloads. A compromised admin browser, a leaked screen-share, or an export of `data` JSON exfiltrates working session tokens for arbitrary users with no detection. This is privilege escalation (admin -> impersonate any user, including other admins) and turns the admin surface into the most valuable target in the system.
- **Fix**: Drop `token` from `UserSessionRow` and from the SELECT in `listRecentUserSessions`. The display page does not need the secret -- show only `id`, IP, UA, created/expires. If admin-side "revoke this session" is needed, key the revoke action on `bauth_session.id`, not the token. Audit: also confirm no other surface (job logs, audit metadata, error reports) ever stamps `bauth_session.token` -- a grep against the schema column should return only the writer (better-auth) and this read site.

### major: Upload action joins a tmpdir with the client-supplied filename

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:97-100
- **Problem**: `const tempPath = join(dir, file.name); await writeFile(tempPath, buffer);` -- `file.name` comes from the FormData entry, which is whatever the client puts in the `Content-Disposition: form-data; ... filename=` header. A scripted client (or a curl one-liner) can send `filename="../../../../etc/cron.d/evil"` or `filename="../../../../home/runner/.ssh/authorized_keys"`. `mkdtemp` makes the parent directory unique, but `join` does not normalize traversal -- the resulting `tempPath` escapes `dir`. The role gate (`AUTHOR | OPERATOR | ADMIN`) limits who can trigger this, but the write happens with the server process's filesystem privileges and operators are explicitly not the same trust band as host admins. Subsequent `fs.rename(tempPath, destPath)` would fail (different filesystems) but the `writeFile` already landed.
- **Fix**: Use `path.basename(file.name)` before joining, and additionally reject any name that still contains a path separator after basename normalization. Better still: ignore `file.name` for the temp path entirely (use a fixed `upload.bin` inside the unique tmpdir) and keep `originalFilename` only as metadata for the job payload. The downstream extension extraction already runs on `originalFilename` separately so nothing else depends on the temp filename matching.

### major: Markdown renderer interpolates URLs into HTML attributes without quote escaping

- **File**: /Users/joshua/src/_me/aviation/airboss/libs/utils/src/markdown.ts:43-46, 142-149
- **Problem**: Inline link rendering builds `<a href="${safe}">${label}</a>` and the block-image path builds `<img src="${safeUrl}" alt="${safeAlt}" ...>`. The URL regex `[^)\s]+` accepts characters including `"`, so an authored URL like `/asset"onerror=alert(1) x=` passes the protocol allow-list (starts with `/`) and the resulting HTML breaks out of the `src=` / `href=` attribute and injects an event handler. The protocol filter (`/^(https?:\/\/|\/|#)/`) catches `javascript:` and friends but does not enforce that the URL is attribute-safe. Today the only renderer call sites are knowledge-node bodies (trusted authoring) and handbook-section markdown (trusted ingest), and the new CSP (`script-src 'self' <hash>`) blocks inline event-handler execution -- so this is not directly exploitable end-to-end. It is still a major XSS-class bug because: (a) the function lives in `@ab/utils` and any future call site that renders user-authored markdown inherits the sink, (b) CSP is defense-in-depth and a future `style-src` change or nonce regression would re-open it, (c) the hangar `MarkdownPreview.svelte` component already renders client-typed input through this same function in the authoring UI.
- **Fix**: After the protocol allow-list passes, run the URL through the same `escapeAttr`-style escape used by `libs/sources/src/render/modes/web.ts` (`&` -> `&amp;`, `"` -> `&quot;`, `<` -> `&lt;`, `>` -> `&gt;`). Same for `safeAlt` -- it is currently `escapeHtml(alt)` which doesn't escape `"`. Mirror the `escapeAttr` helper from `web.ts` and reuse it in both spots. Add a regression test with a URL containing `"` and an alt text containing `"`.

### minor: Sim attempt endpoint trusts client-supplied `outcome` and `reason` strings

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/sim/src/routes/[scenarioId]/attempt/+server.ts:43-104
- **Problem**: `isAttemptPayload` only checks that `outcome` and `reason` are strings; the route then casts them through to `recordSimAttempt` with a comment that says "we trust the caller because the cockpit page produced it from a worker message we control end-to-end." The worker is browser code -- it ships to every authenticated user and can be edited in DevTools / replayed via `fetch`. A malicious caller can store arbitrary strings in the sim attempt row, including ones that the BC's `evaluateGrading` would never produce. No exploit beyond the row owner's own history (the route checks `locals.user.id`), but it violates the project's "validate all user input against an allowlist" rule.
- **Fix**: Validate `outcome` against `SIM_SCENARIO_OUTCOMES` (or whatever the canonical enum is) and bound `reason` length. Same for `chosenOption`-style fields if they exist in the tape. Drop the "worker we control" comment -- the worker is client code.

### minor: Heartbeat endpoint accepts unbounded delta below the cap but above the min

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/heartbeat/+server.ts:34-66
- **Problem**: The route validates `delta >= HANDBOOK_HEARTBEAT_MIN_DELTA_SEC` but relies on `recordHeartbeat` to cap the upper bound (`HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`). The min-floor anti-flood guard is fine; the missing client-facing upper bound means a scripted caller can post `{delta: 999999999}` repeatedly and rely on the BC clamp -- which works, but consumes a DB write per call and lets a single user keep one connection busy. Combined with the route having no per-user rate limit (general project gap, not specific to this endpoint), it is a cheap DoS amplifier.
- **Fix**: Reject `delta > HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4` at the route boundary with a 400, same shape as the underflow guard. The cap is already a constant; reuse it.

### minor: No application-level rate limit on the auth + form-action surfaces

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/lib/server/auth.ts (full file); /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts; /Users/joshua/src/_me/aviation/airboss/libs/auth/src/server.ts:29-116
- **Problem**: `createAuth` does not pass a `rateLimit` config to `betterAuth(...)`. better-auth ships a memory-backed default rate limiter (10 req / 10s per IP) which is on by default in newer versions, but (a) memory backing means it resets per process and is bypassable behind a multi-instance deploy, (b) there is no explicit per-account lockout for repeated bad-password attempts on `signInEmail`, (c) the `/login` form action is a SvelteKit form, not the better-auth endpoint, so the better-auth limiter only kicks in via the synthetic internal request -- and the synthetic request always carries `localhost` as origin/IP, which would group all real users into one bucket and rate-limit the entire app. No rate limit on the magic-link or password-reset triggers either.
- **Fix**: (1) Switch `auth.api.signInEmail({ body, headers: request.headers })` instead of constructing a synthetic Request -- this preserves the real client IP for better-auth's own rate limit. (2) Configure `rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 }` (or similar) in `createAuth` so the limit is shared across instances and persisted. (3) Add account-level lockout policy on signInEmail: track consecutive failures per `email` (hashed) and 429 after N. The 2026-04-22 review flagged the synthetic-Request issue too; this finding extends the same fix to close the rate-limit hole.

### minor: thumbnail and download endpoints don't reverify the resolved path is inside `data/sources/`

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/thumbnail/+server.ts:30-43; /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/download/+server.ts:32-40
- **Problem**: Both endpoints call `resolve(REPO_ROOT, row.media.thumbnailPath)` and `resolve(REPO_ROOT, 'data', 'sources', row.type, row.id, row.edition.effectiveDate, 'chart.zip')`. The thumbnail path is sourced from the DB column written by the fetch worker, and the download path is composed from DB row fields. If a future fetch handler ever stores a path with `..` segments (operator-supplied URL, hand-crafted seed, migration bug) the resolved path can escape `data/sources/`. The `/sources/[id]/files/raw` endpoint already has the right guard (lines 64-69 there); the same pattern is missing here.
- **Fix**: After `resolve`, assert `abs.startsWith(`${sourcesRoot}/`)` (where `sourcesRoot = resolve(REPO_ROOT, 'data', 'sources')`); throw 400 otherwise. Mirror the helper from `files/+page.server.ts:isInsideRoot` so the three endpoints share one guard.

### nit: `applySecurityHeaders` swallows header-set failures silently

- **File**: /Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts:36-49; /Users/joshua/src/_me/aviation/airboss/apps/hangar/src/hooks.server.ts:71-89
- **Problem**: The `try { ... } catch { /* skip silently */ }` block hides any case where security-header writes fail. If a future response type or proxy layer makes the headers frozen for a non-trivial fraction of requests, posture degrades silently. The comment is accurate (some streaming responses do freeze headers), but failing closed without a log signal means a regression here is invisible.
- **Fix**: Log at `debug` level when the catch fires, including the request path. No behaviour change; just observability so a regression surfaces.
