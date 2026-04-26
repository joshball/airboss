---
title: 'Tasks: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: tasks
status: unread
review_status: pending
---

# Tasks: Cert, Syllabus, and Goal Composer

Phased plan for [spec.md](./spec.md). Order is dependency-driven: contract + schema first, build pipeline next, BC + migration on top, transcription, ship.

Depends on: handbook-ingestion-and-reader (shipped; provides `reference`, `handbook_section`, `handbook_figure`, `handbook_read_state` tables and the discriminated-union Citation shape). Depends on: knowledge-graph (shipped; provides `knowledge_node` + `knowledge_edge`). Depends on: study-plan-and-session-engine (shipped; this WP migrates `study_plan.cert_goals` data without changing the engine).

## Pre-flight

- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` and `context.md` end-to-end.
- [ ] Read `docs/platform/LEARNING_PHILOSOPHY.md`, especially principles 2, 3, 4, 5, 6, 9.
- [ ] Read `docs/work-packages/handbook-ingestion-and-reader/spec.md` and `design.md`. Confirm the `reference` and `handbook_section` tables shipped match the spec.
- [ ] Read `libs/bc/study/src/schema.ts` -- understand existing CHECK / index / FK conventions, the JSONB `references` column shape, the partial-UNIQUE pattern on `study_plan`.
- [ ] Read `libs/constants/src/study.ts` and `libs/constants/src/reference-tags.ts` -- understand existing taxonomies (`CERTS`, `CERT_PREREQUISITES`, `BLOOM_LEVELS`, `STUDY_PRIORITIES`, `CERT_APPLICABILITIES`, `REFERENCE_KINDS`).
- [ ] Read `libs/constants/src/routes.ts` -- understand the `ROUTES` pattern.
- [ ] Read `course/knowledge/aerodynamics/angle-of-attack-and-stall/node.md` -- understand the existing YAML shape; note the `relevance` field that becomes derived.
- [ ] Read `apps/study/src/routes/(app)/+layout.svelte` -- understand the route grammar and nav.
- [ ] Read the largest existing WPs (`docs/work-packages/handbook-ingestion-and-reader/`, `docs/work-packages/knowledge-graph/`, `docs/work-packages/study-plan-and-session-engine/`) for shape/style.
- [ ] Confirm Open Questions 1-6 in spec.md are resolved by Joshua. Apply any required changes (active-goal model, YAML layout, citation storage shape, study_plan handoff strategy, current PPL ACS edition, pilot transcription Area).
- [ ] Verify DB is running (OrbStack postgres on port 5435).
- [ ] Verify the current FAA-published PPL ACS edition. Lock seed metadata to that edition before any transcription begins.

## Implementation

### Phase 0: Constants + types contract

- [ ] Add `CITATION_LOCATOR_KINDS`, `CITATION_LOCATOR_KIND_VALUES`, `CitationLocatorKind` to `libs/constants/src/study.ts` (or `libs/constants/src/citations.ts` if `study.ts` is heavy and re-export from `index.ts`).
- [ ] Add `CITATION_FRAMINGS`, `CITATION_FRAMING_VALUES`, `CitationFraming`, `CITATION_FRAMING_LABELS`.
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
- [ ] Add ID prefixes: `CITATION_ID_PREFIX = 'cit'`, `CREDENTIAL_ID_PREFIX = 'cred'`, `SYLLABUS_ID_PREFIX = 'syl'`, `SYLLABUS_NODE_ID_PREFIX = 'sln'`, `SYLLABUS_NODE_LINK_ID_PREFIX = 'snl'`, `GOAL_ID_PREFIX = 'goal'`.
- [ ] Add `GOAL_SYLLABUS_WEIGHT_MIN = 0`, `GOAL_SYLLABUS_WEIGHT_MAX = 10`.
- [ ] Re-export every new constant + type from `libs/constants/src/index.ts`.
- [ ] Add deprecation comment to `CERT_PREREQUISITES`: `// @deprecated -- use getCertsCoveredBy(db, credentialId) from @ab/bc-study; retained as a fast-path for the four-cert dashboard subset until the engine cutover.`
- [ ] Add `CitationLocatorData` discriminated-union type in `libs/types/src/citation.ts`. Re-export from `libs/types/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(constants): citation, credential, syllabus, goal contract`).

