---
title: 'Spec: Decision Reps'
product: study
feature: decision-reps
type: spec
status: unread
---

# Spec: Decision Reps

Single-decision micro-scenarios for aviation judgment practice. Read a situation, choose an option, see the outcome and teaching point. 60-120 seconds each. No tick engine, no student model, no real-time progression -- just deliberate practice on decision-making under realistic conditions.

Depends on: Spaced Memory Items (shares the study BC, schema namespace, and domain taxonomy).

## Data Model

All tables in the `study` Postgres schema namespace (same as Spaced Memory Items). IDs use `prefix_ULID` via `@ab/utils` `createId()`.

### study.scenario

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| id | text | PK | `rep_` prefix |
| user_id | text | NOT NULL | Author/owner |
| title | text | NOT NULL | Short descriptive title |
| situation | text | NOT NULL | Markdown. Sets the scene: weather, position, aircraft state, student behavior |
| options | jsonb | NOT NULL | Array of `{ id: string, text: string, isCorrect: boolean, outcome: string, whyNot: string }` |
| teaching_point | text | NOT NULL | Markdown. The key lesson regardless of which option was chosen |
| domain | text | NOT NULL | From `DOMAINS` constant |
| difficulty | text | NOT NULL | From `DIFFICULTIES` constant (beginner, intermediate, advanced) |
| phase_of_flight | text | NULL | From `PHASES_OF_FLIGHT` constant (preflight, takeoff, cruise, approach, landing, ground) |
| source_type | text | NOT NULL, DEFAULT 'personal' | From `CONTENT_SOURCES` constant |
| source_ref | text | NULL | Same pattern as cards |
| is_editable | boolean | NOT NULL, DEFAULT true | |
| reg_references | jsonb | DEFAULT '[]' | Array of regulation references (e.g., "14 CFR 91.175(c)") |
| status | text | NOT NULL, DEFAULT 'active' | active, suspended, archived |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

### study.rep_attempt

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| id | text | PK | `rat_` prefix |
| scenario_id | text | NOT NULL, FK study.scenario | |
| user_id | text | NOT NULL | |
| chosen_option | text | NOT NULL | The option `id` the user selected |
| is_correct | boolean | NOT NULL | Whether the chosen option was marked `isCorrect` |
| confidence | smallint | NULL | 1-5 pre-decision confidence (feeds calibration). NULL when not prompted |
| answer_ms | integer | NULL | Time from scenario display to option selection |
| attempted_at | timestamptz | NOT NULL, DEFAULT now() | |

## Behavior

### Scenario creation

User fills in title, situation, options (2-5), teaching point, domain, difficulty, optional phase_of_flight and reg_references. On submit:

1. Validate all fields (see Validation section).
2. Validate options: at least 2, at most 5, exactly 1 marked `isCorrect`, each has text + outcome + whyNot.
3. Create `study.scenario` with `source_type: 'personal'`, `is_editable: true`.
4. Redirect to scenario browse page.

### Scenario browsing

Browse page shows all active scenarios for the current user. Filter by domain, difficulty, phase_of_flight, source_type. Sort by created date, domain, difficulty.

### Rep session flow

1. User navigates to `/reps/session`.
2. Load function selects scenarios: prioritize those not yet attempted, then least-recently attempted, filtered by any user-selected domain/difficulty preferences. Batch of 10.
3. Show situation text. User reads.
4. On ~50% of reps (same deterministic hash approach as cards), show confidence slider (1-5) BEFORE showing options.
5. Show options (randomized order each time).
6. User selects an option.
7. Reveal: chosen option's outcome, correct option highlighted, `whyNot` for incorrect options, teaching point.
8. Record `rep_attempt`.
9. Advance to next scenario. After batch: session summary (correct count, accuracy, domains covered).

### Rep dashboard

The reps dashboard (`/reps`) shows:

- Scenarios available (total, by domain)
- Attempts today
- Accuracy by domain (last 30 days)
- Scenarios not yet attempted

### Read interfaces

Same pattern as cards -- the study BC exports:

- `getRepAccuracy(userId, domain?)` -> `{ attempted, correct, accuracy }`
- `getRepStats(userId, dateRange?)` -> `{ attemptCount, accuracy, domainBreakdown }`

## Validation

| Field | Rule |
| --- | --- |
| title | Required, 1-200 chars, trimmed |
| situation | Required, 1-10000 chars, trimmed |
| options | Required, array of 2-5 objects |
| options[].id | Required, unique within the array, 1-50 chars |
| options[].text | Required, 1-2000 chars |
| options[].isCorrect | Required, boolean. Exactly 1 must be true |
| options[].outcome | Required, 1-2000 chars |
| options[].whyNot | Required when isCorrect is false, 1-2000 chars |
| teaching_point | Required, 1-5000 chars, trimmed |
| domain | Required, must be in `DOMAINS` |
| difficulty | Required, must be in `DIFFICULTIES` |
| phase_of_flight | Optional, must be in `PHASES_OF_FLIGHT` if provided |
| reg_references | Array of strings, max 10, each 1-200 chars |
| chosen_option | Required, must match an option id in the scenario |
| confidence | Optional, integer 1-5 |

## Edge Cases

- **Scenario with only 2 options:** Valid. Display both. Still randomize order.
- **User attempts same scenario twice:** Allowed. Each attempt is a separate `rep_attempt` row. Useful for tracking improvement over time.
- **All scenarios already attempted:** Show them again, prioritizing least-recently attempted. Display "You've seen all scenarios" notice.
- **No scenarios exist:** Empty state on `/reps` with prompt to create scenarios or import from a course.
- **Option order:** Randomized on each display. Never show in the authored order to prevent position-based guessing.
- **Scenario deleted during session:** Skip, advance to next.
- **Confidence declined:** User can skip. Store NULL.

## Out of Scope

- Adaptive difficulty (adjusting which scenarios to show based on past performance)
- Aircraft-type variants (same scenario with different V-speeds or procedures)
- Missed-reps-to-cards integration (converting frequently-missed scenarios into SRS cards)
- Tick engine integration (scenarios with multi-step progression -- that's the sim app's job)
- Scenario sharing / community pool
- Timed mode (countdown pressure)
