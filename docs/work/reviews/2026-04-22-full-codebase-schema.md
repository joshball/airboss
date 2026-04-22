---
feature: full-codebase
category: schema
date: 2026-04-22
branch: main
issues_found: 14
critical: 1
major: 5
minor: 5
nit: 3
---

## Summary

The study schema is cohesive, well-documented, and internally consistent. ULID-prefixed ids flow through `@ab/utils`, CHECK constraints mirror the `@ab/constants` value sets, and the ADR-012 phase-4/phase-5 changes (`rep_attempt` drop, `session_item_result` rep-outcome columns + two aggregator indexes) are in place and match the calibration/dashboard query shapes. The main real gap is that `session_item_result.user_id` is denormalized for aggregator speed but has no foreign key -- it can drift from `session.user_id`, which is the single correctness risk worth calling out. Secondary findings are all about schema hygiene: the `SCHEMAS.AUDIT` namespace is in the drizzle filter but no table uses it; `cardState` has no `updatedAt`; the partial UNIQUE index for "one active plan per user" lives in a hand-applied SQL file that is not wired into a repeatable migration pipeline; a handful of FKs to `bauth_user` omit `onUpdate`, which matters if better-auth ever rotates user ids. No FK is missing on a write-path column, and every hot aggregator column is index-covered.

## Issues

### CRITICAL: session_item_result.user_id has no FK and can drift from session.user_id

- **Table**: `study.session_item_result`
- **Column**: `user_id`
- **Problem**: Declared as `text('user_id').notNull()` with no `.references(...)`. Every other user-scoped table (`card`, `review`, `card_state`, `scenario`, `study_plan`, `session`) points `user_id` at `bauth_user.id`. The comment says "Denormalized for per-user aggregate queries (streak)," which is fine for speed, but denormalization without a FK and without a trigger/check tying it to `session.user_id` lets a buggy insert write a row whose `user_id` disagrees with `session.user_id`. Aggregators (`calibration.ts`, `dashboard.ts`, `knowledge.ts`) all trust this column -- a mismatch silently attributes rep outcomes to the wrong user.
- **Rule**: CLAUDE.md "All relationships have explicit foreign key constraints." ADR 012 makes this table the single source of truth for rep outcomes.
- **Fix**: Add `.references(() => bauthUser.id, { onDelete: 'cascade' })` to `sessionItemResult.userId`, and either (a) add a CHECK that references `session.user_id` via a trigger, or (b) add a composite FK `(session_id, user_id) REFERENCES session(id, user_id)` -- the latter is cleanest but requires a composite UNIQUE on `session(id, user_id)` (already unique because `id` is the PK; Postgres will accept the composite FK against a superset). Either way, the write path in `sessions.ts` is already setting both consistently, so the migration risk is zero on current data.

### MAJOR: partial UNIQUE index "plan_user_active_uniq" is not part of a tracked migration pipeline

- **Table**: `study.study_plan`
- **Column**: `(user_id) WHERE status = 'active'`
- **Problem**: The invariant "one active plan per user" is enforced by `scripts/db/plan-active-unique.sql`, which `scripts/db/apply-sql.ts` runs ad-hoc. There is no `drizzle/` migrations directory, no numbered migration, and no reference to this SQL from `drizzle.config.ts`. Fresh environments that run only drizzle-kit push/generate will ship without the backstop. The BC comment in `plans.ts` and the schema docstring call this index "the backstop" -- the backstop that isn't guaranteed to exist is the known issue CLAUDE.md prohibits.
- **Rule**: CLAUDE.md "Zero tolerance for known issues. A stub is a known issue." Also: Drizzle supports partial indexes in the table DSL via `uniqueIndex('...').on(table.userId).where(sql\`status = 'active'\`)` as of drizzle-orm 0.30+.
- **Fix**: Express the index in Drizzle directly:

	```typescript
	import { uniqueIndex } from 'drizzle-orm/pg-core';
	// inside studyPlan's second-arg table config:
	planUserActiveUniq: uniqueIndex('plan_user_active_uniq')
		.on(t.userId)
		.where(sql`status = 'active'`),
	```

	Then retire `plan-active-unique.sql` (or keep it as a one-time backfill guarded by `IF NOT EXISTS`).

### MAJOR: SCHEMAS.AUDIT declared but no audit namespace or tables exist

