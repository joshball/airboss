---
title: "Test Plan: Game Modes"
product: sim
feature: game-modes
type: test-plan
status: done
---

# Test Plan: Game Modes

## Setup

```bash
bun db reset --force   # fresh DB with all seeds + test enrollment
bun scripts/dev.ts sim
```

Requires: enrolled user, multiple published scenarios, FAA questions in the pool.

---

## FP-1: Free Play browse page loads

1. Navigate to `/free-play`
2. **Expected:** All published scenarios listed
3. **Expected:** Each shows title, module, difficulty, estimated time

## FP-2: Filter by FAA topic

1. On `/free-play`, select a topic filter
2. **Expected:** Only scenarios covering that topic shown

## FP-3: Filter by difficulty

1. On `/free-play`, select "Case I" difficulty
2. **Expected:** Only introductory-difficulty scenarios shown

## FP-4: Completion badge shown

1. Complete a scenario in free play (or previously in course mode)
2. Return to `/free-play`
3. **Expected:** That scenario shows a completion badge with last score

## FP-5: Play a free play scenario

1. Select a scenario from `/free-play`
2. **Expected:** Navigate to `/free-play/:id/brief`
3. Click "Call the Ball"
4. **Expected:** Standard player loads at `/free-play/:id`
5. Complete the scenario
6. **Expected:** Redirect to debrief

## FP-6: Evidence recorded with free_play mode

1. After completing a free play scenario, query `evidence.scenario_run`
2. **Expected:** Row exists with `mode = 'free_play'`
3. Query `enrollment.time_log`
4. **Expected:** Time logged with `faaQualified = true`

## FP-7: Free play does not advance course progress

1. Note current module progress
2. Complete a scenario in free play that belongs to an incomplete module
3. Check module progress
4. **Expected:** Module progress unchanged

## FP-8: Debrief back link

1. Complete a free play scenario, arrive at debrief
2. Click "Back" or "Continue"
3. **Expected:** Returns to `/free-play` (not `/course`)

---

## DR-1: Drill setup page loads

1. Navigate to `/drill`
2. **Expected:** Question count selector visible (10, 20, 30, 50)
3. **Expected:** Optional topic and domain filters
4. **Expected:** "Start Drill" button

## DR-2: Start a drill session

1. Select 10 questions, no filters
2. Click "Start Drill"
3. **Expected:** Redirect to `/drill/:sessionId`
4. **Expected:** First question displayed with options

## DR-3: Answer a question

1. During a drill, select an answer
2. **Expected:** Immediate feedback -- correct (green) or incorrect (red)
3. **Expected:** Explanation text shown
4. **Expected:** "Next" button appears

## DR-4: Progress through drill

1. Answer 3 questions
2. **Expected:** Progress bar shows "3 of 10"
3. **Expected:** Each question different (no repeats within session)

## DR-5: Complete a drill

1. Answer all 10 questions
2. **Expected:** Redirect to `/drill/:sessionId/results`
3. **Expected:** Accuracy percentage shown
4. **Expected:** Average time per question shown
5. **Expected:** Domain breakdown shown

## DR-6: Evidence recorded for drill

1. After completing a drill, query `evidence.scenario_run`
2. **Expected:** Row with `mode = 'drill'`, `outcome = 'complete'`
3. Query `enrollment.time_log`
4. **Expected:** Time logged for drill duration

## DR-7: Adaptive memory updated

1. After completing a drill, query `enrollment.learner_memory`
2. **Expected:** Memory records updated for each answered question

## DR-8: Try Again

1. On results page, click "Try Again"
2. **Expected:** New drill session created with same settings
3. **Expected:** Different question selection (adaptive)

## DR-9: Insufficient questions

1. Filter to a topic with < 10 FAA questions
2. Select 10 questions
3. **Expected:** Drill starts with all available questions (less than 10)
4. **Expected:** Actual count shown in progress bar

## DR-10: Browser refresh during drill

1. Start a drill, answer 3 questions
2. Refresh the page
3. **Expected:** Drill session lost, returns to `/drill` setup
4. **Expected:** No partial records in DB

---

## NAV-1: Navigation links

1. Check sim navigation bar
2. **Expected:** "Free Play" and "Drill" links visible
3. Click each
4. **Expected:** Navigates to correct page
