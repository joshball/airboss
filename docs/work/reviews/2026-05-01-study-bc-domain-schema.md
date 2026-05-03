---
feature: study-bc-domain
category: schema
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 5
  minor: 6
  nit: 4
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----: | -----: | ---: |
| critical |     0 |      0 |    0 |
| major    |     5 |      4 |    1 |
| minor    |     6 |      1 |    5 |
| nit      |     4 |      0 |    4 |

### MAJOR: scenario_option.scenario_id leading-column index -- CLOSED

Self-closed by the original review (re-classified as a documentation NIT). The `(scenario_id, position)` partial unique still serves as the leading-column index. Closed.

### MAJOR: session_item_result.chosen_option_id FK index -- CLOSED

`libs/bc/study/src/schema.ts:906` adds `sirChosenOptionIdx: index('sir_chosen_option_idx').on(t.chosenOptionId)` with a partial `WHERE chosen_option_id IS NOT NULL` clause -- the partial-index variant the original review preferred. Closed.

### MAJOR: review.review_session_id FK index -- CLOSED

Self-closed by the original review (downgraded to no-fix). Existing `(review_session_id, card_id)` prefix is sufficient. Closed.

### MAJOR: card.updated_at orderBy not index-backed -- CLOSED

`libs/bc/study/src/schema.ts:360`. `cardUserUpdatedIdx: index('card_user_updated_idx').on(t.userId, t.updatedAt)`. Closed.

### MAJOR: goal.updated_at orderBy not index-backed -- CLOSED

`libs/bc/study/src/schema.ts:2106`. `goalUserUpdatedIdx: index('goal_user_updated_idx').on(t.userId, t.updatedAt)`. Closed.

### MAJOR: card_feedback (card,user) ORDER BY created_at not covered -- CLOSED

`libs/bc/study/src/schema.ts:1200`. `cardFeedbackUserCardCreatedIdx: index('card_feedback_user_card_created_idx').on(...)`. Closed.

### MAJOR: knowledge_node missing updater audit column -- STILL OPEN

`libs/bc/study/src/schema.ts:225` still tracks only `author_id`. No `last_edited_by` column. Trigger: when the knowledge-node-version table referenced in the column comment ships, add `lastEditedById` at the same time, OR open a small "knowledge-node audit" WP if the version-table work is deferred further.

### MINOR: knowledge_edge no DB-level self-loop guard -- CLOSED

`libs/bc/study/src/schema.ts:322`. `noSelfLoopCheck: check('knowledge_edge_no_self_loop_check', sql.raw(\`"from_node_id" <> "to_node_id"\`))`. Mirrors `credential_prereq`. Closed.

### MINOR: knowledge_node.lifecycle no NOT NULL / safe default -- STILL OPEN

`libs/bc/study/src/schema.ts:225` still nullable with default. CHECK still has `IS NULL OR ...`. Trigger: confirm every environment has run the back-fill seed; then in the next schema-cleanup migration, add `.notNull()` and tighten the CHECK to drop the `IS NULL OR` branch.

### MINOR: knowledge_node.references_v2_migrated dead-end column -- STILL OPEN

`libs/bc/study/src/schema.ts:235` column comment still ends with "a follow-on cleanup can drop it" with no WP pointer or trigger condition. Trigger: roll into the schema-cleanup pass with `lifecycle` notNull tightening.

### MINOR: study_plan.cert_goals @deprecated trigger -- STILL OPEN

Trigger: when the engine-goal-cutover WP's verify phase ships dual-read telemetry showing `source='plan'` reads at zero for 14 consecutive days, drop the column. Today the dual-read telemetry exists (`emitEngineTargetingTelemetry`) but the daily query / dashboard isn't documented. Roll into the cutover WP's verify phase.

### MINOR: card.nodeId graph-linked composite UNIQUE -- STILL OPEN

`libs/bc/study/src/schema.ts:578` has `scenarioUserNodeIdx` (non-unique). No partial UNIQUE on `(user_id, node_id) WHERE node_id IS NOT NULL` for cards. Trigger: confirm with spec whether multiple cards per (user, node) is intentional; if not, add the partial unique.

