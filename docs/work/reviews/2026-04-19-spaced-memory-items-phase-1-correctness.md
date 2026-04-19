---
title: 'Phase 1 Correctness Review: spaced-memory-items'
date: 2026-04-19
phase: 1
category: correctness
branch: build/spaced-memory-items
commit: a3dbe04
reviewer: correctness
---

# Phase 1 Correctness Review

Scope: HEAD (`a3dbe04`) vs HEAD~1 (`966da01`). Phase 1 adds:

- `libs/constants/src/study.ts` -- DOMAINS, CARD_TYPES, CONTENT_SOURCES, CARD_STATUSES, REVIEW_RATINGS, CARD_STATES, CONFIDENCE_LEVELS, and tuning constants.
- `libs/bc/study/src/schema.ts` -- `card`, `review`, `card_state` tables in the `study` Postgres namespace.
- `libs/bc/study/src/srs.ts` -- FSRS-5 scheduling wrapper over `ts-fsrs@5.3.2`.
- `libs/bc/study/src/srs.test.ts` -- 9 vitest specs (all passing locally).

This review checks logical correctness of the wrapper, tests, and constant
values against the spec, the ts-fsrs 5.3.2 source, and the work-package design.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 0     |
| Minor    | 4     |
| Nit      | 3     |

Overall: Phase 1 is logically correct. The FSRS wrapper is a thin, faithful
translation between airboss types and ts-fsrs types. All enumeration maps are
exhaustive and use type-level `Record<K, V>`, so the compiler guarantees
coverage if new states/ratings are added. Tests verify the contractual
invariants (bounds, state transitions, relative ordering of Easy/Good). The
nits and minors below are polish, not correctness bugs.

## Findings

### [MINOR] Schema defaults use magic strings instead of constants

**File:** `libs/bc/study/src/schema.ts:34, 37`
**Issue:** The `sourceType` column defaults to the literal `'personal'` and
`status` defaults to the literal `'active'`. Both values are duplicated from
`CONTENT_SOURCES.PERSONAL` and `CARD_STATUSES.ACTIVE` in
`libs/constants/src/study.ts`.
**Impact:** CLAUDE.md project rules explicitly say "No magic strings. Use
`libs/constants/`." A future rename of the canonical enum value would silently
drift from the DB default. Search-for-usages also misses the schema file.
**Fix:**

```typescript
import { CARD_STATUSES, CONTENT_SOURCES, SCHEMAS } from '@ab/constants';
// ...
sourceType: text('source_type').notNull().default(CONTENT_SOURCES.PERSONAL),
status: text('status').notNull().default(CARD_STATUSES.ACTIVE),
```

The constants are `as const` string literals, so Drizzle sees the same
compile-time type and the generated SQL is identical (`DEFAULT 'personal'`,
`DEFAULT 'active'`).

### [MINOR] Test-gap: no ordering assertion on Hard < Good for a single state

**File:** `libs/bc/study/src/srs.test.ts`
**Issue:** Tests assert `Easy > Good` for a new card but do not assert the full
monotonicity chain `dueAt(Again) < dueAt(Hard) < dueAt(Good) < dueAt(Easy)` for
either new or review-state cards. A regression that swapped Hard/Good inside
`RATING_TO_TS` would still pass every existing test: Easy remains the longest
interval, Again still lands in Learning/Relearning within 24 hours, the bounds
test averages over mixed ratings.
**Impact:** The rating-to-ts-fsrs map is the highest-leverage place for a silent
bug (one-character typo swaps the semantics of two buttons for every user). An
ordering test would catch it immediately.
**Fix:** Add one test per scheduler state (new + review) that schedules all four
ratings from identical starting state and asserts the dueAt ordering:

```typescript
it('new-card intervals order Again < Hard < Good < Easy', () => {
	const ratings = [
		REVIEW_RATINGS.AGAIN,
		REVIEW_RATINGS.HARD,
		REVIEW_RATINGS.GOOD,
		REVIEW_RATINGS.EASY,
	];
	const dues = ratings.map(
		(r) => fsrsSchedule(fsrsInitialState(NOW), r, NOW).dueAt.getTime(),
	);
	// Strictly monotonic non-decreasing. (Hard and Good can tie on some
	// parameter sets; Again < everything else must always hold.)
	for (let i = 1; i < dues.length; i++) {
		expect(dues[i]).toBeGreaterThanOrEqual(dues[i - 1]);
	}
	expect(dues[0]).toBeLessThan(dues[3]); // Again < Easy always
});
```

