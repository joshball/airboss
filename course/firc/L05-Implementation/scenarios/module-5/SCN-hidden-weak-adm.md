---
status: done
phase: C1
type: scenario-script
---

# SCN 5.2: Flight Review with a 500-Hour Owner-Pilot

## Metadata

```
Scenario ID:     5.2
Title:           Flight Review with a 500-Hour Owner-Pilot
Module:          5
Difficulty:      0.7
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_9, FAA_TOPIC.A_5]
```

## Competency Links

```
competencies: ['ES-1', 'CJ-1', 'RM-1']
```

## Student Model

```
Student Model:   Sharp but Weak ADM
Parameters:
  skillLevel:         0.8
  compliance:         0.4
  overconfidence:     0.7
  freezeTendency:     0.1
  instrumentAccuracy: 0.6
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A private pilot with 500 hours comes in for a flight review. The pilot flies 8-10 hours per month, owns their own airplane, and is confident and current. Maneuvers are crisp, radio work is professional, and systems knowledge is solid. Ground review was excellent. You are heading out to fly the review portion.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        In flight. You've completed steep turns, slow flight, and stalls -- all within ACS tolerances. The pilot is flying smoothly. You ask them to plan a diversion to a nearby airport. The pilot immediately programs the GPS direct-to without checking weather, NOTAMs, or fuel.
studentSpeech:Done. Direct-to KXYZ, 22 nautical miles, 12 minutes. Easy. What's next?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What's the weather at the alternate? Any NOTAMs? How's our fuel?" Probes the gap between execution and planning.                   |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to consider what information you need before diverting. "What else should you check before committing to this diversion?" |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on diversion planning when the gap hasn't been fully revealed yet. One more probe maps it better.                          |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing to check weather/NOTAMs. Fixes this instance but doesn't diagnose the pattern.                                            |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | In flight, no safety issue.                                                                                                         |

### Tick 2

```
id:           tick_2
scene:        Pilot looks mildly surprised by the question. Checks weather -- KXYZ is VFR. Checks NOTAMs -- runway is shortened for construction. Fuel is adequate. Pilot shrugs it off.
studentSpeech:Weather's fine, fuel's fine. The runway is shorter but it's plenty for our airplane. I've been flying into this airport for years. I don't usually bother checking all that for a short hop.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                   |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3     | 0           | -1       | -1     | 0         | The ADM gap is now visible. "I don't usually bother" is the diagnostic gold. Don't just note it -- address it.                                                                                                                                               |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "What if the weather had changed? Or the runway was closed? What does your diversion checklist look like?" Challenges the assumption.                                                                                                                        |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Your flying is excellent. But 'I don't usually bother checking' for a diversion is a risk pattern. Checking takes 30 seconds and prevents surprises. The day the runway is closed or the weather is marginal is the day it matters." Direct but respectful. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to always check before diverting. The pilot hears it as a rule, not a principle.                                                                                                                                                                   |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | In flight, no safety issue.                                                                                                                                                                                                                                  |

### Tick 3

```
id:           tick_3
scene:        You set up a scenario: simulated engine roughness. You ask the pilot what they'd do. The pilot immediately identifies the nearest airport and says they'd go there. You ask about off-airport options, passenger briefing, and the emergency checklist. The pilot dismisses these.
studentSpeech:If the engine is rough, I'm going to the nearest airport. That's obvious. I wouldn't waste time with checklists while the engine is failing. I've got 500 hours -- I know what to do.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | 0      | 0         | The pattern is clear: high skill, poor decision framework. Two data points (diversion, emergency) show the same gap. Coach it.                                                                                                                                                                                                                                                                                                           |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | Prompting to consider what happens if the nearest airport is not reachable. Challenges the assumption.                                                                                                                                                                                                                                                                                                                                   |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Your instinct to go to the nearest airport is good. But the checklist isn't a waste of time -- carburetor heat, mixture, fuel selector -- those might fix the problem in 10 seconds. And what if the nearest airport is 15 miles away and you don't make it? Having already identified off-airport options means you're not starting from zero. Your skills will get you there -- but ADM is what keeps you from needing those skills." |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing to work through the emergency procedure. Pilot complies but the underlying attitude isn't addressed.                                                                                                                                                                                                                                                                                                                           |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Simulated scenario discussion.                                                                                                                                                                                                                                                                                                                                                                                                           |

### Tick 4

```
id:           tick_4
scene:        Post-flight debrief. Pilot is waiting for the signoff. Maneuver quality was excellent. ADM showed consistent pattern of skipping steps and relying on experience over procedure.
studentSpeech:So, do I pass? Everything was within standards, right? I know the steep turns and stalls were good.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Pilot is asking for the result. Give it to them -- with the context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting to reflect on the decision-making patterns from the flight. Useful but the pilot needs the direct feedback.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Your stick and rudder skills are excellent. I'll sign the review. But I want to flag something: in two scenarios, your first response was to skip the planning and checking steps because your experience told you it was fine. That works until it doesn't. The pilots in NTSB reports had experience too. Consider making a personal checklist for diversions and emergencies -- not because you need it today, but because the day you need it, you won't have time to think of it." Signs the review but delivers meaningful feedback. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "You pass on maneuvers. I'd encourage you to work on your decision-making framework." Honest but thin.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Debrief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                           | recognition | judgment | timing | execution | Total | Outcome       |
| ---------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> prompt -> coach -> coach)      | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> coach -> prompt -> prompt) | +4          | +2       | +2     | +1        | +9    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)    | +1          | -3       | 0      | +3        | +1    | terminal_safe |

## Author Notes

The hardest diagnostic puzzle in Module 5. The pilot passes every objective measure -- maneuvers, knowledge, radio work. The gap is entirely in ADM (aeronautical decision-making), and it only appears when the CFI probes with scenario questions, not maneuver tasks. This is the "sharp but weak ADM" archetype: the pilot who survives on skill until the day skill isn't enough. The two diagnostic moments (diversion without checking, emergency without procedure) reveal the same pattern: over-reliance on experience, under-reliance on systems. The optimal path signs the review -- the pilot earned it on maneuvers -- but delivers substantive ADM feedback that may prevent an accident. The worst path either signs without the feedback (rubber stamp) or fails the pilot on maneuvers that were within standards (unfair). This connects to ES-1 (tailored evaluation -- what does THIS pilot need?) and RM-1 (risk identification -- the CFI must identify risk patterns in another pilot's decision-making, not just their own).
