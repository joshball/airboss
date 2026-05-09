---
# === Identity ===
id: proc-execute-steep-turn
title: Executing a Steep Turn
domain: procedures
cross_domains:
  - aerodynamics

# === Knowledge character ===
# procedural: roll in smoothly to 45° (PPL) at the recommended airspeed,
#   add back-pressure as bank increases, hold for 360°, anticipate roll-out
#   lead, roll out on entry heading. Repeat in opposite direction.
# perceptual: the bank cue is the wing-tip vs. horizon angle. The altitude
#   cue is the altimeter and the VSI trend. The airspeed cue is the ASI.
#   Outside-the-window dominates the scan; the panel confirms.
# judgment: when do you stop the maneuver? When the airplane is out of
#   tolerance and you cannot recover within the maneuver. When traffic
#   appears in the area. When you over-bank past 50° and the recovery
#   risks accelerated stall.
knowledge_types:
  - procedural
  - perceptual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-load-factor-and-bank-angle
  - aero-coordination-rudder
  - proc-maneuvering-airspeeds
  - proc-clear-the-area
deepens: []
applied_by: []
taught_by: []
related:
  - proc-acs-tolerances
  - proc-attention-management
  - proc-stall-recovery
  - aero-uncoordinated-flight

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 35
review_time_minutes: 6

# === References ===
references:
  - source: FAA-H-8083-3
    detail: Airplane Flying Handbook -- Performance Maneuvers (Steep Turns)
    note: >-
      The canonical chapter on steep-turn execution -- entry, control
      inputs, scan technique, common errors, and recovery from exceeding
      tolerances.
  - source: ACS PPL-A
    detail: Area V Task A -- Steep Turns
    note: >-
      The performance standards for V.A.S3 (roll into a coordinated
      360 steep turn at approximately 45 bank), V.A.S4 (perform in
      opposite direction), V.A.S5 (tolerances).
  - source: POH / AFM Section 5
    detail: Performance Maneuvers -- recommended airspeed for steep turns
    note: >-
      Airplane-specific maneuver entry airspeed and any bank-angle
      restrictions (some airplanes have a published "do not exceed"
      bank in normal category).
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge -- Aerodynamics of Flight
    note: >-
      Background on load factor, stall speed in banked turns, and
      coordinated-turn physics that determine the steep-turn technique.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
mastery_criteria: >-
  Learner can: (1) describe the entry sequence (clear the area, select
  altitude / airspeed / heading reference, brief the maneuver, smooth
  roll-in to 45° while adding back-pressure and trim); (2) demonstrate
  a 360° steep turn within ACS tolerances (altitude ±100 ft, airspeed
  ±10 kt, bank ±5°, heading ±10° on rollout); (3) demonstrate the
  reverse-direction turn (V.A.S4); (4) anticipate roll-out lead
  (typically half the bank angle in degrees of heading -- 22 degrees
  before target heading at 45 bank); (5) recognise and recover from a
  bank exceeding 50°, an airspeed dropping below 10 KIAS under target,
  or an altitude deviation approaching tolerance.
---

# Executing a Steep Turn

## Context

A steep turn is the simplest performance maneuver to describe and one of the harder to fly well. Roll into a 45-degree banked level turn, hold the bank and altitude for a full 360, roll out on the entry heading. Repeat in the opposite direction.

Why is it hard? Because it forces the pilot to integrate four inputs simultaneously and continuously: aileron (bank control), elevator (altitude control through back-pressure), rudder (coordination), and throttle (airspeed control). All four interact. A change in bank changes the back-pressure required. A change in back-pressure affects airspeed. A change in airspeed affects the load factor at the same bank. Every input ripples.

The pilot who fights each variable independently loses; they make corrections that cascade into other corrections. The pilot who flies the maneuver as a single integrated control task wins; they trim for the new condition, scan continuously, and make small simultaneous adjustments.

