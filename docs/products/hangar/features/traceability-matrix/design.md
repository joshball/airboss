---
title: "Design: Traceability Matrix Editor"
product: hangar
feature: traceability-matrix
type: design
status: done
---

# Design: Traceability Matrix Editor

## One Row Per Topic, Not Per Module

The existing `traceability_entry` table has `moduleId` as a single text field. The PRD describes a matrix with rows = topics, columns = dimensions. Restructure to one row per FAA topic with `moduleIds` as an array. Schema change on an empty table -- clean rename.

## FAA Topic Registry

`libs/constants/src/faa-topics.ts` holds the authoritative topic data. Four layers:

```typescript
export const FAA_TOPIC = {
  A_1: "A.1",
  A_2: "A.2",
  A_3: "A.3",
  A_4: "A.4",
  A_5: "A.5",
  A_6: "A.6",
  A_7: "A.7",
  A_8: "A.8",
  A_9: "A.9",
  A_10: "A.10",
  A_11: "A.11",
  A_12: "A.12",
  A_13: "A.13",
} as const;

export const FAA_TOPIC_REGISTRY: Record<
  FaaTopic,
  {
    faaTitle: string; // verbatim from AC 61-83K Appendix A
    faaDescription: string; // full paragraph from appendix
    internalName: string; // short label for UI (e.g., "GPS & TAA")
    summary: string; // 1-2 sentence terse summary
  }
> = {
  [FAA_TOPIC.A_1]: {
    faaTitle:
      "Navigating in the 21st Century: Pilotage to Global Positioning System (GPS), Automation, and Technically Advanced Aircraft (TAA)",
    faaDescription: "GPS has quickly become the principal means of navigation...",
    internalName: "GPS, Automation & TAA",
    summary: "Modern navigation, glass cockpits, ADS-B, NextGen. Teach automation without dependency.",
  },
  // ... 12 more entries
};
```

The `FAA_TOPIC` keyed object replaces bare string literals. Code uses `FAA_TOPIC.A_11` instead of `'A.11'`. The existing `FAA_TOPICS` array stays for iteration.

## Schema

### `compliance.traceability_entry` (restructured)

```typescript
export const traceabilityEntry = complianceSchema.table("traceability_entry", {
  id: text("id").primaryKey(),
  faaTopic: text("faa_topic").notNull().unique(),
  moduleIds: jsonb("module_ids").notNull().$type<string[]>().default([]),
  scenarioIds: jsonb("scenario_ids").notNull().$type<string[]>().default([]),
  competencyIds: jsonb("competency_ids").notNull().$type<string[]>().default([]),
  assessmentMethods: jsonb("assessment_methods")
    .notNull()
    .$type<{
      methods: AssessmentMethod[];
      notes: string;
    }>()
    .default({ methods: [], notes: "" }),
  estimatedMinutes: integer("estimated_minutes").notNull().default(0),
  coverage: text("coverage").notNull().default(TRACEABILITY_COVERAGE.MISSING),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## API Surface

### BC: `libs/bc/compliance/src/manage.ts`

```typescript
export async function upsertTraceabilityEntry(data: TraceabilityEntryInsert);
export async function syncTraceabilityFromContent(): Promise<TraceabilityEntry[]>;
export function computeCoverage(entry): TraceabilityCoverage;
export function computeEstimatedMinutes(scenarioIds, allScenarios): number;
```

### Route: `/compliance/traceability`

- **load**: fetch entries + scenarios + modules + competencies + validation report
- **save**: upsert single row, recompute time/coverage, audit
- **sync**: auto-populate all 13 rows from content, audit

## Component: TraceabilityMatrix

`libs/ui/src/components/TraceabilityMatrix.svelte`

Props: entries, scenarios, modules, competencies, validationChecks

Each row: topic label (internal name, full FAA title on hover), multi-select dropdowns for moduleIds/scenarioIds/competencyIds, structured assessment method picker + notes, auto-computed time, auto-derived status.

## Key Decisions

### Structured assessment methods over free text

Multi-select from `ASSESSMENT_METHOD` constant + optional free-text notes. Gives consistency in FAA exports while allowing author specifics. No downside vs free text -- we get queryable data and clean export formatting for free.

### Per-row save, not bulk

Each row saves independently. 13 rows is small. Per-row avoids lost-edit complexity.

### Time computed from scenarios, not user-entered

`estimatedMinutes` = sum of selected scenarios' `duration`. Ensures the matrix reflects actual content. Author controls time by managing scenario selection.

### Coverage auto-derived

`complete`/`partial`/`missing` computed from data. Can't claim "complete" when it isn't.

### Working draft only (no versioning yet)

The matrix editor works on the current working state. Release snapshots (freezing the matrix into a published release) are deferred to Feature 3 (Content Versioning).

### Stale scenario handling: keep and flag

Deleted scenarios stay in the entry, flagged as "(deleted)" in UI. "Sync from Content" cleans them up. This makes coverage gaps visible rather than silently hiding them.
