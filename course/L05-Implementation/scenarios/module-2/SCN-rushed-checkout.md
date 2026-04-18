---
status: done
phase: C1
type: scenario-script
---

# SCN 2.4: Complex Aircraft Checkout Appointment

## Metadata

```
Scenario ID:     2.4
Title:           Complex Aircraft Checkout Appointment
Module:          2
Difficulty:      0.5
Duration:        10 min
Pattern:         Pressure Decision
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_4, FAA_TOPIC.A_10]
```

## Competency Links

```
competencies: ['PS-1', 'RM-3', 'CJ-2']
```

## Student Model

```
Student Model:   Pressure-Susceptible
Parameters:
  skillLevel:         0.5
  compliance:         0.8
  freezeTendency:     0.5
  overconfidence:     0.3
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.4
```

## Briefing

> A certificated private pilot with 180 hours is at your school for a complex aircraft checkout in the Piper Arrow. The pilot has a trip planned for tomorrow morning. The weather is marginal VFR and deteriorating, and you have about 90 minutes of daylight remaining. You are meeting the pilot for the first time.

## Tick Script

### Tick 1

```
id:           tick_1
scene:        FBO planning room. The pilot arrives in a rush, flight bag over shoulder, keys to the rental car already returned. Chief pilot's text on your phone reads: "This guy books 20 hours a month. Make it happen."
studentSpeech:Hey, I'm in a bit of a hurry. I've got 300 hours and I fly a Bonanza back home -- this Arrow should be a piece of cake. Can we skip the ground stuff and just go fly?
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                         |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | +1          | +1       | +1     | 0         | "When was your last flight in a complex airplane?" Good diagnostic -- tests whether the confidence has basis.                      |
| prompt        | tick_2     | +1          | +1       | +1     | 0         | Prompting to review the checkout requirements. "Our checkout has specific items we need to cover." Sets the professional boundary. |
| coach         | tick_2     | +1          | 0        | 0      | 0         | Coaching the process is fine but the pilot hasn't shown a gap yet. Start with assessment, not instruction.                         |
| direct        | tick_2     | 0           | -1       | 0      | 0         | Directing to sit down for ground school. Correct but tone-deaf to the customer dynamic. Better to establish why first.             |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Planning room. No aircraft.                                                                                                        |

### Tick 2

```
id:           tick_2
scene:        Pilot reveals he hasn't flown complex in 6 months. Bonanza was sold, hence the checkout here. Weather is MVFR with a 2,500-foot ceiling and 5-mile visibility. Sun sets in 80 minutes.
studentSpeech:Look, I've been flying for 10 years. I know retractable gear. Can we just do a couple laps around the pattern and sign me off? I really need this for tomorrow.
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                              |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | The pilot is pushing for shortcuts. Questions feel like stalling. Set the standard clearly.                                                                                                             |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to consider the weather and currency is accurate but doesn't directly address the pressure to cut corners.                                                                                    |
| coach         | tick_3     | +1          | +1       | +1     | +1        | Coaching the reality: "I understand the time pressure. Here's what I can do responsibly today given the weather and daylight. If we can't finish safely, we pick up tomorrow." Professional and honest. |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "Our checkout requires ground review, normal ops, and emergency procedures. I can't skip any of those. Let's see what we can cover in the time we have." Clear standard-setting.                        |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Planning room.                                                                                                                                                                                          |

### Tick 3

```
id:           tick_3
scene:        Pilot's phone rings. He glances at it -- it's the person he's flying with tomorrow. He silences it but his jaw tightens. Chief pilot walks through the FBO and gives you a thumbs-up and a pointed look.
studentSpeech:Come on, I've done checkouts at other schools in 30 minutes. Your chief said this would be quick. What's the holdup?
studentState: degrading
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                             |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4        | -1          | -1       | -1     | 0         | Pressure is escalating. Questions feel like weakness. The pilot and the chief are both pushing. Stand your ground.                                                                                     |
| prompt        | tick_4        | 0           | 0        | 0      | 0         | Prompting to review the situation is accurate but the pilot isn't interested in reasoning. He wants a decision.                                                                                        |
| coach         | tick_4        | +1          | +1       | 0      | 0         | Coaching can work but the pressure is social, not technical. The pilot knows the procedures -- he wants you to bend.                                                                                   |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "I understand the pressure, and I'm not trying to make this difficult. But my name goes on this signoff. We do the full checkout or we don't go today." Professional boundary. Not rude, not flexible. |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | There is no aircraft to take controls of.                                                                                                                                                              |

### Tick 4

```
id:           tick_4
scene:        Pilot stands up, visibly frustrated. Pulls out his phone and starts texting. Weather has dropped to IFR at a nearby field. Daylight is now 60 minutes.
studentSpeech:Fine. I'll just call another school. Or maybe I'll talk to your chief about this. This is ridiculous.
studentState: critical
safeWindow:   [direct]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId      | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                     |
| ------------- | --------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | terminal_unsafe | -1          | -2       | -1     | -1        | The pilot is threatening to go elsewhere. If you waver, someone may sign off an unprepared pilot in deteriorating weather.                                                                                                     |
| prompt        | terminal_unsafe | 0           | -1       | 0      | -1        | Prompting at this point feels like you're negotiating your standards. Hold firm.                                                                                                                                               |
| coach         | terminal_safe   | +1          | 0        | 0      | 0         | Coaching the situation: "I'd rather lose a customer than put someone in a situation I'm not comfortable with." True but the battle is already drawn.                                                                           |
| direct        | terminal_safe   | +1          | +1       | +1     | +1        | "You're welcome to call another school. My recommendation is that we start the ground review now and fly when conditions allow -- even if that's tomorrow. My job is to make sure you're safe, not fast." Professional. Final. |
| take_controls | terminal_safe   | -1          | -3       | -1     | -1        | No aircraft.                                                                                                                                                                                                                   |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> terminal_unsafe (ask/prompt)
                        \         \-> terminal_safe (coach/direct)
                         \-> terminal_safe (direct)
```

## Score Summary

| Path                                                | recognition | judgment | timing | execution | Total | Outcome         |
| --------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | --------------- |
| Optimal (ask -> coach -> direct)                    | +3          | +3       | +3     | +2        | +11   | terminal_safe   |
| Good but slow (prompt -> prompt -> coach -> direct) | +2          | 0        | 0      | +1        | +3    | terminal_safe   |
| Worst case (ask -> ask -> ask -> ask)               | -1          | -3       | -2     | -1        | -7    | terminal_unsafe |

## Author Notes

This is the first Pressure Decision scenario in M2. There is no in-flight emergency -- the danger is entirely professional and ethical. The pressure comes from three directions simultaneously: the pilot (schedule), the chief pilot (revenue), and the environment (weather and daylight). The terminal_unsafe outcome represents signing off an unprepared pilot who then flies in deteriorating weather -- not a crash in this scenario, but a bad decision with real consequences. The Pressure-Susceptible student model isn't really the "student" here -- it models the CFI's own susceptibility to pressure. The scenario tests PS-1 (professionalism) and RM-3 (ethical responsibility) by creating a situation where the right answer is unpopular with everyone. The optimal path diagnoses first (tick 1), sets boundaries with rationale (tick 2), then holds firm when challenged (tick 3). The key insight for learners: your name is on the signoff. Chief pilots come and go. Customers move on. But if something happens, the FAA looks at who signed the endorsement.
