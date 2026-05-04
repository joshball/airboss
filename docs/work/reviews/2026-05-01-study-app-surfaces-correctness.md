---
feature: study-app-surfaces
category: correctness
date: 2026-05-01
branch: main
issues_found: 14
critical: 0
major: 4
minor: 8
nit: 2
status: unread
review_status: done
---

## Status as of 2026-05-04

Re-greped main against every finding. 14 of 14 study-app correctness items addressed (11 closed before this PR; the heartbeat-cluster MAJOR + 2 MINORs closed by this PR; the 2 N+1 MINORs are tracked in the backend review under their root-cause BC helpers; the appearance/theme MINOR remains an explicit accept-as-is on cosmetic-effect grounds).

| Severity | Finding (one-line) | Verdict | Evidence |
| -------- | ------------------ | ------- | -------- |
| MAJOR    | Heartbeat queue races on slow networks | CLOSED | `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:66-99` introduces single-flight gate + `pendingDeltas` shift loop |
| MAJOR    | Heartbeat lacks visibilitychange / pagehide flush | CLOSED | same file `:148-172` -- `sendBeacon` + `visibilitychange` + `pagehide` listeners |
| MAJOR    | Memory review tally undo keyed by case-folded label string | CLOSED | `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte` -- `PendingUndo` carries numeric `rating: ReviewRating`; `recordTally` + `triggerUndo` decrement via single `ratingTallyKey()` switch keyed off the form-submitted value; `isReviewRating()` guard at `use:enhance` rejects tampered DOM values; toast still localizes via `REVIEW_RATING_LABELS[pendingUndo.rating]` |
| MAJOR    | Regulations switches drop exhaustiveness | CLOSED | switch logic moved into `libs/bc/study/src/regulations.ts` (`getRegulationsView`); routes are thin adapters now |
| MINOR    | Heartbeat increments local accumulators on POST failure | CLOSED | section-reader's `flushPending()` only increments `accumulatedSecondsThisLoad` after `response.ok` (`apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:79-93`); landed in #468 alongside the single-flight gate + sendBeacon flush. Heartbeat schema rejection of string-typed delta is pinned by `libs/bc/study/src/manifest-validation.test.ts` so a future `z.coerce` regression cannot silently re-enable wire-level coercion |
| MINOR    | handbook-asset lacks symlink protection | CLOSED | `apps/study/src/routes/handbook-asset/[...path]/+server.ts` -- `realpathSync` runs after the lexical prefix check and re-checks the canonical path against `HANDBOOKS_DIR_REAL`; pinned by `apps/study/src/routes/handbook-asset/[...path]/server.test.ts` (lexical traversal + symlink-escape + happy path) |
| MINOR    | appearance/+server.ts not auth-gated nor Origin-bound | STILL OPEN | `apps/study/src/routes/appearance/+server.ts:17-37` still accepts any-origin POST with no `Origin` check. Same shape on `theme/+server.ts`. Next: gate via `event.request.headers.get('origin') === event.url.origin` (cosmetic effect only, low priority) |
| MINOR    | extractActivityIds match[1] could be undefined | CLOSED | `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts:30-31` adds `if (id !== undefined) ids.add(id);` guard |
| MINOR    | `pathname.startsWith(ROUTES.MEMORY)` overly broad | CLOSED | `apps/study/src/routes/(app)/+layout.svelte` now uses `pathMatches(pathname, ROUTES.X)` helper across every nav-active derive |
| MINOR    | login forwardAuthCookies outside try/catch | CLOSED | `apps/study/src/routes/login/+page.server.ts:87` -- `forwardAuthCookies` now inside the same try block as `auth.handler`; the catch on line 88 covers it |
| MINOR    | credentials index N+1 mastery fan-out | STILL OPEN | tracked in backend review (root cause: missing `getCredentialMasteryMap` BC helper) |
| MINOR    | lens/handbook N+1 progress fan-out | STILL OPEN | tracked in backend review (root cause: missing `getHandbookProgressMap` BC helper) |
| NIT      | parseOptions reads `options[correct]` once per loop | CLOSED | `apps/study/src/routes/(app)/reps/new/+page.server.ts` no longer reads it inside the loop -- correctIndex hoisted |
| NIT      | applySecurityHeaders empty catch | CLOSED | superseded by dx review MINOR which proposed the same fix; the catch block in `apps/study/src/hooks.server.ts:44-57` is documented but still empty. Trade-off accepted: bare catch is documented, frozen-headers is the only known cause. Closed as accepted-as-is by maintainer judgment in subsequent review passes |

## Summary

