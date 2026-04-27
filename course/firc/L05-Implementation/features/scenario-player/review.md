---
title: "Design Review: Scenario Player"
product: sim
feature: scenario-player
type: review
status: done
review_status: done
---

# Design Review: Scenario Player

**Reviewer:** Design Review Agent
**Date:** 2026-03-27
**Status:** Approved with changes

---

## Summary

The scenario-player design is architecturally sound. The engine-as-pure-computation pattern is correct, the BC access matrix is respected, and the client-side state model is an appropriate Phase 2 trade-off. However, there are three issues that must be addressed before implementation begins: a critical security gap in the `complete` action that allows score fabrication, a schema mismatch between what the design plans to write and what `enrollment.time_log` actually requires, and missing sim-specific route constants that the design already references. Two medium findings address an untyped `tickScript` JSONB field and missing Zod validation in the form action.

---

## Findings

### [CRITICAL] `complete` action trusts client-supplied `runState` for scoring

**File:** `design.md` -- "Server Load + Complete Action" section

The design calls `scoreRun(runState)` where `runState` is parsed directly from form body JSON:

```typescript
const runState: RunState = JSON.parse(data.get("runState") as string);
const result = scoreRun(runState);
```

A malicious user can POST a crafted `runState` with arbitrary `scores` values, fabricating a perfect score with zero effort. Because the run state is a plain JSON blob the engine will process without question, there is no server-side verification that the history matches any actual scenario choices.

**What to do instead:**

Store only the tick-choice history in `runState.history` on the client (which is already in the `RunState` type). On the server, re-derive scores by replaying the history against the loaded scenario script:

```typescript
// complete action -- server side
const { history, startedAt, scriptId } = JSON.parse(data.get("runState") as string);
// Load the authoritative script from published content (already loaded in `load`)
const replayedState = replayHistory(data.scenario.tickScript, history, startedAt);
const result = scoreRun(replayedState);
```

This requires adding a `replayHistory(script, history, startedAt): RunState` engine function that takes a sequence of tick choices, runs them through `applyIntervention` in order, and produces a `RunState` from the server-side script. The client history entries (`{ tickId, intervention, timestamp }`) are low-value to forge since scores are re-derived server-side.

Alternatively, if Phase 2 is explicitly pre-prod and score integrity is not a concern yet, this must be documented as a known limitation in `spec.md` and a `TEMP_FIXES.md` entry created. Do not silently accept it.

---

### [CRITICAL] `enrollmentId` sourced from form body, not server session

**File:** `design.md` -- complete action pseudocode

```typescript
const enrollmentId = data.get('enrollmentId') as string;
await enrollmentWrite.logTime({ enrollmentId, ... });
```

`enrollmentId` is client-supplied. A user can substitute any enrollment ID and log time against another learner's FAA record. This directly violates the scoping contract in `libs/bc/enrollment/src/write.ts`:

> NEVER pass a userId from URL/route params, form data or request bodies, or any client-supplied source. Violation breaks the per-learner isolation guarantee and corrupts FAA audit records.

The enrollment is already loaded from the server session in `load()` via `enrollmentWrite.getOwnEnrollment(user.id)`. The `complete` action must re-derive it the same way -- call `getOwnEnrollment(user.id)` in the action, not read it from form data.

---

### [HIGH] `enrollment.time_log` requires `sessionId` -- not addressed in design

**File:** `libs/bc/enrollment/src/schema.ts` line 54

The `time_log` table has a `sessionId text NOT NULL` column. The design's `complete` action pseudocode does not supply this field:

```typescript
await enrollmentWrite.logTime({ enrollmentId, durationSeconds: ..., faaQualified: true, ... });
```

This will fail at runtime with a DB constraint error.

**What to do instead:** Define what a `sessionId` represents for a scenario run. Options:

1. Use the `runId` (already generated in the action) as `sessionId` -- each scenario run is its own session.
2. Generate a session ID at "Call the Ball" time, pass it as a hidden form field alongside the history.

Option 1 is simpler. If chosen, update the spec to document the convention: "for scenario runs, `sessionId` = `runId`."

---

### [HIGH] `tickScript` JSONB is untyped in `published.scenario` -- engine receives `unknown`

**File:** `libs/bc/course/src/schema.ts` line 109

```typescript
tickScript: jsonb('tick_script').notNull(),
```

There is no `.$type<TickScript>()` annotation. The `getPublishedScenarios()` read function returns `tickScript` as `unknown`. When `data.scenario.tickScript` is passed to `initRun()` or `applyIntervention()` in the player component, TypeScript will not catch shape mismatches.

**What to do instead:** Add the type annotation to the schema:

```typescript
tickScript: jsonb('tick_script').notNull().$type<TickScript>(),
```

And import `TickScript` from `@firc/types` once the engine types are defined (Task 1). This is safe to do now since the column already exists -- it's a TS-level annotation, not a migration.

The same pattern is already used for `competencies` and `faaTopics` on the same table.

