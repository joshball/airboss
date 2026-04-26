---
status: done
phase: C1
type: scenario-script
---

# SCN 5.1: Flight Review with a 350-Hour Private Pilot

## Metadata

```
Scenario ID:     5.1
Title:           Flight Review with a 350-Hour Private Pilot
Module:          5
Difficulty:      0.6
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['ES-1', 'CJ-1']
```

## Student Model

```
Student Model:   Rusty Pilot
Parameters:
  skillLevel:         0.3
  compliance:         0.7
  freezeTendency:     0.3
  overconfidence:     0.5
  instrumentAccuracy: 0.4
  startleDelay:       0.4
  fatigue:            0.3
```

## Briefing

> A private pilot comes to you for a flight review. Their certificate is current but they haven't flown in 22 months. During the ground portion, the pilot answers every question correctly and confidently. They can cite regulations, describe maneuvers accurately, and discuss aerodynamics fluently. Their logbook shows 350 hours, including some complex and high-performance time. They seem well-prepared. You're about to go fly.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Ground review complete. Pilot answered every question well. You're walking to the aircraft. Pilot is relaxed, chatting about aviation news, seems perfectly prepared.
studentSpeech:I've been reading the handbooks and watching videos for the past month. I feel really sharp. Should be a quick flight, right?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When was the last time you actually flew? Not studied -- flew." Distinguishes knowledge currency from skill currency. The key question. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to discuss specific flight activities in the past 22 months. "What have you actually done behind the controls recently?"       |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching expectations before seeing performance. Let the flight reveal the gaps.                                                         |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing a specific flight plan without first understanding the pilot's actual recency. The ground review already passed.               |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Walking to the aircraft.                                                                                                                 |

### Tick 2

```
id:           tick_2
scene:        In the aircraft, preflight complete. Pilot starts the engine. Runs through the checklist smoothly but you notice they fumbled the mixture control and had to look twice at the avionics power-up sequence. Small motor-skill hesitations. Verbal knowledge: perfect. Physical execution: rusty.
studentSpeech:Let me just get the avionics... there we go. Been a while since I've done this in the actual airplane versus the checklist in my living room.
studentState: degrading
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | +1          | +1       | +1     | 0         | "How does the airplane feel compared to what you expected?" Diagnostic. Lets the pilot assess their own rustiness.    |
| prompt        | tick_3     | +1          | +1       | +1     | 0         | Prompting to take the taxi slowly and do a thorough run-up. "No rush today. Let's let the muscle memory come back."   |
| coach         | tick_3     | +1          | 0        | 0      | +1        | Coaching technique on the avionics. Correct but misidentifies the problem as knowledge when it's motor skill atrophy. |
| direct        | tick_3     | 0           | -1       | 0      | +1        | Directing the taxi. Pilot doesn't need help with the procedure -- they need time to recalibrate.                      |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Pilot is taxiing adequately. Hesitations are minor.                                                                   |

### Tick 3

```
id:           tick_3
scene:        Airborne, practicing steep turns. Pilot enters the turn confidently but execution is rough: altitude excursion of 150 feet, bank angle wandering between 40-50 degrees, airspeed fluctuating 15 knots. Pilot seems surprised by their own performance.
studentSpeech:That was... not great. I know how to do this. My hands just aren't doing what my brain is telling them. It's weird.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | -1     | 0         | The pilot just diagnosed their own problem. Don't test them more. Help them work through it.                                                                                                                                                                                                          |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | Prompting to try again with a specific focus. Useful but the pilot needs the reassurance and framework first.                                                                                                                                                                                         |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "That's exactly what 22 months off looks like. Your knowledge is intact -- that's clear. Motor skills and scan timing need to rebuild. That's normal and expected. Let's slow down, simplify, and rebuild from the basics. One thing at a time: hold the bank, let the altitude and airspeed follow." |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing to try again. The pilot will, but they need to understand that what they're experiencing is normal.                                                                                                                                                                                         |
| take_controls | tick_4     | -1          | -2       | -1     | -1        | Pilot is flying safely, just imprecisely.                                                                                                                                                                                                                                                             |

