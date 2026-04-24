---
title: 'Tasks: OKLCH Palette Migration'
feature: oklch-palette-migration
type: tasks
status: unread
review_status: pending
---

# Tasks: OKLCH Palette Migration

## Order

1. Contrast matrix upgrade (enables the rest of the work to be verifiable).
2. Palette conversion, file-by-file.
3. Regenerate + verify.

Parallelization: none. The matrix upgrade has to land first so palette conversion has a safety net; palette conversion itself is quick enough not to bother splitting.

## Phase 1 -- OKLCH contrast in `libs/themes/contrast.ts`

- [ ] Add `parseOklch(s: string): { l: number; c: number; h: number; a: number }`. Accept `oklch(L C H)`, `oklch(L C H / A)`, `oklch(L% C H)` (percent L scales to 0-1).
- [ ] Add `oklchToLinearRgb(oklch): { r: number; g: number; b: number }`. Implement CSS Color 4 OKLab -> linear sRGB matrices. Use existing derive.ts utilities if they already do the conversion (they likely do for `adjustBrightness`).
- [ ] Add `luminanceOklch(oklch)` and route `contrastRatio(a, b)` through a shape-dispatch: hex -> luminanceHex, oklch -> luminanceOklch, rgba/rgb strings likewise.
- [ ] Unit-test the converter: known hex <-> OKLCH round-trips (from the CSS Color 4 examples) within a 0.5% tolerance per channel.
- [ ] Commit: `feat(themes): oklch-aware contrastRatio`.

## Phase 2 -- contrast-matrix test opens up

- [ ] Remove the OKLCH skip in `libs/themes/__tests__/contrast-matrix.test.ts`.
- [ ] Confirm every current palette still passes AA. It should, because the hex values were picked for contrast; OKLCH round-trip is perceptually identical. If anything fails, investigate before continuing.
- [ ] Commit: `test(themes): contrast matrix measures every theme x appearance without oklch skip`.

## Phase 3 -- palette conversion

Do one file at a time, committing between each so the diff is reviewable.

- [ ] `libs/themes/core/defaults/airboss-default/palette.light.ts`.
- [ ] `libs/themes/core/defaults/airboss-default/palette.dark.ts` (including the `overrides` block's hex pins).
- [ ] `libs/themes/study/sectional/palette.light.ts` if it overrides.
- [ ] `libs/themes/study/sectional/palette.dark.ts` if it overrides.
- [ ] `libs/themes/study/flightdeck/palette.light.ts` if it overrides.
- [ ] `libs/themes/study/flightdeck/palette.dark.ts` if it overrides.
- [ ] `libs/themes/sim/glass/palette.dark.ts`.
- [ ] For each file: hex values convert to OKLCH via a one-shot script (or an online converter cross-checked against our `parseOklch`). Log each pair in the commit body so reviewers can verify.
- [ ] After each file: `bun run themes:emit`, diff `generated/tokens.css`, confirm the perceptual delta is within rounding.
- [ ] Commit per palette or two-at-a-time depending on size: `refactor(themes): airboss/default light palette to oklch`.

## Phase 4 -- palette-parse test

- [ ] `palette-parse.test.ts` grows an OKLCH branch asserting every palette parses via `parseOklch`. Hex branch stays for external input boundary checks.
- [ ] Commit: `test(themes): assert every palette parses as oklch`.

## Phase 5 -- emit verification

- [ ] Run `bun run themes:emit` twice, confirm byte-identical SHA.
- [ ] Run `bun run check` clean.
- [ ] Run `bun run test` clean.
- [ ] Dev-server spot check: dashboard, memory, plans, knowledge, glossary, calibration, sim on both light and dark appearances. Log findings in PR.
- [ ] PR title: `refactor(themes): migrate palettes to oklch + contrast matrix measures them`.

## Rollback

Each phase is a separate commit. If phase N breaks something, `git revert` that commit and investigate; prior phases stay shipped.
