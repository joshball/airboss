---
title: 'Phase 1 Schema Review: spaced-memory-items'
date: 2026-04-19
phase: 1
category: schema
branch: build/spaced-memory-items
commit: a3dbe04
reviewer: schema
---

# Phase 1 Schema Review

Scope: HEAD (`a3dbe04`) vs HEAD~1 (`966da01`). Phase 1 adds the data layer for the
Spaced Memory Items feature: `libs/constants/src/study.ts`, `libs/bc/study/src/schema.ts`
(three tables in the `study` pg schema: `card`, `review`, `card_state`), an FSRS
wrapper, and a drizzle-kit push workflow.

This review checks the schema against
[docs/work-packages/spaced-memory-items/spec.md](../../work-packages/spaced-memory-items/spec.md)
and [design.md](../../work-packages/spaced-memory-items/design.md), the documented
query patterns, and Drizzle/Postgres best practice.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 4     |
| Minor    | 6     |
| Nit      | 2     |

Overall: the schema is clean, spec-conformant on columns/types/defaults, well
documented, and uses appropriate Drizzle primitives. The findings cluster in three
areas:

1. Missing `user_id` FK on all three tables (spec says `FK identity`).
2. Missing indexes for specific documented queries (due-now scan must also
   filter on `card.status = active`, which forces a join to a table that has no
   `id + user_id + status` index).
3. Cascade behavior on `card_state` vs `review` needs a second look -- if a card
   with history is deleted, both its state and its reviews vanish, which is
   correct for user-owned cards but worth calling out.

## Findings

### [Major] No foreign key on `user_id` anywhere in the study schema

**File:** `libs/bc/study/src/schema.ts:28,55,79`
**Issue:** Spec says `user_id | text | NOT NULL, FK identity`. The implementation
leaves `userId` as a plain `text('user_id').notNull()` with no `.references()`.
There are three places this matters: `card.user_id`, `review.user_id`,
`card_state.user_id`.
**Impact:** If a better-auth user is deleted, the study tables are silently
orphaned -- cards, reviews, and card_state rows keep pointing at a non-existent
user id. This is a data-integrity concern that the spec explicitly calls out
("FK identity"). It also blocks any DB-level cascade on user deletion.
**Why it was likely skipped:** better-auth's user table lives in `public.bauth_user`
(see `libs/auth/src/schema.ts`). The `identity` Postgres namespace exists in
`SCHEMAS` but has no tables yet -- there is no `identity.user` to reference. The
comment in `libs/auth/src/schema.ts` notes: "These live in the default public
schema since better-auth does not support PostgreSQL schema namespaces."
**Fix:** Two viable options:

1. Add `.references(() => bauthUser.id, { onDelete: 'cascade' })` on `card.user_id`
   (and leave `review`/`card_state` to cascade transitively via `card`). This
   requires importing `bauthUser` from `@ab/auth` -- cross-lib but the study BC
   already owns user-scoped data.
2. Document explicitly that user deletion is handled at the application layer via
   a cleanup routine, and note this as a deliberate deviation from the spec. If
   chosen, update the spec to match.

Recommendation: option 1. User deletion is rare, cascade is safe, and the spec
asks for it.

### [Major] "Cards due now" query cannot use an index for the `status = 'active'` filter

**File:** `libs/bc/study/src/schema.ts:24-46, 73-92`
**Issue:** The documented query (spec Review flow step 2, design Data Flow) is:

```sql
SELECT c.*, cs.*
FROM study.card_state cs
JOIN study.card c ON c.id = cs.card_id AND c.user_id = cs.user_id
WHERE cs.user_id = ?
  AND cs.due_at <= now()
  AND c.status = 'active'
ORDER BY cs.due_at ASC
LIMIT 20;
```

`card_state` has `card_state_user_due_idx` on `(user_id, due_at)` -- good for the
first filter. But the join must then fetch each matching card row and filter on
`status`. `card` has `card_user_status_idx` on `(user_id, status)` -- not helpful
here because the join is by `id` (the PK), and the PK index returns `status` only
via a heap lookup.
**Impact:** At modest scale (5-10k cards per user), the join plus heap lookups is
fine. At 100k+ or when most cards are suspended/archived, the planner will fetch
many "dead" cards only to discard them. Also, `card.status` is low-cardinality
(three values) so a partial index is more appropriate than a btree.
**Fix:** Either

