---
title: 'Test Plan: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: test-plan
status: unread
review_status: pending
amended:
  - 2026-04-27 -- amended to compose with merged WP #1 (PR #242) and accepted ADR 019 v3
---

# Test Plan: Cert, Syllabus, and Goal Composer

Manual acceptance tests for [spec.md](./spec.md). Prefix `CSG-`.

## Amendment scope (2026-04-27)

This test plan was authored before WP #1 (PR #242) and the validator WP (PR #241) merged. Scenarios that asserted on a `study.citation` row, a citation_id-based `references` column, or a `study.reference` table created by this WP are inapplicable; they are marked DELETED in place (numbering preserved). New scenarios cover the post-amendment shape: every `knowledge_node.references` entry is a `StructuredCitation`; syllabus leaves carry `airboss_ref` validated via `@ab/sources`; the `study.reference` table is seeded (not created); the `acs` corpus resolver answers `getLiveUrl` for ACS leaves.

## Setup

- Study app running at `localhost:9600`.
- Logged in as `abby@airboss.test` (the canonical dev test learner).
- PostgreSQL running on port 5435 with the `study` schema migrated through `0011_cert_syllabus_goal.sql`. Note: this migration does NOT create `study.reference` or `study.citation`; those are owned by WP #1's migration `0001_handbook_ingestion.sql` (and the citation table doesn't exist).
- WP #1 (handbook ingestion) shipped: PHAK 8083-25C, AFH, AvWX seed data present.
- PR #241 (`@ab/sources` validator) shipped: parser, validator, lesson-parser, registry stub available.
- ACS / PTS / endorsement reference rows have been appended to `study.reference` via this WP's seed augment.
- `course/credentials/` populated with the seed YAML for every credential listed in spec section "In Scope".
- `course/syllabi/ppl-acs-<edition>/` present with manifest + Area V YAML; every leaf carries an `airboss-ref:acs/...` identifier.
- `bun run db seed credentials` has been run; row counts in DB match `course/credentials/` file count.
- `bun run db seed syllabi` has been run; PPL ACS Area V is populated.
- `bun run db migrate references-to-structured` has run; every existing knowledge node's `references` column contains only `StructuredCitation` entries; `references_v2_migrated=true`.
- `bun run db build:relevance` has run; `knowledge_node.relevance` reflects the syllabi.
- `bun run db migrate study-plan-to-goals` has run; abby's existing study_plan now has a paired primary goal.
- `bun run check` passes on the branch.

---

## Schema

### CSG-1: DELETED -- `study.citation` row shape no longer applies

This scenario tested a `study.citation` table that this WP no longer creates. Citations live inline as `StructuredCitation` JSONB array entries on each consumer per WP #1; see CSG-1A and CSG-10 for the post-amendment shape.

### CSG-1A: `StructuredCitation` JSONB shape on `knowledge_node.references`

1. Inspect via `psql`: `SELECT id, jsonb_array_length(references) AS n, references->0 AS first FROM study.knowledge_node WHERE jsonb_array_length(references) > 0 LIMIT 5;`.
2. **Expected:** every entry in `references` is a JSONB object whose `kind` field is one of `REFERENCE_KIND_VALUES` (`handbook | cfr | ac | acs | pts | aim | pcg | ntsb | poh | other`). The locator shape inside matches the `kind`. `framing` (if present) is one of `CITATION_FRAMING_VALUES`. `airboss_ref` (if present) starts with `airboss-ref:`.

### CSG-1B: `study.reference` table created by WP #1, not this WP

