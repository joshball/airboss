# 008: Glass Cockpit Extended Token Contract (ARCHIVED)

> **Archived 2026-04-25.** Superseded by the as-built theme system. The "Glass Cockpit" single-theme concept this ADR amends was replaced during the Option A overhaul: the system now ships `study/sectional`, `study/flightdeck`, and `sim/glass` as distinct themes under three orthogonal axes (`theme` × `appearance` × `layout`). The `--t-*` token prefix referenced throughout was never adopted; live tokens are unprefixed (`--action-default`, `--surface-page`, etc.).
>
> The control-token problem this ADR identified (gradient/inset bg values that can't be derived) was addressed differently: themes ship a `ControlTokens` block ([libs/themes/contract.ts](../../../libs/themes/contract.ts)) with explicit `bg`/`hoverBg`/`activeBg`/etc. slots per button variant, and theme-specific values land in each theme's `control.ts` (e.g. `libs/themes/sim/glass/control.ts`). No `color-mix()` derivation contract remained.
>
> **Current source of truth:** [docs/platform/theme-system/02-ARCHITECTURE.md](../../platform/theme-system/02-ARCHITECTURE.md) §"The layered token model" and §"The contract (TypeScript)".
>
> Kept for historical context only.

---

Decided 2026-03-26. Amends ADR 003.

## Context

ADR 003 states that themes define semantic tokens only (`--t-primary`, `--t-surface`, `--t-text-muted`, etc.) and components derive state variants (hover, active, focus) internally using `color-mix()`. This allows components to be theme-agnostic.

The Glass Cockpit theme cannot follow this contract. Its glassmorphic aesthetic requires gradient backgrounds with complex color stops, layered inset shadows, and translucent surfaces with backdrop blur. These cannot be expressed by components at render time using `color-mix()` -- they require pre-computed multi-stop gradient values that only make sense in the context of a specific theme.

Example: a primary button in Glass Cockpit has a `background` that is:

```css
linear-gradient(
  180deg,
  color-mix(in oklch, var(--t-primary) 46%, oklch(0.25 0.018 248)) 0%,
  color-mix(in oklch, var(--t-primary) 64%, oklch(0.2 0.018 248)) 100%
)
```

This cannot be encoded in `Button.svelte` without knowing the theme. It must live in the theme.

## Decision

Glass Cockpit defines **component tokens** in addition to semantic tokens. These are pre-computed values for specific component states that are too complex to derive at the component layer.

This creates **two tiers** of theme implementation:

| Tier          | Themes        | Token types                        | Component work when adding |
| ------------- | ------------- | ---------------------------------- | -------------------------- |
| Semantic-only | Aviation      | `--t-primary`, `--t-surface`, etc. | None                       |
| Extended      | Glass Cockpit | Semantic + component tokens        | Must add component tokens  |

### Component Token Namespaces (Glass Cockpit)

Defined in `glass-cockpit/light.css` and `glass-cockpit/dark.css`:

| Namespace                | Tokens                                                                                                                  | Used by                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--t-button-primary-*`   | bg, bg-hover, border, border-hover, text, shadow, shadow-hover                                                          | Button (primary)        |
| `--t-button-secondary-*` | bg, bg-hover, border, border-hover, text, shadow, shadow-hover                                                          | Button (secondary)      |
| `--t-button-danger-*`    | bg, bg-hover, border, border-hover, text, shadow, shadow-hover                                                          | Button (danger)         |
| `--t-button-ghost-*`     | bg, bg-hover, border, border-hover, text                                                                                | Button (ghost)          |
| `--t-control-*`          | bg, bg-hover, border, border-hover, shadow, focus-ring, placeholder, radius                                             | Input, Select, Textarea |
| `--t-panel-*`            | bg, bg-hover, border, shadow, header-bg, header-border, inset-bg, inset-border                                          | Panel                   |
| `--t-badge-{variant}-*`  | bg, border, text (for default/success/warning/danger/info)                                                              | Badge                   |
| `--t-alert-{variant}-*`  | bg, border, text, shadow (for danger/success/info)                                                                      | Alert                   |
| `--t-table-*`            | bg, border, head-bg, row-alt, row-hover, shadow                                                                         | DataTable               |
| `--t-sidebar-*`          | link-hover-bg, link-hover-border, link-active-bg, link-active-border, link-active-text, group-color, group-hover, badge | Sidebar                 |
| `--t-shell-*`            | bg, sidebar-bg, sidebar-border, sidebar-shadow, header-bg, header-border, header-shadow                                 | AppShell                |
| `--t-toast-*`            | bg, border, shadow                                                                                                      | ToastContainer          |

### Per-App Color System

Glass Cockpit also supports per-app accent colors via `data-app-id` on `<html>`. The `tokens.css` file defines overrides for `hangar`, `sim`, `ops`, and `runway`. These set:

- `--t-app-primary-light` / `--t-app-primary-dark`
- `--t-app-accent-light` / `--t-app-accent-dark`
- `--t-app-glow-light-1/2` / `--t-app-glow-dark-1/2`

These feed into `--t-primary`, `--t-accent`, and `--t-body-background` in the mode files. Without `data-app-id`, the app uses hangar defaults.

## Checklist: Adding a New Component

When adding a component to `libs/ui/`:

- [ ] Write the component using semantic tokens (`--t-primary`, `--t-surface`, etc.)
- [ ] Verify it looks correct with the Aviation theme (semantic tokens only)
- [ ] Decide what component tokens it needs for Glass Cockpit (backgrounds as gradients, shadow values, etc.)
- [ ] Add the component tokens to `glass-cockpit/light.css`
- [ ] Add the component tokens to `glass-cockpit/dark.css`
- [ ] Use the component tokens in the component via `var(--t-{component}-*, fallback)` -- fallback to the semantic token that makes sense in Aviation

Example token with fallback:

```css
.my-component {
  background: var(--t-mycomponent-bg, var(--t-surface));
  border: 1px solid var(--t-mycomponent-border, var(--t-border));
  box-shadow: var(--t-mycomponent-shadow, var(--t-shadow-sm));
}
```

This way: Aviation uses the fallback (semantic token), Glass Cockpit uses the pre-computed token.

## Consequences

- Aviation remains the reference implementation. New components work there automatically.
- Glass Cockpit requires extra token work per component. Missing tokens cause the component to look flat/generic rather than broken (due to fallbacks).
- The two themes diverge architecturally but remain coupled at the semantic token contract.
- Adding a third theme: it can follow either tier. Semantic-only is simpler; extended allows richer visual treatment.
