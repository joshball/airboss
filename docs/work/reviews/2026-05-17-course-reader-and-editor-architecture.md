---
feature: course-reader-and-editor
category: architecture
date: 2026-05-17
branch: main
issues_found: 9
critical: 0
major: 3
minor: 4
nit: 2
---

## Summary

The CRE feature is architecturally sound in its core decisions: the BC barrel split is clean (every new course helper is value-exported only from `@ab/bc-study/server`, types only from the runtime barrel), the dual-surface design correctly puts both study reader and hangar editor on the same `courses.ts` BC layer, and the YAML-as-source editor wraps the seed pipeline as design.md specifies. Three major issues stand out: the goal composer reaches past the BC into the `goal_course` table directly from the app shell (a real boundary violation), the hangar app imports a SvelteKit page-server module from `scripts/` rather than a lib, and breadcrumb/preview/rollup domain logic is implemented inline in app loaders instead of the BC. The remaining findings are module-placement and duplication nits.

## Issues

### MAJOR: Goal composer reaches past the BC into the `goal_course` table from the app shell

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:144`, `:379-387`, `:404`, `:422-426`
- **Problem**: All three new course actions (`addCourse`, `removeCourse`, `setCourseWeight`) plus the loader perform raw Drizzle queries against the `goalCourse` table directly inside the app route file: `db.select().from(goalCourse)...`, `db.insert(goalCourse).values(...)`, `db.delete(goalCourse).where(...)`, `db.update(goalCourse).set(...)`. The app shell is constructing query builders and owning a domain write path. Every other goal mutation on this same page (`addGoalSyllabus`, `removeGoalSyllabus`, `setGoalSyllabusWeight`, `addGoalNode`, etc.) goes through a BC function in `@ab/bc-study/server` -- the course actions are the only ones that bypass it. The spec ("design.md -> API surface -> Goal composer extension") even shows the inline `db.insert(goalCourse)` shape, but that contradicts the project rule that domain logic and DB access live in the BC, not the app.
- **Rule**: CLAUDE.md "Business Logic Placement" / architecture checklist: "Apps should be thin shells: routes, form actions, data loading, layout assembly ONLY. Are there query builders, data transformations, or domain rules in `+page.server.ts` that belong in a domain library?" The `courses.ts` BC already owns `getCoursesByGoal` -- the goal_course write path belongs next to it.
- **Fix**: Add `addCourseToGoal(goalId, courseId, weight, db)`, `removeCourseFromGoal(goalId, courseId, db)`, `setGoalCourseWeight(goalId, courseId, weight, db)`, and a `getGoalCourseLinks(goalId, db)` (or extend `getCoursesByGoal` to return the weight) to `libs/bc/study/src/courses.ts` (or `goals.ts`, matching where `addGoalSyllabus` lives). Have the actions call those. The "course already in goal" / "course not in goal" checks move into the BC functions alongside the existing duplicate-detection pattern in the syllabus helpers. Remove the `goalCourse` table import and the `and`/`eq` drizzle imports from the route file.

### MAJOR: Hangar app imports a SvelteKit server module from `scripts/` via a synthetic path alias

- **File**: `apps/hangar/src/lib/server/course-seed.ts:25`, `apps/hangar/svelte.config.js:94`
- **Problem**: `course-seed.ts` imports `seedCourses` / `CourseSeedError` / `SeedCoursesSummary` from `@ab/seed-courses`, which `svelte.config.js` aliases to `../../scripts/db/seed-courses.ts`. `scripts/` is the CLI-dispatcher tier, not a lib. A SvelteKit app importing application-runtime code out of `scripts/` inverts the dependency direction (apps depend on libs, not on scripts; scripts are themselves consumers of libs). design.md acknowledged this is "unusual but not forbidden" and named the fallback explicitly: "the fallback is to move the `seedCourses` function into `libs/bc/study/src/seed-courses.ts`." The svelte.config.js comment also pre-declares the intended move. The fallback should have been taken in this WP, not deferred -- the seed pipeline is now a load-bearing runtime dependency of a user-facing app, not a one-off CLI.
- **Rule**: Architecture checklist "Dependency Direction" -- dependencies flow constants -> types -> business logic -> apps; `scripts/` is not a layer apps may depend on. CLAUDE.md "Module Organization" -- "Is new code in the right lib?"
- **Fix**: Move the `seedCourses` function, `CourseSeedError`, `SeedCoursesSummary`, `validateCourseTree`, and the tree-walk helpers into `libs/bc/study/src/seed-courses.ts`, value-export them from `@ab/bc-study/server` (and `@ab/bc-study/build` if the seeders' upserts should stay build-tier). Reduce `scripts/db/seed-courses.ts` to a thin CLI wrapper that imports from the lib. Delete the `@ab/seed-courses` alias from `svelte.config.js`. `apps/hangar/src/lib/server/course-seed.ts` then imports from `@ab/bc-study/server` like every other server module.

### MAJOR: Domain logic (breadcrumb walk, body preview, prev/next mapping, empty-rollup) lives in app loaders instead of the BC

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts:137-186` (`previewBody`, `buildBreadcrumbs`, `computePrevNext`), `apps/study/src/routes/(app)/courses/+page.server.ts:42-49` (`EMPTY_ROLLUP`)
- **Problem**: The step reader loader carries three pure domain transformations: `buildBreadcrumbs` (parent-chain walk with a cycle guard over `CourseStepRow`), `previewBody` (body_md truncation at a word boundary, with a `BODY_PREVIEW_MAX` constant), and `computePrevNext` (maps the lens-pure `computePrevNextLeaves` result back onto step codes). These operate purely on course-tree row shapes and are exactly the kind of reusable tree logic the BC already hosts -- `flattenLeavesDepthFirst` / `computePrevNextLeaves` live in `libs/bc/study/src/lens-tree-walk.ts` precisely so they are browser-safe and shared. `buildBreadcrumbs` and `previewBody` are the same category of pure helper but were left in the app. The course index loader separately hand-declares `EMPTY_ROLLUP` as a literal `MasteryRollup` -- a domain default that belongs with the `MasteryRollup` type / `computeMasteryRollup` in the BC.
- **Rule**: Architecture checklist "Business Logic Placement" -- pure domain transformations belong in shared libs; "Shared vs. App-Specific" -- a second consumer (the course detail page already renders the same tree) makes these shared. The BC's own `lens-tree-walk.ts` is the established home.
- **Fix**: Move `buildBreadcrumbs` and `computePrevNext`'s code-mapping into `lens-tree-walk.ts` (browser-safe, no DB) as e.g. `buildAncestorChain(rowId, rows)` and a `mapLeavesToCodes` helper. Move `previewBody` + `BODY_PREVIEW_MAX` into a BC pure-helper module (or `@ab/utils` if it is generic text truncation). Export a `EMPTY_MASTERY_ROLLUP` constant from the BC next to `MasteryRollup` and import it in the index loader.

