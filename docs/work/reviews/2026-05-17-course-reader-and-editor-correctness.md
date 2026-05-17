---
feature: course-reader-and-editor
category: correctness
date: 2026-05-17
branch: main
issues_found: 13
critical: 1
major: 4
minor: 5
nit: 3
---

## Summary

The CRE feature set is generally sound: lens selection is deterministic, the BC read helpers are well-guarded against missing rows, the YAML round-trip emitter is correct and tested, and the goal-composer course actions check ownership before mutating. The most serious gap is in the hangar editor's write path: the `createCourse` action does not honour the WP's revert-on-seed-failure invariant, leaving a half-created course directory on disk when the seed rejects. Two other defects break documented spec behaviour (`removeCourse` skips the "course is in goal" validation; the orphan-detection panel only surfaces section-level orphans while leaving orphan step rows invisible). The remaining findings are defensive gaps and minor inconsistencies.

## Issues

### CRITICAL: `createCourse` leaves a half-created course directory on disk when the seed fails

- **File**: apps/hangar/src/routes/(app)/courses/+page.server.ts:91-117
- **Problem**: The action creates the directory, the `sections/` subdir, and `manifest.yaml`, then runs `runCourseSeed`. If the seed throws a `CourseSeedError` (line 110-114) it returns `fail(400, ...)` but never removes the directory it just wrote. The WP write-flow invariant (design.md "5b. on failure: fs.writeFile(backup), return error" and spec.md "Hangar editor: write flow" -- "If the seed throws ... the YAML write is reverted") is violated for the create path. Every other hangar write action (`updateManifest`, `addSection`, `deleteSection` via `runSave`) correctly reverts; `createCourse` is the one that does not.
- **Trigger**: Create a new course whose slug or manifest is valid lexically but trips a seed-pipeline rejection (e.g. a transient DB error, or a manifest field the validator rejects). The form shows `seed failed: ...`, but `course/courses/<slug>/manifest.yaml` now exists on disk. A retry with the same slug then hits the `existsSync(dir)` guard at line 92 and reports "Course directory already exists" -- the user is now wedged and must delete the directory by hand. The orphan directory is also un-git-tracked scratch that pollutes the working tree.
- **Fix**: Wrap the seed call so a failure removes the freshly created directory before returning `fail`:

  ```typescript
  try {
    await runCourseSeed(slug);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true }); // revert the create
    if (err instanceof CourseSeedError) {
      return fail(400, { intent: 'createCourse', error: `seed failed: ${err.message}` });
    }
    throw err;
  }
  ```

  Only remove the directory the action itself created (it was guaranteed absent by the `existsSync` guard above, so an unconditional `rmSync` of `dir` is safe here).

### MAJOR: `removeCourse` does not validate the course is actually in the goal

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:391-406
- **Problem**: spec.md "Goal composer: course tab flow" step 4 states "`removeCourse` action: validates the goal holds the course. Deletes the row." and the Validation table row "Goal composer: removeCourse course_id -> Must exist as a `goal_course` row for this goal". The implementation issues an unconditional `db.delete(...)` and always returns `{ intent: 'removeCourse', success: true }` regardless of whether a row was deleted. The sibling `setCourseWeight` action (lines 422-429) does this correctly -- it uses `.returning()` and returns `fail(400, ...)` when `result.length === 0`. `removeCourse` is inconsistent with both the spec and its sibling.
- **Trigger**: POST `removeCourse` with a `courseId` that is not linked to the goal (stale form, double-submit, or a crafted request). The user sees the success banner "Course removed from goal" though nothing happened. Masks bugs and confuses the operator.
- **Fix**: Use `.returning()` and fail when empty, mirroring `setCourseWeight`:

  ```typescript
  const result = await db
    .delete(goalCourse)
    .where(and(eq(goalCourse.goalId, event.params.id), eq(goalCourse.courseId, courseId)))
    .returning();
  if (result.length === 0) {
    return fail(400, { intent: 'removeCourse', error: 'Course not in goal.' });
  }
  return { intent: 'removeCourse', success: true };
  ```

