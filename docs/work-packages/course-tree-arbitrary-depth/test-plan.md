---
id: course-tree-arbitrary-depth
title: 'Test Plan: Course Tree -- Arbitrary Depth'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-12
owner: agent
depends_on:
  - course-primitive
unblocks:
  - wx-scenarios-course-section
tags:
  - course
  - test-plan
legacy_fields:
  feature: course-tree-arbitrary-depth
  type: test-plan
---

# Test Plan: Course Tree -- Arbitrary Depth

WXENG-style numbered cases. Each case lists the layer, the input, the expected outcome, and whether it's automated (unit / e2e) or manual.

The 3-level reference fixture (`course/courses/_fixtures/3-level-tree/`) lands in Phase A and is the substrate for the bulk of these cases. The existing `course/courses/weather-comprehensive/` course is the 2-level regression baseline.

## Schema-layer cases

### T1.1 -- Section row legal shape

- **Layer**: DB CHECK
- **Input**: insert `course_step` row with `level='section'`, `parent_id=NULL`, `knowledge_node_id=NULL`, `is_leaf=false`
- **Expected**: insert succeeds
- **Auto**: Vitest (raw SQL) -- `libs/bc/study/src/schema.test.ts`

### T1.2 -- Lesson row legal shape

- **Layer**: DB CHECK
- **Input**: insert with `level='lesson'`, `parent_id='cst_<section>'`, `knowledge_node_id=NULL`, `is_leaf=false`
- **Expected**: insert succeeds
- **Auto**: Vitest

### T1.3 -- Step row legal shape

- **Layer**: DB CHECK
- **Input**: insert with `level='step'`, `parent_id='cst_<section-or-lesson>'`, `knowledge_node_id='kn_<existing>'`, `is_leaf=true`
- **Expected**: insert succeeds
- **Auto**: Vitest

### T1.4 -- Leaf without node rejected

- **Input**: `level='step'`, `is_leaf=true`, `knowledge_node_id=NULL`
- **Expected**: CHECK violation
- **Auto**: Vitest

### T1.5 -- Non-leaf with node rejected

- **Input**: `level='lesson'`, `is_leaf=false`, `knowledge_node_id='kn_x'`
- **Expected**: CHECK violation
- **Auto**: Vitest

### T1.6 -- Section with parent rejected

- **Input**: `level='section'`, `parent_id='cst_x'`
- **Expected**: CHECK violation
- **Auto**: Vitest

### T1.7 -- Lesson without parent rejected

- **Input**: `level='lesson'`, `parent_id=NULL`
- **Expected**: CHECK violation
- **Auto**: Vitest

### T1.8 -- Unknown level rejected

- **Input**: `level='module'`
- **Expected**: CHECK violation
- **Auto**: Vitest

## YAML-schema cases

### T2.1 -- Flat 2-level YAML accepts (regression)

- **Input**: existing `course/courses/weather-comprehensive/sections/s1-why-weather-matters.yaml`
- **Expected**: Zod parse clean
- **Auto**: Vitest -- `libs/bc/study/src/course-yaml-schemas.test.ts`

### T2.2 -- 3-level YAML accepts

- **Input**: synthetic section with `steps: [{ level: lesson, code: l1, steps: [{ code: l1.1, ... }] }]`
- **Expected**: parse clean
- **Auto**: Vitest

### T2.3 -- 4-level YAML accepts

- **Input**: synthetic section with lesson -> lesson -> step
- **Expected**: parse clean
- **Auto**: Vitest

### T2.4 -- Lesson with zero children rejected

- **Input**: `{ level: lesson, code: l1, steps: [] }`
- **Expected**: Zod parse error (`.min(1)` on lesson.steps)
- **Auto**: Vitest

### T2.5 -- Unknown key at depth rejected

- **Input**: a lesson with `{ level: lesson, foo: bar, ... }`
- **Expected**: Zod strict-mode rejection
- **Auto**: Vitest

### T2.6 -- Step with `level: step` field accepts

- **Input**: explicit `level: step` on a leaf
- **Expected**: parse clean (default when omitted)
- **Auto**: Vitest

## Seed-validator cases

### T3.1 -- weather-comprehensive re-seed is zero-diff

