---
status: done
phase: C1
type: scenario-script
---

# SCN 1.1: IFR Cross-Country in a G1000 Cessna

## Metadata

```
Scenario ID:     1.1
Title:           IFR Cross-Country in a G1000 Cessna
Module:          1
Difficulty:      0.4
Duration:        10 min
Pattern:         Escalating Crisis
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_1]
```

## Competency Links

```
competencies: ['AV-3', 'RC-4']
```

## Student Model

```
Student Model:   Automation-Dependent
Parameters:
  skillLevel:         0.5
  compliance:         0.7
  freezeTendency:     0.3
  overconfidence:     0.6
  instrumentAccuracy: 0.7
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> You are conducting a cross-country training flight in a G1000-equipped Cessna 172 with your instrument student. The flight was planned VFR, but weather along the route has deteriorated and you have requested an IFR clearance. Your student has loaded the approach at the destination and is reviewing the procedure. The student has 120 hours total time and relies heavily on GPS for all navigation.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Cruising IFR at 6,000. Student has the GPS approach loaded and is reviewing the plate on the iPad. You notice the "DATABASE EXPIRED" annunciation on the GPS unit. The student hasn't mentioned it.
studentSpeech:OK, I've got the RNAV 24 loaded. Straight-in from FIXXX, pretty simple approach. Ready when ATC gives us the clearance.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What does that annunciation on the GPS mean?" Perfect diagnostic -- makes the student find and process the warning themselves. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to check the GPS database currency. Gets the right information in front of the student.                               |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on database currency is correct but the student hasn't seen the problem. Let them discover it.                         |
| direct        | tick_2     | 0           | -1       | 0      | +1        | Directing to look at the annunciation. Works but misses the teaching opportunity about monitoring.                              |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Level IFR cruise with no immediate hazard.                                                                                      |

### Tick 2

```
id:           tick_2
scene:        Student sees the DATABASE EXPIRED warning. Looks confused, then dismissive. Taps the GPS screen and the approach is still loaded and appears to work.
studentSpeech:Oh, it's expired? But the approach is still in there and it matches the plate. It should be fine, right? It's only 10 days.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Student rationalized the expired database. Asking more questions lets the rationalization solidify. Teach the regulation.                                                                                   |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "Under IFR, can we legally use a GPS approach with an expired database? Where would you find that answer?"                                                                                                  |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Coaching the regulatory basis: expired database means the approach may not reflect current NOTAM'd changes. Waypoints could have moved. Altitudes could have changed. "Looks the same" is not the standard. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | Directing to request a conventional approach instead. Safe but student doesn't learn why.                                                                                                                   |
| take_controls | tick_3     | 0           | -2       | 0      | 0         | No immediate safety issue at this point.                                                                                                                                                                    |

### Tick 3

```
id:           tick_3
scene:        ATC clears you for the RNAV 24 approach. Student begins configuring for the approach, following the GPS guidance without question. You notice the step-down altitude at one fix differs from the current plate by 100 feet -- the database has an old amendment.
studentSpeech:Cleared for the approach. GPS is guiding me in. I'll just follow the magenta line.
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Student is about to fly incorrect altitudes on an IFR approach. This isn't a learning moment anymore.                                                                           |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting while descending on an approach with bad data. Too passive for the risk.                                                                                              |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching to cross-reference the plate is correct in theory, but the student is already following bad GPS data.                                                                  |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Stop following the GPS altitudes. We're using the plate and backing up with VOR. Cross-check every altitude before descending." Takes the bad data source out of the equation. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking over navigation on an approach with known bad data. Appropriate. Fly the approach from the plate.                                                                        |

### Tick 4

```
id:           tick_4
scene:        Student descends to the GPS-indicated step-down altitude, which is 100 feet lower than the current plate. Terrain clearance is now compromised. TAWS (if equipped) gives a caution alert.
studentSpeech:The GPS says 2,400 here but the plate says 2,500. Which one is right? Should I climb back up?
studentState: critical
safeWindow:   [take_controls]
criticalWindow:[direct]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                  |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------- |
| ask           | terminal_unsafe | -2          | -3       | -3     | -2        | Aircraft is 100 feet below the correct minimum altitude on approach. Not a discussion.      |
| prompt        | terminal_unsafe | -1          | -2       | -2     | -1        | Prompting while below minimum altitude. Insufficient urgency.                               |
| coach         | terminal_unsafe | 0           | -1       | -1     | -1        | Coaching while terrain clearance is compromised. Too slow.                                  |
| direct        | terminal_safe   | +1          | 0        | 0      | +1        | "Climb to 2,500 immediately. The plate is current, the GPS is not." Corrects the altitude.  |
| take_controls | terminal_safe   | +1          | +1       | +1     | +1        | Taking controls to climb and re-establish on the correct approach profile. Fully justified. |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt/coach)
                        \         \-> terminal_safe (direct/take_controls)
                         \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                              | recognition | judgment | timing | execution | Total | Outcome         |
| ------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> prompt -> direct)                 | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Late catch (ask -> ask -> coach -> take_controls) | +1          | -2       | -2     | 0         | -3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)             | -2          | -6       | -5     | -3        | -16   | terminal_unsafe |

## Author Notes

The template-setter for Module 1 automation scenarios. GPS database currency is a regulation that many pilots treat casually -- "it's only 10 days old" is a real rationalization heard frequently. The scenario makes the abstract regulation concrete by showing that expired databases can contain incorrect altitude data. The 100-foot discrepancy in tick 3 is subtle but operationally significant -- it's the difference between clearing terrain and not. The Automation-Dependent student model drives the core behavior: following the GPS without cross-referencing the plate. The teaching point is that AV-3 (teach GPS limitations) isn't abstract -- it has direct safety consequences. The "magenta line" fixation connects to AC 61-83K's emphasis on teaching pilots to remain proficient in conventional navigation and not become automation-dependent. RC-4 (use current regulatory sources) is tested because the student needs to understand why currency requirements exist -- they're not bureaucratic paperwork, they're safety-critical.