### MINOR: knowledge_node.relevance jsonb GIN index -- STILL OPEN

Forward-looking note. Trigger: when a "nodes relevant to cert X" reverse-containment read appears in the BC.

### NIT: composite-fks.schema.test.ts cross-reference comment -- STILL OPEN

No comment added pointing at `scenario-option.schema.test.ts`. Trigger: small docs-polish PR.

### NIT: scenario_option.text shadows JS `text` import -- STILL OPEN

Pure cosmetic. Trigger: if a scenario_option migration is needed for unrelated reasons, rename then.

### NIT: knowledge_node_progress surrogate `id` -- STILL OPEN

Trigger: if a future migration touches the table.

### NIT: mrs `last_activity_at` ordering not index-leading -- STILL OPEN

`libs/bc/study/src/schema.ts:1026` `mrs_user_started_idx` still leads on `started_at`, not `last_activity_at`. Per-user session count bounded; in-memory sort cheap. Trigger: when review-sessions list rendering shows up in p95s.

### Final verdict

4 of 5 majors closed (3 indexes added + 1 self-closed by original review). 1 of 6 minors closed (knowledge_edge self-loop CHECK). The remaining major (knowledge_node updater audit column) ties to the deferred knowledge_node_version table work. `review_status` flipped to `done`.

## Summary

The study BC schema is dense, well-commented, and disciplined about CHECK enforcement, partial UNIQUE indexes, composite FKs, and ON DELETE behavior. ID generation routes through `@ab/utils` (no raw `nanoid`/`ulid` calls in the schema files themselves), enums are validated by CHECKs against `@ab/constants` value lists, and citation/jsonb columns carry GIN indexes where reverse-containment queries exist.

The findings cluster around four themes: (1) several FK columns lack covering indexes, so DELETE/UPDATE on the parent and reverse lookups fall back to sequential scans; (2) a few hot-path queries (`orderBy(desc(card.updatedAt))`, `goal.updatedAt`, `card_feedback (card,user) ORDER BY created_at DESC`, `review (user) WHERE confidence IS NOT NULL`) order or filter on columns that are not the trailing column of any usable index; (3) the schema lacks `created_by`/`updated_by` audit columns on authored content (`knowledge_node` carries `author_id` only, with no edit-time updater pointer); (4) a handful of documented invariants are enforced only at the BC layer when a small DB-level guard would close them off (knowledge_edge.fromNodeId === toNodeId self-loops, card.nodeId/userId composite for graph-linked cards). No data-integrity-class issues found.

## Issues

### MAJOR: scenario_option.scenario_id has no leading-column index

Table: `study.scenario_option`
Column: `scenario_id`
Problem: `scenarioOptionScenarioPositionUnique` is `(scenario_id, position)` and serves as the leading-column index for `scenario_id`-only lookups, so this is index-backed. However, `scenarioOptionCorrectUnique` is partial on `(scenario_id) WHERE is_correct=true` and only rarely covers the read shape used by `getScenarioOptions` (`scenarios.ts:447-449`) and `countScenarioOptionsByScenario` (`scenarios.ts:478-481`). Confirmed: position-unique index is sufficient as a leading prefix. Re-classifying as a NIT documentation point: the schema comment near `scenario_option` does not call out that `(scenario_id, position)` is the de facto FK index. Recommend a one-line comment so a future reader does not add a redundant `scenario_option_scenario_idx`.
Rule: Every FK column should be index-backed; redundant indexes are still better than missing ones if intent is unclear.
Fix: Add a one-line comment on `scenarioOptionScenarioPositionUnique` noting it doubles as the FK index for `scenario_id`. (No new index needed.)

### MAJOR: session_item_result.chosen_option_id FK has no index

Table: `study.session_item_result`
Column: `chosen_option_id`
Problem: `chosenOptionId` carries a FK to `scenario_option.id` with `ON DELETE set null` but no index. When an option is deleted (the `scenario-options-relational` invariant rebuilds), Postgres must seq-scan `session_item_result` to find rows whose `chosen_option_id` matches the deleted option. The schema has dense indexes elsewhere on this table; this column was missed.
Rule: FK columns referenced by a parent's `ON DELETE` action must be indexed, or every parent-row delete pays a full child-table scan.
Fix: Add `sirChosenOptionIdx: index('sir_chosen_option_idx').on(t.chosenOptionId)`. Alternatively, a partial index `WHERE chosen_option_id IS NOT NULL` since the column is nullable for non-rep slots and will be NULL on the majority of rows.

