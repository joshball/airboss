---
status: done
review_status: done
phase: C1
type: curriculum
---

# Scenario Script Template

Copy this template for each new scenario. Fill in all sections. See [design.md](design.md) for patterns and guidelines.

---

## Metadata

```
Scenario ID:     [module.number, e.g., 3.2]
Title:           [short descriptive name]
Module:          [1-6]
Difficulty:      [0-1]
Duration:        [estimated minutes]
Pattern:         [Escalating Crisis | Pressure Decision | Diagnostic Puzzle | Multi-Beat Admin | Integrated Capstone]
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_xx, FAA_TOPIC.A_xx]
```

List all FAA topics this scenario contributes time toward. Use `FAA_TOPIC` constants only.

## Competency Links

```
competencies: ['XX-N', 'XX-N']
```

List all competencies exercised. Reference [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md).

## Student Model

Use an existing archetype or define a new one. See [design.md](design.md) archetype library.

```
Student Model:   [archetype name or "new"]
Parameters:
  skillLevel:         [0-1]
  compliance:         [0-1]
  freezeTendency:     [0-1]
  overconfidence:     [0-1]
  instrumentAccuracy: [0-1]
  startleDelay:       [0-1]
  fatigue:            [0-1]
```

## Briefing

> [2-4 sentences. Set the scene for the learner. Airport, weather, student, lesson context. Don't telegraph the challenge.]

## Tick Script

### Tick 1

```
id:           tick_1
scene:        [What the CFI sees/hears. 1-2 sentences.]
studentSpeech:[What the student says.]
studentState: [nominal | degrading | critical | recovered]
safeWindow:   [intervention levels that are appropriate]
criticalWindow:[intervention levels that are risky]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------- |
| ask           |            |             |          |        |           |            |
| prompt        |            |             |          |        |           |            |
| coach         |            |             |          |        |           |            |
| direct        |            |             |          |        |           |            |
| take_controls |            |             |          |        |           |            |

### Tick 2

```
id:           tick_2
scene:        [...]
studentSpeech:[...]
studentState: [...]
safeWindow:   [...]
criticalWindow:[...]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------- |
| ask           |            |             |          |        |           |            |
| prompt        |            |             |          |        |           |            |
| coach         |            |             |          |        |           |            |
| direct        |            |             |          |        |           |            |
| take_controls |            |             |          |        |           |            |

[Continue with tick_3, tick_4, etc. as needed.]

## Tick Graph

Sketch the branching structure:

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
              \         \-> terminal_unsafe
               \-> tick_2b -> terminal_safe
```

## Score Summary

| Path              | recognition | judgment | timing | execution | Total | Outcome         |
| ----------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal           |             |          |        |           |       | terminal_safe   |
| Late intervention |             |          |        |           |       | terminal_safe   |
| Worst case        |             |          |        |           |       | terminal_unsafe |

## Author Notes

[Any context about why certain design choices were made. References to AC 61-83K, accident data, instructional reasoning. Not learner-facing.]

---

## Self-Check

Before submitting, verify against the [Per-Scenario Checklist](test-plan.md#per-scenario-checklist):

- [ ] Structure: all ticks connected, no orphans, terminals reachable
- [ ] Scoring: safeWindow positive, outside-window negative, balanced
- [ ] Content: briefing clean, annotations explain why, no jargon
- [ ] Metadata: FAA topics, competencies, duration, difficulty all set
