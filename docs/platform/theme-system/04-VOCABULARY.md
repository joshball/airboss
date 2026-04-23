# Vocabulary reference

Complete catalog of token names every theme system should start from. Copy, don't re-derive. Change names only with justification — every rename is a migration.

## Why this specific vocabulary

Seven iterations converged on role-based naming with ~12 role families. Going narrower (e.g. only `color`/`size`) lost expressiveness; going wider (airboss-v1's 100+ information types) lost adoption. This set is the sweet spot that survived.

## Role tokens

### ink — text color

```text
--ink-body           Default body text
--ink-muted          Secondary text: labels, captions, metadata
--ink-subtle         De-emphasized text: hints, placeholder
--ink-faint          Barely-visible: empty-state helper text
--ink-strong         Emphasized body (headlines embedded in prose)
--ink-inverse        Text on dark/saturated surfaces (buttons, filled states)
```

### surface — fills

```text
--surface-page       The base background everything sits on
--surface-panel      Elevated content (cards, panels) against the page
--surface-raised     Further elevation (popovers, menus)
--surface-sunken     Receded content (input backgrounds, code blocks)
--surface-muted      Low-contrast fill (disabled, placeholder)
--surface-overlay    Modal/dialog content surface
```

### edge — borders

```text
--edge-default       Normal borders
--edge-strong        Emphasized borders (active inputs, selected rows)
--edge-subtle        Barely-visible dividers
--edge-focus         Focused element borders (composes with --focus-ring)
```

### action — interactive intent

Base roles: `default`, `hazard` (destructive), `caution` (warning-level action), `neutral`, `link`.

Each role ships a bundle (derived from a single base color):

```text
--action-{role}              Solid base color
--action-{role}-hover        Hover state
--action-{role}-active       Pressed/active state
--action-{role}-wash         Subtle tinted background (subtle button, chip)
--action-{role}-edge         Subtle border matching the role
--action-{role}-ink          Text on --action-{role} solid
--action-{role}-disabled     Disabled state
```

Example: `--action-default-ink` is the text color of a solid primary button.

### signal — status / feedback

Bases: `success`, `warning`, `danger`, `info`.

```text
--signal-{role}              Solid base color
--signal-{role}-wash         Subtle tinted background (banners, alerts)
--signal-{role}-edge         Subtle border
--signal-{role}-ink          Text on --signal-{role} solid
```

### focus — focus indication

```text
--focus-ring                 Outline color
--focus-ring-strong          High-contrast variant for small targets
--focus-ring-shadow          Full box-shadow value for composite focus
```

### accent — decorative, non-interactive

```text
--accent-code                Inline code highlights
--accent-reference           Reference-material highlights
--accent-definition          Glossary term highlights
```

### overlay — scrims, backdrops

```text
--overlay-scrim              Modal backdrop
--overlay-tooltip-bg         Tooltip background
--overlay-tooltip-ink        Tooltip text
```

### selection — text/row selection

```text
--selection-bg
--selection-ink
```

### disabled — disabled state

```text
--disabled-surface
--disabled-ink
--disabled-edge
```

### link — hyperlinks (when distinct from action-link)

```text
--link-default
--link-hover
--link-visited
```

## Typography tokens

Typography lives in *bundles*, not atoms. A bundle is a TypeScript object resolved to a set of CSS variables.

### Reading

```text
--type-reading-body          Default body prose
--type-reading-lead          Emphasized lead paragraph
--type-reading-caption       Figure captions, small prose
--type-reading-quote         Blockquotes
```

### Heading

```text
--type-heading-1 .. --type-heading-6
```

### UI

```text
--type-ui-control            Button / input text
--type-ui-label              Form labels
--type-ui-caption            Table headers, metadata
--type-ui-badge              Badges, chips
```

### Code

```text
--type-code-inline
--type-code-block
```

### Definition

```text
--type-definition-term       Term in a term/definition pair
--type-definition-body       Definition body
```

### How bundles emit

A bundle expands to five sub-properties per bundle:

```text
--type-reading-body-family
--type-reading-body-size
--type-reading-body-weight
--type-reading-body-line-height
--type-reading-body-tracking
```

So CSS looks like:

```css
.body {
  font-family: var(--type-reading-body-family);
  font-size: var(--type-reading-body-size);
  font-weight: var(--type-reading-body-weight);
  line-height: var(--type-reading-body-line-height);
  letter-spacing: var(--type-reading-body-tracking);
}
```

A helper mixin or utility class (e.g. `.type-reading-body`) saves typing, but the five-variable contract is the truth.

## Layout tokens

```text
--layout-container-max              Max-width of page container
--layout-container-padding          Horizontal padding of container
--layout-grid-gap                   Default grid gap
--layout-panel-padding              Panel internal padding
--layout-panel-gap                  Panel's internal children gap
--layout-panel-header-size          Panel header type bundle size
--layout-panel-header-weight
--layout-panel-header-transform     (uppercase / none)
--layout-panel-header-tracking
--layout-panel-header-family
```

## Scale tokens (Layer 0 — never overridden)

```text
--space-2xs | --space-xs | --space-sm | --space-md | --space-lg | --space-xl | --space-2xl
--radius-sharp | --radius-xs | --radius-sm | --radius-md | --radius-lg | --radius-pill
--shadow-none | --shadow-sm | --shadow-md | --shadow-lg
--motion-fast | --motion-normal
--z-base | --z-dropdown | --z-sticky | --z-overlay | --z-modal | --z-toast | --z-tooltip
```

These form Layer 0 — the universal, immutable contract. Themes can *pick values* for the scale steps but cannot add new scale names without an ADR.

## Component tokens (Layer 2 — surgical overrides)

Introduce component tokens only when the component has a genuine override surface. Default binding resolves to a role token.

### Button

```text
--button-default-bg              default: var(--action-default)
--button-default-ink             default: var(--action-default-ink)
--button-default-edge            default: transparent
--button-default-bg-hover        default: var(--action-default-hover)
--button-default-bg-active       default: var(--action-default-active)
--button-radius                  default: var(--radius-md)
--button-padding-x-{sm,md,lg}
--button-padding-y-{sm,md,lg}
--button-height-{sm,md,lg}

Same shape for: button-hazard-*, button-caution-*, button-neutral-*, button-ghost-*
```

### Input / TextField

```text
--input-bg                       default: var(--surface-sunken)
--input-ink                      default: var(--ink-body)
--input-placeholder              default: var(--ink-subtle)
--input-edge                     default: var(--edge-default)
--input-edge-focus               default: var(--edge-focus)
--input-edge-error               default: var(--signal-danger)
--input-radius                   default: var(--radius-md)
--input-padding-x-{sm,md,lg}
--input-padding-y-{sm,md,lg}
--input-height-{sm,md,lg}
```

### Card / Panel

```text
--card-bg                        default: var(--surface-panel)
--card-edge                      default: var(--edge-default)
--card-radius                    default: var(--radius-md)
--card-padding                   default: var(--layout-panel-padding)
--card-shadow                    default: var(--shadow-sm)
```

### Dialog / Modal

```text
--dialog-bg                      default: var(--surface-overlay)
--dialog-edge                    default: var(--edge-default)
--dialog-radius                  default: var(--radius-lg)
--dialog-shadow                  default: var(--shadow-lg)
--dialog-scrim                   default: var(--overlay-scrim)
```

### Badge

```text
--badge-radius                   default: var(--radius-pill)
--badge-padding-x-{sm,md,lg}
--badge-padding-y-{sm,md,lg}
```

### Table

```text
--table-header-bg                default: var(--surface-sunken)
--table-header-ink               default: var(--ink-muted)
--table-row-edge                 default: var(--edge-subtle)
--table-row-bg-hover             default: var(--surface-muted)
--table-row-bg-selected          default: var(--action-default-wash)
```

## App-specific vocabulary extensions

Apps may extend vocabulary in their own `vocab.ts`. These tokens are scoped to the app:

```ts
// libs/themes/sim/vocab.ts
export const SIM_VOCAB = {
  instrumentHorizon: '--instrument-horizon',
  instrumentNeedle: '--instrument-needle',
  instrumentCautionArc: '--instrument-caution-arc',
  instrumentWarningArc: '--instrument-warning-arc',
  instrumentBezel: '--instrument-bezel',
  instrumentPanelBg: '--instrument-panel-bg',
} as const;
```

Shared libs (`libs/ui/*`) cannot reference these — enforced via TypeScript import boundaries. Sim's primitives can. This is the correct scope — an attitude indicator's horizon color is not a concern the Table component needs to know about.

## Naming rules

1. **No rank words.** Never `primary`, `secondary`, `tertiary`. Use the role name.
2. **Role-modifier order.** `<role>-<variant>-<state>`. Good: `action-default-hover`. Bad: `hover-action-default`.
3. **No abbreviations.** `background` → `bg` is fine (convention); `foreground` → `fg` is fine; `primary` → `prim` is not.
4. **kebab-case in CSS, camelCase in TS.** `--ink-body` and `tokens.ink.body`.
5. **Singular for roles, plural for collections.** `ink-body` (one role), `layouts: { reading, dashboard }` (collection).
6. **Don't leak tech.** No `-svelte`, `-hex`, `-rgb` in token names. Tokens are semantic, not implementation.

## Checklist when adding a token

- Does an existing token already cover the need? (90% of the time, yes.)
- Is it a role or a component token? Role if reusable across primitives; component if specific.
- What's its Layer? (0 = universal scale, 1 = theme palette, 2 = component override.)
- Does the derivation utility already compute this? (If so, don't declare it.)
- Is it shared or app-specific? (App-specific lives in that app's `vocab.ts`.)
- Will adding it require updating the lint rule's vocabulary? (Always yes for new role tokens; automatic for component tokens.)

If the answers don't come easily, don't add the token yet.
