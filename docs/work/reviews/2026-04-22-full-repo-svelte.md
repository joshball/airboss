---
feature: full-repo
category: svelte
date: 2026-04-22
branch: main
issues_found: 9
critical: 0
major: 3
minor: 4
nit: 2
---

## Summary

The codebase is Svelte 5 clean at the syntax level: zero `export let`, zero `$:`, zero `<slot>`, zero `$app/stores`, zero `svelte/store` imports, zero `createEventDispatcher`, every `{#each}` is keyed, every component uses `$props()` destructuring with defaults, and callback-prop patterns are used consistently instead of event dispatchers. `bind:value` only appears on inputs and on `$bindable()` primitives in `libs/ui`. `+page.ts` files load from client-safe registries (`@ab/aviation`, `@ab/help`, `@ab/bc-sim`); no DB or secrets leak into universal loads. The load-bearing issues are all in `$effect` usage: two components reset state when a prop changes (erasing user interaction on parent rerender), and a couple of effects mutate state that belongs in an event handler or `$derived`. A separate propagatable issue is the amount of visual CSS living in `+page.svelte` files instead of `libs/ui` primitives.

## Propagatable Patterns (top priority)

These are the patterns most likely to be copied into future components. Fix them once, at the root, before they spread.

1. `$effect(() => { state = propOrDerived; })` to seed state (HelpSection.svelte:31, HelpLayout.svelte:25). This is not "seed once" -- the effect reruns on every prop change, clobbering user interaction. Correct pattern is `let state = $state(prop)` with the existing `svelte-ignore state_referenced_locally` annotation, or a `{#key}` block.
2. Visual CSS in route files. Every +page.svelte in apps/study has 130-570 lines of `<style>` defining banners, buttons, cards, form fields, badges, chips, sub-text. Primitives like `Card`, `Banner`, `Button`, `TextField`, `Badge`, `StatTile`, `ConfirmAction` already exist in `libs/ui` but route files reimplement them inline. See `apps/study/src/routes/(app)/memory/new/+page.svelte:187-386` for a representative example.
3. `$effect` for "derived reset on slot change" (sessions/[id]/+page.svelte:43, knowledge/[slug]/learn/+page.svelte:47). Writing state from inside an effect whose dep is a server-returned key is a pattern that should either live in a `{#key}` block (remount) or be recomputed lazily in `$derived`. The current pattern works but propagates the idea that `$effect` is the right tool for "recompute state when X changes" -- `$derived` is the right tool.
4. `$effect` for URL mirroring (memory/[id]/+page.svelte:39, sessions/[id]/+page.svelte:58, knowledge/[slug]/learn/+page.svelte:36, plans/[id]/+page.svelte:40). These are legitimate side-effects and are well-commented, but the pattern is verbose and repeated. Worth extracting a `useUrlMirror(paramName, value)` helper in `.svelte.ts` form so the contract is one function call and the dependency/guard story lives in one place.
5. `tooltipId = $state(\`ref-tt-${Math.random()...}\`)` in ReferenceTerm.svelte:37 -- immutable data wrapped in `$state`. Not a bug, but if copied into peer components (and there are already three sibling files that could) it normalizes spurious reactive overhead for constant values.

## Issues

### MAJOR: $effect overwrites user-toggled state when prop changes

- **File**: libs/help/src/ui/HelpSection.svelte:30-33
- **Problem**: The effect reads `startExpanded` and assigns it to `expanded`, so any time the parent rerenders (e.g. scroll-tracked activeId change in HelpLayout) with the same or a new value, the user's collapse/expand toggle is reset. The comment claims "capturing startExpanded once is intentional" but the code does not implement capture-once -- `$effect` re-fires on dep change. The bug will manifest the moment HelpSection is instantiated inside anything that rerenders (which is all current usages).
- **Fix**: seed the state directly with the prop and accept the `state_referenced_locally` warning as intentional.

  ```svelte
  // before
  let expanded = $state(false);
  $effect(() => {
  	expanded = startExpanded;
  });

  // after
  // svelte-ignore state_referenced_locally -- prop is an initial value, not a reactive controller
  let expanded = $state(startExpanded);
  ```

### MAJOR: $effect resets active TOC highlight on every sections change

- **File**: libs/help/src/ui/HelpLayout.svelte:25-28
- **Problem**: `$effect(() => { activeId = sections[0]?.id ?? null; })` reruns whenever `sections` (a `$derived(page.sections)`) changes -- but `sections` is a derivation over a prop, so any prop-level rerender of the parent wipes the user's scroll-tracked `activeId` back to the first section. The intent ("reset when the page itself changes") is sound; the implementation ties reset to a value that tracks more than that.
- **Fix**: key the reset to `page.id` (stable identity) or wrap the whole `HelpLayout` body in `{#key page.id}` so the `activeId` `$state` is fresh per page, removing the effect entirely.

  ```svelte
  <!-- before -->
  let activeId = $state<string | null>(null);
  const sections = $derived(page.sections);
  $effect(() => { activeId = sections[0]?.id ?? null; });

  <!-- after: initialize once per page mount -->
  // svelte-ignore state_referenced_locally
  let activeId = $state<string | null>(page.sections[0]?.id ?? null);
  // outer {#key page.id}...{/key} ensures fresh state when page changes
  ```

### MAJOR: Visual CSS duplicated across route files instead of libs/ui primitives

