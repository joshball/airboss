---
feature: course-reader-and-editor
category: ux
date: 2026-05-17
branch: main
issues_found: 14
critical: 0
major: 5
minor: 6
nit: 3
---

## Summary

The CRE feature set is well-built overall: empty states are present everywhere, loading is server-side, breadcrumbs and prev/next navigation are consistent, and destructive hangar actions are confirmed. The most material UX gap is on the study-app goal composer: the three course actions (`addCourse` / `removeCourse` / `setCourseWeight`) succeed silently. They return `{ success: true }` but the page renders no success banner at all, so the user gets zero positive feedback after adding, removing, or reweighting a course - and the test plan (CRE-12/14/16) explicitly expects banners. A second cluster of issues: the spec's "Add-to-goal action" on the course detail page was never built (a learner reading a course cannot subscribe to it from that page), and the hangar editor's seed-action validation diverges from the spec in two places (out-of-range weight is silently clamped instead of rejected; `removeCourse` deletes with no in-goal check). The previously-noted "Courses block vs tab" drift is confirmed and is one of several spec drifts, not the only one.

## Issues

### MAJOR: Goal composer course actions produce no success feedback

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:86-88
- **Problem**: The page only renders `{#if form?.error}`. The three course actions (`addCourse`, `removeCourse`, `setCourseWeight`) - and in fact `addSyllabus`, `removeSyllabus`, `setSyllabusWeight`, `addNode`, etc. - all return `{ intent, success: true }` on success, but nothing on the page renders that state. After a user adds a course, removes a course, or changes a weight, the form re-renders with no banner, no toast, no message. The list does update (the loader re-runs), but there is no explicit acknowledgement. The test plan requires specific banners: CRE-12 "Course added to goal.", CRE-14 "Weight updated.", CRE-16 "Course removed from goal.", CRE-13/CRE-15 error banners. The error banners work; the success banners do not exist.
- **Expected**: Every action that mutates the goal shows a visible, specific success banner ("Course added to goal", "Weight updated", "Course removed from goal").
- **Fix**: Add a `{#if form?.success}` branch next to the error branch that renders a `role="status"` banner. Map `form.intent` to a specific message string (the actions already return `intent`), e.g. a small lookup `{ addCourse: 'Course added to goal.', removeCourse: 'Course removed from goal.', setCourseWeight: 'Weight updated.', ... }`.

### MAJOR: Course detail page has no "add to goal" action

- **File**: apps/study/src/routes/(app)/courses/[slug]/+page.svelte (whole file)
- **Problem**: spec.md "Study app: /courses/[slug] detail" lists, as a page section: "Add-to-goal action: opens a small inline form (or a modal) that POSTs to the existing goal composer's `addCourse` action." The detail page renders the header, mastery rollup, the section tree, the cert-gaps panel, and a notes block - but there is no add-to-goal affordance anywhere. A learner who navigates to a course and wants to study it has no path from this page to put it in their goal; they must leave, find their goal, open the Courses block, and pick the course from a `<select>`. That is a dead end for the page's primary call to action.
- **Expected**: The detail page surfaces an "Add to goal" button (when the learner has a primary goal and the course is not already in it) that POSTs to the goal composer's `addCourse` action, or an equivalent inline form. When the course is already in the goal, show an "In your goal" indicator instead.
- **Fix**: Add an action button in or below the `PageHeader`. The loader already needs only the primary goal + a check against `getCoursesByGoal`; POST to `addCourse` on the goal route (an absolute action URL) or add a thin `addCourse` action to this route that delegates to the same BC insert.

### MAJOR: setCourseWeight silently clamps out-of-range weights instead of rejecting

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:408-431 (and 357-389 addCourse)
- **Problem**: `clampWeight` (line 166-170) silently coerces any out-of-range value into `[GOAL_SYLLABUS_WEIGHT_MIN, GOAL_SYLLABUS_WEIGHT_MAX]`. Test plan CRE-15 expects: submitting weight 999 produces an error banner "Weight out of range." Instead the action clamps 999 to the max and reports success. The user typed 999, the system stored (say) 10, and told them nothing changed semantics - they have no idea their input was altered. The spec validation table also says addCourse/setCourseWeight weight must be "Real in [MIN, MAX]" - a validation rule, not a clamp. Silent clamping is a data-integrity surprise: the stored value differs from the submitted value with no notice.
- **Expected**: An out-of-range weight returns `fail(400, { intent, error: 'Weight must be between X and Y.' })` and the input retains the user's typed value so they can correct it.
- **Fix**: Replace `clampWeight` for the course (and syllabus/node) weight paths with a validate-or-reject helper: parse the number, and if it is non-finite or outside the range, `fail(400, ...)` with a specific message. Only fall back to a default when the field is genuinely absent.

