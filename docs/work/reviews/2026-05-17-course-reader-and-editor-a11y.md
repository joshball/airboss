---
feature: course-reader-and-editor
category: a11y
date: 2026-05-17
branch: main
issues_found: 18
critical: 2
major: 6
minor: 7
nit: 3
---

## Summary

The CRE file set is generally well-structured for accessibility: landmarks (`<nav>`, `<header>`, `<section>`), real `<button>`/`<a>` elements, semantic lists, `<table>` with `<th scope>`, and labelled form controls are used throughout. Heading hierarchy is largely correct and progressbar ARIA on the mastery bars is well done.

Two areas are genuinely broken for keyboard and screen-reader users. The hangar `KnowledgeNodePicker` combobox is built as a free-typed text input with a `role="listbox"` dropdown that has zero keyboard support (no arrow keys, no Escape, no `aria-activedescendant`, no outside-click dismiss) and a `role="listbox"` on a `<ul>` of `<button>`s -- a malformed ARIA pattern. Several dynamically-revealed forms (hangar create-course, add-section, add-step, inline step edit, knowledge-node picker selection) move no focus when they appear, and form-level success/error banners are not announced because they are not in a live region at render time. The encoded-text ladder strip is correctly inert per OUT-OF-SCOPE so no tablist ARIA is expected there.

## Issues

### CRITICAL: Knowledge-node picker dropdown has no keyboard support

- **File**: apps/hangar/src/lib/components/KnowledgeNodePicker.svelte:73-104
- **WCAG**: 2.1.1 Keyboard, 4.1.2 Name/Role/Value
- **Problem**: The picker is the step editor's primary control for linking a `knowledge_node_id`. It is a text input that opens a `<ul role="listbox">` of `<button>` items on focus. A keyboard user can type into the input but cannot navigate the results: there is no `ArrowDown`/`ArrowUp` handling, no `Enter`-to-select on the highlighted option, no `aria-activedescendant`, and no `Escape` to dismiss. The only way to pick a node is a mouse click on a `.dropdown-item` button. Worse, `showDropdown` is only ever set `true` (on `onfocus`) and never reset, so once opened the listbox never closes (no outside-click handler, no blur handler, no Escape). A keyboard-only or screen-reader user cannot complete CRE-26 (add step with node picker).
- **Fix**: Implement the WAI-ARIA combobox pattern. Put `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` on the text input; give each result a stable `id` and `role="option"` (on the `<li>`, not a nested `<button>`). Add `onkeydown` handling for `ArrowDown`/`ArrowUp` (move active option), `Enter` (select active), `Escape` (close + clear active), and `Home`/`End`. Add an outside-click / focusout handler to set `showDropdown = false`. Track an `activeIndex` `$state`. Selection on click stays, but click is no longer the only path.

### CRITICAL: `role="listbox"` wraps focusable `<button>` children -- invalid ARIA

- **File**: apps/hangar/src/lib/components/KnowledgeNodePicker.svelte:85-99
- **WCAG**: 4.1.2 Name/Role/Value, 1.3.1 Info and Relationships
- **Problem**: `<ul class="dropdown" role="listbox">` contains `<li>` wrappers each holding a `<button role>`-less `<button>`. A `listbox` must contain `option`-role children only; interactive descendants (buttons, links) inside `option`s break the role mapping. Screen readers will announce the structure inconsistently -- some will expose the buttons as separate stops, some will swallow them under the listbox, and the option count / position-in-set is lost entirely. The `.empty` `<li>` ("No nodes match the filter.") is also an invalid listbox child.
- **Fix**: Either (a) drop `role="listbox"` and treat the dropdown as a plain menu of buttons (simplest, but then it is not a combobox), or (b) commit to the combobox pattern: `<ul role="listbox">` with `<li role="option" id="..." aria-selected={...}>` and no nested button -- make the `<li>` itself the selectable element driven by `aria-activedescendant` from the input. Move the "no matches" message out of the listbox into a sibling `aria-live` status node.

### MAJOR: Revealed forms do not receive focus

- **File**: apps/hangar/src/routes/(app)/courses/+page.svelte:52-93, apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte:77-106, apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:96-135 and 151-180
- **WCAG**: 2.4.3 Focus Order, 3.2.2 On Input
- **Problem**: "New course", "Add section", "Add step", and the inline "Edit" step toggle all flip a `$state` boolean to render a form inline. Focus stays on the trigger button. A keyboard user must hunt forward through the DOM to find the newly-revealed first field; a screen-reader user gets no signal that a form appeared. For the inline step edit, the toggled form replaces the display row in place, so the previously-focused "Edit" button is destroyed and focus is lost to `<body>`.
- **Fix**: After toggling the form open, move focus to its first input. Bind the first field with a ref and call `.focus()` in an `$effect` keyed on the open-state boolean (e.g. `$effect(() => { if (showAddStep) firstField?.focus(); })`). For the inline edit, focus the first edit field on open and return focus to the Edit button (or the next logical control) on cancel/save.

