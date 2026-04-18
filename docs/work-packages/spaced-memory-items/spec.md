---
title: 'Spec: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: spec
status: unread
---

# Spec: Spaced Memory Items

Flashcard-based spaced repetition for aviation knowledge. Users create cards, review them on an FSRS-5 schedule, and track mastery per domain. This is both a standalone study tool (Joshua studies regs and airspace now) and platform infrastructure -- future products and courses publish cards into this system.

## Data Model

All tables in the `study` Postgres schema namespace. IDs use `prefix_ULID` via `@ab/utils` `createId()`.

### study.card

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| id | text | PK | `crd_` prefix |
| user_id | text | NOT NULL, FK identity | Owner -- the user whose deck this card is in |
| front | text | NOT NULL | Question/prompt (markdown) |
| back | text | NOT NULL | Answer/explanation (markdown) |
| domain | text | NOT NULL | From `DOMAINS` constant (regulations, weather, airspace, etc.) |
| tags | jsonb | DEFAULT '[]' | Freeform tags for filtering |
| card_type | text | NOT NULL | From `CARD_TYPES` constant (basic, cloze, regulation, memory_item) |
| source_type | text | NOT NULL, DEFAULT 'personal' | From `CONTENT_SOURCES` constant (personal, course, product, imported) |
| source_ref | text | NULL | Opaque reference to origin. NULL for personal. Format: `{source}:{id}` (e.g., `firc:mod1:card-042`, `route-walkthrough:kbjc-approach`) |
| is_editable | boolean | NOT NULL, DEFAULT true | false for course/product-provided cards |
| status | text | NOT NULL, DEFAULT 'active' | active, suspended, archived |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

### study.review

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| id | text | PK | `rev_` prefix |
| card_id | text | NOT NULL, FK study.card | |
| user_id | text | NOT NULL | Denormalized for query efficiency |
| rating | smallint | NOT NULL | 1=again, 2=hard, 3=good, 4=easy (FSRS standard) |
| confidence | smallint | NULL | 1-5 pre-reveal confidence (feeds calibration tracker). NULL when not prompted |
| stability | real | NOT NULL | FSRS stability after this review |
| difficulty | real | NOT NULL | FSRS difficulty after this review |
| elapsed_days | real | NOT NULL | Days since last review (0 for first) |
| scheduled_days | real | NOT NULL | Days until next review |
| state | text | NOT NULL | new, learning, review, relearning (FSRS states) |
| due_at | timestamptz | NOT NULL | When next review is scheduled |
| reviewed_at | timestamptz | NOT NULL, DEFAULT now() | |
| answer_ms | integer | NULL | Time from card reveal to rating selection |

### study.card_state

Materialized current state per card per user. Avoids scanning all reviews to determine what's due.

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| card_id | text | PK (composite) | FK study.card |
| user_id | text | PK (composite) | |
| stability | real | NOT NULL | Current FSRS stability |
| difficulty | real | NOT NULL | Current FSRS difficulty |
| state | text | NOT NULL | new, learning, review, relearning |
| due_at | timestamptz | NOT NULL | When next review is due |
| last_review_id | text | NULL, FK study.review | NULL for new cards |
| review_count | integer | NOT NULL, DEFAULT 0 | |
| lapse_count | integer | NOT NULL, DEFAULT 0 | Times card went from review -> relearning |

## Behavior

### Card creation

User fills in front, back, domain, card_type, and optional tags. On submit:

1. Validate all fields (see Validation section).
2. Create `study.card` with `source_type: 'personal'`, `is_editable: true`.
3. Create `study.card_state` with FSRS initial values: `stability: 0`, `difficulty: 0`, `state: 'new'`, `due_at: now()`.
4. Redirect to the new card's detail page.

### Card editing

Only cards with `is_editable: true` can be edited. Course/product cards show a read-only view with a "source" badge.

### Card browsing

Browse page shows all active cards for the current user. Filter by domain, card_type, source_type, tags. Search front/back text. Sort by due date, created date, domain.

### Review flow