### Phase 1: Route constants

- [ ] Add `CREDENTIALS`, `CREDENTIAL`, `CREDENTIAL_AREA`, `CREDENTIAL_TASK`, `CREDENTIAL_AT_EDITION` route entries to `libs/constants/src/routes.ts`.
- [ ] Add `GOALS`, `GOALS_NEW`, `GOAL`, `GOAL_EDIT` entries.
- [ ] Add `NAV_LABELS.CREDENTIALS = 'Credentials'`, `NAV_LABELS.GOALS = 'Goals'`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(routes): credentials + goals route constants`).

### Phase 2: Drizzle schema -- citation, credential, credential_prereq, credential_syllabus

- [ ] Add `citation`, `credential`, `credentialPrereq`, `credentialSyllabus` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECK constraints per spec (locator_kind in list, framing in list, kind in list, category in list, class in list-or-null, status in list, prereq kind in list, primacy in list).
- [ ] Add unique constraints on `credential.slug`, `credential_syllabus (credential_id, syllabus_id)` and partial UNIQUE on `(credential_id) WHERE primacy='primary'`.
- [ ] Add indexes per spec: `citation (reference_id)`, `citation (locator_kind)`, `credential (kind)`, `credential (category, class)`, `credential (status)`, `credential_prereq (prereq_id)`.
- [ ] Export row + insert types: `CitationRow`, `NewCitationRow`, `CredentialRow`, `NewCredentialRow`, `CredentialPrereqRow`, `NewCredentialPrereqRow`, `CredentialSyllabusRow`, `NewCredentialSyllabusRow`.
- [ ] Run `bun run check` -- 0 errors.

### Phase 3: Drizzle schema -- syllabus, syllabus_node, syllabus_node_link

- [ ] Add `syllabus`, `syllabusNode`, `syllabusNodeLink` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECK for syllabus_node level / parent_id consistency, triad / level consistency, required_bloom / is_leaf consistency (single CHECK using `sql.raw()`).
- [ ] Add unique constraints on `syllabus.slug`, `syllabus (kind, edition)` partial unique for `kind IN ('acs','pts')`, `syllabus_node (syllabus_id, code)`, `syllabus_node_link (syllabus_node_id, knowledge_node_id)`.
- [ ] Add indexes per spec: `syllabus_node (syllabus_id, parent_id, ordinal)`, `syllabus_node (syllabus_id, level, ordinal)`, `syllabus_node (syllabus_id, is_leaf)`, `syllabus_node_link (knowledge_node_id, syllabus_node_id)`, `syllabus_node_link (syllabus_node_id)`.
- [ ] Export row + insert types: `SyllabusRow`, `NewSyllabusRow`, `SyllabusNodeRow`, `NewSyllabusNodeRow`, `SyllabusNodeLinkRow`, `NewSyllabusNodeLinkRow`.
- [ ] Run `bun run check` -- 0 errors.

### Phase 4: Drizzle schema -- goal, goal_syllabus, goal_node, plus migration flag columns

- [ ] Add `goal`, `goalSyllabus`, `goalNode` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECKs (status in list, weight bounds), partial UNIQUE on `goal (user_id) WHERE is_primary=true`.
- [ ] Add `references_v2_migrated` boolean column (DEFAULT false) to `knowledge_node`.
- [ ] Add `goal_migrated_at` timestamptz column (nullable) to `study_plan`.
- [ ] Export row + insert types: `GoalRow`, `NewGoalRow`, `GoalSyllabusRow`, `NewGoalSyllabusRow`, `GoalNodeRow`, `NewGoalNodeRow`.
- [ ] Run `bun run check` -- 0 errors.

### Phase 5: drizzle-kit generate + migration commit

- [ ] Run `bunx drizzle-kit generate`. Inspect the generated SQL; confirm CHECKs, partial UNIQUEs, and FKs match the schema.
- [ ] Commit the generated SQL file (sequence number after WP #1's; e.g., `drizzle/0011_cert_syllabus_goal.sql`).
- [ ] Run `bunx drizzle-kit push` against local dev. Verify with `\d study.citation`, `\d study.credential`, `\d study.credential_prereq`, `\d study.credential_syllabus`, `\d study.syllabus`, `\d study.syllabus_node`, `\d study.syllabus_node_link`, `\d study.goal`, `\d study.goal_syllabus`, `\d study.goal_node`. Verify partial UNIQUEs via `\di+`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(schema): citation + credential + syllabus + goal tables`).

