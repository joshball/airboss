---
title: 'Phase 7 Backend Review: Hangar Review Queue'
reviewer: backend
date: 2026-05-05
diff: 371626fd...f95d5588
---

# Phase 7 Backend Review: Hangar Review Queue

Scope: loader admin page, bucket admin (list / new / edit+delete), nav-badge wiring, two new BC primitives (`countReviewQueueOpen`, `getBucket`), and the `getLastLoaderRun`/`setLastLoaderRun` process-local cache.

## Summary

- Files reviewed: 17
- Critical: 0
- Major: 3
- Minor: 5
- Nit: 4

Overall the server-side code is competent: every `load` and every action calls `requireRole(ADMIN)`, all writes go through Drizzle, all routes go through `ROUTES`, all enums come from `libs/constants`. The main backend concerns are (a) the bucket-list page's item counts silently undercount when the board exceeds the in-memory cap, (b) zero automated test coverage for the new primitives or Phase 7 actions, and (c) `setLastLoaderRun` is exported as a public BC primitive but is only ever meant to be called internally.

## Findings

### Critical

(none)

### Major

#### M1. `buckets/+page.server.ts` item counts silently truncate at `REVIEW_LIST_HARD_CAP`

- **Location**: `apps/hangar/src/routes/(app)/review/admin/buckets/+page.server.ts:27-39`; cap defined `libs/constants/src/review.ts:251` (`REVIEW_LIST_HARD_CAP = 1000`); filter applied `libs/bc/hangar/src/review.ts:683`.
- **Problem**: The list page builds bucket counts by calling `listItems(board.id)` (no filter overrides, so capped at 1000) and then running `filterItemsByCriteria` over the in-memory list. Once the board crosses 1000 live items the displayed `Items` column is wrong without any indication: a bucket containing the 1001st item shows 0 even though the bucket really matches more rows. Worse, the admin's primary signal for "is this predicate doing what I think" is exactly this number.
- **Why it matters**: Bucket admin's whole purpose is verifying predicate behavior before saving. A capped count produces false-negatives that look authoritative. The board layout already uses the same pattern, but on the admin surface where the operator is reasoning about predicates this is the wrong tradeoff -- and there's no banner warning when `items.length === REVIEW_LIST_HARD_CAP`.
- **Fix**: Either (a) add a per-bucket SQL `COUNT(*)` that translates the predicate to Drizzle conditions (mirror what `countReviewQueueOpen` does), or (b) at minimum surface a banner when `items.length === REVIEW_LIST_HARD_CAP` saying counts may be truncated. Option (a) is the right direction; this admin page is ADMIN-only and small N, so 6-12 round-trips on page load is fine. The `noPassingSession` predicate already has its own SQL helper (`listItemsWithPassingSession`); add a sibling `countItemsByCriteria(boardId, criteria)` BC primitive.

#### M2. Zero automated test coverage for Phase 7 server actions and new BC primitives

- **Location**: `libs/bc/hangar/src/review.test.ts` (no new `describe` blocks for `countReviewQueueOpen` / `getBucket` / `getLastLoaderRun`); no `.test.ts` next to any of the new `+page.server.ts` files.
- **Problem**: Phase 7 adds `countReviewQueueOpen` (one indexed COUNT used on every nav request), `getBucket` (read by every edit page), and `getLastLoaderRun`/`setLastLoaderRun` (a process-local cache exported as public API). None have test coverage. The bucket admin actions (`new` create, `edit` update, `edit` delete, `loader` runLoader) are also untested. The existing `review.test.ts` `'buckets'` `describe` only covers the create/update/delete BC functions, not the form-action wrapping (parsing, error mapping, redirect targets, 23505 surface).
- **Why it matters**: The CLAUDE.md project rules require automated tests alongside implementation: "unit (Vitest) for BC/lib logic, e2e (Playwright) for user flows." `countReviewQueueOpen` is on the hot path for every authenticated hangar request and has subtle predicate logic (`NOT (fmStatus=done AND reviewStatus=done)`); a regression here would silently misbadge the nav for everyone. A unit test asserting the count over a fixture board with one row in each `(fmStatus, reviewStatus)` quadrant is cheap and catches a class of regressions (e.g., someone simplifying the `not(and(...))` to `or` of negations).
- **Fix**: Add to `libs/bc/hangar/src/review.test.ts`:
  - `describe('countReviewQueueOpen')` with rows in each of the four `(fmStatus, reviewStatus)` quadrants + a soft-deleted row, asserting the open count excludes only the `(done, done)` non-deleted row.
  - `describe('getBucket')` for present / absent / hard-deleted ids.
  - `describe('getLastLoaderRun')` -- assert null on fresh module, populated after `loadReviewItems`.
  - At least one server-action smoke test per page (create-bucket happy path + 23505 surface, update-bucket happy path, delete-bucket happy path, loader runNow happy path) using the existing test-DB harness.

