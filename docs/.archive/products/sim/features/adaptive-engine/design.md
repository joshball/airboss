---
title: "Design: Adaptive Engine"
product: sim
feature: adaptive-engine
type: design
status: done
---

# Design: Adaptive Engine

## Architecture

The adaptive engine is **pure computation** in `libs/engine/src/adaptive.ts`. No I/O, no DB access, no side effects. BCs handle persistence. This follows the same pattern as the tick engine.

```text
libs/engine/src/
  tick.ts        -- existing tick engine (unchanged)
  adaptive.ts    -- NEW: spaced repetition, difficulty adjustment, recommendations
```

The engine takes inputs (memory records, profiles, available content) and returns outputs (updates, recommendations). The calling code (form actions in sim) reads from BCs, calls engine functions, then writes results via BCs.

## Engine Functions

```typescript
// libs/engine/src/adaptive.ts

// SM-2 spaced repetition
export function mapScoreToQuality(score: number): number; // 0-1 -> 0-5
export function computeSpacedRepetition(
  current: LearnerMemory | null, // null = first encounter
  quality: number,
): SpacedRepetitionUpdate;

// Difficulty adjustment
export function adjustDifficulty(
  profile: DifficultyProfile | null, // null = first encounter
  score: number,
  scenarioDifficulty: number,
): DifficultyProfile;

// Recommendations
export function recommendNextScenarios(
  memory: LearnerMemory[],
  profiles: DifficultyProfile[],
  availableScenarios: { id: string; difficulty: number; competencyDomains: string[] }[],
  limit: number,
): AdaptiveRecommendation[];

export function selectQuestions(
  memory: LearnerMemory[],
  profiles: DifficultyProfile[],
  questionPool: { id: string; difficulty: number; poolId: string | null; competencyDomain: string }[],
  count: number,
): string[];
```

All functions are pure. All parameters are plain data. No Drizzle, no DB types.

## SM-2 Implementation

Modified SuperMemo 2 algorithm. Well-documented, widely used (Anki, Mnemosyne).

```typescript
export function computeSpacedRepetition(current: LearnerMemory | null, quality: number): SpacedRepetitionUpdate {
  const ease = current?.easeFactor ?? SM2_DEFAULT_EASE;
  const reps = current?.repetitions ?? 0;
  const interval = current?.interval ?? 1;

  if (quality < SM2_QUALITY_THRESHOLD) {
    // Failed: reset
    return {
      quality,
      newEase: Math.max(SM2_MIN_EASE, ease - 0.2),
      newInterval: 1,
      newRepetitions: 0,
      nextReviewAt: addDays(now(), 1),
    };
  }

  // Passed: advance
  const newReps = reps + 1;
  const newInterval = newReps === 1 ? 1 : newReps === 2 ? 6 : Math.round(interval * ease);
  const newEase = Math.max(SM2_MIN_EASE, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    quality,
    newEase,
    newInterval,
    newRepetitions: newReps,
    nextReviewAt: addDays(now(), newInterval),
  };
}
```

Note: `now()` is passed as a parameter in the actual implementation (for testability). The pseudocode above simplifies for readability.

## Difficulty Adjustment

Simple linear model with damping. More sophisticated models (Elo, Bayesian) can replace this later without changing the interface.

```typescript
export function adjustDifficulty(
  profile: DifficultyProfile | null,
  score: number,
  scenarioDifficulty: number,
): DifficultyProfile {
  const level = profile?.currentLevel ?? DIFFICULTY_DEFAULT_LEVEL;
  const confidence = profile?.confidence ?? 0;

  // Positive delta = learner is above this level
  const delta = (score - scenarioDifficulty) * DIFFICULTY_ADJUSTMENT_STEP;
  const newLevel = Math.max(0, Math.min(1, level + delta));
  const newConfidence = Math.min(1, confidence + DIFFICULTY_CONFIDENCE_INCREMENT);

  return {
    competencyDomain: profile?.competencyDomain ?? "",
    currentLevel: newLevel,
    confidence: newConfidence,
  };
}
```

## Recommendation Priority

```typescript
function scorePriority(
  scenario: AvailableScenario,
  memory: Map<string, LearnerMemory>,
  profiles: Map<string, DifficultyProfile>,
  now: Date,
): number {
  let score = 0;

  const mem = memory.get(scenario.id);
  if (mem?.nextReviewAt && new Date(mem.nextReviewAt) <= now) {
    score += 100; // Due for review = highest priority
  }

  if (!mem) {
    score += 50; // Never seen = high priority
  }

  // Competency gap bonus
  for (const domain of scenario.competencyDomains) {
    const profile = profiles.get(domain);
    if (!profile || profile.confidence < 0.3) {
      score += 30; // Weak or unknown domain
    }
  }

  // Difficulty match bonus (closer to learner level = better)
  const avgLevel = averageLevel(profiles, scenario.competencyDomains);
  const diffMatch = 1 - Math.abs(scenario.difficulty - avgLevel);
  score += diffMatch * 20;

  return score;
}
```

## Integration Flow

### After scenario completion

```text
1. Player form action -> scoreRun() (existing)
2. Map overall score to SM-2 quality
3. computeSpacedRepetition(existingMemory, quality)
4. adjustDifficulty(existingProfile, score, scenarioDifficulty)
5. enrollmentWrite.updateLearnerMemory(...)
6. enrollmentWrite.updateDifficultyProfile(...)
7. Redirect to debrief (existing)
```

Steps 2-6 are additions to the existing `complete` action. The redirect and evidence recording are unchanged.

### Course dashboard load

```text
1. Load enrollment (existing)
2. Load learner memory records
3. Load difficulty profiles
4. Load available published scenarios
5. recommendNextScenarios(memory, profiles, scenarios, 5)
6. Return scenarios with recommendations
```

## Difficulty Level Naming (Carrier Metaphor)

Per VOCABULARY.md, difficulty maps to carrier landing categories:

| Level range | Name     | Meaning                                                         |
| ----------- | -------- | --------------------------------------------------------------- |
| 0.0-0.33    | Case I   | Clear day, visual approach -- introductory difficulty           |
| 0.34-0.66   | Case II  | Instrument approach, break out at 1000ft -- moderate difficulty |
| 0.67-1.0    | Case III | Zero visibility, full instrument -- advanced difficulty         |

These labels appear in the course dashboard UI next to recommendations. Not exposed in FAA-facing docs.

## Key Decisions

**Why SM-2 over more complex models:** SM-2 is simple, proven, and well-understood. It has decades of use in spaced repetition systems. More complex models (FSRS, Bayesian) can be swapped in later -- the interface is the same.

**Why per-domain difficulty, not per-scenario:** Scenarios exercise multiple competencies. A single difficulty number per scenario wouldn't capture that a learner is strong in CRM but weak in weather assessment. Per-domain profiling enables targeted recommendations.

**Why pure functions:** Same reason as the tick engine. Pure computation is testable, portable, and has no side effects. The engine doesn't know about the database. This makes unit testing trivial and prevents coupling.

**Why not adaptive within a scenario run:** Tick scripts are authored content. Changing tick behavior at runtime would undermine content integrity and make FAA traceability impossible. Adaptation happens in sequencing (which scenario/question to present), not in execution.
