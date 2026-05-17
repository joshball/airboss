---
feature: course-reader-and-editor
category: backend
date: 2026-05-17
branch: main
issues_found: 14
critical: 0
major: 4
minor: 7
nit: 3
---

## Summary

The CRE backend is solid overall: loaders are correctly placed in `+page.server.ts`, auth/role gates are present on every loader and action, the YAML-as-source write flow honors the spec's backup-then-revert contract, and the goal-course actions follow the established `addSyllabus` / `addNode` pattern faithfully. The main weaknesses are inconsistency in mutation outcomes (some actions redirect, some return; `addCourse` does not redirect where the spec implies a banner refresh), a few partial-failure windows in the hangar editor write path that are not fully atomic, raw Postgres error text leaking to the form on the goal-course write path, and one BC layering violation where the goal composer queries `goalCourse` directly instead of going through the courses BC. No data-corruption or auth-bypass defects were found.

## Issues

### MAJOR: Hangar editor write path is not atomic across multi-file mutations

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:134-170` (`runSave`)
- **Problem**: `runSave` snapshots backups, applies every write, then runs the seed. If the seed fails, it reverts every file. But the revert itself is best-effort: `writeFile(...).catch(() => {})` and `unlink(...).catch(() => {})` swallow every revert error. If a revert `writeFile` fails (disk full, permission flip mid-operation), the YAML on disk is now in a partially-mutated state, the DB is whatever the failed seed left, and the user gets only the original seed error with no signal that the revert also failed. The spec's invariant ("every successful save lands the exact same state in both; on failure the DB is unchanged and YAML is reverted") is silently broken with no diagnostic.
- **Fix**: Collect revert failures and, if any occurred, surface them in the returned `fail()` message: `seed failed: <msg>; WARNING: <N> file(s) could not be reverted -- run 'git checkout course/courses/<slug>' to restore`. The user must know the disk is dirty. Also log the revert failures with context (the file path) -- right now they vanish.

### MAJOR: `deleteCourse` nukes the YAML directory before the DB delete can be validated

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:270-298`
- **Problem**: The action does `rmSync(dir, { recursive: true, force: true })` first, then `deleteCourseRow(course.id)`. The `goal_course.course_id` FK is `ON DELETE RESTRICT`, so a course referenced by any goal rejects the delete. By that point the YAML directory is already gone. The error message tells the user to "Restore the YAML directory with git if you cancel," which is a manual recovery step shoved onto the user for a condition (course-in-use) that is fully knowable *before* destroying anything. The code comment acknowledges "Restore-by-recreating-files isn't realistic at this point" -- that is an admission the ordering is wrong, not a justification.
- **Fix**: Check for blocking `goal_course` rows before the `rmSync`. Add a BC helper (`countGoalsReferencingCourse(courseId, db)`) or query `goalCourse` by `courseId` (the `goal_course_by_course_idx` index already exists for exactly this reverse lookup). If any exist, `return fail(400, ...)` with "course is in use by N goal(s); remove it from those goals first" and leave the directory intact. Only `rmSync` + `deleteCourseRow` once the path is clear.

