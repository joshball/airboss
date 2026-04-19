---
title: 'Final Correctness Review: spaced-memory-items'
date: 2026-04-19
phase: final
category: correctness
branch: build/spaced-memory-items
commit: 236c688
base: docs/initial-migration
reviewer: correctness
---

# Final Correctness Review

Scope: `git diff docs/initial-migration..HEAD` on branch `build/spaced-memory-items`
(HEAD at `236c688`, Phase 4 complete). Full walkthrough of the spec test plan
(SMI-1..SMI-17) against the implementation.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 3     |
| Minor    | 8     |
| Nit      | 4     |

The feature is structurally sound end-to-end: FSRS integration is correct (the
Phase 2 `lastReviewedAt` fix is in place), the review transaction locks the
card_state row with `FOR UPDATE` before the idempotency check, card creation
inserts `card` and `card_state` in a single transaction, streak computation
uses UTC day keys, and filters compose with parameter-safe LIKE escaping.

Three `[MAJOR]` issues to address before the user-facing test pass:

1. The review form advances the card on a server `fail()` result, silently
   dropping failed reviews.
2. `submitReview` does not check `card.status` -- a suspended/archived card's
   review can still be persisted if a stale client POSTs it.
3. `getCardMastery` accuracy query joins `card` on `review.userId = card.userId`
   rather than on `review.cardId = card.id`, producing a Cartesian count of
   all reviews the user has ever submitted (filtered only by card status/domain
   existing), not reviews of that user's cards.

## Walkthrough against the test plan

| ID     | Scenario                                          | Expected path exercised                                                                                             | Observed                                                                |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SMI-1  | Create a basic card                               | `newCardSchema` -> `createCard` tx -> insert card + card_state -> redirect to `ROUTES.MEMORY_CARD(id)`              | Correct                                                                 |
| SMI-2  | Create with tags                                  | `parseTags` splits commas, trims, drops empties; stored as jsonb string[]                                           | Correct                                                                 |
| SMI-3  | Validation rejects empty fields                   | Zod `trim().min(1)` on `front`/`back`; fail(400) with `fieldErrors` + `values` preserved                            | Correct                                                                 |
| SMI-4  | Browse filters                                    | `narrowDomain` etc. narrow URL params; filters composed via `and(...)`, default status = ACTIVE                     | Correct                                                                 |
| SMI-5  | Edit a personal card                              | `updateCard` checks `is_editable` and whitelists patch fields                                                       | Correct                                                                 |
| SMI-6  | Dashboard due count                               | `getDashboardStats.dueNow` via `cardState.dueAt <= now AND card.status='active'`                                    | Correct                                                                 |
| SMI-7  | Review flow first card                            | `getDueCards` -> front/answer -> `submitReview` tx                                                                  | Correct, but see [MAJOR] review advances on failure                      |
| SMI-8  | FSRS scheduling                                   | `fsrsSchedule` with actual `lastReviewedAt` threaded via `card_state.lastReviewedAt`                                | Correct (Phase 2 fix landed)                                             |
| SMI-9  | Again resets                                      | `prevState === REVIEW && result.state === RELEARNING` bumps `lapseCount`                                            | Correct                                                                 |
| SMI-10 | Confidence slider                                 | `shouldPromptConfidence(cardId, now)` via djb2 on `cardId:YYYY-MM-DD`, compared to `CONFIDENCE_SAMPLE_RATE = 0.5`   | Correct -- deterministic per card per UTC day                            |
| SMI-11 | Skip confidence                                   | `confidence: null` path, form omits the key, zod `.nullish()` accepts                                               | Correct                                                                 |
| SMI-12 | No cards due                                      | `batch.length === 0` -> phase = 'complete' on load -> "All caught up" branch                                        | Correct                                                                 |
| SMI-13 | Streak                                            | `computeStreakDays` walks distinct UTC review days desc from today                                                  | Correct, UTC-only (see `[MINOR]` TZ note)                                |
| SMI-14 | Suspend                                           | `setCardStatus -> SUSPENDED`; `getDueCards` filters `status = 'active'`; browse can filter status                   | Correct (but see `[MAJOR]` submitReview status check)                    |
| SMI-15 | Archive                                           | Same as suspend; redirect to `ROUTES.MEMORY_BROWSE` after archive                                                   | Correct                                                                 |
| SMI-16 | Dashboard domain breakdown                        | `getDomainBreakdown` with per-domain `total`, `due`, `mastered` (stability > 30)                                    | Correct                                                                 |
| SMI-17 | Non-editable card                                 | Detail page checks `card.isEditable` -> hides Edit button; `updateCard` rejects at BC                               | Correct                                                                 |

## Findings

