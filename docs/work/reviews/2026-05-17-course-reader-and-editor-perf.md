---
feature: course-reader-and-editor
category: perf
date: 2026-05-17
branch: main
issues_found: 9
critical: 0
major: 3
minor: 4
nit: 2
---

## Summary

The CRE feature is well-engineered for current data scale (single-digit courses, ~50 knowledge nodes, two-level trees) and the loaders mostly use `Promise.all` correctly. The dominant performance theme is **redundant course-tree traversal**: the course detail and step-reader loaders each fetch the full course-step list directly *and* call a lens that fetches the same list again internally, and the step reader runs an entire lens pass purely to obtain a leaf flatten it could compute from rows already in hand. None of these cause visible lag today, but they roughly double the per-render query count on the two highest-traffic reader pages and will compound as authored courses grow. The seed pipeline and YAML emitter are sound. No critical issues.

## Issues

### MAJOR: Step reader runs a full lens pass solely to get the prev/next leaf flatten

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:202-266`
- **Problem**: The loader already fetches `allSteps` via `getCourseStepsByCourse(course.id)` (line 202-206) and builds `rowById` from it (line 245-246). It then *separately* runs `courseLens` or `courseWithCertOverlayLens` (line 217-226). `courseLens` internally calls `getCourseStepsByCourse(courseId, db)` again (lenses-course.ts:137) plus a `course` row select and a `goalCourse` link select, and `getNodeEvidenceStateMap` over every linked node. When no overlay is active, the *only* product of that lens pass that the loader consumes is `lensResult.tree`, fed into `flattenLeavesDepthFirst` for prev/next (line 265). The comment at line 215-216 acknowledges this ("Run a lens pass to get the flattened leaf list for prev/next"). Prev/next is pure tree topology -- `computePrevNextLeaves` already takes `rows` (id + parentId) which the loader has from `allSteps`; the leaf set is just `allSteps.filter(isLeaf)`.
- **Impact**: On every non-overlay step view: one extra `getCourseStepsByCourse` (full row scan of the course tree), one extra `course` select, one extra `goalCourse` select, and one `getNodeEvidenceStateMap` query -- roughly 4 redundant round-trips per page load, plus the recursive subtree build and per-leaf mastery decode that the page never renders (the step reader shows node phases, not the tree). A learner clicking through a 40-step course pays this 40 times per session.
- **Fix**: When `overlayActive` is false, skip the lens entirely. Build the leaf list directly: `const leaves = allSteps.filter((s) => s.isLeaf).map((s) => ({ id: s.id, title: s.title }))` (in tree-walk order, which `getCourseStepsByCourse` already returns), and feed `rowById`-derived rows into `computePrevNextLeaves`. Only call the overlay lens when `overlayActive` is true (it genuinely needs the lens for `certGaps` / `certChip`).

### MAJOR: Course detail loader double-fetches the course row and the step tree

- **File**: `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts:66-85`
- **Problem**: The loader calls `getCourseBySlug` (line 66), then in the `Promise.all` calls both the lens (line 74-82) and `getCourseStepsByCourse(course.id)` (line 83). The lens internally re-selects the `course` row by id (lenses-course.ts:132-134) and re-runs `getCourseStepsByCourse(courseId, db)` (lenses-course.ts:137). So the course tree is read from Postgres twice per detail render, and the course row three times (slug lookup + lens). The loader needs `allSteps` only to build `stepCodeById` (line 90-93) -- a map the lens *could* expose since it already walks the same rows.
- **Impact**: One redundant full course-tree query and one redundant single-row `course` select on every course-detail page load. Bounded by tree size; a large authored course (the upcoming weather-comprehensive) makes the duplicate scan non-trivial.
- **Fix**: Either (a) have the lens return the `code`-per-node mapping (it already iterates every `course_step` row and has `code` in hand), eliminating the loader's separate `getCourseStepsByCourse` call; or (b) accept the loader's `getCourseStepsByCourse` and have the lens accept a pre-fetched step list to avoid re-querying. Option (a) is cleaner and removes the duplication at the source.

### MAJOR: Hangar courses index N+1 -- one full course-tree query per course just to count sections

- **File**: `apps/hangar/src/routes/(app)/courses/+page.server.ts:53-59`
- **Problem**: For every course the loader calls `getCourseStepsByCourse(course.id)`, which `SELECT *`s every section + lesson + step row of that course (full `body_md` text included), then counts `parentId === null` rows in JS (line 56). The code comment at line 50-52 acknowledges this is an N+1 ("at scale we'd batch via a count-by-course query"). The `Promise.all` parallelizes the round-trips but does not reduce their count -- N courses still issue N queries, each pulling potentially large `body_md` payloads only to discard everything but a `length`.
- **Impact**: With the smoke fixture (1 course) this is invisible. Each authored course adds one full-tree query to the hangar index render. At 20-30 courses with real `body_md` content the index page transfers hundreds of KB of markdown from Postgres to drop it on the floor.
- **Fix**: Add a BC helper `countSectionsByCourse(courseIds: string[])` doing a single `SELECT course_id, count(*) FROM course_step WHERE parent_id IS NULL AND course_id = ANY(...) GROUP BY course_id`, backed by `course_step_tree_idx` (leading `courseId`). One query for the whole index. The aggregate belongs in the DB, not a JS `.filter().length`.

### MINOR: Courses index re-queries goal_course link + course row inside each per-course lens call

- **File**: `apps/study/src/routes/(app)/courses/+page.server.ts:57-83`
- **Problem**: The loader fetches `getCoursesByGoal(primaryGoal.id)` (line 57) -- which already returns the full `course` rows for every goal-linked course. It then maps each goal-course id through `courseLens` (line 71-79). Each `courseLens` call independently re-selects the `goalCourse` link row (lenses-course.ts:116-120) and the `course` row by id (lenses-course.ts:132-134) that the loader already holds. The lens is invoked only for its `rollup`, but the per-call setup re-fetches data already in memory.
- **Impact**: 2 redundant single-row selects per in-goal course. Small absolute cost (indexed PK lookups), but it scales linearly with goal size and is pure waste. `getCoursesByGoal` already did the join the lens redoes.
- **Fix**: Lower-priority than the MAJOR items because the rows are indexed PK hits. If the lens gains a "pre-fetched goal context" parameter (the fix for the detail-page MAJOR), thread it here too. Otherwise accept as a known minor.

### MINOR: `splitContentPhases` recomputed seven times per step-reader render

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:236-242`
- **Problem**: `phases` is built by `KNOWLEDGE_PHASE_ORDER.map((phase) => ({ phase, body: splitContentPhases(node.contentMd ?? '')[phase] ?? null }))`. `splitContentPhases` is called once per iteration -- 7 times -- and each call re-parses the entire node `contentMd` markdown to split it into all 7 phases, then the map throws away 6 of the 7 results each time.
- **Impact**: 7x redundant markdown parse of the full node body on every step-reader load. For a long node body this is measurable CPU on the server render path. Not visible at current content scale but strictly wasteful.
- **Fix**: Hoist the split: `const split = splitContentPhases(node.contentMd ?? ''); const phases = KNOWLEDGE_PHASE_ORDER.map((phase) => ({ phase, body: split[phase] ?? null }));`. One parse instead of seven.

