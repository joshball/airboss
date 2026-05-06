---
feature: full-schema-cross-cutting
category: schema
date: 2026-05-06
branch: main
issues_found: 28
critical: 1
major: 8
minor: 12
nit: 7
status: pending
review_status: done
---

# Full schema review -- consistency, flexibility, efficiency

> **Frame.** Holistic audit across every Drizzle schema in the repo, with the recent ADR 019 + amendment progression in mind. This is not a per-feature review; it is a cross-cutting check on naming, ID conventions, FK direction, lifecycle handling, edition-pinning, and where the schema is rigid in ways that will hurt the next corpus migration. The first question is *what is the right thing to do?* -- recommendations are calibrated to that, not to "what's cheapest to ship."

## Files reviewed

- [libs/db/src/columns.ts](../../../libs/db/src/columns.ts) -- `timestamps()` helper
- [libs/auth/src/schema.ts](../../../libs/auth/src/schema.ts) -- better-auth read-only mirror (`bauth_*`)
- [libs/audit/src/schema.ts](../../../libs/audit/src/schema.ts) -- `audit.audit_log`
- [libs/sources/src/db/schema.ts](../../../libs/sources/src/db/schema.ts) -- `sources_registry.promotion_batches`, `sources_registry.editions`
- [libs/hangar-jobs/src/schema.ts](../../../libs/hangar-jobs/src/schema.ts) -- `hangar.job`, `hangar.job_log`
- [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts) -- 25 study tables
- [libs/bc/study/src/citations/schema.ts](../../../libs/bc/study/src/citations/schema.ts) -- `study.content_citations`
- [libs/bc/hangar/src/schema.ts](../../../libs/bc/hangar/src/schema.ts) -- 13 hangar tables
- [libs/bc/sim/src/schema.ts](../../../libs/bc/sim/src/schema.ts) -- `sim.attempt`
- [libs/constants/src/schemas.ts](../../../libs/constants/src/schemas.ts) -- `SCHEMAS` namespace map

## Summary

The schema has matured well. Namespace separation per ADR 004 is consistently applied, the `prefix_ULID` ID convention is universal, the `timestamps()` helper is reused everywhere, CHECK-from-constants enums are the project-wide pattern, and recent additions (`sources_registry`, citations, syllabus DAG, evidence-kind partition) layer cleanly on the substrate. **The big three risks all live in one neighborhood: edition handling.**

There is now an *incoherent layering* between three independent edition mechanisms:

1. **`@ab/sources` registry + ADR 019** -- `sources_registry.editions` table, `airboss-ref:` URIs, `supersededById` chains, lifecycle states.
2. **`study.reference` + `study.reference_section`** -- a parallel edition story with its own `documentSlug`, `edition` text column, `superseded_by_id` self-FK, and a per-row `airboss_ref` mirror.
3. **`study.syllabus`** -- a third edition story with its own `superseded_by_id` self-FK and free-form `edition` column.

Three tables now carry the concept of "edition" with three separate sources of truth, and the new amendment ("optional edition + drift sentinels") raises the stakes -- when the validator becomes precision-aware and drift-aware, none of the three knows about the others. **This is the single most consequential cross-cutting issue in the schema today.** Section A below.

Beyond that the issues are smaller and well-localised: a few rigid CHECK constraints that will need migration when the next corpus lands, a couple of `nodeId text` columns that should now FK, three nullable-`updatedAt`-on-content-tables risks, and the predictable accumulated-debt items that normally show up in a schema this age (see "Migration-rigidity" section).

The overall verdict: the substrate is in good shape. The edition-coherence work is the next ADR-class decision; everything else is normal schema maintenance.

## Cross-cutting strengths

