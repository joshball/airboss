---
title: "Test Plan: Scenario Player"
product: sim
feature: scenario-player
type: test-plan
status: done
---

# Test Plan: Scenario Player

## Setup

```bash
bun db reset --force   # fresh DB with all seeds + test enrollment
bun scripts/dev.ts sim
```

Requires: an enrollment record for the dev user.

---

## BRIEF-1: Navigate to briefing

1. From `/course`, click on the demo scenario
2. **Expected:** Navigate to `/scenario/:id/brief`
3. **Expected:** Scenario title, situation description, and objectives visible
4. **Expected:** "Call the Ball" button visible

## BRIEF-2: Scenario not found

1. Navigate to `/scenario/does-not-exist/brief`
2. **Expected:** 404 page (not a crash)

---

## PLAY-1: Start the scenario

1. On briefing screen, click "Call the Ball"
2. **Expected:** Navigate to `/scenario/:id`
3. **Expected:** Scene description shown
4. **Expected:** Student speech shown
5. **Expected:** Intervention ladder visible (Ask, Prompt, Coach, Direct, Take Controls)

## PLAY-2: Intervention advances the tick

1. Click "Ask" on the first tick
2. **Expected:** New scene description appears (tick advanced)
3. **Expected:** Student speech updates
4. **Expected:** No page reload (client-side state)

## PLAY-3: Work through all intervention levels

1. Play through the scenario choosing a variety of interventions (Ask, Prompt, Coach, Direct, Take Controls)
2. **Expected:** Each click advances the tick smoothly
3. **Expected:** No errors in browser console

## PLAY-4: Scenario completes -- safe outcome

1. Play the scenario making good (safe-window) interventions
2. **Expected:** On terminal tick, auto-submits and redirects to `/debrief/:runId`
3. **Expected:** Debrief URL contains a valid run ID

## PLAY-5: Scenario completes -- unsafe outcome

1. Play the scenario ignoring all intervention cues
2. **Expected:** Reaches `terminal_unsafe`, redirects to debrief
3. **Expected:** Debrief shows unsafe outcome (not a crash)

## PLAY-6: Over-intervention

1. Click "Take Controls" on the first tick when not yet necessary
2. **Expected:** Scenario advances (over-intervention is recorded, not blocked)
3. **Expected:** After completion, debrief shows judgment penalty

---

## EVIDENCE-1: Run recorded in database

1. Complete a scenario
2. Query: `SELECT * FROM evidence.scenario_run WHERE user_id = '...' ORDER BY started_at DESC LIMIT 1`
3. **Expected:** Row exists with correct `scenario_id`, `outcome`, `score`, `duration_seconds`

## EVIDENCE-2: Evidence packet recorded

1. After completing, query `evidence.evidence_packet` for the run
2. **Expected:** `topics_covered`, `competencies_exercised`, `actions_taken` are non-empty

## EVIDENCE-3: Time logged

1. After completing, query `enrollment.time_log` for the enrollment
2. **Expected:** New row with `faa_qualified = true`, `duration_seconds > 0`

---

## ABORT-1: Call it out (abort)

1. Start a scenario, play 2-3 ticks
2. Click "Call it out"
3. **Expected:** Redirect to `/course` (not debrief)
4. Query `evidence.scenario_run`
5. **Expected:** Row with `outcome = 'incomplete'` (or no row -- either is acceptable for Phase 2)

---

## REFRESH-1: Browser refresh during play

1. Start a scenario, play 1 tick
2. Refresh the page
3. **Expected:** Returns to briefing or start of scenario (not crashed, run lost is acceptable)
4. **Expected:** No corrupt DB records from the interrupted run
