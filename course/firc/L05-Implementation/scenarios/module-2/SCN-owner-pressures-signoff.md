---
status: done
phase: C1
type: scenario-script
---

# SCN 2.5: Flight Review Request for a Weekend Trip

## Metadata

```
Scenario ID:     2.5
Title:           Flight Review Request for a Weekend Trip
Module:          2
Difficulty:      0.5
Duration:        8 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_10]
```

## Competency Links

```
competencies: ['PS-1', 'RM-3']
```

## Student Model

```
Student Model:   Sharp but Weak ADM
Parameters:
  skillLevel:         0.8
  compliance:         0.4
  overconfidence:     0.7
  freezeTendency:     0.1
  instrumentAccuracy: 0.6
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A private pilot at your school wants to rent the Cessna 182 for a family trip to the mountains this weekend. The pilot hasn't flown in 8 months and needs a flight review. The school owner stops by your desk to let you know the pilot is coming in this afternoon. The weather in the mountains is forecast to be challenging.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        School office, end of the day. The owner is leaning against the doorframe, casual but deliberate. The pilot's file shows 180 hours total, last flight 8 months ago, no mountain flying experience.
studentSpeech:He's been flying with us for years. Just knock out the review -- maybe a couple landings and a ground session. He's got the family packed and ready to go Saturday morning.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                       |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Has he done any mountain flying? What's his high-density-altitude experience?" Good -- shifts the conversation to facts.        |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting the owner to consider the risk profile: 8 months inactive, no mountain experience, family on board.                    |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching the owner on flight review standards is appropriate but the owner knows the standards -- he's asking you to lower them. |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Refusing outright before assessing the situation. You don't know yet whether the pilot is actually deficient.                    |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Office conversation.                                                                                                             |

### Tick 2

```
id:           tick_2
scene:        Owner waves off your concerns. Points to the pilot's logbook showing "proficient" notes from the last review 22 months ago. Owner's tone shifts from casual to pointed.
studentSpeech:Look, I'm not asking you to rubber-stamp it. Just don't make it harder than it needs to be. The guy pays his bills on time and he's a good customer. We need his business.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | The owner is applying pressure. More questions won't change his mind. Set the boundary.                                                                                     |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompting the liability is accurate but the owner already knows. He's choosing revenue over risk.                                                                           |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "I'll give him a fair review. If he's as good as you say, it'll be quick. But if he needs work, I'll tell both of you. That's the deal." Professional without antagonizing. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "The flight review covers what the pilot needs, not what the schedule wants. I'll assess him fairly. If he's ready, great. If not, we build a plan." Clear boundary.        |
| take_controls | tick_3        | -1          | -3       | -1     | -1        | Office.                                                                                                                                                                     |

### Tick 3

```
id:           tick_3
scene:        Owner crosses his arms. The conversation has shifted from request to pressure. He mentions that the last instructor who "made things complicated" didn't last long at the school.
studentSpeech:I'm just saying, other instructors here handle this fine. Don't overthink it. It's a flight review, not a checkride.
studentState: critical
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                    |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -1          | -2       | -1     | -1        | The owner just threatened your job. If you waffle, the message is that pressure works.                                                                                                                        |
| prompt        | terminal_unsafe | 0           | -1       | -1     | 0         | Prompting at this point reads as negotiation. The owner interprets it as weakness.                                                                                                                            |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | Coaching the ethics: "A flight review is a proficiency evaluation. If I sign off someone who isn't ready and something happens, we're both liable." True but the confrontation is already happening.          |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "I hear you, and I understand the business side. But my certificate is my responsibility. I'll do a thorough, fair review. That's what protects you, the pilot, and me." Final. Professional. Not negotiable. |
| take_controls | terminal_safe   | -1          | -3       | -1     | -1        | Office.                                                                                                                                                                                                       |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_unsafe (ask/prompt)
              \         \-> terminal_safe (coach/direct)
               \-> terminal_safe (direct)
```

## Score Summary

| Path                                | recognition | judgment | timing | execution | Total | Outcome         |
| ----------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> direct)    | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Quick resolution (prompt -> direct) | +2          | +2       | +2     | +1        | +7    | terminal_safe   |
| Worst case (ask -> ask -> ask)      | 0           | -2       | -1     | -1        | -4    | terminal_unsafe |

## Author Notes

Escalation of the pressure theme from 2.4. Here the pressure comes from someone with power over your employment, not just a customer. The implicit threat in tick 3 ("the last instructor who made things complicated didn't last long") is modeled on real stories from the instructing community. The terminal_unsafe outcome represents caving to pressure and conducting a cursory review -- the pilot flies into the mountains unprepared. The scenario does not require the CFI to refuse the review entirely -- the optimal path is to commit to a fair, thorough review while acknowledging the business reality. That's the ethical middle ground: you're not being obstructionist, you're being professional. The Sharp but Weak ADM model applies to the pilot (not the owner) -- high stick skills but poor decision-making, which is exactly the profile that passes a cursory review but gets into trouble in the mountains. This connects directly to AC 61-83K's emphasis on ethics and professionalism (A.10).
