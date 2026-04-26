---
status: done
phase: C1
type: scenario-script
---

# SCN 2.8: Return Leg of a Long Cross-Country

## Metadata

```
Scenario ID:     2.8
Title:           Return Leg of a Long Cross-Country
Module:          2
Difficulty:      0.6
Duration:        10 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_5, FAA_TOPIC.A_10]
```

## Competency Links

```
competencies: ['RM-1', 'RM-2', 'RM-3']
```

## Student Model

```
Student Model:   Pressure-Susceptible
Parameters:
  skillLevel:         0.5
  compliance:         0.8
  freezeTendency:     0.5
  overconfidence:     0.3
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.4
```

## Briefing

> You are on the return leg of a long cross-country training flight with your student. You departed at 7 AM and it is now 4 PM. The student has been flying for 6 hours with one fuel stop. You are 45 minutes from the home airport. An alternate airport sits 20 miles south of your destination.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Cruising at 4,500, 45 minutes from home. Student is flying competently but you've noticed slower responses to ATC calls and more frequent yawning. The student's posture has slumped. Haze is visible ahead.
studentSpeech:Almost home. I can see the haze but the ATIS said 6 miles. That's fine for VFR, right?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "How are you feeling right now? Rate your fatigue on a 1-10." Forces honest self-assessment of the IMSAFE risk. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to review the IMSAFE checklist. Fatigue after 6 hours of flying in a student is a real concern.       |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on fatigue recognition is fine but the student hasn't admitted to being tired. Let them assess first.  |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing a divert when conditions are still legal VFR. May be premature -- assess the student first.           |
| take_controls | tick_2     | -1          | -2       | -1     | -1        | Aircraft is in cruise, student is flying adequately.                                                            |

### Tick 2

```
id:           tick_2
scene:        Student admits to being tired but insists they can make it. Updated ATIS: ceiling 2,000 broken, visibility 5 miles. Cloud bases are lower than when you departed this morning. Student rubs eyes.
studentSpeech:I'm a little tired, but we're so close. I just want to get home. I don't want to deal with finding a ride from the alternate. It's only 30 more minutes.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student admitted fatigue and declining weather. More questions just stall the decision. Guide it.                                                                                                      |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "Weather is trending down. You're tired. We have a clear alternate 20 miles south. What does your risk assessment tell you?"                                                                           |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "Let's count: six hours flying, poor sleep, weather deteriorating, 30 minutes to go with conditions getting worse. What's the smart call?" Builds the risk chain without making the decision for them. |
| direct        | terminal_safe | +1          | 0        | +1     | +1        | Directing to the alternate. Safe outcome but student misses the ADM exercise.                                                                                                                          |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Student is flying adequately. Conditions are legal VFR.                                                                                                                                                |

### Tick 3

```
id:           tick_3
scene:        Student hesitates. Checks the time, checks the weather, looks at the fuel gauges. The alternate would add an hour to the trip including the drive. Student's family has texted asking when they'll land.
studentSpeech:My wife is at the airport waiting. If we divert she'll have to drive an hour to get me. Can we at least try for home and divert if it gets worse?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4        | 0           | -1       | -1     | 0         | External pressure (family waiting) is compounding the fatigue and weather. Address the decision, not the feelings.                                                                                                                                                             |
| prompt        | tick_4        | +1          | 0        | 0      | 0         | Prompting the "continue and divert if worse" trap: "What if 'worse' happens faster than you can react in your current state?"                                                                                                                                                  |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "The 'try and see' plan sounds reasonable, but it puts the divert decision at the worst possible moment -- when you're more tired and weather is worse. The smart move is to divert now while it's easy. Your wife would rather drive an hour than deal with the alternative." |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "We're diverting. Weather is deteriorating, you're fatigued, and the 'press on' plan relies on things not getting worse. We go to the alternate."                                                                                                                              |
| take_controls | terminal_safe | +1          | 0        | 0      | 0         | Taking controls to divert. Justified by the cumulative risk but student should be part of the decision.                                                                                                                                                                        |

### Tick 4

```
id:           tick_4
scene:        Student continues toward home. Ceiling drops to 1,800 broken. Visibility 4 miles. Student is now hand-flying with noticeably degraded precision -- altitude excursions of 200 feet, heading wandering. Reaction to a traffic call from ATC is slow.
studentSpeech:I can see the airport from here... I think. Is that it over there? No, that's the lake.
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                 |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Student is disoriented from fatigue in deteriorating weather. Questions are useless.                       |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting a fatigued, disoriented student. They cannot process complex information right now.              |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching at this point is too slow. Fatigue has degraded cognitive function below the teachable threshold. |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "I have the airplane. We're turning south to the alternate." Take over the decision and the flying.        |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls from a fatigued student in deteriorating conditions. Textbook appropriate.                 |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (coach/direct)
              \-> terminal_safe (direct)
```

## Score Summary

| Path                                         | recognition | judgment | timing | execution | Total | Outcome         |
| -------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)             | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late divert (ask -> ask -> prompt -> direct) | +1          | -1       | -1     | +1        | 0     | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)        | -1          | -5       | -4     | -3        | -13   | terminal_unsafe |

## Author Notes

The culminating risk management scenario for Module 2. Every accident causal factor is present: fatigue, deteriorating weather, schedule pressure, external social pressure (family waiting), and the sunk-cost fallacy ("we're so close"). The scenario deliberately stacks these to teach risk chain recognition. The "continue and divert if worse" plan (tick 3) is the most dangerous rationalization because it sounds responsible while actually deferring the decision to a moment when you'll be less capable of making it. The Pressure-Susceptible model's high compliance (0.8) means the student will go along with whatever the CFI decides -- which means the CFI owns this decision completely. Tick 4 shows what fatigue actually looks like in a cockpit: missed calls, altitude excursions, spatial disorientation. This isn't dramatic -- it's how real fatigue accidents develop. Connects to all three RM competencies: RM-1 (the preflight risk assessment this morning should have flagged poor sleep), RM-2 (dynamic reassessment as conditions change), and RM-3 (the ethical responsibility to prioritize safety over convenience).