1. `SELECT version() ; \d study.reference` and inspect the migration history: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;`.
2. **Expected:** the `reference` table was created by WP #1's `0001_handbook_ingestion.sql`. This WP's `0011_cert_syllabus_goal.sql` does NOT create or alter the `reference` table.
3. **Expected:** `SELECT count(*) FROM study.reference WHERE kind IN ('acs','pts');` returns at least one row (this WP appended ACS / PTS rows via the seed augment).

### CSG-2: `study.credential` and `study.credential_prereq` row shape

1. Run `SELECT id, kind, slug, title, category, class FROM study.credential ORDER BY kind, slug;`.
2. **Expected:** `id` has `cred_` prefix. Pilot certs (`private`, `commercial`, `atp`), instructor certs (`cfi`, `cfii`, `mei`, `meii`), ratings (`instrument`, `single-engine-land`, `multi-engine-land`, `single-engine-sea`, `multi-engine-sea`), and endorsements (`complex`, `high-performance`, `tailwheel`, `high-altitude`, `spin`, `glass-cockpit`) all present.
3. **Expected:** every row's `regulatory_basis` JSONB column is an array of `StructuredCitation` shapes (typically `kind: 'cfr'`).
4. Run `SELECT credential_id, prereq_id, kind FROM study.credential_prereq;`.
5. **Expected:** instrument requires private; cfii requires cfi AND instrument; mei requires cfi AND multi-engine-land; meii requires mei AND instrument (or whatever decomposition the user signed off in design.md). No cycles.

### CSG-3: `study.syllabus` and `study.syllabus_node` for PPL ACS Area V

1. Run `SELECT id, slug, kind, edition, status FROM study.syllabus WHERE slug LIKE 'ppl-acs-%';`.
2. **Expected:** one row, `kind='acs'`, `status='active'`, edition matching whatever the user verified.
3. Run `SELECT id, level, code, airboss_ref, title, triad, required_bloom, is_leaf FROM study.syllabus_node WHERE syllabus_id = '<syl_id>' ORDER BY code;`.
4. **Expected:** Area V row at `level='area', code='V', airboss_ref='airboss-ref:acs/ppl-asel/<edition-slug>/area-v', triad NULL, is_leaf=false`. Three task rows at `level='task', code IN ('V.A','V.B','V.C')`, each with an `airboss_ref` of form `.../area-v/task-<x>`. Element rows at `level='element', code LIKE 'V.A.%'` etc., each with a non-null `triad`, `required_bloom`, `is_leaf=true`, and `airboss_ref` of form `.../area-v/task-a/element-<triad><n>`.

### CSG-4: `study.syllabus_node_link` rows wire knowledge nodes

1. Run `SELECT syllabus_node_id, knowledge_node_id, weight FROM study.syllabus_node_link WHERE syllabus_node_id IN (SELECT id FROM study.syllabus_node WHERE syllabus_id = '<syl_id>');`.
2. **Expected:** Every link row's `knowledge_node_id` resolves to an existing `knowledge_node`. Every link row's `syllabus_node_id` resolves to a leaf row (`is_leaf=true`). `weight > 0 AND <= 1.0` for the seed; user-authored weights up to the constant max.

### CSG-5: Partial UNIQUE on `goal.is_primary`

1. Confirm: `SELECT goal_id FROM study.goal WHERE user_id = '<abby_id>' AND is_primary = true;` returns exactly one row.
2. Attempt `INSERT INTO study.goal (id, user_id, title, is_primary) VALUES ('goal_test', '<abby_id>', 'Test', true);`.
3. **Expected:** insert fails with a UNIQUE constraint violation (`goal_user_primary_uniq`).

### CSG-6: Partial UNIQUE on `credential_syllabus.primacy='primary'`

1. Pick a credential with a primary syllabus. Attempt to insert a second `credential_syllabus` row with `primacy='primary'` for the same credential.
2. **Expected:** UNIQUE constraint violation.

### CSG-7: CHECK on `syllabus_node` level / parent_id consistency

1. Attempt `INSERT INTO study.syllabus_node (id, syllabus_id, level, code, title, ordinal, is_leaf) VALUES ('sln_test', '<syl_id>', 'area', 'TEST', 't', 99, false);` (area with no parent, valid).
2. **Expected:** insert succeeds.
3. Attempt the same with `level='task'` and `parent_id NULL`.
4. **Expected:** CHECK violation (`syllabus_node_level_parent_check`).

### CSG-8: CHECK on `syllabus_node.triad` only when `level='element'`

1. Attempt `INSERT ... level='task', triad='knowledge', ...`.
2. **Expected:** CHECK violation (`syllabus_node_triad_check`).

### CSG-8A: CHECK on `syllabus_node.airboss_ref` syntactic guard

1. Attempt `INSERT ... airboss_ref='not-a-real-identifier', ...`.
2. **Expected:** CHECK violation (the syntactic `LIKE 'airboss-ref:%'` guard rejects it).
3. Attempt `INSERT ... airboss_ref='airboss-ref:invalid//locator', ...`.
4. **Expected:** the syntactic CHECK passes (starts with `airboss-ref:`); seed-time validation via `@ab/sources` parser rejects it. See CSG-19A.

### CSG-9: GIN-indexed `knowledge_node.references` and `syllabus_node.citations` reverse lookup

1. Pick a reference row (`SELECT id, document_slug FROM study.reference LIMIT 1;`). Run `SELECT id FROM study.knowledge_node WHERE references @> '[{"reference_id": "<ref_id>"}]'::jsonb;` and `SELECT id FROM study.syllabus_node WHERE citations @> '[{"reference_id": "<ref_id>"}]'::jsonb;`.
2. **Expected:** returns the rows that cite this reference. Query plan uses a GIN index on each table (`EXPLAIN` should show `Bitmap Index Scan`).

---

## Citation read helpers

### CSG-10: `getCitationsForKnowledgeNode` returns `StructuredCitation[]`

1. Pick a knowledge node with citations. Run `getCitationsForKnowledgeNode(db, '<node_id>')` via a vitest harness or REPL.
2. **Expected:** array of `StructuredCitation` (discriminated union narrowed by `kind`). Each carries `kind`, the per-kind locator shape, optional `note`, optional `framing`, optional `airboss_ref`.

### CSG-10A: `getCitationsForSyllabusNode` returns `StructuredCitation[]`

1. Pick a syllabus leaf with citations (e.g., Area V Task A K1). Run `getCitationsForSyllabusNode(db, '<sln_id>')`.
2. **Expected:** array of `StructuredCitation` matching the YAML-authored `citations:` list. Reference slugs resolved to `reference_id` values.

### CSG-11: `resolveCitationUrl` returns correct URL for each `StructuredCitation.kind`

For each `kind`, run the resolver against a citation of that kind. Expected URLs:

| Kind     | Citation                  | Expected URL fragment                                                     |
| -------- | ------------------------- | ------------------------------------------------------------------------- |
| handbook | PHAK Ch 12 §3             | `/handbooks/phak/12/3` (handbook URL via WP #1 resolver)                  |
| cfr      | 14 CFR 61.103             | eCFR URL with title 14, part 61, section 103                              |
| acs      | PPL ACS Area V Task A     | FAA test-standards URL keyed off the syllabus edition; or, when `airboss_ref` present, delegated to `@ab/sources` `getLiveUrl()` |
| pts      | CFI PTS Area II Task A    | FAA test-standards URL keyed off the PTS edition                          |
| ac       | AC 61-67C ¶3              | FAA AC index URL                                                          |
| aim      | AIM 5-1-7                 | FAA AIM URL                                                               |
| pcg      | PCG "VFR"                 | FAA PCG URL by term                                                       |
| ntsb     | freeform                  | `null`                                                                    |
| poh      | freeform                  | `null`                                                                    |
| other    | freeform                  | `null`                                                                    |

For `null` results, the UI is expected to render the citation note as freeform text.

### CSG-11A: `airboss_ref` round-trips via `@ab/sources` parser

1. Pick a syllabus leaf with `airboss_ref` set (e.g., `airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1`).
2. Call `parse('airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1')` from `@ab/sources`.
3. **Expected:** returns a `ParsedIdentifier` with `corpus='acs'`, `locator='ppl-asel/faa-s-acs-25/area-v/task-a/element-k1'`, `pin` carrying the publication-ID slug per ADR 019 §1.3.
4. Re-format via `acsResolver.formatCitation(parsed)` and confirm round-trip equality.

---

## Credential BC

### CSG-12: `getCertsCoveredBy` traverses the DAG

1. Run `getCertsCoveredBy(db, getCredentialBySlug(db, 'cfii').id)`.
2. **Expected:** returns slugs `['student', 'private', 'instrument', 'cfi', 'cfii']` (or whatever the seed's prereq DAG says CFII transitively requires).

### CSG-13: `getCredentialMastery` rolls up Area V correctly

1. As abby (no card / rep history yet for Area V leaves), run `getCredentialMastery(db, abby_id, 'private')`.
2. **Expected:** `totalLeaves` matches the count of Area V leaves seeded. `coveredLeaves >= 0` (count of leaves whose linked nodes have any evidence). `masteredLeaves = 0` (no mastery yet). `areas` array includes `{ areaCode: 'V', areaTitle: 'Performance Maneuvers', totalLeaves: <N>, masteredLeaves: 0 }`.

### CSG-14: Mastery updates as evidence lands

1. Create a card linked to one of the Area V K1 leaf's knowledge_nodes. Review it once, rate `Easy`. Repeat until it's mastered (FSRS stability > 30 days).
2. Run `getCredentialMastery(db, abby_id, 'private')`.
3. **Expected:** Area V's `masteredLeaves` is `>= 1` if the K1 leaf's only knowledge node is now mastered, else still `0`. Verify the rollup math by hand against the dual-gate rule.

### CSG-15: `CredentialPrereqCycleError` from a synthetic cycle

1. Author a malformed `course/credentials/` set: A requires B, B requires C, C requires A.
2. Run `bun run db seed credentials`.
3. **Expected:** seed aborts with `CredentialPrereqCycleError` listing the cycle path.

### CSG-15A: `regulatory_basis` validates as `StructuredCitation`

1. Author a malformed credential YAML with a `regulatory_basis` entry whose `kind` is not in `REFERENCE_KIND_VALUES`, or whose locator shape doesn't match the `kind`.
2. Run `bun run db seed credentials`.
3. **Expected:** seed aborts with a Zod validation error pointing at the offending YAML path.

---

## Syllabus BC

### CSG-16: `getSyllabusTree` returns full Area V tree

1. Run `getSyllabusTree(db, '<ppl-acs syllabus_id>')`.
2. **Expected:** every Area V row is present, ordered by code. Tasks parent into Area V. Elements parent into their respective tasks. `is_leaf` is true on element rows, false on task and area rows.

### CSG-17: `getSyllabusLeavesForNode` returns reverse lookup

1. Pick a knowledge node linked from Area V (e.g., `aero-load-factor`). Run `getSyllabusLeavesForNode(db, 'aero-load-factor')`.
2. **Expected:** array of leaves that link to it, with the syllabus row joined. Includes Area V Task A K1 (or whichever leaf was authored).

### CSG-18: `getNodesForSyllabusLeaf` returns forward lookup

1. Pick a leaf (say, Area V Task A K1). Run `getNodesForSyllabusLeaf(db, '<sln_id>')`.
2. **Expected:** array of `KnowledgeNodeRow` that this leaf links to.

### CSG-19: Validator hard-fails dangling knowledge_node_link

1. Author a syllabus YAML element that references `aero-not-a-real-node`.
2. Run `bun run db seed syllabi`.
3. **Expected:** seed aborts with `SyllabusValidationError`: "knowledge_node 'aero-not-a-real-node' does not exist; rename or remove."

### CSG-19A: Validator hard-fails on bad `airboss_ref` for an ACS leaf

1. Author an ACS element-level YAML row with `airboss_ref='airboss-ref:handbooks/phak/12/3'` (wrong corpus for an ACS leaf).
2. Run `bun run db seed syllabi`.
3. **Expected:** seed aborts with `AirbossRefValidationError` citing corpus mismatch (expected `acs`, got `handbooks`).
4. Author an ACS element-level YAML row with `airboss_ref='airboss-ref:acs/ppl-asel/faa-s-acs-99/area-v/task-a/element-k1'` (edition slug doesn't match the syllabus's edition).
5. **Expected:** seed aborts with `AirbossRefValidationError` citing edition slug mismatch.

### CSG-19B: Validator hard-fails when an ACS element-level row lacks `airboss_ref`

1. Author an ACS element-level YAML row with `airboss_ref` omitted.
2. Run `bun run db seed syllabi`.
3. **Expected:** seed aborts with `SyllabusValidationError` requiring `airboss_ref` on element-level ACS rows.

### CSG-20: Validator rejects level / hierarchy violations

1. Author a YAML element that's structured as a child of an element (sub-element via the `section` level), but mark its `level` as `task`.
2. Run `bun run db seed syllabi`.
3. **Expected:** validation error with file path + offending entry.

### CSG-21: Idempotent re-run of `bun run db seed syllabi`

1. Confirm `course/syllabi/ppl-acs-<edition>/` is current.
2. Run `bun run db seed syllabi` twice.
3. **Expected:** Second run reports "0 syllabi updated, 0 nodes updated, 0 links updated." `updated_at` timestamps unchanged on second run.

### CSG-21A: Idempotent re-run of ACS / PTS reference seed

1. Run `bun run db seed references` twice.
2. **Expected:** second run reports "0 reference rows updated." Existing handbook reference rows from WP #1 remain untouched; ACS / PTS / endorsement rows from this WP also untouched.

---

## acs corpus resolver

### CSG-21B: `acsResolver.parseLocator` over every shape

1. For each of `airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v`, `.../area-v/task-a`, `.../area-v/task-a/element-k1`, `.../area-v/task-a/element-r1`, `.../area-v/task-a/element-s1`, call `acsResolver.parseLocator(...)`.
2. **Expected:** returns a structured locator with `cert='ppl-asel'`, `editionSlug='faa-s-acs-25'`, and area / task / element fields populated per the depth of the input.
3. Round-trip via `acsResolver.formatCitation(parsed)` and assert equality.

### CSG-21C: `acsResolver.getCurrentEdition` returns the seeded ACS reference row

1. Call `acsResolver.getCurrentEdition({ cert: 'ppl-asel' })`.
2. **Expected:** returns the `study.reference` row for the current PPL ASEL ACS edition (the one seeded by this WP per Open Question 5).

### CSG-21D: `acsResolver.getIndexedContent` returns the matching `syllabus_node`

1. Call `acsResolver.getIndexedContent('airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1')`.
2. **Expected:** returns the `syllabus_node` row for Area V Task A K1.

---

## Goal BC

### CSG-22: Multiple active goals with one primary

1. Create a second active goal for abby via `createGoal`. Confirm `is_primary=false`.
2. Run `getActiveGoals(db, abby_id)`.
3. **Expected:** array of length 2.
4. Run `getPrimaryGoal(db, abby_id)`.
5. **Expected:** the original goal (the one with `is_primary=true`).

### CSG-23: `setPrimaryGoal` swaps cleanly

1. Call `setPrimaryGoal(db, secondGoalId, abby_id)`.
2. **Expected:** transactional. The original goal flips to `is_primary=false`; the new goal flips to `is_primary=true`. `getPrimaryGoal` now returns the new goal.

### CSG-24: `addGoalSyllabus` adds with weight + sequence

1. Call `addGoalSyllabus(db, goalId, abby_id, { syllabus_id: '<syl_id>', weight: 0.7, sequence_hint: 1 })`.
2. **Expected:** row inserted in `goal_syllabus` with the given weight and sequence hint. Re-call with the same syllabus_id should error with a duplicate-PK constraint (the BC translates to a meaningful error).

### CSG-25: `addGoalNode` records ad-hoc node

1. Call `addGoalNode(db, goalId, abby_id, 'aero-angle-of-attack-and-stall', 'weak area')`.
2. **Expected:** row inserted in `goal_node` with the reason. Idempotent on the composite PK.

### CSG-26: `getGoalNodeUnion` aggregates across syllabi + ad-hoc

1. With abby's primary goal having one syllabus (PPL ACS) and one ad-hoc node, run `getGoalNodeUnion(db, primaryGoalId)`.
2. **Expected:** `knowledgeNodeIds` includes every node reachable from any leaf in PPL ACS plus the ad-hoc node. `weights` map includes per-node weight aggregation.

### CSG-27: `getDerivedCertGoals` returns engine-compatible cert slugs

1. Run `getDerivedCertGoals(db, abby_id)`.
2. **Expected:** returns the same cert slugs that `study_plan.cert_goals` originally held for abby. The session engine reads this via the BC layer; behavior unchanged.

---

## Lens framework

### CSG-28: ACS lens shape over abby's primary goal

1. Run `acsLens(db, abby_id, { goal: primaryGoal, filters: undefined })`.
2. **Expected:** `LensResult` with a tree rooted at the credential's primary syllabus -> Area V -> tasks -> elements. Internal nodes carry rollups; leaves carry mastery.
3. Verify `totalLeaves`, `coveredLeaves`, `masteredLeaves` match the underlying mastery data.

### CSG-29: Domain lens shape over abby's primary goal

1. Run `domainLens(db, abby_id, { goal: primaryGoal })`.
2. **Expected:** tree rooted at "Domains" -> Aerodynamics, Safety / Accident Analysis (per Area V's nodes' domains) -> nodes. Cross-domain nodes appear under multiple parents.

### CSG-30: ACS lens with area-code filter

1. Run `acsLens(db, abby_id, { goal: primaryGoal, filters: { areaCodes: ['V'] } })`.
2. **Expected:** tree contains only Area V (other areas trimmed even if the syllabus has them). Rollups recomputed for the filtered subtree.

### CSG-31: Anonymous browse (goal=null)

1. Run `acsLens(db, abby_id, { goal: null, filters: { areaCodes: ['V'] } })`.
2. **Expected:** full Area V tree. Mastery rollup is per-abby (the user_id is still passed). No goal-level filtering.

---

## References migration

### CSG-32: Legacy `LegacyCitation` entries reshape to `StructuredCitation`

1. Pick a knowledge node with legacy references (every existing pre-PR-#242 node had them).
2. After running `bun run db migrate references-to-structured`, verify:
   - `references` JSONB column is a uniform array of `StructuredCitation` shapes.
   - Each entry has `kind` matching the resolved reference (`handbook` for handbooks, `cfr` for 14 CFR, etc.).
   - Each entry's locator shape matches the `kind` per `libs/types/src/citation.ts`.
   - `framing` is set per the default-per-kind rule (handbook -> survey, cfr -> regulatory, etc.).
   - `airboss_ref` is set when the resolved kind has an established corpus convention.
3. Verify `references_v2_migrated=true` on the row.

### CSG-32A: WP #1 structured handbook citations pass through untouched

1. Pick a knowledge node whose references were seeded by WP #1 as `StructuredCitation` already (post-PR-#242).
2. Compare the JSONB before and after running `migrate references-to-structured`.
3. **Expected:** byte-equal except for the `references_v2_migrated` flag being flipped to true.

### CSG-33: Idempotent re-run of references-to-structured migration

1. Run `bun run db migrate references-to-structured` against an already-migrated DB.
2. **Expected:** zero rows updated. No JSONB rewrites.

### CSG-34: Resolver renders migrated citations in the node detail UI

1. Open a knowledge node detail page (e.g., `/knowledge/aero-angle-of-attack-and-stall`).
2. **Expected:** the references panel shows each citation. PHAK / AFH citations are clickable links to the corresponding handbook section. Citations of kind `other` render as freeform text matching the legacy `source + detail` line. Citations with `airboss_ref` resolve via `@ab/sources` `getLiveUrl()` when the corpus resolver provides one.

---

## Relevance cache rebuild

### CSG-35: `--dry-run` produces a manifest with diffs

1. Run `bun run db build:relevance --dry-run`.
2. **Expected:** report file at `docs/work/build-reports/relevance-rebuild-<timestamp>.md`. Lists per-node diffs vs the existing `knowledge_node.relevance` JSONB. Highlights additions (`+ added: ppl@apply`), removals, promotions, demotions.
3. **Expected:** no DB writes (verify via `SELECT updated_at FROM study.knowledge_node;`, timestamps unchanged).

### CSG-36: Without `--dry-run` writes the cache

1. Run `bun run db build:relevance`.
2. **Expected:** every `knowledge_node.relevance` updated to match the cache shape derived from active syllabi.

### CSG-37: Re-run of build:relevance against unchanged syllabi is a no-op

1. Run `bun run db build:relevance` twice with no syllabus changes between.
2. **Expected:** second run reports "0 nodes updated."

### CSG-38: Add a syllabus link, rebuild, expect new relevance entry

1. Author a new `syllabus_node_link` (in YAML and re-seed, or ad-hoc via psql for the test).
2. Run `bun run db build:relevance`.
3. **Expected:** the linked knowledge node's `relevance` array gains an entry matching the new leaf's `(cert, bloom, priority)`.

---

## Authored YAML cleanup

### CSG-39: drop-authored-relevance script removes `relevance:` from every node.md

1. Confirm YAML files in `course/knowledge/<slug>/node.md` have `relevance:` keys.
2. Run `bun run scripts/migrate/drop-authored-relevance.ts`.
3. **Expected:** every node.md frontmatter has `relevance:` removed. Other frontmatter fields untouched. Markdown body untouched.
4. **Expected:** report file lists every modification.

### CSG-40: Build pipeline still works after YAML cleanup

1. Run `bun run db reset && bun run db seed && bun run db build:relevance`.
2. **Expected:** every phase succeeds. Knowledge node rows exist; relevance cache is populated from syllabi only.

---

## Study plan -> Goal migration

### CSG-41: Existing study_plan creates a paired goal

1. Pre-migration: abby has an active study_plan with `cert_goals=['private', 'instrument']`.
2. Run `bun run db migrate study-plan-to-goals`.
3. **Expected:** abby has a new `goal` row with `is_primary=true, status='active'`. Two `goal_syllabus` rows: one for the PPL ACS syllabus (the private credential's primary), one for the IR ACS syllabus (the instrument credential's primary).
4. **Expected:** `study_plan.goal_migrated_at` is set.

### CSG-42: Migration is idempotent

1. Run the migration a second time.
2. **Expected:** no new goals or goal_syllabus rows. Report shows "0 plans migrated; <N> already migrated."

### CSG-43: `getDerivedCertGoals` matches the original `cert_goals`

1. Pre-migration: abby's study_plan had `cert_goals=['private', 'instrument']`.
2. Post-migration: run `getDerivedCertGoals(db, abby_id)`.
3. **Expected:** returns `['private', 'instrument']` (or in whatever order; sorted lexicographically per BC contract).

### CSG-44: Engine session preview unchanged post-migration

1. Pre-migration: capture the output of `previewSession(db, abby_id, { mode: 'mixed' })` against abby's plan.
2. Post-migration (no other changes): re-run `previewSession(db, abby_id, { mode: 'mixed' })`.
3. **Expected:** identical output (same items, same scoring). The engine is unchanged; the cert filter resolution path now runs through `getDerivedCertGoals` but produces the same result.

### CSG-45: Orphan cert in cert_goals (not in credential table) is logged + skipped

1. Pre-migration: pollute abby's plan with a fake cert: `UPDATE study.study_plan SET cert_goals = '["private","fake-cert"]' WHERE user_id = '<abby_id>';`. (Synthetic test; reset after.)
2. Run the migration.
3. **Expected:** migration logs a warning "credential 'fake-cert' not found; skipping." `goal_syllabus` rows include the PPL ACS row (for `private`) but not a row for `fake-cert`. Migration completes successfully.
4. Reset the test data.

---

## Edge cases

### CSG-46: Syllabus with archived status excluded from active rollups

1. Set a syllabus's `status='archived'`.
2. Run `getCredentialMastery(db, abby_id, 'private')`.
3. **Expected:** the archived syllabus's leaves are not included in the rollup. Switch back to `active`; rollup includes them.

### CSG-47: Credential with zero syllabi renders rollup with 0 totalLeaves

1. Pick a credential whose seed has no syllabi yet (e.g., `cfii`).
2. Run `getCredentialMastery(db, abby_id, 'cfii')`.
3. **Expected:** `totalLeaves=0, coveredLeaves=0, masteredLeaves=0`. `areas=[]`. No error.

### CSG-48: Goal with no syllabi and no nodes

1. Create a goal with neither syllabi nor ad-hoc nodes via `createGoal`.
2. Run `getGoalNodeUnion(db, goalId)`.
3. **Expected:** `{ knowledgeNodeIds: [], weights: {} }`. No error.

### CSG-49: Citation kind `other` falls back to freeform text in UI

1. Pick a citation entry with `kind='other'` on `knowledge_node.references`.
2. Open the knowledge node detail that includes it.
3. **Expected:** the citation row renders as freeform text (the `note` plus any `locator.text`); no broken-link UI.

### CSG-50: DELETED -- FK on `study.citation` no longer applies

This scenario tested a `citation -> reference` foreign key that doesn't exist (no citation table). FK enforcement on reference rows is still relevant for `handbook_section.reference_id` (covered by WP #1's tests) and `credential.regulatory_basis` / `syllabus_node.citations` JSONB-embedded `reference_id` values are validated at the BC layer (not by FK).

### CSG-50A: BC-layer enforcement of `reference_id` validity in citation JSONB

1. Author a syllabus YAML element with a `citations` entry whose `reference: not-a-real-doc` (slug doesn't resolve).
2. Run `bun run db seed syllabi`.
3. **Expected:** seed aborts with `SyllabusValidationError` citing the missing reference slug.

### CSG-51: ACS edition diff -- placeholder until follow-on

1. Insert a synthetic second edition of PPL ACS (`ppl-acs-faa-s-acs-30`) with a few leaf code changes.
2. **Expected (this WP):** seed accepts the new syllabus; `getCredentialMastery` against `private` continues using the credential's primary syllabus (which the user can swap via `credential_syllabus`). The `acs` resolver's `getEditions(cert)` returns both editions.
3. **Out of scope:** a UI surface that diffs the two editions. Verify only that both editions coexist cleanly.

---

## Performance

### CSG-52: GIN index on `knowledge_node.references` makes reverse lookup fast

1. With ~30 nodes seeded plus their references migrated, run `EXPLAIN ANALYZE SELECT id FROM study.knowledge_node WHERE references @> '[{"reference_id": "<some_ref_id>"}]'::jsonb;`.
2. **Expected:** plan uses `Bitmap Index Scan on knowledge_node_references_gin_idx`. Execution time well under 10ms.

### CSG-52A: GIN index on `syllabus_node.citations` makes reverse lookup fast

1. With Area V populated, run `EXPLAIN ANALYZE SELECT id FROM study.syllabus_node WHERE citations @> '[{"reference_id": "<phak_ref_id>"}]'::jsonb;`.
2. **Expected:** plan uses `Bitmap Index Scan on syllabus_node_citations_gin_idx`. Execution time well under 10ms.

### CSG-53: `getCredentialMastery` for PPL completes under 200ms with Area V populated

1. Time `getCredentialMastery(db, abby_id, 'private')`.
2. **Expected:** under 200ms cold cache, under 50ms warm. (Adjust threshold if profiling reveals different baseline; the goal is "no obvious sequential scan over leaves.")

---

## Acceptance gate

A scenario is closed when:

- The expected behavior matches.
- `bun run check` is clean.
- Relevant unit tests pass.
- A grep for the symptom returns empty (no debug logs left, no commented-out code).
