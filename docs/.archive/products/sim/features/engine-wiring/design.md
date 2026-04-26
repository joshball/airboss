---
title: "Design: Engine Wiring"
product: sim
feature: engine-wiring
type: design
status: unread
---

# Design: Engine Wiring

## Key Finding: Already Built

The sim engine wiring was implemented in Phase 2 (Sim Core). This design doc documents the existing architecture for reference.

## Architecture

### Client-Side Engine (Pure Computation)

The tick engine runs entirely in the browser after the initial page load. No server round-trips during gameplay.

```
libs/engine/src/tick.ts
  initRun(script, startedAt) -> RunState
  getCurrentTick(state, script) -> Tick
  applyIntervention(state, script, level) -> RunState (new)
  isTerminal(state, script) -> boolean
  scoreRun(state) -> ScoreResult
  replayHistory(script, history, startedAt) -> RunState
```

RunState is immutable -- each `applyIntervention` returns a new state. History accumulates as an array of `ActionTaken` objects.

### Server-Side Validation (Trust Nothing)

When the player submits, the server replays the entire history from scratch using `replayHistory()`. It does NOT trust the client's scores or outcome -- it recomputes everything server-side. This prevents cheating.

The server then atomically:

1. Records the evidence (run, packet, score dimensions)
2. Updates enrollment progress (lesson attempt, module progress)
3. Logs FAA time per topic
4. Updates adaptive engine (spaced repetition, difficulty profiles)
5. Audits the action

### Published Content Pipeline

Sim reads from `published.*` schema, never from `course.*`. Content must be published through hangar's publish pipeline before sim can access it. This ensures sim never sees draft/unapproved content.

```
course.scenario (hangar) -> publish -> published.scenario (sim reads)
```

## Data Flow

```
DB (published.scenario.tickScript)
  -> +page.server.ts load() -> returns tickScript to client
  -> +page.svelte: initRun(tickScript) -> player loop
  -> user clicks intervention -> applyIntervention() -> new state
  -> terminal -> form POST with history JSON
  -> +page.server.ts complete action:
       replayHistory() -> scoreRun() -> record evidence
       -> update enrollment -> log time -> adaptive update -> audit
  -> redirect 303 to /debrief/{runId}
```

## Key Decisions

### Why client-side engine?

The engine is a pure state machine. Running it client-side means zero latency between ticks -- critical for the "Decisions Under Pressure" design principle. Server validates after the fact.

### Why replay on server?

Trust boundary. The client sends history (array of intervention choices), not scores. The server replays deterministically and computes its own scores. A tampered client can't inflate scores.

### Why sessionStorage for debrief?

Not used. The debrief page loads evidence data from the DB (recorded by the complete action). This is better than sessionStorage because it survives page refreshes and works across devices.

### Why published schema?

Per ADR 005 -- sim never sees drafts. Content authors can iterate freely in hangar without affecting live learners. Publishing is an atomic operation that creates a versioned snapshot.