### MAJOR: removeCourse deletes with no "course is in goal" validation

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts:391-406
- **Problem**: `removeCourse` runs `db.delete(goalCourse).where(...)` and unconditionally returns `{ success: true }`, even when zero rows matched. The spec validation table requires "removeCourse course_id: Must exist as a `goal_course` row for this goal." A stale form (course already removed in another tab, or a replayed POST) reports "removed" success when nothing was removed. Compare `setCourseWeight`, which correctly checks `result.length === 0` and fails. `removeCourse` should be symmetric.
- **Expected**: When no `goal_course` row matched, return `fail(400, { intent: 'removeCourse', error: 'Course not in goal.' })`.
- **Fix**: Add `.returning()` to the delete and check the result length, mirroring `setCourseWeight`'s pattern at line 427.

### MAJOR: Hangar editor success banners are generic, not specific

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte:44-46 and apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:62-64
- **Problem**: Both hangar editor pages render `{#if form?.success === true}` with a single hard-coded message: "Saved." The test plan expects specific confirmations: CRE-23 "Manifest updated.", CRE-25 "Section added.", CRE-26 "Step added.", CRE-28 "Step deleted.", CRE-31 the orphan-cleanup count. The actions all return a discriminating `intent` field (`updateManifest`, `addSection`, `deleteStep`, `cleanupOrphans`, etc.) and `cleanupOrphans` even returns `removed: <count>`, but the page throws all of that away and says "Saved." for everything. A user who clicks "Remove orphans" cannot tell from the banner whether 0 or 5 rows were removed; a user who deletes a step sees the same "Saved." as a manifest edit. The UX skill calls this out directly: success messages must be specific, not generic.
- **Expected**: Each action's banner names what happened: "Manifest updated.", "Section added.", "Step deleted.", "Removed N orphan rows."
- **Fix**: Map `form.intent` to a specific message. For `cleanupOrphans`, include `form.removed` in the string ("Removed 3 orphan rows." / "No orphan rows to remove.").

### MINOR: Course index card description clamps to 2 lines, spec says one

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:222-228
- **Problem**: spec.md "Study app: /courses index" says each row shows "description (clamped to one line)". The `.description` style uses `-webkit-line-clamp: 2`. Two lines is arguably the better choice for a card grid, but it is a spec drift that was not recorded as a resolved decision.
- **Expected**: Either match the spec (one line) or update the spec to record 2 lines as the intended behavior.
- **Fix**: Change `line-clamp` to `1`, or amend spec.md and note it in the sign-off review's drift list. Recommend keeping 2 lines (better for a card) and amending the spec.

### MINOR: Encoded-text ladder strip renders even when the node body is a skeleton or missing

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:60-73
- **Problem**: `EncodedTextLadderTabs` renders inside `{#if isLeaf}` before the `node === null` / `isNodeSkeleton` branches. So a step that links an encoded-text node whose body is not yet authored shows the "Skill ladder: Decode / Understand / Triage" strip immediately above a "Content authoring in progress" placeholder. The strip orients the learner to content that does not exist yet, which is confusing - the ladder promises a skill progression and then there is nothing below it.
- **Expected**: The ladder strip appears only when there is actual node body content to orient (the `else` branch that renders `KnowledgeNodeBody`).
- **Fix**: Move the `{#if isEncodedText}<EncodedTextLadderTabs />{/if}` inside the final `{:else}` branch (alongside `KnowledgeNodeBody`), or gate it on `hasNodeBody && !isTransition`.

### MINOR: Knowledge-node picker dropdown does not close on outside click or blur

- **File**: apps/hangar/src/lib/components/KnowledgeNodePicker.svelte:73-104
- **Problem**: `showDropdown` is set true on `onfocus` of the filter input and is only set false inside `selectNode`. There is no outside-click or blur handler. Once the dropdown is open, clicking elsewhere on the page (another field, the page background) leaves the 20rem-tall scrolling list open, overlapping whatever is beneath it. In a form with a body_md textarea right below the picker, the dropdown covers the textarea until the user picks a node. The only ways to dismiss it are to select a node or to lose the element from the DOM.
- **Expected**: The dropdown closes when focus leaves the picker or the user clicks outside it.
- **Fix**: Add an `onblur` handler on the picker container (with a short timeout so a click on a dropdown item still registers) or a `window` click listener that closes the dropdown when the click target is outside `.picker`.

### MINOR: Knowledge-node picker filter input has no associated label

