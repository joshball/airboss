---
feature: course-reader-and-editor
category: patterns
date: 2026-05-17
branch: main
issues_found: 14
critical: 0
major: 5
minor: 6
nit: 3
---

## Summary

The CRE file set is broadly compliant with the project's house style: routes go through `ROUTES`, design tokens are used consistently, no `any`, no non-null assertions, Drizzle-only data access, `@ab/*` aliases for cross-lib imports, and the BC layer (`libs/bc/study/src/courses.ts`) is clean. The pattern violations cluster around three convergent root causes: (1) form `action="?/..."` attributes are inline strings even though the WP authored `ROUTES.HANGAR_COURSE_*_ACTION` / `ROUTES.STUDY_GOAL_*_COURSE_ACTION` constants specifically for them; (2) the course slug regex is hand-duplicated three times instead of living in one shared constant; (3) the goal-composer course actions inline raw Drizzle against `goalCourse` instead of going through BC helpers, breaking parity with the sibling `addGoalSyllabus` / `addGoalNode` pattern. None are Critical, but the first two are systemic and should be fixed at the root.

## Issues

### MAJOR: Form `action` attributes inline `?/...` strings instead of the authored ROUTES constants

- **File**: `apps/hangar/src/routes/(app)/courses/+page.svelte`:63; `apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte`:50,83,136,170,185; `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte`:68,108,152,200; `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte`:263,278,288
- **Problem**: Every CRE form uses an inline `action="?/createCourse"` / `action="?/updateManifest"` / `action="?/addCourse"` etc. string. The WP itself added matching constants to `libs/constants/src/routes.ts` (`HANGAR_COURSE_CREATE_ACTION: '?/createCourse'`, `HANGAR_COURSE_UPDATE_MANIFEST_ACTION`, `HANGAR_COURSE_ADD_SECTION_ACTION`, `HANGAR_COURSE_DELETE_SECTION_ACTION`, `HANGAR_COURSE_CLEANUP_ORPHANS_ACTION`, `HANGAR_COURSE_DELETE_ACTION`, `HANGAR_COURSE_UPDATE_SECTION_ACTION`, `HANGAR_COURSE_ADD_STEP_ACTION`, `HANGAR_COURSE_UPDATE_STEP_ACTION`, `HANGAR_COURSE_DELETE_STEP_ACTION`, `STUDY_GOAL_ADD_COURSE_ACTION`, `STUDY_GOAL_REMOVE_COURSE_ACTION`, `STUDY_GOAL_SET_COURSE_WEIGHT_ACTION`) — and then no `.svelte` file consumes any of them. The project already uses this pattern elsewhere: `apps/hangar/src/routes/(app)/ingest-review/+page.svelte:128` uses `action={ROUTES.HANGAR_INGEST_REVIEW_RUN_PRODUCERS_ACTION}`, and `apps/hangar/src/routes/(app)/__tests__/destructive-confirm-wiring.svelte.test.ts` asserts forms expose `ROUTES.HANGAR_*_ACTION`. The constants are dead until the forms reference them.
- **Rule**: CLAUDE.md "Critical Rules" -- "All routes go through `ROUTES` in `libs/constants/src/routes.ts`. Never write a path string inline." A form-action query string is a route fragment; the project treats `?/...` action ids as `ROUTES` constants.
- **Fix**: Replace each inline `action="?/createCourse"` with `action={ROUTES.HANGAR_COURSE_CREATE_ACTION}`, `action="?/updateManifest"` with `action={ROUTES.HANGAR_COURSE_UPDATE_MANIFEST_ACTION}`, `action="?/addCourse"` with `action={ROUTES.STUDY_GOAL_ADD_COURSE_ACTION}`, etc. The pre-existing goal-composer forms (`?/update`, `?/setStatus`) also inline strings; the WP's own new forms are what this review scopes, but fixing the goal-composer course forms while leaving its syllabus/node forms inconsistent is acceptable since the course constants exist and the syllabus ones do not.

