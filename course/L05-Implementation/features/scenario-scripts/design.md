---
status: done
review_status: done
phase: C1
type: curriculum
---

# C1 Scenario Scripts -- Design

How to write a scenario script. Tick structure patterns, student model guidelines, and the scenario template format.

## Tick Structure Patterns

Every scenario follows the `TickScript` type from `libs/types/src/engine-types.ts`. A script is an array of `Tick` objects connected by `nextTickId` references.

### The Tick Graph

Ticks form a directed graph, not a linear list. Branching creates replayability.

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
              \         \-> terminal_unsafe
               \-> tick_2b -> terminal_safe
```

### Tick Anatomy

```typescript
{
  id: 'tick_2',
  scene: 'What the CFI sees/hears right now.',
  studentSpeech: 'What the student says (or silence).',
  studentState: 'degrading',        // nominal | degrading | critical | recovered
  safeWindow: ['prompt', 'coach'],  // interventions that are appropriate here
  criticalWindow: ['ask'],          // interventions that are risky but not catastrophic
  consequences: {                   // one entry per InterventionLevel
    ask:            { nextTickId, scoreDelta, annotation },
    prompt:         { nextTickId, scoreDelta, annotation },
    coach:          { nextTickId, scoreDelta, annotation },
    direct:         { nextTickId, scoreDelta, annotation },
    take_controls:  { nextTickId, scoreDelta, annotation },
  }
}
```

### State Progression Patterns

Most scenarios follow one of these patterns.

**Pattern A: Escalating Crisis** (LOC, stall/spin, engine failure)

```
nominal -> degrading -> critical -> terminal
```

The student deteriorates unless the CFI intervenes. Each tick raises the stakes. The right intervention depends on how far things have gone.

**Pattern B: Pressure Decision** (ethics, signoff, compliance)

```
nominal -> pressure_1 -> pressure_2 -> decision_point -> outcome
```

External pressure builds. The CFI must recognize the pressure and resist or comply. No physical danger, but professional/legal consequences.

**Pattern C: Diagnostic Puzzle** (hidden weakness, rusty pilot, automation dependency)

```
nominal -> cue_1 -> cue_2 -> diagnosis -> evaluation_plan -> outcome
```

The student appears fine on the surface. Subtle cues reveal a hidden weakness. The CFI must probe, diagnose, and tailor the response.

**Pattern D: Multi-Beat Administrative** (TSA, applications, records)

```
intake -> verification -> decision -> documentation -> outcome
```

A walk-in or scenario triggers an administrative workflow. Each beat requires the right procedural step. Branches for correct/incorrect paths.

**Pattern E: Integrated Capstone** (multiple topics, branching day-in-the-life)

```
setup -> branch_A (LOC event)
     \-> branch_B (compliance event)
     \-> branch_C (teaching event)
