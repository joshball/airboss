---
feature: study-app-surfaces (chunk 1)
category: dx
date: 2026-05-01
branch: main
issues_found: 18
critical: 0
major: 6
minor: 8
nit: 4
---

## Summary

The study app surface (routes + lib + hooks + config) has a strong DX baseline: every server load uses `requireAuth`, every form action funnels failures through typed BC errors and a `createLogger('study:<area>')` namespace, and every error path carries `requestId + userId + metadata` so logs join cleanly. The root and (app) error boundaries already gate on a `isUserSafeMessage` predicate so raw `Error: ...at fn()` strings cannot leak to the browser. The hooks chain stamps a request id, surfaces it on the response header, and emits a one-line per-request access log with method/path/status/ms.

The pain shows up in three places: (1) generic user-facing copy on 5xx fallback paths ("Could not save changes.", "Try again.") that gives on-call no operation/entity context when grepping logs, (2) sloppy log message strings that keep saying `"<func> threw"` instead of describing the operation + entity (`"failed to save card"`, `cardId=<id>`), so a fresh on-call greps for "save card failed" and finds nothing, and (3) heavy use of `.catch(() => null)` swallowing real DB errors as 404s on the library handbook tree. There are also several unbounded log levels (banned-user as `warn`, sign-out 5xx as `error` with no body) that need calibration.

Onboarding is good: route docstrings are dense and useful, ADR / WP references are in-line, the dev-account quick-fill in `/login` accelerates local testing, and the discovery-spawn hook explains its purpose at the top. No undocumented env vars beyond what `auth.ts` validates explicitly.

No critical findings. The biggest items are major: swallowed DB errors in handbook routes (look like 404s, are actually outages) and inconsistent error-log content quality.

## Issues

### MAJOR: handbook routes silently turn DB failures into 404s

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts`, `[section]/+page.server.ts`, `[section]/heartbeat/+server.ts`

Problem: Every `getReferenceByDocument`/`getHandbookChapter`/`getHandbookSection` call uses `.catch(() => null)` then `if (!ref) throw error(404, ...)`. A connection-refused, query-timeout, or constraint-violation error is now indistinguishable from "row not found." On-call wakes at 2am, sees a flood of "Section not found" 404s, looks at the BC, sees the table is fine, and burns time before realising the DB is flapping.

```typescript
const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
if (!ref) throw error(404, `Handbook not found: ${documentSlug}`);
```

Fix: Replace `.catch(() => null)` with a typed not-found check (the BC already has `getReferenceByDocument` that should throw a typed `ReferenceNotFoundError` or return null on a real miss; if it currently throws on miss, add the typed error). Re-throw real failures so the SvelteKit `handleError` path logs them and surfaces 500. Pattern should match the goals page (`if (err instanceof CredentialNotFoundError) error(404); throw err;`).

### MAJOR: error log messages are non-grep-friendly verbs

File: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:111,141,192,222`, `memory/+page.server.ts:86,117`, `memory/review/[sessionId]/+page.server.ts:191,227,258,321,354`, `reps/[id]/+page.server.ts:108`, `reps/new/+page.server.ts:108`, `plans/[id]/+page.server.ts:84`, `plans/new/+page.server.ts:80`, `goals/new/+page.server.ts` (no log), `session/start/+page.server.ts:62,92,170`, etc.

Problem: Almost every catch logs `'<funcName> threw'`. At 2am on-call greps for "save card failed" or "could not delete deck" (the user-visible string) and finds nothing because the log says `'updateCard threw'` or `'deleteSavedDeck threw'`. The function-name-only pattern also forces the reader to know the BC API to make sense of the log line. Worse, the user-facing fallback strings ("Could not save changes.", "Could not delete deck.") never appear anywhere greppable.

Fix: Standardise log messages on `'<verb> <entity> failed'` with the user-visible noun phrase, and include the same phrase in the `fail()` message so log-grep matches user-report-grep. Example:

```typescript
log.error(
  'save card failed',
  { requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id } },
  err instanceof Error ? err : undefined,
);
return fail(500, { values: input, fieldErrors: { _: 'Could not save card.' }, intent: 'update' });
```

This is a one-pass mechanical edit across the ~25 catch blocks in the locked scope.

### MAJOR: handbook 404 messages leak internals to learners

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts:38,41`, `[section]/+page.server.ts:38`, `heartbeat/+server.ts:68,71`, `library/cert/[cert]/+page.server.ts`, `library/topic/[topic]/+page.server.ts:69`, `library/regulations/[kind]/+page.server.ts:75`

Problem: `error(404, 'Handbook not found: phak')`, `error(404, 'Section not found: phak / 5.2')`, `error(404, 'Unknown topic: foobar')` -- these messages render to the user via `+error.svelte`'s `safeMessage` (passes the `isUserSafeMessage` predicate at <200 chars / no newlines / no stack frames). For a typo the user gets a bare slug back; for a stale link they get a slug-shaped string with no recovery affordance. Worse, the slug pattern lets a fuzzer enumerate which document slugs exist (200) vs not (404 with the typed slug back).

Fix: Use `error(404, { message: 'Handbook not found' })` consistently. The slug already lives in the URL bar; echoing it back in error copy is noise. The (app)/+error.svelte already provides "Back to dashboard" -- that's the right recovery, not the slug.

### MAJOR: `/login` 500-path masks better-auth response shape

File: `apps/study/src/routes/login/+page.server.ts:73-93`

Problem: When `authResponse.ok` is false but the body is unparseable, the user sees `'Invalid email or password'` regardless of whether the actual problem was a 503 (DB down) or a real auth failure. The log line `'login handler threw'` only fires on a thrown exception path -- a 500 returned by better-auth with an unparseable body silently shows "Invalid email or password" to the learner and writes nothing to the airboss logs.

```typescript
if (!authResponse.ok) {
  const data = (await authResponse.json().catch(() => null)) as { message?: string } | null;
  // ... fail(401|400, ...)
}
```

Fix: Branch on `authResponse.status`: `< 500` -> treat as auth failure (log at `info`, surface generic message); `>= 500` -> log at `error` with `{ status, requestId, bodySnippet }` and surface 'Sign-in service is having trouble. Try again in a moment.' so the user knows it's not their password.

### MAJOR: discovery spawn errors logged at `warn`, not `error`

File: `apps/study/src/lib/server/discovery.ts:55-65`

Problem: The discovery hook spawns a long-running `bun run sources discover-errata` child. If `spawn` fails (binary not found, perms), or the child throws on startup, the hook logs at `warn`. A spawn failure means errata discovery is permanently broken -- that's not a warning, that's an error condition. On-call grepping `level=warn` for noise will dismiss it; grepping `level=error` will miss it. Because it's fire-and-forget, the only visibility is this log line.

Fix: Promote to `log.error` for both branches. `warn` is appropriate for "child started but may take a while" -- not for "we failed to start the child at all."

### MAJOR: 5xx during sign-out logged but session cookies still cleared with no upstream signal

File: `apps/study/src/routes/(app)/logout/+page.server.ts:29-39, 44-50`

Problem: The handler logs `'sign-out handler returned 5xx'` and then unconditionally clears local cookies in the `finally` block. The user is redirected to `/login` and sees a normal sign-in screen, while the better-auth server still has a live session row that an attacker holding a stolen cookie could continue to use (the comment at the top of the catch acknowledges this risk). The `error` log carries no backing-server response body, so a 2am responder sees `status=500` and has nothing to investigate.

Fix: Capture and log a body snippet (`(await authResponse.text()).slice(0, 200)`) on 5xx so the responder has context on which row failed to invalidate. Consider a `metric` (counter `signout.upstream_5xx`) so the team gets paged when the rate climbs, since the user-facing flow looks healthy.

### MINOR: `console`-style banned-user log uses `warn` plus no follow-up

File: `apps/study/src/hooks.server.ts:133-139`

Problem: `log.warn('banned user blocked', ...)` for every banned-user request. A single banned account hammering the app produces hundreds of warns/minute and pushes legitimate warnings out of view. There's no rate counter or structured event marking it for analytics.

Fix: Either downgrade to `info` (it's expected behaviour, not an anomaly) or sample (`log.warn` once per `userId+hour`). Better: emit a counter `auth.banned_block_total{userId}` and let metrics track the rate.

### MINOR: `applySecurityHeaders` swallows a real misconfiguration class

File: `apps/study/src/hooks.server.ts:44-57`

Problem: The `try { ... } catch {}` around header sets exists for "frozen response headers (streaming/binary)" -- a real case. But it also catches a Permissions-Policy syntax error or any other future bug that throws in `set()`. There's zero log line, so a regression in header content silently turns off CSRF / clickjacking defenses for streaming responses.

Fix: Catch with `(err) => { if (!(err instanceof TypeError)) log.error('failed to set security headers', { metadata: { ... } }, err); }`. Frozen-headers throws a TypeError ('Headers immutable'); anything else is a bug.

### MINOR: `requireAuth(event)` called repeatedly per action

File: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts`, `goals/[id]/+page.server.ts`, `plans/[id]/+page.server.ts`, `reps/[id]/+page.server.ts`, `memory/review/[sessionId]/+page.server.ts`, `session/start/+page.server.ts`