1. User navigates to `/memory/review`.
2. Load function queries `study.card_state` for cards where `due_at <= now()` and `status = 'active'`, ordered by `due_at ASC`. Limit to a batch (20 cards).
3. If no cards due: show "all caught up" empty state with stats (next due date, total cards, review streak).
4. Show card front. User reads, thinks, then clicks "Show Answer."
5. Card back revealed. User rates: Again (1), Hard (2), Good (3), Easy (4).
6. On ~50% of reviews (deterministic hash of `card_id + review_date`, not random), show confidence slider (1-5) BEFORE revealing the answer. This feeds calibration data.
7. On rating submission:
   a. Run FSRS-5 algorithm with current card_state + rating -> new stability, difficulty, state, due_at.
   b. Insert `study.review` row.
   c. Upsert `study.card_state` with new values.
   d. Advance to next card.
8. After batch complete: show session summary (reviewed count, ratings distribution, next due date).

### FSRS-5 algorithm

Pure functions in `libs/bc/study/src/srs.ts`. ~100 lines of TypeScript math. 19 tunable parameters with sensible defaults from the reference implementation.

Key functions:

- `fsrsSchedule(cardState, rating, now)` -> `{ stability, difficulty, state, due_at, elapsed_days, scheduled_days }`
- `fsrsInitialState()` -> default card_state for new cards
- `fsrsDefaultParams()` -> the 19 default parameters

Reference: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT license).

### Dashboard stats

The memory dashboard (`/memory`) shows:

- Cards due now (count, grouped by domain)
- Cards reviewed today
- Current streak (consecutive days with at least 1 review)
- Cards by state (new, learning, review, relearning)
- Cards by domain (total, mastered where stability > 30 days)

### Read interfaces for cross-product consumption

The study BC exports read functions that other BCs/products can consume:

- `getCardMastery(userId, domain?)` -> `{ total, due, mastered, accuracy }`
- `getReviewStats(userId, dateRange?)` -> `{ reviewedCount, ratingDistribution, streakDays }`
- `getDomainBreakdown(userId)` -> per-domain mastery summary

These are how a future course app checks "has this learner mastered weather?" without reaching into study tables directly.

## Validation

| Field | Rule |
| --- | --- |
| front | Required, 1-10000 chars, trimmed |
| back | Required, 1-10000 chars, trimmed |
| domain | Required, must be a value in `DOMAINS` constant |
| card_type | Required, must be a value in `CARD_TYPES` constant |
| tags | Array of strings, max 20 tags, each tag 1-100 chars |
| rating | Required, integer 1-4 |
| confidence | Optional, integer 1-5 |
| source_type | Must be a value in `CONTENT_SOURCES` constant |
| source_ref | Required when source_type is not 'personal', NULL when 'personal' |

## Edge Cases

- **No cards due:** Show "all caught up" with next due date and suggestion to create cards.
- **Card deleted during review session:** Skip it, advance to next. Don't crash the session.
- **Rapid double-submit on rating:** Idempotency -- check if a review already exists for this card_id + user_id within the last 5 seconds. Ignore duplicate.
- **Confidence slider declined:** User can skip the confidence prompt. Store NULL for confidence.
- **Card with no reviews (new):** card_state exists with `state: 'new'`, FSRS handles first-review scheduling.
- **All cards suspended/archived:** Same as "no cards due" -- empty state.
- **Source card becomes uneditable:** If a card's `source_type` changes from personal to course (via a future import/assignment flow), existing reviews are preserved. Only editability changes.
- **Domain taxonomy extension:** New domains added to `DOMAINS` constant. Existing cards with the old domain value remain valid. No migration needed -- the constant is the canonical list but the DB column is text, not an enum.

## Out of Scope

- Card templates (regulation fill-in, plate quiz) -- future card_type additions
- Image/audio attachments on cards
- Import/export (CSV, Anki format)
- Shared decks / community card pools
- Auto-generation from FAR/AIM or other sources
- Offline/PWA support
- FSRS parameter optimization from user review data (collecting data from day one; optimization is future)
- Integration hooks (missed rep -> card, route walkthrough -> card) -- the `source_type`/`source_ref` schema supports this, but the actual integration flows are out of scope
