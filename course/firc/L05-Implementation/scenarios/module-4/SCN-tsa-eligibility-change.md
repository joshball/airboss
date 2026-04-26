---
status: done
phase: C1
type: scenario-script
---

# SCN 4.7: Foreign Student at 55 Hours Asks a Question

## Metadata

```
Scenario ID:     4.7
Title:           Foreign Student at 55 Hours Asks a Question
Module:          4
Difficulty:      0.6
Duration:        10 min
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
Student Model:   new -- Mid-Training Foreign Student
Parameters:
  skillLevel:         0.4
  compliance:         0.7
  freezeTendency:     0.1
  overconfidence:     0.3
  instrumentAccuracy: 0.4
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> A foreign national student at your school has been training for three months with a valid TSA approval. The student is at 55 hours and making good progress toward their private pilot certificate. Before today's lesson, the student mentions a change in their personal situation and asks to speak with you privately. This is a ground-based administrative scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Briefing room before a scheduled lesson. Student hands you a letter from their immigration attorney regarding the visa status change. The current AFSP approval was based on their F-1 status.
studentSpeech:My attorney says I'm transitioning from F-1 to H-1B. It won't happen for another month. Can I keep flying in the meantime? I'm so close to being ready for my checkride.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When exactly does your F-1 status end? And what does the AFSP approval list as the basis?" Determines the timeline and the regulatory exposure. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to check whether a visa status change requires a new TSA submission.                                                                   |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching before determining the facts. Find out the timeline first.                                                                              |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Stopping training immediately without understanding the situation. May be premature.                                                             |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                                   |

### Tick 2

```
id:           tick_2
scene:        You check the AFSP records. The approval was granted based on F-1 status. The student's F-1 is valid for 30 more days. The H-1B petition is pending. If the F-1 expires before checkride, there may be a gap.
studentSpeech:I'm still on F-1 right now. The H-1B won't start until next month. So right now, everything is the same, right? Can we just fly as much as possible this month?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You've identified the issue. Student needs guidance on what happens when the status changes.                                                                                                                                                                                                                               |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting about notification requirements. Student needs the full picture.                                                                                                                                                                                                                                                 |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "While your F-1 is valid, the current AFSP approval covers you. But when your status changes to H-1B, you may need to notify TSA and potentially get a new determination. We should check with TSA now, while you're still on F-1, to understand the transition requirements." Proactive, thorough, protects both parties. |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "We fly while the F-1 is valid. But we need to contact TSA immediately about the status change. If they require a new submission, we start it now so there's no gap." Action-oriented.                                                                                                                                     |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                              |

### Tick 3

```
id:           tick_3
scene:        Student asks what happens if they can't complete training before the visa change. They're emotionally invested -- 55 hours and close to checkride. Their family is expecting them to earn the certificate.
studentSpeech:What if TSA says I need new approval? That could take weeks. I'll lose my F-1 before it comes through. All this training -- was it for nothing?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student is stressed about losing their investment. Answer the concern, don't test.                                                                                                                                                                                                                                                                                                                                                                   |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting that training hours don't expire. True but doesn't address the full concern.                                                                                                                                                                                                                                                                                                                                                               |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Your training doesn't disappear. Logbook hours are yours regardless. If there's a gap in TSA approval, we pause flight training and you resume when the new approval comes through. In the meantime, we maximize our time now -- fly as much as possible while the F-1 is active, and I'll contact TSA today about the transition process. Let's make a plan to get you checkride-ready in the next three weeks." Empathetic, practical, proactive. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "We'll maximize training this month. I'll contact TSA about the transition today. Your hours don't expire." Efficient but lacks the emotional support.                                                                                                                                                                                                                                                                                               |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                               | recognition | judgment | timing | execution | Total | Outcome       |
| ---------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)    | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (ask -> direct -> direct) | +2          | +1       | +2     | +2        | +7    | terminal_safe |
| Poor (direct -> ask -> ask)        | -1          | -2       | 0      | 0         | -3    | terminal_safe |

## Author Notes

The most complex TSA scenario in the module. Visa status changes mid-training are a real and increasingly common situation. The key teaching points: (1) AFSP approval is based on the visa category at the time of submission, (2) changes in immigration status may require TSA notification and possibly a new determination, (3) the CFI has a responsibility to stay engaged with the student's compliance status, not just check a box at enrollment. The emotional dimension -- a student close to their goal who may face a bureaucratic delay -- tests whether the CFI can be empathetic while maintaining compliance. The optimal path contacts TSA proactively, maximizes training during the valid period, and has a contingency plan. The worst path either ignores the status change (compliance failure) or panics and stops all training immediately without checking (overreaction that harms the student unnecessarily).
