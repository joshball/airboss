---
title: 'Tasks: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: tasks
status: unread
review_status: pending
amended:
  - 2026-04-27 -- amended to compose with merged WP #1 (PR #242) and accepted ADR 019 v3
---

# Tasks: Cert, Syllabus, and Goal Composer

Phased plan for [spec.md](./spec.md). Order is dependency-driven: contract + schema first, build pipeline next, BC + migration on top, transcription, ship.

Depends on: handbook-ingestion-and-reader (shipped in PR #242; provides `reference`, `handbook_section`, `handbook_figure`, `handbook_read_state` tables and the discriminated-union `StructuredCitation` shape on `knowledge_node.references`). Depends on: reference-identifier-scheme-validator (shipped in PR #241; provides `@ab/sources` parser, validator, lesson-parser, and registry stub for ADR 019 `airboss-ref:` identifiers). Depends on: knowledge-graph (shipped; provides `knowledge_node` + `knowledge_edge`). Depends on: study-plan-and-session-engine (shipped; this WP migrates `study_plan.cert_goals` data without changing the engine).

## Amendment scope (2026-04-27)

This task list was originally authored before PR #242 and PR #241 merged. The reconciliations applied:

- Tasks that proposed creating a `study.citation` table or `citations.ts` citation-row BC are dropped. Citations live inline as `StructuredCitation` JSONB on each consumer per WP #1.
- Tasks that proposed creating `study.reference` are dropped. The table exists; this WP seeds rows.
- Tasks that proposed `CITATION_LOCATOR_KINDS` are dropped. The locator shape lives inside `StructuredCitation` per kind.
- New tasks added: extend `StructuredCitation` with optional `framing` + `airboss_ref`; ship the `acs` corpus resolver in `@ab/sources`; validate every syllabus leaf's `airboss_ref` via the validator from PR #241; seed reference rows for ACS / PTS / endorsement publications.
- Phase numbering preserved where possible; the citation-BC phase is replaced in place by reference-seeding + StructuredCitation extension work, the references-to-citations migration becomes references-to-structured.

Credential, Goal, Lens framework, syllabus YAML pipeline, and PPL ACS Area V transcription tasks are unchanged in scope.

## Pre-flight

- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` and `context.md` end-to-end.
- [ ] Read `docs/decisions/019-reference-identifier-system/decision.md` end-to-end (v3 accepted). Especially §1.2 (`acs` corpus locator example), §1.3 (publication-ID slug pinning), §2.2 (`CorpusResolver` interface), §6.1 (alias migrations).
- [ ] Read `docs/decisions/020-handbook-edition-and-amendment-policy.md` for edition-vs-errata semantics on ACS / PTS reference rows.
- [ ] Read `docs/platform/LEARNING_PHILOSOPHY.md`, especially principles 2, 3, 4, 5, 6, 9.
- [ ] Read `docs/work-packages/handbook-ingestion-and-reader/spec.md` and `design.md`. Confirm the `reference`, `handbook_section`, `handbook_figure`, `handbook_read_state` tables shipped match the spec.
- [ ] Read `docs/work-packages/reference-identifier-scheme-validator/spec.md`. Confirm `@ab/sources` exposes the parser, validator, lesson-parser, and registry stub this WP composes on.
- [ ] Read `libs/types/src/citation.ts`. Understand the `StructuredCitation` discriminated union and `LegacyCitation` shape that this WP extends and migrates from.
- [ ] Read `libs/sources/src/types.ts`, `libs/sources/src/parser.ts`, `libs/sources/src/validator.ts`, `libs/sources/src/registry-stub.ts`. Understand the contract the `acs` corpus resolver registers against.
- [ ] Read `libs/bc/citations/src/`. Confirm it is the polymorphic content-citation BC (cards / scenarios / regulations) and not affected by this WP.
- [ ] Read `libs/bc/study/src/schema.ts`. Understand existing CHECK / index / FK conventions, the JSONB `references` column shape on `knowledge_node`, and the partial-UNIQUE pattern on `study_plan`.
- [ ] Read `libs/constants/src/study.ts` and `libs/constants/src/reference-tags.ts`. Understand existing taxonomies (`CERTS`, `CERT_PREREQUISITES`, `BLOOM_LEVELS`, `STUDY_PRIORITIES`, `CERT_APPLICABILITIES`, `REFERENCE_KINDS`).
- [ ] Read `libs/constants/src/routes.ts`. Understand the `ROUTES` pattern.
- [ ] Read `course/knowledge/aerodynamics/angle-of-attack-and-stall/node.md`. Understand the existing YAML shape; note the `relevance` field that becomes derived.
- [ ] Read `apps/study/src/routes/(app)/+layout.svelte`. Understand the route grammar and nav.
- [ ] Read the largest existing WPs (`docs/work-packages/handbook-ingestion-and-reader/`, `docs/work-packages/knowledge-graph/`, `docs/work-packages/study-plan-and-session-engine/`) for shape and style.
- [ ] Confirm Open Questions 1-7 in spec.md are resolved by Joshua. Apply any required changes (active-goal model, YAML layout, `study_plan` handoff strategy, current PPL ACS edition, pilot transcription Area, `acs` corpus locator convention).
- [ ] Verify DB is running (OrbStack postgres on port 5435).
- [ ] Verify the current FAA-published PPL ACS edition. Lock seed metadata to that edition before any transcription begins.

## Implementation

### Phase 0: Constants + types contract

- [ ] Add `CITATION_FRAMINGS`, `CITATION_FRAMING_VALUES`, `CitationFraming`, `CITATION_FRAMING_LABELS` to `libs/constants/src/study.ts` (or `libs/constants/src/citations.ts` if `study.ts` is heavy and re-export from `index.ts`).
- [ ] Add `CREDENTIAL_KINDS`, `CREDENTIAL_KIND_VALUES`, `CredentialKind`, `CREDENTIAL_KIND_LABELS`.
- [ ] Add `CREDENTIAL_PREREQ_KINDS`, `CREDENTIAL_PREREQ_KIND_VALUES`, `CredentialPrereqKind`.
- [ ] Add `CREDENTIAL_CATEGORIES`, `CREDENTIAL_CATEGORY_VALUES`, `CredentialCategory`, `CREDENTIAL_CATEGORY_LABELS`.
- [ ] Add `CREDENTIAL_CLASSES`, `CREDENTIAL_CLASS_VALUES`, `CredentialClass`, `CREDENTIAL_CLASS_LABELS`.
- [ ] Add `CREDENTIAL_STATUSES`, `CREDENTIAL_STATUS_VALUES`, `CredentialStatus`.
- [ ] Add `SYLLABUS_KINDS`, `SYLLABUS_KIND_VALUES`, `SyllabusKind`, `SYLLABUS_KIND_LABELS`.
- [ ] Add `SYLLABUS_STATUSES`, `SYLLABUS_STATUS_VALUES`, `SyllabusStatus`.
- [ ] Add `SYLLABUS_NODE_LEVELS`, `SYLLABUS_NODE_LEVEL_VALUES`, `SyllabusNodeLevel`, `SYLLABUS_NODE_LEVEL_LABELS`.
- [ ] Add `SYLLABUS_PRIMACY`, `SYLLABUS_PRIMACY_VALUES`, `SyllabusPrimacy`.
- [ ] Add `ACS_TRIAD`, `ACS_TRIAD_VALUES`, `ACSTriad`, `ACS_TRIAD_LABELS`.
- [ ] Add `LENS_KINDS`, `LENS_KIND_VALUES`, `LensKind`, `LENS_KIND_LABELS`.
- [ ] Add `GOAL_STATUSES`, `GOAL_STATUS_VALUES`, `GoalStatus`, `GOAL_STATUS_LABELS`.
- [ ] Add ID prefixes: `CREDENTIAL_ID_PREFIX = 'cred'`, `SYLLABUS_ID_PREFIX = 'syl'`, `SYLLABUS_NODE_ID_PREFIX = 'sln'`, `SYLLABUS_NODE_LINK_ID_PREFIX = 'snl'`, `GOAL_ID_PREFIX = 'goal'`. (No `cit_` prefix; citations have no row.)
- [ ] Add `GOAL_SYLLABUS_WEIGHT_MIN = 0`, `GOAL_SYLLABUS_WEIGHT_MAX = 10`.
- [ ] Re-export every new constant + type from `libs/constants/src/index.ts`.
- [ ] Add deprecation comment to `CERT_PREREQUISITES`: `// @deprecated -- use getCertsCoveredBy(db, credentialId) from @ab/bc-study; retained as a fast-path for the four-cert dashboard subset until the engine cutover.`
- [ ] Extend `StructuredCitation` in `libs/types/src/citation.ts`: every variant gains optional `framing?: CitationFraming` and optional `airboss_ref?: string`. WP #1's already-seeded entries continue to validate without modification.
- [ ] Re-export `CitationFraming` and the extended `StructuredCitation` from `libs/types/src/index.ts`.
- [ ] Run `bun run check`, expect 0 errors. Commit (`feat(constants): credential, syllabus, goal contract; StructuredCitation extended with framing + airboss_ref`).

### Phase 1: Route constants

- [ ] Add `CREDENTIALS`, `CREDENTIAL`, `CREDENTIAL_AREA`, `CREDENTIAL_TASK`, `CREDENTIAL_AT_EDITION` route entries to `libs/constants/src/routes.ts`.
- [ ] Add `GOALS`, `GOALS_NEW`, `GOAL`, `GOAL_EDIT` entries.
- [ ] Add `NAV_LABELS.CREDENTIALS = 'Credentials'`, `NAV_LABELS.GOALS = 'Goals'`.
- [ ] Run `bun run check`, expect 0 errors. Commit (`feat(routes): credentials + goals route constants`).

### Phase 2: Drizzle schema -- credential, credential_prereq, credential_syllabus

- [ ] Add `credential`, `credentialPrereq`, `credentialSyllabus` tables to `libs/bc/study/src/schema.ts`. (No `citation` table; WP #1's `reference` table is consumed read-side and via existing seed helpers.)
- [ ] Add CHECK constraints per spec (kind in list, category in list, class in list-or-null, status in list, prereq kind in list, primacy in list).
- [ ] Add unique constraints on `credential.slug`, `credential_syllabus (credential_id, syllabus_id)` and partial UNIQUE on `(credential_id) WHERE primacy='primary'`.
- [ ] Add indexes per spec: `credential (kind)`, `credential (category, class)`, `credential (status)`, `credential_prereq (prereq_id)`.
- [ ] `credential.regulatory_basis` is `jsonb NOT NULL DEFAULT '[]'` carrying an array of `StructuredCitation` shapes.
- [ ] Export row + insert types: `CredentialRow`, `NewCredentialRow`, `CredentialPrereqRow`, `NewCredentialPrereqRow`, `CredentialSyllabusRow`, `NewCredentialSyllabusRow`.
- [ ] Run `bun run check`, expect 0 errors.

### Phase 3: Drizzle schema -- syllabus, syllabus_node, syllabus_node_link

- [ ] Add `syllabus`, `syllabusNode`, `syllabusNodeLink` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECK for syllabus_node level / parent_id consistency, triad / level consistency, required_bloom / is_leaf consistency, `airboss_ref LIKE 'airboss-ref:%'` syntactic guard (single CHECK using `sql.raw()`).
- [ ] `syllabus_node.airboss_ref` column: `text NULL` per spec; full validation via `@ab/sources` runs at the BC + seed layer.
- [ ] `syllabus_node.citations` column: `jsonb NOT NULL DEFAULT '[]'` carrying an array of `StructuredCitation` shapes.
- [ ] Add unique constraints on `syllabus.slug`, `syllabus (kind, edition)` partial unique for `kind IN ('acs','pts')`, `syllabus_node (syllabus_id, code)`, `syllabus_node_link (syllabus_node_id, knowledge_node_id)`.
- [ ] Add indexes per spec: `syllabus_node (syllabus_id, parent_id, ordinal)`, `syllabus_node (syllabus_id, level, ordinal)`, `syllabus_node (syllabus_id, is_leaf)`, GIN index on `syllabus_node.citations`, `syllabus_node_link (knowledge_node_id, syllabus_node_id)`, `syllabus_node_link (syllabus_node_id)`.
- [ ] Export row + insert types: `SyllabusRow`, `NewSyllabusRow`, `SyllabusNodeRow`, `NewSyllabusNodeRow`, `SyllabusNodeLinkRow`, `NewSyllabusNodeLinkRow`.
- [ ] Run `bun run check`, expect 0 errors.

### Phase 4: Drizzle schema -- goal, goal_syllabus, goal_node, plus migration flag columns

- [ ] Add `goal`, `goalSyllabus`, `goalNode` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECKs (status in list, weight bounds), partial UNIQUE on `goal (user_id) WHERE is_primary=true`.
- [ ] Add `references_v2_migrated` boolean column (DEFAULT false) to `knowledge_node`.
- [ ] Add `goal_migrated_at` timestamptz column (nullable) to `study_plan`.
- [ ] Export row + insert types: `GoalRow`, `NewGoalRow`, `GoalSyllabusRow`, `NewGoalSyllabusRow`, `GoalNodeRow`, `NewGoalNodeRow`.
- [ ] Run `bun run check`, expect 0 errors.

### Phase 5: drizzle-kit generate + migration commit

- [ ] Run `bunx drizzle-kit generate`. Inspect the generated SQL; confirm CHECKs, partial UNIQUEs, and FKs match the schema.
- [ ] Commit the generated SQL file (sequence number after WP #1's; for example `drizzle/0011_cert_syllabus_goal.sql`).
- [ ] Run `bunx drizzle-kit push` against local dev. Verify with `\d study.credential`, `\d study.credential_prereq`, `\d study.credential_syllabus`, `\d study.syllabus`, `\d study.syllabus_node`, `\d study.syllabus_node_link`, `\d study.goal`, `\d study.goal_syllabus`, `\d study.goal_node`. Verify the `references_v2_migrated` and `goal_migrated_at` columns. Verify partial UNIQUEs via `\di+`.
- [ ] Confirm the migration does NOT touch `study.reference` (WP #1 owns it). Confirm no `study.citation` table is created.
- [ ] Run `bun run check`, expect 0 errors. Commit (`feat(schema): credential + syllabus + goal tables; references_v2 + goal_migrated_at flag columns`).

### Phase 6: ID helpers

- [ ] Add `generateCredentialId`, `generateSyllabusId`, `generateSyllabusNodeId`, `generateSyllabusNodeLinkId`, `generateGoalId` to `libs/utils/src/ids.ts`. Use the same `prefix_ULID` pattern as the existing helpers.
- [ ] Export from `libs/utils/src/index.ts`.
- [ ] Run `bun run check`, expect 0 errors. Commit.

### Phase 7: Zod schemas

- [ ] Extend the Zod schema for `StructuredCitation` in `libs/types/src/citation.ts` (or wherever it lives) with the optional `framing` and `airboss_ref` fields. Keep WP #1's already-shipped narrowed shapes intact.
- [ ] Add Zod schemas for credential YAML authoring shape and the credential_prereq + credential_syllabus inline forms.
- [ ] Add Zod schemas for syllabus manifest shape, area shape, task shape, element shape (with triad-required-when-element rule), inline citation shape (composes `StructuredCitation` schema), `airboss_ref` field (string that parses via `@ab/sources` parser).
- [ ] Add Zod schemas for goal CRUD inputs: `createGoalInputSchema`, `updateGoalInputSchema`, `addGoalSyllabusInputSchema`, `addGoalNodeInputSchema`.
- [ ] Place schemas under `libs/types/src/` or `libs/bc/study/src/validation.ts` matching project convention.
- [ ] Unit tests for the discriminated-union narrowing across every `StructuredCitation` kind, including the new optional fields.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (`feat(types): credential + syllabus + goal Zod schemas; StructuredCitation framing + airboss_ref`).

### Phase 8: ACS reference seed + `acs` corpus resolver

- [ ] Author / extend `course/references/` with rows for: PPL ACS (current edition per Open Question 5), IR ACS, CPL ACS, CFI PTS, CFII PTS, MEI PTS, MEII PTS, plus the regulatory basis for 14 CFR 61.31 endorsements (`reference.kind='cfr'` rows for the relevant CFR sections; the endorsement publications themselves don't have separate FAA documents).
- [ ] Wire a seed step that calls the existing `upsertReference` helper (from WP #1's `libs/bc/study/src/handbooks.ts`) for each ACS / PTS / endorsement entry. Edition + errata fields follow ADR 020.
- [ ] Verify the seed step is idempotent (re-running with no changes produces no row writes).
- [ ] Implement the `acs` corpus resolver in `libs/sources/src/resolvers/acs.ts`. Implements the `CorpusResolver` interface from `libs/sources/src/types.ts` per ADR 019 §2.2: `parseLocator`, `formatCitation`, `getCurrentEdition`, `getEditions`, `getLiveUrl`, `getDerivativeContent` (returns `null` until ACS PDF ingestion ships), `getIndexedContent` (returns the `syllabus_node` row for the resolved ACS identifier).
- [ ] Register the `acs` resolver with the registry stub from `libs/sources/src/registry-stub.ts` at lib init.
- [ ] Implement `validateAirbossRefForLeaf(ref, leaf)` in `libs/bc/study/src/syllabi.ts` (BC + seed validator). Parses the identifier via `@ab/sources` parser; throws `AirbossRefValidationError` on shape mismatch (corpus / locator / kind / edition slug).
- [ ] Unit tests for the `acs` resolver: `parseLocator` over every shape (area-only, task-only, element-only with K/R/S triad), `formatCitation` round-trip, `getCurrentEdition` + `getEditions` against the seeded reference rows, `validateAirbossRefForLeaf` against good and bad inputs.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (`feat(sources): acs corpus resolver per ADR 019 §2.2; ACS / PTS reference seeding`).

### Phase 9: Credential BC

- [ ] Create `libs/bc/study/src/credentials.ts`. Export `listCredentials`, `getCredentialBySlug`, `getCertsCoveredBy`, `getCredentialPrereqDag`, `getCredentialPrimarySyllabus`, `getCredentialMastery`, plus build-only `upsertCredential`, `upsertCredentialPrereq`, `upsertCredentialSyllabus`.
- [ ] Implement `getCertsCoveredBy` recursively over `credential_prereq` (BFS / DFS; cycle-protected via visited set as defence-in-depth even though the seed validates DAG-ness).
- [ ] Implement `getCredentialMastery` as a single aggregate query over `syllabus_node`, `syllabus_node_link`, `knowledge_node`, and per-user mastery from `libs/bc/study/src/knowledge.ts`.
- [ ] Define `CredentialNotFoundError`, `CredentialPrereqCycleError`.
- [ ] Export read-side helpers from `libs/bc/study/src/index.ts`. Keep `upsert*` build-only (not in barrel).
- [ ] Unit tests: DAG walk over a fixture, mastery rollup over a fixture syllabus + linked nodes + per-user evidence, regulatory_basis citations validate as `StructuredCitation`.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass.

### Phase 10: Syllabus BC

- [ ] Create `libs/bc/study/src/syllabi.ts`. Export `listSyllabi`, `getSyllabusBySlug`, `getSyllabusTree`, `getSyllabusArea`, `getSyllabusLeavesForNode`, `getNodesForSyllabusLeaf`, `getCitationsForSyllabusNode`, plus build-only `upsertSyllabus`, `upsertSyllabusNode`, `replaceSyllabusNodeLinks`, `rebuildKnowledgeNodeRelevanceCache`, `validateAirbossRefForLeaf`.
- [ ] Implement `getCitationsForSyllabusNode(db, syllabusNodeId)` returning `StructuredCitation[]` from the JSONB column.
- [ ] Implement tree walks via `WITH RECURSIVE` or in-memory parent_id walk; pick whichever maps cleanest to Drizzle's query DSL and document the choice.
- [ ] Define `SyllabusNotFoundError`, `SyllabusValidationError`, `AirbossRefValidationError`.
- [ ] Export read-side helpers from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: tree walk, leaf-link forward + reverse, area-fetch with tasks + elements ordering, validation rejections, citation extraction off the JSONB column, `airboss_ref` validation (good and bad).
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass.

### Phase 11: Knowledge node citation read helper + URL resolver extension

- [ ] In `libs/bc/study/src/knowledge.ts`, add `getCitationsForKnowledgeNode(db, knowledgeNodeId)` returning `StructuredCitation[]` from the JSONB column.
- [ ] In `libs/bc/study/src/handbooks.ts`, extend `resolveCitationUrl(citation, references)` to handle every `StructuredCitation.kind` not yet covered: cfr (eCFR template), ac (FAA AC index by paragraph), acs / pts (FAA test-standards page; uses `airboss_ref` when present), aim (FAA AIM by paragraph), pcg (FAA PCG by term), ntsb / poh / other (returns `null`; UI renders the freeform note).
- [ ] When a `StructuredCitation` carries `airboss_ref`, the resolver may delegate to the `@ab/sources` registry to compute the live URL via the corpus resolver's `getLiveUrl()`. Otherwise it falls back to the kind-specific URL formula.
- [ ] URL templates live in `libs/constants/src/study.ts` so e.g. eCFR URL changes are a one-file fix.
- [ ] Unit tests covering every `StructuredCitation.kind`, success and `null` paths, `airboss_ref`-routed and locator-routed paths.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (`feat(bc): credential + syllabus + citation read helpers + URL resolver extended for every kind`).

### Phase 12: Goal BC

- [ ] Create `libs/bc/study/src/goals.ts`. Export every function in spec's "Functions" table for `goals.ts`.
- [ ] `setPrimaryGoal` is transactional: clear `is_primary=true` on every other goal for the user, then set on target. Catch the partial-UNIQUE constraint violation and translate to `GoalAlreadyPrimaryError`.
- [ ] `getDerivedCertGoals(userId)`: walks the user's primary goal's `goal_syllabus` rows -> credential_syllabus reverse-lookup -> credential.slug. Returns `string[]`.
- [ ] `getGoalNodeUnion(goalId)`: returns the union of (every node reachable via `goal_syllabus -> syllabus_node -> syllabus_node_link`) plus (`goal_node`). Aggregates weights when a node is reachable through multiple paths.
- [ ] Define `GoalNotFoundError`, `GoalNotPrimaryError`, `GoalAlreadyPrimaryError`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: CRUD, set-primary transactional behavior, multi-active goals, derived cert goals, node-union aggregation, partial UNIQUE enforcement.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (`feat(bc): goal CRUD + primary + node-union`).

### Phase 13: Lens framework

- [ ] Create `libs/bc/study/src/lenses.ts`. Export the `Lens`, `LensInput`, `LensTreeNode`, `LensLeaf`, `LensResult` types.
- [ ] Implement `acsLens`: takes a goal, walks the goal's syllabi, for each builds the Area -> Task -> Element tree from `getSyllabusTree`, attaches mastery rollups per leaf and per internal node.
- [ ] Implement `domainLens`: takes a goal, gets the goal-node-union, groups by `knowledge_node.domain` (with cross_domains as multi-membership), attaches mastery rollups.
- [ ] Both lenses accept an optional `LensInput.filters` (areaCodes / taskCodes / domains / etc.).
- [ ] Define `LensError` if needed for unsupported lens kinds.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: ACS lens shape over a fixture goal + syllabus, domain lens shape, filters honored, rollup math correct.
- [ ] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (`feat(bc): lens framework + ACS lens + Domain lens`).

### Phase 14: Credential YAML authoring + seed

- [ ] Create `course/credentials/` directory with one YAML per credential.
- [ ] Author every credential the user is pursuing (per spec): private, commercial, atp, instrument, single-engine-land, multi-engine-land, single-engine-sea, multi-engine-sea, cfi, cfii, mei, meii, complex, high-performance, tailwheel, high-altitude, spin, glass-cockpit. Plus the `student` credential as a prereq target.
- [ ] Each YAML includes: slug, kind, title, category, class, regulatory_basis (inline `StructuredCitation` array, typically `kind: 'cfr'`, with optional `airboss_ref` per ADR 019), prereqs, syllabi (initially empty for credentials whose syllabi aren't authored yet -- `cfi`, `cfii`, etc.).
- [ ] Create `scripts/db/seed-credentials.ts`. Reads `course/credentials/*.yaml`, validates against Zod (including `regulatory_basis` as `StructuredCitation[]`; `airboss_ref` parses via `@ab/sources`), runs topological sort to detect cycles, upserts `credential`, `credential_prereq`, `credential_syllabus` rows.
- [ ] Wire `bun run db seed credentials` into `scripts/db/seed-all.ts` after `references` and before `syllabi`.
- [ ] Unit test fixture under `scripts/db/__tests__/seed-credentials.test.ts`. Cover: fresh insert, idempotent re-run, cycle detection, dangling syllabus reference handling, `regulatory_basis` validation, `airboss_ref` validation.
- [ ] Run `bun run db seed credentials`. Confirm row counts. Commit (`feat(seed): credentials YAML pipeline + seed wiring`).

### Phase 15: Syllabus YAML schema + seed pipeline

- [ ] Implement the YAML reader in `scripts/db/seed-syllabi.ts`. Walk `course/syllabi/<slug>/manifest.yaml` + `course/syllabi/<slug>/areas/*.yaml`.
- [ ] Validate YAML against Zod (manifest schema + area schema + task / element / section recursion).
- [ ] For each citation-inline entry in the YAML, validate as a `StructuredCitation`, resolve the `reference` slug to a `study.reference.id`, and append the entry to the `syllabus_node.citations` JSONB array. (No citation row to upsert.)
- [ ] For each `knowledge_nodes[]` entry, upsert a `syllabus_node_link` row with the leaf's id and the node id. Reject if the node id doesn't exist.
- [ ] For every leaf row, validate `airboss_ref` via `@ab/sources` parser; corpus must be `acs` for ACS / PTS syllabi; pin must match the syllabus's edition slug.
- [ ] For ACS / PTS syllabi, hard-fail when an element-level row lacks `airboss_ref`.
- [ ] Maintain `is_leaf` correctness via a final sweep after upserts.
- [ ] Wire `bun run db seed syllabi` into `scripts/db/seed-all.ts` after `credentials`.
- [ ] Idempotency: per-syllabus content hash on the manifest file plus per-node content hash on every YAML node entry. Re-running with no changes makes no DB writes.
- [ ] Unit test fixture under `scripts/db/__tests__/seed-syllabi.test.ts`. Cover: fresh insert, idempotent re-run, level-hierarchy violation, dangling knowledge_node_link, citation-shape mismatch, `airboss_ref` parse failure, `airboss_ref` corpus mismatch, code-uniqueness violation, missing `airboss_ref` on ACS element.
- [ ] Run `bun run db seed syllabi` (against an empty `course/syllabi/`, expect 0 rows). Commit (`feat(seed): syllabus YAML pipeline + seed wiring; airboss_ref validation`).

### Phase 16: PPL ACS Area V transcription

- [ ] Create `course/syllabi/ppl-acs-<edition>/manifest.yaml` with the verified current edition (Open Question 5).
- [ ] Create `course/syllabi/ppl-acs-<edition>/areas/V-performance-maneuvers.yaml`.
- [ ] Transcribe Area V from the FAA-published PPL ACS:
  - Task A "Steep Turns" with K1, R1, R2 (or whatever the current ACS lists), S1.
  - Task B "Steep Spirals" with its K / R / S elements.
  - Task C ("Chandelles" or whatever Area V's third task is in the current edition) with its K / R / S elements.
  - Each element row includes: code, triad, title, required_bloom, description (verbatim ACS element text), `airboss_ref` (per the convention locked by Open Question 7), citations (inline `StructuredCitation` array, typically `kind: 'handbook'` for PHAK / AFH chapter references), knowledge_nodes (link to existing graph nodes by slug, with weight).
- [ ] Run `bun run db seed syllabi`. Verify the Area V tree lands cleanly. Spot-check via `psql` queries that codes are right, triads are present on element rows, `airboss_ref` strings are populated and parseable, citations resolve.
- [ ] Commit `course/syllabi/ppl-acs-<edition>/` with manifest + Area V YAML. Use `git add` per file. Commit (`feat(content): PPL ACS Area V transcribed; existing nodes wired in via syllabus_node_link; airboss-ref identifiers on every leaf`).

### Phase 17: knowledge_node.references migration to uniform StructuredCitation

- [ ] Create `scripts/db/migrate-references-to-structured.ts`. For each `knowledge_node` where `references_v2_migrated=false`:
  - For each entry in `references` JSONB:
    - If shape is `{ source, detail, note }` (legacy `LegacyCitation`): map `source` to a `study.reference` row by `(kind, document_slug, edition)` heuristics; pick a `StructuredCitation.kind` matching the resolved reference (`handbook` for handbooks, `cfr` for 14 CFR, `acs` / `pts` for test standards, etc.); fall back to `kind: 'other'` with a synthetic reference row when no match exists. Translate `detail` into the locator shape per kind (chapter/section for handbooks, title/part/section for CFRs, etc.). Default `framing` per kind (`survey` for handbook, `regulatory` for CFR, `examiner` for ACS / PTS). Stamp `airboss_ref` when the resolved kind has an established corpus convention.
    - If shape is already a `StructuredCitation` (from WP #1): pass through untouched.
  - Replace the `references` JSONB with the migrated array of uniform `StructuredCitation` entries.
  - Set `references_v2_migrated=true`.
- [ ] Output a report: per-node counts of legacy entries migrated, structured entries passed through, references resolved (existing vs synthetic).
- [ ] Idempotency: skip rows with `references_v2_migrated=true`.
- [ ] Unit test fixture under `scripts/db/__tests__/migrate-references-to-structured.test.ts`. Cover: legacy entry, structured entry pass-through, mixed array, idempotent re-run, synthetic reference fallback, `airboss_ref` stamping when applicable.
- [ ] Run `bun run db migrate references-to-structured` against local dev. Verify row counts, spot-check `knowledge_node.references` shape (every entry is a `StructuredCitation`), spot-check resolved reference rows.
- [ ] Commit (`feat(migrate): knowledge_node.references uniformly StructuredCitation; LegacyCitation entries reshaped`).

### Phase 18: Relevance cache rebuild

- [ ] Create `scripts/db/build-relevance-cache.ts`. For each `syllabus` where `status='active'`, walk every leaf `syllabus_node`, every `syllabus_node_link`, accumulate `(cert, bloom, priority)` triples per linked `knowledge_node_id`. Use the priority derivation rule from spec / design.
- [ ] Deduplicate per `(node, cert)` (highest bloom wins per pair).
- [ ] `--dry-run` flag: writes a manifest of per-node diffs (added / removed / promoted / demoted vs the existing `knowledge_node.relevance` JSONB) to `docs/work/build-reports/relevance-rebuild-<timestamp>.md`. No DB writes.
- [ ] Without `--dry-run`: writes the cache to `knowledge_node.relevance`.
- [ ] Wire `bun run db build:relevance` into the build pipeline (or as an explicit step after seed).
- [ ] Unit test fixture under `scripts/db/__tests__/build-relevance-cache.test.ts`. Cover: single-cert single-bloom case, multi-cert promotion, multi-bloom deduplication, dry-run emits manifest.
- [ ] Run `bun run db build:relevance --dry-run` against the post-Area-V state. Review the report manifest for expected diffs.
- [ ] User signs off on the manifest.
- [ ] Run `bun run db build:relevance` (no dry-run). Cache writes.
- [ ] Commit (`feat(build): relevance cache rebuild from syllabi`).

### Phase 19: Drop authored relevance from YAML

- [ ] Create `scripts/migrate/drop-authored-relevance.ts`. Walks every `course/knowledge/<slug>/node.md`. Removes the `relevance:` key from frontmatter.
- [ ] Output a report listing every file modified and the relevance entries removed.
- [ ] Run the script. Inspect `git status` and `git diff` for the YAML changes.
- [ ] User signs off on the diff.
- [ ] Commit YAML changes per file (or in one bulk commit if every node was touched; bulk is acceptable here because the script touched every file in one pass).
- [ ] Drop the `relevance` field from the knowledge node Zod schema (`libs/types/src/knowledge.ts` or equivalent). Build script no longer reads it.
- [ ] Run `bun run check`, expect 0 errors. Run `bun run db build` to confirm the build pipeline still works without the YAML field.
- [ ] Commit (`refactor(content): drop authored relevance; cache is the source of truth`).

### Phase 20: study_plan.cert_goals -> goal migration

- [ ] Create `scripts/db/migrate-study-plan-to-goals.ts`. For each `study_plan` row where `goal_migrated_at IS NULL`:
  - Create a `goal` row: `title='Active Plan Goal'` (or pull from plan title), `status='active'`, `is_primary=true`.
  - For each cert in `cert_goals`, look up the credential by slug, find its primary syllabus via `credential_syllabus`, insert a `goal_syllabus(goal_id, syllabus_id, weight=1.0)` row.
  - Set `goal_migrated_at = now()` on the study_plan row.
- [ ] Idempotency: skip plans where `goal_migrated_at IS NOT NULL`.
- [ ] Unit test fixture: cover single-cert, multi-cert, cert with no credential row (orphan, log warning, skip), cert with no primary syllabus yet (skip; warn).
- [ ] Implement `getDerivedCertGoals(userId)` (Phase 12) so the engine continues reading `cert_goals` correctly.
- [ ] Run `bun run db migrate study-plan-to-goals` against local dev. Verify a goal exists per migrated plan, verify `getDerivedCertGoals` returns the same cert slugs the plan had.
- [ ] Commit (`feat(migrate): study_plan.cert_goals -> goal + goal_syllabus`).

### Phase 21: Engine sanity check (no engine changes)

- [ ] Verify the existing session engine still works post-migration. Run `bun test` against the engine test suite. Run `/session/start` manually with a migrated plan and confirm the preview shape is unchanged.
- [ ] If any engine test fails because it expected `cert_goals` to be authored vs derived, debug. The derivation should match the authored value 1:1 right after migration; divergence indicates a bug in the migration logic.
- [ ] No engine code changes in this WP. Commit only test fixes if needed.

### Phase 22: Build pipeline integration

- [ ] Wire every new `bun run db ...` step into `scripts/db/seed-all.ts` so a fresh dev database can be rebuilt with one command:
  - existing: users -> knowledge -> handbooks -> references (handbook seed; this WP appends ACS / PTS / endorsement rows in the same phase)
  - new: credentials -> syllabi -> goals (no-op; user-authored)
  - migrate references-to-structured (after all references seeded so legacy `source` strings can resolve)
  - relevance cache rebuild as a final post-seed phase.
- [ ] Add `bun run db build:all` if a one-step "seed + build all derived caches" is useful. Otherwise rely on existing `bun run db seed`.
- [ ] Update `scripts/db/seed-guard.ts` if any new step needs production protection.
- [ ] Run `bun run db reset && bun run db seed` against a fresh dev DB. Confirm every phase succeeds. Commit (`feat(build): seed-all pipeline wires references seeding, credentials, syllabi, structured-citation migration`).

### Phase 23: BC barrel exports and docs

- [ ] Confirm `libs/bc/study/src/index.ts` re-exports every public function from `credentials.ts`, `syllabi.ts`, `goals.ts`, `lenses.ts`, plus `getCitationsForKnowledgeNode` / `getCitationsForSyllabusNode`.
- [ ] Confirm `libs/sources/src/index.ts` re-exports the `acs` resolver registration.
- [ ] Confirm error classes are exported.
- [ ] Update any module-level JSDoc comments at the top of each new BC file with the function-level overview matching the style of `handbooks.ts`.
- [ ] Run `bun run check`, expect 0 errors. Commit (`docs(bc): JSDoc + barrel exports for credential / syllabus / goal / lens modules`).

### Phase 24: Acceptance review

- [ ] Self-review the diff against [test-plan.md](./test-plan.md), close every scenario.
- [ ] Run `bun run check` end-to-end, expect 0 errors.
- [ ] Run `bun test`, all pass.
- [ ] Request implementation review via `/ball-review-full`.
- [ ] Address review findings (every level: critical, major, minor, nit, ALL of them).
- [ ] Re-verify post-fix: `bun run check`, relevant tests, grep for the symptom.
- [ ] Final manual test pass per [test-plan.md](./test-plan.md).

## Post-implementation

- [ ] Update `docs/work/NOW.md`, move the WP from active to shipped.
- [ ] Update `docs/products/study/ROADMAP.md` and `TASKS.md` to reflect the WP landing.
- [ ] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` migration table: phases 1-6 status -> shipped (record the PR URL in the table).
- [ ] Update `docs/decisions/019-reference-identifier-system/decision.md` to note the `acs` corpus resolver shipped via this WP.
- [ ] Schedule the follow-on WPs:
  - `cert-dashboard` (ADR 016 phase 7), pages over `getCredentialMastery`.
  - `goal-composer-ui` (ADR 016 phase 9), pages over the goals BC.
  - `engine-goal-cutover`, session engine reads `goal_syllabus` directly; drops `cert_goals` derivation.
  - `lens-evidence-gating`, engine reads `triad` + `assessment_methods` to surface only matching evidence kinds per leaf.
  - `acs-edition-diff-surface`, when the FAA publishes a new ACS edition, surface a diff view.
  - Iterative content sweeps (ADR 016 phase 10), IR ACS, CPL ACS, CFI PTS, CFII PTS, MEI, MEII, endorsements; IFH + IPH ingestion (the last two are handbook follow-ons consumed here via citation references).
  - ADR 019 Phase 2 (`reference-source-registry-core`), real registry that the `acs` resolver swaps into transparently.
- [ ] Run `bun run check`, `bun test` once more before merge. All green.
- [ ] PR opened, linked from `NOW.md`. Title: `feat(cert-syllabus): ADR 016 phases 1-6 -- credentials, syllabi, goals, acs corpus resolver`. Description summarizes scope, lists the 7 open product decisions resolved, and references PR #229 (original spec) / PR #242 (WP #1) / PR #241 (validator) / ADR 016 / ADR 019 / ADR 020.
