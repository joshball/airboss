---
status: done
phase: C1
type: scenario-script
---

# SCN 4.10: Student Pilot Solo Endorsement Decision

## Metadata

```
Scenario ID:     4.10
Title:           Student Pilot Solo Endorsement Decision
Module:          4
Difficulty:      0.5
Duration:        15 min
Pattern:         Multi-Beat Admin
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_13]
```

## Competency Links

```
competencies: ['RC-3', 'CJ-1']
```

## Student Model

```
Student Model:   new -- Student Pilot Near Solo
Parameters:
  skillLevel:         0.4
  compliance:         0.8
  freezeTendency:     0.3
  overconfidence:     0.2
  instrumentAccuracy: 0.0
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> Your student pilot has been training for two months and is eager to solo. The student handles the aircraft well in calm conditions and has been progressing steadily. The student's parent -- who is paying for training -- calls you to ask about progress. This is a ground-based administrative and decision-making scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Phone call from the parent. You're at your desk reviewing the student's training records. The student has 18 hours of dual and can consistently perform pattern work in calm winds.
studentSpeech:(Parent on phone) Jake's been at this for two months and I've spent over $4,000. His friend at [other school] soloed at 12 hours. When is the solo going to happen? He says he's ready.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | 0           | -1       | 0      | 0         | Asking the parent questions about their expectations prolongs an inappropriate conversation. Set the boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | "I understand the investment. Let me explain what the solo endorsement involves." Acknowledges and redirects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| coach         | tick_2     | +1          | +1       | +1     | +1        | "I understand the cost and the timeline concern. Every student progresses differently -- comparing to other students isn't useful because training environments, aircraft, and weather are all different. Jake is making good progress. The solo endorsement is one of the most serious decisions I make as a CFI -- I'm certifying that Jake can safely operate the aircraft alone. Under 14 CFR 61.87, I must ensure he's proficient in specific maneuvers and procedures, including emergency procedures, before I can endorse the solo. We're close but he needs a few more sessions on crosswinds and emergency procedures. I'll discuss the specific timeline with Jake at our next lesson." Professional, specific, regulatory basis, doesn't undermine the student. |
| direct        | tick_2     | +1          | +1       | 0      | +1        | "I can't discuss training details with anyone but the student. I'll talk to Jake about the timeline." Appropriate but misses the teaching opportunity about what solo readiness means.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Phone call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Tick 2

```
id:           tick_2
scene:        Next training session. Student arrives and immediately brings up the solo. He's been practicing emergency procedures on a home simulator.
studentSpeech:My dad told me you said I'm close. Can we solo today? I've been practicing emergencies on my sim at home. I know the engine failure checklist by heart now. I'm ready.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | +1          | +1       | +1     | 0         | "Let's start with a ground review. Walk me through what you'd do if the engine quit at 500 feet on upwind." Tests the claim without taking the student's word for it. |
| prompt        | tick_3     | +1          | +1       | 0      | 0         | "Show me the emergency checklist from memory, then we'll fly and see." Combines ground and flight evaluation.                                                         |
| coach         | tick_3     | +1          | 0        | 0      | 0         | Coaching on emergency procedures before evaluating whether the home sim practice actually worked. Assess first, then teach.                                           |
| direct        | tick_3     | 0           | -1       | 0      | 0         | "Home sims don't count. We need to practice in the actual airplane." Dismisses legitimate supplementary practice.                                                     |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Ground conversation.                                                                                                                                                  |

### Tick 3

```
id:           tick_3
scene:        During the training flight. Student handles pattern work well. Winds are 8 knots with a 5-knot crosswind component. Student lands safely but the last landing has poor crosswind correction -- drifts left of centerline before correcting.
studentSpeech:(After the flight) That last one was a little off but I caught it. I think I can handle it. Can we do the solo now? The wind is dying down.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "What happened on that last landing? Walk me through what you felt." Good debrief technique.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "What would have happened if the crosswind was stronger?" Pushes the student to think about margins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Your pattern work today was good and your emergency procedure execution was solid -- the sim practice helped. But the crosswind correction on that last landing tells me we need one more session with a steady crosswind. Here's why I'm cautious: when you solo, there's no instructor to help correct a drift or call for a go-around. The crosswind on your solo day might be stronger than today. I need to see you handle 8-10 knots of crosswind consistently before I endorse the solo. Let's plan for [specific day with forecast crosswind]. If you nail it, we solo that day." Specific criteria, clear timeline, honest assessment. |
| direct        | tick_4     | +1          | +1       | 0      | +1        | "Not today. One more crosswind session. If it's good, we solo next time." Clear but doesn't explain the reasoning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Tarmac conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Tick 4

```
id:           tick_4
scene:        Student is disappointed but accepting. Asks about what endorsements are needed and what happens on solo day.
studentSpeech:OK, I trust your judgment. But when we do solo, what actually happens? Do you just sign my logbook and watch from the ramp? And what about my student certificate -- does that need to be updated for solo?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | Student asked a direct procedural question. Answer it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "What do you know about the endorsement requirements from your ground school?" Tests their knowledge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Several things have to be in place. First, your student pilot certificate must be current -- check that it hasn't expired. Second, your medical must be current. Third, I provide specific endorsements in your logbook per 14 CFR 61.87: a pre-solo knowledge test endorsement, a pre-solo flight training endorsement, and a solo flight endorsement that's limited to specific conditions -- make and model of aircraft, airport, and any limitations I specify. On solo day, I'll brief you on the conditions, review the endorsement limitations, and yes -- I'll be watching from the ground. After your first solo, we'll debrief. The endorsement is valid for 90 days, and I can add cross-country endorsements later per 61.93." Complete, procedurally correct, builds confidence. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Logbook endorsements per 61.87, current medical, current student certificate. I'll be on the ground monitoring. Endorsement is good for 90 days." Efficient and accurate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (coach -> ask -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | 0        | +1     | +2        | +4    | terminal_safe |

## Author Notes

This scenario tests the CFI's understanding of student pilot endorsement requirements (14 CFR 61.87) under AC 61-83K Topic A.13, combined with the practical judgment of when a student is ready to solo. The parent pressure in tick 1 tests professional boundaries. The home sim practice in tick 2 tests whether the CFI can evaluate and validate supplementary training. The crosswind landing in tick 3 creates the core decision point -- is the student ready or not? The correct answer is "not yet, but close, with specific criteria for next time." The endorsement walkthrough in tick 4 ensures the CFI knows the actual documentation requirements. The scenario also tests CJ-1 (diagnose student state) because the CFI must accurately assess the student's readiness rather than yielding to external pressure.
