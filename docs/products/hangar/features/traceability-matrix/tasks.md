---
title: "Tasks: Traceability Matrix Editor"
product: hangar
feature: traceability-matrix
type: tasks
status: done
---

# Tasks: Traceability Matrix Editor

## Pre-flight

- [ ] Read `libs/bc/compliance/src/schema.ts` -- existing traceability_entry table
- [ ] Read `libs/bc/compliance/src/manage.ts` -- existing upsert/list functions
- [ ] Read `libs/bc/compliance/src/validate.ts` -- matrix completeness check
- [ ] Read `libs/bc/course/src/manage.ts` -- list scenarios, modules, competencies
- [ ] Read `libs/constants/src/course.ts` -- FAA_TOPICS
- [ ] Read `scripts/db/seed.ts` -- competency -> faaTopic mapping
- [ ] Read `docs/firc/references/AC_61-83K.pdf` pages 38-51 -- exact topic titles and descriptions

## Implementation

### 1. FAA Topic Registry + Constants

- [ ] Create `libs/constants/src/faa-topics.ts` with `FAA_TOPIC` keyed object and `FAA_TOPIC_REGISTRY` (all 13 topics with faaTitle, faaDescription, internalName, summary from AC 61-83K)
- [ ] Add `ASSESSMENT_METHOD` constant to `libs/constants/src/compliance.ts`
- [ ] Add `TRACEABILITY_COVERAGE` constant to `libs/constants/src/compliance.ts`
- [ ] Export all new constants from `libs/constants/src/index.ts`
- [ ] Run `bun run check` -- 0 errors

### 2. Project-wide AC 61-83K Audit

- [ ] Audit all existing references to FAA topics across the codebase (search for `'A.1'`, `'A.2'`, etc.)
- [ ] Replace bare string literals with `FAA_TOPIC.*` constants where possible
- [ ] Verify competency seed data `faaTopic` values match AC 61-83K
- [ ] Verify `FAA_TIME` constants match AC 61-83K Section 13.1
- [ ] Verify `MIN_FAA_QUESTIONS` (60) matches AC 61-83K Section 13.7
- [ ] Document any discrepancies found
- [ ] Run `bun run check` -- 0 errors, commit

### 3. Schema Changes

- [ ] Restructure `compliance.traceability_entry` in `libs/bc/compliance/src/schema.ts`:
  - Rename `moduleId` -> `moduleIds` (jsonb array, default `[]`)
  - Add `assessmentMethods` (jsonb, structured `{ methods, notes }`)
  - Add `estimatedMinutes` (integer, default 0)
  - Add `notes` (text, nullable)
  - Add `createdAt` (timestamp)
  - Add UNIQUE constraint on `faaTopic`
  - Add CHECK constraint on `coverage` (complete/partial/missing)
- [ ] Update `libs/bc/compliance/src/manage.ts` to match new schema
- [ ] Update `libs/bc/compliance/src/read.ts` if affected
- [ ] Update validation engine `checkMatrixCompleteness()` if schema change affects it
- [ ] Regenerate initial migration and reset DB
- [ ] Run `bun run check` -- 0 errors, commit

### 4. BC Functions

- [ ] Add `upsertTraceabilityEntry()` to manage.ts -- upsert by faaTopic
- [ ] Add `syncTraceabilityFromContent()` to manage.ts -- auto-populate all 13 rows
- [ ] Add `computeCoverage()` -- derive complete/partial/missing
- [ ] Add `computeEstimatedMinutes()` -- sum scenario durations
- [ ] Export new functions from `libs/bc/compliance/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 5. TraceabilityMatrix Component

- [ ] Create `libs/ui/src/components/TraceabilityMatrix.svelte`
  - 13 rows, one per FAA topic (code + internal name, full title on hover)
  - Multi-select dropdowns for modules, scenarios, competencies
  - Structured assessment method picker (multi-select + notes text)
  - Auto-computed time column
  - Auto-derived status column with color coding
  - Per-row save form
  - Deleted scenario flagging
- [ ] Export from `libs/ui/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Hangar Route

- [ ] Create `apps/hangar/src/routes/(app)/compliance/traceability/+page.server.ts`
  - Load: fetch entries + scenarios + modules + competencies + validation report
  - Save action: upsert single row, recompute time/coverage, audit
  - Sync action: auto-populate all 13 rows, audit
- [ ] Create `apps/hangar/src/routes/(app)/compliance/traceability/+page.svelte`
  - Page title, Sync from Content button, TraceabilityMatrix component
- [ ] Add audit logging to both actions
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Request implementation review
- [ ] Commit docs updates
