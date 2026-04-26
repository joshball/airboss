---
# === Identity ===
id: proc-overspeed-recovery
title: Overspeed Recovery
domain: emergency-procedures
cross_domains:
  - aerodynamics
  - aircraft-systems

# === Knowledge character ===
# procedural: there is a default response (reduce power, raise nose smoothly,
#   stay below Va, do not deploy speedbrakes/flaps/gear if airspeed exceeds
#   their maximum extension speeds).
# factual: V-speeds (Vne, Vno, Va, Vle, Vfe) define the structural envelope;
#   overspeed is exceeding Vne (red line) and is a structural emergency.
# judgment: which limits to break (gear/flap extension speeds for additional
#   drag) versus which to absolutely not break (Vne, structural pull). Pilot
#   judgment under speed-up surprise is the safety-critical move.
knowledge_types:
  - procedural
  - factual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires:
  - aero-load-factor-and-bank-angle
  - aero-four-forces
deepens: []
applied_by: []
taught_by: []
related:
  - proc-unusual-attitude-recovery
  - proc-pitot-static-failures

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 45
review_time_minutes: 8

# === References ===
references:
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 5 -- Aerodynamics; V-speeds and the airspeed indicator color coding
    note: >-
      Authoritative for the relationship of V-speeds (Vne, Vno, Va, Vfe,
      Vle) to the structural and aerodynamic envelope, and the airspeed-
      indicator color bands that visualise them.
  - source: AFH (FAA-H-8083-3B)
    detail: Recovery from high-speed dives, spiral instability, dive recovery
    note: >-
      Practical recovery technique from high-speed descending flight. The
      AFH treats overspeed as a subset of unusual-attitude recovery and is
      consistent with the IFH framing.
  - source: POH / AFM
    detail: Section 2 -- Limitations; Section 3 -- Emergency Procedures
    note: >-
      The numbers. Vne, Vno, Va (typically given at MTOW; Va decreases
      with weight), Vfe, Vle. Section 3 may include a high-speed dive or
      spiral recovery procedure.
  - source: FAR 23 / Part 91
    detail: 14 CFR 23.1505 (operating speed limits) and 91.13 (careless / reckless)
    note: >-
      Airworthiness standards define the structural envelope; the operating
      regs define the obligation to not exceed it.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - scenario
  - demonstration
mastery_criteria: >-
  Learner can: (1) recite Vne, Vno, Va, Vfe, and Vle for their training
  airplane; (2) identify the airspeed indicator color bands and the
  V-speeds at the band boundaries; (3) execute the recovery from an
  inadvertent overspeed (reduce power, smooth pitch-up, do not extend
  flaps/gear above their respective max extension speeds); (4) explain
  why Va decreases with weight and how that affects maneuvering in
  turbulence; (5) describe at least three scenarios that produce
  inadvertent overspeed (descent without throttle reduction, spiral
  from autopilot fail, recovery from unusual attitude with insufficient
  power management).
---

# Overspeed Recovery

## Context

Vne is a hard limit. Below Vne, the airplane is certified to fly. At Vne, structural margin is at the rated limit. Above Vne, the airplane is in territory the certification did not cover -- flutter onset, control reversal, structural failure of the airframe under aerodynamic load, or some combination. Pilots who fly past Vne and recover are usually flying a stronger airplane than its certification rating, and they are usually unaware of how close they came.

Overspeed in light singles happens in three predictable ways. First, the airplane is descending and the pilot did not retard power; speed builds without the pilot noticing because their attention is elsewhere. Second, the airplane is in a spiral or steep bank from spatial disorientation or autopilot failure, and the spiral builds airspeed as it builds bank. Third, the pilot recovered from an unusual attitude or near-stall by pushing the nose down and adding power without thinking about how that combination converts altitude into airspeed in seconds.

The recovery is short: reduce power, raise the nose smoothly, do not exceed structural limits during the pull-up, and do not deploy drag devices (flaps, gear) above their certified extension speeds. The discipline is keeping the pull-up smooth. A snatch on the elevator at 150+ KIAS in a 30-degree bank can exceed limit load factor; the airplane comes apart, or the wing G-stalls accelerated and rolls into a deeper dive.