### Tick 4

```
id:           tick_4
scene:        After several more maneuvers -- some improving, some still rough. Landing pattern. Pilot flies the pattern well (procedural knowledge) but the landing is hard and off-centerline. Pilot is frustrated.
studentSpeech:I'm embarrassed. I know every procedure cold. But I can't seem to land this thing smoothly. Am I going to pass this review?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | 0           | -1       | 0      | 0         | Pilot is asking whether they'll pass. Answer honestly and constructively.                                                                                                                                                                                                                                                                                                                                         |
| prompt        | tick_5     | +1          | 0        | 0      | 0         | Prompting about what areas need work. Correct but the emotional moment needs addressing first.                                                                                                                                                                                                                                                                                                                    |
| coach         | tick_5     | +1          | +1       | +1     | +1        | "Don't be embarrassed. Every pilot who takes 22 months off goes through this. Here's what I see: your knowledge is solid, your procedures are good, and your judgment is sound. The motor skills need a few more hours to come back. I'd recommend 3-4 hours of dual with me focused on landings and maneuver precision before I sign the review off. That's not failure -- that's responsible skill rebuilding." |
| direct        | tick_5     | +1          | 0        | 0      | +1        | "The review isn't complete today. We need more time on landings and maneuver precision." Honest but without the framework.                                                                                                                                                                                                                                                                                        |
| take_controls | tick_5     | -1          | -3       | -1     | -1        | Pilot is frustrated but safe.                                                                                                                                                                                                                                                                                                                                                                                     |

### Tick 5

```
id:           tick_5
scene:        Pilot absorbs the feedback. The frustration eases as they realize this is normal and there's a clear plan. They ask about next steps.
studentSpeech:OK. Three or four hours makes sense. Can we schedule those this week? I'd rather get this done right than just have someone sign me off and hope for the best.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                              |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Any reasonable response works here. Pilot is engaged and planning.                                                                                                                                                                                                                      |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to focus on specific areas for each session. Good structure.                                                                                                                                                                                                                  |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Let's schedule three sessions: first one on slow flight and stalls to rebuild the feel, second on landings, third as the review completion flight. And consider joining the WINGS program for ongoing proficiency tracking after we're done." Structured plan plus long-term thinking. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "Three sessions this week. We'll finish the review on the last one." Efficient.                                                                                                                                                                                                         |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                           |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
```

## Score Summary

| Path                                                      | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> ask -> coach -> coach -> coach)           | +5          | +4       | +4     | +3        | +16   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt -> prompt) | +5          | +2       | +2     | 0         | +9    | terminal_safe |
| Poor (direct -> direct -> direct -> direct -> direct)     | +1          | -4       | 0      | +4        | +1    | terminal_safe |

## Author Notes

The template-setter for Module 5 evaluation scenarios. The Rusty Pilot archetype is one of the most common flight review situations: a pilot whose knowledge is current (from studying) but whose skills have atrophied. The trap is that the excellent ground review creates a halo effect -- the CFI assumes the flight will match the ground, and the pilot themselves expects to perform well. The scenario tests ES-1 (tailor a flight review to the pilot) at its deepest level: can the CFI distinguish knowledge from skill, adjust the plan based on observed performance, and deliver a professional recommendation that the pilot accepts? The key teaching point is tick 4: the flight review is a proficiency evaluation, not a pass/fail exam. Telling a 350-hour pilot they need 3-4 more hours isn't a failure -- it's responsible instruction. The pilot's response in tick 5 ("I'd rather get this done right") validates the CFI's approach. AC 61-83K explicitly says flight reviews should be meaningful and tailored, not rote -- this scenario embodies that.