### MAJOR: review.review_session_id FK -- only covered when read with cardId

Table: `study.review`
Column: `review_session_id`
Problem: `reviewSessionCardIdx` is `(review_session_id, card_id)`. The query in `review-sessions.ts:346` filters `WHERE review.userId=? AND review.reviewSessionId=?` (no cardId), and `review-sessions.ts:648` joins on `review_session_id` only. The (review_session_id, card_id) prefix does cover both probes (review_session_id is leading), so this is fine for read paths. The remaining gap is `ON DELETE set null` on the `memory_review_session` parent: when a session row is deleted, the planner can use the same prefix. No fix needed; this finding is downgraded.
Rule: FK columns must be indexed for both reads and parent-cascade behavior.
Fix: None. Removing this finding from the actionable list -- the existing `(review_session_id, card_id)` prefix is sufficient.

### MAJOR: card.updated_at orderBy is not index-backed

Table: `study.card`
Column: `updated_at`
Problem: `cards.ts:348` does `ORDER BY card.updatedAt DESC` (browse list ordering). The closest covering index is `cardUserCreatedIdx` on `(user_id, created_at)`, which sorts by created_at, not updated_at. After an edit, browse-by-recently-updated falls back to a sort. Cards-per-user is bounded but on Abby's seed dataset (hundreds of personal cards plus seeded ones) this becomes a noticeable scan.
Rule: ORDER BY columns scoped by user should be the trailing key of a `(user_id, sort_col)` index.
Fix: Either add `cardUserUpdatedIdx: index('card_user_updated_idx').on(t.userId, t.updatedAt)`, OR change the BC sort to `created_at DESC` (semantically usually equivalent for personal-deck browse). Pick one; if the BC keeps `updatedAt`, add the index.

### MAJOR: goal.updatedAt orderBy is not index-backed

Table: `study.goal`
Column: `updated_at`
Problem: `goals.ts:110` orders by `(is_primary DESC, updated_at DESC)` but the only index is `goalUserStatusIdx` on `(user_id, status)`. After a goal edit the list view re-sorts in memory.
Rule: Same as above: `(user_id, updated_at)` covering index for the dashboard sort.
Fix: Add `goalUserUpdatedIdx: index('goal_user_updated_idx').on(t.userId, t.updatedAt)` or refactor the BC to sort by `created_at` (which is part of `timestamps()` and could also be added as an index column).

### MAJOR: card_feedback (card_id, user_id) ORDER BY created_at not covered

Table: `study.card_feedback`
Column: `created_at`
Problem: `feedback.ts:80-86` (`getLatestFeedback`) does `WHERE card_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1`. The only index is `cardFeedbackUserCardIdx` on `(user_id, card_id)`. Probing one (card,user) pair returns all rows, then the planner does an in-memory sort. The hot path is "is this card's latest signal a flag/like?"; if a learner has flagged + later liked, the row count per pair stays small, so this is mostly fine in practice. Promoting from `cardFeedbackUserCardIdx` to `(user_id, card_id, created_at)` makes the LIMIT 1 truly index-only.
Rule: A LIMIT N over an ORDER BY should match the trailing index column.
Fix: Replace `cardFeedbackUserCardIdx` with `(user_id, card_id, created_at DESC)` or add a separate `cardFeedbackUserCardCreatedIdx`. Index size cost is negligible (per-card history is bounded).

### MAJOR: knowledge_node missing updater audit column

