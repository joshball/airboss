---
id: course-reader-and-editor
title: 'Spec: Course Reader and Editor'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-09
owner: agent
depends_on:
  - course-primitive
unblocks: []
tags:
  - course
  - lens
  - hangar
  - study
  - adr-016
---

# Spec: Course Reader and Editor

The dual UI on top of the [course-primitive](../course-primitive/spec.md) WP. A study-app reader (`/courses`, `/courses/[slug]`, `/courses/[slug]/[stepCode]`) renders instructor-authored courses for learners, with cert-overlay surfacing when the learner's goal includes a syllabus. A hangar-app editor (`/courses`, `/courses/[slug]`, `/courses/[slug]/sections/[code]`) lets the instructor compose courses by editing YAML files and re-running the seed pipeline.

The first authored course is the weather-comprehensive course. This WP ships the surfaces; the content authoring is its own follow-on.

Cross-product WP. The `product` field is `study` (the primary consumer) but the spec covers an equal-sized hangar surface.

## Why this WP exists

The course-primitive WP shipped data + lens + YAML pipeline, but no pages. Today a learner cannot see a course in the study app, and an instructor cannot edit a course outside their text editor. The next step in actually using courses is the UX.

Two surfaces, one BC layer:

- **Study reader** -- consumes `courseLens`, `courseWithCertOverlayLens`, `getCoursesByGoal`. Read-only against course data; writes go through the existing goal composer (extending `goal_course`).
- **Hangar editor** -- reads + writes the YAML files under `course/courses/<slug>/`, then triggers `bun run db seed courses`. The DB is downstream of YAML; the editor is a UX over the file system + seed pipeline.

This split honors the project rule that YAML-in-repo is the source of truth for instructor content (per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) reasoning: reviewable, diffable, versioned by git). The editor never writes course rows directly.

## Anchor docs

- [course-primitive/spec.md](../course-primitive/spec.md) -- the foundation this WP consumes
- [course-primitive/design.md](../course-primitive/design.md) -- BC contract + lens shape
- [course-primitive/SMOKE-RESULTS.md](../course-primitive/SMOKE-RESULTS.md) -- what works end-to-end
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md), principle 11 -- the chef and the diner are different people
- [ADR 016 refinement (2026-05-08)](../../decisions/016-cert-syllabus-goal-model/decision.md) -- course as peer primitive
- `libs/bc/study/src/lenses-course.ts` -- the lenses to consume
- `libs/bc/study/src/courses.ts` -- the BC helpers to consume
- `scripts/db/seed-courses.ts` -- the YAML -> DB pipeline the editor triggers
- `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts` -- the goal composer this WP extends
- `apps/hangar/src/routes/(app)/glossary/+page.svelte` -- the hangar editor pattern this WP mirrors

## Scope

In:

- Three study-app pages: `/courses` (index), `/courses/[slug]` (detail), `/courses/[slug]/[stepCode]` (step reader)
- Three hangar-app pages: `/courses` (index), `/courses/[slug]` (course editor), `/courses/[slug]/sections/[code]` (section editor)
- One existing-page extension: `/program/goals/[id]` adds a Courses tab + 3 form actions (`addCourse`, `removeCourse`, `setCourseWeight`)
- One stub component: `<CourseStepChart slug="..." />` -- placeholder for future WX chart embedding
- Two BC read-helpers (if not already present): `listAllCourses(db)` for the editor index; `listCoursesForReader(db, opts)` for the study index with optional status filter
- Hangar BC writes: a small surface that wraps "edit YAML file + trigger seed" as an idempotent unit (filesystem write + child-process spawn or BC call into `seedCourses`)
- Constants: `ROUTES.HANGAR_COURSES`, `ROUTES.HANGAR_COURSE`, `ROUTES.HANGAR_COURSE_SECTION`, plus form-action labels under existing route constants. New `KNOWLEDGE_NODE_KIND_LABELS` already shipped via course-primitive WP -- this WP consumes them
- One encoded-text family rendering hint: when a step's linked node carries `domain: weather` AND its slug matches the encoded-text product set (METAR/TAF/PIREP/AIRMET/SIGMET decoding -- specifically `wx-reading-metars-tafs`, `wx-product-pireps`, `wx-product-airmets-sigmets`), the step reader renders a decode/understand/triage skill-ladder header above the body. Implementation is content-driven (a small lookup table or a node frontmatter field), not a structural change to courses
- One transition-step rendering hint: when the linked `knowledge_node.kind === 'transition'`, the step reader renders a distinct "bridge" treatment (visual divider + "this step connects X and Y" framing prose drawn from the body)
- Manual test plan covering both surfaces

