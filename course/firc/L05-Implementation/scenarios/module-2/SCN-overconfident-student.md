---
status: done
phase: C1
type: scenario-script
---

# SCN 2.1: Stage Check Preparation at 80 Hours

## Metadata

```
Scenario ID:     2.1
Title:           Stage Check Preparation at 80 Hours
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
Student Model:   Overconfident Student
Parameters:
  skillLevel:         0.4
  compliance:         0.6
  freezeTendency:     0.3
  overconfidence:     0.8
  instrumentAccuracy: 0.5
  startleDelay:       0.4
  fatigue:            0.2
```

## Briefing

> Your student has 80 hours and is preparing for a stage check. During the last three flights, the student has been dismissive of your corrections, saying things like "I know" and "I already did that." Ground school quiz scores are high, but in-flight performance does not match. Today you are reviewing power-on stalls and the student has already told you they "nailed" these last time.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Pre-maneuver briefing. Student is leaning back, relaxed, arms crossed. You ask about the procedure for power-on stall entry and recovery.
studentSpeech:Yeah, I know this. Full power, pull back, feel the buffet, push forward and add power. I've done this a bunch of times.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | Good diagnostic probing. "What about coordinated rudder input during recovery?" Tests whether the confidence has substance.        |
| prompt        | tick_2     | +1          | 0        | +1     | 0         | Prompting is OK but the student will hear it as a lecture. Questions expose gaps more effectively with this personality.           |
| coach         | tick_2     | 0           | -1       | 0      | 0         | Coaching an overconfident student who hasn't demonstrated the gap yet. They'll tune you out.                                       |
| direct        | tick_2     | 0           | -2       | 0      | 0         | Directing before the student has shown the problem. Overconfident students resist direct instruction they perceive as unnecessary. |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | There is no flight safety issue. Taking controls is nonsensical in a ground briefing context.                                      |

### Tick 2

```
id:           tick_2
scene:        In the air, student sets up for power-on stall. Enters at wrong airspeed (too fast), adds full power before establishing pitch. The entry is sloppy but the student doesn't notice.
studentSpeech:OK, stall coming... here we go. See? I told you I know this.
studentState: degrading
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | +1          | +1       | +1     | 0         | "What was your entry airspeed? What does the ACS say it should be?" Forces self-evaluation against a standard.  |
| prompt        | tick_3     | +1          | +1       | +1     | 0         | Prompting attention to the entry procedure. "Let's look at what the ACS specifies for entry."                   |
| coach         | tick_3     | +1          | 0        | 0      | +1        | Coaching through the correct procedure is effective but may trigger defensiveness in an overconfident student.  |
| direct        | tick_3     | 0           | -1       | 0      | +1        | Directing the correct entry. Student complies but learns that you're "picky," not that they were wrong.         |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Student is performing a maneuver (poorly). No safety issue. Taking controls is destructive to the relationship. |

### Tick 3

```
id:           tick_3
scene:        During stall recovery, student pitches forward aggressively, loses 200 feet, and adds power late. Student maintains coordinated flight but the recovery is well outside ACS tolerances. Student looks satisfied.
studentSpeech:Recovered! See, no problem. Can we move on to the next thing?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                             |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | 0        | -1     | 0         | The student already demonstrated the gap. More questions without showing them the standard feels like a game.          |
| prompt        | tick_4     | +1          | +1       | +1     | +1        | Prompting to review against ACS standards: "Let's compare what just happened to what the examiner will expect."        |
| coach         | tick_4     | +1          | +1       | +1     | +1        | Coaching with specific, observable feedback: "You lost 200 feet -- ACS allows 50. Let's work on what that looks like." |
| direct        | tick_4     | +1          | 0        | 0      | +1        | Directing a redo works but doesn't address the overconfidence. Student will comply but not internalize.                |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | No safety issue in post-recovery flight.                                                                               |

### Tick 4

```
id:           tick_4
scene:        You've provided feedback. Student's body language shifts -- arms cross again, jaw tightens. The overconfidence mask is starting to crack.
studentSpeech:I mean, it wasn't that bad. My last instructor said I was doing great. Are you sure you're not being too strict?
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                      |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5        | 0           | -1       | 0      | 0         | Student is challenging your authority. Open-ended questions feel weak here. Address the issue directly but with care.                                                                           |
| prompt        | tick_5        | +1          | +1       | 0      | 0         | Prompting to examine the standard, not your opinion. "This isn't my standard -- it's the ACS. Let's look at it together."                                                                       |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching the mindset shift: "I'm not being strict -- I'm showing you what the examiner will see. My job is to make sure you're ready, not to make you feel good." Honest, professional, caring. |
| direct        | tick_5        | +1          | 0        | 0      | +1        | Directing to redo the maneuver. Student complies but the relationship tension is unresolved.                                                                                                    |
| take_controls | tick_5        | -1          | -3       | -1     | -1        | No flight safety issue.                                                                                                                                                                         |

### Tick 5

```
id:           tick_5
scene:        Student is quiet, clearly frustrated. Staring out the window. The defensive posture is gone but replaced by withdrawal. They attempt another stall -- entry is better but recovery is still sloppy.
studentSpeech:Fine. Whatever you say.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                     |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | Student is shut down. Questions feel like interrogation right now. They need encouragement, not more testing.                                                                                                                  |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting what improved: "Your entry was much better that time." Acknowledges progress. Adequate but could do more.                                                                                                            |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | Coaching with positive specifics: "That entry was solid. Recovery still needs work on altitude loss, but the improvement shows you can do this. Let's do one more focused on the recovery pitch." Rebuilds without retreating. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | Directing another attempt. Student complies but the emotional state isn't addressed. Rote compliance, not learning.                                                                                                            |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | No safety issue.                                                                                                                                                                                                               |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
                                   \-> terminal_safe (coach)
```

## Score Summary

| Path                                                     | recognition | judgment | timing | execution | Total | Outcome       |
| -------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> ask -> prompt -> coach)                  | +4          | +4       | +4     | +2        | +14   | terminal_safe |
| Adequate (prompt -> coach -> direct -> direct -> direct) | +3          | 0        | +1     | +4        | +8    | terminal_safe |
| Poor (direct -> direct -> direct -> direct -> direct)    | 0           | -7       | -1     | +4        | -4    | terminal_safe |

## Author Notes

This is a Diagnostic Puzzle, not an Escalating Crisis. There is no physical danger -- the challenge is entirely instructional. The overconfident student is one of the most common and most difficult teaching challenges. The scenario tests whether the CFI can diagnose the gap between the student's self-assessment and actual performance, then address it without destroying the relationship. The optimal path uses questions early (to surface the gap), shifts to prompting against objective standards (to remove the "it's just your opinion" defense), and finishes with coaching that rebuilds confidence on an honest foundation. The worst approach is directing throughout -- the student complies mechanically but the overconfidence remains unchallenged, and the relationship degrades to "whatever you say." Note this scenario has no terminal_unsafe path -- the danger is instructional failure, not aircraft control. Every path reaches terminal_safe because the CFI is always present. The scores reflect teaching quality, not safety.
