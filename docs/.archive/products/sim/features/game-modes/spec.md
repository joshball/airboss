---
title: "Spec: Game Modes"
product: sim
feature: game-modes
type: spec
status: done
---

# Spec: Game Modes

Two additional play modes beyond the standard course flow: **Free Play** (choose any published scenario, no course progression) and **Drill Mode** (rapid-fire question practice from the knowledge check bank). Both contribute to FAA time tracking but are separate from the structured course path.

This is what gets people from 16 hours to 100+ hours (Design Principle 5: Replay is the Product).

## What It Does

### Free Play

A learner browses all published scenarios (across all modules) and plays any one without prerequisite or sequencing constraints. The standard scenario player is used. Evidence is recorded. FAA time is logged. Adaptive engine updates. But course progress (module completion) is not affected.

### Drill Mode

A learner runs through knowledge check questions rapid-fire. Questions are drawn from the full FAA question pool using adaptive selection. Each question shows immediate feedback (correct/incorrect + explanation). No grading threshold -- it's practice, not assessment. Memory records update for spaced repetition.

## Data Model

### No new tables

Both modes reuse existing infrastructure:

- Free Play uses the same scenario player, evidence recording, and time logging
- Drill Mode uses the same knowledge check rendering and adaptive question selection

### New constants in `libs/constants/src/game-modes.ts`

| Constant                   | Type        | Value                          |
| -------------------------- | ----------- | ------------------------------ |
| `GAME_MODE`                | enum object | `COURSE`, `FREE_PLAY`, `DRILL` |
| `DRILL_DEFAULT_COUNT`      | number      | `10`                           |
| `DRILL_MAX_COUNT`          | number      | `50`                           |
| `FREE_PLAY_TIME_QUALIFIED` | boolean     | `true`                         |
| `DRILL_TIME_QUALIFIED`     | boolean     | `true`                         |

### New routes in `libs/constants/src/routes.ts`

| Route                    | Path                                                   |
| ------------------------ | ------------------------------------------------------ |
| `SIM_FREE_PLAY`          | `'/free-play'`                                         |
| `SIM_FREE_PLAY_SCENARIO` | `(id: string) => '/free-play/${id}'`                   |
| `SIM_DRILL`              | `'/drill'`                                             |
| `SIM_DRILL_SESSION`      | `(sessionId: string) => '/drill/${sessionId}'`         |
| `SIM_DRILL_RESULTS`      | `(sessionId: string) => '/drill/${sessionId}/results'` |

### Extend `evidence.scenario_run`

Add a `mode` column:

| Column | Type            | Default    | Notes                                   |
| ------ | --------------- | ---------- | --------------------------------------- |
| `mode` | `text` NOT NULL | `'course'` | `'course'`, `'free_play'`, or `'drill'` |

This distinguishes runs by mode for analytics. Default is `'course'` so existing data is unaffected.

### New type: `DrillSession`

```typescript
interface DrillSession {
  id: string;
  enrollmentId: string;
  questions: DrillQuestion[];
  currentIndex: number;
  answers: DrillAnswer[];
  startedAt: string;
}

interface DrillQuestion {
  questionId: string;
  text: string;
  options: { id: string; text: string }[];
  competencyDomain: string;
  difficulty: number;
}

interface DrillAnswer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  timeMs: number;
}

interface DrillResults {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  byDomain: Record<string, { correct: number; total: number }>;
}
```

## Behavior

### Free Play

**Browse screen (`/free-play`):**

- All published scenarios displayed in a grid/list
- Filterable by FAA topic, competency domain, difficulty (Case I/II/III)
- Each card shows: title, module, difficulty, estimated time, topics covered
- Scenarios already completed show a completion badge with last score
- No sequencing -- any scenario is playable

**Play flow:**

1. Learner selects a scenario -> navigates to `/free-play/:id`
2. Standard briefing screen (same as course)
3. Standard player (same as course)
4. On completion: evidence recorded with `mode = 'free_play'`, FAA time logged
5. Redirect to debrief (same as course)
6. Debrief "Back" link returns to `/free-play` (not `/course`)

**Course progress:** Free play completions update adaptive engine memory and difficulty profiles but do NOT advance module progress. A learner who plays everything in free play still needs to complete modules in course mode for graduation.

### Drill Mode

**Setup screen (`/drill`):**

- Learner selects question count (10, 20, 30, 50) and optionally filters by FAA topic or competency domain
- "Start Drill" button creates a drill session

**Drill screen (`/drill/:sessionId`):**

- One question at a time, full screen
- Question text + options (multiple choice)
- Timer showing elapsed time per question (visual only, no cutoff)
- On answer: immediate feedback (correct/incorrect), show explanation, "Next" button
- Progress bar: "Question 3 of 10"

**Results screen (`/drill/:sessionId/results`):**

- Total correct / total questions
- Accuracy percentage
- Average time per question
- Breakdown by competency domain
- "Try Again" button (new session with same settings)
- "Back to Course" link

**Evidence recording:**

- One `evidence.scenario_run` per drill session with `mode = 'drill'`, `outcome = 'complete'`
- `durationSeconds` = total drill time
- Score = accuracy (correct / total)
- FAA time logged for the full drill duration
- Each question answer updates learner memory via adaptive engine

**No grading threshold.** Drill mode is practice. There is no pass/fail. The FAA graded assessment is a separate feature in the course flow.

## Validation

| Field              | Rule                                                   |
| ------------------ | ------------------------------------------------------ |
| `questionCount`    | Must be in [10, 20, 30, 50]                            |
| `topicFilter`      | Optional. If provided, must be valid `FAA_TOPIC`       |
| `domainFilter`     | Optional. If provided, must be valid competency domain |
| `selectedOptionId` | Must match one of the question's option IDs            |

## Edge Cases

| Case                                         | Behavior                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| No published scenarios                       | Free play shows empty state: "No scenarios published yet"                                                          |
| Fewer questions than requested count         | Drill uses all available questions. Shows actual count.                                                            |
| Learner leaves drill mid-session             | Session is lost (client state). No partial drill recorded.                                                         |
| All questions in drill answered correctly    | Results show 100% accuracy. Memory intervals lengthen.                                                             |
| Browser refresh during drill                 | Session lost. Returns to `/drill` setup.                                                                           |
| Same scenario played in free play and course | Both runs recorded separately with different `mode`. Both count for FAA time. Adaptive engine treats them equally. |
| Drill question pool empty (no FAA questions) | "No questions available" message on setup screen. Start button disabled.                                           |

## Out of Scope

- Timed drill mode (hard cutoff per question -- future)
- Competitive/leaderboard drill mode (future, connects to Greenie Board)
- Custom drill playlists (author-curated question sets)
- Offline drill mode
- Drill mode for non-FAA (lesson) questions
- Free play for unpublished scenarios (author preview is a hangar feature)
- Social features (sharing drill scores)
