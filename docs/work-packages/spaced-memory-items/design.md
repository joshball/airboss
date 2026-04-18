---
title: 'Design: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: design
status: unread
---

# Design: Spaced Memory Items

## FSRS-5 over SM-2

**Question:** Which spaced repetition scheduling algorithm?

**Options considered:**

- **SM-2** (SuperMemo, 1987) -- one variable per card (ease factor), fixed initial intervals, no stability/difficulty separation. Simple but crude.
- **FSRS-5** (Free Spaced Repetition Scheduler v5, Jarrett Ye) -- two variables per card (stability + difficulty), better lapse handling, adopted by Anki since v23.10. ~100 lines of pure math, 19 tunable parameters.

**Chosen:** FSRS-5.

**Why:**

- The stability/difficulty split maps well to aviation domains -- some material is inherently harder (complex regs vs. simple memory items).
- Open-source (MIT), well-documented, proven at Anki scale.
- Collecting review data from day one means we can optimize the 19 parameters from real usage later.
- Reference implementation in TypeScript: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs).

**Cost accepted:** FSRS-5 is more complex than SM-2 (~100 lines vs ~20). Worth it for scheduling accuracy.

## Schema

Drizzle ORM, `study` Postgres namespace.

```typescript
// libs/bc/study/src/schema.ts
import { pgSchema, text, smallint, real, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const studySchema = pgSchema('study');

export const card = studySchema.table('card', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	front: text('front').notNull(),
	back: text('back').notNull(),
	domain: text('domain').notNull(),
	tags: jsonb('tags').default([]),
	cardType: text('card_type').notNull(),
	sourceType: text('source_type').notNull().default('personal'),
	sourceRef: text('source_ref'),
	isEditable: boolean('is_editable').notNull().default(true),
	status: text('status').notNull().default('active'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const review = studySchema.table('review', {
	id: text('id').primaryKey(),
	cardId: text('card_id').notNull().references(() => card.id),
	userId: text('user_id').notNull(),
	rating: smallint('rating').notNull(),
	confidence: smallint('confidence'),
	stability: real('stability').notNull(),
	difficulty: real('difficulty').notNull(),
	elapsedDays: real('elapsed_days').notNull(),
	scheduledDays: real('scheduled_days').notNull(),
	state: text('state').notNull(),
	dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
	reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
	answerMs: integer('answer_ms'),
});

export const cardState = studySchema.table('card_state', {
	cardId: text('card_id').notNull().references(() => card.id),
	userId: text('user_id').notNull(),
	stability: real('stability').notNull(),
	difficulty: real('difficulty').notNull(),
	state: text('state').notNull(),
	dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
	lastReviewId: text('last_review_id').references(() => review.id),
	reviewCount: integer('review_count').notNull().default(0),
	lapseCount: integer('lapse_count').notNull().default(0),
}, (table) => ({
	pk: primaryKey({ columns: [table.cardId, table.userId] }),
}));
```

## Constants

```typescript
// libs/constants/src/study.ts

export const DOMAINS = {
	REGULATIONS: 'regulations',
	WEATHER: 'weather',
	AIRSPACE: 'airspace',
	GLASS_COCKPITS: 'glass-cockpits',
	IFR_PROCEDURES: 'ifr-procedures',
	VFR_OPERATIONS: 'vfr-operations',
	AERODYNAMICS: 'aerodynamics',
	TEACHING_METHODOLOGY: 'teaching-methodology',
	ADM_HUMAN_FACTORS: 'adm-human-factors',
	SAFETY_ACCIDENT_ANALYSIS: 'safety-accident-analysis',
	AIRCRAFT_SYSTEMS: 'aircraft-systems',
	FLIGHT_PLANNING: 'flight-planning',
	EMERGENCY_PROCEDURES: 'emergency-procedures',
	FAA_PRACTICAL_STANDARDS: 'faa-practical-standards',
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

export const CARD_TYPES = {
	BASIC: 'basic',
	CLOZE: 'cloze',
	REGULATION: 'regulation',
	MEMORY_ITEM: 'memory_item',
} as const;

export type CardType = (typeof CARD_TYPES)[keyof typeof CARD_TYPES];

export const CONTENT_SOURCES = {
	PERSONAL: 'personal',
	COURSE: 'course',
	PRODUCT: 'product',
	IMPORTED: 'imported',
} as const;

export type ContentSource = (typeof CONTENT_SOURCES)[keyof typeof CONTENT_SOURCES];

export const REVIEW_RATINGS = {
	AGAIN: 1,
	HARD: 2,
	GOOD: 3,
	EASY: 4,
} as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[keyof typeof REVIEW_RATINGS];

export const CARD_STATES = {
	NEW: 'new',
	LEARNING: 'learning',
	REVIEW: 'review',
	RELEARNING: 'relearning',
} as const;

export type CardState = (typeof CARD_STATES)[keyof typeof CARD_STATES];

export const CONFIDENCE_LEVELS = {
	WILD_GUESS: 1,
	UNCERTAIN: 2,
	MAYBE: 3,
	PROBABLY: 4,
	CERTAIN: 5,
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];
```

## API Surface

### Server load functions

