---
title: '10x Review: Decision Reps'
feature: decision-reps
type: review
status: unread
review_status: done
date: 2026-04-20
---

# 10x Review: Decision Reps

## Overview

Decision Reps ships a single-decision micro-scenario flow (`/reps`, `/reps/new`, `/reps/browse`, `/reps/session`) backed by two new tables (`study.scenario`, `study.rep_attempt`) and a fully-wired study BC module. Schema carries CHECK constraints for difficulty / phase / source / status / options-shape, dual `domain_*` and `user_status` indexes, and RESTRICT on `rep_attempt -> scenario` so audit history can't silently drop. The BC (`scenarios.ts`, ~500 lines) owns creation, listing, session queueing, attempt submission, and five read aggregates, guarded by typed errors and zod validation. 23 real-DB unit specs exercise the happy paths, validation rejects, priority ordering, accuracy math, and the dashboard rollup. Routes follow existing patterns (requireAuth + `@ab/bc-study` + `@ab/constants`), Svelte 5 runes are used correctly, and an auth-cookie-domain fix that rode along makes the hooks / login / logout flows resilient across `*.airboss.test` and `127.0.0.1`. Overall quality is high -- ships cleanly with a small set of follow-ups. No blockers.

**Verdict: ship as-is, pull the Medium / Low list into the next iteration.**

## Blockers

None.

## High

- **Session summary double-counts `skipped` successes** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:283-294`. When the server returns `{ success: true, skipped: true }` the client calls `advance()` without bumping `attemptedTotal` (correct), but the route still returns `success: true` so the session shows "attempted = N" that silently misses skipped scenarios. Either surface the skip to the user ("Skipped -- scenario was removed") or rename the field so the summary isn't misleading.
- **`phase === 'submitting'` is never entered on the render path** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:271,312`. The `choose | submitting` branch disables the option buttons via `disabled={phase !== 'choose'}`, but the double-submit guard is racy: the form submits synchronously, `phase = 'submitting'` runs inside the enhance callback after the click event, and a rapid second click on a different option can fire before the first update lands. Switch to `disabled={loading}` pattern (set `loading = true` at the top of the enhance callback) or disable the fieldset wholesale on first submit.
- **`fieldErrors['']` lookup is dead code** -- `apps/study/src/routes/(app)/reps/new/+page.svelte:161-163`. The server action flattens zod paths with `issue.path.join('.')` and uses `'_'` for root-level issues, so an empty-string key never appears. Rename to `fieldErrors._` or delete the branch -- right now root-level "exactly one option must be marked correct" messages display via the `_` banner AND attempt to render in `fieldErrors.options`, neither of which is populated by the current keying scheme (the root error lands at `_`, not `options`).
- **Logout action does not forward Set-Cookie on its own** -- `apps/study/src/routes/(app)/logout/+page.server.ts:22,30`. `forwardAuthCookies` is called before `clearSessionCookies`, but the logout response body from better-auth is discarded without checking status. If better-auth returns an error (network flap, banned session already expired), the user silently stays logged in on the server-side response path until `clearSessionCookies` executes. Move `clearSessionCookies` into a `finally` block or run it first and rely on better-auth only for the non-session side effects.

## Medium