### Phase 6: ID helpers

- [ ] Add `generateCitationId`, `generateCredentialId`, `generateSyllabusId`, `generateSyllabusNodeId`, `generateSyllabusNodeLinkId`, `generateGoalId` to `libs/utils/src/ids.ts`. Use the same `prefix_ULID` pattern as the existing helpers.
- [ ] Export from `libs/utils/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 7: Zod schemas

- [ ] Add Zod schemas for `CitationLocatorData` (per-kind narrowed schemas), `Citation` (full row shape).
- [ ] Add Zod schemas for credential YAML authoring shape and the credential_prereq + credential_syllabus inline forms.
- [ ] Add Zod schemas for syllabus manifest shape, area shape, task shape, element shape (with triad-required-when-element rule), citation-inline shape.
- [ ] Add Zod schemas for goal CRUD inputs: `createGoalInputSchema`, `updateGoalInputSchema`, `addGoalSyllabusInputSchema`, `addGoalNodeInputSchema`.
- [ ] Place schemas under `libs/types/src/` or `libs/bc/study/src/validation.ts` matching project convention.
- [ ] Unit tests for the discriminated-union narrowing across every locator kind.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass. Commit (`feat(types): citation + credential + syllabus + goal Zod schemas`).

### Phase 8: Citation BC

- [ ] Create `libs/bc/study/src/citations.ts`. Export `listCitations`, `getCitation`, `getCitationsForKnowledgeNode`, `getCitationsForSyllabusNode`, `upsertCitation` (build-only).
- [ ] Implement narrow-by-kind serialization for `locator_data` based on `locator_kind`.
- [ ] Define `CitationNotFoundError`.
- [ ] Export read-side helpers from `libs/bc/study/src/index.ts`. Keep `upsertCitation` build-only (not in barrel).
- [ ] Unit tests in `citations.test.ts`: insert + read each locator kind, narrow correctly; resolveCitationUrl extension covered in Phase 11.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass.

### Phase 9: Credential BC

- [ ] Create `libs/bc/study/src/credentials.ts`. Export `listCredentials`, `getCredentialBySlug`, `getCertsCoveredBy`, `getCredentialPrereqDag`, `getCredentialPrimarySyllabus`, `getCredentialMastery`, plus build-only `upsertCredential`, `upsertCredentialPrereq`, `upsertCredentialSyllabus`.
- [ ] Implement `getCertsCoveredBy` recursively over `credential_prereq` (BFS / DFS; cycle-protected via visited set as defence-in-depth even though the seed validates DAG-ness).
- [ ] Implement `getCredentialMastery` as a single aggregate query over `syllabus_node`, `syllabus_node_link`, `knowledge_node`, and per-user mastery from `libs/bc/study/src/knowledge.ts`.
- [ ] Define `CredentialNotFoundError`, `CredentialPrereqCycleError`.
- [ ] Export read-side helpers from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: DAG walk over a fixture, mastery rollup over a fixture syllabus + linked nodes + per-user evidence.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass.

### Phase 10: Syllabus BC

- [ ] Create `libs/bc/study/src/syllabi.ts`. Export `listSyllabi`, `getSyllabusBySlug`, `getSyllabusTree`, `getSyllabusArea`, `getSyllabusLeavesForNode`, `getNodesForSyllabusLeaf`, plus build-only `upsertSyllabus`, `upsertSyllabusNode`, `replaceSyllabusNodeLinks`, `rebuildKnowledgeNodeRelevanceCache`.
- [ ] Implement tree walks via `WITH RECURSIVE` or in-memory parent_id walk -- pick whichever maps cleanest to Drizzle's query DSL; document the choice.
- [ ] Define `SyllabusNotFoundError`, `SyllabusValidationError`.
- [ ] Export read-side helpers from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: tree walk, leaf-link forward + reverse, area-fetch with tasks + elements ordering, validation rejections.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass.

### Phase 11: Citation URL resolver extension

- [ ] In `libs/bc/study/src/handbooks.ts`, extend `resolveCitationUrl` to handle every `CitationLocatorKind`.
- [ ] handbook -> existing handbook URL resolver.
- [ ] cfr -> `https://www.ecfr.gov/cgi-bin/text-idx?...` (with `title`, `part`, `section` interpolated). Constant URL template lives in `libs/constants/src/study.ts` so e.g. eCFR URL changes are a one-file fix.
- [ ] ac -> FAA AC index URL with `paragraph` anchor when present.
- [ ] acs / pts -> FAA test-standards page URL keyed off the syllabus's edition.
- [ ] aim -> FAA AIM index by `paragraph`.
- [ ] pcg -> FAA PCG by term.
- [ ] ntsb / poh / page / other -> `null` (UI renders the freeform note).
- [ ] Unit tests covering every kind, success and `null` paths.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass. Commit (`feat(bc): citation + credential + syllabus + URL resolver`).

