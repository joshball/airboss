---
feature: full-repo
category: backend
date: 2026-04-22
branch: main
issues_found: 18
critical: 1
major: 5
minor: 8
nit: 4
---

## Summary

Backend layering is strong overall: a single `requireAuth` guard, BC functions that own their own transactions, typed domain errors, and Zod schemas shared between routes and BC. The patterns are clean enough to template. The chief propagatable problems are two leaks of raw Drizzle into `+page.server.ts` (browse pagination counts), a partial-failure gap in the session `skip` action where a slot commit can succeed while plan mutation fails silently, and drift between `redirect(303, ...)` and `throw redirect(303, ...)` across similar actions.

## Propagatable Patterns (top priority)

These are the patterns that will (and should) be copy-pasted into every future surface app. Fix them at the root or lock them in as the template.

1. **Auth guard + BC call + shape transform** -- `apps/study/src/routes/(app)/memory/+page.server.ts:5-9`, `apps/study/src/routes/(app)/plans/+page.server.ts:5-10`, `apps/study/src/routes/(app)/dashboard/+page.server.ts:5-12`. Three-line load function: `requireAuth(event)` -> BC call -> return. This is the template shape for every read page. Independent reads use `Promise.all`. Where available, a single BC aggregator (`getDashboardPayload`, `getDashboardStats`) is preferred over multiple per-panel calls. Lock this as the idiomatic load.
2. **Enum narrowing from query params** -- `apps/study/src/routes/(app)/knowledge/+page.server.ts:16-19` (`narrow<T>`), `apps/study/src/routes/(app)/reps/browse/+page.server.ts:29-32`. Five routes re-define the same `narrow<T>(value, allowed)` helper. Promote to `@ab/utils` (or `@ab/auth`-style shared server utilities) so every future surface app uses one implementation.
3. **Form action error handling** -- `apps/study/src/routes/(app)/memory/review/+page.server.ts:66-155`, `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:50-130`, `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:45-174`. The idiom is clear: `safeParse` -> typed BC error -> `fail(status, { error, values, fieldErrors })` for validation, `error(404)` for not-found, log with requestId + userId + metadata on 500. Keep this shape; it's good. But three inconsistencies need to be fixed before it's templated:
	- `redirect(303, ...)` vs `throw redirect(303, ...)` (see Issue M-2).
	- Different field-error keys (`_` / `error` / `fieldErrors`) (see Issue m-1).
	- `intent` only sometimes returned on success (see Issue m-2).
4. **Zod schemas shared between route and BC** -- `libs/bc/study/src/validation.ts`, consumed at `libs/bc/study/src/cards.ts:103` and `apps/study/src/routes/(app)/memory/new/+page.server.ts:50`. BC parses defensively, route uses `safeParse` for user-facing field errors. This is excellent. Lock it in as the validation standard: Zod schema lives in the BC, both layers import it, BC does `.parse()` at the boundary, route does `.safeParse()` for UX.
5. **Typed domain errors from BC** -- `libs/bc/study/src/cards.ts:32-57`, `libs/bc/study/src/reviews.ts:38-48`, `libs/bc/study/src/plans.ts:33-73`. Discriminable classes (`CardNotFoundError`, `PlanNotFoundError`, `DomainOverlapError`, etc) that the route `instanceof`-checks to pick `fail(400/403/404/409)` vs `error(404)` vs `fail(500)`. This is the right pattern. Propagate it to every new BC; prohibit string-message parsing at the route.

## Issues

### CRITICAL: Session skip action non-atomic across slot result + plan + content writes

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:385-457`
- **Problem**: The `skip` action does three separate writes that must either all commit or none: (1) `recordItemResult(...)` writes the slot row, (2) `addSkipNode` / `addSkipDomain` mutates the plan, (3) for `permanent`, `setCardStatus` / `setScenarioStatus` suspends the content. These run as three independent DB calls with no enclosing transaction. If step 2 or step 3 throws, step 1 is already committed. The code even comments "don't fail the whole request; the slot is already recorded" and swallows the error to a log line. Consequence: the learner who picks "permanent -- I never want to see this card again" can end up with the slot recorded but the card still active in the review queue, silently. The BC-internal transactions inside `addSkipNode` / `setCardStatus` each protect their own row but not the three-way outcome. Plan mutation is explicitly documented as "best-effort" in the comment, which bakes the known-issue into code -- this is exactly what the prime directive bans.
- **Fix**: Move the whole three-step operation into a single BC function (e.g. `libs/bc/study/src/sessions.ts::skipSessionSlot(sessionId, userId, slotIndex, skipKind)`) that opens a single `db.transaction` and runs all three writes (slot upsert, plan mutation, content status change) against the `tx`. Propagate a typed error on partial failure; the route returns `fail(500, { error: 'Could not save your skip. Try again.' })` and does NOT commit the slot. This is the template for every multi-write action going forward: atomic BC function, route calls it, no orchestration in the route.

### MAJOR: Direct Drizzle in +page.server.ts for pagination counts (two places)

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:17,72-85`
- **File**: `apps/study/src/routes/(app)/reps/browse/+page.server.ts:18-20,84-93`
- **Problem**: Both browse pages import `db`, `scenario` / `card`, and Drizzle operators directly to compute a total-row count that duplicates the filter logic in `getCards` / `getScenarios`. Both files contain the same comment ("inline rather than promoted to BC -- single consumer at the moment") -- that's two consumers right now and will be more when every future surface app gets a browse page. This is the thin-shell principle leaking: the filter shape now lives in two places (the BC list function + the inline count) and they must be kept in sync by hand. Drift between them is silent (totals disagree with the list).
- **Fix**: Add `getCardsCount(userId, filters)` to `libs/bc/study/src/cards.ts` and `getScenariosCount(userId, filters)` to `libs/bc/study/src/scenarios.ts`, sharing the same `CardFilters` / `ScenarioFilters` types the list functions already accept. Route calls `Promise.all([getCards(...), getCardsCount(...)])`. Delete the Drizzle import from both route files. Template this pattern for every browse surface: pair every list function with a count function on the same filter type.

