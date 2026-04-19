---
title: "Spec: Hangar Analytics"
product: hangar
feature: analytics
type: spec
status: done
---

# Spec: Hangar Analytics

Four dashboards that show the state of course content at a glance: coverage across FAA topics, scenario inventory, question bank health, and time projections. All data is computed on-demand from existing content tables -- no new persistence.

Covers PRD sections E1-E4.

## What It Does

Authors see where content is strong, where it's thin, and whether FAA time requirements will be met. Each dashboard is a read-only view that queries content tables and presents aggregated stats.

## Four Dashboards

### 1. Coverage Dashboard (`ROUTES.ANALYTICS_COVERAGE`)

Heat map of content coverage across FAA topics and modules.

| Display                                                                    | Source                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| Heat map: FAA topics (rows) x modules (columns), colored by coverage depth | `course.scenario` faaTopics + moduleId               |
| Competency coverage: which competencies have scenarios, which don't        | `course.scenario` competencies + `course.competency` |
| Gap list: topics/competencies below threshold                              | Derived from above                                   |

**Heat map color scale:**

| Color  | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| Red    | No scenarios for this topic in this module              |
| Yellow | 1 scenario, or < 45 min estimated time                  |
| Green  | 2+ scenarios AND >= 45 min estimated time               |
| Gray   | Module does not target this topic (no mapping expected) |

### 2. Scenario Inventory (`ROUTES.ANALYTICS_INVENTORY`)

Content volume and distribution stats.

| Display                                                                  | Source                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Total scenarios by status (draft, review, approved, published, archived) | `course.scenario` grouped by status                    |
| Scenarios per FAA topic                                                  | `course.scenario` faaTopics unnested                   |
| Scenarios per competency                                                 | `course.scenario` competencies unnested                |
| Difficulty distribution (bar chart data)                                 | `course.scenario` grouped by difficulty                |
| Estimated play time per topic                                            | Sum of `course.scenario` duration grouped by faaTopics |

### 3. Question Bank Stats (`ROUTES.ANALYTICS_QUESTIONS`)

Health of the FAA question pool.

| Display                                                                  | Source                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| Total questions by status (draft, approved, active, retired)             | `course.question` grouped by status             |
| Questions per topic, per module                                          | `course.question` grouped by faaTopic, moduleId |
| FAA vs lesson breakdown                                                  | `course.question` grouped by purpose            |
| Randomization pool depth (pools with < 3 questions flagged)              | `course.question` grouped by poolId             |
| Questions approaching retirement (created > 18 months ago, still active) | `course.question` createdAt filter              |

### 4. Time Projection (`ROUTES.ANALYTICS_TIME`)

Whether the course meets FAA minimums.

| Display                                                          | Source                                          |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| Estimated learner time per FAA topic (from scenario durations)   | `course.scenario` duration grouped by faaTopics |
| Comparison bar: actual vs 45-min minimum per topic               | Computed                                        |
| Total estimated course time vs 16-hour minimum                   | Sum of all scenario durations                   |
| Topics trending under threshold (< 54 min = within warning zone) | Filter by `VALIDATION_WARNING_MULTIPLIER`       |

## Data Model

No new tables. All dashboards read from existing `course.*` tables.

### New constants in `libs/constants/src/analytics.ts`

| Constant                    | Type        | Value                                        |
| --------------------------- | ----------- | -------------------------------------------- |
| `COVERAGE_DEPTH`            | enum object | `NONE`, `LOW`, `ADEQUATE`, `NOT_APPLICABLE`  |
| `RETIREMENT_WARNING_MONTHS` | number      | `18`                                         |
| `ANALYTICS_TABS`            | enum object | `COVERAGE`, `INVENTORY`, `QUESTIONS`, `TIME` |

### New routes in `libs/constants/src/routes.ts`

| Route                 | Path                     |
| --------------------- | ------------------------ |
| `ANALYTICS_QUESTIONS` | `'/analytics/questions'` |
| `ANALYTICS_TIME`      | `'/analytics/time'`      |

Note: `ANALYTICS_COVERAGE` and `ANALYTICS_INVENTORY` already exist as placeholders.

### New types in `libs/types/src/analytics.ts`

```typescript
interface CoverageCell {
  faaTopic: FaaTopic;
  moduleId: string;
  scenarioCount: number;
  estimatedMinutes: number;
  depth: CoverageDepth;
}

interface CoverageReport {
  heatMap: CoverageCell[];
  competencyGaps: { competencyId: string; name: string; scenarioCount: number }[];
  topicGaps: { faaTopic: FaaTopic; scenarioCount: number; estimatedMinutes: number }[];
}

interface InventoryReport {
  byStatus: Record<string, number>;
  byTopic: Record<FaaTopic, number>;
  byCompetency: Record<string, number>;
  byDifficulty: Record<string, number>;
  timeByTopic: Record<FaaTopic, number>;
}

interface QuestionBankReport {
  byStatus: Record<string, number>;
  byTopic: Record<FaaTopic, number>;
  byModule: Record<string, number>;
  byPurpose: Record<string, number>;
  shallowPools: { poolId: string; count: number }[];
  approachingRetirement: { questionId: string; createdAt: string; ageMonths: number }[];
}

interface TimeProjectionReport {
  perTopic: { faaTopic: FaaTopic; estimatedMinutes: number; minimum: number; status: "ok" | "warning" | "fail" }[];
  totalMinutes: number;
  totalMinimum: number;
  totalStatus: "ok" | "warning" | "fail";
}
```

## Behavior

### Navigation

A tabbed interface at `/analytics/*`. Tab bar shows all four dashboards. Each tab is a separate route for direct linking and back-button support.

### Data Loading

Each dashboard loads data in its `+page.server.ts` via `@firc/bc/course/read` queries. No caching -- data is always fresh. Queries should be efficient (aggregation in SQL via Drizzle, not in JS).

### No Interactivity

These are read-only dashboards. No editing, no filtering (Phase 6 scope). Filtering could be added later without schema changes.

## Validation

No user inputs -- read-only views.

## Edge Cases

| Case                              | Behavior                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| No scenarios exist                | Heat map all red. Inventory shows zeros. Time projection all fail.                   |
| No questions exist                | Question bank shows zeros. All pool depths zero.                                     |
| Scenario with no faaTopics        | Not counted in any topic row. Visible in inventory total but not in topic breakdown. |
| Scenario in multiple FAA topics   | Counted once per topic. Duration contributes to each topic independently.            |
| Question without poolId           | Listed as pool of 1, flagged as shallow.                                             |
| Module with no scenarios assigned | Column shows all red for that module in heat map.                                    |
| FAA question purpose not set      | Default is `'lesson'` -- won't appear in FAA question counts.                        |

## Out of Scope

- Filtering / drill-down (future enhancement)
- Charts / visualizations (tables and colored cells for Phase 6; charting library deferred)
- Historical trend data (would require persisted snapshots)
- Export to CSV/PDF
- Learner-facing analytics (that's ops)
- Real-time updates / polling
