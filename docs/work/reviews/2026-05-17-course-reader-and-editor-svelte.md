---
feature: course-reader-and-editor
category: svelte
date: 2026-05-17
branch: main
issues_found: 6
critical: 0
major: 0
minor: 3
nit: 3
---

## Summary

The Course Reader and Editor file set is clean Svelte 5: every component uses runes (`$props`, `$state`, `$derived`, `$derived.by`, `$bindable`), `$app/state` (not `$app/stores`), snippets instead of slots, and callback props instead of `createEventDispatcher`. No `export let`, no `$:`, no `<slot>`, no Svelte 4 stores anywhere in scope. Reactivity is correct -- `$derived` values are pure, no effects (none are needed in this file set), and `{#each}` blocks are keyed. The findings below are all minor or nit: a couple of shared-state reuse hazards in the hangar section editor, one route file carrying a meaningful amount of visual CSS, and a small style-extraction observation.

## Issues

### MINOR: Section editor reuses one `KnowledgeNodePicker` instance across edit rows -- internal filter state leaks

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:125, 170
- **Problem**: The page mounts `<KnowledgeNodePicker>` in two places (the add-step form and the per-row edit form), and both bind to the same `pickerValue` state. The picker holds private `$state` -- `filterText`, `includeArchived`, `showDropdown` (KnowledgeNodePicker.svelte:29-31). The `{#each leafSteps as step (step.code)}` loop renders the edit form inside the matched row, but because the edit form is gated by `{#if editingStepCode === step.code}` only one row's form exists at a time and Svelte reuses the same component instance position when `editingStepCode` switches from one code to another. The picker's `filterText`/`showDropdown` from editing step A carry over when the author clicks Edit on step B. `startEdit` resets `pickerValue` but cannot reach the picker's internal filter state. The author sees a stale open dropdown / stale search term on the next row.
- **Fix**: Wrap the per-row edit picker in `{#key editingStepCode}` so the picker remounts fresh when the edited row changes:

  ```svelte
  {#key editingStepCode}
    <KnowledgeNodePicker nodes={pickerNodes} bind:value={pickerValue} />
  {/key}
  ```

  Or move the edit form out of the `{#each}` and key it explicitly. Either remounts the picker and clears its private state on row switch.

### MINOR: `showAddStep` and `editingStepCode` can be active simultaneously -- two pickers bind the same `pickerValue`

