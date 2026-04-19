---
title: 'Phase 1 Architecture Review: spaced-memory-items'
date: 2026-04-19
phase: 1
category: architecture
branch: build/spaced-memory-items
commit: a3dbe04
reviewer: architecture
---

# Phase 1 Architecture Review

Phase 1 adds the study BC foundation: `libs/constants/src/study.ts` (enums +
tuning constants), `libs/bc/study/src/schema.ts` (card / review / card_state in
the `study` Postgres namespace), `libs/bc/study/src/srs.ts` (ts-fsrs wrapper),
9 FSRS tests, and the drizzle.config schema-list addition. Scope of this
review: architectural quality of those additions and the barrel they flow
through.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 1     |
| Minor    | 6     |
| Nit      | 3     |

Overall: Phase 1 is architecturally sound. Dependency direction stays clean
(`@ab/bc-study` depends only on `@ab/constants` + `ts-fsrs` + `drizzle-orm`),
the one-BC-not-three structure is correctly set up to absorb `scenarios.ts`
and `calibration.ts` in later phases, and the FSRS wrapper draws a crisp line
between the airboss-flavored surface and the upstream library. The findings
below are mostly about (a) the study constants arguably being BC-specific
rather than platform-wide and (b) small follow-ups the FSRS singleton leaves
for the "tune per user" future that the spec calls out.

## Findings

### [MAJOR] Study-specific constants are placed in `@ab/constants`, not in the BC

**File/area:** `libs/constants/src/study.ts` (116 lines), re-exported from
`libs/constants/src/index.ts:39-65`.
**Issue:** `libs/constants` today mixes two different kinds of constants:
platform concerns (ports, schema names, roles, routes, env vars, better-auth
endpoints) and BC-specific enums/tuning (DOMAINS, CARD_TYPES, CARD_STATES,
REVIEW_RATINGS, CONFIDENCE_LEVELS, MASTERY_STABILITY_DAYS, REVIEW_BATCH_SIZE,
REVIEW_DEDUPE_WINDOW_MS, CONFIDENCE_SAMPLE_RATE). Everything else in the
`@ab/constants` barrel is platform-wide -- any app or lib might legitimately
want `PORTS`, `ROUTES`, `SCHEMAS`, `ROLES`, `HOSTS`, `LOG_LEVELS`. By
contrast, `DOMAINS` / `CARD_TYPES` / `REVIEW_RATINGS` are knowledge about the
study BC. A future `@ab/bc-audio` or `@ab/bc-spatial` has no reason to know
those enums exist. Placing them in the shared constants lib inverts the usual
dependency direction -- `@ab/constants` is the universal leaf, so now every
downstream lib transitively carries study vocabulary.
**Impact:** Three concrete consequences:

1. `@ab/bc-study` today imports `CARD_STATES`, `CARD_TYPES`, etc. from
   `@ab/constants`. The BC owns the domain concept but reads its own
   vocabulary from the shared leaf. If a non-study consumer ever needs the
   constants, they should import from the BC, not from a shared box.
2. The `@ab/constants` barrel grows with every BC. When `scenarios.ts` and
   `calibration.ts` land, they add SCENARIO_STATES, CALIBRATION_BUCKETS, etc.
   -- the barrel becomes a directory of everything-anywhere.
3. The ADR-011 eventual-migration path (domains come from the graph) is
   harder to stage from the shared lib than from inside the BC, because
   rewrites in `@ab/constants` ripple everywhere.

**Fix:** Move BC-specific constants into `libs/bc/study/src/constants.ts`,
re-exported via the BC barrel (`@ab/bc-study`). Keep in `@ab/constants` only
what's genuinely cross-BC: `SCHEMAS`, `PORTS`, `ROUTES`, `ROLES`, `HOSTS`,
`ENV_VARS`, `DEV_*`, `BETTER_AUTH_*`, `MIN_PASSWORD_LENGTH`, `LOG_LEVELS`,
`DB_*`, `SESSION_MAX_AGE_SECONDS`, `SHUTDOWN_TIMEOUT_MS`.

Relocation is mechanical -- the BC schema and srs.ts already sit one step
away (`@ab/constants` is a cross-lib import); they become intra-lib imports
after the move. The only other consumers to follow-up on are the Phase 2+
route handlers that will read `DOMAINS` / `CARD_TYPES` for form validation;
they will import from `@ab/bc-study` instead. If you want to keep shared
vocabulary like `SCHEMAS.STUDY` in `@ab/constants` (it is shared -- drizzle.config
also needs it), that's fine; the line is "constants a non-study consumer
might legitimately want" -> platform, "constants only the study BC cares
about" -> BC lib.

