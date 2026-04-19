---
title: 'Phase 2 Performance Review: spaced-memory-items'
date: 2026-04-19
phase: 2
category: perf
---

# Phase 2 Performance Review

Scope: BC-layer queries added in commit `0bbde26` (libs/bc/study/src/cards.ts, reviews.ts, stats.ts). Target from spec: "dashboard loads in < 200ms with 1,000 cards."

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 1     |
| Minor    | 6     |
| Nit      | 3     |

## Findings

### [Major] getDashboardStats runs 5 DB round-trips sequentially

**File:** libs/bc/study/src/stats.ts:97-143
**Issue:** `getDashboardStats` issues 5 independent queries in strict sequence: `dueNow`, `reviewedToday`, `stateCounts`, `getDomainBreakdown` (internally 1 query), `computeStreakDays` (internally 1 query). None depend on the output of another -- each is driven purely by `userId` and `now`. The function awaits each before starting the next.
**Impact:** At 1,000 cards with a local Postgres and warm pool, each query likely lands in 5-15 ms, so 5 serial queries + network = 50-100 ms of pure round-trip latency. That is already half the 200 ms budget, before any SvelteKit load + render overhead. With a heavier user (stale pool, more review history, or any WAN hop), this is the single biggest contributor to dashboard TTFB.
**Fix:** Run the five independent queries under `Promise.all`:

```typescript
const [dueNowRow, reviewedTodayRow, stateRows, domains, streakDays] = await Promise.all([
  db.select(...).from(cardState)...,
  db.select(...).from(review)...,
  db.select(...).from(cardState)...groupBy(cardState.state),
  getDomainBreakdown(userId, db, now),
  computeStreakDays(userId, db, now),
]);
```

Drizzle's pooled connection handles concurrent queries fine, and this collapses 5 serial round-trips to 1 wall-clock round-trip. Expected improvement: 40-80 ms off dashboard TTFB.

### [Minor] getCardMastery unnecessarily joins review -> card when no domain filter

**File:** libs/bc/study/src/stats.ts:197-204
**Issue:** The accuracy sub-query always `innerJoin`s `card` onto `review`, even when `domain` is undefined. When no domain is given, the join is pure overhead -- the query could run against `review` alone using `review_user_reviewed_idx`.
**Impact:** At 1,000 cards / several thousand reviews, PG still picks up the index but adds a nested-loop join to `card` PK per review row. Small but compounds at scale; unnecessary work for the common "overall accuracy" call path.
**Fix:** Make the join conditional:

```typescript
const accuracyQuery = db
  .select({ total: count(), correct: sql<number>`sum(case when ${review.rating} > ${REVIEW_RATINGS.AGAIN} then 1 else 0 end)` })
  .from(review);
if (domain) {
  accuracyQuery.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)));
  accuracyClauses.push(eq(card.domain, domain));
}
accuracyQuery.where(and(...accuracyClauses));
```

Also consider running the totals query and the accuracy query via `Promise.all` -- they are independent.

### [Minor] getCardMastery runs totals + accuracy sequentially

**File:** libs/bc/study/src/stats.ts:182-204
**Issue:** Two independent aggregate queries awaited one after the other.
**Impact:** Same shape as the dashboard finding -- one extra round-trip of latency for callers hitting this per page load.
**Fix:** `Promise.all([totalsQuery, accuracyQuery])`.

### [Minor] Browse default sort is (user_id, updated_at DESC) with no matching index

**File:** libs/bc/study/src/cards.ts:199-208
**Issue:** `getCards` orders by `card.updatedAt DESC`. The three indexes on `card` are `(user_id, status)`, `(user_id, domain)`, `(user_id, created_at)`. There is no `(user_id, updated_at)`. Postgres will use `card_user_status_idx` for the WHERE and then do an in-memory sort on `updated_at`.
**Impact:** At 1,000 cards per user, the sort is trivial (< 5 ms). At 10k+ cards -- realistic for a long-term learner building a personal deck -- this becomes a work-mem sort over the entire filtered result set every page load, and `LIMIT` cannot stop the sort early without an index.
**Fix:** Phase 3: add `card_user_updated_idx` on `(user_id, updated_at)`. Non-blocking for Phase 2. Alternatively, switch browse default ordering to `created_at DESC` which has a matching index today.

### [Minor] Browse search uses ilike '%x%' -- forced full-table scan per user

**File:** libs/bc/study/src/cards.ts:191-197
**Issue:** `ilike(card.front, '%x%')` with a leading wildcard cannot use a B-tree index; PG must scan every card row for the user and evaluate the pattern.
**Impact:** At 1,000 cards acceptable. At 10k+ or if global search becomes a hot path, this is a problem. For now, always scoped by `user_id` via the other clauses so blast radius is bounded per user.
**Fix:** Not in scope for Phase 2. Flag for Phase 3: either a `pg_trgm` GIN index on `front || ' ' || back`, or a separate `tsvector` column with a GIN index for real full-text search. Document as a known future index.

### [Minor] Streak computation has to parse every distinct-day row client-side

