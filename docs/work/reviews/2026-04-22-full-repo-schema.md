---
feature: full-repo
category: schema
date: 2026-04-22
branch: main
issues_found: 18
critical: 1
major: 6
minor: 8
nit: 3
---

## Summary

The current Drizzle schema is small but mature: three namespaces (`public` for better-auth, `audit`, `study`), FKs and cascades are explicit on every relationship column except one, CHECK constraints back every string-enum, and indexes cover the actual read shapes in BC code. The structural weaknesses are propagatable: the `knowledge_node_progress.node_id` column is a pseudo-FK (no constraint, no index), the knowledge-graph content table has no versioning table despite claiming to be versioned, `updated_at` auto-bump is applied inconsistently (only two of the six mutable tables have `$onUpdate`), audit columns (`created_by`, `updated_by`) are missing from every user-authored content table, and there is no committed migration artifact (no `drizzle/` directory) -- the schema is maintained by `drizzle-kit push` plus ad-hoc SQL scripts. These patterns will replicate in every new BC (sim, hangar, firc) unless fixed at the substrate level now.

## Propagatable Patterns (top priority)

The following five patterns are the ones that will be copy-pasted into every new table the moment a second BC lands. Fix them here and the downstream BCs inherit the fix; leave them and every future table needs the same review.

1. **Pseudo-FK columns with no constraint and no index** -- `study.knowledge_node_progress.node_id` is a "knowledge-graph node slug" that the schema comment explicitly calls a non-FK, yet it is the table's *primary* join column and has no index. The same shape appears on `study.session_item_result.node_id` (no FK, no index). Every future BC that references knowledge nodes by slug will replicate the hole unless the rule is codified: either FK it, or it is NOT a join column and must not appear in a WHERE clause.
2. **`updated_at` auto-bump is per-table opt-in, not a substrate rule** -- `card_state` and `knowledge_node_progress` have `$onUpdate(() => new Date())`; `card`, `scenario`, `study_plan`, `knowledge_node` do not. Every update path is then responsible for remembering to set `updated_at` manually, and at least one (card edits) silently lets the column drift. A helper (`timestamps()` spread) applied to every mutable table fixes it at the source.
3. **Authored content has no version history table** -- `knowledge_node` carries a `version` counter and a `content_hash`, but there is no `knowledge_node_version` table holding prior revisions. The comment at schema.ts:143 says "a future `knowledge_node_version` table can hold full history when the need arrives." The need has arrived (ADR 006: Content Versioning is signed, published content is supposed to be recoverable). Every future authored content table (scenarios, cards-as-content, micro-lessons) will replicate this hole.
4. **No `created_by` / `updated_by` on user-authored content tables** -- `card`, `scenario`, `study_plan`, `knowledge_node_progress` have a `user_id` (the owner) but no `updated_by` (who last touched it). In a solo-user world these coincide. They will not for hangar authoring, shared study plans, or any admin edit path. The audit BC captures the trail, but the row itself cannot answer "who last edited this" without a join into `audit.audit_log`.
5. **No committed migration artifact** -- `drizzle.config.ts` targets `./drizzle` for migrations; that directory does not exist in the repo. The live DDL is `drizzle-kit push` + `scripts/db/apply-review-2026-04-22.sql` + `scripts/db/plan-active-unique.sql`, applied by hand. This was flagged as a Major in the 2026-04-19 spaced-memory-items final schema review and is still open. It blocks every BC that needs to deploy anywhere but a single dev laptop.

## Issues

### [CRITICAL]: `session_item_result.node_id` is a dangling join column -- no FK, no index, no CHECK

