---
feature: full-codebase
category: backend
date: 2026-04-27
branch: main
issues_found: 14
critical: 1
major: 4
minor: 6
nit: 3
---

## Summary

Backend is in solid shape overall. Study app handlers are textbook: thin route adapters that call typed BC functions, validate with Zod, surface typed BC error subclasses with appropriate `fail()` / `error()` / `redirect()` codes, and route every request through `requireAuth`. The BC layer in `libs/bc/study/` uses transactions + row locks where it matters (reviews, plans, sessions, skip orchestration, card create/state) and has visible attention to idempotency and concurrency.

The backend findings cluster around the hangar app, which routinely query Drizzle directly from `+page.server.ts` / `+server.ts` instead of going through a BC service. There is also one ADMIN-only surface that ships raw session tokens to the client, a few orphaned-tempfile paths on the upload handler, and theme/appearance cookies hard-coded `secure: false`.

## Issues

### CRITICAL: Raw session tokens leaked to ADMIN client view

- **File**: `apps/hangar/src/routes/(app)/users/[id]/+page.server.ts:38-43` (consumer); `apps/hangar/src/lib/server/users.ts:204-223` (source)
- **Problem**: The `/users/[id]` admin page selects `bauthSession.token` and ships it to the page (`token: s.token`). `bauth_session.token` is the bearer secret -- whoever holds it impersonates the user until the session expires. Any browser extension, log-aggregator, screen-record, or shoulder-surf that can see an admin tab can now hijack any other user's session. Even ADMIN should never see another user's token; the surface only needs id/ip/ua/timestamps to reason about activity.
- **Fix**: Drop `token` from both the SELECT (`listRecentUserSessions`) and the page payload mapping. If a future "revoke session" affordance needs a handle, use `bauthSession.id`; the revoke action takes the id, looks up the row server-side, and invalidates -- the token never crosses the wire to the page.

### MAJOR: Hangar route handlers query Drizzle directly instead of going through a BC

- **File**: `apps/hangar/src/routes/(app)/+page.server.ts:36-42`; `apps/hangar/src/routes/(app)/sources/+page.server.ts:77-107`; `apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:37-60,126-140`; `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.server.ts:26-40`; `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:29-90`; `apps/hangar/src/routes/(app)/sources/[id]/files/+page.server.ts:112,214`; `apps/hangar/src/routes/(app)/sources/[id]/files/raw/+server.ts:53`; `apps/hangar/src/routes/(app)/sources/[id]/download/+server.ts:22`; `apps/hangar/src/routes/(app)/sources/[id]/thumbnail/+server.ts:24`; `apps/study/src/routes/(app)/references/[id]/+page.server.ts:26-35`
- **Problem**: At least nine hangar route files import `db, hangarJob, hangarSource, hangarReference` from `@ab/db` and run Drizzle queries directly in `load`/actions. CLAUDE.md and the backend skill both specify route handlers as thin parse->BC->respond wrappers; the hangar `lib/server/registry.ts` already proves this is doable for some queries but new code keeps reaching past it. Every direct query is a place where filters (e.g., `isNull(deletedAt)`, `dirty=1` semantics, the "active job per source" predicate) can drift between the index page and the detail page, and a place where a future auth/scoping rule has to be remembered N times instead of enforced once.
- **Fix**: Promote these into `apps/hangar/src/lib/server/sources.ts` (or fold into `registry.ts`) -- `getSourceById`, `listRecentJobsForSource`, `getActiveJobForSource`, `safeCount`, `getLatestCompleteJob(kind)`. Routes call those; the routes shrink to "guard + call + map + return". One concern (`apps/study/.../references/[id]`) lives across BC boundaries and should move to `@ab/bc-citations` or a study-side `references` lib, not duplicate the hangar query.

### MAJOR: Sim attempt POST trusts client-supplied `outcome` strings

- **File**: `apps/sim/src/routes/[scenarioId]/attempt/+server.ts:73-105`
- **Problem**: `isAttemptPayload` checks types but never narrows `result.outcome` against `SIM_SCENARIO_OUTCOMES` before passing it through to `recordSimAttempt`, where it lands as the row's `outcome` text. The comment ("the BC validates against SIM_SCENARIO_OUTCOMES at the call site") is incorrect for this call site -- nothing else validates this string. A signed-in learner can POST any outcome string they want and have it persisted. Worse, the same code path casts `body.tape` and `body.grade` to BC types using `as` after only a shallow `typeof === 'object'` check, so a hostile JSON body with the right top-level keys writes whatever shape it likes into `tape`/`grade` JSONB.
- **Fix**: Build a Zod schema for the payload (`SimAttemptPayloadSchema`) that narrows `outcome` to `z.enum(SIM_SCENARIO_OUTCOMES_VALUES)`, validates `result` numerics with `z.number().finite().nonnegative()`, validates `tape` with the BC's known frame schema, and validates `grade.components[].kind` against `GRADING_COMPONENT_KIND_VALUES`. `safeParse` then returns a 400 instead of trusting the client. The BC types still `as`-cast at the boundary, but only after structural validation.

