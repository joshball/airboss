---
title: 'Final Schema Review: spaced-memory-items'
date: 2026-04-19
phase: final
category: schema
branch: build/spaced-memory-items
base: docs/initial-migration
reviewer: schema
status: unread
review_status: done
---

# Final Schema Review: spaced-memory-items

Scope: `git diff docs/initial-migration..HEAD` on branch `build/spaced-memory-items`.
Targets: `libs/bc/study/src/schema.ts` (card, review, card_state in the
`study` namespace), `libs/auth/src/schema.ts` (bauth_* in `public`),
`drizzle.config.ts`, and `libs/constants/src/{schemas,study,auth}.ts`.

This is the final end-of-feature schema pass. It supersedes the Phase 1
schema review ([2026-04-19-spaced-memory-items-phase-1-schema.md](2026-04-19-spaced-memory-items-phase-1-schema.md)),
re-checks every item against the spec's Data Model section, and treats the
intervening phases' schema touchpoints (Phase 2's `last_reviewed_at` addition,
the updated FK/cascade choices, the Drizzle `$type<string[]>()` on tags, and
the CHECK constraints) as new surface.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 1     |
| Minor    | 4     |
| Nit      | 3     |

Overall assessment: the schema lands in very good shape. Every Phase 1 Major
finding has been addressed in code:

- FKs on `user_id` now point at `bauth_user` on all three tables with correct
  cascade semantics.
- `review.card_id` uses `ON DELETE RESTRICT`, preserving review history if a
  card is ever hard-deleted.
- `card_state.card_id` cascades (state is derived) and `card_state.last_review_id`
  uses `ON DELETE SET NULL`.
- CHECK constraints enforce the enum-like text columns and numeric ranges.
- `tags jsonb` is typed `.$type<string[]>()` so `CardRow['tags']` is `string[]`.
- Phase 2 denormalized `card_state.last_reviewed_at` to fix FSRS `elapsed_days`;
  `submitReview` keeps it in sync on every write.

The one remaining Major is operational, not structural: no migration artifact
exists because the workflow is `drizzle-kit push`. That must be resolved before
any shared/prod deploy. Minors cluster around indexes that the dashboard and
browse pages would benefit from but do not yet need at current data volumes.

## Findings

### [Major] No migration artifacts -- `drizzle-kit push`-only workflow blocks any shared deploy

**File:** `drizzle.config.ts`, `package.json` scripts (`db:push`, `db:studio`).
**Issue:** There is no `drizzle/` directory in the repo. Every schema change
in this feature was applied via `drizzle-kit push` directly against local
Postgres. For a single-dev local workflow this is fine. For anything shared --
staging, prod, a second dev's machine, CI -- there is no ordered, committed
artifact to apply.

Concrete gaps:

- No audit trail of the sequence of DDL that built the current schema.
- Drift between `libs/bc/study/src/schema.ts` and any deployed DB is invisible
  until the next `push`, and `push` happily issues destructive statements
  (column drops, type changes) without prompting for confirmation in
  non-interactive contexts.
- Rollback is not defined. For additive changes you re-edit and push; for
  destructive changes there is no forward-fix path short of a manual SQL
  rescue.
- `CREATE EXTENSION` statements (e.g. `pg_trgm` if trigram search on
  front/back lands) cannot be expressed via `push` and will be silently absent
  on fresh databases.

**Impact:** None today (study runs on one local DB). Blocks the next step
whenever airboss gets a shared environment -- a day-zero problem, not a
never problem.

**Fix:** Before the first non-local deploy:

1. Run `drizzle-kit generate` once to produce a baseline migration capturing
   the current schema and commit the result under `drizzle/`.
2. Add `db:generate` and `db:migrate` scripts. Keep `db:push` for throwaway
   experimentation only.
3. Document the boundary in [docs/work-packages/spaced-memory-items/tasks.md](../../work-packages/spaced-memory-items/tasks.md)
   so this does not get forgotten when the `apps/firc` migration or any shared
   DB target appears.