- **Table**: `study.session_item_result`
- **Column**: `node_id`
- **Problem**: The column is `text` with no `.references()`, no index, and no check. It is populated for `item_kind = 'node_start'` rows and read by knowledge-progress aggregates. A knowledge node can be renamed or deleted at any time (the table is rebuilt by a seed script); this column silently keeps stale slugs that no longer resolve, and queries that filter on `node_id` do a sequential scan on a growing session-item log. The parallel column on `knowledge_node_progress` has the same shape (see Major 1 below). This is data-integrity-level because the BC claims per-node progress is correct, and without FK + index it isn't.
- **Rule**: ADR 011 (knowledge graph) says edge targets may dangle *by design* (`targetExists` flag exists for that). Session-item results are not edges; they are event records that point into the graph. Dangling event records are not information, they are drift.
- **Fix**: Add `.references(() => knowledgeNode.id, { onDelete: 'set null', onUpdate: 'cascade' })` and an index `sir_node_completed_idx` on `(node_id, completed_at)`. If the team explicitly wants slug-resilient decoupling, replace the text with `knowledge_node_id` (FK) and a separate `node_slug_snapshot text` capturing the slug at the time of the event.

### [MAJOR]: `knowledge_node_progress.node_id` is a pseudo-FK with no index on the primary join column

