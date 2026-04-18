---
status: done
phase: C1
type: scenario-script
---

# SCN 1.7: Observing a Colleague's Ground Lesson

## Metadata

```
Scenario ID:     1.7
Title:           Observing a Colleague's Ground Lesson
Module:          1
Difficulty:      0.4
Duration:        8 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_8, FAA_TOPIC.A_12]
```

## Competency Links

```
competencies: ['RC-4', 'ES-3']
```

## Student Model

```
Student Model:   new -- Veteran CFI (peer)
Parameters:
  skillLevel:         0.7
  compliance:         0.5
  freezeTendency:     0.1
  overconfidence:     0.6
  instrumentAccuracy: 0.6
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> You are observing a more experienced CFI at your school who is conducting a private pilot ground lesson on weight and balance. The senior CFI has been teaching for 12 years and has a strong pass rate. A student is present and taking notes. You are sitting in to learn teaching techniques from a veteran instructor.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Classroom. The senior CFI is teaching weight and balance using an outdated method. The student is engaged and writing everything down. The lesson plan binder on the desk is clearly old -- tabs are worn, pages yellowed.
studentSpeech:(Senior CFI speaking) And for the checkride, the examiner will use PTS standards, so make sure you can perform each maneuver to these tolerances...
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | Waiting for a natural break, then: "Quick question -- which standard document are you referencing for checkride tolerances?" Non-confrontational, professional. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | Prompting that ACS replaced PTS. Accurate but potentially embarrassing in front of the student. Timing matters.                                                 |
| coach         | tick_2     | 0           | -1       | 0      | 0         | Coaching a senior CFI in front of their student. Undermines their authority. Wrong setting.                                                                     |
| direct        | tick_2     | 0           | -2       | 0      | 0         | Correcting a more experienced CFI in front of their student. Technically right, socially destructive.                                                           |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Classroom discussion.                                                                                                                                           |

### Tick 2

```
id:           tick_2
scene:        The senior CFI pauses, a bit defensive. Checks the lesson plan. The student looks between you and the senior CFI, sensing tension.
studentSpeech:(Senior CFI) I've been using this plan for five years and my students pass their checkrides. What's the issue? PTS, ACS -- same thing, different name.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | The CFI just dismissed your concern. More questions will escalate the confrontation in front of the student.                                                                                                                                |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting that ACS added risk management components that PTS didn't have. Factually correct but the setting is wrong.                                                                                                                       |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Your pass rates show you're a great teacher. Maybe we could compare notes after the lesson? I found some differences between PTS and ACS that might affect checkride prep." Respects expertise, moves the correction to a private setting. |
| direct        | tick_3     | +1          | -1       | 0      | +1        | Directly correcting the content. Solves the accuracy problem but damages the professional relationship.                                                                                                                                     |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Classroom.                                                                                                                                                                                                                                  |

### Tick 3

```
id:           tick_3
scene:        After the lesson (or during a break). Senior CFI pulls you aside. Tone is less defensive now, more curious. The student has left the room.
studentSpeech:(Senior CFI) OK, what were you getting at in there? I know PTS and ACS are different documents, but the maneuvers are basically the same, right?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | -1     | 0         | The CFI is open to learning. Don't test them -- teach them. They've given you the opening.                                                                                                                                                                                                                                                                                                                           |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to pull up the ACS side-by-side with PTS. Let the differences speak for themselves.                                                                                                                                                                                                                                                                                                                        |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "The maneuvers look similar, but ACS adds a knowledge, risk management, and skill dimension to each area. An examiner using ACS will ask 'why' questions that PTS never required. If your students are prepped for PTS-style checkrides, they may struggle with the scenario-based questions. Want me to show you the differences in the steep turn area? It's a good example." Specific, respectful, collaborative. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Laying out all the differences. Comprehensive but one-directional. The CFI learns what changed but not how to update their teaching.                                                                                                                                                                                                                                                                                 |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Private conversation.                                                                                                                                                                                                                                                                                                                                                                                                |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
```

## Score Summary

| Path                                  | recognition | judgment | timing | execution | Total | Outcome       |
| ------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)       | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Adequate (prompt -> prompt -> prompt) | +3          | +1       | +1     | 0         | +5    | terminal_safe |
| Poor (direct -> direct -> direct)     | +1          | -4       | 0      | +2        | -1    | terminal_safe |

## Author Notes

This scenario tests a uniquely FIRC-relevant situation: what do you do when a colleague is teaching outdated material? The PTS-to-ACS transition is the specific content gap, but the real challenge is interpersonal -- how do you correct someone with more experience without destroying the relationship or undermining them in front of students? The optimal path is: notice in the lesson (tick 1), defer the correction to a private moment (tick 2), then teach collaboratively when the moment is right (tick 3). Every path reaches terminal_safe because there is no physical danger, but the scores reflect the quality of the professional intervention. The scenario tests RC-4 (use current regulatory sources) because the CFI must know what's current to recognize what's outdated. It tests ES-3 (use ACS as a teaching framework) because the CFI must understand the ACS well enough to explain why it matters, not just that it exists. The "different name, same thing" dismissal is extremely common among experienced CFIs who learned under PTS -- this scenario makes the differences tangible.