### MAJOR: `secure: false` on theme + appearance cookies in production

- **File**: `libs/themes/picker/server.ts:72-78`; `apps/study/src/routes/appearance/+server.ts:27-33` (also hangar/sim siblings)
- **Problem**: Both cookies are written with a literal `secure: false`. In production (HTTPS) cookies SHOULD be `Secure` so a downgrade attack or mixed-content fetch can't leak them. They're cosmetic, not session, but a stable per-user appearance cookie is still a fingerprinting vector and the policy across the codebase should be uniform. The hooks already use `dev` from `$app/environment`; the same gate should reach these endpoints.
- **Fix**: Take an `isDev` (or `secure`) parameter on `createThemeEndpoint(...)` (and the appearance endpoint), pass `secure: !dev`, default to `true` if dev cannot be detected. Same change in the appearance endpoint -- or hoist a shared `cosmeticCookieOptions(dev)` helper into `@ab/utils` so all three apps (study, sim, hangar) share one definition.

### MAJOR: Upload handler orphans temp files on failure

- **File**: `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:97-125`
- **Problem**: The action `mkdtemp`s a directory, writes the uploaded buffer there, then enqueues a job that holds the path. If `enqueueJob` throws (e.g., the worker DB is flapping), the catch block returns a `fail(500, ...)` without removing the temp file. Same shape if the redirect throws after enqueue but before the worker starts -- the worker will take the path and clean up on success, but a failed enqueue leaves N MB of data in `os.tmpdir()` per attempt. Ops doesn't have a sweeper.
- **Fix**: Wrap the enqueue in a try/finally that removes `dir` (rm -r) on the failure path. Move the temp dir cleanup into a dedicated helper alongside the existing temp-write helper so the contract is "this dir is the worker's once enqueue succeeds; otherwise it's mine." Also drop a cleanup pass in the worker for any pre-existing `airboss-hangar-upload-*` dirs older than 1 hour at boot (matches the orphan-job recovery in `hooks.server.ts`).

### MINOR: Per-action redundant DB lookups for handbook section id

- **File**: `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.server.ts:107-152`
- **Problem**: Every form action (`set-status`, `set-comprehended`, `mark-reread`, `set-notes`) re-runs `getReferenceByDocument` + `getHandbookSection` to resolve a section id that the URL already names. Four route params and two BC calls per action; load already proved the section exists when the form was rendered.
- **Fix**: Either post the resolved `sectionId` as a hidden form field set during load and validate it server-side before mutating (cheap: just check ownership/lookup once per action via a single new `getSectionById(id)` call), or memoize the (doc, chapter, section) -> id resolution in a per-request cache on `event.locals`.

### MINOR: `/handbooks` index N+1 progress lookup