Problem: Every action re-runs `requireAuth(event)`, which is fine for correctness (defense-in-depth) but it means `event.locals.user` is already populated by the (app)/+layout.server.ts guard and the hooks `getSession` call. Doubling up on a session lookup per action is wasted DB load AND obscures who's actually paying for the auth round-trip in flame graphs.

Fix: `requireAuth` should be cheap (read from `event.locals.user`) -- verify that's what it's doing. If `requireAuth` re-fetches, change it to use the cached locals. Either way, leave the call site alone (defense-in-depth).

### MINOR: card-page client-side fetch has nested try/catch that loses original error

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte:230-239`

```typescript
if (!res.ok) {
  try {
    const payload = await res.json();
    const message = payload?.data?.fieldErrors?._ ?? 'Could not add citation.';
    throw new Error(message);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Could not add citation.');
  }
}
```

Problem: The inner `throw new Error(message)` is caught by the outer catch, which then re-checks `instanceof Error` (always true) and rethrows. The `err.cause` is never attached, so an upstream toast handler sees only the user-safe string and loses any HTTP status / payload context for client-side debugging.

Fix:

```typescript
if (!res.ok) {
  let message = 'Could not add citation.';
  try {
    const payload = await res.json();
    if (payload?.data?.fieldErrors?._) message = payload.data.fieldErrors._;
  } catch {
    // body wasn't JSON -- keep the default message
  }
  throw new Error(message, { cause: { status: res.status, url: res.url } });
}
```

### MINOR: session start `previewSession` error has no `metadata`

File: `apps/study/src/routes/(app)/session/start/+page.server.ts:62-67`

Problem: `'previewSession threw'` log includes `requestId, userId` only. No mode/focus/cert/seed, which is the entire input that determined the failure. On-call sees the log, can't reproduce.

Fix: Pass `metadata: { mode, focus, cert, seedPresent: seed != null }` so the log line carries the inputs.

### MINOR: handbook redirect uses 308 with no logging

File: `apps/study/src/routes/(app)/handbooks/[...rest]/+server.ts`

Problem: The legacy `/handbooks/...` -> `/library/...` redirect doesn't log. Once external links die off these redirects should drop. With no telemetry, there's no signal for "safe to remove the redirect" except a manual log scan. Per `feedback_no_legacy_in_airboss`, every legacy compatibility shim wants a planned retirement signal.

Fix: `log.info('legacy handbooks redirect', { metadata: { from: url.pathname, to: target } })`. Sample if needed. Or ship a counter `legacy.handbooks_redirect`. Then add a TODO note in the file linking to the metric so it's clear how to know when it's safe to delete.

### MINOR: `narrow` and `coerceEnum` patterns are duplicated across page servers

File: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:34-36`, `plans/new/+page.server.ts:21-23`, `session/start/+page.server.ts:30-43`, `memory/review/+page.server.ts:43-46`, `cards/[id]/+page.server.ts` (implicit), reps/browse, knowledge, etc.

