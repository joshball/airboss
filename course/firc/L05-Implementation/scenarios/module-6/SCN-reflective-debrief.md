---
status: done
phase: C1
type: scenario-script
---

# SCN 6.4: End-of-Course Reflective Debrief

## Metadata

```
Scenario ID:     6.4
Title:           End-of-Course Reflective Debrief
Module:          6
Difficulty:      0.5
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_4, FAA_TOPIC.A_5, FAA_TOPIC.A_9, FAA_TOPIC.A_10, FAA_TOPIC.A_7]
```

## Competency Links

```
competencies: ['CJ-3', 'PS-2']
```

## Student Model

```
Student Model:   new -- FIRC Learner (self-reflective)
Parameters:
  skillLevel:         0.7
  compliance:         0.8
  freezeTendency:     0.1
  overconfidence:     0.3
  instrumentAccuracy: 0.6
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> You have completed all five preceding modules of this FIRC. This final scenario is different: instead of managing a student, you are reflecting on your own instructional practice. A series of vignettes will ask you to apply the concepts from the course to your own teaching history and future plans. There are no wrong answers that endanger anyone -- but the depth and honesty of your reflection determines the quality of your learning.

## Tick Script

### Tick 1 -- Recognizing Your Own Gaps

```
id:           tick_1
scene:        Quiet debrief room. The prompt on screen reads: "Think of a time in the past year when you could have intervened earlier with a student, but didn't. What held you back?"
studentSpeech:(Internal reflection) There was that time with the student who kept overshooting final... I saw the bank angle increasing but I waited because I wanted to see if they'd recover. They didn't. I had to take over at the last minute.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                              |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What would you do differently if that situation happened tomorrow?" Connects past experience to future behavior.       |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to identify the specific tick (intervention point) where you should have acted. Applies the course framework. |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Coaching on the intervention ladder. Useful but the learner is reflecting -- guide, don't lecture.                      |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing the reflection. The value is in the learner's own processing, not directed recall.                            |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Reflective exercise.                                                                                                    |

### Tick 2 -- Connecting to Safety Culture

```
id:           tick_2
scene:        The next prompt: "When was the last time you had to refuse a flight, refuse a signoff, or tell a student something they didn't want to hear? How did you handle it?"
studentSpeech:(Internal reflection) I had a student's parent push me to solo the student too early. I said no, but I didn't explain why well. The parent was angry and the student was embarrassed. I could have handled the communication better.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | 0        | -1     | 0         | The learner has identified the gap (communication, not the decision). Don't test -- help them plan the improvement.                                                                                                                                                                      |
| prompt        | tick_3     | +1          | +1       | 0      | 0         | Prompting to script the conversation they wish they'd had. Practice makes the skill available under pressure.                                                                                                                                                                            |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Making the right decision is step one. Communicating it so the student and family understand and support it is step two. Safety culture isn't just saying no -- it's saying no in a way that builds trust. What would you say to that parent today?" Elevates from decision to culture. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to practice the conversation. Useful but the reflection moment is where the learning happens.                                                                                                                                                                                  |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Reflection.                                                                                                                                                                                                                                                                              |

### Tick 3 -- Building Your Proficiency Plan

```
id:           tick_3
scene:        The prompt reads: "Based on what you've experienced in this course, what are two specific areas of your instructional practice you want to improve? And what will you do about them in the next 90 days?"
studentSpeech:(Internal reflection) I think I need to get better at recognizing student fatigue early. And I want to learn the TAA approach structure better -- I've been avoiding airports with TAA-only approaches because I'm not confident teaching them.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "What's your plan for each?" Good -- moves from awareness to action.                                                                                                                                                                                                                                                                                                     |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | Prompting to set specific, measurable goals for each area. "How will you know when you've improved?"                                                                                                                                                                                                                                                                     |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Two good choices. For fatigue recognition: start every flight with the IMSAFE question and document what you observe. After 10 flights, you'll have a pattern. For TAA: fly three TAA approaches in the next month with a safety pilot or in a simulator. Use the WINGS program to get credit and keep yourself accountable." Specific, time-bound, connected to WINGS. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "Write those down. Set a 90-day calendar reminder. Use WINGS for structure." Action-oriented.                                                                                                                                                                                                                                                                            |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Reflection.                                                                                                                                                                                                                                                                                                                                                              |

### Tick 4 -- Commitment

```
id:           tick_4
scene:        Final prompt: "What is one thing you will do differently the next time you fly with a student, based on what you learned in this course?"
studentSpeech:(Internal reflection) I'm going to ask diagnostic questions before coaching. I always jumped straight to coaching because it felt efficient. But the scenarios showed me that asking first reveals what the student actually needs, not what I assume they need.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Any supportive response works. The learner has synthesized the course into a concrete takeaway.                                                                                                                                                                                                                                       |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to think about how they'll remember this commitment. "What will remind you to ask first?"                                                                                                                                                                                                                                   |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "That's a powerful insight. The ask-before-coach principle applies everywhere: in the cockpit, in the debrief, and in conversations with students' families. Write it on a card and put it in your flight bag. When it becomes automatic, you'll know the course worked." Reinforces, anchors, provides a physical reminder strategy. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Write it down. Keep it visible. You've got a good plan." Affirming and practical.                                                                                                                                                                                                                                                    |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Reflection.                                                                                                                                                                                                                                                                                                                           |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +3       | +1     | 0         | +8    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -1       | +1     | +3        | +4    | terminal_safe |

## Author Notes

This is deliberately different from every other scenario in the course. There is no student to manage, no airplane to fly, no emergency to handle. The "student" is the FIRC participant themselves, reflecting on their own practice. The scenario tests CJ-3 (debrief causes, not outcomes) applied inward -- can the CFI analyze their own teaching the way they analyze a student's flying? And PS-2 (build safety culture) at the meta-level -- can the CFI make commitments to professional development that extend beyond the course? The WINGS program connection in tick 3 makes the proficiency plan concrete -- it's not just "try harder" but "use this system to structure your improvement." Every path reaches terminal_safe because reflection has no physical risk. The scores reflect the depth and actionability of the reflection. This scenario should feel like the most important one in the course -- not because it's dramatic, but because it's the one that changes behavior after the last module ends.
