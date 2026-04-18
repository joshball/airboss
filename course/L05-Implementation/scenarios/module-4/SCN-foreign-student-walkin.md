---
status: done
phase: C1
type: scenario-script
---

# SCN 4.4: Non-US Prospective Student Walk-In

## Metadata

```
Scenario ID:     4.4
Title:           Non-US Prospective Student Walk-In
Module:          4
Difficulty:      0.4
Duration:        10 min
Pattern:         Multi-Beat Admin
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_3]
```

## Competency Links

```
competencies: ['RC-1', 'RC-2']
```

## Student Model

```
Student Model:   new -- Prospective Foreign Student
Parameters:
  skillLevel:         0.0
  compliance:         0.9
  freezeTendency:     0.1
  overconfidence:     0.2
  instrumentAccuracy: 0.0
  startleDelay:       0.2
  fatigue:            0.1
```

## Briefing

> A person walks into your flight school and says they want to start flight training. During the initial conversation, they mention they are in the United States on a student visa from a foreign country. They have a valid passport, their I-20 form, and are eager to begin. They ask if they can start ground school today and fly this week.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO front desk. A well-dressed young person with a foreign passport and university paperwork approaches you. They are polite and enthusiastic.
studentSpeech:Hello, I am a university student here. I would like to learn to fly. I brought my passport and university documents. Can I start today?
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "What is your citizenship? Are you a US citizen or permanent resident?" The first and most critical question for TSA determination. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to verify citizenship status before any discussion of training. Proper first step.                                        |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on TSA requirements before determining if they apply. Find out citizenship status first.                                   |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing them to fill out paperwork before determining if TSA process is needed. Could start the wrong process.                    |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Desk conversation.                                                                                                                  |

### Tick 2

```
id:           tick_2
scene:        The prospective student confirms they are not a US citizen or permanent resident. They are a foreign national on an F-1 student visa. They pull out their passport and I-20 form.
studentSpeech:I am from [country]. I have an F-1 visa. My university counselor said I need to get approved for flight training. Do you know what I need to do?
studentState: nominal
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                        |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | You've confirmed they're a foreign national. They need the TSA AFSP process. Explain it, don't test them on it.                                                                                                                   |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting about TSA requirements. Correct direction but the prospective student needs clear guidance, not hints.                                                                                                                  |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "Since you're not a US citizen, TSA requires you to go through the Alien Flight Student Program before any flight training can begin. This is a federal requirement. Let me explain what's involved." Clear, welcoming, accurate. |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "Before we can begin any flight training, you need TSA approval through the AFSP. No flight instruction can happen until TSA clears you. Here's what you need to do." Sets the boundary clearly.                                  |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                     |

### Tick 3

```
id:           tick_3
scene:        Prospective student nods, understanding. Asks about the process timeline. Then asks if they can at least sit in on ground school or use the simulator while waiting for TSA approval.
studentSpeech:How long does the approval take? Can I do ground school while I wait? Or use the flight simulator? I don't want to waste time.
studentState: nominal
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4     | 0           | -1       | 0      | 0         | They asked a specific question. Answer it -- the nuances of what counts as "flight training" under TSA rules.                                                                                                                                                                                                                               |
| prompt        | tick_4     | +1          | +1       | 0      | 0         | Prompting to consider what qualifies as "flight training" under TSA definitions. Good but they need the answer.                                                                                                                                                                                                                             |
| coach         | tick_4     | +1          | +1       | +1     | +1        | "Ground school is generally not restricted by TSA -- it's not flight training. But any time in an aircraft, including a simulator that qualifies as an FTD, may be restricted. The safe answer is: ground school yes, anything with controls no, until TSA clears you. Approval typically takes 2-4 weeks." Precise, helpful, conservative. |
| direct        | tick_4     | +1          | 0        | 0      | +1        | "Ground school is fine. No flight training or simulator time until TSA approval comes through." Clear but misses the nuance about FTD vs BATD.                                                                                                                                                                                              |
| take_controls | tick_4     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                               |

### Tick 4

```
id:           tick_4
scene:        Prospective student asks about what documents they need to provide and what happens with their information. They're concerned about privacy and want to know if the school keeps copies of their passport.
studentSpeech:What documents do I need to give you? Do you keep copies of my passport? My university counselor told me to be careful about who has my documents.
studentState: nominal
safeWindow:   [coach, direct]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | 0           | 0        | 0      | 0         | Legitimate question from the student. Answer it professionally.                                                                                                                                                                                                                                                                                                                             |
| prompt        | terminal_safe | +1          | 0        | 0      | 0         | Prompting about recordkeeping requirements. Student deserves a direct answer.                                                                                                                                                                                                                                                                                                               |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "TSA requires us to verify your identity, photograph you, and submit fingerprints through the AFSP system. We'll keep copies as required by TSA recordkeeping rules -- 5 years minimum. Your counselor is right to be careful, and we handle this information securely. I'll give you the full requirements list so you know exactly what to bring." Professional, transparent, respectful. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Here's the document list: valid passport, visa, I-20, two forms of ID, and you'll need to provide fingerprints. We keep records per TSA requirements." Efficient and accurate.                                                                                                                                                                                                             |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                                                                               |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_safe
```

## Score Summary

| Path                                         | recognition | judgment | timing | execution | Total | Outcome       |
| -------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> coach -> coach)     | +4          | +4       | +4     | +3        | +15   | terminal_safe |
| Adequate (ask -> direct -> direct -> direct) | +3          | +1       | +2     | +3        | +9    | terminal_safe |
| Poor (coach -> ask -> ask -> ask)            | +1          | -2       | 0      | 0         | -1    | terminal_safe |

## Author Notes

The template-setter for TSA scenarios. This is the straightforward case: a foreign national walks in, you identify the TSA requirement, you explain the AFSP process, and you handle the documentation questions professionally. Every path reaches terminal_safe because this is an administrative scenario -- the "unsafe" would be starting training without TSA clearance, which only happens if the CFI doesn't ask about citizenship (which would require skipping tick 1). The scenario tests RC-1 (can training legally begin -- no, not until TSA clears them) and RC-2 (recordkeeping requirements). The ground school nuance in tick 3 is important: TSA restrictions apply to flight training, not ground instruction, but the boundaries are sometimes unclear with FTD/simulator time. The 5-year retention requirement for TSA records (per 49 CFR 1552) differs from the general 24-month FAA retention -- the CFI should know both. The prospective student's concern about document privacy in tick 4 is realistic and should be handled with respect, not dismissal.