- **Layer**: seed
- **Input**: existing `course/courses/weather-comprehensive/`
- **Expected**: `bun run db seed courses` writes zero rows (content_hash unchanged); the `course_step` row set is byte-identical to before the schema change
- **Auto**: scripted test in Phase B -- dump rows before and after, diff
- **Manual**: yes, walk one section -> step end-to-end in the UI to confirm the lens output is unchanged

### T3.2 -- 3-level fixture seeds clean

- **Input**: `course/courses/_fixtures/3-level-tree/`
- **Expected**: rows inserted in section -> lesson -> step order; `is_leaf` set correctly; `parent_id` chain resolves
- **Auto**: Vitest (uses test DB)

### T3.3 -- Cycle in authored YAML rejected

- **Input**: synthetic YAML where a lesson code parents to a descendant of itself (only possible through a hand-edit; YAML is a tree, but defensive)
- **Expected**: `CourseSeedError: cycle in course '<slug>' tree`
- **Auto**: Vitest

### T3.4 -- Lesson with knowledge_node_id rejected

- **Input**: `{ level: lesson, code: l1, knowledge_node_id: kn_x, steps: [...] }`
- **Expected**: `CourseSeedError: lesson '<course>.l1' must not carry knowledge_node_id`
- **Auto**: Vitest

### T3.5 -- Step without knowledge_node_id rejected

- **Input**: a leaf step missing `knowledge_node_id`
- **Expected**: `CourseSeedError: step '<course>.<code>' must carry knowledge_node_id`
- **Auto**: Vitest

### T3.6 -- Step with steps[] rejected

- **Input**: a step row carrying `steps: [...]`
- **Expected**: `CourseSeedError: step '<course>.<code>' must not have child steps`
- **Auto**: Vitest

### T3.7 -- Non-leaf with no leaf descendants rejected

- **Input**: section with a single lesson child whose `steps` is empty (rejected at YAML layer T2.4) or every leaf is missing
- **Expected**: `CourseSeedError: lesson '<code>' must have at least one leaf descendant`
- **Auto**: Vitest

### T3.8 -- Tree depth > 10 rejected

- **Input**: synthetic 11-deep nesting
- **Expected**: `CourseSeedError: course '<slug>' exceeds max tree depth of 10`
- **Auto**: Vitest

### T3.9 -- Duplicate ordinals within a parent rejected

- **Input**: two children of the same lesson both ordinal 1
- **Expected**: `CourseSeedError: duplicate ordinal in lesson '<code>' children`
- **Auto**: Vitest

## Lens-layer cases

### T4.1 -- Lens returns flat tree for 2-level course (regression)

- **Input**: `courseLens` against weather-comprehensive
- **Expected**: course root -> section nodes -> step leaves (no `lesson` rows)
- **Auto**: Vitest -- `libs/bc/study/src/lenses.test.ts`

### T4.2 -- Lens returns nested tree for 3-level fixture

- **Input**: `courseLens` against 3-level fixture
- **Expected**: course root -> section -> lesson (level='lesson') -> step leaves; structure exactly as authored
- **Auto**: Vitest

### T4.3 -- Lens rollup aggregates leaf mastery up the tree

- **Input**: 3-level fixture, mock evidence on 2 of 4 leaves
- **Expected**: lesson rollup shows 50% covered; section rollup mirrors lesson rollup
- **Auto**: Vitest

### T4.4 -- `flattenLeavesDepthFirst` walks leaves in document order

- **Input**: 3-level fixture (s1 -> { l1 -> [s1.1, s1.2], s2 (no lesson, direct step) })
- **Expected**: ordered `[s1.1, s1.2, s2]`
- **Auto**: Vitest

### T4.5 -- Lens handles mixed depth (section with both direct steps and lessons)

- **Input**: fixture where a section has step children AND lesson children
- **Expected**: both partitions appear in `children` (lessons) and `leaves` (direct steps); ordinal order preserved across both
- **Auto**: Vitest

### T4.6 -- Overlay lens populates `LensLeafSources` on leaves only

- **Input**: 3-level fixture with overlay
- **Expected**: every leaf carries `sources`; no lesson / section node carries `sources`
- **Auto**: Vitest

## Renderer + navigation cases

### T5.1 -- Course landing renders flat 2-level outline (regression)

- **Layer**: course landing route
- **Input**: navigate to `/courses/weather-comprehensive`
- **Expected**: outline visually identical to today
- **Manual** + Playwright (regression suite)

