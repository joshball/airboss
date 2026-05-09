---
# === Identity ===
id: proc-acs-tolerances
title: ACS Maneuver Tolerances
domain: procedures
cross_domains:
  - regulations
  - adm-human-factors

# === Knowledge character ===
# factual: the ACS publishes specific numerical tolerances for each
#   performance maneuver -- altitude ±100 ft, airspeed ±10 kt, bank ±5°,
#   heading ±10°. These numbers are the checkride pass/fail line.
# perceptual: holding inside tolerances requires constant scan and
#   continuous small corrections. The pilot who waits for the value to
#   drift to the limit is too late.
# judgment: the pilot must self-evaluate against the standard in real
#   time. Examiners watch for the recognition of a deviation, not just
#   the deviation itself.
knowledge_types:
  - factual
  - perceptual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-load-factor-and-bank-angle
deepens:
  - proc-attention-management
applied_by:
  - proc-execute-steep-turn
  - proc-ground-reference-maneuvers
taught_by: []
related:
  - proc-attention-management
  - proc-execute-steep-turn

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 20
review_time_minutes: 4

# === References ===
references:
  - source: ACS PPL-A
    detail: 'Areas of Operation -- skill standards (e.g., V.A.S5, V.B.S7)'
    note: >-
      Authoritative source for the numerical tolerances on each maneuver.
      Tolerances vary by maneuver and may differ between PPL, IR, CPL, and
      ATP standards.
  - source: FAA-H-8083-3
    detail: Airplane Flying Handbook -- Performance Maneuvers
    note: >-
      Practical guidance on how to fly within tolerances -- scan tempo,
      trim use, anticipation, and the perceptual cues that warn of
      drift before the gauge confirms it.
  - source: FAA-S-8081-14
    detail: Airman Certification Standards / Practical Test Standards (legacy)
    note: >-
      Predecessor PTS document; ACS replaced PTS but the tolerance
      numbers have remained largely consistent.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - recall
mastery_criteria: >-
  Learner can: (1) recite the standard ACS tolerances for steep turns
  (altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10°); (2) recite
  the standard ACS tolerances for ground reference maneuvers (altitude
  ±100 ft, airspeed ±10 kt); (3) describe the scan technique that keeps
  values inside tolerance (early small corrections, not late large
  corrections); (4) explain the difference between "achieving" tolerance
  (one-time) and "maintaining" tolerance (continuous); (5) describe what
  an examiner is watching for during the maneuver (recognition + correction,
  not just the gauge values).
---

# ACS Maneuver Tolerances

## Context

The Airman Certification Standards (ACS) is the document the examiner uses to grade your checkride. For each task, the ACS publishes numerical tolerances -- the specific deviations the examiner can accept and still award a passing grade.

For steep turns: altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10° on rollout.

For ground reference: altitude ±100 ft, airspeed ±10 kt.

These numbers are not arbitrary. They are the boundary between "the pilot has control of the airplane" and "the pilot is fighting the airplane." A pilot who routinely deviates by 100 feet during steep turns is not in control; they are riding the airplane and reacting to what it does.

The tolerance is also the ceiling, not the target. A pilot who flies 80-foot deviations on every steep turn is "passing" but missing the deeper standard. The target is zero deviation; the tolerance allows for the realities of turbulence, scan latency, and small corrections that have not yet completed.

## Problem

You are flying steep turns at 3,500 MSL. Halfway through the second turn, you notice your altitude is at 3,580 MSL -- 80 feet high. You have 80 seconds left in the maneuver. What do you do, in what order, and how big are your corrections?

Write your answer before reading on. Then ask: at what point does an in-tolerance deviation become a teaching opportunity worth a verbal "I'm 80 high, correcting"?

## Discover

### Q1. What are the standard tolerances for Area V?

For PPL-A, from the ACS:

| Maneuver               | Tolerance                                                            |
| ---------------------- | -------------------------------------------------------------------- |
| Steep turns (V.A)      | altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10° on rollout |
| Ground reference (V.B) | altitude ±100 ft, airspeed ±10 kt                                    |

For IR / CPL / ATP, tolerances tighten:

- CPL steep turns: altitude ±100 ft, airspeed ±10 kt, bank ±5° (same numbers but at 50° bank instead of 45°).
- IR turn-rate / heading work: altitude ±100 ft, airspeed ±10 kt, bank-as-required.

Always check the current ACS for the cert you are pursuing. The numbers above are the long-standing PPL standard.

### Q2. What does "tolerance" actually mean?

