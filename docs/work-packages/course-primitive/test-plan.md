---
title: 'Test Plan: Course Primitive'
product: study
feature: course-primitive
type: test-plan
status: unread
---

# Test Plan: Course Primitive

Manual acceptance tests for [spec.md](./spec.md). Prefix `CRS-`.

## Setup

- Study app running at `localhost:9600`.
- Logged in as `abby@airboss.test` (canonical dev test learner).
- PostgreSQL running on port 5435 with the `study` schema migrated through the course-primitive migration.
- Cert-syllabus WP shipped (PR #248-#274): `syllabus`, `syllabus_node`, `goal`, `goal_syllabus` populated; PPL ACS Area V seeded.
- `bun run db diagnose:school-personal-syllabi` reports 0 rows.
- `bun run db seed courses` has run against the smoke fixture (`course/courses/_fixtures/seed-smoke/`).
- `bun run check all` passes on the branch.

---

## Schema

### CRS-1: course table created

1. `psql -d airboss -c "\d study.course"`.
2. **Expected:** table exists with columns `id`, `slug`, `kind`, `title`, `description`, `status`, `seed_origin`, `created_at`, `updated_at`. CHECK constraints: `course_kind_check`, `course_status_check`, `course_slug_shape_check`. UNIQUE on `slug`. Index on `(kind, status)`.

### CRS-2: course_step table created

1. `psql -d airboss -c "\d study.course_step"`.
2. **Expected:** table exists with columns per spec. CHECK constraints: `course_step_level_check`, `course_step_consistency_check`, `course_step_ordinal_check`. UNIQUE on `(course_id, code)`. Indexes: `(course_id, parent_id, ordinal)`, `(knowledge_node_id)`. FK on `course_id` with ON DELETE CASCADE; FK on `parent_id` with ON DELETE CASCADE; FK on `knowledge_node_id` with ON DELETE RESTRICT.

### CRS-3: goal_course table created

1. `psql -d airboss -c "\d study.goal_course"`.
2. **Expected:** table exists with composite PK on `(goal_id, course_id)`. Reverse index on `course_id`. CHECK on `weight` matches the `goal_syllabus_weight_check` range.

### CRS-4: knowledge_node.kind column added and backfilled

1. `psql -d airboss -c "SELECT kind, COUNT(*) FROM study.knowledge_node GROUP BY kind;"`.
2. **Expected:** every row has `kind='concept'` (the backfill default). The migration left no NULLs.

### CRS-5: CHECK constraint rejects bad course_step row

1. Try to insert a step row with `level='step'` and NULL `knowledge_node_id`: `INSERT INTO study.course_step (id, course_id, parent_id, level, ordinal, code, title) VALUES ('cst_bad', 'crs_smoke', 'cst_section', 'step', 0, 'bad', 't');`.
2. **Expected:** insert fails with `course_step_consistency_check` violation.

### CRS-6: CHECK constraint rejects bad section row

1. Try to insert a section row with non-NULL `parent_id`: `INSERT INTO study.course_step (id, course_id, parent_id, level, ordinal, code, title) VALUES ('cst_bad', 'crs_smoke', 'cst_section', 'section', 0, 'bad', 't');`.
2. **Expected:** insert fails with `course_step_consistency_check` violation.

---

## Seed pipeline

### CRS-10: seed against smoke fixture creates expected rows

1. `bun run db seed courses` against `course/courses/_fixtures/seed-smoke/`.
2. Query `SELECT slug, kind, status, title FROM study.course WHERE slug='seed-smoke';`.
3. **Expected:** one row, `kind='instructor'`, `status='active'`, title matches manifest.
4. Query `SELECT level, code, title, knowledge_node_id IS NULL AS has_no_node FROM study.course_step WHERE course_id=(SELECT id FROM study.course WHERE slug='seed-smoke') ORDER BY level, ordinal;`.
5. **Expected:** one section row (`has_no_node=true`), two step rows (`has_no_node=false`).

### CRS-11: idempotent seed (no writes on unchanged YAML)

1. Run `bun run db seed courses` twice in succession.
2. Capture `pg_stat_user_tables.n_tup_upd` for `study.course` and `study.course_step` before the second run.
3. **Expected:** the second run reports zero updates / inserts on either table.

### CRS-12: content_hash drives single-row update

1. Edit one step's `body_md` in `course/courses/_fixtures/seed-smoke/sections/s1.yaml`.
2. Run `bun run db seed courses`.
3. **Expected:** exactly one `course_step` row updated; the others untouched (verify via `updated_at`).
4. Revert the YAML; rerun the seed.
5. **Expected:** exactly one row updated again (back to original content).

### CRS-13: validator rejects dangling knowledge_node reference

1. Add a step in the smoke fixture with `knowledge_node_id: wx-does-not-exist`.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with the exact message `course step '...' references missing knowledge_node 'wx-does-not-exist'`. No partial writes (transaction rolled back).

### CRS-14: validator rejects duplicate ordinal

1. Author two steps in the same section with `ordinal: 1`.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with `duplicate ordinal in section '...' steps`.

### CRS-15: validator rejects duplicate code

1. Author two `course_step` rows in the same course with `code: s1.1`.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with `duplicate code 's1.1' in course '...'`.

### CRS-16: validator rejects step missing knowledge_node_id

1. Author a step row with no `knowledge_node_id` in the YAML.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with `step '...' must carry knowledge_node_id`.

### CRS-17: validator rejects section carrying knowledge_node_id

1. Author a section row with a `knowledge_node_id` field.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with `section '...' must not carry knowledge_node_id`.

### CRS-18: kind='personal' rejected as reserved

1. Author a course manifest with `kind: personal`.
2. Run `bun run db seed courses`.
3. **Expected:** seed fails with `course kind 'personal' is reserved; authoring deferred`.

---

## Diagnostic

### CRS-20: school/personal syllabi diagnostic reports zero rows

1. Run `bun run db diagnose:school-personal-syllabi`.
2. **Expected:** exits 0 with output `0 row(s) found with kind IN ('school','personal').`

### CRS-21: diagnostic surfaces planted school row

1. Manually insert one row: `INSERT INTO study.syllabus (id, slug, kind, title, edition) VALUES ('syl_test', 'test-school', 'school', 'Test', '2026-01');`.
2. Run `bun run db diagnose:school-personal-syllabi`.
3. **Expected:** exits 0 with output listing the test row.
4. Cleanup: `DELETE FROM study.syllabus WHERE id='syl_test';`.

---

## BC: getGoalNodeUnion extension

### CRS-30: course-only goal returns course-linked nodes

1. Create a test goal for abby with one `goal_course` row pointing at the smoke course.
2. Call `getGoalNodeUnion(goalId)` via test or REPL.
3. **Expected:** the returned `knowledgeNodeIds` array contains every node id referenced by the smoke course's step rows. Weights = `goal_course.weight` per node.

### CRS-31: mixed goal dedupes shared nodes (weight = MAX across paths)

1. Create a goal with: one `goal_course` (weight 1.0) referencing the smoke course AND one `goal_node` (weight 0.5) pointing at the same node id as one of the smoke course's steps.
2. Call `getGoalNodeUnion(goalId)`.
3. **Expected:** the shared node appears exactly once in `knowledgeNodeIds`. Its weight in `weights` is 1.0 (the MAX of the two reachable paths -- "most-prominent context wins"; matches the existing relevance-cache rebuild semantic).

### CRS-32: course + syllabus goal merges all sources

1. Create a goal with: one `goal_course` referencing the smoke course AND one `goal_syllabus` referencing PPL ACS Area V.
2. Call `getGoalNodeUnion(goalId)`.
3. **Expected:** the union contains every node reached via either source. Shared nodes are deduped; per-node weight is the MAX across reachable paths.

---

## Lens: courseLens

### CRS-40: courseLens returns two-level tree

1. Call `courseLens(db, abbyUserId, { goal: smokeGoal, filters: { courseId: smokeCourseId } })`.
2. **Expected:** `result.tree` has one root with `level: 'course'`, one child with `level: 'section'`, two grandchild leaves with `level: 'step'`. Title strings match the YAML manifest.

### CRS-41: courseLens rolls up mastery

1. Mark one of the two smoke-course-linked nodes as mastered for abby (via card reviews to the `pass` gate).
2. Call `courseLens` per CRS-40.
3. **Expected:** the section's `rollup.masteredLeaves=1`, `totalLeaves=2`, `masteryFraction=0.5`. The course root's rollup matches.

### CRS-42: courseLens with anonymous browse (null goal)

1. Call `courseLens(db, '', { goal: null, filters: { courseId: smokeCourseId } })`.
2. **Expected:** `result.tree` returns the course tree with empty mastery on every leaf; rollup `totalLeaves=2`, `masteredLeaves=0`, `coveredLeaves=0`.

### CRS-43: courseLens applies goal_course.weight

1. Update the test goal's `goal_course` row to `weight=2.0`.
2. Call `courseLens` per CRS-40.
3. **Expected:** the rollup's weighted-mastery math reflects the doubled weight. The mastered-leaf count is unchanged (weight does not affect counts), but `masteryFraction` math uses 2.0 per leaf.

---

## Lens: courseWithCertOverlayLens

### CRS-50: overlay flags steps that satisfy cert leaves

1. Author a fixture course step linked to a knowledge node that is ALSO linked from PPL ACS Area V (one of the existing area-V `syllabus_node_link` rows).
2. Author a second step linked to a node NOT in any PPL ACS leaf.
3. Call `courseWithCertOverlayLens(db, abbyUserId, { goal: pplGoal, filters: { courseId: fixtureCourseId, syllabusId: pplAcsSyllabusId } })`.
4. **Expected:** the first step's leaf has `sources: { inCourse: true, inCert: true, certCode: '<the syllabus_node code>' }`. The second step has `sources: { inCourse: true, inCert: false }` and no `certCode`.

### CRS-51: overlay populates certGaps

1. Continue from CRS-50.
2. Inspect `result.certGaps`.
3. **Expected:** the array contains an entry for every PPL ACS Area V element-leaf whose linked nodes are NOT covered by any course step. Each entry has `syllabusNodeId`, `code`, `title`, `requiredBloom`, `knowledgeNodeIds`.

### CRS-52: overlay computes empty gap list when course covers all cert leaves

1. Construct a fixture syllabus with one element-leaf carrying a single `syllabus_node_link` pointing at a known knowledge_node id.
2. Construct a fixture course with one step linking to the same knowledge_node id.
3. Call the overlay lens with the fixture course + fixture syllabus.
4. **Expected:** `result.certGaps` is `[]` (empty array, not undefined).

Note: the test must use a fixture syllabus that has every element-leaf linked. Running this against the seeded PPL ACS Area V is unsatisfiable today because most element-leaves have zero `syllabus_node_link` rows (content gap, not a BC bug -- `getCourseGaps` correctly emits zero-link leaves as gaps per its JSDoc). Backfilling Area V link coverage is a separate content-authoring task.

### CRS-53: overlay accepts syllabusId not on goal

1. Call the overlay lens with a `syllabusId` that the goal does NOT reference via `goal_syllabus`.
2. **Expected:** the lens still computes the overlay against that syllabus. No error thrown. (Useful for "what would this course look like for PPL?" exploration.)

---

## Knowledge node kind

### CRS-60: kind='transition' renders without rejection

1. Author a knowledge node with `kind: transition` in its frontmatter (or set via direct DB update for testing).
2. Confirm the seed accepts it: `psql -d airboss -c "SELECT kind FROM study.knowledge_node WHERE id='<node-id>';"` returns `transition`.
3. Author a course step linking to that node. Run `bun run db seed courses`.
4. **Expected:** seed succeeds. The step links normally. The lens emits the leaf without special handling (UI rendering of transition framing is a follow-on WP).

### CRS-61: kind CHECK rejects unknown value

1. Try `UPDATE study.knowledge_node SET kind='gibberish' WHERE id='<some-node>';`.
2. **Expected:** update fails with `knowledge_node_kind_check` violation.

---

## Edge cases

### CRS-70: empty course (zero steps) returns empty tree from lens

1. Create a course row with no `course_step` rows.
2. Call `courseLens` against a goal that references it.
3. **Expected:** the tree contains the course root with empty children; rollup is zero.

### CRS-71: section with zero steps has zero coverage in rollup

1. Author a course with one section that has no steps.
2. Call `courseLens`.
3. **Expected:** the section's rollup shows `totalLeaves=0`, `masteryFraction=0`. The course root's rollup correctly handles the empty section.

### CRS-72: archived course still serves the lens

1. Set `study.course.status='archived'` for the smoke course.
2. Call `courseLens` against a goal that references it.
3. **Expected:** the lens returns the tree unchanged; status filtering is the UI's job, not the lens's.

### CRS-73: two courses linking the same knowledge_node coexist

1. Author a second smoke course whose steps include one node id already used by the first smoke course.
2. Run `bun run db seed courses`.
3. **Expected:** seed succeeds; both courses exist; the shared node is referenced by both `course_step` rows. Reverse-lookup via `course_step.knowledge_node_id` index returns both rows.

### CRS-74: CASCADE delete on course removes its steps; goal_course blocks via RESTRICT

1. With NO `goal_course` rows pointing at the course: `DELETE FROM study.course WHERE slug='seed-smoke';`.
2. **Expected:** delete succeeds; all `course_step` rows for that course are CASCADE-deleted (the `course_step.course_id` FK is `ON DELETE CASCADE`).
3. With a `goal_course` row pointing at the course: try the same DELETE.
4. **Expected:** delete fails with FK violation. The `goal_course.course_id` FK is `ON DELETE RESTRICT` -- a learner with the course in their goal must remove the goal_course row first. This protects against accidental loss of a course referenced by an active learner goal.

### CRS-75: RESTRICT delete on knowledge_node prevents loss

1. Try to `DELETE FROM study.knowledge_node WHERE id='<node-referenced-by-a-course-step>';`.
2. **Expected:** delete fails with FK violation. The course_step.knowledge_node_id FK is `RESTRICT`, not `CASCADE` -- the human must remove the course step first.
