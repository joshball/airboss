---
status: done
phase: C1
type: scenario-script
---

# SCN 3.3: Soft-Field Takeoff Practice

## Metadata

```
Scenario ID:     3.3
Title:           Soft-Field Takeoff Practice
Module:          3
Difficulty:      0.4
Duration:        8 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_11]
```

## Competency Links

```
competencies: ['AC-1', 'AC-2', 'CJ-1']
```

## Student Model

```
Student Model:   Timid Student
Parameters:
  skillLevel:         0.3
  compliance:         0.9
  freezeTendency:     0.7
  overconfidence:     0.1
  instrumentAccuracy: 0.4
  startleDelay:       0.6
  fatigue:            0.2
```

## Briefing

> Your student is practicing soft-field takeoffs from a 3,500-foot runway. The student has been making good progress today but tends to be tentative with pitch inputs. The student has 30 hours total time and this is the fourth soft-field takeoff of the lesson. Light winds, clear skies.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Just airborne, 50 feet AGL. Nose pitching up through 12 degrees. Airspeed 62 knots and not accelerating. Student is gripping yoke tightly and staring at the end of the runway.
studentSpeech:We're climbing, right? This feels normal?
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2        | +1          | +1       | +1     | 0         | Good diagnostic question. "What's your airspeed?" makes the student look at the instrument -- teaching moment.  |
| prompt        | tick_2        | +1          | +1       | +1     | 0         | Drawing attention to the pitch attitude and airspeed. Appropriate for a student who is asking for confirmation. |
| coach         | tick_2        | +1          | 0        | 0      | 0         | Coaching slightly ahead of the need. Student asked a genuine question -- a simpler response works here.         |
| direct        | tick_2        | 0           | -1       | 0      | +1        | Directing pitch-down on a soft-field takeoff where the student is slightly nose-high. Over-controlling early.   |
| take_controls | terminal_safe | 0           | -3       | 0      | -1        | Taking controls at 50 AGL during a slightly nose-high climb. Massive over-reaction.                             |

### Tick 2

```
id:           tick_2
scene:        100 feet AGL. Pitch attitude 15 degrees. Airspeed 58 knots, decaying. Student has not adjusted pitch despite prior input. Hands are rigid on the yoke.
studentSpeech:I don't want to push the nose down -- we'll hit the ground.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                            |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | 0        | -1     | 0         | The student just told you they're afraid to lower the nose. Questions won't overcome that fear -- they need guidance. |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | Prompting to check airspeed and lower the nose slightly. Respects the student's fear while directing attention.       |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching through the pitch correction. "Ease the nose down just a couple degrees -- watch the airspeed come alive."   |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing the pitch change works but misses the chance to address the underlying fear that caused the problem.        |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student was communicating and responsive. Taking controls here damages confidence in a timid student.                 |

### Tick 3

```
id:           tick_3
scene:        120 feet AGL. Pitch 17 degrees. Airspeed 52 knots. Stall horn begins chirping. Student's eyes are wide and hands are frozen on the yoke.
studentSpeech:...
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Student is frozen and the stall horn is sounding. Questions are useless.                                  |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting a frozen student near a stall. They cannot process subtle input right now.                      |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching at the edge. Student may or may not unfreeze. Risk is high.                                      |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | Clear, calm direction: "Push the nose down now." Firm enough to break the freeze, matched to the urgency. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls from a frozen student near stall is justified. Positive exchange, recover, teach later.   |

### Tick 4

```
id:           tick_4
scene:        110 feet AGL. Airspeed 47 knots. Full stall horn. Left wing drops slightly. Student is motionless.
studentSpeech:...
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                              |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student is frozen in a departure stall at 110 AGL. Verbal intervention is meaningless.                  |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting during an active stall with a frozen student. No effect.                                      |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching cannot overcome the freeze at this point. Physical intervention required.                      |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | Commanding works if the student unfreezes, but the freeze tendency is high. Marginal outcome.           |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls is the only reliable intervention. Recover the aircraft, address the freeze in debrief. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (direct/take_controls)
              \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                        | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +1          | -1       | -2     | 0         | -2    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -4       | -5     | -3        | -14   | terminal_unsafe |

## Author Notes

Departure stalls kill because they happen at low altitude with no room for recovery. This scenario uses the Timid Student model -- opposite of the overconfident student in 3.1. The student's fear of pushing the nose down (a common real-world student behavior) is the root cause. The freeze at tick 3 is the key moment: a timid student with high freezeTendency (0.7) goes silent under pressure. The CFI must recognize that the silence IS the problem -- not confusion, not defiance, but paralysis. The teaching point is that the intervention ladder still applies: you can try directing first, but with a frozen student near the ground, taking controls may be the only reliable option. Debrief should address the underlying fear, not just the mechanics.