Out:

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Surface summaries

### Study app: `/courses` index

Lists every course with `status IN ('active', 'archived')` (drafts excluded by default). Each row: title, description (clamped to one line), status badge, mastery rollup if the learner's goal has a `goal_course` row pointing at the course (a number plus a small bar: `mastered / total leaves`), an "open" affordance.

Filtering: status (active / archived / all). Sort: title ascending; the "currently in goal" courses pin to the top.

Anonymous browse (no goal) still works: the list renders with empty mastery on every row.

### Study app: `/courses/[slug]` detail

Renders the course tree from `courseLens` if the learner has no goal_course row OR `courseWithCertOverlayLens` if the learner has a goal that holds at least one cert syllabus. The lens picks itself based on the goal:

- No goal, or goal holds no syllabi -> `courseLens`
- Goal holds at least one cert syllabus -> `courseWithCertOverlayLens` against the first goal_syllabus row (sorted by goal_syllabus.weight desc, syllabus_id ascending for stability). Future: a syllabus picker on the page; deferred per OUT-OF-SCOPE

Page sections:

- Header: title, status, description (markdown), mastery rollup at course level (`X of Y mastered`, percentage)
- Per-section: title, body_md preamble, list of step leaves with title + linked node id + per-leaf mastery indicator (`mastered` / `covered` / `unseen`) + cert badge (`In PPL ACS V.A.K1`) when the overlay surfaces it
- "Cert gaps" panel below the tree (only when overlay is active): list of `certGaps` entries with title + code + required bloom + linked-node count, each linking to the appropriate ACS area page in the cert dashboard
- Add-to-goal action: opens a small inline form (or a modal -- see design.md) that POSTs to the existing goal composer's `addCourse` action

### Study app: `/courses/[slug]/[stepCode]` step reader

The page a learner spends most of their reading time on. Three vertical sections:

1. **Step framing** -- title, breadcrumb (course title -> section title), step body_md rendered as Markdown. This is the instructor's pedagogical wrapper around the linked node.
2. **Linked knowledge node** -- the node body rendered with the existing 7-phase Markdown pipeline (Context / Problem / Discover / Reveal / Practice / Connect / Verify). The node renderer is the same one `/reference/knowledge/[id]` uses today; this WP extracts the renderer to a shared component if it isn't already shared.
3. **Cert-overlay surface** (when the learner's goal holds at least one syllabus AND the overlay lens has run for this course) -- a chip strip showing every cert leaf this step satisfies (`PPL ACS V.A.K1: Effects of bank angle`), plus a "still need to study" panel listing the certGaps relevant to the current section (filtered from the full `certGaps` array to keep the panel focused).

Conditional rendering:

- **Transition step** (`knowledge_node.kind === 'transition'`): replace the node body's 7-phase rendering with a single "bridge" treatment -- a vertical visual rule + the body text rendered as connective prose, no Discover / Practice / Verify scaffolding (those are not authored on transition nodes anyway).
- **Encoded-text family node** (slug match against `WX_DECODE_PRODUCT_SLUGS`): render a header strip above the body with three labeled tabs -- `Decode` / `Understand` / `Triage`. The tabs are render-time hints; the body content remains the same. The strip exists to telegraph the skill ladder pattern even when the underlying node body has not (yet) been split.
- **Empty step body** (`body_md === ''`): skip section 1 (the framing block); render section 2 (linked node body) directly.
- **Empty linked node body** (`lifecycle === 'skeleton'`): render the framing block plus a "content authoring in progress" placeholder for the node body.

The chart stub: a Svelte component `<CourseStepChart slug="..." />` is available to embed in step body_md or node body markdown via a markdown extension (e.g., `:::chart slug="sfc-analysis-2026-05-09"\n:::`). This WP ships the component with a placeholder body (a bordered container + the slug visible as text in development; an empty wrapper in production). The real chart implementation is its own WP.

### Goal composer extension: Courses tab on `/program/goals/[id]`

Adds a Courses tab next to the existing Syllabi and Ad-hoc nodes tabs. Three form actions on the page:

- `addCourse` -- form `course_id` + `weight` (defaults to 1.0). Inserts a `goal_course` row.
- `removeCourse` -- form `course_id`. Deletes the matching `goal_course` row.
- `setCourseWeight` -- form `course_id` + `weight`. Updates the existing row.

Tab UI: list of courses already in the goal (with weight + remove buttons), plus a picker for adding new ones. The picker shows every active instructor course not currently in the goal.

### Hangar app: `/courses` index

Mirrors the study reader's index but for authoring. Each row: slug, title, status, kind (always `instructor` today; `personal` is reserved), section count, last-updated timestamp, edit + delete actions.

Filtering: status (draft / active / archived / all). Sort: most recently updated first.

A "new course" button at the top opens a form that creates a new YAML directory at `course/courses/<slug>/` (manifest.yaml only, sections/ empty). After save, the page redirects to `/courses/[slug]`.

### Hangar app: `/courses/[slug]` course editor

Edit the course manifest fields (title, description, status) plus list / reorder / add / delete sections. The layout:

- Top: form for manifest fields. Save = write `manifest.yaml` + run `bun run db seed courses --slug <slug>`.
- Middle: ordered section list (drag-handle for reorder, edit + delete actions). Reorder = re-write each section file's `ordinal` field + re-run seed.
- Bottom: "add section" form (code, title, ordinal). Save = create a new file `course/courses/<slug>/sections/<code>-<title>.yaml` + re-run seed. Ordinal is suggested as max(existing) + 1, editable.

Delete-course action exists at the page level. Confirmation modal; on confirm, the entire `course/courses/<slug>/` directory is removed and a re-seed runs (which orphans the DB row -- the seed pipeline reports orphan rows but does not auto-delete, so a follow-up SQL cleanup is needed; see "Validation" below).

### Hangar app: `/courses/[slug]/sections/[code]` section editor

Edit one section's fields (title, body_md, ordinal) plus list / reorder / add / delete steps inline.

Step list: each step shows code, title, knowledge_node_id (with a preview of the node title), ordinal. Edit / delete buttons per row. Drag-handle for reorder.

Step editor: a small inline form (or modal) with:

- code (text) -- defaults to `<section_code>.<next_ordinal>` (e.g., `s1.4`)
- title (text)
- body_md (textarea)
- knowledge_node_id (picker -- search/filter by domain, topic, kind; uses existing `/reference/knowledge` browse data)
- ordinal (number, suggested as max(existing) + 1)

Save = re-write the section's YAML file (the entire file, since steps are inline) + re-run seed. Reorder = same operation; the YAML is re-emitted with new ordinals.

## Behavior

### Study reader: render flow

1. Loader hits `getCourseBySlug(slug)`; 404 if missing or `status === 'draft'` (drafts are hidden from learners).
2. Loader picks the lens: if the learner's goal has at least one syllabus, fetch the highest-weight `goal_syllabus` and call `courseWithCertOverlayLens(db, userId, { goal, filters: { courseId, syllabusId } })`. Otherwise call `courseLens(db, userId, { goal, filters: { courseId } })`.
3. Page renders the tree. Per-step mastery indicators come from the lens output's `LensLeafMastery`.
4. Cert-gaps panel (overlay only): renders the lens output's `certGaps` array, sorted as the lens already returns it.
5. Step page: same flow, plus a fetch for the linked `knowledge_node` body (existing query on the node table).

### Goal composer: course tab flow

1. Loader for `/program/goals/[id]` already loads the goal + linked syllabi + ad-hoc nodes. Extend the loader to also call `getCoursesByGoal(goalId)` plus `listAllCourses({ statusIn: ['active'] })` for the picker.
2. Tab UI shows: courses-in-goal list (with weight inputs + remove buttons) + a picker (datalist or select) for adding a new one.
3. `addCourse` action: validates the course exists + is `active`, validates the goal does not already hold the course, validates `weight` is in range. Inserts the `goal_course` row.
4. `removeCourse` action: validates the goal holds the course. Deletes the row.
5. `setCourseWeight` action: validates + updates.

All three actions return to the goal page with a banner per the existing pattern.

### Hangar editor: write flow

The editor's contract is "edit YAML file, then re-seed." Every save action follows this two-step sequence:

1. **YAML write** -- the editor reads the current YAML file, applies the form deltas, re-emits the YAML in canonical form (keys in stable order, indentation per the existing fixtures, body_md preserved verbatim with literal block scalars). Writes atomically (write to temp + rename, or `node:fs/promises#writeFile` with a single call -- design.md picks).
2. **Seed re-run** -- the editor invokes the seed pipeline programmatically by calling `seedCourses({ slug, coursesDir: 'course/courses' })` from `scripts/db/seed-courses.ts` (which exports the function alongside its CLI entry). The result summary is surfaced to the user. If the seed throws (any `CourseSeedError`), the YAML write is reverted -- the editor restores the previous file contents from a one-shot in-memory backup taken before the write.

This flow is **per-save synchronous**. The user sees a spinner while the seed runs (typically <500ms for one course). The editor does not queue saves or batch them.

Concurrency: two simultaneous editors of the same course is not supported. The hangar app is single-user today (Joshua); a future multi-author surface needs file-locking or last-writer-wins UX, both deferred per OUT-OF-SCOPE.

### Hangar editor: delete flow

Delete-section: removes the section file from `sections/`, re-runs seed. The seed pipeline's orphan-detection (in `scripts/db/seed-courses.ts`) reports the now-orphan section + step rows but does NOT delete them. The hangar UI surfaces the orphan list and offers a "remove orphans" action that runs `DELETE FROM study.course_step WHERE course_id = ? AND code IN (...)` via a BC helper.

Delete-course: removes the entire `course/courses/<slug>/` directory + re-runs seed. The course row in `study.course` becomes orphan (no manifest pointing at it). The UI surfaces the orphan + offers "remove course row" action that runs the analogous DELETE.

Both delete flows preserve the YAML-as-source rule (no DB-only deletions; the YAML mutation drives the DB cleanup). The orphan-cleanup actions are explicit and labeled.

### Encoded-text family rendering

`WX_DECODE_PRODUCT_SLUGS` is a small constant array in `libs/constants/src/study.ts` (or a peer file -- design.md picks). Initial values:

```text
WX_DECODE_PRODUCT_SLUGS = [
  'wx-reading-metars-tafs',
  'wx-product-pireps',
  'wx-product-airmets-sigmets',
]
```

When a step's linked node slug matches, the step reader renders a tab strip with three labels: `Decode`, `Understand`, `Triage`. The tabs are visual hints only -- they don't filter content; they orient the learner to the skill ladder. Future: per-tab content (a Decode lens that shows only decoding cards; an Understand lens that surfaces the "why each field exists" framing). Deferred per OUT-OF-SCOPE.

### Transition step rendering

When `knowledge_node.kind === 'transition'`, the step reader skips the 7-phase node renderer entirely. Replacement: a vertical visual rule (left margin) + the body_md rendered as connective prose. The step framing (the step's own body_md) remains above this. Pattern: "this is a bridge between X and Y; here's what carries over."

### Cert overlay: which syllabus

The detail page picks a single syllabus to overlay against, based on the goal:

- Highest-weight `goal_syllabus` row, breaking ties by `syllabus_id ASC` for determinism. This is the syllabus the learner is most invested in.
- If the goal has no syllabi, no overlay; `courseLens` runs.
- The detail page does NOT pick multiple syllabi. The overlay is one cert at a time. Multi-cert overlay (a course's coverage across all the learner's certs) is its own concern, deferred per OUT-OF-SCOPE.

## Validation

| Field                                 | Rule                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/courses/[slug]` slug                | Must match an existing `course.slug` AND course.status != 'draft'; else 404                          |
| `/courses/[slug]/[stepCode]` slug     | Must match an existing course; stepCode must match a `course_step.code` under that course; else 404  |
| Hangar course editor: title           | Non-empty                                                                                            |
| Hangar course editor: description     | String; markdown allowed; no length limit (the seed pipeline does not enforce one)                   |
| Hangar course editor: status          | One of `draft / active / archived`                                                                   |
| Hangar new-course: slug               | Matches `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` (the existing course slug regex); UI does the check live |
| Hangar new-course: slug               | Must not collide with an existing course directory                                                   |
| Hangar section editor: code           | Non-empty; unique within the course (matches existing seed validator rule)                           |
| Hangar section editor: ordinal        | Integer >= 0; unique within the course's sections                                                    |
| Hangar step editor: code              | Non-empty; unique within the course (course-wide, not section-wide -- matches the seed validator)    |
| Hangar step editor: knowledge_node_id | Must match an existing `knowledge_node.id`; UI picker enforces this by only showing existing ids     |
| Hangar step editor: ordinal           | Integer >= 0; unique within the parent section                                                       |
| Goal composer: addCourse course_id    | Must exist in `study.course` AND status='active'                                                     |
| Goal composer: addCourse weight       | Real in `[GOAL_SYLLABUS_WEIGHT_MIN, GOAL_SYLLABUS_WEIGHT_MAX]` (reuse existing constants)            |
| Goal composer: removeCourse course_id | Must exist as a `goal_course` row for this goal                                                      |
| Goal composer: setCourseWeight        | Course must already be in goal; weight in range                                                      |

The seed pipeline's existing rejections (duplicate ordinals, missing `knowledge_node_id`, kind='personal', etc.) fire when the editor's save action triggers `seedCourses`. The editor surfaces the rejection message verbatim and reverts the YAML write.

## Edge cases

- **Course in `status='draft'`**: hidden from study-app reader (404). Visible in hangar editor (any status). Allowed as a `goal_course` target via the BC, but the UI picker filters out drafts so the goal composer does not surface them.
- **Course with zero sections**: study reader shows an empty tree with a "no content yet" placeholder. Hangar editor shows the manifest form + an "add first section" CTA.
- **Section with zero steps**: study reader shows the section header + body_md, no leaves. Hangar editor shows the section form + an "add first step" CTA.
- **Step's linked node has no body** (`lifecycle='skeleton'`): study reader renders the step framing + a placeholder for the node body. The mastery indicator collapses to "unseen" (matches the lens output).
- **Goal references a course that was archived after the link was made**: lens still renders the course; the study reader still shows it; the goal composer's "courses in goal" list shows the archived course with a status badge. The picker for adding new courses filters out archived ones, so the user can only NEW-add active courses.
- **Goal references a course AND a syllabus that share knowledge nodes**: per the lens design (`getGoalNodeUnion` dedups by node id, max-weight), the node is scheduled once. The cert-overlay panel marks the step's leaf as `inCert: true` with the correct certCode.
- **Two simultaneous hangar editors on different courses**: independent. The seed pipeline is idempotent and per-course; concurrent saves of different courses are safe.
- **Two simultaneous hangar editors on the same course**: not supported. Last-writer-wins; the second save will likely succeed but loses the first's changes. The UI does not lock or surface a conflict warning. Single-user assumption (deferred per OUT-OF-SCOPE).
- **Seed pipeline rejects on save**: editor reverts the YAML write, surfaces the error. The DB is unchanged. The user sees the YAML in the editor as it was before the failed save (the form retains the user's input -- the file is reverted, not the form state).
- **YAML file write succeeds but seed fails for a non-validation reason** (e.g., DB connection lost): editor reverts the YAML write, surfaces a message of the form `seed failed: <error>; your edits were reverted` (the placeholder is the error text). The user must retry.
- **Encoded-text product slug list grows**: adding a new slug to `WX_DECODE_PRODUCT_SLUGS` is a one-line constants change. No data migration; the rendering hint is content-driven.
- **A goal-with-overlay where the lens picks syllabus A, but the learner wants overlay against syllabus B**: deferred. Today the page picks the highest-weight syllabus deterministically. A picker UI is its own concern (deferred per OUT-OF-SCOPE).
- **Step body_md uses `<CourseStepChart slug="..." />` directive** (or a `:::chart slug="..."` markdown extension): the renderer detects the directive and mounts the chart-stub component. In dev the slug is visible; in prod the placeholder is empty. Same for node body_md.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
