---
title: "Spec: Traceability Matrix Editor"
product: hangar
feature: traceability-matrix
type: spec
status: done
---

# Spec: Traceability Matrix Editor

Interactive editor for the FAA traceability matrix -- the most important compliance artifact. Shows all 13 FAA core topics as rows, with columns for coverage dimensions (modules, scenarios, competencies, assessment methods, time, status). Cells are editable via dropdowns. Auto-populates from existing content data. Live-validates via the content validation engine.

## Data Model

### FAA Topic Registry

New constant structure in `libs/constants/src/faa-topics.ts`. Four layers per topic:

- **faaTitle**: verbatim from AC 61-83K Appendix A -- used in FAA-facing exports
- **faaDescription**: full paragraph from the appendix -- reference for authors
- **internalName**: our short label for UI dropdowns, sidebar, headers
- **summary**: our 1-2 sentence terse summary for author context

```typescript
export const FAA_TOPIC_REGISTRY: Record<FaaTopic, {
  faaTitle: string;
  faaDescription: string;
  internalName: string;
  summary: string;
}> = { ... };
```

Also add a keyed constant for typed topic references:

```typescript
export const FAA_TOPIC = {
  A_1: "A.1",
  A_2: "A.2",
  // ...
  A_13: "A.13",
} as const;
```

This eliminates magic strings like `'A.11'` throughout the codebase. Code should use `FAA_TOPIC.A_11` instead.

### Extend `compliance.traceability_entry`

Restructure the existing table. One row per FAA topic (not per topic-per-module):

| Column              | Type                            | Change                     | Notes                                                        |
| ------------------- | ------------------------------- | -------------------------- | ------------------------------------------------------------ |
| `id`                | `text` PK                       | keep                       |                                                              |
| `faaTopic`          | `text` NOT NULL, UNIQUE         | add unique constraint      | One row per topic                                            |
| `moduleIds`         | `jsonb` NOT NULL, default `[]`  | **rename** from `moduleId` | Array of module IDs                                          |
| `scenarioIds`       | `jsonb` NOT NULL, default `[]`  | keep                       | Array of scenario IDs                                        |
| `competencyIds`     | `jsonb` NOT NULL, default `[]`  | keep                       | Array of competency IDs                                      |
| `assessmentMethods` | `jsonb` NOT NULL                | **add**                    | Structured: `{ methods: AssessmentMethod[], notes: string }` |
| `estimatedMinutes`  | `integer` NOT NULL, default `0` | **add**                    | Computed from selected scenarios' durations                  |
| `coverage`          | `text` NOT NULL                 | keep                       | `'complete'`, `'partial'`, `'missing'`                       |
| `notes`             | `text`                          | **add**                    | Free text notes for the author                               |
| `updatedAt`         | `timestamp`                     | keep                       |                                                              |
| `createdAt`         | `timestamp`                     | **add**                    |                                                              |

### Assessment Method constant

```typescript
export const ASSESSMENT_METHOD = {
  SCENARIO: "scenario",
  KNOWLEDGE_CHECK: "knowledge-check",
  DEBRIEF: "debrief",
  PRACTICAL: "practical-demonstration",
} as const;
```

### `TRACEABILITY_COVERAGE` constant

```typescript
export const TRACEABILITY_COVERAGE = {
  COMPLETE: "complete",
  PARTIAL: "partial",
  MISSING: "missing",
} as const;
```

## Behavior

### Matrix View

The page at `/compliance/traceability` shows a table with 13 rows (one per FAA topic). Columns:

| Column       | Content                                                                            | Editable?                             |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------- |
| Topic        | Code + internal name (e.g., "A.1 - GPS & TAA"). Hover/expand shows full FAA title. | No                                    |
| Modules      | Which modules cover this topic                                                     | Yes -- multi-select dropdown          |
| Scenarios    | Which scenarios cover this topic                                                   | Yes -- multi-select dropdown          |
| Competencies | Which competencies are linked                                                      | Yes -- multi-select dropdown          |
| Assessment   | Structured: method types + optional notes                                          | Yes -- multi-select + text            |
| Time (min)   | Estimated coverage time                                                            | Auto-computed from selected scenarios |
| Status       | Complete / Partial / Missing                                                       | Auto-computed from data               |

### Auto-Population

On "Sync from Content":

- **Scenarios**: All non-deleted scenarios with this FAA topic in their `faaTopics` array
- **Competencies**: All competencies whose `faaTopic` matches this row's topic
- **Time**: Sum of `duration` from selected scenarios (in minutes)
- **Status**: Derived from coverage criteria (see below)

The author can override suggestions by editing cells. Overrides are persisted and take precedence.

### Coverage Status Derivation

| Status     | Criteria                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| `complete` | scenarioIds non-empty AND competencyIds non-empty AND estimatedMinutes >= 45 |
| `partial`  | at least one of the above is met, but not all                                |
| `missing`  | scenarioIds empty AND competencyIds empty                                    |

### Saving

Each row saves independently via a form action. On save:

1. Upsert the `traceability_entry` for that `faaTopic`
2. Recompute `estimatedMinutes` from selected scenarios
3. Recompute `coverage` status
4. Log via `@firc/audit`

### Sync from Content

"Sync from Content" re-derives all 13 rows from current content. Overwrites manual edits. Creates entries for topics that don't have one.

### Stale Scenario Handling

When a scenario is soft-deleted after being linked to the matrix, the working draft keeps the reference and flags it as "(deleted)" in the UI. The author sees the gap and can clean up manually, or click "Sync from Content" to remove all stale references.

Historical releases (Feature 3, Content Versioning) will snapshot the matrix -- deleted scenarios remain in the frozen snapshot forever. The working draft is the only place stale references appear.

### Live Validation

The page runs `runValidation()` on load and shows the `MATRIX_COMPLETENESS` check result. After any save, validation result updates.

## Validation

| Field                       | Rule                                                    |
| --------------------------- | ------------------------------------------------------- |
| `faaTopic`                  | Must be one of `FAA_TOPICS`. Not user-editable.         |
| `moduleIds`                 | Array of valid module IDs. Can be empty.                |
| `scenarioIds`               | Array of valid, non-deleted scenario IDs. Can be empty. |
| `competencyIds`             | Array of valid competency IDs. Can be empty.            |
| `assessmentMethods.methods` | Array of `ASSESSMENT_METHOD` values. Can be empty.      |
| `assessmentMethods.notes`   | Free text, max 1000 chars.                              |
| `notes`                     | Free text, max 2000 chars.                              |

## Edge Cases

| Case                              | Behavior                                                                    |
| --------------------------------- | --------------------------------------------------------------------------- |
| No traceability entries exist     | 13 empty rows shown. Sync creates all 13.                                   |
| Deleted scenario linked in matrix | Kept in entry, flagged as "(deleted)". Sync removes it.                     |
| Scenario covers multiple topics   | Same scenario ID in multiple rows. Correct and expected.                    |
| Module with no assigned scenarios | Can still be linked to a topic row. Time comes from scenarios, not modules. |
| All scenarios deleted for a topic | Time drops to 0, status changes to missing.                                 |

## Out of Scope

- PDF/document export (FAA package generator feature)
- Matrix versioning / release snapshots (content versioning feature)
- Custom topics beyond AC 61-83K's 13
- Row reordering (fixed to topic order)