### MAJOR: Raw Postgres error text leaks to the form on the goal-course write path

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:387` (`addCourse`), and the same exposure surface in `removeCourse:404` / `setCourseWeight:422-426`
- **Problem**: `addCourse` validates course-exists, course-active, and not-already-in-goal, then does a bare `db.insert(goalCourse).values(...)` with no try/catch. The `weight` value comes from `clampWeight`, which clamps to the schema range, so the `goal_course_weight_check` will not fire -- but the composite PK `(goalId, courseId)` *can* still collide if two requests race between the `existing[0]` check and the insert (TOCTOU). A racing duplicate insert throws a raw Postgres unique-violation error, which is not caught here, so SvelteKit renders a 500 with the driver's error text. The "Course already in goal" friendly message is only reachable on the non-racing path. The checklist item "error messages user-facing (not raw DB errors)" is violated under concurrency.
- **Fix**: Wrap the insert in try/catch and map the unique-violation to the same `fail(400, { intent: 'addCourse', error: 'Course already in goal.' })`. Better: drop the pre-check `select` entirely and use `db.insert(goalCourse).values(...).onConflictDoNothing().returning()` -- if `returning()` is empty, the row already existed, return the friendly fail. That collapses the TOCTOU window and the round trip into one idempotent statement, matching the upsert idioms already used in `courses.ts`.

### MAJOR: Goal composer queries the `goalCourse` table directly instead of going through the BC

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:144` (loader), `379-387` (`addCourse`), `404` (`removeCourse`), `422-426` (`setCourseWeight`)
- **Problem**: Every other relationship on this page (`goal_syllabus`, `goal_node`) is mutated through BC functions (`addGoalSyllabus`, `removeGoalSyllabus`, `setGoalSyllabusWeight`, `addGoalNode`, etc.) that own the validation and the actor-scoping. The course tab breaks that pattern: the loader and all three course actions reach into `db.select()/insert()/delete()/update()` against the `goalCourse` table inline. The backend checklist explicitly calls this out ("Do server files call BC lib functions, not query the DB directly?"). The consequence is real: the duplicate-detection logic, the weight clamp, the "not in goal" check, and the ownership ordering are now duplicated in a route file instead of living in the BC, so the next consumer of `goal_course` (the cross-course mastery dashboard named in OUT-OF-SCOPE.md) will either re-implement them or diverge. The design.md API surface even sketched `addCourse` with an inline `db.select()` -- but design.md is not a license to skip the BC layer that the rest of the file uses.
- **Fix**: Add `addGoalCourse(goalId, userId, { courseId, weight })`, `removeGoalCourse(goalId, userId, courseId)`, `setGoalCourseWeight(goalId, userId, courseId, weight)`, and `getGoalCourseLinks(goalId, db)` to `libs/bc/study/src/goals.ts` (next to the syllabus equivalents), each doing the ownership check + the validation + the write. The route actions become the thin parse-input -> call-BC -> return-response wrappers the rest of the file already is. This also fixes the MAJOR above for free, since the conflict handling moves into one BC function.

### MINOR: `addCourse` returns instead of redirecting, inconsistent with sibling mutation actions

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:388` (also `removeCourse:405`, `setCourseWeight:430`)
- **Problem**: The three course actions `return { intent, success: true }`. The `update` / `archive` actions on the same page `throw redirect(303, ...)`. `addSyllabus` / `removeSyllabus` / `addNode` etc. also return rather than redirect, so the course actions are consistent with *those* -- but the spec says "All three actions return to the goal page with a banner per the existing pattern," and the existing add/remove pattern leaves the page on a non-redirected POST result. That is acceptable, but note `addCourse` does no post-success redirect while the hangar `createCourse` does (`throw redirect(303, ROUTES.HANGAR_COURSE(slug))`). The inconsistency is within tolerance; flagging because a POST that returns 200 with action data is not refresh-safe (re-submitting the form re-POSTs). Spec compliance is met; idempotency is not.
- **Fix**: Either keep the current return shape (matches `addSyllabus`) -- acceptable -- or move all goal-composer add/remove actions to `throw redirect(303, ROUTES.PROGRAM_GOAL(id))` for PRG (post-redirect-get) safety. Do not change `addCourse` alone; converge the whole tab set. Recommend the redirect form.

### MINOR: Section editor `addStep` / `updateStep` build a `CourseStep` that loses the `level` discriminator

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts:187-193` (`addStep`), `216-222` (`updateStep`)
- **Problem**: `found.section.steps` is `CourseTreeNode[]` (a `CourseStep | CourseLesson` union). `addStep` appends a `CourseStep` literal with no `level` field, and `updateStep` replaces `newSteps[idx]` with a `CourseStep` literal. `updateStep` correctly guards the index lookup against lessons (`s.level !== COURSE_STEP_LEVELS.LESSON`), but if an author hand-edited the YAML so a leaf step carried an explicit `level: 'step'`, the rebuilt object drops it. That is harmless for round-trip (the emitter omits `level` on steps by design) but means the in-memory `CourseSection` passed to `saveSection` is not a faithful copy of what was parsed. More importantly, `addStep` does not validate that `stepInput.code` is unique *course-wide* -- only section-wide (`found.section.steps.some(...)`). The seed pipeline catches the course-wide collision, but the comment at line 181 says "Course-wide duplicate-code check fires inside the seed pipeline" -- so a cross-section duplicate produces a `seed failed: ...` error after the YAML was already written and reverted, rather than a clean pre-write `fail()`. Functional, but the friendlier message the spec asks for ("unique within the course") is not delivered for cross-section collisions.
- **Fix**: Acceptable to defer to the seed for cross-section collisions (the revert protects integrity), but the error message will read `seed failed: ...` rather than a clean field error. If a cleaner message is wanted, scan all section files for the code before `saveSection`. At minimum, document that cross-section duplicates surface as seed errors so the test plan's CRE expectations are not surprised.

### MINOR: `runCourseSeed` is invoked per-save but the seed walks and re-validates every section file