This was flagged as Minor in the Phase 1 review. Promoted to Major here because
the feature is now shippable from every other angle, and this is the only item
that blocks the next realistic step.

### [Minor] Dashboard's "cards due now" scan still does a heap lookup per card to check `card.status`

**File:** `libs/bc/study/src/schema.ts:46-73, 108-135`, `libs/bc/study/src/stats.ts:107-112`, `libs/bc/study/src/cards.ts:188-203`.
**Issue:** The review-queue and dashboard due-now queries all look like:

```sql
SELECT ...
FROM study.card_state cs
JOIN study.card c ON c.id = cs.card_id AND c.user_id = cs.user_id
WHERE cs.user_id = $1
  AND cs.due_at <= now()
  AND c.status = 'active'
ORDER BY cs.due_at ASC
LIMIT 20;
```

`card_state_user_due_idx (user_id, due_at)` is the right access path for the
`cs` side. The join then fetches each matching `card` row by PK and filters on
`status`. `card_user_status_idx (user_id, status)` does not help this plan --
the join key is `card.id`, not `(user_id, status)`, so the planner walks the
PK and heap-loads `status` for every candidate card. Low-cardinality filter
(3 status values) applied after the random-access heap fetch.

**Impact:** Invisible at current scale. At 5-10k cards per user with a
non-trivial fraction of suspended/archived cards, the due-now scan pays a
heap fetch per non-active card inside the due set. The dashboard
`getDashboardStats` hits this path four times (`dueNow`, `stateCounts`,
`getDomainBreakdown`, and `getDueCardCount` via its own call site).

**Fix:** Two options, both deferred safely until data volume justifies them:

1. Denormalize `card.status` onto `card_state` and add a partial index:
   `card_state_user_due_active_idx ON study.card_state (user_id, due_at) WHERE status = 'active'`.
   Single-index range scan for the hot path. `setCardStatus` already exists in
   `libs/bc/study/src/cards.ts:244-257`; extending it to upsert the status
   onto `card_state` in the same transaction is a 5-line change.
2. Add a partial index on `card`: `card_user_id_active_idx ON study.card (user_id, id) WHERE status = 'active'`.
   Cheaper, keeps the join, lets the planner skip heap rows for non-active
   cards.

Recommendation: not yet. Schedule a follow-up task once a real user has
accumulated meaningful data. Option 1 is the long-term shape.

### [Minor] Browse filters have no composite index beyond `(user_id, domain)` and `(user_id, status)`

**File:** `libs/bc/study/src/schema.ts:65-68`, `libs/bc/study/src/cards.ts:210-241`.
**Issue:** The browse page (`apps/study/src/routes/(app)/memory/browse/+page.server.ts`)
accepts `domain`, `card_type`, `source_type`, `status`, and a free-text search
on `front`/`back`. Indexes present: `(user_id, status)`, `(user_id, domain)`,
`(user_id, created_at)`. No index covers:

- `(user_id, card_type)` -- appears in the `cards.ts:220` filter path.
- `(user_id, source_type)` -- same, `cards.ts:221`.
- `ilike('%query%')` on `front`/`back` -- this is a full table scan by
  definition without a trigram (pg_trgm) index. `cards.ts:222-226` escapes
  like-wildcards but there is no index to use.
- `ORDER BY card.updatedAt DESC` -- the query always sorts by `updated_at`
  but there is no `(user_id, updated_at)` index. It will sort in-memory
  after filtering, which is fine at small scale.

**Impact:** None at current volumes (single-digit test cards). At 1k+ cards
per user, `ilike` search will visibly stall the browse page on every
keystroke.

