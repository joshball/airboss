---
title: "Design Review: Debrief"
product: sim
feature: debrief
type: review
status: done
review_status: done
---

# Design Review: Debrief

**Reviewer:** Design Review Agent
**Date:** 2026-03-27
**Status:** Approved with changes

## Summary

The debrief design is solid in structure and intent. It correctly reads from existing evidence tables with no new schema, applies NTSB framing throughout, and handles the key edge cases. Three issues need to be resolved before implementation begins: (1) the design proposes creating `libs/bc/evidence/src/read.ts` for user-scoped reads, but that file already exists -- with a different purpose (hangar aggregate reads); this creates a direct access-level collision that must be resolved cleanly. (2) `actionsTaken` in `evidence_packet` is typed as bare `jsonb` with no `$type<>` annotation, meaning the timeline builder has no schema contract to rely on. (3) `sumValues()` is used in the key-misses extraction but is not defined anywhere in the design -- it needs a home. The remaining findings are medium or low.

---

## Findings

### CRITICAL: `evidence/read.ts` already exists with a different purpose

`libs/bc/evidence/src/read.ts` already exists and is already exported from `libs/bc/evidence/src/index.ts` as `read`. Its current functions (`getRunsForScenario`, `getEvidenceForRun`) are aggregate/hangar-facing reads -- they are not user-scoped and do not enforce userId ownership.

The design recommends adding user-scoped functions to a new `read.ts`, but that file is already taken. Two paths forward:

**Option A (recommended):** Add a fourth access level file: `libs/bc/evidence/src/learner.ts` exporting user-scoped functions (`getOwnRun`, `getOwnEvidencePacket`, `getOwnScoreDimensions`). Export it from `index.ts` as `learner`. This cleanly separates the two consumers (hangar aggregate reads vs. sim per-user reads) without touching existing code. ADR 002 defines three access levels but nothing bars a named consumer module -- `learner` is a recognized consumer in the architecture.

**Option B:** Add the user-scoped functions to the existing `manage.ts` under a clearly named block, and enforce userId in the load function (as the design currently does for Phase 2). This is weaker -- it conflates ops-level access with learner-scoped access.

Resolution: implement Option A. Update `index.ts` to export `learner`, update the debrief design.md to import from `@firc/bc/evidence/learner`, and update tasks.md accordingly.

---

### HIGH: `actionsTaken` has no typed schema contract

`evidence_packet.actionsTaken` is declared as bare `jsonb` in `schema.ts` (no `$type<>` annotation). The scenario player design shows `RunState.history` as:

```typescript
history: Array<{ tickId: string; intervention: InterventionLevel | null; timestamp: number }>;
```

But the debrief design's timeline builder assumes `actionsTaken` has the shape:

```typescript
Array<{ tickId: string; intervention: InterventionLevel; timestamp: number }>;
```

These are not the same: `history` allows `intervention: null` (for the terminal tick where no intervention was made), but the timeline builder uses `action.intervention` directly to look up `tick.consequences[action.intervention]`. A null intervention would produce a runtime error.

Required actions:

1. Add `$type<Array<{ tickId: string; intervention: InterventionLevel | null; timestamp: number }>>()` to `actionsTaken` in `schema.ts`. This matches the writer's shape.
2. In `buildTimeline()`, guard against `action.intervention === null` -- skip or mark terminal ticks as "Run ended" entries rather than attempting a consequence lookup.
3. Define the `ActionTaken` type in `libs/types/src/schemas/engine.ts` (alongside the other engine types that will live there) and reference it from both the schema and the timeline builder.

---

### HIGH: `sumValues()` is undefined -- no home, no type

The key-misses extraction uses `sumValues(entry.scoreDelta)` twice but the function is never defined in the design. `entry.scoreDelta` is `Record<ScoreDimension, number>` (from `TickConsequence`). This is a pure computation on engine types.

This function belongs in `libs/engine/src/` or a shared utility alongside the other score helpers -- not in `apps/sim/src/$lib/debrief.ts`. Reasoning: it operates on engine-typed data (`ScoreDimension`), and placing it in the app lib would mean duplicating or importing engine types into the app, which is the wrong direction.

Resolution: define `sumValues(dims: Partial<Record<ScoreDimension, number>>): number` in `libs/engine/src/score.ts` (new file alongside the existing tick.ts placeholder) and export it from the engine lib index. The debrief timeline builder then imports it via `@firc/engine`.

---

### MEDIUM: `ROUTES.SIM_DEBRIEF` does not exist -- `ROUTES.DEBRIEF` does, but is a static string

