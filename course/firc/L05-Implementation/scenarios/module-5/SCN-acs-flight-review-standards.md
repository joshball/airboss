---
status: done
phase: C1
type: scenario-script
---

# SCN 5.8: Applying ACS Standards in a Flight Review

## Metadata

```
Scenario ID:     5.8
Title:           Applying ACS Standards in a Flight Review
Module:          5
Difficulty:      0.5
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_12, FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['ES-3', 'ES-1']
```

## Student Model

```
Student Model:   new -- Experienced VFR Pilot
Parameters:
  skillLevel:         0.6
  compliance:         0.7
  freezeTendency:     0.1
  overconfidence:     0.5
  instrumentAccuracy: 0.3
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> You are conducting a flight review for a private pilot with 400 hours, all VFR. During the ground portion, you are using the ACS as your evaluation framework. The pilot is cooperative and engaged. You are partway through the ground review and preparing to transition to the flight portion.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Ground portion of flight review. Pilot has answered knowledge questions confidently. You've moved to scenario-based risk management questions. You present a scenario about deteriorating weather on a VFR cross-country.
studentSpeech:Well, VFR minimums are 3 statute miles and clear of clouds below 10,000 feet in Class E. And 1,000 above, 500 below, 2,000 horizontal at or above. So as long as I'm legal, I'd keep going. Rules are rules, right?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What if conditions were exactly at minimums -- 3 miles vis and scattered clouds at 1,200 feet. Would you launch that cross-country? Walk me through your thinking." Probes the gap between legal knowledge and practical judgment. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | "Think about a time when legal minimums weren't the same as safe minimums." Pushes toward the insight.                                                                                                                              |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Explaining the difference between legal and safe immediately. Correct but doesn't let the pilot discover the gap.                                                                                                                   |
| direct        | tick_2     | 0           | -1       | 0      | 0         | "Legal doesn't mean safe. You need to think beyond the numbers." True but doesn't teach.                                                                                                                                            |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground conversation.                                                                                                                                                                                                                |

### Tick 2

```
id:           tick_2
scene:        Pilot hesitates. They know the right answer is "it depends" but struggle to articulate what it depends on.
studentSpeech:I mean... I guess I'd check the forecast and see if it was getting worse? But honestly, if it's legal, I've always just gone. I've been flying for 15 years and never had a problem. What else should I be considering?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Pilot asked "what else should I be considering?" Answer the question.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | "What factors beyond visibility and cloud clearance affect a VFR cross-country decision?" Gets them thinking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Here's what ACS risk management looks like for cross-country planning: it's not just legal minimums. You consider terrain along the route, your personal experience with similar conditions, whether conditions are stable or deteriorating, availability of alternates, time of day, aircraft equipment, and your own currency and fatigue. ACS asks: can you identify the risks? Can you assess their severity? Can you mitigate them? Knowing the legal minimums is the knowledge dimension. Deciding whether to fly in those minimums is the risk management dimension. Fifteen years of never having a problem doesn't mean the risk isn't there -- it means you've been lucky or conservative, and you should know which one." Connects ACS framework to practical decision-making. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "Consider terrain, experience, forecast trend, alternates, and personal minimums. Legal isn't the whole picture." List of factors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Tick 3

```
id:           tick_3
scene:        Pilot is engaged but reveals they've never set personal minimums. Asks what the flight portion of the review will look like given these gaps.
studentSpeech:I've never really thought about personal minimums. I just go by the FARs. So does this mean I'm failing the flight review? And what are you going to evaluate during the flight?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | 0      | 0         | Pilot is anxious about failing. Address the concern directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "A flight review isn't a checkride -- it's a learning event. What do you think we should focus on in the flight?" Reframes the review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "A flight review is not a pass/fail test -- it's a proficiency evaluation and training event. You're not failing; you're identifying an area to strengthen. That's exactly what the review is for. For the flight: I'll use the ACS framework to evaluate your practical skills, and I'll incorporate scenario-based decision-making. I'll present situations during the flight -- weather changes, simulated emergencies, airspace decisions -- and I'll evaluate how you think through them, not just whether you hold altitude. If we find gaps, we'll work on them during the review. We might need more than the minimum time, and that's fine." Addresses the anxiety, explains the ACS-structured flight portion, sets expectations. |
| direct        | tick_4     | +1          | 0        | +1     | +1        | "You're not failing. Flight reviews aren't pass/fail. We'll use the flight to work on risk management." Reassures and redirects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Tick 4

```
id:           tick_4
scene:        Pilot is relieved and asks about setting personal minimums before the flight.
studentSpeech:OK, so before we fly, can you help me set some personal minimums? I realize I've been flying for 15 years without ever writing any down. What should they look like?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | "What conditions have you turned down flights in before?" Builds from their experience. Good.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | "Start with the categories: ceiling, visibility, wind, crosswind, runway length. What numbers feel safe to you?" Structured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Let's build them now. Start conservative and adjust with experience. I'd suggest: ceiling 3,000 feet for cross-country (gives you room to maneuver), visibility 5 miles (legal is 3, but 5 gives margin), crosswind component no more than 50% of demonstrated crosswind for your aircraft, and no night flight over unfamiliar terrain until you've built 20 hours of night PIC. Write these down, keep them in your flight bag, and review them every 6 months. The key is: these are your decision-making tool before you're in the airplane. They remove the temptation to rationalize in the moment." Specific, conservative, actionable, connected to the ACS risk management framework they just discussed. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Ceiling 3,000, visibility 5 miles, crosswind 50% of demonstrated, no night over unfamiliar terrain. Write them down." Efficient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -2       | +1     | +2        | +2    | terminal_safe |

## Author Notes

This scenario bridges A.12 (ACS Standards) and A.9 (Flight Review) by testing whether a CFI can apply the ACS framework during a flight review. The key insight: an experienced VFR pilot who knows the regulations cold but has never developed risk management thinking represents a gap that PTS wouldn't catch but ACS is designed to expose. The pilot's 15 years of incident-free flying demonstrates the difference between skill and judgment -- they've been safe because their flying has been conservative (or lucky), not because they have a systematic risk management framework. The personal minimums discussion in tick 4 turns the ACS concept into a practical tool. This scenario also tests the CFI's ability to frame a flight review as a training event, not a test -- a common misconception among pilots and sometimes among CFIs.
