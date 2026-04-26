---
title: "Design: Debrief"
product: sim
feature: debrief
type: design
status: done
---

# Design: Debrief

## Route Files

```text
apps/sim/src/routes/(app)/
  debrief/
    [runId]/
      +page.svelte          -- debrief display
      +page.server.ts       -- load run + evidence + scenario script
```

`[runId]` is a Tier B ULID (`run_01jvxyz...`). Lives inside `(app)/` -- auth inherited.

## New BC Module: `evidence/learner.ts`

`libs/bc/evidence/src/read.ts` already exists with hangar aggregate reads (`getRunsForScenario`,
`getEvidenceForRun`). The debrief needs user-scoped reads -- these must not be in the same file.

Create `libs/bc/evidence/src/learner.ts`:

```typescript
// libs/bc/evidence/src/learner.ts
// User-scoped reads. Always enforce userId ownership -- never return data for another user.

export async function getOwnRun(runId: string, userId: string) {
  const [run] = await db
    .select()
    .from(scenarioRun)
    .where(and(eq(scenarioRun.id, runId), eq(scenarioRun.userId, userId)));
  return run ?? null;
}

export async function getOwnEvidencePacket(runId: string, userId: string) {
  // Join through scenarioRun to enforce userId
  const [packet] = await db
    .select({ packet: evidencePacket })
    .from(evidencePacket)
    .innerJoin(scenarioRun, eq(evidencePacket.runId, scenarioRun.id))
    .where(and(eq(evidencePacket.runId, runId), eq(scenarioRun.userId, userId)));
  return packet?.packet ?? null;
}

export async function getOwnScoreDimensions(runId: string, userId: string) {
  return db
    .select({ dim: scoreDimension })
    .from(scoreDimension)
    .innerJoin(scenarioRun, eq(scoreDimension.runId, scenarioRun.id))
    .where(and(eq(scoreDimension.runId, runId), eq(scenarioRun.userId, userId)))
    .then((rows) => rows.map((r) => r.dim));
}
```

Export from `libs/bc/evidence/src/index.ts` as `learner`. Update debrief imports to use
`@firc/bc/evidence/learner`.

## Load Function

```typescript
// +page.server.ts
export const load = async (event) => {
  const user = requireAuth(event);

  const run = await evidenceLearner.getOwnRun(event.params.runId, user.id);
  if (!run) error(404);
  // 403 not 404: do not leak that the run exists for a different user
  // getOwnRun already enforces userId -- null means either not found or not owned

  const [packet, dimensions] = await Promise.all([
    evidenceLearner.getOwnEvidencePacket(event.params.runId, user.id),
    evidenceLearner.getOwnScoreDimensions(event.params.runId, user.id),
  ]);

  // Load scenario script for timeline annotations
  const scenario = run.releaseId ? await courseRead.getPublishedScenarioBySlug(run.releaseId, run.scenarioId) : null;

  return { run, packet, dimensions, scenario };
};
```

## Timeline Construction

`packet.actionsTaken` is typed as `ActionTaken[]` (from `@firc/types/src/schemas/engine.ts`):

```typescript
// ActionTaken is defined in libs/types/src/schemas/engine.ts
// interface ActionTaken { tickId: string; intervention: InterventionLevel | null; timestamp: number; }
```

The `null` intervention occurs on the terminal tick (run ended, no intervention made). The timeline
builder must guard against it.

```typescript
// buildTimeline -- lives in apps/sim/src/$lib/debrief.ts (presentation logic, app-level)
function buildTimeline(run: ScenarioRun, packet: EvidencePacket, scenario: PublishedScenario | null) {
  return packet.actionsTaken.map((action) => {
    const tick = scenario?.tickScript?.ticks.find((t) => t.id === action.tickId);

    // Terminal tick: intervention is null -- no consequence lookup possible
    if (action.intervention === null) {
      return {
        tickId: action.tickId,
        scene: tick?.scene ?? "[scene unavailable]",
        chosen: null,
        chosenAnnotation: "Run ended",
        bestChoice: null,
        scoreDelta: {},
      };
    }

    const consequence = tick?.consequences[action.intervention];
    const bestChoice = tick ? getBestIntervention(tick) : null; // from @firc/engine

    return {
      tickId: action.tickId,
      scene: tick?.scene ?? "[scene unavailable]",
      chosen: action.intervention,
      chosenAnnotation: consequence?.annotation ?? "",
      bestChoice: bestChoice !== action.intervention ? bestChoice : null,
      scoreDelta: consequence?.scoreDelta ?? {},
    };
  });
}
```

