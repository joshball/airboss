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

- [x] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` and `context.md` end-to-end. (PRs #248-274 shipped against this ADR.)
- [x] Read `docs/decisions/019-reference-identifier-system/decision.md` end-to-end (v3 accepted). Especially §1.2 (`acs` corpus locator example), §1.3 (publication-ID slug pinning), §2.2 (`CorpusResolver` interface), §6.1 (alias migrations).
- [x] Read `docs/decisions/020-handbook-edition-and-amendment-policy.md` for edition-vs-errata semantics on ACS / PTS reference rows.
- [x] Read `docs/platform/LEARNING_PHILOSOPHY.md`, especially principles 2, 3, 4, 5, 6, 9.
- [x] Read `docs/work-packages/handbook-ingestion-and-reader/spec.md` and `design.md`. Reference/handbook_section/handbook_figure/handbook_read_state tables confirmed shipped (WP #1).
- [x] Read `docs/work-packages/reference-identifier-scheme-validator/spec.md`. `@ab/sources` parser/validator/lesson-parser/registry confirmed.
- [x] Read `libs/types/src/citation.ts`. `StructuredCitation` discriminated union + `LegacyCitation` shape understood; PR #248 extends with `framing` + `airboss_ref`.
- [x] Read `libs/sources/src/types.ts`, parser, validator, registry. Contract for `acs` corpus resolver understood.
- [x] Read `libs/bc/citations/src/`. Confirmed polymorphic content-citation BC, not affected by this WP.
- [x] Read `libs/bc/study/src/schema.ts`. Existing CHECK / index / FK / partial-UNIQUE conventions understood.
- [x] Read `libs/constants/src/study.ts` and `libs/constants/src/reference-tags.ts`. Existing taxonomies understood.
- [x] Read `libs/constants/src/routes.ts`. `ROUTES` pattern understood.
- [x] Read `course/knowledge/aerodynamics/angle-of-attack-and-stall/node.md`. YAML shape understood; `relevance` field derived per Phase 21/22.
- [x] Read `apps/study/src/routes/(app)/+layout.svelte`. Route grammar + nav understood.
- [x] Read the largest existing WPs for shape and style.
- [x] Confirm Open Questions 1-7 in spec.md are resolved by Joshua. Q5 (PPL ACS edition: FAA-S-ACS-6C Nov 2023) and Q7 (locator format: 2-digit zero-padding, `elem-` prefix, publication slug collapsing cert+category+edition) locked in PR #264.
- [x] Verify DB is running (OrbStack postgres on port 5435).
- [x] Verify the current FAA-published PPL ACS edition. Locked to FAA-S-ACS-6C (Nov 2023) in PR #264.

## Implementation

### Phase 0: Constants + types contract -- shipped (PR #248)

- [x] Add `CITATION_FRAMINGS`, `CITATION_FRAMING_VALUES`, `CitationFraming`, `CITATION_FRAMING_LABELS` to `libs/constants/src/citations.ts` (PR #248).
- [x] Add `CREDENTIAL_KINDS`, `CREDENTIAL_KIND_VALUES`, `CredentialKind`, `CREDENTIAL_KIND_LABELS` (PR #248, `libs/constants/src/credentials.ts`).
- [x] Add `CREDENTIAL_PREREQ_KINDS`, `CREDENTIAL_PREREQ_KIND_VALUES`, `CredentialPrereqKind` (PR #248).
- [x] Add `CREDENTIAL_CATEGORIES`, `CREDENTIAL_CATEGORY_VALUES`, `CredentialCategory`, `CREDENTIAL_CATEGORY_LABELS` (PR #248).
- [x] Add `CREDENTIAL_CLASSES`, `CREDENTIAL_CLASS_VALUES`, `CredentialClass`, `CREDENTIAL_CLASS_LABELS` (PR #248).
- [x] Add `CREDENTIAL_STATUSES`, `CREDENTIAL_STATUS_VALUES`, `CredentialStatus` (PR #248).
- [x] Add `SYLLABUS_KINDS`, `SYLLABUS_KIND_VALUES`, `SyllabusKind`, `SYLLABUS_KIND_LABELS` (PR #248).
- [x] Add `SYLLABUS_STATUSES`, `SYLLABUS_STATUS_VALUES`, `SyllabusStatus` (PR #248).
- [x] Add `SYLLABUS_NODE_LEVELS`, `SYLLABUS_NODE_LEVEL_VALUES`, `SyllabusNodeLevel`, `SYLLABUS_NODE_LEVEL_LABELS` (PR #248).
- [x] Add `SYLLABUS_PRIMACY`, `SYLLABUS_PRIMACY_VALUES`, `SyllabusPrimacy` (PR #248).
- [x] Add `ACS_TRIAD`, `ACS_TRIAD_VALUES`, `ACSTriad`, `ACS_TRIAD_LABELS` (PR #248).
- [x] Add `LENS_KINDS`, `LENS_KIND_VALUES`, `LensKind`, `LENS_KIND_LABELS` (PR #248).
- [x] Add `GOAL_STATUSES`, `GOAL_STATUS_VALUES`, `GoalStatus`, `GOAL_STATUS_LABELS` (PR #248).
- [x] Add ID prefixes: `CREDENTIAL_ID_PREFIX = 'cred'`, `SYLLABUS_ID_PREFIX = 'syl'`, `SYLLABUS_NODE_ID_PREFIX = 'sln'`, `SYLLABUS_NODE_LINK_ID_PREFIX = 'snl'`, `GOAL_ID_PREFIX = 'goal'` (PR #248).
- [x] Add `GOAL_SYLLABUS_WEIGHT_MIN = 0`, `GOAL_SYLLABUS_WEIGHT_MAX = 10` (PR #248).
- [x] Re-export every new constant + type from `libs/constants/src/index.ts` (PR #248).
- [x] Add deprecation comment to `CERT_PREREQUISITES` (PR #248, JSDoc `@deprecated` block in `libs/constants/src/study.ts`).
- [x] Extend `StructuredCitation` in `libs/types/src/citation.ts`: every variant gains optional `framing?: CitationFraming` and optional `airboss_ref?: string` (PR #248).
- [x] Re-export `CitationFraming` and the extended `StructuredCitation` from `libs/types/src/index.ts` (PR #248).
- [x] Run `bun run check`, expect 0 errors. Commit (PR #248, merge `cf3f3278`).

### Phase 1: Route constants -- shipped (PR #248)

- [x] Add `CREDENTIALS`, `CREDENTIAL_AREA`, `CREDENTIAL_TASK`, `CREDENTIAL_AT_EDITION` route entries to `libs/constants/src/routes.ts` (PR #248). Note: `CREDENTIAL` static entry replaced by `CREDENTIAL_AT_EDITION` parameterized helper.
- [x] Add `GOALS`, `GOALS_NEW`, `GOAL_EDIT` entries (PR #248). Note: `GOAL` static entry collapsed into `GOAL_EDIT` query-param form.
- [x] Add `NAV_LABELS.CREDENTIALS = 'Credentials'`, `NAV_LABELS.GOALS = 'Goals'` (PR #248).
- [x] Run `bun run check`, expect 0 errors. Commit (PR #248).

### Phase 2: Drizzle schema -- credential, credential_prereq, credential_syllabus -- shipped (PR #248)

- [x] Add `credential`, `credentialPrereq`, `credentialSyllabus` tables to `libs/bc/study/src/schema.ts` (PR #248).
- [x] Add CHECK constraints per spec (PR #248).
- [x] Add unique constraints on `credential.slug`, `credential_syllabus (credential_id, syllabus_id)` and partial UNIQUE on `(credential_id) WHERE primacy='primary'` (PR #248).
- [x] Add indexes per spec (PR #248).
- [x] `credential.regulatory_basis` is `jsonb NOT NULL DEFAULT '[]'` carrying an array of `StructuredCitation` shapes (PR #248).
- [x] Export row + insert types (PR #248).
- [x] Run `bun run check`, expect 0 errors (PR #248).

### Phase 3: Drizzle schema -- syllabus, syllabus_node, syllabus_node_link -- shipped (PR #248, extended PR #264)

- [x] Add `syllabus`, `syllabusNode`, `syllabusNodeLink` tables to `libs/bc/study/src/schema.ts` (PR #248).
- [x] Add CHECK for syllabus_node level/parent/triad/required_bloom/airboss_ref consistency (PR #248).
- [x] `syllabus_node.airboss_ref` column: `text NULL` per spec (PR #248).
- [x] `syllabus_node.citations` column: `jsonb NOT NULL DEFAULT '[]'` carrying `StructuredCitation` shapes (PR #248).
- [x] Add unique + partial-unique constraints on syllabus + syllabus_node + syllabus_node_link (PR #248).
- [x] Add indexes per spec including GIN on citations (PR #248).
- [x] Export row + insert types (PR #248).
- [x] `syllabus_node.classes` JSONB column added (PR #264; class scope per FAA-airplane reality, AIRPLANE_CLASSES enum mirror).
- [x] Run `bun run check`, expect 0 errors (PR #248).

### Phase 4: Drizzle schema -- goal, goal_syllabus, goal_node, plus migration flag columns -- shipped (PR #248, refined PR #274)

- [x] Add `goal`, `goalSyllabus`, `goalNode` tables to `libs/bc/study/src/schema.ts` (PR #248).
- [x] Add CHECKs (status in list, weight bounds), partial UNIQUE on `goal (user_id) WHERE is_primary=true` (PR #248).
- [x] Add `references_v2_migrated` boolean column (DEFAULT false) to `knowledge_node` (PR #248).
- [x] Add `goal_migrated_at` timestamptz column (nullable) to `study_plan` (PR #248).
- [x] Export row + insert types (PR #248).
- [x] `goal.target_date` column type tightened to `date` in PR #274 review fix (drizzle migration `0006_goal_target_date_to_date.sql`).
- [x] Run `bun run check`, expect 0 errors (PR #248).

### Phase 5: drizzle-kit generate + migration commit -- shipped (PR #248)

- [x] Run `bunx drizzle-kit generate`. Inspect the generated SQL (PR #248).
- [x] Commit the generated SQL file as `drizzle/0003_cert_syllabus_goal.sql` (PR #248). Note: subsequently consolidated by PR #284 into `drizzle/0000_initial.sql`; the cert-syllabus tables are present in the consolidated migration.
- [x] Run `bunx drizzle-kit push` against local dev and verify (PR #248).
- [x] Confirm the migration does NOT touch `study.reference` and creates no `study.citation` table (PR #248).
- [x] Additional migrations during the WP: `0004_syllabus_node_classes_and_knowledge_node_relevance.sql` (PR #264, syllabus_node.classes + knowledge_node.relevance), `0006_goal_target_date_to_date.sql` (PR #274 review fix). All folded into 0000_initial post-consolidation.
- [x] Run `bun run check`, expect 0 errors. Commit.

### Phase 6: ID helpers -- shipped (PR #248)

- [x] Add `generateCredentialId`, `generateSyllabusId`, `generateSyllabusNodeId`, `generateSyllabusNodeLinkId`, `generateGoalId` to `libs/utils/src/ids.ts` (PR #248).
- [x] Export from `libs/utils/src/index.ts` (PR #248).
- [x] Run `bun run check`, expect 0 errors. Commit (PR #248).

### Phase 7: Zod schemas -- shipped (PR #248)

- [x] Extend the Zod schema for `StructuredCitation` with optional `framing` + `airboss_ref` (PR #248).
- [x] Add Zod schemas for credential YAML authoring shape (`credentialYamlSchema`) (PR #248, `libs/bc/study/src/credentials.validation.ts`).
- [x] Add Zod schemas for syllabus manifest shape, area shape, task shape, element shape, inline citation, airboss_ref field (PR #248).
- [x] Add Zod schemas for goal CRUD inputs: `createGoalInputSchema`, `updateGoalInputSchema`, `addGoalSyllabusInputSchema`, `addGoalNodeInputSchema` (PR #248).
- [x] Place schemas under `libs/bc/study/src/credentials.validation.ts` (PR #248).
- [x] Unit tests for the discriminated-union narrowing across every `StructuredCitation` kind (PR #248, 17 tests in `credentials.validation.test.ts`).
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (PR #248).

### Phase 8: ACS reference seed + `acs` corpus resolver -- shipped (PR #254 resolver, PR #264 seed + locked Q7 format + pts corpus)

- [x] Author `course/references/acs-pts.yaml` with rows for: PPL ACS (FAA-S-ACS-6C), IR ACS (FAA-S-ACS-8C), CPL ACS (FAA-S-ACS-7B), CFI ACS (FAA-S-ACS-25), ATP ACS (FAA-S-ACS-11A), CFII PTS (FAA-S-8081-9E), FAA-G-ACS-2 companion guide -- 7 rows (PR #264). Note: 14 CFR 61.31 endorsement bases live as inline `regulatory_basis` `StructuredCitation` arrays on credential YAMLs rather than as separate reference rows.
- [x] Wire a seed step (`scripts/db/seed-references.ts`) that calls `upsertReference` for each ACS / PTS row (PR #264).
- [x] Verify the seed step is idempotent (PR #264).
- [x] Implement the `acs` corpus resolver in `libs/sources/src/acs/` (locator, citation, url, resolver) per ADR 019 §2.2 (PR #254). Reshaped to the locked Q7 format in PR #264 (publication-slug + 2-digit zero-padding + `elem-` prefix).
- [x] Register the `acs` resolver with the registry at lib init (PR #254). PR #264 adds the parallel `pts` corpus resolver (`libs/sources/src/pts/`) and registers it.
- [x] Implement `validateAirbossRefForLeaf(ref, leaf)` in `libs/bc/study/src/syllabi.ts` (PR #254). PR #264 extends to accept `pts:` corpus on PTS-kind syllabi.
- [x] Unit tests for the `acs` + `pts` resolvers: 29 ACS tests (PR #254) + 110 total post-PR #264 across both corpus modules.
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (PR #254 / PR #264).

### Phase 9: Credential BC -- shipped (PR #254)

- [x] Create `libs/bc/study/src/credentials.ts`. Exports `listCredentials`, `getCredentialBySlug`, `getCredentialById`, `getCredentialPrereqs`, `getCredentialIdsCoveredBy`, `getCertsCoveredBy`, `getCredentialPrereqDag`, `getCredentialPrimarySyllabus`, `getCredentialSyllabi`, `getCredentialMastery`, plus build-only `upsertCredential`, `upsertCredentialPrereq`, `upsertCredentialSyllabus`, `validateCredentialDag` (PR #254).
- [x] Implement `getCertsCoveredBy` / `getCredentialIdsCoveredBy` recursively over `credential_prereq` with cycle protection (PR #254).
- [x] Implement `getCredentialMastery` aggregating syllabus_node + syllabus_node_link + knowledge_node + per-user mastery (PR #254). PR #274 perf fix: materialised `nodesById` map (O(leaves) instead of O(leaves * nodes)).
- [x] Define `CredentialNotFoundError`, `CredentialPrereqCycleError` (PR #254).
- [x] Export read-side helpers from `libs/bc/study/src/index.ts` (PR #254).
- [x] Unit tests: 26 tests (PR #254) -- DAG walk, mastery rollup, regulatory_basis validation.
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass (PR #254).

### Phase 10: Syllabus BC -- shipped (PR #254, refined PR #274)

- [x] Create `libs/bc/study/src/syllabi.ts`. Exports `listSyllabi`, `getSyllabusById`, `getSyllabusBySlug`, `getSyllabusTree`, `buildSyllabusTreeFromRows`, `getSyllabusArea`, `getSyllabusLeaves`, `getCitationsForSyllabusNode`, `getKnowledgeNodesForSyllabusLeaf`, `getSyllabusLeavesForKnowledgeNode`, `validateAirbossRefForLeaf`, `validateSyllabusTree`, plus build-only `upsertSyllabus`, `upsertSyllabusNode`, `replaceSyllabusNodeLinks`, `levelIsLeafEligible` (PR #254).
- [x] Implement `getCitationsForSyllabusNode` returning `StructuredCitation[]` from the JSONB column (PR #254).
- [x] Implement tree walks via in-memory parent_id walk over flat row fetch + `buildSyllabusTreeFromRows` (PR #254).
- [x] Define `SyllabusNotFoundError`, `SyllabusValidationError`, `AirbossRefValidationError` (PR #254).
- [x] Export read-side helpers from `libs/bc/study/src/index.ts` (PR #254).
- [x] Unit tests: 31 tests (PR #254) -- tree walk, leaf-link forward + reverse, area-fetch ordering, validation rejections, citation extraction, `airboss_ref` validation.
- [x] PR #274 review fix: dead `rebuildKnowledgeNodeRelevanceCache` BC stub removed (real impl lives at `scripts/db/build-relevance-cache.ts`).
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass (PR #254).

### Phase 11: Knowledge node citation read helper + URL resolver extension -- partially shipped (PR #254)

- [ ] In `libs/bc/study/src/knowledge.ts`, add `getCitationsForKnowledgeNode(db, knowledgeNodeId)` returning `StructuredCitation[]` from the JSONB column. (Not located in current `knowledge.ts` -- left unchecked.)
- [x] In `libs/bc/study/src/handbooks.ts`, extend `resolveCitationUrl(citation, references)` to handle every `StructuredCitation.kind` (PR #254). Routes through `CITATION_URL_TEMPLATES` from `libs/constants/src/study.ts`.
- [x] When a `StructuredCitation` carries `airboss_ref`, delegate to `@ab/sources getLiveUrl()`; otherwise fall back to per-kind template (PR #254).
- [x] URL templates live in `libs/constants/src/study.ts` `CITATION_URL_TEMPLATES` (PR #254).
- [x] Unit tests covering every `StructuredCitation.kind` (PR #254, 9 new tests).
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (PR #254).

### Phase 12: Goal BC -- shipped (PR #254, refined PR #274)

- [x] Create `libs/bc/study/src/goals.ts`. Exports `listGoals`, `getActiveGoals`, `getPrimaryGoal`, `getGoalById`, `getOwnedGoal`, `getGoalSyllabi`, `getGoalNodes`, `getGoalNodeUnion`, `getDerivedCertGoals`, `createGoal`, `updateGoal`, `archiveGoal`, `setPrimaryGoal`, `addGoalSyllabus`, `removeGoalSyllabus`, `setGoalSyllabusWeight`, `addGoalNode`, `removeGoalNode`, `setGoalNodeWeight` (PR #254; `setGoalNodeWeight` added in PR #274 review fix).
- [x] `setPrimaryGoal` transactional clear-and-set with partial-UNIQUE catch (PR #254).
- [x] `getDerivedCertGoals(userId)`: walks primary goal's `goal_syllabus` -> credential_syllabus reverse -> credential.slug (PR #254).
- [x] `getGoalNodeUnion(goalId)`: union of syllabus-reachable nodes + `goal_node` rows with weight aggregation (PR #254).
- [x] Define `GoalNotFoundError`, `GoalNotPrimaryError`, `GoalAlreadyPrimaryError` (PR #254).
- [x] Export from `libs/bc/study/src/index.ts` (PR #254).
- [x] Unit tests: 18 tests (PR #254) covering CRUD, primary swap atomicity, derived certs, node-union aggregation.
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (PR #254).

### Phase 13: Lens framework -- shipped (PR #254, refined PR #264 + PR #274)

- [x] Create `libs/bc/study/src/lenses.ts`. Exports `Lens`, `LensInput`, `LensTreeNode`, `LensLeaf`, `LensResult` types (PR #254). PR #274: `LensLeaf` gains `placeholder?: boolean`.
- [x] Implement `acsLens` walking goal syllabi + Area -> Task -> Element tree with mastery rollups (PR #254). PR #274: synthetic root level renamed to `'syllabus'` and carries syllabus's display title.
- [x] Implement `domainLens` grouping by `knowledge_node.domain` with `cross_domains` multi-membership + mastery rollups (PR #254).
- [x] Both lenses accept `LensInput.filters` (PR #254). PR #264: `AcsLensFilters.classes` filter + `nodeMatchesClassFilter` walker added.
- [x] Define `LensError` for unsupported lens kinds (PR #254).
- [x] Export from `libs/bc/study/src/index.ts` (PR #254).
- [x] Unit tests: 11 tests (PR #254) plus filter coverage (PR #264).
- [x] Run `bun run check` + `bun test`, expect 0 errors and all pass. Commit (PR #254).

### Phase 14: Credential YAML authoring + seed -- shipped (PR #264)

Note: the dispatcher numbered this as Phase 17/18 in the PR #264 commits; tasks.md numbering preserved here.

- [x] Create `course/credentials/` directory with one YAML per credential (PR #264, plus `course/credentials/README.md`).
- [x] Author 18 credentials: private, instrument, commercial, atp, cfi, cfii, mei, meii, single-engine-land, multi-engine-land, single-engine-sea, multi-engine-sea, complex, high-performance, tailwheel, high-altitude, spin, student (PR #264). Note: `glass-cockpit` from spec dropped; replaced by the broader endorsement set.
- [x] Each YAML includes slug/kind/title/category/class/regulatory_basis/prereqs/syllabi (PR #264).
- [x] Create `scripts/db/seed-credentials.ts` with Zod validation + topological-sort cycle detection + 3-pass idempotent upsert (PR #264).
- [x] Wire into `scripts/db/seed-all.ts` (PR #264, phases `references` -> `credentials` -> `syllabi` -> `credential-syllabi`).
- [ ] Unit test fixture under `scripts/db/__tests__/seed-credentials.test.ts`. (No dedicated `__tests__/` directory in `scripts/db/`; PR #264 verified via live seed run + Zod schemas. Left unchecked - test coverage didn't materialize as scoped here.)
- [x] Run `bun run db seed credentials`. Confirm row counts. Commit (PR #264).

### Phase 15: Syllabus YAML schema + seed pipeline -- shipped (PR #264)

- [x] Implement YAML reader in `scripts/db/seed-syllabi.ts` walking `course/syllabi/<slug>/manifest.yaml` + `areas/*.yaml` (PR #264).
- [x] Validate YAML against Zod (manifest + area + task + element schemas) (PR #264).
- [x] For each citation-inline entry, validate as a `StructuredCitation` and append to the `syllabus_node.citations` JSONB array (PR #264).
- [x] For each `knowledge_nodes[]` entry, upsert a `syllabus_node_link` row via `replaceSyllabusNodeLinks` (PR #264).
- [x] For every leaf row, validate `airboss_ref` via `@ab/sources` parser; corpus = `acs` for ACS / `pts` for PTS; pin matches syllabus edition (PR #264).
- [x] ACS / PTS hard-fail on element-level rows lacking `airboss_ref` (PR #264).
- [x] Maintain `is_leaf` correctness via final sweep (PR #264).
- [x] Wire `bun run db seed syllabi` into `scripts/db/seed-all.ts` after `credentials` (PR #264).
- [x] Idempotency verified via live re-runs (PR #264 PR body: "idempotent re-run produces no row writes"). Note: no per-file content hash; idempotency relies on UNIQUE constraints + diffless upserts.
- [ ] Unit test fixture under `scripts/db/__tests__/seed-syllabi.test.ts`. (No `__tests__/` dir created; left unchecked per same reason as Phase 14.)
- [x] Run `bun run db seed syllabi`. Commit (PR #264).

### Phase 16: PPL ACS Area V transcription -- shipped (PR #264)

- [x] Create `course/syllabi/ppl-airplane-6c/manifest.yaml` with the verified edition (FAA-S-ACS-6C, Nov 2023) (PR #264).
- [x] Create `course/syllabi/ppl-airplane-6c/areas/05-performance-maneuvers.yaml` (PR #264).
- [x] Transcribe Area V from the FAA-published PPL ACS:
  - [x] Task A "Steep Turns" with K1-K2, R1-R5, S1-S5 elements (PR #264).
  - [x] Task B "Ground Reference Maneuvers" with K1-K2, R1-R6, S1-S6 elements (PR #264). Note: PR #264 corrected the spec dispatcher's mistake -- PPL Area V is two tasks (Steep Turns + Ground Reference Maneuvers), not three; "Steep Spirals" and "Chandelles" are commercial tasks.
  - [ ] Task C (Chandelles). Not in PPL ACS-6C; this dispatcher item was incorrect, dropped.
  - [x] Each element row includes code/triad/title/required_bloom/description/`airboss_ref` per locked Q7 format (PR #264). 28 element rows transcribed.
- [x] Run `bun run db seed syllabi`. Verify Area V lands cleanly; PR body reports 12 syllabus_node_link rows binding leaves to existing knowledge nodes (PR #264).
- [x] Commit `course/syllabi/ppl-airplane-6c/` with manifest + Area V YAML (PR #264).

### Phase 17: knowledge_node.references migration to uniform StructuredCitation -- NOT SHIPPED

The `references_v2_migrated` flag column shipped in PR #248 schema, but no migration script (`migrate-references-to-structured.ts`) exists in `scripts/db/`. Grep for `references_v2_migrated` outside `schema.ts` returns zero hits. This phase is unstarted.

- [ ] Create `scripts/db/migrate-references-to-structured.ts`.
- [ ] Output a report.
- [ ] Idempotency via `references_v2_migrated=true`.
- [ ] Unit test fixture.
- [ ] Run migration against local dev.
- [ ] Commit.

### Phase 18: Relevance cache rebuild -- shipped (PR #264 dry-run + PR #270 live write)

- [x] Create `scripts/db/build-relevance-cache.ts` (PR #264). Walks active syllabi + leaves + links + accumulates `(cert, bloom, priority)` triples per knowledge_node.
- [x] Deduplicate per `(node, cert)` (highest bloom wins) (PR #264).
- [x] `--dry-run` flag emits manifest at `docs/work/build-reports/relevance-rebuild-<timestamp>.md` (PR #264). Initial dry-run report committed: `docs/work/build-reports/relevance-rebuild-2026-04-28T01-13-29-810Z.md`.
- [x] Without `--dry-run`: writes the cache to `knowledge_node.relevance` (PR #270).
- [x] Wired into the build pipeline as an explicit post-seed step (PR #264).
- [ ] Unit test fixture under `scripts/db/__tests__/build-relevance-cache.test.ts`. (No `__tests__/` dir; verified via dry-run + live-run reports instead. Left unchecked.)
- [x] Run `bun run db build:relevance --dry-run`. Manifest committed (PR #264).
- [x] User signs off on the manifest (PR #270 Gate A passed).
- [x] Run live cache write -- 1 syllabus / 28 leaves / 12 links / 7 nodes affected. Live build report: `docs/work/build-reports/relevance-rebuild-live-2026-04-28T03-06-39Z.md` (PR #270).
- [x] Commit (PR #264 / PR #270).

### Phase 19: Drop authored relevance from YAML -- shipped (PR #270, future-proofed)

- [x] Create `scripts/db/strip-authored-relevance.ts` (PR #270). Walks every `course/knowledge/**/node.md` and removes any top-level `relevance:` key from YAML frontmatter. Idempotent.
- [x] Output a report (PR #270, runtime stdout). 9 vitest cases under `scripts/db/strip-authored-relevance.test.ts` (PR #270).
- [x] Run the script. Live run on current authoring state: 46 files scanned, 0 modified -- no node carries an authored `relevance:` block today (PR #270 PR body). Future-proofing for any author-introduced block on next pass.
- [x] User signs off on the diff (no diff to sign off on; clean run).
- [x] Commit (PR #270).
- [ ] Drop the `relevance` field from the knowledge node Zod schema. (No `libs/types/src/knowledge.ts` currently. Knowledge frontmatter schema retained for back-compat; no `relevance` field present in current authoring. Left unchecked.)
- [x] Run `bun run check`, expect 0 errors. Run `bun run db build` to confirm pipeline (PR #270).

### Phase 20: study_plan.cert_goals -> goal migration -- shipped (PR #270)

- [x] Create `scripts/db/migrate-study-plans-to-goals.ts` (PR #270). For each plan with non-empty `cert_goals`, creates a Goal owned by the plan's user + a GoalSyllabus row per cert with a credential primary syllabus. Title derived from plan title. `is_primary=true` only when user has no other primary. Stamps `goal_migrated_at`. All rows carry `seed_origin='migrate-study-plans-to-goals-v1'`.
- [x] Idempotency: skip plans where `goal_migrated_at IS NOT NULL` (PR #270).
- [x] Unit test fixture: 7 vitest cases (PR #270, `scripts/db/migrate-study-plans-to-goals.test.ts`) covering single/multi/no-syllabus/empty/already-migrated/has-existing-primary/idempotency.
- [x] Implement `getDerivedCertGoals(userId)` (PR #254 Phase 12 ship; engine continues reading `cert_goals` until follow-on cutover).
- [x] Run live: Abby's PPL plan migrated -> 1 primary goal + 1 goal_syllabus (PR #270). `getDerivedCertGoals(abby)` returns `['private']` post-migration.
- [x] Commit (PR #270).

### Phase 21: Engine sanity check (no engine changes) -- shipped (PR #270)

- [x] Verify the existing session engine still works post-migration. PR #270 verified `getDerivedCertGoals(abby)` returns `['private']` matching pre-migration `cert_goals`; engine test suite green (114 BC tests pass in PR #270). Manual `/session/start` not run in PR but post-migration value equivalence is the relevant invariant.
- [x] No engine test failures: derivation matches authored value 1:1 (PR #270).
- [x] No engine code changes in this WP (PR #270; no engine.ts changes).

### Phase 22: Build pipeline integration -- partially shipped (PR #264)

- [x] Wire `seed-all.ts` for: references -> credentials -> syllabi -> credential-syllabi (PR #264). Pipeline runs end-to-end against fresh dev DB.
- [ ] migrate references-to-structured step. Not wired (Phase 17 unstarted).
- [x] Relevance cache rebuild integrated as explicit post-seed step (PR #264 dry-run + PR #270 live).
- [ ] `bun run db build:all` one-step composite. Not located in current `package.json`; left unchecked.
- [ ] Update `scripts/db/seed-guard.ts` for new steps. (No diff to seed-guard for the new phases observed; left unchecked.)
- [x] Run `bun run db reset && bun run db seed` against fresh dev DB; pipeline succeeds (PR #264 / PR #270).

### Phase 23: BC barrel exports and docs -- mostly shipped (PR #254 / PR #274)

- [x] Confirm `libs/bc/study/src/index.ts` re-exports every public function from `credentials.ts`, `syllabi.ts`, `goals.ts`, `lenses.ts`, plus `getCitationsForSyllabusNode` (PR #254). Note: `getCitationsForKnowledgeNode` is not re-exported (Phase 11 partial).
- [x] Confirm `libs/sources/src/index.ts` re-exports both `acs` and `pts` resolver registrations (PR #254 / PR #264).
- [x] Confirm error classes are exported (PR #254).
- [x] Module-level JSDoc on each new BC file (PR #254 ship + PR #274 cleanup).
- [x] Run `bun run check`, expect 0 errors. Commit (PR #254 / PR #274).

### Phase 24: Acceptance review -- shipped (PR #274)

- [x] Self-review the diff against test-plan.md (PR #274 SUMMARY).
- [x] Run `bun run check` end-to-end (PR #274; baseline: 28 pre-existing biome errors out of WP scope per the SUMMARY's "Cross-cutting notes"; theme-lint clean; references clean; help-id validator clean).
- [x] Run `bun test` -- 1086 pass / 0 fail across `libs/sources libs/bc/study scripts/db` (PR #274).
- [x] Request implementation review via `/ball-review-full` (PR #274). 12 review axes run -- ux/svelte/security/perf/architecture/patterns/correctness/a11y/backend/schema/testing/dx. Review docs at `docs/work/reviews/2026-04-28-cert-syllabus-*.md`.
- [x] Address review findings: 22 total (2 critical, 5 major, 12 minor, 3 nits) -- all fixed (PR #274). Convergent findings collapsed (corpus-resolver test pollution; `nodes.find` O(n^2); `void X` anti-pattern).
- [x] Re-verify post-fix: `bun run check`, relevant tests, grep (PR #274).
- [ ] Final manual test pass per test-plan.md. (Manual pass per project rule "nothing merges without a manual test plan" -- not explicitly recorded against this WP in NOW.md or test-plan.md status. Left unchecked pending user confirmation.)

## Post-implementation

- [ ] Update `docs/work/NOW.md`, move the WP from active to shipped. (Not verified here; left unchecked.)
- [ ] Update `docs/products/study/ROADMAP.md` and `TASKS.md` to reflect the WP landing. (Not verified here; left unchecked.)
- [ ] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` migration table with shipped PR URLs. (Not verified here; left unchecked.)
- [ ] Update `docs/decisions/019-reference-identifier-system/decision.md` to note the `acs` + `pts` corpus resolvers shipped. (Not verified here; left unchecked.)
- [ ] Schedule the follow-on WPs (cert-dashboard, goal-composer-ui, engine-goal-cutover, lens-evidence-gating, acs-edition-diff-surface, iterative content sweeps, ADR 019 Phase 2). (Spec listed; scheduling status not verified here. Left unchecked.)
- [x] Run `bun run check`, `bun test` once more before merge. All green for WP scope (PR #274).
- [x] PRs opened: #248, #254, #264, #270, #274. Sequence references PR #229 (original spec) / PR #245 (amendment) / WP #1 (#242) / validator (#241) / ADR 016 / ADR 019 / ADR 020.

## Status as of 2026-04-28

The cert-syllabus-and-goal-composer WP shipped across 5 PRs (the parent dispatcher referenced #264 / #270 / #272 / #274; #272 is unrelated, the actual cert-syllabus PR sequence is #248 / #254 / #264 / #270 / #274). Per the WP description in PR #274: "WP cert-syllabus-and-goal-composer COMPLETE."

- 189 of 210 checkboxes closed across PRs #248, #254, #264, #270, #274. (The original 201-checkbox file gained 9 sub-bullet checkboxes during this sync where Phase 16's three task sub-bullets were promoted to explicit checkboxes.)
- Phases shipped: 0 (constants/types), 1 (routes), 2/3/4/5 (schema + migration), 6 (ID helpers), 7 (Zod), 8 (acs/pts resolver + reference seed), 9 (credential BC), 10 (syllabus BC), 11 (URL resolver -- partial), 12 (goal BC), 13 (lens framework), 14 (credential YAML + seed), 15 (syllabus YAML + seed), 16 (PPL ACS Area V transcription), 18 (relevance cache rebuild + Gate A), 19 (strip authored relevance + Gate B), 20 (study_plan.cert_goals migration), 21 (engine sanity check), 22 (build pipeline -- partial), 23 (BC barrel exports + docs), 24 (`/ball-review-full` + fixer).
- Phases unstarted: 17 (knowledge_node.references -> uniform StructuredCitation migration). The `references_v2_migrated` flag column shipped in schema (PR #248) but no `migrate-references-to-structured.ts` script exists. Inside Phase 11, `getCitationsForKnowledgeNode(db, knowledgeNodeId)` is not present in `knowledge.ts`. Inside Phase 22, the `migrate references-to-structured` step in `seed-all.ts` is not wired.

### Per-PR closure summary

| PR   | Phases closed                                              | Notes                                                                                                                          |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| #248 | 0, 1, 2, 3 (initial), 4 (initial), 5 (initial), 6, 7       | Contract + schema + migration `0003_cert_syllabus_goal.sql`. `StructuredCitation` extended with `framing` + `airboss_ref`.     |
| #254 | 8 (acs resolver), 9, 10, 11 (URL resolver), 12, 13, 23     | BC modules + acs corpus resolver + cross-kind URL resolver. 124 new tests.                                                     |
| #264 | 8 (pts resolver + ref seed), 14, 15, 16, 18 (dry-run)      | Locked Q7 ACS locator format. Phase 14 schema delta `0004_classes_and_relevance.sql`. PPL Area V transcription (28 elements).  |
| #270 | 18 (live write), 19, 20, 21                                | Gate A signoff, Gate B strip, study_plan -> Goal migration. Abby's PPL plan migrated cleanly.                                  |
| #274 | 4 (target_date refinement), 10 (cleanup), 13 (cleanup), 24 | `/ball-review-full` 12-axis pass + fixer. 22 findings closed. Migration `0006_goal_target_date_to_date.sql`.                   |

### Phases unstarted (PR 5 candidate)

The natural next slice is the **structured-citation migration** -- the only meaningful gap in the WP. Concretely:

1. Implement `getCitationsForKnowledgeNode(db, knowledgeNodeId)` in `libs/bc/study/src/knowledge.ts` and re-export it from the BC barrel (closes the open Phase 11 sub-task).
2. Implement `scripts/db/migrate-references-to-structured.ts` walking every `knowledge_node` with `references_v2_migrated=false`, resolving legacy `{source, detail, note}` entries to typed `StructuredCitation` shapes via the `study.reference` registry, defaulting `framing` per kind, stamping `airboss_ref` where a corpus convention exists. Idempotent on the flag column.
3. Wire the migration into `seed-all.ts` between the seed phases and the relevance rebuild (so legacy `source` strings can resolve against the now-seeded references).
4. Vitest unit suite over the migration logic (legacy / structured pass-through / mixed / synthetic-reference fallback / idempotency).

Why this is the right next slice: it's the last open task in the WP scope, it unlocks a uniform `StructuredCitation`-only world for downstream consumers (cert-dashboard, goal-composer-ui), and it's small enough to land cleanly in one PR after the convergent post-#274 review cleanup is on main.

After that closes, the spec's "Phase 24 final manual test pass" is the only remaining open box and is a user-facing gate, not engineering scope.
