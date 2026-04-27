---
title: "Test Plan: Debrief"
product: sim
feature: debrief
type: test-plan
status: done
---

# Test Plan: Debrief

## Setup

Requires at least one completed scenario run in the database. Run `bun db reset --force` to seed all scenarios and test enrollment.

---

## DEB-1: Navigate to debrief

1. Complete a scenario (from scenario player test)
2. **Expected:** Automatically redirected to `/debrief/:runId`
3. **Expected:** Outcome banner visible (SAFE, UNSAFE, or INCOMPLETE)

## DEB-2: SAFE outcome display

1. Complete the demo scenario with good interventions (safe outcome)
2. **Expected:** Banner says "SAFE" (or equivalent, no "you passed" language)
3. **Expected:** Score bars visible for all 4 dimensions
4. **Expected:** Timeline shows ticks with "Outcome: Correct" entries

## DEB-3: UNSAFE outcome display

1. Complete the demo scenario ignoring all cues (unsafe outcome)
2. **Expected:** Banner says "UNSAFE" and references student state (not "you failed")
3. **Expected:** Key misses section shows 2-3 entries
4. **Expected:** Timeline shows missed intervention opportunities

## DEB-4: Timeline accuracy

1. Complete scenario, note the interventions chosen (e.g., "Ask" on tick 1, "Direct" on tick 3)
2. On debrief, verify timeline shows:
   - "You: Ask" on tick 1
   - "You: Direct" on tick 3
   - Better alternatives where applicable
3. **Expected:** Timeline matches actual choices made

## DEB-5: "Better" shown only when needed

1. Complete scenario with 2 good and 2 bad interventions
2. On debrief timeline:
   - Good intervention ticks: should show "Outcome: Correct", no "Better:" alternative
   - Bad intervention ticks: should show "Better: [level]"

## DEB-6: Score dimensions

1. After any run, verify all 4 dimensions show bars:
   - Recognition
   - Judgment
   - Timing
   - Execution
2. **Expected:** Bars are proportional to scores (not all 0, not all 100 after a normal run)

## DEB-7: Competency + FAA tags

1. On debrief, scroll to tags section
2. **Expected:** At least one competency domain chip visible
3. **Expected:** At least one FAA topic chip visible (matching the scenario's faaTopics)

## DEB-8: Security -- can't view other user's debrief

1. Note the debrief URL: `/debrief/:runId`
2. In a different session (if possible) or by manually constructing the URL with another user's runId
3. **Expected:** 403 or redirect to login (not the other user's debrief)

## DEB-9: Non-existent runId

1. Navigate to `/debrief/does-not-exist`
2. **Expected:** 404 page

## DEB-10: Try Again button

1. On any debrief, click "Try Again"
2. **Expected:** Navigate to `/scenario/:id/brief` (the briefing screen for the same scenario)

## DEB-11: Continue button

1. On any debrief, click "Continue"
2. **Expected:** Navigate to `/course` (or module page)

## DEB-12: Replay button

1. On debrief, find "Replay" button
2. **Expected:** Either disabled/greyed with "Coming soon" label, or not present in Phase 2

---

## SECURITY-1: correctAnswer not leaked

1. Open browser dev tools -> Network tab
2. Navigate to debrief page
3. Inspect the page data (either in the HTML source or as a fetch response)
4. **Expected:** No `correctAnswer` field visible anywhere in the response (debrief doesn't use questions, but verify no question data leaks)