- **File**: apps/study/src/routes/(app)/**/+page.svelte (20 files; worst offenders: calibration/+page.svelte 567 style lines, session/start/+page.svelte 439, reps/browse/+page.svelte 383, knowledge/[slug]/+page.svelte 378, memory/[id]/+page.svelte 364)
- **Problem**: DESIGN_PRINCIPLES and MULTI_PRODUCT_ARCHITECTURE call for CSS in route files to be layout-only, with visual styling (buttons, banners, cards, chips, badges, tiles, form fields) in `libs/ui`. The route files re-implement button, banner, card, chip, badge, and form-field styling inline. `libs/ui` already exposes Banner, Button, Card, ConfidenceSlider, ConfirmAction, KbdHint, PanelShell, Select, StatTile, TextField, Badge that these pages could use. This is a propagation risk: new pages copy the nearest existing page and inherit 300+ lines of hand-rolled CSS.
- **Fix**: one page at a time, replace inline buttons/banners/fields with the `@ab/ui` primitives, keeping only grid/layout rules in the page `<style>`. Convergent with any in-flight token-migration work -- coordinate so the two passes do not collide. Budget this as its own work package; do not fold it into unrelated feature PRs.

### MINOR: $effect resets derived state that should live in $derived + {#key}

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:43-53
- **Problem**: The effect tracks `current` and `data.session.id`, computes a slot key, and resets five pieces of state when the key changes. The guard (`if (key !== lastSlotKey)`) prevents an infinite loop but the pattern treats `$effect` as "recompute these when server data changes" -- that is the job of `$derived` or a remount. Copying this into future multi-step flows will grow the list of reset fields until someone forgets one and state bleeds across items.
- **Fix**: wrap the per-slot UI region in `{#key current?.slotIndex ?? -1}` so phase / confidence / selectedOption / loading get fresh `$state` on every slot advance, and drop the effect and the `lastSlotKey` bookkeeping.

### MINOR: $effect mutates visited-set + fires side-effect instead of event handler

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:47-52
- **Problem**: The effect reads `currentPhase`, reads `visitedPhases`, writes `visitedPhases`, and issues a `fetch`. Guarded so no infinite loop, but the "record a visit" action is caused by navigation (`prev` / `next` / direct step change) -- it belongs in the event handlers that change `currentPhase`, not in an effect that watches `currentPhase`. The effect shape conflates "state derived from phase" with "network request because user navigated."
- **Fix**: move the `visitedPhases` update + `recordVisit(phase)` call into the functions that assign `currentPhase` (the prev/next and the URL-driven init). The initial visit can fire once in `onMount` if the deep-link lands the user inside an unvisited phase.

### MINOR: $effect reads results it does not depend on reliably

- **File**: libs/help/src/ui/HelpSearchPalette.svelte:38-42
- **Problem**: The comment says "we depend on rawQuery (not results) so the effect never reads state it writes" but the body reads `results.aviation.length` and `results.help.length`, and `results` is a `$derived(search(rawQuery))`. The effect does depend on `results` transitively. Not a loop (the writes target `focusedIndex` / `focusedBucket`, not `rawQuery` / `results`), but the comment misleads future maintainers about how Svelte 5 tracking actually works, which is exactly the kind of thing that gets copied.
- **Fix**: delete `void rawQuery;` and the misleading comment, keep the body as-is. The effect tracks `results` naturally and behaves correctly.

### MINOR: .svelte.ts file that does not use runes

- **File**: apps/sim/src/lib/stall-horn.svelte.ts
- **Problem**: The file exports a plain class with no `$state` / `$derived` / `$effect`. The `.svelte.ts` extension is the signal to compiler + tooling that the module uses runes; plain classes should be `.ts`. The import in `apps/sim/src/routes/[scenarioId]/+page.svelte:39` (`from '$lib/stall-horn.svelte'`) follows the Svelte 5 convention but masks the mis-naming.
- **Fix**: rename to `stall-horn.ts` and update the import. Zero behavioral change; correct signal.

### NIT: $state used for an immutable tooltip id

- **File**: libs/aviation/src/ui/ReferenceTerm.svelte:37
- **Problem**: `let tooltipId = $state(\`ref-tt-${Math.random().toString(36).slice(2)}\`);` -- the value is assigned once and never changes. `$state` marks this as reactive for no reason.
- **Fix**: `const tooltipId = \`ref-tt-${Math.random().toString(36).slice(2)}\`;`. Consider `crypto.randomUUID()` in browser contexts for better uniqueness guarantees.

### NIT: Seed-from-form pattern silently drops second-submit values

- **File**: apps/study/src/routes/(app)/reps/new/+page.svelte:39-56
- **Problem**: `const seed = form?.values; let title = $state(seed?.title ?? '')` seeds state once at mount from the initial form prop. With `use:enhance`, the component is not remounted on form-action round-trip -- subsequent validation failures update `form` but the local `$state` vars keep whatever the user typed in between. The comment notes this is intentional ("subsequent reactive changes are driven by user typing"), and in practice it preserves the user's in-flight edit across a failed submit, which is the right UX. The nit: this pattern is subtle and the comment does not call out the "second validation failure loses server-returned values" nuance. If a future reviewer copies this pattern into a form that expects form?.values to round-trip as source of truth, they will be confused.
- **Fix**: tighten the comment to name the invariant explicitly: "draft survives validation errors; server-returned `form.values` are only consulted on first render." No code change.
