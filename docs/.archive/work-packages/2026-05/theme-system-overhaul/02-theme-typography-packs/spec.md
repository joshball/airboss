---
title: 'Spec: Typography Packs'
feature: theme-typography-packs
type: spec
status: unread
review_status: pending
---

# Spec: Typography Packs

Replace atomic typography tokens (`--font-size-lg`) with semantic bundles (`--type-reading-body`, `--type-heading-1`, etc.) per [04-VOCABULARY.md §Typography tokens](../../../platform/theme-system/04-VOCABULARY.md).

## Goal

- `libs/themes/core/typography-packs.ts` ships 3 curated packs: `airboss-standard`, `airboss-compact`, `airboss-display-serif` (name TBD).
- Each pack includes per-font size adjustments (`serif scales 0.95×`, `mono scales 1.05×`) so visual weight stays consistent across pack swaps.
- Theme declarations reference a pack by id and may override individual bundles.
- Emission produces `--type-<role>-<variant>-{family,size,weight,line-height,tracking}` variables per bundle.
- Primitives update to read bundle variables (e.g. `font-family: var(--type-ui-control-family)`).

## Pack shape

```ts
export interface TypographyPack {
  id: string;
  name: string;
  families: {
    sans: string;      // full font-family stack
    serif: string;
    mono: string;
    display?: string;  // optional display/headline face
  };
  adjustments: {
    // per-family size multipliers
    sans: number;      // 1.0 baseline
    serif: number;
    mono: number;
    display?: number;
  };
  bundles: {
    reading: { body; lead; caption; quote };
    heading: { 1; 2; 3; 4; 5; 6 };
    ui:      { control; label; caption; badge };
    code:    { inline; block };
    definition: { term; body };
  };
}
```

Each bundle value is a `TypeBundle`: `{ family: 'sans' | 'serif' | 'mono' | 'display', size: string, weight: number, lineHeight: number, tracking: string }`. The emitter resolves `family` through `pack.families[family]`, multiplies `size` by `pack.adjustments[family]`.

## Primitive updates

Every primitive in `libs/ui/src/components/*.svelte` that reads `--font-size-*` / `--font-family-*` / `--font-weight-*` switches to reading a bundle variable:

- `Button` → `--type-ui-control-*`
- `TextField` / `Select` → `--type-ui-control-*`
- `Badge` → `--type-ui-badge-*`
- `KbdHint` → `--type-ui-caption-*` (or mono-specific)
- `PanelShell` header → `--type-ui-caption-*` for tui density, `--type-heading-3-*` for web density
- `StatTile` → label: `--type-ui-caption-*`, value: `--type-heading-3-*`
- `Banner` → `--type-reading-body-*`
- `Card` → `--type-reading-body-*`
- `ConfirmAction` → same as Button

## Per-theme pack picks

- `airboss/default`: `airboss-standard` (sans everything, reasonable reading)
- `study/sectional`: inherits `airboss-standard`
- `study/flightdeck`: `airboss-compact` with all bundles overridden to use `mono` family

## Non-goals

- Font loading pipeline (use `@import url(...)` or system stacks for now).
- Custom fonts (WOFF2 files shipped with the repo — punt).
- Variable fonts (punt).

## Acceptance

- Pack definitions exist and are type-checked.
- Emission produces per-bundle variables.
- Primitives render correctly (visual regression on all study routes).
- Page-level CSS still uses atomic `--font-*` tokens; those are provided for back-compat during migration and removed in #7.
