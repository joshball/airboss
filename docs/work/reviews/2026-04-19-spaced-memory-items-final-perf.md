---
title: 'Final Performance Review: spaced-memory-items'
date: 2026-04-19
branch: build/spaced-memory-items
scope: git diff docs/initial-migration..HEAD
spec_target: 'dashboard loads in < 200ms with 1,000 cards'
category: perf
review_status: pending
status: unread
---

# Final Performance Review -- spaced-memory-items

Read-only perf pass over the full feature branch (phases 0-4). Focuses on the hot paths actually wired into the UI: dashboard, browse, review queue, card detail, and the `hooks.server.ts` gate that every request passes through.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 2     |
| Minor    | 7     |
| Nit      | 4     |

**Verdict:** At the spec target (1 user, 1,000 cards, warm pool) the dashboard will hit the 200 ms budget. Two items threaten the budget under real conditions: the auth session lookup on every request (unavoidable extra DB round-trip before any page load query starts) and the serialized card-detail load. Neither is critical for shipping the MVP with one learner; both should be resolved before any multi-user or keep-alive deployment.

## 1. Query plans by hot path

### 1a. Dashboard load (`/memory`)

**Files:** `apps/study/src/routes/(app)/memory/+page.server.ts`, `libs/bc/study/src/stats.ts:97-146`.

`getDashboardStats` runs five independent queries under `Promise.all` (the Phase 2 fix landed correctly). At 1,000 cards / ~5,000 reviews / single user:

| Query            | Predicates                                                       | Index used                                        | Expected cost |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ------------- |
| `dueNow`         | `cardState.userId = ? AND cardState.dueAt <= now AND card.status = 'active'` | `card_state_user_due_idx (user_id, due_at)`       | 1-3 ms        |
| `reviewedToday`  | `review.userId = ? AND reviewedAt >= todayStart`                 | `review_user_reviewed_idx (user_id, reviewed_at)` | 1-3 ms        |
| `stateCounts`    | `cardState.userId = ? AND card.status = 'active'` group by state | `card_state` PK + `card_user_status_idx` nested-loop | 3-8 ms     |
| `getDomainBreakdown` | `card.userId = ? AND card.status = 'active'` group by domain | `card_user_status_idx` + join `card_state` PK     | 4-10 ms       |
| `computeStreakDays`  | `review.userId = ? AND reviewedAt >= -366d` + distinct day   | `review_user_reviewed_idx`                        | 3-10 ms       |

Parallel round-trip wall time ~= max of the five ~= 10 ms. Under the 200 ms budget with comfortable headroom.

**Watch-out:** `stateCounts` and `getDomainBreakdown` both join `card` -> `card_state` with predicates on both sides. `card.status` is an indexed equality (`card_user_status_idx`), and `cardState.userId` goes through the `card_state` PK. Planner behavior is straightforward at 1k cards; at 100k cards the cheapest plan becomes "scan card_state via `(user_id, due_at)`, probe into card PK, filter status=active" -- still bounded by per-user fan-out. No concern in the spec window.

### 1b. Browse load (`/memory/browse`)

**Files:** `apps/study/src/routes/(app)/memory/browse/+page.server.ts`, `libs/bc/study/src/cards.ts:210-241`.

Predicate shapes: `user_id = ? AND status IN (...) [+ domain = ? + card_type = ? + source_type = ? + ilike front/back]`, `ORDER BY updated_at DESC LIMIT 26 OFFSET n`.

| Filter combo                             | Index used                          | Notes                                                         |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| user + status (default)                  | `card_user_status_idx`              | Good. Sort on `updated_at` is in-memory (trivial at 1k cards).|
| user + domain                            | `card_user_domain_idx`              | Good.                                                         |
| user + cardType                          | `card_user_status_idx` then filter  | No index on `(user_id, card_type)` -- filter on heap rows.    |
| user + sourceType                        | `card_user_status_idx` then filter  | No index on `(user_id, source_type)` -- filter on heap rows.  |
| user + search (`ilike '%q%'`)            | `card_user_status_idx` then filter  | Leading wildcard -- cannot use B-tree. See 1.Minor.Browse-search. |
| user + `ORDER BY updated_at DESC LIMIT`  | None matches; sort after filter     | No `(user_id, updated_at)` index. See 1.Minor.Browse-order.   |

