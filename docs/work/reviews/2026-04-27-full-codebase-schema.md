---
feature: full-codebase
category: schema
date: 2026-04-27
branch: main
issues_found: 14
critical: 1
major: 5
minor: 5
nit: 3
---

## Summary

Schema is in strong shape overall: namespaces (`identity`/`audit`/`study`/`hangar`/`sim`) are clean, ID strategy is consistent (`prefix_ULID` via `createId()`), CHECK constraints back the constants pattern, and FK cascades have been thought through (reviews `restrict`, content `set null`, user-scoped `cascade`). Most query paths have matching composite indexes. The findings below cluster around: a persisted `lifecycle` column that is functionally dead because reads recompute it from `content_md`, a few denormalisations with no enforced consistency, several FKs with no covering index that show up in actual query plans, and a small number of normalisation/constraint gaps in newer tables (sim, hangar, scenario options, audit log, study schema cross-namespace links).

## Issues

### CRITICAL: `knowledge_node.lifecycle` is a dead persisted column with an index, while reads compute lifecycle in JS

- **Table**: `study.knowledge_node`
- **Column**: `lifecycle` + `knowledge_node_lifecycle_idx`
- **Problem**: The schema persists `lifecycle text DEFAULT 'skeleton'` and indexes it (`knowledge_node_lifecycle_idx`). The column comment says it's "Derived from phase coverage by build-knowledge-index.ts and persisted so read paths can filter on it without recomputing." But every read site in `libs/bc/study/src/knowledge.ts` actually recomputes lifecycle from `contentMd` via `lifecycleFromContent()` at lines 500-506, 522, 546. There is no `select(...lifecycle...)` against `knowledge_node` anywhere in the codebase; `grep -rn "knowledgeNode\.lifecycle"` returns zero non-test hits. The persisted column is therefore one of: (a) drifting silently on every node edit until the seed reconciles, (b) populated by the seed but never consulted, (c) both. The index is never probed. The CHECK constraint exists, but the value it constrains is decoupled from truth.
- **Rule**: ADR 011 + project rule "no known issues, no dead state". Either the column is the source of truth and the index supports `WHERE lifecycle = ?`, or the JS derivation is the source of truth and the column should be dropped along with the index and the CHECK.
- **Fix**: Pick one path and execute the same WP. Option A (persist): change `lifecycleFromContent` callers to read `n.lifecycle` directly; the seed already writes it; add a guard in the BC that any code path mutating `content_md` must also recompute and write `lifecycle`. Option B (drop): remove the column, index, and CHECK from `libs/bc/study/src/schema.ts:210-211, 225, 238-241` and add a follow-on migration. Option B is simpler and matches actual usage today.

### MAJOR: `card_state.userId` denormalised from `card.userId` without an enforcing FK pair or trigger

- **Table**: `study.card_state`
- **Column**: `(card_id, user_id)` composite PK
- **Problem**: `card_state.user_id` is a separate FK to `bauth_user`, parallel to the FK on `card.user_id`. Nothing guarantees `card_state.user_id = card.user_id` for the same `card_id`. A bug in the upsert path (or any future direct insert) could store a row where the per-(card,user) projection points at a different user than the card itself, and the existing reads (`stats.ts:118-119` join on both keys) would silently miss data. Cards are user-owned, so the natural shape would be a single FK to `card.id` and dropping `user_id` from `card_state` entirely (or making it a composite FK `(card_id, user_id) -> (card.id, card.user_id)` and adding a UNIQUE on `card.(id, user_id)`).
- **Rule**: Drizzle/Postgres best practice -- if a column duplicates another table's owned column, either remove it or constrain it via composite FK. Same comment applies to `session_item_result.user_id` (denormalised from `session.user_id` per the schema comment) -- the schema comment claims "FK is required so the column cannot drift from session.user_id; the write path keeps the two consistent" but no DB-level constraint enforces that claim.
- **Fix**: Add `UNIQUE(card.id, user_id)` on `card`, then change `card_state` to use a composite FK `(card_id, user_id) REFERENCES card(id, user_id) ON DELETE CASCADE`. Same treatment for `session_item_result.(session_id, user_id) -> session.(id, user_id)`. Or drop the duplicated column and join through.

### MAJOR: `scenario.options` JSON array carries identity (`option.id`, `isCorrect`) with zero relational invariant

