---
status: done
phase: C1
type: scenario-script
---

# SCN 3.7: Taxi Back to the Ramp at a Class D Airport

## Metadata

```
Scenario ID:     3.7
Title:           Taxi Back to the Ramp at a Class D Airport
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
competencies: ['OD-1', 'CJ-2']
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

> Your student has just landed at a Class D airport and is taxiing back to the ramp. Ground control has issued taxi instructions. The airport has construction on one taxiway, and a NOTAM was issued about the closure. Your student has 55 hours and this is the first time visiting this airport.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Taxiing on Charlie toward the runway 14/32 crossing. Student is staring at the GPS moving map which shows taxiway Delta as available, but Delta is closed for construction. Student is taxiing at a brisk pace.
studentSpeech:The GPS shows we can take Delta to save time. Should we go that way instead?
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What did ground control clear us for?" Good check -- tests if the student understands they can't freelance taxi routes. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to follow the assigned route, not the GPS suggestion. Teaches that clearance overrides convenience.            |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on GPS limitations is appropriate but the student hasn't deviated yet. Let the question teach itself first.     |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to stay on Charlie works but misses the teaching moment about GPS vs clearance.                                |
| take_controls | tick_2     | -1          | -3       | 0      | -1        | Student asked a question while taxiing on the assigned route. Taking controls is absurd.                                 |

### Tick 2

```
id:           tick_2
scene:        Approaching the hold-short line for runway 14/32. Ground cleared "cross runway 14/32" but there are two hold-short lines -- one for 14/32 and one for a parallel taxiway that looks similar at night. Student slows but is aimed at the wrong line.
studentSpeech:OK, hold short here... this is the runway, right?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                            |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student is confused about which line is the runway hold-short. More questions while approaching won't help.                           |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | Prompting to stop and identify the runway markings. "Look at the pavement markings -- what do you see?"                               |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching through runway identification: "The runway has dashed centerline markings and numbers painted on it. What do you see ahead?" |
| direct        | terminal_safe | +1          | 0        | +1     | +1        | Directing to stop at the correct hold-short. Safe outcome but student doesn't build the identification skill.                         |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student is stopped or nearly stopped. No immediate danger.                                                                            |

### Tick 3

```
id:           tick_3
scene:        Student has stopped but at the wrong marking -- they are on the runway edge, not at the hold-short line. The aircraft's nosewheel is past the hold-short marking. A Cessna is on short final for runway 32.
studentSpeech:Wait, this doesn't look right. Are we on the runway?
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                    |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Aircraft is on the runway with traffic on final. Do not ask questions.                                        |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting while on an active runway. Too passive for the situation.                                           |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching barely adequate. "You need to clear the runway" might work but urgency demands clarity.              |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Brakes. Do not move. Let me talk to ground." Clear and prevents further incursion. Then coordinate with ATC. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking taxi control on an active runway with conflicting traffic. Fully justified.                            |

### Tick 4

```
id:           tick_4
scene:        Student hesitates, then begins taxiing forward across the runway without looking. The Cessna on final executes a go-around. Tower transmits: "[Callsign], you have crossed runway 32 without authorization. Contact ground on 121.7."
studentSpeech:Oh no, oh no. I'm sorry. Where do I go?
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                               |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student is panicking on an active runway. Questions will make it worse.                                  |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting a panicking student on a runway. Insufficient.                                                 |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching while on the runway with an emotional student. Too slow.                                        |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | Directing to clear the runway and stop on the other side. Works if student can comply through the panic. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls to clear the runway expeditiously. Correct response to a runway incursion in progress.   |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                \       \         \-> terminal_safe (direct/take_controls)
                 \       \-> terminal_safe (direct/take_controls)
                  \-> terminal_safe (direct)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                        | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -6       | -6     | -3        | -17   | terminal_unsafe |

## Author Notes

This scenario builds on 3.5 (Complex Airport Taxi at Night) but adds the GPS dependency layer. The student trusts the moving map more than the pavement markings and ATC clearance -- a real and growing problem as EFB (electronic flight bag) usage increases. The construction closure creates a deliberate mismatch between GPS data and reality, which is the same kind of stale-database problem explored in Module 1 (1.1 GPS Database Out of Date). The hold-short confusion in tick 2 is modeled on actual runway incursion reports where pilots mistake taxiway edges for hold-short markings, especially at unfamiliar airports at night. The Automation-Dependent student model (overconfidence 0.6 combined with GPS reliance) drives the tick 1 behavior -- the student's first instinct is to follow the map, not the clearance. The runway incursion in tick 3-4 escalates quickly from "wrong position" to "active conflict" -- the key teaching point is that on the ground, the margin between "confused" and "dangerous" is measured in feet, not minutes.