### MINOR: `COURSE_SLUG_REGEX` is a magic literal duplicated in the app, not a constant

- **File**: `apps/hangar/src/routes/(app)/courses/+page.server.ts:67`
- **Problem**: `const COURSE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;` is declared inline in the route file and the same shape (`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`) is also hard-coded into the user-facing error string on line 81. The seed pipeline validates the same slug shape (`scripts/db/seed-courses.ts:475` "course slug ... fails kebab-case shape"). spec.md's Validation table explicitly calls this "the existing course slug regex" -- implying it should already be a shared constant. Having the regex live in an app route means the editor's client-side check and the seed validator can drift.
- **Rule**: CLAUDE.md Critical Rules -- "No magic strings. All literal values in `libs/constants/`." Architecture "Is validation logic centralized, not duplicated across apps?"
- **Fix**: Add `COURSE_SLUG_REGEX` (or `COURSE_SLUG_PATTERN`) to `libs/constants/src/study.ts` next to the other course constants, import it in both the hangar route and the seed validator, and build the error message from the constant's `.source`.

### MINOR: `CourseStepChart` placeholder/stub-spec drift -- shipped as a real fetch component, not the spec'd dev/prod stub

- **File**: `apps/study/src/lib/components/CourseStepChart.svelte:16-41`
- **Problem**: spec.md and OUT-OF-SCOPE.md describe `CourseStepChart` as a stub: "a bordered container + the slug visible as text in development; an empty wrapper in production" with real rendering deferred to a follow-on WP. The shipped component instead does a live `<img src="/api/charts/${slug}/chart.svg">` fetch against an `apps/study/src/routes/api/charts/[...slug]/+server.ts` endpoint. That is a real implementation, not a stub. This is not necessarily wrong -- doing the real thing over a stub aligns with the prime directive -- but it is undocumented architectural drift from the WP: the WP's "Real WX chart embedding" out-of-scope entry and CRE-40/CRE-41 test cases (placeholder renders/empty) no longer match the code, and a `/api/charts` route + `data/charts/` disk dependency were introduced without the WP recording them.
- **Rule**: Architecture "Spec Compliance -- does the module structure match the design doc?" CLAUDE.md "No undecided considerations" / WP docs updated with the work.
- **Fix**: Reconcile the WP with reality: update spec.md / OUT-OF-SCOPE.md / test-plan.md (CRE-40, CRE-41) to describe the real chart component and the `/api/charts` route, or note which WP (`wx-charts` / ADR 027) the chart endpoint belongs to and cross-link. The code may be fine; the spec must stop describing a stub that no longer exists.

### MINOR: `course-seed.ts` re-resolves the courses dir with brittle six-level `..` path math

