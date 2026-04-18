---
status: done
phase: C1
type: scenario-script
---

# SCN 3.4: Cross-Country Through a Valley at 3,000

## Metadata

```
Scenario ID:     3.4
Title:           Cross-Country Through a Valley at 3,000
Module:          3
Difficulty:      0.7
Duration:        12 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_11, FAA_TOPIC.A_5]
```

## Competency Links

```
competencies: ['AC-2', 'RM-2', 'CJ-1', 'CJ-2']
```

## Student Model

```
Student Model:   new -- Overwhelmed VFR Pilot
Parameters:
  skillLevel:         0.4
  compliance:         0.7
  freezeTendency:     0.5
  overconfidence:     0.4
  instrumentAccuracy: 0.2
  startleDelay:       0.5
  fatigue:            0.4
```

## Briefing

> You are conducting a VFR cross-country training flight with your student through a valley. The TAF called for scattered clouds at 4,500. You are at 3,000 MSL with rising terrain ahead. Your student has 45 hours total time and no instrument training. The route takes you through mountainous terrain for the next 20 miles.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Visibility 5 miles but hazy. Clouds building ahead. Terrain rises from 1,500 to 2,500 MSL in the next 10 miles. Student is following the GPS magenta line and hasn't looked outside in 30 seconds.
studentSpeech:GPS says 22 miles to the next checkpoint. We're making good time.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2        | +1          | +1       | +1     | 0         | Good probe. "What do you see outside?" forces heads-up and begins the weather awareness conversation.          |
| prompt        | tick_2        | +1          | +1       | +1     | 0         | Prompting to look at visibility and ceiling. Gets the student thinking about deteriorating conditions.         |
| coach         | tick_2        | +1          | 0        | 0      | 0         | Coaching on weather awareness is fine but premature. Student hasn't been given a chance to notice the problem. |
| direct        | tick_2        | 0           | -1       | 0      | 0         | Directing a turn now is overly cautious. Visibility is still legal and terrain clearance is adequate.          |
| take_controls | terminal_safe | -1          | -3       | 0      | -1        | Taking controls with 5-mile visibility and VFR clearance. Completely unwarranted.                              |

### Tick 2

```
id:           tick_2
scene:        Visibility 3 miles. Cloud base appears to be at 3,500. Terrain ahead rises to 2,800 MSL -- only 200 feet of clearance if ceiling is where it looks. Student is squinting through the windscreen.
studentSpeech:It's getting kind of hazy... but I can still see the ridge. Should we keep going?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| ask           | tick_3a       | 0           | -1       | -1     | 0         | Student asked if they should keep going. That's a decision point, not a question point. Guide the decision. |
| prompt        | tick_3a       | +1          | +1       | +1     | +1        | Prompting to evaluate minimums, terrain, and the 180-degree turn option. Building the ADM framework.        |
| coach         | tick_2b       | +1          | +1       | +1     | +1        | Coaching through the IMSAFE/PAVE analysis in real time. Student begins to see the risk stacking.            |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing a 180 works but the student never learns to make the call themselves.                             |
| take_controls | terminal_safe | 0           | -2       | 0      | 0         | Visibility is 3 miles. Student asked a question. Taking controls here sends the wrong message.              |

### Tick 2b

```
id:           tick_2b
scene:        Student has processed the coaching. Looks at the terrain chart, then outside. Visibility steady at 3 miles but not improving.
studentSpeech:I think we should... maybe turn back? But we're so close to the checkpoint.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                   |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3a       | 0           | -1       | -1     | 0         | Student is on the edge of making the right call. Questions here may introduce doubt. Support the decision.                                   |
| prompt        | tick_3a       | +1          | +1       | 0      | 0         | Prompt reinforces the right instinct but student needs the confidence boost that coaching provides.                                          |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching confirms the student's instinct. "Trust what you're seeing. The checkpoint will still be there tomorrow." Student executes the 180. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing works but the student was about to make the right call. Let them own it.                                                           |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student was communicating and reasoning. Taking controls undercuts the learning.                                                             |

### Tick 3a

```
id:           tick_3a
scene:        Visibility dropping to 2 miles. Cloud base at 3,200 -- you're only 200 feet below it. Terrain ahead is disappearing into haze. Student's scan has degraded to fixation on the GPS.
studentSpeech:The GPS says we can go around the ridge to the right...
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                         |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Student is task-saturated and fixated on GPS. Questions will not break through.                                    |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting in marginal VFR with a panicking student. They need clear direction.                                     |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching might work but the margin is gone. A VFR pilot in 2-mile visibility near terrain needs firm intervention. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | Clear direction: "We're turning around now. Standard rate turn to the left, descend to 2,500."                     |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls is justified. Low visibility, rising terrain, task-saturated student with no instrument skills.    |

### Tick 4

```
id:           tick_4
scene:        Visibility 1 mile. In and out of cloud wisps. Student has entered a shallow right turn following the GPS suggestion. Spatial orientation deteriorating -- attitude indicator shows 15-degree bank the student hasn't noticed.
studentSpeech:I can't see the ridge anymore. Where did it go?
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                              |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student is spatially disoriented in IMC. Verbal probing is catastrophically insufficient.                                               |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting a disoriented VFR-only pilot in IMC. They cannot process or respond appropriately.                                            |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching a 45-hour student in inadvertent IMC. They have no instrument skills to coach.                                                 |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | Directing might work if student complies. But spatial disorientation makes compliance unreliable. Risky.                                |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls from a disoriented pilot in IMC. Transition to instruments, execute 180, descend to VFR. This is the textbook response. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3a -> tick_4 -> terminal_unsafe (ask/prompt/coach)
              \         \          \-> terminal_safe (direct/take_controls)
               \         \-> terminal_safe (direct/take_controls)
                \-> tick_2b -> tick_3a -> ...
                         \-> terminal_safe (coach/direct/take_controls)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> coach in 2b)                    | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Good (prompt -> prompt -> direct)                        | +3          | +2       | +2     | +2        | +9    | terminal_safe   |
| Late intervention (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)                    | -2          | -6       | -5     | -3        | -16   | terminal_unsafe |

## Author Notes

Inadvertent IMC is the third major LOC killer in GA. This scenario layers two compounding problems: deteriorating weather AND a low-time student with no instrument skills. The student model has low instrumentAccuracy (0.2) -- even with coaching, they cannot reliably fly on instruments. The critical teaching point is that the 180-degree turn decision should be made EARLY (tick 2) when conditions are still flyable. Tick 2b rewards the CFI who coaches at the decision point -- the student almost talks themselves into the right call, they just need support. By tick 3a, the CFI who waited too long is now in a harder situation. Tick 4 is spatial disorientation -- only taking controls reliably works because you cannot coach instrument skills that don't exist. The GPS fixation thread (student following the magenta line into terrain) is a deliberate nod to automation dependency, creating a natural cross-reference to Module 1 scenarios.