- **Table**: `study.scenario`
- **Column**: `options jsonb`
- **Problem**: `ScenarioOption` includes `id: string` and `isCorrect: boolean`; the per-attempt outcome row (`session_item_result.chosen_option`) stores the picked `id` as a free `text` column. Three real invariants are enforced only by app-layer Zod (newScenarioSchema) and code review:
  1. Exactly one `isCorrect: true` per scenario.
  2. Option ids are unique within a scenario.
  3. `session_item_result.chosen_option` corresponds to an extant id on `scenario.options`.
  None of these are enforced at the DB layer. The schema comment at line 532 acknowledges (1) and (2) and explicitly opts out, but item (3) silently couples two tables without referential integrity. A renamed option silently invalidates historical attempts; a future seed bypassing the BC produces zero/two correct options.
- **Rule**: Drizzle/Postgres -- multi-row identity with cross-row references should be a relational table, not a JSON array. ADR 011's "discovery first" preference for inline content is about pedagogical text, not identifiers consulted by other tables.
- **Fix**: Promote options to a `study.scenario_option` table with FK to `scenario`, `id` PK, partial UNIQUE `(scenario_id) WHERE is_correct=true` enforces the one-correct invariant, and `session_item_result.chosen_option_id` becomes a real FK. Migration is mechanical: unnest the JSONB array, re-key chosen_option strings to the new option ids.

### MAJOR: `sim.attempt.scenario_id` is a free-form string with no FK and no canonical scenario table

- **Table**: `sim.attempt`
- **Column**: `scenario_id`
- **Problem**: `sim_attempt_user_scenario_ended_idx` filters by `scenarioId`, but the column is a `text` not-null with no FK. The sim BC reads/writes scenario manifests from the filesystem (`apps/sim` ships with manifests on disk), so there is no DB row to FK to. That is an intentional design but it makes the column effectively a magic string with no rename safety, no shape guard, and no way to ask the DB "list scenarios that have ever been attempted." The neighbouring scenario in `study.scenario` is unrelated (decision-rep micro-scenarios, not flight scenarios), so the namespacing is also a future trap if the two ever converge.
- **Rule**: Drizzle/Postgres -- prefer FKs even for "static manifests"; mirror the manifest into a small `sim.scenario` table at boot/seed and FK from `sim.attempt`.
- **Fix**: Add `sim.scenario { id text pk, slug text unique, manifest_path text, ... }`, mirror manifests on hangar boot, then `sim.attempt.scenario_id REFERENCES sim.scenario(id) ON DELETE RESTRICT`. The "no auth on sim app yet" comment explains why this isn't urgent for runtime, but the schema correctness gap is real.

### MAJOR: `audit.audit_log` carries `target_type` + `target_id` as a polymorphic free string with no FK and no app-layer registry

- **Table**: `audit.audit_log`
- **Column**: `target_type`, `target_id`
- **Problem**: `target_type` is a free-form `text` column ("study.card", "hangar.source", etc.) with no CHECK, no enum, no constants. A typo at any callsite of `auditWrite` produces an unsearchable row. `audit_log_target_idx` is on `(target_type, target_id, timestamp)` so query callers must spell the target_type exactly the same way the writer did, with no compiler help. Compare this to `study.content_citations` which carries the same polymorphism but enforces `source_type` / `target_type` with a CHECK against `CITATION_SOURCE_VALUES` / `CITATION_TARGET_VALUES`.
- **Rule**: ADR 004 / centralised constants -- enumerated polymorphic columns get a CHECK against a constants list.
- **Fix**: Add `AUDIT_TARGET_TYPES` to `libs/audit/src/log.ts` (or a new constants entry), wire a CHECK constraint on `audit_log.target_type IN (...)`, and surface a helper that callers must use to write rows. Same treatment for `audit_log.op` (already constrained at the type level via `AUDIT_OPS` but missing a DB CHECK).

### MAJOR: `hangar.job` has no CHECK constraints on `status` / `kind` / `target_type`, despite constants existing