- **File**: `apps/hangar/src/lib/server/course-seed.ts:27-31`
- **Problem**: `REPO_ROOT` is computed as `resolve(HERE, '..', '..', '..', '..', '..', '..')` with a comment counting six segments. This couples the lib file to its exact nesting depth under `apps/hangar/src/lib/server/`. Any move of the file (including the design.md-anticipated move of the seed entry into a lib) silently breaks the path. The hangar app already configures `env: { dir: '../../' }` in `svelte.config.js`, and SvelteKit exposes a project root; `process.cwd()` at dev/build time is the repo root.
- **Rule**: Architecture "Module Organization" / robustness -- module location should not be encoded as a relative-segment count.
- **Fix**: Resolve the courses directory from `process.cwd()` (the repo root in this monorepo's dev/build invocation) or from a single `REPO_ROOT` constant exported by `@ab/constants` alongside the other path config. When the seed function moves into the BC per the MAJOR above, the courses-dir resolution should move with it and stop being a per-app concern.

### MINOR: Orphan-cleanup re-implements section-file parsing already centralised in the seed pipeline

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts:51-63` (`findSectionFile`), `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts:76-97` (`loadSectionsFromDisk`) and `:309-319` (orphan re-scan)
- **Problem**: Three separate route files each walk `course/courses/<slug>/sections/*.yaml`, `readFileSync` + `parse` + `courseSectionSchema.safeParse` to reconstruct the on-disk section set. This is the same directory-walk-and-parse the seed pipeline already does (`scripts/db/seed-courses.ts` section scan). The orphan-detection logic ("rows in DB whose code is not present on disk") is domain logic duplicated across the course editor loader and the `cleanupOrphans` action, each re-deriving the on-disk code set slightly differently (the loader checks section codes only; `cleanupOrphans` also adds inline step codes -- an inconsistency that is itself a latent bug).
- **Rule**: Architecture "Business Logic Placement" -- the YAML-tree read + orphan diff is BC domain logic, not per-route loader code; "Shared vs App-Specific" -- it has three consumers.
- **Fix**: Add a BC helper (`readCourseTreeFromDisk(slug, coursesDir)` and `detectOrphanSteps(courseId, onDiskCodes, db)`) to the course BC / seed lib, returning a typed tree plus the full set of on-disk codes (sections + steps + lessons). All three call sites consume it, eliminating the loader-vs-action divergence.

### NIT: `EMPTY_ROLLUP` / `EMPTY_MASTERY_ROLLUP` naming and the picker-types file placement

- **File**: `apps/study/src/routes/(app)/courses/+page.server.ts:42`, `apps/hangar/src/lib/components/knowledge-node-picker-types.ts`
- **Problem**: Two small placement/naming preferences. (1) `EMPTY_ROLLUP` is a fine local name but once lifted to the BC (see the MAJOR above) it should be `EMPTY_MASTERY_ROLLUP` to match the `MasteryRollup` type. (2) `knowledge-node-picker-types.ts` correctly isolates the `PickerNode` type so the `.svelte` picker does not drag the loader's server imports -- good instinct -- but it sits loose in `apps/hangar/src/lib/components/` next to the component. That is acceptable; a `.types.ts` suffix (`knowledge-node-picker.types.ts`) would make the pairing with `KnowledgeNodePicker.svelte` clearer and matches common conventions elsewhere.
- **Rule**: Architecture "nit: naming or file structure preference within a correctly-placed module."
- **Fix**: Rename on the lift (`EMPTY_MASTERY_ROLLUP`); optionally rename the types file to `knowledge-node-picker.types.ts`. No functional change.

### NIT: `KnowledgeNodeBody` lives in `apps/study` but is a candidate for `libs/ui`

- **File**: `apps/study/src/lib/components/KnowledgeNodeBody.svelte`
- **Problem**: `KnowledgeNodeBody` is the 7-phase node renderer, now shared between `/reference/knowledge/[id]` and the course step reader. spec.md "Resolved decisions" explicitly decided to keep it in `apps/study/src/lib/components/` and "defer the lift to `libs/ui/` until a real second consumer exists." There are now two consumers within `apps/study`, so the decision still holds (both are study-app). This is only a nit and a forward-looking note: the moment the hangar editor or any other app needs a node-body preview, this component (and `CourseStepMarkdown`, `TransitionStepBody`) must move to `libs/ui/`. The decision is correctly recorded; flagging so the trigger is not forgotten.
- **Rule**: Architecture "Component Placement" / "Shared vs App-Specific" -- multi-app components belong in `libs/ui/`; single-app is correctly kept local.
- **Fix**: None required now. When a non-study surface needs the node-body renderer, lift `KnowledgeNodeBody`, `CourseStepMarkdown`, and `TransitionStepBody` to `libs/ui/` together and update the WP's resolved-decision note.
