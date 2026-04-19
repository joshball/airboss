---
title: 'Phase 2 Backend Review: spaced-memory-items'
date: 2026-04-19
phase: 2
category: backend
---

# Phase 2 Backend Review

Scope: BC-layer functions added in commit `0bbde26` -- `libs/bc/study/src/cards.ts`, `reviews.ts`, `stats.ts`, `index.ts`, and `scripts/smoke/study-bc.ts`. Review focuses on server-side correctness and safety: transactional boundaries, idempotency, scheduling correctness, validation placement, and error surfaces.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 1     |
| Major    | 2     |
| Minor    | 6     |
| Nit      | 4     |

## Findings

### [Critical] FSRS scheduling receives `lastReview: null` on every review, destroying elapsed_days

**File:** `libs/bc/study/src/reviews.ts:72`
**Issue:** `submitReview` calls `fsrsSchedule(...)` with `lastReview: null` on every invocation. The inline comment claims "ts-fsrs uses `dueAt - scheduledDays` internally; pass null here" -- this is not how ts-fsrs works. In `node_modules/ts-fsrs/dist/index.mjs:344-351`, the scheduler's `init()` computes:

```typescript
const { state, last_review } = this.current;
let interval = 0;
if (state !== State.New && last_review) {
	interval = dateDiffInDays(last_review, this.review_time);
}
this.elapsed_days = interval;
```

When `last_review` is null/undefined, `interval` stays 0. The downstream `next_ds(t, grade, r)` then branches on `t === 0 && enable_short_term` (line 934) and uses `next_short_term_stability` -- the same-day, learning-steps formula -- *instead of* the retention-driven `next_recall_stability`.

**Impact:** For every review past the first, FSRS behaves as if the learner is reviewing the card on the same day the previous review occurred. This is incorrect in two ways:

1. **Scheduling is wrong.** A card that was due 30 days ago and is rated "Good" gets the short-term-stability bump, not the large stability gain FSRS awards for successful recall after a long interval. Long-interval cards will be re-scheduled too soon. Progression through the spaced-repetition ladder is hobbled.
2. **Analytics are wrong.** `result.log.elapsed_days` is persisted into `review.elapsed_days` -- with `lastReview: null`, that column is always 0 for non-new reviews. Any future FSRS parameter optimization or mastery analytics that consumes review history will see garbage.

The card only "looks" correct because the dashboard shows the new `dueAt`, which *is* advanced. The bug is invisible in the smoke script because it submits only one review per card.

**Fix:** Track the last review time on `card_state` (simplest) or look it up from `review` each submit (one extra round-trip). Two clean options:

1. Add `last_reviewed_at: timestamptz` to `card_state`. On first review, set it to `now`. On subsequent reviews, pass the previous value as `lastReview` to `fsrsSchedule`, then update to `now` in the same upsert. This is a schema addition to Phase 1's migration -- but Phase 2 is the first consumer, so the fix lands naturally here.
2. Inside the tx, after loading `row.state`, if `row.state.lastReviewId` is not null, fetch the linked `review.reviewedAt` and pass it as `lastReview`. Cheaper on schema but costs one extra SELECT per review.

Option 1 is preferred -- the schema already stores `last_review_id` as a pointer; promoting the timestamp alongside it avoids the extra query and keeps `card_state` self-sufficient for scheduling (which is its stated purpose per the schema comment at `schema.ts:8-10`).

### [Critical] submitReview idempotency check races under concurrent double-submit

**File:** `libs/bc/study/src/reviews.ts:44-52`
**Issue:** The 5-second idempotency check is inside the transaction but without any row lock. Under default `READ COMMITTED`:

1. Request A begins tx, runs the idempotency SELECT -- no recent review exists.
2. Request B begins tx concurrently, runs its idempotency SELECT -- A has not committed, so B also sees no recent review.
3. Both read `card_state`, both compute FSRS, both INSERT `review`, both UPDATE `card_state`. The row lock on `card_state` serializes the two UPDATEs, but both proceed -- the second overwrites the first.

Result: two review rows inserted for one user-intended rating, and `card_state` reflects only the second FSRS advance (possibly a double advance in the same direction, which skews stability upward). The spec is explicit: "Rapid double-submit on rating: Idempotency -- check if a review already exists ... Ignore duplicate."

This is reproducible any time a client retries a slow request, or a user double-clicks the rating button and the network is fast enough that two tabs/requests start before either commits.

**Fix:** Acquire a row lock on `card_state` for the (cardId, userId) pair *before* the idempotency check. With postgres-js + Drizzle:

```typescript
return await db.transaction(async (tx) => {
	// Serialize concurrent submits for (cardId, userId) by locking card_state.
	const locked = await tx
		.select()
		.from(cardState)
		.where(and(eq(cardState.cardId, input.cardId), eq(cardState.userId, input.userId)))
		.for('update')
		.limit(1);
	if (locked.length === 0) throw new Error(`Card ${input.cardId} not found for user ${input.userId}`);

	// Now the idempotency check is safe -- any concurrent submit for this card
	// is blocked on the row lock until we commit.
	const [recent] = await tx.select()...;
	if (recent) return recent;
	// ...rest unchanged
});
```

`.for('update')` is supported on Drizzle select builders. Alternative: `SERIALIZABLE` isolation via the transaction config, but that's heavier and forces retry handling at every call site.

Bonus: after this fix, the separate "load card + state" query at `reviews.ts:55-62` can be collapsed into the locked read, saving a round-trip.

### [Major] updateCard accepts status-mutating patches at runtime

**File:** `libs/bc/study/src/cards.ts:128-135`
**Issue:** `updateCard` spreads the caller's `patch` object directly into `.set({...patch, updatedAt: new Date()})`. The `UpdateCardInput` interface does not include `status`, `isEditable`, `userId`, or `sourceType`, so the TypeScript compiler catches misuse at compile time. But at runtime, any caller that passes an object with extra keys -- for example, a form action that spreads `Object.fromEntries(formData)` or a test harness -- can mutate any column on `card`, including `status`, `isEditable`, and `userId`. TypeScript's excess property checks don't apply to objects passed through variables.

Per spec: "Only cards with `is_editable: true` can be edited" and status is supposed to change only through `setCardStatus`. Right now a malicious or buggy form-action layer could set `is_editable: false` permanently, or worse, re-parent a card to another user.

**Impact:** Authorization-by-typing only. A single zod-schema miss at the route layer lets arbitrary column writes through. For a BC that sits behind auth and form actions, defense-in-depth matters.

**Fix:** Build the update set explicitly from the allowed fields:

```typescript
const updateSet: Partial<typeof card.$inferInsert> = { updatedAt: new Date() };
if (patch.front !== undefined) updateSet.front = patch.front;
if (patch.back !== undefined) updateSet.back = patch.back;
if (patch.domain !== undefined) updateSet.domain = patch.domain;
if (patch.cardType !== undefined) updateSet.cardType = patch.cardType;
if (patch.tags !== undefined) updateSet.tags = patch.tags;

const [updated] = await db.update(card).set(updateSet).where(...).returning();
```

### [Major] submitReview loads card + state redundantly with the idempotency check

**File:** `libs/bc/study/src/reviews.ts:46-62`
**Issue:** Not a correctness bug, but the transaction does two SELECTs that could be one: an idempotency SELECT on `review`, then a separate JOIN SELECT to load the card + state. If the Critical fix above is applied (`FOR UPDATE` on `card_state`), the locked row read *is* the state load, and the idempotency check follows.

**Impact:** One wasted round-trip per review submission under the normal (non-duplicate) path. With 20 reviews per session and ~5 ms per local query, that's 100 ms per session spent on a query that always returns the same thing.

**Fix:** Combine. Inside the tx, first `SELECT ... FOR UPDATE` on `card_state` for `(cardId, userId)` joined with `card` to verify ownership; then run the idempotency SELECT; then compute + insert + update. Deferred until the Critical fix lands -- they fix together.

### [Minor] createCard does no input validation

**File:** `libs/bc/study/src/cards.ts:64-108`
**Issue:** The BC function trusts its caller. Only `source_ref` presence is checked. Spec validation rules (front/back 1-10000 trimmed, tags max 20, each tag 1-100, domain in DOMAINS, card_type in CARD_TYPES) are enforced only via TypeScript types and route-layer zod. If a caller sends `front: ''` or `tags: new Array(500).fill('x'.repeat(500))`, the BC writes it and Postgres stores it (no DB length check on front/back or element check on jsonb tags).

**Impact:** Defense-in-depth gap. Route-layer validation is fine today, but future consumers (import scripts, admin tools, internal services) will skip the zod layer and hit BC directly. At minimum, front/back being allowed empty bypasses the "required" spec rule silently.

**Fix:** Either (a) add a narrow `validateCreateCardInput` helper that asserts the spec rules and call it at the top of `createCard`, or (b) co-locate a zod schema in `libs/bc/study/src/` that both `createCard` and route actions use. Option (b) is cleaner -- one schema, two consumers, no drift.

Same argument applies to `updateCard` (no length/count validation on the patch).

### [Minor] BC layer uses plain `throw new Error(...)` without typed error classes