- **File**: `apps/hangar/src/lib/server/course-seed.ts:48-51`, `scripts/db/seed-courses.ts:110-137`
- **Problem**: `runCourseSeed(slug)` calls `seedCourses({ coursesDir, slug })`, which filters to one slug -- good. But the seed has no transaction wrapper: `seedOneCourse` upserts the course row, then upserts each section/step row in a loop (`seedOneSection`), each as its own statement. If the process dies mid-loop (or a later section trips a DB-level CHECK the YAML schema did not catch), the course row and the earlier sections are already committed while the later ones are not. The hangar editor's revert restores the YAML, but the DB is left half-seeded -- the next save re-seeds and converges, but between the two the reader surfaces a partial course. The spec's write-flow invariant ("every successful save lands the exact same state in both") holds for *successful* saves; a save that fails *after* partial DB writes leaves divergence the revert cannot undo.
- **Fix**: Wrap `seedOneCourse`'s upsert loop in `db.transaction(...)` so a course's section/step writes are all-or-nothing. This is a `scripts/db/seed-courses.ts` change, slightly outside the named CRE file set, but the CRE editor is now a production write path (not just a CLI), so the transaction boundary matters. The orphan-detection `process.stdout.write` can stay outside the transaction (it is a read + log).

### MINOR: `cleanupOrphans` deletes orphan rows in a non-transactional loop with no failure handling

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:300-326`
- **Problem**: The action re-detects orphans, then `for (const row of orphanRows) await deleteCourseStep(row.id)`. Each delete is its own statement. If delete #3 of 5 throws (e.g. a FK from a future table, or a connection blip), rows 1-2 are gone, 3-5 remain, and the thrown error escapes the action uncaught -> SvelteKit 500 with raw error text. The returned `removed` count is also never reached on partial failure, so the UI cannot report "removed 2 of 5."
- **Fix**: Wrap the deletes in `db.transaction(...)` so orphan cleanup is atomic, and catch any error to return `fail(400, { intent: 'cleanupOrphans', error: '...' })` with a user-facing message instead of a 500.

### MINOR: Step-reader loader runs the lens twice-worth of work; `allSteps` fetched alongside a lens that already walks the tree

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:202-226`
- **Problem**: The loader fetches `getCourseStepsByCourse(course.id)` in the `Promise.all`, then *separately* awaits a `courseLens` / `courseWithCertOverlayLens` call (line 217-226) which internally also reads the course tree to build `lensResult.tree` and `lensResult.leaves`. The lens result already carries the full tree; the loader then rebuilds `rowById` from `allSteps` and re-derives children/breadcrumbs from the raw rows. Two reads of the same course tree per render. The detail page (`[slug]/+page.server.ts`) has the same shape (`getCourseStepsByCourse` + lens in one `Promise.all`) but at least parallelizes them. The step reader awaits the lens *after* the `Promise.all` resolves, so the lens read is fully sequential after the tree read.
- **Fix**: Move the lens call into the `Promise.all` alongside `getCourseStepsByCourse` so the two reads overlap. Longer term, decide whether the loader needs `allSteps` at all: `lensResult.tree` plus the `stepCodeById`-style join could supply breadcrumbs/children without a second query. At minimum, parallelize.

### MINOR: `getCourseGaps` ignores its `_goalId` parameter -- dead parameter on a public BC function

- **File**: `libs/bc/study/src/courses.ts:266-271`
- **Problem**: `getCourseGaps(_goalId, courseId, syllabusId, db)` takes `_goalId` but the JSDoc states the calculation is goal-agnostic and the parameter is "reserved for future per-goal weighting." A reserved-but-unused leading parameter on an exported function forces every caller to pass a value that does nothing, and the underscore prefix signals "intentionally unused" which is at odds with "public API." The project rule "No undecided considerations for future work" applies: either the goal-weighting feature is planned (write the WP) or the parameter should be dropped now.
- **Fix**: Drop `_goalId` from the signature and update the call sites in `lenses-course.ts`. If goal-aware weighting is genuinely coming, that is a future signature change anyway (its shape is unknown today), so carrying a placeholder buys nothing. Removing it now is the honest API.