- **File**: apps/hangar/src/lib/components/KnowledgeNodePicker.svelte:73-79
- **Problem**: The combobox's filter `<input type="text">` has only a `placeholder`, no label. The parent forms wrap the picker in a `<label class="field"><span class="label">Knowledge node</span>` (section editor lines 124-126, 168-171), but that label wraps the whole `KnowledgeNodePicker` component, and inside the component the actual text input is a sibling of a hidden input and (conditionally) a checkbox. The label's `for`/wrapping association does not reliably bind to the inner filter input. The "Include archived" checkbox has its own wrapping label, which is correct. A placeholder is not a label.
- **Expected**: The filter input has a programmatic label.
- **Fix**: Add an `aria-label` to the filter input (e.g. `aria-label="Search knowledge nodes"`) or accept a `label` prop and render a real `<label>` inside the component.

### MINOR: New-course form omits the seed summary; user cannot confirm what was created

- **File**: apps/hangar/src/routes/(app)/courses/+page.server.ts:108-117
- **Problem**: `createCourse` runs `runCourseSeed(slug)`, which returns a `summary` (rows scanned / written / unchanged), then immediately `redirect(303, ...)` to the course editor. The `.banner-ok` style is defined in the index page CSS (lines 174-178) but never used - there is no success surface on the index at all. On the destination editor page, the redirect lands with no `form` state, so the user sees the editor with no confirmation that the course was created or seeded. design.md "data flow" step 5a says "on success: return summary, render banner." The summary is computed and discarded.
- **Expected**: After create, the user sees a confirmation that the course was created (and ideally the seed result).
- **Fix**: Either render a success banner on the editor page after the redirect (pass a flag via query param the editor reads) or surface the summary inline before redirecting. At minimum, remove the dead `.banner-ok` rule from the index CSS if no success banner will ever render there.

### MINOR: Hangar new-course status select offers only Draft/Active; spec lists three

- **File**: apps/hangar/src/routes/(app)/courses/+page.svelte:83-88
- **Problem**: The "Initial status" `<select>` in the create form offers Draft and Active only. The server (`createCourse`, +page.server.ts:87-89) accepts any of `COURSE_STATUS_VALUES` including `archived` and the spec validation table says course status is "One of draft / active / archived". Creating a course in `archived` state is an odd workflow, so omitting it from the UI is defensible - but it is an undocumented UI/spec divergence. Either is fine; it should be consistent and intentional.
- **Expected**: The UI status choices match the spec, or the spec records that new courses can only be created as draft/active.
- **Fix**: Add an Archived option for parity, or note in spec.md that the create form intentionally restricts to draft/active (archived is reachable via the manifest editor, which does offer all three).

### NIT: Goal composer page header says "Courses" block, spec/test-plan say "tab"

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:249-300
- **Problem**: Confirmed drift already noted in the sign-off review. spec.md and test-plan.md (CRE-11 "Three tabs visible: Syllabi, Ad-hoc nodes, Courses") describe the goal composer as tabbed; the implementation renders three stacked `<section class="block">` elements (Syllabi, Knowledge nodes, Courses). The block layout is consistent with the existing Syllabi/Nodes sections and is a reasonable choice - the drift is in the spec wording, not a UX defect. This is the only confirmed instance of the tab/block naming drift; the other drifts in this review are distinct issues.
- **Expected**: spec.md and test-plan.md updated to say "block"/"section" instead of "tab", or a one-line note recording the decision.
- **Fix**: Amend the spec wording (the implementation is fine as-is).

### NIT: Course index "no goal" banner CTA only offers goal creation, not adding courses

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:33-41
- **Problem**: The "No primary goal set" banner links to "Create a goal". After a user creates a goal, they still have to discover that adding courses to it happens on the goal detail page's Courses block - the courses index never tells them. Combined with the missing add-to-goal action on the course detail page (MAJOR above), the flow from "I see a course I want" to "it is in my goal" is not discoverable from any course-surface page.
- **Expected**: Once the add-to-goal action exists on the detail page, this is mostly resolved. The banner copy could also mention that adding courses happens per-goal.
- **Fix**: Lower priority - resolving the detail-page MAJOR covers the core flow. Optionally tweak the banner copy.

### NIT: Step reader missing-node and skeleton placeholders are center-aligned dashed boxes; inconsistent with the EmptyState component used elsewhere

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:65-73 (`.missing-node`)
- **Problem**: The course index, course detail, hangar index, and hangar editors all use the shared `@ab/ui` `EmptyState` component for "nothing here" states. The step reader rolls its own `.missing-node` dashed-border centered box for the two analogous states ("no knowledge node linked" and "content authoring in progress"). The result is two visually different empty-state treatments within the same feature.
- **Expected**: Consistent empty/placeholder styling across the feature.
- **Fix**: Use `EmptyState` for the missing-node and skeleton cases, or accept the bespoke box and document why the step reader needs a distinct treatment.
