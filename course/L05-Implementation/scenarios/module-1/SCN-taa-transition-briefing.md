---
status: done
phase: C1
type: scenario-script
---

# SCN 1.6: TAA Transition Briefing

## Metadata

```
Scenario ID:     1.6
Title:           TAA Transition Briefing
Module:          1
Difficulty:      0.4
Duration:        10 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1, FAA_TOPIC.A_12]
```

## Competency Links

```
competencies: ['AV-1', 'ES-3']
```

## Student Model

```
Student Model:   new -- Transitioning Instrument Student
Parameters:
  skillLevel:         0.6
  compliance:         0.8
  freezeTendency:     0.2
  overconfidence:     0.4
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.2
```

## Briefing

> You are briefing an instrument student on a TAA (Terminal Arrival Area) approach for the first time. The student earned their instrument rating in a traditional round-gauge aircraft and has recently transitioned to a G1000 aircraft. The student can brief a traditional ILS approach confidently but has never seen a TAA approach plate. You are on the ground before a planned IFR flight to a TAA-only airport.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Planning table. The TAA approach plate is open on the iPad. The student is looking at the IAF sectors, the step-down fixes, and the T-shaped arrangement. Their expression shows confusion.
studentSpeech:This looks completely different from a normal approach. Where's the feeder route? Where do I get established? I don't even know where to start reading this.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What parts look familiar compared to the ILS you know?" Anchors new knowledge to existing knowledge. Excellent teaching technique.            |
| prompt        | tick_2     | +1          | 0        | +1     | 0         | Prompting to identify the common elements -- final approach course, MDA, missed approach. Starting point is fine but less elegant than asking. |
| coach         | tick_2     | 0           | -1       | 0      | 0         | Coaching immediately when the student just said "I don't know where to start." Let them find the familiar parts first.                         |
| direct        | tick_2     | 0           | -2       | 0      | 0         | Directing the student through the plate step by step. They learn the plate, not the skill of reading plates.                                   |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground briefing.                                                                                                                               |

### Tick 2

```
id:           tick_2
scene:        Student identifies the final approach segment and the missed approach. But the TAA sectors -- the pie-shaped sectors around the IAFs -- are still confusing. The student doesn't understand how to determine which IAF to use.
studentSpeech:OK, the final approach course is the same idea. But these sectors with the different altitudes... how do I know which one I'm in? And why are there three IAFs?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[ask, prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                               |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Student needs conceptual teaching, not more testing. They're lost and asking for help.                                                                                                                                                                                                   |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to think about where you'd be coming from. Correct direction but student needs more support.                                                                                                                                                                                   |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Think of the T as a funnel. ATC or your GPS will tell you which sector you're in based on your direction of arrival. Each sector has its own IAF and altitude. The GPS does the sector math for you -- your job is to verify the altitude and the correct IAF." Conceptual + practical. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Telling the student which IAF to use for today's flight. Solves today's problem but doesn't teach the concept.                                                                                                                                                                           |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Ground briefing.                                                                                                                                                                                                                                                                         |

### Tick 3

```
id:           tick_3
scene:        Student is starting to understand the T structure. But now they're trying to reconcile the TAA with the ACS standards they memorized for their checkride. Confused about what the examiner would expect.
studentSpeech:Wait, if I'm teaching this to a student, what does the ACS say about TAAs? Is this an area of operation? I prepared for my checkride using PTS -- I don't even know where TAA fits in the ACS.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4     | 0           | -1       | 0      | 0         | Good question by the student. Answer it -- don't deflect with more probing.                                                                                                                                                                                                                                        |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | Prompting to look at the ACS instrument rating standards. Shows the student how to find the answer themselves.                                                                                                                                                                                                     |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "The ACS doesn't call out TAA separately. It falls under 'Instrument Approach Procedures.' The examiner will expect you to brief and fly whatever approach is available -- ILS, RNAV, TAA. The skill is the same: read the plate, verify the automation, fly the approach." Connects old framework to new content. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing to the specific ACS section. Accurate but doesn't help the student build the mental framework.                                                                                                                                                                                                           |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Ground briefing.                                                                                                                                                                                                                                                                                                   |

### Tick 4

```
id:           tick_4
scene:        Student is nodding, confidence building. They pull up the ACS on the iPad and find the approach section. A light-bulb moment as they see how TAA fits the existing framework.
studentSpeech:Oh, I see. It's not a separate thing -- it's just a different kind of approach with the same standards. So if I can teach a student to brief any approach systematically, TAA is just another version of that skill?
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                               |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | "How would you brief this approach to a student?" Tests the synthesis. Good but the student is in a positive learning flow.                                                                                                                                              |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to brief the approach now using their new understanding. Practical application of the concept.                                                                                                                                                                 |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Exactly. And here's the key for teaching: always start with what the student already knows. ILS approach structure is the same skeleton. TAA just adds the sector entry piece. Build from the familiar to the unfamiliar." Teaches them how to teach. Meta-instruction. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing to brief the approach. Student complies but the meta-teaching moment (how to teach transitions) is missed.                                                                                                                                                     |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Ground briefing.                                                                                                                                                                                                                                                         |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +3          | +3       | +3     | +3        | +12   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +2       | +1     | 0         | +7    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -5       | 0      | +3        | -1    | terminal_safe |

## Author Notes

This is a teaching-about-teaching scenario. The CFI isn't just learning about TAAs -- they're learning how to teach new concepts to instrument students who are transitioning between aircraft types and standards. The scenario has no terminal_unsafe path because it's a ground briefing, but the instructional quality varies enormously. The optimal path demonstrates the "anchor to the known" technique: start with what the student recognizes (ILS structure), then build the new concept (TAA sectors) on that foundation. The ACS integration in tick 3 addresses a real gap -- many CFIs were trained under PTS and haven't fully internalized how ACS organizes knowledge differently. ES-3 (use ACS as a teaching and debrief framework) is tested because the CFI must know how TAA fits the ACS structure to teach it effectively. The recovered state in tick 4 represents the student making the connection independently -- the highest form of learning.