- **Namespace discipline.** `audit`, `study`, `hangar`, `sim`, `sources_registry` are all distinct `pgSchema` instances; `bauth_*` lives in `public` only because better-auth requires it. Every namespace is centralized in `SCHEMAS` (`libs/constants/src/schemas.ts`) and reused -- no string-literal `pgSchema('study')` anywhere.
- **CHECK-from-constants is the universal pattern.** Every enum-shaped column has a CHECK that reads from `*_VALUES` constants via `inList()`. The `inList` helper is duplicated across files, but the *pattern* is stable.
- **Consistent ID strategy.** Everything is `prefix_ULID` text. `createId('batch')`, `createId('edition')`, `card_<ulid>`, `rses_<ulid>`, etc. The two exceptions are intentional: knowledge-graph node IDs use authored slugs (so cross-build identity is grep-able), `docs_search_index.path` uses path as PK.
- **Composite-FK ownership pattern.** [`card_state.(card_id, user_id)` -> `card.(id, user_id)`](../../../libs/bc/study/src/schema.ts#L501-L507) and the matching `session_item_result -> session` composite FK are the right way to lock denormalized `user_id` columns at the storage layer. This pattern is healthy and worth preserving.
- **Partial indexes are used where they pay.** `editions_source_current_idx WHERE retired_at IS NULL`, `goal_user_primary_unique WHERE is_primary = true`, `card_state_user_mastered_idx WHERE stability > MASTERY_STABILITY_DAYS`, `hangar_review_session_open_unique_idx WHERE finished_at IS NULL`. Hot reads stay narrow; cold rows don't pollute the index.
- **`timestamps()` is universal.** Every mutable table spreads the helper. The only places without it are intentional projections (`card_state` uses a custom `updatedAt` block, `knowledge_node_progress` skips `createdAt` because every write is a full upsert).
- **Audit trail preservation.** Every user FK on a historical / append-only table uses `onDelete: 'set null'` (`audit_log.actorId`, `hangar_review_session.userId`, `hangar_invitation.invitedByUserId`, `card_snooze.userId` is the exception -- intentional, snoozes belong to the user). The discipline is correct: GDPR-purging a user must not destroy the audit trail.

## Issues

### A. CRITICAL: three parallel edition stories that don't know about each other

- **Tables**: `sources_registry.editions` ([libs/sources/src/db/schema.ts:137](../../../libs/sources/src/db/schema.ts#L137)) + `study.reference` / `study.reference_section` ([libs/bc/study/src/schema.ts:1335,1497](../../../libs/bc/study/src/schema.ts#L1335)) + `study.syllabus` ([libs/bc/study/src/schema.ts:1969](../../../libs/bc/study/src/schema.ts#L1969))
- **Problem**: The schema currently models "edition" three independent ways:
  - `sources_registry.editions` is the ADR 019 §6.1 home: per-`SOURCES`-entry edition history, lifecycle-aware, `retiredAt` partial index for "current edition" lookup, alias-entry JSONB for the supersedes chain. `sourceId` is the canonical `airboss-ref:` URI.
  - `study.reference` carries its own `(documentSlug, edition)` unique index, `supersededById` self-FK with `onDelete: 'set null'`, `subjects: text[]`, `primaryCert`, `sectionSchema` jsonb. The `reference_section` rows then carry their own `airboss_ref` mirror (CHECK `~ '^airboss-ref:'`).
  - `study.syllabus` carries a *third* `supersededById` self-FK, partial UNIQUE on `(kind, edition) WHERE kind IN ('acs','pts')`, optional `referenceId` FK to `reference`.

  None of these tables know about the others. A row in `editions` does not know a `reference` exists; a `reference.supersededById` chain does not consult `editions.retiredAt`; a `syllabus.superseded_by_id` chain is a third walker. ADR 019's amendment ("optional edition + drift sentinels") raises the stakes: the validator is about to become *precision-aware* about edition pinning, but it can only consult one of the three. Whichever it consults is "right" for that corpus and silently wrong for the others.

  Concrete failure modes already latent:
  1. Promote a new AFH edition via the registry (write to `sources_registry.editions`, retire prior). `study.reference.superseded_by_id` is not updated -- the handbook reader's "newer edition available" banner is now wrong.
  2. Author a new syllabus edition (`syllabus.superseded_by_id` set). The registry doesn't know. `airboss-ref:acs/...` resolution paths that read the registry get the wrong "current."
  3. The drift-sentinel mechanism in the amendment looks up `chapter_title` against "current edition," but "current" in `sources_registry.editions` and "current" in `study.reference` can disagree by a sync window.
- **Rule**: ADR 019 §2 + §6.1 designate the registry as the single source of truth for source identity, edition history, and supersedes chains. Two parallel stories in `study.*` are pre-ADR-019 carryover.
- **Fix**: Decide and write an ADR (call it 021 or extend 019) that picks ONE of:
  1. **Registry-canonical** (recommended): `sources_registry.editions` is authoritative. `study.reference.edition` becomes a denormalized cache populated from the registry on seed; `study.reference.superseded_by_id` is dropped (resolve via registry). `study.syllabus.superseded_by_id` is dropped (same path). The amendment's drift sentinels read `editions` directly, not the per-corpus mirror.
  2. **Per-corpus-canonical**: registry table is for audit only; each corpus (handbooks, syllabi, regs) owns its own edition story. `editions` shrinks to a write-only audit ledger. (I do not recommend this -- ADR 019 was explicit that the registry is the truth; this option also turns the amendment's drift mechanism into N independent implementations.)

  Either way, the schema needs to commit to one model. Today it ships both, and the drift-sentinel work in flight will harden the inconsistency rather than resolve it.

### B. MAJOR: `study.reference_section.airboss_ref` is duplicated state

- **Table**: [`study.reference_section`](../../../libs/bc/study/src/schema.ts#L1497)
- **Column**: `airboss_ref text NOT NULL` (line 1553) with shape CHECK and an index
- **Problem**: The URI is computable from `(reference.kind, reference.documentSlug, reference.edition, reference_section.code)`. The per-row mirror was written "because five different URI shapes per corpus make at-write computation strictly simpler than at-read" -- which is true today, but it bakes the URI into the row. Any change to the URI shape (locator-grammar change, a new corpus that needs disambiguation, the optional-edition path-grammar tie-break in the amendment) requires rewriting every row's `airboss_ref` column.

  This is the rigidity that the next corpus migration is most likely to hit. The amendment specifically introduces "edition optional in the locator path" + a path-grammar disambiguation rule (per the amendment review, item B). The day that lands, `study.reference_section.airboss_ref` for every existing handbook section is *almost-correct-but-not-quite* and needs a full rewrite pass.
- **Rule**: ADR 019 §1.2 -- the URI is a derived deep-link target, not a primary key. The amendment makes that more true, not less.
- **Fix**: Two options, ranked:
  1. **Drop the column**: keep the URI a derived value computed at read time by a `urlForReference()`-style helper. The 5-corpus shape variation is per-corpus resolver code, not a row-level state. This trades the index for a code-generated URI, which is fine because the code-generated path is what the amendment's drift logic will need anyway.
  2. **Keep but make it generated**: convert to a `generatedAlwaysAs` STORED column (Drizzle supports this -- see `hangarDocsSearchIndex.tsv`) computed in SQL from `(reference_id, code)` joined with `reference`. This keeps the index but eliminates the "rewrite every row when the URI shape changes" failure mode.

  Recommend #1; the `airboss-ref:` URI is application-layer data, not storage state.

### C. MAJOR: `study.knowledge_node.references` is a free-form JSONB ledger that the amendment is about to invalidate

- **Table**: [`study.knowledge_node`](../../../libs/bc/study/src/schema.ts#L156)
- **Column**: `references jsonb $type<{ source: string; detail: string; note: string }[]>` (line 188), with companion `references_v2_migrated boolean` flag (line 239) and a GIN index `references @> ?::jsonb`
- **Problem**: Per the comment at line 239, this column is mid-migration from `LegacyCitation` to `StructuredCitation`. The amendment now makes the picture more complicated: citations should carry optional edition pins + sentinel fields (`chapter_title`, `section_title`, etc.). The current shape (`{source, detail, note}`) carries none of that, the v2 shape (per `@ab/types` `StructuredCitation`) carries some of it, and neither carries sentinels.

  The flag (`references_v2_migrated`) defends against re-migration, but every additional citation-shape decision (sentinels, optional editions, drift NOTICE state) means another flag column or another migration script. The pattern doesn't scale.
- **Rule**: ADR 019 amendment -- citations grow per-corpus sentinel fields and optional edition pins. The amendment review (Q1) commits a canonical sentinel vocabulary across corpora.
- **Fix**: Two parts.
  1. **Replace the per-node JSONB references with rows in the existing `study.content_citations` polymorphic table** ([libs/bc/study/src/citations/schema.ts](../../../libs/bc/study/src/citations/schema.ts)). It already supports `source_type='knowledge_node'` -> `target_type='reference'` / `target_type='regulation_node'`. The cited-by panel is faster, the schema is one shape across cards / nodes / scenarios, and adding sentinel fields is one column add against one table instead of "re-shape every JSONB row."
  2. **Add per-citation columns for the amendment's sentinel vocabulary**: `chapter_title text`, `section_title text`, `paragraph_text text`, `page_heading text` on `content_citations`, all nullable. The validator reads these on every build per the amendment.

  This also resolves issue A's "no place for drift sentinels" -- the table is already polymorphic and can hold them.

### D. MAJOR: `study.scenario.regReferences` is a stringly-typed citation list with no FK and no shape

- **Table**: [`study.scenario`](../../../libs/bc/study/src/schema.ts#L558)
- **Column**: `regReferences: jsonb $type<string[]>().notNull().default([])` (line 581)
- **Problem**: Free-form `string[]` of regulation reference text. No FK, no URI shape, no edition awareness, no drift detection. Today this is a label-only field; the moment any reader wants "scenarios that cite this CFR section," it's a JSONB scan that doesn't compose with the citation BC.
- **Rule**: Same as C -- the polymorphic `content_citations` table exists for exactly this. Per ADR 019 the canonical reference shape is the `airboss-ref:` URI, not free-form strings.
- **Fix**: Migrate `regReferences` into `content_citations` rows with `source_type='scenario'`, `target_type='reference_section'`. Drop the column. The BC layer's read of `getCitationsOf({source: 'scenario', sourceId})` already exists.

### E. MAJOR: `study.knowledge_edge.toNodeId` deliberately has no FK -- but the `targetExists` boolean defends a problem the schema can solve directly

- **Table**: [`study.knowledge_edge`](../../../libs/bc/study/src/schema.ts#L297)
- **Column**: `toNodeId text` (no FK), `targetExists boolean` maintained by the build script
- **Problem**: ADR 011 permits edges to non-existent nodes (a visible gap is information). Fine, but the current implementation pays for that flexibility by giving up referential integrity entirely *and* maintaining a denormalized boolean that can drift between build runs. The build script is the only writer keeping `targetExists` accurate; any direct insert path (test fixture, manual SQL) silently corrupts the value.

  Postgres has a clean answer: a deferred FK that allows insert-time gaps but checks at commit. Or simpler: keep the column FK-free but stop maintaining the boolean -- read-time `LEFT JOIN knowledge_node ON to_node_id = id` answers the same question without drift.
- **Rule**: Convention violation -- the schema is fine to relax FK enforcement when the domain demands it (ADR 011 does), but it should not then re-introduce the same constraint as a denormalized cache that the build script has to keep correct.
- **Fix**: Drop `targetExists`. Read the existence at query time via `LEFT JOIN knowledge_node`. The build script writing this column once per run is a class of subtle bug (rebuild order, partial seed runs, dev-seed pipelines) that a `LEFT JOIN ... IS NULL` filter eliminates.

### F. MAJOR: `study.knowledge_node_progress.nodeId` is nullable + indexed but should be NOT NULL

- **Table**: [`study.knowledge_node_progress`](../../../libs/bc/study/src/schema.ts#L1047)
- **Column**: `nodeId text references(...) on delete set null` (line 1063), nullable
- **Problem**: A progress row with `nodeId IS NULL` is meaningless -- there's nothing to track progress *of*. The comment says `set null` is preserved to avoid losing the row when a node is renamed, but the cascade-set-null leaves an orphan that no read path can act on, and the unique index `knp_user_node_unique (user_id, node_id)` will let multiple null rows accumulate per user (Postgres treats NULLs as distinct in unique indexes).

  This is a known weak spot in the `(user_id, nullable_node_id)` unique-index pattern across the schema -- once a node is renamed, the orphan progress rows survive forever and the user can collect another orphan every time another node renames.
- **Rule**: Nullable should be intentional; here it actively breaks the invariant the unique index expresses.
- **Fix**: Choose one:
  1. `onDelete: 'cascade'` and accept that renaming a node forfeits progress (rebuild-on-rename is the seed's job; if rebuild preserves the slug, no cascade fires).
  2. Keep `set null` but add `WHERE node_id IS NOT NULL` to the unique index so orphans don't accumulate, and add a periodic cleanup job that drops rows where `node_id IS NULL`.

  Recommend #1. Knowledge-graph slugs are stable per ADR 011; rename is rare; cascade is cleaner.

### G. MAJOR: ADR 019 §1.5 / amendment "edition pinning required when locator is page/quote/paragraph" is not encoded anywhere in the DB

- **Tables**: `study.content_citations` (target_type='reference' or 'regulation_node'), eventual sentinel/pin columns
- **Problem**: ADR 019 v3 mandated edition pinning; the amendment relaxes it for chapter-level locators but tightens it for `?page=` / `?paragraph=` / quote-bearing citations. None of this is in the schema. The validator runs at build time and is the only enforcement; a direct SQL insert of a page-pinned citation without an edition is accepted.

  This is structurally fine (build-time validation is the primary gate per ADR 019 §1.6), but two things are worth thinking about:
  1. When sentinels land per amendment Q1, the polymorphic citations table will carry `chapter_title`, `page_heading`, etc. The CHECK that "page_heading is set => edition is pinned" can live at the schema layer cheaply.
  2. The CHECK is the kind of belt-and-suspenders guard the project already uses for `sir_teaching_exercise_shape_check` and `scenario_option.why_not_required_check`. Keeping the schema dumb here trades one consistent enforcement pattern.
- **Rule**: ADR 019 amendment -- precision-determines-pin is the canonical rule.
- **Fix**: When `content_citations` grows the sentinel + edition columns (per issue C fix), add a CHECK enforcing "edition-sensitive locator implies edition pinned" inline. This is a minor amount of SQL and guarantees the rule holds even if the validator changes shape.

### H. MAJOR: rigidity in CHECK-from-constants will hurt the next corpus migration

- **Tables**: `study.knowledge_node` (`minimum_cert_check`, `study_priority_check`), `study.scenario` (`difficulty_check`, `phase_check`), `study.syllabus_node` (`level_check`, `triad_check`, `required_bloom_check`, `parent_level_consistency_check`), `study.reference` (`primary_cert_check`)
- **Problem**: The CHECK-from-constants pattern is good *for closed enums* (card status, review rating). It is *bad* for vocabularies that grow with corpora. `syllabus_node.parent_level_consistency_check` hard-codes `('area', 'chapter')` as the only top-of-tree levels; the CFR ingestion (which uses `subpart` / `part` as top-of-tree levels per `reference.section_schema`) would fail this CHECK if it ever stored a syllabus row. The amendment's per-corpus sentinel vocabulary (Q1: `chapter_title` / `section_title` / `paragraph_text` / `page_heading`) will run into the same wall when added.

  Every CHECK against a constants array is also a *migration-time hazard*: changing the array means writing a migration that drops and recreates the CHECK. The project does this routinely, but each one is a manual step.
- **Rule**: CHECK constraints should encode invariants that hold across all corpora and all foreseeable values. Per-corpus vocabularies are not invariants of the schema; they are policy.
- **Fix**: Two-part.
  1. **Move per-corpus level vocabulary out of CHECKs into the existing `reference.section_schema` JSONB**, which already declares `levels: string[]`. Validate at ingest time (Zod, per the existing `reference_section` comment "Validation moves to ingest-time Zod"). Drop `parent_level_consistency_check` from `syllabus_node`. Same logic for `level_check`, `triad_check`.
  2. **Keep CHECKs only where the value set is genuinely closed at the schema level**: card status (`active`/`archived`), review rating (1-4), session outcome -- these are not corpus-policy. Audit the existing CHECKs once and decide per-CHECK; the criterion is "would adding a new corpus change this set?"

  This is the *flexibility* axis the user asked about. Today the schema's CHECKs encode a snapshot of policy; they should encode invariants.

### I. MINOR: duplicated `inList()` helper in five files

- **Files**: `audit/src/schema.ts:24`, `sources/src/db/schema.ts:29`, `hangar-jobs/src/schema.ts:22`, `bc/study/src/schema.ts:116`, `bc/study/src/citations/schema.ts:26`, `bc/hangar/src/schema.ts:65`
- **Problem**: The same 1-line helper exists six times. Each escapes single quotes; minor variations in identifier names. Drift risk is low (the function is trivial) but it's a "looking at this every file is the same" smell.
- **Fix**: Move `inList` to `@ab/db` next to `timestamps()`. Export from `libs/db/src/index.ts`. Ten-line refactor.

### J. MINOR: `audit.audit_log.target_type_check` is a hard-coded enum that grows with every BC

- **Table**: `audit.audit_log`
- **Column**: `target_type` with `targetTypeCheck` against `AUDIT_TARGET_VALUES`
- **Problem**: `AUDIT_TARGET_VALUES` lists every table in every BC that gets audited (e.g. `'study.card'`, `'hangar.source'`). Adding a BC means editing the constants file *and* migrating the CHECK. Same migration-rigidity story as H.
- **Rule**: Per H -- value sets that grow with the project are policy, not invariants.
- **Fix**: Drop the CHECK. The audit BC writer is the gate; targetType is a free-form route key. (Lower-priority than H because audit_log is append-only and the cost of a typo is one bad audit row, not a production crash.)

### K. MINOR: `study.reference_section.faaPageStart/End` is handbook-specific in a corpus-agnostic table

- **Table**: `study.reference_section` (lines 1556-1561)
- **Problem**: The table's docstring is explicit that it's the substrate for *every* corpus's hierarchical content (handbooks, AIM, CFR, AC, ACS, ...). But it carries two columns and a CHECK (`reference_section_faa_pages_check`) that only mean something for handbooks. CFR section rows will always have these as NULL; ACS task rows will always have these as NULL.

  Two columns of NULL on every non-handbook row is cheap, but the principle is wrong: per-corpus extras should live in the `metadata` jsonb (the schema already has it for that purpose, line 1582).
- **Rule**: Per-corpus policy belongs in `metadata`, not in dedicated columns on the shared table.
- **Fix**: Move `faaPageStart` / `faaPageEnd` into `metadata.faaPages = { start, end }`. Drop the CHECK; per-corpus Zod validates at ingest. One migration. This is the same lesson as H -- corpus-specific shape goes in `metadata`.

### L. MINOR: `study.reference.subjects` is text[] but `study.knowledge_node.cross_domains` is jsonb<string[]>

- **Tables**: `study.reference.subjects` (line 1363), `study.knowledge_node.crossDomains` (line 165), `study.knowledge_node.knowledgeTypes` (line 167), `study.knowledge_node.modalities` (line 184), `study.knowledge_node.assessmentMethods` (line 190), `study.knowledge_node_progress.visitedPhases` (line 1064)
- **Problem**: Inconsistent representation of "list of strings." Three of these are `jsonb<string[]>`, two are `text[]`. Both work; the GIN index requires different opclasses; the containment operators are different (`@>` vs `<@` vs `?|`).

  The pragmatic choice (reasonable, but worth deciding): use `text[]` for fixed vocabularies (with CHECK against the canonical array) and jsonb only when the elements have shape (`{ source, detail, note }`). The schema currently mixes them without a documented rule.
- **Rule**: Consistency convention -- pick one shape for "list of enum strings" and use it everywhere.
- **Fix**: Pick `text[]` for enum-array columns (`crossDomains`, `knowledgeTypes`, `modalities`, `assessmentMethods`, `visitedPhases`, `completedPhases`, `focusDomains`, `skipDomains`); keep jsonb for shape-bearing arrays (`citations`, `regulatory_basis`, `relevance`). Gives consistent GIN behavior, simpler containment queries, and the `<@ ARRAY[...]::text[]` CHECK pattern (already used by `reference.subjects`) becomes the canonical enum-array CHECK.

### M. MINOR: `sim.attempt.scenarioId` is text with no FK

- **Table**: [`sim.attempt`](../../../libs/bc/sim/src/schema.ts#L64)
- **Column**: `scenarioId text NOT NULL` (line 71)
- **Problem**: Sim scenarios are code-resident today (no `sim_scenario` table), so the column has no FK target. That's fine, but the column should at least carry a CHECK on shape (sim scenarios use a `sce_*` prefix per the BC) so a typo at insert time is caught at the storage layer. Same defense-in-depth pattern as `reference_section.airboss_ref_shape_check`.
- **Fix**: Add `check('sim_attempt_scenario_id_shape_check', sql.raw("\"scenario_id\" ~ '^sce_'"))`.

### N. MINOR: `hangar.source.checksum` and `downloadedAt` use `'pending-download'` sentinel strings

- **Table**: [`hangar.source`](../../../libs/bc/hangar/src/schema.ts#L158)
- **Columns**: `checksum text NOT NULL` (line 175), `downloadedAt text NOT NULL` (line 177)
- **Problem**: The comments explicitly call out that NOT NULL is preserved by writing `'pending-download'` sentinel strings. This is a known anti-pattern: the schema lies (the column is "always set"), the BC layer has to filter sentinel values out on read, and the meaning of "is this row downloaded yet?" becomes a string compare instead of an `IS NULL` check.

  Sentinel strings are also brittle for `downloadedAt` because the column is `text` (presumably ISO-8601), so a `WHERE downloaded_at < some_iso_string` filter accidentally matches `'pending-download'` (alphabetical sort).
- **Rule**: NOT NULL means "always carries a meaningful value." Placeholders defeat the constraint.
- **Fix**: Make both columns nullable. Update BC reads to check `IS NULL`. Optionally add a CHECK that `(checksum IS NULL) = (downloaded_at IS NULL)` to enforce the pair invariant. Convert `downloaded_at` from `text` to `timestamptz` while you're touching it (currently stored as ISO string, which loses index-friendly comparison).

### O. MINOR: `study.session.completedAt`, `hangar.review_session.finishedAt`, `sim.attempt.endedAt` -- inconsistent "completed" column names

- **Tables**: `session.completedAt`, `memory_review_session.completedAt`, `hangar_review_session.finishedAt`, `sim.attempt.endedAt`, `card_snooze.resolvedAt`
- **Problem**: Five different tables, four different column names for "this row is finished." `completedAt`, `finishedAt`, `endedAt`, `resolvedAt`. Each was reasonable in isolation; cross-cutting the value drops because no read path reuses logic.
- **Fix**: Pick one (`completedAt` is the most common; `resolvedAt` for snooze stays because "resolved" is the BC verb). Migrate one or two; document the convention in a CLAUDE.md or pattern doc.

### P. MINOR: `hangar.source.path` is repo-relative blob path stored as text

- **Table**: `hangar.source` line 172
- **Problem**: The `path` column is the cache-relative path under `hangar-blobs/`. If the cache layout ever changes (new ADR 018-style refactor), every row needs a rewrite. Storing the path is fine in principle; the issue is no shape constraint, no length cap, no NUL-byte check.
- **Fix**: Add a CHECK on shape (`~ '^[a-z0-9][a-zA-Z0-9/_.-]*$'` or similar) and a length cap. Defense-in-depth; minor.

### Q. MINOR: `hangar.docs_search_index.path` uses path as PK -- portable across rename?

- **Table**: `hangar.docs_search_index` line 769
- **Problem**: PK = filesystem path. Renaming the file means delete + insert (the loader handles this), but if a path renames mid-loader-run, race conditions could leave both rows briefly. Not a critical issue (the loader is the only writer and runs single-process), but worth noting.
- **Fix**: None needed today; flag as something to revisit if the loader ever runs concurrently or if multiple workspaces share the docs index.

### R. MINOR: `study.knowledge_node.references` GIN index uses `jsonb_path_ops` opclass

- **Table**: `study.knowledge_node` line 265
- **Problem**: `jsonb_path_ops` only supports `@>` containment. The reverse query `getNodesCitingSection` only needs containment (correct). But if the amendment's drift logic ever needs `?` / `?|` / `?&` (key-existence, e.g. "find every node whose references include a sentinel field"), the index won't help.
- **Fix**: When the amendment's sentinel work lands, evaluate whether a second `jsonb_ops` GIN index is needed alongside. Today this is a documentation note, not a fix.

### S. NIT: `study.session.items` jsonb stores ordered items inline -- comment says "atomic batch commit" but `session_item_result` exists

- **Table**: `study.session` line 858
- **Problem**: `items: jsonb<SessionItem[]>` carries the ordered batch the engine produced, *and* `session_item_result` records the actual outcomes per slot. Two sources of truth for "what items were in this session." Comment at line 738 explains the design (commit atomically), and the unique `(session_id, slot_index)` covers the result side. Worth a doc entry that lists the invariants between the two so a future reader can verify them.
- **Fix**: Add an invariant block to the schema docstring: "items[i] and session_item_result.slot_index=i must agree on (cardId|scenarioId|nodeId|teachingExerciseId)."

### T. NIT: enum-name drift -- `STATUSES` vs `_VALUES`

- **Pattern**: `CARD_STATUSES.ACTIVE` (object map) vs `CARD_STATUS_VALUES` (array of strings). Used everywhere, but inconsistently named.
- **Fix**: Document the convention. Object maps end in `S` (`STATUSES`, `MODES`, `KINDS`); arrays end in `_VALUES`. Already mostly done; one or two outliers can be tidied.

### U. NIT: `study.reference_section_errata.publishedAt` is `text`, not `date`

- **Table**: `study.reference_section_errata` line 1693
- **Problem**: ISO-8601 date stored as text loses index-friendly comparison. The column is read by the reader's "newest first" ordering; today it works because ISO-8601 strings sort lexicographically.
- **Fix**: Convert to `date` (Drizzle has `date` mode). Defensive; correct sort order is preserved.

### V. NIT: `hangar.source.downloadedAt` is `text`, see N

### W. NIT: `study.user_pref.value: jsonb notNull` has no CHECK

- **Table**: `study.user_pref` line 2361
- **Problem**: Comment at line 2350 explains "per-key validation lives in BC `setUserPref`, not a CHECK," because closed sets evolve faster than schema migrations. Reasonable, but the column has no shape guard at all -- a `value: null` JSONB literal would be accepted (Postgres distinguishes SQL NULL from JSON null).
- **Fix**: Optional `CHECK (jsonb_typeof(value) <> 'null')` if you want to reject the JSON-null special case.

### X. NIT: `audit.audit_log.targetId` is nullable -- but the partial-index hot-path for "audit by target" assumes both columns

- **Table**: `audit.audit_log` line 60, index at line 76
- **Problem**: `auditTargetIdx (targetType, targetId, timestamp)` carries `targetId` as a non-leading column with NULLs. Postgres treats NULLs as distinct, but also returns them in B-tree order. The "audit_log_target_type_time_idx" alongside is the redundancy guard. Worth confirming that `auditRecent({targetType, targetId})` reads use the right index when `targetId IS NULL`.
- **Fix**: Confirm the planner picks `auditTargetTypeTimeIdx` for `targetType IN (...) AND targetId IS NULL` reads via `EXPLAIN`. Documentation only.

### Y. NIT: `study.review.review_session_id` FK is `set null` but the comment justifies it as "history preservation"

- **Tables**: `study.review` line 441
- **Observation**: The comment is right; the FK is correct. Worth flagging that the index `review_session_card_idx (review_session_id, card_id)` will accumulate NULL leading-column rows over time. Minor; partial-on-`review_session_id IS NOT NULL` would tighten it.
- **Fix**: Convert to partial index `WHERE review_session_id IS NOT NULL` if the legacy review row count gets large.

### Z. NIT: `hangar.invitation.acceptedUserId` and `revokedByUserId` are FK'd but neither is indexed

- **Table**: `hangar.invitation` lines 322-330
- **Observation**: The cascade `set null` requires Postgres to find rows by these columns when the user deletes. Without indexes, deletion is O(N). N is small today (invitations are low-volume), but if the surface ever scales, this is a sub-second-becomes-multi-second risk.
- **Fix**: Add `(acceptedUserId)` and `(revokedByUserId)` indexes when invitation volume warrants. Today: documentation note.

### AA. NIT: `sources_registry.promotion_batches.reviewerId` is text without an FK

- **Table**: `sources_registry.promotion_batches` line 53
- **Comment in schema** (line 53): `Reviewer ULID. Free-form text; reviewers aren't FK'd to bauth_user yet.`
- **Observation**: The audit trail of who promoted what is the load-bearing trail of ADR 019 §2.4. A free-form text reviewer ID is a known weak spot. The comment explicitly defers the FK; worth flagging that this needs to land before promotion_batches goes hot in Phase 3 of the WP.
- **Fix**: When the WP `promotion-batches-persistence` Phase 3 lands, add the FK to `bauth_user.id` with `onDelete: 'restrict'` (the audit trail must outlive the user; restrict forces an explicit reassignment).

### BB. NIT: `study.scenario` does NOT have `...timestamps()` -- only `createdAt`

- **Table**: `study.scenario` line 598
- **Observation**: Every other content-bearing table uses `...timestamps()`. Scenarios skip `updatedAt`. Editing a scenario doesn't bump anything; the BC has to write `(scenarios.id = ?, status = active, ...)` without an audit trail of the edit time.
- **Fix**: Add `...timestamps()` to `scenario`. Migration is metadata-only ALTER + default backfill from `createdAt`.

## Per-axis answer to the user's three asks

### Consistency

The schema is largely consistent: namespaces, ID strategy, CHECK-from-constants, `timestamps()`, FK-cascade discipline. The places it isn't:

- **String-list representation** (issue L) -- `text[]` vs `jsonb<string[]>` mixed.
- **"Completed" column naming** (issue O) -- four names for one concept.
- **Per-table `inList()` duplication** (issue I) -- helper repeated six times.
- **Enum-name suffix** (`STATUSES` vs `_VALUES`, issue T) -- mostly there, one or two outliers.
- **Three parallel edition stories** (issue A, the big one).

### Flexibility

The schema is *less* flexible than the user thinks, in two specific ways:

- **CHECK-from-constants encodes policy as schema** (issue H, J). Each new corpus, each new vocabulary value, requires a migration. The right home for per-corpus vocabulary is `metadata` jsonb + ingest-time Zod, with CHECKs reserved for genuinely closed enums.
- **`reference_section.airboss_ref` bakes URI shape into stored state** (issue B). The amendment's path-grammar work will need a full-table rewrite to update.

The schema is *more* flexible than necessary in two places:

- **`hangar.source.checksum/downloadedAt` sentinel strings** (issue N) -- nullable would have been simpler, the schema chose NOT NULL + sentinel.
- **`knowledge_edge.targetExists` denormalized boolean** (issue E) -- `LEFT JOIN` answers the question without a maintained cache.

### Efficiency

Index coverage is good. The places worth attention:

- **`hangar.invitation.acceptedUserId / revokedByUserId`** are FK'd without supporting indexes (issue Z). Cheap fix when invitation volume grows.
- **`audit.audit_log` indexes** are well-shaped; one verification step (issue X) on the planner choice for `targetId IS NULL` queries.
- **GIN opclass choice** on `knowledge_node.references` (issue R) is the right call today; revisit when the amendment's sentinel queries land.
- **Partial indexes** are everywhere they should be. No regressions found.
- **`study.review.review_session_id`-leading index** (issue Y) accumulates NULLs over time. Convert to partial when legacy volume warrants.

The single biggest efficiency gain available: **moving `knowledge_node.references` JSONB into `content_citations` rows** (issue C). Today the GIN scan is cheap but the *write* path rewrites the entire array on every node edit. Per-citation rows are smaller writes, faster reverse queries, and unify the citation shape across cards / scenarios / nodes.

## Recommendations

In priority order:

1. **Resolve the three-parallel-edition-stories incoherence** (issue A). This is the next ADR-class decision. Until it's resolved, every ADR 019 amendment lands into an inconsistent substrate.
2. **Plan the `knowledge_node.references` -> `content_citations` migration** (issue C). The sentinel + optional-edition work in the amendment is the natural trigger; the migration should land before sentinels do, not after.
3. **Drop `study.knowledge_edge.targetExists`** (issue E). Pure cleanup; replaces a maintained boolean with a `LEFT JOIN`.
4. **Drop or generate `study.reference_section.airboss_ref`** (issue B). Removes a pre-loaded migration cost when the path grammar evolves.
5. **Audit CHECK-from-constants for policy vs invariant** (issues H, J). Per-corpus vocabularies move to `metadata` + ingest Zod.
6. **Migrate `study.scenario.regReferences` into `content_citations`** (issue D). Aligns the citation surface across content kinds.
7. **Address the `study.knowledge_node_progress.nodeId` orphan-row pattern** (issue F).
8. **Tidy nullable-sentinel patterns** (`hangar.source.checksum/downloadedAt`, issue N).
9. **Consolidate `inList()` into `@ab/db`** (issue I).
10. **Standardize string-list representation and "completed" column names** (issues L, O).

Items 1-2 are the ones that actually block clean work on the next corpus migration; everything else is incremental.

## What's right and worth preserving

- The composite-FK ownership pattern (`card_state -> card`, `session_item_result -> session`) is excellent. Keep using it for any future per-user content table.
- The polymorphic `content_citations` table is the right architectural choice; just finish the job by routing every citation kind through it.
- The partial-index discipline (`WHERE retired_at IS NULL`, `WHERE is_primary = true`, etc.) is uniformly applied where it pays.
- The `timestamps()` helper + `auditColumns()` pattern is clean, opt-in, and consistent.
- The dev-seed marker convention (`seed_origin text`) is uniform across content tables and makes seed cleanup tractable.
- ADR-driven schema design (004 namespaces, 011 knowledge graph, 016 cert-syllabus, 019 reference identifier, 020 handbook editions) is producing a coherent substrate. The edition-coherence issue (A) is the natural next ADR.