### MAJOR: Form success/error banners are not announced on render

- **File**: apps/hangar/src/routes/(app)/courses/+page.svelte:58-60, apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte:42-46, apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:60-64, apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:86-88
- **WCAG**: 4.1.3 Status Messages
- **Problem**: After a form action the page re-renders with `{#if form?.error}` / `{#if form?.success}` adding a `<p role="alert">` or `<p role="status">`. `role="alert"` and `role="status"` only announce content that changes *while the live region already exists in the DOM*. Because the element is conditionally created on the same render that carries the message, many screen readers (notably VoiceOver + Safari and NVDA in some modes) will not announce it -- the live region must be present and empty *before* the update. The result of CRE-13/15/22/24/30 (rejection banners) and CRE-12/14/16/23 (success banners) is silent for SR users.
- **Fix**: Render the live-region container unconditionally and toggle only its inner content: `<div aria-live="assertive" role="alert">{#if form?.error}{form.error}{/if}</div>` (and a separate `aria-live="polite"` node for success). Alternatively, move focus to the banner after the action completes.

### MAJOR: Knowledge-node selection / clear changes UI with no focus management or announcement

- **File**: apps/hangar/src/lib/components/KnowledgeNodePicker.svelte:52-56 and 70
- **WCAG**: 2.4.3 Focus Order, 4.1.3 Status Messages
- **Problem**: `selectNode()` swaps the search input + dropdown for the `.selected` summary block; the "Change" button (line 70) swaps it back to the search input. Each swap destroys the element that had focus (the clicked `.dropdown-item`, or the "Change" button) and focus falls to `<body>`. A screen-reader user gets no confirmation that a node was selected or cleared.
- **Fix**: On `selectNode()`, move focus to the "Change" button (or announce the selection via an `aria-live` node). On clear, move focus back to the `.filter-input`. Add a visually-hidden `aria-live="polite"` status node that states "Selected: {title}" / "Selection cleared".

### MAJOR: Filter `<select>` auto-submits on change -- unexpected context change

- **File**: apps/hangar/src/routes/(app)/courses/+page.svelte:98-109
- **WCAG**: 3.2.2 On Input
- **Problem**: The status filter `<select>` calls `e.currentTarget.form.submit()` in `onchange`, navigating the page. Keyboard users selecting an `<option>` with arrow keys fire `change` on every intermediate option, triggering navigation before they reach their intended choice. There is also no submit button as a fallback, and `form.submit()` bypasses any SvelteKit enhancement.
- **Fix**: Add a visible "Apply" submit button and remove the `onchange` auto-submit, or keep auto-submit but debounce it / only fire on a committed selection. The accessible baseline is a real submit button so keyboard arrow-navigation through options does not navigate.

### MAJOR: Native disabled/required state on section "Code" field not conveyed beyond visual

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:70-81, and required inputs across all hangar/goal forms
- **WCAG**: 3.3.2 Labels or Instructions, 1.3.1 Info and Relationships
- **Problem**: Required fields across the editor and goal-composer forms (`title`, `code`, `ordinal`, etc.) use the `required` attribute but carry no visible "required" indicator and no `aria-required` reinforcement -- a sighted user has no cue which fields are mandatory until submit fails, and the browser's native validation bubble is the only error surface (not associated via `aria-describedby`). The disabled Code input on the section editor (line 72) has a `<label>` but the disabled state communicates "you cannot edit this" only through greyed styling.
- **Fix**: Add a visible required marker (e.g. `*` with a legend, or the word "required") to each mandatory field's label, and pair server-side validation errors with the field via `aria-describedby` pointing at an error node. For the disabled Code field, add explanatory help text (e.g. "Code is fixed once a section is created") associated via `aria-describedby` so the reason is not visual-only.

