---
title: 'Phase 2 Correctness Review: spaced-memory-items'
date: 2026-04-19
phase: 2
category: correctness
branch: build/spaced-memory-items
commit: 0bbde26
reviewer: correctness
---

# Phase 2 Correctness Review

Scope: HEAD (`0bbde26`) vs HEAD~1 (`e97d759`). Phase 2 adds:

- `libs/bc/study/src/cards.ts` -- `createCard`, `updateCard`, `getCard`, `getDueCards`, `getCards`, `setCardStatus`.
- `libs/bc/study/src/reviews.ts` -- `submitReview` with transaction + 5-second idempotency guard.
- `libs/bc/study/src/stats.ts` -- `getDashboardStats`, `getDomainBreakdown`, `getCardMastery`, `getReviewStats`, `getDueCardCount`, `getMasteredCount`.
- `libs/bc/study/src/index.ts` -- barrel export.
- `scripts/smoke/study-bc.ts` -- manual smoke test (not automated).

This review checks logical correctness against the work-package spec, design,
the ts-fsrs 5.x source, and Drizzle runtime behavior.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 2     |
| Minor    | 6     |
| Nit      | 4     |

Overall: Phase 2 is structurally sound and the happy-path smoke test exercises
the main contract end-to-end. The two `[MAJOR]` findings both affect data
correctness under real usage -- the FSRS `last_review: null` call produces a
garbage `elapsed_days` on every non-first review, and there is no automated
test coverage for transaction, idempotency, or FSRS integration. Neither blocks
the smoke test (Phase 3 will find them once the review flow runs against an
overdue card), but both should be fixed before Phase 3 consumes the BC.

## Findings

### [MAJOR] `submitReview` passes `last_review: null` to FSRS, producing incorrect `elapsed_days` for every non-first review

**File:** `libs/bc/study/src/reviews.ts:72`

**Issue:** The code passes `lastReview: null` into `fsrsSchedule`, with a
comment claiming "ts-fsrs uses `dueAt - scheduledDays` internally; pass null
here." That is not what ts-fsrs 5.x does. In `node_modules/ts-fsrs/dist/index.mjs`
around line 344:

```typescript
init() {
    const { state, last_review } = this.current;
    let interval = 0;
    if (state !== State.New && last_review) {
      interval = dateDiffInDays(last_review, this.review_time);
    }
    this.current.last_review = this.review_time;
    this.elapsed_days = interval;
    ...
}
```

When `last_review` is `null`, `interval` stays `0`, and `this.elapsed_days`
(which is returned as `result.log.elapsed_days` and persisted to
`review.elapsed_days`) is `0` for every rating after the first one.

**Impact:** The `review.elapsed_days` column is wrong for all but the first
review of each card. This column is the audit trail of how overdue the card
actually was, and it feeds future FSRS parameter optimization (mentioned as
"collecting data from day one" in design.md). Polluting it with zeros from day
one silently corrupts the dataset the design explicitly calls out as valuable.
The FSRS stability/difficulty calculation itself still works because ts-fsrs
uses `state.stability` and the card's `due` field to drive its internal
scheduling -- so the card scheduling is not broken today. But the recorded
`elapsed_days` is wrong.

**Fix:** Look up the previous review's `reviewedAt` before calling
`fsrsSchedule` and pass it as `lastReview`. Two reasonable ways:

1. Read `cardState.lastReviewId`, fetch that review's `reviewedAt` (another
   `SELECT` inside the same transaction).
2. Add a `lastReviewedAt` timestamptz column to `card_state`, populate it
   from the review insert (one-line schema tweak, avoids the extra `SELECT`).

Option 2 is structurally cleaner; `card_state` already materializes other
derived values. Either way, the comment at `reviews.ts:72` is wrong and
should be deleted.

### [MAJOR] No automated test coverage for `cards.ts`, `reviews.ts`, or `stats.ts`

**File:** `libs/bc/study/src/` (absence)

