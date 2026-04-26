---
title: "Test Plan: Engine Wiring"
product: sim
feature: engine-wiring
type: test-plan
status: unread
---

# Test Plan: Engine Wiring

## Setup

- DB running with seeded data (scenarios, questions, student models, competencies, modules)
- At least one published release via hangar
- Sim app running locally
- Logged in as a test learner with an active enrollment

---

## EW-1: Course page shows scenarios

1. Navigate to `/course` in sim
2. **Expected:** Scenarios appear grouped by module. Each shows title, difficulty, duration. Cards are clickable.

## EW-2: Scenario brief loads

1. Click any scenario from the course page
2. **Expected:** Brief page shows scenario title, briefing text, difficulty badge, duration, FAA topics. "Call the Ball" button is visible.

## EW-3: Player loads first tick

1. Click "Call the Ball" from the brief page
2. **Expected:** Player page shows: scene description, student speech (quoted), student state indicator. 5 intervention buttons visible (Ask, Prompt, Coach, Direct, Take Controls).

## EW-4: Intervention advances to next tick

1. Click any intervention button (e.g., "Ask")
2. **Expected:** Scene updates to next tick. Student speech changes. Student state may change. All 5 buttons still visible and identical.

## EW-5: No intervention hints

1. Observe the 5 intervention buttons across multiple ticks
2. **Expected:** All buttons look identical (same styling, size, position). No visual cues indicating which is "correct." Per design principle: Never a Trick.

## EW-6: Terminal state reached

1. Play through all ticks until the scenario ends
2. **Expected:** "Scenario Complete" message appears. Outcome shown (safe or unsafe). Submit button visible.

## EW-7: Debrief displays correctly

1. Submit the completed scenario
2. **Expected:** Redirected to `/debrief/{runId}`. Shows:
   - Outcome banner (SAFE green or UNSAFE red)
   - 4 score dimension bars (recognition, judgment, timing, execution)
   - Overall score percentage
   - Key misses (up to 3 worst decisions with what you should have done)
   - Full timeline (each tick: scene, your choice, best choice, annotation)
   - FAA topics and competencies covered

## EW-8: Debrief actions work

1. On the debrief page, click "Try Again"
2. **Expected:** Navigates back to the brief page for the same scenario.
3. Click "Continue"
4. **Expected:** Navigates back to the course page.

## EW-9: Free-play flow

1. Navigate to `/free-play`
2. **Expected:** Scenario cards appear with difficulty, duration, last score.
3. Play through a scenario via free-play
4. **Expected:** Debrief shows with "Back to Free Play" link instead of "Continue."

## EW-10: Scenario with unsafe outcome

1. Play a scenario and deliberately choose poor interventions (e.g., "Ask" when the situation is critical)
2. **Expected:** Reaches terminal_unsafe. Debrief shows UNSAFE outcome with low scores. Key misses highlight where better intervention was needed.

## EW-11: Multiple scenario completions

1. Complete 2-3 different scenarios
2. **Expected:** Module progress updates (visible in course page or progress page). FAA time logged per topic.

## EW-12: Abort scenario

1. Start a scenario, play 1-2 ticks
2. Click abort/back (if available)
3. **Expected:** Scenario recorded as INCOMPLETE. Redirected to course page. No crash.