- **`sql.raw('"study"."scenario"."id"')` hardcodes the schema namespace** -- `libs/bc/study/src/scenarios.ts:293,490`. Works today because `SCHEMAS.STUDY === 'study'` and the comment explains the drizzle-serializer hazard. If the namespace ever moves (the ADR notes a future graph domain split), this silently binds to the old name. Replace with `sql.identifier(SCHEMAS.STUDY, 'scenario', 'id')` or an `aliasedTable(scenario, 'outer_scenario')` + `outer.id` reference so the coupling is constant-driven.
- **No idempotency window on `submitAttempt`** -- `libs/bc/study/src/scenarios.ts:314-352`. The comment says re-attempts are spec-allowed and each gets a row, but the rep-session UX submits via a standard form; a double-click or back-button replay can write two identical `rep_attempt` rows in the same second. Cards carry `REVIEW_DEDUPE_WINDOW_MS`; scenarios should either do the same for "same user + same scenario + same chosenOption within N ms" or the session page should generate an `Idempotency-Key` (sessionId + rep index) and the server should 200-no-op on dupes.
- **Shuffle seed changes on every load** -- `apps/study/src/routes/(app)/reps/session/+page.server.ts:68,81`. `sessionId = now.getTime().toString()` means every time `load` re-runs (e.g. `invalidateAll()` in `startNewSession`, or any natural SvelteKit rerun) the seed drifts. The Svelte page mitigates with local `$state`, but if the user hard-refreshes mid-session they'll see options in a different order, and their `answerMs` baseline will be lost. Persist the sessionId in the URL (`?s=...`) or a cookie, so a refresh resumes the same shuffle seed.
- **Dashboard `unattemptedCount` + `scenariosByDomain` double-count archived scenarios** -- `libs/bc/study/src/scenarios.ts:467-495`. Both queries filter by `status = ACTIVE`, but the UNATTEMPTED subquery (`NOT EXISTS ... rep_attempt`) is keyed on scenarioId only -- if a learner archives a scenario they previously attempted, it disappears from `scenarioCount`, but the `unattemptedCount` still reflects all-time attempts on active rows. In practice this is fine for MVP; flag for "you archived X that you never attempted" UX later.
- **`getNextScenarios` `ORDER BY last_attempted_at ASC NULLS FIRST, createdAt DESC` does not tie-break on `id`** -- `libs/bc/study/src/scenarios.ts:302`. Two scenarios created in the same millisecond (seeder scripts, batch imports) appear in a nondeterministic order. Add `, scenario.id` as a final tie-breaker so the session queue is fully deterministic.
- **`getRepDashboard` doesn't use `todayStart` for the accuracy window; uses `windowStart` instead** -- `libs/bc/study/src/scenarios.ts:461,501`. Correct by spec (30d accuracy + attemptedToday are two different numbers), but the mix is easy to mis-read. Add a one-line comment clarifying both windows.
- **`rewriteSetCookieDomain` / `clearSessionCookies` both trust `event.url.host`** -- `apps/study/src/hooks.server.ts:47`, `apps/study/src/routes/(app)/logout/+page.server.ts:22,30`. Behind a proxy, `url.host` can be the internal host, not the user's origin. Accept this for now but document -- when the reverse proxy lands, prefer `Forwarded:` / `X-Forwarded-Host` after CSRF check.
- **`options.length` not CHECK-enforced equal to distinct ids** -- `libs/bc/study/src/schema.ts:307-313`. The shape CHECK enforces jsonb array + length BETWEEN 2 AND 5, but duplicate option ids inside the array are only caught by zod. A script bypassing validation could write a scenario with duplicate option ids; `submitAttempt` then picks the first match. Add a CHECK that uses `jsonb_array_elements(options)->>'id'` aggregate uniqueness, or accept that the BC is the only write path and say so.
- **`userStartOfDay` silently picks `DEFAULT_USER_TIMEZONE`** -- `libs/bc/study/src/scenarios.ts:152`. `getRepDashboard` doesn't accept a `tz` argument, so "today" is always America/Denver. Comment already notes the per-user-tz gap; plumb `tz` through `RepDashboardStats` caller path when user settings land.
- **Dev-tz helper placement** -- `libs/bc/study/src/scenarios.ts:152-159`. `userStartOfDay` is a generic time helper that also appears (or will appear) in the Memory BC once day-boundary stats land there. Hoist to `libs/utils/src/time.ts` before the second use-site creates a drift.
- **Browse page reveals `isCorrect` on every option via `s.options.length`** -- `apps/study/src/routes/(app)/reps/browse/+page.svelte:156`. Only the count is rendered (fine), but the full `options` array (with `isCorrect`, `outcome`, `whyNot`) is serialized into the page data payload. A learner peeking at the source can see the answer before attempting. Strip options down to `{count}` in the load (`scenarios.map(s => ({...s, optionsCount: s.options.length, options: undefined}))`) before returning.

## Low / Nit

