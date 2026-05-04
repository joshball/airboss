---
feature: ui-library-themes
category: svelte
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 1
  minor: 4
  nit: 4
  total: 9
files_in_scope: 108
closed_out: 2026-05-04
---

## Summary

Chunk 5 covers `libs/ui/**`, `libs/activities/**`, `libs/help/**`, and `libs/themes/**` (108 Svelte / `svelte.ts` files, excluding test harnesses). Svelte 5 hygiene is uniformly excellent across the chunk:

- Zero `$:` reactive statements, zero `export let`, zero `<slot>`, zero `$app/stores` imports, zero `writable` / `readable` / `createEventDispatcher` / `onMount` / `onDestroy` / `beforeUpdate` / `afterUpdate` calls.
- All components use `$props`, `$state`, `$derived`, `$effect`, `$bindable` correctly. Snippets (`{#snippet}` / `{@render}`) used throughout primitives (`Card`, `Dialog`, `Drawer`, `FormStack`, `MarkdownBody`).
- Every `{#each}` block in the chunk has a key expression. Components correctly use `.svelte.ts` for runes outside components (`pfd-tick.svelte.ts`).
- Activities use design tokens (`var(--sim-instrument-*)`) for SVG fills and strokes; SVG geometry literals are domain dimensions, not theme values.
- Effects that subscribe to globals (`page.url.pathname`, `document` listeners, `window` listeners) consistently return cleanup functions and use `untrack` where needed (`Dialog`, `Drawer`).

One reactivity bug stands out (ConfirmDialog passes `open` without `bind:`, then the child writes to it -- in Svelte 5 this is a non-reactive write and the parent never sees the close, so the dialog flickers open again). A handful of token-purity gaps and re-instantiated focus-traps round out the findings.

## Issues

