---
status: done
phase: C1
type: scenario-script
---

# SCN 6.5: Final "Checkride" Scenario

## Metadata

```
Scenario ID:     6.5
Title:           Final Checkride Scenario
Module:          6
Difficulty:      0.8
Duration:        25 min
Pattern:         Integrated Capstone
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_11, FAA_TOPIC.A_5, FAA_TOPIC.A_4, FAA_TOPIC.A_6, FAA_TOPIC.A_10, FAA_TOPIC.A_1, FAA_TOPIC.A_9]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-2', 'CJ-3', 'AC-1', 'AC-2', 'RM-1', 'RM-2', 'RM-3', 'AV-1', 'PS-1', 'PS-2', 'ES-1', 'OD-1']
```

## Student Model

```
Student Model:   new -- Composite (multiple archetypes)
Parameters:
  skillLevel:         0.5
  compliance:         0.6
  freezeTendency:     0.4
  overconfidence:     0.5
  instrumentAccuracy: 0.4
  startleDelay:       0.4
  fatigue:            0.4
```

## Briefing

> This is your final evaluation scenario. You will face a sequence of challenges that draw from every module in the course. Each challenge will require a different competency. Your responses will be evaluated across all four dimensions: recognition, judgment, timing, and execution. There is no single "right" path -- the challenge is to apply the principles you've learned to situations that are realistic, ambiguous, and time-pressured. Treat this as a representative hour in a CFI's professional life.

## Tick Script

### Tick 1 -- Pre-Flight Risk Assessment

```
id:           tick_1
scene:        Morning preflight briefing with a new student. The student is a 50-year-old professional returning to flying after a 10-year break. Weather is VFR but winds are 12 gusting 20. The student seems eager but you notice their hand shakes slightly when they hold the checklist. Their medical was just renewed.
studentSpeech:I'm excited to get started again. I used to fly a lot -- Cessna 182, some twin time. I know I'll be rusty but I'm sure it'll come back fast. Let's get up there!
studentState: nominal
safeWindow:   [ask]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                             |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "How are you feeling about the gusty conditions today? Any concerns about your first flight in 10 years?" Assesses fitness and sets the tone for honest communication. |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to review the IMSAFE checklist together. Models good ADM from the first flight.                                                                              |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching on expectations for the first flight back. Good but assess the student first.                                                                                 |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing to start the lesson without assessing the student's physical and mental state. The shaking hand and the 10-year break are risk factors.                      |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Pre-flight briefing.                                                                                                                                                   |

### Tick 2 -- In-Flight Automation Decision

```
id:           tick_2
scene:        Airborne, 3,000 feet. Student is flying a G1000 Cessna 172. You asked for a turn to a nearby practice area. Student immediately reaches for the autopilot heading bug instead of hand-flying. You notice the student's last aircraft was a steam-gauge 182 -- they're reaching for automation they've never used.
studentSpeech:Let me just set the heading bug here... how does this thing work again? My old 182 didn't have any of this.
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                     |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Student is confused by unfamiliar avionics in flight. Help them, don't test them.                                                                                                                                                                                                              |
| prompt        | tick_3     | +1          | +1       | +1     | +1        | "Let's hand-fly for now. You know how to make a turn -- use the instruments you're comfortable with. We'll learn the G1000 on the ground later." Prioritizes flying over automation.                                                                                                           |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "The G1000 is powerful but it's new to you. Rule one: fly the airplane first, learn the automation second. Hand-fly the turn, keep your scan going. We'll introduce the automation features one at a time in ground sessions." Establishes the AV-1 principle (automation without dependency). |
| direct        | tick_3     | +1          | 0        | 0      | +1        | "Hands off the panel. Fly the turn by hand. We'll cover the G1000 later." Gets the right result without the teaching.                                                                                                                                                                          |
| take_controls | tick_3     | 0           | -2       | 0      | 0         | Student is in a gentle turn at altitude. No safety issue.                                                                                                                                                                                                                                      |

### Tick 3 -- LOC Recognition

