---
status: done
phase: C1
type: scenario-script
---

# SCN 3.8: Gusty Crosswind Final

## Metadata

```
Scenario ID:     3.8
Title:           Gusty Crosswind Final
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
competencies: ['AC-1', 'RM-2']
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

> Your student is flying the approach to runway 36 on a breezy afternoon. Winds are from the west and have been increasing throughout the lesson. Your student had a good crosswind landing earlier today in lighter conditions. ATIS is current. The student has 70 hours and is working toward solo cross-country endorsement.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Two-mile final, 800 AGL. Airspeed fluctuating between 72 and 80 knots. Student is holding a crab angle of 15 degrees. Occasional bumps but aircraft is tracking centerline.
studentSpeech:Winds are a little stronger than before, but I've got it. That last landing was great.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2        | +1          | +1       | +1     | 0         | "What's your crosswind component right now?" Forces the student to do the math and compare to personal limits. |
| prompt        | tick_2        | +1          | +1       | +1     | 0         | Prompting attention to the gust factor. "What's the difference between 12 knots steady and 18 gusting 28?"     |
| coach         | tick_2        | +1          | 0        | 0      | 0         | Coaching on the approach is fine but the student is flying adequately at this point.                           |
| direct        | tick_2        | 0           | -1       | 0      | 0         | Directing a go-around on a stabilized approach at 2 miles. The approach isn't unstable yet.                    |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Taking controls on a stable approach. Destroys student confidence for no reason.                               |

### Tick 2

```
id:           tick_2
scene:        One-mile final, 500 AGL. Wind gust hits -- airspeed spikes to 85 then drops to 65. Aircraft displaced 50 feet left of centerline. Student over-corrects right.
studentSpeech:Whoa! OK, getting it back... there. See, I can handle this.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                               |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3        | 0           | -1       | -1     | 0         | The approach just became unstable with windshear. Asking questions while the student over-corrects wastes decision time. |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | Prompting to evaluate: "Is this approach stabilized? What's our go-around criteria?" Builds ADM in real time.            |
| coach         | tick_2b       | +1          | +1       | +1     | +1        | Coaching the decision framework: "We're exceeding the gust limits. What does the stabilized approach checklist say?"     |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing a go-around. Safe outcome but student may not understand why -- they thought they were handling it.            |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Aircraft is displaced but recoverable at 500 AGL. Over-reaction.                                                         |

### Tick 2b

```
id:           tick_2b
scene:        Student considers the coaching. Airspeed back to 75, tracking centerline but still gusting. Another bump pushes the aircraft right.
studentSpeech:I guess we are over my limit... but we're so close. Can't we just finish this one?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                    |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student is rationalizing exceeding limits. Questions may be heard as permission to continue.                                  |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompt is adequate but the student is asking for permission, not information. Address the decision.                           |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Limits exist for this exact moment. We go around, set up again, and see if conditions improve." Student initiates go-around. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Go around." Clear and appropriate. The student already acknowledged exceeding limits -- now enforce them.                    |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | Student was communicating and able to fly. Taking controls sends a fear-based message.                                        |

### Tick 3

```
id:           tick_3
scene:        Half-mile final, 200 AGL. Strong gust from the left. Airspeed drops to 60 knots. Aircraft yaws 20 degrees and student over-controls with right rudder. Wing drops right, aircraft below glidepath.
studentSpeech:I've got it, I've got it!
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                              |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Aircraft is low, slow, and yawed at 200 AGL. Not a discussion.                                          |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting at 200 AGL with windshear. The approach is unstable and the student is fighting the airplane. |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching at 200 AGL in gusty conditions. The student says they have it -- they do not.                  |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Go around. Full power, pitch up, positive rate." Clear go-around call saves the situation.             |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls to execute the go-around. Justified at 200 AGL with an unstable approach and windshear. |

### Tick 4

```
id:           tick_4
scene:        100 AGL. Aircraft drifts left of centerline. Right main touches first, aircraft bounces. Wind gust catches the aircraft during the bounce. Student freezes on the controls.
studentSpeech:...
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                   |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Aircraft is bouncing in a crosswind. Student is frozen. Talking is catastrophically insufficient.            |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting during a bounced landing in gusty crosswind. Student cannot process.                               |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching through a bounce. Student's hands are frozen.                                                       |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | "FULL POWER, GO AROUND." Might break through the freeze if student's hands respond. Marginal.                |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls during a bounced landing in gusty crosswind. Textbook takeover situation. Execute go-around. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
              \         \         \-> terminal_safe (direct/take_controls)
               \         \-> terminal_safe (direct/take_controls)
                \-> tick_2b -> tick_3 -> ...
                         \-> terminal_safe (coach/direct)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> coach in 2b)                    | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Good (prompt -> prompt -> direct)                        | +2          | +1       | +1     | +2        | +6    | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -6       | -5     | -3        | -16   | terminal_unsafe |

## Author Notes

This scenario highlights the "get-there-itis" variant of LOC: the student had a good crosswind landing earlier and extrapolates that success to conditions that exceed their limits. The overconfident student model drives the "I've got it" responses even as conditions deteriorate. The key teaching moment is tick 2/2b: the crosswind component (18 knots direct, gusting to 28) clearly exceeds the student's personal limit (12 knots) and the school limit (15 knots). The optimal response is to coach the student through recognizing the limit violation and making the go-around decision themselves. Tick 3-4 escalates to a windshear event and bounced landing -- by this point, only firm intervention works. The scenario reinforces that personal minimums and go-around decisions should be made early, not at the last moment when physics is already against you. Connects to RM-2 (dynamic risk reassessment) and the GA safety trend data on approach-and-landing accidents in gusty conditions.
