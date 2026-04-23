# Reference architecture

The as-built shape of airboss's theme system, post Option A overhaul (PRs #78 - #85). Every element here is in `libs/themes/` on main right now. Where this doc disagrees with the code, the code wins - file an ADR and update the doc.

Read [01-LESSONS.md](01-LESSONS.md) first for *why* the shape is what it is. Read [05-OVERHAUL-2026-04.md](05-OVERHAUL-2026-04.md) for *how* the overhaul actually landed.

## The three axes (and only three)

| Axis         | Values                                                                | Applied via                                             |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------- |
| `theme`      | `airboss/default`, `study/sectional`, `study/flightdeck`, `sim/glass` | `data-theme` attribute                                  |
| `appearance` | `light` \| `dark` (themes declare which they support)                 | `data-appearance` attribute                             |
| `layout`     | `reading`, `dashboard`, `cockpit`                                     | `data-layout` attribute (+ layout CSS on the container) |

That is the entire composition surface. Density, chrome, and elevation live inside a theme, not as separate axes.

`sim/glass` is dark-only; the resolver forces `appearance: 'dark'` on any `/sim*` path so the user's cookie preference cannot crash it.

## Directory layout

```text
libs/themes/
  index.ts                       Public API: types, derive/emit/registry/resolve, packs, vocab
  ThemeProvider.svelte           Sets data-theme / data-appearance / data-layout on a display:contents div
  contract.ts                    Theme / Palette / TypographyPack / ControlTokens / SimTokens
  vocab.ts                       TOKENS catalog (role-token names)
  registry.ts                    registerTheme / getTheme / getThemeSafe / isValidThemeId / listThemes
  resolve.ts                     resolveThemeForPath + appearance-preference parsing / cookie helpers
  derive.ts                      alpha / adjustBrightness / deriveInteractiveStates / deriveSignalVariants
  emit.ts                        themeToCss / emitAllThemes (deterministic CSS emission)
  contrast.ts                    luminance / contrastRatio
  tones.ts                       resolveTone + TONES registry

  generated/
    tokens.css                   Emitted by scripts/themes/emit.ts. Committed. CI checks for drift.

  core/
    typography-packs.ts          AIRBOSS_STANDARD_PACK, AIRBOSS_COMPACT_PACK, TYPOGRAPHY_PACKS registry
    defaults/
      airboss-default/           The shared base theme; every other theme extends this.
        index.ts                 registerTheme(...)
        palette.light.ts
        palette.dark.ts
        typography.ts
        control.ts
        chrome.ts
        layouts/{reading,dashboard}.css

  study/
    sectional/                   Light + dark, reading layout. Default for everything outside /sim and /dashboard.
    flightdeck/                  Light + dark, dashboard layout. Used for /dashboard*.
  sim/
    glass/                       Dark-only, cockpit layout. Used for /sim*. Ships SimTokens.

  __tests__/
    contrast-matrix.test.ts      WCAG AA/AAA pair checks across every theme x appearance.
    palette-parse.test.ts        OKLCH round-trips.
    emit.test.ts                 Deterministic output snapshots.
    contrast.test.ts, derive.test.ts, registry.test.ts, resolve.test.ts, typography-packs.test.ts

scripts/themes/emit.ts           bun script that writes libs/themes/generated/tokens.css.

tools/
  theme-lint/                    Call-site CSS lint (hex / rgb / hsl / oklch / raw-length / raw-duration / unknown-token).
  theme-codemod/                 Mechanical rewrites (radius / motion / font-family literals -> tokens).
```

Every theme registers itself at module load via `registerTheme(...)` in `libs/themes/index.ts`. `emit.ts` walks `listThemes()` and produces one selector block per `(theme, appearance)` pair.

## The contract (TypeScript)

Source: `libs/themes/contract.ts`.

```ts
export type AppearanceMode = 'light' | 'dark';
export type ThemeId = string;                   // `${app}/${name}`

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  extends?: ThemeId;
  appearances: AppearanceMode[];
  defaultAppearance: AppearanceMode;
  layouts: Record<string, string>;
  defaultLayout: string;
  palette: { light?: Palette; dark?: Palette };
  typography: TypographyPack;
  chrome: Chrome;
  control: ControlTokens;
  sim?: SimTokens;
  componentTokens?: Partial<ComponentTokens>;
  vocabulary?: AppVocabulary;
}

export interface Palette {
  ink:     { body; muted; subtle; faint; strong; inverse };
  surface: { page; panel; raised; sunken; muted; overlay };
  edge:    { default; strong; subtle };
  action:  { default; hazard; caution; neutral; link };     // bases only
  signal:  { success; warning; danger; info };              // bases only
  focus:   string;
  accent:  { code; reference; definition };
  overrides?: Partial<DerivedPalette>;
}

export interface TypographyPack {
  packId: string;
  families: { sans; serif; mono; base; display? };
  adjustments: { sans; serif; mono; base; display? };
  bundles: {
    reading:    { body; lead; caption; quote };
    heading:    { 1; 2; 3; 4; 5; 6 };
    ui:         { control; label; caption; badge };
    code:       { inline; block };
    definition: { term; body };
  };
}

export interface ControlTokens {
  button: Record<'default' | 'primary' | 'hazard' | 'neutral' | 'ghost', ControlSlots>;
  input:  Record<'default' | 'error', ControlSlots>;
}

export interface SimTokens {
  panel; instrument; horizon; arc; status; banner;
  readout: { warningBg };
  muted:   { stateBg };
}

export interface ThemeSelection {
  theme: ThemeId;
  appearance: AppearanceMode;
  layout: string;
}
```