### MAJOR: redirect/throw redirect inconsistency across actions

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:94,96` uses `redirect(303, ...)` (no throw)
- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:127,129` uses `redirect(303, ...)` (no throw)
- **File**: `apps/study/src/routes/(app)/plans/new/+page.server.ts:100` uses `throw redirect(303, ...)`
- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:104,115` uses `throw redirect(303, ...)`
- **File**: `apps/study/src/routes/(app)/session/start/+page.server.ts:82,89,141` uses `throw redirect(303, ...)`; `start` action wraps with `if (isRedirect(err)) throw err`
- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:57,467` uses `throw redirect(303, ...)`
- **Problem**: Both forms work in SvelteKit >=2, but mixing them inside try/catch blocks is a footgun: `redirect()` without `throw` is a no-op inside a catch that swallows errors, and `throw redirect()` without an `isRedirect` check at the outer catch produces log noise and can be swallowed by a catch that rethrows only "real" errors. The session/start action shows the correct pattern (`if (isRedirect(err)) throw err`); the others don't, and they work today only because their try/catch blocks re-throw unconditionally. When someone copies `memory/new` as a template and adds a catch-all, the redirect silently disappears.
- **Fix**: Pick one form and enforce it. Recommend `throw redirect(303, ...)` everywhere plus the `isRedirect(err)` check in any try that wraps a redirect. Add a `/ball-review-patterns` rule for it.

### MAJOR: Legacy `?phase=` query-param dual-read has no retirement schedule in code

- **File**: `apps/study/src/routes/(app)/reps/browse/+page.server.ts:25-27`
- **Problem**: The comment says `TODO(retire): drop after 2026-07-01 once no logs show it being hit`. This is a known issue in prose with no code enforcement. The prime directive forbids leaving "known issues" as log-hunt TODOs. Either the logs confirm no hits and this can be deleted today, or it genuinely has live bookmarks and a retirement trigger must be captured somewhere that will actually fire.
- **Fix**: Check the last 30 days of logs for `legacy ?phase= used` hits. If zero, delete the legacy branch now. If non-zero, move the TODO into `docs/work/todos/TEMP_FIXES.md` with an explicit trigger ("delete when X consecutive days of zero hits"), not a calendar date in a source comment.

### MAJOR: `updatePlan` / `archivePlan` status set via UpdatePlanInput despite docstring

- **File**: `libs/bc/study/src/plans.ts:97,213`
- **Problem**: `UpdatePlanInput` accepts `status?: PlanStatus`, and `updatePlan` at line 213 copies it through. The function's own docstring (line 181) says "Callers should not change status here; use archive/activate." The type allows exactly what the docstring forbids. Because `updatePlanSchema` is imported from `plans.validation.ts`, the allowlist is centralized there; if it includes `status`, any route that calls `updatePlan({ status: 'active' })` bypasses the activation logic (which archives other active plans inside a transaction to preserve the partial UNIQUE invariant). Data-integrity risk is contained today because the route form actions don't pass `status`, but this is a trap waiting for the next form that does.
- **Fix**: Remove `status` from `UpdatePlanInput` and `updatePlanSchema`. The only status-transition paths are `archivePlan` and `activatePlan`, which already exist. Anything else is a bug.

### MAJOR: `submitReview` elapsed_days / lastReviewedAt coupling relies on denormalized field staying consistent

