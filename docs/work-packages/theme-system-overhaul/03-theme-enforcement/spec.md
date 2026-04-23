---
title: 'Spec: Theme Enforcement'
feature: theme-enforcement
type: spec
status: unread
review_status: pending
---

# Spec: Theme Enforcement

Ship the lint rule, codemod, contrast tests, palette-parse tests, FOUC Playwright test, and CI gates per [03-ENFORCEMENT.md](../../../platform/theme-system/03-ENFORCEMENT.md).

This package is what prevents every prior iteration's failure mode (adoption-by-hope).

## Components

### 1. Lint rule

- Location: `tools/theme-lint/`.
- Runs over `.svelte` and `.css` files in `apps/**` and `libs/ui/**`. Excludes `libs/themes/**`.
- Blocks:
  - Hex colors, `rgb(`, `rgba(` (except `transparent`, `currentColor`).
  - Named CSS colors on blocked properties.
  - Raw `rem`/`px`/`em` on font-size, font-family, padding, margin, gap, border-radius, box-shadow, transition (with `1px` border + `0` exceptions).
  - Hardcoded `ms`/`s` transition durations.
  - `font-family` with actual names (must be `var(--type-*-family)` or `var(--font-family-*)`).
  - References to unknown CSS custom property names (cross-referenced against `TOKENS` from `vocab.ts`).
- Exceptions: `/* lint-disable-token-enforcement: <reason> */` suppresses the next line.
- Ignore file: `tools/theme-lint/ignore.txt` lists known pre-migration violations so adoption can happen incrementally.

### 2. Codemod

- Location: `tools/theme-codemod/`.
- Mechanical rewrites (`#fff` → `var(--surface-page)`, `120ms` → `var(--motion-fast)`, etc.).
- Context-dependent cases flagged with a TODO comment, not auto-fixed.
- Takes a glob; writes changes in place; prints a summary.

### 3. Contrast tests

- `libs/themes/__tests__/contrast.test.ts` per [03-ENFORCEMENT.md §3](../../../platform/theme-system/03-ENFORCEMENT.md#3-contrast-tests).
- ~25 required role-pairs covering body text, button labels, signal washes, borders.
- WCAG AA: 4.5:1 for body; 3:1 for large text and non-text elements.
- Runs per (theme × appearance).

### 4. Palette parse test

- `libs/themes/__tests__/palette-parse.test.ts`.
- Every color in every theme parses as valid OKLCH.
- Catches typos (`oklcch(...)`) and out-of-range values.

### 5. FOUC Playwright test

- `apps/study/tests/e2e/theme-fouc.spec.ts`.
- Pre-sets appearance cookie; asserts `<html>` has `data-appearance="dark"` before hydration.

### 6. CI gates

- `bun run lint:theme` — lint rule.
- `bun run test:unit libs/themes` — unit tests.
- `bun run test:e2e theme` — Playwright suite.
- All three gate PRs.

## Adoption strategy

- Lint rule lands with an ignore file listing every current violation.
- Codemod runs folder-by-folder in #7; each folder's entries drop from the ignore file.
- Ignore file deleted when empty.

## Acceptance

- `bun run lint:theme` executes cleanly on a post-#3 tree (uses ignore file).
- `bun run lint:theme` fails on a PR that adds a new `#hex` color to a study page.
- Contrast tests pass on current palettes (even with stub dark).
- FOUC test passes.
- CI config runs all three gates on PRs.