- **File**: `apps/study/src/routes/(app)/handbooks/+page.server.ts:13-22`
- **Problem**: The page maps every reference to a `getHandbookProgress(user.id, ref.id)` call inside `Promise.all`. Each progress call is its own round trip. With ~5 handbooks today this is fine; with 30+ (PHAK + AvWX + AFH + Pilot's Handbook + AC chapters + IFR Handbook + ...) the index page does 30 round trips just to draw a list. The query is also pure aggregation -- it can be a single batched query that returns one row per reference id.
- **Fix**: Add `getHandbookProgressBatch(userId, referenceIds: string[])` to `libs/bc/study/src/handbooks.ts` that does the per-ref counts in one SQL query (e.g., `GROUP BY reference_id`); the page still maps over the references, but every progress lookup is `progressByRef.get(ref.id)` against a single round-trip result.

### MINOR: Sim history + attempt detail repeat the `studyLoginUrl` helper verbatim

- **File**: `apps/sim/src/routes/history/+page.server.ts:18-30`; `apps/sim/src/routes/history/[attemptId]/+page.server.ts:18-25`
- **Problem**: Two copies of the exact same host-derivation function. Future change (subdomain change, custom port handling) will be made in one and forgotten in the other.
- **Fix**: Extract to `apps/sim/src/lib/server/study-login.ts` (or `@ab/auth` if it's a cross-app helper) with one definition. Both routes import.

### MINOR: Audit-ping action records no `targetId`

- **File**: `apps/hangar/src/routes/(app)/admin/audit-ping/+page.server.ts:36-47`
- **Problem**: `auditWrite` is called with `targetId: null`. That's fine for a heartbeat ping but the audit recap surface (the parent load) only filters by `targetType` and orders by timestamp. Without a per-call id there's no way to correlate "I pinged from request X" with the row -- which defeats the demo's stated purpose ("proves the auth -> role gate -> form action -> audit write -> audit read-back path"). The `requestId` is in metadata, not on the row.
- **Fix**: Either (a) keep `targetId: null` and stop calling this a correlation demo, or (b) set `targetId: requestId` so the recap row carries the same correlation id the response header carries. (b) is the cheaper fix and keeps the demo accurate.

### MINOR: `getCardCrossReferences` + `getCitationsOf` overlap on the card detail page

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:55-63`
- **Problem**: The page fans out four parallel queries: `getCard`, `getRecentReviewsForCard`, `getCitationsOf`, and `getCardCrossReferences`. Citations + cross-refs both query against the same citation/cross-reference tables; the BC could collapse them into a single round-trip or at least share a connection from the same pool slot. Today's setup blocks two pool slots for the duration of the page load even though the data is structurally one query.
- **Fix**: Add `getCardSocialContext(cardId, userId): { citations, crossRefs }` that runs the two reads serially against one connection (or one UNION query). Page uses the wrapper. Cuts the load's pool footprint by 25% under load.

### MINOR: References+sources aviation count uses string regex over a TS source file

- **File**: `apps/hangar/src/routes/(app)/sources/+page.server.ts:56-72`
- **Problem**: `loadAviationCounts()` reads `libs/aviation/src/references/aviation.ts` from disk and runs two regexes over its source code to derive `referenceCount` + `verbatimCount`. Today this works because the file is generated; a future hand-edit, comment, or formatting change will silently shift the counts, and the page swallows any error to 0/0. This is also a directory-traversal-shaped concern (route load reading repo files at runtime in production).
- **Fix**: Read the actual data structure: `import { AVIATION_REFERENCES } from '@ab/aviation'`; then `referenceCount = AVIATION_REFERENCES.length` and `verbatimCount = AVIATION_REFERENCES.filter((r) => r.verbatim?.length).length`. Compile-time guarantees, no fs read, no regex. Same approach for the manifest summary if the manifest can be imported.

### NIT: Inline `db.select().from(...)` SELECTs in hangar return entire row + `*` columns

- **File**: `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:29,76`
- **Problem**: `db.select().from(hangarSource)` pulls every column (including `media`, `edition`, `locatorShape`, `dirty`, `checksum`, `path`, etc.) when the upload action only needs `{ id, deletedAt }`. Same in many other handlers. Doesn't matter today; it does start to matter when `media` carries a large blob.
- **Fix**: Project only the fields the consumer needs (`db.select({ id: hangarSource.id, deletedAt: hangarSource.deletedAt }).from(hangarSource)...`). Becomes especially important when these queries move into the BC service in the major fix above.

### NIT: Isomorphic `if (err && typeof err === 'object' && 'status' in err && 'location' in err) throw err;` repeated

- **File**: `apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:150`; `apps/hangar/src/routes/(app)/sources/+page.server.ts:193`; `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.server.ts:71,93`; `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:118`
- **Problem**: Five copies of the "rethrow if it's a SvelteKit Redirect" guard. SvelteKit ships `isRedirect()` (used at `apps/study/src/routes/(app)/session/start/+page.server.ts:84`) which is the correct check. The hand-rolled structural test is brittle (will miss future internal changes to the redirect shape).
- **Fix**: Replace every instance with `isRedirect(err)` from `@sveltejs/kit`. Same change in the route's `commit` action and the `enqueueGlobalAction` helper.

### NIT: Login redirect status mismatch (302 vs 303)

- **File**: `apps/study/src/routes/login/+page.server.ts:23`; `apps/hangar/src/routes/login/+page.server.ts:21`
- **Problem**: The `load` redirect on already-signed-in users returns `redirect(302, ...)`, but the success-action redirect immediately below returns `redirect(303, ...)`. 303 is the right code for "POST succeeded, follow GET to home"; 302 on the load path is harmless but inconsistent. The logout `load` is also 302. POST/GET follow conventions are minor here, but a uniform 303 (or 307 for the load `redirect` paths) reads more deliberate.
- **Fix**: Use 303 in both legs (or 307 for the load-time redirect, 303 for the action-time redirect). Pick one and apply across study + hangar + sim.
