---
status: done
phase: C1
type: scenario-script
---

# SCN 5.7: WINGS Phase Planning for a Returning Pilot

## Metadata

```
Scenario ID:     5.7
Title:           WINGS Phase Planning for a Returning Pilot
Module:          5
Difficulty:      0.4
Duration:        20 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_7]
```

## Competency Links

```
competencies: ['PS-2', 'ES-1']
```

## Student Model

```
Student Model:   new -- Returning Pilot
Parameters:
  skillLevel:         0.4
  compliance:         0.8
  freezeTendency:     0.2
  overconfidence:     0.2
  instrumentAccuracy: 0.3
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> A private pilot who hasn't flown in 18 months contacts you about getting back into flying. They need a flight review but also want a structured way to rebuild proficiency. They've heard of WINGS but don't understand how to use it as a proficiency framework. They are motivated but realistic about their rust. This is a ground-only planning scenario -- you're building a WINGS-based return-to-flying plan.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO briefing room. The pilot has their logbook showing 18 months of inactivity. Last flight review was 20 months ago (expired). Total time is 280 hours, mostly VFR cross-country.
studentSpeech:I know I need a flight review, but I don't want to just check the box. I want to actually get sharp again. Someone mentioned WINGS -- is that something I should look into? I'm not sure how it works or whether it's worth the trouble.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What kind of flying do you want to get back to? Cross-country? Local? Night?" Understanding their goals before building the plan. |
| prompt        | tick_2     | +1          | +1       | 0      | 0         | Prompting to think about where they felt weakest before the break. Good but goals first.                                           |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Launching into WINGS explanation before understanding their goals. Cart before horse.                                              |
| direct        | tick_2     | 0           | -1       | 0      | 0         | "Sign up for WINGS online." Too transactional. Doesn't build understanding or commitment.                                          |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground conversation.                                                                                                               |

### Tick 2

```
id:           tick_2
scene:        Pilot explains they mostly flew VFR cross-country trips with family. They want to get comfortable enough to resume those trips. They admit their radio work and airspace knowledge feel rusty.
studentSpeech:Mostly cross-country trips -- weekend getaways with my wife. I was comfortable with that before. But last time I flew, I fumbled the radio calls at a Class C airport and it shook my confidence. I also haven't kept up with any airspace changes or TFR procedures.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | +1          | 0        | 0      | 0         | More questions when the pilot has given you enough to start planning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| prompt        | tick_3     | +1          | +1       | 0      | 0         | "What if we built a plan that addresses the radio work and airspace first, then builds toward your cross-country goal?" Good framing.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Here's how WINGS can work for you. We'll build a Basic WINGS phase around your actual weak spots -- radio communications and airspace. WINGS has three activity types: Knowledge, Flight, and Combined. For knowledge, there are free FAASTeam online courses on airspace and communications. For flight, we'll do a structured dual session focused on Class C operations. When you complete the phase, it satisfies your flight review too -- so you're not just checking a box, you're building real proficiency with structure and documentation." Connects WINGS to their specific needs. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "We'll do a dual flight at the Class C airport for your flight review." Addresses one symptom but misses the WINGS structure opportunity.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Tick 3

```
id:           tick_3
scene:        Pilot is engaged and writing notes. Asks about the specific structure of a WINGS phase and how to track progress.
studentSpeech:OK, I like that it's structured. How does the tracking work? Do I just log into a website? And how many activities do I need to complete? I want to make sure I'm actually doing enough, not just gaming the system.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | 0        | -1     | 0         | Pilot asked a direct question. Answer it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "Pull up FAASafety.gov on your phone and let's walk through it together." Good hands-on approach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "FAASafety.gov is the hub. You create an account, enroll in a WINGS phase, and the system tracks your progress. Each phase has required activities in three categories. The knowledge activities are online courses -- I'll recommend specific ones for airspace and communications. The flight activities are things we'll do together -- I'll validate them in the system as your WINGS instructor. You need to complete the required number in each category to finish the phase. The system is designed so that completing a phase genuinely addresses proficiency, not just checkboxes. And once you finish this first phase, we can plan the next one around night currency or your specific cross-country route." Complete, practical, forward-looking. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "Go to FAASafety.gov, create an account, enroll in Basic WINGS." Action item without context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Tick 4

```
id:           tick_4
scene:        Pilot is ready to commit. Asks about timeline and how to maintain proficiency after the initial phase.
studentSpeech:How long should this take? And once I'm current again, how do I keep from getting rusty? I don't want to be back here in another 18 months having the same conversation.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | 0           | 0        | -1     | 0         | Pilot wants a timeline. Give one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| prompt        | tick_5     | +1          | +1       | 0      | 0         | "What's a realistic flying schedule for you -- once a week? Twice a month?" Building the timeline from their availability.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| coach         | tick_5     | +1          | +1       | +1     | +1        | "Plan on 3-4 weeks for the initial phase if you can fly once a week. The knowledge activities you can do at home between flights. For staying current after that: WINGS is ongoing -- you don't stop after one phase. Plan the next phase around your next goal. The Advanced and Master levels build on Basic. And set a personal rule: if you haven't flown in 60 days, book a dual session before flying solo. That prevents the slow rust from becoming a safety issue." Specific timeline, ongoing structure, personal minimums tied to WINGS. |
| direct        | tick_5     | +1          | 0        | +1     | +1        | "Three to four weeks. Fly once a week. Start the next phase when you finish." Efficient.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| take_controls | tick_5     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Tick 5

```
id:           tick_5
scene:        Pilot asks about connecting with the local FAASTeam representative and whether there are local events worth attending.
studentSpeech:You mentioned FAASTeam resources. Is there someone local I should connect with? And are those safety seminars worth going to, or are they just PowerPoint presentations?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | "Have you attended any FAASTeam events before?" Gathering info.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "Check the FAASTeam events calendar for our area on FAASafety.gov." Useful pointer.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "The local FAASTeam Program Manager (FAAST Rep) is worth knowing. They coordinate events, connect pilots with resources, and can credit WINGS activities. The seminars vary -- some are excellent, some are basic -- but they count toward WINGS knowledge activities and they're free. More importantly, they connect you with other pilots who are actively working on proficiency. That community aspect keeps you engaged. I'll introduce you to our local rep." Connects the pilot to the ecosystem. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "I'll send you the FAASTeam rep's contact info." Action item.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
```

## Score Summary

| Path                                                      | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach -> coach)         | +5          | +5       | +5     | +3        | +18   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt -> prompt) | +5          | +3       | +1     | 0         | +9    | terminal_safe |
| Poor (direct -> direct -> direct -> direct -> direct)     | +1          | -1       | +1     | +3        | +4    | terminal_safe |

## Author Notes

A deeper WINGS scenario than 5.6. While 5.6 introduces WINGS briefly as part of a post-checkride conversation, this scenario is entirely focused on using WINGS as a structured return-to-flying framework. It tests whether the CFI understands WINGS deeply enough to build a personalized plan -- not just recommend the program. The five ticks cover: goal-setting (tick 1), connecting WINGS to specific weaknesses (tick 2), practical system mechanics (tick 3), timeline and ongoing proficiency (tick 4), and FAASTeam ecosystem engagement (tick 5). The 20-minute duration reflects the depth of the planning conversation. All paths reach terminal_safe because this is a planning scenario.