### MINOR: Hangar section editor / course editor read and YAML-parse every section file on every load

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts:51-63` and `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:76-97`
- **Problem**: `findSectionFile` (`readdirSync` + `readFileSync` + `parse` + Zod `safeParse` of every `.yaml` in `sections/`) runs on every section-editor load to locate one file by `code`. `loadSectionsFromDisk` does the same full scan + parse on every course-editor load. Synchronous `readFileSync` blocks the SvelteKit request thread for the duration of all file reads + YAML parses.
- **Impact**: With a handful of sections this is sub-millisecond. A course with many sections turns each editor page load into N synchronous file reads + N YAML parses + N Zod validations on the request thread. The `cleanupOrphans` action additionally re-reads + re-parses every section file (line 312-319) after `loadSectionsFromDisk` already parsed them.
- **Fix**: Acceptable for the single-user hangar at current scale, but: (a) use `readFile` (async) instead of `readFileSync` so the request thread is not blocked; (b) in `cleanupOrphans`, have `loadSectionsFromDisk` return the parsed `steps` (or the full parsed section) so the second parse loop is eliminated. Document the sync-scan as a known limitation if left.

### MINOR: Hangar courses index loads `listAllCourses` (full table, all columns) then filters status in JS

- **File**: `apps/hangar/src/routes/(app)/courses/+page.server.ts:46-47`
- **Problem**: `listAllCourses(db)` selects every column of every course row; the loader then filters by `statusFilter` in JS (line 47). `course` has `course_kind_status_idx` on `(kind, status)`, so a status filter could be index-backed in the DB.
- **Impact**: Negligible at current scale (`course` is a tiny table and the editor genuinely wants "all statuses" by default). Only the `?status=` filtered view does redundant transfer.
- **Fix**: Low priority. If desired, give `listAllCourses` an optional `statusIn` filter mirroring `listCoursesForReader` and push the filter to the DB. The `description` column (potentially large markdown) is also fetched for the index list where only the title/slug/status/timestamp are rendered -- a column projection would trim transfer. Acceptable to leave at this scale.

### NIT: `listCoursesForReader` orders by `course.title` with no supporting index

- **File**: `libs/bc/study/src/courses.ts:383-394`
- **Problem**: `listCoursesForReader` ends with `.orderBy(asc(course.title))`. There is no index on `course.title`; Postgres sorts in memory.
- **Impact**: Irrelevant at current scale -- `course` is a tiny table, an in-memory sort of a few dozen rows is free. Listed only for completeness; do not add an index for this until the table is large.
- **Fix**: None needed now. Revisit only if `course` ever grows past hundreds of rows.

### NIT: Course detail loader builds `stepCodeById` over every row including non-leaf interiors

- **File**: `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts:90-93`
- **Problem**: The loop maps every step row's `id -> code`. This is correct and intentional (the comment at design-time notes interior rows render landing pages and need URLs), so it is not a bug. The map is shipped to the client in the page payload; for a large course it is a modest serialized-data-transfer line item.
- **Impact**: Trivial -- a `Record<string,string>` of a few dozen short strings. Noted only because if this map were instead derived from the lens output (per the detail-page MAJOR fix) the separate `allSteps` fetch disappears and this loop with it.
- **Fix**: Folds into the MAJOR fix for the detail loader; no standalone action.

## Spec compliance notes

- The design.md API sketch for the step reader (lines 207-231) explicitly says "step reader doesn't need lens output when no overlay -- mastery comes from `getNodeEvidenceStateMap` directly" and sets `lensResult = null` in the no-overlay branch. The shipped code (the first MAJOR above) diverges: it always runs a lens pass regardless of overlay state. The implementation is heavier than the design intended. The fix realigns the code with design.md.
- The design.md detail-page sketch (lines 188-203) does not include the separate `getCourseStepsByCourse` call the shipped loader adds for `stepCodeById`; the duplication (second MAJOR) is a build-phase addition not anticipated by the design. Worth resolving so the lens stays the single source of tree traversal.
- All other surfaces match the spec. The seed-pipeline-on-save flow, YAML canonical emission, encoded-text constant lookup, and transition rendering are implemented as specified with no performance regressions. `getCourseGaps` correctly batches its leaf-link lookup into one `inArray` query and its covered-node scan into one query -- no N+1 in the gap calculation.