### [MINOR] FSRS singleton blocks per-user parameter tuning without refactor

**File/area:** `libs/bc/study/src/srs.ts:59` (`const scheduler = fsrs()`).
**Issue:** The scheduler is constructed once at module load with default
parameters. The spec explicitly names "Beyond MVP: FSRS parameter
optimization from user review data" as a future, and the code comment on the
singleton acknowledges "if we ever let users tune their params, construct a
per-user instance instead." The price of that future is already sitting
here: the public function signature is `fsrsSchedule(state, rating, now)`,
with no seam for caller-supplied parameters. When per-user tuning lands, the
signature has to change, and every call site in the BC (not yet written) has
to thread a params argument through.
**Impact:** The wrapper today is frozen against default FSRS-5 weights. Any
future move to per-user tuning is a breaking change to the BC's internal
API, and a second one to the call sites that depend on it. Reviewing only
Phase 1 code, the footprint is tiny (one test file + the upcoming phases);
still, the cost is strictly cheaper to absorb now than after phases 2-4 have
built on the current shape.
**Fix:** Two options, preference listed first:

1. Accept an optional `params?: readonly number[]` on `fsrsSchedule` and
   `fsrsInitialState`. When undefined, use the module-level default
   scheduler; when supplied, construct a per-call `fsrs({ w: params })` (or
   cache by param hash). Zero impact on Phase 1 call sites; seam is there
   when needed. Matches ts-fsrs's `FSRSParameters.w` shape.
2. Introduce a `createScheduler(params?)` factory that returns
   `{ schedule, initialState, defaultParams }`. Heavier refactor but cleaner
   long-term -- "the scheduler" becomes a value, not a module.

Either change keeps the 9 existing tests passing. Skip this only if per-user
tuning is explicitly deferred past "Phase 5+ / never" in the spec.

### [MINOR] Schema constraints are missing on rating / confidence / state columns

**File/area:** `libs/bc/study/src/schema.ts:56-57, 62, 82`.
**Issue:** `rating` is `smallint`, `confidence` is `smallint`, `state` and
`cardState.state` are `text`, `card.status` is `text`, `card.cardType` is
`text`, `card.sourceType` is `text`, `card.domain` is `text`. The design doc
explicitly justifies `text` for `domain` (additive domains without
migrations) and the enum constants in `@ab/constants` back them, but the
schema itself has no `check` constraints enforcing that a row's `rating` is
actually `{1,2,3,4}`, its `state` is actually one of `{new, learning,
review, relearning}`, its `status` is actually one of `{active, suspended,
archived}`. Drizzle supports `check()` constraints in pg-core.
**Impact:** Validation is entirely application-layer. A buggy submit path
or a manual SQL query can land an invalid value and silently poison
downstream statistics (a `rating=7` row breaks `fsrsSchedule` inputs and
never throws at the DB). This is the same pattern airboss-firc uses and it
has not bitten there yet, but defense-in-depth at the schema layer is
cheap.
**Fix:** Add `check` constraints for the bounded-enum columns -- `rating IN
(1,2,3,4)`, `confidence IN (1,2,3,4,5) OR NULL`, `state IN ('new',
'learning', 'review', 'relearning')`, `status IN ('active', 'suspended',
'archived')`, `card_type IN ('basic', 'cloze', 'regulation',
'memory_item')`, `source_type IN ('personal', 'course', 'product',
'imported')`. Skip `domain` -- that one the design doc explicitly wants
open per the ADR-011 migration path. Drizzle pg-core exposes `check` as
the third arg of the table builder.

### [MINOR] `card_state (user_id, due_at)` index does not filter by card status

