---
title: 'Test Plan: Decision Reps'
product: study
feature: decision-reps
type: test-plan
status: unread
---

# Test Plan: Decision Reps

## Setup

- Study app running at `localhost:9600`
- Logged in as test user
- Spaced Memory Items feature complete (schema exists)
- No existing scenarios (fresh state)

---

## DR-1: Create a scenario with 3 options

1. Navigate to `/reps/new`.
2. Fill in: Title = "Engine rough at 800 AGL", Situation = "You're climbing through 800 AGL after takeoff from a 5,000-foot runway...", Domain = Emergency Procedures, Difficulty = Intermediate.
3. Add 3 options: (A) "Continue climbing" with outcome/whyNot, (B) "Turn back to runway" with outcome/whyNot, (C) "Land straight ahead" marked correct with outcome.
4. Fill in teaching point.
5. Click Save.
6. **Expected:** Redirected to browse page. Scenario appears in list with correct domain and difficulty.

## DR-2: Validation -- fewer than 2 options

1. Navigate to `/reps/new`.
2. Fill in all fields but only add 1 option.
3. Click Save.
4. **Expected:** Validation error: minimum 2 options required.

## DR-3: Validation -- no correct option marked

1. Navigate to `/reps/new`.
2. Add 3 options, none marked as correct.
3. Click Save.
4. **Expected:** Validation error: exactly 1 option must be marked correct.

## DR-4: Validation -- two correct options

1. Navigate to `/reps/new`.
2. Add 3 options, mark 2 as correct.
3. Click Save.
4. **Expected:** Validation error: exactly 1 option must be marked correct.

## DR-5: Browse scenarios with filters

1. Create 3 scenarios: 1 Beginner/Weather, 1 Intermediate/Regulations, 1 Advanced/Emergency Procedures.
2. Navigate to `/reps/browse`.
3. **Expected:** All 3 listed.
4. Filter by difficulty = Advanced.
5. **Expected:** Only the Advanced scenario shown.
6. Filter by domain = Weather.
7. **Expected:** Only the Weather scenario shown.

## DR-6: Rep session -- correct answer

1. Create 1 scenario.
2. Navigate to `/reps/session`.
3. Read situation. Select the correct option.
4. **Expected:** Outcome shown. Option highlighted as correct. Teaching point displayed. "Correct" indicator.

## DR-7: Rep session -- incorrect answer

1. Start a session. Select an incorrect option.
2. **Expected:** Chosen option's outcome and `whyNot` shown. Correct option highlighted. Teaching point displayed. "Incorrect" indicator.

## DR-8: Rep session -- option order randomized

1. Create a scenario with 4 options.
2. Start a session. Note the option order.
3. Complete it. Start a new session with the same scenario.
4. **Expected:** Option order may differ (randomized). Not guaranteed to differ every time, but over multiple attempts the order should vary.

## DR-9: Rep session -- confidence slider

1. Create 5+ scenarios.
2. Start a session.
3. **Expected:** On approximately half the scenarios, a confidence slider (1-5) appears BEFORE options are shown. On others, options appear directly.
4. Rate confidence, then select option.
5. **Expected:** Attempt saved with confidence value.

## DR-10: Rep session -- session summary

1. Create 3 scenarios. Start and complete a session (all 3).
2. **Expected:** Summary shows: 3 attempted, X correct, accuracy %, domains covered.

## DR-11: Rep session -- prioritizes unattempted

1. Create 5 scenarios. Attempt 2 of them.
2. Start a new session.
3. **Expected:** The 3 unattempted scenarios appear first.

## DR-12: No scenarios available

1. Ensure no scenarios exist.
2. Navigate to `/reps`.
3. **Expected:** Empty state with prompt to create scenarios.

## DR-13: Reps dashboard accuracy

1. Create scenarios. Attempt several (some correct, some not).
2. Navigate to `/reps`.
3. **Expected:** Dashboard shows accuracy by domain for last 30 days.

## DR-14: Multiple attempts on same scenario

1. Create 1 scenario. Attempt it 3 times.
2. Check that all 3 attempts are recorded (via dashboard stats or DB).
3. **Expected:** Each attempt has its own `rep_attempt` row. Accuracy reflects all attempts.