#### M3. Bucket admin's structured-form parser does an unchecked cast for the advanced-JSON branch

- **Location**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.ts:81-91`.
- **Problem**: When `values.advancedJson !== ''`, the parser does `filterCriteria = parsed as BucketFilterCriteria` and returns. The actual schema validation (`validateBucketFilterCriteria`) only runs later, inside `createBucket`/`updateBucket`, and throws `RangeError`. The form action then maps that `RangeError` to `errors.advancedJson`. The end result is correct -- the DB never sees an invalid predicate -- but the parser ships unchecked user input back to the form layer typed as if it were validated. A future caller of `parseBucketForm` that doesn't go through `createBucket` (e.g. a future preview / dry-run endpoint) would silently accept arbitrary structure.
- **Why it matters**: The function's docstring promises validation: "Returns either a parsed `{ ..., filterCriteria }` payload or a `FormErrors` record." A reader assumes `filterCriteria` is well-formed on the success branch. The unsafe `as` is the only thing keeping the type signature intact. Defense-in-depth says validation should live at the parser boundary, not "later, in some other layer."
- **Fix**: Run `validateBucketFilterCriteria` inside `parseBucketForm` for both branches, catching `RangeError` and folding it into `errors.advancedJson` (or `errors._form` for the structured branch where the bug isn't user-attributable). Drop the `as BucketFilterCriteria` cast. Then `createBucket`/`updateBucket` can keep their own validation as a defensive double-check, but the parser becomes the source of truth and the type signature reflects reality.

### Minor

#### m1. `setLastLoaderRun` is exported but is only meant to be called internally

- **Location**: `libs/bc/hangar/src/review-loader.ts:61-63`; re-exported `libs/bc/hangar/src/index.ts:218`.
- **Problem**: `setLastLoaderRun` is a write to the module-local `lastLoaderRun` cache. The only legitimate caller is `loadReviewItems` itself (which already calls it via the `.then` continuation). Exporting it from `@ab/bc-hangar` invites a future caller to pollute the admin page's "Last run" panel with a synthesized result.
- **Why it matters**: Public BC API should be the minimum. Two functions read this cache (`getLastLoaderRun`) and one writes it (`loadReviewItems`); both are already exposed. The setter has no caller and shouldn't be a foot-gun.
- **Fix**: Drop `setLastLoaderRun` from `index.ts`'s re-export. Keep it module-private inside `review-loader.ts`.

#### m2. Nav-badge query runs on every (app) request, including non-review pages

- **Location**: `apps/hangar/src/routes/(app)/+layout.server.ts:28-29`.
- **Problem**: `getOrCreateBoard()` + `countReviewQueueOpen()` now fire on every authenticated hangar nav -- `/sources`, `/users`, `/audit`, `/docs`, etc. -- regardless of whether the current page even shows a nav with a review badge. That's two DB round-trips added to every authenticated load. These are cheap (the COUNT is indexable, the get-or-create is a single SELECT after first boot) but they're not parallelized with anything: they run sequentially before the layout resolves.
- **Why it matters**: For ADMIN-only surfaces like loader admin this is invisible, but for a busy authoring user navigating between sources/references/docs this adds two synchronous DB hops per page. Independent calls should be parallel.
- **Fix**: Two cheap fixes that can land together:
  1. `Promise.all([getOrCreateBoard(), ...])` -- doesn't help here (the count needs the board id), but `siblingOrigin` is sync so reorder so `getOrCreateBoard()` and any other parent-load read run together.
  2. Better: collapse to a single query that returns `(boardId, openCount)` in one round-trip via Drizzle (`SELECT id, (SELECT count(*)...) FROM hangar_review_board WHERE name = ...`). Exposes one BC helper `getBoardWithOpenCount()`. Removes one round-trip from every authenticated request.

#### m3. `countReviewQueueOpen` predicate isn't supported by an index that includes status columns

- **Location**: `libs/bc/hangar/src/review.ts:468-489`; index defined `libs/bc/hangar/src/schema.ts:602` (`hangar_review_item_board_idx` on `(boardId, deletedAt)`).
- **Problem**: The query filters `boardId + deletedAt IS NULL + NOT (frontmatterStatus = 'done' AND reviewStatus = 'done')`. The existing index covers the first two columns; the status predicate is filtered as a heap scan. For a singleton board with N items the planner reads every live row to evaluate the NOT. That's fine while N is small (hundreds), and in practice it will run sub-millisecond, but the doc-comment claims "one indexed COUNT(*)" which oversells it -- it's an index-scan-on-(boardId,deletedAt) plus a per-row status check.
- **Why it matters**: Phrasing in the doc comment misrepresents the plan. If the count grows slow, the right fix is a partial index. Lower priority than M1 because the cardinality is bounded and ADMIN-only. The bigger correctness issue is in `+layout.server.ts` running this on every nav (m2).
- **Fix**: Either (a) tighten the doc comment ("indexed scan over live rows for the singleton board, with a heap-side status check"), or (b) add a partial index `WHERE deletedAt IS NULL AND NOT (frontmatterStatus='done' AND reviewStatus='done')` -- but only do (b) once we have a measurement showing it matters. Recommend (a) now.

#### m4. `deleteBucket` confirms with no awareness of how many items the bucket currently surfaces

- **Location**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.svelte:158-191`; spec invariant calls for "warn the user" of affected count.
- **Problem**: The danger banner says "Items remain on the board" -- correct -- but the user doesn't see how many items are about to lose this bucket's surfacing. After deletion those items only show up under buckets whose predicates they match; if they match no remaining bucket they hide entirely. The spec's bucket-CRUD requirement names this: "warn the user count of affected items."
- **Why it matters**: A reviewer about to delete "WP Specs -- unread" wants to know "12 items currently in this bucket; deleting it leaves 7 of them with no bucket." Without that number the delete is a leap of faith. The data is already loaded by the load function for the `Edit` page sibling list -- thread it through.
- **Fix**: Add `itemCount` (and ideally `itemsWithoutOtherBucket`) to the edit-page load output, and surface both numbers in the delete confirmation banner. Re-uses `filterItemsByCriteria` plus a "matches any other bucket" pass.