**File:** `libs/bc/study/src/cards.ts:67,125,126,223`; `libs/bc/study/src/reviews.ts:62`
**Issue:** Every error is a bare `Error` with a free-form message. Route-layer code that wants to distinguish "card not found" from "card not editable" from "source_ref required" has to string-match. airboss-firc (and most BC conventions) use tagged error classes (e.g., `class StudyError extends Error { code: 'NOT_FOUND' | 'NOT_EDITABLE' | 'INVALID_SOURCE' }`).

**Impact:** Form actions can't return structured failure reasons without parsing message strings. Future observability (Sentry tags, log categorization) degrades to message-text matching.

**Fix:** Introduce `StudyError` with a code union. Example:

```typescript
export type StudyErrorCode = 'CARD_NOT_FOUND' | 'CARD_NOT_EDITABLE' | 'INVALID_SOURCE_REF' | 'CARD_STATE_MISSING';
export class StudyError extends Error {
	constructor(public readonly code: StudyErrorCode, message: string) {
		super(message);
		this.name = 'StudyError';
	}
}
```

Low effort, pays back every time a route handler needs to branch on reason.

### [Minor] getCards default status filter includes suspended

**File:** `libs/bc/study/src/cards.ts:180-184`
**Issue:** When `filters.status` is not supplied, `getCards` returns `[ACTIVE, SUSPENDED]`. Spec "Card browsing" (spec.md:86): "Browse page shows all active cards for the current user." The spec language is colloquial but implies only active by default.

**Impact:** Browse UI will show suspended cards mixed in with active ones unless the route explicitly sets the filter. The visual distinction between active and suspended is a UI concern -- the BC default deviates from the spec's literal reading.

**Fix:** Two defensible choices: (a) narrow the default to `[ACTIVE]` to match the spec literal; or (b) keep current behavior but update the spec to say "excludes archived by default, includes suspended for browse/resume workflow." Pick one and document.

### [Minor] getDashboardStats stateCounts silently drop unknown states

**File:** `libs/bc/study/src/stats.ts:128-131`
**Issue:** `for (const row of stateRows) { if (s in stateCounts) stateCounts[s] = Number(row.c); }`. If the DB ever holds a state not in the `CARD_STATES` enum (bad migration, schema drift, hand-written insert), those cards vanish from the dashboard counts with no log. Total shown becomes less than `card_state` row count.

**Impact:** Silent data divergence. Debugging "I have 50 cards but the dashboard shows 47" is hard when there's no log.

**Fix:** Warn on unknown state:

```typescript
for (const row of stateRows) {
	const s = row.state as CardState;
	if (s in stateCounts) stateCounts[s] = Number(row.c);
	else console.warn(`[study] Unknown card state '${row.state}' (count ${row.c})`);
}
```

Or use the project logger from `libs/utils/src/logger.ts`.

### [Minor] Streak calculation uses UTC, not user timezone

**File:** `libs/bc/study/src/stats.ts:54-94`
**Issue:** `computeStreakDays` buckets by UTC day. A user in US-Pacific who reviews at 6pm PT (which is 02:00 UTC the next day) will see their streak jump a day early. A user who reviews at 5am PT (13:00 UTC same day) gets correctly-bucketed days only when each day's review also lands in that UTC range.

**Impact:** Streak feels wrong for users not on UTC. For user zero (Joshua, US-Mountain), reviewing between 5pm and midnight local shifts the streak bucket boundary.

**Fix:** Acceptable for MVP but track as a followup. Either (a) accept a `tz` parameter and bucket with `date_trunc('day', reviewedAt at time zone tz)`, or (b) store a per-user timezone on `bauthUser` and thread it through. Note in the spec under Edge Cases.

### [Minor] getCardMastery accuracy denominator mixes review lifecycles

**File:** `libs/bc/study/src/stats.ts:173-216`
**Issue:** Accuracy = `count(rating > 1) / count(all reviews)` across all time, all cards, all lifecycle stages. Early "learning" reviews (where `Again` is expected and part of acquisition) and mature "review" reviews are lumped together. A learner who just started gets a low accuracy score that reflects lesson acquisition, not mastery.

Spec Dashboard section doesn't specify "accuracy," only "total, due, mastered." The field is in the return type but not in the spec's dashboard checklist, so this may be intentional for other consumers. Still worth flagging -- the metric as computed doesn't match an intuitive "how well am I doing" reading.

**Impact:** The accuracy number will look low for new learners and fluctuate unpredictably. If this feeds a UI metric, users will be confused.

**Fix:** Either (a) scope accuracy to reviews where the pre-review state was `review` or `relearning` (i.e., exclude `new`/`learning` acquisition reviews), or (b) rename the field to `all_time_rating_success_rate` and document what it is. Option (a) is the spec-aligned "accuracy" reading.

### [Nit] smoke script hardcodes DATABASE_URL fallback instead of using DEV_DB_URL