### MINOR: `previewBody` truncation can split a multi-byte grapheme / markdown token

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:137-144`
- **Problem**: `previewBody` slices `body_md` at a 200-char boundary then backs up to the last space. It operates on `body_md` (raw markdown), so a cut can land inside a markdown construct -- mid-`[link](url)`, mid-`**bold**`, mid-code-fence -- producing a preview that renders broken markup on the landing page. It also slices by UTF-16 code unit, so an astral-plane character (emoji) at the boundary can be split into a lone surrogate.
- **Fix**: For the broken-markdown risk, strip markdown to plain text before truncating (a `stripMarkdown` util, or render-then-textContent) -- the landing preview is meant to be a teaser, not live markdown. For the surrogate risk, use `Array.from(trimmed)` to slice by code point. The landing UI is non-critical, hence MINOR, but a broken `[` in a preview looks like a bug.

### NIT: `EMPTY_ROLLUP` is a module-level mutable object exported-shaped but shared by reference

- **File**: `apps/study/src/routes/(app)/courses/+page.server.ts:42-49`
- **Problem**: `EMPTY_ROLLUP` is a single frozen-in-intent but not actually frozen object, assigned by reference to every non-in-goal row (`rollupByCourseId.get(course.id) ?? EMPTY_ROLLUP`). If any downstream code mutates a row's `rollup` (e.g. a future page-side accumulation), every row sharing `EMPTY_ROLLUP` mutates together. The serialization boundary copies it, so today it is harmless, but it is a latent aliasing trap.
- **Fix**: `Object.freeze(EMPTY_ROLLUP)` to make the shared-reference intent explicit and fail-fast on accidental mutation, or return a fresh literal per row.

### NIT: Inconsistent 404 idiom -- `throw error(404)` vs the design.md `error(404)` shorthand

- **File**: `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts:67-68`, `[stepCode]/+page.server.ts:191-195`, `apps/hangar/.../[slug]/+page.server.ts:103`
- **Problem**: All CRE loaders use `throw error(404, '...')`, which is correct. Minor inconsistency: the hangar `[slug]` loader uses `throw error(404, 'Course not found.')` while the *actions* in the same file use `return fail(404, { intent, error: 'Course not found.' })`. Mixing `error(404)` (throws an error page) and `fail(404)` (returns to the form) is intentional here -- loaders render a page, actions return to a form -- but `fail(404, ...)` is unusual: `fail` is conventionally for 400/422 validation. A 404 in an action means the resource vanished between page load and submit, which is closer to an error than a validation failure.
- **Fix**: Acceptable as-is (returning to the form with a banner is a reasonable UX for "course deleted under you"), but consider whether a vanished course mid-edit should `throw redirect(303, ROUTES.HANGAR_COURSES)` instead, so the user is not stranded on a dead editor page. Style nit, not a defect.

### NIT: `addSection` derives the filename from the title with no collision-resistant component

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:230-237`
- **Problem**: The section filename is `${code}-${slugified-title}.yaml`. The code prefixes it so two sections with the same title but different codes do not collide, and `existsSync(path)` catches an exact filename repeat. But if an author renames a section's title later (via `updateSection`), the file is rewritten in place at the *old* filename (the section editor's `saveSection` resolves the path from `found.filename`), so the filename and title drift. Cosmetic, since the seed keys on YAML `code` not filename, but a directory of `s1-old-title.yaml` files whose contents say `title: New Title` is confusing for anyone reading the repo.
- **Fix**: Acceptable (filename is not load-bearing). If tidiness matters, `updateSection` could rename the file when the title changes (unlink old, write new) -- but that adds a file op to the revert set. Recommend leaving it and documenting that filenames are first-write-only.

## Spec compliance notes

- All six pages + the goal-composer extension from the spec scope are present and wired.
- The three goal-composer actions (`addCourse`, `removeCourse`, `setCourseWeight`) match the spec's validation table: course-exists, course-active, not-already-in-goal, weight-in-range (via `clampWeight` against `GOAL_SYLLABUS_WEIGHT_MIN/MAX`), course-in-goal for remove/setWeight. One spec deviation: the spec validation table says `setCourseWeight` requires "Course must already be in goal" -- the implementation checks this via `result.length === 0` after the UPDATE, which is correct.
- `pickOverlaySyllabus` implements the deterministic highest-weight + `syllabus_id ASC` tiebreak exactly as spec'd.
- The encoded-text detection compares the node's `id` (the kebab slug, per the schema PK note) against `WX_DECODE_PRODUCT_SLUGS` -- correct, though the spec text said "slug"; the loader comment correctly explains `knowledge_node.id` *is* the slug.
- OUT-OF-SCOPE.md exists and is complete; no out-of-scope work leaked into these files.
- The hangar editor honors YAML-as-source: no direct `course` / `course_step` writes anywhere except `deleteCourseRow` / `deleteCourseStep`, which are the spec-sanctioned orphan-cleanup path.