```

Multiple independent challenges in sequence. Tests breadth across competency domains.

## Score Delta Guidelines

Scores accumulate across four dimensions: `recognition`, `judgment`, `timing`, `execution`.

### Scoring Philosophy

- **Positive scores** for correct, well-timed interventions
- **Zero** for neutral/acceptable-but-not-optimal choices
- **Negative scores** for harmful, dangerous, or inappropriate interventions
- The _magnitude_ reflects how much the choice matters at this moment

### Recommended Ranges

| Situation                               | Score delta range               |
| --------------------------------------- | ------------------------------- |
| Perfect intervention in safeWindow      | +1 per dimension (max +4 total) |
| Acceptable but suboptimal               | +1 in some, 0 in others         |
| Neutral / no-harm-no-help               | 0 across the board              |
| Mildly inappropriate                    | -1 in 1-2 dimensions            |
| Dangerous inaction or over-intervention | -2 to -3 per dimension          |

### Key Rules

- `safeWindow` interventions should score positively
- `criticalWindow` interventions should score near zero or slightly negative
- Interventions outside both windows should score negatively
- `take_controls` on a `nominal` tick should always score heavily negative
- `ask` on a `critical` tick should always score heavily negative
- Annotations must explain the reasoning, not just restate the score

## Student Model Guidelines

### When to Reuse vs Create New Models

- Reuse a model when the scenario needs a common student archetype (overconfident, timid, rusty)
- Create a new model when the scenario requires a specific behavioral combination
- Each module should have 2-4 student models that its scenarios share

### Archetype Library

| Archetype             | Key parameters                                                | Used in                  |
| --------------------- | ------------------------------------------------------------- | ------------------------ |
| Overconfident Student | overconfidence: 0.8, compliance: 0.6, skillLevel: 0.4         | M3 LOC scenarios         |
| Timid Student         | freezeTendency: 0.7, compliance: 0.9, overconfidence: 0.1     | M2 instruction scenarios |
| Rusty Pilot           | skillLevel: 0.3, instrumentAccuracy: 0.4, fatigue: 0.3        | M5 evaluation scenarios  |
| Parroting Student     | compliance: 0.9, skillLevel: 0.2, overconfidence: 0.3         | M2 instruction scenarios |
| Automation-Dependent  | instrumentAccuracy: 0.7, skillLevel: 0.5, overconfidence: 0.6 | M1 cockpit scenarios     |
| Pressure-Susceptible  | compliance: 0.8, freezeTendency: 0.5, fatigue: 0.4            | M2 safety culture        |
| Sharp but Weak ADM    | skillLevel: 0.8, overconfidence: 0.7, compliance: 0.4         | M5 evaluation scenarios  |

### Parameter Interactions

- High `overconfidence` + low `compliance` = student who ignores corrections
- High `freezeTendency` + high `startleDelay` = student who locks up in emergencies
- High `skillLevel` + low `instrumentAccuracy` = VFR-strong but IFR-weak pilot
- High `fatigue` degrades all other parameters over time

## Briefing Writing Guidelines

The briefing is the learner's first impression. It sets the scenario without revealing the challenge.

### Do

- Set the physical scene (airport, weather, time of day, aircraft)
- Describe the student briefly (experience level, recent history, demeanor)
- Give the instructional context (type of lesson, phase of training)
- Use professional, realistic language

### Don't

- Telegraph the "right" answer
- Use internal terminology (ticks, scores, student models)
- Write more than 4 sentences
- Include information the CFI wouldn't know at this point

### Example (from reference implementation)

> Your student is flying a visual approach to runway 27. On base leg, the student begins the turn to final but overshoots the centerline. Crosswind from the south is stronger than forecast. The student appears fixated on regaining the centerline and is losing airspeed awareness.

## Annotation Writing Guidelines

Each `TickConsequence.annotation` is a debrief teaching moment.

### Do

- Explain why this intervention was appropriate or inappropriate _at this moment_
- Reference the student's state and the safety margin
- Connect to the intervention ladder philosophy
- Keep to 1-2 sentences

### Don't

- Just restate what happened ("You took controls")
- Use score numbers ("This cost you -2 judgment")
- Be condescending
- Reference other ticks or the broader scenario structure

## Duration Estimation

| Tick count | Typical play time | Scenario type          |
| ---------- | ----------------- | ---------------------- |
| 3-4 ticks  | 5-8 min           | Focused single-concept |
| 5-7 ticks  | 8-12 min          | Standard scenario      |
| 8-10 ticks | 12-18 min         | Complex branching      |
| 10+ ticks  | 15-25 min         | Capstone / multi-beat  |

Include briefing read time (~1 min) and post-scenario debrief review (~2-3 min) in duration estimates.

## Related Docs

- [spec.md](spec.md) -- required fields, quality criteria, FAA rules
- [template.md](template.md) -- blank template to fill in
- [TickScript type](../../../../libs/types/src/engine-types.ts) -- TypeScript definition
- [seed-e2e-demo.ts](../../../../scripts/db/seed-e2e-demo.ts) -- reference implementation
- [DESIGN_PRINCIPLES.md](../../../platform/DESIGN_PRINCIPLES.md) -- principles 3 (Decisions Under Pressure), 4 (Never a Trick), 5 (Replay is the Product)