`routes.ts` has `DEBRIEF: '/debrief'` as a plain string. The design calls for `ROUTES.SIM_DEBRIEF: (id: string) => \`/debrief/${id}\`` (a function).

Two issues:

1. The existing `DEBRIEF` constant can't be used for parameterized links without string concatenation, which is exactly what constants are supposed to prevent.
2. The design uses `SIM_DEBRIEF` to namespace it to sim, which is correct -- other apps shouldn't route to `/debrief/:runId`.

Resolution: rename `DEBRIEF` to `SIM_DEBRIEF` and change it to a function: `SIM_DEBRIEF: (id: string) => \`/debrief/${id}\` as const`. Grep for any existing `ROUTES.DEBRIEF` usage and update before committing.

---

### MEDIUM: `getBestIntervention(tick)` belongs in the engine, not the app lib

The design places `getBestIntervention` in `apps/sim/src/$lib/debrief.ts`. This function operates on a `Tick` (engine type) and returns an `InterventionLevel` (engine type). It is pure computation over engine data.

Per ADR 002 and the thin-apps rule: "if you're writing business logic in an `apps/` directory -- stop and put it in a lib." Engine helpers belong in `libs/engine/src/`.

Resolution: add `getBestIntervention(tick: Tick): InterventionLevel | null` to `libs/engine/src/tick.ts` (once implemented) alongside the other engine functions. `buildTimeline()` can remain in the app lib since it orchestrates presentation logic, but it should call `getBestIntervention` from `@firc/engine`.

---

### MEDIUM: "Key misses" extraction has undefined behavior when all deltas are positive

The key-misses filter is `.filter(entry => sumValues(entry.scoreDelta) < 0)`. If the learner chose optimally on every tick, no entries pass the filter and `keyMisses` is an empty array. The design does not specify what to render in this case.

This is not just an edge case -- it is the success path for a proficient learner. "Key misses" with no items should still render something meaningful rather than an empty section.

Resolution: add a spec entry and a UI state for this: if `keyMisses.length === 0`, show a positive callout ("No critical misses -- clean run"). This aligns with Emotional Safety (principle 6): reward good performance explicitly rather than silently showing nothing.

---

### MEDIUM: `scoreDimensions` is redundant in the load function

The load function fetches `dimensions` from `getScoreDimensions(runId)` (rows from `evidence.score_dimension`), but `evidence_packet.scoreDimensions` is also a jsonb column that stores dimension data. The design uses the row table for the score bars, which is correct for structured queries, but `packet.scoreDimensions` is never used in the design.

This creates ambiguity: why does `evidence_packet` have a `scoreDimensions` jsonb column if the authoritative data lives in `score_dimension` rows?