#### m5. Loader runNow action returns `ranLoader: 'error'` instead of `fail()` on failure

- **Location**: `apps/hangar/src/routes/(app)/review/admin/loader/+page.server.ts:57-61`.
- **Problem**: When `loadReviewItems` throws, the action returns `{ ranLoader: 'error', error: message }` as a normal 200 response instead of `fail(500, ...)`. SvelteKit's convention is that recoverable errors use `fail()` (which sets the response status appropriately and surfaces the form-state shape the client expects). The bucket actions (`new` create, `edit` update, `edit` delete) all use `fail()` with a status code; this one is inconsistent.
- **Why it matters**: Pattern consistency across actions matters for the client's error-handling code. The page already does the right thing visually (the toast checks `ranLoader === 'error'`), but a future shared `enhance` helper that branches on `result.type === 'failure'` would behave differently here. The diff says "Form actions return `fail()` ... `redirect()` on success" -- the loader action breaks that contract.
- **Fix**: `return fail(500, { ranLoader: 'error' as const, error: message });`. The Svelte page's `$effect` already accesses `'ranLoader' in form`, which still works after `fail()`.

### Nit

#### n1. Dead-code `?? sql\`FALSE\`` in `countReviewQueueOpen`

- **Location**: `libs/bc/hangar/src/review.ts:484`.
- **Problem**: `not(and(eq(...), eq(...)) ?? sql\`FALSE\`)` -- `and()` only returns `undefined` when given zero args; here it has two literal args so the fallback is unreachable.
- **Fix**: Drop the `?? sql\`FALSE\`` and the un-needed nullish-coalesce. `not(and(eq(...), eq(...)))` is correct and clearer.