- **Table**: (namespace) `audit`
- **Problem**: `drizzle.config.ts` lists `SCHEMAS.AUDIT` in `schemaFilter`, and the constant exists, but no `pgSchema('audit')` is declared anywhere and no table references it. Every write path in the study BC (card create/update, scenario edits, plan edits, session runs) is un-audited. CLAUDE.md calls out audit columns as part of schema review, and `docs/agents/` references an `audit` BC.
- **Rule**: CLAUDE.md "Do content tables support version history (per `libs/audit/` patterns)? Is every content edit tracked and recoverable?" Also ADR 004 (namespaces).
- **Fix**: Either (a) drop `SCHEMAS.AUDIT` from the filter until the audit BC lands, so the constant reflects reality, or (b) add the audit schema + an `audit.change_log` table (actor_id, table_name, row_id, op, before, after, occurred_at) and wire a minimal interceptor into the write paths. Option (a) is a 2-line fix and the right move for today; option (b) is the longer-scope correct move when audit is on the roadmap.

### MAJOR: SCHEMAS.IDENTITY declared but better-auth tables live in `public`

- **Table**: (namespace) `identity`
- **Problem**: `auth/src/schema.ts` says "These live in the default public schema since better-auth does not support PostgreSQL schema namespaces" and the tables are declared with `pgTable(...)` (public). `SCHEMAS.IDENTITY = 'identity'` is in the filter but unused. Same drift shape as AUDIT.
- **Rule**: ADR 004 namespaces; CLAUDE.md "Schema namespaces: `identity`, `audit`, `study` (more added as BCs grow)."
- **Fix**: Either rename `SCHEMAS.IDENTITY` -> drop it and call the home of better-auth tables what it is (`public`), or accept the comment: document in `schemas.ts` that `IDENTITY` is reserved for future non-better-auth identity tables. The file's current state -- constant exists, nothing uses it, filter references it -- is a trap for the next contributor.

### MAJOR: card_state has no updated_at timestamp

- **Table**: `study.card_state`
- **Column**: (missing) `updated_at`
- **Problem**: The docstring says "no created_at/updated_at: it is a materialized projection... reviewedAt of the latest review is the relevant timestamp." That works when the only writer is "apply review -> update state," but `lastReviewedAt` is the timestamp of the *last review*, not the last state mutation. A migration that rewrites stability/difficulty formulas, a lapse-count backfill, or a manual correction would change the row without changing `lastReviewedAt`. Debugging "why does this card's stability disagree with its review log?" becomes hard.
- **Rule**: CLAUDE.md "Is there an `updated_at` column where appropriate?" Every other mutable projection in the codebase has one.
- **Fix**: Add `updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()` with an explicit set in `reviews.ts` on the upsert. Keep `lastReviewedAt` as-is -- they answer different questions.

### MAJOR: card.node_id index order puts userId first, hurting node-scoped listings

- **Table**: `study.card`
- **Column**: index `card_user_node_idx` on `(user_id, node_id)`
- **Problem**: `knowledge.ts` has two node-scoped reads: `getCardsForNode(nodeId, userId)` and `listNodeSummaries` which computes `SELECT count(*) FROM card WHERE c.node_id = $node AND c.user_id = $user`. The current index covers the second filter only as a trailing seek; a plain `(user_id, node_id)` index is good for "all cards for a user grouped by node" but not ideal for "all users with a card on this node." The stronger index for the query shapes the BC actually runs is `(node_id, user_id)`: selective on node first (one node out of 30+), then user. The first access path ("user's cards attached to this node") uses the prefix of either order, so it is not regressed.
- **Rule**: "Composite indexes ordered correctly? (Most selective column first)."
- **Fix**: Reorder to `index('card_node_user_idx').on(t.nodeId, t.userId)`. Keep the other three indexes as-is. If both shapes are needed, add a second partial `(node_id, user_id) WHERE node_id IS NOT NULL` -- personal cards (node_id NULL) stay out of it.

### MINOR: knowledge_node is authored content with no author column, no version, no "published vs draft" split

- **Table**: `study.knowledge_node`
- **Problem**: The graph is built from `course/` markdown by the seed script; the DB row is the runtime copy. There is no `author`, no `content_hash`, no `version`, no distinction between "the latest build" and "previously built." ADR 005 (published content versioning) is about `published` releases, not this graph, so the ADR doesn't directly apply -- but the pattern gap is the same: a learner who completed node `airspace-vfr-minimums` v1 has no way to know the content changed in v2. `updatedAt` is all we have.
- **Rule**: ADR 005 spirit; CLAUDE.md "Is content versioning preserved? Can you answer 'which version did this user complete?'"
- **Fix**: Add a `content_hash: text` column (sha256 of `contentMd` + frontmatter) populated by the seed script; add a `version: integer notNull default 1` that bumps on upsert when the hash changes. A future `knowledge_node_version` table can hold the history when the need arrives -- the hash alone unblocks "did this node change since the user last saw it?"

