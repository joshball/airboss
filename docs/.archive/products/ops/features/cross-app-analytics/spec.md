---
title: "Spec: Cross-App Analytics"
product: ops
feature: cross-app-analytics
type: spec
status: done
---

# Spec: Cross-App Analytics

Unified analytics dashboard in ops that aggregates data across all apps: learner performance from sim, content health from hangar, and operational metrics from ops itself. Extends the Phase 3 analytics dashboard with cross-cutting views that no single app can provide alone.

## What It Does

Operators see a single dashboard showing the health of the entire FIRC program: how learners are performing, where content is weak, what's happening operationally. This is "Vulture's Row" -- the observation deck where you watch everything.

## Three Dashboard Sections

### 1. Learner Performance Analytics

Aggregated learner metrics across all enrollments.

| Metric                  | Source                      | Description                                                 |
| ----------------------- | --------------------------- | ----------------------------------------------------------- |
| Completion rate         | `enrollment.enrollment`     | % of enrollments that reached `graduated` status            |
| Average course duration | `enrollment.time_log`       | Mean total hours from enrollment to graduation              |
| Scenario pass rate      | `evidence.scenario_run`     | % of runs with `outcome = 'safe'`                           |
| Average scenario score  | `evidence.scenario_run`     | Mean overall score across all runs                          |
| Struggle points         | `evidence.score_dimension`  | Competency domains with lowest average scores               |
| Mode distribution       | `evidence.scenario_run`     | % of runs by mode (course, free_play, drill)                |
| Drop-off points         | `enrollment.lesson_attempt` | Modules/scenarios where learners abandon or fail repeatedly |
| Time per FAA topic      | `enrollment.time_log`       | Average time spent per topic across all learners            |

### 2. Content Effectiveness

How well content is working, measured by learner outcomes.

| Metric                          | Source                                      | Description                                                                              |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Scenario difficulty calibration | `evidence.scenario_run` x `course.scenario` | Actual pass rates vs authored difficulty level                                           |
| Question discrimination         | `evidence.evidence_packet`                  | Questions where high-performers and low-performers score similarly (poor discrimination) |
| Time accuracy                   | `evidence.scenario_run` x `course.scenario` | Actual duration vs estimated duration                                                    |
| Knowledge check accuracy        | `enrollment.lesson_attempt`                 | Average scores on knowledge checks by module                                             |
| Adaptive engine coverage        | `enrollment.learner_memory`                 | % of content items with spaced repetition data                                           |

### 3. Operational Metrics

Program-level stats.

| Metric                      | Source                                 | Description                                          |
| --------------------------- | -------------------------------------- | ---------------------------------------------------- |
| Active enrollments          | `enrollment.enrollment`                | Count by status (active, graduated, expired, denied) |
| Enrollment velocity         | `enrollment.enrollment`                | New enrollments per week/month                       |
| Certificate issuance rate   | `enrollment.enrollment`                | Graduations per month                                |
| FAA compliance status       | `compliance.*`                         | Last regulatory check date, validation pass/fail     |
| Content freshness           | `course.*`                             | Days since last content publish                      |
| Revenue (if payment active) | `enrollment.enrollment` x payment data | Revenue per month (deferred until Phase 4b)          |

## Data Model

### No new tables

All analytics are computed from existing tables across schemas: `enrollment.*`, `evidence.*`, `course.*`, `compliance.*`.

### New constants in `libs/constants/src/cross-analytics.ts`

| Constant                   | Type        | Value                                     |
| -------------------------- | ----------- | ----------------------------------------- |
| `ANALYTICS_SECTION`        | enum object | `LEARNER`, `CONTENT`, `OPERATIONAL`       |
| `TIME_RANGE`               | enum object | `WEEK`, `MONTH`, `QUARTER`, `YEAR`, `ALL` |
| `STRUGGLE_THRESHOLD`       | number      | `0.5`                                     |
| `DISCRIMINATION_THRESHOLD` | number      | `0.2`                                     |

### New routes in `libs/constants/src/routes.ts`

| Route                       | Path                       |
| --------------------------- | -------------------------- |
| `OPS_ANALYTICS_LEARNER`     | `'/analytics/learner'`     |
| `OPS_ANALYTICS_CONTENT`     | `'/analytics/content'`     |
| `OPS_ANALYTICS_OPERATIONAL` | `'/analytics/operational'` |

