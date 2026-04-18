---
status: done
phase: C1
type: scenario-script
---

# SCN 2.7: Mountain Airport Fuel Stop on a Cross-Country

## Metadata

```
Scenario ID:     2.7
Title:           Mountain Airport Fuel Stop on a Cross-Country
Module:          2
Difficulty:      0.5
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_5]
```

## Competency Links

```
competencies: ['RM-1', 'RM-2', 'CJ-2']
```

## Student Model

```
Student Model:   new -- Eager Cross-Country Student
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

> You and your student are at a mountain airport, elevation 6,800 feet, after a fuel stop on a long cross-country. It is a warm summer afternoon. The runway is 5,500 feet long. Your student completed weight and balance and takeoff performance calculations during preflight planning at home this morning. The student is eager to continue to the destination before dark.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Ramp area. Sun is high and hot. The airplane feels sluggish just taxiing. Density altitude calculation shows 9,800 feet. Student has the original flight plan on the kneeboard from this morning's preflight.
studentSpeech:We're topped off and ready. The plan says we need 2,800 feet for takeoff, and the runway is 5,500. Plenty of room.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What temperature did you use for that calculation?" The key question -- the plan was built on standard conditions, not today's 35 C. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to recalculate with actual conditions. Good but less diagnostic than seeing if the student catches it themselves.           |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on density altitude is appropriate but the student hasn't recognized the problem. Let them find it.                          |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing a recalculation before the student has had a chance to see the issue. Effective but not instructional.                      |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | On the ramp. No aircraft control issue.                                                                                               |

### Tick 2

```
id:           tick_2
scene:        Student recalculates (or you've prompted them to). New numbers: takeoff roll 4,200 feet, 50-foot obstacle clearance requires 5,800 feet. There's a tree line 300 feet past the departure end. Student stares at the numbers.
studentSpeech:Hmm... that's tight. But the POH always adds a safety margin, right? And we can use the whole runway. I think we'll be fine.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | Student just rationalized away a 300-foot margin with trees. Questions aren't strong enough here.                          |
| prompt        | tick_3        | +1          | +1       | +1     | +1        | "POH numbers are for a new engine at max performance. What's the standard safety factor? And what about the trees?"        |
| coach         | tick_3        | +1          | +1       | +1     | +1        | Coaching the risk stacking: density altitude + full fuel + obstacle clearance + degraded engine. Building the ADM process. |
| direct        | terminal_safe | +1          | 0        | +1     | +1        | Directing to offload fuel or wait for cooler temperatures. Safe outcome but student doesn't learn the analysis.            |
| take_controls | terminal_safe | -1          | -2       | 0      | 0         | On the ramp.                                                                                                               |

### Tick 3

```
id:           tick_3
scene:        Student acknowledges the risk is higher than planned but is looking at the watch. Destination is 90 minutes away. Sunset is in 3 hours. The student's family is expecting them for dinner.
studentSpeech:What if we use a short-field technique? Or reduce fuel to minimum? We need to get going or we'll be flying after dark, and I'm not night current.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | 0           | -1       | -1     | 0         | Student is stacking rationalizations. Each "what if" pushes the margins thinner. Stop the momentum.                                                                                                        |
| prompt        | tick_4        | +1          | 0        | 0      | 0         | Prompting to count the risk factors -- valid but the student is problem-solving around the risk, not addressing it.                                                                                        |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Count the links in this chain: high density altitude, full fuel, obstacle, get-there pressure, not night current. How many more links before this becomes an accident sequence?" Teaches the chain model. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "We're not departing in these conditions with these numbers. We wait for cooler evening temps, offload fuel, or stay overnight. Those are our options." Clear decision.                                    |
| take_controls | terminal_safe | -1          | -2       | 0      | 0         | Ramp discussion.                                                                                                                                                                                           |

### Tick 4

```
id:           tick_4
scene:        Student decides to attempt the takeoff despite the risk discussion. Lines up on the runway and applies full power. Acceleration is noticeably sluggish. Halfway point markers pass with 55 knots -- well below the expected 65.
studentSpeech:Come on, come on... it's accelerating. We'll make it.
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                           |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | The airplane is not going to make it. Every second of discussion is runway behind you.               |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting at the midpoint of a marginal takeoff roll. Useless.                                       |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching during a go/no-go decision with 2,500 feet of runway remaining. Not enough.                 |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "ABORT. Power idle, brakes." Clear, immediate. Student complies. You stop with 1,000 feet remaining. |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Pulling the power and braking. Justified -- the takeoff was not going to succeed.                    |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (coach/direct)
```

## Score Summary

| Path                                     | recognition | judgment | timing | execution | Total | Outcome         |
| ---------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> coach)         | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late abort (ask -> ask -> ask -> direct) | 0           | -1       | -1     | +1        | -1    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)    | -1          | -5       | -4     | -3        | -13   | terminal_unsafe |

## Author Notes

This scenario bridges the LOC content of Module 3 and the risk management emphasis of Module 2. Hot/high departures are a perennial GA accident cause -- the physics are unforgiving. The scenario deliberately stacks risks the way real accidents do: stale performance calculations, high density altitude, obstacles, schedule pressure, lack of night currency. Each risk alone might be manageable, but together they form an accident chain. The student's rationalizations in ticks 2-3 are drawn from actual accident narratives -- "the POH adds a safety margin" and "what if we use short-field technique" are real pilot statements from NTSB reports. Tick 4 exists for the CFI who let everything else slide -- the abort call is the last opportunity. The teaching point is that the decision should have been made on the ramp (ticks 1-3), not on the runway (tick 4). Connects to RM-1 (preflight risk identification), RM-2 (dynamic reassessment), and the GA safety trends data on density altitude accidents.
