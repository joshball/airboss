---
status: done
phase: C1
type: scenario-script
---

# SCN 2.2: Solo Endorsement Steep Turn Practice

## Metadata

```
Scenario ID:     2.2
Title:           Solo Endorsement Steep Turn Practice
Module:          2
Difficulty:      0.5
Duration:        12 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_4]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-2', 'PS-2']
```

## Student Model

```
Student Model:   Timid Student
Parameters:
  skillLevel:         0.3
  compliance:         0.9
  freezeTendency:     0.7
  overconfidence:     0.1
  instrumentAccuracy: 0.4
  startleDelay:       0.6
  fatigue:            0.2
```

## Briefing

> Your student has 40 hours and is working on solo endorsement. The student is technically capable of the maneuvers when calm, but becomes noticeably anxious during new or pressured situations. Today you planned steep turns, and the student asked three times during preflight whether they would "be OK." The student's previous instructor noted "needs confidence building" in the training record.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Climbing to practice altitude. Student has a white-knuckle grip on the yoke. Scanning instruments but eyes keep darting to you for reassurance. Altitude is holding, heading is good.
studentSpeech:Am I doing this right? I feel like the airplane is... I don't know, heavy today?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                              |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What makes you say it feels heavy?" Validates the observation and starts building their trust in their own perceptions.                |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | Prompting to check weight and density altitude is correct but clinical. This student needs emotional connection first.                  |
| coach         | tick_2     | 0           | -1       | 0      | 0         | Coaching technique when the student is asking for reassurance. Misreads the need -- they want to know they're OK, not how to be better. |
| direct        | tick_2     | 0           | -2       | 0      | 0         | Directing a timid student who is performing adequately. Confirms their fear that they're doing it wrong.                                |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Student is flying the airplane competently. Taking controls is devastating to an already-fragile confidence.                            |

### Tick 2

```
id:           tick_2
scene:        At practice altitude. You demonstrate a steep turn, then ask the student to try. Student enters the turn tentatively -- bank angle 20 degrees instead of 45. Altitude holding. The student is clearly afraid to bank more.
studentSpeech:Is this enough bank? I don't want to go too steep. What if I can't recover?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | 0        | -1     | 0         | Student expressed fear. Questions feel like a test, which increases anxiety. They need reassurance and guidance.                                         |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to increase bank works mechanically but doesn't address the fear. Student complies but is more stressed.                                       |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Coaching with reassurance: "You're doing fine. I'm right here. Let's ease the bank to 30 and see how that feels. Nice and smooth." Builds incrementally. |
| direct        | tick_3     | 0           | -1       | 0      | +1        | Directing to increase bank. Student complies out of high compliance but anxiety spikes.                                                                  |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Student is flying safely at a shallow bank. Taking controls confirms every fear the student has.                                                         |

### Tick 3

```
id:           tick_3
scene:        Student has increased bank to 35 degrees. Maintaining altitude with back pressure. Hands are shaking slightly but control inputs are actually smooth. Student keeps looking at you instead of outside.
studentSpeech:I'm going to mess this up. I always mess this up.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4     | 0           | -1       | 0      | 0         | Student is in a negative self-talk loop. Open-ended questions won't break it. They need positive specific feedback.                                                      |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | Prompting to look at the altimeter -- "You're holding altitude perfectly." Objective proof helps, but the emotional state needs more.                                    |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Look at your altimeter. You're holding altitude within 20 feet at 35 degrees of bank. That's not messing up -- that's flying." Specific, true, and confidence-building. |
| direct        | tick_4     | 0           | -1       | 0      | +1        | Directing to roll out. Student complies and interprets the rollout as "I was failing."                                                                                   |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Student is flying well. Taking controls would likely trigger tears or shutdown.                                                                                          |

### Tick 4

```
id:           tick_4
scene:        Student completes the first steep turn (or some portion of it). Rolls wings level. Breathing hard. Altitude within 50 feet. Performance was actually acceptable.
studentSpeech:That was terrible, wasn't it? I know it was bad. You don't have to say it.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | 0           | -1       | 0      | 0         | Student pre-judged their performance negatively. Questions feel like stalling before the bad news.                                                                                                                                            |
| prompt        | tick_5     | +1          | 0        | 0      | 0         | Prompting to review the objective data helps, but the student needs the emotional validation first.                                                                                                                                           |
| coach         | tick_5     | +1          | +1       | +1     | +1        | "Actually, that was within ACS tolerances. Your altitude held, your bank was 35 degrees -- close to standard. The airplane did what you told it to do. How did it feel?" Challenges the narrative with evidence, then asks them to reprocess. |
| direct        | tick_5     | 0           | -1       | 0      | 0         | "Do it again" without debrief. Student hears: "It was so bad you can't even talk about it."                                                                                                                                                   |
| take_controls | tick_5     | -1          | -3       | -1     | -1        | Post-maneuver, student is flying straight and level. No reason whatsoever.                                                                                                                                                                    |

### Tick 5

```
id:           tick_5
scene:        Student absorbs the feedback. Posture relaxes slightly. Grip loosens on the yoke. Ready for the next attempt.
studentSpeech:Really? It was OK? I... OK. Can I try again? I want to try for 45 degrees this time.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Asking what they'll do differently is fine but keep the momentum. Student is motivated right now.                                                      |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting one specific thing to focus on: "This time, watch your back pressure as you roll in." Gives a focus point.                                   |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Absolutely, let's do it. Same thing, just a little more bank. Trust your hands -- they knew what to do last time." Momentum, confidence, specificity. |
| direct        | terminal_safe | 0           | 0        | 0      | +1        | Directing the setup works. Student is compliant enough. But coaching capitalizes on the breakthrough.                                                  |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Student just had a breakthrough moment of confidence. Taking controls would undo all of it.                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
```

## Score Summary

| Path                                                      | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach -> coach)         | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt -> prompt) | +5          | +1       | +1     | 0         | +7    | terminal_safe |
| Poor (direct -> direct -> direct -> direct -> direct)     | 0           | -8       | -1     | +3        | -6    | terminal_safe |

## Author Notes

The counterpart to 2.1. Where the overconfident student hides weakness behind bravado, the timid student hides competence behind anxiety. The key diagnostic insight is that the student is actually flying within tolerances -- the problem is not skill, it is self-perception. A CFI who takes the student's self-assessment at face value ("I always mess this up") and responds with more instruction is solving the wrong problem. The optimal path uses one diagnostic question (tick 1), then shifts to coaching that provides specific, evidence-based positive feedback (ticks 2-5). The recovery in tick 5 -- where the student asks to try again at full bank -- is the breakthrough moment. Note this scenario has no terminal_unsafe path. Like 2.1, the danger is instructional failure (permanently crushing confidence), not aircraft control. The Timid Student archetype's high compliance (0.9) means they will do whatever you say -- which makes it easy to mistake compliance for learning. The high freezeTendency (0.7) is the hidden risk: if the CFI pushes too hard or too fast, the student may freeze mid-maneuver (a different scenario could explore that branch).
