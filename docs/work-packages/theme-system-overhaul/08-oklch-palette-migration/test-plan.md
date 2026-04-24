---
title: 'Test plan: OKLCH Palette Migration'
feature: oklch-palette-migration
type: test-plan
status: unread
review_status: pending
---

# Test plan: OKLCH Palette Migration

## Automated

- [ ] `libs/themes/__tests__/contrast.test.ts`: OKLCH round-trip to hex within 0.5% per channel on a battery of known pairs from the CSS Color 4 spec.
- [ ] `libs/themes/__tests__/contrast-matrix.test.ts`: no skips; every (theme, appearance) passes AA on the 11 required role-pairs. AAA remains advisory.
- [ ] `libs/themes/__tests__/palette-parse.test.ts`: every palette file parses as OKLCH; hex-external inputs still parse.
- [ ] `libs/themes/__tests__/derive.test.ts`: existing tests keep passing (derivation inputs are OKLCH now, outputs already were).
- [ ] `libs/themes/__tests__/emit.test.ts`: byte-deterministic emit, two consecutive runs identical.
- [ ] `bun run check` clean.
- [ ] `bun run lint:theme` clean -- `lint:theme` already accepts OKLCH values in `<style>` blocks since `tools/theme-lint/rules.ts` flags raw `oklch(...)` literals only at call sites, not in token emission. Confirm no regression.

## Manual

- [ ] Dashboard on light + dark: panels render with correct colors, focus ring visible, action buttons the right brand tone.
- [ ] Memory / plans / knowledge / glossary / calibration routes on both appearances: no visible color drift, no washed-out edges, signal badges readable.
- [ ] Sim at `/sim`: instrument panels, horizon, status lanes render correctly.
- [ ] Appearance toggle still works end-to-end: system / light / dark from the identity menu, cookie persists across refresh.
- [ ] System appearance change while on `system`: UI live-updates via matchMedia listener.
- [ ] Pre-hydration: hard refresh on each of the above with `appearance=dark` cookie set; confirm no light flash.

## Regression guard

The hex-to-OKLCH conversion is perceptually identical by construction. Any visible drift means a converter bug, not a design drift. If something looks wrong:

1. Check the hex <-> OKLCH conversion in the commit body against an external reference (e.g. <https://oklch.com>).
2. If the conversion was correct, the prior hex was likely already slightly off-gamut and the OKLCH rendering is more accurate. Decide: keep OKLCH (usually correct) or pin an `overrides.*` hex (when the visual hold is load-bearing).

## Performance

- [ ] `bun run themes:emit` runtime does not regress more than 20%. OKLCH parsing is cheap but adds work.
- [ ] Generated CSS size does not regress more than 10% (OKLCH strings are longer than hex).

## Browser support

- OKLCH is Baseline 2023 in CSS. Every target browser supports it. No fallback needed. Document this in 03-ENFORCEMENT.md if not already stated.
