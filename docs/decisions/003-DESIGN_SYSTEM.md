# 003: Design System Architecture

Decided 2026-03-25.

## Context

We need a design system that controls all visuals, fonts, spacing, and layouts. Themes must be fully isolated. Apps must have zero styling decisions -- they hand data to theme-driven layouts.

## Decision

### Two Libs

| Lib            | Contains                                            | Purpose                      |
| -------------- | --------------------------------------------------- | ---------------------------- |
| `libs/themes/` | Token contract (types), theme implementations (CSS) | Define what things look like |
| `libs/ui/`     | Svelte components, layout shells                    | Consume tokens, render UI    |

Themes define token values (CSS custom properties). UI components consume them. The coupling is the token contract (`--t-*` variable names), not import dependencies.

If we later need a third lib (design-tokens as abstract infrastructure for composing themes programmatically), we split. Not now.

### Theme Structure

```
libs/themes/
  types.ts              Token contract interfaces
  index.ts              Theme registry
  aviation/
    index.ts            Theme metadata (id, name, default mode)
    dark.css            Color tokens for dark mode
    light.css           Color tokens for light mode
    fonts.css           Font definitions + role assignments
    tokens.css          Spacing, radius, transitions, z-index
    layout.css          Layout tokens (nav, header, content, breakpoints)
```

Every theme must provide complete light AND dark color sets. Delete a theme directory, the system still works structurally (just no theme to render). Complete isolation.

### Layout Control

**Approach: Layout tokens** (not theme-specific layout components).

Themes provide CSS custom properties that layout components read. One set of layout components in `libs/ui/layouts/` responds to theme tokens. Different themes produce different layouts through different token values.

**What layout tokens control:** dimensions, spacing, flex-direction, visibility, and CSS-expressible structural changes (e.g., grid areas, sidebar width, header height).

```css
/* A theme that wants a left sidebar */
--t-nav-width: 260px;
--t-nav-direction: column;
--t-content-area: "nav content";

/* A theme that wants a top nav */
--t-nav-width: 0;
--t-nav-direction: row;
--t-content-area: "content";
```

**What layout tokens do NOT control:** fundamentally different DOM structures. If a theme needs a completely different element tree (not just different CSS on the same tree), the layout component reads the token value in Svelte and conditionally renders. This is the escape hatch -- used sparingly, for structural changes that CSS alone can't express.

```svelte
<!-- Layout component reads token and branches -->
{#if layoutMode === 'sidebar'}
  <SidebarLayout><slot /></SidebarLayout>
{:else}
  <TopNavLayout><slot /></TopNavLayout>
{/if}
```

We don't build the escape hatch now. Start with CSS-driven layout tokens. Add conditional rendering only when a real theme requires it.

**Key principle:** The page is a route, not a layout. Pages authenticate, fetch data, and hand content to the layout. How content is arranged on screen is the theme's job.

### Font Roles

Fonts grouped by purpose, not by generic names:

| Token                   | Purpose                           | Example use                    |
| ----------------------- | --------------------------------- | ------------------------------ |
| `--t-font-heading-lg-*` | Page titles, hero text            | Module title, dashboard header |
| `--t-font-heading-sm-*` | Section headers, panel titles     | Card headers, form sections    |
| `--t-font-reading-*`    | Body text, long-form content      | Briefings, descriptions        |
| `--t-font-ui-*`         | Buttons, labels, nav, controls    | Sidebar, badges, form labels   |
| `--t-font-code-*`       | Code, technical data, IDs         | Scenario IDs, config values    |
| `--t-font-caption-*`    | Captions, footnotes, timestamps   | Diagram labels, metadata       |
| `--t-font-question-*`   | Assessment question text          | Knowledge checks               |
| `--t-font-data-*`       | Table cells, metrics, instruments | Greenie board, time logs       |

Each role has sub-tokens: `-family`, `-size`, `-weight`, `-leading`.

### Color Groups

Semantic, not palette-based:

| Group     | Tokens                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Surface   | `bg`, `bg-subtle`, `surface`, `surface-hover`, `surface-raised`            |
| Text      | `text`, `text-muted`, `text-subtle`                                        |
| Border    | `border`, `border-subtle`                                                  |
| Action    | `primary`, `primary-hover`, `primary-text`, `secondary`, `secondary-hover` |
| Accent    | `accent`                                                                   |
| Selection | `selection`, `selection-text`                                              |
| Status    | `success`, `warning`, `danger`, `info`                                     |
| Scenario  | `safe`, `caution`, `critical`, `intervention`                              |
| Scoring   | `score-high`, `score-mid`, `score-low`                                     |
| Effects   | `shadow-sm/md/lg`, `focus-ring`, `overlay`                                 |

All colors OKLCH for perceptual uniformity.

### Token Naming Convention

All tokens use `--t-` prefix. Grammar: `--t-{category}-{role}-{property}`.

| Category | Pattern                      | Examples                                                        |
| -------- | ---------------------------- | --------------------------------------------------------------- |
| Font     | `--t-font-{role}-{property}` | `--t-font-heading-lg-size`, `--t-font-ui-weight`                |
| Color    | `--t-{group}-{name}`         | `--t-surface-bg`, `--t-action-primary`, `--t-scenario-critical` |
| Spacing  | `--t-space-{size}`           | `--t-space-xs`, `--t-space-lg`                                  |
| Layout   | `--t-{element}-{property}`   | `--t-nav-width`, `--t-header-height`                            |
| Radius   | `--t-radius-{size}`          | `--t-radius-sm`, `--t-radius-full`                              |
| Shadow   | `--t-shadow-{size}`          | `--t-shadow-sm`, `--t-shadow-lg`                                |

### Component Token Strategy

Components map from semantic theme tokens internally. Themes do NOT define per-component tokens (no `--t-button-*`). A Button reads `--t-action-primary`, `--t-font-ui-*`, etc.

If a component needs state-specific values (hover, disabled, focus), it derives them from semantic tokens using CSS (e.g., `color-mix()`, `oklch()` adjustments) or maps multiple semantic tokens.

### Fallback Strategy

All `var()` usage should include a fallback value: `var(--t-surface-bg, #fff)`. This prevents silent visual breakage if a theme omits a token. A base/default theme will be the first theme implemented -- all others extend or override it.

### Theme Loading

One theme active per app, set at build time via environment variable. Theme CSS is injected in the root layout. For runway (SSR), theme CSS is included in the server-rendered HTML to prevent flash of unstyled content.

### No Styles in Apps

- All visual CSS in components (`libs/ui/`) driven by theme tokens (`libs/themes/`)
- App route files contain no `<style>` blocks (or layout-flow only: grid, flex, gap)
- No hardcoded colors, font sizes, spacing, or any visual value anywhere outside themes
- No magic strings in CSS -- all values from tokens
