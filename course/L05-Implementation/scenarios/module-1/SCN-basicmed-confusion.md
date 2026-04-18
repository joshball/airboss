---
status: done
phase: C1
type: scenario-script
---

# SCN 1.8: Preflight Briefing with a Returning Instrument Pilot

## Metadata

```
Scenario ID:     1.8
Title:           Preflight Briefing with a Returning Instrument Pilot
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
competencies: ['RC-4', 'PS-2']
```

## Student Model

```
Student Model:   new -- Experienced Pilot Returning to Training
Parameters:
  skillLevel:         0.6
  compliance:         0.7
  freezeTendency:     0.1
  overconfidence:     0.5
  instrumentAccuracy: 0.5
  startleDelay:       0.2
  fatigue:            0.2
```

## Briefing

> An instrument-rated private pilot arrives for IFR recurrency training. During the preflight briefing, you discover they are operating under BasicMed (14 CFR Part 68) instead of a traditional medical certificate. The pilot has several misconceptions about what BasicMed allows and doesn't allow. This is a ground-based instructional scenario -- you are clarifying regulatory requirements before the training flight.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO briefing room. Pilot presents BasicMed documentation. You're reviewing the training plan for instrument approach practice. The pilot mentions wanting to fly above FL180 for a cross-country trip next month.
studentSpeech:I've got my BasicMed all current -- did the online course and got the CMEC from my doctor last month. I'm thinking about filing IFR direct at FL190 for the trip to Denver next month. Saves a lot of time at altitude.
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                   |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Can you walk me through what you understand about BasicMed altitude and airspace limitations?" Exposes the knowledge gap without lecturing. |
| prompt        | tick_2     | +1          | +1       | 0      | 0         | "Let's review the BasicMed operating limitations before we plan that trip." Direct but still collaborative.                                  |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Explaining BasicMed limitations immediately. Correct but skips diagnosing how deep the knowledge gap goes.                                   |
| direct        | tick_2     | +1          | -1       | 0      | +1        | "You can't fly above 18,000 on BasicMed." Accurate but blunt -- doesn't teach, just corrects.                                                |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                               |

### Tick 2

```
id:           tick_2
scene:        Pilot is surprised by the altitude limitation. Reveals more misunderstandings.
studentSpeech:Wait, really? I thought BasicMed was basically the same as a third-class medical. What else can't I do? I was also planning to take five friends to Oshkosh in a Bonanza.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | The pilot has two more misconceptions showing -- passenger and aircraft limits. Don't keep probing; teach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | "How many seats does that Bonanza have?" Gets them to discover the 6-seat limit themselves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "BasicMed and a third-class medical have important differences. BasicMed limits you to: aircraft with max 6 seats and max 6,000 lbs takeoff weight, below 18,000 feet MSL, no faster than 250 knots indicated, within the US and under specific conditions. With five passengers in a 6-seat Bonanza, you're at the seat limit -- that's legal -- but check your weight. The bigger issue is that these limits exist because BasicMed is a streamlined process, not a full aeromedical evaluation. Understanding the boundaries is part of operating professionally." Complete, accurate, teaches the why. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "Six seats max, 6,000 lbs, below 18,000, 250 knots, US only." List of facts without context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Briefing room.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Tick 3

```
id:           tick_3
scene:        Pilot absorbs the limitations. Now asks about the recurrency requirements and whether their BasicMed is actually current.
studentSpeech:OK, so I did the online course and saw my doctor. Am I good for two years? And what if something changes with my health -- do I have to report it to anyone?
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | +1          | 0        | 0      | 0         | "When exactly did you complete each requirement?" Verification is good.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "Pull up your BasicMed documentation and let's verify the dates together." Collaborative.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "BasicMed has two components with different timelines. The Comprehensive Medical Examination Checklist (CMEC) from your doctor is valid for 48 months. The online aeromedical course must be completed every 24 months. Both must be current to exercise BasicMed privileges. For health changes: you must comply with 14 CFR 61.53 -- if you know or have reason to know of any medical condition that would make you unable to operate safely, you cannot act as PIC. That's the same standard as a traditional medical, and it's on you to self-assess honestly. Also, if the FAA has ever denied, revoked, or suspended your medical, BasicMed may not be available to you -- check 14 CFR 68.9." Precise timelines, self-reporting obligation, disqualifying conditions. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "CMEC every 48 months, online course every 24 months, and 61.53 self-assessment applies." Facts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Tick 4

```
id:           tick_4
scene:        Pilot realizes they were confused about the timeline. Their online course is actually overdue. They completed it 26 months ago.
studentSpeech:Hang on, let me check... I did the course in February two years ago. That's 26 months. Am I not legal right now? I've been flying for the last two months thinking I was fine.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | -1       | 0      | 0         | The pilot just told you they've been flying without valid medical authorization. Don't ask more questions -- address it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "What do you think you should do about the last two months?" Forces self-assessment but delays the actionable guidance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Yes, your BasicMed online course has lapsed, which means your medical authorization hasn't been current. That means those flights were technically without valid medical authorization. Here's what to do: complete the online course today -- it takes about an hour. Once completed, your BasicMed is current again going forward. For the flights in the gap, I'd recommend you consult with an aviation attorney about whether to self-disclose. This is exactly why tracking your currency dates -- medical, flight review, BasicMed components -- matters. Let's add a currency tracking system to your plan." Honest assessment, immediate fix, professional guidance, systemic improvement. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "You're not legal. Complete the course today. Consider talking to an aviation attorney about the gap flights." Efficient and correct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +3          | -1       | +1     | +3        | +6    | terminal_safe |

## Author Notes

BasicMed (14 CFR Part 68) is one of the most significant regulatory changes in recent GA history, and it's a prime example of AC 61-83K Topic A.8 -- regulatory updates that CFIs must understand and teach correctly. This scenario exposes layered misconceptions that are extremely common in the real world: pilots who think BasicMed equals a third-class medical, who don't know the operating limitations, and who lose track of the dual-timeline currency requirements. The discovery in tick 4 that the pilot has been flying without valid medical authorization creates a real ethical and professional teaching moment. The scenario tests RC-4 (use current regulatory sources) because the CFI must know BasicMed rules cold, and PS-2 (build safety culture) because the response to the lapsed currency reveals whether the CFI treats compliance as a box-checking exercise or a genuine safety framework.