Resolution: clarify in the design which is authoritative. If `score_dimension` rows are authoritative (recommended -- they are queryable and typed), document that `evidence_packet.scoreDimensions` is a denormalized cache for fast read-only access (and note when it's written vs. when rows are written). If they're always kept in sync, remove the ambiguity from the design before implementation creates two sources of truth.

---

### LOW: `incomplete` outcome is missing from the spec's outcome table

`spec.md` lists three outcomes in the outcome banner table (safe, unsafe, incomplete) but `scenario_run.outcome` is untyped (`text` with no constraint). The engine types in `scenario-player/design.md` show `outcome: 'safe' | 'unsafe' | 'incomplete'`.

`COURSE_STATUS`, `FAA_STATUS`, and `RELEASE_SIGNIFICANCE` all use constants from `libs/constants/`. Outcome values should follow the same pattern.

Resolution: add `SCENARIO_OUTCOMES` to `libs/constants/src/engine.ts` (which the scenario-player design already calls for but which does not yet exist) alongside `INTERVENTION_LEVELS` and `SCORE_DIMENSIONS`. Use this constant in the schema `$type<>` annotation and in the debrief banner logic.

---

### LOW: `courseRead.getPublishedScenarios` + `find()` could be replaced with a direct lookup

The load function fetches all published scenarios for a release, then finds the matching one with `.find()`. For a release with many scenarios, this is inefficient and unnecessary.

Resolution: if `courseRead.getPublishedScenario(releaseId, scenarioId)` exists or can be added, use it. If not, add it as part of this feature -- single-scenario lookup is a common access pattern that will be needed again.

---

### LOW: No `test-plan.md` in the feature directory

Per WORKFLOW.md: "Nothing merges without a manual test plan." The debrief feature directory has `spec.md`, `user-stories.md`, `design.md`, and `tasks.md` but no `test-plan.md`. Tasks.md references it (`Full manual test per \`test-plan.md\``) without it existing.

Resolution: write `test-plan.md` before or during implementation, not after. Add it to the pre-flight checklist in `tasks.md`.

---

## Approved items

- **No new tables.** Debrief is correctly designed as a read-only view over existing evidence data.
- **403 not 404 for wrong-user access.** Correctly specified in both spec.md and design.md -- prevents leaking run existence.
- **`requireAuth` pattern.** Load function uses `requireAuth(locals)` and captures the result, consistent with best-practices.md.
- **Graceful degradation for missing scenario.** `scenario?.tickScript?.ticks.find(...)` with fallback `'[scene unavailable]'` handles deleted published content correctly.
- **Graceful degradation for missing packet.** Spec calls for "Detailed breakdown unavailable" state -- correctly specified.
- **Replay deferred cleanly.** "Coming soon" disabled button is the right call. Replay with annotations is a Phase 6 concern; deferral is documented with rationale.
- **Emotional Safety framing.** "Student at risk" not "You failed." "Earlier coaching" not "You were wrong." All outcome copy avoids shame framing. Consistent with Design Principle 6.
- **NTSB framing.** "Chain of events" language throughout the spec and copy examples. Consistent with Design Principle 1.
- **No correct-answer exposure.** The design only shows the learner's chosen intervention and the "better" alternative -- it does not expose the internal scoring formula or the full consequences map. Consistent with "Two Systems, Layered" (Principle 2).
- **Timeline uses `annotation` from `TickConsequence`.** This is the right source -- annotations are authored text, not derived scoring internals.
- **`$derived()` for timeline and keyMisses.** Component correctly uses `$derived()` not `$:` for computed values from props.
- **Schema namespaces.** Reads from `evidence.*` namespace -- consistent with ADR 004.
- **`Promise.all` for parallel fetches.** Packet and dimensions are fetched in parallel -- correct.
- **`ROUTES.SIM_DEBRIEF` defined before use.** Design specifies adding to constants before wiring the route. Consistent with best-practices.md constants rule.
- **FAA tags section.** `topicsCovered` and `competenciesExercised` from evidence packet are surfaced to the learner. Satisfies FAA compliance user story and supports traceability.

---

## Decision

**Approved with changes.** The following must be resolved before implementation begins:

1. **`evidence/read.ts` collision** -- create `libs/bc/evidence/src/learner.ts` instead of overwriting the existing read.ts. Update index.ts, design.md, and tasks.md.
2. **`actionsTaken` schema contract** -- add `$type<>` annotation to `evidencePacket.actionsTaken` in schema.ts. Define the type in `libs/types/`. Guard against `intervention: null` in `buildTimeline()`.
3. **`sumValues` location** -- define in `libs/engine/src/score.ts`, export from engine lib, import via `@firc/engine` in the timeline builder.

Items 4-7 (medium findings) should be addressed during implementation:

4. Rename `ROUTES.DEBRIEF` to `ROUTES.SIM_DEBRIEF` (function form) and update all callsites.
5. Move `getBestIntervention` to `libs/engine/src/tick.ts`.
6. Add empty-keyMisses UI state to spec and component.
7. Clarify `scoreDimensions` jsonb vs. `score_dimension` rows -- document which is authoritative.

Items 8-10 (low findings) are non-blocking but must be completed before merge:

8. Add `SCENARIO_OUTCOMES` to `libs/constants/src/engine.ts`.
9. Add `getPublishedScenario(releaseId, scenarioId)` single-lookup to `bc/course/read`.
10. Write `test-plan.md` before implementation is complete.

## Fix Log (2026-03-28)

- [CRITICAL] `evidence/read.ts` collision -- verified fixed (pre-existing)
- [HIGH] `actionsTaken` has no typed schema contract -- verified fixed (pre-existing)
- [HIGH] `sumValues()` undefined -- no home, no type -- fixed in 667e943
- [MEDIUM] `ROUTES.SIM_DEBRIEF` does not exist -- verified fixed (pre-existing)
- [MEDIUM] `getBestIntervention(tick)` belongs in engine, not app lib -- verified fixed (pre-existing)
- [MEDIUM] Key misses -- undefined behavior when all deltas positive -- verified fixed (pre-existing)
- [MEDIUM] `scoreDimensions` jsonb redundant with `score_dimension` rows -- verified fixed (pre-existing, column never existed)
- [LOW] `incomplete` outcome missing from constants -- verified fixed (pre-existing)
- [LOW] `getPublishedScenarios` + `find()` inefficient -- fixed in 9295500
- [LOW] No `test-plan.md` in feature directory -- verified fixed (pre-existing)
