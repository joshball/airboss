# Reference architecture

The shape every new project should start from. Derived from [01-LESSONS.md](01-LESSONS.md); nothing here is invented fresh — every element survived an iteration.

## The three axes (and only three)

| Axis         | Values                                  | Applied via                             |
| ------------ | --------------------------------------- | --------------------------------------- |
| `theme`      | app-specific (e.g. `sectional`, `flightdeck`, `glass`) | `data-theme` attribute on a container   |
| `appearance` | `light` \| `dark`                       | `data-appearance` attribute             |
| `layout`     | theme-specific (e.g. `reading`, `dashboard`, `cockpit`) | class on the page container             |

That's the whole composition surface. Do not add a fourth axis.

Density, chrome, and elevation are *inside* a theme — not separate axes. If you want denser, make a new theme. If you want more chrome, override component tokens.

## Directory layout

```text
libs/themes/
  index.ts                       Public API: resolveTheme, ThemeProvider, registry
  ThemeProvider.svelte           Sets data-theme + data-appearance; uses display: contents
  registry.ts                    Central theme registry with safe getters
  contract.ts                    TypeScript theme contract (Theme, Palette, Typography, etc.)
  emit.ts                        tokensToCss() — emits CSS from a theme object
  derive.ts                      Color derivation utilities (alpha, brightness, states)
  contrast.ts                    WCAG contrast-ratio helpers
  vocab.ts                       The token name registry (Layer 0 vocabulary)

  core/                          Layer 0: universal, immutable
    spacing.ts                   Spacing scale (never changes)
    zindex.ts                    Z-index ladder
    breakpoints.ts               Responsive breakpoints
    motion.ts                    Durations, easings
    typography-packs.ts          Named font pairings with per-font adjustments
    defaults/
      airboss-default/           Shared base theme. Apps inherit from this.
        index.ts
        palette.light.ts
        palette.dark.ts
        typography.ts
        chrome.ts
        layouts/
          reading.css
          dashboard.css

  <app>/                         Layer 1: per-app themes
    <theme-name>/
      index.ts                   Theme definition, extends a base
      palette.light.ts           Only values this theme overrides
      palette.dark.ts
      typography.ts
      chrome.ts
      vocab.ts                   App-specific token extensions (e.g. sim's instrument-*)
      layouts/
        <layout-name>.css        Theme-specific layout templates
      components/                Per-component token overrides (rare, surgical)
        button.ts
```

Apps that have no opinion can ship a five-line theme that inherits everything from `airboss-default`. An empty `palette.light.ts` is valid.

## The layered token model

Three layers, in priority order (later overrides earlier):

1. **Role tokens** — base vocabulary (`--ink-body`, `--surface-panel`, `--action-default`). Shared across all apps and themes.
2. **Component tokens** — where a component has a surgical override point (`--button-default-bg`, `--input-error-edge`). Normally resolve to role tokens (`var(--action-default)`); apps can rebind them.
3. **Override tokens** — per-route, per-section. Rare. A surface can re-map a single component token without forking the theme.

**Discipline**: component tokens exist only where a component has a genuine override surface. Don't introduce them on principle. A divider probably doesn't need component tokens. A button does.

## The role vocabulary (Layer 0)

Keep role families at ~12. Use modifiers for variation.