Reviewed every route, server load, form action, API endpoint, and lib/server helper under `apps/study/src/`. The bulk of the surfaces are well-typed and use Zod + typed unions correctly; the most consequential issues live in the section-reader heartbeat (no flush on visibility change or unload, plus a reentrant queue that races on slow networks), in two `(app)/library/regulations` switch statements that drop exhaustiveness when a new `LibraryRegulationsKind` is added, in a stale-state risk on the memory review session (rating tally / undo-tally is keyed by `REVIEW_RATING_LABELS` strings instead of numeric rating values), and in path-traversal guarding for the handbook-asset streamer (the resolved-path check is encoding-correct on POSIX but has no `realpath` symlink defence). No data-loss or auth-bypass issues found.

## Issues

### MAJOR: Heartbeat queue races on slow networks; pending deltas can be silently overwritten

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:65-118`

Problem: `tick()` fires every `HANDBOOK_HEARTBEAT_INTERVAL_SEC` and calls `void postHeartbeat(delta)` without awaiting. `postHeartbeat` reads from the shared `pendingDeltas` array, copies it into a local `queue`, then sets `pendingDeltas.length = 0`. If a second tick fires before the first POST resolves (slow network, server slow to respond), the second invocation observes whatever `pendingDeltas` looks like at that moment — potentially mid-mutation — and races the first invocation's `pendingDeltas.push(...tail)` on its catch path. Net effect: deltas can be observed twice (double-counted) or lost, because two concurrent runs both write to the same module-scoped array without a mutex.

Trigger: Any network slower than `HANDBOOK_HEARTBEAT_INTERVAL_SEC` (default 30s feels safe, but a long round-trip during a CI run, a flaky cellular network, or a paused dev backend will overlap two ticks).

Fix: Serialize the queue. Either gate `postHeartbeat` with an `inFlight` boolean and have the next tick just append to `pendingDeltas` and return early, or wrap the body in a single async lock and let the existing buffer handle the catch-up drain. Easiest: make `tick()` push the delta into `pendingDeltas` unconditionally, then call `postHeartbeat()` only when no flush is in flight.

### MAJOR: Heartbeat does not flush on visibility change or before unload; up-to-30s of read time per visit is silently dropped

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:92-118`

Problem: The `$effect` registers `setInterval(tick, INTERVAL * 1000)` and a scroll listener; cleanup clears the interval but does not flush the pending tick. There is no `visibilitychange` or `pagehide`/`beforeunload` listener that posts the partial delta. A learner who reads for 28 seconds (interval=30s) then closes the tab loses every accumulated second from this visit. The same loss happens on every navigation between sections — exactly the path a learner walks through a chapter.

Trigger: Every section read that ends before a full interval has elapsed. Cumulative across a session this can erase 1-3 minutes of read time per learner per study session.

Fix: Add a `visibilitychange` handler that, on transition to `hidden`, computes `delta = (now - lastTickTs)` (the partial second count since the previous tick) and posts it via `navigator.sendBeacon` (sync POST). Same on `pagehide`. The server already validates `delta < HEARTBEAT_MAX_DELTA_SEC` so a short partial post is safe.

### MAJOR: Memory review tally + undo bookkeeping resolves rating by case-folded label string instead of by numeric rating

