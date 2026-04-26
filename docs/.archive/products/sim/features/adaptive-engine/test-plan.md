---
title: "Test Plan: Adaptive Engine"
product: sim
feature: adaptive-engine
type: test-plan
status: done
---

# Test Plan: Adaptive Engine

## Setup

```bash
bun db reset --force   # fresh DB with all seeds + test enrollment
bun scripts/dev.ts sim
```

Requires: enrolled user, multiple published scenarios with varying difficulty, multiple FAA questions.

---

## SR-1: Memory created on first completion

1. Log in as a new learner (no prior scenario runs)
2. Complete a scenario
3. Query `enrollment.learner_memory` for this enrollment
4. **Expected:** Memory record exists for this scenario with default ease (2.5), interval 1, repetitions 1

## SR-2: Memory updated on repeat completion

1. Complete the same scenario again (next day or adjust timestamps)
2. Query `enrollment.learner_memory`
3. **Expected:** `repetitions` incremented, `interval` increased, `nextReviewAt` pushed out

## SR-3: Low score resets interval

1. Complete a scenario poorly (over-intervene or miss cues deliberately)
2. Query `enrollment.learner_memory`
3. **Expected:** `repetitions` reset to 0, `interval` reset to 1, `nextReviewAt` is tomorrow

## SR-4: Knowledge check updates memory

1. Complete a knowledge check
2. Query `enrollment.learner_memory` for the answered questions
3. **Expected:** Memory records exist for each question with appropriate ease/interval

---

## DA-1: Difficulty profile created

1. Complete a scenario in a competency domain not yet attempted
2. Query `enrollment.difficulty_profile`
3. **Expected:** Profile exists for that domain, `currentLevel` adjusted from 0.5 based on score

## DA-2: High score increases level

1. Complete a scenario with high score (all safe-window interventions)
2. Query `enrollment.difficulty_profile` for that domain
3. **Expected:** `currentLevel` increased from prior value

## DA-3: Low score decreases level

1. Complete a scenario with low score
2. Query `enrollment.difficulty_profile`
3. **Expected:** `currentLevel` decreased from prior value

## DA-4: Level bounded

1. Complete many scenarios with perfect scores
2. Query `enrollment.difficulty_profile`
3. **Expected:** `currentLevel` never exceeds 1.0

---

## REC-1: Course dashboard shows recommendations

1. Complete 2-3 scenarios
2. Navigate to `/course`
3. **Expected:** "Recommended" section shows scenarios ordered by adaptive priority
4. **Expected:** Previously completed scenarios show "Due for review" if `nextReviewAt` has passed

## REC-2: First-time learner sees all scenarios

1. Log in as new learner (no completions)
2. Navigate to `/course`
3. **Expected:** All scenarios shown as available (no adaptive filtering yet)
4. **Expected:** Difficulty-matched scenarios appear first

## REC-3: Recommendations prioritize gaps

1. Complete scenarios covering only 2 of 8 competency domains
2. Navigate to `/course`
3. **Expected:** Scenarios from uncovered domains appear as high-priority recommendations

---

## QS-1: Adaptive question selection

1. Start a knowledge check
2. **Expected:** Questions are selected (not purely random)
3. Complete the check
4. Start another knowledge check
5. **Expected:** Questions due for review appear again; mastered questions appear less often

## QS-2: Pool diversity maintained

1. Start a knowledge check
2. **Expected:** No two questions from the same randomization pool in a single check
3. **Expected:** FAA minimum question variety still met

---

## INT-1: Adaptive data invisible to learner

1. Navigate through all learner-facing pages
2. **Expected:** No mention of "ease factor", "interval", "difficulty level", or SM-2 terminology
3. **Expected:** Recommendations appear natural ("Suggested for you" or "Continue where you left off")

## INT-2: FAA time tracking unaffected

1. Complete a scenario via adaptive recommendation
2. Query `enrollment.time_log`
3. **Expected:** Time logged normally with `faaQualified = true`, same as non-adaptive runs