- **Table**: `study.knowledge_node_progress`
- **Column**: `node_id`
- **Problem**: The schema comment (schema.ts:681) says "no FK because seeded nodes may be rebuilt independently." The unique index is on `(user_id, node_id)` which incidentally covers `(user_id, node_id)` lookups but not `(node_id, *)` reads such as "how many users have started this node" or "purge progress for deleted nodes." Meanwhile there is no guard at all: a slug rename leaves progress rows pointing at a node that no longer exists, and nothing in the schema flags them. Re-running the seed can silently orphan rows.
- **Rule**: ADR 010 (ID strategy) slugs are immutable after publish, but the seed script rebuilds slugs on every run -- in practice these rows *can* drift. ADR 011 does not license event records (progress) to dangle, only edges.
- **Fix**: Either (a) add an FK with `onDelete: 'cascade'` and accept that seed rebuilds must not remove existing nodes, or (b) keep the text column but add a nightly reconciliation job plus an index `knp_node_idx` on `node_id`. Option (a) is consistent with the cascade pattern on `card.node_id` / `scenario.node_id` (both FK'd to `knowledge_node` with `set null`).

### [MAJOR]: No migration artifact -- `drizzle/` directory absent, live DDL drift invisible

- **Table**: all
- **Problem**: `drizzle.config.ts` writes migrations to `./drizzle`, which does not exist. Live DDL is applied through `drizzle-kit push` (destructive in non-interactive contexts) plus two hand-written SQL files in `scripts/db/`. Nothing records the order of applied DDL, drift between `schema.ts` and the deployed DB is invisible until the next push, and `CREATE EXTENSION pg_trgm` (required for the card trigram indexes) is not expressed anywhere that runs on a fresh DB. This was flagged in 2026-04-19 final schema review and is still open.
- **Rule**: ADR 006 (Content Versioning) + ADR 004 (Database Namespaces) both assume ordered, committed DDL. `drizzle-kit push` is explicitly a dev-only shortcut in the Drizzle docs.
- **Fix**: Switch to `drizzle-kit generate` + `drizzle-kit migrate`. Generate a baseline migration from the current schema, commit it, and from this point forward every schema change ships as a numbered migration file. Fold the two ad-hoc SQL files (`apply-review-2026-04-22.sql`, `plan-active-unique.sql`) into the baseline. Add `CREATE EXTENSION IF NOT EXISTS pg_trgm` as the first statement of the baseline so fresh DBs bring up the trigram indexes.

### [MAJOR]: `knowledge_node` has version counter + content hash but no version history table

- **Table**: `study.knowledge_node`
- **Column**: `version`, `content_hash`
- **Problem**: The schema stores `version` (integer, monotonic) and `content_hash` (sha256), but no `knowledge_node_version` table records prior revisions. ADR 006 says published content is versioned and recoverable. If a seed run rewrites a node, the prior `content_md` and `relevance` array are gone; only git history holds them, and only for authored markdown -- not for tooling-generated edits. The schema at line 145 even calls out "A future `knowledge_node_version` table can hold full history when the need arrives." The need is now: audit uses `before` / `after` JSON snapshots, but nothing captures the full authored content over time.
- **Rule**: ADR 006 -- published content is versioned and recoverable. Per CLAUDE.md Prime Directive: "A stub is a known issue."
- **Fix**: Add `study.knowledge_node_version` with `(id, node_id, version, content_md, content_hash, frontmatter_snapshot jsonb, author_id, created_at)`. The seed writes the prior row into this table before overwriting the node. `node_id + version` is the composite unique key; primary key is a `knv_ULID` via `createId('knv')`. Index on `(node_id, version DESC)`.

### [MAJOR]: `updated_at` auto-bump applied to only two of six mutable tables

- **Table**: `study.card`, `study.scenario`, `study.study_plan`, `study.knowledge_node`
- **Column**: `updated_at`
- **Problem**: `cardState` and `knowledgeNodeProgress` use `.$onUpdate(() => new Date())`. The other four mutable tables (`card`, `scenario`, `study_plan`, `knowledge_node`) have an `updated_at` column but rely on each BC write path to set it manually. Any future mutation site that forgets (e.g. admin correction, data-migration script) silently leaves `updated_at` stale -- the row has changed but the timestamp lies.
- **Rule**: ADR 012 (reps substrate) and project convention say `updated_at` must reflect "when did the row last change" without depending on caller discipline.
- **Fix**: Add `.$onUpdate(() => new Date())` to the `updated_at` column on `card`, `scenario`, `study_plan`, and `knowledge_node`. Better: extract a `timestamps()` helper in `libs/db/src/` that spreads `created_at` + `updated_at` with the `$onUpdate` already attached, and use it on every mutable table going forward. This closes the substrate rule rather than patching four tables.

### [MAJOR]: No `created_by` / `updated_by` columns on user-authored content

- **Table**: `study.card`, `study.scenario`, `study.study_plan`, `study.knowledge_node`
- **Problem**: Every user-authored table carries a `user_id` that *currently* doubles as "owner" and "author." In a solo-user world that is fine. For hangar authoring (shared content), admin edits (Joshua editing another CFI's card), or any multi-author surface, the schema cannot answer "who last changed this row?" without joining into `audit.audit_log`. The audit trail is a capability, not a substitute for the row-level answer.
- **Rule**: ADR 004 (namespaces) sets `audit` aside for change logs; the *current-value* trail lives on the row.
- **Fix**: Add `createdBy text NOT NULL` (FK to `bauth_user` with `onDelete: 'set null'` -- actually `text not null` blocks set-null; use `restrict` or keep nullable and set defaults via BC) and `updatedBy text` (FK same, nullable) to `card`, `scenario`, `study_plan`, `knowledge_node`. The existing `user_id` stays as "owner"; these two columns record authorship separately so a single-user app can set them equal while hangar later diverges them.

### [MAJOR]: `knowledge_node.lifecycle` is nullable with a default -- NOT NULL is the intent

- **Table**: `study.knowledge_node`
- **Column**: `lifecycle`
- **Problem**: The column is declared `text('lifecycle').default(NODE_LIFECYCLES.SKELETON)` -- no `.notNull()`. The schema comment (schema.ts:160) says "Nullable for existing rows during the migration window; the seed back-fills on next run." That migration window closed -- every `knowledge_node` row is seeded. The CHECK allows NULL (`"lifecycle" IS NULL OR ...`) to accommodate this, but the normal default is `SKELETON`, not NULL. Any future row created without an explicit lifecycle will take the default; any bug that passes `null` explicitly bypasses the CHECK and leaves a NULL row that read paths have to defend against.
- **Rule**: CLAUDE.md -- "Nullable columns that should be NOT NULL" + "Default-NOT-NULL missing defaults."
- **Fix**: Add `.notNull()`, drop the `IS NULL OR` branch of the CHECK. If old data lurks, backfill to `SKELETON` first.

### [MINOR]: `scenario` table missing `updated_at`

- **Table**: `study.scenario`
- **Problem**: `scenario` has `created_at` but no `updated_at`. Scenarios are editable (`is_editable` column exists, `BC updateScenario` exists per the index types). A row that has been edited five times looks identical to a brand-new row with respect to its mutation timestamp.
- **Rule**: Project convention (every mutable content table has `created_at` + `updated_at`).
- **Fix**: Add `updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())`.

### [MINOR]: `session.session_length` is denormalized without a hard guard against `plan.session_length` drift

- **Table**: `study.session`
- **Column**: `session_length`
- **Problem**: Every session snapshots `session_length` from its owning plan. The CHECK `session_session_length_check` enforces the 3..30 range, but there is no constraint linking `session.session_length` to `plan.session_length` at write time. This is intentional (plan edits shouldn't rewrite historical sessions), but the denormalization is undocumented at the column level and a future reader will ask "why isn't this `FK->plan`?" The rationale belongs next to the column.
- **Rule**: Normalization justification -- CLAUDE.md + schema prime directive.
- **Fix**: Add a JSDoc comment to `session.sessionLength` explaining the snapshot contract (mirrors the `seed` comment above it). No schema change.

### [MINOR]: `card_state` has no `created_at` -- projections still merit a creation timestamp

- **Table**: `study.card_state`
- **Problem**: `card_state` is a materialized projection and intentionally omits `created_at`. The header comment explains `reviewedAt` of the latest review is the relevant timestamp. But the *projection row itself* has a creation moment (the first time the BC materialized state for this `(card, user)` pair), and knowing that is useful for debugging drift (projection lagged, backfill happened, user imported a card pack at time T). `updated_at` alone answers "when last changed," not "when first seen."
- **Rule**: Project convention + debuggability of derived tables.
- **Fix**: Add `createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`. Zero write-path change -- Postgres fills it on insert.

### [MINOR]: `bauthUser.role` is a free-form text column -- ADR 009 names the roles

- **Table**: `public.bauth_user`
- **Column**: `role`
- **Problem**: `role: text('role')` with no CHECK. ADR 009 (role model) names the valid roles (learner, cfi, admin, etc.). Typos or stale strings silently authorize or deny. The table is owned by better-auth so Drizzle cannot fully manage it, but a CHECK constraint can still be added out-of-band in the baseline migration.
- **Rule**: ADR 009, CLAUDE.md -- "Free-form status strings instead of enums."
- **Fix**: Add a CHECK constraint in the baseline migration: `CHECK (role IS NULL OR role IN ('learner', 'cfi', 'admin', ...))`. Keep it out of `schema.ts` (better-auth owns the table) but in the migration file.

### [MINOR]: `session.focus_override` and `cert_override` are single-value but modeled as text

- **Table**: `study.session`
- **Columns**: `focus_override`, `cert_override`
- **Problem**: Both are single-value overrides at session-start. The CHECK constraints validate against `DOMAIN_VALUES` / `CERT_VALUES`, which is correct. But these two columns, plus `card.domain` (CHECK-less!) and `scenario.domain` / `scenario.difficulty`, are repeating the same "text column with CHECK against an enum array" pattern in five places. This is begging for Drizzle `pgEnum()` -- one declaration, every table references the same pg type, the CHECK is automatic.
- **Rule**: CLAUDE.md -- "Drizzle enums, match libs/constants."
- **Fix**: Declare `domainEnum = studySchema.enum('domain', DOMAIN_VALUES)`, `certEnum = studySchema.enum('cert', CERT_VALUES)`, `difficultyEnum`, `cardStatusEnum`, `sessionModeEnum`, etc. Replace `text('domain').notNull()` + CHECK with `domainEnum('domain').notNull()`. Collapses ~15 CHECKs into typed column definitions and removes the `inList()` / `sql.raw()` string manipulation. Lands before any second BC copies the current pattern.

### [MINOR]: `card.domain` and `scenario.domain` have no CHECK constraint

- **Table**: `study.card`, `study.scenario`
- **Column**: `domain`
- **Problem**: `card_type`, `source_type`, `status` have CHECKs; `domain` does not. Scenarios have CHECKs on `difficulty`, `phase_of_flight`, `source_type`, `status` but not `domain`. A bad `domain` string inserts successfully and silently corrupts every domain-scoped read (`card_user_domain_idx`, `getDomainBreakdown`).
- **Rule**: CLAUDE.md -- "Free-form status strings instead of enums" applies to categorical columns too.
- **Fix**: Add CHECK `domain IN (${inList(DOMAIN_VALUES)})` on both tables. Superseded by the `pgEnum` refactor (minor above) when that lands.

### [MINOR]: `review.elapsed_days` and `scheduled_days` have no non-negative CHECK

- **Table**: `study.review`
- **Columns**: `elapsed_days`, `scheduled_days`
- **Problem**: Both are `real` and `NOT NULL`, but negative values are accepted. FSRS never produces negatives, but a buggy caller, a clock skew, or a manual correction can. The table already uses `nonNegativeDurationCheckSql` for `answer_ms` on `session_item_result`; the same treatment fits here.
- **Rule**: Data-integrity consistency with `sir_answer_ms_check`.
- **Fix**: Add `check('review_elapsed_days_check', sql.raw('"elapsed_days" >= 0'))` and the same for `scheduled_days`. Same pattern as the existing helper.

### [MINOR]: `audit_log` has no CHECK on `op` despite the `AUDIT_OPS` enum being defined in the same file

- **Table**: `audit.audit_log`
- **Column**: `op`
- **Problem**: The file declares `AUDIT_OPS` and `AUDIT_OP_VALUES`, and `auditWrite()` accepts the typed `AuditOp`, but the storage column is `text('op').notNull()` with no CHECK. A caller that bypasses the helper (or a future direct SQL insert) can write `'purge'` and nothing catches it.
- **Rule**: Same as other string-enum CHECKs in the file.
- **Fix**: Add `check('audit_op_check', sql.raw(\`"op" IN (${inList(AUDIT_OP_VALUES)})\`))` in the table's secondary args.

### [NIT]: `audit_log.target_type` is a free-form string that encodes a table reference

- **Table**: `audit.audit_log`
- **Column**: `target_type`
- **Problem**: Callers pass `'study.card'`, `'study.study_plan'`, etc. This is a stringly-typed resource discriminator with no enum. As the number of BCs grows this will drift (`'study.card'` vs `'study/card'` vs `'card'`). Consider a `TARGET_TYPES` constant in `libs/constants/src/` with the single source of truth.
- **Rule**: CLAUDE.md -- "No magic strings."
- **Fix**: `const TARGET_TYPES = { STUDY_CARD: 'study.card', STUDY_STUDY_PLAN: 'study.study_plan', ... } as const`. Keep as a type, no DB CHECK (too brittle; table list changes with every BC).

### [NIT]: Catalog-tier ID strategy (ADR 010 Tier A) has no tables using it yet -- deliberate or drift?

- **Table**: none
- **Problem**: ADR 010 defines `prefix-NNN` catalog IDs (`scn-001`, `mod-001`, etc.) backed by Postgres sequences. No table in the current schema uses Tier A -- `scenario` is `rep_ULID` (Tier B), `knowledge_node` is a slug-as-PK. This may be correct for the current product (nothing is hangar-authored yet), but it is worth flagging before the first hangar table lands so Tier A is actually used where ADR 010 says it should be (modules, questions, released scenarios).
- **Rule**: ADR 010.
- **Fix**: No schema change now. When the first hangar content table is added, ensure it uses `generateCatalogId(prefix, seq, digits)` and not ULID.

### [NIT]: `knowledge_edge.target_exists` defaults to `false` -- a newly-created edge is assumed broken

- **Table**: `study.knowledge_edge`
- **Column**: `target_exists`
- **Problem**: Default `false` means "dangling until proven otherwise." The build script refreshes it on every run, so rows are correct by the time anything reads them. But during the small window between an edge insert and the build script's reconciliation pass, a read will filter it out. Flipping the default to `true` (the happy case) and having the build script mark confirmed-dangling edges as `false` is the same logic with the failure-closed default inverted.
- **Rule**: Principle of least surprise on defaults.
- **Fix**: Change default to `true`; ensure the build script marks both directions (confirmed-exists, confirmed-dangling) rather than only `true` on the happy path.
