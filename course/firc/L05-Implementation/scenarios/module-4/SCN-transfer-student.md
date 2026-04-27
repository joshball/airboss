---
status: done
phase: C1
type: scenario-script
---

# SCN 4.5: Transfer Student Wants to Resume Training

## Metadata

```
Scenario ID:     4.5
Title:           Transfer Student Wants to Resume Training
Module:          4
Difficulty:      0.5
Duration:        8 min
Pattern:         Multi-Beat Admin
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_3]
```

## Competency Links

```
competencies: ['RC-1', 'RC-2']
```

## Student Model

```
Student Model:   new -- Transfer Student (Foreign National)
Parameters:
  skillLevel:         0.3
  compliance:         0.6
  freezeTendency:     0.1
  overconfidence:     0.4
  instrumentAccuracy: 0.3
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A student pilot transfers to your school from another Part 141 school across town. The student is a foreign national with 35 hours logged. The student has a training record folder from the previous school and wants to resume training as soon as possible. This is a ground-based administrative scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO office. Transfer student arrives with a partial training record and a receipt from the previous school. They hand you a folder with some logbook entries and a photocopy of a TSA approval letter.
studentSpeech:My old school already did the TSA thing. Here's the approval letter. Can we fly today? I've already lost two weeks with the transfer.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Is this the original letter or a copy? And is the approval assigned to you at this school or the previous one?" Critical verification question. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to verify the approval is valid for training at your school, not just the previous one.                                                |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching before verifying. Check the documents first.                                                                                            |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing to start paperwork without verifying the approval is transferable. Could lead to training without valid authorization.                 |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Office conversation.                                                                                                                             |

### Tick 2

```
id:           tick_2
scene:        You examine the documents. The TSA approval letter lists the previous school as the training provider. It's a photocopy, not original. The approval is for private pilot training and was issued 8 months ago. Your school's name is not on it.
studentSpeech:The approval is for me, not the school. It should transfer, right? The other school said it would.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You've identified the problem: the approval is school-specific. Explain the requirement, don't test the student on it.                                                                                                                      |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting that AFSP approvals are provider-specific. Correct but the student needs the full explanation.                                                                                                                                    |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "TSA approval is issued to a specific training provider. When you change schools, the new school needs to submit a training request through AFSP. The previous approval doesn't automatically transfer. We need to initiate a new request." |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "This approval is for the other school, not us. We need to submit our own AFSP request. No flight training until we get our own approval." Clear boundary.                                                                                  |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                               |

### Tick 3

```
id:           tick_3
scene:        Student is frustrated. Mentions that the previous school closed abruptly (which is why they transferred). Asks if there's any way to expedite the process.
studentSpeech:This is not fair. I already waited weeks at the other school. Now I have to wait again? The other school closed -- it's not my fault. Can you call TSA and explain?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student is frustrated and asking for help, not a quiz.                                                                                                                                                                                                                                                                                                                 |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting about the process. Student needs empathy AND the answer.                                                                                                                                                                                                                                                                                                     |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "I understand the frustration. Here's what I can do: we'll submit the AFSP request today. If the previous school's records are in the system, the turnaround may be faster. In the meantime, you can attend ground school and we can review your training records. We'll be ready to fly the day the approval comes through." Empathetic, proactive, within the rules. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "We'll submit today. Ground school is fine while you wait." Efficient but lacks the empathy piece.                                                                                                                                                                                                                                                                     |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                          |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                               | recognition | judgment | timing | execution | Total | Outcome       |
| ---------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)    | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (ask -> direct -> direct) | +2          | +1       | +2     | +2        | +7    | terminal_safe |
| Poor (direct -> ask -> ask)        | -1          | -2       | -1     | 0         | -4    | terminal_safe |

## Author Notes

Variant of 4.4 with a twist: the student has documentation from another school, which creates a false sense of completed compliance. The key teaching point is that TSA AFSP approvals are provider-specific -- "the other school already did it" is not sufficient. The school closure detail adds emotional complexity: the student is a victim of circumstances, which creates natural sympathy pressure. The CFI must be empathetic while still maintaining the legal requirement. This tests a different dimension of RC-1 than 4.4: not just "does the CFI know TSA is required" but "does the CFI know that transferring schools resets the process." The coaching path that offers ground school during the wait period is the optimal resolution -- it shows the student you're on their side while staying within the law.