- **File**: apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte:96-104, 125, 170
- **Problem**: `showAddStep` (toggled by the Add step button) and `editingStepCode` (set by a row's Edit button) are independent state. Nothing closes the add-step form when the author clicks Edit on a row, so both the add-step picker (line 125) and an edit-row picker (line 170) can be mounted at once, both `bind:value={pickerValue}`. Selecting a node in one silently changes the other's displayed selection, and whichever form the author submits picks up `pickerValue` from the last interaction with either picker. The two forms also each carry their own `code`/`ordinal`/`title` inputs, so the shared picker value is the only cross-contamination, but it is a real one.
- **Fix**: Make the two forms mutually exclusive. In `startEdit`, also set `showAddStep = false`; in the Add step `onclick`, also set `editingStepCode = null`. That guarantees a single picker is mounted and `pickerValue` belongs to exactly one form.

### MINOR: `courses/[slug]/[stepCode]/+page.svelte` carries substantial visual CSS for the child-card UI

- **File**: apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte:108-278
- **Problem**: The Svelte checklist's "CSS in Route Files" rule says route files should hold only layout/flow CSS -- grid, flex, gap, positioning. This route file has ~170 lines of `<style>`, and a large share is visual: badge backgrounds and borders (`.cert-chip`, `.child-badge`, `.level-section`, `.level-lesson`), card surfaces (`.framing`, `.missing-node`, `.child-card`), pill radii, text-transform/letter-spacing, hover transitions. The `.child-card` / `.child-link` / `.child-badge` block in particular is a self-contained "child step card" visual component rendered inside an `{#each}` -- it is a component, not page layout. The sibling `courses/[slug]/+page.svelte` has the same pattern at larger scale (~300 lines of `<style>`, the `treeNode`/`leafItem` snippets are effectively a `CourseTree` component inlined into the route). The design.md component list even names `CourseTree.svelte` and `CertOverlayChips.svelte` as intended components; the build collapsed them into the route's `<style>` and snippets instead.
- **Fix**: Extract the repeated card/badge visuals into `libs/ui/` or `apps/study/src/lib/components/` components driven by design tokens (the design doc's `CourseTree`, `CertOverlayChips` were the planned homes). The route file keeps only the page-level flex/grid/gap. This is a non-blocking cleanup -- the CSS already uses tokens correctly, so it is correct, just misplaced.

### NIT: `EncodedTextLadderTabs` `{#each}` key uses the item value itself

- **File**: apps/study/src/lib/components/EncodedTextLadderTabs.svelte:16
- **Problem**: `{#each ENCODED_TEXT_LADDER_TABS as tab (tab)}` keys on the string value. For a static, never-reordered three-element constant this is harmless and even idiomatic, but a string-value key is fragile if the array ever gains duplicate entries. Not a bug today.
- **Fix**: Leave as-is, or key on index for a static list (`(tab, i) (i)`). No action required -- noting only for completeness against the checklist's "key expression" item.

### NIT: `CourseStepChart` reads `import.meta.env.DEV` with a `?? false` fallback that can never trigger

- **File**: apps/study/src/lib/components/CourseStepChart.svelte:26
- **Problem**: `const isDev = import.meta.env.DEV ?? false;` -- `import.meta.env.DEV` is always a boolean under Vite (true in dev/test, false in prod), so the `?? false` branch is dead. The accompanying comment explains the choice to avoid `$app/environment` for testability, which is sound; the nullish coalesce is just redundant defensive code.
- **Fix**: `const isDev = import.meta.env.DEV;` -- the type is already `boolean`. Minor tidy; harmless as written.

### NIT: `headingLevel` cast pattern repeats a 5-branch `{#if}` ladder for one heading element

- **File**: apps/study/src/routes/(app)/courses/[slug]/+page.svelte:67-119
- **Problem**: `treeNode` renders the node title heading via a five-branch `{#if hLevel === 2}...{:else if hLevel === 3}...` chain, each branch an identical `<hN class="node-title"><a .../></hN>`. This is correct Svelte (element tag names cannot be dynamic in markup), and the `headingLevel` helper with its narrowed `2|3|4|5|6` return type is sound. It is verbose but not wrong. A `<svelte:element this={`h${hLevel}`}>` would collapse the five branches into one.
- **Fix**: Optional -- replace the ladder with `<svelte:element this={'h' + hLevel} class="node-title">`. Svelte 5 supports dynamic elements via `<svelte:element>`, and `hLevel` is already a constrained union. Purely a readability improvement; the current code behaves correctly.

## Notes (no action)

- `KnowledgeNodeBody.svelte` correctly declares `Props` with an optional `ariaLabel` defaulted in the destructure, exports its `NodeBodyPhase` interface for the loader contract, and uses snippet-free composition. Good.
- `KnowledgeNodePicker.svelte` uses `$bindable('')` correctly for the two-way `value` prop and `$derived.by` for the filtered list with a `.slice(0, 50)` cap -- pure derivation, no effect. Good.
- `knowledge-node-picker-types.ts` is correctly named `.ts` (not `.svelte.ts`): it contains only a type, no runes. Correct.
- `CourseStepMarkdown.svelte` (used by `KnowledgeNodeBody`, `TransitionStepBody`, and the step reader) wraps `parseMarkdownSync` in `$derived.by` with a try/catch returning a discriminated union -- correct pure-derivation pattern, no effect needed.
- All six route files keep load logic in `+page.server.ts` and use `$derived(data.x)` aliases in the page component -- correct SvelteKit layering. Form actions use plain `method="POST"` forms; `use:enhance` is not applied, but the spec/design call for full-page-reload banner UX (matching the existing goal composer pattern), so the absence of `enhance` is a deliberate match to the established pattern, not a defect.
- `program/goals/[id]/+page.svelte` Courses tab section mirrors the existing Syllabi/Nodes blocks exactly -- consistent, keyed `{#each}`, no reactivity issues.
</content>
</invoke>