### [MINOR] Test-gap: `fsrsDefaultParams` is not sanity-checked against FSRS-5 shape

**File:** `libs/bc/study/src/srs.test.ts:19-28`
**Issue:** The test asserts `length >= 19` and all entries finite, but does not
verify the specific count (ts-fsrs 5.3.2 exposes 21 weights) nor that the array
is frozen / immutable. A future ts-fsrs major that drops `default_w` in favor of
a getter-only API would silently return an empty array and still pass
`length >= 19` only if the upstream happens to keep at least 19.
**Impact:** Low today. A 3-line improvement would lock the invariant tighter
without overfitting to FSRS-5-vs-FSRS-6.
**Fix:** Either assert the exact length (`21` today, bump when upgrading) or
assert a plausible upper bound (`<= 32`) plus that the array is the Object.frozen
reference returned by ts-fsrs (which it is -- `Object.freeze([...])`).

### [MINOR] Schema has no CHECK constraints on enum-valued text columns

**File:** `libs/bc/study/src/schema.ts` (all three tables)
**Issue:** `card.domain`, `card.card_type`, `card.source_type`, `card.status`,
`review.state`, `review.rating`, and `card_state.state` are all `text`/`smallint`
with no CHECK constraint restricting values to the enum set defined in
`libs/constants/src/study.ts`. The spec deliberately picked `text` over
Postgres enums ("the constant is the canonical list but the DB column is text,
not an enum" -- spec.md:158), but CHECK constraints would still enforce
validity without the migration pain of ALTER TYPE.
**Impact:** Application-layer bugs (or hand-written SQL) could write
`status = 'deletd'` or `rating = 7` and the DB would accept it. All three
tables are still in Phase 1 (no write paths yet), so no corrupt data can exist
yet. This is preventative.
**Fix (optional, defer to Phase 2 write-path review):** Add CHECK constraints
using Drizzle's `check()` helper, sourcing the lists from constants. Example:

```typescript
import { check, sql } from 'drizzle-orm';
// ...
(t) => ({
    // ...existing indexes...
    ratingCheck: check('rating_check', sql`${t.rating} BETWEEN 1 AND 4`),
})
```

Flagged as minor rather than major because the spec's "text over enum" choice is
a considered call, and CHECK constraints add migration friction for their own
evolution. Surface for discussion; don't block Phase 1.

### [NIT] Misleading comment in `makeMatureCard` test helper

**File:** `libs/bc/study/src/srs.test.ts:62-87`
**Issue:** The helper constructs a card with `lastReview = NOW - 10 days` and
`dueAt = NOW + 10 days`, then invokes the scheduler at `at = dueAt`. The test
comment says "the prior 10-day interval" (line 83), but the actual `elapsed_days`
ts-fsrs computes is `dateDiffInDays(lastReview, at)` = **20 days**. The card was
scheduled for a 10-day interval, but the review is happening 10 days late.
**Impact:** Slightly misleading for future readers / test maintainers but the
test assertion is still correct (the new interval after Again is still < 1 day;
stability still collapses).
**Fix:** Either adjust the comment to "the prior 20-day real elapsed interval"
or adjust `at` to equal `dueAt` minus one-off such that elapsed matches the
scheduled 10-day interval. The cleaner fix is the comment.

### [NIT] `CardSchedulerState.lastReview` is `Date | null | undefined` but wrapper normalizes both

**File:** `libs/bc/study/src/srs.ts:19, 69, 98`
**Issue:** `lastReview?: Date | null` accepts all of undefined, null, and Date.
`fsrsInitialState` returns `empty.last_review ?? null` (never undefined).
`fsrsSchedule` passes `state.lastReview ?? null` to ts-fsrs (which then coerces
null to undefined internally via `card.last_review ? ... : void 0`). The
three-state type works but is slightly over-permissive -- if a future caller
builds a `CardSchedulerState` from a DB row with `null`, null is passed through;
if they omit the field, undefined is passed through. Both funnel to the same
ts-fsrs input.
**Impact:** None today. Minor API surface clean-up.
**Fix (optional):** Narrow to `Date | null` (drop `?`) so the type reflects
"always serialize a value, use null for 'no prior review'." Matches what
`fsrsInitialState` returns. Alternatively keep the optional but document that
undefined and null are equivalent.

### [NIT] `fsrsDefaultParams()` return type is `readonly number[]` but the ts-fsrs reference is Object.frozen

**File:** `libs/bc/study/src/srs.ts:76-78`
**Issue:** We return the `default_w` reference directly. ts-fsrs exports it as
`Object.freeze([...])`, so mutation throws in strict mode, but the
`readonly number[]` type hides the fact that the array itself is shared with
other ts-fsrs consumers. The type is sound; it's a minor documentation gap.
**Impact:** None.
**Fix (optional):** Comment on the behavior, or return `[...default_w]` if we
want to own the array. Not required.

## Clean

Items verified correct and spec-aligned:

1. **Rating map is exhaustive and correct.** `RATING_TO_TS` is typed
   `Record<ReviewRating, Rating>`, so the compiler requires all four keys.
   Values: `AGAIN=1 -> Rating.Again=1`, `HARD=2 -> Rating.Hard=2`,
   `GOOD=3 -> Rating.Good=3`, `EASY=4 -> Rating.Easy=4`. The fact that our
   `REVIEW_RATINGS` numeric values equal the ts-fsrs `Rating` enum values is
   deliberate ("matches ts-fsrs / Anki convention" per study.ts:62), and using
   `Record<K,V>` rather than `as const` guarantees we catch drift if either side
   changes.
2. **State maps (TO/FROM) are exhaustive and correct.** Both
   `STATE_TO_TS: Record<CardState, State>` and
   `STATE_FROM_TS: Record<State, CardState>` are compiler-enforced total maps
   over all four (new/learning/review/relearning). `State.New=0`,
   `Learning=1`, `Review=2`, `Relearning=3` in ts-fsrs match our string-keyed
   enum by definition; the bijection is sound.
3. **`fsrsInitialState` matches spec for brand-new cards.** Returns
   `stability: 0`, `difficulty: 0`, `state: 'new'`, `dueAt: now`,
   `lastReview: null`, `reviewCount: 0`, `lapseCount: 0`. Spec says
   `stability: 0, difficulty: 0, state: 'new', due_at: now()` -- match.
   Verified against ts-fsrs `createEmptyCard` which sets the same values plus
   `last_review: undefined` (normalized to null by us).
4. **`fsrsSchedule` input-translation is safe.** ts-fsrs `FSRS.next()` uses the
   passed `last_review` + `now` to derive `elapsed_days` via `init()`, ignoring
   any `elapsed_days` / `scheduled_days` / `learning_steps` on the input for
   state-transition purposes. Passing `0, 0, 0` is therefore harmless, as the
   wrapper comment correctly assumes. Confirmed by reading
   `node_modules/ts-fsrs/dist/index.mjs` `AbstractScheduler.init()`.
5. **`dueAt` is a UTC Date.** `result.card.due` is a JS `Date` (absolute instant,
   not an interval). The `timestamp('due_at', { withTimezone: true })` Postgres
   column stores it as `timestamptz`. No UTC/local confusion; round-trips
   through Drizzle preserve the instant.
6. **No additional stability/difficulty clamping needed.** ts-fsrs clamps
   `stability` to `[S_MIN=0.001, S_MAX=36500]` and `difficulty` to `[1, 10]`
   inside its `next_state()` algorithm (`CLAMP_PARAMETERS` in
   `index.mjs`). The wrapper correctly delegates and adds no second clamp.
   Bounds test verifies difficulty stays in [1, 10] over 20 mixed rounds.
7. **Singleton scheduler is safe for concurrent use.** `fsrs()` returns an
   `FSRS` instance; `next()` constructs a fresh `BasicScheduler` per call
   (`new Scheduler(card, now, this, this.strategyHandler)`), carrying no
   call-to-call mutable state on the shared instance. Confirmed via source.
8. **Tuning constants match spec.**
   - `MASTERY_STABILITY_DAYS = 30` matches spec "mastered where stability > 30
     days" (spec.md:123, PRD.md dashboard).
   - `CONFIDENCE_SAMPLE_RATE = 0.5` matches spec "~50% of reviews"
     (tasks.md:96 "Confidence slider on ~50% of cards").
   - `REVIEW_BATCH_SIZE = 20` matches spec "Limit to a batch (20 cards)"
     (spec.md:91).
   - `REVIEW_DEDUPE_WINDOW_MS = 5_000` matches the 5-second dedupe window
     requirement discussed in the Phase 0 reviews.
9. **DOMAINS has the canonical 14 values.** Matches design.md:93-108 exactly:
   regulations, weather, airspace, glass-cockpits, ifr-procedures,
   vfr-operations, aerodynamics, teaching-methodology, adm-human-factors,
   safety-accident-analysis, aircraft-systems, flight-planning,
   emergency-procedures, faa-practical-standards.
10. **CARD_TYPES = {basic, cloze, regulation, memory_item}** matches spec.md:27.
11. **CONTENT_SOURCES = {personal, course, product, imported}** matches
    spec.md:28.
12. **CARD_STATES = {new, learning, review, relearning}** matches spec.md:48
    ("new, learning, review, relearning -- FSRS states").
13. **CARD_STATUSES = {active, suspended, archived}** matches spec.md:31. The
    `CARD_STATUSES` constant was added in Phase 1 (not in design.md's inline
    constants list), which is an improvement -- it removes a magic-string
    cluster from the future `setCardStatus` code path.
14. **CONFIDENCE_LEVELS = {wild_guess=1, uncertain=2, maybe=3, probably=4,
    certain=5}** forms a 1-5 scale. Not spelled out numerically in the spec;
    the 5-point Likert scale is conventional for pre-reveal confidence and
    matches the PRD's calibration tracker intent.
15. **`jsonb('tags').notNull().default([])` produces valid JSON SQL.** Verified
    by running `bunx drizzle-kit generate` against the current schema: the
    migration emits `"tags" jsonb DEFAULT '[]'::jsonb NOT NULL` -- valid
    Postgres JSON literal, not the bare `[]` literal that would fail.
16. **`status` default `'active'` matches the `CARD_STATUSES.ACTIVE` string
    value.** They agree; the only issue is stylistic (see Minor #1 above --
    should reference the constant rather than duplicate the literal).
17. **Type export hygiene.** `CardSchedulerState`, `ScheduleResult`, and the
    `CardRow`/`NewCardRow`/`ReviewRow`/`NewReviewRow`/`CardStateRow`/
    `NewCardStateRow` types are all part of the Phase-2 public API (BC
    functions consuming them, route loaders displaying them). Nothing is
    over-exported.
18. **All 9 tests pass.** `bun test libs/bc/study/src/srs.test.ts` -> 9 pass,
    0 fail, 85 assertions, 13ms.
19. **Full check clean.** `bun run check` -> 0 errors, 0 warnings
    (svelte-check 1267 files + biome 55 files).

## Test-suite completeness assessment

Coverage against spec-stated FSRS behaviors:

| Behavior                                       | Covered?   | Test                                                    |
| ---------------------------------------------- | ---------- | ------------------------------------------------------- |
| Initial state for new card                     | yes        | `fsrsInitialState returns the new-card defaults`        |
| Default weights exist and are finite           | yes        | `fsrsDefaultParams exposes a finite default weight...`  |
| Good on new card leaves New state              | yes        | `Good on a new card promotes past state New...`         |
| Again on new card -> Learning, short interval  | yes        | `Again on a new card lands in learning...`              |
| Easy > Good interval on new card               | yes        | `Easy on a new card schedules a longer interval...`     |
| Again on Review card -> Relearning             | yes        | `Again on a Review-state card transitions to Relearn..` |
| Again on Review card -- stability collapses    | yes        | (same test)                                             |
| Easy on Review card -- stability increases     | yes        | `Easy on a Review-state card increases stability`       |
| Difficulty stays in [1, 10] across many cycles | yes        | `difficulty stays within [1, 10] across many...`        |
| elapsedDays / scheduledDays finite >= 0        | yes        | `elapsedDays and scheduledDays are finite...`           |
| Hard < Good ordering                           | **no**     | See Minor #2 above                                      |
| Rating map not swapped (sanity)                | **no**     | See Minor #2 above                                      |
| State map not swapped (sanity)                 | indirectly | Covered by state-transition tests                       |

Overall: 9 tests covering 10 of 12 behaviors is strong coverage for Phase 1.
The two gaps are low-frequency failure modes but easy to catch with a single
added test.

## Summary

Phase 1 is **correct**. No bugs found that would cause incorrect scheduling,
bad data writes, or runtime errors. The four minors are all about defense in
depth (constants instead of magic strings, one more test, CHECK constraints)
and the three nits are documentation polish. Nothing blocks Phase 2.

The highest-value follow-up is Minor #2 (ordering test) because it closes the
widest remaining "silent bug" window in the rating map -- a one-character swap
there would change the semantics of a button every user presses dozens of times
a day, and none of the current tests would catch it.
