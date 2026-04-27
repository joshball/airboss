---
status: done
phase: C1
type: scenario-script
---

# SCN 3.1: Visual Approach to Runway 27

## Metadata

```
Scenario ID:     3.1
Title:           Visual Approach to Runway 27
Module:          3
Difficulty:      0.3
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_11]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-2', 'AC-1', 'AC-2', 'RM-2']
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

> Your student is flying a visual approach to runway 27. Winds are from the south, stronger than forecast. You are on base leg at pattern altitude. The student has 65 hours and tends to be aggressive with corrections.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Base leg, 1000 AGL. Student begins turn to final. Wind is 190 at 15 gusting 22.
studentSpeech:Turning final... looks a little wide but I got it.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------- |
| ask           | tick_2        | +1          | +1       | +1     | 0         | Good situational probing. Student is overconfident but not yet in danger. |
| prompt        | tick_2        | +1          | 0        | +1     | 0         | Slightly heavy-handed for a nominal situation, but not harmful.           |
| coach         | tick_2        | +1          | -1       | 0      | 0         | Coaching at this stage undermines student autonomy. Too early.            |
| direct        | tick_2        | 0           | -2       | 0      | 0         | Directing on a nominal base turn. Significant over-intervention.          |
| take_controls | terminal_safe | 0           | -3       | 0      | -1        | Taking controls on a normal base turn. Completely unnecessary.            |

### Tick 2

```
id:           tick_2
scene:        Overshooting final. Bank angle increasing to 35 degrees. Airspeed decreasing through 75 knots.
studentSpeech:I can make it... just need a little more bank.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | 0        | -1     | 0         | Asking questions while the student is overshooting. Situation needs more direct input. |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | Good prompt. Drawing attention to bank angle and airspeed without taking over.         |
| coach         | tick_3        | +1          | +1       | 0      | +1        | Coaching is appropriate here. Guiding without directing.                               |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing works but removes a learning opportunity. Student was recoverable.           |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Taking controls during a recoverable overshoot. Over-intervention.                     |

### Tick 3

```
id:           tick_3
scene:        Bank angle 40 degrees. Airspeed 68 knots and decreasing. Stall horn intermittent. Student is fixated on runway.
studentSpeech:Almost there... I can see the numbers.
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                       |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Asking questions during a stall approach. Dangerously passive.                   |
| prompt        | tick_4        | 0           | -1       | -1     | -1        | Prompting is too subtle for a critical situation. Student needs clear direction. |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching barely adequate. Student is at the edge -- firmer intervention needed.  |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | Clear direction at the right moment. Student levels wings and adds power.        |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls was justified. Stall was imminent.                               |

### Tick 4

```
id:           tick_4
scene:        Stall horn continuous. Bank angle 45 degrees. Airspeed 62 knots. Nose dropping.
studentSpeech:...
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                       |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Asking questions during an active stall. Catastrophic inaction.  |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting during a stall. Ineffective.                           |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching during a stall. Too late for guidance.                  |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | Direction at the last moment. Student recovers but it was close. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls at the right moment. Clean recovery.             |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                                   \-> terminal_safe (direct/take_controls)
                        \-> terminal_safe (direct/take_controls)
              \-> terminal_safe (direct/take_controls)
   \-> terminal_safe (take_controls)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                        | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +2          | 0        | -1     | 0         | +1    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -4       | -5     | -3        | -14   | terminal_unsafe |

## Author Notes

Reference implementation. Modeled on NTSB stall/spin accident data in the base-to-final turn. The classic LOC scenario -- student tightens the turn, trades airspeed for bank angle, fixates on the runway. AC 61-83K identifies this as the #1 LOC accident profile. The overconfident student model ("I got it") delays recognition by the CFI because the student sounds confident even as parameters degrade.