Table: `study.knowledge_node`
Column: (missing) `updated_by`
Problem: `author_id` records the user who first imported / authored the node, with `ON DELETE set null` so the row outlives the author. When the node is later edited via tooling there is no `updated_by` to record who made the edit. Version history is partially captured (`version` counter + `content_hash`) but the human attribution stops at the first author. The CLAUDE.md rubric calls out audit columns (`created_by`/`updated_by`, version history) explicitly.
Rule: Authored content with mutation paths should carry both `created_by` (who made it) and `updated_by` (who last touched it). `knowledgeNodeVersion` table mentioned in the comment is the longer-form fix.
Fix: Add `lastEditedById: text('last_edited_by').references(() => bauthUser.id, { onDelete: 'set null' })`, and have `upsertKnowledgeNode` set it on every write. Alternatively, schedule the `knowledge_node_version` table referenced in the existing comment and resolve this as part of that work package.

### MINOR: knowledge_edge has no DB-level self-loop guard

Table: `study.knowledge_edge`
Column: (composite) `from_node_id`, `to_node_id`
Problem: A node could point at itself for any `edge_type`. `credential_prereq` carries an explicit `noSelfLoopCheck` (`credential_id <> prereq_id`); knowledge_edge does not. ADR 011 implies edges have a meaningful direction, so a self-loop is almost certainly authoring noise.
Rule: When the credential prereq table calls out self-loops, the analogous knowledge graph table should match.
Fix: Add `check('knowledge_edge_no_self_loop_check', sql.raw(`"from_node_id" <> "to_node_id"`))`. The build script already prevents this; the DB CHECK is the belt-and-suspenders guard.

### MINOR: knowledge_node.lifecycle has no NOT NULL / safe default

Table: `study.knowledge_node`
Column: `lifecycle`
Problem: `lifecycle: text('lifecycle').default(NODE_LIFECYCLES.SKELETON)` is NULLABLE with a default. The CHECK is `IS NULL OR IN (...)`. The schema comment says it was kept nullable "for existing rows during the migration window; the seed back-fills on next run." If the migration window is closed (the seed has run on every environment), the column should be NOT NULL. Otherwise read-side queries that filter on lifecycle silently miss seed-pending rows.
Rule: Migration-window nullability is a known issue. Per CLAUDE.md "zero tolerance for known issues," close the gap as soon as the back-fill has shipped.
Fix: After confirming every environment has run the back-fill seed (probably true today), add NOT NULL: `text('lifecycle').notNull().default(NODE_LIFECYCLES.SKELETON)` and tighten the CHECK to drop the `IS NULL OR` branch.

### MINOR: knowledge_node.references_v2_migrated is dead-end without a drop ticket

Table: `study.knowledge_node`
Column: `references_v2_migrated`
Problem: Column comment: "Once the migration phase completes for every row this column becomes informational; a follow-on cleanup can drop it." There is no work-package or ADR pointer for the cleanup. CLAUDE.md "no undecided considerations for future work" applies.
Rule: Migration-bridge columns must carry an explicit drop trigger (date, condition, or WP id) in the schema comment so they get retired.
Fix: Either add a one-line note pointing to the existing migration WP's cleanup phase, or open a small "schema cleanup" WP and reference it in the comment. The column itself is fine; the open-endedness is the issue.

### MINOR: study_plan.cert_goals carries @deprecated but no drop trigger condition

Table: `study.study_plan`
Column: `cert_goals`
Problem: Column comment marks it `@deprecated` and references `engine-goal-cutover` WP "Open Question (d): 14 consecutive days with zero source='plan' reads" as the trigger. No SQL or scheduled query verifies this trigger; it is on a human to remember. Same root cause as the previous finding.
Rule: A `@deprecated` column needs an automated drop-readiness signal or it lingers forever.
Fix: Add a small monitoring query to the engine cutover work package's verify phase that exports a daily count of `source='plan'` reads, and reference the dashboard in the comment so a future agent can confirm the trigger has fired before running the drop migration.

### MINOR: card.nodeId graph-linked rows could carry a composite (node, user) UNIQUE

Table: `study.card`
Column: `node_id`
Problem: Personal cards (`node_id IS NULL`) can multiply per user; graph-linked cards (`node_id IS NOT NULL`) probably should not. Today the schema permits a learner to have N cards for the same knowledge node, which is intended for personal authoring but may not be intended for graph-linked cards generated by the seed. No CHECK or partial UNIQUE prevents `(user_id, node_id)` duplicates among graph-linked rows.
Rule: When the spec talks about "the card for this node" in the singular, the storage layer should enforce it.
Fix: Confirm with the spec whether a partial UNIQUE on `(user_id, node_id) WHERE node_id IS NOT NULL` matches intent. If so, add it. If multiple cards per node are intentional (e.g. authored variants), document it explicitly in the column comment instead.

