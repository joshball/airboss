---
title: 'Spec: Study Page Migration'
feature: study-page-migration
type: spec
status: unread
review_status: pending
---

# Spec: Study Page Migration

Sweep every route in `apps/study/src/routes/(app)/` and `apps/study/src/routes/login/` to:

1. Delete local `.btn` / `<input>` / `<textarea>` / `<select>` styling.
2. Swap to `@ab/ui` primitives (Button, TextField, Select, FormField, Dialog, Table, Checkbox, Radio, Tabs, Badge, StatTile, Card, PanelShell, Banner, ConfidenceSlider, KbdHint).
3. Replace every hardcoded hex/`rem`/`px`/`ms` with the corresponding token.
4. Replace custom grids with `.ab-container` + `.ab-grid` (or a theme layout template where appropriate).
5. Remove hardcoded `font-family` values that should be bundle variables.

This closes the bulk of the UX review's major findings.

**Inherited from package #1:** The app-wide `--ab-*` → role-token sweep is this package's responsibility. Package #1 migrated the 12 `libs/ui/` primitives and left `generated/tokens.css` exposing `--ab-*` names as compatibility aliases so unmigrated study routes kept rendering. Those aliases must be removed as part of this package's acceptance: final grep for `--ab-` across `apps/study/src/**` returns zero, and the alias block in the emit pipeline is deleted.

## Sub-PRs

Split by folder for reviewability. Each sub-PR is a self-contained migration.

| # | Folder                                          | Files (approx) | Expected violations cleared |
| - | ----------------------------------------------- | -------------- | --------------------------- |
| 7.1 | `memory/`                                       | 7              | ~80                         |
| 7.2 | `plans/`                                        | 3              | ~35                         |
| 7.3 | `reps/`                                         | 3              | ~40                         |
| 7.4 | `calibration/`                                  | 1              | ~50                         |
| 7.5 | `knowledge/` + `glossary/`                      | 4              | ~45                         |
| 7.6 | `sessions/` + `session/`                        | 3              | ~40                         |
| 7.7 | `dashboard/` + `dashboard/_panels/`             | 10             | ~60                         |

Plus:

- `login/` + app-root `+layout.svelte` touched in #2.
- `help/` is mostly help-lib driven; audit quickly.

## Approach per folder

For each folder:

1. Run the codemod from #4 in dry-run mode → review diff.
2. Apply codemod; review flagged TODOs; resolve context-dependent cases by hand.
3. Swap `.btn` blocks for `<Button>`; swap `<input>`/`<textarea>` for `<TextField>`; swap `<select>` for `<Select>`. Use `<FormField>` to wrap label + control.
4. Re-scan the folder with the lint rule — ignore file entries for this folder must go to zero.
5. Visual regression pass: pixel-diff each route before/after. Expect visual changes (intended — now using real primitives) but no user-visible regressions in flow.
6. Drop the folder's entries from `tools/theme-lint/ignore.txt`.
7. Merge.

## Special cases

- **Dashboard panels** (`MapPanel.svelte` etc.): heavy bespoke rendering. Migrate color/radius/transition tokens but keep custom layout.
- **ConfidenceSlider** inside reviews: already a primitive; just ensure page-side styling is gone.
- **Custom grids**: evaluate each. If it's a "list of cards, auto-fit", use `.ab-grid`. If it's a bespoke visualization (confidence histogram, calibration chart), keep the custom CSS but tokenize values.
- **Form state styling**: use new `FormField` for error + help; stop rolling local error colors.

## Acceptance

- `tools/theme-lint/ignore.txt` is empty.
- `bun run lint:theme` passes with 0 violations across `apps/study`.
- `bun run check` clean.
- Every route still works (manual test pass of core flows per `test-plan.md`).
- No route regresses in accessibility (axe scan clean).
- Visual check: no layout breakage. Styling differences allowed (e.g. button shape changes because now using `<Button>`) as long as the flow is the same.
