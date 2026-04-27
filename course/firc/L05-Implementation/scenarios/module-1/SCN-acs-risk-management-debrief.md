---
status: done
phase: C1
type: scenario-script
---

# SCN 1.10: Post-Flight Debrief After Instrument Training

## Metadata

```
Scenario ID:     1.10
Title:           Post-Flight Debrief After Instrument Training
Module:          1
Difficulty:      0.5
Duration:        15 min
Pattern:         Diagnostic Puzzle
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_12]
```

## Competency Links

```
competencies: ['ES-3', 'CJ-3']
```

## Student Model

```
Student Model:   new -- Instrument Student Pre-Checkride
Parameters:
  skillLevel:         0.7
  compliance:         0.8
  freezeTendency:     0.2
  overconfidence:     0.4
  instrumentAccuracy: 0.6
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> You just completed an instrument training flight with a student preparing for their instrument checkride. The student flew three approaches and all were within ACS tolerances for tracking. The student is satisfied with the flight and is packing up. You are sitting down at the FBO for the debrief. This is a post-flight ground scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Post-flight debrief at the FBO. Student is satisfied with the flight, reviewing their approach tracking on a tablet. All approaches were within standard tolerances.
studentSpeech:I think that went well! My ILS was within a dot the whole way, and the GPS approach was right on centerline. I feel ready for the checkride. What do you think?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Your tracking was solid. Walk me through your decision-making on that last approach -- the weather was changing. What were you thinking?" Opens the risk management discussion without dismissing the skill achievement. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | "What about the parts of the flight that aren't about tracking needles?" Vague.                                                                                                                                           |
| coach         | tick_2     | 0           | -1       | 0      | +1        | Launching into the critique without acknowledging the skill performance. Undermines the student's confidence unnecessarily.                                                                                               |
| direct        | tick_2     | 0           | -2       | 0      | +1        | "You're not ready. Your risk management was poor." Accurate assessment but devastating delivery.                                                                                                                          |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Ground conversation.                                                                                                                                                                                                      |

### Tick 2

```
id:           tick_2
scene:        Student pauses and thinks about the weather decision. They realize they didn't really have a plan for deteriorating conditions.
studentSpeech:Honestly, I noticed the weather was getting worse but the approach was going well, so I just kept going. I figured if the needles were good, the approach was good. Was that wrong?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | The student just identified the gap. Don't keep digging -- teach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | "What does the ACS say about risk management for the instrument approach Task?" Points to the framework.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Your needle tracking was genuinely good. But here's the ACS framework: every Task has three dimensions -- knowledge, risk management, and skill. You crushed the skill dimension. But the risk management dimension for instrument approaches includes recognizing deteriorating conditions, having alternates planned, and knowing when to abandon an approach. A DPE who sees you continue into worsening weather without a plan will evaluate that as a risk management deficiency, even if your needles are perfect. Perfect skill with poor judgment is not a passing combination under ACS." Three-dimensional framework, specific to their situation, connected to checkride reality. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "ACS evaluates risk management alongside skill. You need both." True but doesn't teach the framework.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Tick 3

```
id:           tick_3
scene:        Student understands the framework. Now asks about the approach briefing they skipped.
studentSpeech:OK, that makes sense. What about the approach briefing? I know I'm supposed to do one but honestly, I've flown that ILS so many times I didn't think I needed to brief it. The DPE won't care about a familiar approach, will they?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4     | 0           | 0        | -1     | 0         | Student asked a direct question. Answer it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "What could change on an approach you've flown many times?" Good question that leads to the answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "A DPE absolutely will care. Under ACS, the approach briefing demonstrates the knowledge element -- you know the procedure, the minimums, the missed approach procedure, and the current NOTAMs that might affect it. It also demonstrates risk management -- you're systematically checking for changes and setting decision points before you're task-loaded in the approach. An approach you've flown 50 times can have a NOTAM-ed frequency change, a new obstacle, or an amended missed approach. The briefing catches those. Skip the briefing and a DPE has evidence that you're relying on familiarity instead of procedure." Connects the briefing to ACS dimensions. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "Always brief. NOTAMs can change anything. DPEs check for this." Correct but doesn't teach why.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Tick 4

```
id:           tick_4
scene:        Student is processing the ACS framework seriously now. Asks what they need to do before the checkride.
studentSpeech:So basically I need to demonstrate all three -- knowledge, risk management, and skill -- for every Task? How do I practice the risk management part? I can't practice bad weather decisions in a Cessna.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | Direct question. Answer it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "What scenarios can we create on the ground to practice risk management?" Good.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Exactly right -- all three dimensions for every Task. Risk management practice doesn't require actual bad weather. We do it through scenario-based debriefs like this one, through what-if discussions during ground sessions, and through deliberate practice of decision-making on every flight. Before each approach, brief: what are my personal minimums today? What's my missed approach trigger? What's my alternate? Practice saying 'missed approach' out loud when conditions warrant it. The DPE will present scenarios verbally and evaluate your reasoning. If you can articulate why you would or wouldn't continue an approach, that's the skill they're testing." Actionable practice plan, connects to checkride format. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Practice with scenario discussions, what-if questions, and verbalize decisions on every approach. We'll do dedicated risk management sessions before the checkride." Concrete plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | -3       | +1     | +3        | +2    | terminal_safe |

## Author Notes

This scenario directly tests the CFI's ability to use the ACS framework as a teaching tool, which is the core of AC 61-83K Topic A.12. The critical insight: a student who flies technically perfect approaches but makes poor risk management decisions is NOT checkride-ready under ACS, even though they would have been under PTS. This distinction is the most important change ACS brought to aviation training. The scenario structure progresses from acknowledging skill achievement (tick 1), through exposing the risk management gap (tick 2), connecting it to the approach briefing (tick 3), and building a practice plan (tick 4). The tick 1 entry point is critical -- the optimal path begins by acknowledging what the student did well before addressing what needs work. This models good debrief technique while testing ACS knowledge.
