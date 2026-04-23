---
feature: themability-audit
category: ux
date: 2026-04-22
branch: main
issues_found: 18
critical: 3
major: 7
minor: 5
nit: 3
---

## Summary

The token system at [libs/themes/tokens.css](libs/themes/tokens.css) is well-shaped — `--ab-*` custom properties, dual `[data-theme]` scopes, layout primitives (`.ab-container`, `.ab-grid`), and a typed `TOKENS` catalogue. The primitives in [libs/ui/src/components/](libs/ui/src/components/) are almost all token-compliant. **But the study app leaks hardcoded values at the page/route level at scale** — 30+ hex colors, 340+ raw spacing literals, 34 hardcoded radii, and 20+ custom `.btn`/`<input>` implementations that sidestep the `@ab/ui` primitives. The net effect: swapping to a new theme (e.g. a real dark mode, or a denser variant) will only re-skin chrome-level surfaces and primitives — every page body will stay stuck in the baked-in web palette and spacing.

Two structural gaps compound it: (1) the token system has no dark theme at all — `web` and `tui` share ~95% of the color palette and differ only in typography and density, so "fully themable" currently means "two density variants of the same light theme"; (2) primitive coverage is missing `Dialog`, `Table`, `Toast`, `Tooltip`, `Label`, `Checkbox`, `Radio`, `Tabs`, `Spinner`, `Divider`, forcing pages to roll their own and re-introduce hardcoded values.

## Issues

### CRITICAL: No dark theme exists — "web" and "tui" share ~95% of the palette