### MAJOR: orphan-detection panel hides orphan step rows -- only section rows surface

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:110-112
- **Problem**: The `load` orphan list filters `dbSteps` to `row.level === COURSE_STEP_LEVELS.SECTION && !sectionCodesOnDisk.has(row.code)`. It only ever surfaces orphan *section* rows. When a section file is deleted, the section row AND all its inline step rows become orphans in the DB (the seed pipeline reports them but does not delete -- spec.md "Hangar editor: delete flow"). The `cleanupOrphans` action (lines 309-321) correctly re-detects orphans against the full code set (sections + inline steps), so it *will* delete the orphan step rows -- but the UI panel that drives the user to click "remove orphans" never shows them. A user who deletes a section, sees zero orphans (because the section file removal also removed... no: the section row stays orphan too). Actually worse: if a single *step* is removed from a section file (not the whole file), the section file still exists, `sectionCodesOnDisk` still contains the section code, so `load` reports **zero** orphans -- yet an orphan step row exists in the DB. The user has no signal to run cleanup.
- **Trigger**: In the section editor delete one step (or hand-edit a section YAML to drop a step), re-seed. The DB now has an orphan `course_step` leaf row. The course editor page shows "no orphans". The orphan row silently inflates `getCourseGaps` coverage and lens rollups. Note: `deleteStep` in the section editor goes through `runCourseSeed` which the seed pipeline reports-but-does-not-delete, so this is the *normal* path, not an edge case.
- **Fix**: Make `load`'s orphan detection use the same full-code-set logic `cleanupOrphans` already uses -- collect section codes plus every inline step code from each section file, then filter `dbSteps` to any row whose code is absent. Extract the shared detection into one helper so the panel and the cleanup action cannot drift:

  ```typescript
  function detectOrphans(slug: string, dbSteps: CourseStepRow[]): OrphanEntry[] {
    const sections = loadSectionsFromDisk(slug);
    const codes = new Set(sections.map((s) => s.code));
    for (const section of sections) {
      const parsed = courseSectionSchema.safeParse(parse(readFileSync(resolve(sectionsDir(slug), section.filename), 'utf8')));
      if (parsed.success) for (const step of parsed.data.steps) codes.add(step.code);
    }
    return dbSteps.filter((r) => !codes.has(r.code)).map((r) => ({ id: r.id, code: r.code, title: r.title }));
  }
  ```