### Phase 12: Goal BC

- [ ] Create `libs/bc/study/src/goals.ts`. Export every function in spec's "Functions" table for `goals.ts`.
- [ ] `setPrimaryGoal` is transactional: clear `is_primary=true` on every other goal for the user, then set on target. Catch the partial-UNIQUE constraint violation and translate to `GoalAlreadyPrimaryError`.
- [ ] `getDerivedCertGoals(userId)`: walks the user's primary goal's `goal_syllabus` rows -> credential_syllabus reverse-lookup -> credential.slug. Returns `string[]`.
- [ ] `getGoalNodeUnion(goalId)`: returns the union of (every node reachable via `goal_syllabus -> syllabus_node -> syllabus_node_link`) plus (`goal_node`). Aggregates weights when a node is reachable through multiple paths.
- [ ] Define `GoalNotFoundError`, `GoalNotPrimaryError`, `GoalAlreadyPrimaryError`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: CRUD, set-primary transactional behavior, multi-active goals, derived cert goals, node-union aggregation, partial UNIQUE enforcement.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass. Commit (`feat(bc): goal CRUD + primary + node-union`).

### Phase 13: Lens framework

- [ ] Create `libs/bc/study/src/lenses.ts`. Export the `Lens`, `LensInput`, `LensTreeNode`, `LensLeaf`, `LensResult` types.
- [ ] Implement `acsLens`: takes a goal, walks the goal's syllabi, for each builds the Area -> Task -> Element tree from `getSyllabusTree`, attaches mastery rollups per leaf and per internal node.
- [ ] Implement `domainLens`: takes a goal, gets the goal-node-union, groups by `knowledge_node.domain` (with cross_domains as multi-membership), attaches mastery rollups.
- [ ] Both lenses accept an optional `LensInput.filters` (areaCodes / taskCodes / domains / etc.).
- [ ] Define `LensError` if needed for unsupported lens kinds.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Unit tests: ACS lens shape over a fixture goal + syllabus, domain lens shape, filters honored, rollup math correct.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass. Commit (`feat(bc): lens framework + ACS lens + Domain lens`).

