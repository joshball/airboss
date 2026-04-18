---
status: done
phase: C1
type: scenario-script
---

# SCN 4.1: VFR Cross-Country Near Restricted Airspace

## Metadata

```
Scenario ID:     4.1
Title:           VFR Cross-Country Near Restricted Airspace
Module:          4
Difficulty:      0.5
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_2]
```

## Competency Links

```
competencies: ['OD-3', 'RM-2']
```

## Student Model

```
Student Model:   Eager Cross-Country Student
Parameters:
  skillLevel:         0.5
  compliance:         0.7
  freezeTendency:     0.2
  overconfidence:     0.5
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> You and your student are planning a VFR cross-country. The route passes through an area with active NOTAMs, including temporary flight restrictions. Your student checked NOTAMs during preflight planning this morning and has the printout on the kneeboard. The student has 75 hours and is building cross-country experience.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Planning table, 30 minutes before departure. Student has the route plotted on ForeFlight. The original TFR was 15 miles north of the route. The current TFR (updated 45 minutes ago) is centered on the route.
studentSpeech:Route looks good. I checked NOTAMs this morning -- there's a TFR but it's north of us. We clear it by at least 10 miles. Ready to go.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                   |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When did you last check the NOTAMs? Have any updates come through since this morning?" The key question.    |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to refresh the NOTAMs now. "TFRs associated with VIP movements can change. Let's pull the latest." |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on TFR dynamics is correct but the student hasn't seen the problem. Discovery teaches better.       |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to recheck NOTAMs. Effective but doesn't build the habit of understanding why TFRs move.           |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Planning table.                                                                                              |

### Tick 2

```
id:           tick_2
scene:        Student refreshes NOTAMs. The TFR has moved. It now overlaps the planned route by 5 miles. Student stares at the screen, confused.
studentSpeech:Wait, it moved? How can a TFR move? I checked this morning and it was north of us. Now it's right on top of our route. Can they do that?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student is confused and the route needs replanning. Explain and fix, don't test.                                                                                                                    |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "VIP TFRs move with the VIP's schedule. That's why we check NOTAMs again right before departure. Now -- what are our options?"                                                                      |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "Presidential TFRs follow the VIP. They can be issued, modified, or cancelled with short notice. The rule is: check NOTAMs at preflight AND again before engine start. Now let's replan the route." |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to replan the route around the TFR. Safe but the student doesn't learn why TFRs move.                                                                                                     |
| take_controls | terminal_safe | -1          | -2       | 0      | 0         | Planning table.                                                                                                                                                                                     |

### Tick 3

```
id:           tick_3
scene:        Student replans the route but the detour adds 25 minutes and crosses near restricted airspace. Student is looking at the fuel calculation.
studentSpeech:OK, we can go south around it, but that takes us close to R-4001. And it adds 25 minutes -- we'll be tight on fuel reserves if the winds aren't what's forecast.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                        |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | 0           | -1       | -1     | 0         | Student identified two new risks (restricted area, fuel). They need guidance on the decision, not more analysis.                                                                                                                                                  |
| prompt        | tick_4        | +1          | 0        | 0      | 0         | Prompting to check if R-4001 is hot and recalculate fuel. Correct steps but doesn't address the go/no-go.                                                                                                                                                         |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Good risk identification. Check if the restricted area is active -- call FSS or check the NOTAMs. If it's cold, route south is fine. If fuel is tight, we either reduce fuel burn by climbing higher, add a fuel stop, or postpone. What's your recommendation?" |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Call FSS to check the restricted area. If it's hot, we postpone. If it's cold and fuel works, we go south." Clear decision tree.                                                                                                                                 |
| take_controls | terminal_safe | -1          | -2       | 0      | 0         | Planning table.                                                                                                                                                                                                                                                   |

### Tick 4

```
id:           tick_4
scene:        Student decides to depart on the original route, reasoning that the TFR "probably won't be enforced" at their altitude. They've already loaded the original GPS route.
studentSpeech:You know what, I bet we can just fly under it. The inner ring is only up to 18,000 feet, and we'll be at 5,500. The outer ring says "no restrictions below 5,000." I think we're fine on the original route.
studentState: critical
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                      |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -1          | -2       | -2     | -1        | Student is about to fly through a TFR based on a misreading of the NOTAM. Stop them.                                                                                                                                            |
| prompt        | terminal_unsafe | 0           | -1       | -1     | 0         | Prompting while the student is loading the route to fly through a TFR. Insufficient.                                                                                                                                            |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | "Let's read that NOTAM together one more time. The outer ring has specific altitude restrictions, and violating any part of a VIP TFR can result in intercept, certificate action, and criminal charges." Corrects the misread. |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "We are not flying through any part of that TFR. The consequences of a violation include intercept by armed fighters, certificate suspension, and potential criminal prosecution. We go around or we don't go." Non-negotiable. |
| take_controls | terminal_safe   | -1          | -2       | 0      | 0         | Student hasn't started the airplane.                                                                                                                                                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt)
                        \         \-> terminal_safe (coach/direct)
                         \-> terminal_safe (coach/direct)
              \-> terminal_safe (direct)
```

## Score Summary

| Path                                  | recognition | judgment | timing | execution | Total | Outcome         |
| ------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)      | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Good (ask -> coach -> direct)         | +3          | +2       | +2     | +2        | +9    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask) | 0           | -4       | -4     | -1        | -9    | terminal_unsafe |

## Author Notes

TFRs are the most common airspace enforcement action in GA, and VIP TFRs are the most dangerous because they move, they're rigorously enforced, and the consequences include military intercept. The scenario tests whether the CFI catches the stale NOTAM, teaches why VIP TFRs are dynamic, and prevents the student from rationalizing a TFR penetration. The "fly under it" rationalization in tick 4 is based on real pilot behavior -- many GA pilots misread the multi-ring TFR structure and assume they can transit below a certain altitude. The consequences described (intercept, certificate action, criminal charges) are factually accurate per 14 CFR 91.141 and post-9/11 enforcement policy. This scenario sets the foundation for 4.2 (airspace bust) and 4.3 (intercept recognition).