**File:** `scripts/smoke/study-bc.ts:28`
**Issue:** The script falls back to a hardcoded `'postgresql://airboss:airboss@localhost:5435/airboss'` if `DATABASE_URL` is unset. `libs/constants/src/dev.ts` exports `DEV_DB_URL` with the same value. Magic-string-in-script violates the "All literal values in libs/constants/" rule from CLAUDE.md.

**Fix:** `import { DEV_DB_URL } from '../../libs/constants/src/dev';` and `const url = process.env.DATABASE_URL ?? DEV_DB_URL;`.

### [Nit] CARD_STATUSES imported from deep path in smoke script

**File:** `scripts/smoke/study-bc.ts:26`
**Issue:** `import { CARD_STATUSES } from '../../libs/constants/src/study';` -- all other imports from `../../libs/constants` use `../../libs/constants/src/index`. Inconsistent.

**Fix:** Move `CARD_STATUSES` to the same import line as the others.

### [Nit] Inline comment in submitReview is factually wrong

**File:** `libs/bc/study/src/reviews.ts:72`
**Issue:** `// ts-fsrs uses dueAt - scheduledDays internally; pass null here`. Whether or not the Critical finding above is addressed, this comment is wrong about ts-fsrs behavior -- the library computes elapsed_days as `dateDiffInDays(last_review, now)` and treats null as 0, not as a sentinel to back-compute. Keep the comment accurate to avoid reinforcing the misconception.

**Fix:** Replace with an accurate note once the Critical fix lands, or delete if the semantic changes.

### [Nit] getCards mutates intermediate query builder instead of reassigning

**File:** `libs/bc/study/src/cards.ts:199-208`
**Issue:** The code does `const q = db.select()...; if (filters.limit) q.limit(...); if (filters.offset) q.offset(...); return await q;`. Drizzle's `.limit()` and `.offset()` mutate `this.config` and return `this`, so this works -- but it reads as a latent bug because the return values are discarded. Future readers will assume a chain is required and "fix" it by adding reassignments, which is also fine but a churny diff.

**Fix:** Either chain fluently (`let q = base; if (...) q = q.limit(...); if (...) q = q.offset(...)`) or add a comment that Drizzle mutates in place.

## Clean

- `createCard` correctly wraps both inserts in a single transaction.
- `createCard` correctly validates `source_ref` presence when `source_type !== 'personal'`.
- `isEditable` default logic at `cards.ts:87` -- `input.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL` -- correctly defaults to true for personal and false for everything else. Precedence is correct (operator `??` has lower precedence than `===`).
- `updateCard` correctly refuses to update non-editable cards (`cards.ts:126`).
- `getCard` returns `null` on miss (clean for SvelteKit `load` semantics) and is correctly scoped by `userId` (`cards.ts:146`).
- `getCard` joins `cardState` on both `cardId` and `userId` -- protects against cross-user bleed if a card were ever dual-owned (future sharing).
- `getDueCards` filters correctly: `dueAt <= now` + `status = ACTIVE`, ordered by `dueAt ASC`, default limit `REVIEW_BATCH_SIZE` (20) -- matches spec.
- `setCardStatus` is correctly user-scoped via `and(eq(card.id), eq(card.userId))` (`cards.ts:221`), and throws when the update affects zero rows.
- `getCards` search uses correct ILIKE escaping: `.replace(/[\\%_]/g, (ch) => \`\\${ch}\`)` escapes backslash, percent, underscore -- the only three special chars for Postgres ILIKE. Pattern then wraps in `%...%` for substring match.
- Stats queries correctly use `now.toISOString()` string interpolation inside `sql\`\`` templates, working around postgres-js `Date` bind in `sum(case when ...)` contexts.
- `stateCounts` initializer uses computed property keys off `CARD_STATES` -- no magic strings.
- `getDueCardCount` and `getMasteredCount` mirror the filter logic of `getDashboardStats` correctly (active-only, user-scoped).
- `submitReview` lapseCount increment is correct: only bumps on `REVIEW -> RELEARNING` transition, matching FSRS semantics (lapses = graduated review falling back to relearning).
- Confidence and answerMs nullability handled with `?? null` at insert site -- safe coercion, matches schema nullability.
- DB-level CHECK constraints (from Phase 1 schema) protect `rating 1-4`, `confidence NULL OR 1-5`, `state IN (...)`, `card_type IN (...)`, `source_type IN (...)`, `status IN (...)` -- BC does not need to re-check these.
- Review insert is fully inside the transaction; card_state update is fully inside the transaction -- no write split.
- Smoke script cleans up after itself (deletes review, state, card for the test id at `scripts/smoke/study-bc.ts:100-102`).
- Barrel (`libs/bc/study/src/index.ts`) exports only the intended public surface; internals (`schema` table internals beyond types and the tables themselves) are not leaking.
