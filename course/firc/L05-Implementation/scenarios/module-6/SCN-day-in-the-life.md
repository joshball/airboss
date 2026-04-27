---
status: done
phase: C1
type: scenario-script
---

# SCN 6.2: Branching "Day-in-the-Life" CFI Simulation

## Metadata

```
Scenario ID:     6.2
Title:           Branching Day-in-the-Life CFI Simulation
Module:          6
Difficulty:      0.8
Duration:        25 min
Pattern:         Integrated Capstone
```

## FAA Topic Tags

```
faaTopics: [FAA_TOPIC.A_6, FAA_TOPIC.A_10, FAA_TOPIC.A_4, FAA_TOPIC.A_2, FAA_TOPIC.A_3]
```

## Competency Links

```
competencies: ['CJ-1', 'CJ-2', 'RM-1', 'PS-1', 'OD-1', 'RC-1']
```

## Student Model

```
Student Model:   new -- Multiple students (varies by beat)
Parameters:
  skillLevel:         0.5
  compliance:         0.6
  freezeTendency:     0.3
  overconfidence:     0.5
  instrumentAccuracy: 0.5
  startleDelay:       0.3
  fatigue:            0.3
```

## Briefing

> It is a busy Thursday at a Part 61 flight school near a Class C airport. You have a full day: a morning solo supervision for a pre-solo student, a midday flight with an instrument student in the pattern, and an afternoon walk-in situation. Between flights, a colleague asks for your opinion on an ethical question. Each beat of the day requires a different skill set. Your decisions in the morning affect what's available in the afternoon.

## Tick Script

### Tick 1 -- Solo Supervision

```
id:           tick_1
scene:        7:30 AM. Your pre-solo student is conducting supervised solo in the pattern. You're watching from the ramp. Third circuit: the student lands long, floats past the touchdown zone, and begins a late go-around at the 2,000-foot marker on a 4,000-foot runway. The go-around is successful but the student doesn't announce it on CTAF.
studentSpeech:(Student on radio, after landing from go-around) That was... I went around. Sorry, I didn't call it on the radio. Am I doing OK?
studentState: degrading
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_2     | 0           | -1       | -1     | 0         | Student is solo and asking for reassurance. The communication failure needs addressing before the next circuit.                                                                                                                                                                             |
| prompt        | tick_2     | +1          | +1       | +1     | +1        | "Good go-around decision. But you need to announce go-arounds on CTAF. Other traffic needs to know. Make the call next time." Positive reinforcement of the decision, correction of the omission.                                                                                           |
| coach         | tick_2     | +1          | +1       | +1     | +1        | "Nice job recognizing the long landing and going around -- that was the right call. Two things for next time: announce the go-around on CTAF, and aim for the touchdown zone from the start. Set up the next approach a little slower. You're doing well." Complete, encouraging, specific. |
| direct        | tick_2     | +1          | 0        | +1     | +1        | "Announce go-arounds on CTAF. Fly the next one." Correct but the student needs encouragement during solo, not just corrections.                                                                                                                                                             |
| take_controls | tick_2     | -1          | -3       | -1     | -1        | Student is solo. You can't take controls via radio. The intervention options represent radio communication.                                                                                                                                                                                 |

### Tick 2 -- Ethical Question from Colleague

```
id:           tick_2
scene:        9:30 AM, between flights. A fellow instructor pulls you aside. They're troubled about something.
studentSpeech:(Colleague) Hey, can I ask you something? A student's father offered me $200 cash to sign off the student for solo even though I don't think the student is ready. I said no, but the father called the chief pilot and now the chief is asking me to "reconsider." What would you do?
studentState: degrading
safeWindow:   [coach, direct]
criticalWindow:[prompt]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_3     | 0           | -1       | -1     | 0         | Your colleague needs support and clarity, not more questions. They already made the right call. Validate it.                                                                                                                                                                                                                        |
| prompt        | tick_3     | +1          | 0        | 0      | 0         | Prompting to consider the regulatory and liability implications. They already know -- they need the moral support.                                                                                                                                                                                                                  |
| coach         | tick_3     | +1          | +1       | +1     | +1        | "You made the right call. Solo endorsement is your professional judgment, not the father's money or the chief's pressure. If the student isn't ready, signing them off puts them at risk. Document your decision and the reasons in writing. If the chief persists, that documentation protects you." Validates, advises, protects. |
| direct        | tick_3     | +1          | +1       | +1     | +1        | "Don't sign. Document why. If the chief pushes, escalate to the FSDO if needed. Your certificate, your call." Clear and firm.                                                                                                                                                                                                       |
| take_controls | tick_3     | -1          | -3       | -1     | -1        | Conversation.                                                                                                                                                                                                                                                                                                                       |