### T5.2 -- Course landing renders 3-level outline

- **Input**: navigate to `/courses/_3-level-fixture` (or whichever the fixture is mounted under)
- **Expected**: section as h2, lesson as h3 with indented step list, every clickable link resolves
- **Auto**: Playwright -- `tests/e2e/course-tree-n-deep.spec.ts`

### T5.3 -- Step reader renders leaf as today

- **Input**: navigate to any leaf URL in weather-comprehensive
- **Expected**: rendered identically to before this WP (knowledge node phases + framing)
- **Manual** + Playwright

### T5.4 -- Step reader renders lesson as landing

- **Input**: navigate to a lesson URL in the 3-level fixture
- **Expected**: page shows lesson title, breadcrumb (course -> section -> lesson), body_md, list of children with title + truncated body + link
- **Auto**: Playwright

### T5.5 -- Step reader renders section as landing

- **Input**: navigate to a section URL
- **Expected**: page shows section title, breadcrumb (course -> section), body_md, list of children (mix of lessons + steps with level badges)
- **Auto**: Playwright

### T5.6 -- Prev/next traverses leaves depth-first

- **Input**: from the first leaf of the 3-level fixture, click "next" through every leaf
- **Expected**: visit order matches `flattenLeavesDepthFirst`; final "next" link absent
- **Auto**: Playwright

### T5.7 -- Prev/next on a lesson landing

- **Input**: navigate to a lesson URL; click "next"
- **Expected**: lands on the lesson's first leaf
- **Auto**: Playwright

### T5.8 -- Prev/next on a section landing

- **Input**: navigate to a section URL; click "prev"
- **Expected**: lands on the previous section's last leaf
- **Auto**: Playwright

### T5.9 -- Prev/next at the very start of the course

- **Input**: navigate to the course's first leaf
- **Expected**: only "next" link; "prev" suppressed
- **Auto**: Playwright

### T5.10 -- Prev/next labels carry context

- **Input**: hover or read the prev/next link text
- **Expected**: text reads "Next: <Section> / <Lesson> / <Step>" so the destination is unambiguous
- **Manual**

## Cross-cutting cases

### T6.1 -- weather-comprehensive renders byte-identical to today

- **Input**: full click-through against a snapshot of pre-WP HTML
- **Expected**: zero diff in lens output and rendered outline structure (the new schema is a strict superset of the old)
- **Auto**: snapshot test against a captured HTML baseline; Manual confirmation

### T6.2 -- Unblocked WX scenarios content PR seeds + renders cleanly

- **Input**: re-run seed against `feat/wx-scenarios-course-section` YAML on top of this WP's schema
- **Expected**: 6 lessons * 4 substeps render; prev/next walks all 24 leaves end-to-end
- **Manual** + Playwright

### T6.3 -- Cert overlay aggregates leaf coverage up the tree

- **Input**: 3-level fixture with overlay; mock 2 of 4 leaves covered
- **Expected**: lesson shows "2 / 4 covered"; section shows the same
- **Auto**: Vitest (Phase E)

### T6.4 -- Study-plan session selection ignores non-leaf rows

- **Input**: build a session for a goal that references a course with lessons
- **Expected**: every selected card resolves to a leaf row; no lesson row is selected (no node binding)
- **Auto**: Vitest (Phase E)

### T6.5 -- `bun run check all` clean on every Phase PR

- **Manual**: confirm locally before pushing each phase

## Manual smoke test (the user-facing "feature works" walkthrough)

1. `bun run db reseed` -- confirm zero errors
2. `bun run dev study` -- launch the study app
3. Visit `/courses/weather-comprehensive` -- outline renders as today
4. Click any step -- renders as today
5. (After the unblock-content PR is rebased and seeded:) visit `/courses/weather-comprehensive` and scroll to the WX Scenarios section
6. Click into the first scenario lesson -- landing page renders with breadcrumb + body + list of 4 substeps
7. Click the first substep -- renders the knowledge node content as a leaf
8. Click "next" four times -- visits all 4 substeps of lesson 1 in order
9. Click "next" again -- lands on the first substep of lesson 2
10. Click "prev" five times -- walks backwards in document order
11. Open devtools console -- zero errors / warnings

If any step diverges from the expected behaviour, file a bug + fix before merging the Phase that introduced the regression.