- **Table**: `hangar.job`
- **Column**: `status`, `kind`, `target_type`, plus `hangar.job_log.stream`
- **Problem**: `status text DEFAULT 'queued'` with no CHECK. The schema comments reference `JOB_STATUSES`, `JOB_KINDS`, `JOB_LOG_STREAMS` constants but the table never wires them to a CHECK. By contrast, every `study.*` table CHECKs every enumerated text column. A typo from any worker that writes the job table produces a status the polling query never finds. Same for `hangar.sync_log.kind` (`HANGAR_SYNC_MODES`) and `hangar.sync_log.outcome` (`SYNC_OUTCOMES`).
- **Rule**: Project pattern across `study.*` -- enumerated text columns CHECK against the values list.
- **Fix**: Add CHECK constraints for `hangar.job.{status,kind}`, `hangar.job_log.stream`, `hangar.sync_log.{kind,outcome}`, `hangar.source.{type,format}` keyed off the existing constants in `@ab/constants`.

### MINOR: Missing index on `hangar.source.deleted_at` / `hangar.reference.deleted_at` filters

- **Table**: `hangar.reference`, `hangar.source`
- **Column**: `deleted_at`
- **Problem**: `run-sync-job.ts:281-282` reads `WHERE deleted_at IS NULL` against the full table on every sync. Today the row counts are small (TOML mirror), but the query is a sequential scan and a partial index is the canonical fix. `hangar_reference_dirty_idx` on the boolean is similarly low-cardinality and would benefit from being partial-on-true (the only value the BC ever queries).
- **Rule**: Postgres index design -- low-cardinality columns queried with a single value benefit from partial indexes.
- **Fix**: Replace `hangar_reference_dirty_idx` and `hangar_source_dirty_idx` with `WHERE dirty = true`, and add `WHERE deleted_at IS NULL` partial indexes (or fold into the dirty index as `(dirty) WHERE deleted_at IS NULL`).

### MINOR: `bauth_session.user_id` and `bauth_account.user_id` use `ON DELETE no action`

- **Table**: `bauth_session`, `bauth_account`
- **Column**: `user_id`
- **Problem**: All other `bauth_user.id` FKs use `ON DELETE cascade`. These two use `no action`. Result: deleting a user fails (the FK blocks) until the application code clears sessions/accounts first. Better-auth manages these tables, but the schema shape we expose to drizzle-kit for migrations should match the reality: either Better-Auth handles delete cascades in its own code path (then the FK should be `cascade` or `restrict` matching that contract), or admin-tooling that hard-deletes a user has to know to clear these first. Today the contract is silent.
- **Rule**: Drizzle/Postgres -- all FKs to a parent should declare a coherent delete behaviour; `no action` is a default that often hides intent.
- **Fix**: Confirm Better-Auth's deletion semantics, then explicitly set `cascade` or `restrict` to match. Updating the schema mirror is read-only (Better-Auth owns the table) but the local `references(...)` declaration documents intent and drives drizzle-kit migration generation.

### MINOR: `review.review_session_id` index is `(review_session_id, card_id)` but the join uses `review_session_id` only

- **Table**: `study.review`
- **Column**: `review_session_id`
- **Problem**: `review_session_card_idx` is on `(review_session_id, card_id)`. The join in `review-sessions.ts:647` joins on `review_session_id = memory_review_session.id` and filters by `card_id` separately, which the composite supports. However other reviews-by-session reads (e.g. counting reviews per session) only filter by `review_session_id`. The composite still supports a leading-prefix probe, so this is not a correctness issue, but `WHERE review_session_id IS NOT NULL` (line 648) cannot use the index unless it's a partial index. Today the column is sparse (most rows are NULL: legacy or non-session reviews), so a partial index would shrink it dramatically.
- **Rule**: Postgres -- sparse boolean-ish columns benefit from partial indexes.
- **Fix**: Make `review_session_card_idx` partial: `... WHERE review_session_id IS NOT NULL`.

### MINOR: `reference.superseded_by_id` self-FK has no UNIQUE on the chain head, allowing fan-out

