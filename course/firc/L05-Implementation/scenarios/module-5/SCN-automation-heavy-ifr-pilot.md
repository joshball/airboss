---
status: done
phase: C1
type: scenario-script
---

# SCN 5.4: IPC in a Cirrus SR22

## Metadata

```
Scenario ID:     5.4
Title:           IPC in a Cirrus SR22
Module:          5
Difficulty:      0.6
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_9, FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['ES-2', 'AV-1', 'CJ-1']
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

> An instrument-rated private pilot requests an IPC. The pilot flies 6-8 hours per month in a Cirrus SR22 with full Perspective avionics. All recent flights have been with autopilot engaged. The pilot routinely flies IFR cross-countries and is comfortable with the automation. You are conducting the IPC in the same aircraft.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Under the hood, outbound on a procedure turn. You've asked the pilot to disconnect the autopilot and hand-fly. The moment the autopilot disconnects, the pilot's heading begins wandering. Altitude starts oscillating +/- 100 feet. The pilot is gripping the sidestick tightly.
studentSpeech:OK, autopilot is off. This feels... different. The airplane seems twitchy. It's hard to hold a heading without the autopilot trimming for me.
studentState: degrading
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When was the last time you hand-flew a full approach? How often do you fly without the autopilot?" Diagnostic -- establishes the scope of the dependency.                    |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to focus on trim first. "Before anything else, get the aircraft trimmed for hands-off straight and level." Teaches the fundamental that automation has been hiding. |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Coaching hand-flying technique immediately. Useful but diagnosing the depth of the dependency is more important first.                                                        |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing specific pitch and bank corrections. The pilot needs to rebuild the feel, not follow directions.                                                                    |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Pilot is safe, just imprecise. Under the hood with an evaluator is the safest time to practice.                                                                               |

### Tick 2

```
id:           tick_2
scene:        Pilot admits they almost never hand-fly. Maybe 5 minutes per month, during takeoff and landing. Everything else is autopilot. The hand-flying stabilizes slightly after your intervention but is still rough.
studentSpeech:Honestly? I hand-fly for takeoff and the first 500 feet, then I turn the autopilot on. Same coming in -- I hand-fly the last 200 feet after I disconnect. Everything in between is George. That's what the airplane is designed for, right?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You now know the scope. The pilot hand-flies 5 minutes per month. Address it.                                                                                                                                                                                                                                             |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "What happens if the autopilot fails at 3,000 feet in IMC? You'd need to hand-fly the entire approach. Can you do that right now?" Makes the gap consequential.                                                                                                                                                           |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "The airplane is designed to be flown with the autopilot. But the regulations require you to be able to fly without it. And the autopilot will fail someday -- usually at the worst possible moment. Let's work on this: hand-fly the procedure turn and the approach. No autopilot." Sets the standard and the exercise. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to hand-fly the entire approach. Correct but the pilot needs to understand why, not just comply.                                                                                                                                                                                                                |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Training exercise.                                                                                                                                                                                                                                                                                                        |

### Tick 3

```
id:           tick_3
scene:        Pilot attempts to hand-fly the procedure turn. The turn inbound is 30 degrees off the intended heading. Altitude is lost during the turn. The pilot is clearly working very hard.
studentSpeech:This is harder than I remember. I used to be able to do this. I think the airplane is harder to hand-fly than the one I trained in.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                   |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | 0      | 0         | Pilot is struggling and making excuses ("the airplane is harder"). Address the skill atrophy, not the airplane.                                                                                                                                                                              |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | Prompting to focus on one thing at a time. Useful approach for rebuilding.                                                                                                                                                                                                                   |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "The airplane isn't harder -- your manual flying skills have atrophied from disuse. That's normal and fixable. Let's simplify: maintain altitude first, let the heading settle. Once altitude is stable, then work on the turn. One variable at a time." Honest, non-judgmental, productive. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing to level off and start over. Works but doesn't address the underlying issue.                                                                                                                                                                                                       |
| take_controls | tick_4     | -1          | -2       | -1     | -1        | Pilot needs the practice, not a demonstration.                                                                                                                                                                                                                                               |

### Tick 4

```
id:           tick_4
scene:        After working through the approach, pilot lands (adequately, with you ready to take over). Debrief. The pilot is humbled but receptive.
studentSpeech:I had no idea I'd gotten this bad at hand-flying. I thought because I fly all the time, I was proficient. What do I need to do?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Any reasonable question continues the productive debrief.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to consider how to integrate hand-flying into regular flying. Good long-term thinking.                                                                                                                                                                                                                                                                                                                                                                              |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Here's my plan: I can't sign the IPC today because the hand-flying isn't at IPC standards. But here's the fix: commit to hand-flying the first 10 minutes and last 10 minutes of every flight. No autopilot below 3,000 on approach. Fly one approach per month fully hand-flown. We schedule two more sessions -- one focused on hand-flying, one as the IPC completion. You'll be back to standard in a few hours." Honest assessment, specific plan, achievable timeline. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "IPC not complete today. You need more hand-flying practice. Let's schedule follow-ups." Honest but sparse.                                                                                                                                                                                                                                                                                                                                                                   |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Debrief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                           | recognition | judgment | timing | execution | Total | Outcome       |
| ---------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> prompt -> coach -> coach)      | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> coach -> prompt -> direct) | +4          | +2       | +2     | +2        | +10   | terminal_safe |
| Poor (direct -> direct -> direct -> direct)    | +1          | -2       | 0      | +4        | +3    | terminal_safe |

## Author Notes

This scenario connects Module 5 (evaluation) back to Module 1 (automation). The pilot who flies 6-8 hours per month looks current -- but all those hours are with the autopilot doing the flying. Manual proficiency has atrophied to dangerous levels. The scenario tests ES-2 (tailor an IPC meaningfully) and AV-1 (teach automation without dependency) simultaneously. The "everything between 500 AGL and 200 feet is autopilot" description is drawn from real Cirrus community flying patterns -- it's not unusual, but it creates pilots who are automation operators, not airplane flyers. The teaching point is that currency (recent flight hours) is not the same as proficiency (ability to perform). The CFI must be willing to not sign the IPC when hand-flying is below standard, even though the pilot flies regularly. The proficiency plan (hand-fly first/last 10 minutes of every flight) is practical and achievable -- it doesn't require the pilot to stop using the autopilot, just to practice without it regularly.