This node is the procedure for the maneuver. It composes on `aero-load-factor-and-bank-angle` (the physics), `proc-maneuvering-airspeeds` (Va and the recommended airspeed), `proc-clear-the-area` (the prefix), and `proc-acs-tolerances` (the success criteria).

## Problem

You are about to demonstrate a steep turn for your CFI. Walk through the maneuver from "clear the area" to "complete the second-direction turn." Specifically:

1. What is your entry checklist?
2. How do you select the entry heading?
3. What does the roll-in look like (rate, control inputs, trim)?
4. What does the steady-state turn look like (scan, corrections)?
5. How do you anticipate roll-out lead?
6. What is different about the second-direction turn?

Write your answer before reading on.

## Discover

### Q1. What is the entry checklist?

Before rolling in, complete:

1. **Altitude check** -- am I above the maneuver minimum (typically 1,500 AGL)?
2. **Clear the area** -- two 90-degree clearing turns, scan high-low-high (see `proc-clear-the-area`).
3. **Reference selection** -- pick a heading toward a recognisable visual reference (a road, a mountain, a town). The reference is what you use to roll out cleanly.
4. **Airspeed** -- establish manufacturer's recommended airspeed (POH Section 5) or do not exceed Va.
5. **Trim** -- trim for level flight at the entry airspeed.
6. **Brief** -- "I am going to do a steep turn to the right at 45 bank, hold for 360, roll out on heading 270."

Now you are ready to roll in. The whole sequence takes about 60 seconds and should feel deliberate, not rushed.

### Q2. How do you select the entry heading?

Pick a heading that points toward a recognisable visual reference -- a road, a mountain, a city. Two reasons:

1. The reference makes roll-out judgment easier. Instead of "I should be at 270 degrees on the heading indicator," you have "the city is at my 12 o'clock when I should be wings level."
2. The reference catches a heading-indicator failure or a misread. If the city is at your 9 o'clock when you "rolled out on heading," you have a discrepancy to investigate.

Avoid headings that point at nothing distinguishable (e.g., over open water, over featureless terrain). The maneuver is harder without an outside cue.

### Q3. What does the roll-in look like?

Smooth, deliberate, simultaneous:

```text
1. Apply aileron to roll into the bank.
2. As bank increases past 30°, add back-pressure proportionally.
3. As bank increases past 35°, add trim (1-2 turns nose-up in a C172).
4. Maintain coordination with rudder (small input only; mostly aileron drives the bank).
5. Watch the bank approach 45°; freeze aileron pressure to hold the bank.
6. Add throttle if airspeed bleeds (typically 100-200 RPM in a C172 to maintain ~95 KIAS).
```

The whole roll-in takes about 3-5 seconds. Pilots who try to roll in too fast lose altitude as the elevator catches up. Pilots who roll in too slow waste the maneuver's first quadrant on transient corrections.

The trim adjustment is the secret weapon. Without trim, the back-pressure required to maintain altitude in a 45 bank is significant -- enough that the pilot fights it for the entire turn and the arm fatigues. With trim, the airplane wants to hold altitude at the new condition; the pilot relaxes back-pressure, scans freely, and corrects small drifts with light pressure.

### Q4. What does the steady-state turn look like?

Once established at 45 bank:

```text
Scan: bank -> altitude -> airspeed -> outside-for-traffic -> back to bank
Tempo: every 2-3 seconds per channel
Inputs: continuous tiny corrections, never large
```

Outside-the-window dominates. The wing-tip-to-horizon angle is your primary bank reference. The horizon position relative to the cowling is your primary altitude reference. The panel confirms the outside picture; if your wing-tip says 45 and the panel says 42, the wing-tip wins (the AI may have a small error; the visual reference is correct).

Common steady-state corrections:

- **Bank drift toward overbank (50+):** smoothly relax aileron pressure or apply small opposite aileron. Do NOT add rudder.
- **Bank drift toward shallow (40-):** apply small same-side aileron.
- **Altitude drift high:** release a small amount of back-pressure.
- **Altitude drift low:** add a small amount of back-pressure. If significant, also reduce bank momentarily (more vertical lift component).
- **Airspeed drift low:** add small throttle. If significant, also reduce bank.
- **Airspeed drift high:** reduce throttle slightly.

The corrections are small and continuous. Each correction's response is checked on the next scan cycle.

### Q5. How do you anticipate roll-out lead?

The roll-out is not instantaneous. The airplane keeps turning while the bank is rolling out. The lead distance depends on bank and roll-out rate.

Rule of thumb: lead the roll-out by approximately **half the bank angle in degrees of heading**. At 45 bank, lead by ~22 degrees. So if your target rollout is heading 270, start the roll-out at heading 248 (turning right) or 292 (turning left).

The roll-out is the mirror image of the roll-in: smooth, deliberate, simultaneous. As the bank rolls out:

```text
1. Reduce aileron pressure to begin roll-out.
2. As bank decreases past 35°, release back-pressure proportionally.
3. As bank decreases past 30°, release trim back to neutral.
4. Throttle back to baseline as airspeed stabilises.
5. Wings level at target heading; check altitude and airspeed.
```

A clean roll-out lands you on the entry heading ±5° (well inside the ±10° tolerance) at entry altitude (well inside the ±100 ft tolerance) at entry airspeed (well inside the ±10 kt tolerance).

### Q6. What is different about the second-direction turn?

V.A.S4 requires the maneuver in the opposite direction. The differences:

- **Engine torque effect** -- in a C172 with a counterclockwise-rotating-when-viewed-from-cockpit prop, left turns are slightly easier (torque adds to the turn) and right turns are slightly harder (torque opposes). The student must add slightly more right rudder for the right turn coordination.
- **Visual reference shift** -- the entry reference is now in a different position; the student must select a new reference for the new heading.
- **Adverse-yaw direction** -- aileron-induced adverse yaw flips direction. The rudder coordination input flips direction.
- **Pilot's preferred-side bias** -- most pilots have a "good side" they fly cleaner. The other side reveals coordination weaknesses.

The transition between the two turns is also a maneuver in itself. Roll out from the first turn cleanly. Stabilise wings-level. Brief the second turn. Roll into the second turn. Do not chain them as one continuous motion; the transition is the chance to reset.

### Q7. What are the common errors and their fixes?

| Error                             | Cause                                                  | Fix                                                     |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Loss of altitude                  | Insufficient back-pressure / no trim                   | Trim during roll-in; add back-pressure as bank steepens |
| Gain of altitude                  | Excess back-pressure / over-trimmed                    | Release back-pressure; check trim                       |
| Overbank (50+)                    | Aileron not held centered against overbanking tendency | Active aileron pressure; momentary opposite aileron     |
| Shallow bank (40-)                | Aileron drift, especially on weak side                 | Hold aileron pressure; check trim                       |
| Airspeed loss                     | Insufficient throttle compensation                     | Add 100-200 RPM at the steep bank                       |
| Heading bust on rollout           | Late or no roll-out lead                               | Lead by ~half the bank angle                            |
| Skidding turn (rudder to tighten) | Pilot using rudder as a turn control                   | Rudder is for coordination only; bank drives the turn   |
| Loss of outside reference         | Pilot fixating on panel                                | 80% outside, 20% inside; wing-tip is the bank cue       |
| Maneuver disintegrates after 270° | Trim drift, scan fatigue                               | Re-trim during the turn if needed; verbalise altitude   |

The first-line correction for any of these is "verbalise the deviation, apply a small correction, re-check on next cycle." Do not let the correction become large.

### Q8. When do you abort the maneuver?

Abort and re-set when:

- Altitude exceeds tolerance (more than 100 ft from entry) and trend is not reversing.
- Bank exceeds 55° and the recovery is not immediate.
- Airspeed drops within 10 KIAS of stall (Vs at 45 bank in C172 ≈ 57 KIAS clean; pull-up reduces margin further).
- Traffic appears in the area at your altitude.
- You become disoriented or task-saturated.

The abort technique: roll wings level, climb if low, breathe, restart with a cleaner entry. There is no shame in restarting; the shame is in pressing into a maneuver that is failing.

### What Discover should have led you to

- Entry checklist: altitude / clear / reference / airspeed / trim / brief.
- Roll-in is smooth + simultaneous (aileron + back-pressure + trim + throttle).
- Trim during roll-in is the secret weapon.
- Steady-state scan: 80% outside, 20% inside; wing-tip is the bank cue.
- Roll-out lead is about half the bank angle in degrees of heading.
- Second-direction turn reveals coordination weaknesses.
- Abort and re-set when conditions exceed recoverable tolerances.

## Reveal

### The summary rule

> Steep turn: clear the area, select an outside reference, establish recommended airspeed (or Va), trim. Roll in smoothly to 45° while adding back-pressure, trim, and small throttle. Hold for 360° with continuous small corrections; scan 80% outside (wing-tip vs. horizon for bank, cowling-vs-horizon for pitch), 20% inside (panel confirms). Lead the roll-out by approximately half the bank angle. Roll out smoothly; release back-pressure, trim, and throttle as bank decreases. Reset wings-level, brief the second-direction turn, repeat. Tolerances: altitude ±100 ft, airspeed ±10 kt, bank ±5°, heading ±10° on rollout. The integrated control task wins; fighting each variable independently loses.

### The procedure

```text
ENTRY:
  1. Altitude check (>= 1,500 AGL recommended)
  2. Clear the area (two 90° turns, scan high-low-high)
  3. Select entry heading toward a visible reference
  4. Establish airspeed (POH-recommended; default not above Va)
  5. Trim for level flight at entry airspeed
  6. Brief the maneuver out loud

ROLL-IN (3-5 sec):
  7. Apply aileron to roll toward 45°
  8. Add back-pressure as bank passes 30°
  9. Add nose-up trim (1-2 turns C172) as bank passes 35°
 10. Add throttle if airspeed bleeds (100-200 RPM C172)
 11. Maintain coordination with rudder (small input)
 12. Freeze aileron pressure at 45°

STEADY STATE (~25-30 sec):
 13. Scan: bank -> altitude -> airspeed -> outside-for-traffic
 14. Tempo: 2-3 sec per channel, continuous
 15. Apply small continuous corrections
 16. Verbalise notable deviations and corrections

ROLL-OUT (3-5 sec):
 17. Lead by ~22° of heading (half the bank angle at 45°)
 18. Reduce aileron pressure to roll out
 19. Release back-pressure as bank decreases
 20. Release trim back to neutral
 21. Reduce throttle as airspeed stabilises
 22. Wings level at target heading

VERIFY:
 23. Heading on entry heading ±10°?
 24. Altitude at entry altitude ±100 ft?
 25. Airspeed at entry airspeed ±10 kt?

REPEAT IN OPPOSITE DIRECTION (V.A.S4):
 26. Stabilise wings level
 27. Brief the opposite-direction maneuver
 28. Steps 7-25 in the new direction
```

### The control input summary

| Variable     | Primary control | Secondary effect                                                 |
| ------------ | --------------- | ---------------------------------------------------------------- |
| Bank         | Aileron         | Affects required back-pressure                                   |
| Pitch        | Elevator        | Affects airspeed                                                 |
| Coordination | Rudder          | Should not affect bank                                           |
| Airspeed     | Throttle        | Affects required pitch trim                                      |
| Trim         | Trim wheel      | Reduces stick force; same effect as continuous elevator pressure |

### The roll-out lead

```text
lead (degrees) ≈ bank (degrees) / 2

At 30° bank: lead 15°
At 45° bank: lead 22°
At 60° bank: lead 30°  (steep-turn bank only at CPL+; not PPL)
```