- **File**: [libs/themes/tokens.css:44-202](libs/themes/tokens.css#L44-L202) vs [libs/themes/tokens.css:207-365](libs/themes/tokens.css#L207-L365)
- **Problem**: The two `[data-theme]` blocks differ almost entirely in typography (mono vs sans), density (spacing/radius), and a slightly darker state palette. `--ab-color-fg`, `--ab-color-surface`, `--ab-color-border`, primary/muted/accent/info-subtle — identical between themes. There is no dark mode, no high-contrast mode, and no `prefers-color-scheme` hook. A user who expects "fully themable" gets a light-only app with two density presets.
- **Expected**: At minimum a `[data-theme='web-dark']` (or `[data-theme='tui-dark']`) block that re-maps the surface/fg/border/state families to a dark palette. The token vocabulary already supports it — the values are just missing.
- **Fix**: Add a `dark` variant block. Decide whether darkness is orthogonal to density (four themes: `web`/`web-dark`/`tui`/`tui-dark`) or modelled as a separate `data-appearance="dark"` attribute that composes with `data-theme`. I'd lean toward the latter so the two axes stay independent. Either way, wire it through [libs/themes/resolve.ts](libs/themes/resolve.ts) and expose a user preference (system / light / dark) from the identity menu in [apps/study/src/routes/(app)/+layout.svelte](apps/study/src/routes/(app)/+layout.svelte).

### CRITICAL: Hardcoded `white` + `#hex` color literals scattered across every route

- **File**: ~30 occurrences across [apps/study/src/routes/(app)/memory/+page.svelte:169](apps/study/src/routes/(app)/memory/+page.svelte#L169), [memory/+page.svelte:309](apps/study/src/routes/(app)/memory/+page.svelte#L309), [memory/new/+page.svelte:337](apps/study/src/routes/(app)/memory/new/+page.svelte#L337), [memory/browse/+page.svelte:580](apps/study/src/routes/(app)/memory/browse/+page.svelte#L580), [memory/review/+page.svelte:614](apps/study/src/routes/(app)/memory/review/+page.svelte#L614), [memory/[id]/+page.svelte:701](apps/study/src/routes/(app)/memory/[id]/+page.svelte#L701), [plans/+page.svelte:197,307](apps/study/src/routes/(app)/plans/+page.svelte#L197), [plans/new/+page.svelte:215,297](apps/study/src/routes/(app)/plans/new/+page.svelte#L215), sessions/[id], calibration, reps.
- **Problem**: Pages hardcode `background: white`, `color: white`, and at least one `color: #94a3b8`. When a dark theme arrives, every `.card-list { background: white; }` stays white against a dark body. This is the thing that breaks themability end-to-end.
- **Expected**: `background: var(--ab-color-surface)`, `color: var(--ab-color-primary-fg)` (for color-on-primary) or `var(--ab-color-fg-inverse)` (for color-on-dark-neutral), never a literal.
- **Fix**: Global find-replace pass: `background: white` → `var(--ab-color-surface)`; `color: white` on primary buttons → `var(--ab-color-primary-fg)`; `#94a3b8` → `var(--ab-color-fg-faint)`. But the real fix is the next finding — delete the custom `.btn` blocks entirely.

### CRITICAL: Pages reinvent `<button>`, `<input>`, `<textarea>`, `<select>` instead of using `@ab/ui`

- **File**: ~20 of 31 study page files. Sampled: [memory/+page.svelte:293-312](apps/study/src/routes/(app)/memory/+page.svelte#L293-L312) defines `.btn` / `.btn.primary` locally; memory/new, memory/browse, memory/review, plans/new, plans/[id], calibration, reps/new, reps/browse, knowledge, sessions/[id] do the same. Local `<textarea>`/`<input>`/`<select>` styling bypasses [libs/ui/src/components/TextField.svelte](libs/ui/src/components/TextField.svelte) and [libs/ui/src/components/Select.svelte](libs/ui/src/components/Select.svelte).
- **Problem**: `Button`, `TextField`, `Select` *are* token-compliant. Every page that hand-rolls controls duplicates styling, re-introduces the `white`/hardcoded-radius violations above, and drifts from the primitive's variant/size/focus/disabled states. A theme change re-skins the primitives and silently leaves every page's buttons behind.
- **Expected**: Every interactive control on a page comes from `@ab/ui`. Local `.btn` blocks should not exist.
- **Fix**: Burn the custom `.btn` definitions and swap to `<Button variant="primary" size="md">`. Same for inputs/selects. This is the single highest-leverage change — fixing it erases ~60% of the token violations in the study app as a side effect.

### MAJOR: Pages bypass `.ab-container` / `.ab-grid` with ad-hoc grids and paddings

- **File**: [memory/new/+page.svelte:187,214,305](apps/study/src/routes/(app)/memory/new/+page.svelte#L305), [memory/review/+page.svelte:529,685](apps/study/src/routes/(app)/memory/review/+page.svelte#L529), [plans/new/+page.svelte:235](apps/study/src/routes/(app)/plans/new/+page.svelte#L235), [knowledge/+page.svelte:296](apps/study/src/routes/(app)/knowledge/+page.svelte#L296), [memory/+page.svelte:160-164](apps/study/src/routes/(app)/memory/+page.svelte#L160-L164) (`grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`).
- **Problem**: The whole point of `--ab-layout-grid-gap`, `--ab-layout-container-max`, and `.ab-grid` is that switching themes reflows the page. Pages that define their own grid columns and `gap: 0.75rem` literals ignore that.
- **Expected**: Page bodies use `<div class="ab-container">` and `<div class="ab-grid">` with `.ab-col-*` utilities; custom grids are allowed only when semantically warranted (e.g. confidence distribution histogram) and still use `var(--ab-layout-grid-gap)` / `var(--ab-space-*)`.
- **Fix**: Migrate page-level layouts to the utility classes. Reserve custom grids for data visualizations, not for listing states/domains/cards.

### MAJOR: 21 hardcoded transition durations defeat `--ab-transition-*`

- **File**: ~21 occurrences, e.g. [memory/+page.svelte:304](apps/study/src/routes/(app)/memory/+page.svelte#L304) (`transition: background 120ms, border-color 120ms`), plans, calibration, knowledge, reps.
- **Problem**: The TUI theme redefines `--ab-transition-fast` to 80ms for its snappier feel. Pages that hardcode `120ms` stay at web timing even under TUI. Also bypasses the `prefers-reduced-motion: reduce` override at [tokens.css:367-374](libs/themes/tokens.css#L367-L374) — these transitions will keep running for users who opted out.
- **Expected**: `transition: background var(--ab-transition-fast), border-color var(--ab-transition-fast)`.
- **Fix**: Global replace `120ms` → `var(--ab-transition-fast)`, `200ms ease-out` → `var(--ab-transition-normal)`. This one also closes an accessibility defect.

### MAJOR: 34 hardcoded `border-radius` values lock pages to web's rounded look

- **File**: Sampled — [memory/+page.svelte:171,203,266](apps/study/src/routes/(app)/memory/+page.svelte#L171) (`12px`, `8px`, `999px`), [memory/review/+page.svelte:386,410,443,475,486,536](apps/study/src/routes/(app)/memory/review/+page.svelte#L386) (`10px`, `6px`, `4px`, `999px`, `16px`), [sessions/[id]/+page.svelte:352,367,375,397,436](apps/study/src/routes/(app)/sessions/[id]/+page.svelte#L352), [dashboard/_panels/MapPanel.svelte:145](apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte#L145) (`2px`).
- **Problem**: TUI sets every radius token (`sm`, `md`, `lg`) to `2px` so the whole surface reads as sharp. Pages with literal `12px`/`8px` stay rounded even inside the TUI dashboard (none today, but the memory/review pill patterns are candidates for TUI panels later). More immediately, introducing a third theme with different radii won't reach these pages.
- **Expected**: `border-radius: var(--ab-radius-lg)` / `var(--ab-radius-md)` / `var(--ab-radius-pill)`.
- **Fix**: Table-driven replace: `12px` → `var(--ab-radius-lg)`, `8px` → `var(--ab-radius-md)`, `6px` → `var(--ab-radius-sm)`, `999px` → `var(--ab-radius-pill)`. Inspect `4px`, `10px`, `16px` case-by-case — these need to round to the nearest token and often indicate the page is inventing a primitive.

### MAJOR: ~340 raw spacing literals (`rem` / `px`) at the page level

- **File**: Across every route's `<style>` block. Examples: [memory/new/+page.svelte:187](apps/study/src/routes/(app)/memory/new/+page.svelte#L187) (`gap: 1.25rem`), [memory/+page.svelte:162-163](apps/study/src/routes/(app)/memory/+page.svelte#L162) (`minmax(180px, 1fr)`, `gap: 0.75rem`), [dashboard/+page.svelte:69](apps/study/src/routes/(app)/dashboard/+page.svelte#L69) (`gap: 0.5rem`), [memory/+page.svelte:175,193](apps/study/src/routes/(app)/memory/+page.svelte#L175) (`gap: 0.875rem`, `0.5rem`).
- **Problem**: A density switch (web → tui, or future `cozy`/`compact` variants) re-maps `--ab-space-*` but doesn't touch raw literals. The grid-gap between cards stays `0.75rem` even when `--ab-layout-grid-gap` flips to `0.5rem`.
- **Expected**: Gaps at the layout level use `var(--ab-layout-grid-gap)` or `var(--ab-layout-panel-gap)`; gaps inside components use `var(--ab-space-*)`; paddings use `var(--ab-space-*)` or `var(--ab-layout-panel-padding)`.
- **Fix**: Systematic pass. The mapping is mostly mechanical (`0.25rem`→`2xs`, `0.375rem`→`xs`, `0.5rem`→`sm`, `0.75rem`→`md`, `1rem`→`lg`, `1.5rem`→`xl`, `2rem`→`2xl`). Values that don't round cleanly (`0.875rem`, `1.25rem`) usually signal the page should be using a primitive — prefer composing primitives over inventing intermediate spacings.

### MAJOR: Missing primitives force pages to reinvent patterns

- **File**: [libs/ui/src/components/](libs/ui/src/components/)
- **Problem**: The library has 12 components (Banner, Badge, Button, Card, ConfidenceSlider, ConfirmAction, KbdHint, PanelShell, Select, StatTile, TextField). Missing for current needs: **Dialog/Modal**, **Table**, **Toast** (notification queue distinct from Banner), **Tooltip**, **Tabs**, **Label**, **FormField**, **Checkbox**, **Radio**, **Spinner**, **Divider**, **Breadcrumb**. The study app clearly needs Dialog, Table, and FormField today (memory browse, calibration domain breakdowns, knowledge relevance tables, every form).
- **Expected**: Every cross-cutting UI pattern exists once as a token-consuming primitive; pages compose them.
- **Fix**: Prioritize **Dialog**, **Table**, **FormField** (label + input + error + help-text), **Checkbox**, **Radio** first — those are blocking the form pages. Defer **Toast**, **Tooltip**, **Tabs**, **Spinner**, **Divider**, **Breadcrumb** until a page actually needs them, but capture them as tasks now. See the ui-lib companion review for missing variants on existing primitives.

### MAJOR: `StatTile` variants drift from `Badge` tones — semantic inconsistency

- **File**: [libs/ui/src/components/StatTile.svelte](libs/ui/src/components/StatTile.svelte) vs [libs/ui/src/components/Badge.svelte](libs/ui/src/components/Badge.svelte)
- **Problem**: Badge supports `default|info|success|warning|danger|muted` but StatTile supports `neutral|primary|success|warning|danger` (missing `info`, `muted`, `accent`; uses `neutral` where Badge uses `default`/`muted`). Pages have to mentally translate between tone vocabularies for two primitives that encode the same concept.
- **Expected**: A single shared tone enum — `default`|`primary`|`success`|`warning`|`danger`|`info`|`muted`|`accent` — used by every tone-bearing primitive.
- **Fix**: Extract tone into `libs/types` (or `libs/themes`) as `TONES` and have Badge, StatTile, Banner, and any future Alert/Toast read from it. Map the two surface variants (Badge's subtle fill, StatTile's framed tile) to the same tone values.

### MAJOR: Dashboard nav is inside the ThemeProvider but uses `web` tokens regardless

- **File**: [apps/study/src/routes/(app)/+layout.svelte:71-109](apps/study/src/routes/(app)/+layout.svelte#L71)
- **Problem**: The nav sits inside `<ThemeProvider {theme}>` so when the user is on `/dashboard` (tui), the nav inherits tui tokens — meaning the nav switches to monospace + tighter spacing on dashboard pages only. That's a surprising cross-page inconsistency. Either the nav is intentionally theme-bound (so it reshapes with the page body) or it's global chrome (so it stays stable). Right now it's unintentionally the former.
- **Expected**: Pick a stance and commit. A consistent global nav reads as "app chrome"; a theme-shifting nav reads as "this whole surface switched modes" — both are valid, but silently flipping the nav's typography on one route is neither.
- **Fix**: Decide. If chrome-stable: move `<ThemeProvider {theme}>` inside `<main>` so it only wraps the page body. If intentionally page-linked: add a note in the layout explaining the behavior. Recommend chrome-stable — the nav is an anchor the user relies on for orientation.

### MINOR: Global focus ring bypasses the token

- **File**: [apps/study/src/app.html:38-41](apps/study/src/app.html#L38-L41)
- **Problem**: `:focus-visible { outline: 2px solid var(--ab-color-primary); }` uses `--ab-color-primary` directly instead of `--ab-color-focus-ring` (which exists specifically for this: [tokens.css:120](libs/themes/tokens.css#L120)). The tokenized focus ring includes alpha; the current rule is a solid 2px primary line.
- **Fix**: `outline: 2px solid var(--ab-color-focus-ring-strong);` or use `box-shadow: var(--ab-shadow-focus-ring);` to match the shape other primitives use.

### MINOR: Primitive micro-violations (sizing hardcodes)

- **File**: [libs/ui/src/components/Badge.svelte:49,55](libs/ui/src/components/Badge.svelte#L49), [ConfidenceSlider.svelte:80,133](libs/ui/src/components/ConfidenceSlider.svelte#L80), [KbdHint.svelte:39-40](libs/ui/src/components/KbdHint.svelte#L39-L40)
- **Problem**: `min-height: 1rem`/`1.25rem`, `min-width: 5rem`, `text-underline-offset: 2px`, `min-width: 1.25rem` are hardcoded inside otherwise-token-compliant primitives.
- **Fix**: Introduce a `--ab-control-height-{sm,md,lg}` token scale for consistent control sizing across Button/Select/TextField/Badge, and use it here. `text-underline-offset` can use a new `--ab-text-underline-offset` token or fall back to `var(--ab-space-2xs)`.

### MINOR: Missing size variants on primitives

- **File**: [TextField.svelte](libs/ui/src/components/TextField.svelte), [Select.svelte](libs/ui/src/components/Select.svelte), [Badge.svelte](libs/ui/src/components/Badge.svelte)
- **Problem**: `TextField` and `Select` ship only `md`; `Badge` ships `sm|md` but no `lg`. Compact forms (calibration domain picker, filter bars) reach for smaller controls and hit the wall, which is one of the reasons pages re-invent inputs.
- **Fix**: Add `sm|md|lg` to TextField and Select. Add `lg` to Badge. The control-padding tokens already exist for all three sizes.

### MINOR: `libs/ui/src/index.ts` is empty — no barrel, no type surface

- **File**: [libs/ui/src/index.ts](libs/ui/src/index.ts)
- **Problem**: Exports `{}`. Every import uses deep paths (`@ab/ui/components/Banner.svelte`). The comment argues this avoids pulling the Svelte runtime into non-UI consumers, which is reasonable — but it means there's no single place to discover what exists, no type-only re-exports of prop shapes (e.g. `BadgeTone`, `ButtonVariant`), and IDE "go to symbol" on the lib gives nothing.
- **Fix**: Keep the component-file imports, but export component prop types and shared enums (tones, variants, sizes) through the barrel. A page can `import type { BadgeTone } from '@ab/ui'` without dragging Svelte along.

### MINOR: No documented pattern for per-component theme overrides

- **File**: token system
- **Problem**: The token layer is global. There's no convention for "this card should always feel TUI even on a web page" without nesting a ThemeProvider (which is heavy and also brings typography changes). No mixins/recipes/subsurface overrides.
- **Fix**: Low priority until a real use-case appears. When it does, document a `data-surface="dense"` or similar attribute in tokens.css that re-maps only the subset of tokens you want to vary.

### NIT: Token catalogue missing `--ab-color-focus-ring-strong`, `--ab-shadow-focus-ring`, `--ab-shadow-success-glow`

- **File**: [libs/themes/tokens.ts:84](libs/themes/tokens.ts#L84)
- **Problem**: These three tokens exist in CSS ([tokens.css:120-123](libs/themes/tokens.css#L120-L123)) but aren't in the `TOKENS` object, so TypeScript consumers can't reference them by name.
- **Fix**: Add `colorFocusRingStrong`, `shadowFocusRing`, `shadowSuccessGlow` entries to `TOKENS`.

### NIT: `--ab-radius-xs` and `--ab-radius-pill` missing from `TOKENS`

- **File**: [libs/themes/tokens.ts:125-129](libs/themes/tokens.ts#L125-L129)
- **Problem**: CSS defines `--ab-radius-xs` (3px web / 2px tui) and `--ab-radius-pill` (999px) but only `sharp|sm|md|lg` are in the TOKENS export.
- **Fix**: Add `radiusXs` and `radiusPill`.

### NIT: Body default `font-family` doesn't flow into the TUI subtree cleanly

- **File**: [apps/study/src/app.html:26](apps/study/src/app.html#L26)
- **Problem**: `<body>` resolves `var(--ab-font-family-base)` from `:root`, which is the web sans stack. Inside `[data-theme='tui']` the token re-binds to mono — that works because it inherits through CSS custom properties. But the body itself paints before hydration in sans even on the dashboard page's first paint, causing a font flash when hydration resolves theme. Acceptable, but worth noting.
- **Fix**: If the flash is noticeable, add a `<script>` in `app.html` that reads the path and sets `data-theme` on `<html>` pre-hydration.

## Recommended sequencing

Close this review in four passes, smallest-first:

1. **Contract pass** (small, landed first): add missing entries to `TOKENS`, add shared `TONES` enum in `libs/themes`, add `sm|md|lg` size variants to `TextField`/`Select`, `lg` to `Badge`, align `StatTile` tones with the shared enum. Unblocks everything after.
2. **Primitive additions**: build `Dialog`, `Table`, `FormField`, `Checkbox`, `Radio` as token-compliant primitives. These are what the form-heavy pages are missing.
3. **Page migration, per-route**: for each study route, delete local `.btn`/`<input>` styling, swap to `@ab/ui` primitives, swap hardcoded colors/radii/transitions/spacings for tokens, swap custom grids for `.ab-container` + `.ab-grid`. Do this one folder at a time (memory/, plans/, reps/, calibration/, knowledge/, sessions/, dashboard/) so each PR is reviewable. The `Button`+`TextField` swap alone erases most of the hardcoded colors.
4. **Dark theme**: add `data-appearance="dark"` composable with `data-theme`, expose a user preference from the nav identity menu. Only attempt after the page migration — otherwise the dark theme will bounce off the 340 hardcoded values and look broken.

Per the project rule in [CLAUDE.md](CLAUDE.md), there should be no "considerations for future work" left hanging — each of the four passes above wants to be either a work package or dropped now. Recommend all four as work packages, authored with `/ball-wp-spec` starting from pass 1.