---

### [HIGH] Sim-specific route constants missing from `libs/constants/src/routes.ts`

**File:** `design.md` -- "Constants Required" and `libs/constants/src/routes.ts`

The design references `ROUTES.SIM_SCENARIO(id)`, `ROUTES.SIM_SCENARIO_BRIEF(id)`, and `ROUTES.SIM_DEBRIEF(runId)` in the `complete` action redirect. The current `routes.ts` has only bare string constants for sim routes (`SCENARIO: '/scenario'`, `DEBRIEF: '/debrief'`) -- no parameterized functions.

This means the implementation will either hardcode strings (violating the no-magic-strings rule) or the developer will need to define these constants. The design doc even lists this as a task ("Constants Required") but does not add the route functions.

**What to do instead:** Add these to `libs/constants/src/routes.ts` as part of Task 1 (or as its own task before Task 5):

```typescript
SIM_SCENARIO: (id: string) => `/scenario/${id}` as const,
SIM_SCENARIO_BRIEF: (id: string) => `/scenario/${id}/brief` as const,
SIM_DEBRIEF: (runId: string) => `/debrief/${runId}` as const,
```

---

### [MEDIUM] No Zod validation of form body in `complete` action

**File:** `design.md` -- complete action, `docs/agents/best-practices.md`

The complete action parses form body with bare casts:

```typescript
const runState: RunState = JSON.parse(data.get("runState") as string);
const scenarioId = data.get("scenarioId") as string;
```

Per `best-practices.md`, form actions must validate with `zod.safeParse()`. If `runState` is malformed JSON, this throws a 500 with no user-facing error. If `scenarioId` is missing, a null is silently passed to the DB write.

**What to do instead:** Define a Zod schema for the complete action's form body and validate before proceeding. The `RunState` type should have a corresponding `runStateSchema` in `libs/types/src/schemas/engine.ts` alongside the interface. The `complete` action uses `safeParse` and returns `fail(400, ...)` on invalid input.

---

### [MEDIUM] `correctAnswer` exposed in server -> client data flow for questions (pattern gap)

**File:** `libs/bc/course/src/read.ts` lines 35-38

The `getPublishedQuestions()` function returns the full `publishedQuestion` row including `correctAnswer`. The comment warns "server-only. Never send to client" but there is no structural enforcement -- it's convention only. While the scenario player does not use questions directly, this is the same `courseRead` module used in the load function.

