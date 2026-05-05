# Svelte 5 review -- study-ia-cleanup Phase 1

issues_found: 3

## S-1 (minor) -- `<svelte:window onkeydown>` on every Tooltip is wasteful

`libs/ui/src/components/Tooltip.svelte:131`

Each mounted `Tooltip` registers its own keydown listener on `window`. The Home page mounts seven Tooltips today; every keypress fires seven listeners that each compare `event.key === 'Escape'` and check `if (open)`. This is fine for seven instances but the pattern doesn't scale. A future page that mounts 30 Tooltips inside a glossary index would have 30 global listeners.

Fix: scope the keydown to the host span (`onkeydown={handleKey}` on `<span class="tooltip-host">`). Esc on a focused trigger still works; Esc when the user isn't on a trigger is irrelevant because the bubble can only be open if the trigger was just hovered/focused.

## S-2 (minor) -- `untrack(() => initialDismissed)` is the right idiom but the comment doesn't survive a future refactor

`libs/ui/src/components/PageExplainer.svelte:65-69`

The pattern is correct (capture the reactive prop's value once), and the comment explains *why*. Nit: the `untrack` import is now used only in this one place; if a future agent inlines the seed value back into `$state(initialDismissed)`, the warning resurfaces. Add a one-line jsdoc on `dismissed` reminding readers why the prop is read through `untrack`.

## S-3 (nit) -- `$derived.by` for `resolved` is fine but could be `$derived` with a ternary

`libs/ui/src/components/Tooltip.svelte:62-69`

```typescript
const resolved = $derived.by<{ term: string; short: string } | null>(() => { ... });
```

Same shape works as `$derived(...)` since the body is straight-line. `$derived.by` is for cases where you need a function scope (locals, multiple statements). Pure stylistic nit; current code is correct.
