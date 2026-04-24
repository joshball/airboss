# Enforcement playbook

The tools below are not optional. They ship with the architecture, not after. Every prior iteration tried to adopt a theme system by documentation; none stuck. Option A (PRs #78 - #85) landed the lint, codemod, and test surface in the same wave as the role-token vocabulary, and the system has held since.

If you can't write the lint rule, you haven't defined the vocabulary yet.

Read [02-ARCHITECTURE.md](02-ARCHITECTURE.md) for what the system looks like, [04-VOCABULARY.md](04-VOCABULARY.md) for the token catalog, and [05-OVERHAUL-2026-04.md](05-OVERHAUL-2026-04.md) for how the migration landed.

## What enforcement covers

| Concern                                         | Tool                                                                           | When                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| Hardcoded color literals in components          | `tools/theme-lint/` (standalone Bun scanner)                                   | `bun run check` + CI        |
| Hardcoded spacing/radius/font-size in `<style>` | `tools/theme-lint/` raw-length rule                                            | `bun run check` + CI        |
| Hardcoded transition/animation durations        | `tools/theme-lint/` raw-duration rule                                          | `bun run check` + CI        |
| Unknown `var(--*)` references                   | `tools/theme-lint/` unknown-token rule (reads `vocab.ts` + `emit.ts` prefixes) | `bun run check` + CI        |
| Contrast ratios meet WCAG AA                    | `libs/themes/__tests__/contrast-matrix.test.ts`                                | `bun run test` + CI         |
| Light/dark palettes parse                       | `libs/themes/__tests__/palette-parse.test.ts`                                  | `bun run test` + CI         |
| Emit pipeline is deterministic                  | `libs/themes/__tests__/emit.test.ts`                                           | `bun run test` + CI         |
| No duplicate theme IDs                          | `registerTheme` throws; registry test enforces                                 | App boot (dev) + test suite |
| `data-theme` + `data-appearance` before paint   | `tests/e2e/theme-fouc.spec.ts` (Playwright)                                    | `bun run test e2e` + CI     |
| Migration of existing literals                  | `tools/theme-codemod/`                                                         | One-off, per folder         |

## 1. Lint rule: `tools/theme-lint/`

A standalone Bun script. No Biome custom rule, no ESLint plugin. It tokenizes CSS declarations and runs a small set of pure rules against each declaration's value.

Entry point: `bun run lint:theme` (aliased from `bun tools/theme-lint/bin.ts`).

Scope:

- Scans `apps/**/*.svelte`, `apps/**/*.css`, `libs/ui/**/*.svelte`, `libs/ui/**/*.css`.
- Excludes `libs/themes/**` (tokens are defined there), `node_modules`, `.svelte-kit`, `dist`, `build`, test fixtures for the lint + codemod tools.

Rules (see `tools/theme-lint/rules.ts`):

| Rule ID               | What it catches                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `hex-color`           | `#rrggbb`, `#rgb`, `#rrggbbaa` on any property                                                                       |
| `rgb-color`           | `rgb(...)` / `rgba(...)` literals                                                                                    |
| `hsl-color`           | `hsl(...)` / `hsla(...)` literals                                                                                    |
| `oklch-literal`       | `oklch(...)` literals (palette OKLCH values belong in `libs/themes`)                                                 |
| `named-color`         | `white`, `black`, `red`, ... on color-carrying properties                                                            |
| `raw-length`          | `Nrem`, `Nem`, `Npx` on spacing / sizing / radius / font properties (`1px` allowed for hairlines, `0` always allowed) |
| `raw-duration`        | Hardcoded `Nms` / `Ns` in `transition-*` / `animation-*`                                                             |
| `font-family-literal` | `font-family` without `var(...)` or an inherit keyword                                                               |
| `unknown-token`       | `var(--foo)` where `--foo` is not in `vocab.ts` or an emitted prefix family                                          |

Known-token discovery:

- Every value of `TOKENS` from `libs/themes/vocab.ts`.
- An allowlist of emit-synthesized atomics (`--font-size-*`, `--font-weight-*`, `--line-height-*`, `--letter-spacing-*`, `--control-*`).
- Prefix families for bundle / control / sim tokens:
  - `--type-{reading|heading|ui|code|definition}-{variant}-{field}`
  - `--button-{variant}-*`, `--button-height-{sm|md|lg}`
  - `--input-{variant}-*`, `--input-height-{sm|md|lg}`
  - `--badge-height-{sm|md|lg}`
  - `--dialog-{scrim|bg|edge|radius|shadow}`
  - `--table-{header-bg|header-ink|row-edge|row-bg-hover|row-bg-selected}`
  - `--underline-offset-*`
  - `--sim-*` (populated by sim-surface themes only)

Exception mechanism:

```css
/* lint-disable-token-enforcement: <reason> */
animation: spin 800ms linear infinite;
```

The comment suppresses every violation on the next non-blank line. The reason is required - a bare `/* lint-disable-token-enforcement: */` is ignored. Reviewers must justify every exception.

Grandfather ignore file: `tools/theme-lint/ignore.txt`. Each non-blank, non-comment line is `<relative-path>:<line>:<rule>` and suppresses a single known violation. Entries drop as migrations land. The file shrank to zero during Option A and stays empty on main as of the `--motion-slow` / `--ink-inverse-subtle` clean-up; any new entry is a signal that a role token is missing, not that enforcement should be relaxed.

CLI usage:

```bash
bun run lint:theme                  # lint the whole repo
bun tools/theme-lint/bin.ts apps/study    # lint one subtree
bun tools/theme-lint/bin.ts --fix-ignore  # rewrite ignore.txt to current violations
bun tools/theme-lint/bin.ts --json        # machine-readable output
```

## 2. Codemod: `tools/theme-codemod/`

Companion tool to the lint rule. Lint tells you what's broken; codemod fixes the mechanical cases. Run once per folder during migration.

Entry point: `bun run codemod:theme`.

Passes (run in this order -- see `runAllTransforms` in `tools/theme-codemod/transforms.ts`):

| Pass                        | Input                                                  | Output                                                                                                      |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `rewriteLegacyAliases`      | `var(--ab-foo)` references                             | Historical; the `--ab-*` alias surface retired in #85 so this pass is a no-op today. Kept for archaeology   |
| `rewriteRadiusLiterals`     | `border-radius: Npx` / `border-top-left-radius: ...`   | `var(--radius-{rung})` (nearest rung)                                                                       |
| `rewriteMotionLiterals`     | `transition`, `transition-duration`, `animation-*`     | `var(--motion-fast)` / `--motion-normal)` / `--motion-slow)` (within 60ms of a known rung; else left as-is) |
| `rewriteFontFamilyLiterals` | `font-family: <known-stack>`                           | `var(--font-family-mono)` / `--font-family-sans)`                                                           |
| `annotateAmbiguousColors`   | `color`/`background`/`border`/`fill`/`stroke` literals | Inserts `/* TODO-theme: pick a role token for this literal. */` inline; never auto-rewrites                 |

Context-dependent cases (is this `#ffffff` a background or a text-on-dark color?) the codemod refuses to guess. It flags the line with a TODO and leaves the human to pick the right role token.

Implementation: TypeScript + regex over the source text. Ships in `tools/theme-codemod/`. Takes a glob, writes changes in place, leaves a diff for review. Tests in `tools/theme-codemod/__tests__/` cover every pass.

## 3. Contrast matrix

File: `libs/themes/__tests__/contrast-matrix.test.ts`.

Enforces WCAG AA (4.5:1 for body text, 3:1 for large text and non-text elements) on 11 required role-pairs per `(theme, appearance)`. Failures block the suite. The pairs cover the usual high-leverage combinations: body ink on page / panel surface, action-default ink on action-default fill, `signal-*` ink on `signal-*` wash, edge visibility on page, focus ring on page.

Since WP #8, `contrast.ts` computes luminance directly from OKLCH (OKLab intermediate, CSS Color 4 matrices) instead of requiring callers to pre-convert to hex. Every `(theme, appearance)` pair is measured -- there is no skip branch. An advisory list still logs below-bar ratios without failing. This catches "the pair is not in the required matrix but the contrast is poor anyway" without blocking, so regressions stay visible during theme tuning.

AAA is not enforced. Aviation UX prefers legibility but not at the cost of limiting the palette; pushing AAA across every role would force the palette into a narrow ink-on-white corner.

## 4. Palette parse

File: `libs/themes/__tests__/palette-parse.test.ts`.

Walks every theme's light and dark palettes and confirms every color string parses. OKLCH strings are easy to typo -- a single `/` where a space belongs and the value silently reverts to the browser default. A second describe block asserts that every palette entry parses as OKLCH (not just "a valid color"); since WP #8 landed the OKLCH migration, a palette commit that reintroduces hex fails immediately and points at the offending role path.

OKLCH is Baseline 2023 across every target browser, so the emit pipeline writes `oklch(...)` verbatim -- no hex fallback is generated.

## 5. Emit determinism

File: `libs/themes/__tests__/emit.test.ts`.

Asserts:

- Two successive `emitAllThemes()` calls produce identical strings. Catches non-deterministic ordering (Object.keys order shifts between bun versions, anything).
- Every `(theme, appearance)` pair emits its `[data-theme=...][data-appearance=...]` selector block.
- A `:root` fallback block exists (for pre-hydration body paint).
- Zero `--ab-*` aliases (Option A retired them; any reappearance is a regression).
- Every core role token (`--ink-body`, `--surface-page`, `--action-default-hover`, `--motion-normal`, `--radius-md`, ...) appears.
- Every action role emits its full state set (base / hover / active / wash / edge / ink / disabled).
- Every typography bundle emits every field.
- Every button / input variant emits every slot.

## 6. Vocabulary guard

`vocab.ts` is the master list of legal role-token names. The lint rule reads it at startup (`buildKnownTokens`). Any `var(--foo)` the vocab doesn't recognize fails the `unknown-token` rule with the offending name. Typos fail instantly and point at the source of truth.

## 7. FOUC test

File: `tests/e2e/theme-fouc.spec.ts` (Playwright).

Asserts that when `DOMContentLoaded` fires, `<html>` already has non-empty `data-theme` and `data-appearance` attributes, and that the appearance cookie (`appearance=dark` / `appearance=light`) is honored on first paint. Covers the study, flightdeck, and sim (forced-dark) routes. The pre-hydration script in `apps/study/src/app.html` runs before `domcontentloaded` and sets the attributes from the cookie + `prefers-color-scheme`; if it regresses, the test fails and we see FOUC again.

Run locally: `bun run test e2e tests/e2e/theme-fouc.spec.ts`. Full e2e pass: `bun run test e2e`. CI runs e2e as a gating check alongside unit tests. Browser install is one-time: `bun run test e2e:install`.

## 8. CI gates

Summary of what blocks a PR:

- `bun run check` -- runs svelte-check, Biome, the reference validator, the knowledge-graph dry-run, `theme-lint` (0 violations tolerated outside `ignore.txt`), and the help-id validator.
- `bun run test` -- Vitest unit suite (contrast, palette-parse, derive, emit, registry, resolve, typography-packs).
- `bun run test e2e` -- Playwright smoke + auth + theme-FOUC.
- TypeScript strict mode -- theme contract violations surface at compile time.

All of the above must pass. There is no "critical / major / minor" classification on theme violations -- the vocabulary is either followed or it isn't.

## Adoption strategy (history)

The adoption sequence that shipped:

1. #78 - #82: land the role-token vocabulary, emit pipeline, and compat-alias shim. Theme-lint lands with an ignore file the size of the pre-existing violation set.
2. #83 - #84: run the codemod folder-by-folder. Each PR is one surface or app. Ignore file shrinks every merge.
3. #85: delete the `--ab-*` compat shim and its allowlist. Every app now consumes role tokens directly. Ignore file collapses to a handful of primitive-level exceptions.
4. Post-overhaul clean-up (this doc's current wave): retire the last three ignore entries by promoting them to role tokens (`--motion-slow`, `--ink-inverse-subtle`). Ignore file empty.

The pattern is general: you can't land the lint rule without an ignore file (that's a big-bang migration nobody ships), but once it's landed, adoption stops being a milestone and becomes continuous enforcement.

## Why this beats documentation

Documentation is advice. A lint rule is a command. Developers read advice and defer; developers read red squigglies and fix. Of all the investments a theme system can make, the lint rule is the single biggest lever for making the vocabulary stick.