This node lives next to `proc-unusual-attitude-recovery`. Nose-low unusual attitudes that go uncorrected become overspeed events. Once airspeed is past Vno (top of the green arc, into the yellow), every additional knot of indicated airspeed is borrowed against the airframe's gust margin. Past Vne, the borrowing is over.

## Problem

You are descending IMC from 9,000 to 4,000 in a Cessna 172. Vne is 163 KIAS (typical for the type; verify your POH). You set up a 1,000 fpm descent at 100 KIAS with reduced power, no flaps. About four minutes into the descent, you look up from a chart to find the airplane in a 35-degree right bank, nose 15 degrees below the horizon, airspeed at 155 KIAS, altitude passing 5,200 and dropping at 2,500 fpm.

What is your sequence in the next 5 seconds, and what do you watch for during the recovery?

Write your answer before reading on. Then ask: what changes in your recovery if airspeed has already crossed Vne by the time you act?

## Discover

The recovery decomposes into limits, sequence, and traps. Work each.

### Q1. Why is Vne the hard limit?

Vne is set by either flutter onset (aeroelastic resonance of control surfaces or wings) or structural limit at the certified gust loading. Flutter is destructive and fast: a flutter onset at Vne+5 KIAS can shed an aileron or a stabiliser within seconds. Structural limits are gust-margin issues: the airplane is certified to absorb a 25-50 fps gust at Vno without exceeding limit load; at higher airspeeds, the same gust produces overload.

Above Vne, the airplane has departed its certified envelope. Recovery is theoretically possible (and is documented after the fact in many GA accidents that did not result in inflight breakup) but the failure mode is unbounded.

### Q2. What does the airspeed indicator color coding tell you?

| Band             | Meaning                                                                | Speed range                          |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| White arc        | Flap operating range; Vso (lower) to Vfe (upper)                       | Vso to Vfe                           |
| Green arc        | Normal operating range; Vs (lower) to Vno (upper)                      | Vs to Vno                            |
| Yellow arc       | Caution range; Vno to Vne. Smooth air only; turbulence forbidden       | Vno to Vne                           |
| Red line         | Vne. Never exceed.                                                     | At Vne                               |
| Blue line (twin) | Vyse, single-engine best rate of climb                                 | Type-specific                        |

The bands are not just decoration. Yellow says "smooth air only" because turbulence at this speed can spike load factor past limits. Red is non-negotiable. A pilot in yellow with rising airspeed should be reducing power or pitching up RIGHT NOW.

### Q3. What is the recovery sequence?

```text
1. Reduce power. Idle if necessary.
2. Level the wings if banked (do not pull in a steep bank -- accelerated stall
   risk, structural overload risk).
3. Pitch up smoothly. Smooth means continuous; not abrupt.
4. Avoid Va by not pulling more than ~3 G during recovery.
5. As airspeed bleeds back into the green, return to assigned altitude.
6. Do NOT deploy flaps or gear if airspeed exceeds their maximum
   extension speeds (Vfe, Vle). Drag from those devices on overspeed
   approach can cause structural damage to the device or the airframe.
```

### Q4. What is Va and why does it matter for recovery?

Va is maneuvering speed -- the maximum speed at which a full or abrupt control input will not exceed limit load factor. Above Va, the airplane can be overstressed by full-deflection elevator. Va decreases with weight (lighter airplane stalls earlier under load, so the speed at which a full pull produces 3.8G is lower).

In recovery, you typically pull less than full-deflection and you smooth the pull. Even so, recovery from 150 KIAS in a steep bank is above Va for most light singles at typical weights, so the pull must be smooth and the bank must come out first.

### Q5. What is the spiral instability connection?

Most light singles are spirally unstable in instrument conditions. Without active rolling-out input from the pilot or autopilot, a small bank tends to grow over time. As bank grows, vertical lift component drops, the airplane descends, airspeed builds, lift builds, the bank tightens further. This is the "graveyard spiral."

