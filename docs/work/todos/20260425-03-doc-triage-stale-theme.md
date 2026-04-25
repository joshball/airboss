# 2026-04-25 Doc triage: stale theme refs

Triage stale theme references in product feature docs. Pre-overhaul docs reference the abandoned token system (`--t-*` prefix, `data-theme-id`, glass-cockpit / aviation theme split, families like `workbench` / `focus` / `brand`). Some target an app (`ops`) that no longer exists post-pivot.

Source of truth: `docs/platform/theme-system/QUICK_REFERENCE.md`. Model: PR #193 archive notices.

## Pre-flight verification

- [x] Confirmed no live code references `theme-editor` / `themeEditor` / `ThemeEditor` in `apps/hangar/src/`.
- [x] Confirmed no `apps/ops/` exists; no `/ops` routes; no ops imports.
- [x] Confirmed `data-app-id` is still live in all three app.html files; preserve refs to it.

## Archive: whole `docs/products/ops/` tree

- [ ] `git mv docs/products/ops -> docs/.archive/products/ops`
- [ ] Add `docs/.archive/products/ops/ARCHIVED.md` (top-level explainer)
- [ ] Add per-file "# Archived: ..." top-of-file notice (matching PR #193 spec.md style)

## Archive: `docs/products/hangar/features/theme-editor/`

- [ ] `git mv docs/products/hangar/features/theme-editor -> docs/.archive/products/hangar/features/theme-editor`
- [ ] Add `ARCHIVED.md`
- [ ] Add per-file "# Archived: ..." notice

## Token sweep (live docs)

- [ ] `docs/products/hangar/TASKS.md`
- [ ] `docs/products/hangar/features/task-board/review.md`
- [ ] `docs/products/sim/features/sim-shell/design.md`
- [ ] `docs/products/sim/features/sim-shell/review.md`

## Verification

- [ ] `rg "\-\-t-[a-z]|data-theme-id|workbench|glass-cockpit|aviation theme" docs/products/` returns empty
- [ ] `git log --follow` proves history follows archived files
- [ ] PR opened
