---
status: done
phase: C1
type: scenario-script
---

# SCN 3.5: Complex Airport Taxi at Night

## Metadata

```
Scenario ID:     3.5
Title:           Complex Airport Taxi at Night
Module:          3
Difficulty:      0.4
Duration:        10 min
Pattern:         Pressure Decision
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
Student Model:   new -- Night-Inexperienced Student
Parameters:
  skillLevel:         0.5
  compliance:         0.7
  freezeTendency:     0.3
  overconfidence:     0.5
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.5
```

## Briefing

> It is 9:30 PM local at a Class C airport your student has not visited before. You have just landed on runway 28R and ground control has issued a complex taxi clearance to the FBO on the east side of the field. The taxi route crosses two runways. Your student is fumbling with the airport diagram on the iPad while trying to taxi. This is the student's third night flight.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Student is taxiing on taxiway Alpha at moderate speed. Airport diagram is on the iPad but student is looking outside trying to read taxiway signs. First runway crossing (Runway 10/28L) is 500 feet ahead.
studentSpeech:OK, Alpha to... wait, which way is Bravo? These signs all look the same at night.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | Good probe. "Can you read back the taxi clearance?" tests whether the student actually retained it.       |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to stop and review the diagram before proceeding. Good taxi discipline.                         |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on taxi technique is fine but student hasn't made an error yet. Let them work the problem first. |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing taxi at a nominal situation. Student needs to develop the skill, not follow directions.         |
| take_controls | tick_2     | -1          | -3       | 0      | -1        | Taking taxi control from a student who is confused but safe. No threat exists.                            |

### Tick 2

```
id:           tick_2
scene:        Approaching hold-short line for Runway 10/28L. Student has not slowed down. The hold-short markings are visible in the taxi light. Student is looking at the iPad.
studentSpeech:I think we go straight across here...
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Student is about to cross a runway without confirming clearance. Questions waste time at the hold-short line. |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | Prompting to stop at the hold-short. "What does that marking mean?" teaches without directing.                |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Coaching through the hold-short procedure. "Let's stop here and verify we have clearance to cross."           |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to stop works but student doesn't learn to recognize the hold-short cue themselves.                 |
| take_controls | tick_3     | 0           | -2       | 0      | 0         | Taking controls at a hold-short line. Student was taxiing safely -- just confused about the route.            |

### Tick 3

```
id:           tick_3
scene:        Stopped at hold-short line. Student looks both ways down the runway. Ground control has not cleared a crossing. A regional jet's landing lights are visible on a 2-mile final for 28L.
studentSpeech:Looks clear to me. Can I go?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                           |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -1       | -1     | 0         | Student wants to cross an active runway without clearance. This is not a discussion moment.                                                                          |
| prompt        | tick_4        | 0           | 0        | 0      | 0         | Prompting to check clearance is adequate but the student needs to understand why "looks clear" is insufficient.                                                      |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching the clearance requirement: "We need explicit crossing clearance from ground. See those lights on final? That's why we wait." Connects procedure to reality. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | Clear direction: "Do not cross. We need clearance from ground." Prevents the incursion.                                                                              |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | Holding the brakes prevents the crossing but student was already stopped. Over-reaction.                                                                             |

### Tick 4

```
id:           tick_4
scene:        Student begins to roll forward onto Runway 28L. The regional jet is now on short final, 1 mile out. Tower transmits: "Aircraft on 28 Left, hold your position!"
studentSpeech:Oh! Sorry -- I didn't realize --
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                 |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------ |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student is on an active runway with traffic on short final. Not a teaching moment.         |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting while on a runway with a jet on final. Insufficient.                             |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching on a live runway. Too slow for the situation.                                     |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "STOP. Brakes now." Clear, immediate, prevents the incursion from becoming a collision.    |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Applying brakes to stop the aircraft on the runway. Justified -- traffic conflict is real. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (coach/direct/take_controls)
```

## Score Summary

| Path                                               | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)                   | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late intervention (ask -> ask -> prompt -> direct) | 0           | -1       | -1     | +2        | 0     | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)              | -2          | -5       | -4     | -2        | -13   | terminal_unsafe |

## Author Notes

Runway incursions account for 63% of pilot deviations per AC 61-83K. Night operations at unfamiliar airports compound every weakness: sign visibility is poor, the airport diagram requires more attention, and the student's mental model of the airport is incomplete. The critical teaching point is tick 3: "Looks clear to me" without ATC clearance is the exact mindset that causes incursions. The regional jet on final makes it visceral -- this isn't abstract procedure, it's a real traffic conflict. The fatigue parameter (0.5) reflects that this is the third night flight and the student's cognitive resources are diminished. Note this scenario is the gateway to 3.6 (Readback Misunderstanding) and 3.7 (Runway Crossing Confusion) -- it establishes the ground operations framework.