### Tick 3 -- Instrument Pattern Work

```
id:           tick_3
scene:        11 AM. Flying with your instrument student in the pattern at the Class C. Tower is busy. Your student is under the hood on a practice ILS. ATC: "[Callsign], traffic alert, VFR aircraft in your 2 o'clock, 500 feet below, not in contact." Your student can't see (under the hood). You look and spot a Cessna at 2 o'clock that appears to be climbing toward your altitude.
studentSpeech:(Student, under hood) I'm maintaining the glideslope. Did they say something about traffic? I can't see anything.
studentState: degrading
safeWindow:   [direct, take_controls]
criticalWindow:[coach]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ask           | tick_4        | -1          | -2       | -2     | -1        | VFR traffic is converging and your student is under the hood. This is a safety-of-flight moment.                                                                                           |
| prompt        | tick_4        | 0           | -1       | -1     | 0         | Prompting the student about traffic they can't see. You are the safety pilot. Act as one.                                                                                                  |
| coach         | tick_4        | +1          | 0        | 0      | 0         | Coaching while monitoring traffic. Barely adequate -- keep your eyes on the Cessna.                                                                                                        |
| direct        | terminal_safe | +1          | +1       | +1     | +1        | "I have the traffic. Continue the approach, I'm watching them. If they get closer, I'll tell you to break off." Appropriate -- you're the safety pilot, you handle the see-and-avoid duty. |
| take_controls | terminal_safe | +1          | +1       | +1     | +1        | Taking controls to maneuver away from the converging traffic. Justified if the traffic gets close enough.                                                                                  |

### Tick 4 -- Airspace Awareness

```
id:           tick_4
scene:        Post-approach, climbing back to pattern altitude. Your instrument student requests to do one more approach. ATC issues a TFR alert: temporary flight restriction going into effect in 30 minutes, 10 miles southwest of your position, for a VIP movement. Your student hasn't heard the NOTAM.
studentSpeech:One more approach? I think I'm getting the hang of the glideslope. Can we stay in the pattern for another 30 minutes?
studentState: nominal
safeWindow:   [prompt, coach]
criticalWindow:[ask]
```

**Consequences:**

| Intervention  | nextTickId | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------- | ----------- | -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | tick_5     | 0           | -1       | -1     | 0         | TFR is going active. Factor it into the plan, don't quiz the student about it.                                                                                                                                                                                                                                                              |
| prompt        | tick_5     | +1          | +1       | +1     | +1        | "Did you hear the TFR alert? It's going active 10 miles southwest in 30 minutes. Let's verify our pattern keeps us clear and decide if we have time for one more." Teaches situational awareness of airspace restrictions.                                                                                                                  |
| coach         | tick_5     | +1          | +1       | +1     | +1        | "Good approach -- we can do one more. But first: ATC just announced a TFR going active. Even though it's 10 miles away, we need to know the boundaries and make sure our pattern doesn't conflict. This is part of instrument flying too -- knowing what's happening around you." Integrates airspace awareness into the instrument lesson. |
| direct        | tick_5     | +1          | 0        | 0      | +1        | "One more approach, but the TFR means we need to check our position carefully. Let's verify clearance." Appropriate but less instructional.                                                                                                                                                                                                 |
| take_controls | tick_5     | 0           | -2       | 0      | 0         | Pattern flying, no immediate TFR conflict.                                                                                                                                                                                                                                                                                                  |

### Tick 5 -- Afternoon Walk-In

```
id:           tick_5
scene:        2 PM. You've returned from the flight. A person is waiting at the desk -- the walk-in from the morning finally got to talk to you. They want to start training but they're on a tight timeline: they need a pilot certificate in 6 weeks for a new job that requires travel to remote sites.
studentSpeech:I need to learn to fly in six weeks. My company will pay for everything. I fly out for a job site visit next month and having a pilot certificate would be a huge advantage. Can you get me there?
studentState: nominal
safeWindow:   [ask, prompt]
criticalWindow:[]
```

**Consequences:**

| Intervention  | nextTickId    | recognition | judgment | timing | execution | Annotation                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------- | ----------- | -------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ask           | terminal_safe | +1          | +1       | +1     | 0         | "What kind of flying does your job require? And have you flown before?" Assesses the actual need before committing to a timeline.                                                                                                                                                                                                                                                                          |
| prompt        | terminal_safe | +1          | +1       | +1     | 0         | Prompting to discuss what's realistic in 6 weeks versus what the job actually needs. Maybe a sport pilot or private pilot ground school start is achievable.                                                                                                                                                                                                                                               |
| coach         | terminal_safe | +1          | +1       | +1     | +1        | "Let's separate the need from the timeline. A private pilot certificate in 6 weeks is possible but extremely aggressive. What does the job actually require? If it's flying to remote sites, you may need more than a private certificate. Let's build a realistic plan -- maybe start with ground school and a discovery flight, then see if the timeline works." Honest, thorough, manages expectations. |
| direct        | terminal_safe | +1          | 0        | +1     | +1        | "Six weeks for a private certificate is very tight. Let's talk about what's achievable and what your job actually needs." Sets expectations.                                                                                                                                                                                                                                                               |
| take_controls | terminal_safe | -1          | -3       | -1     | -1        | Desk conversation.                                                                                                                                                                                                                                                                                                                                                                                         |

## Tick Graph

```
tick_1 -> tick_2 -> tick_3 -> tick_4 -> tick_5 -> terminal_safe
                         \-> terminal_safe (direct/take_controls)
