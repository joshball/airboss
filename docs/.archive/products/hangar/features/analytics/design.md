---
title: "Design: Hangar Analytics"
product: hangar
feature: analytics
type: design
status: done
---

# Design: Hangar Analytics

## Route Files

```text
apps/hangar/src/routes/(app)/
  analytics/
    +layout.svelte            -- tab bar (Coverage, Inventory, Questions, Time)
    coverage/
      +page.svelte            -- heat map + gap lists
      +page.server.ts         -- load getCoverageReport()
    inventory/
      +page.svelte            -- scenario breakdown tables
      +page.server.ts         -- load getInventoryReport()
    questions/
      +page.svelte            -- question bank stats
      +page.server.ts         -- load getQuestionBankReport()
    time/
      +page.svelte            -- time projection bars
      +page.server.ts         -- load getTimeProjectionReport()
```

## BC Query Layer

All queries live in `libs/bc/course/src/read.ts`. Each returns a typed report object.

```typescript
// libs/bc/course/src/read.ts

export async function getCoverageReport(db: DB): Promise<CoverageReport> {
  // 1. Query all non-deleted scenarios with faaTopics + moduleId
  // 2. Query all competencies
  // 3. Build heat map: for each (topic, module) pair, count scenarios and sum duration
  // 4. Derive depth from count + time
  // 5. Compute competency gaps (competencies with 0 linked scenarios)
  // 6. Compute topic gaps (topics below threshold)
}

export async function getInventoryReport(db: DB): Promise<InventoryReport> {
  // 1. Count scenarios grouped by status
  // 2. Unnest faaTopics, count per topic
  // 3. Unnest competencies, count per competency
  // 4. Count by difficulty
  // 5. Sum duration by topic
}

export async function getQuestionBankReport(db: DB): Promise<QuestionBankReport> {
  // 1. Count questions grouped by status
  // 2. Count by faaTopic, moduleId, purpose
  // 3. Group by poolId, flag pools with count < MIN_POOL_DEPTH
  // 4. Filter active questions where createdAt < now - RETIREMENT_WARNING_MONTHS
}

export async function getTimeProjectionReport(db: DB): Promise<TimeProjectionReport> {
  // 1. Sum scenario duration per FAA topic
  // 2. Compare each to 45-min minimum
  // 3. Apply VALIDATION_WARNING_MULTIPLIER for warning zone
  // 4. Sum total, compare to 16-hour minimum
}
```

### Aggregation Strategy

Prefer Drizzle `groupBy` + `count` / `sum` over loading all rows into JS. For JSONB array fields (`faaTopics`, `competencyIds`), use `jsonb_array_elements_text()` via Drizzle's `sql` template for unnesting.

## Heat Map Component

A table rendered in plain HTML. No charting library needed.

```svelte
<!-- coverage/+page.svelte -->
<script lang="ts">
  let { data } = $props();
  // data.report: CoverageReport
</script>

<table class="heat-map">
  <thead>
    <tr>
      <th>Topic</th>
      {#each modules as mod}
        <th>{mod.title}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each faaTopics as topic}
      <tr>
        <td>{topic.internalName}</td>
        {#each modules as mod}
          {@const cell = findCell(data.report.heatMap, topic.id, mod.id)}
          <td class="depth-{cell.depth}">
            {cell.scenarioCount} ({cell.estimatedMinutes}m)
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
```

CSS classes `depth-none`, `depth-low`, `depth-adequate` map to red, yellow, green via CSS custom properties from the theme.

## Time Projection Bars

Horizontal bar per topic. Two segments: actual time (filled) and remaining to minimum (unfilled). Color based on status.

```svelte
<!-- time/+page.svelte -->
{#each data.report.perTopic as row}
  <div class="time-bar">
    <span class="topic-label">{row.faaTopic}</span>
    <div class="bar-track">
      <div
        class="bar-fill status-{row.status}"
        style="width: {Math.min(100, (row.estimatedMinutes / row.minimum) * 100)}%"
      ></div>
      <div class="bar-threshold" style="left: 100%"></div>
    </div>
    <span class="time-label">{row.estimatedMinutes}m / {row.minimum}m</span>
  </div>
{/each}
```

## Key Decisions

**Why no persisted analytics:** Data changes frequently during authoring. Computing on-demand avoids stale caches and cache invalidation complexity. If performance becomes an issue, add server-side caching with timestamp invalidation -- but don't optimize prematurely.

**Why no charting library:** Tables and CSS bars are sufficient for Phase 6. A charting library (e.g., Chart.js, D3) would add bundle weight and complexity. Can be added later if authors want richer visualizations.

**Why separate routes per dashboard:** Each dashboard has different data needs. Separate routes mean only the needed data loads. Also supports deep linking and browser history.

**Why reuse validation thresholds:** Time projection uses the same 45-min and 16-hour constants as the validation engine. Single source of truth in `libs/constants/src/compliance.ts`.