- **File**: `libs/bc/study/src/reviews.ts:94-148`
- **Problem**: The review path reads `cardState.lastReviewedAt` and writes it back on each review. If a future admin flow ever mutates `cardState` outside this transaction (e.g. a data migration, a bulk operation, an `undoReview` from a different tab overlapping with a submit), `lastReviewedAt` and the last review row in the `review` table can desynchronize. The FSRS scheduler computing `elapsedDays` from `lastReviewedAt` will then produce wrong scheduling math silently. `undoReview` does read + delete + re-project correctly, so there's no latent bug today, but the denormalization is a contract that needs to be documented.
- **Fix**: Add a BC-level invariant test (one exists for the happy path in `reviews.test.ts` -- extend it) that asserts `cardState.lastReviewedAt` always equals `MAX(review.reviewedAt)` after any public BC write. Consider dropping the denormalization and joining `review` in `fetchCardCandidates` (the hot path, which already joins `review`). The perf argument for the denormalization was cheap-read; the hot read already does the join.

### MINOR: Five copies of `narrow<T>` / `parseDomain` / `coerceEnum` helper

- **File**: `apps/study/src/routes/(app)/knowledge/+page.server.ts:16-19`
- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:30-33`
- **File**: `apps/study/src/routes/(app)/reps/browse/+page.server.ts:29-32`
- **File**: `apps/study/src/routes/(app)/session/start/+page.server.ts:29-42`
- **File**: `apps/study/src/routes/(app)/plans/new/+page.server.ts:22-24` (`coerceEnum`)
- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:34-36` (`coerceEnum`)
- **File**: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:20-38` (four variants of the same thing)
- **Problem**: Same function, seven copies. Drift risk is low today (all correct) but this is exactly the pattern that propagates into every future surface app.
- **Fix**: Add `narrowEnum<T extends string>(value: string | null | undefined, allowed: readonly string[]): T | undefined` and `coerceEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T` to `libs/utils/src/query.ts` (new file). Export via `@ab/utils`. Replace all call sites in one sweep.

### MINOR: Inconsistent field-error key conventions across actions

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:53-55` (uses `_` for top-level, dot-path for fields)
- **File**: `apps/study/src/routes/(app)/reps/new/+page.server.ts:96` (uses `_` for top-level, dot-path via zod)
- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:77,86` (uses plain `error` string, no fieldErrors)
- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:84,91` (uses plain `error` string)
- **File**: `apps/study/src/routes/(app)/plans/new/+page.server.ts:54,92` (uses plain `error` string)
- **Problem**: Three different failure-shape conventions for `fail()` returns: `{ error, values, fieldErrors }`, `{ error }`, and `{ fieldErrors: { _: ... }, values }`. The Svelte forms that consume these have to know which shape to expect. New surface apps will keep inventing a fourth.
- **Fix**: Standardize on `{ error?: string, fieldErrors?: Record<string, string>, values?: Record<string, unknown> }` for every action. Define the shape in `libs/types/src/forms.ts` as `ActionFailure`. Use `_` for top-level field-free errors (already a common convention), dot-path keys for per-field. Update all actions in one pass.

### MINOR: Inconsistent `intent` echo on action success

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:99` (returns `intent: 'update'`)
- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:98,99,110` (returns `success`, no intent)
- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:93,115,129,143,157,172` (returns `success: true`, no intent)
- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts:86,94` (returns `intent`)
- **Problem**: Some actions echo `intent` so the client can disambiguate which of N named actions returned; some don't. When the template is copied, the client form enhancer has no reliable way to branch on "which action just returned."
- **Fix**: Always echo `intent` on success for multi-action routes. Make it the convention in the `ActionFailure` / `ActionSuccess` types.

### MINOR: `requireAuth` repeats inside every action on the same route

- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:47,97,108,119,133,147,161`
- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:211,275,351,386,460`
- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:52,103`
- **Problem**: Every action starts with `const user = requireAuth(event)`. This is correct (actions don't inherit from load), but when a route has 6 actions, the ceremony is noisy and one missed call is an IDOR. The layout-level `requireAuth` for load is already handled; actions need their own.
- **Fix**: Two options: (a) accept the ceremony and add a lint rule / review checklist item that every action starts with `requireAuth`; (b) introduce a `withAuth(fn)` wrapper in `@ab/auth` that returns `(event) => fn({ ...event, user: requireAuth(event) })`. Option (b) is cleaner but obscures the auth check at code-review time. Recommend (a) + review-checklist item.

### MINOR: `submitReview` action -> BC error classification of 400 vs 500 is inconsistent

- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:106-122`
- **Problem**: `CardNotFoundError` and `CardNotReviewableError` both get treated as "skipped: true, success: true" (200). Other routes treat `CardNotFoundError` as `error(404)` (e.g. `memory/[id]`). Same typed error gets three different route-layer meanings across the codebase.
- **Fix**: Pick one meaning per typed BC error or document the context-dependent handling explicitly. If "card vanished mid-review" really is `skipped: true`, rename the case: introduce `CardDeletedDuringReviewError` or similar so the route doesn't guess. At minimum add a comment citing the spec line that says a 404 inside review should surface as a skip.

