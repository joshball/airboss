---
title: 'Tasks: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: tasks
status: unread
---

# Tasks: Spaced Memory Items

## Pre-flight

- [ ] Read `libs/bc/study/src/index.ts` -- currently a stub. Understand what exists.
- [ ] Read `libs/constants/src/index.ts` and all constant files -- understand existing patterns.
- [ ] Read `libs/db/src/index.ts` -- understand Drizzle connection setup.
- [ ] Read `apps/study/src/routes/` -- understand existing routes and layout.
- [ ] Read the [ts-fsrs source](https://github.com/open-spaced-repetition/ts-fsrs) -- understand the algorithm before implementing.
- [ ] Verify DB is running: `docker ps` or OrbStack check for postgres on port 5435.

## Implementation

### 1. Constants

- [ ] Create `libs/constants/src/study.ts` with `DOMAINS`, `CARD_TYPES`, `CONTENT_SOURCES`, `REVIEW_RATINGS`, `CARD_STATES`, `CONFIDENCE_LEVELS` (see design.md for exact values).
- [ ] Export from `libs/constants/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 2. ID prefixes

- [ ] Add card (`crd_`) and review (`rev_`) ID creation helpers to `libs/utils/src/index.ts` or a new `libs/utils/src/ids.ts` that uses `createId()`.
- [ ] Run `bun run check` -- 0 errors.

### 3. Drizzle schema

- [ ] Create `libs/bc/study/src/schema.ts` with `card`, `review`, `card_state` tables in the `study` Postgres namespace (see design.md for exact Drizzle code).
- [ ] Create the `study` schema in Postgres: `CREATE SCHEMA IF NOT EXISTS study;`
- [ ] Generate and run initial migration, or push schema directly for dev: `bunx drizzle-kit push`.
- [ ] Verify tables exist in DB.
- [ ] Run `bun run check` -- 0 errors, commit.

### 4. FSRS-5 algorithm

- [ ] Create `libs/bc/study/src/srs.ts` -- pure functions: `fsrsSchedule()`, `fsrsInitialState()`, `fsrsDefaultParams()`.
- [ ] Create `libs/bc/study/src/srs.test.ts` -- unit tests with known FSRS test vectors:
  - New card rated Good -> learning state, short interval
  - Review card rated Again -> relearning state, stability decreases
  - Review card rated Easy -> stability increases significantly
  - Difficulty stays bounded [1, 10]
  - Stability stays positive
- [ ] Run `bun test` -- all pass.
- [ ] Run `bun run check` -- 0 errors, commit.

### 5. Card BC functions

- [ ] Create `libs/bc/study/src/cards.ts` -- `createCard()`, `updateCard()`, `getCard()`, `getDueCards()`, `getCards()`, `setCardStatus()`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 6. Review BC functions

- [ ] Create `libs/bc/study/src/reviews.ts` -- `submitReview()` that runs FSRS, inserts review, upserts card_state. Single transaction.
- [ ] Run `bun run check` -- 0 errors, commit.

### 7. Stats BC functions

- [ ] Create `libs/bc/study/src/stats.ts` -- `getDashboardStats()`, `getCardMastery()`, `getReviewStats()`, `getDomainBreakdown()`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 8. Card creation route

- [ ] Create `apps/study/src/routes/(app)/memory/new/+page.server.ts` -- form action that validates and calls `createCard()`.
- [ ] Create `apps/study/src/routes/(app)/memory/new/+page.svelte` -- form with front, back, domain (dropdown from DOMAINS), card_type, tags.
- [ ] Run `bun run check` -- 0 errors.

### 9. Card browse route

- [ ] Create `apps/study/src/routes/(app)/memory/browse/+page.server.ts` -- load function with domain/type/search filters.
- [ ] Create `apps/study/src/routes/(app)/memory/browse/+page.svelte` -- card list with filters.
- [ ] Run `bun run check` -- 0 errors.

### 10. Card detail route

- [ ] Create `apps/study/src/routes/(app)/memory/[id]/+page.server.ts` -- load card + state + recent reviews. Actions: update, suspend, archive.
- [ ] Create `apps/study/src/routes/(app)/memory/[id]/+page.svelte` -- card detail with edit form (if editable), status actions, review history.
- [ ] Run `bun run check` -- 0 errors, commit.

### 11. Memory dashboard

- [ ] Create `apps/study/src/routes/(app)/memory/+page.server.ts` -- load dashboard stats.
- [ ] Create `apps/study/src/routes/(app)/memory/+page.svelte` -- due count by domain, reviewed today, streak, state breakdown, "Start Review" button.
- [ ] Run `bun run check` -- 0 errors.

### 12. Review flow

- [ ] Create `apps/study/src/routes/(app)/memory/review/+page.server.ts` -- load due cards batch. Form action: `submitReview`.
- [ ] Create `apps/study/src/routes/(app)/memory/review/+page.svelte` -- card front -> reveal -> rate flow. Confidence slider on ~50% of cards. Session summary at end.
- [ ] Run `bun run check` -- 0 errors, commit.

### 13. Navigation

- [ ] Update `apps/study/src/routes/(app)/+layout.svelte` -- add Memory nav item linking to `/memory`.
- [ ] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Request implementation review
- [ ] Commit docs updates