- **`@ab/constants` import ordering in `libs/bc/study/src/scenarios.ts:13-24`** -- some re-exported types use `import type` but others plain `import`; Biome will sort, but the cross-mode mixing is a minor readability snag.
- **`scenarios.ts` `humanize()` copy-pasted across three pages** -- `apps/study/src/routes/(app)/reps/{+page,session/+page,browse/+page}.svelte`. Extract into `@ab/utils`.
- **`confidence` narrowed via `parsed.data.confidence as ConfidenceLevel | null | undefined`** -- `apps/study/src/routes/(app)/reps/session/+page.server.ts:120`. zod already enforces the refinement; the cast is safe but noisy. The BC signature could accept `number | null | undefined` and narrow internally.
- **`'rep_does-not-exist'` in test** -- `libs/bc/study/src/scenarios.test.ts:346`. Intentional; the ULID generator uses lowercase ULID separators but the literal doesn't match the `_ULID` format. Harmless, but a future format tightening would break the test.
- **`isEditable` default in route payload** -- `libs/bc/study/src/scenarios.ts:204`. Falls back to `sourceType === 'personal'` when the user didn't send it, which is correct but subtle; mirror the cards default exactly and document the fallback.
- **Svelte 5 `state_referenced_locally` warnings are suppressed with `// svelte-ignore`** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:27,30`, `apps/study/src/routes/(app)/reps/new/+page.svelte:38`. Correct usage but the comments only say "intentional"; add a one-line "why": "seed initial state from `data` / `form`, then treat as independent".
- **`aria-disabled` on disabled "Start session" anchor without `role=link` or `tabindex=-1`** -- `apps/study/src/routes/(app)/reps/+page.svelte:43`. Pointer-events hides the click, but keyboard users can still Tab + Enter. Use a `<button disabled>` when there's no destination, or add `tabindex="-1"`.
- **`<hr />` inside reveal card** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:209`. Structural separator styled as a dashed line; consider `<div role="separator">` for better semantics.
- **No aria-live on the reveal section** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:208`. When the phase flips to `reveal`, screen readers don't announce "Your choice / Correct/Incorrect". Add `aria-live="polite"` on the reveal container or an `aria-atomic` status announcement.
- **Confidence row lacks `role="radiogroup"` semantics** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:260`. They're `<button>` elements which is fine functionally, but a radiogroup better matches the 1..5 selection UX for assistive tech.
- **`onkeydown` on `<svelte:window>` doesn't guard composition events** -- `apps/study/src/routes/(app)/reps/session/+page.svelte:134-154`. Fine for the current user flow; if IME composition is ever used (e.g. localization), number keys during compose can trigger a confidence pick. Low-priority.
- **Filters form on browse lacks `aria-labelledby`** -- `apps/study/src/routes/(app)/reps/browse/+page.svelte:88`. Has `aria-label="Filter scenarios"` which is fine; nit.
- **`.filter.three` grid collapses to `1fr` at 640px but middle column keeps its label** -- `apps/study/src/routes/(app)/reps/new/+page.svelte:586-590`. Looks fine; nothing to do.
- **`scenario_user_created_idx` is unused by current queries** -- `libs/bc/study/src/schema.ts:296`. `getScenarios` orders by `createdAt DESC` but filters on `userId + status`, hitting the user_status index. The user_created index is speculative. Keep for now (cheap), but flag if unused after N weeks.
- **`rep_attempt_user_attempted_idx` covers the range-scan in `getRepDashboard.attemptedToday`** -- `libs/bc/study/src/schema.ts:345`. Good; no issue, just confirming the schema matches the query shape.
- **`getRepAccuracy` sums with `sum(case when is_correct then 1 else 0 end)`** -- `libs/bc/study/src/scenarios.ts:378`. Portable but slower than `count(*) filter (where is_correct)` on Postgres. Micro-nit.
- **Hard-coded hex colors in page styles** -- all four `+page.svelte` files. Design tokens live in `libs/themes/`; the pages currently don't import from there. Acceptable for now (other study pages do the same), but the themes-lib-vs-app boundary deserves a cleanup pass.

## By persona

### 1. UX

Core flow reads well: dashboard tiles + domain breakdown, clean creation form with per-option structure, session flow with clear read/confidence/choose/reveal phases. Gaps: skipped-scenarios feedback (see High), no empty-state for the "batch returns 0 because all scenarios archived" case beyond a plain sentence, progress bar advances before the reveal is dismissed (counts the in-flight rep as done), and no "back / review previous rep" affordance during a session. See `apps/study/src/routes/(app)/reps/session/+page.svelte:331` for the progress math, `+page.svelte:181` for the thin "no scenarios available" summary text.

### 2. Svelte 5 correctness

Runes used correctly throughout: `$state`, `$derived`, `$props` in every component. `$app/state` (not `$app/stores`) used in `(app)/+layout.svelte:4`. Snippets used for layout children (`+layout.svelte:3,21`). Form enhance callback is idiomatic. Two `state_referenced_locally` suppressions are correct but undocumented (see Low). `$effect` is not used anywhere -- session progression via explicit `advance()` function is the right call over derived effects. The `<svelte:window onkeydown>` handler runs globally while the session page is mounted; fine given the scope but see Low about composition events.