**File:** libs/bc/study/src/stats.ts:67-94
**Issue:** The streak walker pulls every distinct review day in the last 366 days, then walks them client-side. Works, but the whole streak can be computed purely in SQL with `generate_series` / `lag` / a recursive CTE.
**Impact:** For a daily reviewer with 365 rows, transfer is trivial. Correctness is fine. Main concern is that the query cannot be served from any index -- `date_trunc('day', reviewed_at at time zone 'UTC')` forces a scan of `review_user_reviewed_idx` (which is fine because it's bounded by the user and the 366-day window, not by `distinct`). No immediate action needed.
**Fix:** Defer. If streak becomes a dashboard hotspot in practice (profile shows it dominates), push the walk into SQL so only a single integer returns.

### [Minor] submitReview idempotency SELECT touches review_user_reviewed_idx (not ideal)

**File:** libs/bc/study/src/reviews.ts:46-52
**Issue:** The dedupe query filters by `(cardId, userId, reviewedAt >= windowStart)` and orders by `reviewedAt DESC LIMIT 1`. The available index `review_card_reviewed_idx` is `(card_id, reviewed_at)`. That covers the predicate perfectly; the planner should pick it. Worth verifying with `EXPLAIN` post-migration since `user_id` is an additional equality filter the index does not cover (it will recheck on heap).
**Impact:** At realistic review rates the index scan on `(card_id, reviewed_at)` is near-instant. Flagged only because the code shape makes it non-obvious which index services it.
**Fix:** None needed. Optional: add a test asserting the chosen plan if you want to catch regressions (e.g. a drop of `review_card_reviewed_idx`).

### [Nit] Raw SQL embeds `now.toISOString()` instead of a bound parameter

**File:** libs/bc/study/src/stats.ts:155, 185
**Issue:** `sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)` interpolates the ISO string as a literal into the SQL text (Drizzle's `sql` tag does bind it, but as `text`, requiring an implicit cast to `timestamptz`).
**Impact:** Trivial. Postgres casts the string. But if the planner ever fails to see the value as a `timestamptz` constant, it could miss index opportunities (not applicable here since this is an aggregate expression, not a range predicate).
**Fix:** Use the drizzle `lte(cardState.dueAt, now)` style or `sql.placeholder`. Cosmetic.

### [Nit] `ORDER BY card.domain` on getDomainBreakdown

**File:** libs/bc/study/src/stats.ts:162
**Issue:** The final sort is by `card.domain` text. Only 14 possible domain values and group output is at most 14 rows. Not a real issue.
**Impact:** Zero measurable impact.
**Fix:** Optional: sort client-side by a canonical domain order (e.g. the order in `DOMAIN_VALUES`) for deterministic UI. Not a perf concern.

### [Nit] getDueCards join condition is (card_id AND user_id) -- verify planner uses card_state_user_due_idx

**File:** libs/bc/study/src/cards.ts:164-170
**Issue:** The join predicates `card.id = cardState.cardId AND card.userId = cardState.userId`. Both `card_state` PK (`card_id, user_id`) and `card_state_user_due_idx` (`user_id, due_at`) are candidates. The planner should pick the due index since the outer predicate filters `cardState.userId + cardState.dueAt`.
**Impact:** None observed; just a callout to verify the intended plan under load. At 1,000 cards with 20 due, this is sub-millisecond.
**Fix:** Add an `EXPLAIN` smoke test or document the expected plan.

## Missing indexes (queued for Phase 3)

| Index                            | Query that wants it                    | Trigger scale        |
| -------------------------------- | -------------------------------------- | -------------------- |
| `card (user_id, updated_at)`     | `getCards` default ordering            | > 5k cards / user    |
| `card (user_id, source_type)`    | Browse filter by source                | > 5k cards / user    |
| `card (user_id, card_type)`      | Browse filter by card_type             | > 5k cards / user    |
| `pg_trgm` / `tsvector` on front/back | `getCards` ilike search            | > 5k cards / user    |
| `GIN` on `card.tags`             | Tag-based browse (not yet in UI)       | When tag UI ships    |

None block Phase 2 shipping. Add when the UI actually drives those query shapes and we can validate via explain plans.

## Clean

- `getDueCards` (cards.ts:158-173): uses `card_state_user_due_idx`, ORDER BY matches index direction, LIMIT bounds work. Correctly avoids cross-user leakage by filtering `cardState.userId` before the join.
- `getCard` (cards.ts:141-151): PK lookup on `card.id`, composite join to `card_state` PK, bounded by `LIMIT 1`. Optimal.
- `createCard` (cards.ts:64-108): two inserts inside a transaction, no read-modify-write pattern, no locking concern.
- `updateCard` (cards.ts:114-138): one SELECT for authorization, one UPDATE. Could be collapsed to an UPDATE with a RETURNING + status CHECK, but the explicit SELECT makes the editable check cleaner. No perf concern at Phase 2 scale.
- `setCardStatus` (cards.ts:212-225): single UPDATE with RETURNING, minimal work.
- `submitReview` (reviews.ts:40-122): transaction scope is tight (all four statements in < 50 ms). Idempotency check uses index-friendly predicates. No SELECT FOR UPDATE needed because the unique writer is the same user and concurrency on a single `(card, user)` pair is bounded.
- `getDueCardCount` (stats.ts:255-262): same index path as `getDueCards` without the outer projection; cheap.
- `getMasteredCount` (stats.ts:265-278): range filter on `stability` is non-indexed, but bounded per user by `card_state.user_id` equality (via the PK on `card_state`). Fine at 1-10k cards.
- `getReviewStats` (stats.ts:219-252): groupBy rating uses `review_user_reviewed_idx` for the WHERE, then in-memory groups 4 ratings. Trivial.
- `getDomainBreakdown` (stats.ts:146-170): aggregate over per-user cards (<= 10k rows), group into 14 domains. Fine.
- Connection pool behavior: transactions are short (<50 ms for submitReview). Default pool size 10 is adequate for Phase 2 single-learner traffic.
- `MASTERY_STABILITY_DAYS` and `REVIEW_RATINGS.AGAIN` are inlined integer constants in the `sql` templates -- no bind-parameter plan cache thrash.

## Headline recommendation

Parallelize the five dashboard queries with `Promise.all` (Major finding). This single change likely cuts dashboard TTFB by 40-80 ms and is the only item worth doing in Phase 2. Everything else is deferrable to Phase 3 when UI-driven query shapes and real user data justify the work.
