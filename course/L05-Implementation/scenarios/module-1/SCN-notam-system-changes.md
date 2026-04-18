---
status: done
phase: C1
type: scenario-script
---

# SCN 1.9: Cross-Country Planning Session Before Checkride

## Metadata

```
Scenario ID:     1.9
Title:           Cross-Country Planning Session Before Checkride
Module:          1
Difficulty:      0.4
Duration:        20 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_8]
```

## Competency Links

```
competencies: ['RC-4', 'ES-3']
```

## Student Model

```
Student Model:   new -- Private Pilot Student (Advanced)
Parameters:
  skillLevel:         0.5
  compliance:         0.8
  freezeTendency:     0.2
  overconfidence:     0.3
  instrumentAccuracy: 0.4
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> You are conducting a cross-country planning session with a private pilot student who is preparing for their checkride. The student has printed a weather briefing and is reviewing NOTAMs for the planned route. The student has 60 hours total time and has been studying consistently for the past three months. This is a ground-based instructional scenario focused on preflight briefing procedures.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Classroom with flight planning materials spread out. Student has printed a weather briefing and is reviewing NOTAMs for their planned cross-country route. Their study guide is from 2019.
studentSpeech:I've got the NOTAMs here. There are a few FDC NOTAMs and some L NOTAMs. My study guide says to focus on FDC NOTAMs first because they're the most critical. Is that right?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When was that study guide published? Let's compare what it says with the current NOTAM format." Identifies the root cause -- outdated materials. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | "Take a look at the actual NOTAM classifications on the briefing printout. Do they match your study guide?" Leads to discovery.                   |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Explaining the NOTAM changes immediately. Correct but doesn't help the student learn to recognize outdated materials.                             |
| direct        | tick_2     | 0           | -1       | 0      | +1        | "That terminology is outdated. Get a current study guide." True but not a teaching moment.                                                        |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Classroom.                                                                                                                                        |

### Tick 2

```
id:           tick_2
scene:        Student realizes their study guide is outdated. Asks about what changed and why it matters.
studentSpeech:Oh, this guide is from before the changes. What's different now? And will the examiner care if I use the old terminology on the checkride?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Student asked two direct questions. Answer them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | "Pull up the current AIM section on NOTAMs and compare it to your guide." Hands-on but slow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "The FAA reformatted NOTAMs to improve readability. The key changes: plain language keywords replace many of the old contractions, the classification structure was updated, and the presentation format aims for clarity over brevity. For your checkride: yes, the examiner will expect you to use current terminology and demonstrate that you can read and interpret NOTAMs in the current format. More importantly, if you're reading NOTAMs with outdated understanding, you might miss or misinterpret safety-critical information. That's the real issue -- not the checkride." Connects format changes to safety, not just test prep. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Listing the specific format changes. Complete but doesn't connect to why it matters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Classroom.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Tick 3

```
id:           tick_3
scene:        Student is engaged and wants to practice interpreting NOTAMs in the current format. Pulls up a live briefing.
studentSpeech:Can we go through the actual NOTAMs for our route? I want to make sure I'm reading them correctly. There's one here about a runway closure and another about GPS testing. How do I prioritize these?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "Which one do you think affects your flight more?" Good prompting but they need the framework first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | "Read each one out loud and tell me how it affects our planned flight." Active learning approach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Let's work through them systematically. First, look at location and effective dates -- does this NOTAM apply to our route and our planned flight time? The runway closure: which runway, which airport, what dates? If it's our destination and the only runway, that changes the plan. The GPS testing NOTAM: check the area and altitude -- GPS interference testing can affect your navigation if you're in the affected area. The priority framework is: does it affect the safety of this specific flight? Not all NOTAMs matter for every flight, but the ones that do matter a lot." Teaches a repeatable evaluation framework, not just this specific NOTAM. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "The runway closure is at your destination, so plan for the other runway. GPS testing is 200 miles away, doesn't affect you." Solves this instance but doesn't teach the framework.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Classroom.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Tick 4

```
id:           tick_4
scene:        Student asks about staying current with regulatory changes in general, not just NOTAMs. They're realizing their study materials may have other outdated content.
studentSpeech:This makes me nervous. What else might be outdated in my study materials? How do I make sure I'm studying current information? I've been using this guide for months.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | "What other sources have you been using?" Helpful for assessment but the student needs reassurance and a system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "What if we checked the publication dates on all your materials?" Practical first step.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Don't panic -- this is exactly the kind of awareness that makes a good pilot. Here's a system: always check the publication date and edition of any study material. The AIM, the FAR/AIM, and the ACS are updated regularly -- FAA.gov has the current versions, always free. For your checkride prep, cross-reference your study guide against the current ACS for private pilot. Any area where the guidance has changed, we'll update together. Going forward, make it a habit: before you study a topic, check that your source is current. This is a skill you'll use for your entire flying career, not just the checkride." Builds a system, reduces anxiety, teaches a lifelong habit. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Check all publication dates. Use FAA.gov for current AIM and ACS. We'll review any gaps before the checkride." Action plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -1       | +1     | +3        | +4    | terminal_safe |

## Author Notes

This scenario tests AC 61-83K Topic A.8 (Regulatory Updates) through a concrete, practical example: a student using outdated study materials. The NOTAM format changes are the specific content, but the deeper lesson is about how CFIs and pilots stay current with FAA publications generally. The scenario progresses from discovering the problem (tick 1), understanding what changed (tick 2), applying current knowledge (tick 3), to building a system for staying current (tick 4). The tick 4 moment -- when the student realizes their entire study stack may be outdated -- is the emotional pivot that makes the lesson stick. This scenario pairs well with SCN 1.7 (Old Lesson Plan vs Current), which covers the same topic from the CFI's own materials perspective rather than the student's.