```
id:           tick_3
scene:        Practicing slow flight. Student is managing well, but on the recovery, they add power without lowering the nose first. The airplane pitches up further, airspeed drops. The student tightens their grip on the yoke and pulls back slightly -- instinctive but wrong.
studentSpeech:Power is in... why is the nose going up? I'm pulling back to keep the nose up but the airspeed is going down...
studentState: critical
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                            |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_4        | -1          | -2       | -2     | -1        | Student is in a developing stall from misapplied recovery. Do not ask questions.                                      |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting in a developing stall. Student is reverting to instinct, not processing prompts.                            |
| coach         | tick_4        | +1          | 0        | 0      | 0         | "Push the nose down. Power is fine but you need to lower the pitch first." Coaching barely adequate at this point.    |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Nose DOWN. Release back pressure. Power is set -- just lower the nose." Clear, immediate, correct. Student recovers. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls for stall recovery. Justified -- student was pulling back into a developing stall.                    |

### Tick 4 -- Ethical Pressure + Evaluation

```
id:           tick_4
scene:        Post-flight. Student is drained but happy. They ask when they can solo. The student's wife is in the lobby -- she booked a trip for their anniversary in 6 weeks and assumes the student will be able to fly them there. The student has 3 hours in the airplane and barely recovered from a developing stall an hour ago.
studentSpeech:My wife has us booked for a fly-in to the coast for our anniversary. That's six weeks from now. I should be able to do that by then, right? She's really excited about it.
studentState: degrading
safeWindow:   [coach]
criticalWindow:[prompt, direct]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | 0           | -1       | 0      | 0         | The student needs honest expectation-setting, not more questions. The trip timeline is unrealistic and potentially dangerous.                                                                                                                                                                                                                                                                                               |
| prompt        | tick_5     | +1          | 0        | 0      | 0         | Prompting to think about what's needed between now and that trip. Good but the truth needs to come first.                                                                                                                                                                                                                                                                                                                   |
| coach         | tick_5     | +1          | +1       | +1     | +1        | "I'm glad you're enthusiastic. Let's be honest about the timeline: you have 3 hours and we just worked through a stall recovery. Solo is probably 4-6 flights away. A cross-country with a passenger is months, not weeks. I don't want to set an expectation that pushes you faster than is safe. Let's set achievable milestones and your wife can join you when you're ready -- not before." Honest, kind, professional. |
| direct        | tick_5     | +1          | 0        | 0      | +1        | "Six weeks is not realistic for passenger cross-country. We'll build a timeline together." Honest but blunt.                                                                                                                                                                                                                                                                                                                |
| take_controls | tick_5     | -1          | -3       | -1     | -1        | Post-flight debrief.                                                                                                                                                                                                                                                                                                                                                                                                        |

### Tick 5 -- Debrief and Forward Plan

```
id:           tick_5
scene:        Student absorbs the honest assessment. Initial disappointment shifts to understanding. They ask for a realistic plan. The wife is in earshot.
studentSpeech:OK. I appreciate your honesty. What's a realistic plan? And can you explain it so my wife understands too? She's going to be disappointed about the anniversary trip.
studentState: recovered
safeWindow:   [coach]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | 0        | 0      | 0         | "What are your goals beyond the trip?" Good for long-term planning.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| prompt        | terminal_safe | +1          | +1       | 0      | 0         | Prompting to outline milestones: solo, solo XC, passenger currency.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Here's the realistic timeline: 2-3 months to solo, 4-5 months to cross-country, then passenger checkout. I'd plan the fly-in trip for fall -- you'll be ready and confident by then. And ma'am" (to the wife) "his enthusiasm is great. My job is to make sure he builds the skills safely so you can enjoy many flights together, not just one. The coast will be there in the fall." Professional, includes the family, reframes the timeline as responsible, not disappointing. |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "Solo in 2-3 months. Cross-country in 4-5. Plan the trip for fall." Clear milestones.                                                                                                                                                                                                                                                                                                                                                                                               |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Debrief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
                         \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                                      | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (ask -> coach -> direct -> coach -> coach)        | +5          | +5       | +5     | +4        | +19   | terminal_safe |
| Adequate (prompt -> prompt -> direct -> prompt -> prompt) | +5          | +3       | +3     | +2        | +13   | terminal_safe |
| Poor (direct -> ask -> ask -> ask -> ask)                 | 0           | -5       | -3     | 0         | -8    | terminal_safe |

## Author Notes

The final evaluation scenario. Five beats spanning the full competency range: risk assessment (RM-1), automation management (AV-1), LOC intervention (AC-1/AC-2), ethical pressure (PS-1/RM-3), and professional communication (CJ-3/PS-2). Each beat is drawn from a different module's content, proving that the learner can apply all the course concepts in a single continuous session. The scenario is deliberately realistic: a returning pilot with enthusiasm that outstrips ability, equipment they don't know, a developing stall, and family pressure on the timeline. The wife in the lobby is the Module 2 pressure scenario in a different form -- the CFI must be honest about the timeline while being sensitive to the family dynamic. Tick 5's coaching response that addresses both the student and the wife is the capstone moment: it shows the CFI operating as a professional who can communicate safety to non-pilots, which is what mature professionalism looks like. This scenario should be the hardest in the course -- not because any single beat is more difficult than Module 3's LOC scenarios, but because the learner must switch between competencies every 3-4 minutes.
