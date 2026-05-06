---
id: wp-design-token-convergence
title: 'Design token convergence pass'
product: platform
category: platform
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags: [theme, ui, tokens]
legacy_fields:
  feature: design-token-convergence
  priority: low
  trigger: 'next theme-pass session, OR when adding a new instrument / overlay primitive'
  captured_from: '2026-05-02-ui-library-themes-patterns.md (minors #3, #4, nit #2)'
---

# Work package: design token convergence pass

## Why

Three convergent token gaps surfaced in the chunk-5 patterns review and
were marked CLOSED-with-followup because the right fix is one focused
token-design pass rather than three separate component-level edits.

## Scope

Add three token families to the themes contract and migrate every
in-tree call site.

### Icon sizing

Currently inlined per component:

- `Checkbox.svelte:88-90` -- `0.875rem`, `1rem`, `1.25rem`
- `InfoTip.svelte:298-299` -- `1.125rem`
- `FilterCard.svelte` -- `min-height: 1.25rem`
- `Spinner.svelte` -- already tokenized but not against a shared scale

Proposed tokens:

```css
--icon-size-sm: 0.875rem;
--icon-size-md: 1rem;
--icon-size-lg: 1.25rem;
```

### Overlay sizing

Currently each overlay primitive picks its own scale:

| Primitive             | sm     | md     | lg     |
| --------------------- | ------ | ------ | ------ |
| Dialog.svelte         | 24rem  | 36rem  | 54rem  |
| Drawer.svelte         | 20rem  | 32rem  | 48rem  |
| InfoTip.svelte        | 14rem  | 18rem  | 20rem  |
| JumpToCardPopover     | 24rem  | 28rem  | --     |
| SharePopover          | 28rem  | 32rem  | --     |
| SnoozeReasonPopover   | 32rem  | 36rem  | --     |

Proposed tokens (one canonical scale, components override only with
inline justification):

```css
--overlay-size-sm: 22rem;
--overlay-size-md: 32rem;
--overlay-size-lg: 48rem;
```

### Focus-ring shadow recipe

`box-shadow: 0 0 0 3px var(--focus-ring)` is hand-written in five
files (`SharePopover`, `SnoozeReasonPopover`, `BrowseListItem`).

Proposed token:

```css
--focus-ring-shadow: 0 0 0 3px var(--focus-ring);
```

### Instrument SVG label sizes

Cockpit-panel instruments inline `font-size="10" / "11" / "15"` SVG
attribute values for tick labels and digital readouts (~9 instrument
files). These are unitless SVG coordinates not CSS px so they're not
"px in components" violations, but they're convergent across files and
should share a constants module.

Proposed constants in `libs/activities/src/cockpit-panel/instrument-typography.ts`:

```typescript
export const INSTRUMENT_TICK_FONT_SIZE = 10;
export const INSTRUMENT_UNIT_FONT_SIZE = 11;
export const INSTRUMENT_READOUT_FONT_SIZE = 15;
```

## Out of scope

- Tone / color tokens (already tokenized).
- Spacing tokens (already tokenized).
- Typography tokens (already tokenized).

## Tasks

1. Extend `libs/themes/contract.ts`, `vocab.ts`, `emit.ts`, and
   `generated/tokens.css` with the three new token families.
2. Add a contract test asserting the tokens emit on every theme.
3. Codemod in-tree call sites (small change set, ~10 files).
4. `bun run check` clean, then re-grep for the inlined values to
   confirm zero residual call sites.

## Trigger

Run this work package next time we open a theme-pass session, or
immediately if a new overlay/instrument primitive lands and would
otherwise inherit one of the three patterns.

## References

- `docs/work/reviews/2026-05-02-ui-library-themes-patterns.md`
  minors #3, #4, nit #2.