At 1k cards these are all sub-10ms even without matching indexes. Flagged below for the 10k+ horizon.

### 1c. Review queue load (`/memory/review`)

**Files:** `apps/study/src/routes/(app)/memory/review/+page.server.ts`, `libs/bc/study/src/cards.ts:188-203`.

`getDueCards` predicates: `cardState.userId = ? AND cardState.dueAt <= now AND card.status = 'active'`, `ORDER BY dueAt ASC LIMIT 20`.

Plan: seek `card_state_user_due_idx (user_id, due_at)` starting from the lower-bound user key, scan ascending while `due_at <= now`, nested-loop probe into `card` PK for the status filter. `LIMIT 20` stops the seek early. Expected 1-2 ms at any realistic user deck size.

**Observation:** `card.status` is not in the composite index, so every row the seek returns must do a heap fetch on `card` to check `status`. For a learner with 1000 due cards and 950 archived (unlikely but possible), the seek may have to probe many heap rows before collecting 20 active ones. Not a problem in the spec window; at scale, consider a partial index `(user_id, due_at) WHERE status = 'active'` or adding `status` to the composite.

### 1d. Card detail load (`/memory/[id]`)

**Files:** `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:25-54`.

Two queries run **sequentially**:

```typescript
const found = await getCard(params.id, user.id);               // query 1
...
const recentReviews = await db.select(...).from(review).where(eq(review.cardId, params.id)).orderBy(desc(review.reviewedAt)).limit(10); // query 2
```

Both are independent once `params.id` and `user.id` are known. The sequential await adds one avoidable round-trip. See 2.Major.Card-detail-serial.

Query 2 uses `review_card_reviewed_idx (card_id, reviewed_at)` -- correct index, direction matches `ORDER BY reviewedAt DESC`, `LIMIT 10` bounds work. ~1 ms.

Query 1 is `getCard`: PK lookup on `card.id` + join to `card_state` PK. Sub-millisecond.

## 2. Findings

