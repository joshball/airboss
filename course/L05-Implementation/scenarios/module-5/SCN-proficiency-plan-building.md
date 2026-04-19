---
status: done
phase: C1
type: scenario-script
---

# SCN 5.6: Post-Checkride Proficiency Plan Building

## Metadata

```
Scenario ID:     5.6
Title:           Post-Checkride Proficiency Plan Building
Module:          5
Difficulty:      0.4
Duration:        12 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_7, FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['ES-1', 'PS-2']
```

## Student Model

```
Student Model:   new -- Newly Certificated Pilot
Parameters:
  skillLevel:         0.5
  compliance:         0.8
  freezeTendency:     0.2
  overconfidence:     0.3
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> Your student just passed their private pilot checkride. They're excited and ask you: "Now what? How do I stay safe and keep getting better?" The student is a thoughtful person who wants to continue developing as a pilot but doesn't know what a proficiency plan looks like. They've heard of WINGS but don't understand how it works. This is a ground-only scenario -- a debrief and planning conversation.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Post-checkride debrief at the FBO. Student has their temporary certificate in hand. Grinning but also asking genuine questions about what comes next.
studentSpeech:I passed, but the examiner said my soft-field landings need work and my emergency procedures were "adequate." What does that mean? And how do I keep improving without an instructor watching me all the time?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What did the examiner say specifically about the soft-fields and the emergency procedures?" Gets the detailed feedback before building the plan. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to think about what areas they want to focus on first. Builds ownership of the proficiency plan.                                        |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on proficiency planning before hearing the examiner's specific feedback. Get the data first.                                             |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing a specific plan without knowing what the examiner identified. Premature.                                                                |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground conversation.                                                                                                                              |

### Tick 2

```
id:           tick_2
scene:        Student relays the examiner's feedback: soft-field landings were safe but the technique was inconsistent, and the emergency procedure response was slow -- the student eventually did the right thing but took too long to begin the checklist.
studentSpeech:She said my landings were "certificated" but not "polished." And for the emergency, she said I froze for about 5 seconds before starting the checklist. I got through it, but she could tell I was thinking hard. How do I fix that?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | 0        | -1     | 0         | Student wants a plan, not more assessment. They already know the weaknesses.                                                                                                                                                                                                                                                                                                                                                                                          |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to prioritize which weakness to address first. Good but the student needs a framework.                                                                                                                                                                                                                                                                                                                                                                      |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Both of those are normal for a new private pilot. The soft-field technique gets better with repetition -- plan 5 solo trips focused on soft-field practice within your first 50 hours. The emergency hesitation is about habit, not knowledge. Chair-fly the emergency procedures at home until the first three steps are automatic. And here's the bigger picture: your checkride was the beginning, not the end. Let me show you how to build a proficiency plan." |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing specific practice. Useful but doesn't frame the bigger proficiency picture.                                                                                                                                                                                                                                                                                                                                                                                 |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Tick 3

```
id:           tick_3
scene:        Student is engaged and taking notes. Asks about WINGS and how to structure ongoing learning without an instructor.
studentSpeech:Someone mentioned WINGS. Is that worth doing? And should I be flying with an instructor sometimes, or should I just practice solo? I don't want to develop bad habits.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "What are your flying goals for the next year?" Good -- builds the proficiency plan around their goals.                                                                                                                                                                                                                                                                                                                                                                                           |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | Prompting to look up the WINGS program online and explore the structure.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "WINGS is excellent and it's free. Three levels -- Basic, Advanced, Master. You complete activities in three categories: Knowledge, Flight, and a combination. It gives structure to your practice and it satisfies the flight review requirement when you complete a phase. For the instructor question: fly with someone every 3-4 months for a proficiency session. Not a flight review -- just a tune-up. Bad habits form fast when nobody's watching." Comprehensive, practical, actionable. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "Sign up for WINGS. Fly with an instructor quarterly." Efficient.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Tick 4

```
id:           tick_4
scene:        Student is writing down the plan. Asks about setting personal minimums and building toward an instrument rating.
studentSpeech:One more thing. I want to eventually get my instrument rating. Should I start that now? And what about personal minimums -- the examiner mentioned those too.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | "What kind of flying do you want to do?" Good for goal-setting.                                                                                                                                                                                                                                                                                                                                                                                              |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to set personal minimums now, before the first solo cross-country. Timing is right.                                                                                                                                                                                                                                                                                                                                                                |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Set personal minimums today -- write them down. Start conservative: 3,000-foot ceiling, 5-mile visibility, winds under 15 knots. Adjust as you gain experience. For the instrument rating: build 50 hours of solid VFR PIC time first. Get comfortable with the airplane, the airspace, and your decision-making. Then start instrument training on a foundation, not from scratch." Staged approach, specific numbers, connected to their development arc. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Write personal minimums this week. Build 50 hours PIC before starting instrument. I'll help you plan both." Action items.                                                                                                                                                                                                                                                                                                                                   |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +2       | +1     | 0         | +7    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -1       | +1     | +3        | +4    | terminal_safe |

## Author Notes

The only purely constructive scenario in Module 5 -- no hidden weakness to find, no pressure to resist. This tests whether the CFI can build a meaningful proficiency plan for a newly certificated pilot. The scenario covers three critical post-checkride topics: addressing examiner feedback (tick 1-2), the WINGS program (tick 3), and personal minimums with long-term planning (tick 4). The WINGS program is specifically called out in FAA_TOPIC.A_7 and is underutilized in real-world GA instruction. The personal minimums discussion is connected to safety culture (PS-2) -- teaching a new pilot to set and follow personal minimums is one of the most impactful things a CFI can do for long-term safety. The "50 hours before instrument" recommendation is common CFI wisdom that prevents the rush-to-instrument-rating problem. All paths reach terminal_safe because this is a planning conversation -- the scores reflect the quality and comprehensiveness of the plan.