### What is actually authoritative

In descending order:

1. **POH Section 5** -- airplane-specific maneuver airspeed and any constraints.
2. **AFH "Performance Maneuvers" chapter** -- the canonical technique.
3. **ACS PPL-A V.A** -- the tolerances and required performance.
4. **PHAK Aerodynamics chapter** -- the load-factor and stall-margin background.

## Practice

### Cards (spaced memory items)

- `card:est-entry-checklist` -- "Steep turn entry checklist?" -> "Altitude check / clear / reference / airspeed / trim / brief."
- `card:est-rollin-trim` -- "Why trim during roll-in?" -> "Reduces back-pressure required at 45 bank; lets the pilot scan freely instead of fighting stick force."
- `card:est-scan` -- "Steep turn scan distribution?" -> "80% outside (wing-tip vs. horizon), 20% inside (panel confirms)."
- `card:est-rollout-lead` -- "Roll-out lead at 45 bank?" -> "Approximately half the bank: 22° of heading."
- `card:est-overbank-fix` -- "Recovery from overbank (50°+)?" -> "Smoothly release aileron or apply opposite aileron. Do NOT use rudder."
- `card:est-altitude-loss-fix` -- "Recovery from altitude loss?" -> "Add back-pressure; if significant, momentarily reduce bank to recover vertical lift."
- `card:est-abort-criteria` -- "When do you abort a steep turn?" -> "Altitude > 100 ft off and trend not reversing; bank > 55°; airspeed within 10 of Vs; traffic in area; pilot disorientation."

### Reps (scenario IDs)

- `scenario:est-clean-execution` -- pilot demonstrates clean entry, steady state, and rollout within ACS tolerances in both directions.
- `scenario:est-altitude-recovery` -- pilot drifts 80 ft low at 270°; demonstrates correction without overshoot.
- `scenario:est-overbank-recovery` -- pilot reaches 52° bank at 90°; demonstrates aileron-only recovery without rudder.
- `scenario:est-direction-transition` -- pilot completes first turn cleanly, transitions, and executes the opposite-direction turn revealing coordination differences.
- `scenario:est-traffic-abort` -- mid-maneuver, traffic appears at the altitude block; pilot rolls wings level, navigates around, decides whether to resume or relocate.

### Drills (time-pressured)

- `drill:est-entry-recite` -- pilot recites the entry checklist in 15 seconds.
- `drill:est-rollout-lead` -- given a target heading, pilot calls the roll-out start heading at 45 bank in 3 seconds.
- `drill:est-correction-call` -- CFI calls a deviation; pilot responds with the correction direction and magnitude in 3 seconds.
- `drill:est-scan-watch` -- CFI watches pilot's eyes for a full 360; verifies the rotation continues throughout (no fixation).

## Connect

### What changes if...

- **...you are flying a Cessna 172 (typical)?** Recommended airspeed ~95 KIAS, 45 bank, 1-2 turns nose-up trim during roll-in. Coordination requires slightly more right rudder than left.
- **...you are flying a Piper Cherokee (low-wing)?** The visible horizon reference shifts; the wing covers ground in turns. Use the cowling and the spinner against the horizon. Recommended airspeed similar (95 KIAS); check the POH.
- **...you are at high density altitude?** True airspeed is higher than indicated. The airplane responds slower in roll. Allow longer for roll-in and roll-out. Stall margin in the steep turn is unchanged because Vs is indicated, not true.
- **...you are flying CPL?** Bank is 50° instead of 45°. Load factor is 1.56 G instead of 1.41. Stall speed multiplier is 1.25 instead of 1.19. Tolerances are the same numbers but the maneuver itself is more demanding. Same technique scaled up.
- **...you are practicing solo?** Self-evaluate after every turn. Note what drifted first. Plan the next attempt. Do not chain failed turns; reset and re-enter cleanly.
- **...you are teaching a primary student?** Demonstrate first; let them feel the trim, the back-pressure, the wing-tip reference. Then have them fly with verbal coaching. Then silent observation. Three flights minimum to consolidate the maneuver.
- **...you are demonstrating in turbulence?** Postpone if possible. The deviation tolerances do not loosen, but turbulence makes them much harder to hold. Smooth-air practice first; turbulence practice after the maneuver is consolidated.

