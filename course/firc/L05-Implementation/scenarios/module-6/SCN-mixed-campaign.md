---
status: done
phase: C1
type: scenario-script
---

# SCN 6.1: Mixed Campaign Scenario

## Metadata

```
Scenario ID:     6.1
Title:           Mixed Campaign Scenario
Module:          6
Difficulty:      0.7
Duration:        25 min
Pattern:         Integrated Capstone
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_4, FAA_TOPIC.A_5, FAA_TOPIC.A_11, FAA_TOPIC.A_9, FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-2', 'RM-1', 'RM-2', 'AC-1', 'AV-1', 'ES-1', 'PS-1']
```

## Student Model

```
Student Model:   new -- Variable (shifts between archetypes)
Parameters:
  skillLevel:         0.5
  compliance:         0.6
  freezeTendency:     0.3
  overconfidence:     0.5
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> It is a typical Saturday at a busy flight school. You are the senior instructor on duty. Your morning includes: a flight review for a pilot you've never met, a training flight with a student who is behind schedule, and a walk-in who wants to discuss starting flight training. The weather is marginal and deteriorating. You have three back-to-back appointments. Your day is about to test every dimension of your instructional judgment.

## Tick Script

### Tick 1 -- Morning Briefing

```
id:           tick_1
scene:        FBO briefing room, 8 AM. Weather is 3,500 scattered, visibility 8 miles, forecast to go 2,000 broken by noon. You check the schedule: 8:30 flight review, 10:30 training flight, and a walk-in is already sitting in the lobby. Your coffee is getting cold.
studentSpeech:(Phone rings) Hey, this is your 8:30. I'm running late. Can we push to 9? I was out late last night and I need another cup of coffee.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "How late were you out? How are you feeling this morning?" Assesses fitness before committing to the flight. The late night is a risk factor. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to consider whether the flight review should happen today given fatigue and deteriorating weather.                                  |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching the schedule. Fine but assess the fitness question first.                                                                            |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Agreeing to push to 9 without assessing fitness. The weather window is closing and the pilot may be fatigued.                                 |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Phone call.                                                                                                                                   |

### Tick 2 -- Flight Review Assessment

```
id:           tick_2
scene:        9 AM. The flight review pilot arrives. Looks tired but alert. Coffee in hand. You have 90 minutes before the weather window closes and 90 minutes before your next student. Ground review reveals solid knowledge but the pilot hasn't flown in 4 months.
studentSpeech:I know I'm rusty. But I've been studying all week. Can we just do a quick flight and I'll come back for more practice after the review?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You know the pilot is rusty and fatigued. The schedule is tight and weather is closing. Make a decision.                                                                                                                                                                           |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to consider whether today is the right day given fatigue, rustiness, and weather.                                                                                                                                                                                        |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "I can start the review today, but if you need more time to get proficient, we'll schedule follow-up flights. No pressure to finish in one session -- especially with the weather closing in. Let's fly what we can safely and see where you are." Professional, flexible, honest. |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "We'll start the review. If the weather holds, we fly. If not, ground only today and fly next week. I won't rush a review to beat weather." Clear boundary.                                                                                                                        |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                                                                                                                                                                     |

### Tick 3 -- Training Flight Decision

```
id:           tick_3
scene:        10:15 AM. Flight review is done (or partially done). Weather has dropped to 2,500 broken, visibility 6 miles. Your 10:30 student arrives. This student is behind schedule for their stage check and is anxious about falling further behind. The student's parents have called the school twice this week asking about progress.
studentSpeech:Are we still flying? I really need this lesson. My stage check is next week and I'm not ready. My parents are going to be upset if I fall further behind.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | -1     | 0         | The student is pressured and the weather is marginal. Make the call.                                                                                                                                                                                                                                                                                                  |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | Prompting to evaluate whether the lesson objectives can be met in current conditions.                                                                                                                                                                                                                                                                                 |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "The weather is marginal for pattern work. Here's what we can do: ground session today focused on your weak areas for the stage check, then fly first thing tomorrow when the weather improves. You'll be more prepared for the stage check with targeted ground work than with a marginal weather flight." Addresses the anxiety, provides a productive alternative. |
| direct        | tick_4     | +1          | +1       | +1     | +1        | "No flying in this weather for your training objectives. We'll do ground today. I'll call your parents and explain the plan. Stage check is better served by preparation, not pressure." Takes ownership.                                                                                                                                                             |
| take_controls | tick_4     | -1          | -2       | -1     | -1        | Conversation about schedule.                                                                                                                                                                                                                                                                                                                                          |

