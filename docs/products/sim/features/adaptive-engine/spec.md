---
title: "Spec: Adaptive Engine"
product: sim
feature: adaptive-engine
type: spec
status: done
---

# Spec: Adaptive Engine

Replaces the Phase 2 scripted tick engine with adaptive capabilities: spaced repetition for knowledge checks and scenario sequencing, and difficulty adjustment based on learner performance. The engine interface stays the same -- adaption happens behind the scenes.

## What It Does

The adaptive engine personalizes the learning path for each learner based on their performance history. Two mechanisms:

1. **Spaced repetition** -- determines when to re-present knowledge checks and scenarios based on time since last exposure and performance quality
2. **Difficulty adjustment** -- selects scenario difficulty and question difficulty based on learner's demonstrated competency level

Both are invisible to the learner. The FAA-facing layer sees standard curriculum delivery. The experience layer delivers personalized training.

## Data Model

### New table: `enrollment.learner_memory`

Tracks per-item retention state for spaced repetition.

| Column           | Type                            | Constraints                     | Notes                                |
| ---------------- | ------------------------------- | ------------------------------- | ------------------------------------ |
| `id`             | `text` PK                       |                                 | Tier B ULID                          |
| `enrollmentId`   | `text` NOT NULL                 | FK -> `enrollment.enrollment`   |                                      |
| `itemType`       | `text` NOT NULL                 | CHECK: valid `MEMORY_ITEM_TYPE` | `scenario`, `question`, `competency` |
| `itemId`         | `text` NOT NULL                 |                                 | The scenario/question/competency ID  |
| `easeFactor`     | `real` NOT NULL, default `2.5`  |                                 | SM-2 ease factor                     |
| `interval`       | `integer` NOT NULL, default `1` |                                 | Days until next review               |
| `repetitions`    | `integer` NOT NULL, default `0` |                                 | Successful consecutive reviews       |
| `lastReviewedAt` | `timestamp`                     |                                 | When last seen                       |
| `nextReviewAt`   | `timestamp`                     |                                 | When to present again                |
| `quality`        | `integer`                       |                                 | Last response quality (0-5)          |
| `createdAt`      | `timestamp` NOT NULL            |                                 |                                      |
| `updatedAt`      | `timestamp` NOT NULL            |                                 |                                      |

Unique constraint on `(enrollmentId, itemType, itemId)`.

### New table: `enrollment.difficulty_profile`

Tracks learner's demonstrated level per competency domain.

| Column              | Type                           | Constraints                   | Notes                                      |
| ------------------- | ------------------------------ | ----------------------------- | ------------------------------------------ |
| `id`                | `text` PK                      |                               | Tier B ULID                                |
| `enrollmentId`      | `text` NOT NULL                | FK -> `enrollment.enrollment` |                                            |
| `competencyDomain`  | `text` NOT NULL                |                               | Domain identifier from competency registry |
| `currentLevel`      | `real` NOT NULL, default `0.5` |                               | 0.0-1.0, starts at midpoint                |
| `confidence`        | `real` NOT NULL, default `0.0` |                               | 0.0-1.0, how many data points              |
| `adjustmentHistory` | `jsonb` NOT NULL, default `[]` |                               | Array of `{ timestamp, delta, reason }`    |
| `createdAt`         | `timestamp` NOT NULL           |                               |                                            |
| `updatedAt`         | `timestamp` NOT NULL           |                               |                                            |

Unique constraint on `(enrollmentId, competencyDomain)`.

### New constants in `libs/constants/src/adaptive.ts`

| Constant                          | Type        | Value                                | Notes                                      |
| --------------------------------- | ----------- | ------------------------------------ | ------------------------------------------ |
| `MEMORY_ITEM_TYPE`                | enum object | `SCENARIO`, `QUESTION`, `COMPETENCY` |                                            |
| `SM2_DEFAULT_EASE`                | number      | `2.5`                                | SM-2 algorithm default                     |
| `SM2_MIN_EASE`                    | number      | `1.3`                                | Floor for ease factor                      |
| `SM2_QUALITY_THRESHOLD`           | number      | `3`                                  | Below this = reset interval                |
| `DIFFICULTY_DEFAULT_LEVEL`        | number      | `0.5`                                | Starting difficulty                        |
| `DIFFICULTY_ADJUSTMENT_STEP`      | number      | `0.1`                                | Per-review adjustment                      |
| `DIFFICULTY_CONFIDENCE_INCREMENT` | number      | `0.05`                               | Per data point                             |
| `DIFFICULTY_LEVELS`               | enum object | `CASE_I`, `CASE_II`, `CASE_III`      | Maps to carrier landing weather categories |

### New types in `libs/types/src/adaptive.ts`