**Fix:** Defer per the Phase 1 recommendation. When trigram search goes in:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX card_front_trgm_idx ON study.card USING gin (front gin_trgm_ops);
CREATE INDEX card_back_trgm_idx  ON study.card USING gin (back  gin_trgm_ops);
```

`drizzle-kit push` cannot express the extension; this must be a managed
migration. See the Major finding.

### [Minor] `card.updated_at` is not maintained by the DB

**File:** `libs/bc/study/src/schema.ts:62-63`, `libs/bc/study/src/cards.ts:154, 252`.
**Issue:** `updated_at` has `defaultNow()` for INSERTs but no trigger or
Drizzle-level `$onUpdate` to refresh it on UPDATE. Today `updateCard` and
`setCardStatus` set it explicitly; any future UPDATE path that forgets will
leave `updated_at` stale. The browse page orders by `updated_at` so staleness
here means wrong-order rows.

**Impact:** Low while the BC is the only writer. Mild footgun if a script or
admin tool issues an UPDATE.

**Fix:** Either:

1. Add `.$onUpdate(() => new Date())` on the Drizzle column so Drizzle
   injects the value on every UPDATE automatically (preferred -- stays in the
   schema file, no trigger needed).
2. Add a Postgres trigger `set_updated_at` on the `card` table.

Option 1 is the cheapest and matches how Drizzle expects this to be handled.

### [Minor] `card_state.last_review_id` can reference a review row for a different card/user

**File:** `libs/bc/study/src/schema.ts:121`.
**Issue:** Carry-over from Phase 1. `last_review_id` is a simple FK to
`review.id`; nothing at the DB level enforces that the referenced review's
`(card_id, user_id)` matches the `card_state` row's `(card_id, user_id)`. A
composite FK would require a unique `(id, card_id, user_id)` index on
`review` to be the referenced key.

**Impact:** Low. Only `submitReview` sets this, and it always uses the review
it just inserted for the same `(card_id, user_id)` triple.

**Fix:** Not worth the extra unique index to get a composite FK. Acceptable
as-is; document the invariant in a short comment above the column and rely
on the BC as the single writer. The existing comment covers `last_reviewed_at`
but not this relationship.

### [Nit] `is_editable` is derivable from `source_type`

**File:** `libs/bc/study/src/schema.ts:60`, `libs/bc/study/src/cards.ts:106`.
**Issue:** `createCard` sets `isEditable: parsed.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL`
-- so by default `is_editable` is precisely "source is personal". The field
is storable independently but there is no current flow where the two diverge.
Spec supports either reading; implementation keeps it as a column because
"course/product cards show a read-only view."

**Impact:** None. Just a small amount of redundancy. Flagging because a
reader new to the schema will wonder why both exist.

**Fix:** None. Leave it. If a future requirement ("user can pin a
course-provided card as editable because they took notes on it") lands, the
separation earns its keep.

### [Nit] Text columns have no length cap at the DB layer

**File:** `libs/bc/study/src/schema.ts:53, 54, 59` (front, back, source_ref).
**Issue:** Spec's Validation section caps `front` and `back` at 10000 chars.
The Zod validator (`libs/bc/study/src/validation.ts:58` area) enforces that
on the write path. The DB column is unbounded `text`, so a raw insert that
bypasses Zod could stuff a 10MB payload into `front`.

**Impact:** None today (BC is the only writer). Belt-and-braces defense for
later.

**Fix:** Optional CHECK `CHECK (char_length(front) BETWEEN 1 AND 10000)`, or
switch to `varchar(10000)`. Either is fine; neither is urgent.

### [Nit] Index names are verbose but within the 63-char identifier limit

**File:** `libs/bc/study/src/schema.ts:66-68, 100-101, 132`.
**Issue:** `card_user_status_idx`, `review_card_reviewed_idx`, etc. -- all
within Postgres's 63-char identifier limit. Once indexes start combining 3-4
columns (`card_user_domain_type_source_idx`), watch the limit.

**Impact:** None today.

**Fix:** Flagged for awareness, no change needed.

## Checklist against review points

| # | Item | Status |
| -- | --- | --- |
| 1  | Column types match spec (text IDs, real stability/difficulty, smallint rating/confidence, jsonb tags, timestamptz) | Clean -- all exact matches |
| 2  | NOT NULL / DEFAULT / nullable correctness | Clean -- every spec row matches |
| 3a | card.user_id -> bauth_user.id ON DELETE CASCADE | Clean |
| 3b | card_state.card_id -> card.id ON DELETE CASCADE | Clean |
| 3c | card_state.user_id -> bauth_user.id ON DELETE CASCADE | Clean |
| 3d | card_state.last_review_id -> review.id ON DELETE SET NULL | Clean |
| 3e | review.card_id -> card.id ON DELETE RESTRICT | Clean -- preserves history per comment at `schema.ts:79-82` |
| 3f | review.user_id -> bauth_user.id ON DELETE CASCADE | Clean |
| 4  | Composite PK on card_state (card_id, user_id) | Clean (`schema.ts:131`) |
| 5  | Indexes per spec (card: user+status, user+domain, user+created; review: card+reviewed, user+reviewed; card_state: user+due) | Clean -- all present and correctly named |
| 6a | card CHECKs: card_type_check, card_source_type_check, card_status_check | Clean |
| 6b | review CHECKs: rating BETWEEN 1 AND 4, confidence NULL or 1-5, state in CARD_STATES | Clean |
| 6c | card_state CHECK: state in CARD_STATES | Clean |
| 7  | card_state.last_reviewed_at maintained by submitReview | Clean -- `reviews.ts:137` sets it on every upsert, `cards.ts:121` initializes to NULL |
| 8  | jsonb tags typed string[] via `.$type<string[]>()` | Clean (`schema.ts:56`) |
| 9  | Schema namespacing via SCHEMAS constant; schemaFilter covers public + 3 schemas | Clean -- `drizzle.config.ts:6-9` uses SCHEMAS constant |
| 10 | Migration workflow -- artifacts needed for prod | Major finding above |
| 11 | ID prefix not enforced at DB | Accepted as MVP trade-off |
| 12 | Text column length cap | Nit above |
| 13 | No timestamps on card_state (intentional, derived state) | Documented in file header comment |

## Clean (verified unchanged from Phase 1)

- Every spec column matches the implementation by name, type, nullability,
  and default.
- `real` for FSRS stability/difficulty, `smallint` for rating/confidence,
  `integer` for review_count/lapse_count/answer_ms -- all right-sized.
- Timestamps use `{ withTimezone: true }` and `defaultNow()` where spec
  demands.
- Composite PK on card_state is the correct natural key.
- All index names fit the 63-char identifier limit and are snake_case.
- No magic strings for default values -- `CONTENT_SOURCES.PERSONAL` and
  `CARD_STATUSES.ACTIVE` feed the Drizzle `.default(...)` expressions.
- CHECK constraint values come from the typed constants via `inList(...)`,
  so drift between the constant list and the CHECK is impossible without a
  re-push.
- `SCHEMAS.STUDY` drives both `pgSchema()` and the `drizzle.config.ts`
  `schemaFilter` -- no duplication.
- FSRS scheduler wiring (`cards.ts:92`, `reviews.ts:88-100`) reads/writes
  the denormalized `lastReviewedAt` correctly; the Phase 2 comment at
  `schema.ts:123-125` explains the denorm.
- Auth table surface (`bauth_user`, `bauth_session`, `bauth_account`,
  `bauth_verification`) is a read-only mirror of better-auth's tables and
  is correctly marked as such in the file header.
- No stubs, no "for now", no hardcoded shortcuts. Prime-directive-clean.

## Recommendations (priority order)

1. **Resolve the migration-artifact gap before any shared deploy.** Generate
   a baseline migration, commit it, and switch the shared-target workflow to
   `drizzle-kit migrate`. Keep `push` for local only.
2. Add `.$onUpdate(() => new Date())` to `card.updatedAt` so the column
   maintains itself under any future writer. Two-line change, high value.
3. When data volume starts to bite (5k+ cards or when the dashboard
   noticeably slows), add a partial index `card_state_user_due_active_idx`
   and denormalize `status` onto `card_state`.
4. Plan the browse-page trigram indexes (`pg_trgm`) -- they live outside
   `drizzle-kit push` and need a managed migration, so bundle with item 1.
