---
status: done
review_status: done
phase: C1
type: curriculum
---

# C1 Scenario Scripts -- Spec

Write all 43 scenario scripts across 6 modules. Each script is a complete `TickScript` -- the data structure that drives the sim app's tick engine.

## What a Scenario Script Needs

Every scenario is a self-contained instructional experience. The script defines the world, the student, the challenge, and the scoring.

### Required Fields

| Field            | Type             | Description                                                          |
| ---------------- | ---------------- | -------------------------------------------------------------------- |
| `title`          | string           | Short name for the scenario                                          |
| `briefing`       | string           | 2-4 sentences. Sets the scene for the learner before tick 1.         |
| `difficulty`     | number (0-1)     | Starting difficulty rating                                           |
| `duration`       | number (minutes) | Estimated play time                                                  |
| `studentModelId` | ref              | Links to a student model (personality/behavior profile)              |
| `competencies`   | string[]         | Competency codes targeted (e.g., `CJ-1`, `AC-2`)                     |
| `faaTopics`      | FaaTopic[]       | FAA topic codes using `FAA_TOPIC` constants (e.g., `FAA_TOPIC.A_11`) |
| `tickScript`     | TickScript       | The tick sequence (see [design.md](design.md))                       |
| `status`         | string           | Always `'draft'` for new scripts                                     |

### Student Model Parameters

Each scenario references a student model that defines the simulated student's behavior. These are defined separately and reused across scenarios.

| Parameter            | Range | Meaning                                      |
| -------------------- | ----- | -------------------------------------------- |
| `skillLevel`         | 0-1   | Base flying ability                          |
| `compliance`         | 0-1   | How readily the student follows instructions |
| `freezeTendency`     | 0-1   | Likelihood of freezing under pressure        |
| `overconfidence`     | 0-1   | Tendency to dismiss cues                     |
| `instrumentAccuracy` | 0-1   | How well the student reads instruments       |
| `startleDelay`       | 0-1   | Reaction delay when surprised                |
| `fatigue`            | 0-1   | Cognitive/physical degradation               |

## Quality Criteria

A scenario script is ready when it passes all of the following.

### Instructional Quality

- [ ] Briefing sets context without telegraphing the "right" answer
- [ ] Tick progression creates genuine time pressure
- [ ] At least one tick has a non-obvious best intervention
- [ ] Scoring rewards noticing early, not just knowing the answer
- [ ] Debrief annotations explain the _why_, not just the outcome
- [ ] Student model parameters create believable behavior
- [ ] Replay with different student model would produce a different experience

### Structural Completeness

- [ ] Every tick has all 5 intervention consequences defined
- [ ] Every consequence has a valid `nextTickId` (another tick, `terminal_safe`, or `terminal_unsafe`)
- [ ] No orphan ticks (every tick is reachable from tick_1)
- [ ] At least one path reaches `terminal_safe`
- [ ] At least one path reaches `terminal_unsafe` (except capstone/reflective scenarios)
- [ ] `safeWindow` and `criticalWindow` are defined for every tick
- [ ] Score deltas are balanced -- max achievable score is meaningful

### FAA Compliance Rules

- [ ] At least one `FAA_TOPIC` constant assigned -- use `FAA_TOPIC.A_1` through `FAA_TOPIC.A_13`, never bare strings
- [ ] At least one competency code assigned from [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md)
- [ ] Scenario content aligns with the FAA topic descriptions in [TRACEABILITY_MATRIX.md](../../TRACEABILITY_MATRIX.md)
- [ ] No internal terminology in briefing text (no "tick", "score delta", "student model")
- [ ] Duration estimate is realistic for the tick count and complexity
- [ ] Time contribution to FAA topics is documented per scenario

## Coverage Requirements

The 43 scenarios must collectively satisfy:

| Requirement                          | Target               | Source                                           |
| ------------------------------------ | -------------------- | ------------------------------------------------ |
| Total course time                    | >= 16 hours          | AC 61-83K                                        |
| Per FAA topic                        | >= 45 min cumulative | AC 61-83K                                        |
| All 13 FAA topics covered            | 13/13                | AC 61-83K Appendix A                             |
| All 22 competencies exercised        | 22/22                | [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md) |
| All 8 competency domains represented | 8/8                  | [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md) |

## Related Docs

- [design.md](design.md) -- template format, tick patterns, student model guidelines
- [tasks.md](tasks.md) -- all 43 scenarios with dependency order
- [test-plan.md](test-plan.md) -- validation checklists
- [template.md](template.md) -- blank template for authors
- [TickScript type](../../../../libs/types/src/engine-types.ts) -- TypeScript type definition
- [seed-e2e-demo.ts](../../../../scripts/db/seed-e2e-demo.ts) -- reference implementation (Base-to-Final Overshoot)
- [COMPETENCY_GRAPH.md](../../COMPETENCY_GRAPH.md) -- competency domains and behaviors
- [TRACEABILITY_MATRIX.md](../../TRACEABILITY_MATRIX.md) -- FAA topic coverage mapping
- [COURSE_STRUCTURE.md](../../COURSE_STRUCTURE.md) -- module time allocations