Tolerance is the maximum acceptable deviation from the target value at any single point during the maneuver. If you are at any moment more than 100 feet from your entry altitude, you have exceeded altitude tolerance. The examiner does not need to see you 100+ feet off for an extended period; one moment is enough.

This means the maneuver must be flown with the tolerances as a constraint at every instant. You cannot "average" to the standard -- you must stay inside it continuously.

### Q3. What makes pilots exceed tolerance?

Common causes:

- **Late recognition.** The pilot is looking elsewhere when the value drifts; by the time they see it, the deviation is already at or past the tolerance.
- **Late correction.** The pilot recognises the deviation but applies a correction that is too small or too slow. The value continues to drift.
- **Overcorrection.** The pilot applies a correction that overshoots the target, putting the value out of tolerance on the other side. Cycle continues.
- **Distraction.** The pilot is dealing with another task (a radio call, a visual reference) and stops sampling the panel.
- **Wrong scan tempo.** The pilot is looking at the wrong instrument at the wrong time. Bank and altitude are the primary panel cues in a steep turn; if the pilot fixates on airspeed or VSI, bank drifts.
- **Wrong control input.** The pilot uses bank to fix altitude (instead of pitch or back-pressure) or pitch to fix bank, and the correction goes the wrong direction.

The fix for each is a different drill, but the meta-pattern is: scan continuously, correct early and small, anticipate trends.

### Q4. What does an early small correction look like?

You are at 3,500 MSL, 45 bank. Your scan picks up the altimeter at 3,520 (20 feet high, well inside tolerance). The correct response is to add a small amount of back-pressure (or trim slightly aft), enough to arrest the climb without immediately starting a descent. Re-check on the next scan cycle (2-3 seconds).

If on the next cycle the altimeter is at 3,510 (drifting back toward target), you continue. If at 3,535, you add a bit more. If at 3,500, you neutralise the input (you achieved the correction; do not let it become a descent).

The correction is continuous, small, and proportional to the current deviation and trend. No single input is large; the sum keeps the value at target.

### Q5. What does a late large correction look like?

You are at 3,500, 45 bank. You have not been scanning the altimeter for 8-10 seconds because you are focused on the bank and the outside picture. Your scan picks up the altimeter at 3,575 (75 feet high; still in tolerance but on the edge).

The correct response now is moderate back-pressure release; the wrong response is panic. Many pilots react to the surprise by:

- Pushing the nose down hard, which immediately starts a descent.
- The descent overshoots the target; pilot now at 3,420 (80 feet low).
- Pilot pulls up hard; airspeed bleeds; bank loosens; the maneuver disintegrates.

The pattern is "surprise -> overcorrection -> opposite overshoot -> overcorrection." The fix is to break the cycle: small inputs, frequent rechecks, do not chase the gauge.

### Q6. What is the perceptual goal?

The pilot should be able to predict the next altitude reading from the current pitch, the current trend, and the previous reading. If the prediction matches the actual reading on the next scan, the pilot is in control. If the prediction misses, the pilot has lost the model and needs to slow down, level off briefly, or exit and restart.

This is the difference between "flying the maneuver" and "watching the maneuver fly itself." The good pilot is always one cycle ahead of the airplane.

### Q7. What is the examiner watching for?

Three things, in roughly this order:

1. **Did you stay in tolerance?** The numerical floor.
2. **Did you recognise deviations early?** The perceptual standard. An examiner who sees a 50-foot drift and a verbalised "I'm 50 high, correcting" is reassured. An examiner who sees a 90-foot drift with no verbal acknowledgement is concerned even though it is still in tolerance.
3. **Were your corrections proportional and effective?** A pilot who makes appropriate small inputs, watches the response, and adjusts is demonstrating mastery. A pilot who oscillates is not.

The verbalisation is an option, not a requirement. But it tells the examiner what is in your head. Use it.

### Q8. What is the ACS minimum vs. the safe-pilot standard?

ACS tolerances are the minimum to pass a checkride. They are not the standard for safe everyday flying.

A pilot who routinely deviates by 80-100 feet during normal maneuvering is doing damage to their own airmanship and to anyone they fly with. The internal target should be tight (±20 feet, ±3 knots, ±2 degrees). The ACS gives margin so a moment of turbulence or distraction does not bust the checkride.

Treat the tolerance as a ceiling, not a target. Aim for zero deviation; accept small deviations as the price of operating in the real atmosphere.

### What Discover should have led you to

- ACS tolerances are continuous constraints, not averages.
- Late large corrections oscillate; early small corrections converge.
- The perceptual standard is "predict the next reading and match it."
- Examiners watch recognition + correction, not just gauge values.
- The pilot's internal target should be tighter than the ACS ceiling.
- Verbalising deviations and corrections demonstrates control to the examiner.

