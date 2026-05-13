---
title: 'Test Plan: Theme Enforcement'
feature: theme-enforcement
type: test-plan
---

# Test Plan

## Lint rule self-tests

- Fixture: page with `background: #fff` → rule flags it.
- Fixture: page with `background: white` → rule flags it.
- Fixture: page with `background: var(--surface-page)` → rule passes.
- Fixture: page with `padding: 1rem` → flagged.
- Fixture: page with `padding: var(--space-lg)` → passes.
- Fixture: `var(--ink-wrongname)` → flagged with suggestion.
- Fixture: `var(--ink-body)` → passes.
- Fixture: line with `/* lint-disable-token-enforcement: debug border */` + next-line violation → passes.
- Ignore-file entry covers a known violation → passes.

## Codemod self-tests

- Fixture: `color: white` on button `color` → rewritten to `color: var(--ink-inverse)` (or flagged if ambiguous).
- Fixture: `border-radius: 8px` → rewritten to `border-radius: var(--radius-md)`.
- Fixture: `transition: color 120ms` → rewritten to `transition: color var(--motion-fast)`.
- Dry-run flag: produces a diff without writing.

## Contrast tests

- With current (light-only) palettes, all pairs pass WCAG AA.
- Intentional regression: tweak a palette to fail → test fails loudly.

## Palette parse

- Intentionally break a color (`oklcch(...)`) → test fails with the bad path.

## Playwright

- FOUC: cookie pre-set, page loads, attribute present before domcontentloaded.
- Appearance toggle: click dark toggle, reload, still dark.

## CI

- Open a PR that adds `background: #123456` to a study page. CI fails.
- Open a PR that adds the same with a lint-disable comment and a reason. CI passes.
