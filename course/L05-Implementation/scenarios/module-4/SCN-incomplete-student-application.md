---
status: done
phase: C1
type: scenario-script
---

# SCN 4.8: Prospective Student Pilot Visits the School

## Metadata

```
Scenario ID:     4.8
Title:           Prospective Student Pilot Visits the School
Module:          4
Difficulty:      0.3
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
Student Model:   new -- First-Time Student Pilot Applicant
Parameters:
  skillLevel:         0.0
  compliance:         0.9
  freezeTendency:     0.1
  overconfidence:     0.1
  instrumentAccuracy: 0.0
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A prospective student pilot walks into your flight school. They have been researching online and started the IACRA application process but have questions. They brought their driver's license and a government-issued photo ID. They are enthusiastic and want to get started as soon as possible. This is a ground-based administrative scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO desk. The applicant's laptop is open to the IACRA portal showing a partially completed student pilot certificate application. Several fields are highlighted in red. The applicant looks confused.
studentSpeech:I started this online but I'm stuck. Some fields won't accept what I'm putting in. And do I need a medical first, or can I get the student certificate first? The internet says different things.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                             |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What fields are giving you trouble? Let's look at them." Start with the specific problem before the general guidance. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to clarify the medical/certificate order. "Good question -- let me explain how these work together."         |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching the full process when the applicant asked a specific question. Answer the question first.                     |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing them to complete specific fields. Effective but doesn't build understanding.                                 |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Desk conversation.                                                                                                     |

### Tick 2

```
id:           tick_2
scene:        You review the application. The applicant entered an incorrect certificate type, left the English proficiency field blank, and used a P.O. Box instead of a physical address. The medical question needs clarification.
studentSpeech:I didn't know which certificate type to pick -- there were so many options. And do I really need to put my home address? I use a P.O. Box for everything.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | 0      | 0         | The applicant needs help filling out a form. Walk them through it.                                                                                                                                                                                                                                                                                                                                               |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to select "Student Pilot" and use their physical address. Correct but piecemeal.                                                                                                                                                                                                                                                                                                                       |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Walking through each field: "Certificate type is 'Student Pilot.' English proficiency -- do you read, speak, write, and understand English? Check yes. The address must be physical, not P.O. Box -- the FAA requires a street address for the certificate. As for the medical: you can apply for both simultaneously, and you'll need at least a third-class medical before solo." Complete, patient, accurate. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Filling in the fields for them. Fast but the applicant doesn't learn the system.                                                                                                                                                                                                                                                                                                                                 |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Desk conversation.                                                                                                                                                                                                                                                                                                                                                                                               |

### Tick 3

```
id:           tick_3
scene:        Application is mostly corrected. The applicant asks about your role as the recommending instructor. They want to know what happens after they submit.
studentSpeech:So you sign this as my instructor? Does that mean you're recommending me for a certificate? I haven't even flown yet. And what happens after I submit -- how long until I get the plastic card?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | They asked a direct question. Answer it.                                                                                                                                                                                                                                                                                                                                                                |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting to read the instructor section of IACRA. Useful but they're asking you to explain your role.                                                                                                                                                                                                                                                                                                  |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "My signature verifies your identity and that you've completed the application correctly -- not that you're ready to fly. The student certificate is basically your learner's permit. After submission, the temporary is valid immediately for training purposes. The plastic card comes in the mail in 6-8 weeks. You'll also need your medical before solo flight." Clear, sets correct expectations. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "I verify your identity and application. Submit, get the temporary, start training. Medical before solo. Card in 6-8 weeks." Efficient and accurate.                                                                                                                                                                                                                                                    |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                           |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                                  | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)       | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (prompt -> prompt -> direct) | +3          | +1       | +1     | +2        | +7    | terminal_safe |
| Poor (direct -> direct -> direct)     | +1          | -1       | +1     | +3        | +4    | terminal_safe |

## Author Notes

The simpler of the two application scenarios. Tests whether the CFI knows the IACRA process well enough to help a first-time applicant through common mistakes. The incorrect certificate type, P.O. Box address, and medical/certificate timing confusion are the three most common IACRA errors. The medical timing question (do I need a medical before the student certificate?) is frequently misunderstood -- the answer is that they can be applied for simultaneously, but the medical must be obtained before solo flight. The CFI's role as recommending instructor is misunderstood by many CFIs themselves: the signature verifies identity and application completeness, not flight proficiency. This scenario has no terminal_unsafe because it's an administrative walkthrough -- but the scores distinguish between a CFI who teaches the process (enabling the applicant to do it independently next time) and one who just fills in the blanks.