```text
Roles:
  ink          text color        { body, muted, subtle, faint, inverse, strong }
  surface      fills             { page, panel, raised, sunken, muted, overlay }
  edge         borders           { default, strong, subtle, focus }
  action       interactive       { default, hazard, caution, neutral, link }
                                 each with: { base, hover, active, wash, edge, ink, disabled }
  signal       status            { success, warning, danger, info }
                                 each with: { solid, wash, edge, ink }
  focus        focus rings       { ring, ring-strong, shadow }
  accent       decorative        { code, reference, definition }
  overlay      scrims, backdrops { scrim, tooltip-bg, tooltip-ink }
  selection    text/row select   { bg, ink }
  disabled     disabled state    { surface, ink, edge }
  link         hyperlinks        { default, visited, hover }

Typography roles (each is a bundle, not atoms):
  type-reading       { body, lead, caption, quote }
  type-heading       { 1, 2, 3, 4, 5, 6 }
  type-ui            { control, label, caption, badge }
  type-code          { inline, block }
  type-definition    { term, body }

Layout variables:
  layout-container-max
  layout-container-padding
  layout-grid-gap
  layout-panel-padding
  layout-panel-gap
  layout-panel-header-*

Spacing (Layer 0, never overridden by themes):
  space-{2xs, xs, sm, md, lg, xl, 2xl}

Radius / shadow / motion (Layer 0 scale, themes pick values):
  radius-{sharp, xs, sm, md, lg, pill}
  shadow-{none, sm, md, lg}
  motion-{fast, normal}
```

Total role-token names: ~120. Manageable. Every component can read from a small, stable surface.

## The contract (TypeScript)

```ts
// libs/themes/contract.ts
export type AppearanceMode = 'light' | 'dark';
export type ThemeId = string; // `${app}/${name}`, e.g. 'study/sectional'

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  extends?: ThemeId;
  appearances: AppearanceMode[]; // some themes are dark-only (e.g. sim/glass)
  defaultAppearance: AppearanceMode;
  layouts: Record<string, string>; // name -> CSS file path
  defaultLayout: string;
  palette: {
    light?: Palette;
    dark?: Palette;
  };
  typography: TypographyPack;
  chrome: Chrome;
  componentTokens?: Partial<ComponentTokens>;
  vocabulary?: AppVocabulary; // app-specific extensions, typed
}

export interface Palette {
  // Base colors per role. Variants (hover, active, wash, edge, ink) are
  // derived by math unless explicitly overridden.
  ink: { body: string; muted: string; subtle: string; faint: string; inverse: string; strong: string };
  surface: { page: string; panel: string; raised: string; sunken: string; muted: string; overlay: string };
  edge: { default: string; strong: string; subtle: string };
  action: {
    default: string;
    hazard: string;
    caution: string;
    neutral: string;
    link: string;
  };
  signal: { success: string; warning: string; danger: string; info: string };
  focus: string;
  accent: { code: string; reference: string; definition: string };
  // Overrides are optional. Anything not set is derived from the base.
  overrides?: Partial<DerivedPalette>;
}

export interface TypographyPack {
  packId: string;                   // from core/typography-packs.ts
  scale?: number;                   // 1.0 default; pack's sizes are multiplied
  families?: Partial<FontFamilies>; // optional per-family override
  bundles: {
    reading: { body: TypeBundle; lead: TypeBundle; caption: TypeBundle; quote: TypeBundle };
    heading: { 1: TypeBundle; 2: TypeBundle; 3: TypeBundle; 4: TypeBundle; 5: TypeBundle; 6: TypeBundle };
    ui: { control: TypeBundle; label: TypeBundle; caption: TypeBundle; badge: TypeBundle };
    code: { inline: TypeBundle; block: TypeBundle };
    definition: { term: TypeBundle; body: TypeBundle };
  };
}

export interface TypeBundle {
  family: string;      // references a family from the pack
  size: string;        // rem
  weight: number;
  lineHeight: number;
  tracking: string;
}
```

## Derivation, not enumeration

A theme declares *base* colors. Hover, active, wash, edge, ink variants are derived by math.

```ts
// libs/themes/derive.ts

export function deriveInteractiveStates(base: string, isDark: boolean): InteractiveStates {
  return {
    base,
    hover: adjustBrightness(base, isDark ? +0.08 : -0.08),
    active: adjustBrightness(base, isDark ? +0.16 : -0.16),
    wash: alpha(base, isDark ? 0.18 : 0.08),
    edge: alpha(base, isDark ? 0.40 : 0.24),
    ink: getContrastingTextColor(base),
    disabled: alpha(base, 0.40),
  };
}

export function deriveSignalVariants(base: string, isDark: boolean): SignalStates {
  return {
    solid: base,
    wash: alpha(base, isDark ? 0.12 : 0.08),
    edge: alpha(base, isDark ? 0.35 : 0.25),
    ink: getContrastingTextColor(base),
  };
}
```

