---
id: m3-base-to-final
module: 3
title: "Visual Approach to Runway 27"
faa_topics: [A.11]
competencies: [CJ-1, CJ-2, AC-1, AC-2, RM-2]
student_model: low-skill-overconfident
duration_min: 10
difficulty: entry
replay_value: >
  Student model variation changes the response -- a compliant student recovers quickly on a Prompt;
  an overconfident student dismisses a Prompt and requires Direct or Take Controls.
  Wind and pattern altitude vary the energy state at T=0.
---

# Visual Approach to Runway 27

## Briefing

> You are right-seat in a Cessna 172 at KGVQ (Genesee County), pattern altitude 2,100 MSL.
> Your student, a 65-hour private pilot working toward commercial, is flying a normal VFR pattern.
> They've been flying well today -- a little mechanical, but not alarming. Tower has cleared you to land on 28.
> Base leg. Flaps 20. Everything looks fine.

## Setup

Initial simulation state at T=0. Student has just rolled into the base-to-final turn.

```yaml
aircraft:
  ref: single_engine_not_high_perf # resolved to student's aircraft if it fits, else C172S default
  familiarity: familiar # student's own aircraft -- removes unfamiliar-equipment stress
  phase_of_flight: base_to_final_turn
  bank_deg: 30 # geometry -- aircraft-independent
  airspeed: approach_target # resolved to 1.3 Vso for the actual aircraft
  altitude_agl_ft: 300 # AGL -- scenario controls relative altitude, not absolute
  pitch_deg: 2
  config: flaps_approach # aircraft's normal approach flap setting

environment:
  ref: vmc_day_light_winds # standard bundle: VMC, 5-10 kts on-heading, 10+ SM
  airport: home_airport # student's registered home airport
  traffic: none # lesson-specific: no pattern traffic to add distraction

student:
  state: focused
  workload: medium
  verbal: "Turning final... flaps set."
```

## Tick Timeline

```yaml
beats:
  - t: 0
    label: "Normal base-to-final turn begins"
    aircraft:
      bank_deg: 30
      airspeed: approach_target
    student:
      state: focused
      verbal: "Turning final... flaps set."
    cues: []
    risks: []
    intervention_window: false

  - t: 5
    label: "Overshooting -- student tightens the turn"
    aircraft:
      bank_deg: 45
      airspeed: approach_target_minus_5
      pitch_deg: 4 # back pressure added to hold altitude in the turn
    student:
      state: fixated_on_runway
      workload: high
      verbal: "" # silent, task-saturated
    cues:
      - bank steeper than standard (>30°)
      - airspeed trending below target
      - nose higher than expected for bank angle
    risks:
      - accelerated stall developing
      - insufficient altitude to recover from incipient spin
    intervention_window: true # IP-1 opens here

  - t: 10
    label: "Stall precursors -- student has not corrected"
    aircraft:
      bank_deg: 52
      airspeed: Vs1_plus_10
      pitch_deg: 6
    student:
      state: overconfident
      verbal: "I've got it." # if prompted
    cues:
      - airspeed approaching stall arc
      - control feel softening
      - stall horn intermittent
    risks:
      - stall imminent within 3-5 seconds without recovery input
      - bank makes standard stall recovery ineffective
    intervention_window: true # IP-1 still open but closing fast

  - t: 14
    label: "Stall break -- if no intervention"
    aircraft:
      bank_deg: 58
      airspeed: Vs1
      pitch_deg: 0 # nose drops at stall break
    student:
      state: startled
      verbal: "Whoa--"
    cues:
      - stall horn continuous
      - nose drop
      - left wing drop beginning
    risks:
      - incipient spin entry if not recovered immediately
    intervention_window: true # IP-2 (emergency) -- Take Controls likely required

  - t: 18
    label: "Incipient spin entry -- no recovery possible without takeover"
    aircraft:
      bank_deg: 70
      airspeed: Vso # below stall in all configs
      pitch_deg: -15 # nose well below horizon
    student:
      state: freeze
      verbal: ""
    cues:
      - pronounced rotation beginning
      - altitude 100 ft AGL -- insufficient for developed spin recovery
    risks:
      - ground impact without immediate recovery
    intervention_window: true # Take Controls only -- too late for anything else
```

## Intervention Points

### IP-1: Tightening Turn (T+5 to T+13)

**Situation:** Student has steepened the bank past 45°, airspeed is bleeding, back pressure is adding pitch. The overshoot is obvious. The stall is building but not yet imminent.

**Window:** ~8 seconds before stall break. Plenty of time for Ask or Prompt -- if taken now.

| Level         | Action                                                           | Outcome if taken here                                                                                                                           |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Ask           | "What's your airspeed?"                                          | Student looks at airspeed, recognizes the problem, reduces bank. Recovers normally. Debrief: good catch, suboptimal that a question was needed. |
| Prompt        | "Correct to target speed."                                       | Compliant student reduces bank and pitch. Overconfident student says "I've got it" -- may not fully correct. Watch for partial response.        |
| Coach         | "Roll wings level, add power, then re-intercept the centerline." | Full corrective guidance. Student follows if not frozen. Recovers safely with coaching.                                                         |
| Direct        | "Level wings. Now."                                              | Student complies immediately. Safe recovery. Debrief: consider whether Direct was necessary this early.                                         |
| Take Controls | Positive exchange                                                | Safe. Debrief: premature -- was the situation actually unsafe at T+5?                                                                           |
| No action     | --                                                               | Scenario continues to IP-2.                                                                                                                     |