### MINOR: Heading hierarchy skips a level on the step reader children path

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:46, 81, 92
- **WCAG**: 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
- **Problem**: The step reader renders `<h1>` (step title, line 46), then `<h2 class="children-h">` (line 81), then each child card uses `<h3 class="child-title">` (line 92) -- that path is fine. But on the leaf path, `KnowledgeNodeBody` renders each phase title as `<h3>` (KnowledgeNodeBody.svelte:50) with no intervening `<h2>`. The leaf branch goes `<h1>` step title -> `<h3>` phase title, skipping `<h2>`. The reference knowledge page wraps `KnowledgeNodeBody` in a `<section><h2>Content phases</h2>` (line 333) so it is correct there, but the step reader calls `<KnowledgeNodeBody>` directly with no `<h2>` ancestor.
- **Fix**: Wrap the `KnowledgeNodeBody` call in the step reader's leaf branch in a section with an `<h2>` (e.g. "Content"), matching the reference page, or make `KnowledgeNodeBody` emit `<h2>` for phase titles and let callers supply the surrounding `<h1>`/`<h2>` consistently.

### MINOR: Skeleton-node placeholder heading is an `<h2>` directly under `<h1>` but live phase content is `<h3>`

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:69-73
- **WCAG**: 1.3.1 Info and Relationships
- **Problem**: The `isNodeSkeleton` branch renders `<h2>{node.title}</h2>`, but the normal `KnowledgeNodeBody` branch (same visual slot) renders phase `<h3>`s with no `<h2>`. The heading level for "the node body region" is inconsistent depending on node state, which confuses heading-navigation users moving between steps.
- **Fix**: Pick one level for the node-body region heading and use it in both the skeleton and the populated branches (resolve together with the previous finding).

### MINOR: `<details>`/`<summary>` body preview has no programmatic name distinguishing rows

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:193-196
- **WCAG**: 2.4.6 Headings and Labels
- **Problem**: Each step row's body preview is a `<details><summary>Body ({n} chars)</summary>`. With multiple steps, a screen-reader user navigating by interactive element hears "Body (120 chars)" repeatedly with no association to which step. The summary text is identical-shaped across rows.
- **Fix**: Include the step code or title in the summary, e.g. `Body for {step.code} ({n} chars)`, or add `aria-label` on the `<details>` / `<summary>` naming the parent step.

### MINOR: Mastery bar `aria-valuemax` is the leaf count, not a percentage -- `aria-valuetext` missing

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:76-88, apps/study/src/routes/(app)/courses/[slug]/+page.svelte:185-197
- **WCAG**: 1.3.1 Info and Relationships, 4.1.2 Name/Role/Value
- **Problem**: The course-index and detail progressbars set `aria-valuemin="0"`, `aria-valuemax={totalLeaves}`, `aria-valuenow={masteredLeaves}`. That is valid, but with no `aria-valuetext` a screen reader announces a bare ratio like "3 of 12" with no unit context ("mastered leaves"). The reference knowledge page (`[slug]/+page.svelte:204-213`) does this correctly with `aria-valuetext`. The two CRE progressbars are inconsistent with that good example.
- **Fix**: Add `aria-valuetext` to both CRE progressbars, e.g. `aria-valuetext="{masteredLeaves} of {totalLeaves} leaves mastered"`.

### MINOR: Card link wraps an `<h2>` -- heading is inside the link's accessible name

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:52-90
- **WCAG**: 2.4.4 Link Purpose, 1.3.1 Info and Relationships
- **Problem**: Each course card is `<a class="card-link">` wrapping `<header>`, `<h2 class="title">`, description, stats, and the progressbar. The entire card content becomes one link's accessible name, so a screen reader announces a long run-on string ("active In goal Seed-Smoke Course Fixture {description} Mastered 3 / 12 ..."). The `<h2>` inside an `<a>` is technically valid but the heading no longer functions as a navigation landmark since activating it navigates. The progressbar inside the link is also read as part of the link name.
- **Fix**: Restructure so the `<h2>` contains the link (`<h2><a href>{title}</a></h2>`) and the status badge, stats, and progressbar sit outside the anchor as siblings within the card. This keeps the heading list usable and shortens the link name to just the course title.

### MINOR: Course-detail node-link nested inside heading repeats the title-link pattern

- **File**: apps/study/src/routes/(app)/courses/[slug]/+page.svelte:99-119
- **WCAG**: 2.4.4 Link Purpose (acceptable but suboptimal)
- **Problem**: This one is actually done correctly (`<h2><a class="node-link">{title}</a></h2>`) -- noting it only to contrast with the index card finding above; the index page should mirror this structure. No fix needed here; flagged so the convergent fix is applied to the index, not this file.
- **Fix**: None for this file. Apply the heading-wraps-link structure from here to `courses/+page.svelte`.

### MINOR: Goal-composer breadcrumb separator is a bare `<span>/`, detail-page crumb uses CSS `::before`