Themes can override any derived value explicitly (via `palette.overrides`) when the math produces the wrong result (e.g. signal-warning needs a specific ink that isn't the math default). But overrides are opt-in, not required.

**Use OKLCH for color math.** Lightness shifts behave predictably regardless of hue. HSL will make your action-default-hover inconsistent across themes.

## Emission

TypeScript theme objects are the source of truth. `emit.ts` produces CSS:

```ts
// libs/themes/emit.ts
export function themeToCss(theme: Theme, appearance: AppearanceMode): string {
  const resolved = resolveTheme(theme);           // extends chain resolved
  const palette = resolveDerivations(resolved.palette[appearance]);
  const blocks = [
    roleTokensBlock(palette),
    typographyBlock(resolved.typography),
    chromeBlock(resolved.chrome),
    layoutBlock(resolved.chrome),
    componentTokensBlock(resolved.componentTokens, palette),
  ];
  return `[data-theme="${theme.id}"][data-appearance="${appearance}"] { ${blocks.join('\n')} }`;
}
```

Emission happens at build time (tokens.css is a build artifact) or at dev-server startup. **Do not edit the emitted CSS by hand.** The vocabulary is tracked in TS; CSS is a derived output.

## The registry

```ts
// libs/themes/registry.ts
const themes = new Map<ThemeId, Theme>();

export function registerTheme(theme: Theme): void {
  if (themes.has(theme.id)) throw new Error(`Duplicate theme id: ${theme.id}`);
  themes.set(theme.id, theme);
}

export function getTheme(id: ThemeId): Theme {
  const t = themes.get(id);
  if (!t) throw new Error(`Unknown theme: ${id}. Registered: ${[...themes.keys()].join(', ')}`);
  return t;
}

export function getThemeSafe(id: string): Theme | undefined {
  return themes.get(id as ThemeId);
}

export function isValidThemeId(id: string): id is ThemeId {
  return themes.has(id as ThemeId);
}

export function listThemes(): Theme[] { return [...themes.values()]; }
```

Each theme's `index.ts` calls `registerTheme(...)`. Adding a theme is a one-file, one-function-call operation.

## Resolver

```ts
// libs/themes/resolve.ts
export interface ThemeSelection {
  theme: ThemeId;
  appearance: AppearanceMode;
  layout: string;
}

export function resolveTheme(
  path: string,
  userAppearance: AppearanceMode | 'system',
  systemAppearance: AppearanceMode,
): ThemeSelection {
  // 1. Determine theme by path (or user preference, etc.)
  // 2. Determine appearance: user pick > system pref > theme default
  // 3. Determine layout: theme's default for this path
  // 4. Return all three, composable.
}
```

The resolver is the one place path-to-theme mapping lives. Routes don't choose themes directly.

## Pre-hydration script

`app.html` ships a tiny inline script that runs before SvelteKit hydrates:

```html
<script>
  (function() {
    try {
      const stored = document.cookie.match(/appearance=(light|dark)/);
      const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const appearance = stored ? stored[1] : system;
      const theme = /* path-based resolution */;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-appearance', appearance);
    } catch (e) { /* no-op; CSS defaults cover fallback */ }
  })();
</script>
```

Solves FOUC from day one. If you skip this, you'll write it later after debugging hydration mismatches.

## What this buys you

- One source of truth (TS) → no CSS/TS drift.
- Three axes → predictable composition surface.
- Derivation → declare 5 base colors, get 30 variants for free.
- Registry → impossible to orphan a theme.
- Layered architecture → Layer 0 can't be broken by app changes.
- Pre-hydration → no FOUC.
- App-scoped vocabulary → sim's instrument tokens can't leak into hangar.

And critically: **empty theme files are valid**. An app with no opinion inherits everything. Divergence is deliberate and visible.