| Route | Load | Returns |
| --- | --- | --- |
| `(app)/memory/+page.server.ts` | `getDashboardStats(userId)` | due count by domain, reviewed today, streak, state counts |
| `(app)/memory/review/+page.server.ts` | `getDueCards(userId, limit: 20)` | batch of due cards with card_state |
| `(app)/memory/browse/+page.server.ts` | `getCards(userId, filters)` | paginated cards with filters |
| `(app)/memory/new/+page.server.ts` | -- | Just needs DOMAINS and CARD_TYPES constants |
| `(app)/memory/[id]/+page.server.ts` | `getCard(cardId, userId)` | single card with state and recent reviews |

### Form actions

| Route | Action | What it does |
| --- | --- | --- |
| `(app)/memory/new/+page.server.ts` | `default` | Validate + create card + card_state |
| `(app)/memory/[id]/+page.server.ts` | `update` | Validate + update card (only if is_editable) |
| `(app)/memory/[id]/+page.server.ts` | `suspend` | Set status to 'suspended' |
| `(app)/memory/[id]/+page.server.ts` | `archive` | Set status to 'archived' |
| `(app)/memory/review/+page.server.ts` | `submitReview` | Run FSRS, insert review, upsert card_state |

### BC functions (libs/bc/study/)

| File | Function | Signature |
| --- | --- | --- |
| `cards.ts` | `createCard` | `(db, data: NewCard) -> Card` |
| `cards.ts` | `updateCard` | `(db, cardId, userId, data: Partial<Card>) -> Card` |
| `cards.ts` | `getCard` | `(db, cardId, userId) -> Card & CardState` |
| `cards.ts` | `getDueCards` | `(db, userId, limit?) -> (Card & CardState)[]` |
| `cards.ts` | `getCards` | `(db, userId, filters?) -> Card[]` |
| `cards.ts` | `setCardStatus` | `(db, cardId, userId, status) -> void` |
| `reviews.ts` | `submitReview` | `(db, cardId, userId, rating, confidence?) -> Review` |
| `srs.ts` | `fsrsSchedule` | `(state: CardState, rating: Rating, now: Date) -> ScheduleResult` |
| `srs.ts` | `fsrsInitialState` | `() -> CardStateValues` |
| `srs.ts` | `fsrsDefaultParams` | `() -> FsrsParams` |
| `stats.ts` | `getDashboardStats` | `(db, userId) -> DashboardStats` |
| `stats.ts` | `getCardMastery` | `(db, userId, domain?) -> MasteryStats` |
| `stats.ts` | `getReviewStats` | `(db, userId, dateRange?) -> ReviewStats` |
| `stats.ts` | `getDomainBreakdown` | `(db, userId) -> DomainStats[]` |

## Data Flow

```text
Card Creation:
  form submit -> form action validates -> cards.createCard() -> INSERT card + card_state -> redirect

Review Flow:
  page load -> getDueCards() -> SELECT from card JOIN card_state WHERE due_at <= now()
  user rates -> form action -> submitReview():
    1. Read current card_state
    2. fsrsSchedule(state, rating, now) -> new stability, difficulty, due_at
    3. INSERT review row
    4. UPSERT card_state with new values
    -> return next card (or session complete)

Cross-product reads:
  other BC -> import { getCardMastery } from '@ab/bc/study' -> SELECT aggregates from card_state
```

## Key Decisions

### One BC, not three

Spaced Memory Items, Decision Reps, and Calibration Tracker share data models heavily -- calibration reads from both cards and reps, both produce confidence+result tuples. One `libs/bc/study/` with sub-modules (`cards.ts`, `reviews.ts`, `scenarios.ts`, `calibration.ts`, `srs.ts`) is cleaner than three separate BCs. They'll diverge if needed; premature separation costs more than premature coupling here.

### card_state as materialized current state

Without `card_state`, every "what's due?" query scans the entire review history. With it, we maintain a single row per card per user with current FSRS values. The cost is an upsert on every review. The benefit is O(1) per-card state lookup vs O(n) review scan. At even modest scale (1000+ cards), this is essential.

### Content source model for future integration

`source_type` + `source_ref` + `is_editable` on cards (and later scenarios) enables three future integration patterns without schema migration:

1. **Courses** assign cards -> `source_type: 'course'`, `source_ref: 'firc:mod1:card-042'`, `is_editable: false`
2. **Products** generate cards -> `source_type: 'product'`, `source_ref: 'route-walkthrough:kbjc'`, `is_editable: false`
3. **Bulk import** -> `source_type: 'imported'`, `source_ref: 'anki-deck:aviation-regs'`, `is_editable: true`

Personal cards remain the default: `source_type: 'personal'`, `source_ref: null`, `is_editable: true`.

### Domain taxonomy: constants, not DB enum

Domains are defined in `libs/constants/src/study.ts` as a TypeScript `as const` object. The DB column is `text`, not a Postgres enum. This means:

- Adding a domain is a code change, not a migration.
- Courses can define sub-domains (`regulations:far-61`) that the study app treats as valid text.
- Validation happens at the application layer, not the DB layer.

### Confidence sampling at ~50%

Asking confidence on every review adds friction. Asking on none gives no calibration data. The ~50% rate (deterministic hash of `card_id + review_date`) balances data collection with UX. The hash ensures the same card on the same day always shows/hides the prompt consistently, avoiding user confusion.
