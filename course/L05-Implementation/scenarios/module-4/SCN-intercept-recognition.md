---
status: done
phase: C1
type: scenario-script
---

# SCN 4.3: Cross-Country Near a Restricted Area

## Metadata

```
Scenario ID:     4.3
Title:           Cross-Country Near a Restricted Area
Module:          4
Difficulty:      0.5
Duration:        8 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_2]
```

## Competency Links

```
competencies: ['OD-3']
```

## Student Model

```
Student Model:   new -- Average Student
Parameters:
  skillLevel:         0.5
  compliance:         0.7
  freezeTendency:     0.4
  overconfidence:     0.3
  instrumentAccuracy: 0.5
  startleDelay:       0.5
  fatigue:            0.2
```

## Briefing

> You are conducting a cross-country training flight. Your route passes near a restricted area. Your student has 60 hours and has been handling radio communications. You notice the radio has been unusually quiet for the last several minutes. A fast-moving aircraft is approaching from your left at the same altitude.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Cruising at 5,500. A military fighter is visible at your 9 o'clock, same altitude, closing fast. It pulls alongside, approximately 1,000 feet to your left. The pilot is visible, rocking wings.
studentSpeech:What is THAT? Is that a fighter jet? Why is it so close to us? What do we do?!
studentState: nominal
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | -1          | -1       | -1     | 0         | A military jet is alongside you rocking wings. This is not a teaching moment. Execute the intercept response.                                                  |
| prompt        | tick_2     | 0           | 0        | -1     | 0         | Prompting to think about what the rocking wings mean. Student is panicking -- they need clear direction.                                                       |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching through the intercept signals is OK but the student needs to act, not learn theory right now.                                                         |
| direct        | tick_2     | +1          | +1       | +1     | +1        | "That's an intercept. Rock your wings back -- that means you see them. Then follow their lead. I'll handle the radio. Squawk 7700." Clear, calm, step-by-step. |
| take_controls | tick_2     | +1          | +1       | +1     | +1        | Taking controls to execute the intercept response. Appropriate given the urgency and student's panic.                                                          |

### Tick 2

```
id:           tick_2
scene:        The fighter pilot makes a slow turn to the right, looking back at you. This is the signal to follow. Your radio is now working (you fixed the stuck mic). Guard frequency is active.
studentSpeech:They're turning! Are we supposed to follow them? I don't know what any of this means!
studentState: degrading
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                               |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3        | -1          | -2       | -2     | -1        | Intercepting aircraft is directing you. Follow them.                                                                     |
| prompt        | tick_3        | 0           | -1       | -1     | 0         | Prompting while being intercepted. Too slow.                                                                             |
| coach         | tick_3        | +1          | 0        | 0      | +1        | "When they turn slowly and look back, that means follow them. Turn to match their heading." Teaches while acting.        |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Follow them. Turn right to match their heading. I'm calling on guard: '[Callsign] on guard, complying with intercept.'" |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls to follow the interceptor while communicating on guard. Clean execution of a high-stress procedure.      |

### Tick 3

```
id:           tick_3
scene:        You've been following the interceptor (or not). Guard frequency: "[Callsign], this is [callsign], turn to heading 090 and contact approach on 124.5." The interceptor breaks away after seeing your compliance.
studentSpeech:OK, OK. Heading 090. They're leaving. Is it over? Are we in trouble?
studentState: critical
safeWindow:   [coach, direct]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | -1     | 0         | Student needs reassurance and procedure, not testing.                                                                                                                                                                                          |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting to contact approach as instructed. Correct but student is emotional.                                                                                                                                                                 |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Contact approach, comply with their instructions, and fly normally. We'll debrief on the ground. The important thing is we complied. The stuck mic caused the communication failure -- that's what we'll explain." Calm, factual, reassuring. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Contact approach on 124.5 now. Tell them you're complying." Keeps the student on task.                                                                                                                                                        |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | The immediate threat is resolved. Student can fly heading and make radio calls.                                                                                                                                                                |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
                \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                            | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (direct -> direct)      | +2          | +2       | +2     | +2        | +8    | terminal_safe |
| Good (direct -> coach -> coach) | +3          | +2       | +2     | +3        | +10   | terminal_safe |
| Poor (ask -> ask -> ask)        | -2          | -3       | -4     | -1        | -10   | terminal_safe |

## Author Notes

Intercept procedures are required knowledge per AC 61-83K but rarely practiced. Most pilots' only exposure is a paragraph in the AIM. This scenario makes it visceral -- a military jet pulling alongside at close range is one of the most startling things that can happen in GA flying. The scenario tests whether the CFI knows the intercept response signals (rock wings to acknowledge, follow when directed, comply with radio instructions) AND whether they can execute them under pressure while managing a panicking student. Every path reaches terminal_safe because compliance with an intercept always resolves the immediate situation -- the scores reflect how quickly and correctly the CFI responded. The stuck mic as the cause is deliberate: it teaches that communication failures can have outsized consequences, and that monitoring your radio (including checking for stuck mics) is a real-world operational necessity, not just a good habit. This is the only Module 4 airspace scenario where the student model's freezeTendency (0.4) and startleDelay (0.5) are the primary behavioral drivers.