### Phase 14: Credential YAML authoring + seed

- [ ] Create `course/credentials/` directory with one YAML per credential.
- [ ] Author every credential the user is pursuing (per spec): private, commercial, atp, instrument, single-engine-land, multi-engine-land, single-engine-sea, multi-engine-sea, cfi, cfii, mei, meii, complex, high-performance, tailwheel, high-altitude, spin, glass cockpit. Plus the `student` credential as a prereq target.
- [ ] Each YAML includes: slug, kind, title, category, class, regulatory_basis (CFR citations), prereqs, syllabi (initially empty for credentials whose syllabi aren't authored yet -- `cfi`, `cfii`, etc.).
- [ ] Create `scripts/db/seed-credentials.ts`. Reads `course/credentials/*.yaml`, validates against Zod, runs topological sort to detect cycles, upserts `credential`, `credential_prereq`, `credential_syllabus` rows.
- [ ] Wire `bun run db seed credentials` into `scripts/db/seed-all.ts` after `references` and before `syllabi`.
- [ ] Unit test fixture under `scripts/db/__tests__/seed-credentials.test.ts`. Cover: fresh insert, idempotent re-run, cycle detection, dangling syllabus reference handling.
- [ ] Run `bun run db seed credentials`. Confirm row counts. Commit (`feat(seed): credentials YAML pipeline + seed wiring`).

### Phase 15: Syllabus YAML schema + seed pipeline

- [ ] Implement the YAML reader in `scripts/db/seed-syllabi.ts`. Walk `course/syllabi/<slug>/manifest.yaml` + `course/syllabi/<slug>/areas/*.yaml`.
- [ ] Validate YAML against Zod (manifest schema + area schema + task / element / section recursion).
- [ ] For each citation-inline entry in the YAML, upsert a `citation` row (deduplicated by content hash). Capture the returned `citation_id` for inclusion in the `syllabus_node.citations` array.
- [ ] For each `knowledge_nodes[]` entry, upsert a `syllabus_node_link` row with the leaf's id and the node id. Reject if the node id doesn't exist.
- [ ] Maintain `is_leaf` correctness via a final sweep after upserts.
- [ ] Wire `bun run db seed syllabi` into `scripts/db/seed-all.ts` after `credentials`.
- [ ] Idempotency: per-syllabus content hash on the manifest file plus per-node content hash on every YAML node entry. Re-running with no changes makes no DB writes.
- [ ] Unit test fixture under `scripts/db/__tests__/seed-syllabi.test.ts`. Cover: fresh insert, idempotent re-run, level-hierarchy violation, dangling knowledge_node_link, citation-shape mismatch, code-uniqueness violation.
- [ ] Run `bun run db seed syllabi` (against an empty `course/syllabi/`; expect 0 rows). Commit (`feat(seed): syllabus YAML pipeline + seed wiring`).

### Phase 16: PPL ACS Area V transcription

- [ ] Create `course/syllabi/ppl-acs-<edition>/manifest.yaml` with the verified current edition (Open Question 5).
- [ ] Create `course/syllabi/ppl-acs-<edition>/areas/V-performance-maneuvers.yaml`.
- [ ] Transcribe Area V from the FAA-published PPL ACS:
  - Task A "Steep Turns" with K1, R1, R2 (or whatever the current ACS lists), S1.
  - Task B "Steep Spirals" with its K / R / S elements.
  - Task C ("Chandelles" or whatever Area V's third task is in the current edition) with its K / R / S elements.
  - Each element row includes: code, triad, title, required_bloom, description (verbatim ACS element text), citations (PHAK / AFH chapters where applicable), knowledge_nodes (link to existing graph nodes by slug, with weight).
- [ ] Run `bun run db seed syllabi`. Verify the Area V tree lands cleanly. Spot-check via `psql` queries that codes are right, triads are present on element rows, citations resolve.
- [ ] Commit `course/syllabi/ppl-acs-<edition>/` -- manifest + Area V YAML. Use `git add` per file. Commit (`feat(content): PPL ACS Area V transcribed; existing nodes wired in via syllabus_node_link`).

### Phase 17: knowledge_node.references migration

- [ ] Create `scripts/db/migrate-references-to-citations.ts`. For each `knowledge_node` where `references_v2_migrated=false`:
  - For each entry in `references` JSONB:
    - If shape is `{ source, detail, note }` (legacy): create a `citation` row with `locator_kind='other'`, `locator_data={ kind: 'other', text: '<source> <detail>' }`, `framing='survey'` (default), `note=<note>`. Reference resolution: try to map `<source>` to an existing reference row by `document_slug` heuristics (e.g., "PHAK" -> `document_slug=phak`); fall back to a synthetic `kind='other'` reference row when no match.
    - If shape is `{ kind: 'handbook', reference_id, locator: ... }` (WP #1 structured): create a `citation` row with `locator_kind='chapter_section'`, copy locator over, `framing='operational'` (default), `note=<note>`.
    - Map every other WP #1 structured kind similarly.
  - Replace the `references` JSONB with a `string[]` of new citation_ids.
  - Set `references_v2_migrated=true`.
- [ ] Output a report: per-node counts of legacy entries migrated, structured entries migrated, references created (existing vs synthetic).
- [ ] Idempotency: skip rows with `references_v2_migrated=true`.
- [ ] Unit test fixture under `scripts/db/__tests__/migrate-references-to-citations.test.ts`. Cover: legacy entry, structured handbook entry, mixed array, idempotent re-run, synthetic reference fallback.
- [ ] Run `bun run db migrate references-to-citations` against local dev. Verify row counts, spot-check `knowledge_node.references` shape, spot-check citation rows.
- [ ] Commit (`feat(migrate): knowledge_node.references reshaped to citation_id[]`).

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
- [ ] Commit YAML changes per file (or in one bulk commit if every node was touched -- pick the cleaner story; bulk is acceptable here because the script touched every file in one pass).
- [ ] Drop the `relevance` field from the knowledge node Zod schema (`libs/types/src/knowledge.ts` or equivalent). Build script no longer reads it.
- [ ] Run `bun run check` -- 0 errors. Run `bun run db build` to confirm the build pipeline still works without the YAML field.
- [ ] Commit (`refactor(content): drop authored relevance; cache is the source of truth`).

### Phase 20: study_plan.cert_goals -> goal migration

- [ ] Create `scripts/db/migrate-study-plan-to-goals.ts`. For each `study_plan` row where `goal_migrated_at IS NULL`:
  - Create a `goal` row: `title='Active Plan Goal'` (or pull from plan title), `status='active'`, `is_primary=true`.
  - For each cert in `cert_goals`, look up the credential by slug, find its primary syllabus via `credential_syllabus`, insert a `goal_syllabus(goal_id, syllabus_id, weight=1.0)` row.
  - Set `goal_migrated_at = now()` on the study_plan row.
- [ ] Idempotency: skip plans where `goal_migrated_at IS NOT NULL`.
- [ ] Unit test fixture: cover single-cert, multi-cert, cert with no credential row (orphan -- log warning, skip), cert with no primary syllabus yet (skip; warn).
- [ ] Implement `getDerivedCertGoals(userId)` (Phase 12) so the engine continues reading `cert_goals` correctly.
- [ ] Run `bun run db migrate study-plan-to-goals` against local dev. Verify a goal exists per migrated plan, verify `getDerivedCertGoals` returns the same cert slugs the plan had.
- [ ] Commit (`feat(migrate): study_plan.cert_goals -> goal + goal_syllabus`).

### Phase 21: Engine sanity check (no engine changes)

- [ ] Verify the existing session engine still works post-migration. Run `bun test` against the engine test suite. Run `/session/start` manually with a migrated plan and confirm the preview shape is unchanged.
- [ ] If any engine test fails because it expected `cert_goals` to be authored vs derived, debug. The derivation should match the authored value 1:1 right after migration; divergence indicates a bug in the migration logic.
- [ ] No engine code changes in this WP. Commit only test fixes if needed.

### Phase 22: Build pipeline integration

- [ ] Wire every new `bun run db ...` step into `scripts/db/seed-all.ts` so a fresh dev database can be rebuilt with one command:
  - existing: users -> knowledge -> handbooks -> references (handbook seed)
  - new: citations (no-op for empty catalog; populated by syllabus seed) -> credentials -> syllabi -> goals (no-op; user-authored)
  - relevance cache rebuild as a final post-seed phase.
- [ ] Add `bun run db build:all` if a one-step "seed + build all derived caches" is useful. Otherwise rely on existing `bun run db seed`.
- [ ] Update `scripts/db/seed-guard.ts` if any new step needs production protection.
- [ ] Run `bun run db reset && bun run db seed` against a fresh dev DB. Confirm every phase succeeds. Commit (`feat(build): seed-all pipeline wires citations, credentials, syllabi`).

### Phase 23: BC barrel exports and docs

- [ ] Confirm `libs/bc/study/src/index.ts` re-exports every public function from `citations.ts`, `credentials.ts`, `syllabi.ts`, `goals.ts`, `lenses.ts`.
- [ ] Confirm error classes are exported.
- [ ] Update any module-level JSDoc comments at the top of each new BC file with the function-level overview matching style of `handbooks.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit (`docs(bc): JSDoc + barrel exports for citation / credential / syllabus / goal / lens modules`).

### Phase 24: Acceptance review

- [ ] Self-review the diff against [test-plan.md](./test-plan.md) -- close every scenario.
- [ ] Run `bun run check` end-to-end -- 0 errors.
- [ ] Run `bun test` -- all pass.
- [ ] Request implementation review via `/ball-review-full`.
- [ ] Address review findings (every level: critical, major, minor, nit -- ALL of them).
- [ ] Re-verify post-fix: `bun run check`, relevant tests, grep for the symptom.
- [ ] Final manual test pass per [test-plan.md](./test-plan.md).

## Post-implementation

- [ ] Update `docs/work/NOW.md` -- move the WP from active to shipped.
- [ ] Update `docs/products/study/ROADMAP.md` and `TASKS.md` to reflect the WP landing.
- [ ] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` migration table: phases 1-6 status -> shipped (record the PR URL in the table).
- [ ] Schedule the follow-on WPs:
  - `cert-dashboard` (ADR 016 phase 7) -- pages over `getCredentialMastery`.
  - `goal-composer-ui` (ADR 016 phase 9) -- pages over the goals BC.
  - `engine-goal-cutover` -- session engine reads `goal_syllabus` directly; drops `cert_goals` derivation.
  - `lens-evidence-gating` -- engine reads `triad` + `assessment_methods` to surface only matching evidence kinds per leaf.
  - `acs-edition-diff-surface` -- when the FAA publishes a new ACS edition, surface a diff view.
  - Iterative content sweeps (ADR 016 phase 10) -- IR ACS, CPL ACS, CFI PTS, CFII PTS, MEI, MEII, endorsements; IFH + IPH ingestion (the last two are handbook follow-ons consumed here via citation references).
- [ ] Run `bun run check`, `bun test` once more before merge. All green.
- [ ] PR opened, linked from `NOW.md`. Title: `feat(cert-syllabus): ADR 016 phases 1-6 -- citations, credentials, syllabi, goals`. Description summarizes scope, lists the 6 open product decisions resolved, and references PR #223 / ADR 016.