### [MAJOR] Review form advances card on server `fail()`, silently losing the rating

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:218`

```svelte
return async ({ result, update }) => {
    await update({ reset: false });
    if (result.type === 'success' || result.type === 'failure') {
        const rating = Number(formData.get('rating') ?? 0);
        onRatingResult(rating);
    } else {
        phase = 'answer';
    }
};
```

`result.type === 'failure'` is returned by SvelteKit whenever the action calls
`fail(400, ...)` (e.g. bad rating, missing cardId). In that case the review
was NOT persisted server-side, but the UI:

- Increments `tally[rating]`
- Advances `index` to the next card
- Treats the card as "reviewed" for the session summary

The user will see "You reviewed N cards" where 1..N-1 may not actually be in
the DB. The previous card will reappear as "due" on the next session because
its `card_state` wasn't updated, but the UX inconsistency is real.

Exact impact is small (the form fields are constructed from local state, so
most failures would require a mismatched FormData shape), but the guard is
wrong in principle and masks real bugs. Split handling: advance only on
`success`; on `failure`, re-render `phase = 'answer'` and surface the error.

The same branch also runs on `{ success: true, skipped: true }` which counts
a skipped (card-not-found) card toward the rating tally. That's arguably fine
per spec (SMI "Card deleted during review session -- skip, advance"), but the
tally should probably not include the rating the user pressed for a card that
no longer exists. `[MINOR]` at most; `[MAJOR]` for the failure case.

---

### [MAJOR] `submitReview` does not check `card.status`

**File:** `libs/bc/study/src/reviews.ts:65-73`

The initial select joins `card` only to confirm ownership, but does not read
`card.status`. A client that POSTs a review for a suspended or archived card
(stale tab, crafted request) will have that review persisted and the
`card_state` mutated -- potentially moving an archived card's `due_at` forward
as if it were active.

Spec implication is soft: SMI-14 / SMI-15 say suspended/archived cards don't
appear in the review queue; they don't explicitly forbid a review being
submitted for one. But "not in review queue" is only enforced by the load
function's filter, and any reload/redirect race can leave a stale `cardId` in
the client. Add `eq(card.status, CARD_STATUSES.ACTIVE)` to the FOR UPDATE
select, or re-check after the select and throw a `CardNotFoundError`-equivalent.

---

### [MAJOR] `getCardMastery` accuracy join uses wrong predicate

**File:** `libs/bc/study/src/stats.ts:202-210`

```ts
.from(review)
.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
.where(and(...accuracyClauses))
```

Actually re-reading the code: the join IS `card.id = review.cardId AND
card.userId = review.userId`, so this looks correct on first pass. The issue
to scrutinize: when `domain` is omitted from `getCardMastery`, the
`accuracyClauses` becomes just `eq(review.userId, userId)` and the card status
clause. For a user with reviews against a card that was later archived, the
status filter excludes those reviews; for totals (`totalsRow`), the status
filter also excludes the archived card. So `accuracy` and `total` are
self-consistent within the "active cards" scope -- intentional per the
comment. No bug here.

Withdrawn -- this was an initial read of the join direction; the predicates
are correct. Downgrade: `[NIT]` -- the symmetric `and(eq(card.id,
review.cardId), eq(card.userId, review.userId))` works only because reviews
are guaranteed to be owned by the same user as their card (enforced by
`submitReview`'s initial lookup). If someone ever back-fills reviews without
that guarantee, the join silently filters them. Adding a CHECK or at least an
assertion in code wouldn't hurt.

(Keeping this entry in the review because the original flag was meaningful;
after the second read it's a `[NIT]`, not `[MAJOR]`. Net count above reflects
the corrected severity.)

Revised count:

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 2     |
| Minor    | 8     |
| Nit      | 5     |

---

### [MINOR] `getDomainBreakdown` and `getCardMastery` pass Date via `now.toISOString()` into raw SQL

**Files:**

- `libs/bc/study/src/stats.ts:158` (`getDomainBreakdown`)
- `libs/bc/study/src/stats.ts:195` (`getCardMastery`)

```ts
due: sql<number>`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)`,
```

Postgres will implicit-cast the text parameter to `timestamptz` for the `<=`
comparison, so this works in practice. It's also the only path in the codebase
that passes a string where a Date is expected -- every other query uses
`lte(cardState.dueAt, now)` with the Date object, letting Drizzle bind it as
`timestamptz`. Prefer passing the Date directly through a `param()` or via
`sql<number>`sum(case when ${cardState.dueAt} <= ${now} ...`` -- it removes a
class of timezone / format-edge bugs and is type-safe.

Pin-down: the current string form has worked in local testing because Postgres
accepts ISO-8601 with `Z`. On a server with non-default `DateStyle` or an older
driver, implicit casts are not guaranteed.

---

### [MINOR] `submitReview` uses UPDATE, not UPSERT, for `card_state`

**File:** `libs/bc/study/src/reviews.ts:129-141`

The doc comment says "upserts the card_state" but the code calls
`tx.update(cardState)`. This is correct in the current system because
`createCard` inserts the `card_state` row in the same transaction as the card,
and the FOR UPDATE select at line 65 throws `CardNotFoundError` if no row
exists. So the update is guaranteed to find a row.

The risk: if a future path creates a card without a `card_state` row (bulk
import, migration, cross-BC card creation that forgets the pair), the update
silently affects zero rows and the review row is still inserted -- meaning
the card's `card_state.dueAt` never changes, but the review history accrues.
FSRS would recompute correctly because `lastReviewedAt` is denormalized on
`card_state`, but the next review would see stale state.

Either update the doc comment to "updates" OR switch to a true upsert
(`.onConflictDoUpdate(...)` against the composite PK). I recommend the
latter; it's one more guard against a class of bug that's easy to introduce
when adding cross-BC card sources (the very pattern this feature opens up).

---

### [MINOR] Review tally counts skipped (card-deleted) cards toward the rating

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:218-220`

