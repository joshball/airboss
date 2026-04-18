---
title: "Spec: Debrief"
product: sim
feature: debrief
type: spec
status: done
---

# Spec: Debrief

Post-scenario review. Shows what happened, what was missed, and why -- in the spirit of an aviation debrief room. NTSB framing: chain of events, not blame.

## What It Does

After a scenario run, the learner sees a structured debrief with:

1. **Outcome banner** -- SAFE / UNSAFE / LATE INTERVENTION
2. **Score summary** -- four dimensions with visual bars
3. **Timeline** -- tick-by-tick: what happened, what you did, what a better choice was
4. **Key misses** -- top 2-3 contributing factors to the outcome
5. **Competency + FAA tags** -- what was exercised
6. **Actions** -- Replay, Try Again, Continue

## Data Model

**Reads from:**

- `evidence.scenario_run` (outcome, score, duration, scenarioId, releaseId, seed)
- `evidence.evidence_packet` (topicsCovered, competenciesExercised, actionsTaken, scoreDimensions)
- `evidence.score_dimension` rows (per-dimension scores)
- `published.scenario` (title, briefing, tickScript -- for timeline annotations)

**No new tables.** Debrief is a read-only view over evidence data.

## Behavior

### Outcome banner

| Outcome      | Banner                             | Color                   |
| ------------ | ---------------------------------- | ----------------------- |
| `safe`       | SAFE -- Good instructing           | Success (green/emerald) |
| `unsafe`     | UNSAFE -- Student at risk          | Danger (red)            |
| `incomplete` | INCOMPLETE -- Run was not finished | Neutral                 |

Banner language avoids "you failed" framing. Use "Student at risk" not "You failed."

### Score dimensions

Four dimensions, each answering a specific question about CFI performance. Each dimension shows:

- The question it answers (italic, above the bar)
- A visual bar (0-100%)
- Contextual feedback that explains the score in plain language

| Dimension   | Question                                            | High                                                 | Low                                                                 |
| ----------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Recognition | Did you see the problem before it became dangerous? | Identified early cues while there was time to teach. | Did not act until the situation was critical or too late.           |
| Judgment    | Did you match intervention to the severity?         | Used the right ladder level at each moment.          | Over-intervened when safe, or under-intervened when critical.       |
| Timing      | Did you act when your intervention could matter?    | Intervened while there was time to recover safely.   | Waited past the point where intervention could prevent the outcome. |
| Execution   | Did your intervention address the actual problem?   | Action directly corrected or prevented the hazard.   | Intervention was off-target -- did not address the actual threat.   |

**No overall percentage.** A single rolled-up number obscures what happened. The four dimensions ARE the feedback. See `SCORE_DIMENSION_INFO` in `libs/constants/src/engine.ts` for the canonical definitions.

**No "SAFE 45%".** SAFE is the outcome label (Student Safe), not an acronym. It is not a score. Outcome and dimensions are shown separately.

### Timeline

Chronological list of ticks played:

```
Tick 1 -- [Scene summary]
  You: Ask ("Tell me about your airspeed?")
  Better: Prompt -- student was already degrading
  Impact: Partial -- student responded but continued declining

Tick 2 -- [Scene summary]
  You: Direct ("Bank angle, bank angle!")
  Outcome: Correct intervention at critical moment
  Impact: Positive -- student corrected
```

Timeline uses the `annotation` field from `TickConsequence` for the "Impact" text.

"Better" is only shown when the learner's choice was suboptimal. If they chose well, "Outcome: Correct" is shown with no alternative.

### Key misses

Extracted from the timeline: the 2-3 ticks with the highest negative `scoreDelta`. Shown as callouts with plain language:

> "You waited until the critical window to intervene on Tick 3. Earlier coaching could have prevented the stall setup."

Use NTSB-style language: "the chain that led to this outcome" not "where you went wrong."

### Competency + FAA tags

Grid of chips:

- Competency domains exercised (e.g., "CJ-2: Least invasive intervention")
- FAA topics covered (e.g., "LOC", "Teaching & Safety Culture")

### Actions

| Button        | Behavior                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Replay**    | Start the same scenario with the same tick script, full debrief annotations shown inline |
| **Try Again** | Start the same scenario fresh (no annotations, new attempt)                              |
| **Continue**  | Go to next recommended activity (`/course` with module context)                          |

Replay (with annotations) is Phase 2 deferred -- too complex for initial release. Show button but mark it "Coming soon" or omit in Phase 2.

## Route

`/debrief/:runId`

Load function reads run from DB, verifies `run.userId === locals.user.id` (security: can't view another user's debrief).

## Edge Cases

- `runId` not found -> 404
- `run.userId !== locals.user.id` -> 403 (not 404, which would leak existence)
- Scenario no longer in published content (scenario deleted from course) -> show debrief data from evidence packet, show "Scenario content unavailable" for timeline
- `incomplete` run (aborted) -> show truncated timeline up to abort tick
- No `evidence_packet` (recording bug) -> show outcome + score only, note "Detailed breakdown unavailable"

## Design Principles Applied

- **Debrief Culture (#1):** Show the chain, not the score. Every tick explained.
- **Emotional Safety (#6):** No shame framing. "Student at risk" not "You failed." "Earlier coaching" not "You were wrong."
- **Replay is the Product (#5):** Try Again and Replay buttons are prominent, not buried. Failure creates the motivation to replay.
