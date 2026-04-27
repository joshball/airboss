---
status: done
phase: C1
type: scenario-script
---

# SCN 2.6: Friday Evening Phone Call from a Fellow Pilot

## Metadata

```
Scenario ID:     2.6
Title:           Friday Evening Phone Call from a Fellow Pilot
Module:          2
Difficulty:      0.4
Duration:        8 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_10, FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['PS-1', 'RM-3', 'ES-1']
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

> A good friend and fellow pilot calls you on a Friday evening. He needs a flight review by Sunday because his is expired and he has a cross-country trip planned Monday. He says he's been flying regularly -- "at least once a month" -- and wants to schedule something for Saturday. He has 280 hours and flies a Cessna 182.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        Phone call. Your friend's tone is upbeat and casual. You can hear his family in the background discussing the Monday trip. He's clearly assuming this is a formality.
studentSpeech:Come on, you know I can fly. We've been flying together for years. It's just a formality, right? I'll buy you lunch at that place by the airport.
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When was your last actual flight? What have you been doing recently?" Good -- gets facts before committing.                       |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting that a flight review has specific requirements regardless of relationship. Sets the tone early.                          |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching a friend who hasn't asked for coaching. He asked for a favor, not a lesson.                                               |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Flat refusal on the first request, before any assessment. Harsh for a friend asking for something he doesn't realize is a problem. |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Phone call.                                                                                                                        |

### Tick 2

```
id:           tick_2
scene:        Friend reveals his "regular flying" is actually passengers-only flights in a friend's Cirrus -- right seat, no PIC time. Last PIC time was 5 months ago. Still sounds confident.
studentSpeech:Well, I mean, I've been in the airplane. Right seat, but I'm watching everything. It's basically the same. I could take over any time.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3        | 0           | -1       | -1     | 0         | You now know his currency is weaker than he represented. Time to set expectations, not ask more questions.                                                                                                 |
| prompt        | tick_3        | +1          | 0        | 0      | 0         | Prompting that right-seat time isn't PIC time is accurate but feels pedantic to a friend. Frame it as care, not rules.                                                                                     |
| coach         | tick_3        | +1          | +1       | +1     | +1        | "I want to do this for you, but I owe you a real review. Right-seat time isn't the same as PIC. Let me put together something that actually checks the important stuff so I know you're solid for Monday." |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Here's the deal: we do a proper flight review -- ground and air. If you're as good as you think, it'll be quick. I'm not signing off pattern work and calling it a review."                               |
| take_controls | tick_3        | -1          | -3       | -1     | -1        | Phone call.                                                                                                                                                                                                |

### Tick 3

```
id:           tick_3
scene:        Friend's tone shifts. The casual request is becoming an imposition. He mentions that another instructor at the airport "would just do it" and that you're making this into a bigger deal than it needs to be.
studentSpeech:You know what, forget it. I'll call Mike. He'll just sign me off. I thought we were friends.
studentState: critical
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                     |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_unsafe | -1          | -2       | -1     | -1        | Friend is walking. If you let him go to someone who will rubber-stamp it, you've abdicated the professional responsibility AND the friendship.                                                                                 |
| prompt        | terminal_unsafe | 0           | -1       | 0      | -1        | Prompting regulations while he's walking away. He won't hear it.                                                                                                                                                               |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | "I get it. But I'm telling you this because I'm your friend, not despite it. If Mike does a pattern ride and signs you off, and something happens Monday, I'll know I could have done better."                                 |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "Call Mike if you want. But I'm asking you to let me do this right. An hour of my time Saturday is a small price for knowing you and your family are safe Monday. I'll even buy lunch." Redirects the favor, reframes the ask. |
| take_controls | terminal_safe   | -1          | -3       | -1     | -1        | Phone call.                                                                                                                                                                                                                    |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> terminal_unsafe (ask/prompt)
              \         \-> terminal_safe (coach/direct)
               \-> terminal_safe (direct)
```

## Score Summary

| Path                              | recognition | judgment | timing | execution | Total | Outcome         |
| --------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> direct)  | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Quick boundary (prompt -> direct) | +2          | +2       | +2     | +1        | +7    | terminal_safe   |
| Worst case (ask -> ask -> ask)    | 0           | -2       | -1     | -1        | -4    | terminal_unsafe |

## Author Notes

The third pressure scenario in the M2 trio (2.4, 2.5, 2.6), each escalating the emotional complexity. A customer is one thing. A boss is harder. A friend is the hardest. The ethical challenge here is that the friend's request is socially normal -- "just sign me off" is what many pilots say about flight reviews. The CFI has to recognize that the friend's self-assessment ("I've been flying regularly") is factually misleading (right-seat passenger time =/= PIC time), then maintain the standard without destroying the friendship. The terminal_unsafe isn't a crash -- it's the friend going to Mike, getting a cursory signoff, and flying into conditions he's not current for. The CFI who lets that happen has failed both professionally and personally. The optimal path in tick 3 reframes the favor: "I'm doing this BECAUSE you're my friend." That's the mark of a professional who understands that ethics and relationships aren't in conflict. Connects to ES-1 (tailored flight review) and PS-1 (professionalism).
