---
title: "Design: Scenario Player"
product: sim
feature: scenario-player
type: design
status: done
---

# Design: Scenario Player

**Design review required before implementation begins.** See WORKFLOW.md.

## Route Files

```text
apps/sim/src/routes/(app)/
  scenario/
    [id]/
      brief/
        +page.svelte          -- briefing screen
        +page.server.ts       -- load scenario from published content (id = slug)
      +page.svelte            -- player screen (client-heavy)
      +page.server.ts         -- load scenario + student model; complete action
```

`[id]` is the published scenario slug (e.g., `loc-base-to-final`). Per ADR-010, the load
function resolves slug -> synthetic ID for all FK lookups.

## Engine Implementation

**`libs/engine/src/tick.ts`** replaces the current placeholder. Pure functions only -- no I/O.

### Types (in `@firc/types/src/schemas/engine.ts`)

```typescript
export interface TickScript {
  ticks: Tick[];
}

export interface Tick {
  id: string;
  scene: string;
  studentSpeech: string;
  studentState: "nominal" | "degrading" | "critical" | "recovered";
  safeWindow: InterventionLevel[];
  criticalWindow: InterventionLevel[];
  consequences: Record<InterventionLevel, TickConsequence>;
}

export interface TickConsequence {
  nextTickId: string | "terminal_safe" | "terminal_unsafe";
  scoreDelta: Record<ScoreDimension, number>;
  annotation: string;
}

export type InterventionLevel = "ask" | "prompt" | "coach" | "direct" | "take_controls";
export type ScoreDimension = "recognition" | "judgment" | "timing" | "execution";

// ActionTaken is the shape written to evidence_packet.actionsTaken
export interface ActionTaken {
  tickId: string;
  intervention: InterventionLevel | null; // null on terminal tick (no intervention made)
  timestamp: number;
}

export interface RunState {
  scriptId: string;
  currentTickId: string;
  history: ActionTaken[];
  scores: Record<ScoreDimension, number>;
  maxScores: Record<ScoreDimension, number>;
  startedAt: number; // unix ms
  tickTimestamps: number[]; // ms per tick -- used for engagement timing / bot detection
}

export interface ScoreResult {
  dimensions: Record<ScoreDimension, { score: number; max: number }>;
  overall: number; // 0-1
  outcome: "safe" | "unsafe" | "incomplete";
}
```

### Engine Functions

```typescript
// libs/engine/src/tick.ts
export function initRun(script: TickScript, startedAt: number): RunState;
export function getCurrentTick(state: RunState, script: TickScript): Tick;
export function applyIntervention(state: RunState, script: TickScript, level: InterventionLevel): RunState;
export function isTerminal(state: RunState, script: TickScript): boolean;
export function scoreRun(state: RunState): ScoreResult;
export function getBestIntervention(tick: Tick): InterventionLevel | null; // used by debrief
```

`getBestIntervention` belongs in the engine (pure computation on engine types), not in the app lib.

### Replay History

```typescript
// libs/engine/src/tick.ts
export function replayHistory(script: TickScript, history: ActionTaken[]): RunState;
```

Reconstructs a `RunState` from a stored history array. Used by the debrief timeline builder and
FAA evidence verification. Required for audit integrity -- the server must be able to independently
reproduce the run from stored history.

## Player Component

**Client-side state drives the UI.** No server calls during play.

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();  // { scenario, studentModel, enrollment }

  let runState = $state(initRun(data.scenario.tickScript, Date.now()));
  let currentTick = $derived(getCurrentTick(runState, data.scenario.tickScript));
  let terminal = $derived(isTerminal(runState, data.scenario.tickScript));
</script>

