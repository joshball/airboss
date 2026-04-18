---
title: "Design: Game Modes"
product: sim
feature: game-modes
type: design
status: done
---

# Design: Game Modes

## Route Files

```text
apps/sim/src/routes/(app)/
  free-play/
    +page.svelte              -- scenario browse grid with filters
    +page.server.ts           -- load all published scenarios + completion history
    [id]/
      brief/
        +page.svelte          -- briefing (reuses scenario briefing component)
        +page.server.ts       -- load scenario
      +page.svelte            -- player (reuses scenario player component)
      +page.server.ts         -- load + complete action (mode = 'free_play')
  drill/
    +page.svelte              -- setup screen (count selector, filters)
    +page.server.ts           -- load question pool stats, create session action
    [sessionId]/
      +page.svelte            -- drill player (one question at a time)
      +page.server.ts         -- load session, complete action
      results/
        +page.svelte          -- results display
        +page.server.ts       -- compute results + record evidence
```

## Component Reuse

Free Play reuses the scenario player and briefing components from the course flow. The key difference is in the `+page.server.ts` actions:

```typescript
// free-play/[id]/+page.server.ts
export const actions = {
  complete: async (event) => {
    // Same as scenario player complete action, but:
    // 1. mode = GAME_MODE.FREE_PLAY
    // 2. No module progress update
    // 3. Debrief redirect includes returnTo=/free-play
    await evidenceWrite.recordScenarioRun({
      ...runData,
      mode: GAME_MODE.FREE_PLAY,
    });
    // ... time logging, adaptive updates same as course
    redirect(303, `${ROUTES.SIM_DEBRIEF(runId)}?returnTo=${ROUTES.SIM_FREE_PLAY}`);
  },
};
```

The debrief page reads the `returnTo` query param for its back link.

## Free Play Browse

```svelte
<!-- free-play/+page.svelte -->
<script lang="ts">
  let { data } = $props();
  let topicFilter = $state('');
  let difficultyFilter = $state('');

  let filtered = $derived(
    data.scenarios.filter(s =>
      (!topicFilter || s.faaTopics.includes(topicFilter)) &&
      (!difficultyFilter || getDifficultyBand(s.difficulty) === difficultyFilter)
    )
  );
</script>

<div class="filters">
  <select bind:value={topicFilter}>
    <option value="">All Topics</option>
    {#each faaTopics as topic}
      <option value={topic.id}>{topic.internalName}</option>
    {/each}
  </select>
  <select bind:value={difficultyFilter}>
    <option value="">All Difficulties</option>
    <option value="case_i">Case I</option>
    <option value="case_ii">Case II</option>
    <option value="case_iii">Case III</option>
  </select>
</div>

<div class="scenario-grid">
  {#each filtered as scenario}
    <a href={ROUTES.SIM_FREE_PLAY_SCENARIO(scenario.slug)} class="scenario-card">
      <h3>{scenario.title}</h3>
      <span class="difficulty">{getDifficultyLabel(scenario.difficulty)}</span>
      <span class="time">{scenario.estimatedMinutes}m</span>
      {#if scenario.lastScore !== null}
        <span class="completion-badge">{Math.round(scenario.lastScore * 100)}%</span>
      {/if}
    </a>
  {/each}
</div>
```

Filtering is client-side (all scenarios loaded). The dataset is small (< 100 scenarios).

## Drill Engine

Pure functions in `libs/engine/src/drill.ts`:

```typescript
// libs/engine/src/drill.ts

export function createDrillSession(
  questions: QuestionPoolEntry[],
  count: number,
  selectFn: typeof selectQuestions, // from adaptive engine
  memory: LearnerMemory[],
  profiles: DifficultyProfile[],
): DrillSession;

export function scoreDrillAnswer(
  question: DrillQuestion,
  selectedOptionId: string,
): { correct: boolean; explanation: string };

export function computeDrillResults(session: DrillSession): DrillResults;
```

`createDrillSession` delegates question selection to the adaptive engine's `selectQuestions()`. It assembles the selected questions into a `DrillSession` with client-friendly data (no answer keys in the client payload -- answers checked server-side).

## Drill Client State

```svelte
<!-- drill/[sessionId]/+page.svelte -->
<script lang="ts">
  let { data } = $props();

  let currentIndex = $state(0);
  let answers = $state<DrillAnswer[]>([]);
  let feedback = $state<{ correct: boolean; explanation: string } | null>(null);
  let currentQuestion = $derived(data.session.questions[currentIndex]);
  let isLast = $derived(currentIndex >= data.session.questions.length - 1);
</script>

{#if feedback}
  <div class="feedback {feedback.correct ? 'correct' : 'incorrect'}">
    <p>{feedback.correct ? 'Correct' : 'Incorrect'}</p>
    <p>{feedback.explanation}</p>
    {#if isLast}
      <form method="POST" action="?/complete">
        <input type="hidden" name="answers" value={JSON.stringify(answers)} />
        <button type="submit">See Results</button>
      </form>
    {:else}
      <button onclick={() => { currentIndex++; feedback = null; }}>Next</button>
    {/if}
  </div>
{:else}
  <div class="question">
    <p class="progress">Question {currentIndex + 1} of {data.session.questions.length}</p>
    <h2>{currentQuestion.text}</h2>
    {#each currentQuestion.options as option}
      <button
        class="option"
        onclick={() => handleAnswer(option.id)}
      >{option.text}</button>
    {/each}
  </div>
{/if}
```

Answer checking submits to a form action (server-side), which returns the feedback. This prevents the client from having access to correct answers before answering.

```typescript
// drill/[sessionId]/+page.server.ts
export const actions = {
  answer: async (event) => {
    const data = await event.request.formData();
    const questionId = data.get("questionId") as string;
    const selectedOptionId = data.get("selectedOptionId") as string;
    // Look up correct answer server-side
    const result = scoreDrillAnswer(question, selectedOptionId);
    return { correct: result.correct, explanation: result.explanation };
  },
  complete: async (event) => {
    // Record evidence, update adaptive memory, redirect to results
  },
};
```

## Key Decisions

**Why client-side filtering for free play:** The scenario catalog is small (< 100 items). Loading all and filtering in the browser is simpler than server-round-trip filtering and provides instant feedback.

**Why server-side answer checking for drill:** Sending correct answers to the client would enable cheating. The server checks each answer and returns feedback. Slightly more complex but preserves integrity.

**Why no grading threshold for drill:** Drill mode is practice. Adding pass/fail would discourage use and contradict Design Principle 6 (Emotional Safety). Learners should feel safe to practice.

**Why reuse scenario player for free play:** The gameplay is identical. Only the routing, mode tagging, and post-completion behavior differ. Reusing components avoids drift between course and free play experiences.

**Why `returnTo` query param on debrief:** The debrief page serves both course and free play completions. The back link needs to know where to go. A query param is simpler than separate debrief routes.
