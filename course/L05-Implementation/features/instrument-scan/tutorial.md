# Instrument Scan Tutorial

A guided walkthrough that teaches the panel mode UI before the learner encounters their first real scan exercise. Not scored. Not a test. The system walks them through a scenario step by step, showing what each control does and what good responses look like. Then they replay it unguided.

**Placement:** Before ISE-1.1. First thing in the course after account setup.
**Duration:** ~5 min guided + ~3 min replay
**Tone:** "Here's how this works. We'll walk through it together."

---

## Design Philosophy

The tutorial must accomplish three things:

1. **Teach the UI** -- note keys, intervention ladder, activity log
2. **Teach the escalation model** -- ask before you coach, coach before you direct, direct before you take controls
3. **Teach that take-controls is not failure** -- it's the right call when safety demands it

The scenario is deliberately obvious. Nobody should miss anything here. The point is mechanical fluency with the controls so that when ISE-1.1 arrives 3 minutes later, the learner is thinking about the instruments, not the UI.

---

## The Scenario: Wrong-Way Turn

**Setup:** VFR cruise at 5,000 ft, heading 040. Approach control has just told your student to turn left to heading 180. The student starts turning right.

This is a simple, clear, escalating situation that every CFI has seen. The "right" answers are obvious. That's the point -- we're teaching the tools, not testing judgment.

### Phase 1: The Wrong Turn

**What the instruments show:**

- Heading: 040, starting to increase (student turning right)
- Bank: 15 degrees right
- Altitude: 5,000, stable
- Airspeed: 110, stable

**System pauses and highlights the heading indicator:**

> Your student was told to turn LEFT to 180. They're turning RIGHT.
>
> This is the kind of thing you'll need to catch in this course. Let's walk through your options.
>
> The action bar at the bottom shows your intervention ladder:
>
> **[A] Ask** -- a diagnostic question. Use this when you're not sure what the student is thinking, or when there's time to let them self-correct.
>
> **[P] Prompt** -- draw their attention to something. Use this when you know the issue but want them to find it.
>
> **[C] Coach** -- give specific guidance. Use this when they need direction but can still execute.
>
> **[D] Direct** -- tell them exactly what to do. Use this when there's less time or the student isn't responding to softer interventions.
>
> **[T] Take Controls** -- you fly. Use this when safety requires immediate action.
>
> Right now, there's time. The student is turning the wrong way but the situation isn't dangerous yet. What's the least invasive effective intervention?
>
> **Try pressing [A] to ask your student a question.**

**Learner presses A:**

> The system shows a quick-pick:
>
> - "Which direction did ATC say to turn?"
> - "What heading are we going to?"
> - "Tell me about the turn you're making."
>
> **Pick any of these.** They all work. You're getting the student to think.

**Student response (after learner picks):**

> Student: "Oh -- they said 180... and I'm turning... wait, I'm going the wrong way, aren't I?"
>
> The student rolls wings level and begins turning left.

**System note:**

> That worked. An Ask was enough because:
>
> - There was time (no immediate safety concern)
> - The student had the knowledge (they knew the heading)
> - They just needed a prompt to self-correct
>
> Notice your activity log on the right -- it recorded your action and the student's response. This log builds throughout every exercise.
>
> **Now note the heading indicator by pressing [5].** This marks that you're tracking heading.

**Learner presses 5:**

> A timestamped entry appears in the activity log: "Noted: HI"
>
> Note keys (1-6) let you tag which instruments you're watching. No interruption, no prompt. Just a tap. The system uses these to understand your scan pattern.

---

### Phase 2: Altitude Loss in the Turn

**What the instruments show:**