{#if terminal}
  <form method="POST" action="?/complete">
    <!-- hidden: serialized runState -->
    <!-- auto-submits on render -->
  </form>
{:else}
  <!-- Scene panel -->
  <!-- Student panel -->
  <!-- Intervention ladder -->
{/if}
```

**Intervention selection:** clicking a ladder button calls `applyIntervention()`, updates `runState`.
No server round-trip. When terminal, form auto-submits.

## Intervention Ladder UI

Five buttons, always visible in the same order:

| Label         | Level           | Icon hint       |
| ------------- | --------------- | --------------- |
| Ask           | `ask`           | Question mark   |
| Prompt        | `prompt`        | Nudge arrow     |
| Coach         | `coach`         | Speech bubble   |
| Direct        | `direct`        | Command chevron |
| Take Controls | `take_controls` | Hands icon      |

- Buttons are always enabled (no graying out -- player decides the ladder level)
- No "correct" highlighting until debrief
- Timer shows seconds elapsed in tick (visual pressure; no hard cutoff in Phase 2)

## Server Load + Complete Action

```typescript
// +page.server.ts
export const load = async (event) => {
  const user = requireAuth(event);
  const release = await courseRead.getLatestRelease();
  // ADR-010: params.id is a slug; resolve to synthetic ID for all FK lookups
  const scenario = await courseRead.getPublishedScenarioBySlug(release.id, event.params.id);
  if (!scenario) error(404);

  const studentModel = await courseRead.getPublishedStudentModel(release.id, scenario.studentModelId);
  const enrollment = await enrollmentRead.getOwnEnrollment(user.id);
  return { scenario, studentModel, enrollment };
};

export const actions = {
  complete: async (event) => {
    const user = requireAuth(event);
    const data = await event.request.formData();

    // Validate run state shape before trusting it
    const runStateResult = runStateSchema.safeParse(JSON.parse(data.get("runState") as string));
    if (!runStateResult.success) return fail(400, { error: "Invalid run state" });

    const runState = runStateResult.data;
    const scenarioId = data.get("scenarioId") as string; // synthetic ID, not slug
    const releaseId = data.get("releaseId") as string;
    const enrollmentId = data.get("enrollmentId") as string;

    // Server independently scores -- never trust client score
    const result = scoreRun(runState);
    const runId = generateRunId(); // Tier B ULID: run_01jvxyz...

    // Engagement integrity: minimum plausible time check
    const totalMs = runState.tickTimestamps.reduce((a, b) => a + b, 0);
    const minPlausibleMs = runState.history.length * 3000; // 3s minimum per tick
    const afkSuspected = runState.tickTimestamps.some((t) => t > 120_000); // >2min on one tick

    await evidenceWrite.recordScenarioRun({
      id: runId,
      userId: user.id,
      scenarioId,
      releaseId,
      seed: runId, // deterministic replay seed
      outcome: result.outcome,
      score: result.overall,
      durationSeconds: Math.round(totalMs / 1000),
      startedAt: new Date(runState.startedAt),
      completedAt: new Date(),
    });

    await evidenceWrite.recordEvidencePacket({
      id: generatePacketId(),
      runId,
      actionsTaken: runState.history,
      afkSuspected,
      tooFast: totalMs < minPlausibleMs,
      // ... other fields
    });

    await enrollmentWrite.logTime({
      id: generateTimeLogId(),
      enrollmentId,
      sessionId: runId, // sessionId = runId per ADR-010 decision
      faaQualified: true,
      durationSeconds: Math.round(totalMs / 1000),
      topic: scenario.faaTopic,
      startedAt: new Date(runState.startedAt),
    });

    redirect(303, ROUTES.SIM_DEBRIEF(runId));
  },
};
```

## Demo Scenario Seed

The E2E seed script (`scripts/db/seed-e2e-demo.ts`, run automatically by `bun db reset`) adds:

- One student model with basic parameters
- One scenario with a complete tick script (5-8 ticks covering base-to-final approach)
- The scenario assigned to Module 3 (LOC)
- Scenario published with slug `loc-base-to-final`

This allows testing the player without waiting for C1 scenario scripts.

## Constants Required

```typescript
// libs/constants/src/engine.ts (new file)
export const INTERVENTION_LEVELS = {
  ASK: "ask",
  PROMPT: "prompt",
  COACH: "coach",
  DIRECT: "direct",
  TAKE_CONTROLS: "take_controls",
} as const;

export const INTERVENTION_LABELS: Record<InterventionLevel, string> = {
  ask: "Ask",
  prompt: "Prompt",
  coach: "Coach",
  direct: "Direct",
  take_controls: "Take Controls",
};

export const SCORE_DIMENSIONS = {
  RECOGNITION: "recognition",
  JUDGMENT: "judgment",
  TIMING: "timing",
  EXECUTION: "execution",
} as const;

export const SCENARIO_OUTCOMES = {
  SAFE: "safe",
  UNSAFE: "unsafe",
  INCOMPLETE: "incomplete",
} as const;
```

## Key Decisions

**Why client-side state for run:** Server-side tick loop requires round-trips per tick, adding
latency and complexity. Client state is simpler and faster. Trade-off: no auto-save -- acceptable
for Phase 2.

**Why scripted not adaptive:** C1 scripts don't exist yet. Scripted engine validates the data model.
Adaptive engine (Phase 6) replaces the internals without changing the interface.

**Why sessionId = runId:** A "session" for FAA time logging is a scenario run. The run ID is
permanent, immutable, and traceable. Per ADR-010 decision.

**Why Zod on complete action:** Client-submitted run state is untrusted. Zod validates shape before
any scoring or DB writes. Server independently scores -- never uses client-supplied score.

**Why tickTimestamps in RunState:** Required for bot/AFK detection. Timing data is part of the
evidence packet. See sim PRD non-functional requirements.

**Why `take_controls` can score badly:** Over-intervention is a real instructor problem. The system
does not reward reflexive takeover. Embodies "Never a Trick" and "Decisions Under Pressure."
