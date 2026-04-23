# Vocabulary reference

Complete as-built catalog of every role-token name emitted by `libs/themes/`. Ground truth: `libs/themes/vocab.ts` + the prefix families `emit.ts` synthesizes. Copy, don't re-derive. Every rename is a migration.

## Why this vocabulary

Eight iterations converged on role-based naming across ~12 role families plus a small number of component token families. Going narrower (only `color`/`size`) lost expressiveness; going wider (v1's 100+ information types) lost adoption. Option A (2026-04) confirmed the shape under real load: the 12 primitives plus 8 new primitives from package #4 all fit, and migrating 2,614 call sites didn't need a new token class.

## Role tokens

### ink -- text color

```text
--ink-body           Default body text
--ink-muted          Secondary text: labels, captions, metadata
--ink-subtle         De-emphasized text: hints, placeholder
--ink-faint          Barely-visible: empty-state helper text
--ink-strong         Emphasized body (headlines embedded in prose)
--ink-inverse        Text on dark/saturated surfaces (buttons, filled states)
```

### surface -- fills

```text
--surface-page       Page background
--surface-panel      Card / panel fill
--surface-raised     Elevated fill (dropdown menu, popover)
--surface-sunken     Recessed fill (input, nested card)
--surface-muted      Disabled / read-only fill
--surface-overlay    Modal scrim backing
```

### edge -- borders, dividers

```text
--edge-default       Default 1px border
--edge-strong        Emphasized border (hover, active)
--edge-subtle        Faint divider
--edge-focus         Focus outline color (rarely used directly; see focus.* below)
```

### action -- interactive colors

Five roles x seven states. Each role ships `base`, `hover`, `active`, `wash`, `edge`, `ink`, `disabled`.

Roles: `default`, `hazard`, `caution`, `neutral`, `link`.

```text
--action-default                  Base brand action (primary buttons, links)
--action-default-hover
--action-default-active
--action-default-wash             Low-alpha tint for backgrounds, badges
--action-default-edge             Low-alpha border variant
--action-default-ink              Contrasting text on a default-filled surface
--action-default-disabled

--action-hazard-*                 Destructive (delete, remove, kick)
--action-caution-*                Non-destructive warning (unsaved changes, leave?)
--action-neutral-*                Secondary/tertiary gray actions
--action-link-*                   Hyperlink color family
```

35 tokens total in this family.

### signal -- status / feedback

Four roles x four variants. Roles: `success`, `warning`, `danger`, `info`.

```text
--signal-success                  Solid fill (badge, dot, progress bar)
--signal-success-wash             Low-alpha backdrop (toast, banner)
--signal-success-edge             Low-alpha border
--signal-success-ink              Contrasting text on solid

--signal-warning-*
--signal-danger-*
--signal-info-*
```

16 tokens total.

### focus -- keyboard focus

```text
--focus-ring                      Standard focus outline (2px)
--focus-ring-strong               High-visibility variant (admin surfaces)
--focus-ring-offset               Distance from the focused element
--focus-ring-width                Ring thickness
--focus-shadow                    Optional soft shadow companion
```

### accent -- inline typographic accents

```text
--accent-code                     Inline code text color
--accent-reference                Cross-reference link accent (e.g. wiki-links)
--accent-definition               Glossary-term highlight
```

### overlay -- transient chrome

```text
--overlay-scrim                   Modal backdrop translucency
--overlay-tooltip-bg              Tooltip fill
--overlay-tooltip-ink             Tooltip text
```

### selection -- text selection

```text
--selection-bg
--selection-ink
```

### disabled -- across-role disabled baseline

```text
--disabled-surface
--disabled-ink
--disabled-edge
```

### link -- navigation

```text
--link-default
--link-hover
--link-visited
```

## Typography tokens

Emitted per typography pack from `libs/themes/core/typography-packs.ts`.

### Families

```text
--font-family-sans
--font-family-serif
--font-family-mono
--font-family-base        (= families.base; usually sans, overridable per pack)
--font-family-display     (optional; emitted only when declared)
```

### Bundle tokens

One set per bundle x variant x field:

```text
--type-reading-body-family      --type-reading-body-size
--type-reading-body-weight      --type-reading-body-line-height
--type-reading-body-tracking

(same shape for: reading-{body,lead,caption,quote};
                  heading-{1..6};
                  ui-{control,label,caption,badge};
                  code-{inline,block};
                  definition-{term,body})
```

Sizes multiply by `pack.adjustments[family]` at emit time, so `adjustments.sans = 0.95` shrinks every sans bundle without editing them.

### Atomic typography aliases

Shared scales emitted once per theme block for raw use in component CSS:

```text
--font-size-xs, -sm, -md, -lg, -xl, -2xl, -3xl, -4xl
--font-weight-regular, -medium, -semibold, -bold
--line-height-tight, -snug, -normal, -relaxed, -loose
--letter-spacing-tight, -normal, -wide
```

## Scale tokens (layer 0, invariant across themes)

### space

```text
--space-3xs, -2xs, -xs, -sm, -md, -lg, -xl, -2xl, -3xl, -4xl
```

### radius

```text
--radius-xs, -sm, -md, -lg, -xl, -2xl, -pill, -full
```

### shadow

```text
--shadow-xs, -sm, -md, -lg, -xl
```

### motion

```text
--motion-fast                     120ms + easing (hover, focus)
--motion-normal                   200ms + easing (panel transitions)
```

Under `@media (prefers-reduced-motion: reduce)`, both collapse to `0ms`.

### underline-offset

```text
--underline-offset-2xs, -xs, -sm
```

## Layout tokens

Emitted from `theme.chrome.layout`.

```text
--layout-container-max            Max content width
--layout-container-padding        Side padding inside the container
--layout-grid-gap                 Default grid/flex gap
--layout-panel-radius             Panel default radius
--layout-panel-padding            Panel default padding
--layout-panel-gap                Panel internal gap
```

## Control tokens (layer 2)

### Buttons

Five variants x seven slots:

```text
--button-default-bg       --button-default-ink       --button-default-border
--button-default-hover-bg --button-default-hover-ink --button-default-active-bg
--button-default-disabled-bg --button-default-disabled-ink
--button-default-ring

(same shape for: button-primary-*, button-hazard-*, button-neutral-*, button-ghost-*)
```

### Inputs

Two variants x slots:

```text
--input-default-bg --input-default-ink --input-default-border
--input-default-hover-border --input-default-disabled-bg --input-default-disabled-ink
--input-default-ring

--input-error-bg --input-error-ink --input-error-border --input-error-ring
```

### Control heights

```text
--button-height-sm, -md, -lg
--input-height-sm, -md, -lg
--badge-height-sm, -md, -lg
```

### Control font sizes

```text
--control-font-size-sm, -md, -lg
```

## Component tokens (layer 3)

Shared surface for primitives that don't warrant a full control-slot family.

### Dialog

```text
--dialog-scrim
--dialog-bg
--dialog-edge
--dialog-radius
--dialog-shadow
```

### Table

```text
--table-header-bg
--table-header-ink
--table-row-edge
--table-row-bg-hover
--table-row-bg-selected
```

## Sim tokens (layer 4, app-scoped)

Emitted only when the active theme declares `sim`. Shape from `libs/themes/contract.ts`:

```text
--sim-panel-bg, --sim-panel-edge, --sim-panel-ink
--sim-instrument-bg, --sim-instrument-bezel, --sim-instrument-ink, --sim-instrument-accent
--sim-horizon-sky, --sim-horizon-ground, --sim-horizon-line
--sim-arc-bg, --sim-arc-fill, --sim-arc-tick
--sim-status-ok, --sim-status-warn, --sim-status-fail, --sim-status-caution
--sim-banner-master-caution, --sim-banner-master-warning
--sim-readout-warning-bg
--sim-muted-state-bg
```

Consumed by `apps/sim/src/**`. The `SimTokens` type in `contract.ts` is `optional` so non-sim themes leave it undefined and emit nothing.

## Counts

Per `(theme, appearance)` emit block:

| Family                                      | Token count |
| ------------------------------------------- | ----------- |
| ink                                         | 6           |
| surface                                     | 6           |
| edge                                        | 4           |
| action                                      | 35          |
| signal                                      | 16          |
| focus                                       | 5           |
| accent                                      | 3           |
| overlay                                     | 3           |
| selection                                   | 2           |
| disabled                                    | 3           |
| link                                        | 3           |
| typography bundles                          | ~120        |
| atomic typography                           | ~20         |
| space/radius/shadow/motion/underline-offset | ~35         |
| layout                                      | 6           |
| button                                      | 35          |
| input                                       | 12          |
| control heights                             | 9           |
| control font sizes                          | 3           |
| dialog                                      | 5           |
| table                                       | 5           |
| sim (when present)                          | ~20         |

Total: ~350 tokens emitted per appearance for themes without sim, ~370 for sim themes.

## Rules for adding a token

1. Does an existing role fit? Use it; don't add a token.
2. Is it a component surface that can compose from role tokens? Use `var()` chains in the component CSS.
3. If a new role token is needed: add to `vocab.ts`, add emission in `emit.ts`, add to this doc, add a test in `emit.test.ts`. Every new token is a migration candidate for every existing theme.