```

## Score Summary

| Path                                                      | recognition | judgment | timing | execution | Total | Outcome       |
| --------------------------------------------------------- | ----------- | -------- | ------ | --------- | ----- | ------------- |
| Optimal (coach -> coach -> direct -> coach -> coach)      | +5          | +5       | +5     | +5        | +20   | terminal_safe |
| Adequate (prompt -> direct -> direct -> prompt -> prompt) | +5          | +3       | +3     | +3        | +14   | terminal_safe |
| Poor (ask -> ask -> ask -> ask -> ask)                    | 0           | -5       | -5     | -1        | -11   | terminal_safe |

## Author Notes

The most complex branching scenario in the course. Five beats, each from a different domain: flight safety supervision (OD-1/CJ-2), ethics and professionalism (PS-1/RM-3), instrument flight safety (CJ-2/AC), airspace awareness (OD-3), and student management (CJ-1/PS-1). The scenario tests the CFI's ability to switch modes rapidly -- from encouraging a solo student, to supporting a colleague's ethical stand, to being a safety pilot, to managing airspace, to counseling a prospective student. The thread connecting all beats is professional judgment under time pressure. Every beat has a "right" answer that some CFIs will miss because they're in the wrong mode. The ethical question from the colleague in tick 2 is the most important beat: it tests whether the FIRC participant will support a colleague who made the right call under pressure, which is the foundation of safety culture (PS-1). The TFR in tick 4 integrates Module 4 airspace content into an instrument lesson context, which is how it appears in real life.