`getBestIntervention` is defined in `libs/engine/src/tick.ts` and imported via `@firc/engine`.
It belongs in the engine (pure computation on `Tick` engine type) not in the app lib.

## Key Misses Extraction

`sumValues` is defined in `libs/engine/src/score.ts` and imported via `@firc/engine`:

```typescript
// libs/engine/src/score.ts
export function sumValues(dims: Partial<Record<ScoreDimension, number>>): number {
  return Object.values(dims).reduce((acc, v) => acc + (v ?? 0), 0);
}
```

```typescript
// extractKeyMisses -- in apps/sim/src/$lib/debrief.ts
function extractKeyMisses(timeline: TimelineEntry[]) {
  const misses = timeline
    .filter((entry) => entry.scoreDelta && sumValues(entry.scoreDelta) < 0)
    .sort((a, b) => sumValues(a.scoreDelta) - sumValues(b.scoreDelta))
    .slice(0, 3);
  return misses;
}
```

## Page Component Structure

```svelte
<script lang="ts">
  let { data } = $props();
  const { run, packet, dimensions, scenario } = data;

  const timeline = $derived(buildTimeline(run, packet, scenario));
  const keyMisses = $derived(extractKeyMisses(timeline));
</script>

<!-- Outcome banner (safe / unsafe / incomplete) -->
<!-- Score bars (4 dimensions) -->
<!-- Key misses section:
     if keyMisses.length === 0: show "No critical misses -- clean run" positive callout
     else: show top 3 misses -->
<!-- Timeline (collapsible for long runs) -->
<!-- Competency + FAA tags grid -->
<!-- Action buttons: Try Again | Replay (Coming soon, disabled) | Continue -->
```

Empty `keyMisses` (clean run) renders a positive callout -- not an empty section. Per Emotional
Safety (Design Principle 6): reward good performance explicitly.

## Schema Changes Required

**`evidence_packet.scoreDimensions` jsonb column must be dropped.** `score_dimension` rows in the
`evidence.score_dimension` table are the single authoritative source. The jsonb column creates a
second source of truth with no sync guarantee. The debrief load function already queries rows via
`getOwnScoreDimensions`. Drop the column from schema.ts and the next `db push` removes it.

**`evidence_packet.actionsTaken` must be typed:**

```typescript
// libs/bc/evidence/src/schema.ts
actionsTaken: jsonb('actions_taken').notNull().$type<ActionTaken[]>(),
```

Where `ActionTaken` is imported from `@firc/types`.

## Constants Required

`ROUTES.SIM_DEBRIEF` is a function (not a bare string). Add to `libs/constants/src/routes.ts`:

```typescript
SIM_DEBRIEF: (id: string) => `/debrief/${id}` as const,
```

Existing `DEBRIEF: '/debrief'` bare string should be removed or renamed if unused. Grep for
`ROUTES.DEBRIEF` before removing.

`SCENARIO_OUTCOMES` must be defined in `libs/constants/src/engine.ts`:

```typescript
export const SCENARIO_OUTCOMES = {
  SAFE: "safe",
  UNSAFE: "unsafe",
  INCOMPLETE: "incomplete",
} as const;
```

## Key Decisions

**Why `evidence/learner.ts` not `evidence/read.ts`:** `read.ts` already exists with hangar
aggregate reads. Creating a collision would break existing hangar imports. `learner.ts` is a named
consumer module -- learner-scoped reads for sim.

**Why `getBestIntervention` in engine not app lib:** It operates on `Tick` (engine type) and
returns `InterventionLevel` (engine type). Engine helpers belong in `libs/engine/`. The timeline
builder remains in the app lib because it orchestrates presentation logic.

**Why `sumValues` in engine:** It operates on `Record<ScoreDimension, number>` -- engine-typed
data. Placing it in the app lib would mean importing engine types into the app in the wrong
direction.

**Why 403 not 404 for wrong-user access:** 404 leaks that the run exists. 403 reveals only that
the caller lacks access. `getOwnRun` enforces userId at the query level; a null result means either
not found or not owned -- the caller gets 404 either way, which is acceptable.

**Why drop `scoreDimensions` jsonb:** One source of truth. The rows table is queryable for ops
analytics (Phase 3). Two identical columns that must be kept in sync is a future bug.

**Why Replay is deferred:** Replay with inline annotations requires storing the full annotated
timeline server-side and re-rendering it. Phase 2 establishes the data model; replay uses it in
Phase 6. `replayHistory()` in the engine (see scenario-player design) makes this possible when
the time comes.