Without intervention, an unmonitored airplane in IMC can be in a 60-degree spiral with airspeed past Vne in 60-90 seconds from a 5-degree initial bank. The recovery from a fully developed spiral is overspeed recovery plus unusual-attitude recovery merged.

### Q6. What about extending drag (flaps, gear) to slow down?

Flaps and gear have extension speed limits (Vfe and Vle respectively). Below those limits, deploy them is acceptable additional drag. Above those limits, deploying them risks:

- Flap damage / structural damage to the wing-flap interface.
- Gear-door damage / gear strut damage / inability to retract afterward.
- Asymmetric extension (one side deploys, the other does not) producing a roll moment.

Do not extend gear or flaps to slow down from overspeed. Reduce power first; let aerodynamic drag bleed the speed; then return to a normal configuration.

Some retractable airplanes have specific procedures for using gear as a speedbrake within their limits; consult the POH.

### What Discover should have led you to

- Vne is a structural / flutter limit; above it, the airplane is in unbounded territory.
- The yellow arc is "smooth air only" -- turbulence in yellow can overload.
- Recovery: reduce power, level wings, smooth pitch-up, do not exceed Va in the pull, do not deploy drag devices above their limits.
- Spiral instability builds overspeed silently in IMC; trained pilot or autopilot keeps it bounded.
- Smooth elevator inputs prevent structural overload during the pull.

## Reveal

### The summary rule

> Overspeed (above Vno into yellow, or above Vne into red): immediately reduce power, level the wings if banked, then smoothly pitch up to bleed airspeed. Do not pull abruptly above Va; do not deploy flaps or gear above their certified extension speeds (Vfe, Vle). Once below Vno, return to assigned altitude / heading. Above Vne, the airplane is outside its certified envelope; recovery technique is the same but the structural margin is gone -- assume something on the airplane has been damaged and land at the nearest suitable airport for inspection.

### V-speed reference (typical, illustrative -- POH wins)

| V-speed | Definition                                       | Typical C172 | Typical PA28-181 |
| ------- | ------------------------------------------------ | ------------ | ---------------- |
| Vso     | Stall speed, full flaps, MTOW                    | 40 KIAS      | 49 KIAS          |
| Vs      | Stall speed, clean, MTOW                         | 48 KIAS      | 55 KIAS          |
| Vy      | Best rate of climb                               | 74 KIAS      | 79 KIAS          |
| Vx      | Best angle of climb                              | 60 KIAS      | 64 KIAS          |
| Va      | Maneuvering, MTOW (decreases with weight)        | 99 KIAS      | 113 KIAS         |
| Vno     | Max structural cruising; top of green            | 129 KIAS     | 125 KIAS         |
| Vne     | Never exceed; red line                           | 163 KIAS     | 154 KIAS         |
| Vfe     | Max flap extension                               | 85-110 KIAS  | 103 KIAS         |
| Vle     | Max landing gear operation/extended (retract)    | n/a          | n/a              |

POH numbers vary by year, model, and configuration. These are illustrative.

### The recovery sequence in detail

```text
1. POWER: idle (or as needed). Smooth, not slammed.
2. BANK: if banked, coordinated aileron + rudder to level. Do not pull in
   the bank.
3. PITCH: smooth aft pressure. Target: 2-3 G during pull-up max.
4. SCAN: airspeed through Vno, then through Vy/Vno target. Altitude lost
   during recovery is the cost of not exceeding Va.
5. ALTITUDE: re-establish assigned altitude after airspeed back in green.
6. RADIO: notify ATC if altitude bust or course deviation occurred.
7. AIRCRAFT: if Vne was exceeded, land at nearest suitable airport for
   inspection -- flutter and overstress damage may not be visible from
   the cockpit.
```

### The Va decreases with weight rule

Va decreases as the airplane gets lighter because a lighter wing stalls at lower load factor for a given pull. Manufacturers may publish Va at multiple weights:

- C172 at 2,300 lb (MTOW): Va = 99 KIAS.
- C172 at 2,000 lb: Va = ~92 KIAS.
- C172 at 1,800 lb (near min): Va = ~88 KIAS.

In practice, in turbulence, fly Va or below for the current weight. Many pilots fly the published MTOW Va number always, which is overconservative when light and dangerously underconservative when only listed at MTOW (some POHs do not publish lighter-weight Va). Read your specific POH.

### Smooth vs. abrupt pull

Smooth pull-up at 150 KIAS, 30 bank, in a C172:

- Pull rate ~1 deg/sec pitch.
- Load factor builds smoothly to ~2.5 G.
- Airspeed bleeds 5-10 KIAS per second once nose comes up.

Abrupt pull-up at 150 KIAS, 30 bank:

- Pull rate ~5 deg/sec pitch.
- Load factor spikes to 4-5 G or more.
- Airframe certified to 3.8 G (normal category) -- exceeded. Structural damage possible.

The difference is the time between starting the pull and reaching level. Smooth = 4-5 seconds. Abrupt = 1-2 seconds.

### Flutter and the Vne argument

Flutter is the resonance of an aerodynamic surface (aileron, elevator, rudder, sometimes wing) at airspeeds where airflow energy can sustain oscillation. Once flutter starts, it is not damped by normal damping mechanisms; it grows. Flutter onset is type-specific and is one factor in setting Vne.

Some types are flutter-limited (Vne is set by flutter); others are structural-limit-limited (Vne is set by gust loading). Either way, exceeding Vne is exceeding the certification basis. The pilot does not know which limit is binding without consulting type-specific airworthiness data; the operational rule is the same: do not exceed Vne, ever.

### What is actually authoritative

In descending order:

1. **POH Section 2** -- limitations -- the V-speed table.
2. **POH Section 3** -- emergency procedures -- spiral / dive / overspeed recovery if specified.
3. **AFH** -- chapter on dive / spiral recovery.
4. **PHAK Chapter 5** -- the underlying aerodynamics of V-speeds.

### location_skill

- POH Section 2 -- V-speed table; airspeed indicator markings.
- POH Section 4 / 5 -- maneuvering speed at various weights (if published).
- POH Section 7 -- flap and gear systems descriptions including extension speeds.

## Practice

### Cards (spaced memory items)

- `card:os-vne-meaning` -- "What does Vne represent?" -> "Never-exceed speed; structural / flutter limit; certification envelope boundary."
- `card:os-yellow-arc-rule" -- "Operational rule for the yellow arc (Vno to Vne)?" -> "Smooth air only; not for turbulence."
- `card:os-recovery-first-action" -- "First action on overspeed recognition?" -> "Reduce power."
- `card:os-pitch-then-bank-or-bank-then-pitch" -- "In overspeed with bank, recovery order?" -> "Reduce power; level wings; then pitch up smoothly."
- `card:os-va-with-weight" -- "How does Va change with weight?" -> "Decreases as weight decreases."
- `card:os-flaps-gear-overspeed" -- "Should you deploy flaps or gear to slow down from overspeed?" -> "Not above Vfe / Vle; the device-extension speed limits prevent structural damage to the device."
- `card:os-vno-yellow-arc" -- "Top of the green arc / bottom of the yellow arc?" -> "Vno -- max structural cruising speed."
- `card:os-spiral-instability" -- "Why does a small uncorrected bank in IMC become an overspeed event?" -> "Spiral instability: lift vector tilts as bank grows, airplane descends, airspeed builds, bank tightens; positive feedback loop."
- `card:os-recovery-after-vne" -- "After exceeding Vne and recovering, what next?" -> "Land at nearest suitable airport; inspect for flutter / structural damage; do not continue."
- `card:os-smooth-pull-vs-abrupt" -- "Why is a smooth pull-up critical above Va?" -> "Abrupt elevator at high airspeed spikes load factor and can exceed limit load (3.8G normal); smooth pull keeps G in tolerable range."

### Reps (scenario IDs)

- `scenario:os-spiral-from-AP-fail" -- autopilot disengages in IMC; pilot is head-down; airplane spirals into Vne territory.
- `scenario:os-descent-no-throttle-reduction" -- pilot starts a descent and forgets to retard throttle; airspeed climbs through Vno into yellow; turbulence patches in.
- `scenario:os-recovery-from-unusual-attitude-overshoot" -- pilot recovers from a near-stall by pushing the nose down hard and adding full power; ends up in nose-low overspeed.
- `scenario:os-spiral-instability-graveyard" -- IMC, no autopilot, pilot follows body cues into a 60 banked descent; airspeed crossing Vne; pilot must recover.
- `scenario:os-pitot-static-fooled-into-pull-up" -- ASI lying high; pilot interprets as overspeed and retards power; actual airspeed was nominal. False overspeed; aircraft control degrades from unnecessary inputs.