#### n2. `getBucket` doesn't scope by board id

- **Location**: `libs/bc/hangar/src/review.ts:408-411`; call site `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:32`.
- **Problem**: The lookup is by `id` only, with no `boardId` filter. Today the system has a singleton board so there's no leak, but if a second board ever exists the edit page will happily edit a bucket from a different board if the URL's `bucketId` resolves there.
- **Fix**: Either accept `(boardId, id)` and filter both, or document explicitly that `getBucket` is intentionally board-agnostic given the singleton invariant. Prefer the former -- cheap defense against the singleton invariant being relaxed later.

#### n3. `FilterCriteriaRecord` interface duplicated in edit page

- **Location**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:22-27`.
- **Problem**: The page declares its own ad-hoc `FilterCriteriaRecord` shape to extract structured fields from the validated `BucketFilterCriteria`. The BC already exports `BucketFilterCriteria` -- reuse it directly rather than declaring a parallel record type with looser typing (`string`, `ReadonlyArray<string>`).
- **Fix**: `import type { BucketFilterCriteria } from '@ab/bc-hangar'` and use `bucket.filterCriteria` directly; the cast to `FilterCriteriaRecord` is unnecessary.

#### n4. `isRedirect` import in `new/+page.server.ts` action is dead

- **Location**: `apps/hangar/src/routes/(app)/review/admin/buckets/new/+page.server.ts:18, 47-48`.
- **Problem**: The catch block does `if (isRedirect(err)) throw err;` -- but the only line that could throw a redirect is *after* the try/catch (`throw redirect(303, ...)` on line 60), so no redirect can ever reach this catch. The line is harmless but cargo-culted.
- **Fix**: Remove the `isRedirect` check (and the import) from this action. Keep it on the `edit` page's `delete` action (which has the same dead-import pattern -- the `redirect` is also outside the try/catch). Clean up both consistently.

## Areas verified clean

- Every `load` and every action calls `requireRole(ROLES.ADMIN)` (admin pages) or `requireRole(ROLES.AUTHOR, OPERATOR, ADMIN)` (root layout). Dual-gate rule respected.
- All routes go through `ROUTES.HANGAR_REVIEW_ADMIN_*`. No inline path strings.
- All enum / status / kind literals come from `@ab/constants` (`REVIEW_KIND_VALUES`, `FRONTMATTER_STATUS_VALUES`, `FRONTMATTER_REVIEW_STATUS_VALUES`, `REVIEW_KIND_LABELS`, `REVIEW_WP_SPEC_TOAST_DISMISS_MS`).
- Drizzle ORM only; no raw SQL except the documented window-function read in `listItemsWithPassingSession` (pre-existing, not Phase 7).
- 23505 (unique violation on bucket name) is mapped to a friendly inline `errors.name` on both `new` and `edit`. 23503 isn't possible (no FK targets buckets).
- `RangeError` from `validateBucketFilterCriteria` is mapped to `errors.advancedJson` on both `new` and `edit` (the parser-level cast in M3 is the qualifying caveat).
- `loadReviewItems` is single-flight per `Db` via `WeakMap<Db, Promise<...>>`; the runNow action correctly composes with concurrent boot scans.
- `getOrCreateBoard()` is idempotent and seeds columns + kinds on first call; bucket admin pages rely on this without a separate seed step.
- The loader action correctly logs structured metadata via `createLogger` and surfaces a user-friendly message on failure.
- `bucket-form.ts` parser correctly uses `Number.isFinite` + `< 0` check for `sortOrder` (no NaN injection).
- Admin layout (`+layout.svelte`) is client-only and is purely presentational; auth is enforced at every `+page.server.ts` underneath.
- The advanced-JSON predicate path is safe from arbitrary-jsonb-key injection because `validateBucketFilterCriteria` enforces an allowlist of four keys with type checks before any DB write.