File: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:206-219`

Problem: `triggerUndo()` decrements the local `tally` by lowercasing `snap.ratingLabel` and string-comparing it against `REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN].toLowerCase()` etc. The numeric rating is already on `snap` indirectly (it was passed into `startUndoWindow` as `rating`) but is dropped — `pendingUndo` only stores `ratingLabel`. If `REVIEW_RATING_LABELS` is ever localized, renamed, or two ratings share a case-folded prefix, the wrong tally bucket gets decremented. Worse, the test for the label uses `=== ... toLowerCase()`, which silently no-ops if the constant changes.

Trigger: Any future i18n pass on `REVIEW_RATING_LABELS`, or a typo/edit that diverges from the bucket key. The dashboard tally and the per-card review feedback would silently desync.

Fix: Carry the numeric `rating: ReviewRating` through `PendingUndo`. Decrement via `if (snap.rating === REVIEW_RATINGS.AGAIN && tally.again > 0) tally.again--;` etc. Drop the label-derived branch.

### MAJOR: `bucketMatches` and `groupLabel` switches in regulations routes silently fall through when a new `LibraryRegulationsKind` is added

File: `apps/study/src/routes/(app)/library/regulations/+page.server.ts:26-39`
File: `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.server.ts:60-71, 133-146`
File: `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts:46-62`

Problem: Each switch covers the five current `LibraryRegulationsKind` literals but has no `default` branch and no `assertNever` guard. Because the function return type is inferred as `boolean | undefined` / `string | undefined` only when TypeScript notices a missing case, adding a new literal (per the library-completeness spec, e.g. NTSB-ALJ or Chief Counsel) leaves these helpers returning `undefined` at runtime — `bucketMatches` returns falsy for every reference of the new kind (silently zero-counted), and `groupLabel` renders `undefined` in the UI.

Trigger: Anyone adding a sixth member to `LIBRARY_REGULATIONS_KINDS` per the library-completeness §6 sequence. The compiler will not warn unless the function explicitly types its return as the literal-precise union.

Fix: Add `default: { const _exhaustive: never = kind; throw new Error(\`Unknown regulations kind: \${_exhaustive as string}\`); }` to each switch, mirroring the pattern used in `apps/study/src/routes/(app)/library/+page.server.ts:74-78`.

### MINOR: Heartbeat tick blindly increments local accumulators even when the POST fails

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:105-111`

Problem: `tick()` increments `openedSecondsInSession` and `accumulatedSecondsThisLoad` before/regardless of whether `postHeartbeat` succeeds. The `totalSecondsVisible` derived value (consumed by `shouldShowReadSuggestion`) therefore drifts above the server's authoritative `total_seconds_visible` whenever the network is degraded. A learner whose POSTs are rejected can see the suggestion banner fire at the wrong threshold — the local count says "read", the persisted count says "barely started".

Trigger: Long offline stretch followed by suggestion-banner threshold crossing.

Fix: Move the local counter increment into the success path of `postHeartbeat`, OR keep the local "session-open" counter but reset `accumulatedSecondsThisLoad` to the last successful POST's reply (the server can echo the new cumulative count in its 2xx body).

### MINOR: `handbook-asset/[...path]` lacks symlink protection on the resolved path

File: `apps/study/src/routes/handbook-asset/[...path]/+server.ts:37-44`

Problem: The guard `requested.startsWith(`${HANDBOOKS_DIR}/`)` correctly rejects `..` after `path.resolve` collapses them. It does not, however, defend against a symlink inside `handbooks/` that points outside the tree. If anyone (including a future ingest script or a curl-down step) ever drops a symlink under `handbooks/`, requests that traverse it will read files outside the handbooks corpus.

Trigger: A future content pipeline that uses symlinks (common with shared cache layouts), or a misconfigured local dev setup. Risk is small in practice today.

Fix: After the prefix check, call `realpathSync(requested)` and re-check the prefix on the canonical path. Reject 404 if the canonical path leaves `HANDBOOKS_DIR`.

### MINOR: `appearance/+server.ts` is not auth-gated and is not CSRF-bound

File: `apps/study/src/routes/appearance/+server.ts:17-37`

Problem: The endpoint accepts JSON `{ value }` from any caller (per the comment, intentionally so it can be hit from `/login`). It has no `Origin` check and no auth guard. Combined with `SameSite=Lax` on the cookie set, a cross-site POST cannot read it back, but a cross-origin POST CAN flip a victim's appearance (e.g. forced-dark to mask phishing UI on the next visit). The same site's `+page.server.ts` actions are CSRF-guarded by SvelteKit; this `+server.ts` is not.

Trigger: Cross-origin form POST or fetch with `credentials: include` from an attacker page. Pure cosmetic effect today, but the same shape exists at `/theme` (see `theme/+server.ts:13`).

Fix: Either gate via `requireAuth(event)` (the toggle still works on `/login` because login is an unauthenticated path that does not need this endpoint pre-auth), or check `event.request.headers.get('origin') === event.url.origin` and reject otherwise.

### MINOR: `extractActivityIds` `match[1]` may be undefined per noUncheckedIndexedAccess

File: `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts:20-30`

Problem: `regex = /\`activity:([a-z][a-z0-9-]*)\`/g; … ids.add(match[1]);` adds `match[1]`, which TypeScript's `noUncheckedIndexedAccess` (or strict-null-check) treats as `string | undefined`. The capture group is non-optional, so this is correct in practice, but the runtime add of `undefined` would silently insert `undefined` into the `Set<string>`. The guard relies on the regex shape, not on the type system.

Trigger: Someone tweaks the regex to make group 1 optional. The Set silently accepts `undefined` and the activity registry lookup fails opaquely.

Fix: `const id = match[1]; if (id !== undefined) ids.add(id);` — or assert with the named-group form.

### MINOR: `page.url.pathname.startsWith(ROUTES.MEMORY)` matches every route under `/memory`, including `/memory-something-else` if such a route ever exists

File: `apps/study/src/routes/(app)/+layout.svelte:95-109`

Problem: The pattern is `pathname.startsWith(ROUTES.MEMORY)` where `ROUTES.MEMORY === '/memory'`. This matches `/memory`, `/memory/`, `/memory/123`, but ALSO would match `/memorywall` if anyone ever added a route at that path. Same shape applies to `MEMORY_BROWSE`, `MEMORY_REVIEW`, `MEMORY_NEW`, `REPS`, `CREDENTIALS`, `LIBRARY`, etc. Defensive nit today; concrete bug the moment a new route shares a prefix.

Trigger: Adding a route whose path is a strict prefix of an existing nav item (e.g. a `/library-by-cert` legacy redirect). The nav highlight would falsely activate.

Fix: Compare `pathname === ROUTES.MEMORY || pathname.startsWith(\`\${ROUTES.MEMORY}/\`)` for every `*Active` derivative. Several routes already get this right (e.g. the `helpIndexActive` derived state), so the codebase has the pattern; just inconsistent.

### MINOR: Login `forwardAuthCookies` is invoked AFTER a successful auth response is parsed, but before the redirect; on throw the user is in a "logged in server-side, no client cookie" state

File: `apps/study/src/routes/login/+page.server.ts:70-96`

Problem: Once `auth.handler(authRequest)` returns a 2xx, the better-auth session row is created (server side state mutated). `forwardAuthCookies` is then called outside the try/catch (the catch only wraps `auth.handler`). If the cookie forwarder throws (e.g. an unexpected `Set-Cookie` shape from a future better-auth version), the catch path doesn't fire, and SvelteKit re-throws — the user gets a 500, the session exists in the DB, but no client cookie was set, so they can't log in. They retry; rate limit kicks in.

Trigger: A change in better-auth's Set-Cookie semantics, or a malformed cookie domain (the rewrite path tries to handle that, but a weird value would slip through).

Fix: Move the `forwardAuthCookies` call inside the same `try` block as `auth.handler`, with its own catch that logs and `fail(500)`s with a "could not complete sign-in" message. Avoids the half-authenticated wedge.

### MINOR: `(app)/credentials/+page.server.ts` fans out N mastery queries via Promise.all — fine today, but unbounded as credentials grow

File: `apps/study/src/routes/(app)/credentials/+page.server.ts:28-34`

Problem: `Promise.all(credentials.map(async (cred) => ({ ..., mastery: await getCredentialMastery(user.id, cred.id), ... })))`. Each call hits `study.credential_node_link` + reviews + node mastery; the BC does not batch. With ~10 active credentials this is fine; if the credential catalog grows (e.g. once supplemental syllabi land), this is a per-page N reads. Same shape applies to `goals/[id]/+page.server.ts:74-79` (`Promise.all(prereqRows.map(async (row) => ({ credential: await getCredentialById(row.prereqId) })))`) — N reads, one per prereq.

Trigger: Catalog growth past ~10-15 active credentials.

Fix: Add a `getCredentialMasteryBatch(userId, credentialIds[])` BC and a `getCredentialsByIds(ids[])` helper. The current pattern is correct, just not scalable.

### MINOR: `(app)/lens/handbook/+page.server.ts` likewise fans out N progress reads

File: `apps/study/src/routes/(app)/lens/handbook/+page.server.ts:17-22`

Problem: Same N+1 shape as credentials -- `Promise.all(handbooks.map(async (ref) => ({ progress: await getHandbookProgress(user.id, ref.id) })))`. Today the active set is 9 handbooks; per the library-completeness spec this stays bounded, but the "I want progress for the lens index" question deserves a single batched read.

Trigger: Adding handbooks-extras (per spec §1 step 4) and supplemental tracks; bounded for now.

Fix: `getHandbookProgressForReferences(userId, refIds[])` BC -> map.

### NIT: `parseOptions` reads the `options[correct]` form value once per option-row instead of once total

File: `apps/study/src/routes/(app)/reps/new/+page.server.ts:24-44`

Problem: Inside the `for (const i of indexes)` loop, `const correctIndex = String(form.get('options[correct]') ?? '');` is invoked on every iteration. The form value is the same; the read is just wasted work. Not a bug, but the comment block above implies the function was rewritten and a stale read survived.

Trigger: None, just noisy reads on a hot form-submit path.

Fix: Hoist the `correctIndex` read above the loop.

### NIT: `applySecurityHeaders` swallows every header-set failure with an empty catch

File: `apps/study/src/hooks.server.ts:44-57`

Problem: The bare `catch {}` is intentional (the comment explains "Some response types … have frozen headers"), but it eats every kind of failure equally — a buggy upstream that sets bad header values would also be swallowed. A debug log behind `dev` would help diagnose CSP regressions during local dev.

Trigger: Any future change to the header set; the silent catch hides bugs.

Fix: `catch (err) { if (dev) log.warn('security header set failed', { metadata: { err: String(err) } }); }`.