### Drills (time-pressured)

- `drill:os-vspeed-recall" -- 10 V-speeds for the training airplane; learner recites in 30 seconds.
- `drill:os-yellow-arc-decision" -- airspeed shown in yellow with rising trend; learner calls out the action sequence.
- `drill:os-recovery-sequence-recall" -- instructor cues an overspeed scenario; learner names the recovery in order with control input descriptions.
- `drill:os-smooth-vs-abrupt-G-feel" -- in a sim, learner pulls smooth then abrupt; G-meter shows the difference; learner verbalises tactile difference.

### Back-of-envelope calculations

**Calculation 1: load factor in a banked pull-up.**

C172 at 150 KIAS, 30-degree bank. Pull to G_load = 3.0:

Load factor at 30 bank, level: 1.15 G.
Additional G from pull-up: 3.0 - 1.15 = 1.85 G.

Stall speed at 3 G: Vs * sqrt(3) = 48 * 1.73 = 83 KIAS. At 150 KIAS, 67 KIAS margin.

Above Va (99 KIAS): full elevator deflection at 3 G is structurally fine, but a 5+ G snatch would overload. Smooth pull keeps G to ~3 max.

**Calculation 2: airspeed-bleed during pull-up.**

In a 1.85-G pull-up from 150 KIAS, 30 bank, level off:

- Drag increases roughly with G squared; induced drag spikes.
- Airspeed bleeds at roughly 5-10 KIAS per second during the pull.
- 4-5 seconds to level brings 150 KIAS down to 110-120 KIAS.

This is acceptable. Recovery is complete in 4-5 seconds with airspeed back into the green; altitude lost is roughly 200-400 feet.

**Calculation 3: time from bank to overspeed in spiral.**

Starting from 5-degree bank, 100 KIAS, level cruise, no input:

- Bank doubles in roughly 30-60 seconds (spiral instability time constant; type-dependent).
- At 30 bank, descent rate ~500 fpm; airspeed climbs ~2 KIAS/sec.
- At 60 bank, descent rate ~2,000 fpm; airspeed climbs ~5 KIAS/sec.

From level cruise to Vne penetration in ~60-90 seconds without intervention. Pilot's cross-check needs to catch the bank well before that.

## Connect

### What changes if...

- **...you fly a high-performance airplane?** Vne is closer to cruise; the speed margin to overspeed is smaller. Power management in descent matters more. Some have automatic power-management features that trigger on overspeed; trust them but verify.
- **...you are in turbulence?** Below Va. Period. Above Va in turbulence, gust loading can spike past limit load.
- **...you are over Vne already?** Same recovery, but assume you have damaged the airplane. Land nearest. Inspect.
- **...you are in a glider / experimental?** V-speeds are airplane-specific; some experimentals have soft Vne (recommended) vs. hard structural limits. Read the AFM.
- **...the pitot-static system is lying about airspeed?** You may interpret a normal flight as overspeed and degrade the airplane unnecessarily. Cross-check airspeed against attitude + power. See `proc-pitot-static-failures`.
- **...you have an autopilot in vertical-speed mode?** AP will hold the commanded VS even if it requires unsafe airspeed (overspeed in descent or stall in climb). Monitor airspeed; intervene before the AP acts you into a corner.
- **...the airplane is operating at high density altitude in cruise?** TAS at a given IAS is higher; structural margin to Vne in IAS is unchanged but the airplane is moving faster over the ground. Vne is IAS-defined for piston singles; structural limit is based on dynamic pressure (which is IAS-related).
- **...you fly above 10,000 MSL?** Mach number becomes relevant in some airplanes (turboprops, jets). Overspeed has both Vmo (max operating, IAS-based) and Mmo (max Mach) limits. Light singles do not see Mach issues but turboprops might.