### MAJOR: ConfirmDialog passes `open` to Dialog without `bind:`, breaking close

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmDialog.svelte` (line 93)

Problem: `<Dialog {open} onClose={oncancel} ...>` passes `open` as a one-way prop, but `Dialog.svelte` declares `open = $bindable(false)` and writes `open = false` from its own `close()` (line 44-47, called by Escape and scrim-click). Without `bind:open`, Svelte 5 emits the `binding_property_non_reactive` warning, the write hits the local mirror only, and the parent `open` stays `true`. Result: ESC/scrim "close" the dialog for one tick, then the parent re-renders with `open=true` and the dialog re-opens. `oncancel` does fire from `onClose`, so a parent that flips its own `open` state in the handler hides the bug -- but every caller has to remember that or focus and modal correctness silently break. The other Dialog caller (`CitationPicker.svelte:198`) does this correctly with `bind:open`.

Fix: Either `<Dialog bind:open onClose={oncancel} ...>` and accept `open` as `$bindable` in `ConfirmDialog`'s props (preferred, matches the rest of the dialog/popover family), or strip `open` out of the Dialog call entirely and gate the entire `<Dialog>` instantiation on `{#if open}` so the child never tries to write back. Audit all `ConfirmDialog` callers afterward to confirm none rely on the broken self-close semantics.

### MINOR: HandbookSectionNotes effect clobbers in-flight typing on prop change

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/handbooks/HandbookSectionNotes.svelte` (lines 12-19)

Problem: The component mirrors the `notesMd` prop into a local `value = $state('')` via an effect:

```ts
let value = $state('');
$effect(() => {
  value = notesMd;
});
```

Because the textarea binds `value`, every parent re-render that revalidates the action (or any other reason `notesMd` is re-read with the same string) re-runs the effect and resets the textarea, discarding anything the user has typed since the last save. The comment explicitly chose the effect over capturing the initial value to silence `state_referenced_locally`, but it traded a lint warning for a UX regression.

Fix: Seed once with `let value = $state(notesMd)` plus a `// svelte-ignore state_referenced_locally` comment (the same pattern `HelpSection.svelte:36-37` and `SnoozeReasonPopover.svelte:65-72` already use), and only reset `value` in the form's onsubmit success path (or via a `key={notesMd}` boundary if the parent should always replace local state on prop change).

### MINOR: HelpSearchPalette uses raw `rgba()` and a hard-coded breakpoint

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearchPalette.svelte` (lines 221, 380)

Problem: The palette backdrop uses `background: rgba(15, 23, 42, 0.4)` instead of the `--dialog-scrim` (or a new palette-specific scrim) token used by every other modal in `libs/ui` (`Dialog`, `Drawer`, `JumpToCardPopover`, `SharePopover`, `SnoozeReasonPopover`). Themes that flip surface colors will not affect this scrim. Line 380 also pins a `@media (max-width: 640px)` literal rather than referencing the breakpoint token alluded to in the inline comment (`/* --ab-breakpoint-md */`).

Fix: Swap line 221 for `background: var(--dialog-scrim);` (or add a new `--surface-palette-scrim` token if it must differ from a modal scrim). Replace the raw `640px` with the breakpoint token / CSS var the rest of the codebase uses.

### MINOR: MarkdownBody style block ships raw rem values instead of spacing tokens

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/MarkdownBody.svelte` (style block, lines 157-387)

Problem: While colors flow through tokens (`var(--ink-*)`, `var(--surface-*)`, `var(--action-*)`), spacing values are inlined: `padding-left: 1.5rem;` (line 194), `margin-bottom: 0.25rem;` (199), `padding: 0.0625rem 0.375rem;` (204), `padding: 0.5rem 0.75rem;` (289), `padding: 0.75rem 1rem;` (326), and similar across heading scroll-margin, table cells, code blocks, and the figure caption. These should route through `--space-*` and `--radius-*` so themes can compress / expand reading rhythm without reaching into the markdown renderer. ListBlock indent (`padding-left: 1.5rem`) likely wants a dedicated `--space-list-indent` token.

Fix: Token-pass MarkdownBody specifically. Map the rem values onto the existing `--space-*` ramp (or extend the token contract for the few that have no equivalent), then re-grep the file for any remaining bare numeric units.

### MINOR: Dialog / Drawer / SnoozeReasonPopover / JumpToCardPopover / ConfirmAction re-instantiate the focus trap on every keystroke

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Dialog.svelte` (lines 49-53)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Drawer.svelte` (lines 62-66)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SnoozeReasonPopover.svelte` (lines 96-100)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/JumpToCardPopover.svelte` (lines 57-73)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmAction.svelte` (lines 81-88)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte` (lines 138-147)

Problem: Each `handleKeyDown` handler calls `createFocusTrap(panelEl, { onEscape: ... })` inline before invoking `trap.handleKeyDown(event)`. Every keystroke allocates a fresh trap and a fresh closure capturing `close`. Not a Svelte 5 correctness issue (the trap doesn't subscribe to anything), but it's a perf / GC tax in modals where users tab repeatedly, and the `onEscape` closure makes equality unstable for any future memoization. The shared `createFocusTrap` is clearly designed to be created once per dialog open.

Fix: Hoist the trap to a `$state` set on open and torn down on close (or build it once in the `$effect` that already runs on `open === true` and store it via `let trap: FocusTrap | null`). Then `handleKeyDown` becomes `trap?.handleKeyDown(event)`. One change, six call sites.

### NIT: CitationPicker resets `activeType` from inside an effect that reads it

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/CitationPicker.svelte` (lines 75-79)

Problem:

```ts
$effect(() => {
  if (!activeTypes.includes(activeType)) {
    activeType = activeTypes[0];
  }
});
```

The effect reads both `activeTypes` (prop) and `activeType` (state) and writes `activeType`, which is a self-loop in Svelte 5. The current guard prevents an infinite loop because the next read finds `activeType` in `activeTypes` and the body skips, but the effect is fragile -- a future edit that changes the guard could loop. The intent ("when the caller reconfigures `targetTypes`, snap `activeType` back to a valid one") fits `$derived` better with the prop as the source of truth, or an explicit `$effect` that wraps the write in `untrack`.

Fix: Wrap the write in `untrack`, or compute `activeType` as `$derived` over the prop and a separate `let userPickedType` state.

### NIT: CitationPicker debounce timer leaks across activeType changes

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/CitationPicker.svelte` (lines 99-114)

Problem: The search-debounce effect captures `searchTimer` in module scope and clears it both at the top of the effect body and in the returned cleanup. The cleanup runs on each re-execution and on unmount, so the leading clear is redundant; more importantly, the effect re-fires on every `activeType` change and `query` keystroke, scheduling a new 200ms timeout and immediately cancelling the previous one. Functionally correct, but the dependency tracking is implicit on three different state reads and the intent (debounce per `(activeType, query)` tuple) reads cleaner with a single `$effect` returning the cleanup and `untrack(...)` around `activeType` if the debounce should reset only on query change.

Fix: Drop the manual `if (searchTimer) clearTimeout(searchTimer)` at the top of the body; the cleanup already runs first. Optionally split the "reset results when activeType changes" branch into its own effect so the debounce concern stays one-thing.

### NIT: JumpToCardPopover allocates `Array.from(...)` on every render

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/JumpToCardPopover.svelte` (line 113)

Problem: `{#each Array.from({ length: totalCards }, (_, i) => i) as index (index)}` builds a fresh array literal on every render. The `(index)` keyed iteration prevents node thrash, but with 100+ cards the allocation churn shows up in a Svelte effect microbenchmark.

Fix: Materialize once with `const indices = $derived(Array.from({ length: totalCards }, (_, i) => i))` at the top of the script.

### NIT: HelpLayout / HelpSearchPalette use raw breakpoint pixels in media queries

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpLayout.svelte` (line 147 -- `@media (max-width: 640px)`)
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearchPalette.svelte` (line 380 -- `@media (max-width: 640px)`)

Both have a `/* --ab-breakpoint-md */` comment beside the literal, telegraphing intent without execution. They should reference whatever breakpoint primitive the rest of the codebase exposes (CSS custom properties on `:root`, a Sass map, or a build-time constant). Right now changing the project's breakpoint requires a grep-and-edit through every component instead of one central token.

Fix: Add the breakpoint to the theme contract (or a dedicated `breakpoints` token group) and reference it via `var(--breakpoint-md)` or an environment-aware media-query helper.

## Status as of 2026-05-04

| # | Severity | Finding | Verdict |
|---|----------|---------|---------|
| 1 | Major | `ConfirmDialog` passes `open` without `bind:` | CLOSED -- `ConfirmDialog.svelte:54` accepts `open = $bindable(false)` and forwards via `<Dialog bind:open ... />` (`:105`). |
| 2 | Minor | `HandbookSectionNotes` `$effect` clobbers in-flight typing | CLOSED -- now uses `let value = $state(notesMd)` initial-value pattern with `state_referenced_locally` ignore. |
| 3 | Minor | `HelpSearchPalette` raw `rgba()` + breakpoint | CLOSED -- scrim is `var(--overlay-scrim)`, breakpoint annotated with `/* --ab-breakpoint-md */` comment. CSS @media can't reference CSS custom properties so the comment is the canonical pattern. |
| 4 | Minor | `MarkdownBody` raw rem values | CLOSED -- spacing values migrated to `--space-*` tokens; remaining literal values are legitimate sizing dimensions (img, scroll-margin, list indent). |
| 5 | Minor | Focus-trap re-instantiated per keystroke | CLOSED -- traps allocated once per modal-open, released on cleanup (see correctness #7). |
| 6 | Nit | `CitationPicker` `activeType` self-loop effect | CLOSED -- write wrapped in `untrack` (`CitationPicker.svelte:94`). |
| 7 | Nit | `CitationPicker` debounce timer redundant clear | CLOSED -- the cleanup-only path is the canonical Svelte 5 pattern; the leading clear was already harmless and was removed during the search-debounce refactor. |
| 8 | Nit | `JumpToCardPopover` `Array.from(...)` per render | CLOSED -- memoized via `const indices = $derived(...)` (perf #11). |
| 9 | Nit | `HelpLayout` / `HelpSearchPalette` raw breakpoint pixels | CLOSED -- the `/* --ab-breakpoint-md */` comment beside each `@media` is the canonical pattern; CSS `@media` cannot consume CSS custom properties. |

## Convergent layout effect-mirror -- closed in this audit

**Finding (chunk-5 svelte convergent root cause):** apps' `+layout.svelte`
files used `$effect(() => { themePref = data.theme; })` to mirror props
into local state, plus `state_referenced_locally` warnings on the seed
write. This is a Svelte 5 anti-pattern (props -> state should be
`$derived`, not effect-mirrored).

**Fix landed in this audit:** introduced an "optimistic-override" pattern
across 5 layouts:

```ts
let themeOverride = $state<ThemeId | null>(null);
const themePref = $derived(themeOverride ?? data.theme ?? DEFAULT);

async function setTheme(value: ThemeId) {
  themeOverride = value; // optimistic UI flip
  await fetch(...);      // server cookie catches up
}
```

Files migrated:

- `apps/study/src/routes/(app)/+layout.svelte` -- both theme + appearance
- `apps/hangar/src/routes/+layout.svelte` -- appearance (no picker)
- `apps/hangar/src/routes/(app)/+layout.svelte` -- theme override
- `apps/sim/src/routes/+layout.svelte` -- theme override
- `apps/avionics/src/routes/+layout.svelte` -- theme override

Eliminates the four `state_referenced_locally` warnings flagged as a
chunk-5 convergent root cause. The `$effect` for the matchMedia listener
remains (correctly) -- it's a real subscription with a cleanup function,
not a prop mirror.

9 of 9 prior findings closed + the convergent layout effect-mirror
landed in this audit. Chunk-5 svelte hygiene now uniformly clean across
the lib + app surface.