### 3. Security

Auth wired via `requireAuth(event)` on every load/action. Validation happens at the route layer AND BC layer (defense-in-depth). `submitAttempt` resolves correctness from the DB, never the client payload (`libs/bc/study/src/scenarios.ts:333-344`). Login `redirectTo` is sanitized (`apps/study/src/routes/login/+page.server.ts:11-19`). Cookie-domain resolution for cross-subdomain vs host-only is the right model. Confidence sampling uses djb2 hash -- deterministic, not cryptographic, but it doesn't need to be. Shuffle seed uses the same djb2 hash; fine. Concerns: (a) the browse page leaks full `options` (with `isCorrect` + `outcome` + `whyNot`) to the client -- see Medium -- so a learner can read the answer before attempting; (b) `resolveCookieDomain` trusts `event.url.host`, OK behind no proxy but worth documenting (Medium). CSRF: SvelteKit's default CSRF on form POSTs is in play; no custom skipping seen.

### 4. Performance

Dashboard fans out five parallel queries via `Promise.all` -- correct. Indexes exist for the hot paths (`scenario_user_status_idx`, `scenario_user_domain_idx`, `rep_attempt_user_attempted_idx`, `rep_attempt_scenario_attempted_idx`). The `last_attempted_at` correlated subquery in `getNextScenarios` is O(scenarios * log(attempts)) with the rep_attempt_user_attempted_idx; fine up to ~10K scenarios per user. Browse uses `limit + 1` to infer `hasMore` without a COUNT -- good pattern. Concern: browse page ships full scenario rows (including the large `situation`, `teachingPoint`, `options` jsonb) for each card -- 25 per page is fine, but trim to a projection if ever showing 100+. No N+1 detected.

### 5. Architecture

BC boundaries respected: `libs/bc/study/src/scenarios.ts` owns all scenario logic; routes call BC functions only; validation lives in `libs/bc/study/src/validation.ts` and is re-exported through the BC barrel. Schema stays in the `study` namespace, no cross-BC leakage. `@ab/*` aliases used throughout (not a single relative cross-lib import). `userStartOfDay` lives in the BC -- should migrate to `@ab/utils` before a second caller lands (Medium). Auth cookie helpers are correctly split between `libs/auth` (pure) and `apps/study/src/lib/server/cookies.ts` (binds `dev`). `@ab/bc-study` barrel re-exports include a mix of functions, types, and schema objects -- acceptable given the scale but a candidate to split into `/scenarios`, `/cards`, `/srs`, `/schema` sub-exports when the BC grows.

### 6. Patterns

All IDs via `createId()` helpers (`generateScenarioId`, `generateRepAttemptId`). All routes via `ROUTES.REPS_*` constants -- no inline paths. All enums / literals via `@ab/constants` (`DOMAINS`, `DIFFICULTIES`, `PHASES_OF_FLIGHT`, `CONFIDENCE_LEVELS`, `REP_BATCH_SIZE`, `REP_DASHBOARD_WINDOW_DAYS`, `BROWSE_PAGE_SIZE`, `SCENARIO_OPTIONS_MIN/MAX`). CHECK constraints built via `inList(VALUES)` helper -- same shape as cards. Drizzle-only; no raw SQL except the two intentional correlated subqueries. No `any`, no `!`, no magic numbers found. Good adherence.

### 7. Correctness

`sql.raw('"study"."scenario"."id"')` workaround is airtight **for the current schema name** -- the serializer behavior drizzle exhibits is to emit `"scenario"."id"` (table-qualified, not schema-qualified), and the raw fragment forces schema qualification to disambiguate. If the namespace moves, the string doesn't follow (Medium). Accuracy math: `sum(case when is_correct then 1 else 0 end)` returns `null` when there are no rows; `Number(null)` -> 0, so the `attempted === 0` guard catches it. `getNextScenarios` ordering: correctly puts NULLS FIRST; secondary `createdAt DESC` but no tiebreaker on `id` (Medium). `submitAttempt` correctness resolution: pulls options from DB, finds by id, writes `isCorrect = chosen.isCorrect`. Confidence lands as `null` when `NaN` because `Number('')` would be `0` (passes zod `int().min(1)`? no -- zod's refine on CONFIDENCE_LEVEL_VALUES excludes 0); the route layer handles empty-string via `confidenceRaw === '' ? null : Number(...)`, correctly. `answerMs` on a negative `revealedAt` (user toggled back) -- current flow only sets `revealedAt` in `proceedToChoose`/`pickConfidence`, never clears mid-rep; safe. `fieldErrors['']` branch is dead (High). Edge case: user submits scenario creation, zod refine adds issue with `path: []`, which becomes key `'_'` -- matches `fieldErrors._`; good. RESTRICT FK on rep_attempt -> scenario is enforced; tests honor the ordering in afterAll teardown.

