---
title: "Spec: Scenario Player"
product: sim
feature: scenario-player
type: spec
status: done
---

# Spec: Scenario Player

The flagship feature. A learner plays through a scripted scenario using the intervention ladder. Evidence is recorded. FAA time is logged.

## What It Does

A learner selects a scenario, reads a briefing, then plays through a tick-driven simulation. At each decision point they choose an intervention level. The engine scores each choice. On completion, it writes an evidence packet and redirects to debrief.

## Two Screens

### 1. Briefing (`/scenario/:id/brief`)

Shown before play begins:

- Scenario title and module context
- Situation setup (who is the student, what are the conditions, what flight segment)
- Objectives (what competencies are being exercised)
- Duration estimate
- "Call the Ball" button -- commits to starting the scenario

**"Call the Ball"** is borrowed from carrier aviation. It's the moment you commit to landing. Creates intentionality -- this isn't accidental play.

### 2. Player (`/scenario/:id`)

The simulation screen:

| Panel               | Content                                                     |
| ------------------- | ----------------------------------------------------------- |
| Scene               | Current situation description (what's happening)            |
| Student             | Student state and speech (what the student is doing/saying) |
| Intervention ladder | 5 options: Ask / Prompt / Coach / Direct / Take Controls    |
| Timer               | Countdown within current tick (visual pressure)             |
| Abort               | "Call it out" link -- exits and records incomplete run      |

## Tick Engine

The engine lives in `libs/engine/src/`. For Phase 2 it is **scripted** (pre-authored sequences), not adaptive.

### Tick Script Format

Defined in `@firc/types`:

```typescript
interface TickScript {
  ticks: Tick[];
}

interface Tick {
  id: string;
  scene: string; // Situation description
  studentSpeech: string; // What the student says/does
  studentState: StudentState; // Behind-the-scenes context
  safeWindow: InterventionLevel[]; // Intervention levels that score well here
  criticalWindow: InterventionLevel[]; // Min acceptable intervention (if no safe)
  consequences: Record<InterventionLevel, TickConsequence>;
}

interface TickConsequence {
  nextTickId: string | "terminal_safe" | "terminal_unsafe";
  scoreDelta: number; // +/- contribution to dimensions
  annotation: string; // Shown in debrief timeline
}

type InterventionLevel = "ask" | "prompt" | "coach" | "direct" | "take_controls";
type StudentState = "nominal" | "degrading" | "critical" | "recovered";
```

### Engine Functions (Phase 2)

```typescript
// libs/engine/src/tick.ts

export function initRun(script: TickScript): RunState;
export function getCurrentTick(state: RunState): Tick;
export function applyIntervention(state: RunState, level: InterventionLevel): RunState;
export function isTerminal(state: RunState): boolean;
export function getOutcome(state: RunState): "safe" | "unsafe" | "incomplete";
export function scoreRun(state: RunState): ScoreResult;
```

`RunState` is pure data (no I/O). Passed between client and server as needed. The engine never touches the DB.

## Scoring Dimensions

Each dimension answers a specific question about CFI performance. Scores accumulate across ticks -- good choices add points, poor choices subtract.

| Dimension   | Question                                            | High                                                 | Low                                                                 |
| ----------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Recognition | Did you see the problem before it became dangerous? | Identified early cues while there was time to teach. | Did not act until the situation was critical or too late.           |
| Judgment    | Did you match intervention to the severity?         | Used the right ladder level at each moment.          | Over-intervened when safe, or under-intervened when critical.       |
| Timing      | Did you act when your intervention could matter?    | Intervened while there was time to recover safely.   | Waited past the point where intervention could prevent the outcome. |
| Execution   | Did your intervention address the actual problem?   | Action directly corrected or prevented the hazard.   | Intervention was off-target -- did not address the actual threat.   |

Each tick contributes `scoreDelta` to relevant dimensions. Final score per dimension = earned / maximum possible. Displayed in debrief with the question and contextual feedback -- not just a bare percentage.

## Outcome

The outcome label communicates the student's safety, not the instructor's grade:

| Outcome      | Label           | Meaning                                               |
| ------------ | --------------- | ----------------------------------------------------- |
| `safe`       | Student Safe    | The instructor's interventions kept the student safe. |
| `unsafe`     | Student at Risk | The instructor's actions did not prevent the hazard.  |
| `incomplete` | Incomplete      | The scenario was not finished.                        |

**Note:** "SAFE" is not an acronym. It is the scenario outcome. The overall percentage is intentionally NOT shown -- the four dimension scores are the feedback. A single rolled-up percentage obscures what actually happened.

## Evidence Recording

On scenario completion (`/scenario/:id` POST to `/api/complete` or form action):

1. Write `evidence.scenario_run` (userId, scenarioId, releaseId, seed, outcome, score, duration)
2. Write `evidence.evidence_packet` (topicsCovered, competenciesExercised, actionsTaken, scoreDimensions)
3. Write `evidence.score_dimension` rows (one per dimension)
4. Write `enrollment.lesson_attempt` (linked to enrollment)
5. Log time: `enrollment.time_log` (duration, faaQualified=true, topic from scenario faaTopics[0])
6. Redirect to `/debrief/:runId`

## State Management

Run state lives **client-side** in `$state()` during play. Only written to DB on completion or abort.

On page unload before completion: the run is lost (no auto-save in Phase 2). A note in the UI warns: "Leaving this page will end your run."

## FAA Time

- Time is logged on completion only (not tracked live in Phase 2)
- `durationSeconds` = time between "Call the Ball" click and completion
- `faaQualified = true` for all Phase 2 scenarios
- Topic = first FAA topic in `scenario.faaTopics` array (multi-topic accounting deferred to Phase 5)

## Edge Cases

- Browser refresh during play -> run lost, returns to scenario briefing page
- Scenario not found (bad ID) -> 404
- No enrollment -> warn but allow (Phase 2: enrollment gate is advisory)
- `take_controls` used unnecessarily -> over-intervention penalty applied (shown in debrief)
- Run without any intervention -> terminal_unsafe outcome

## Patterns

- See `docs/agents/reference-engine-patterns.md` before implementing the tick loop
- Engine is pure computation -- no async, no DB, no side effects
- BCs handle all persistence (evidence/write, enrollment/write)
- Player component manages state with `$state()` + `$derived()`