### IP-2: Stall Imminent (T+13 to T+17)

**Situation:** Stall horn intermittent-to-continuous. Bank 52°+. Airspeed at or below Vs1. Student is fixated or beginning to freeze.

**Window:** 3-4 seconds. Ask and Prompt are no longer appropriate -- consequences are too close.

| Level         | Action                                   | Outcome if taken here                                                             |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Ask           | "What's your airspeed?"                  | Student looks down, loses remaining margin. Stall break likely before response.   |
| Prompt        | "Correct to target speed."               | Too vague for this phase. Student cannot comply in time. Stall break likely.      |
| Coach         | "Power, roll level, forward pressure."   | If student responds immediately, possible recovery. Tight.                        |
| Direct        | "Level wings, push forward, full power." | Student has best chance of self-recovery with explicit command. Marginal outcome. |
| Take Controls | Positive exchange                        | Safe recovery. Appropriate given proximity to stall break.                        |
| No action     | --                                       | Stall break at T+14. Proceeds to IP-2E.                                           |

### IP-2E: Stall Break / Spin Entry (T+14+)

**Situation:** Stall has broken. Nose dropped, wing dropped. At 300 AGL, spin recovery is not possible. Only Take Controls can prevent ground impact.

**Window:** Seconds. No ladder -- Take Controls immediately.

| Level         | Action    | Outcome                                                                            |
| ------------- | --------- | ---------------------------------------------------------------------------------- |
| Take Controls | Immediate | Recovery possible if taken before T+18. Minimum altitude ~200 AGL margin required. |
| Any other     | --        | Ground impact. Scenario ends. Debrief triggered.                                   |

## Branch Outcomes

| Intervened by              | Intervention    | Outcome                                                                |
| -------------------------- | --------------- | ---------------------------------------------------------------------- |
| T+5 to T+9 (early)         | Ask             | Student self-corrects. Clean recovery. Debrief: normal landing.        |
| T+5 to T+9 (early)         | Prompt or Coach | Student corrects with guidance. Safe. Debrief: normal landing.         |
| T+5 to T+9 (early)         | Direct or Take  | Safe but debrief flags possible overresponse.                          |
| T+10 to T+13 (late)        | Ask             | Risk of inadequate response -- student may not fully correct. Monitor. |
| T+10 to T+13 (late)        | Direct or Take  | Safe recovery. Debrief: intervention was necessary, timing was late.   |
| T+14 to T+17 (stall break) | Take Controls   | Marginal safe recovery. Debrief: late -- what was missed at T+5?       |
| T+18+                      | Anything        | Ground impact. Scenario ends in safety event.                          |

## Evidence Logged

| Signal                         | Description                                               | Maps to                  |
| ------------------------------ | --------------------------------------------------------- | ------------------------ | ----------- | ------------- | ---- |
| `first_cue_tick`               | When IP-1 cues first appeared (T+5)                       | baseline                 |
| `first_intervention_tick`      | When instructor first acted                               | CJ-1 -- did they notice? |
| `intervention_delay_sec`       | `first_intervention_tick - first_cue_tick`                | CJ-1, AC-1               |
| `intervention_level`           | Which ladder level was chosen at each IP                  | CJ-2                     |
| `intervention_appropriateness` | Was chosen level appropriate to the window?               | CJ-2                     |
| `student_verbal_dismissed`     | Did student say "I've got it" and instructor accepted it? | CJ-1, CJ-3               |
| `outcome`                      | recovered_early                                           | recovered_late           | stall_break | ground_impact | RM-2 |

## Debrief

**If early intervention (T+5 to T+9):**

> "You caught the overshoot early -- bank was 45° and airspeed was 75 kts when you acted. That's the window. At that point, a [Ask/Prompt] was the right level -- the situation was developing but not yet critical. [If Ask: Your student found the problem themselves, which builds their scan. Well done.]"

**If late intervention (T+10 to T+13):**

> "The cues were there at T+5: bank past 45°, airspeed trending down, back pressure building. Your first action was at T+[X] -- [X-5] seconds after the pattern became clear. In that window, a Prompt would have been enough. By T+10, you needed Direct or Take Controls. What were you waiting for?"

**If stall break before intervention:**

> "The stall broke at 300 AGL with 58° of bank. At that altitude, there is no recovery from a spin entry. Your student was at the controls when this happened. Walk through the tape: bank started steepening at T+5. Airspeed was in the yellow arc at T+8. Stall horn was intermittent at T+11. Each of those was a moment you could have acted. This is why we train this scenario."

**Key learning moment:**

> The stall-spin on base-to-final doesn't announce itself. It develops over 10-15 seconds through a sequence of small, ignorable signals. The CFI's job is to interrupt the chain -- not at the stall break, but at the first bend in the trend.
