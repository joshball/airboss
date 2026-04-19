---
status: done
phase: C1
type: scenario-script
---

# SCN 4.11: Remote Pilot Certificate Renewal Pathway

## Metadata

```
Scenario ID:     4.11
Title:           Remote Pilot Certificate Renewal Pathway
Module:          4
Difficulty:      0.4
Duration:        15 min
Pattern:         Multi-Beat Admin
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_13]
```

## Competency Links

```
competencies: ['RC-3', 'RC-4']
```

## Student Model

```
Student Model:   new -- Part 107 Remote Pilot
Parameters:
  skillLevel:         0.3
  compliance:         0.6
  freezeTendency:     0.1
  overconfidence:     0.6
  instrumentAccuracy: 0.0
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A Part 107 remote pilot certificate holder comes to you with questions about recurrency. Their certificate is approaching the 24-month recurrent training deadline. They also hold a current private pilot certificate. They have been flying drones commercially for a year. This is a ground-based instructional scenario.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO lobby. The remote pilot approaches you because they heard you can "sign them off" for their Part 107 renewal. They have their remote pilot certificate and private pilot certificate.
studentSpeech:Hey, I need my Part 107 renewed. My buddy said a flight instructor can just sign me off and I'm good for another two years. I've got my private pilot cert too, so I figured it would be quick. Can we do this today?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                             |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "Tell me about how you initially got your Part 107 certificate. Did you take the knowledge test or use the Part 61 pilot pathway?" Understanding their initial pathway determines the recurrency path. |
| prompt        | tick_2     | +1          | 0        | 0      | 0         | "Let's look at what 'renewal' actually means for Part 107. It's not exactly what your buddy described." Begins correcting the misconception.                                                           |
| coach         | tick_2     | +1          | 0        | 0      | +1        | Explaining the recurrency process before understanding their specific situation. They might have taken different initial pathways.                                                                     |
| direct        | tick_2     | 0           | -1       | 0      | 0         | "That's not how it works. I can't sign off a Part 107 renewal." Partially correct but depends on the pathway.                                                                                          |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Lobby conversation.                                                                                                                                                                                    |

### Tick 2

```
id:           tick_2
scene:        Remote pilot explains they initially took the full Part 107 knowledge test. They've been flying commercially for mapping and inspection work.
studentSpeech:I took the full Part 107 test at the testing center two years ago. Got an 88. Now I need to do something before it expires, right? And since I also have a private pilot certificate, does that make it easier? I don't want to take another test if I don't have to.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You have enough information to explain the recurrency options. Don't keep probing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | "Look up 14 CFR 107.65 on your phone and let's read through the recurrency options together." Hands-on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Good news -- you have options. For Part 107 recurrent certification, you need to complete recurrent training or testing every 24 calendar months. Since you also hold a Part 61 certificate, you have two paths: you can take the recurrent knowledge test (shorter than the initial test), or you can complete the FAA's free online recurrent training course at FAASafety.gov. The online course is the path most Part 61 pilots use -- it takes about an hour and covers the updates since your last certification. Once completed, you update your records through IACRA. A flight instructor sign-off is not part of this process -- your buddy was misinformed." Clear options, corrects the misconception, actionable. |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "Online recurrent training course at FAASafety.gov. Free. About an hour. Update through IACRA." The facts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Tick 3

```
id:           tick_3
scene:        Remote pilot is surprised about the online course option. Asks about the differences between Part 107 and Part 61 privileges and whether their private certificate gives them additional drone authority.
studentSpeech:Wait, so I can just do it online? That's easy. One more question -- since I have a private pilot certificate, can I fly drones in controlled airspace without a LAANC authorization? I heard that manned aircraft pilots have more privileges.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | 0        | -1     | 0         | Direct question with a dangerous misconception. Correct it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| prompt        | tick_4     | +1          | 0        | 0      | 0         | "What does Part 107 say about airspace authorization?" Gets them to look it up.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "No -- your private pilot certificate gives you no additional privileges for Part 107 operations. Part 107 and Part 61 are separate regulatory frameworks. For drone operations in controlled airspace, you must have airspace authorization regardless of what manned aircraft certificates you hold. LAANC is the primary system for near-real-time authorization in controlled airspace, and DroneZone is the manual process for areas without LAANC coverage. Flying a drone in controlled airspace without authorization is an airspace violation -- same as a manned aircraft without a clearance. Your private certificate means you understand airspace, which is an advantage, but it doesn't bypass the authorization requirement." Critical safety correction, regulatory basis, practical guidance. |
| direct        | tick_4     | +1          | +1       | 0      | +1        | "No. Part 107 airspace rules apply regardless of your manned certificates. LAANC authorization is always required in controlled airspace." Correct and direct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Tick 4

```
id:           tick_4
scene:        Remote pilot absorbs the airspace correction. Asks about their responsibilities as a commercial drone operator that they might not be aware of.
studentSpeech:OK, I definitely don't want a violation. Is there anything else I should know? I've been doing this commercially for a year and I want to make sure I'm not missing something obvious.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | "Have you reported any incidents or accidents with your drone operations?" Important compliance question.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | "Pull up Part 107 Subpart D -- Waivers. Are you operating under any conditions that might require one?" Good self-audit prompt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "A few things to verify: First, accident reporting -- any crash causing serious injury or property damage over $500 must be reported to the FAA within 10 days per 107.9. Second, make sure you're maintaining your remote pilot logbook or records. Third, review the standard Part 107 limitations -- operations over people, night operations, and beyond visual line of sight all have specific rules that have been updated since the original rule. The December 2020 final rule added categories for operations over people and night operations. Make sure your commercial operations comply with the current rules, not just the rules from when you tested. This ties back to what we discussed -- staying current with regulatory changes is an ongoing obligation." Comprehensive compliance check, connects to regulatory currency theme. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Check accident reporting requirements (107.9), operations over people rules (updated 2020), and night operations rules. Keep records." Actionable items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                            | recognition | judgment | timing | execution | Total | Outcome       |
| ----------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)        | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (prompt -> prompt -> prompt -> prompt) | +4          | +1       | +1     | 0         | +6    | terminal_safe |
| Poor (direct -> direct -> direct -> direct)     | +1          | 0        | +1     | +2        | +4    | terminal_safe |

## Author Notes

This scenario tests the CFI's knowledge of Part 107 remote pilot certification -- specifically the recurrency process (107.65), the interaction between Part 61 and Part 107 privileges, and commercial drone operating requirements. The tick 3 airspace misconception is common and dangerous: many Part 61 pilots who add Part 107 assume their manned aircraft knowledge grants additional UAS privileges. The scenario also reinforces AC 61-83K Topic A.8 (regulatory updates) through the tick 4 discussion of rules that have changed since the original Part 107 implementation (operations over people, night operations). This pairs with SCN 4.9 (Remote Pilot Applicant with Issue) but covers the ongoing compliance side rather than initial certification.
