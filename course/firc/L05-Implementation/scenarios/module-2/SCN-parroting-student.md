---
status: done
phase: C1
type: scenario-script
---

# SCN 2.3: Emergency Procedures Review Before Checkride

## Metadata

```
Scenario ID:     2.3
Title:           Emergency Procedures Review Before Checkride
Module:          2
Difficulty:      0.6
Duration:        10 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_4]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-3']
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

> Your student is preparing for a private pilot checkride scheduled next week. Written exam score was 92%. The student has been a diligent studier throughout training. Today you are reviewing emergency procedures as part of the pre-checkride ground session. The student has 65 hours total time and answers confidently.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Ground briefing. You ask the student to describe engine failure after takeoff. Student responds immediately and smoothly with a textbook answer -- pitch for best glide, identify a field, attempt restart if altitude permits.
studentSpeech:Maintain Vy minus five until best glide is established, look for a field within a 30-degree cone, run the checklist if above 1,000 AGL. That's from the POH, section 3.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What if there's no field in the 30-degree cone?" Probing beyond the memorized answer reveals understanding depth. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | Prompting to go deeper is fine but less targeted than a specific probing question.                                 |
| coach         | tick_2     | 0           | -1       | 0      | 0         | Student gave a correct answer. Coaching when they answered correctly feels like you don't trust them.              |
| direct        | tick_2     | 0           | -2       | 0      | 0         | Student answered correctly. Directing is inappropriate when no error has been demonstrated.                        |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground briefing. No aircraft involved.                                                                             |

### Tick 2

```
id:           tick_2
scene:        Student pauses at the unexpected question. Looks at notes, then back at you. Gives an answer that partially makes sense but reveals a fundamental misunderstanding about energy management.
studentSpeech:I'd... turn to find a better field? The airplane has enough energy to maneuver at best glide, right? You can turn as much as you want at best glide speed.
studentState: degrading
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | +1          | +1       | +1     | 0         | "What happens to your glide range when you bank?" Further probing to map the edges of the misunderstanding. |
| prompt        | tick_3     | +1          | +1       | +1     | 0         | Prompting to think about bank angle and sink rate. "How does turning affect your descent rate?"             |
| coach         | tick_3     | +1          | 0        | 0      | +1        | Coaching on energy management is appropriate but slightly early -- one more probe maps the gap better.      |
| direct        | tick_3     | 0           | -1       | 0      | +1        | Correcting the misconception directly. Student will memorize the correction without understanding it.       |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Ground discussion. No aircraft.                                                                             |

### Tick 3

```
id:           tick_3
scene:        In the air now. You simulate an engine failure at 2,000 AGL. Student immediately pitches for best glide (correct), identifies a field (correct), then begins a series of S-turns while descending -- maneuvering extensively while burning altitude.
studentSpeech:I'm doing what we briefed. Best glide, field selected. Now I need to get lined up. Let me try from this angle... no, that's not right. Let me turn back...
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                           |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4        | 0           | -1       | -1     | 0         | Student is burning altitude with excessive maneuvering. The gap is now visible -- diagnose it, don't probe more.                     |
| prompt        | tick_4        | +1          | +1       | +1     | +1        | "Check your altitude. How much have you lost since the turns?" Makes the consequence of the misconception visible.                   |
| coach         | tick_4        | +1          | +1       | +1     | +1        | Coaching the connection: "Every turn costs you altitude you can't get back. Straight to the field is almost always the best answer." |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to stop turning and fly straight to the field. Saves the exercise but doesn't teach the why.                               |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Student is flying safely, just poorly. Altitude is sufficient. Taking controls is over-reaction.                                     |

### Tick 4

```
id:           tick_4
scene:        1,200 AGL now. Student has lost 800 feet maneuvering. The selected field is still reachable but the margin is thin. Student finally notices the altitude and looks alarmed.
studentSpeech:Wait, I've lost a lot of altitude. I thought best glide meant I wouldn't lose much height in turns?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                            |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student just identified their own gap. They need the correction, not more probing.                                                                                                    |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to think about why: "Best glide is for distance, not time. What happens to sink rate in a bank?" Connects the dots.                                                         |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Now you see it. Best glide gives you maximum distance in a straight line. Every bank steepens the descent. That's why we plan the approach to minimize turns." The lightbulb moment. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing the approach to the field. Safe outcome but the understanding moment is rushed.                                                                                             |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Student is above 1,000 AGL with a field in reach. Unnecessary.                                                                                                                        |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
                         \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                        | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> ask -> prompt -> coach)     | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (ask -> prompt -> coach -> prompt) | +4          | +3       | +3     | +1        | +11   | terminal_safe |
| Poor (coach -> direct -> direct -> direct)  | +1          | -3       | 0      | +3        | +1    | terminal_safe |

## Author Notes

This is the most pedagogically rich scenario in Module 2. The Parroting Student archetype is extremely common in aviation training -- students who pass written exams and recite procedures but don't understand the underlying physics. The 92% written score is the red flag: it creates a false sense of readiness. The critical skill being tested is CJ-1 (diagnose student state) at a subtle level: the student is not confused, not defiant, not anxious -- they are fluently wrong. The energy management misconception (thinking best glide allows unlimited maneuvering) is based on a real and common student error. The scenario rewards the CFI who uses targeted questions (tick 1-2) to map the gap before trying to fix it. The air exercise in tick 3 makes the abstract misconception concrete -- the student sees 800 feet vanish because of their own maneuvering. Tick 4 is the teaching moment: the student identifies the problem themselves, and the best intervention is coaching that connects the observation to the principle. This connects to CJ-3 (debrief causes, not outcomes) -- the cause is a memorized-but-not-understood procedure.
