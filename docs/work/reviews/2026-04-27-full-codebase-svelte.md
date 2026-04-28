---
feature: full-codebase-svelte
category: svelte
date: 2026-04-27
branch: main
issues_found: 13
critical: 0
major: 4
minor: 7
nit: 2
---

## Summary

The codebase is fully on Svelte 5 runes -- a wide grep for Svelte 4 holdovers (`export let`, `$:`, `<slot>`, `svelte/store`, `$app/stores`, `createEventDispatcher`) returned zero matches across 218 `.svelte` / `.svelte.ts` files. Rune usage is consistent and idiomatic in the bulk of the code (1000+ rune call sites). The notable issues are: (1) eight `.svelte.ts` files in `apps/sim/` that contain no runes and should be plain `.ts`; (2) a broken focus-outline declaration in `ConfirmAction`; (3) several pages and lib components carrying substantial visual CSS that belongs in `libs/ui/` token-driven primitives; (4) a recurring "prop -> $state via $effect" sync pattern in app layouts that would be cleaner as `$derived`. No critical reactivity bugs, no infinite-loop effects, no unsafe `{@html}` paths -- every `{@html}` site is fed by an HTML-escaping renderer (`renderMarkdown`, Shiki output, or the controlled `substituteTokens` reference resolver).

## Issues

### MAJOR: Broken `outline` and `outline-offset` syntax in ConfirmAction focus styles

- **File**: libs/ui/src/components/ConfirmAction.svelte:217-218
- **Problem**: The CSS reads `outline: var(2px) solid var(--focus-ring); outline-offset: var(2px);`. `var(2px)` is invalid -- `var()` only accepts custom properties (names beginning with `--`). Browsers will discard both declarations entirely. `ConfirmAction` is the project's destructive-action primitive, so this silently wipes the focus indicator on every Archive / Skip permanently / Finish early button across the app. A11y regression.
- **Fix**: Drop the broken `var(...)` wrapper.

  Before:

  ```css
  .trigger:focus-visible,
  .btn:focus-visible {
      outline: var(2px) solid var(--focus-ring);
      outline-offset: var(2px);
  }
  ```

  After:

  ```css
  .trigger:focus-visible,
  .btn:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
  }
  ```

### MAJOR: 8 `.svelte.ts` files that contain no runes -- should be plain `.ts`

- **Files**:
  - apps/sim/src/lib/engine-sound.svelte.ts
  - apps/sim/src/lib/stall-horn.svelte.ts
  - apps/sim/src/lib/tape-store.svelte.ts
  - apps/sim/src/lib/warning-cues/altitude-alert.svelte.ts
  - apps/sim/src/lib/warning-cues/flap-motor.svelte.ts
  - apps/sim/src/lib/warning-cues/marker-beacon.svelte.ts
  - apps/sim/src/lib/warning-cues/gear-warning.svelte.ts
  - apps/sim/src/lib/warning-cues/ap-disconnect.svelte.ts
- **Problem**: CLAUDE.md and the Svelte 5 best-practices doc say `.svelte.ts` is reserved for files that use runes outside components. These 8 files are pure audio synthesis classes (`EngineSound`, `StallHorn`, ...) and a `sessionStorage` wrapper. They contain zero `$state` / `$derived` / `$effect` / `$props` / `$bindable` calls. The `.svelte.ts` suffix puts the Svelte compiler on the file unnecessarily and signals to readers that the file is reactive, which it isn't. Compare with `apps/sim/src/lib/warning-cues/audio-captions.svelte.ts`, which legitimately uses `private entries = $state<...>([])` -- that one keeps its suffix.
- **Fix**: Rename each of the 8 files from `*.svelte.ts` to `*.ts` and update the imports in their callers (sim cockpit page, debrief, history). Run `bun run check` to catch any missed import.

### MAJOR: Hardcoded color and raw rem/px values in `libs/help/src/ui/HelpSearchPalette.svelte`