```typescript
interface LearnerMemory {
  itemType: MemoryItemType;
  itemId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quality: number | null;
}

interface DifficultyProfile {
  competencyDomain: string;
  currentLevel: number;
  confidence: number;
}

interface AdaptiveRecommendation {
  type: "scenario" | "question";
  itemId: string;
  reason: "due_for_review" | "new_item" | "difficulty_match" | "competency_gap";
  priority: number; // higher = more urgent
}

interface SpacedRepetitionUpdate {
  quality: number; // 0-5 (SM-2 scale)
  newEase: number;
  newInterval: number;
  newRepetitions: number;
  nextReviewAt: string;
}
```

## Behavior

### Spaced Repetition (SM-2 Algorithm)

The engine uses a modified SM-2 algorithm (same as Anki). Pure computation in `libs/engine/src/adaptive.ts`.

**Quality mapping:**

| Engine score | SM-2 quality | Meaning                       |
| ------------ | ------------ | ----------------------------- |
| 0.0-0.2      | 0            | Complete failure              |
| 0.2-0.4      | 1            | Serious errors                |
| 0.4-0.6      | 2            | Significant errors            |
| 0.6-0.7      | 3            | Correct with difficulty       |
| 0.7-0.85     | 4            | Correct with minor hesitation |
| 0.85-1.0     | 5            | Perfect response              |

**Algorithm:**

```typescript
export function computeSpacedRepetition(current: LearnerMemory, quality: number): SpacedRepetitionUpdate;
```

1. If quality < `SM2_QUALITY_THRESHOLD`: reset repetitions to 0, interval to 1 day
2. Otherwise: increment repetitions, compute new interval using ease factor
3. Adjust ease factor based on quality (never below `SM2_MIN_EASE`)
4. Compute `nextReviewAt` from current time + interval

### Difficulty Adjustment

After each scenario run or knowledge check, the difficulty profile updates.

```typescript
export function adjustDifficulty(
  profile: DifficultyProfile,
  score: number, // 0-1 overall score
  scenarioDifficulty: number, // 0-1 difficulty of what was attempted
): DifficultyProfile;
```

- Score above difficulty -> increase level (learner is above this difficulty)
- Score below difficulty -> decrease level (learner struggled)
- Adjustment magnitude scales with distance from current level
- Confidence increases with each data point (diminishing returns)

### Scenario Recommendation

```typescript
export function recommendNextScenarios(
  memory: LearnerMemory[],
  profiles: DifficultyProfile[],
  availableScenarios: PublishedScenario[],
  limit: number,
): AdaptiveRecommendation[];
```

Priority order:

1. Items due for review (nextReviewAt < now)
2. Competency gaps (domains with low confidence or low level)
3. Difficulty-matched new items (scenarios the learner hasn't tried, matched to their level)
4. Variety (avoid repeating the same competency domain)

### Question Selection

```typescript
export function selectQuestions(
  memory: LearnerMemory[],
  profiles: DifficultyProfile[],
  questionPool: PublishedQuestion[],
  count: number,
): string[]; // question IDs
```

Selects questions prioritizing:

1. Questions due for review
2. Questions from weak competency areas
3. Difficulty-appropriate questions
4. Pool diversity (one per pool for randomization compliance)

### Integration Points

- **After scenario completion:** Update `learner_memory` for that scenario and its competencies. Update `difficulty_profile` for relevant domains.
- **After knowledge check:** Update `learner_memory` for each question answered. Update `difficulty_profile`.
- **Course dashboard:** Call `recommendNextScenarios()` to suggest what to play next.
- **Knowledge check start:** Call `selectQuestions()` instead of random selection.

## Validation

| Field          | Rule                    |
| -------------- | ----------------------- |
| `quality`      | Integer 0-5             |
| `easeFactor`   | Float >= `SM2_MIN_EASE` |
| `interval`     | Integer >= 1            |
| `currentLevel` | Float 0.0-1.0           |
| `confidence`   | Float 0.0-1.0           |

## Edge Cases

| Case                                   | Behavior                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| First-time learner (no memory records) | All items treated as new. Difficulty starts at 0.5.                           |
| Learner abandons mid-scenario          | No memory update (only on completion).                                        |
| All scenarios completed                | Recommendations shift to review-due items.                                    |
| No scenarios due for review            | Recommend highest-priority new or gap-filling scenarios.                      |
| Learner consistently scores 1.0        | Difficulty increases to max. Ease factor increases. Intervals lengthen.       |
| Learner consistently scores 0.0        | Difficulty decreases to min. Items reset to short intervals.                  |
| Question pool too small for selection  | Return all available. Log warning.                                            |
| Published content changes mid-course   | Memory records for removed items become orphaned. Ignored in recommendations. |

## Out of Scope

- Exposing difficulty level to the learner (internal only)
- Manual difficulty override by author (future)
- Cross-learner analytics on difficulty (ops feature)
- Adaptive tick scripts (ticks remain authored; only sequencing is adaptive)
- Real-time difficulty adjustment within a scenario run (only between runs)
- A/B testing of adaptive parameters
