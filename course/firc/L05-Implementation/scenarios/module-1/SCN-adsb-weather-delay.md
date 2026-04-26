---
status: done
phase: C1
type: scenario-script
---

# SCN 1.5: Cross-Country Planning with Cockpit Weather

## Metadata

```
Scenario ID:     1.5
Title:           Cross-Country Planning with Cockpit Weather
Module:          1
Difficulty:      0.4
Duration:        8 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['AV-3', 'RM-1']
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

> Your student is planning a cross-country flight and is using the cockpit weather display (FIS-B via ADS-B In) to check weather along the route. The display shows a line of thunderstorms about 30 miles west, but the path ahead appears clear with a green corridor. The student has 70 hours total time and has been using ADS-B weather tools for the past month. This is a ground-based preflight planning session.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        On the ground, preflight planning. Student points to the cockpit weather display showing the clear corridor between cells.
studentSpeech:Look, there's a gap right here between the cells. The display shows it's clear. If we depart in the next 10 minutes, we can shoot through that gap before the storms move east. Easy.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "How old is that weather image? What's the update cycle?" Perfect question -- exposes the data latency issue.         |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to check the timestamp on the weather image. "When was this radar snapshot taken?"                          |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on FIS-B limitations before the student has seen the problem. Let them discover the gap first.               |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing that FIS-B can't be trusted for tactical weather avoidance. Correct but heavy-handed at the planning stage. |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | On the ground, planning stage.                                                                                        |

### Tick 2

```
id:           tick_2
scene:        Student checks the timestamp -- image is 18 minutes old. You pull up the current NEXRAD on your phone. The "gap" has closed significantly. Cells are merging. Student looks surprised.
studentSpeech:Wait, that's 18 minutes old? But it's always worked for me before. How much can weather change in 18 minutes?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | 0        | -1     | 0         | Student asked a genuine question about weather dynamics. Answer it -- don't test more.                                                                                                                      |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to compare the two images. Useful but the student needs the principle, not just the observation.                                                                                                  |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Thunderstorm cells can move 20-30 knots and grow significantly in 15 minutes. FIS-B is for strategic awareness -- big picture. It is not for threading gaps between cells. That's a critical distinction." |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to cancel the flight or wait. Safe but the teaching moment is happening now -- use it.                                                                                                            |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | On the ground.                                                                                                                                                                                              |

### Tick 3

```
id:           tick_3
scene:        Student is processing the information. Looking between the cockpit display and your phone's current radar. The difference is stark. Student's confidence in the display is shaken.
studentSpeech:So I can't trust this thing at all? Then what's the point of having it?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student asked a direct question about the tool's purpose. Answering with another question feels evasive.                                                                                                                                                                                                                      |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting to think about strategic vs tactical use. Correct direction but the student needs the explanation.                                                                                                                                                                                                                  |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "You can trust it for the big picture -- knowing where the major weather is. You cannot trust it for threading between cells or timing a gap. Use it to make the go/no-go decision, not to navigate through weather. And always compare it with the freshest source available before departure." Complete, practical, honest. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing the go/no-go decision based on the current radar. Good decision but incomplete teaching.                                                                                                                                                                                                                            |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Ground discussion.                                                                                                                                                                                                                                                                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                                  | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)       | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (prompt -> prompt -> prompt) | +3          | +1       | +1     | 0         | +5    | terminal_safe |
| Poor (direct -> direct -> direct)     | +1          | -2       | 0      | +2        | +1    | terminal_safe |

## Author Notes

A shorter, ground-based diagnostic puzzle that teaches the most dangerous FIS-B misconception: using it for tactical weather avoidance. The 15-20 minute data latency means the picture on the display may have changed dramatically by the time you see it. The "gap between cells" scenario is drawn from actual thunderstorm penetration accidents where pilots trusted datalink weather to thread between cells. The scenario has no terminal_unsafe path because it takes place on the ground during planning -- the risk is conceptual, not immediate. But the concept it teaches prevents the in-flight version from happening. This pairs with 1.4 (traffic display limitations) to build the theme: glass cockpit tools are powerful but have specific, non-obvious limitations that pilots often don't understand. The final teaching point -- "strategic, not tactical" -- is the one-liner the CFI should internalize and pass to every student.