### MINOR: review.rating has no PG enum, only a CHECK on the magic numbers 1..4

- **Table**: `study.review`
- **Column**: `rating` (smallint) + `review_rating_check` (`BETWEEN 1 AND 4`)
- **Problem**: The rating is ts-fsrs's AGAIN/HARD/GOOD/EASY. The CHECK encodes the range, but the semantic mapping lives only in `REVIEW_RATINGS` in `@ab/constants`. A reader of the schema alone sees "1..4, means what?" This is the one place where a PG enum (or a named check like `review_rating_check` using `IN (1,2,3,4)` with a comment pointing at the constant) would actually help -- confidence uses the same pattern but has a clearer "1=least, 5=most" intuition.
- **Rule**: CLAUDE.md "Are enum types defined in Drizzle (not just string columns)? Do enum values match constants?"
- **Fix**: Either (a) swap `smallint` for `pgEnum('review_rating', ['again','hard','good','easy'])` and store labels, or (b) keep the numeric column and add a `COMMENT ON COLUMN study.review.rating IS 'ts-fsrs 1=AGAIN 2=HARD 3=GOOD 4=EASY'`. Option (b) is lower-risk given ts-fsrs takes numbers in.

### MINOR: scenario.difficulty CHECK constrained but no index on (user_id, difficulty)

- **Table**: `study.scenario`
- **Column**: `difficulty`
- **Problem**: `scenarios.ts` list/filter paths accept a difficulty filter. Current indexes are `(user_id, status)`, `(user_id, domain)`, `(user_id, created_at)`, `(user_id, node_id)`. Difficulty is low-cardinality so the benefit is marginal on small backlogs; on a learner with 500 scenarios it matters.
- **Rule**: "Do columns used in WHERE clauses have indexes?"
- **Fix**: Add `index('scenario_user_difficulty_idx').on(t.userId, t.difficulty)` only if the list queries actually use the filter (verify in `scenarios.ts` before adding -- otherwise skip). A second option is a partial index on `(user_id, domain) WHERE status = 'active'` which covers most active-scenario reads regardless of difficulty.

### MINOR: knowledge_edge.targetExists has no default on the UPDATE path; only build script refreshes it

- **Table**: `study.knowledge_edge`
- **Column**: `target_exists`
- **Problem**: New edges are inserted with `targetExists: false` (seen in `replaceNodeEdges`). The `refreshEdgeTargetExists` function runs an UPDATE to recompute. If a new node is authored between `replaceNodeEdges` and `refreshEdgeTargetExists`, edges pointing at it stay `false` until the next full build. Render-time queries that filter on `target_exists = true` will show a false "gap" banner.
- **Rule**: Data integrity: stored booleans maintained outside the DB drift.
- **Fix**: Either (a) compute `target_exists` on write with a `CASE WHEN EXISTS(SELECT 1 FROM knowledge_node WHERE id = from_node_id) THEN true ELSE false END` subselect in the insert, or (b) replace the column with a generated/virtual expression via a VIEW (`knowledge_edge_resolved`) that LEFT JOINs knowledge_node. Option (b) is the "do the right thing" fix -- a materialised column that the build script must remember to refresh is a stub shaped like a column.

### MINOR: session.focus_override / cert_override are free-text, not CHECKed against DOMAIN_VALUES / CERT_VALUES

- **Table**: `study.session`
- **Columns**: `focus_override`, `cert_override`
- **Problem**: Both are `text`, nullable, no CHECK. Every other domain- or cert-bearing column in the schema either gets a CHECK (scenario.phase_of_flight -> PHASE_OF_FLIGHT_VALUES, card_state.state -> CARD_STATE_VALUES) or is a typed jsonb ($type<Domain[]>). Engine code validates these on the way in, but a hand-run INSERT or a future engine bug can insert garbage.
- **Rule**: "Check constraints for bounded enums when you can't use PG enums."
- **Fix**: Add `focusOverrideCheck` and `certOverrideCheck` of the shape `"focus_override" IS NULL OR "focus_override" IN (...DOMAIN_VALUES...)`, same pattern as `sir_skip_kind_check`.