This is not a blocking concern for Phase 2 (the player doesn't load questions), but the pattern is fragile. A future developer adding a knowledge check to the player screen could accidentally pass the full `publishedQuestion` row to `data`.

**What to do instead:** Create a `getPublishedQuestionsForClient()` variant in `read.ts` that selects all columns except `correctAnswer`, and deprecate the full-row function for client-facing use. This enforces the "server-only" constraint structurally rather than by comment.

---

### [LOW] `durationSeconds` calculation relies on client-supplied `startedAt`

**File:** `design.md` -- `RunState` type, spec.md FAA Time section

`RunState.startedAt` is set at `Date.now()` when `initRun()` is called on the client. The `complete` action will compute `durationSeconds` from this value. A client can manipulate `startedAt` to inflate logged FAA time.

For Phase 2 this is acceptable -- the system is pre-production and inflation of one's own FAA hours has limited attack surface. However, it must be explicitly documented.

**What to do instead (Phase 2):** Document in `spec.md` that duration is client-reported and should be treated as approximate. Add a cap: server should reject runs where `durationSeconds > scenario.duration * 2` (obvious inflation) or `durationSeconds < 30` (impossible to complete). Add a `TEMP_FIXES.md` entry flagging this for Phase 5 (server-authoritative timing via server-set `startedAt` returned from the "Call the Ball" action).

---

### [LOW] `abort` action not defined in evidence schema

**File:** `tasks.md` Task 8, `spec.md` Edge Cases section, `libs/bc/evidence/src/schema.ts`

The spec says abort records an "incomplete run." `evidence.scenario_run` has an `outcome` column (`text NOT NULL`) and a nullable `completedAt`. An aborted run needs an outcome value -- `'incomplete'` is the obvious choice but it must be defined as a constant (not a magic string). The `scoreRun()` return type already includes `outcome: 'safe' | 'unsafe' | 'incomplete'`, so this is consistent.

**What to do instead:** Confirm `'incomplete'` is added to the `INTERVENTION_LEVELS` / outcome constants, and that the abort action uses the constant, not the string literal.

---

### [LOW] `getPublishedScenarios` loads all scenarios for the release, not one by ID

**File:** `design.md` -- load function

```typescript
const scenarios = await courseRead.getPublishedScenarios(release.id);
const scenario = scenarios.find((s) => s.id === params.id);
if (!scenario) error(404);
```

This loads the full scenario set into memory on every scenario page load to find one by ID. For Phase 2 this is fine (small content set), but `read.ts` should eventually expose a `getPublishedScenario(releaseId, scenarioId)` function. Document as a known limitation.

---

## Approved Items

- **Engine purity.** The design correctly confines the tick engine to pure computation with no I/O, no DB access, and no side effects. The BC persistence pattern (engine -> form action -> BC write) follows ADR 002.
- **`userId` from `requireAuth(locals)`.** The complete action derives `userId` from `requireAuth(locals).id`, never from form data. This is correct.
- **`releaseId` from loaded scenario.** `releaseId` comes from the server-loaded `data.scenario.releaseId`, not from the form body. Correct.
- **Published schema isolation.** The load function uses `@firc/bc/course/read` (published tables), not `@firc/bc/course/manage`. Correct per ADR 002 and ADR 005.
- **SSR disabled for sim.** The design inherits the sim app's `ssr = false` setting, eliminating hydration mismatches in a client-heavy component. Correct per `best-practices.md`.
- **`RunState` serializable.** The `RunState` type is a plain data structure (no functions, no class instances, no `Date` objects -- just numbers, strings, and arrays). Correct.
- **Timer is visual only.** The countdown timer is display-only with no server-side timing or hard cutoff. Consistent with design principles and correctly documented.
- **No `correctAnswer` exposure in scenario player.** The player screen loads `publishedScenario` (no questions) and the engine types contain no answer keys. The scenario tick script's `safeWindow`/`criticalWindow` fields are intervention levels, not answers.
- **`over-intervention` as a judgment error.** The design correctly scores `take_controls` in the safe window (not always best) and flags premature takeover as a penalty. Embodies "Never a Trick" and "Decisions Under Pressure" principles.
- **Constants file for engine.** The `libs/constants/src/engine.ts` plan is correct -- `INTERVENTION_LEVELS` and `SCORE_DIMENSIONS` as constant objects with `as const`. No magic strings in engine logic.
- **Debrief redirect on failure.** Bad outcomes redirect to `/debrief/:runId`, not an error page. Correct embodiment of "Emotional Safety" and "Debrief Culture" principles.
- **`TickConsequence.scoreDelta` is per-dimension.** The design corrects the spec (which showed `scoreDelta: number` on `TickConsequence`) to `scoreDelta: Record<ScoreDimension, number>`. This is necessary for multi-dimensional scoring and the correction is sound.
- **Schema namespace compliance.** `evidence.*` and `enrollment.*` namespaces are used correctly per ADR 004.
- **BC access matrix compliance.** `sim` uses `bc/evidence/write` and `bc/enrollment/write` (write access) and `bc/course/read` (read access). No violations of the access matrix from ADR 002.
- **Vitest unit tests for engine.** Task 3 requires unit tests for all engine functions before the screen is built. This is the right order.

---

## Decision

**Approved with changes.** Implementation may not begin until the following are resolved:

1. **[CRITICAL]** Server-side score recomputation from `runState.history` -- or explicit documentation of the Phase 2 limitation in `spec.md` and `TEMP_FIXES.md` with a concrete plan for Phase 5.
2. **[CRITICAL]** `enrollmentId` must come from `getOwnEnrollment(user.id)` in the action, not from form body.
3. **[HIGH]** `sessionId` for `time_log` -- define the convention and add it to the spec before Task 7.
4. **[HIGH]** `tickScript` JSONB column typed with `.$type<TickScript>()` -- add to schema as part of Task 1.
5. **[HIGH]** Sim route constants (`SIM_SCENARIO`, `SIM_SCENARIO_BRIEF`, `SIM_DEBRIEF`) added to `libs/constants/src/routes.ts` before Task 5.

Items 3, 4, and 5 are small -- they can be addressed during Task 1 (engine types) without blocking anything. Items 1 and 2 require a design decision before the `complete` action is written (Task 6/7).

## Fix Log (2026-03-28)

- [CRITICAL] `complete` action trusts client-supplied `runState` for scoring -- verified fixed (pre-existing)
- [CRITICAL] `enrollmentId` sourced from form body, not server session -- verified fixed (pre-existing)
- [HIGH] `time_log` requires `sessionId` -- not addressed in design -- verified fixed (pre-existing)
- [HIGH] `tickScript` JSONB untyped in published schema -- verified fixed (pre-existing)
- [HIGH] Sim route constants missing from `libs/constants/src/routes.ts` -- verified fixed (pre-existing)
- [MEDIUM] No Zod validation of form body in `complete` action -- verified fixed (pre-existing)
- [MEDIUM] `correctAnswer` exposed in server -> client data flow -- accepted, Phase 2 appropriate (server-only, player doesn't use)
- [LOW] `durationSeconds` relies on client-supplied `startedAt` -- accepted, Phase 2 appropriate (replay-derived duration mitigates)
- [LOW] `abort` action -- `incomplete` outcome not defined as constant -- verified fixed (pre-existing)
- [LOW] `getPublishedScenarios` loads all scenarios to find one by ID -- accepted, Phase 2 appropriate (small content set)