A theme that has no opinion can extend `airboss/default` and leave nearly every field unset; the resolver walks the `extends` chain and fills from the parent.

## The layered token model

Four layers, later overrides earlier:

1. **Role tokens** - base vocabulary (`--ink-body`, `--surface-panel`, `--action-default-hover`). Defined in `vocab.ts`; emitted from palette + `derive.ts`.
2. **Control tokens** - button + input surface slots (`--button-primary-bg`, `--input-error-border`). Themes supply a `ControlTokens` object; the default points every slot at a role token via `var()` so theme swaps propagate.
3. **Component tokens** - dialog, table, badge-height, underline-offset. Emitted in a single atomic block (`controlsAtomicBlock` in `emit.ts`) so primitives have a stable surface.
4. **Sim tokens** - `--sim-*` family. Emitted only when the active theme declares a `sim` block.

Token names never change under a theme swap; only their values do.

## The role vocabulary

Complete catalog: [04-VOCABULARY.md](04-VOCABULARY.md). Shape:

```text
ink         { body, muted, subtle, faint, strong, inverse }
surface     { page, panel, raised, sunken, muted, overlay }
edge        { default, strong, subtle, focus }
action      { default, hazard, caution, neutral, link } x { base, hover, active, wash, edge, ink, disabled }
signal      { success, warning, danger, info }           x { solid, wash, edge, ink }
focus       { ring, ring-strong, shadow }
accent      { code, reference, definition }
overlay     { scrim, tooltip-bg, tooltip-ink }
selection   { bg, ink }
disabled    { surface, ink, edge }
link        { default, hover, visited }

Typography: type-{reading,heading,ui,code,definition}-{variant}-{family,size,weight,line-height,tracking}
Scales:     space-*, radius-*, shadow-*, motion-*, underline-offset-*
Layout:     layout-container-*, layout-grid-gap, layout-panel-*
Controls:   button-{variant}-{slot}, input-{variant}-{slot}, button-height-*, input-height-*, badge-height-*
Components: dialog-*, table-*
Sim:        sim-*
```

Around 350 emitted token names per `(theme, appearance)` block.

## Derivation, not enumeration

A theme declares *base* colors per role. Hover, active, wash, edge, ink, disabled are derived by `deriveInteractiveStates(base, isDark)`. OKLCH lightness shifts are perceptually uniform.

```ts
export function deriveInteractiveStates(base: string, isDark: boolean): InteractiveStates {
  return {
    base,
    hover:    adjustBrightness(base, isDark ? +0.10 : -0.10),
    active:   adjustBrightness(base, isDark ? +0.20 : -0.20),
    wash:     alpha(base, isDark ? 0.18 : 0.08),
    edge:     alpha(base, isDark ? 0.40 : 0.24),
    ink:      getContrastingTextColor(base),
    disabled: alpha(base, 0.40),
  };
}
```

`adjustBrightness` parses OKLCH, shifts lightness, re-emits OKLCH. `alpha` appends `/ <opacity>`. Both pass non-OKLCH input through unchanged, which is how explicit hex overrides survive the derivation step.

### Explicit overrides

`palette.overrides: Partial<DerivedPalette>` is merged over the derived bundle in `emit.ts`. Dark themes use this to pin hex hover/active values where OKLCH math produces the wrong tone. Merge is `{ ...derived, ...override }`.

## The emit pipeline

Source: `libs/themes/emit.ts` + `scripts/themes/emit.ts`.

```text
listThemes()  (alphabetical -> deterministic)
for each theme:
  for each appearance in theme.appearances:
    resolveTheme(theme)            // walk extends chain, merge
    paletteBlock(palette, isDark)
    typographyBlock(pack)
    chromeBlock(chrome)
    controlsAtomicBlock()
    controlTokensBlock(control)
    simBlock(sim)                  // only if theme.sim defined
  emit `[data-theme="<id>"][data-appearance="<mode>"] { ... }`

rootFallbackBlock()                // airboss/default light, re-targeted to :root
REDUCED_MOTION_BLOCK               // @media (prefers-reduced-motion: reduce)
```

Output is committed to `libs/themes/generated/tokens.css` and imported once at app root. CI reruns `bun run themes:emit` and fails on drift; the pipeline guarantees byte-identical output for unchanged sources.