### NIT: session_item_result confidence/answer_ms CHECKs are correct but could reuse review's expression

- **Table**: `study.session_item_result`
- **Columns**: `confidence`, `answer_ms`
- **Problem**: `sir_confidence_check` (`IS NULL OR BETWEEN 1 AND 5`) and `sir_answer_ms_check` (`IS NULL OR >= 0`) are correct and match `CONFIDENCE_LEVEL_VALUES` and the user-input contract. `review.confidence` uses the same CHECK shape. The parallel check names are harmless but a shared helper (`confidenceCheck(colName)`) would keep the two in lockstep.
- **Rule**: Style.
- **Fix**: Extract a `confidenceRangeCheck(name, column)` + `nonNegativeDurationCheck(name, column)` helper in `schema.ts`. Optional cleanup; current state is fine.

### NIT: FKs to bauth_user have onDelete but no onUpdate

- **Table**: every user-scoped table (`card`, `review`, `card_state`, `scenario`, `study_plan`, `session`, and once fixed, `session_item_result`)
- **Column**: `user_id`
- **Problem**: `references(() => bauthUser.id, { onDelete: 'cascade' })` omits `onUpdate`. Default is `NO ACTION`. better-auth uses stable ids today, but if admin tooling ever renames a user (merging duplicates, for example), the rewrite fails on every child FK rather than cascading.
- **Rule**: CLAUDE.md "`onDelete` + `onUpdate` cascades are declared intentionally."
- **Fix**: Add `onUpdate: 'cascade'` to every user-scoped FK. Same call for `card_id`, `plan_id`, `session_id`, `scenario_id`, and `review_id` references -- the ULIDs don't rotate, but declaring intent matches the convention.

### NIT: studyPlan.session_length and sessionLength on session duplicate MIN/MAX bounds checks in two places

- **Table**: `study.study_plan`, `study.session`
- **Columns**: `session_length`
- **Problem**: `study_plan.session_length` has `plan_session_length_check BETWEEN MIN_SESSION_LENGTH AND MAX_SESSION_LENGTH`. `session.session_length` has no CHECK at all. Sessions are authored by the engine from plan.session_length plus overrides; a bug in override handling could produce out-of-range values.
- **Rule**: Parallel columns get parallel CHECKs.
- **Fix**: Mirror the CHECK on `session.session_length` with the same bounds. Trivial.

## Verified clean

The following were specifically called out in the scope and check out:

- **session_item_result.confidence CHECK**: `"confidence" IS NULL OR "confidence" BETWEEN 1 AND 5` -- correct, matches `CONFIDENCE_LEVEL_VALUES` (1..5) and nullable semantics for non-rep/uncompleted rows.
- **session_item_result.answer_ms CHECK**: `"answer_ms" IS NULL OR "answer_ms" >= 0` -- correct.
- **sir_user_kind_completed_idx** on `(user_id, item_kind, completed_at)` -- exactly what `calibration.ts` / `dashboard.ts` / `knowledge.ts` rep-aggregator queries filter on. Confirmed by grep against those files.
- **sir_scenario_completed_idx** on `(scenario_id, completed_at)` -- exactly what `getRepBacklog` needs for its LEFT JOIN aggregation.
- **rep_attempt table dropped + rep_attempt_id FK dropped** -- schema shows no trace; all call sites in calibration/dashboard/knowledge read from `sessionItemResult` with `itemKind = REP` predicates.
- **Partial UNIQUE for active plan** -- present as raw SQL (`plan-active-unique.sql`), invariant holds -- but see MAJOR above for the tracking gap.
- **No orphan-on-delete cases**: `scenario` cascades from user; `session_item_result.scenario_id` is `set null` so history survives scenario delete; `review.card_id` is `restrict` so review history cannot be silently lost; `card_state.last_review_id` is `set null`. All intentional and documented.
- **Reference system (PR #43)**: `libs/aviation/src/` contains TypeScript types, a validator, and an in-memory registry. No Drizzle tables were added, so no schema review applies.
- **Sim BC (PR #37)**: `libs/bc/sim/` is FDM + scenario runners in memory -- no DB tables.
- **IDs**: every PK is `text('id').primaryKey()` populated via `@ab/utils` ULID generators. No `nanoid()` / `ulid()` direct calls found in schema or seed scripts.
