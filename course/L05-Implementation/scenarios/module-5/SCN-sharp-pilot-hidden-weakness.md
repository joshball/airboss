---
status: done
phase: C1
type: scenario-script
---

# SCN 5.3: IPC for an Instrument-Rated Private Pilot

## Metadata

```
Scenario ID:     5.3
Title:           IPC for an Instrument-Rated Private Pilot
Module:          5
Difficulty:      0.5
Duration:        12 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['ES-1', 'ES-2', 'CJ-1']
```

## Student Model

```
Student Model:   new -- Competent Pilot with Blind Spot
Parameters:
  skillLevel:         0.7
  compliance:         0.6
  freezeTendency:     0.2
  overconfidence:     0.5
  instrumentAccuracy: 0.3
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> An instrument-rated private pilot with 400 hours requests an IPC (Instrument Proficiency Check). The pilot flies regularly VFR but hasn't filed IFR in 14 months. Ground knowledge on approaches, holds, and regulations is solid. The pilot is honest about being rusty on instruments but confident in their ability to shake off the rust quickly. During the flight, one specific area reveals a significant gap.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Under the hood, flying an ILS approach. Localizer tracking is surprisingly good -- within a dot. But as the pilot descends on the glideslope, altitude corrections are erratic. The pilot is chasing the glideslope needle with pitch changes that create a roller-coaster descent profile.
studentSpeech:Localizer looks good. Glideslope is... bouncing around a lot. Is the glideslope signal always this sensitive?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What are you using to track the glideslope? Describe your scan." Diagnostic -- the question will reveal whether the pilot is chasing the needle or using a pitch/power method. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to stabilize and use a consistent descent rate rather than chasing the needle.                                                                                        |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching the technique before diagnosing the cause. Find out what the pilot is doing first.                                                                                     |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to set a specific descent rate. Fixes the immediate problem but doesn't identify the root cause.                                                                      |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Pilot is tracking localizer well, glideslope is oscillating but safe.                                                                                                           |

### Tick 2

```
id:           tick_2
scene:        Pilot reveals their scan: they're looking at the glideslope indicator, adjusting pitch, then looking back at the glideslope indicator. They're not including airspeed or VSI in the cross-check. The scan is fixated on one instrument.
studentSpeech:I'm just watching the glideslope needle and adjusting. That's how I was taught. Isn't that how everyone does it? I keep the needle centered.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You've diagnosed the problem: fixated scan. Now teach the fix.                                                                                                                                                                                                                                                      |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "Let me show you something. Set 500 fpm descent and hold it. Don't look at the glideslope for 10 seconds. What happened?" Makes the lesson experiential.                                                                                                                                                            |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "You're chasing the needle. That creates oscillation because there's a lag between your pitch input and the needle movement. Try this: set a 500 fpm descent with pitch and power, then let the glideslope be a trend indicator, not a target. Check it every 5 seconds, don't stare at it." Root-cause correction. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to set 500 fpm and hold it. Fixes the symptom but the scan pattern needs explicit correction.                                                                                                                                                                                                             |
| take_controls | tick_3     | -1          | -2       | -1     | -1        | Pilot is safe, learning.                                                                                                                                                                                                                                                                                            |

### Tick 3

```
id:           tick_3
scene:        Pilot tries the new technique. The descent stabilizes significantly. Glideslope tracking improves. The pilot is surprised by the improvement.
studentSpeech:Wow, that's completely different. The needle is barely moving now. I've been doing it wrong for years. How did I not know this?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "What's the difference between what you were doing and what you're doing now?" Good synthesis question.                                                                                                                                                                                                                                               |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | Prompting to articulate the principle. "Primary instrument for descent control is...?" Reinforces through teaching.                                                                                                                                                                                                                                   |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "The scan pattern is the foundation. Everything else builds on it. When you don't fly IFR regularly, the scan is the first thing that degrades. The good news is it comes back fast with practice. Let's do this approach one more time -- and this time, verbalize your scan to me." Explains the why, normalizes the gap, builds the practice plan. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing another approach. Useful practice.                                                                                                                                                                                                                                                                                                          |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Pilot just had a breakthrough.                                                                                                                                                                                                                                                                                                                        |

### Tick 4

```
id:           tick_4
scene:        Second approach. Glideslope tracking is much better. Pilot's overall instrument performance is now within IPC standards. Debrief time.
studentSpeech:That second approach felt completely different. My scan needs work, clearly. Am I going to pass the IPC? I know the first approach was bad.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | Pilot wants the verdict. Give it with context.                                                                                                                                                                                                                                                                                                                                                                      |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting to evaluate their own performance. Good but they're asking for your professional assessment.                                                                                                                                                                                                                                                                                                              |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "The second approach met standards. I'll sign the IPC. But here's my recommendation: schedule a few hours of hood time in the next month to rebuild the scan. Use the WINGS program to get credit for the proficiency work. The scan will atrophy again if you don't maintain it. I'd rather see you do 2 hours of practice now than wait 14 months and start over." Signs, but with a meaningful proficiency plan. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "IPC is complete. I recommend follow-up practice on instrument scan within the next month." Signs with recommendation.                                                                                                                                                                                                                                                                                              |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Debrief.                                                                                                                                                                                                                                                                                                                                                                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                          | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> prompt -> coach -> coach)     | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> coach -> coach -> direct) | +4          | +3       | +3     | +3        | +13   | terminal_safe |
| Poor (direct -> direct -> direct -> direct)   | +1          | -2       | 0      | +4        | +3    | terminal_safe |

## Author Notes

This scenario targets IPC conduct specifically (ES-2). The hidden weakness is instrument scan fixation -- a common real-world issue that often goes undetected because the pilot can track one axis well (localizer, in this case) while failing on the other (glideslope). The low instrumentAccuracy (0.3) in the student model reflects the atrophied scan, not lack of knowledge. The "wow" moment in tick 3 is the scenario's payoff: the pilot discovers that a simple technique change dramatically improves their performance. This is what a meaningful IPC looks like -- not a checklist of maneuvers to perform, but a diagnosis of the specific weakness and a targeted correction. The proficiency plan recommendation (WINGS, follow-up practice) connects to ES-1 and the A.7 (FAASTeam/WINGS) topic. The second approach succeeding is important: it shows the pilot CAN do this -- they just need the scan refresher and a plan to maintain it.