- **Table**: `study.reference` (also same shape on `study.syllabus`)
- **Column**: `superseded_by_id`
- **Problem**: The schema documents the intent as "this older edition was replaced by exactly one newer edition" but the column is a plain self-FK with no UNIQUE on the inverse direction. Two older editions can both point at the same newer one (correct), but nothing prevents a chain that bifurcates: edition A says "superseded by C", edition B says "superseded by C" -- fine. But also, edition A could be marked superseded by B, while B is also superseded by C: a query "is this row superseded?" must walk the chain. A simpler model: store `superseded_by_id` and a derived `chain_head_id` (computed by the seed) so the "is current?" check is `WHERE chain_head_id = id`.
- **Rule**: Drizzle/Postgres -- linked-list edition models that are queried for "current" are cheaper as a denormalised head pointer.
- **Fix**: Either add `chain_head_id` and a partial UNIQUE on `(document_slug) WHERE id = chain_head_id`, or accept the chain walk and document it. Defer until a third edition lands -- for now this is design hygiene.

### MINOR: `knowledgeNodeProgress.id` is a redundant ULID; the natural PK is `(user_id, node_id)`

- **Table**: `study.knowledge_node_progress`
- **Column**: `id` + `knp_user_node_unique`
- **Problem**: The table has a synthetic `id text PRIMARY KEY` plus a UNIQUE on `(user_id, node_id)`. Every read uses the natural key (`knowledge.ts:1159, 1180, 1226`) and updates by `id` only after looking up via the natural key. The synthetic ID adds a column, an index, and the indirection without earning anything; the upsert path uses ON CONFLICT against the unique. Compare to `card_state` and `handbook_read_state` which use a composite PK directly.
- **Rule**: Drizzle/Postgres -- when the natural composite key is the actual probe, make it the PK.
- **Fix**: Migrate `knowledge_node_progress` to `PRIMARY KEY (user_id, node_id)`, drop the synthetic `id`, drop the redundant unique. Rewrite the two `where(eq(knowledgeNodeProgress.id, existing.id))` updates to use the composite. Note: `node_id` is currently nullable -- the unique permits at most one NULL row per user, but a composite PK forbids NULLs. Either tighten `node_id` to NOT NULL (the BC already requires it for any meaningful read) or keep the synthetic id. Pick one.

### NIT: `card_state` lacks a `created_at`; `updated_at` is the only timestamp

- **Table**: `study.card_state`
- **Column**: missing `created_at`
- **Problem**: The header comment explains the rationale ("materialized projection... reviewedAt of the latest review is the relevant timestamp") and that's defensible. The minor cost: when debugging "when did this user first review this card?" via the projection alone, the answer is gone. Today the answer comes from `MIN(review.reviewed_at) WHERE card_id = ? AND user_id = ?`, which is fine. Mark this resolved if the position holds; otherwise add `created_at`.
- **Rule**: Project pattern -- mutable tables get `timestamps()`; projections may opt out with documented rationale.
- **Fix**: Status-quo OK; document explicitly in the column doc that `MIN(review.reviewed_at)` is the answer to "first attempt."

### NIT: `hangar.reference.reviewed_at` stored as `text` instead of `timestamp`

- **Table**: `hangar.reference`
- **Column**: `reviewed_at`
- **Problem**: ISO-8601 string in a `text` column. Every other timestamp in the schema is `timestamp with time zone`. Querying "stale references (reviewed > 6 months ago)" requires `to_timestamp` on every row.
- **Rule**: Project pattern -- date-typed columns use `timestamp({ withTimezone: true })`.
- **Fix**: Convert to `timestamp with time zone`. Same for `hangar.source.downloaded_at` -- stored as `text` per the schema comment ("`pending-download` sentinel"); replace the sentinel with NULL + a separate `download_status` column constrained by CHECK so the timestamp can be a proper timestamp.

### NIT: `knowledge_edge` has no `seed_origin` column despite every sibling carrying one

- **Table**: `study.knowledge_edge`
- **Column**: missing `seed_origin`
- **Problem**: Every other `study` table (`card`, `scenario`, `study_plan`, `session`, `session_item_result`, `knowledge_node`, `reference`, `handbook_section`, `handbook_figure`, `handbook_read_state`, `credential`, `credential_prereq`, `credential_syllabus`, `syllabus`, `syllabus_node`, `syllabus_node_link`, `goal`, `goal_syllabus`, `goal_node`) carries a nullable `seed_origin text` so dev-seed cleanup can find and delete its rows. `knowledge_edge` is the lone exception. If the dev-seed pipeline ever inserts edges, the cleanup story has a gap.
- **Rule**: Project pattern -- dev-seed marker on every seedable table.
- **Fix**: Add `seedOrigin: text('seed_origin')` to `knowledge_edge`.
