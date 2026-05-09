---
title: 'Design: Course Reader and Editor'
product: study
feature: course-reader-and-editor
type: design
status: unread
---

# Design: Course Reader and Editor

Technical decisions and architecture for [spec.md](./spec.md). The spec carries WHAT; this doc carries HOW and WHY.

## YAML-as-source-of-truth: editor wraps the seed pipeline

The single most important decision: the hangar editor reads + writes YAML files in `course/courses/<slug>/`, then invokes `seedCourses()` from [scripts/db/seed-courses.ts](../../../scripts/db/seed-courses.ts). The editor never writes to `study.course` or `study.course_step` directly.

Considered:

1. **Direct DB writes** -- editor writes course rows; seed pipeline becomes a one-time bootstrap.
2. **YAML-source + on-save seed** -- editor writes YAML, runs the seed, surfaces seed errors as form errors.
3. **YAML-source + lazy seed** -- editor writes YAML; seed runs on a schedule or via a manual button.

Picked: 2.

Reasoning: per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) and the project rule "YAML in repo is the single source of truth," course content is a git-versioned artifact. Direct DB writes break this -- the YAML and the DB diverge, and a future re-seed silently overwrites editor changes. Lazy seed has the same divergence risk plus a worse UX (the user can't see whether their save took effect).

The synchronous on-save seed makes the YAML-DB invariant unconditional: every successful save lands the exact same state in both. The seed pipeline is fast (<500ms per course), so synchronous is fine.

The cost: the editor must handle seed failures gracefully. The pipeline rejects on duplicate ordinals, missing knowledge_node refs, etc. The editor's save action catches `CourseSeedError`, reverts the YAML write (in-memory backup), and surfaces the error. Spec.md "Hangar editor: write flow" describes this.

## Two reader entry points (with-overlay vs without): one route, two lens calls

The course detail page picks between `courseLens` and `courseWithCertOverlayLens` at load time, based on whether the learner's goal holds at least one syllabus.

Considered:

1. **One lens call always** -- always run `courseWithCertOverlayLens`, accepting that the `certGaps` array is meaningless when no syllabus is active.
2. **Two routes** -- `/courses/[slug]` (no overlay) and `/courses/[slug]?cert=<id>` (overlay).
3. **One route, conditional lens call at load time** (picked).

Picked: 3.

Reasoning: option 1 wastes a query (gap calculation iterates every cert leaf). Option 2 forces the URL to carry overlay state, which complicates deep-linking and requires the page to handle both shapes. Option 3 keeps the URL clean and lets the loader pick based on goal state.

The overlay-syllabus selection rule (highest-weight `goal_syllabus`, ties broken by `syllabus_id ASC`) is deterministic so the overlay is stable across refreshes. A user-facing picker is deferred per OUT-OF-SCOPE; when it lands, it gets a `?cert=<id>` query param that overrides the auto-pick.

## Step reader: extract the node-body renderer to a shared component

The 7-phase node renderer lives at `apps/study/src/routes/(app)/reference/knowledge/[id]/+page.svelte` (or wherever the existing knowledge detail page renders it). The step page needs the same renderer; this WP extracts it to `apps/study/src/lib/components/KnowledgeNodeBody.svelte` (or equivalent shared location).

Considered:

1. **Copy the renderer** -- duplicate the markdown rendering, the phase scaffolding, the heading style.
2. **Extract the renderer** (picked).
3. **Render via an iframe** -- embed the existing `/reference/knowledge/[id]` page.

Picked: 2.

Reasoning: option 1 invites drift; option 3 is gross and breaks intra-page navigation. Extraction is the right cost-once move. The build phase for this WP includes the extraction as a small refactor before any new pages are built (so the existing `/reference/knowledge` page consumes the shared component too).

## Hangar editor: per-save seed pipeline integration via direct function import

The editor invokes the seed pipeline by importing `seedCourses` from `scripts/db/seed-courses.ts` and calling it programmatically.

Considered:

1. **Spawn a child process** -- `Bun.spawn(['bun', 'scripts/db/seed-courses.ts', '--slug', slug])`.
2. **Import + call directly** (picked).
3. **HTTP call to a seed-runner service** -- overkill for a single-user app.

Picked: 2.

Reasoning: the seed function is already exported from `scripts/db/seed-courses.ts` (line 93). The CLI entry is a thin wrapper around it. Importing directly avoids spawning a Bun subprocess, reuses the existing DB connection pool, and keeps error handling in-process.

The cost: the seed pipeline is part of `scripts/`, not `libs/`. A SvelteKit page importing from `scripts/` is unusual but not forbidden -- the path alias `@ab/db/connection` already crosses the same boundary in the seed script. The build pipeline includes a check that the import works.

If the path-alias check rejects this, the fallback is to move the `seedCourses` function into `libs/bc/study/src/seed-courses.ts` (or `@ab/bc-study/server`) and have the CLI wrapper import it from there. Either path keeps the YAML-as-source rule intact.

## Hangar editor: YAML emission via a small canonical-write helper

Saving a section file requires re-emitting the entire file (since steps are inline). The emission is canonical: keys in stable order (matching the existing fixtures: `code`, `ordinal`, `title`, `body_md`, then `steps`), block-scalar (`|`) for multi-line strings, no quoted scalars unless necessary.

Considered:

1. **Use the `yaml` package's `stringify` directly** -- accepts a JS object, emits YAML.
2. **Hand-roll the emission** -- explicit ordering, explicit scalar styles.
3. **Round-trip through `yaml.parseDocument`** -- preserves comments and ordering on edit.

Picked: 1, with a stable-key-order wrapper.

Reasoning: option 3 is the correct answer for a feature-complete editor (preserving author comments matters), but it's heavier and the project doesn't have authored comments in YAML files yet. Option 2 reinvents serialization. Option 1 plus a key-order wrapper gives canonical output that diffs cleanly against authored fixtures.

The wrapper:

```typescript
export function emitSection(section: CourseSection): string {
  const ordered = {
    code: section.code,
    ordinal: section.ordinal,
    title: section.title,
    body_md: section.body_md,
    steps: section.steps.map(emitStepFields),
  };
  return stringify(ordered, { lineWidth: 0, blockQuote: 'literal' });
}
```

If a future authoring need requires comment preservation, the wrapper switches to `parseDocument` and the emission becomes a per-field setter pattern.

## Knowledge-node picker in the step editor

The step editor needs a picker for `knowledge_node_id`. Today the BC has `getNodesForBrowse` (or similar -- the build phase verifies the exact name) that returns paginated nodes filterable by domain, topic, kind. The picker reuses this.

Considered:

1. **Combobox with live search** -- type-ahead filters against the full node list.
2. **Modal picker** with grouped browse (by domain).
3. **Inline list of recent nodes** -- last 20 used; rest behind a search.

Picked: 1.

Reasoning: with ~50 nodes today and no realistic projection beyond a few hundred, a single combobox with live filter is the simplest. The user (Joshua) knows the slugs already; type-ahead is fast.

The picker shows: slug, title, domain, kind. Selecting populates `knowledge_node_id` on the step form.

## Cert-overlay surface design: chip strip on step reader, panel below tree on detail page

Two distinct overlay surfaces:

- **Step reader**: a small chip strip near the step header. One chip per cert leaf the step satisfies (`PPL ACS V.A.K1: Effects of bank angle`). Click a chip -> link to the corresponding ACS area page. When `inCert: false`, no chip shown.
- **Course detail**: a panel below the tree. Title: "Cert gaps under PPL ACS." Body: the `certGaps` array as a sortable list. Each entry: code, title, required-bloom badge, count of linked nodes. Click an entry -> link to the ACS area page.

The two surfaces serve different questions. The step chip answers "does this step satisfy a cert leaf?" The detail panel answers "what does this course leave uncovered?"

Both use the same overlay lens output; no extra queries.

## Encoded-text family rendering: constant-driven, content-orthogonal

The `WX_DECODE_PRODUCT_SLUGS` constant lives in `libs/constants/src/study.ts` (next to `KNOWLEDGE_NODE_KINDS`). The step reader checks the linked node's slug against this array; if matched, renders the tab strip.

Considered:

1. **Constant-based slug match** (picked).
2. **Frontmatter field on the node** (`encoded_text_family: true` or similar).
3. **Tag-based match** -- nodes carry a `tags` array; check for `'encoded-text'`.

Picked: 1.

Reasoning: with three nodes in the family today and a small expected growth (TAF, ATIS, charts), a constant is the lowest-overhead expression. Adding a slug = one-line constants change. Option 2 requires touching every node frontmatter and a schema migration. Option 3 requires authoring discipline that can drift.

When the family grows past ~10-15 members, the constant becomes a liability and we migrate to option 2. That's a follow-on, not a blocker.

## Goal composer: extend, don't rewrite

The existing `/program/goals/[id]/+page.server.ts` (310 lines, 10 form actions) is the canonical pattern. This WP adds 3 actions (`addCourse`, `removeCourse`, `setCourseWeight`) following the existing shapes. The page svelte gains one more tab.

Considered:

1. **Refactor goal composer to a tab framework** -- abstract Syllabi / Ad-hoc / Courses into a generic tab pattern.
2. **Add the new actions inline** (picked).
3. **Move course composition to a separate route** -- `/program/goals/[id]/courses`.

Picked: 2.

Reasoning: the existing pattern is repetitive but clear (each action is ~15-20 lines, each tab is independent). Refactoring before there are 4+ tab kinds is premature abstraction. A separate route doubles the loader work and out-of-step with the existing pattern.

## Schema

No schema changes. This WP consumes the shipped course-primitive schema (`course`, `course_step`, `goal_course`, `knowledge_node.kind`).

## API surface

### Study reader

```typescript
// apps/study/src/routes/(app)/courses/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  const { primaryGoal } = await getPrimaryGoal(user.id);
  const courses = await listCoursesForReader(db, { statusIn: ['active', 'archived'] });
  const goalCourses = primaryGoal ? await getCoursesByGoal(primaryGoal.id, db) : [];
  // Per-course mastery rollup is computed lazily -- see design "lazy mastery" below.
  return { courses, goalCourseSet: new Set(goalCourses.map(c => c.id)) };
};
```

```typescript
// apps/study/src/routes/(app)/courses/[slug]/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  const course = await getCourseBySlug(event.params.slug, db);
  if (!course || course.status === COURSE_STATUSES.DRAFT) error(404);

  const { primaryGoal } = await getPrimaryGoal(user.id);
  const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal, db);

  const lensInput = { goal: primaryGoal, filters: { courseId: course.id } };
  const lensResult = overlaySyllabusId
    ? await courseWithCertOverlayLens(db, user.id, { ...lensInput, filters: { courseId: course.id, syllabusId: overlaySyllabusId } })
    : await courseLens(db, user.id, lensInput);

  return { course, lensResult, overlayActive: overlaySyllabusId !== null };
};
```

```typescript
// apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  const course = await getCourseBySlug(event.params.slug, db);
  if (!course || course.status === COURSE_STATUSES.DRAFT) error(404);

  const step = await getCourseStepByCode(course.id, event.params.stepCode, db);
  if (!step || step.level !== COURSE_STEP_LEVELS.STEP) error(404);

  const node = step.knowledgeNodeId
    ? await getKnowledgeNodeById(step.knowledgeNodeId, db)
    : null;

  // Same overlay logic as the detail page; surfaces the chip strip + the section-scoped gap list.
  const { primaryGoal } = await getPrimaryGoal(user.id);
  const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal, db);
  const lensResult = overlaySyllabusId
    ? await courseWithCertOverlayLens(db, user.id, { goal: primaryGoal, filters: { courseId: course.id, syllabusId: overlaySyllabusId } })
    : null; // step reader doesn't need lens output when no overlay -- mastery comes from getNodeEvidenceStateMap directly

  const isEncodedText = node !== null && WX_DECODE_PRODUCT_SLUGS.includes(node.slug as typeof WX_DECODE_PRODUCT_SLUGS[number]);
  const isTransition = node?.kind === KNOWLEDGE_NODE_KINDS.TRANSITION;

  return { course, step, node, lensResult, overlayActive: overlaySyllabusId !== null, isEncodedText, isTransition };
};
```

### Goal composer extension

```typescript
// apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts
// Existing actions unchanged. Add three:
addCourse: async (event) => {
  const user = requireAuth(event);
  const goal = await loadGoalForUser(event.params.id, user.id);
  const form = await event.request.formData();
  const courseId = String(form.get('courseId') ?? '');
  const weight = clampWeight(String(form.get('weight') ?? '1.0'));
  // validate course exists + active
  const course = await getCourseById(courseId, db);
  if (!course) return fail(400, { intent: 'addCourse', error: 'Course not found.' });
  if (course.status !== COURSE_STATUSES.ACTIVE) return fail(400, { intent: 'addCourse', error: 'Course is not active.' });
  // validate not already in goal
  const existing = await db.select().from(goalCourse).where(and(eq(goalCourse.goalId, goal.id), eq(goalCourse.courseId, courseId))).limit(1);
  if (existing[0]) return fail(400, { intent: 'addCourse', error: 'Course already in goal.' });
  await db.insert(goalCourse).values({ goalId: goal.id, courseId, weight });
  return { intent: 'addCourse', ok: true };
},
removeCourse: async (event) => { /* mirrors removeSyllabus */ },
setCourseWeight: async (event) => { /* mirrors setSyllabusWeight */ },
```

### Hangar editor

```typescript
// apps/hangar/src/routes/(app)/courses/+page.server.ts
export const load: PageServerLoad = async (event) => {
  requireRole(event, ['AUTHOR', 'OPERATOR', 'ADMIN']);
  const courses = await listAllCourses(db); // every course, every status
  return { courses };
};
```

```typescript
// apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts
export const load: PageServerLoad = async (event) => {
  requireRole(event, ['AUTHOR', 'OPERATOR', 'ADMIN']);
  const course = await getCourseBySlug(event.params.slug, db);
  if (!course) error(404);
  const sections = await getCourseStepsByCourse(course.id, db);
  return { course, sections: sections.filter(s => s.level === COURSE_STEP_LEVELS.SECTION) };
};

export const actions: Actions = {
  updateManifest: async (event) => {
    requireRole(event, ['AUTHOR', 'OPERATOR', 'ADMIN']);
    const form = await event.request.formData();
    const slug = event.params.slug;
    const manifestPath = resolve('course/courses', slug, 'manifest.yaml');
    const backup = await readFile(manifestPath, 'utf8');
    try {
      const next = { slug, kind: 'instructor', title: form.get('title'), description: form.get('description'), status: form.get('status') };
      await writeFile(manifestPath, emitManifest(next));
      const summary = await seedCourses({ slug });
      return { intent: 'updateManifest', ok: true, summary };
    } catch (err) {
      await writeFile(manifestPath, backup); // revert
      return fail(400, { intent: 'updateManifest', error: (err as Error).message });
    }
  },
  // addSection / updateSection / deleteSection / reorderSections / deleteCourse follow the same pattern
};
```

### BC additions

```typescript
// libs/bc/study/src/courses.ts
// Existing functions unchanged. Add:

export interface ListCoursesForReaderOpts {
  statusIn?: CourseStatus[];
}
export async function listCoursesForReader(db: Db, opts: ListCoursesForReaderOpts = {}): Promise<CourseRow[]>;

export async function listAllCourses(db: Db): Promise<CourseRow[]>;

export async function getCourseStepByCode(courseId: string, code: string, db: Db): Promise<CourseStepRow | null>;

export async function getCourseById(id: string, db: Db): Promise<CourseRow | null>;

export async function deleteCourseStep(id: string, db: Db): Promise<void>;
// Used by the orphan-cleanup action; restricted by FK so an in-use step rejects.

export async function deleteCourseRow(id: string, db: Db): Promise<void>;
// Used by the orphan-cleanup action; cascades to course_step.

export async function pickOverlaySyllabus(goal: GoalRow | null, db: Db): Promise<string | null>;
// Returns the highest-weight goal_syllabus.syllabus_id, ties broken by syllabus_id ASC. Null if no goal or no syllabi.
```

The BC re-exports the new functions from `@ab/bc-study/server` (they all touch the postgres driver via `db` argument).

## Component structure

Reader components (`apps/study/src/lib/components/`):

- `CoursesIndexList.svelte` -- the index page list
- `CourseTree.svelte` -- the course detail tree (course -> sections -> step leaves)
- `CourseStepFraming.svelte` -- the step body_md rendering with breadcrumb + title
- `KnowledgeNodeBody.svelte` -- the 7-phase node renderer (extracted from the existing knowledge detail page)
- `CourseStepChart.svelte` -- the placeholder chart stub
- `CertOverlayChips.svelte` -- the per-step chip strip
- `CertGapsPanel.svelte` -- the bottom-of-tree gap panel
- `EncodedTextLadderTabs.svelte` -- the Decode/Understand/Triage tab strip
- `TransitionStepBody.svelte` -- the bridge-styled body for transition nodes

Editor components (`apps/hangar/src/lib/components/`):

- `CoursesAdminList.svelte` -- the index page list
- `CourseManifestForm.svelte` -- the manifest editor
- `SectionList.svelte` -- the ordered section list
- `SectionForm.svelte` -- the section editor
- `StepList.svelte` -- the inline step list inside a section
- `StepForm.svelte` -- the step editor
- `KnowledgeNodePicker.svelte` -- the combobox for knowledge_node_id
- `OrphanCleanupActions.svelte` -- the orphan-cleanup UI

Goal composer extension (`apps/study/src/lib/components/`):

- `GoalCoursesTab.svelte` -- the new tab content (added inside the existing `/program/goals/[id]/+page.svelte`)

Names are illustrative; the build phase finalizes them against the existing project conventions.

## Data flow

```text
+--------------+     load    +---------------+     query     +-----------+
| /courses     | ----------> | +page.server  | ------------> | BC reads  |
| index page   |             | (loader)      |               | (courses) |
+--------------+             +---------------+               +-----------+

+----------------+   load   +---------------+   lens call   +------------+
| /courses/slug  | -------> | +page.server  | ------------> | courseLens |
| detail page    |          |               |               | or overlay |
+----------------+          +---------------+               +------------+

+-----------------------+ load +---------+ +---------------+ +-----------+
| /courses/slug/stepCode|----->| step    | | knowledge node | | overlay  |
| step reader page      |      | row     | | row + body     | | (if goal) |
+-----------------------+      +---------+ +---------------+ +-----------+

+------------------------+
| Hangar editor save     |
+------------------------+
   1. read backup of YAML file
   2. emit canonical YAML for new state
   3. fs.writeFile (atomic)
   4. seedCourses({ slug })
   5a. on success: return summary, render banner
   5b. on failure: fs.writeFile(backup), return error, render error banner
```

## Key decisions

| Decision                                                        | Why                                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| YAML-as-source-of-truth; editor wraps seed pipeline             | Per ADR 018 + project rule; direct DB writes break git-versioning of authored content.                                                          |
| One detail-page route, lens picked at load time                 | Keeps URL clean; deterministic overlay; defers the picker UX until 2+ syllabi in goal.                                                          |
| Extract KnowledgeNodeBody to shared component                   | Step reader and reference page both need it; copy-paste invites drift.                                                                          |
| Hangar editor imports seedCourses() directly                    | Avoids subprocess spawn; reuses connection pool; in-process error handling.                                                                     |
| Canonical YAML emission via stable key-order wrapper            | Diffs cleanly against authored fixtures; comment preservation deferred until needed.                                                            |
| Knowledge-node picker = single combobox with live filter        | ~50 nodes today, growth bounded; complex pickers are speculative UX.                                                                            |
| Encoded-text family is constant-driven                          | Three nodes today; constants array is the lowest-overhead expression. Migrates to frontmatter when family grows past ~10-15.                    |
| Goal composer: extend with three actions, don't refactor        | Existing pattern is repetitive but clear; refactoring before 4+ tab kinds is premature.                                                         |
| Cert-overlay: chip on step + panel on detail (two distinct UIs) | The chip answers "does this step satisfy?"; the panel answers "what does this course leave uncovered?"                                          |
| Chart stub = component now, real rendering is a follow-on WP    | Decouples chart work from surface work; surface ships standalone-useful even with placeholders.                                                 |
| Drag-and-drop reorder deferred                                  | Number-input ordinals are sufficient at this scale; sortable lib + a11y is its own scope.                                                       |
| Transition-step rendering replaces 7-phase scaffold             | A bridge node has no Discover / Practice / Verify content authored anyway; the scaffolding would render empty.                                  |
| Orphan-cleanup is explicit (not automatic on YAML delete)       | YAML deletion -> seed pipeline reports orphans but does not delete. The cleanup is a separate, labeled action so the user opts into the DELETE. |