### Links

- `aero-load-factor-and-bank-angle` -- the structural and stall implications during the pull-up.
- `aero-four-forces` -- the equilibrium being broken during overspeed (excess thrust + lost drag = airspeed gain).
- `proc-unusual-attitude-recovery` -- nose-low unusual attitudes that go uncorrected become overspeed events; merged sequence.
- `proc-pitot-static-failures` -- false overspeed indications from a lying ASI.
- `proc-instrument-cross-check` -- the active discipline that catches the spiral before it becomes overspeed.

## Verify

### Novel scenario (narrative)

> You are at 9,000 in IMC, descending toward 5,000 in a Cessna 172. You set up a 1,000 fpm descent at 110 KIAS with reduced power. The autopilot is on in altitude / heading mode. You glance at a chart for about 12 seconds. When you look up, the AI shows 40 degrees of right bank, 20 nose down. Airspeed is 165 KIAS. Vne is 163 KIAS. Altitude is 6,200 and falling at 3,500 fpm. The autopilot disengaged at some point without your noticing.
>
> Walk through the next 5 seconds. Be specific about each control input and its expected effect. After recovery, what do you do?

Scoring rubric:

- Identifies overspeed plus nose-low unusual attitude. (1)
- Step 1: power to idle. (2)
- Step 2: levels the wings with coordinated aileron and rudder; rejects the impulse to pull while banked. (3)
- Step 3: smooth pitch-up; explicitly avoids snatching; targets 2-3 G during pull. (3)
- Acknowledges Vne was crossed; airplane is now suspect. (1)
- Calls ATC: "Center, Cessna 12345, encountered Vne event, recovering, request lower / nearest suitable airport." (2)
- States that on the ground, airplane goes to maintenance for inspection (flutter / structural damage assessment). (2)
- Self-debriefs: long head-down chart read with no autopilot monitor announcement; will use timer or smaller chart references; will set AP-disconnect alert if equipped. (1)

15/15 is the bar. Below 11 is a redo.

### Teaching exercise (CFI)

> A primary student in their instrument-rating training, in a sim, recovers correctly from a nose-low unusual attitude but consistently lets airspeed climb into the yellow arc during the recovery. They explain that they are "not pulling too hard" and are giving themselves margin. They have not connected the yellow arc to a turbulence-only restriction and the structural-margin issue.
>
> Diagnose the gap and write the post-flight teaching point and the next-flight exercise.

Evaluation criteria:

- Diagnosis: student is over-prioritising "smooth pull" at the expense of timely power reduction. The yellow arc should be transient (a few seconds) during recovery; sustained yellow indicates power was not reduced aggressively enough.
- Teaching point: yellow arc is not "permitted with care"; it is "smooth air only and only briefly." During recovery, power must come off first because every second in yellow is a second of accumulating airframe risk if turbulence patches in.
- Next-flight exercise: 10 simulated overspeed entries in the sim; CFII grades on (a) time from recognition to power retraction, (b) time in yellow during recovery, (c) airspeed margin to Vne. Target: power off within 1 second of recognition; yellow arc transit under 5 seconds.
- Frames the broader lesson: pilots who treat recovery procedures as "smooth and slow" sometimes neglect aggressive immediate actions. Smooth applies to the pull-up; power reduction is fast.
- The CFII does not punish the student's caution; they reframe what part of the recovery should be aggressive.

The pedagogical move is to separate "smooth" (which applies to the pull) from "aggressive" (which applies to the power reduction). The student conflated them.
