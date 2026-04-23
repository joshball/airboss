---
title: 'Tasks: Study Page Migration'
feature: study-page-migration
type: tasks
---

# Tasks

## Sub-PR 7.1: memory/

- [ ] Codemod dry-run on `memory/`.
- [ ] Apply codemod; resolve TODOs.
- [ ] `+page.svelte`: swap `.btn` for `<Button>`; custom grid → `.ab-grid`.
- [ ] `new/+page.svelte`: form controls to `<FormField>` + `<TextField>`/`<Select>`.
- [ ] `browse/+page.svelte`: filter UI to primitives.
- [ ] `review/+page.svelte`: confidence slider already primitive; kill remaining local styling.
- [ ] `[id]/+page.svelte`: swap action buttons.
- [ ] Drop memory entries from lint ignore.
- [ ] Manual flow test: add memory, browse, review, delete.
- [ ] Visual regression.
- [ ] `bun run check` + `bun run lint:theme`.

## Sub-PR 7.2: plans/

- [ ] Codemod + TODO resolution.
- [ ] `+page.svelte` + `new/` + `[id]/`.
- [ ] Grids → `.ab-grid`.
- [ ] Drop plans entries from ignore.
- [ ] Flow test: create plan, edit plan.

## Sub-PR 7.3: reps/

- [ ] Codemod.
- [ ] `+page.svelte`, `new/`, `browse/`.
- [ ] Custom cards → `<Card>`.
- [ ] Drop reps entries.
- [ ] Flow test: new rep, browse.

## Sub-PR 7.4: calibration/

- [ ] Large file; split changes for review.
- [ ] Charts keep custom layout; tokenize colors/radii.
- [ ] Tables → `<Table>`.
- [ ] Drop calibration entries.

## Sub-PR 7.5: knowledge/ + glossary/

- [ ] `knowledge/+page.svelte`, `knowledge/[slug]/`, `knowledge/[slug]/learn/`.
- [ ] `glossary/+page.svelte`, `glossary/[id]/`.
- [ ] Custom grids → `.ab-grid` where appropriate.
- [ ] Drop knowledge/glossary entries.

## Sub-PR 7.6: sessions/ + session/

- [ ] `sessions/[id]/`, `sessions/[id]/summary/`, `session/start/`.
- [ ] Stats → `<StatTile>`.
- [ ] Drop entries.

## Sub-PR 7.7: dashboard/

- [ ] Each `_panels/*.svelte`: tokenize without forcing primitive swaps (bespoke viz is fine).
- [ ] `+page.svelte`: grid layout already uses `.ab-grid`; verify.
- [ ] `MapPanel.svelte`, `WeakAreasPanel.svelte`, etc.
- [ ] Drop dashboard entries.
- [ ] Visual regression on dashboard.

## Cleanup

- [ ] Delete `tools/theme-lint/ignore.txt` (empty at this point).
- [ ] Full `bun run lint:theme` across `apps/study` passes.
- [ ] Remove any back-compat atomic `--font-*` tokens from #3 that were kept for migration; they should be unused now.
- [ ] `bun run check` + `bun run test` + `bun run test:e2e`.
- [ ] Run `/ball-review-ux` to confirm closure of original findings.
