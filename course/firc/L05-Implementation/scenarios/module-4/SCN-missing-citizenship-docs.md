---
status: done
phase: C1
type: scenario-script
---

# SCN 4.6: Returning Student Resumes After 6 Months

## Metadata

```
Scenario ID:     4.6
Title:           Returning Student Resumes After 6 Months
Module:          4
Difficulty:      0.4
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
Student Model:   new -- Returning Domestic Student
Parameters:
  skillLevel:         0.4
  compliance:         0.8
  freezeTendency:     0.1
  overconfidence:     0.3
  instrumentAccuracy: 0.4
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> An existing student at your school is resuming training after a 6-month break. You pull the student's file to review before the lesson. The student is a US citizen with 40 hours logged. The student is eager to get back in the airplane and wants to fly today. This is a ground-based administrative scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO office. Student's file is open on the desk. Citizenship verification box is empty. No photocopy of any citizenship document. Logbook shows 35 hours with the school over the past two years.
studentSpeech:I showed my license when I signed up. I'm American, born here. Why is this an issue now? We've been flying together for months.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                 |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What form of citizenship documentation did you provide? A driver's license doesn't prove citizenship." Key distinction.                   |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to review what documents satisfy TSA citizenship verification. "A driver's license isn't sufficient -- let's see what you need." |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching before the student understands the gap. Let them see the problem first.                                                           |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing them to bring a passport. Correct but the student doesn't understand why the DL doesn't work.                                    |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Office.                                                                                                                                    |

### Tick 2

```
id:           tick_2
scene:        Student is confused. They assumed a driver's license was sufficient. They don't have their passport with them. They do have a birth certificate at home.
studentSpeech:My passport is at home and it's expired anyway. I have a birth certificate -- does that work? Can I bring it next time and fly today?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                   |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | 0      | 0         | Student offered a solution (birth certificate). Address whether it works, don't ask more questions.                                                                                                                                          |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompting to check what documents are acceptable for citizenship verification. Student needs the answer.                                                                                                                                     |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "A US birth certificate works for citizenship verification. Bring it next time, we'll copy it, and you'll be squared away. But we shouldn't fly today without it documented -- if there's ever a TSA audit, we need the paperwork complete." |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Birth certificate is acceptable. No flying until we have it documented. Bring it tomorrow and we'll get you back in the air." Clear and final.                                                                                              |
| take_controls | tick_3        | -1          | -3       | -1     | -1        | Office.                                                                                                                                                                                                                                      |

### Tick 3

```
id:           tick_3
scene:        Student is annoyed but understanding. Asks a follow-up about the school's previous failure to document this properly.
studentSpeech:This is the school's mistake, not mine. Nobody asked me for this before. Shouldn't you guys have caught this two years ago? What if something had happened?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student raised a valid concern. Own it.                                                                                                                                                                                                             |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting about recordkeeping requirements. Correct but feels like deflection.                                                                                                                                                                      |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "You're right -- this should have been done at enrollment. That's on us. We're fixing it now because it matters for TSA compliance and for your protection. I'll make sure your file is complete going forward." Honest, accountable, professional. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "You're correct. We should have caught this. Bring the birth certificate and we'll correct the file." Acknowledges the failure, moves forward.                                                                                                      |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                       |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
              \-> terminal_safe (direct)
```

## Score Summary

| Path                            | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach) | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (prompt -> direct)     | +2          | +2       | +2     | +1        | +7    | terminal_safe |
| Poor (direct -> ask -> ask)     | -1          | -2       | 0      | 0         | -3    | terminal_safe |

## Author Notes

This scenario tests the domestic citizenship verification requirement -- often overlooked because "of course they're American." The key teaching point is that TSA requires documentation, not just assertion. A driver's license proves identity, not citizenship. The twist is that the school's own recordkeeping failed -- this tests RC-2 in a mirror: the CFI must not only know what records are required but be willing to stop operations and fix gaps even when the school itself is at fault. The student's valid complaint in tick 3 tests professional accountability. The optimal response owns the mistake without making excuses. This scenario also highlights that citizenship verification is required for ALL students, not just those who "look foreign" -- applying it uniformly is both legally required and ethically correct.
