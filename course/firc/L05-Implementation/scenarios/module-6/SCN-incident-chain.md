---
status: done
phase: C1
type: scenario-script
---

# SCN 6.3: Afternoon Pattern Work After an Extended Lesson

## Metadata

```
Scenario ID:     6.3
Title:           Afternoon Pattern Work After an Extended Lesson
Module:          6
Difficulty:      0.7
Duration:        15 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_5, FAA_TOPIC.A_11]
```

## Competency Links

```
competencies: ['RM-1', 'RM-2', 'AC-1', 'CJ-3']
```

## Student Model

```
Student Model:   new -- Accumulating Risk Student
Parameters:
  skillLevel:         0.5
  compliance:         0.6
  freezeTendency:     0.4
  overconfidence:     0.5
  instrumentAccuracy: 0.4
  startleDelay:       0.4
  fatigue:            0.6
```

## Briefing

> You are on a training flight that has run longer than planned. You extended the lesson 30 minutes to finish the last objective. Your student mentioned being tired during the preflight briefing this morning. The weather has changed since departure. You are now in the pattern for landing.

## Tick Script

### Tick 1 -- Chain Link 1: Fatigue

```
id:           tick_1
scene:        Downwind leg. Student has been flying for 2.5 hours. Response time to your instructions has been getting slower. Student missed the last altitude call-out by 3 seconds. Yawning has increased in the last 20 minutes.
studentSpeech:Sorry, what did you say? I heard "abeam" but I forgot what I'm supposed to do at the numbers. Wait, I know this...
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                           |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | 0           | -1       | -1     | 0         | Student is showing clear fatigue. Asking more questions adds cognitive load to an already depleted brain.                                                                                                                                                            |
| prompt        | tick_2     | +1          | +1       | +1     | +1        | "You're getting tired. Let's focus on getting a good landing and calling it a day." Acknowledges the fatigue, simplifies the task.                                                                                                                                   |
| coach         | tick_2     | +1          | +1       | +1     | +1        | "I can see the fatigue. This is exactly what the accident chain looks like: you slept poorly, we've been flying too long, and your performance is degrading. Let's land this one and debrief on the ground." Names the chain while managing the immediate situation. |
| direct        | tick_2     | +1          | 0        | +1     | +1        | "We're landing this one and done for the day." Gets the right outcome without the teaching moment.                                                                                                                                                                   |
| take_controls | tick_2     | 0           | -1       | 0      | 0         | Student is fatigued but flying adequately. Taking controls isn't necessary yet.                                                                                                                                                                                      |

### Tick 2 -- Chain Link 2: Weather

```
id:           tick_2
scene:        Turning base. Visibility has dropped from 8 miles to 5 miles in the last hour. Ceiling is lowering. A rain shower is visible 5 miles southwest, moving toward the airport. Wind has shifted and increased -- now 15 gusting 22, creating a crosswind on the landing runway.
studentSpeech:It's getting bumpy. The wind changed. And is that rain over there? I can still see the runway though.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Multiple chain links are now active: fatigue, weather, time pressure. The chain needs to be broken, not analyzed.                                                                                                                                                                                                               |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompting to evaluate the conditions. Student can see the problems -- they need decision support.                                                                                                                                                                                                                               |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "Count the links: you're tired, the weather is deteriorating, wind has shifted crosswind, and that rain will be here in 10 minutes. Any one of these is manageable. Together, they're an accident chain. We're landing now -- one approach, full stop. If it doesn't work, go around and I'll take over." Explicit chain model. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Straight in for a full stop. One approach. If anything doesn't look right, go around immediately." Clear, conservative.                                                                                                                                                                                                        |
| take_controls | terminal_safe | +1          | 0        | +1     | 0         | Taking controls for the landing. Justified by the accumulated risk but misses the chance for the student to manage it with support.                                                                                                                                                                                             |

### Tick 3 -- Chain Link 3: Approach Instability

```
id:           tick_3
scene:        On final, 300 AGL. Gust hits. Student over-corrects, airspeed drops to 62 knots, then spikes to 78 as they push the nose down. The approach is unstable -- airspeed fluctuating, altitude varying, centerline drifting. Student is task-saturated.
studentSpeech:I've got it, I've got it... just need to stabilize... the wind keeps pushing me off...
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                              |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Unstable approach at 300 AGL with a fatigued student in gusty winds. Do not ask questions.              |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting on an unstable approach. Student is saturated. They can't process new information.            |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching through the approach. Might work but the chain is fully developed now.                         |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Go around. Full power, pitch up, positive rate." The chain is broken by removing the approach attempt. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls for the go-around. Fully justified with this many chain links active.                   |

### Tick 4 -- Chain Completes

```
id:           tick_4
scene:        Student continues the unstable approach. 100 AGL. Airspeed 60 knots. The rain shower hits -- visibility drops to 3 miles instantly. Student freezes on the controls.
studentSpeech:...
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                     |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Full chain: fatigue + weather + unstable approach + rain + freeze. The student cannot respond to verbal input. |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting a frozen student at 100 AGL in rain. No effect.                                                      |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching is pointless. The student is frozen.                                                                  |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | "I HAVE THE CONTROLS." Commanding takeover. May break through the freeze. Marginal at 100 AGL.                 |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls and executing a go-around. The only reliable action when the chain is fully assembled.         |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                \       \         \-> terminal_safe (direct/take_controls)
                 \       \-> terminal_safe (direct/take_controls)
                  \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                                    | recognition | judgment | timing | execution | Total | Outcome         |
| ------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (prompt -> coach -> direct)                     | +3          | +3       | +3     | +3        | +12   | terminal_safe   |
| Adequate (coach -> direct)                              | +2          | +2       | +2     | +2        | +8    | terminal_safe   |
| Late recognition (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                   | -3          | -7       | -7     | -4        | -21   | terminal_unsafe |

## Author Notes

This scenario is explicitly about the accident chain model from AC 61-83K's safety trend content. Each tick adds a link: fatigue (tick 1), weather (tick 2), approach instability (tick 3), and environmental surprise (tick 4). The teaching point is that no individual link was dangerous by itself, but by tick 4, the chain is unbreakable without immediate physical intervention. The optimal path breaks the chain early: acknowledge the fatigue in tick 1, make the go-around decision in tick 2 or 3. The scenario also tests CJ-3 (debrief causes, not outcomes) because the debrief should identify where the chain started forming -- not at tick 4 when the rain hit, but at preflight when the student admitted sleeping poorly, and at the 2-hour mark when the flight should have ended. The high fatigue parameter (0.6) in the student model ensures the degradation is visible across all ticks. This scenario integrates the LOC content from Module 3 with the risk management content from Module 2 into a single escalating event.
