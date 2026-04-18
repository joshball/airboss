# App Theme Strategy

Cross-app strategy for how FIRC Boss should express different products without turning the design system into four unrelated codebases.

See also:

- [003-DESIGN_SYSTEM.md](../decisions/003-DESIGN_SYSTEM.md)
- [008-GLASS_COCKPIT_TOKEN_CONTRACT.md](../decisions/008-GLASS_COCKPIT_TOKEN_CONTRACT.md)
- [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md)

## Summary

We should not build four fully independent theme systems.

We should build:

- one shared design-system foundation
- three visual families
- one thin app-level override layer

Recommended family mapping:

| App      | Family      | Why                                                                              |
| -------- | ----------- | -------------------------------------------------------------------------------- |
| `hangar` | `workbench` | Content management, authoring, review, publishing, forms, tables                 |
| `ops`    | `workbench` | Admin and operational tooling shares shell and control patterns with Hangar      |
| `sim`    | `focus`     | Study, assessment, feedback, and progression need a different interaction rhythm |
| `runway` | `brand`     | Landing, SEO, pricing, and conversion have different goals than product apps     |

This means:

- `hangar` and `ops` should share most shell and component patterns
- `sim` should share primitives but not feel like a CRUD app
- `runway` should be adjacent to the system, not trapped inside admin-shell assumptions

## Why

Each app has a different job:

| App      | Primary job                                 | UX implication                                      |
| -------- | ------------------------------------------- | --------------------------------------------------- |
| `hangar` | Create, edit, organize, and publish content | Dense but readable work surfaces                    |
| `ops`    | Administer, monitor, govern, and support    | Higher density and stronger utilitarian clarity     |
| `sim`    | Train, test, review, and build mastery      | Lower chrome, stronger focus, larger reading rhythm |
| `runway` | Explain, persuade, convert, and transact    | Marketing-first composition and brand storytelling  |

If we treat them all as one theme:

- `sim` will feel like a CMS with bigger buttons
- `runway` will inherit product-app constraints it should not have

If we treat them as four unrelated themes:

- component maintenance becomes expensive
- visual consistency disappears
- shared primitives rot because every app bypasses them

## Recommended Model

Use three layers:

### 1. Core

Shared across every app and family.

Contains:

- base type scale
- spacing scale
- radius scale
- motion and transition tokens
- breakpoints
- z-index tokens
- semantic color groups
- accessibility tokens such as focus and selection

Core answers: "What does the system mean by primary, surface, muted text, warning, dense control, and page title?"

### 2. Family

Defines the shell and visual personality for a class of products.

Recommended families:

| Family      | Intent                   | Typical feel                                              |
| ----------- | ------------------------ | --------------------------------------------------------- |
| `workbench` | Operational workspace    | Structured, panel-based, table/form heavy                 |
| `focus`     | Training and assessment  | Calmer, larger type, less chrome, stronger state/progress |
| `brand`     | Marketing and conversion | Editorial, compositional, campaign-driven                 |

Family answers: "How does this class of product feel to use?"

### 3. App

Thin app-level overrides that personalize a family without redefining it.

App overrides should mainly adjust:

- accent hues
- domain-specific emphasis colors
- density within a narrow range
- shell labels and content widths
- small typography or panel tone adjustments

App overrides should not:

- redefine the whole component library
- create a new shell model
- fork base primitives unless the app genuinely needs different DOM

## Token Split

Recommended token ownership:

| Token tier | Owns                          | Examples                                                                                                    |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Core       | Meaning and scale             | `--t-font-md`, `--t-space-4`, `--t-text`, `--t-primary`, `--t-warning`, `--t-focus-ring`                    |
| Family     | Shell personality and density | `--t-sidebar-width`, `--t-header-height`, `--t-panel-padding`, `--t-nav-active-bg`, `--t-control-height-md` |
| App        | Accent and product flavor     | `--t-app-accent`, `--t-app-glow`, `--t-app-hero-tone`, `--t-app-metric-highlight`                           |

Recommended rule:

- core tokens should be stable and semantic
- family tokens should shape layout, chrome, and density
- app tokens should be few

If an app needs many app-only tokens, it probably wants a new family.

## Shell Split

We should think in shells before we think in colors.

### `WorkbenchShell`

For `hangar` and `ops`.

Expected traits:

- persistent nav
- utility header
- page title + actions
- panels, forms, tables, list screens
- high information density

Variation by app:

- `hangar`: slightly more editorial and content-friendly
- `ops`: slightly tighter and more operational

### `FocusShell`

For `sim`.

Expected traits:

- much lighter chrome
- stronger content focus
- larger reading size
- obvious progress, state, and outcome language
- less simultaneous navigation

This shell should support:

- lesson/test flow
- scenario flow
- review/debrief flow
- progress and mastery surfaces

### `BrandShell`

For `runway`.

Expected traits:

- landing-page sections
- campaign composition
- content bands, hero blocks, pricing, testimonials, CTAs
- lighter dependence on product-app shell conventions

This is the least likely to share shell code with the product apps.

## Component Split

Recommended component ownership:

### Shared Everywhere

These should stay in the shared UI foundation:

- Button
- Input
- Select
- Textarea
- Checkbox and radio primitives
- Alert
- Badge
- Dialog
- Toast
- simple Card or Panel primitive

### Shared by Product Apps

Useful across `workbench` and `focus`:

- PageTitle
- EmptyState
- Pagination
- simple stat cards
- field wrappers
- form stacks and sections

### `Workbench` Components

Expected to be used by `hangar` and `ops`:

- AppShell
- Sidebar
- Header
- DataTable
- filter bars
- bulk action bars
- admin page headers
- dense detail/edit layouts

### `Focus` Components

Expected to be used by `sim`:

- lesson shell
- question card
- answer group
- progress rail
- feedback and debrief blocks
- mastery and competency progress visuals

### `Brand` Components

Expected to be used by `runway`:

- hero
- feature band
- pricing card
- testimonial block
- CTA section
- marketing footer and nav

## App Recommendations

### Hangar

Recommended expression:

- `workbench` family
- readable light mode first
- authoring-first hierarchy
- comfortable forms and panels
- content management pages should feel like an editorial cockpit, not a control room

### Ops

Recommended expression:

- `workbench` family
- more compressed than Hangar
- stronger utility tone
- stronger state, warning, and audit semantics

### Sim

Recommended expression:

- `focus` family
- larger type
- simpler layout
- stronger emphasis on reading, acting, and reviewing
- avoid heavy sidebar/admin chrome

### Runway

Recommended expression:

- `brand` family
- do not force it through the CRUD shell
- SSR-first and conversion-aware
- richer typography and section composition

## Guardrails

We should avoid:

- four unrelated theme packages that each redefine everything
- app-specific CSS piled on top of shared components
- treating shell differences as "just color"
- making `runway` inherit admin-app assumptions
- making `sim` feel like `hangar` with different accents

We should prefer:

- family-first shell design
- shared primitives with clear ownership
- app overrides as the lightest layer
- component extraction when patterns repeat

## Resolved Decisions (Phase 1)

| Question                     | Decision                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family names                 | `workbench`, `focus`, `brand` -- confirmed                                                                                                                                        |
| `glass-cockpit` / `aviation` | Kept as style themes. Family is orthogonal -- `data-theme-family` attribute separate from `data-theme-id`                                                                         |
| Font roles: 5 vs 8           | Keep current 5 (`display`, `heading`, `text`, `ui`, `mono`). ADR 003's 8-role spec was aspirational. Families add role-specific tokens as needed (e.g., `--t-focus-reading-size`) |
| File structure               | Keep `tokens.css + dark.css + light.css`. Family overrides live in `libs/themes/families/{name}.css`                                                                              |
| Token ownership              | Core: semantic tokens, scales, accessibility. Family: shell dimensions, density, layout rhythm. App: accent hues, thin overrides                                                  |

## Implementation

### HTML Attributes

```html
<html data-theme-id="glass-cockpit" data-theme-mode="light" data-app-id="hangar" data-theme-family="workbench"></html>
```

Four data attributes control theming:

- `data-theme-id` -- which style theme (glass-cockpit, aviation)
- `data-theme-mode` -- light or dark
- `data-app-id` -- which app (hangar, ops, sim, runway)
- `data-theme-family` -- which family (workbench, focus, brand)

### CSS Load Order

1. Style theme tokens (e.g., `glass-cockpit/tokens.css`)
2. Style theme mode (e.g., `glass-cockpit/dark.css`)
3. Family overrides (e.g., `families/workbench.css`)

Family CSS overrides shell and density tokens without touching color. Style themes own color and typography; families own layout and density.

### Token Layers

| Layer        | Selector                                                      | Examples                                                  |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| Core style   | `html[data-theme-id='glass-cockpit']`                         | `--t-font-md`, `--t-space-4`, `--t-radius-md`             |
| Mode         | `html[data-theme-id='glass-cockpit'][data-theme-mode='dark']` | `--t-bg`, `--t-text`, `--t-primary`                       |
| App accent   | `html[data-theme-id='glass-cockpit'][data-app-id='sim']`      | `--t-app-primary-light`, `--t-app-glow-dark-1`            |
| Family       | `html[data-theme-family='workbench']`                         | `--t-sidebar-width`, `--t-shell-gap`, `--t-panel-padding` |
| Family + app | `html[data-theme-family='workbench'][data-app-id='ops']`      | `--t-sidebar-width` (narrower for ops)                    |

## Immediate Implications

The architecture is now:

- Foundation is shared (style themes define colors, type, and component tokens)
- Shell is family-driven (families define layout, density, and shell behavior)
- App differences are thin (accent hues from style themes, density tweaks from families)
