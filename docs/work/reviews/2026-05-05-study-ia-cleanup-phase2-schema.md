# Schema review -- study-ia-cleanup Phase 2

issues_found: 1

## SC-1 (info) -- no schema migration

This Phase 2 slice is route migration + UI consolidation. It introduces:

- 4 new `PAGE_EXPLAINER_KEYS` constants. They share the existing `study.user_pref` row keyed by `study.page_explainer.dismissed`, so no DDL.
- New tab values (`quals` / `goal` / `plan` / `coverage`) that are URL constants only -- not persisted.
- One new view-model interface `ProgramCoverageData` that's purely TypeScript.

No Drizzle migration generated. No tables touched. No indexes added.

No issues.
