---
title: "Design: Cross-App Analytics"
product: ops
feature: cross-app-analytics
type: design
status: done
---

# Design: Cross-App Analytics

## Route Files

```text
apps/ops/src/routes/(app)/
  analytics/
    +layout.svelte            -- tab bar (Learner, Content, Operational) + time range filter
    learner/
      +page.svelte            -- learner performance metrics
      +page.server.ts         -- load getLearnerAnalytics()
    content/
      +page.svelte            -- content effectiveness metrics
      +page.server.ts         -- load getContentEffectiveness()
    operational/
      +page.svelte            -- operational metrics
      +page.server.ts         -- load getOperationalMetrics()
```

The existing Phase 3 analytics dashboard at `/analytics` becomes a redirect to `/analytics/learner`.

## BC Query Layer

Cross-app analytics require reading from multiple schemas. Queries live in the BC that owns the primary data:

- Learner metrics -> `@firc/bc/evidence/read` (reads evidence + enrollment)
- Content effectiveness -> `@firc/bc/evidence/read` (reads evidence + course)
- Operational metrics -> `@firc/bc/enrollment/read` (reads enrollment + compliance)

Each function accepts a `TimeRange` parameter and filters accordingly.

```typescript
// libs/bc/evidence/src/read.ts

export async function getLearnerAnalytics(db: DB, timeRange: TimeRange): Promise<LearnerAnalytics> {
  const rangeFilter = computeDateRange(timeRange);

  // 1. Completion rate: graduated / (graduated + active + expired + denied)
  // 2. Avg duration: avg(time_log.sum) grouped by enrollment, filtered to graduated
  // 3. Pass rate: count(outcome='safe') / count(all) from scenario_run
  // 4. Avg score: avg(score) from scenario_run
  // 5. Struggle points: avg score_dimension by competency domain, filter < STRUGGLE_THRESHOLD
  // 6. Mode distribution: count by mode from scenario_run
  // 7. Drop-offs: lesson_attempt grouped by scenario, filter high fail/abandon rate
  // 8. Time by topic: sum duration from time_log grouped by topic
}

export async function getContentEffectiveness(db: DB, timeRange: TimeRange): Promise<ContentEffectiveness> {
  // 1. Difficulty calibration: join scenario_run with course.scenario
  //    Group by scenario, compute actual pass rate, compare to authored difficulty
  // 2. Discrimination: requires per-question performance data
  //    Split learners into top/bottom 27% by overall score
  //    Compute per-question pass rate for each group
  //    Index = top_rate - bottom_rate
  // 3. Time accuracy: join scenario_run actual duration with course.scenario estimated
  // 4. Check accuracy: avg score from lesson_attempt grouped by module
  // 5. Adaptive coverage: count(distinct itemId from learner_memory) / count(total items)
}
```

```typescript
// libs/bc/enrollment/src/read.ts

export async function getOperationalMetrics(db: DB, timeRange: TimeRange): Promise<OperationalMetrics> {
  // 1. Enrollment counts: group by status
  // 2. Velocity: count enrollments grouped by week/month within range
  // 3. Certificate rate: count graduations grouped by period
  // 4. Compliance: last regulatory check from compliance.regulatory_check
  // 5. Freshness: max(createdAt) from published.release
}
```

## Time Range Implementation

```typescript
// libs/types/src/cross-analytics.ts

function computeDateRange(range: TimeRange): { from: Date; to: Date } {
  const to = new Date();
  switch (range) {
    case TIME_RANGE.WEEK:
      return { from: subDays(to, 7), to };
    case TIME_RANGE.MONTH:
      return { from: subDays(to, 30), to };
    case TIME_RANGE.QUARTER:
      return { from: subDays(to, 90), to };
    case TIME_RANGE.YEAR:
      return { from: subDays(to, 365), to };
    case TIME_RANGE.ALL:
      return { from: new Date(0), to };
  }
}
```

Time range is a URL search param (`?range=month`). The layout component renders the filter and passes the value to child pages.

```svelte
<!-- analytics/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  let { children } = $props();

  let range = $derived(page.url.searchParams.get('range') ?? TIME_RANGE.MONTH);
</script>

<nav class="analytics-tabs">
  <a href={ROUTES.OPS_ANALYTICS_LEARNER}>Learner</a>
  <a href={ROUTES.OPS_ANALYTICS_CONTENT}>Content</a>
  <a href={ROUTES.OPS_ANALYTICS_OPERATIONAL}>Operational</a>
</nav>

<div class="time-filter">
  {#each Object.values(TIME_RANGE) as r}
    <a href="?range={r}" class:active={range === r}>{r}</a>
  {/each}
</div>

{@render children()}
```

## Discrimination Index Algorithm

```typescript
function computeDiscriminationIndex(
  questionId: string,
  learnerScores: Map<string, number>, // userId -> overall course score
  questionAnswers: Map<string, Map<string, boolean>>, // userId -> questionId -> correct
): number | null {
  const sortedLearners = [...learnerScores.entries()].sort((a, b) => b[1] - a[1]);

  if (sortedLearners.length < 4) return null; // insufficient data

  const cutoff = Math.ceil(sortedLearners.length * 0.27);
  const topGroup = sortedLearners.slice(0, cutoff).map(([id]) => id);
  const bottomGroup = sortedLearners.slice(-cutoff).map(([id]) => id);

  const topRate = passRate(topGroup, questionId, questionAnswers);
  const bottomRate = passRate(bottomGroup, questionId, questionAnswers);

  return topRate - bottomRate;
}
```

## Key Decisions

**Why ops owns cross-app analytics (not a shared dashboard):** Ops is the operations app. Operators need the cross-cutting view. Authors (hangar) need content-specific analytics. Learners (sim) see their own progress. The cross-app view is an ops concern.

**Why query across schemas:** The alternative is duplicating data or building a separate analytics schema. Cross-schema reads are simpler and always consistent. If performance becomes an issue, materialized views or a read replica can be added later.

**Why discrimination index:** It's a standard psychometric measure used in test development. Questions that don't discriminate between strong and weak learners are either too easy, too hard, or poorly written. This directly supports content quality improvement.

**Why time range as URL param:** Preserves selection on page reload and enables sharing specific views. Simpler than session state.