### Currently emitted selector blocks

```text
:root                                               (airboss/default light fallback)
[data-theme="airboss/default"][data-appearance="light"|"dark"]
[data-theme="study/sectional"][data-appearance="light"|"dark"]
[data-theme="study/flightdeck"][data-appearance="light"|"dark"]
[data-theme="sim/glass"][data-appearance="dark"]
@media (prefers-reduced-motion: reduce) { ... --motion-fast: 0ms; --motion-normal: 0ms; }
```

## Typography packs

Source: `libs/themes/core/typography-packs.ts`. A pack carries `families`, per-family `adjustments` multipliers, and full `bundles` for `reading/heading/ui/code/definition`.

Shipped: `AIRBOSS_STANDARD_PACK` (sans reading column; `airboss/default`, `study/sectional`) and `AIRBOSS_COMPACT_PACK` (mono, compressed leading; `study/flightdeck`, `sim/glass`).

Swap `adjustments.sans` to `0.95` and every sans bundle shrinks without editing 30 bundles.

## The registry

Source: `libs/themes/registry.ts`.

```ts
registerTheme(theme)            // throws on duplicate id
getTheme(id)                    // throws on unknown
getThemeSafe(id)                // returns undefined
isValidThemeId(id)              // type predicate for untrusted input
listThemes()                    // emit + tests
__resetRegistryForTests()       // test-only hook
```

Adding a theme is one file: `libs/themes/<app>/<name>/index.ts` exports an object that satisfies `Theme`, calls `registerTheme`, plus one import in `libs/themes/index.ts`.

## The resolver

Source: `libs/themes/resolve.ts`. `resolveThemeForPath(pathname, userAppearance, systemAppearance) -> ThemeSelection` is the single place that maps URL + appearance preference to theme selection. Routes never pick themes directly.

| Path prefix        | Theme                 | Layout      |
| ------------------ | --------------------- | ----------- |
| `/sim`, `/sim/*`   | `sim/glass`           | `cockpit`   |
| `/dashboard*`      | `study/flightdeck`    | `dashboard` |
| everything else    | `study/sectional`     | `reading`   |

Appearance:

1. Sim path -> force `dark`.
2. User pref is `system` -> use `systemAppearance`.
3. Otherwise use user's `light` / `dark`.

Extend `FLIGHTDECK_PATH_PREFIXES` / `SIM_PATH_PREFIXES` when new dashboard or cockpit surfaces ship. Never sprinkle `data-theme="..."` into routes.

## Appearance preference: cookie + toggle

`AppearancePreference = 'system' | 'light' | 'dark'` in cookie `appearance` (constant `APPEARANCE_COOKIE`).

Read path:

```text
hooks.server.ts -> cookies.get(APPEARANCE_COOKIE) -> parseAppearancePreference -> event.locals.appearance
(app)/+layout.server.ts returns { appearance }
(app)/+layout.svelte: $state + $effects track data.appearance, matchMedia, mirror onto <html data-appearance=...>
```

Write path: segmented toggle POSTs to `/appearance` with `{ value }`; `apps/study/src/routes/appearance/+server.ts` validates via `isAppearancePreference`, sets cookie (`Path=/; Max-Age=1y; SameSite=Lax`), returns `{ ok, value }`. Toggle flips local `$state` immediately so UI responds even if fetch fails.

## Pre-hydration script

Source: `apps/study/src/app.html` - inline `<head>` script that mirrors `resolveThemeForPath` before SvelteKit mounts. Sets `data-theme` / `data-appearance` / `data-layout` on `<html>` from path + appearance cookie + `prefers-color-scheme`. `<html>` ships default attributes so a script failure still paints against valid tokens. The `:root` fallback block covers the window before `ThemeProvider` mounts.

## ThemeProvider

Source: `libs/themes/ThemeProvider.svelte`. Runes; `display: contents`.

```svelte
<div data-theme={theme} data-appearance={appearance} data-layout={layout} class="ab-theme">
  {@render children()}
</div>

<style>.ab-theme { display: contents; }</style>
```

Providers nest freely. `(app)/+layout.svelte` puts the provider inside `<main>` so nav stays on the outer theme while content switches on `/dashboard`.

To paint a surface wrap children in `Card` or `PanelShell`; the provider paints nothing.

## What this buys

- One source of truth (TypeScript). Generated CSS is a build artifact with a CI drift check.
- Three axes - predictable composition surface; no combinatorial explosion.
- Derivation - one base per role, six states.
- Registry - adding a theme is a one-file operation; duplicates throw.
- Pre-hydration + cookie appearance - zero FOUC, preference survives refresh, system fallback updates live.
- App-scoped vocabulary (`SimTokens`) - instrument tokens can't leak into unrelated primitives.
- Lint + codemod + contrast tests ship with the system - enforcement is not deferred.