### Tick 4 -- Walk-In Prospective Student

```
id:           tick_4
scene:        11:30 AM. Between sessions. The walk-in approaches you. They speak with an accent and mention they're interested in starting flight training. They have questions about the process and requirements.
studentSpeech:Hello, I would like to learn to fly. I am here from overseas on a work visa. What do I need to begin?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | +1          | +1       | +1     | 0         | "What is your citizenship status?" The essential first question for any new student -- triggers TSA determination.    |
| prompt        | tick_5     | +1          | +1       | +1     | 0         | Prompting to clarify citizenship before discussing training options.                                                  |
| coach         | tick_5     | +1          | 0        | +1     | 0         | Coaching the enrollment process. Fine but citizenship status must be determined first.                                |
| direct        | tick_5     | 0           | -1       | 0      | 0         | Starting enrollment discussion without citizenship verification. Could begin a process that needs TSA approval first. |
| take_controls | tick_5     | -1          | -3       | -1     | -1        | Conversation.                                                                                                         |

### Tick 5 -- Day Wrap-Up

```
id:           tick_5
scene:        1 PM. Weather has gone IFR. The walk-in is a foreign national -- you've explained the TSA process. Your flight review pilot calls back asking if they can come tomorrow. Your training student's parents have called again. The chief pilot wants a status update.
studentSpeech:(Chief pilot) How'd the morning go? Any issues I should know about?
studentState: nominal
safeWindow:   [coach, direct]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Any reasonable question about priorities works.                                                                                                                                                                                                                                                                                                 |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting the chief about weather-day policies. Good operational awareness.                                                                                                                                                                                                                                                                     |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Professional debrief: "Flight review started, pilot needs follow-up sessions. Training student got productive ground work -- ready for tomorrow's flight if weather improves. Walk-in needs TSA processing -- I gave them the requirements. No issues, everyone's safe, and the schedule is recovered." Comprehensive, professional, proactive. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "All good. Three items for follow-up: flight review continuation, stage check prep flight tomorrow, TSA process for new walk-in." Efficient reporting.                                                                                                                                                                                          |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Office conversation.                                                                                                                                                                                                                                                                                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
```

## Score Summary

| Path                                                   | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------------------------ | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> ask -> coach)        | +5          | +5       | +5     | +3        | +18   | terminal_safe |
| Adequate (prompt -> direct -> direct -> ask -> direct) | +4          | +2       | +3     | +3        | +12   | terminal_safe |
| Poor (direct -> ask -> ask -> direct -> ask)           | 0           | -3       | -1     | 0         | -4    | terminal_safe |

## Author Notes

The flagship capstone scenario. This integrates five FAA topics and eight competencies across a single "day in the life" of a busy CFI. Each tick presents a different challenge: fitness assessment (RM-1), evaluation standards (ES-1), schedule pressure with a student behind (PS-1, CJ-2), TSA compliance (RC-1 implied), and professional communication (PS-1). The scenario tests whether the CFI can manage competing demands while maintaining standards. The weather thread runs through the entire day, requiring dynamic reassessment at each tick. The optimal path never compromises safety for schedule: the flight review starts but may not finish, the training flight becomes ground work, and the walk-in gets the correct TSA guidance. The terminal states are all safe because the CFI controls the day's decisions -- the scores reflect the quality of those decisions. Note this is 25 minutes and 5 ticks -- it should feel like a compressed but complete morning of real CFI work.