## Reveal

### The summary rule

> ACS tolerances are continuous constraints: at no point during the maneuver may the value exceed the published deviation. For PPL Area V steep turns: altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10° on rollout. For ground reference: altitude ±100 ft, airspeed ±10 kt. The technique is early small corrections, not late large ones -- a pilot who scans every 2-3 seconds and trims a small drift back to target stays inside; a pilot who waits for the gauge to scream oscillates. Treat the tolerance as the ceiling, not the target. The internal target is zero deviation; the tolerance allows for the realities of turbulence and scan latency. Examiners are watching for early recognition and proportional correction, not just gauge values.

### PPL Area V tolerances

| Element                    | Tolerance                                             |
| -------------------------- | ----------------------------------------------------- |
| Steep turn altitude        | ±100 ft from entry altitude                           |
| Steep turn airspeed        | ±10 kt from selected airspeed                         |
| Steep turn bank            | ±5° from 45° (or POH-recommended)                     |
| Steep turn heading         | ±10° from entry heading on rollout                    |
| Steep turn duration        | Hold for full 360° in each direction                  |
| Ground reference altitude  | ±100 ft from selected altitude                        |
| Ground reference airspeed  | ±10 kt from selected airspeed                         |
| S-turns reference crossing | Reverse turn directly over the line                   |
| Ground track               | Maintain selected ground track (rectangle, S, circle) |
| Coordination               | Ball centered throughout                              |

### The early-correction technique

```text
1. Establish the target value (altitude, airspeed, bank).
2. Trim the airplane to that condition.
3. Scan the value every 2-3 seconds.
4. On any drift > 10-20 feet (or 2-3 knots, or 2-3 degrees):
   a. Apply a small proportional correction.
   b. Re-check on the next scan.
   c. Adjust the correction based on response.
   d. Neutralise as soon as the trend reverses.
5. Verbalise notable deviations and corrections.
```

### What examiners look for

| Cue                                            | Examiner reads as               |
| ---------------------------------------------- | ------------------------------- |
| Stays inside tolerance throughout              | Pilot has control               |
| Verbalises a deviation and the correction      | Pilot is self-evaluating        |
| Small frequent inputs, smooth response         | Mastery                         |
| Large oscillating inputs                       | Reactive, not predictive        |
| Drift to tolerance edge with no comment        | May not have noticed            |
| Exceeds tolerance and visibly recovers cleanly | Borderline; may pass            |
| Exceeds tolerance and does not recognise it    | Fail (loss of control standard) |

### What is actually authoritative

In descending order:

1. **ACS PPL-A** -- the current Areas of Operation tolerance numbers.
2. **AFH chapters on each maneuver** -- the technique for staying inside tolerance.
3. **POH** -- airplane-specific recommended airspeeds and any maneuver constraints.

## Practice

### Cards (spaced memory items)

- `card:acs-steep-turn-tol` -- "ACS PPL tolerances for steep turns?" -> "Altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10° on rollout, hold for full 360 in each direction."
- `card:acs-grm-tol` -- "ACS PPL tolerances for ground reference?" -> "Altitude ±100 ft, airspeed ±10 kt."
- `card:acs-tolerance-meaning` -- "What does ACS tolerance mean?" -> "Maximum allowable deviation at any single point during the maneuver -- not an average."
- `card:acs-correction-rule` -- "Correction technique for staying in tolerance?" -> "Early, small, proportional. Scan every 2-3 seconds. Trim and trend; do not wait for the gauge to scream."
- `card:acs-target-vs-ceiling` -- "Should you fly to the tolerance or to zero deviation?" -> "Zero deviation is the target; tolerance is the ceiling that allows for turbulence and scan latency."
- `card:acs-examiner-cue` -- "What is the examiner watching for besides gauge values?" -> "Early recognition of deviation and proportional correction; verbalisation is helpful."

### Reps (scenario IDs)

- `scenario:acs-steep-turn-drift` -- pilot in a steep turn drifts 60 feet high mid-maneuver; demonstrates early small correction and recovery without overshoot.
- `scenario:acs-grm-altitude` -- pilot in turns around a point lets altitude drift 90 feet during a downwind quadrant; recognises and corrects.
- `scenario:acs-rollout-heading` -- pilot rolls out of a steep turn 15 degrees off entry heading; recognises bust and explains why (typically late roll-out lead).
- `scenario:acs-overcorrection-cycle` -- pilot enters an oscillation; demonstrates breaking the cycle with smaller inputs and a brief stabilisation.