- **File**: libs/help/src/ui/HelpSearchPalette.svelte:217-385
- **Problem**: This is a `libs/` component, not a route, so per the Svelte review skill it must be token-driven. The style block contains a literal `rgba(15, 23, 42, 0.4)` for the backdrop (line 221), and many raw `rem` font-sizes / paddings / gaps (`0.75rem`, `0.6875rem`, `1rem`, `0.5rem 1rem`, etc.) that have no token equivalent. The component otherwise uses tokens correctly (`var(--surface-panel)`, `var(--edge-default)`, ...), so the gaps are local rather than systemic.
- **Fix**: Replace the rgba literal with `var(--dialog-scrim)` (or define a new role token if the existing scrim is too dark). Promote the recurring sizes to either existing space/type tokens (`--space-sm`, `--type-ui-caption-size`, ...) or introduce palette-specific component tokens.

### MAJOR: Route files carry substantial visual CSS that belongs in components

- **Files** (each `<style>` block well over the ~5-line guidance, with colors / font-sizes / padding / borders that aren't pure layout):
  - apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte (688 lines of `<style>`)
  - apps/study/src/routes/(app)/calibration/+page.svelte (566 lines)
  - apps/study/src/routes/(app)/session/start/+page.svelte (493 lines)
  - apps/study/src/routes/(app)/memory/[id]/+page.svelte (490 lines)
  - apps/study/src/routes/(app)/memory/+page.svelte (445 lines)
  - apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte (414 lines)
  - apps/study/src/routes/(app)/+layout.svelte (346 lines)
  - apps/study/src/routes/(app)/sessions/[id]/+page.svelte (306 lines)
  - apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte (299 lines)
  - apps/study/src/routes/(app)/reps/new/+page.svelte (279 lines)
  - apps/study/src/routes/(app)/plans/+page.svelte (254 lines)
  - apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte (245 lines)
  - apps/study/src/routes/(app)/dashboard/+page.svelte (229 lines)
  - apps/study/src/routes/(app)/reps/+page.svelte (218 lines)
  - apps/study/src/routes/(app)/plans/[id]/+page.svelte (218 lines)
  - apps/study/src/routes/(app)/plans/new/+page.svelte (204 lines)
  - apps/study/src/routes/(app)/memory/new/+page.svelte (206 lines)
  - apps/study/src/routes/(app)/reps/[id]/+page.svelte (178 lines)
  - apps/study/src/routes/(app)/reps/browse/+page.svelte (167 lines)
  - apps/study/src/routes/(app)/memory/browse/+page.svelte (156 lines)
  - apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte (142 lines)
  - apps/study/src/routes/(app)/glossary/[id]/+page.svelte (135 lines)
  - apps/study/src/routes/login/+page.svelte (122 lines)
  - apps/study/src/routes/(app)/help/+page.svelte (117 lines)
  - apps/study/src/routes/(app)/memory/review/+page.svelte (114 lines)
  - apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/+page.svelte (82 lines)
  - apps/study/src/routes/cards/[id]/+page.svelte (82 lines)
- **Problem**: Per the Svelte review skill, route files (`+page.svelte`, `+layout.svelte`) should hold layout/flow CSS only -- grids, flex, positioning. Visual CSS (colors, font-size, font-weight, borders, shadows, padding on visual elements) belongs in `libs/ui/` token-driven components. The token-discipline is fine inside these blocks (no hex literals), but every page is reinventing card chrome, button rows, empty-state panels, header eyebrows, etc. It's why `dashboard/+page.svelte`, `session/start/+page.svelte`, and `reps/+page.svelte` all reimplement the same `.empty` / `.tile` / `.score-card` shells. The pattern is the violation, not any one declaration.
- **Fix**: Inventory the recurring shells (empty state, score card, panel header with eyebrow, list-with-actions, summary tile, ...) and promote each to `libs/ui/`. Replace per-route CSS with the new components. Routes should be left with grid/flex layout to arrange them. Suggest making this a tracked work package rather than a single PR -- the surface is too wide for one pass.

### MINOR: Prop -> $state sync via $effect in app layouts (should be $derived or restructured)

- **Files**:
  - apps/study/src/routes/(app)/+layout.svelte:34-40 (`appearancePref`, `themePref`)
  - apps/hangar/src/routes/+layout.svelte:20-22 (`appearancePref`)
- **Problem**: The pattern `let appearancePref = $state(DEFAULT); $effect(() => { appearancePref = data.appearance; });` uses an effect to mirror a prop into local state. Svelte 5 idiom is `const appearancePref = $derived(data.appearance);` -- which the comment in the study layout acknowledges by saying it's avoiding a "state-referenced-locally" lint. The intent (optimistic local update on click while waiting for the round trip) is real, but the cleaner shape is either `$derived` of the server value with a separate `pendingOverride: $state<AppearancePreference | null>` that wins until the server load returns, or accept the `state_referenced_locally` warning with a one-line comment instead of swallowing the round trip in an effect. The current shape will overwrite an in-flight optimistic update if `data.appearance` re-narrows during the same paint cycle.
- **Fix**: Either:

  ```typescript
  // Option A: pure derived, no optimistic UI
  const appearancePref = $derived(data.appearance);

  // Option B: explicit pending override for optimistic UI
  let pendingAppearance = $state<AppearancePreference | null>(null);
  const appearancePref = $derived(pendingAppearance ?? data.appearance);
  $effect(() => { void data.appearance; pendingAppearance = null; });
  async function setAppearance(v) { pendingAppearance = v; /* fetch */ }
  ```

### MINOR: $effect reads + writes the same `$state` set without `untrack`

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:57-62
- **Problem**: The visit-recording effect reads `currentPhase` and `visitedPhases`, then writes `visitedPhases = new Set([...visitedPhases, phase])`. The `has(phase)` early-return prevents an infinite loop, but `visitedPhases` is now a tracked dependency of an effect that mutates it -- a fragile pattern that breaks if a future edit moves the set-mutation past the guard.
- **Fix**: Either gate the read with `untrack`, or split the dependency-only signal from the mutation:

  ```typescript
  $effect(() => {
      const phase = currentPhase;
      untrack(() => {
          if (visitedPhases.has(phase)) return;
          visitedPhases = new Set([...visitedPhases, phase]);
          void recordVisit(phase);
      });
  });
  ```

### MINOR: $effect.pre re-seeds local state but reads `phase` it then writes

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:92-105
- **Problem**: The pre-effect reads `current`, `isComplete`, `phase` and writes `phase`, `confidence`, `revealedAt`, etc. Reading `phase` makes it a dependency of the effect that mutates it. Today the `phase !== SUBMITTING` branch reaches a stable fixed point (writing `FRONT` doesn't re-fire because the value matches), but it's brittle. The cleaner shape is to drive the reset off the change in `current?.id` only (which the sibling `sessions/[id]/+page.svelte` does correctly via `lastSlotKey`).
- **Fix**: Mirror the `lastSlotKey` pattern from the session page so the reset only fires on a card-id change, untracking the `phase` read.

### MINOR: Timers lack unmount cleanup

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:73 (`undoTimer`), :82 (`shareToastTimer`)
- **Problem**: Both timers are declared as bare `let` outside any `$effect`, and the component has no `onDestroy` or matching cleanup hook. If a user clicks Undo a rating then immediately navigates away, the `setTimeout` fires post-unmount and writes to `pendingUndo` / `shareToast` (still legal for `$state` objects in Svelte 5, but wasted work and a defensive-test trap).
- **Fix**: Move timer creation under `$effect` blocks so SvelteKit cleans them up on unmount, or add an `onDestroy` that clears both. Either pattern is fine; the first is the more idiomatic Svelte 5 path.

### MINOR: Lib component uses raw rem/px instead of design tokens

- **File**: libs/help/src/ui/HelpLayout.svelte:88-156
- **Problem**: Several declarations use raw values (`grid-template-columns: 14rem 1fr`, `gap: 2rem`, `padding: 0.5rem 0`, `font-size: 1.75rem`, `font-size: 1rem`, `font-size: 0.8125rem`, `padding: 0.0625rem 0.375rem`). All sizes should resolve to the existing `--space-*`, `--type-*` tokens.
- **Fix**: Promote each raw size to a token. The recurring `0.8125rem` matches `--type-ui-label-size`; the heading at `1.75rem` matches `--type-heading-1-size` (or close enough for a token alias).

### MINOR: `createFocusTrap` re-instantiated on every keydown

- **Files**:
  - libs/ui/src/components/Dialog.svelte:49-53
  - libs/ui/src/components/Drawer.svelte:62-66
  - libs/ui/src/components/SharePopover.svelte:55-59
  - libs/ui/src/components/ConfirmAction.svelte:81-88
  - libs/ui/src/components/InfoTip.svelte:138-147
- **Problem**: Each `handleKeyDown` calls `createFocusTrap(panelEl, { onEscape: close })` afresh. The trap factory builds a new closure + listener wrapper for every keystroke. Functionally correct (no cleanup needed), but wasted allocation and harder to follow than building the trap once when the panel mounts.
- **Fix**: Build the trap inside the `$effect` that opens the panel (or in a `bind:this` callback), store the returned `{ handleKeyDown }`, and reuse it. Pattern:

  ```typescript
  let trap = $state<ReturnType<typeof createFocusTrap> | null>(null);
  $effect(() => {
      if (!open || !panelEl) { trap = null; return; }
      trap = createFocusTrap(panelEl, { onEscape: close });
  });
  function handleKeyDown(e: KeyboardEvent) { trap?.handleKeyDown(e); }
  ```

### MINOR: $effect runs once with no reactive deps -- replace with `onDestroy`

- **File**: libs/ui/src/components/SharePopover.svelte:95-102
- **Problem**: The cleanup-only effect `$effect(() => { return () => { if (copyResetTimer) clearTimeout(copyResetTimer); }; });` has no reactive reads, so it executes its setup exactly once on mount and its cleanup once on unmount. That's the contract of `onDestroy` -- using `$effect` here is non-idiomatic and obscures the intent.
- **Fix**: Replace with `onDestroy(() => { ... })` from `'svelte'`.

### NIT: Redundant `class:flip-y` / `class:flip-x` paired with template-string class names

- **File**: libs/ui/src/components/InfoTip.svelte:212-213
- **Problem**: The popover uses both `class="popover"` and `class:flip-y={flipY} class:flip-x={flipX}` -- correct, just calling out for consistency. Other primitives in `libs/ui/` (Drawer, Dialog) build the class string with template literals like `class="panel sz-{size} side-{side}"`. Either form is fine, but the codebase mixes them within the same lib.
- **Fix**: Pick one (the `class:` directive is more readable for booleans) and align the lib over time.

### NIT: `lastPathname` / `wasOpen` plain `let` mutated inside `$effect`

- **Files**:
  - libs/ui/src/components/InfoTip.svelte:174-181
  - libs/ui/src/components/SnoozeReasonPopover.svelte:132-140
- **Problem**: Both files use a plain `let` (not `$state`) as a "previous-value tracker" inside an effect to gate behaviour to a transition (path change, false->true open). Documented intentionally with a comment explaining the choice. The pattern works because Svelte 5 doesn't track plain `let`, so the write doesn't re-fire the effect. This is fine, but the alternative -- a `$state` plus `untrack`(prev read) -- would be more discoverable. Pure style preference.
- **Fix**: No action required; flagging in case the project wants to standardize. Leave as-is otherwise.