### MAJOR: `deleteCourse` deletes the YAML directory before the FK check, leaving DB and disk inconsistent on a RESTRICT failure

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:280-296
- **Problem**: The action does `rmSync(dir, ...)` first (line 282), *then* calls `deleteCourseRow` (line 285). `goal_course.course_id` is `ON DELETE RESTRICT` (documented in courses.ts:449-452), so a course referenced by any goal rejects the row delete with a Postgres error. When that happens, the YAML directory is already gone but the `study.course` row (and its `course_step` rows) survive. The course is now un-editable from the hangar (`load` reads sections from disk -- empty -- and the manifest editor's `updateManifest` fails its `existsSync(manifestPath)` guard) yet still live in the study reader and still linked to goals. The error message tells the user to "Restore the YAML directory with git" but the directory may not be git-tracked (a course created via `createCourse` and never committed has no git state to restore).
- **Trigger**: Add a course to any goal via the goal composer, then attempt to delete that course from the hangar editor. The delete fails on the FK, but the YAML is already destroyed.
- **Fix**: Check for blocking `goal_course` references *before* removing the directory, or delete the row first and remove the directory only after the row delete succeeds. Preferred: query `goal_course` for the course id up front and return `fail(400, ...)` if any row exists, leaving the directory intact. If the DB delete is kept first, move `rmSync` to after `deleteCourseRow` returns successfully.

### MINOR: a node that is both a transition and an encoded-text slug renders both treatments

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:60-78 (with +page.server.ts:271-272)
- **Problem**: `isEncodedText` and `isTransition` are computed independently. In the template, `{#if isEncodedText}` mounts `EncodedTextLadderTabs` unconditionally, then a separate `{#if ...}{:else if isTransition}` chooses the body renderer. A node whose `id` is in `WX_DECODE_PRODUCT_SLUGS` *and* whose `kind === 'transition'` renders the Decode/Understand/Triage strip above a bridge-styled body -- two mutually-incoherent treatments. The spec treats these as exclusive rendering modes.
- **Trigger**: Author (or DB-mutate) a knowledge node with `kind='transition'` and an id matching an encoded-text slug. Unlikely in current content but not guarded.
- **Fix**: Make the conditions exclusive -- e.g. only render the ladder tabs when `isEncodedText && !isTransition`, or decide a precedence in the loader and emit a single `renderMode` discriminant instead of two booleans.

### MINOR: step reader runs the full overlay/course lens purely to compute prev/next on every render

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:217-266
- **Problem**: The loader always runs `courseLens` (or `courseWithCertOverlayLens`) -- a full tree walk plus gap calculation -- even when no overlay is active, solely to obtain `lensResult.tree` for `flattenLeavesDepthFirst` and `lensResult.leaves` for the cert chip. design.md's API sketch explicitly anticipated *not* doing this: "step reader doesn't need lens output when no overlay -- mastery comes from getNodeEvidenceStateMap directly". Prev/next only needs the step tree shape, which `getCourseStepsByCourse` (already loaded into `allSteps`) fully provides. This is a correctness-adjacent perf gap: a hot reader page pays a gap-calculation query it does not use.
- **Trigger**: Any step-reader page load for a learner with no syllabus in their goal.
- **Fix**: When `!overlayActive`, derive the leaf list for prev/next from `allSteps` directly (a depth-first walk over the rows by `parentId`/`ordinal`) instead of calling `courseLens`. Reserve the lens call for the overlay path that genuinely needs `certGaps` + `sources.inCert`.

### MINOR: `previewBody` truncation can split a multi-byte grapheme / emit a broken markdown token

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:137-144
- **Problem**: `previewBody` slices `body_md` at a fixed 200-char index then renders the result through `renderMarkdown` in the template (+page.svelte:95). The slice is purely positional: it can cut inside a markdown construct -- e.g. mid-`**bold**`, mid-`[link](url)`, or inside a fenced code block opener -- producing a preview that renders as a stray `**` or an unterminated emphasis run that bleeds into following content. It also slices on UTF-16 code units, so a 200th-character cut inside a surrogate pair (emoji) yields a lone surrogate.
- **Trigger**: A section/lesson child whose `body_md` exceeds 200 chars and has a markdown token straddling the cut point. Cosmetic but visibly broken.
- **Fix**: Either strip markdown to plain text before truncating (a `renderMarkdown` + tag-strip, or a dedicated plain-text extractor), or truncate by rendered text rather than raw markdown. At minimum, slice on grapheme/code-point boundaries (`Array.from(str)`).

### MINOR: courses index `EMPTY_ROLLUP` is a shared mutable object handed to every out-of-goal row

- **File**: apps/study/src/routes/(app)/courses/+page.server.ts:42-49, 88
- **Problem**: `EMPTY_ROLLUP` is a single module-level object referenced by every row that has no per-course rollup (`rollupByCourseId.get(course.id) ?? EMPTY_ROLLUP`). All such `CourseIndexRow.rollup` fields are the *same* object reference. It is only read today (the page never mutates `rollup`), so this is not a live bug -- but it is a fragility: any future code that mutates `row.rollup` (e.g. a normalization pass) would mutate every out-of-goal row at once. `byEvidenceKind: {}` is likewise shared.
- **Trigger**: None today; a latent hazard for future edits.
- **Fix**: Return a fresh object per row -- a `makeEmptyRollup()` factory -- or `structuredClone(EMPTY_ROLLUP)` at the call site. Cheap insurance.

### MINOR: `addSection` does not pre-validate ordinal uniqueness against existing sections

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:213-250
- **Problem**: spec.md Validation table: "Hangar section editor: ordinal -> Integer >= 0; unique within the course's sections." `addSection` validates `ordinalRaw >= 0` and `Number.isFinite`, and checks the *filename* for collision, but never checks whether the chosen ordinal already belongs to another section. A duplicate ordinal is only caught later by the seed validator (then reverted via `runSave`). Functionally the duplicate is rejected, but the error surfaced is a raw `seed failed: ...` message rather than the friendly field-level "Ordinal must be unique" the spec implies, and the section file is written-then-deleted needlessly.
- **Trigger**: Add a section with an ordinal already used by an existing section.
- **Fix**: Load existing sections (`loadSectionsFromDisk`) and return `fail(400, { intent: 'addSection', error: 'Ordinal already used by another section.' })` before writing, mirroring the inner-section duplicate-code check that `addStep` already does (sections/[code]/+page.server.ts:183-185).

### NIT: redundant `primaryGoal !== null` guard after `overlaySyllabusId !== null`

- **File**: apps/study/src/routes/(app)/courses/[slug]/+page.server.ts:74; [stepCode]/+page.server.ts:210, 218
- **Problem**: `pickOverlaySyllabus(goal)` returns `null` whenever `goal === null` (courses.ts:474). So `overlaySyllabusId !== null` already implies `primaryGoal !== null`. The detail loader's ternary at line 74 and the step loader's `overlayActive` (line 210) and lens ternary (line 218) all re-test `primaryGoal !== null`. Harmless, but it obscures the actual invariant and makes a reader wonder whether `pickOverlaySyllabus` can return non-null for a null goal.
- **Trigger**: None -- dead branch.
- **Fix**: Drop the redundant `&& primaryGoal !== null` clauses, or add a one-line comment noting the implication. If TypeScript narrowing of `primaryGoal` is the reason for the extra check, prefer an explicit `if (overlaySyllabusId !== null) { /* primaryGoal is non-null here */ }` guard.

### NIT: `pct` clamps the denominator-zero case but not a value larger than the denominator

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:17-20; [slug]/+page.svelte:48-51
- **Problem**: `pct(num, den)` returns 0 when `den === 0` but otherwise returns `Math.round(num/den*100)` with no upper clamp. If `masteredLeaves` ever exceeds `totalLeaves` (a lens-rollup inconsistency, or an orphan-row inflation as in the MAJOR orphan finding above), `pct` returns >100 and the `mastery-fill` width style becomes e.g. `width: 140%`, overflowing the bar. The `aria-valuenow`/`aria-valuemax` pair would also become incoherent.
- **Trigger**: Any rollup where `masteredLeaves > totalLeaves`. Not expected from a correct lens, but the orphan-step bug makes it reachable.
- **Fix**: Clamp: `return Math.min(100, Math.max(0, Math.round((num / den) * 100)));`

### NIT: `CourseStepChart` / WP "chart stub" language is stale -- component renders a live chart but is unmounted

- **File**: apps/study/src/lib/components/CourseStepChart.svelte (whole file)
- **Problem**: spec.md and design.md describe `<CourseStepChart>` as a placeholder stub ("bordered container with the slug visible in development, empty wrapper in production"). The shipped component is not a stub -- it fetches and renders a real SVG from `/api/charts/<slug>/chart.svg`. That is fine and arguably better than spec, but two things are now true and undocumented: (1) the spec/OUT-OF-SCOPE text is stale and will mislead a future reader; (2) the component is not mounted by any course-content render path -- the `:::chart` markdown-directive parser that would mount it is deferred per OUT-OF-SCOPE, so `CourseStepChart` is currently unreachable dead-ish code reachable only by its own test. test-plan CRE-40/CRE-41 (which assert a placeholder via `?chart=` query param) no longer match the implementation at all.
- **Trigger**: A reader of the WP docs, or anyone running test-plan CRE-40/41.
- **Fix**: Not a code defect. Update spec.md / design.md / OUT-OF-SCOPE.md / test-plan.md to reflect that real chart rendering shipped and the only remaining deferral is the `:::chart` directive parser that mounts the component. Confirm with the WP owner whether the component should stay un-mounted or whether a mount path belongs in this WP's closeout.

## Notes on what is correct (no action needed)

- BC read helpers (`getCourseBySlug`, `getCourseById`, `getCourseStepByCode`, `pickOverlaySyllabus`) all return `null` on miss rather than throwing, and the loaders translate that to a 404 -- consistent and tested.
- `pickOverlaySyllabus` tie-break (`weight DESC, syllabus_id ASC`) is deterministic and unit-tested (courses.test.ts:831-874).
- `getCourseGaps` correctly treats a leaf with zero authored links as a gap, sorts deterministically by `(ordinal, code)`, and short-circuits on an empty/absent syllabus.
- `runSave` (hangar `[slug]` editor) snapshots every target before mutating and reverts all of them on seed failure -- the multi-write revert is correct, including the "did not exist before" -> unlink branch.
- The YAML emitter (`emitManifest`/`emitSection`) round-trips losslessly through the same Zod schema the seed pipeline uses; the lesson-interior recursion preserves nested structure on a leaf-only edit. Round-trip is well-tested.
- `addCourse` checks goal ownership before the existence/active/duplicate validations, matching the `addSyllabus`/`addNode` pattern; `clampWeight` correctly bounds the weight and falls back to 1.0 on a non-finite parse.
- The step reader's encoded-text detection correctly compares against `knowledge_node.id` (the PK *is* the kebab slug) -- the loader comment documents why, even though spec/design said `node.slug`.
