---
title: "Spec: Engine Wiring"
product: sim
feature: engine-wiring
type: spec
status: unread
---

# Spec: Engine Wiring

Connect seeded scenario data to the already-built sim player and verify the full learner flow works end-to-end: browse scenarios, read briefing, play ticks, score, debrief.

## Status: Already Built

The sim engine wiring is **already implemented**. This work package documents what exists, identifies gaps, and defines the verification/testing plan.

### What exists

| Layer          | Status | Location                                                                                                              |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Tick engine    | Done   | `libs/engine/src/tick.ts` -- initRun, applyIntervention, isTerminal, scoreRun, replayHistory                          |
| Player UI      | Done   | `apps/sim/src/routes/(app)/scenario/[id]/+page.svelte` -- calls engine client-side                                    |
| Server actions | Done   | `apps/sim/src/routes/(app)/scenario/[id]/+page.server.ts` -- 358 lines: replay, evidence, enrollment, adaptive, audit |
| Brief page     | Done   | `apps/sim/src/routes/(app)/scenario/[id]/brief/` -- shows briefing, "Call the Ball" button                            |
| Debrief page   | Done   | `apps/sim/src/routes/(app)/debrief/[runId]/` -- timeline, scores, key misses                                          |
| Free-play flow | Done   | `apps/sim/src/routes/(app)/free-play/` -- alternate path, same player                                                 |
| Course page    | Done   | `apps/sim/src/routes/(app)/course/` -- scenario list                                                                  |
| Scenario seed  | Done   | `scripts/db/seed-scenarios.ts` -- 43 scenarios with TickScript                                                        |
| Question seed  | Done   | `scripts/db/seed-questions.ts` -- 67 questions                                                                        |

### What's missing

1. **Published release** -- sim reads from `published.*` schema, not `course.*`. Scenarios must be published via hangar's publish pipeline before sim can load them.
2. **Seed + publish workflow** -- need to run seed scripts then publish a release
3. **End-to-end verification** -- nobody has tested the full flow with real data
4. **Query optimization** -- TODO in scenario server load to use `getPublishedScenarioBySlug` instead of fetching all scenarios

## Data Model

No data model changes. All tables exist.

## Behavior

### Full Learner Flow

1. Learner navigates to `/course` -- sees list of scenarios grouped by module
2. Clicks a scenario -- navigates to `/scenario/{slug}/brief`
3. Reads briefing, clicks "Call the Ball" -- navigates to `/scenario/{slug}`
4. Sees current tick: scene description, student speech, student state
5. Chooses one of 5 interventions (Ask, Prompt, Coach, Direct, Take Controls)
6. Engine advances: new tick displayed, scores updated internally
7. Repeats until terminal state (safe or unsafe)
8. Form submits history to server -- server replays, scores, records evidence
9. Redirected to `/debrief/{runId}` -- sees outcome, 4-dimension scores, timeline, key misses
10. Can click "Try Again" to replay or "Continue" to return to course

### Data Flow

```
Published DB -> server load -> client receives tickScript
  -> initRun() -> player loop (applyIntervention per tick)
  -> terminal -> form POST with history
  -> server: replayHistory() + scoreRun() + recordEvidence + updateProgress
  -> redirect to debrief
```

## Validation

Not applicable -- no new user inputs. All validation already exists in the server actions.

## Edge Cases

- **No published release** -- course page shows empty state. Need to seed + publish first.
- **Scenario with 0 ticks** -- engine throws. Validation in seed parser prevents this.
- **Browser back during scenario** -- history preserved in form, can resume or abort.
- **Double-submit on complete** -- server creates duplicate evidence. Need idempotency guard (future).

## Out of Scope

- Evidence packet persistence redesign
- Adaptive difficulty tuning
- Replay player ("coming soon" in debrief)
- Greenie Board / social features
- Multiplayer debrief
- Student behavior model integration (beyond current tick consequences)