### [Major] Card detail page runs `getCard` and `recentReviews` sequentially

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:29-47`.

**Issue:** Two DB round-trips run in series when they could run concurrently. Both are keyed on `params.id` which is known at function entry; neither depends on the other's output.

**Impact:** One extra round-trip of network latency per card-detail view. ~5-15 ms on a local pool, 30-100 ms over a WAN link, 200+ ms on a cross-region hop. The card detail page is the main editing surface; every rating tweak, status change, and "review again" bounce passes through it.

**Fix:**

```typescript
const [found, recentReviews] = await Promise.all([
  getCard(params.id, user.id),
  db
    .select({ id: review.id, rating: review.rating, /* ... */ })
    .from(review)
    .where(and(eq(review.cardId, params.id), eq(review.userId, user.id)))
    .orderBy(desc(review.reviewedAt))
    .limit(10),
]);
if (!found) error(404, { message: 'Card not found' });
```

Also note: the existing query filters only by `cardId`. Add `eq(review.userId, user.id)` as defense-in-depth so a card owned by user A can't leak user B's reviews if the card FK ever permits it. Functionally equivalent today (cards are 1:1 with a user), but future-proofs if shared cards ever land. This also makes the planner consider `review_user_reviewed_idx` as an alternative path, which is harmless.

### [Major] `hooks.server.ts` runs a full better-auth session lookup on every request

**File:** `apps/study/src/hooks.server.ts:52-88`.

**Issue:** Every non-auth request calls `auth.api.getSession({ headers })`, which under the better-auth Drizzle adapter does (at minimum) a `SELECT` against `bauth_session` by cookie token, plus a `SELECT` against `bauth_user` to hydrate the user row. On a typical dashboard render, this is 2 extra round-trips + adapter overhead *before* the page load function's own queries start.

**Impact:**

- Adds ~5-15 ms per request on a warm local pool, ~30-60 ms on a WAN-hop production db.
- Budget accounting for dashboard: auth (~10 ms) + layout load (~0) + `getDashboardStats` parallel fan-out (~10 ms) + SvelteKit render (~20 ms) + network (~20 ms each way) = ~80 ms. In the spec window. Tight once you're over a cold pool or a distant region.
- The compounding concern: *every* browse page, card detail, and review submit eats the same cost. Dashboards feel snappy; the app between renders does not.

**Fix options (in order of preference):**

1. **better-auth cookieCache.** better-auth supports a signed-cookie cache that elides the DB round-trip while the session cookie is still valid:
   ```typescript
   session: {
     modelName: 'bauth_session',
     cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 min
   }
   ```
   Trade-off: banned-user revocations take up to `maxAge` seconds to propagate. Acceptable given `hooks.server.ts:90` already handles banned users and the revocation path is a sign-out button (which clears the cookie immediately).

2. **Per-request memoization in `event.locals`.** Today the hook does one `getSession`; any downstream load that wants the session reuses `locals.user`. That is already correct -- no change needed there. The hit is the one unavoidable round-trip per request.

3. **Skip session lookup for truly public paths.** `/login`, `/healthz`, static assets served by the handler. The current code only bypasses `/api/auth/*`. A small wildcard list would help for public-facing routes.

**Recommendation:** Enable `cookieCache`. This is the single biggest lever on end-to-end page TTFB across the app and costs ~5 lines of config.

### [Minor] Review flow payload: 20 cards, 10 KB front + 10 KB back each = 400 KB page data

**File:** `apps/study/src/routes/(app)/memory/review/+page.server.ts:40-60`.

**Issue:** The review load pushes 20 cards (the `REVIEW_BATCH_SIZE`) into the SvelteKit `data` payload in one go: each card has `front` and `back` text fields each capped at 10,000 chars. Worst case 20 * 2 * 10,000 = 400,000 chars of text in the initial HTML payload. Median case with a few-hundred-char cards: ~8-15 KB -- totally fine.

**Impact:**

- Worst-case SSR HTML size bloats to ~400 KB + markup overhead, delaying TTFB proportionally (1 MB/s mobile = 400 ms alone).
- `shorten()` truncation applies only to browse; review shows full text.
- Unlikely in practice; no user writes 10 KB flashcards. Still a spec-level edge case worth flagging.

**Fix:** Defer. Either enforce a lower soft cap (e.g. 2,000 chars) in `cardTextSchema` once the product rationale is clearer, or chunk the review batch (first 5 in initial load, rest streamed). Not worth doing pre-scale. Document.

### [Minor] Browse filter on `card_type` / `source_type` has no matching index

**File:** `libs/bc/study/src/cards.ts:220-221`. Carry-over from Phase 2 -- still unresolved.

**Issue:** `card_user_status_idx`, `card_user_domain_idx`, `card_user_created_idx` exist. Filters on `card_type` or `source_type` with any user will fall back to `card_user_status_idx` and then filter rows on heap.

**Impact:** At 1k cards: negligible. At 10k+: a growing fraction of heap fetches per query. Latency grows linearly with per-user deck size.

**Fix:** Add `(user_id, card_type)` and `(user_id, source_type)` composite indexes when either filter becomes frequently used. Alternatively, one composite `(user_id, status, card_type, source_type, domain)` if the query mix justifies it. Not blocking; watch usage.

### [Minor] Browse default sort is `updated_at DESC` with no matching index

**File:** `libs/bc/study/src/cards.ts:234`. Carry-over from Phase 2 -- still unresolved.

**Issue:** The three existing card indexes have `user_id` leading but no `updated_at` -- the default ordering cannot seek the index. Planner will filter by `user_id` via one of the composites and then sort `updated_at` in memory.

**Impact:** 1k cards: ~2 ms sort. 10k cards: ~20-50 ms sort per page load, and `LIMIT` cannot short-circuit without an index.

**Fix:** Add `card_user_updated_idx (user_id, updated_at)`. Or switch the default order to `created_at DESC` which has an existing index. Since the browse page is the main deck-management surface for power users, the index is the better choice.

### [Minor] Browse search uses `ilike '%q%'` -- full-table scan per user

**File:** `libs/bc/study/src/cards.ts:222-226`. Carry-over from Phase 2.

**Issue:** Leading-wildcard `ilike` cannot use a B-tree index. Postgres scans every per-user row and evaluates the pattern on `front` and `back` (up to 20 KB of text per row).

**Impact:** At 1k cards with small text: 5-15 ms. At 10k cards with 10 KB text: 200-500 ms per keystroke-driven search. Users typing into the search box will feel the lag.

**Fix:** When the feature lands for real, either:

- Add `pg_trgm` GIN index on `(front || ' ' || back)` -- best ilike substring performance.
- Add a `tsvector` generated column + GIN index -- better ranking, different semantics (word boundaries).

Keep substring search scoped by `user_id` so blast radius is bounded per user. Not blocking spec target; flag as known future index.

### [Minor] `getDueCards` and `getDashboardStats.dueNow` probe `card.status` on the heap

**Files:** `libs/bc/study/src/cards.ts:188-203`, `stats.ts:107-112`.

**Issue:** The `(user_id, due_at)` index on `card_state` does not know about `card.status`. For each row the index returns, the planner probes the `card` PK and filters on `status = 'active'`. Rows with non-active status waste a heap fetch.

**Impact:** Fine for typical decks where ~95% of cards are active. Pathological if a learner aggressively archives cards and the archived ones cluster at earlier due_at values (they typically won't, because archived cards stop scheduling). Empirically sub-millisecond.

**Fix:** Optional partial index `CREATE INDEX card_state_active_due_idx ON card_state (user_id, due_at) WHERE ... `. Can't easily express because the `status` column lives on `card`, not `card_state`. Alternative: denormalize `status` onto `card_state` and maintain on status change -- overkill. Defer; trust the planner at current scale.

### [Minor] `computeStreakDays` pulls up to 366 distinct-day rows per dashboard load

**File:** `libs/bc/study/src/stats.ts:67-94`. Carry-over from Phase 2.

**Issue:** Returns one row per distinct UTC day with a review. A daily reviewer produces 365 rows of `{ day: string }`. The work to transfer and walk 365 rows client-side is small but non-zero, and the distinct aggregation has to evaluate `date_trunc('day', reviewed_at at time zone 'UTC')` over every qualifying review row.

**Impact:** 365 days * 20 reviews/day = 7,300 reviews scanned, 365 rows back. ~3-8 ms. Zero issue at current scale. Only a concern if a learner rides 3+ years of daily reviews (say, 20k+ rows in the window).

**Fix:** Defer until it profiles as a hotspot. When it does, collapse to a single-row SQL answer via a recursive CTE or `generate_series + NOT EXISTS`. Current code is correct.

### [Minor] `submitReview` uses SELECT FOR UPDATE inside a four-statement transaction on a hot path

**File:** `libs/bc/study/src/reviews.ts:62-143`.

**Issue:** Every rating submission:
1. `SELECT card + card_state ... FOR UPDATE`
2. `SELECT review ... WHERE reviewedAt >= windowStart ORDER BY reviewedAt DESC LIMIT 1` (dedupe check)
3. `INSERT review`
4. `UPDATE card_state`

All four statements inside one transaction. Row-level lock held on `card_state` until commit.

**Is the FOR UPDATE acceptable?** Yes, with caveats:

- **Concurrency scope:** the lock is per `(card_id, user_id)`. A single user submitting the same card twice is the only contention scenario. Double-clicks, back-button reposts, Enter-spam -- all legitimate and exactly what the dedupe window is for.
- **Hold time:** four statements + FSRS math. ~5-15 ms locally, ~30-60 ms over WAN. Short enough that queuing a second submit behind the first is invisible (the second will find the recent review and return idempotently).
- **Pool pressure:** `DB_POOL_SIZE = 10`. If 10 learners double-submit simultaneously, the 11th's whole request blocks on pool. With 1 user today, zero concern.

**Fix:** Not needed at current scale. Two future considerations worth documenting:

1. At multi-user scale, if the pool gets saturated by active review sessions, reduce the transaction footprint -- e.g. pre-compute FSRS outside the tx and run a single `INSERT + UPDATE` via CTE. Pros: shorter lock hold. Cons: the FOR UPDATE still matters for the dedupe read-lock invariant.

2. Consider a unique constraint on `(card_id, user_id, reviewed_at)` rounded to the second to enforce idempotency at the DB layer, freeing the dedupe check from the transaction read path. Changes error shape; not trivial.

**Recommendation:** Ship as-is; flag in `TEMP_FIXES.md` or the review roadmap if the app grows multi-learner.

### [Minor] `createCard` runs 2 inserts in a transaction; no batching opportunity today

**File:** `libs/bc/study/src/cards.ts:73-128`.

**Issue:** Transaction with `INSERT card` + `INSERT card_state` -- correct. At ~20 ms per tx locally. Worth noting: for bulk-import (course content, CSV import) this becomes `n * 20 ms` -- 20 cards = 400 ms; 200 cards = 4 seconds.

**Fix:** When bulk import lands, the BC should expose a `createCards(inputs[])` that does one tx, one batched `INSERT card`, one batched `INSERT card_state`. Not needed for current single-card UX.

### [Nit] Dashboard `reviewedToday` uses `todayStart` as UTC midnight

**File:** `libs/bc/study/src/stats.ts:102, 60-62`.

**Issue:** `utcStartOfDay(now)` uses UTC. For learners in PT (UTC-7/8), the "day" boundary shifts at 4 pm local; a 6 pm review counts toward the next day's "reviewed today" on the dashboard.

**Impact:** Not a perf finding -- a UX/correctness one. Leaving here because it's visible in the dashboard payload and will surface as user confusion.

**Fix:** Accept a user timezone on the query. Out of scope for this review.

### [Nit] `getDueCards` over-fetches: card row contains front/back (up to 20 KB) but queue UI only shows current card

**File:** `apps/study/src/routes/(app)/memory/review/+page.server.ts:41-55`.

**Issue:** The server load selects all 20 due cards with full `front` and `back` text, then the UI displays them one at a time. Median: fine. Pathological (20 * 20 KB = 400 KB): see earlier finding.

**Fix:** Overlaps with the review-payload nit above. Optional: fetch only card IDs upfront, lazy-load front/back as the learner advances. Adds complexity for a non-problem today.

### [Nit] `getDomainBreakdown` -- `ORDER BY card.domain` lexicographic

**File:** `libs/bc/study/src/stats.ts:165`. Carry-over from Phase 2.

**Issue:** Sorts 14 domain groups by text. Zero perf impact; 14-row sort is free.

**Fix:** Optional: sort client-side in a canonical order (e.g. `DOMAIN_VALUES` order) for consistent UI. Cosmetic.

### [Nit] Raw SQL interpolates `now.toISOString()` into `sum(case when ... then 1 else 0 end)`

**File:** `libs/bc/study/src/stats.ts:158, 195`. Carry-over from Phase 2.

**Issue:** Drizzle's `sql` tag binds the ISO string as a `text` parameter, requiring a cast to `timestamptz`. Works; slightly wasteful vs a `timestamptz` bind.

**Fix:** Use `sql.placeholder` or restructure to put `now` comparison in the `WHERE` clause. Cosmetic.

## 3. Index coverage audit

Current indexes (from `libs/bc/study/src/schema.ts`):

| Table      | Index                             | Columns              | Primary consumer                          |
| ---------- | --------------------------------- | -------------------- | ----------------------------------------- |
| card       | `card_user_status_idx`            | (user_id, status)    | Dashboard stateCounts, domain breakdown   |
| card       | `card_user_domain_idx`            | (user_id, domain)    | Browse filter-by-domain                   |
| card       | `card_user_created_idx`           | (user_id, created_at)| (Not currently used by queries reviewed)  |
| review     | `review_card_reviewed_idx`        | (card_id, reviewed_at)| Card detail recent reviews, submitReview dedupe |
| review     | `review_user_reviewed_idx`        | (user_id, reviewed_at)| Dashboard reviewedToday, streak, review stats |
| card_state | PK                                | (card_id, user_id)   | getCard join, submitReview update         |
| card_state | `card_state_user_due_idx`         | (user_id, due_at)    | getDueCards, dashboard dueNow             |

### Queries that still table-scan or sort without index

| Query                                    | Missing index                              | Current impact |
| ---------------------------------------- | ------------------------------------------ | -------------- |
| Browse default ORDER BY updated_at       | `(user_id, updated_at)`                    | Sort in memory; 1k rows = fine, 10k = noticeable |
| Browse ilike '%q%'                       | `pg_trgm` GIN on front/back                | Scan per user; 1k = fine, 10k = slow |
| Browse filter by card_type               | `(user_id, card_type)`                     | Heap re-filter; 1k = fine          |
| Browse filter by source_type             | `(user_id, source_type)`                   | Heap re-filter; 1k = fine          |
| `getMasteredCount` stability > threshold | `(user_id, stability)` on card_state       | Bounded per user via PK; 1k = fine |

**`card_user_created_idx` is currently unused** by any query in this branch. `getCards` orders by `updated_at`, not `created_at`. Worth either (a) dropping it to save write cost or (b) switching `getCards` default ordering to `created_at DESC` to use it. My read: keep the index if you expect a "show by creation date" UI soon; otherwise drop and add `(user_id, updated_at)` instead.

### Recommended Phase 5 index work

1. **`card_user_updated_idx (user_id, updated_at)`** -- fixes browse sort at scale. Low cost.
2. **`pg_trgm` extension + GIN on `(front || ' ' || back)` for card** -- only when search usage justifies it. Extension add is a one-time ops task.
3. Everything else: wait for real usage data.

## 4. Connection-pool behavior under concurrent users

**Pool size:** `DB_POOL_SIZE = 10` (default, overridable via env).

**Dashboard under `Promise.all`:** The 5 parallel queries each check out a pooled connection. A single dashboard load can momentarily occupy 5 connections. If 3 users load the dashboard simultaneously, that's 15 connection-checkouts against a pool of 10 -- some queries will queue waiting for a connection.

**Impact at spec target (1 user):** Zero. The pool has 9 idle connections to spare.

**Impact at 3-5 concurrent users:** Queries at the tail of the `Promise.all` may wait 10-30 ms for a free connection. Still well under budget.

**Impact at 10+ concurrent users loading dashboards:** Pool saturation. Queries queue. Dashboard TTFB climbs above 200 ms for the tail.

**Recommendation:** No action yet. If/when multi-learner traffic materializes:

- Bump `DB_POOL_SIZE` to 20-30 (remember each app instance has its own pool; coordinate with Postgres `max_connections`).
- Consider a lighter dashboard variant that issues 1 or 2 aggregated queries instead of 5 parallel ones -- trades query complexity for connection-pool footprint. A single CTE can compute all five metrics in one round-trip and one connection.

## 5. Other observations

### `hooks.server.ts` timing log

`hooks.server.ts:108-113` logs `{ method, path, status, ms }` per request. Good for measuring the very things this review is about. No findings -- callout only.

### SSR payload: dashboard

Dashboard data shape: `{ dueNow, reviewedToday, streakDays, stateCounts (4 ints), domains (<=14 rows of 3 ints + slug) }`. Total serialized size: ~500 bytes. Zero concern.

### SSR payload: browse

`cards` array: up to 26 cards (PAGE_SIZE + 1 for hasMore probe), each including full `front`/`back` text. Median case ~2-5 KB. Worst case 26 * 20 KB = 520 KB. Same pathological concern as review. See 2.Minor.Review-payload.

### Smoke scripts

`scripts/smoke/study-bc.ts` exists (114 lines) -- a good place to add perf-assertion queries (e.g. "dashboard returns < 100 ms with N seeded cards"). Not in scope to require, just noting the hook point.

## 6. Headline recommendations

In order of leverage:

1. **Enable better-auth `cookieCache`** in `libs/auth/src/server.ts`. Shaves ~5-15 ms off *every* authenticated request in the app. Lowest-effort, highest-impact change. (2.Major.Auth-session)

2. **Parallelize `/memory/[id]` load** with `Promise.all`. Removes one round-trip from the second-most-frequent authenticated page view. (2.Major.Card-detail-serial)

3. Before shipping multi-user: add `card_user_updated_idx` and resolve the review-batch payload cap. Both have concrete user-visible latency at scale.

4. Everything else is defer-until-profiled.

## 7. Clean

- `getCard` -- PK lookup + composite-PK join + LIMIT 1. Optimal.
- `getDueCards` -- index direction matches ORDER BY, LIMIT bounds work, no cross-user leakage.
- `getDashboardStats` -- Promise.all landed correctly. 5 queries, 1 wall-clock round-trip.
- `submitReview` -- FOR UPDATE scope is correct; dedupe check lives inside the same tx as the insert.
- `createCard` -- initial FSRS state computed in JS (pure), two inserts in tx -- no read-modify-write hazards.
- `setCardStatus` -- single UPDATE with RETURNING.
- `updateCard` -- explicit editability check. Could be collapsed, but clarity wins.
- `getDueCardCount`, `getMasteredCount`, `getReviewStats` -- bounded per user, short queries.
- Transaction boundaries everywhere: tight, no I/O-outside-tx patterns, no long-held locks.
- Route load functions: no N+1 patterns; one DB call set per route.
- Constants inlined as integer literals in `sql` templates avoid per-query plan cache thrash.
