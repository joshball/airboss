---
title: 'Test Plan: UI Primitives'
feature: ui-primitives
type: test-plan
---

# Test Plan

## Existing primitives (regression)

- TextField `size="sm"` renders with expected padding/height.
- Badge `size="lg"` renders larger than `md`.
- StatTile `tone="info"` uses info role colors; `neutral` still works (aliased to `default`).
- Type: `import type { ButtonVariant } from '@ab/ui'` compiles.
- Pages using Badge/StatTile today: pixel-identical.

## New primitives — unit

- Dialog: opens, closes on ESC, closes on scrim click, focus trapped.
- FormField: label + input associated; error suppresses help; required adds indicator.
- Checkbox: click toggles, keyboard Space toggles; indeterminate renders correctly.
- RadioGroup: arrow keys cycle; selecting one unselects others.
- Table: hover applies hover-bg; `selected` prop applies selected-bg.
- Tabs: Arrow keys move; Enter activates; Home/End jump.
- Spinner: respects `prefers-reduced-motion` (no animation).
- Divider: horizontal/vertical render; inset prop applies padding.

## A11y

- Axe or Playwright a11y scan on dev demo: no violations.

## Contract

- Every primitive file passes lint rule (from #3).
- New component-token pairs in contrast matrix (#3) pass WCAG AA.
