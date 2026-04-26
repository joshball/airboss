---
status: done
phase: C1
type: scenario-script
---

# SCN 3.2: Third Takeoff in the Pattern

## Metadata

```
Scenario ID:     3.2
Title:           Third Takeoff in the Pattern
Module:          3
Difficulty:      0.5
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_11, FAA_TOPIC.A_5]
```

## Competency Links

```
competencies: ['AC-2', 'RM-2', 'CJ-2']
```

## Student Model

```
Student Model:   Overconfident Student
Parameters:
  skillLevel:         0.4
  compliance:         0.6
  freezeTendency:     0.3
  overconfidence:     0.8
  instrumentAccuracy: 0.5
  startleDelay:       0.4
  fatigue:            0.2
```

## Briefing

> You are conducting pattern work with your student at a non-towered airport. This is the third circuit of the session. The departure end of the runway is behind you and there is open farmland ahead with some scattered trees. Your student has 45 hours total time and the previous two landings were solid.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        400 AGL on crosswind, engine coughs and RPM drops from 2400 to 1800. Aircraft begins to sink. Student's hands tighten on the yoke.
studentSpeech:What was that? The engine -- something's wrong!
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2a       | +1          | +1       | +1     | 0         | Good initial probe. Student recognized the power loss -- now see if they can troubleshoot.                     |
| prompt        | tick_2a       | +1          | +1       | +1     | 0         | Appropriate prompt to direct attention to airspeed and options. Situation is developing but not critical yet.  |
| coach         | tick_2b       | +1          | 0        | 0      | 0         | Coaching is slightly ahead of the need. Student recognized the problem -- give a moment to process.            |
| direct        | tick_2b       | 0           | -1       | 0      | +1        | Directing immediately removes the chance to see how the student processes an emergency.                        |
| take_controls | terminal_safe | 0           | -2       | 0      | +1        | Taking controls at 400 AGL with partial power. Safe outcome but major over-reaction -- student learns nothing. |

### Tick 2a

```
id:           tick_2a
scene:        350 AGL, RPM fluctuating 1600-1800. Airspeed 72 knots and holding. Student is scanning instruments but hasn't pitched for best glide or made a decision about direction.
studentSpeech:Should I try to turn back? I think I can make the runway.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | More questions while altitude is bleeding. The "turn back" impulse is dangerous -- address it now.                  |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | Drawing attention to altitude, airspeed, and the field ahead. Countering the turn-back impulse without taking over. |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching through the decision. Appropriate level -- student needs guidance on the plan, not just awareness.         |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to land ahead works, but student missed the chance to process the decision themselves.                    |
| take_controls | terminal_safe | 0           | -1       | 0      | +1        | Taking controls with altitude to work with. Student was talking, not frozen.                                        |

### Tick 2b

```
id:           tick_2b
scene:        350 AGL, RPM fluctuating 1600-1800. Student is looking around but hands are steady. Airspeed 72 knots.
studentSpeech:OK... power is low. What do I do here?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student asked for help. More questions without guidance wastes altitude.                                  |
| prompt        | tick_3        | +1          | +1       | 0      | 0         | Prompt helps but student explicitly asked for guidance -- coaching is more appropriate.                   |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Student asked what to do. Coaching through "pitch for best glide, pick a field ahead" is the right level. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing works but the student was ready to learn. Missed opportunity.                                   |
| take_controls | terminal_safe | 0           | -1       | 0      | +1        | Student was calm and asking questions. Taking controls was unnecessary.                                   |

### Tick 3

```
id:           tick_3
scene:        250 AGL. RPM drops to 1400 and stabilizes. Airspeed 68 knots -- below best glide. Student begins a left turn back toward the runway. Bank angle 25 degrees.
studentSpeech:I'm going to try for the runway -- I think I can make it.
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                               |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Asking questions while the student turns back at 250 AGL. The impossible turn is developing.             |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting is insufficient. The turn-back at this altitude is the #1 killer in engine failure scenarios.  |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching at 250 AGL in a turn. Barely adequate -- student may or may not comply in time.                 |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | Clear direction: wings level, pitch for glide, land in the field ahead. Student complies.                |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls is fully justified. Low altitude, decreasing airspeed, turn toward stall/spin territory. |

### Tick 4

```
id:           tick_4
scene:        150 AGL. Turning through crosswind heading. Bank angle 30 degrees. Airspeed 63 knots. Stall horn chirps. The runway is behind and below.
studentSpeech:...
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                     |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Questions at 150 AGL in a stalling turn-back. Catastrophic delay.                              |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting while the aircraft is stalling in a turn at 150 AGL. Ineffective.                    |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching at the edge of a stall/spin. Student cannot process guidance here.                    |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | Directing at the last possible moment. Student rolls wings level and pitches down. Very tight. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls prevents the stall/spin. Off-airport landing in the field is survivable.       |

## Tick Graph

```
tick_1 -> tick_2a -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
     \                   \         \-> terminal_safe (direct/take_controls)
      \                   \-> terminal_safe (direct/take_controls)
       \-> tick_2b -> tick_3 -> ...
                  \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                        | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -6       | -5     | -3        | -16   | terminal_unsafe |

## Author Notes

The "impossible turn" is the #2 LOC killer after base-to-final stall/spin. At 400 AGL with partial power, the temptation to turn back is strong, but the physics are against you below 800-1000 AGL in most trainers. The overconfident student model amplifies this -- the student thinks they can make it because they've never experienced how fast altitude disappears in a turn with reduced power. The tick_2a/tick_2b branch lets the scenario respond to whether the CFI let the student think (2a -- student comes up with the dangerous idea themselves) or coached early (2b -- student asks for help). Both paths converge at tick_3 where the student attempts the turn-back regardless -- the question is whether the CFI intervenes decisively enough.