1. Denormalize `status` onto `card_state` (cheap: the status is already updated via
   the BC's setCardStatus function, which would upsert card_state too). Then a
   partial index `card_state_user_due_active_idx on (user_id, due_at) where status = 'active'`
   makes the due-now scan a single index range.
2. Add a partial index on `card`: `card_user_id_active_idx on (user_id, id) where status = 'active'`
   -- still requires the join, but lets the planner avoid fetching heap rows for
   non-active cards.

Option 1 is faster long-term but doubles the write path for status changes.
Option 2 is cheaper and sufficient for the current scale. Call the trade-off in
a code comment either way. Not blocking Phase 1 ship, but schedule a follow-up
before the dashboard/browse code is written in Phase 2.

### [Major] Browse page filters have no composite index

**File:** `libs/bc/study/src/schema.ts:41-45`
**Issue:** Spec (Card browsing) says filters are: `user_id + domain + card_type + source_type + tags + front/back search`. The schema has three separate indexes:

- `(user_id, status)`
- `(user_id, domain)`
- `(user_id, created_at)`

No index covers `(user_id, card_type)`, `(user_id, source_type)`, or the common
case of "cards I filter by domain + card_type". Text search on `front`/`back` has
no trigram (pg_trgm) or GIN index.
**Impact:** With modest data volumes this is invisible. Once a user has 5k+ cards
the domain+type filter will need a bitmap scan; the search will full-scan.
**Fix:** Defer until Phase 2 lands the browse page so indexes can match the
queries actually written. Note in the spec/design that trigram search needs
`CREATE EXTENSION pg_trgm` (a migration step that `drizzle-kit push` will not
generate). If sticking with `push` in dev, document this out-of-band in
`docs/work-packages/spaced-memory-items/tasks.md` so it is not forgotten.

### [Major] Reviews cascade-delete with the card

**File:** `libs/bc/study/src/schema.ts:52-54, 76-78`
**Issue:** Both `review.card_id` and `card_state.card_id` use
`onDelete: 'cascade'`. Deleting a `card` row drops every review that card ever
had. The spec does not explicitly say "deleting a card preserves review history"
-- but it also does not say it erases it. Given that review data is the input
for future FSRS parameter optimization (design "Why" bullet), losing it is a
business-level concern, not just a data-modeling one.
**Impact:** Today, cards are never deleted by the BC -- spec uses `status = 'archived'`
for that. So cascade is academically correct but practically unreachable. The
concern is future code or admin actions that DELETE a card row bypass the
archive-only rule and silently destroy review history.
**Fix:** Two options:

1. Keep cascade, document it explicitly in the schema file, and add a BC-layer
   invariant "cards are archived, never deleted" plus a guard in the delete path.
2. Change `review.card_id` to `onDelete: 'restrict'` so an actual DELETE refuses
   if reviews exist. `card_state` can stay cascade (it is derived).

Recommendation: option 2, with a schema comment. Costs nothing, matches the
archive-only intent, and keeps future refactors from losing history.

### [Minor] `reviewedAt` does not use `defaultNow()` in `card_state` linkage

**File:** `libs/bc/study/src/schema.ts:73-92`
**Issue:** This is more about the spec than the code. Spec's `card_state` has no
`updated_at` or `created_at`. Implementation matches. In practice the `card_state`
row's freshness is `last_review_id -> review.reviewed_at`. If a card is created
but never reviewed, you cannot tell when the state row appeared.
**Impact:** Small. Dashboard queries ("cards added this week") must use
`card.created_at` instead. Document the intent so a future reader does not
"helpfully" add a `card_state.created_at` that diverges from `card.created_at`.
**Fix:** Add a one-line comment above `cardState` saying "no timestamps on
card_state -- use card.created_at and last_review_id -> review.reviewed_at".

### [Minor] `jsonb('tags').notNull().default([])` depends on Drizzle serializing `[]` to `'[]'::jsonb`

**File:** `libs/bc/study/src/schema.ts:32`
**Issue:** Spec says `tags jsonb DEFAULT '[]'`. Implementation passes a JS empty
array. Drizzle serializes this in the generated SQL as a jsonb literal, which
works with `drizzle-kit push` on modern Drizzle (0.44.x) -- but it is easy to
introduce drift if someone later writes `.default({})` or adds a non-serializable
value. Also, there is no check constraint ensuring `tags` is always an array
rather than an object.
**Impact:** Low today. Mild risk of surprising null-vs-empty-array behavior at
the application layer if a future migration or raw insert bypasses the default.
**Fix:** Use Drizzle's `$type<string[]>()` to lock the TS type:

```typescript
tags: jsonb('tags').$type<string[]>().notNull().default([]),
```

This matches the pattern already used in
`docs/products/hangar/features/traceability-matrix/design.md`. Optional but
removes a future footgun: without `$type`, `CardRow['tags']` is `unknown`.

### [Minor] No check constraints on enum-like text columns

**File:** `libs/bc/study/src/schema.ts:31-37, 56-62, 82`
**Issue:** `domain`, `card_type`, `source_type`, `status`, and `state` are all
`text` columns. Per design ("Domain taxonomy: constants, not DB enum") this is
deliberate -- the app validates at the application layer. But the spec-listed
rating range (1-4) and confidence range (1-5) are not enforced either.
**Impact:** A bug in the BC could write `rating: 99` or `state: 'learnign'` and
Postgres would accept it. Drizzle now supports check constraints natively.
**Fix:** Optional. Add CHECK constraints for numeric ranges on `rating` (1-4)
and `confidence` (1-5) via Drizzle's `check()`:

```typescript
rating: smallint('rating').notNull(),
// ...
(t) => ({
  ratingRangeCk: check('review_rating_range', sql`${t.rating} BETWEEN 1 AND 4`),
  confidenceRangeCk: check('review_confidence_range', sql`${t.confidence} IS NULL OR ${t.confidence} BETWEEN 1 AND 5`),
})
```

Text-enum check constraints (domain, state, etc.) are intentionally omitted per
the design decision. Document that in the schema file.

### [Minor] No FK from `card_state.last_review_id` to a review that belongs to the same card+user

**File:** `libs/bc/study/src/schema.ts:84`
**Issue:** `last_review_id` references `review.id`, but nothing enforces that the
referenced review is for the same `(card_id, user_id)` as the `card_state` row.
A bug could set `card_state.last_review_id` to a review of a different card.
**Impact:** Low -- writes go through the BC layer. But the FK relationship alone
is not tight.
**Fix:** Not worth a composite FK (Postgres would need a unique composite key on
`review` to support it, which means every review row gets an extra unique index).
Instead, add an assertion in `submitReview` that reads back the review row and
verifies `card_id` and `user_id` match before upsert. Or add a tx-level
invariant check. Document the invariant in a comment.

### [Minor] `drizzle-kit push` workflow leaves no migration artifact

**File:** `drizzle.config.ts`, `package.json` (db:push script)
**Issue:** Phase 1 was rolled out via `drizzle-kit push` per the phase brief. No
file in `drizzle/` tracks the schema change. For local dev this is fine and
matches the project's documented workflow. For production this means:

- There is no audit trail of what ran against prod.
- Drift between the TS schema and the deployed DB is invisible until the next
  push.
- Rolling back a change means editing the TS and pushing again, which does not
  work for destructive changes (column renames, column drops).

**Impact:** None today (no prod deploy). A speed bump once a deploy target exists.
**Fix:** Before the first deploy to any shared DB, switch to `drizzle-kit generate`
+ `drizzle-kit migrate` for the shared target and keep `push` for ephemeral dev
only. Add a note to `tasks.md` for Phase 2+.

### [Minor] Prefix conventions (`crd_`, `rev_`) are documented only in code, not in spec

**File:** `libs/utils/src/ids.ts:15-16`, `libs/bc/study/src/schema.ts:5`
**Issue:** Spec says `crd_` prefix and `rev_` prefix. Generator functions match:
`generateCardId` -> `crd_` and `generateReviewId` -> `rev_`. Good. But there is
no DB-level check that PK strings follow the prefix. A BC mistake (calling
`createId('card')` instead of `createId('crd')`) would produce a row that passes
type checks but breaks the prefix invariant.
**Impact:** Low. The specific generators live in one file and only that file
should call `createId(prefix)`. But if usage spreads, drift is easy.
**Fix:** Optional: add a CHECK constraint `card_id_prefix_ck CHECK (id LIKE 'crd\_%' ESCAPE '\')`.
Same for `review.id`. Not strictly necessary but future-proof.

### [Nit] `card_state` column order vs spec

**File:** `libs/bc/study/src/schema.ts:73-92`
**Issue:** Spec lists columns in the order:
`card_id, user_id, stability, difficulty, state, due_at, last_review_id, review_count, lapse_count`.
Implementation matches exactly. No finding. (Mentioning here because Phase 0
review included column-order observations and future reviewers may look.)

### [Nit] Some index names are unnecessarily long

**File:** `libs/bc/study/src/schema.ts:42-44, 68-69, 90`
**Issue:** `review_card_reviewed_idx`, `card_state_user_due_idx`, etc. Postgres's
default identifier limit is 63 characters, so all current names fit. As more
composite indexes land (`card_user_domain_type_source_idx`), be aware of the
limit.
**Impact:** None today.
**Fix:** None. Flagged for awareness.

## Clean

Verified clean:

- **Spec column conformance:** every column in spec.md tables matches the
  implementation by name, type, nullability, and default. Includes
  `card.is_editable boolean default true`, `card.status default 'active'`,
  `card.source_type default 'personal'`, timestamps with `withTimezone: true`
  and `defaultNow()`, `review.answer_ms integer NULL`, etc.
- **Type choices:** `real` for FSRS stability/difficulty (single-precision is
  ample for FSRS values and matches ts-fsrs output). `smallint` for rating and
  confidence is correct (1-byte savings x many reviews). `integer` for
  `review_count`, `lapse_count`, `answer_ms` is right-sized.
- **Timestamps:** every datetime column uses `{ withTimezone: true }` and
  `defaultNow()` where the spec demands. No naive timestamp drift risk.
- **Composite PK on card_state:** `primaryKey({ columns: [t.cardId, t.userId] })`
  is the correct choice -- it is the natural key for "one state per user per
  card" and prevents duplicate state rows by definition.
- **Indexes present and meaningful:** `card_state_user_due_idx (user_id, due_at)`
  covers the core review scan. `review_user_reviewed_idx (user_id, reviewed_at)`
  covers "reviewed today" aggregation. `review_card_reviewed_idx (card_id, reviewed_at)`
  covers per-card review history.
- **FK cascade rules on `card_id` from `review` and `card_state`:** cascade is
  appropriate once the "cards are archived not deleted" invariant is added at
  the BC layer. `last_review_id` uses `set null` which is correct (dropping a
  stale review should not wipe the card_state).
- **Schema namespace:** `pgSchema(SCHEMAS.STUDY)` is pulled from the constant
  (no magic string). `drizzle.config.ts` lists the new schema file and includes
  `STUDY` in the filter list.
- **Drizzle patterns:** `text` not `varchar` for IDs (correct for ULID-based
  prefixed strings). `jsonb` not `json` for tags (correct -- jsonb is indexable
  and validates on write). `$inferSelect` / `$inferInsert` exported for all
  three tables as `CardRow`/`NewCardRow`, `ReviewRow`/`NewReviewRow`,
  `CardStateRow`/`NewCardStateRow`.
- **Constants:** `DOMAINS` has 14 entries matching design.md exactly.
  `CARD_TYPES` has the four specified values. `REVIEW_RATINGS` uses 1-4 integers
  matching FSRS / ts-fsrs convention. `CARD_STATES` matches ts-fsrs state names.
  `CONFIDENCE_LEVELS` 1-5. All exported from `libs/constants/src/index.ts` with
  both the object, the `*_VALUES` array, and the TS type.
- **Naming:** snake_case for column names in Drizzle definitions, camelCase for
  TS identifiers -- matches project convention and spec column names exactly.
- **No magic strings:** default values (`'personal'`, `'active'`) use the string
  literals matching the constants. Ideally these would reference the constants
  (`CONTENT_SOURCES.PERSONAL`, `CARD_STATUSES.ACTIVE`) at the Drizzle layer, but
  Drizzle `.default()` accepts string literals only -- using the constant values
  directly would make this slightly safer. Low priority.
- **Prime directive:** no stubs, no TODOs, no "for now" in the schema or
  constants. The FSRS wrapper delegates to ts-fsrs rather than hand-rolling.
