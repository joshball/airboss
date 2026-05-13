---
title: 'Tasks: UI Primitives'
feature: ui-primitives
type: tasks
---

# Tasks

## Part A: existing primitives

- [ ] Re-export `Tone` / `TONES` from `@ab/ui` barrel.
- [ ] Badge: add `lg` size; replace `min-height` hardcodes with `--badge-height-*`; tones match `Tone` enum.
- [ ] StatTile: accept `tone: Tone`; widen tone set; alias `neutral` → `default` with TODO.
- [ ] TextField: `size: 'sm' | 'md' | 'lg'`; reads `--input-*-{sm,md,lg}`.
- [ ] Select: same size variants.
- [ ] KbdHint: replace `min-width`/`min-height`/`text-underline-offset` hardcodes with tokens.
- [ ] ConfidenceSlider: replace `min-width: 5rem` and `text-underline-offset: 2px` with tokens.
- [ ] Add `--input-height-{sm,md,lg}`, `--button-height-{sm,md,lg}`, `--badge-height-{sm,md,lg}`, `--underline-offset-2xs` to chrome emission in `airboss-default`.
- [ ] Regenerate `libs/themes/generated/tokens.css`.
- [ ] Update `libs/ui/src/index.ts` with prop-type exports (`ButtonVariant`, `ButtonSize`, `BadgeTone`, `BadgeSize`, `TextFieldSize`, `SelectSize`, `StatTileTone`, etc.).

## Part B: new primitives

- [ ] `Dialog.svelte` with header/body/footer snippets.
- [ ] Focus trap (hand-rolled or `@melt-ui/svelte`).
- [ ] Scrim + ESC-to-close.
- [ ] Dialog component tokens: `--dialog-{bg,edge,radius,shadow,scrim}`.
- [ ] `FormField.svelte` — label + help + error.
- [ ] `Checkbox.svelte` — click + keyboard space; indeterminate state; size variants.
- [ ] `Radio.svelte` + `RadioGroup.svelte` — arrow-key navigation.
- [ ] `Table.svelte` + subcomponents.
- [ ] Table component tokens: `--table-{header-bg,header-ink,row-edge,row-bg-hover,row-bg-selected}`.
- [ ] `Spinner.svelte` — indeterminate; size/tone; `prefers-reduced-motion`.
- [ ] `Divider.svelte` — horizontal/vertical; inset prop.
- [ ] `Tabs.svelte` + `Tab.svelte` + `TabPanel.svelte` — keyboard nav (Arrow/Home/End).

## Integration

- [ ] Dev demo page at `apps/study/src/routes/(dev)/primitives/+page.svelte` exercises every primitive + every variant.
- [ ] Vitest unit tests for each new primitive.
- [ ] Playwright smoke: open Dialog with focus trap, Tabs keyboard nav, Radio selection.
- [ ] Contrast test matrix in #3 extends to cover new component-token pairs (dialog scrim ink, table selected-row ink, etc.).

## Verification

- [ ] `bun run check` clean.
- [ ] Visual regression: no diff on existing-primitive use sites.
- [ ] Dev demo renders cleanly in light + (stub) dark.