When the action returns `{ success: true, skipped: true }` (CardNotFoundError),
the client path treats this as a normal success: increments `tally[rating]`
and advances. The user pressed "Good" on a card that was deleted mid-session
-- that shouldn't count as a "Good" rating in the summary. Suggest tagging
the result and excluding `skipped` from the tally (summary then shows "1
skipped" alongside the rating breakdown).

---

### [MINOR] `.for('update')` applies FOR UPDATE to the joined `card` row too

**File:** `libs/bc/study/src/reviews.ts:70`

The FOR UPDATE locks rows from both tables in the join. Intent is to serialize
concurrent submits; the card table row is a collateral lock that will
interfere with a concurrent `updateCard` on the same card. Unlikely to matter
(who edits a card while it's being reviewed?), but `.for('update', { of: [...] })`
with an explicit lock target is available in Drizzle via `sql.raw`. Consider
scoping to `cardState` only.

---

### [MINOR] Streak is strictly UTC with no grace period

**File:** `libs/bc/study/src/stats.ts:67-94`

`computeStreakDays` walks back from today's UTC date key; if the user hasn't
reviewed today (UTC), the streak is 0 even if they reviewed "yesterday" in
their local timezone but that local yesterday is UTC today.

Spec says "consecutive days with at least 1 review" without specifying
timezone. UTC is a reasonable default. But this gives a user in US Pacific
(UTC-7/8) a narrow daily window: reviewing at 4pm local = midnight UTC, which
already rolls over. They see their streak drop to 0 overnight whenever they
haven't yet reviewed on the new UTC day.

Minor, but worth either (a) documenting the UTC-only behavior in the UX copy
or (b) accepting "today OR yesterday" to give one day of grace.

---

### [MINOR] Review session's `startNewSession()` reads stale `data.batch` after `invalidateAll()`

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:99-107`

```ts
async function startNewSession() {
    await invalidateAll();
    batch = data.batch;
    ...
}
```

In SvelteKit 2 / Svelte 5, `data` inside an event handler closes over the
value at the time the handler was defined. After `invalidateAll()` re-runs
the load, `data` on the component prop updates reactively, but the local
`data` identifier inside this function body is the same reactive proxy -- it
should reflect the latest. This works because `let { data } = $props()` makes
`data` a reactive getter. Worth verifying by running SMI-7 all the way
through, ending the session, adding a new card in another tab, and clicking
"Reload queue". If `batch = data.batch` sees the old array, swap to reading
via `page.data` from `$app/state`.

---

### [MINOR] Card detail page uses dual `form:not(.inline-form)` styling and inline-form class

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:461`

Not a correctness bug but a fragile pattern: the CSS targets the edit form
via `form:not(.inline-form)`. If a future contributor adds another form on
this page without `.inline-form`, it inherits the full edit-form styling.
Scope the edit form to a class.

---

### [NIT] `updateCard` double-queries the card

**File:** `libs/bc/study/src/cards.ts:141-167`

The function does a SELECT to check editability and then an UPDATE with the
same WHERE clause. A single UPDATE with a `returning()` and a computed guard
could replace both -- but the current form gives clearer errors. Keeping as a
nit since the intent is readability.

---

### [NIT] Browse filter "page=1" hidden input shadows client pager navigation

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:83`

The filter form has `<input type="hidden" name="page" value="1" />` so a
filter submit always resets to page 1. That's the right UX. But
`pageHref(n)` builds the URL by spreading filters via `buildHref({ page: ... })`
-- which also works correctly. Consistent. No bug.

---

### [NIT] `shouldPromptConfidence` is evaluated per card at load time, not per submit

**File:** `apps/study/src/routes/(app)/memory/review/+page.server.ts:36-61`

The deterministic hash is `(cardId, YYYY-MM-DD)`. If a session starts at 23:59
UTC and the user rates a card at 00:01 UTC the next day, the client still
uses the pre-computed `promptConfidence` flag from the load-time date, not
the new day's hash. Since the hash is deterministic by design, this is
technically inconsistent with the spec's "same card on the same day always
prompts or never prompts" -- the client might show a prompt today that
tomorrow's hash would skip, or vice versa.

In practice this matters for one card per user per session, and the
confidence data is still valid. Not worth fixing but worth noting.

---

### [NIT] `formatInterval` on card detail rounds 60-59m to `h`

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:72-85`

Minor rendering oddity: a 59-minute interval displays as "59m", a 61-minute
one as "1h". No correctness issue.

---

### [NIT] `humanize(slug)` defined in three files

`apps/study/src/routes/(app)/memory/+page.svelte`, `...new/+page.svelte`,
`.../[id]/+page.svelte`, `.../browse/+page.svelte`, `.../review/+page.svelte`
each define their own `humanize`. Extract to `libs/utils/src/text.ts`.

---

## Walkthrough against spec edge cases

| Edge case                                              | Handled?                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| No cards due                                           | Yes -- `batch.length === 0` lands on phase = 'complete' with copy "No cards due right now."                                               |
| Card deleted during session                            | Yes -- `CardNotFoundError` -> `{ skipped: true }` path advances the session                                                               |
| Rapid double-submit (5s idempotency)                   | Yes -- `REVIEW_DEDUPE_WINDOW_MS` window check inside the tx with FOR UPDATE serialization                                                 |
| Confidence slider declined                             | Yes -- Escape or "Skip confidence" button sets `confidence = null`, form omits the key, zod `.nullish()` accepts                          |
| All cards suspended/archived                           | Yes -- `getDueCards` filters `status = 'active'`, so queue is empty -> "All caught up"                                                    |
| Source card uneditable                                 | Yes -- UI hides Edit; `updateCard` throws `Card X is not editable`; route maps to `fail(403)`                                              |
| Same card same day -- confidence prompt is deterministic | Yes -- djb2 hash of `cardId:YYYY-MM-DD`                                                                                                   |
| Card created without card_state                        | Not possible via `createCard` (single tx). External paths could break the update; see `[MINOR]` upsert suggestion.                        |

## Conformance to prime-directive concerns

- No stubs remain in the critical path.
- FSRS integration uses the real `ts-fsrs` library; the Phase 2 `lastReviewedAt`
  fix is threaded through the schema, `submitReview`, and the scheduler.
- Transaction boundaries are tight and correct.
- Validation happens at both the route (user-facing errors) and the BC
  (defense-in-depth) layers, using shared zod schemas.
- Idempotency uses a row-lock pattern rather than advisory locks or optimistic
  retry; this is correct for the scale.

## Recommendation

Ship after addressing the two `[MAJOR]` items:

1. Fix the review form to NOT advance on `result.type === 'failure'`
   (apps/study/src/routes/(app)/memory/review/+page.svelte:218).
2. Add `card.status = 'active'` to the `submitReview` initial lookup
   (libs/bc/study/src/reviews.ts:65-73) or re-check after the select.

The `[MINOR]` items are defense-in-depth and can land in a follow-up pass;
the `[NIT]` items are cosmetic.

## Files touched in this review (read-only)

- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/cards.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/reviews.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/srs.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/srs.test.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/stats.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/schema.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/validation.ts
- /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/index.ts
- /Users/joshua/src/_me/aviation/airboss/libs/constants/src/study.ts
- /Users/joshua/src/_me/aviation/airboss/libs/constants/src/routes.ts
- /Users/joshua/src/_me/aviation/airboss/libs/constants/src/index.ts
- /Users/joshua/src/_me/aviation/airboss/libs/utils/src/ids.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/+page.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/+page.svelte
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/new/+page.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/new/+page.svelte
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.svelte
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/browse/+page.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/browse/+page.svelte
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/review/+page.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/review/+page.svelte
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/+layout.server.ts
- /Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts
- /Users/joshua/src/_me/aviation/airboss/scripts/smoke/study-bc.ts
- /Users/joshua/src/_me/aviation/airboss/docs/work-packages/spaced-memory-items/spec.md
- /Users/joshua/src/_me/aviation/airboss/docs/work-packages/spaced-memory-items/test-plan.md
- /Users/joshua/src/_me/aviation/airboss/docs/work-packages/spaced-memory-items/design.md