**File/area:** `libs/bc/study/src/schema.ts:90`.
**Issue:** The critical due-queue index is `card_state_user_due_idx` on
`(user_id, due_at)`. The actual due query (per design.md) is
`SELECT from card JOIN card_state WHERE due_at <= now()` -- i.e. it joins
back through `card.status = 'active'` to exclude suspended/archived cards.
`card_state` has no `status` column; the filter happens on `card`. Postgres
will thus fetch all rows where `(user_id, due_at)` is in range and then do
a hash/nested join to filter by status. As the corpus grows and the user
suspends or archives cards, the index returns rows the final query then
discards.
**Impact:** Low at MVP scale (20-card review sessions, a few hundred cards
per user). Grows with dataset; a user with 3000 cards and 500 archived
still scans the archived subset through this index. More importantly, the
index does not materialize the semantic intent ("give me due cards I'm
studying"), which is the query pattern that runs on every page load of the
review flow.
**Fix:** Either (a) add `status` to `card_state` (denormalize for the query
path; upsert on status change), and make the index
`(user_id, status, due_at)` with `status = 'active'` as a partial-index
filter (`WHERE status = 'active'`), or (b) keep the schema as-is and accept
the join + filter cost, since at Study MVP scale (target: a single user,
tens to low-hundreds of cards) this is not a meaningful difference. My
preference: (b) for Phase 1, but leave a code comment on the index that
names the tradeoff so the Phase 2 index-review revisits it once real card
counts exist. A partial index on `card_state` for just non-default
`due_at <= now()` slices is also an option after card volume is real.

### [MINOR] `review (card_id, reviewed_at)` and `(user_id, reviewed_at)` indexes: one may suffice

**File/area:** `libs/bc/study/src/schema.ts:68-69`.
**Issue:** Two btree indexes on the `review` table: one keyed by
`(card_id, reviewed_at)` (for per-card history: "show me the last N reviews
of this card") and one by `(user_id, reviewed_at)` (for stats: "reviews in
the last 7 days"). Both are defensible -- they answer different queries --
but they cost double on every insert. Each review row writes to both indexes
plus the PK.
**Impact:** At MVP scale insert cost is negligible. At projected scale
(one user, 20 reviews/day, ~7k/year), also negligible. But reviews are
write-heavy and the "per-card history" query (`reviewCardReviewedIdx`) is
rare -- it only fires when someone opens a card detail page, which is a
tiny fraction of review traffic.
**Fix:** Keep both for now; ADD a code comment that the per-card history
index is speculative and we should measure before defending it at scale.
If evidence comes in showing the per-card history query is run <1/100th
as often as the submit-review hot path, drop it -- `SELECT ... FROM review
WHERE card_id = $1 ORDER BY reviewed_at` against a modest per-card row
count is fine without an index.

### [MINOR] `card_state.lastReviewId` FK without index makes `onDelete: 'set null'` slow at scale

**File/area:** `libs/bc/study/src/schema.ts:84`.
**Issue:** `card_state.lastReviewId` has a foreign key to `review(id)` with
`onDelete: 'set null'`. There is no index on `last_review_id`. Postgres
does not auto-index FKs -- and `ON DELETE SET NULL` will do a seq-scan of
`card_state` on every deleted review row.
**Impact:** Low today (we don't delete reviews; "set null" is a failsafe).
But the shape is a known footgun. Even the "you never delete reviews"
story is not future-proof: GDPR / data-export-then-erase scenarios delete
per-user review history, which cascades into many card_state rows.
**Fix:** Add an index: `index('card_state_last_review_idx').on(t.lastReviewId)`.
One-line change, removes a future slow-delete landmine.

### [MINOR] No round-trip / schema integration test for `card`, `review`, `card_state`

**File/area:** `libs/bc/study/src/` has no `schema.test.ts`.
**Issue:** Phase 1 ships 9 FSRS tests that cover the library-math edges but
zero coverage for the schema itself: no insert/select round-trip, no FK
cascade verification, no `dueAt` timezone sanity test, no
`jsonb('tags').default([])` default-on-insert verification, no upsert path
for `card_state`. The test strategy doc (TEST-PRIORITY-MAP referenced in
Phase 0 review) specifically called out that BC tests are a P2 concern; the
schema wiring is the place the most-likely-to-surprise-you bugs live
(timezone, default-object mutation on `jsonb().default([])`, FK cascade
semantics).
**Impact:** Phase 2 will wire `cards.ts` / `reviews.ts` against this
schema. If any of the six issues above is wrong, Phase 2's integration
tests will catch it -- but they'll catch it after Phase 2 is built against
the wrong assumption, not while Phase 1 is fresh. The schema is also the
single piece of Phase 1 that has no explicit verification today; everything
else (`srs.ts`, `studySchema`, barrel) is covered.
**Fix:** Add `libs/bc/study/src/schema.test.ts` with 3-5 tests:
(a) insert a card, select it, compare round-trip; (b) insert a card + a
review + a card_state row keyed to both -- verify PK compositeness;
(c) delete a card, verify `review` rows cascade and `card_state` rows
cascade; (d) delete a review, verify `card_state.lastReviewId` goes to
null; (e) insert a card with default `tags` and `status`, verify defaults
materialize. Requires `@ab/db` client + a test DB setup -- if that harness
doesn't exist yet, it's a Phase 2 dependency anyway. Phase 1 can defer
this if the next phase owns "bring up integration-test harness for the
study schema."

### [NIT] `fsrsSchedule` splits inputs and outputs into different shapes

**File/area:** `libs/bc/study/src/srs.ts:14-32`.
**Issue:** `CardSchedulerState` (inputs) has `reviewCount` + `lapseCount` +
`lastReview`; `ScheduleResult` (outputs) has `elapsedDays` + `scheduledDays`
but not `reviewCount` / `lapseCount` / `lastReview`. The caller has to
reconstitute the next-state object themselves (see the test's
`fsrsSchedule -- bounds` round-trip). That's not wrong -- `reviewCount` and
`lapseCount` aren't FSRS outputs, they're caller bookkeeping -- but the
shape asymmetry does make the test longer and will make the `submitReview`
call site longer too ("take result, combine with some fields from input,
build new state").
**Fix:** Optional. Two shapes to consider:

1. Return `ScheduleResult & { nextState: CardSchedulerState }` so callers
   can write `result.nextState` directly into `card_state`. The bookkeeping
   (lapseCount++, reviewCount++, lastReview=now) is centralized once in the
   wrapper, not repeated at each call site.
2. Keep current shape; document the "construct next state from result"
   pattern in a comment + in the Phase 2 reviews.ts submitReview
   implementation.

Leaning (1) -- the wrapper is the one place that knows both sides and it's
better to encode the reconstitution once.

### [NIT] `drizzle.config.ts` lists two schema files; the Phase 0 review's glob suggestion is still open

**File/area:** `drizzle.config.ts:6`.
**Issue:** The `schema` array is now `['./libs/auth/src/schema.ts',
'./libs/bc/study/src/schema.ts']`. Phase 0's architecture review already
flagged this as a brittle manual registry and suggested glob-based
discovery. Phase 1's answer ("add the path") is fine, but no ground was
made on the underlying finding.
**Impact:** Phase 1 is within the "acceptable for now" window Phase 0 named.
But the growth curve is still linear with BCs: each future BC (scenarios,
calibration, graph, evidence, course on FIRC migration) adds a line. If
the team lands on (b)-document it in CLAUDE.md or best-practices.md, that
is a valid answer too.
**Fix:** Either follow the Phase 0 recommendation (glob-discovery), or
add a one-line checklist item in CLAUDE.md "Before shipping a new BC" that
names `drizzle.config.ts` schema entry as a mandatory addition. Current
state is explicit + readable + two entries, which is fine. Only worth
converting once the list crosses 4-5 entries, not at 2.

### [NIT] `studySchema` is exported from the BC barrel; verify the export is used or drop it

**File/area:** `libs/bc/study/src/index.ts:4`.
**Issue:** `studySchema` (the `pgSchema` object) is re-exported from
`@ab/bc-study`. It's useful for cross-schema query building (e.g.
`studySchema.table(...)` in an analytics BC, or raw schema-qualified
queries), but nothing in Phase 1 uses it outside `schema.ts` itself.
Exporting it signals "consumers may need this"; if in practice the
consumers just import the `card` / `review` / `cardState` table objects,
the export is dead.
**Impact:** None functional; minor surface bloat.
**Fix:** Keep the export if you expect consumers to build raw-SQL or
cross-schema queries. Drop it if not. Flag the decision either way -- at
Phase 2+ this becomes "someone reads `studySchema` in a stats query" or
"it's still exported and still unused." Re-evaluate once reviews.ts and
stats.ts exist.

## Clean

- **Lib placement for schema + srs is correct.** `libs/bc/study/src/schema.ts`
  and `libs/bc/study/src/srs.ts` are inside the BC, not in shared libs. They
  import only from `@ab/constants` (platform leaf) and `ts-fsrs`
  (third-party) + `drizzle-orm`. No upward imports, no reaching into another
  BC.
- **One-BC-not-three structure is ready for `scenarios.ts` + `calibration.ts`.**
  Adding a new sibling file under `libs/bc/study/src/` is a drop-in: no
  directory reshuffle, no import rewrites, no schema file split. The barrel
  exports a flat API surface which scales cleanly by appending exports.
- **Cross-lib imports are consistent.** Every cross-lib import uses the
  `@ab/*` alias. `srs.ts` imports only `@ab/constants` and `ts-fsrs`; the
  test file imports `@ab/constants` and the local relative `./srs`. No
  subpath imports, no relative cross-lib paths, no reach-around into
  `libs/*/src/*`.
- **ts-fsrs choice is architecturally sound.** 23 KB of type definitions +
  58 KB ESM bundle for the FSRS-5 algorithm is cheap, MIT-licensed, is the
  library the design doc explicitly cites, and avoids the spec's "~100 lines
  of math" turning into 100 lines of wrong math. The wrapper file is the
  right abstraction boundary: ts-fsrs types never escape `srs.ts`, and the
  BC's downstream consumers see only airboss-native types. Upgrade churn is
  manageable -- the wrapper is the one place to change if ts-fsrs breaks
  API compat, and the 9 tests cover the translation edges.
- **FSRS enum mapping is defensive.** `RATING_TO_TS`, `STATE_TO_TS`, and
  `STATE_FROM_TS` use the enum values as keys, not positional integers, so
  ts-fsrs can reorder its internal enum without breaking us. Tests cover the
  round-trip.
- **Type exports do not collide with ts-fsrs `Card`.** The BC barrel exports
  `CardRow` / `NewCardRow` (Drizzle row types) and not a bare `Card` type.
  The ts-fsrs `Card` type stays scoped inside `srs.ts` and never leaks
  through the barrel. Good separation: Drizzle rows have one name shape
  (`CardRow`), scheduler state has another (`CardSchedulerState`), and
  results have a third (`ScheduleResult`). A downstream consumer can never
  accidentally mistake "a card row from the DB" for "an FSRS Card."
- **`studySchema = pgSchema(SCHEMAS.STUDY)` placement is right.** The schema
  object is declared once in `schema.ts` where the tables are declared, not
  in a separate file. It reads through `SCHEMAS.STUDY` not an inline
  string. Import direction is correct (`@ab/bc-study` -> `@ab/constants`).
- **Barrel file is tidy.** Seven exports: six type aliases + one schema
  object + three tables + three scheduler functions + two scheduler types.
  Every one is named, every one is useful, no re-export-everything pattern.
- **DOMAINS-vs-ADR-011 flag is present.** The file-level comment on
  `study.ts` names the eventual graph takeover. The flag is adequate as
  documentation; firmer gating (runtime migration path, deprecation
  markers) is premature until the graph actually lands per ADR-011.
- **FSRS test suite covers the meaningful edges.** New-card promotion,
  lapse-state transition, interval ordering (Easy > Good), difficulty
  bounds over 20 iterations, finite/non-negative scalar outputs. The one
  gap is the schema layer itself (see finding).
- **Index choices for `card` are appropriate.** `(user_id, status)` and
  `(user_id, domain)` are the two browse-page filter axes per design.md;
  `(user_id, created_at)` supports "recent" ordering. No obviously missing
  index for Phase 1 query patterns; the three-index set matches the browse
  use case.
- **FK cascade semantics are correct.** `review.cardId -> card(id)` with
  `onDelete: 'cascade'` means archiving a card by delete takes its history;
  `cardState.cardId -> card(id)` same. `cardState.lastReviewId -> review(id)`
  with `onDelete: 'set null'` is the only correct answer (you can't cascade
  a card_state delete off a review delete without orphaning the card).
- **Review dedupe window + confidence sample rate live in the right place.**
  They're tuning constants that the BC applies -- the correct layer, just
  possibly the wrong lib (see Major finding re: constants placement).
  Naming is clear, comments explain the deterministic-hash intent.
- **Review row is a full FSRS snapshot.** `stability`, `difficulty`,
  `elapsedDays`, `scheduledDays`, `state`, `dueAt` all captured -- this is
  exactly the shape needed for "retrain FSRS weights from user history"
  (the Beyond-MVP goal the spec names). Zero retrofit needed when that
  phase starts.