**Issue:** Phase 1 shipped `srs.test.ts` (9 passing specs). Phase 2 ships
~625 lines of BC logic with no vitest/integration tests. The smoke script
(`scripts/smoke/study-bc.ts`) is not registered with `bun test`, and its only
assertion is "doesn't throw." It exercises a single happy path with hardcoded
content.

**Impact:** The idempotency window, transaction boundary, and FSRS -> state
upsert are the highest-risk pieces of the whole feature -- a rapid double-click
on the review button, a partial DB failure, or a state type mismatch will cost
data integrity silently. None of those cases is exercised today. Phase 3 (route
layer) will consume this BC and inherit any latent bugs.

**Fix:** Before Phase 3 starts consuming these functions, add:

- `reviews.test.ts` with a pg-lite or testcontainers harness: idempotency inside
  window returns the same row; outside window inserts new; transaction rolls
  back on FSRS error; lapseCount bump on Review -> Relearning; reviewCount bump.
- `cards.test.ts`: `isEditable` default based on `sourceType`; `updateCard`
  refuses non-editable; `getCards` search escapes `%`/`_`/`\`; status filter
  default excludes archived only.
- `stats.test.ts`: streak -- today present, today absent, gap in middle,
  single day; `ratingDistribution` shape; domain breakdown aggregation; mastery
  threshold strict `>` vs `>=`.

If a Postgres-backed test harness is not yet set up, a narrow vitest suite
using the `.in-memory` pg-mem package covers most of the branches without
docker. The idempotency path in particular is a one-file test.

### [MINOR] `getCardMastery` accuracy denominator is inconsistent with numerator scope

**File:** `libs/bc/study/src/stats.ts:192-208`

**Issue:** The `total/due/mastered` query filters to `card.status = ACTIVE`.
The `accuracy` query does **not** filter on status -- it counts all reviews
whose cards the user still owns, including reviews of archived or suspended
cards.

**Impact:** When a user archives a card they struggled with, the archive does
not remove those historical "again" ratings from the accuracy calculation, even
though the card is no longer visible in any other metric. A user who archives
their 10 worst cards will see their accuracy stay the same but their `total`
drop. Mismatched scope between numerator and denominator is a common stats
pitfall and inflates/deflates the metric in ways users won't understand.

**Fix:** Add `eq(card.status, CARD_STATUSES.ACTIVE)` to `accuracyClauses`, so
accuracy reflects the cards currently in the deck. Alternatively, be explicit
in the type: document `accuracy` as "lifetime review accuracy, including
archived cards" and keep it, but I'd argue the dashboard meaning matches the
active-only definition better.

### [MINOR] No service-layer validation for `createCard` / `updateCard` fields

**File:** `libs/bc/study/src/cards.ts:64-108, 114-138`

**Issue:** Spec Validation section requires:

- `front` / `back` trimmed, 1-10,000 chars
- `tags` max 20, each 1-100 chars
- `domain` must be in `DOMAINS`
- `card_type` must be in `CARD_TYPES`
- `source_type` must be in `CONTENT_SOURCES`

The BC validates exactly one rule: `sourceType !== PERSONAL => sourceRef
required`. Everything else is deferred to the caller (presumably zod in the
form action, Phase 3).

**Impact:** Service-layer validation is stronger than route-layer: a future
script, seed job, or cross-BC caller (e.g., a future course that imports
cards) skips the route layer and can insert garbage. Today the DB CHECK
constraints catch `cardType` / `sourceType` / `status` / `state`
enumerations, but there are no DB constraints on `front`/`back` length or on
`tags`. A script could insert a 5MB `front` string or 5,000 tags.

**Fix:** Two acceptable approaches:

1. Add a `validateCardInput(input)` helper in `cards.ts` that runs the
   spec's rules and throw on violation. `createCard` and `updateCard` both
   call it. Simple and airtight.
2. Accept the route-layer zod boundary and add DB length constraints as a
   belt-and-suspenders check: `check('card_front_length', sql\`length(front)
   between 1 and 10000\`)`, similar for back, and `check` on
   `jsonb_array_length(tags) <= 20`.

Option 1 is better because it also validates the domain/card_type string
values (which are text columns without CHECK) and tag-length rules (which
can't be expressed cleanly in a CHECK).

### [MINOR] `getDomainBreakdown` and `getCardMastery` pass `now.toISOString()` as SQL string instead of timestamptz param

**File:** `libs/bc/study/src/stats.ts:155, 185`

**Issue:** `sql<number>\`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)\`` parameterizes the ISO string as a text value. Postgres does an implicit cast from text to timestamptz for the comparison.

**Impact:** Works today because Postgres coerces ISO-8601 strings to
timestamptz cleanly. But it's the sort of thing that bites during a future
schema change (column type swap) or when running against a strict SQL mode.
Also inconsistent with the rest of the codebase, which passes `Date` objects
through `lte(cardState.dueAt, now)` and lets the Drizzle param layer handle
the type.

**Fix:** Pass `now` directly, Drizzle interpolates it as a timestamptz param:

```typescript
due: sql<number>`sum(case when ${cardState.dueAt} <= ${now} then 1 else 0 end)`,
```

Same for mastery `stability > ${MASTERY_STABILITY_DAYS}` (numeric -- fine as-is).

### [MINOR] `getCards` mutates the query builder without reassignment -- subtle and fragile

**File:** `libs/bc/study/src/cards.ts:199-208`

**Issue:** `const q = db.select()...orderBy(...)` then `if (filters.limit !==
undefined) q.limit(filters.limit)`. Drizzle's `limit()` and `offset()` do
mutate `this.config` in place AND return `this`, so this works today -- but
reading the code, a reviewer has to verify that assumption. Elsewhere in
Drizzle (e.g., `where`) the pattern requires `q = q.where(...)` reassignment.

**Impact:** Easy to break during a Drizzle upgrade or when someone refactors
this into a helper and accidentally assumes `.limit()` returns a new builder.

**Fix:** Either reassign (`let q = ...; if (limit) q = q.limit(limit);`) or
build the query as a single chained expression with a conditional. Or, cleaner:
use the `.$dynamic()` builder pattern for dynamic LIMIT/OFFSET.

### [MINOR] `getCards` search filter works but may miss the UX intent

**File:** `libs/bc/study/src/cards.ts:191-197`

**Issue:** `ilike` on `front OR back` correctly matches the spec ("Search
front/back text"). However, the spec also lists `tags` as a filter in the
"Card browsing" section ("Filter by domain, card_type, source_type, tags"),
and `CardFilters` has no `tags` field.

**Impact:** The UI in Phase 3 cannot filter by tag through this helper. Either
the UI will skip that functionality, or a route-level filter will re-implement
it against the returned rows (inefficient, breaks pagination counts).

**Fix:** Add `tags?: string[]` to `CardFilters` and implement as
`sql\`${card.tags} @> ${JSON.stringify(filters.tags)}::jsonb\`` (contains-all
semantics) or a looser `?|` (contains-any) semantics. Pick one and document it.

### [MINOR] `computeStreakDays` semantics: "streak ending today" excludes a streak that ended yesterday

**File:** `libs/bc/study/src/stats.ts:67-94`

**Issue:** The function walks backward from `today`. If the user reviewed
yesterday and a full streak of 14 days prior but not today, `streak = 0`. The
spec says "consecutive days with at least 1 review" without resolving whether
today must have a review. In most apps (Duolingo etc.), a streak is "days in a
row ending today OR yesterday" -- you don't lose the streak the moment midnight
passes.

**Impact:** The UI showing `streakDays: 0` at 00:01 after a multi-week streak
will be jarring. Users don't know they have until end-of-day to review.

**Fix:** This is a design question rather than a bug. Two options, pick one
and document the constant:

1. Current behavior: streak is "days in a row ending today." At midnight, the
   counter resets until the first review of the day. UI should show "streak at
   risk" when today has 0 reviews.
2. Grace-day behavior: streak allows today OR yesterday to be the last day.
   Walk-backward starts from `today`, and if today is missing, try `yesterday`
   as the cursor origin.

If you go with option 1 (current), add a JSDoc noting "returns 0 until today
has at least one review" so the UI layer knows it must show a distinct "streak
at risk" state.

### [MINOR] `submitReview` throws when the card is missing, but spec says "skip and advance"

**File:** `libs/bc/study/src/reviews.ts:62`

**Issue:** Spec "Edge Cases" section: "Card deleted during review session:
Skip it, advance to next. Don't crash the session." Current implementation
throws `Card ${input.cardId} not found for user ${input.userId}`.

**Impact:** The route layer must catch-and-skip, or the review session crashes
on concurrent card archival. A BC-level sentinel or distinct error class would
make the route layer's responsibility clearer.

**Fix:** Either:

1. Return `null` from `submitReview` when the card is missing; caller decides
   whether that's a skip or an error. Spec language ("Skip it, advance.")
   suggests the caller treats missing as expected, not exceptional.
2. Export a named error class (`export class CardNotFoundError extends Error
   {}`) so the route can `catch (e) { if (e instanceof CardNotFoundError)
   skipAndAdvance(); }`. Better than brittle string matching.

The spec's "skip, advance" is a Phase 3 behavior, but the BC should give the
route layer a clean signal.

### [NIT] `createCard` sets `updatedAt = now` explicitly even though the column has `defaultNow()`

**File:** `libs/bc/study/src/cards.ts:90`

**Issue:** `createdAt: now, updatedAt: now` -- both have `.defaultNow()`
defaults in the schema. Setting them explicitly is slightly redundant.

**Impact:** Negligible. Two timestamps and now are identical by construction.
If anything, it's defensive (ensures both timestamps are exactly equal, not
microsecond-off).

**Fix:** Leave it. But be aware the defaults are already handling it.

### [NIT] `CardWithState.card` field redundantly named when the wrapper is already `CardWithState`

**File:** `libs/bc/study/src/cards.ts:27-31`

**Issue:** `CardWithState` has fields `{ card: CardRow, state: CardStateRow }`.
Consumers write `result.card.front` and `result.state.stability`. The
double-`card` (`cardWithState.card`) reads slightly awkwardly.

**Impact:** Cosmetic. Flat alternative: spread both into one object with a
discriminator prefix (`cardId, cardFront, stateStability, ...`) -- uglier.
Current shape is fine.

**Fix:** None. Keep as-is.

### [NIT] Idempotency query filters on `review.userId` even though `(cardId, userId)` is implied by card ownership

**File:** `libs/bc/study/src/reviews.ts:49`

**Issue:** A given `cardId` belongs to exactly one user (card.userId FK is
unique per card). So `eq(review.cardId, input.cardId) AND eq(review.userId,
input.userId)` is slightly redundant -- the cardId alone identifies the row.

**Impact:** The userId check is a defense-in-depth safety rail: if the caller
passes a mismatched `cardId` / `userId`, the idempotency check returns empty
and the next step (`innerJoin` against `card` with both `id` and `userId`)
catches the mismatch. Leaving both in the query is good hardening, but should
be called out as intentional.

**Fix:** Add a comment: "Defense-in-depth: `userId` filter ensures a
cross-user `cardId` spoof returns no idempotency match."

### [NIT] `updateCard.set({ ...patch, updatedAt: now })` spreads a typed `UpdateCardInput`, but Drizzle's runtime uses undefined for unknown keys

**File:** `libs/bc/study/src/cards.ts:130`

**Issue:** TypeScript prevents extra keys at compile time because `patch:
UpdateCardInput` is a structural type. If a caller uses `as UpdateCardInput`
or an `any` cast, extra keys would be passed to Drizzle's `mapUpdateSet`, which
tolerates them (`new Param(value, table[Symbol.Columns][key])` -- key not in
columns yields `undefined` column metadata).

**Impact:** Not a hole in practice today. But a future refactor or a call from
a loosely typed source (e.g., a FormData object passed through without
validation) could bypass the type narrowing. The zod validation at the route
layer is the real guard.

**Fix:** Optional: destructure explicitly to be extra safe:

```typescript
const { front, back, domain, cardType, tags } = patch;
const [updated] = await db.update(card)
  .set({ front, back, domain, cardType, tags, updatedAt: new Date() })
  .where(...);
```

Slightly more verbose, but the shape is hard-coded at the call site. Combined
with Drizzle's `.filter(value !== undefined)` in `mapUpdateSet`, `undefined`
fields are dropped cleanly.

## Clean

Items reviewed and confirmed correct:

- **Transaction boundaries in `createCard` and `submitReview`** -- both wrap
  the multi-table writes in `db.transaction`, so a partial failure rolls back
  cleanly.
- **Idempotency window behavior** -- returning the existing row is the correct
  read of spec "Ignore duplicate." The caller sees the same review ID twice,
  which is the canonical way to model idempotent HTTP semantics.
- **`lapseCount` bump logic** -- `prevState === REVIEW && result.state ===
  RELEARNING` is the exact definition in the spec's `card_state` table
  description ("Times card went from review -> relearning").
- **`reviewCount` bump** -- `row.state.reviewCount + 1` on every review,
  correct.
- **`isEditable` default logic** -- `input.isEditable ?? (sourceType ===
  PERSONAL)` matches the spec's "personal cards default to editable, non-
  personal cards default to read-only unless explicitly set."
- **`sourceRef` required guard** -- throws on `sourceType !== PERSONAL &&
  !sourceRef`, matching the spec rule.
- **`mastered` threshold uses strict `>`** -- `stability > 30` matches design
  "mastered where stability > 30 days" literally.
- **Default status filter in `getCards`** -- excludes archived by default,
  includes active and suspended, matches spec ("Browse page shows all active
  cards"; spec is slightly ambiguous about suspended, but including them in
  browse is the right UX default -- the user needs to find a suspended card to
  unsuspend it).
- **`getDueCards` order and limit** -- orders by `dueAt ASC` (oldest overdue
  first), limits to `REVIEW_BATCH_SIZE` (20), filters `status = ACTIVE`.
  Matches spec review flow step 2.
- **State type cast (`row.state.state as CardState`)** -- text column, but
  CHECK constraint in the schema enforces the enum. App-level trust of the DB
  is justified.
- **`count()` and `sum()` result conversions** -- `Number(row.c)` and `?? 0`
  fallbacks correctly handle Postgres's bigint/numeric string returns.
- **`ratingDistribution` initialization** -- all four keys pre-populated to
  `0`, so the returned object always has the full shape regardless of which
  ratings appear in the data.
- **`getReviewStats` date range filter** -- `gte` on start, `lte` on end,
  both optional, matches the spec read-interface signature.
- **Index barrel** -- re-exports only the public BC types and functions; does
  not leak `generateCardId` / `generateReviewId` (those correctly live in
  `@ab/utils`). Type exports and value exports are separated.
- **`setCardStatus` error on missing row** -- throws when row is not returned,
  correct for a must-exist operation.
- **UTC day arithmetic in `utcDayKey` / `utcStartOfDay`** -- ISO slice to 10
  chars correctly produces `YYYY-MM-DD`; `new Date('YYYY-MM-DDT00:00:00.000Z')`
  correctly produces UTC midnight. Streak computation uses only these helpers,
  so DST transitions do not cause off-by-one bugs.
- **`getDueCards` join shape** -- inner join on `(cardId, userId)` ensures a
  single row per due card even if a card has multiple card_state rows
  (multi-user seeding). Correct.
- **Drizzle `select()` with record mapper** -- rows destructure cleanly into
  `{ card, state }`.
- **No `any` / non-null assertions / magic strings in the new code** --
  consistent with project rules.