### MINOR: `undoReview` window isn't enforced

- **File**: `libs/bc/study/src/reviews.ts:165-179` (docstring says "Callers are expected to invoke this within a few seconds of submitReview; the function itself does not enforce a window")
- **Problem**: Any caller (including a replay of an old POST) can undo the most-recent review indefinitely. The docstring acknowledges this as deliberate but there's no CSRF / window guard at the route layer either. `memory/review/+page.server.ts` doesn't check anything before calling `undoReview`. A learner who bookmarks a form-post URL can reverse a review they made weeks ago.
- **Fix**: Enforce the window at the BC: pull the latest review's `reviewedAt`, reject if older than `REVIEW_UNDO_WINDOW_MS` (new constant, e.g. 30s matching the UI's undo snackbar). Throw `ReviewUndoExpiredError`. Route maps it to `fail(409, { error: 'Undo window expired' })`.

### MINOR: Login action parses `redirectTo` but no length check

- **File**: `apps/study/src/routes/login/+page.server.ts:11-19,66`
- **Problem**: `isSafeRedirect` guards against cross-origin and header injection but doesn't cap length. A 5KB query param would be happily used as the redirect URL.
- **Fix**: Add `if (path.length > 512) return false;` to `isSafeRedirect`. Cheap, removes a minor DoS vector.

### MINOR: `fetchDomainFrequency` uses 30-day window via untyped `24 * 60 * 60 * 1000`

- **File**: `libs/bc/study/src/sessions.ts:431,461,503` and similar
- **Problem**: `30 * 24 * 60 * 60 * 1000`, `7 * 24 * 60 * 60 * 1000`, `366 * 24 * 60 * 60 * 1000` appear inline across several BC functions. Not a bug, but the constants file (`@ab/constants`) already has `CALIBRATION_TREND_WINDOW_DAYS`, `REP_DASHBOARD_WINDOW_DAYS`, etc -- these window lengths should live next to them. Magic numbers violate the project rule.
- **Fix**: Add `MS_PER_DAY` to `@ab/constants`, replace inline multiplications with `N * MS_PER_DAY`, and extract `SESSION_RECENT_DOMAIN_WINDOW_DAYS`, `SESSION_ACTIVE_DOMAIN_WINDOW_DAYS`, `STREAK_LOOKBACK_DAYS` as named constants.

### NIT: Unused zod import paper-over in memory/new

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:6,101`
- **Problem**: The trailing `export type NewCardInput = z.infer<typeof newCardSchema>` exists specifically to satisfy the bundler because zod is otherwise only used transitively. The comment admits this. It's a smell: the type is exported from one random route file; consumers that want `NewCardInput` won't find it here.
- **Fix**: Move `NewCardInput` to `libs/bc/study/src/validation.ts` alongside the schema, export from `@ab/bc-study`. Remove the zod import from the route.

### NIT: `resolveSlotDomain` in session runner would be better on the BC

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:195-207`
- **Problem**: The function reads a card or scenario just to extract its domain and narrow to the `Domain` type. It's logic about session slots and their domains -- BC territory.
- **Fix**: Move to `libs/bc/study/src/sessions.ts` as `getSlotDomain(sessionId, userId, slotIndex)`. Routes shouldn't know the relationship between slot kind and content table.

### NIT: Dashboard `getDashboardPayload` uses `Promise.allSettled` tuples; pattern isn't documented

- **File**: `apps/study/src/routes/(app)/dashboard/+page.server.ts:5-12`
- **Problem**: The `{ value } | { error }` per-panel tuple shape is a clever "don't blank the whole page when one query fails" pattern but it's not documented anywhere as the template, and no other load uses it. Future pages with multiple independent panels will likely default to `Promise.all` and blank on any failure.
- **Fix**: Document the pattern in `docs/agents/reference-sveltekit-patterns.md` as "dashboard-style aggregators." Name it, describe when to use it (multi-panel reads where partial success is better than total failure) vs `Promise.all` (essential reads where partial success is confusing).

### NIT: Browse `?created=<id>` re-read costs one extra round trip every page load

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:91-95`
- **File**: `apps/study/src/routes/(app)/reps/browse/+page.server.ts:100-105`
- **Problem**: On every browse page load, if `?created` is present, an extra `getCard` / `getScenario` runs sequentially after the list+count fetch. Add it to the existing `Promise.all` or skip it entirely when `createdId` isn't in the current page's rows (we already have them).
- **Fix**: Check `visible.find(c => c.id === createdId)` first; fall back to a BC read only if the created row isn't on this page. Add to the `Promise.all` in any case.