### Drills (time-pressured)

- `drill:acs-tol-recall` -- pilot recites all four steep-turn tolerances in 5 seconds.
- `drill:acs-correction` -- CFI calls out a deviation ("you're 80 high"); pilot responds with the correction and the verbal acknowledgement in 3 seconds.
- `drill:acs-prediction` -- during a steep turn, pilot calls out the expected altitude in 2 seconds; CFI verifies against actual.

## Connect

### What changes if...

- **...you are flying CPL?** Tolerances tighten for steep turns (50° bank instead of 45°, same ±100 / ±10 / ±5). Same numerical tolerance, but the maneuver itself is more demanding.
- **...you are flying IR?** The relevant tolerances are altitude / heading / airspeed in instrument flight. ±100 / ±10 / ±10. Same numbers, applied continuously without outside reference.
- **...you are flying ATP?** ATP tolerances often drop to ±50 ft on altitude and ±5 kt on airspeed for some maneuvers. Different document; check the current ACS for that cert.
- **...you are in turbulence?** The ACS does not tighten in turbulence, but the technique becomes harder. Slow scan tempo to 1-2 seconds; expect more rapid corrections; consider exiting if conditions exceed the airplane's smooth-air practice envelope.
- **...you are training a primary student?** Set internal targets tighter than the ACS (±50 ft, ±5 kt, ±3°). The student who hits the tighter standard in training will easily pass the ACS standard on a checkride.
- **...you are practicing solo?** Self-evaluate against the ACS after every maneuver. Note which gauge drifted first. Plan the next attempt around fixing that channel.

### Links

- `proc-attention-management` -- the scan that keeps values inside tolerance.
- `proc-execute-steep-turn` -- the maneuver where these tolerances apply.
- `proc-ground-reference-maneuvers` -- the maneuver where the ±100 ft, ±10 kt apply.
- `aero-load-factor-and-bank-angle` -- why bank ±5° matters (load-factor consequences of overbank).
- `proc-maneuvering-airspeeds` -- the recommended airspeed that becomes the ±10 kt baseline.

## Verify

### Novel scenario (narrative)

> You are demonstrating a steep turn at 45 bank, 95 KIAS, 3,500 MSL on your checkride. As you reach 270 degrees through the turn (90 degrees from rollout), your altitude is 3,420 (80 feet low) and your bank has drifted to 50 degrees. Walk through your action plan in the next 30 seconds.

Scoring rubric:

- Verbalises the deviations: "80 low, 5 over-banked." (1)
- Corrects bank first (overbank is causing the descent): release some aileron pressure smoothly to come back to 45. (3)
- Adds back-pressure to arrest descent and trend back toward 3,500. (2)
- Re-scans on next cycle (2-3 sec) to verify response. (1)
- Does not overshoot in the recovery: stops the climb at 3,500, holds. (2)
- Plans the rollout: anticipates lead time for 95 KIAS, 45 bank, rolling out on entry heading. (2)
- After rollout: verbalises whether the rollout heading was within ±10° of entry. (1)
- Notes the lessons for the second-direction turn. (1)

13/13 is the bar. Below 9 is a redo.

### Teaching exercise (CFI)

> A student flies steep turns and consistently exits with an altitude deviation of 80-90 feet and an airspeed deviation of 8-9 knots. They are technically passing the ACS tolerance, but the deviations are systematic in the same direction every time. Diagnose using the early-vs-late correction framework and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is not in control; they are finishing inside tolerance by luck and trim drift, not by active correction. The systematic direction (always low, always slow, or always high, always fast) reveals an uncorrected trim or scan bias.
- Identify the bias: typically, students drift low in steep turns because the back-pressure required to maintain altitude in a 45 bank is more than they expect. They under-trim and ride the trim out.
- Teaching point: trim for the steep turn before rolling in. Specifically, add 1-2 turns of nose-up trim during the roll-in. The airplane will hold altitude with much less stick force, and the student can devote attention to bank and outside picture instead of fighting back-pressure.
- Drill: have the student verbalise altitude every 5 seconds during the next turn. The verbalisation forces sampling.
- Reframe the standard: ±100 is not the goal. ±20 is. The student who internalises the tighter target will pass any checkride and fly more precisely for the rest of their life.
- The CFI is direct: "You are passing the test, but you are not flying the airplane. There's a difference."

The pedagogical move is to make the systematic direction visible to the student (it was invisible because they were not measuring), to give them a concrete fix (trim during roll-in), and to elevate the standard above the ACS floor.
