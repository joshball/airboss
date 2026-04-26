---
status: done
phase: C1
type: scenario-script
---

# SCN 5.5: IPC Request from a Fellow CFI

## Metadata

```
Scenario ID:     5.5
Title:           IPC Request from a Fellow CFI
Module:          5
Difficulty:      0.5
Duration:        10 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_9, FAA_TOPIC.A_10]
```

## Competency Links

```
competencies: ['ES-1', 'PS-1', 'RM-3']
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

> A fellow CFI and close friend asks you to conduct their IPC. They need it renewed for insurance purposes. They suggest doing the IPC at their home airport where you both know the approaches well. They have brought donuts to the briefing. You have known this pilot for several years and have flown together socially.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Briefing room. Your friend has the approach plates out, coffee ready, and is already filling in the IPC logbook entry except for your signature. The donuts are on the table.
studentSpeech:I've already picked two approaches -- the ILS and the VOR. Both at our home airport. I've flown them a hundred times. Let's knock this out before lunch. I'll buy.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What areas do you want to focus on? Any rust you've noticed?" Treats it as a real IPC, not a favor.                                                           |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting that a proper IPC has specific requirements including unusual approaches and holding. "Let's make sure we cover everything the regulations require." |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching a fellow CFI on IPC requirements. They know the requirements -- the issue is willingness to comply.                                                   |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing the full IPC checklist. Technically correct but the tone needs managing -- they're a friend and peer.                                                |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                                                 |

### Tick 2

```
id:           tick_2
scene:        Friend laughs off the suggestion that the IPC should be more than two home-airport approaches. Points out they flew these approaches three days ago and were perfect.
studentSpeech:Come on, we're both CFIs. You know I can fly. I'm not some rusty private pilot. Just two approaches, a hold, and sign me off. I'd do the same for you.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_3        | 0           | -1       | -1     | 0         | The friend is pushing for a shortcut. Assert the standard.                                                                                                                                                                                                                                                         |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompting about what a proper IPC includes. They know -- remind them.                                                                                                                                                                                                                                              |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "If you flew them three days ago and were perfect, this will be quick. But we're going to do it right: approaches including one you don't fly regularly, holds, and recovery from unusual attitudes. If you're as sharp as you say, it'll take an hour. My name goes on this IPC and I want it to mean something." |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "We do the full IPC or I don't sign it. Approaches, holds, intercepting, recovery. Your call." Clear professional boundary.                                                                                                                                                                                        |
| take_controls | tick_3        | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                                                                                                                                                                                                     |

### Tick 3

```
id:           tick_3
scene:        Friend's smile fades. The peer dynamic is shifting. They look at the donuts, then at you. The friendly request is becoming an uncomfortable professional moment.
studentSpeech:Fine. But I'm telling you, you're overthinking this. I'll do your full IPC, and then you're buying me dinner instead of just donuts.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                        |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | Maintaining the professional tone. Any reasonable response works.                                                                                                                                                                                                                 |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to set up the flight plan. Moves past the tension and into the work.                                                                                                                                                                                                    |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Deal on dinner. And here's why I'm doing this: if I rubber-stamp your IPC, I'm doing you a disservice. If you're sharp, this proves it. If there's rust, we find it now instead of at 200 feet in the clouds. That's what friends actually do." Reframes the conflict as caring. |
| direct        | terminal_safe | +1          | 0        | 0      | +1        | "Let's fly. I'll include an approach to an airport you don't fly to regularly." Moves forward.                                                                                                                                                                                    |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                     |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_safe
              \-> terminal_safe (direct)
```

## Score Summary

| Path                              | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach)   | +3          | +3       | +3     | +2        | +11   | terminal_safe |
| Quick boundary (prompt -> direct) | +2          | +2       | +2     | +1        | +7    | terminal_safe |
| Poor (coach -> ask -> ask)        | +2          | 0        | 0      | 0         | +2    | terminal_safe |

## Author Notes

This scenario pairs with 2.6 (Friend Wants Shortcut Flight Review) but raises the stakes: the "student" is a fellow CFI, which adds the peer dynamic. When two professionals negotiate standards, the pressure to lower them is powerful because of mutual respect and the implied reciprocity ("I'd do the same for you"). The scenario tests PS-1 (professionalism) and ES-1 (tailored evaluation) in the most challenging context: maintaining standards with a peer who doesn't think they're necessary. The pre-written logbook entry and the donuts are real behaviors -- they establish the expectation that the signoff is a foregone conclusion. The optimal path holds the standard while preserving the friendship by reframing thoroughness as care, not distrust. Every path reaches terminal_safe because the CFI controls whether the IPC happens properly.
