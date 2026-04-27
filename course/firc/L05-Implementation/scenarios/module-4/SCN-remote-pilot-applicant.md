---
status: done
phase: C1
type: scenario-script
---

# SCN 4.9: Private Pilot Asks About Adding Part 107

## Metadata

```
Scenario ID:     4.9
Title:           Private Pilot Asks About Adding Part 107
Module:          4
Difficulty:      0.4
Duration:        8 min
Pattern:         Multi-Beat Admin
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_13]
```

## Competency Links

```
competencies: ['RC-3']
```

## Student Model

```
Student Model:   new -- Remote Pilot Applicant
Parameters:
  skillLevel:         0.0
  compliance:         0.7
  freezeTendency:     0.1
  overconfidence:     0.5
  instrumentAccuracy: 0.0
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A private pilot who works as a real estate photographer comes to you. They hold a current private pilot certificate and want to add Part 107 remote pilot privileges for a commercial drone job starting next week. They have been researching the process online. This is a ground-based administrative scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO office. The applicant shows you their private pilot certificate (current, with valid medical) and asks you to sign them off for the remote pilot certificate.
studentSpeech:I read that if I have a pilot certificate, I can skip the Part 107 test. I just need an instructor to sign off a training course, right? Can you do that today? I have a big job next Tuesday.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Have you completed an FAA-approved initial training course? Which one?" Tests whether they understand the actual pathway.                  |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to clarify the Part 107 pathway for existing certificate holders. "There are specific steps -- let's make sure you've done them." |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on the process before determining what they've actually done. Assess first.                                                        |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Refusing outright before understanding what they've completed. They may have done the online course.                                        |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Office.                                                                                                                                     |

### Tick 2

```
id:           tick_2
scene:        The applicant has not completed the FAA Part 107 initial training course (Part 107.74). They assumed that having a pilot certificate was sufficient and that an instructor sign-off was all that was needed.
studentSpeech:I didn't take a course. I thought the instructor just reviews my knowledge and signs me off. That's how flight reviews work, right? Same concept?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | 0      | 0         | You've identified the gap. They need the correct process, not more questioning.                                                                                                                                                                                                                                                                                                  |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting that the Part 107 pathway requires a specific training course. Correct but incomplete.                                                                                                                                                                                                                                                                                 |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "It's not quite like a flight review. For Part 107, existing Part 61 pilots can use an online FAA training course instead of the knowledge test. But the course must be completed first, then I can review the completion certificate and process the IACRA application. The course is free and available on the FAASafety.gov website." Complete pathway, actionable, accurate. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "You need to complete the online training course first. It's on FAASafety.gov. After that, come back and I'll process the application." Correct but abrupt.                                                                                                                                                                                                                      |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Office.                                                                                                                                                                                                                                                                                                                                                                          |

### Tick 3

```
id:           tick_3
scene:        Applicant is frustrated about the delay but understands. They ask about what happens after they complete the online course. They want to know the exact steps so they can have the certificate by Tuesday.
studentSpeech:OK, so I do the online course. Then what? How quickly can we get the certificate processed? I really need this by next week. Is there anything I can do to speed it up?
studentState: nominal
safeWindow:   [coach, direct]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | Applicant wants the timeline. Give it to them.                                                                                                                                                                                                                                                                                                                                                              |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting about the IACRA process. They need specifics.                                                                                                                                                                                                                                                                                                                                                     |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Complete the online course -- plan 3-4 hours. Bring me the completion certificate. I'll verify it, you complete the IACRA application, I sign as the recommending instructor. The temporary certificate is valid immediately once IACRA is processed. If you do the course this weekend, we can process IACRA Monday, and you'll have a temporary for Tuesday." Specific timeline, actionable, achievable. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Course this weekend, IACRA Monday, temporary Monday. You'll make Tuesday." Efficient, accurate.                                                                                                                                                                                                                                                                                                            |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                               |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                                  | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)       | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (prompt -> direct -> direct) | +2          | 0        | +1     | +2        | +5    | terminal_safe |
| Poor (direct -> ask -> ask)           | -1          | -2       | 0      | 0         | -3    | terminal_safe |

## Author Notes

Part 107 remote pilot certification is increasingly common, and the pathway for existing Part 61 certificate holders is frequently misunderstood. The common misconception (an instructor just signs them off) confuses the Part 107 process with a flight review or an instrument proficiency check. The actual pathway requires completion of an FAA-approved online training course (Part 107.74) before the instructor processes the IACRA application. The instructor's role is to verify the training completion and process the application, not to independently evaluate remote pilot knowledge. This scenario also tests the CFI's ability to handle a time-pressured applicant -- similar to the pressure scenarios in Module 2, but the pressure is commercial (job deadline) rather than social. The optimal path gives the applicant a workable timeline that meets their deadline while following the correct process. No shortcuts, but no unnecessary delays either.
