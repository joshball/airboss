---
id: "" # kebab-case, e.g. m3-base-to-final
module: 0 # 1-6
title: ""
faa_topics: [] # e.g. [A.11, A.4] -- from COURSE_STRUCTURE.md
competencies: [] # e.g. [CJ-1, CJ-2, AC-1] -- from COMPETENCY_GRAPH.md
student_model: "" # reference to a student model id
duration_min: 0 # expected run time in minutes
difficulty: "" # entry | intermediate | advanced
replay_value: "" # what changes on replay (student model variation, conditions, etc.)
---

# [Title]

## Briefing

> What the instructor reads before the scenario starts. Sets context, airport, aircraft, student background. ~2-3 sentences. Should feel like a real pre-brief, not a test prompt.

## Setup

Initial simulation state at T=0.

```yaml
aircraft:
  type: ""
  phase_of_flight: "" # pattern, cruise, approach, etc.
  bank_deg: 0
  airspeed_kts: 0
  altitude_ft: 0
  pitch_deg: 0
  config: "" # e.g. flaps_10, gear_down

environment:
  airport: ""
  conditions: "" # e.g. vmc_day, night, marginal_vmc
  traffic: "" # none, moderate, busy

student:
  state: "" # focused | distracted | overconfident | uncertain
  workload: "" # low | medium | high | saturated
  verbal: "" # what they say at T=0
```

## Tick Timeline

Key beats only -- not every literal second. Each entry is a meaningful state change.

```yaml
beats:
  - t: 0
    label: ""
    aircraft: {} # changed fields only
    student:
      state: ""
      verbal: ""
    cues: [] # what the instructor CAN observe at this moment
    risks: [] # building hazards not yet visible
    intervention_window: false

  # add beats...
```

## Intervention Points

The moments where the instructor is expected to act. Each point shows the full intervention ladder and what each choice leads to.

### IP-1: [Label] (T+Xs)

**Situation:** [What is happening at this moment.]
**Window:** [How long the instructor has before consequences escalate.]

| Level         | Action             | Outcome if taken here |
| ------------- | ------------------ | --------------------- |
| Ask           | [example question] | [what happens]        |
| Prompt        | [example prompt]   | [what happens]        |
| Coach         | [example coaching] | [what happens]        |
| Direct        | [example command]  | [what happens]        |
| Take Controls | Positive exchange  | [what happens]        |
| No action     | --                 | [what happens]        |

## Branch Outcomes

How timing and intervention type combine to determine the scenario outcome.

| Intervened by | Type        | Outcome                                |
| ------------- | ----------- | -------------------------------------- |
| T+Xs (early)  | Any         | [result]                               |
| T+Xs (late)   | Ask/Prompt  | [result]                               |
| T+Xs (late)   | Direct/Take | [result]                               |
| Never         | --          | [result -- typically the safety event] |

## Evidence Logged

What the engine records for scoring and FAA traceability.

| Signal                | Description                            | Maps to    |
| --------------------- | -------------------------------------- | ---------- |
| `intervention_timing` | Seconds from first cue to first action | CJ-1, CJ-2 |
| `intervention_level`  | Which ladder level was chosen          | CJ-2       |
| `cues_noticed`        | Which early cues were acted on         | AC-1       |
| [add more]            |                                        |            |

## Debrief

What the post-scenario review surfaces. Written from the system's perspective -- what it tells the instructor.

**If early intervention:**

> [What the debrief says when the instructor caught it early.]

**If late intervention:**

> [What the debrief says -- focuses on what was missed and when.]

**If no intervention:**

> [What the debrief says about the safety event that occurred.]

**Key learning moment:**
[The one thing this scenario is designed to teach. The debrief should always land here.]