### MAJOR: Goal-composer course actions inline raw Drizzle instead of BC helpers

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts`:144-149, 379-388, 404, 422-426
- **Problem**: `addCourse` / `removeCourse` / `setCourseWeight` (and the loader's goal-course weight read) call `db.select()/insert()/delete()/update()` against the `goalCourse` table directly inside the route file. Every sibling action on the same page goes through a BC helper: `addGoalSyllabus`, `removeGoalSyllabus`, `setGoalSyllabusWeight`, `addGoalNode`, `removeGoalNode`, `setGoalNodeWeight` all live in `libs/bc/study/src/goals.ts`. There is no `addGoalCourse` / `removeGoalCourse` / `setGoalCourseWeight` BC helper -- the route reaches past the BC boundary. The route also imports the raw `goalCourse` table object and `and`/`eq` from `drizzle-orm` purely to do this.
- **Rule**: CLAUDE.md Monorepo / Architecture -- BC logic lives in `libs/bc/study/`; pages consume it through `@ab/bc-study/server`. The established `goals.ts` pattern is the contract for goal-link mutations.
- **Fix**: Add `addGoalCourse(goalId, userId, { courseId, weight })`, `removeGoalCourse(goalId, userId, courseId)`, `setGoalCourseWeight(goalId, userId, courseId, weight)`, and a `getGoalCourseLinks(goalId)` (or extend `getCoursesByGoal` to return the weight) to `libs/bc/study/src/goals.ts`, mirroring `addGoalSyllabus` et al. The route actions then call those helpers; the `goalCourse` / `and` / `eq` / `db` imports drop out of the route file. The course-existence + status validation can stay in the action or move into the helper to match `addGoalSyllabus`.

### MAJOR: Course slug regex duplicated three times instead of one shared constant

- **File**: `apps/hangar/src/routes/(app)/courses/+page.server.ts`:67,81; `apps/hangar/src/routes/(app)/courses/+page.svelte`:70
- **Problem**: `COURSE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/` is defined as a private const in `apps/hangar/src/routes/(app)/courses/+page.server.ts:67`, the identical pattern is hardcoded again as the error-message string at line 81 (`'Slug must match ^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$.'`), and a third time as a literal `pattern={'^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'}` in `+page.svelte:70`. The same regex already lives, privately, in `libs/bc/study/src/course-yaml-schemas.ts:64` (where `courseManifestSchema` validates `slug`). Four copies of one regex; if the slug rule changes, three of them silently drift.
- **Rule**: CLAUDE.md "Critical Rules" -- "No magic strings. All literal values in `libs/constants/`." The spec ("Hangar new-course: slug") explicitly calls it "the existing course slug regex," signalling it should be a single canonical value.
- **Fix**: Add `COURSE_SLUG_REGEX` (and optionally `COURSE_SLUG_REGEX_SOURCE` for the `pattern=` attribute, since HTML `pattern` wants a string) to `libs/constants/src/credentials.ts` next to `COURSE_KINDS` / `COURSE_STATUSES`. Have `course-yaml-schemas.ts`, the hangar route, and the `pattern=` attribute all import it. The error message becomes `` `Slug must match ${COURSE_SLUG_REGEX.source}.` `` so it can never drift from the pattern.

### MAJOR: `maxlength="200"` magic number; no `COURSE_TITLE_MAX_LENGTH` constant and no server-side title-length validation

- **File**: `apps/hangar/src/routes/(app)/courses/+page.svelte`:76; `apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte`:53; `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte`:80,120,165
- **Problem**: The hangar course/section/step title inputs hardcode `maxlength="200"`. Every other titled entity in the project has a constant: `GOAL_TITLE_MAX_LENGTH = 200`, `NOTE_TITLE_MAX_LENGTH = 200`, `PLAN_TITLE_MAX_LENGTH = 200`, `PLAN_ITEM_TITLE_MAX_LENGTH = 200`. There is no `COURSE_TITLE_MAX_LENGTH`. Worse, the server actions (`createCourse`, `updateManifest`, `addSection`, `updateSection`, `addStep`, `updateStep`) only check `title === ''` -- they never enforce the 200-char cap server-side, so the `maxlength` attribute is the only gate and is trivially bypassed (the test plan CRE-24 itself bypasses the form via curl/devtools).
- **Rule**: CLAUDE.md "Critical Rules" -- "No magic strings/numbers. Use `libs/constants/`." The goal-composer's own `update` action (same file the WP extends) validates `title.length > GOAL_TITLE_MAX_LENGTH` server-side -- the CRE actions should mirror it.
- **Fix**: Add `COURSE_TITLE_MAX_LENGTH = 200` to `libs/constants/src/credentials.ts` (alongside `COURSE_KINDS`). Bind the `maxlength=` attributes to it, and add `if (title.length > COURSE_TITLE_MAX_LENGTH) return fail(400, ...)` to `createCourse`, `updateManifest`, `addSection`, `updateSection`, and the step actions, mirroring the goal-composer `update` action.

### MAJOR: `KnowledgeNodePicker` filters on a lifecycle value that does not exist in `NODE_LIFECYCLES`

- **File**: `apps/hangar/src/lib/components/KnowledgeNodePicker.svelte`:33,38,94,226
- **Problem**: The picker declares `const ARCHIVED_LIFECYCLE = 'archived'` and filters `n.lifecycle !== ARCHIVED_LIFECYCLE`, plus the "include archived" checkbox toggles it and a `.lifecycle-archived` CSS rule styles it. But `NODE_LIFECYCLES` in `libs/constants/src/study.ts:852` only defines `SKELETON: 'skeleton'`, `STARTED: 'started'`, `COMPLETE: 'complete'` -- there is no `'archived'` lifecycle. So `'archived'` is both a magic string AND a value that can never match a real row: the archived filter and the include-archived checkbox are dead UI, and the spec's resolved decision ("archived-lifecycle nodes are filterable but excluded by default") cannot be satisfied by the current schema.
- **Rule**: CLAUDE.md "Critical Rules" -- "No magic strings... Enums defined in constants." CLAUDE.md "Zero tolerance for known issues" -- dead filtering logic against a non-existent enum value is a known issue.
- **Fix**: Decide which is true and fix at the root. Either (a) the node lifecycle genuinely has an `archived` state -- then add `ARCHIVED: 'archived'` to `NODE_LIFECYCLES` + `NODE_LIFECYCLE_LABELS` and have the picker import it; or (b) "archived" is not a node lifecycle and the picker's archived filter + checkbox should be removed (or repointed at whatever column actually carries archived state). The spec's resolved-decision wording suggests (a) was intended but the constant was never shipped. Surface this to the user for the call; do not leave the dead `'archived'` literal.

### MINOR: `'section'` / `'lesson'` / `'step'` compared as bare string literals instead of `COURSE_STEP_LEVELS`

- **File**: `apps/study/src/routes/(app)/courses/[slug]/+page.svelte`:94-95; `libs/bc/study/src/courses.ts`:195
- **Problem**: `courses/[slug]/+page.svelte` does `node.level === 'section'` and `node.level === 'lesson'` against bare strings. `courses.ts:195` computes `const isLeaf = input.level === 'step'`. `COURSE_STEP_LEVELS` (`SECTION`/`LESSON`/`STEP`) is the canonical enum and is already imported and used correctly in the sibling files (`[stepCode]/+page.server.ts`, `course-yaml-emit.ts`, the hangar editors all use `COURSE_STEP_LEVELS.*`).
- **Rule**: CLAUDE.md "Critical Rules" -- "No magic strings. Enums defined in constants, not inline."
- **Fix**: Import `COURSE_STEP_LEVELS` in `courses/[slug]/+page.svelte` and `courses.ts`; replace the literals with `COURSE_STEP_LEVELS.SECTION` / `.LESSON` / `.STEP`.

### MINOR: Chart endpoint path is an inline string, not a `ROUTES` entry

- **File**: `apps/study/src/lib/components/CourseStepChart.svelte`:31
- **Problem**: `const chartUrl = $derived(`/api/charts/${slug}/chart.svg`)` builds the chart API URL by hand. The project routes API endpoints through `ROUTES`: `ROUTES.API_CITATIONS_SEARCH = '/api/citations/search'`, `ROUTES.API_PAGE_EXPLAINER`, and the parameterized `'/api/section/${sectionId}/heartbeat'` are all in `routes.ts`. The chart catch-all route (`apps/study/src/routes/api/charts/[...slug]/+server.ts`) has no `ROUTES` entry.
- **Rule**: CLAUDE.md "Critical Rules" -- "All routes go through `ROUTES`... Routes with parameters are typed functions."
- **Fix**: Add `API_CHART: (slug: string) => `/api/charts/${slug}/chart.svg` as const` to `libs/constants/src/routes.ts` and consume it in the component. The catch-all `[...slug]` consumes slashes transparently, so the `slug` need not be `encodeURIComponent`-ed -- a code comment on the route entry should note that, matching the existing comment on the heartbeat route.

### MINOR: Mastery-bar height uses raw `px` for a sizing value

- **File**: `apps/study/src/routes/(app)/courses/+page.svelte`:259 (`height: 6px`); `apps/study/src/routes/(app)/courses/[slug]/+page.svelte`:334 (`height: 8px`)
- **Problem**: The progress-bar tracks use `height: 6px` / `height: 8px`. The patterns checklist allows `px` only for borders and box-shadows; a bar height is a sizing value and should be `rem`-based off the spacing scale so it scales with the base font size. The two bars also disagree (6 vs 8) for what is the same UI affordance.
- **Rule**: Patterns checklist "Design Token Compliance" -- "No `px` for font sizes or spacing -- only `rem` (exception: borders, box-shadows)."
- **Fix**: Use a spacing token (`var(--space-2xs)` or a dedicated `--bar-height` token if one is added to `libs/themes/`) and make both bars consistent.

### MINOR: Inline `letter-spacing: -0.02em` magic value on the step-reader H1

- **File**: `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte`:126
- **Problem**: `.hd h1 { letter-spacing: -0.02em; }` is a hardcoded typographic value. The rest of the CRE CSS uses `var(--letter-spacing-caps)` for letter-spacing; this one negative-tracking value is inline.
- **Rule**: Patterns checklist "Design Token Compliance" -- visual values come from tokens; "If a needed token doesn't exist, add it to the themes/tokens directory."
- **Fix**: Use an existing heading letter-spacing token, or add `--letter-spacing-heading` (or `--letter-spacing-tight`) to `libs/themes/` and reference it. Confirm whether other H1s in the app already carry this tracking -- if so, the token should be applied at the heading level, not per-page.

### MINOR: Native `confirm()` for destructive actions instead of the project's confirm-action pattern

- **File**: `apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte`:142; `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte`:206
- **Problem**: Section-delete and step-delete gate on `if (!confirm(...))`. The hangar app has an established destructive-confirm pattern -- `apps/hangar/src/routes/(app)/__tests__/destructive-confirm-wiring.svelte.test.ts` and the `__tests__/harnesses/*DeleteHarness.svelte` files exercise a `formAction={ROUTES.HANGAR_*_DELETE_ACTION}` confirm component used by `/sources` and `/glossary`. The course editor uses raw browser `confirm()` instead, and the course-level delete (same `[slug]` page) uses a bespoke `confirmingDelete` `$state` two-step. Three different confirm mechanisms across one feature.
- **Rule**: CLAUDE.md Patterns -- "project pattern compliance"; mirror the existing `/sources` / `/glossary` destructive-confirm surface the WP's own spec names as the pattern to follow.
- **Fix**: Route section-delete and step-delete through the same destructive-confirm component `/sources` and `/glossary` use (the one the `destructive-confirm-wiring` test covers), with `formAction` bound to the new `ROUTES.HANGAR_COURSE_DELETE_SECTION_ACTION` / `HANGAR_COURSE_DELETE_STEP_ACTION` constants. This also closes the MAJOR inline-action finding for those forms.

### MINOR: `course/courses` repo path string hand-built with six `..` segments

- **File**: `apps/hangar/src/lib/server/course-seed.ts`:30-31
- **Problem**: `REPO_ROOT` is resolved by `resolve(HERE, '..', '..', '..', '..', '..', '..')` and `COURSES_DIR = resolve(REPO_ROOT, 'course/courses')`. The six-`..` walk is brittle -- any move of the file (e.g., the lib reorg the design.md fallback contemplated) silently breaks it -- and `'course/courses'` is a repo-structure literal. The course-primitive seed pipeline already knows this directory (`seedCourses` takes a `coursesDir`); the canonical path should come from one place.
- **Rule**: CLAUDE.md "No magic strings"; CLAUDE.md "No legacy / brittle constructs."
- **Fix**: Export the courses directory from a constant the seed pipeline owns (e.g. a `COURSES_DIR` / `coursesDir` default exported from `@ab/seed-courses`), or resolve it from a repo-root helper rather than a counted `..` chain. The `// Six `..` segments` comment is a tell that the path math is fragile.

### NIT: Dead `.banner-ok` CSS rule on the hangar courses index

- **File**: `apps/hangar/src/routes/(app)/courses/+page.svelte`:174-178
- **Problem**: `.banner-ok` is styled but the index template only ever renders `.banner-error` (`{#if form?.error}`). Unlike the `[slug]` and section editors, the index page has no success banner. The rule is dead.
- **Rule**: CLAUDE.md "Systematic dead code detection."
- **Fix**: Either render a success banner on `createCourse` success (it currently redirects, so there is no success state on this page -- the rule is genuinely unreachable) and drop the `.banner-ok` rule, or add the success banner if one is wanted. Given `createCourse` redirects to the editor on success, removing the dead rule is the right call.

### NIT: `name = 'knowledge_node_id'` default form-field name as an inline string

- **File**: `apps/hangar/src/lib/components/KnowledgeNodePicker.svelte`:27
- **Problem**: The picker's hidden-input `name` prop defaults to the literal `'knowledge_node_id'`, and the section-editor server (`sections/[code]/+page.server.ts:136`) reads `form.get('knowledge_node_id')`. The two literals must agree but are not derived from one constant. This matches the project's existing convention (the goal composer also uses bare `form.get('title')` etc.), so it is house style, not a hard violation -- flagged only because the picker is a reusable component where a drifted field name fails silently.
- **Rule**: Patterns checklist "Constants & Magic Values" (advisory, given the existing convention).
- **Fix**: Optional. If form-field-name constants are wanted for the reusable picker, define `COURSE_STEP_FORM_FIELDS` (or similar) in `libs/constants/` and share it between the component default and the server `form.get(...)`. Otherwise leave as-is to match the rest of the codebase -- but do not let the literal drift.

### NIT: `slice(0, 25)` / `slice(0, 50)` picker caps as bare numbers

- **File**: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts`:134; `apps/hangar/src/lib/components/KnowledgeNodePicker.svelte`:47
- **Problem**: The goal-composer node picker caps candidates at `.slice(0, 25)` and the `KnowledgeNodePicker` dropdown caps at `.slice(0, 50)`. Both are unexplained magic numbers governing the same kind of UI (a node picker list cap). The `25` cap predates this WP (it is in the unchanged loader region), but the `50` cap is new in CRE.
- **Rule**: CLAUDE.md "No magic numbers... limits."
- **Fix**: Hoist the `50` to a named const in the picker (`const DROPDOWN_CAP = 50`) or, better, a `KNOWLEDGE_NODE_PICKER_LIMIT` in `libs/constants/` shared with the goal-composer's `25` so the two pickers agree. Minimum: a named local const with the rationale the inline comment already gives.

## Non-issues verified

- Routes: study reader routes (`ROUTES.COURSES`, `COURSE`, `COURSE_STEP`) and hangar routes (`HANGAR_COURSES`, `HANGAR_COURSE`, `HANGAR_COURSE_SECTION`) are all in `routes.ts` and consumed correctly via `ROUTES.*` -- no inline path strings for page navigation.
- `WX_DECODE_PRODUCT_SLUGS`, `ENCODED_TEXT_LADDER_TABS`, `KNOWLEDGE_NODE_KINDS`, `COURSE_STATUSES`, `COURSE_KINDS`, `COURSE_STEP_LEVELS`, `NODE_LIFECYCLES`, `KNOWLEDGE_PHASE_ORDER` are all defined in `libs/constants/` and imported where used. (The shipped `WX_DECODE_PRODUCT_SLUGS` 5-slug list differs from the 3-slug list sketched in spec.md -- that is a content decision recorded in the constant's JSDoc, not a pattern violation.)
- TypeScript strictness: no `any`, no non-null assertions (`!`) anywhere in scope. `as` assertions are limited and each is either a Drizzle-required cast (`inArray(... as CourseStatus[])`, `requiredBloom as BloomLevel | null`), a documented enum-narrowing cast for a DB string column (`step.level as CourseStepLevel`, with intent), or a `Record` lookup cast for label maps -- consistent with the rest of the codebase.
- Drizzle ORM only: `courses.ts` and the goal-composer use Drizzle query builders throughout; the single `sql` template (`NULLS FIRST` ordering in `getCourseStepsByCourse`) is commented and justified -- Drizzle has no nulls-ordering helper.
- Runtime-barrel vs server-barrel: `+page.server.ts` files import from `@ab/bc-study/server`; `.svelte` files import types/helpers from `@ab/bc-study`; `course-seed.ts` and `course-yaml-emit.ts` carry the `// @browser-globals: server-only` tag and the picker types are correctly split into `knowledge-node-picker-types.ts` so the `.svelte` component does not pull server imports.
- Cross-lib imports use `@ab/*` aliases; intra-app `$lib/...` imports are within the app boundary. No `../../../` lib crossings.
- BC layer (`courses.ts`) uses `createId('crs')` / `createId('cst')` via `@ab/utils` -- no direct `ulid()` / `nanoid()`.
- ID strategy: `course` / `course_step` use prefixed ULIDs (`crs_` / `cst_`) per the event-record tier; consistent with the schema.
- The WP doc set (`tasks.md`, `OUT-OF-SCOPE.md`) is present and the implementation honors the deferrals (chart stub, encoded-text tabs as visual-only hints, no drag-and-drop reorder, no syllabus picker).