Problem: `coerceEnum<T>(raw, values, fallback)` is reimplemented in `plans/[id]` and `plans/new`, while `narrow` (from `@ab/utils`) is used in browse pages, while `parseDomain`/`parseMode`/`parseFocus`/`parseCert` are hand-rolled in `session/start`. Same operation, three names.

Fix: Pick one (`narrow` from `@ab/utils` -- it already exists). Replace the per-route helpers. Add a `narrowOr<T>(raw, values, fallback)` variant if the fallback flavour earns its keep.

### NIT: `cards/[id]` server load doesn't tag a logger

File: `apps/study/src/routes/cards/[id]/+page.server.ts`

Problem: This is the only public (unauthenticated) route in scope. If `getPublicCard` or `getCitationsOf` throws, the `handleError` global path logs it under the bare `'study'` namespace -- there's no `study:public-card` tag to distinguish anonymous-traffic failures from authenticated-flow failures.

Fix: `const log = createLogger('study:public-card')` and wrap the load in a try/catch that re-throws. Or rely on `handleError`; if so, call out the choice in the docstring.

### NIT: error message inconsistencies for "not found" goals

File: `apps/study/src/routes/(app)/goals/[id]/+page.server.ts:61, 139, 158, 171, ...`

Problem: The load path uses `error(404, "Goal '${id}' not found.")` (echoes ID), all action paths use `error(404, 'Goal not found.')` (no ID). Both render to the user via the same boundary -- the inconsistency just makes the UX feel sloppy.

Fix: Pick one. "Goal not found." (drop the ID echo) is the right choice for the same reason as the handbook 404 finding.

### NIT: `handbook-asset` 404 is a generic 'Not found' for three distinct cases

File: `apps/study/src/routes/handbook-asset/[...path]/+server.ts:39-44`

Problem: Path traversal, missing file, and not-a-file all return `error(404, 'Not found')`. For a real 2am incident (someone is fuzzing path traversal), there's no log entry distinguishing "user typo" from "active probe."

Fix: `log.warn('handbook-asset path-escape attempt', { metadata: { requested, repo: HANDBOOKS_DIR } })` for the traversal branch only. Other branches stay quiet.

### NIT: `appearance` and `theme` POST endpoints don't log on validation fail

File: `apps/study/src/routes/appearance/+server.ts:21,26`, `apps/study/src/routes/theme/+server.ts` (delegated to `@ab/themes`)

Problem: A client posting bad JSON or an invalid value gets `error(400, 'invalid JSON')` or similar -- no log entry. If a legit user is sending bad payloads (broken client, stale code), the responder has no way to spot the rate without browser telemetry.

Fix: Sample `log.info` on the 400 branches, or wire an `auth.bad_appearance_payload` counter.

### NIT: `RenderedLesson.svelte` re-derives `map` and `html` on every prop change

File: `apps/study/src/lib/components/RenderedLesson.svelte`

Problem: `fromSerializable(resolved)` and `substituteTokens(body, map, mode)` both run inside `$derived`. If the parent re-passes the same `resolved` object reference, the runes layer will still re-execute (Svelte 5 derived tracks reads, not deep equality). For a long lesson this is wasted work on every re-render that touches an unrelated prop. Comment in the file says "substitution runs both server-side and client-side over the same input" -- worth confirming there's no DX trap where a parent's `$state` reactivity causes 100 substitutions per scroll.

Fix: Verify with the runes inspector that re-renders are bounded; if not, memoise on the (resolved-object-identity, mode) tuple. If yes, drop a comment confirming the cost is low so the next reader doesn't re-investigate.