- Heading: rolling through 360, turning left toward 180
- Bank: 20 degrees left
- Altitude: 4,950 and descending (student didn't add back pressure in the turn)
- VSI: -200 fpm
- Airspeed: 105 (slight decrease in the turn)

**System highlights the altimeter and VSI:**

> While your student corrects the heading, the altitude is dropping. They didn't compensate for the turn.
>
> This is a secondary issue. The heading correction is good, but now they're losing altitude.
>
> The Ask worked for the heading. But you've already used your softest intervention. The student is now task-loaded correcting the turn. A question right now might overload them.
>
> **Try pressing [C] to coach.** Give them specific, actionable guidance they can follow while turning.

**Learner presses C:**

> Quick-pick:
>
> - "Watch your altitude -- add a little back pressure"
> - "Check your altimeter"
> - "You're descending -- hold altitude in the turn"
>
> **Pick any.**

**Student response:**

> Student: "Oh, right. Back pressure..." [adds back pressure, altitude stabilizes at 4,900]
>
> Heading is now rolling through 270 toward 180.

**System note:**

> Coaching was the right level here. The student was already task-loaded with the turn correction. Asking another diagnostic question would have added confusion. Coaching gave them the specific action without making them figure it out.
>
> Notice the escalation: you went from Ask (Phase 1) to Coach (Phase 2). That's the intervention ladder in action -- you match your response to the situation.

---

### Phase 3: The Overcorrection

**What the instruments show:**

- Heading: approaching 180, student starts to roll wings level
- Altitude: 4,900, stable
- Everything looks like it's resolving

**Then:**

- Student overcorrects the roll: bank snaps to 60 degrees LEFT
- Nose drops: pitch goes to -5 degrees
- Airspeed: increasing rapidly (115 -> 125)
- Altitude: 4,900 and dropping fast (VSI: -800 fpm)
- Student freezes

**System pauses:**

> Your student overcorrected the roll and is now in a steep descending turn. 60 degrees of bank. Nose below the horizon. Airspeed increasing. Altitude dropping.
>
> The student is frozen. They're scared. They're not responding.
>
> You coached them 10 seconds ago. You could try Direct -- tell them exactly what to do. But at 60 degrees of bank with the nose down and a frozen student, how confident are you that they'll execute correctly?
>
> Sometimes the right call is Take Controls.
>
> **Taking controls is not losing.** It's the correct response when:
>
> - Safety margins are shrinking fast
> - The student is not responding to verbal intervention
> - Waiting longer makes recovery harder
>
> **Press [T] to take controls.**

**Learner presses T:**

> Confirmation: "Take controls? [Y/N]"
>
> This confirmation exists because take-controls is a significant action. In a real exercise, the instruments would disappear and you'd answer diagnostic questions about why. For this tutorial, we'll skip that part.

**After confirmation:**

> You: "My controls."
> Student: "Your controls."
>
> [Instruments show recovery: wings level, nose on horizon, airspeed stabilizing, altitude arrest]
>
> The three-step transfer: "My controls" / "Your controls" / "Your controls." Clear, unambiguous, no hesitation.

**System note:**

> You used three levels of the intervention ladder in one scenario:
>
> 1. **Ask** -- when there was time and the student could self-correct
> 2. **Coach** -- when the student was task-loaded but could follow guidance
> 3. **Take Controls** -- when safety margins were gone and the student was frozen
>
> Each was the right call at the right time. The goal is always the **least invasive effective** intervention -- but effective is the key word. When safety demands it, you take controls. No hesitation, no guilt.

---

### Phase 4: The Debrief

**System:**

> In the real course, every scenario ends with a debrief. You'd see:
>
> - A timeline replay of the scenario
> - Your actions overlaid on instrument data
> - Analysis of your intervention timing and level
> - Comparison data from other CFIs
>
> For now, here's the summary:
>
> - **Heading error:** Caught immediately. Ask was appropriate. Student self-corrected.
> - **Altitude loss:** Caught quickly. Coach was appropriate. Student responded.
> - **Overcorrection/freeze:** Take-controls was the right call. Student was non-responsive, bank angle and descent rate exceeded safe margins.
>
> This is the pattern for the entire course: watch, assess, intervene at the right level, debrief.

---

## Unguided Replay

**System:**

> Now let's run it again. Same scenario, but this time you're on your own. No pauses, no highlights, no coaching.
>
> The instruments will animate in real time. Use the note keys (1-6) to track what you're watching. Use the intervention ladder (A/P/C/D/T) when you see something that needs your attention.
>
> Ready?

**The replay runs the same scenario** with minor variations:

- Student might turn left instead of right (different error, same structure)
- Altitude loss rate might be different
- Overcorrection might be less severe (40 degrees instead of 60)
- Student might respond to Direct instead of needing Take Controls

The learner gets to practice the UI at full speed with a scenario they already understand. No surprises. Just mechanical practice.

**After the replay, brief debrief:**

> Your actions:
> [Timeline with their inputs]
>
> You used [intervention levels] at [timestamps].
>
> Ready for Module 1? The next exercise will feel similar -- same instruments, same controls -- but you'll be doing instructor work at the same time.

---

## Script Format

```yaml
id: TUT-1
title: Wrong-Way Turn (Tutorial)
module: 0  # pre-course
duration: guided  # no fixed time, advances on input
panel_type: six_pack
mode: tutorial  # enables pause, highlights, system narration

phases:
  - id: wrong_turn
    trigger: start
    instruments:
      heading: { initial: 040, curve: linear, target: 060, rate: 2_deg_per_s }
      bank: { initial: 0, target: 15_right, rate: 3_deg_per_s }
      altitude: { value: 5000 }
      airspeed: { value: 110 }
    student_scan: [attitude, heading, attitude, heading]  # fixated on turn
    pause_at: { heading: 050 }
    guided_action: ask
    student_response:
      ask: "Oh -- they said 180... I'm going the wrong way, aren't I?"
      result: { heading_target: 180, turn_direction: left }

  - id: altitude_loss
    trigger: heading_passing_300
    instruments:
      heading: { curve: turning_left, target: 180 }
      bank: { value: 20_left }
      altitude: { initial: 5000, curve: linear_decay, rate: 100_ft_per_min }
      vsi: { value: -200 }
      airspeed: { initial: 110, target: 105 }
    pause_at: { altitude: 4960 }
    guided_action: coach
    student_response:
      coach: "Oh, right. Back pressure..."
      result: { altitude_stabilize: 4900 }

  - id: overcorrection
    trigger: heading_approaching_180
    instruments:
      bank: { snap_to: 60_left, rate: 15_deg_per_s }
      pitch: { snap_to: -5, rate: 3_deg_per_s }
      airspeed: { initial: 110, target: 130, rate: 3_kts_per_s }
      altitude: { initial: 4900, rate: -800_ft_per_min }
      vsi: { value: -800 }
    pause_at: { bank: 55 }
    guided_action: take_controls
    student_response:
      take_controls: "Your controls."
      result: { recovery: standard }

replay:
  mode: unguided
  variations:
    - heading_error_direction: [left, right]
    - altitude_loss_rate: [50, 100, 150]
    - overcorrection_severity: [30, 40, 50, 60]
    - student_freeze: [true, false]
```

---

## Placement in Lesson Flow

```text
Account setup / course overview
    |
TUT-1: Wrong-Way Turn (guided, ~5 min)
    |
TUT-1: Wrong-Way Turn (replay, unguided, ~3 min)
    |
ISE-1.1: Instrument Scan Evaluation (the gorilla, ~3 min)
    |
ISE-1.1 reveal + module framing (~3 min)
    |
SCN 1.1: GPS Database Expired (first tick-engine scenario)
    |
... rest of Module 1 ...
```

The tutorial teaches the controls. ISE-1.1 uses those same controls to demonstrate inattentional blindness. The learner goes from "I know how this works" to "I missed something obvious" in under 5 minutes. That emotional arc -- confidence then humility -- is the setup for the entire module.