### Links

- `proc-clear-the-area` -- the prefix that owns the airspace.
- `proc-maneuvering-airspeeds` -- Va and the recommended airspeed.
- `proc-acs-tolerances` -- the success criteria.
- `proc-attention-management` -- the scan that keeps the maneuver in tolerance.
- `aero-load-factor-and-bank-angle` -- the physics: 1.41 G at 45 bank, Vs increases 19%.
- `aero-coordination-rudder` -- coordination during the turn.
- `aero-uncoordinated-flight` -- the kill chain to avoid (rudder to tighten).
- `proc-stall-recovery` -- the recovery if accelerated stall develops.

## Verify

### Novel scenario (narrative)

> You are demonstrating steep turns in a Cessna 172 at 3,500 MSL, 95 KIAS. Your first turn (right) is clean -- entry heading 090, rollout heading 088 (within tolerance), altitude back at 3,510 (10 high), airspeed 94 (1 slow). Your CFI says "now the same in the other direction." Walk through the next 90 seconds.

Scoring rubric:

- Stabilises wings level briefly to reset; does not chain into the second turn immediately. (1)
- Briefs out loud: "Steep turn left, 45 bank, hold for 360, roll out on 090." (1)
- Selects an outside reference for the new heading direction. (1)
- Roll-in: smooth aileron-left, back-pressure additive, trim if needed (probably not -- already trimmed from first turn), small left rudder for coordination. (3)
- Notes that left turns in a C172 are slightly easier (torque alignment); slightly less rudder needed. (1)
- Steady-state: scan tempo 2-3 sec per channel, 80% outside; verbalises any deviation. (2)
- At ~270° heading (90° before rollout), begins lead: starts roll-out at heading 112°. (2)
- Roll-out: aileron-right to wings level, release back-pressure, release trim, throttle adjustment. (2)
- Verifies rollout: heading 088-092, altitude 3,400-3,600, airspeed 85-105. (1)

14/14 is the bar. Below 10 is a redo.

### Teaching exercise (CFI)

> A student demonstrates clean steep turns to the right but consistently struggles with the left turn -- they finish 200 feet low and 15 knots slow every time. Diagnose using the integrated-control framework and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is fighting the airplane in the left turn. The right turn is their preferred side; muscle memory and trim feel are correct. The left turn forces them to apply different rudder and aileron inputs that they have not practiced as much. Specifically, the back-pressure they apply on the right turn is being undone by other corrections during the left turn (perhaps over-correcting bank, which reduces the back-pressure they need, which they then under-supply on the next cycle).
- Teaching point: the left turn is its own maneuver, not a mirror of the right. Treat it as a separate skill until it consolidates.
- Drill: practice left turns alone for an entire session. Skip the right turn. The student needs the left turn to become as automatic as the right.
- Specific input check: have the student call out trim setting at the start, after roll-in, and at the end. Likely they are not trimming for the left turn. Add 1-2 nose-up trim during left roll-in just like the right.
- Visual reference: have the student name the outside reference for the left turn before rolling in. Without a reference, the rollout is sloppy and the maneuver feels worse, which feeds back into the next correction.
- The CFI is patient but specific: "You are not bad at left turns; you just have not practiced left turns as much. Let's fix the practice asymmetry."

The pedagogical move is to refuse the framing of "good at right, bad at left" and reframe as "right is consolidated, left needs more reps." The maneuver is not asymmetric in the airplane; it is asymmetric in the student's training history. Repetition with attention closes the gap.
