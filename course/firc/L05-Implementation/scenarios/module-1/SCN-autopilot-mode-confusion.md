---
status: done
phase: C1
type: scenario-script
---

# SCN 1.2: IFR Descent with a Crossing Restriction

## Metadata

```
Scenario ID:     1.2
Title:           IFR Descent with a Crossing Restriction
Module:          1
Difficulty:      0.5
Duration:        12 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['AV-2', 'CJ-1']
```

## Student Model

```
Student Model:   Automation-Dependent
Parameters:
  skillLevel:         0.5
  compliance:         0.7
  freezeTendency:     0.3
  overconfidence:     0.6
  instrumentAccuracy: 0.7
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> Your student is flying an IFR cross-country in a G1000-equipped Cessna 172. The student has been using the autopilot for most of the flight and is comfortable with basic functions. You are level at 7,000 feet, 18 miles from the JONES intersection. ATC has just issued a descent clearance with a crossing restriction. Your student engages the autopilot's vertical speed mode and settles back in the seat.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Level at 7,000, 18 miles from JONES. Student selects VS mode and dials -500 fpm. At this rate, the aircraft will be at 4,000 well before JONES -- violating the crossing restriction. Student leans back, hands off the yoke.
studentSpeech:OK, autopilot is descending. I set -500 feet per minute. We'll be at 4,000 in six minutes. Easy.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Where will you be altitude-wise when you reach JONES?" Forces the student to do the mental math and discover the conflict. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to check the crossing restriction against the descent profile. Good awareness check.                              |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on descent planning is correct but the student might catch this if asked. Let them think.                          |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to change the descent rate before the student understands why. Fixes the symptom.                                 |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Aircraft is in a controlled descent, autopilot engaged. No immediate danger.                                                |

### Tick 2

```
id:           tick_2
scene:        Descending through 6,200. JONES is now 12 miles ahead. Student either worked out the problem or not. At -500 fpm, they'll cross JONES at approximately 3,600 -- 1,400 feet below the restriction. The autopilot vertical speed indicator shows VS -500 prominently.
studentSpeech:Hmm... wait. If JONES is 12 miles at our groundspeed, that's about 7 minutes... and we'll be at... uh, this doesn't work, does it?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student is realizing the problem. Help them fix it, don't keep testing. They need to act.                              |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "Good catch. What mode would let you cross JONES at the right altitude?" Teaches the mode selection, not just the fix. |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching on VNAV or altitude pre-select vs VS mode. Explains why VS mode alone doesn't protect crossing restrictions.  |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to change descent rate or use altitude pre-select. Fixes it but student doesn't learn the mode logic.        |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Student is troubleshooting their own mistake. Taking over prevents learning.                                           |

### Tick 3

```
id:           tick_3
scene:        Student tries to fix it but selects the wrong mode. Switches from VS to FLC (flight level change) without setting the target altitude to 5,000 first. The autopilot begins descending at a variable rate, still targeting 4,000. Confusion deepens as the mode annunciations change.
studentSpeech:Wait, I thought FLC would fix it. Why is it still going to 4,000? The numbers changed on the screen... what mode am I in now?
studentState: critical
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -1       | -1     | -1        | Student is mode-confused and task-saturated. Questions will overload them further.                                                                                                             |
| prompt        | tick_4        | 0           | 0        | -1     | 0         | Prompting to read the mode annunciations is correct procedure but the student is already overwhelmed by the annunciations.                                                                     |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching step-by-step: "OK, pause. Read the top line of the PFD. What does it say? Good. Now set the altitude bug to 5,000. Now re-engage VS at -200." Slow, methodical, breaks the confusion. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Disconnect the autopilot. Hand-fly level for a moment. We'll set it up correctly together." Simplifies by removing the confusion source.                                                      |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | Taking over to fix the autopilot. Resolves the immediate issue but the mode confusion goes unresolved.                                                                                         |

### Tick 4

```
id:           tick_4
scene:        4,800 feet, 4 miles from JONES. Student has been button-mashing on the autopilot panel. Multiple mode changes have occurred. The airplane is now in a wings-level climb to 4,000 (wrong altitude) with the student unaware the altitude bug is set incorrectly. JONES crossing at 5,000 is about to be violated.
studentSpeech:I don't know what it's doing. The airplane is doing something I didn't tell it to.
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                     |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student has lost situational awareness of the automation. Altitude violation imminent. Act now.                                |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting a task-saturated student 4 miles from a crossing restriction. Insufficient.                                          |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching cannot fix the mode confusion in 4 miles. Physical intervention needed.                                               |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | "Autopilot off. I have the airplane." Direct command to disconnect and hand-fly. Risky if student doesn't respond immediately. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Disconnecting autopilot, hand-flying to cross JONES at 5,000, then re-establishing correctly. Clean recovery.                  |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (coach/direct)
              \-> terminal_safe (direct)
```

## Score Summary

| Path                                               | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)                   | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Good (ask -> coach -> direct)                      | +3          | +2       | +2     | +2        | +9    | terminal_safe   |
| Late catch (ask -> ask -> prompt -> take_controls) | 0           | -2       | -2     | 0         | -4    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)              | -2          | -5       | -4     | -3        | -14   | terminal_unsafe |

## Author Notes

Mode confusion is the most common automation failure mode in glass cockpit aircraft. This scenario is modeled on actual G1000 incidents where pilots selected the wrong vertical mode and didn't understand the annunciations. The critical insight is that automation adds workload when it fails, because the pilot must now diagnose what the machine is doing AND fly the airplane. The "button-mashing" behavior in tick 4 is extremely realistic -- pilots who don't understand the modes will cycle through modes hoping one "looks right." The teaching point for the CFI is that mode confusion requires simplification, not more mode changes. The optimal intervention in tick 3 is either coaching step-by-step or directing the autopilot off entirely. The autopilot should reduce workload -- if it's increasing workload, disconnect it and hand-fly. Connects to AV-2 (recognize mode confusion) and the AC 61-83K emphasis on automation proficiency without dependency.