### 8. A11y

Skip link present on `(app)/+layout.svelte:12`. Nav uses `aria-current='page'`. Forms label every input. Buttons are real `<button>` elements except "Start session" which is an `<a>` with `aria-disabled` -- switch to `<button disabled>` when no navigation is possible (Low). Reveal region lacks `aria-live` -- screen readers won't announce correct/incorrect (Low). Confidence row not a `role="radiogroup"` (Low). Option buttons in the session are type=submit, keyboard-accessible. `fieldset` + `legend` used correctly in the new-scenario form. Color contrast on the green/yellow/red difficulty badges against white looks sufficient; worth a formal WCAG check when themes land. No keyboard trap. Progress bar has `aria-hidden` which is fine given the "Rep N of M" text carries the same info. Overall: solid, with small additive fixes.

### 9. Backend

Server loads: all four call `requireAuth`. No leaky error messages (login action uses a generic "Sign-in failed"). Form actions return `fail(400|500, {...})` with field-level error maps and pre-filled values. `submitAttempt` route correctly translates BC typed errors into user-friendly responses: `ScenarioNotFound | ScenarioNotAttemptable` -> `skipped: true` (spec edge case), `InvalidOption` -> 400, anything else -> 500 with a log line. `submitAttemptSchema.safeParse` at the route layer + `newScenarioSchema.parse` at the BC layer is correct defense-in-depth. `use:enhance` applies `update({ reset: false })` which re-runs `load` and re-pulls `data.batch`; the client's local `$state` batch copy keeps the UI stable, but this is fragile (a future `invalidate` elsewhere in the tree re-triggers). No concurrent-request protection (see Medium on idempotency). Logout action forwards then clears cookies -- works but the finally-block pattern would be safer (High).

### 10. Schema

Normalization: options as jsonb is justified (design.md); FK `rep_attempt.scenario_id -> scenario.id ON DELETE RESTRICT` matches the review -> card pattern and preserves learner history. `rep_attempt.user_id -> bauth_user.id ON DELETE CASCADE` is the right asymmetry (user-delete cascades; scenario-delete requires archive). Indexes: `scenario_user_status_idx`, `scenario_user_domain_idx`, `scenario_user_created_idx` (the third is speculative -- Low), plus `rep_attempt_scenario_attempted_idx` and `rep_attempt_user_attempted_idx`. CHECK constraints cover difficulty / phase / source / status / options-shape; `options_shape_check` uses `jsonb_typeof = 'array' AND jsonb_array_length BETWEEN 2 AND 5` which is correct. `rep_attempt_confidence_check` allows NULL or 1..5, and `rep_attempt_answer_ms_check` allows NULL or >= 0 -- tight. No unique constraint on (userId, scenarioId, attemptedAt) because re-attempts are spec-allowed (correct). Naming conventions match existing tables (`<table>_<column>_<purpose>_idx`). Drizzle patterns clean: `$type<ScenarioOption[]>()` casts the jsonb column to the typed shape, `$inferSelect/$inferInsert` row types exported. `sql.raw(\`"study"."scenario"."id"\`)` coupling to the schema-name constant is the main smell (Medium).

## Follow-up priorities

1. Ship the High items (skipped feedback UX, `fieldErrors['']` cleanup, double-submit guard, logout `finally`) as a single follow-up PR.
2. Trim browse-page options payload (Medium -- small, high-value leak fix).
3. Replace `sql.raw('"study"."scenario"."id"')` with an identifier-safe form (Medium).
4. Add `answerMs` idempotency window OR submit-side `Idempotency-Key` (Medium).
5. Hoist `userStartOfDay` to `@ab/utils/time` before a second caller (Medium).
