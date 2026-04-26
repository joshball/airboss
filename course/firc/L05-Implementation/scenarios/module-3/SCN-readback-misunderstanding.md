---
status: done
phase: C1
type: scenario-script
---

# SCN 3.6: Pattern Work at a Towered Airport

## Metadata

```
Scenario ID:     3.6
Title:           Pattern Work at a Towered Airport
Module:          3
Difficulty:      0.5
Duration:        8 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_6]
```

## Competency Links

```
competencies: ['OD-1', 'OD-2', 'CJ-1']
```

## Student Model

```
Student Model:   Parroting Student
Parameters:
  skillLevel:         0.2
  compliance:         0.9
  freezeTendency:     0.2
  overconfidence:     0.3
  instrumentAccuracy: 0.3
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> You are in the pattern at a towered airport with your student. The pattern is busy with three other aircraft in the sequence. Tower has issued a traffic advisory and a clearance to extend downwind for sequencing behind a Cessna on a long final. Your student has 50 hours and handles radio communications eagerly.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Downwind leg, 1,200 AGL. Tower said "Extend downwind, I'll call your base, traffic is a Cessna 3-mile final." Student reads back "Roger, turning base, traffic in sight" and begins a left turn toward base.
studentSpeech:I see the Cessna. Turning base now.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2        | +1          | +1       | +1     | 0         | Good diagnostic: "What exactly did tower tell us to do?" Makes the student compare their readback to the actual clearance. |
| prompt        | tick_2        | +1          | +1       | +1     | 0         | Prompting to listen to the clearance again. "I don't think tower cleared us for base." Immediate and clear.                |
| coach         | tick_2        | +1          | 0        | 0      | +1        | Coaching is effective but the student already started the turn. Faster input is better here.                               |
| direct        | tick_2        | +1          | 0        | 0      | +1        | Directing to stop the turn works but the student doesn't learn to catch their own readback errors.                         |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Taking controls because of a readback error on downwind. Massive over-reaction to a correctable error.                     |

### Tick 2

```
id:           tick_2
scene:        Student has either continued turning or leveled off depending on prior intervention. Tower calls: "[Callsign], I said extend downwind, not turn base. Continue downwind, I'll call your base."
studentSpeech:Oh... I thought they said turn base. Sorry, going back to downwind.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | 0      | 0         | Tower just corrected the student. More questions delay the fix. Coach the readback technique now.                                   |
| prompt        | tick_3     | +1          | +1       | 0      | 0         | Prompting to extend downwind is fine but the student already got that from tower. Address the root cause.                           |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Coaching on readback technique: "When you read back, use the exact words tower gave you. Let's practice." Addresses the root cause. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing compliance is fine but doesn't teach why the error happened.                                                              |
| take_controls | tick_3     | 0           | -2       | 0      | -1        | Tower already corrected the situation. Taking controls is unnecessary and demoralizing.                                             |

### Tick 3

```
id:           tick_3
scene:        Extended downwind, now 2 miles from the runway. Tower calls: "[Callsign], turn base, runway 24, cleared to land." Student reads back: "Turning base, cleared to land, runway 24."  But the student begins turning toward runway 28, not 24.
studentSpeech:Base turn for 24... wait, which one is 24?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | 0           | -1       | -1     | 0         | Student is confused about which runway is which. Socratic questions will not help while they're turning toward the wrong one.          |
| prompt        | terminal_safe | +1          | +1       | +1     | +1        | Prompt to check heading and runway numbers. "Look at your heading indicator -- which direction is runway 24?" Teachable and effective. |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching through the runway identification. "Runway numbers match the magnetic heading. 24 is to your left." Root-cause instruction.   |
| direct        | terminal_safe | +1          | 0        | +1     | +1        | Directing the correct turn prevents the error but student doesn't build the mental model.                                              |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student is on downwind making a base turn. Wrong direction, but no immediate danger. Over-intervention.                                |

### Tick 4

```
id:           tick_4
scene:        Student has turned toward runway 28 and is established on a base leg for the wrong runway. Another aircraft is on final for 28 and calls traffic in sight. Tower calls: "[Callsign], you are heading for runway 28. Runway 24 is to your south. Turn left immediately."
studentSpeech:I'm sorry, I'm lost. Which way do I go?
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                          |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -1          | -2       | -2     | -1        | Student is confused and heading for occupied runway. Questions are dangerous here.                                                  |
| prompt        | terminal_unsafe | 0           | -1       | -1     | -1        | Prompting a confused student with a traffic conflict. They need clear direction.                                                    |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | Coaching might work -- "Turn left now, look for the runway numbers on the pavement" -- but margin is thin with conflicting traffic. |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | Clear direction: "Turn left heading 180 now." Resolves the conflict. Debrief the confusion on the ground.                           |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls with a traffic conflict and a confused student. Justified.                                                          |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt)
                        \         \-> terminal_safe (coach/direct/take_controls)
                         \-> terminal_safe (prompt/coach/direct)
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome         |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> prompt)                | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> ask -> direct) | +1          | -2       | -1     | +1        | -1    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)           | -1          | -4       | -4     | -1        | -10   | terminal_unsafe |

## Author Notes

This scenario uses the Parroting Student archetype -- high compliance, low skill. The student reads back confidently but the words don't match the clearance. This is the most insidious error pattern: the student sounds correct, so neither ATC nor the instructor immediately catches it. The key insight is that parroting compliance masks comprehension gaps. The readback error in tick 1 is subtle (student says "turning base" when told "extend downwind") -- a CFI who is half-listening or trusting the student's confident tone will miss it. Tick 3 introduces the second layer: even with a correct readback, the student doesn't know which runway is which. The scenario tests whether the CFI is monitoring at the comprehension level, not just the compliance level. Connects directly to OD-1/OD-2 and the deviation prevention emphasis in AC 61-83K.