### MINOR: knowledge_node.relevance jsonb has no GIN index

Table: `study.knowledge_node`
Column: `relevance`
Problem: A GIN index on `references` is present (for the reverse "nodes that cite this section" query). `relevance` is a structurally similar jsonb array `[{cert, bloom, priority}, ...]` and is read by the dashboard / lens code per the comment. No reverse-containment query is currently in the BC, but the lens framework reads it via `inArray(knowledgeNode.id, ...)` only -- so no GIN needed today. This is a forward-looking note: if a "nodes relevant to cert X" reverse query is added, plan a GIN index then.
Rule: GIN-on-jsonb pays only when reverse-containment queries exist.
Fix: No change today. Add a comment to the column noting that a future cert-by-node reverse query should add `relevance jsonb_path_ops` GIN index.

### NIT: composite-fks.schema.test.ts -- coverage gap on session_item_result.chosen_option_id ON DELETE chain

Table: `study.session_item_result`
Column: `chosen_option_id`
Problem: `composite-fks.schema.test.ts` covers the `card_state_card_owner_fk` and `session_item_result_session_owner_fk` composite FKs. It does not cover the chain "delete scenario_option -> session_item_result.chosen_option_id becomes NULL." That chain IS covered by `scenario-option.schema.test.ts:326-352` (the SET NULL test) and `scenario-option.schema.test.ts:354-430` (the cascade-through-scenario test), so the test surface is complete -- the finding is just that the two test files split the responsibility silently.
Rule: Schema tests should be discoverable from one entry point.
Fix: Add a one-line comment at the top of `composite-fks.schema.test.ts` pointing at `scenario-option.schema.test.ts` for the chosen_option_id FK coverage so a reader does not assume the SIR FK story is fully covered here.

### NIT: scenario_option.text shadows JS `text` import

Table: `study.scenario_option`
Column: `text`
Problem: The column name `text` shadows the imported `text` Drizzle helper in the same file when reading. `text('text').notNull()` is legal but visually ambiguous. Other tables avoid this (e.g. `card.front`, `card.back`). The DB column name is fine; only the schema-file readability is the issue.
Rule: Avoid column names that collide with imported Drizzle helpers in the schema file.
Fix: Consider renaming to `body` or `option_text`. Low priority; mostly cosmetic. Skip if the migration cost outweighs the readability gain.

### NIT: knowledge_node_progress.id is a surrogate key while the unique key is (user, node)

Table: `study.knowledge_node_progress`
Column: `id`
Problem: The table has a surrogate `id` PK plus a `(user_id, node_id)` UNIQUE INDEX. Other projection-style tables (`card_state`, `reference_section_read_state`) use composite PRIMARY KEY directly. The surrogate `id` adds storage and a second B-tree without enabling any query the unique index doesn't already support.
Rule: Projection tables with a natural composite key should use it as the PK.
Fix: Migration-cost trade-off. If a future migration touches this table, drop `id` and promote `(user_id, node_id)` to PK. Not worth a dedicated migration.

### NIT: mrs (memory_review_session) ordering by lastActivityAt is not index-leading

Table: `study.memory_review_session`
Column: `last_activity_at`
Problem: `review-sessions.ts:472, 503, 566` all `ORDER BY mrs.lastActivityAt DESC` filtered by `user_id` (and sometimes `status` or `deck_hash`). Existing index is `mrs_user_started_idx` on `(user_id, started_at)`. The dashboard surfaces "most recent activity" not "most recent start"; the index leads on `started_at`, the BC sorts on `last_activity_at`. After resume, these can diverge. Per-user session count is bounded so the in-memory sort is cheap today.
Rule: Where the BC sorts on `last_activity_at`, the index should match.
Fix: Either rename / replace `mrs_user_started_idx` to `(user_id, last_activity_at)`, OR change the BC sort to `started_at` (they are usually close enough). Low impact.
