---
title: 'Theme System Overhaul'
status: unread
review_status: pending
---

# Theme System Overhaul

Seven work packages. Per-app themes under `libs/themes/{app}/{theme}/`, light+dark appearance pair mandatory, layout templates as a separate axis, full enforcement (lint + codemod + contrast tests), dark mode for real.

Derived from seven prior theme-system iterations. See [docs/platform/theme-system/](../../platform/theme-system/00-INDEX.md) for the knowledge base.

## Names

- **`sectional`** — study's reading surface. Replaces today's `web`.
- **`flightdeck`** — study's dashboard surface. Replaces today's `tui`.
- **`airboss/default`** — shared base both themes inherit from.
- **`sim/glass`** — reserved for when sim theme work lands (package #7).

## The packages

| #  | Package                                                                                                                                            | Status              | Depends on                        |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| 1  | [theme-foundation](01-theme-foundation/) — contract + vocabulary + directory restructure + emission + registry + pre-hydration + primitive rename  | shipped (#78, #79)  | —                                 |
| 2  | [theme-typography-packs](02-theme-typography-packs/) — semantic bundles replace atomic font tokens                                                 | shipped (#80)       | #1                                |
| 3  | [theme-enforcement](03-theme-enforcement/) — lint rule, codemod, contrast tests, CI gates                                                          | shipped (#82)       | #1, #2                            |
| 4  | [ui-primitives](04-ui-primitives/) — contract fixes + new primitives (Dialog, FormField, Checkbox, Radio, Table, Spinner, Divider, Tabs)           | shipped (#81)       | #1 (can run parallel with #2, #3) |
| 5  | [study-page-migration](05-study-page-migration/) — seven per-folder sub-PRs, swap to primitives, replace every hardcoded value                     | shipped (#83)       | #3, #4                            |
| 6  | [appearance-dark-mode](06-appearance-dark-mode/) — real dark palettes + toggle + cookie                                                            | shipped (#85)       | #5                                |
| 7  | [sim-theme-glass](07-sim-theme-glass/) — sim app theme + migration                                                                                 | shipped (#84)       | —                                 |
| 8  | [oklch-palette-migration](08-oklch-palette-migration/) — convert palettes from hex to OKLCH; extend contrast matrix to measure them                | shipped (#114)      | #6                                |
| 9  | [theme-picker](09-theme-picker/) — user-selectable theme picker (study only)                                                                       | shipped (#183)      | #6                                |
| 10 | [theme-picker-shared-lib](10-theme-picker-shared-lib/) — extract picker into `@ab/themes/picker/*`, wire study, sim, and hangar                    | shipped (#190)      | #9                                |

## Sequencing

- **Serial foundation**: #1 → #2 → #3.
- **Parallel after #1**: #4 (primitives) runs alongside #2 and #3.
- **Gate**: #5 needs both #3 (lint rule to gate pages) and #4 (primitives to migrate to).
- **Gate**: #6 needs #5 (dark mode bounces off hardcoded values).
- **Deferred**: #7.

## What closes the UX review

| Finding                                         | Closed by         |
| ----------------------------------------------- | ----------------- |
| No dark theme                                   | #6                |
| Hardcoded colors at page level                  | #5                |
| Pages reinvent controls                         | #4, #5            |
| Pages bypass `.ab-container`/`.ab-grid`         | #5                |
| Hardcoded transitions / radii / spacing         | #5 (enforced by #3) |
| Missing primitives                              | #4                |
| StatTile/Badge tone drift                       | #4                |
| Nav themes with page                            | #1                |
| Global focus ring bypasses token                | #1                |
| Primitive micro-hardcodes + size variants       | #4                |
| Empty `libs/ui` barrel                          | #4                |
| Missing entries in `TOKENS.ts`                  | #1                |
| Body font flash on first paint                  | #1                |

## Acceptance

The overhaul is complete when:

- Swapping `data-theme` on `<html>` re-skins every page, not just chrome.
- Swapping `data-appearance` switches light/dark without FOUC.
- Adding a new theme is a single-directory operation.
- CI fails on any hardcoded color/spacing/transition/radius in app code.
- CI fails on any theme that violates WCAG AA contrast.
- `rg "--ab-" apps/ libs/ui/` returns zero results.
