---
title: 'Spec: OKLCH Palette Migration'
feature: oklch-palette-migration
type: spec
status: unread
review_status: pending
---

# Spec: OKLCH Palette Migration

Migrate every theme palette from hex to OKLCH as the source-of-truth representation, and extend the contrast matrix to measure OKLCH values (currently it skips them).

## Why now

PR #85 shipped real dark palettes in hex because `libs/themes/__tests__/contrast-matrix.test.ts` explicitly skips OKLCH values (no OKLCH -> sRGB converter in `libs/themes/contrast.ts`). Hex kept contrast enforcement live while the overhaul landed.

Hex is a local maximum. OKLCH is what `deriveInteractiveStates` already runs on for hover / active shifts; palettes authored in hex round-trip through OKLCH inside the pipeline. Authoring in OKLCH:

- Eliminates the silent hex -> OKLCH -> hex conversion that happens on every emit.
- Lets designers shift perceived lightness directly (`oklch(0.62 0.15 250)` -> `oklch(0.52 ...)` is 10% darker, predictably).
- Keeps the base + derivation pair expressed in one color space.

Leaving hex in place means the derivation math and the palette declarations live in different representations forever. That's the same drift 01-LESSONS.md warns about with hand-synced TypeScript and CSS lists.

## Scope

In:

- Every palette file under `libs/themes/core/defaults/**`, `libs/themes/study/**/palette.*.ts`, `libs/themes/sim/**/palette.*.ts`.
- `libs/themes/contrast.ts` -- add OKLCH -> sRGB luminance conversion so `contrastRatio` accepts either input.
- `libs/themes/__tests__/contrast-matrix.test.ts` -- remove the OKLCH skip; every (theme, appearance, role-pair) is measured.
- `libs/themes/__tests__/palette-parse.test.ts` -- keep the hex branch working for external inputs but assert our palettes parse as OKLCH.
- `libs/themes/core/defaults/airboss-default/palette.light.ts` and `palette.dark.ts` are the anchors. Every other theme's palette either extends or overrides these.

Out:

- New role tokens (that's separate packages).
- Visual redesign. This is representation migration only -- output CSS should be perceptually identical, and diff reviewers should be looking at hex equivalents for drift.
- Third-party color input (user profile custom accents, etc.). Those stay as hex at the API boundary and convert on write.

## Behavior

Every palette exports OKLCH strings. `deriveInteractiveStates` and `deriveSignalVariants` already produce OKLCH; they stop doing hex -> OKLCH -> hex and just propagate OKLCH. `emit.ts` writes the OKLCH string directly to `generated/tokens.css`. CSS consumers see `color: var(--action-default)` evaluate to `oklch(...)` -- no change to call sites.

`overrides.*` entries accept OKLCH too, so dark-palette hex pins (the hex values currently in `palette.dark.ts` `overrides` blocks) convert as part of this migration.

## Contrast matrix

`contrast.ts`:

- `parseOklch(s)` -> `{ l, c, h, a }` (with `a` defaulting to 1).
- `oklchToLinearRgb({ l, c, h })` using the CSS Color 4 spec matrices.
- `luminanceOklch(oklch)` via the converted linear RGB.
- `contrastRatio(a, b)` dispatches to `luminanceHex` or `luminanceOklch` based on input shape.

Matrix test:

- Remove the `skip` guard.
- Every (theme, appearance) is measured on the 11 required role-pairs.
- Failures are hard test failures. Don't soften the bar to let a color squeak through -- change the color.

## Acceptance

- Every palette file is OKLCH.
- `libs/themes/contrast.ts` measures OKLCH without converting through hex.
- `contrast-matrix.test.ts` covers every combination with no skips; all passes AA.
- `palette-parse.test.ts` asserts OKLCH parsability on every palette.
- `bun run themes:emit` deterministic. Emitted CSS round-trips to perceptually-identical hex (allow tiny rounding, document the threshold).
- `bun run check` clean.
- Visual spot-check on dev server: dashboard, memory, plans, knowledge, glossary, calibration, sim -- no visible color regressions on light or dark.

## Non-goals

- OKLCH P3 wide-gamut variants. Default sRGB only.
- Lab / Lch / HSL intermediate representations.
- Per-hue calibration (the derivation math already handles perceptual uniformity).

## References

- CSS Color 4: OKLCH: <https://www.w3.org/TR/css-color-4/#ok-lab>
- Björn Ottosson's OKLab paper: <https://bottosson.github.io/posts/oklab/>
- Existing derive.ts uses OKLCH internally; reuse its parser.
- PR #85 shipped hex dark palettes with this migration explicitly deferred.
