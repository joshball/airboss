---
status: done
phase: C1
type: scenario-script
---

# SCN 1.4: Busy Pattern at a Non-Towered Airport

## Metadata

```
Scenario ID:     1.4
Title:           Busy Pattern at a Non-Towered Airport
Module:          1
Difficulty:      0.5
Duration:        12 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1, FAA_TOPIC.A_5]
```

## Competency Links

```
competencies: ['AV-1', 'AC-1', 'CJ-1']
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

> Your student is flying in the pattern at a busy non-towered airport in a G1000 Cessna 172. At least three other aircraft are in the pattern calling on CTAF. There is also a Piper on a midfield downwind that has not made a radio call in two laps. The student has 55 hours total time and is working on pattern entries and traffic awareness.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Crosswind to downwind turn. Two aircraft ahead in the pattern visible outside. Student is looking at the MFD traffic page, head down.
studentSpeech:I can see two targets on the traffic display. One is a mile ahead and one is two miles on base. We're well separated.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                   |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Can you point to those aircraft by looking outside?" Tests whether the student can match display to visual. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to scan outside. "Traffic display is a tool, not a replacement. Where are they visually?"          |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on scan technique when the student hasn't shown the gap yet. Let the question reveal it.            |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to look outside. Student complies but doesn't understand why the display isn't sufficient.         |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Pattern flying with good separation.                                                                         |

### Tick 2

```
id:           tick_2
scene:        Midfield downwind. Student looked up briefly but went right back to the MFD. The Piper with no radio calls is at the student's 10 o'clock low, turning base. Not on the traffic display -- its transponder may not be ADS-B equipped. Student hasn't seen it.
studentSpeech:All clear on the display. Nobody between us and the base turn. I'll start slowing down for the descent.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | There's traffic the display doesn't show. A question may not direct attention to the right quadrant fast enough.          |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "Traffic, 10 o'clock low. What do you see?" Direct prompt to the correct location. Student learns the display has gaps.   |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Not all aircraft have ADS-B out. That traffic display has blind spots. Scan outside your 10 o'clock -- what do you see?" |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "Traffic, 10 o'clock, turning base." Points out the traffic. Student sees it but doesn't process the display limitation.  |
| take_controls | tick_3     | 0           | -2       | 0      | 0         | Pattern flying with traffic at 10 o'clock. Alert the student, don't take the airplane.                                    |

### Tick 3

```
id:           tick_3
scene:        The Piper has turned final and is now at the student's 9 o'clock, converging. Student saw the traffic (or didn't) and is now turning base. If the student continues the base turn, there will be a traffic conflict on final.
studentSpeech:Turning base now... wait, is that a plane down there? It's not on my display!
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                               |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Traffic conflict developing on final. Don't discuss it.                                                  |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting while converging with traffic. Student needs clear direction.                                  |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching to extend downwind. Adequate but the traffic is converging now.                                 |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Extend downwind. Traffic on final. We'll sequence behind them." Clear, safe, student maintains control. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking over to extend downwind and sequence behind the Piper. Justified with converging traffic.         |

### Tick 4

```
id:           tick_4
scene:        Student completes the base turn despite the traffic. Now on a converging path with the Piper on short final. Separation is shrinking. The Piper pilot calls: "Traffic in the pattern, you're cutting me off on final."
studentSpeech:Oh! I'm sorry! What do I do? Go around?
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                              |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Converging traffic conflict. Immediate action required.                                                 |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting during a near-miss. Insufficient.                                                             |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching during converging traffic. Too slow.                                                           |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | "Go around, right turn, climb to pattern altitude." Resolves the conflict if student executes promptly. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls to execute the go-around and deconflict. Appropriate for a near mid-air scenario.       |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                              | recognition | judgment | timing | execution | Total | Outcome         |
| ------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                 | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late catch (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)             | -2          | -6       | -6     | -3        | -17   | terminal_unsafe |

## Author Notes

This scenario addresses the most important ADS-B/traffic display limitation: not all aircraft are visible on the display. The non-ADS-B Piper is the hidden threat -- the student's entire traffic awareness strategy depends on the display, and when the display has a gap, the student has no backup. The teaching point is that glass cockpit traffic displays supplement visual scanning, they do not replace it. The "heads-down" tendency (high instrumentAccuracy + overconfidence in the Automation-Dependent model) creates the vulnerability. AC 61-83K explicitly notes that instructors need to understand what automation "can and cannot do" -- this scenario makes the "cannot" tangible. The converging traffic pattern is drawn from actual near-miss reports where pilots relied on traffic displays and missed non-ADS-B traffic in the pattern. Also connects to AC-1 (detect unstable approach trends) because the distraction from glass cockpit fixation compounds approach errors.