- **File**: apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:51-55
- **WCAG**: 1.3.1 Info and Relationships
- **Problem**: The goal page breadcrumb is a `<nav><a>...<span aria-hidden>/</span><span>...` flat structure, while the course detail and step reader use a proper `<ol class="crumb">` with the `/` injected via CSS `::before` (decorative, correctly invisible to AT). The goal page version is not a list, so the breadcrumb trail has no item count / position. It is `aria-hidden` on the slash which is correct, but the inconsistency means the goal page breadcrumb is a weaker structure than the CRE pages it sits alongside.
- **Fix**: Convert the goal-page breadcrumb to the `<ol class="crumb">` list pattern used by `courses/[slug]/+page.svelte` and the `Breadcrumbs.svelte` component for consistency and correct list semantics.

### NIT: Chart image alt text duplicates the figure aria-label and exposes a raw slug

- **File**: apps/study/src/lib/components/CourseStepChart.svelte:34-35
- **WCAG**: 1.1.1 Non-text Content
- **Problem**: `<figure aria-label={`Chart: ${slug}`}>` contains `<img alt={`Chart ${slug}`}>`. The slug is a path-shaped id (`wx-scenarios/<id>/<kind>`) -- not meaningful alt text for a learner, and the figure's `aria-label` plus the img `alt` produce near-duplicate announcements. A weather chart is informative content; "Chart wx-scenarios/abc/sfc-analysis" tells a non-sighted user nothing about the chart.
- **Fix**: This is a placeholder stub WP, so a perfect alt is out of scope, but at minimum drop the redundant `aria-label` on the `<figure>` (the `<figcaption>` or `<img alt>` is sufficient) and make the `alt` human-readable (e.g. "Weather chart" until real chart metadata exists). Track meaningful per-chart alt text with the real chart-rendering WP.

### NIT: Encoded-text ladder tabs are styled like interactive tabs but are inert `<li>`s

- **File**: apps/study/src/lib/components/EncodedTextLadderTabs.svelte:13-24
- **WCAG**: 1.3.1 Info and Relationships (advisory)
- **Problem**: The Decode/Understand/Triage items render as pill-shaped `<li class="tab">` elements inside `role="list"`. They are correctly *not* interactive (OUT-OF-SCOPE.md defers per-tab content), and using `<li>` rather than `role="tab"` is the right call -- a `tablist` with no controllable panels would be a worse lie. The only risk is purely visual: the pill styling strongly signals "clickable tab" so a sighted user may try to click them and get no feedback. Not an ARIA defect.
- **Fix**: Optional -- soften the pill styling so the items do not read as buttons, or add a visually-muted cue. The `.ladder-note` already explains "authored per-tab content is on the roadmap", which mitigates this. Acceptable as-is; flagged only so the styling/affordance mismatch is a conscious choice.

### NIT: No `prefers-reduced-motion` guard on hover transitions

- **File**: apps/study/src/routes/(app)/courses/+page.svelte:144, apps/study/src/routes/(app)/courses/[slug]/+page.svelte:460, apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:215, PrevNext.svelte:68
- **WCAG**: 2.3.3 Animation from Interactions (AAA -- advisory at AA)
- **Problem**: Cards and links use `transition: border-color var(--motion-fast) ease`. These are tiny, purpose-built (hover affordance) and short, so the risk is minimal -- this is below the AA bar. Noted for completeness: there is no project-wide `@media (prefers-reduced-motion: reduce)` reset and these components do not opt in individually.
- **Fix**: Optional. A global `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }` in the theme layer would cover every surface at once; preferable to per-component guards. Not blocking for this WP.

## Notes on what is correct

- Landmarks: `<nav aria-label="Breadcrumb">`, `<section aria-label>`/`aria-labelledby`, `<header>`, `<aside>` are used consistently and correctly.
- Tables: hangar index and course-editor tables use `<thead>`/`<th scope="col">` correctly for tabular data.
- `aria-current="page"` is correctly applied to the final breadcrumb item on every breadcrumb.
- Real `<button>` (with `type="button"` / `type="submit"`) and real `<a>` elements are used for actions vs navigation -- no `<div onclick>`.
- The destructive flows (delete section, delete step, delete course) use real confirm steps; the course delete uses a two-step in-page confirm rather than a modal, sidestepping focus-trap requirements.
- Progressbar role on the reference knowledge page (`reference/knowledge/[slug]`) is exemplary (`aria-valuetext` included) -- it is the pattern the two CRE progressbars should copy.
- `CourseStepMarkdown` parse-error surface correctly uses `role="alert"` and is rendered conditionally, but because a parse error is a load-time author mistake (not a live status change) the conditional render is acceptable there.
</content>
</invoke>
