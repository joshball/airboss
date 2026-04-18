---
status: done
phase: C1
type: scenario-script
---

# SCN 4.2: VFR Cross-Country at 4,500 Near Class B

## Metadata

```
Scenario ID:     4.2
Title:           VFR Cross-Country at 4,500 Near Class B
Module:          4
Difficulty:      0.6
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_2, FAA_TOPIC.A_6]
```

## Competency Links

```
competencies: ['OD-2', 'OD-3', 'CJ-2']
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

> You are on a cross-country training flight flying VFR at 4,500 feet. Your route skirts the lateral boundary of Class B airspace. The student has been navigating by GPS and maintaining the planned altitude. The student has 80 hours and is comfortable with GPS navigation. Visibility is 10 miles with a few scattered clouds above.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        4,500 feet, GPS shows on course but the aircraft is 1 mile north of the planned track -- inside the lateral buffer you had built in. The Class B shelf is 2 miles north. Student is looking at the GPS track, satisfied.
studentSpeech:Right on track. GPS shows us dead center on the magenta line. Five minutes to the next waypoint.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What airspace are we near? Where is the Class B boundary relative to us?" Makes the student look at the sectional, not just the GPS. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to cross-check position on the sectional chart. "What does the sectional show about airspace here?"                         |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on airspace awareness when the student hasn't noticed the proximity. Let them find it.                                       |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing a course correction south. Prevents the issue but student doesn't learn the airspace structure.                             |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Straight and level VFR cruise with adequate clearance.                                                                                |

### Tick 2

```
id:           tick_2
scene:        Wind has pushed the aircraft further north. Now 1.5 miles from the Class B lateral boundary. At the current drift rate, you'll be at the boundary in about 3 minutes. Student is adjusting the GPS zoom.
studentSpeech:Hmm, we're a little north. The GPS shows some airspace shading up there but I'm not sure what the altitudes are. We're at 4,500 so we should be above whatever it is, right?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student is confused about the airspace. They need information, not more testing. Two miles from a violation.                                                                |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "That shading is Class B. It starts at 4,000 in this sector. We're at 4,500. Where does that put us if we drift north?" Forces the math.                                    |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "That's the Class B shelf. 4,000 to 10,000 feet. We're at 4,500 -- which means if we cross that boundary, we're in Class B without a clearance. Turn 10 degrees south now." |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Turn south 10 degrees. We're drifting toward Class B." Immediate correction. Prevents the violation.                                                                       |
| take_controls | terminal_safe | 0           | -1       | 0      | 0         | Aircraft is still outside the boundary. Correction is straightforward.                                                                                                      |

### Tick 3

```
id:           tick_3
scene:        Student either corrected course or didn't. If not corrected, the aircraft is now 0.5 miles from the Class B boundary. ATC calls on guard frequency: "[Aircraft type] heading northbound near the Class Bravo boundary, contact approach on 124.5."
studentSpeech:Uh oh. That's us, isn't it? Are we in the Bravo? I didn't mean to--
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                                                                 |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -1          | -2       | -2     | -1        | ATC is calling. Do not ask questions. Respond.                                                                                                                             |
| prompt        | terminal_unsafe | 0           | -1       | -1     | 0         | Prompting while ATC is calling on guard. Insufficient urgency.                                                                                                             |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | "Contact approach, tell them who you are, your altitude and heading. They'll either clear you in or vector you out." Teaches the response procedure but take action first. |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "Contact approach on 124.5 now. Tell them: '[Callsign], 4,500, heading 360, request.' And turn south immediately." Clear, immediate, proper response.                      |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking the radio while directing the student to turn south. Appropriate division of labor under pressure.                                                                  |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_unsafe (ask/prompt)
              \         \-> terminal_safe (coach/direct/take_controls)
               \-> terminal_safe (direct)
```

## Score Summary

| Path                              | recognition | judgment | timing | execution | Total | Outcome         |
| --------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct) | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Quick fix (ask -> direct)         | +2          | +2       | +2     | +1        | +7    | terminal_safe   |
| Worst case (ask -> ask -> ask)    | 0           | -3       | -3     | -1        | -7    | terminal_unsafe |

## Author Notes

Class B violations are the most common GA airspace deviation per AC 61-83K. The scenario demonstrates how GPS navigation without airspace awareness creates a drift-into-violation pattern. The student trusts the GPS track but doesn't understand the vertical dimension of the airspace -- "we should be above whatever it is" shows the gap between GPS proficiency and airspace knowledge. The ATC call on guard frequency in tick 3 is the real-world consequence: before any paperwork happens, ATC sees you on radar and calls. The teaching points: (1) GPS doesn't replace airspace awareness, (2) wind drift toward airspace boundaries is a real and common problem, (3) the proper response to an ATC inquiry is immediate communication, not avoidance. The terminal_unsafe path represents ignoring ATC's call -- which escalates to a Brasher notification and potential enforcement action.