### New types in `libs/types/src/cross-analytics.ts`

```typescript
interface LearnerAnalytics {
  completionRate: number;
  avgCourseDurationHours: number;
  scenarioPassRate: number;
  avgScenarioScore: number;
  strugglePoints: { domain: string; avgScore: number }[];
  modeDistribution: Record<string, number>;
  dropOffPoints: { entityType: string; entityId: string; title: string; dropCount: number }[];
  timeByTopic: Record<string, number>;
}

interface ContentEffectiveness {
  difficultyCalibration: { scenarioId: string; title: string; authoredDifficulty: number; actualPassRate: number }[];
  poorDiscrimination: { questionId: string; text: string; discriminationIndex: number }[];
  timeAccuracy: { scenarioId: string; title: string; estimated: number; actual: number }[];
  checkAccuracyByModule: { moduleId: string; title: string; avgScore: number }[];
  adaptiveCoverage: number;
}

interface OperationalMetrics {
  enrollmentsByStatus: Record<string, number>;
  enrollmentVelocity: { period: string; count: number }[];
  certificateRate: { period: string; count: number }[];
  lastRegulatoryCheck: string | null;
  daysSinceLastCheck: number | null;
  validationStatus: "pass" | "fail" | "warning";
  daysSinceLastPublish: number | null;
}

interface CrossAnalyticsReport {
  learner: LearnerAnalytics;
  content: ContentEffectiveness;
  operational: OperationalMetrics;
  timeRange: TimeRange;
  generatedAt: string;
}
```

## Behavior

### Time Range Filter

All metrics support a time range filter: Week, Month, Quarter, Year, All Time. Default is Month. The filter is a URL search param so it persists on page reload.

### Navigation

Tabbed interface at `/analytics/*` in ops. Three tabs matching the three sections. Each is a separate route.

### Data Loading

Each section loads via its `+page.server.ts`. Queries span multiple schemas:

- **Learner analytics** reads from `enrollment.*` + `evidence.*`
- **Content effectiveness** reads from `evidence.*` + `course.*` (via `@firc/bc/course/read`)
- **Operational metrics** reads from `enrollment.*` + `compliance.*` + `course.*`

### Question Discrimination Index

For each FAA question, compute:

1. Split learners into top 27% and bottom 27% by overall course score
2. For each question, compute pass rate for top group and bottom group
3. Discrimination index = top_pass_rate - bottom_pass_rate
4. Flag questions where index < `DISCRIMINATION_THRESHOLD` (both groups perform similarly -- question doesn't distinguish strong from weak learners)

This is a standard psychometric measure. It identifies questions that should be rewritten or replaced.

### Struggle Point Detection

A competency domain is a "struggle point" when the average score across all learners and all scenario runs touching that domain is below `STRUGGLE_THRESHOLD`. Operators can use this to:

- Ask authors to create more content for that domain
- Adjust difficulty of existing scenarios
- Identify if the content is unclear vs genuinely hard

## Validation

No user inputs beyond the time range filter. Read-only dashboards.

| Field       | Rule                                                |
| ----------- | --------------------------------------------------- |
| `timeRange` | Must be valid `TIME_RANGE` value. Default: `MONTH`. |

## Edge Cases

| Case                                        | Behavior                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| No enrollments                              | All learner metrics show zero/empty. Operational shows 0 active.               |
| No scenario runs                            | Pass rate 0%, no struggle points, no mode distribution.                        |
| No graduated learners                       | Completion rate 0%, certificate rate 0.                                        |
| Single learner (too few for discrimination) | Discrimination index shows "Insufficient data" instead of a number.            |
| No FAA questions answered                   | Content effectiveness section shows "No data" for question metrics.            |
| No regulatory checks                        | Shows "Never checked" with overdue warning.                                    |
| Time range has no data                      | All metrics show zero for that period. No error.                               |
| Cross-schema query performance              | Queries should use indexed columns. Add indexes during schema phase if needed. |

## Out of Scope

- Real-time / live dashboards (data is loaded on page visit)
- Export to CSV / PDF reports
- Email alerts for metric thresholds
- Comparative analytics (this cohort vs last cohort)
- Individual learner drill-down (existing in ops learner progress view)
- Revenue analytics (deferred until payment integration)
- A/B testing analytics
