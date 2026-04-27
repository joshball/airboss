---
status: done
phase: C1
type: scenario-script
---

# SCN 1.3: Vectors for the GPS Approach at Minimums

## Metadata

```
Scenario ID:     1.3
Title:           Vectors for the GPS Approach at Minimums
Module:          1
Difficulty:      0.5
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['AV-3', 'AV-1']
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

> Your student is flying an IFR cross-country and is being vectored for the GPS approach at your destination. You are five miles from the initial approach fix. The weather is right at IFR minimums -- ceiling 300 feet, visibility 1 mile. The destination also has an ILS approach available. Your student has 85 hours of instrument time and is configuring for the approach.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Being vectored to the IAF, 5 miles out. GPS shows "RAIM NOT AVAILABLE" in amber. CDI flag appears. Student hasn't noticed -- looking at the approach plate.
studentSpeech:Almost at the fix. Ready for the approach. Should I start configuring for descent?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Check the GPS status. What does it say?" Forces the student to scan and find the alert.          |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to check GPS integrity status before beginning the approach. Good procedural awareness. |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on RAIM before the student has seen the alert. Teach through discovery, not lecture.     |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Telling the student about the alert removes the discovery moment.                                 |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Being vectored in IMC, no approach has begun. No safety issue.                                    |

### Tick 2

```
id:           tick_2
scene:        Student sees the RAIM alert. CDI flag is displayed. Student looks confused and starts tapping the GPS, trying to make the alert go away.
studentSpeech:RAIM not available? What does that mean? The approach is still loaded. Can we just fly it anyway? It was working a minute ago.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student doesn't know what RAIM is. Questions about something they don't understand will frustrate, not teach.                       |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "RAIM checks GPS integrity for approaches. Without it, the GPS can't guarantee the accuracy we need. What's our backup?"            |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching the decision: "No RAIM means we can't legally fly this GPS approach. But we have an ILS available. What do we need to do?" |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to request the ILS. Safe but student doesn't learn the RAIM concept.                                                      |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student is flying under ATC vectors. No immediate threat.                                                                           |

### Tick 3

```
id:           tick_3
scene:        Student acknowledges the RAIM issue but hesitates. Trying to decide whether to request the ILS or ask ATC if the GPS approach is "still OK." ATC calls: "Turn right heading 360, vectors for the RNAV approach."
studentSpeech:Maybe ATC can tell us if the GPS is working? Should I ask them? Or do I need to switch approaches? I don't remember the ILS frequency...
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                              |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -1       | -1     | 0         | Student is saturated with decisions. ATC is vectoring for an approach you can't fly. Act now.                                                           |
| prompt        | tick_4        | 0           | 0        | -1     | 0         | Prompting at this point is too slow. The student needs help executing the switch, not more analysis.                                                    |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "ATC can't check your RAIM. Tell them: 'Unable RNAV, request ILS runway 24.' I'll help you set up the ILS while you talk to ATC." Divides the workload. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Tell ATC: 'Unable RNAV, request ILS.' I'll set up the nav frequency." Takes the immediate workload.                                                    |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | Taking controls to set up the ILS. Works but student should be making the ATC call.                                                                     |

### Tick 4

```
id:           tick_4
scene:        Student has not communicated with ATC. Still on vectors for the RNAV. Approaching the IAF. ATC: "[Callsign], 2 miles from the fix, cleared RNAV 24 approach." Student looks at you, frozen.
studentSpeech:They cleared us for the RNAV. Do I fly it? The GPS CDI is flagged but the course is still showing...
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                               |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Two miles from the fix, cleared for an approach you cannot fly. Do not ask questions.                                                    |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting at the IAF. Student is frozen. The clearance is accepted but the approach is not flyable.                                      |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching at the IAF of an unflyable approach. Too complex for the moment.                                                                |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "Tell ATC: 'Unable RNAV, request vectors for ILS.' Do it now." Clear, specific, immediate.                                               |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking the radio: "[Callsign] is unable RNAV, requesting vectors for ILS 24." Student flies, you coordinate. Appropriate workload split. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (coach/direct)
```

## Score Summary

| Path                                         | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)             | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late switch (ask -> ask -> prompt -> direct) | +1          | -1       | -1     | +1        | 0     | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)        | -2          | -5       | -5     | -3        | -15   | terminal_unsafe |

## Author Notes

RAIM (Receiver Autonomous Integrity Monitoring) is one of the most misunderstood GPS concepts among GA pilots. Many pilots have never seen a RAIM failure in actual flight, so when it happens, they don't know what it means or what to do. The scenario tests whether the CFI can teach a new concept under time pressure: RAIM failed, weather requires an instrument approach, and ATC is vectoring for the approach you can't fly. The teaching moments are: (1) RAIM is a pilot responsibility, not ATC's, (2) a GPS approach without RAIM is not legal or safe regardless of whether the course "looks right," and (3) the backup plan (ILS) should already be in the student's mind before the primary fails. The terminal_unsafe path represents flying a GPS approach without integrity monitoring near minimums in IMC -- the GPS guidance could be inaccurate and the pilot wouldn't know until obstacle clearance was violated. The Automation-Dependent model's reaction ("it was working a minute ago") reflects the common expectation that GPS is always available.
