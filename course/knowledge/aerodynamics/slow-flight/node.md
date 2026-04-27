---
# === Identity ===
id: aero-slow-flight
title: Slow Flight
domain: aerodynamics
cross_domains:
  - vfr-operations

# === Knowledge character ===
# perceptual: slow flight is mostly about reading the airplane -- mushy
#   controls, high power demand for level flight, behavior of the rudder
#   to counter increasing P-factor.
# procedural: there is a setup (configuration, power, pitch attitude) and
#   a recovery (lower nose, level wings, accept altitude loss while
#   accelerating, return to normal cruise).
# conceptual: slow flight is operation on the back side of the power curve
#   in some configurations -- where adding power loses altitude and
#   reducing power produces a stall.
knowledge_types:
  - perceptual
  - procedural
  - conceptual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: standard
requires:
  - aero-four-forces
  - aero-angle-of-attack-and-stall
deepens: []
applied_by: []
taught_by: []
related:
  - aero-cg-and-stability
  - aero-coordination-rudder
  - proc-stall-recovery

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 45
review_time_minutes: 8

# === References ===
references:
  - source: AFH (FAA-H-8083-3B)
    detail: Chapter 4 -- Slow Flight, Stalls, and Spins
    note: >-
      Authoritative on the maneuver, recovery, and the FAA's specific
      training profile (slow flight at "minimum controllable airspeed"
      where the airplane is just above stall, approach configuration).
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 5 -- Aerodynamics; Chapter 11 -- Aircraft Performance
    note: >-
      The power curve: induced drag rising, parasite drag decreasing as
      airspeed drops; back-side-of-power-curve discussion.
  - source: ACS / PTS standards
    detail: Slow flight maneuver task elements
    note: >-
      Examiner expectations: maintain minimum controllable airspeed
      without stall warning, hold altitude, perform turns to specified
      heading, recover to normal cruise.
  - source: AC 61-67C
    detail: Stall and Spin Awareness Training
    note: >-
      Slow flight is the training regime closest to stall; awareness
      and rudder discipline are emphasised here.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - recall
  - scenario
mastery_criteria: >-
  Learner can: (1) set up slow flight at minimum controllable airspeed
  (just above stall warning) in approach configuration; (2) hold altitude
  within 100 feet; (3) make coordinated 30-degree-banked turns to assigned
  headings without stalling; (4) recognise and verbally identify the
  back-side-of-the-power-curve regime; (5) execute a normal recovery
  (lower nose, full power, raise flaps in stages, return to cruise) and
  a stall-imminent recovery (AOA reduction first); (6) explain why
  rudder demand increases at slow flight and the consequences of failing
  to use it.
---

# Slow Flight

## Context

Slow flight is the airplane operating at the slow edge of its envelope: just above stall, mushy on the controls, demanding rudder, eating power to hold altitude. It is also where most landings are flown. Approach speed in a typical light single is about 1.3 times stall speed (Vso), which puts the airplane firmly in the slow-flight regime for the last quarter mile of every flight. A pilot who is uncomfortable in slow flight is uncomfortable in the flare; a pilot who is comfortable in slow flight has the airplane fully under their feet.

Slow flight is also the training regime where you learn to feel the airplane on the back side of the power curve -- the airspeed range where induced drag dominates and adding power produces additional sink, not climb. This is a counterintuitive regime. New pilots' instincts are wrong here. The airplane that wants to descend gets fixed by adding pitch, not by adding throttle. The airplane that wants to climb gets fixed by reducing pitch, not throttle. Reverse-power-pitch.

The FAA training maneuver for slow flight, in the post-2017 Airman Certification Standards revision, asks the candidate to fly at minimum controllable airspeed -- the slowest speed at which the airplane is fully controllable, just above the stall warning. Earlier ACS revisions asked for actual stall warning activation, which exposed students to imminent stalls more often than necessary. The current standard is "just above," which is still slow enough to teach the back-side-of-curve and the rudder demand without the danger.

This node is about feeling the airplane in this regime, knowing why it behaves differently, and connecting that behavior to the demands of the landing pattern.

## Problem

You are practising slow flight at 3,500 AGL in a Cessna 172. Configuration: full flaps, gear (where applicable -- C172 is fixed), 50 KIAS, full power. The airplane is just above stall warning. You are holding altitude, and you need to turn 90 degrees right to a new heading.

What do you do, and what should you watch for during the turn?

Write your answer before reading on. Then ask: what would change if you tried to maintain the same airspeed but added a steeper bank?

## Discover

Slow flight handling is governed by physics that diverges from cruise behavior. Work through.

### Q1. What is "minimum controllable airspeed"?

The slowest airspeed at which the airplane is fully controllable. Defined operationally as: just above the stall warning activation, with full controls available, and the airplane not on the verge of stall in coordinated turns up to 30 degrees of bank.

For a typical C172 at gross weight, full flaps, this is roughly 45-50 KIAS. The exact number depends on weight, configuration, and the calibration of the stall warning system.

### Q2. What is the back-side-of-the-power-curve?

The total drag curve for an airplane is U-shaped:

- At high airspeed, parasite drag (form drag, skin friction, etc.) dominates and grows fast.
- At low airspeed, induced drag (the cost of producing lift at high AOA) dominates and grows fast.
- In between, drag has a minimum -- the bottom of the U.

The power required to maintain level flight follows the drag curve. At cruise (right of the bottom), reducing airspeed reduces power required. At slow flight (left of the bottom), reducing airspeed INCREASES power required, because induced drag is climbing fast.

This left side of the curve is the "back side." On the back side:

- Adding power without changing pitch = airplane accelerates AND climbs (more thrust, less drag).
- Adding pitch without changing power = airplane decelerates AND climbs initially, then descends (less power available for level flight at lower speed).
- Reducing power without changing pitch = airplane decelerates AND descends.

The instinct to "pull up to climb" works on the right side of the curve. On the back side, pulling up at a fixed power produces a temporary climb followed by deceleration, increased drag, and an eventual descent. To climb on the back side, you have to add power.

### Q3. Why does the rudder demand increase?

Two reasons:

**P-factor.** Single-engine propeller airplanes (clockwise prop, from pilot's view) experience asymmetric thrust at high AOA -- the descending blade on the right has higher angle of attack than the ascending blade on the left, producing more thrust on the right side of the disc. This yaws the airplane left. At slow flight with high power, the effect is large; you need significant right rudder to compensate.

**Slipstream.** Propeller wash hits the vertical stabiliser asymmetrically, producing a small but nonzero yawing moment that depends on AOA and power.

At low airspeed with high power, both effects compound. A pilot in slow flight with feet flat on the floor will have the airplane in a yawed flight attitude (slipping or skidding) without realising it. In a coordinated turn at slow flight, the rudder input is much larger than at cruise.

### Q4. What does a stall in slow flight look like?

If the pilot lets airspeed bleed below stall warning while in turn or while pulling, the airplane stalls. In slow flight, stall occurs at higher AOA (because flaps lower the stall AOA somewhat in some airfoils, and the airplane is already there) and tends to produce:

- Mild break (with flaps, stall is gentler than clean).
- Wing drop, often the side opposite the high P-factor (i.e., right wing drops in left-yaw P-factor regime).
- Recovery similar to standard stall recovery but with more power available, since you are already at high power setting.

### Q5. How does slow flight connect to the pattern?

Approach speed (1.3 Vso) is at the upper edge of slow-flight territory. Final-approach speed below 1.3 Vso (e.g., short-field landings at 1.1-1.15 Vso) is well into slow flight.

Most pilots experience slow flight in:

- Short-field approaches (intentionally slow).
- Soft-field takeoffs and landings (low airspeed, high AOA, ground effect).
- Steep approaches where airspeed is being managed against altitude.
- Slow-flight maneuvers in training.

The skill set is: hold airspeed, hold altitude, feel the airplane, use rudder, anticipate that pitch and power do not behave like they do in cruise.

### Q6. What is the recovery from slow flight?

```text
1. Lower the nose to gain airspeed.
2. Full power.
3. Raise flaps in stages as airspeed builds (per POH; usually 10
   degrees at a time).
4. Return to normal cruise pitch and power.
```

The order matters: pitch down + power up = airplane accelerates while you accept altitude loss. Then flaps come up as airspeed permits. If flaps come up too early (below Vfe-flap stall margin), airplane sinks before accelerating.

### What Discover should have led you to

- Slow flight is operation just above stall, in approach configuration, where induced drag dominates.
- The back side of the power curve reverses pitch-power intuition: adding pitch can produce descent, adding power can produce climb.
- Rudder demand grows from P-factor and slipstream; coordination becomes a continuous active task.
- The pattern (approach, short-field, soft-field) puts the airplane in slow-flight territory regularly.
- Recovery is pitch down, power up, flaps up in stages.

## Reveal

### The summary rule

> Slow flight is operation at minimum controllable airspeed -- just above stall warning, in approach configuration, where induced drag dominates. On the back side of the power curve, adding power tends to climb the airplane; adding pitch tends to descend it. P-factor and slipstream demand active rudder. Coordinated turns at 30 degrees bank or less are the maximum safe maneuver. Recovery: pitch down, power up, flaps up in stages.

### The power-curve picture

```text
total power required
 ^
 |   .                                .
 |    .                              .
 |     .                            .
 |      .  back side               .  front side
 |       .                        .
 |        .   minimum            .
 |         .  power required   .
 |          .                .
 |           ..............
 |                 |
 +-----------------+-------------------> airspeed
                    Vmd (min drag)
```

Below Vmd: increasing airspeed reduces power required. Pitch down to increase airspeed = better power efficiency.

Above Vmd: increasing airspeed increases power required. Normal cruise dynamics.

In a typical light single, Vmd is roughly L/Dmax airspeed (best glide). Slow flight is well below Vmd; cruise is well above.

### Why the regime is counterintuitive

Pitch and power are commonly described as "pitch for airspeed, power for altitude." This holds on the front side. On the back side, this does not work as cleanly: pitching up to "climb" reduces airspeed, which moves you further onto the back side and increases power required. If power is fixed, you sink.

The corrected mental model on the back side is:

- "Pitch for altitude (initially), power for sustained altitude."
- Or: "Add power to climb; pitch is just attitude management."

Different schools of thought. The honest answer is that on the back side, pitch and power are coupled; treating them as independent (pitch-airspeed / power-altitude) is the cruise simplification that fails here.

### The rudder discipline

In slow flight at high power:

- C172: typically 1-2 inches of right rudder pedal forward of neutral (illustrative; varies).
- C182: more, because larger engine = more P-factor.
- Tailwheel: substantially more, because airplane is more sensitive to yaw.

The ball stays centered with active rudder input. A pilot who looks only at the AI / DG and does not check the ball will fly slow-flight in a slip or skid -- both bad, both producing higher stall speed in turns and worse handling.

### Recovery technique

```text
1. PITCH: nose down to a level or slightly nose-low attitude. The
   airplane will accelerate.
2. POWER: full power if not already at it.
3. FLAPS: as airspeed builds, raise to 20 degrees, then 10, then 0
   per POH staging.
4. WINGS: keep level; coordination becomes easier as airspeed
   increases.
5. ALTITUDE: accept any altitude lost during the recovery; climb back
   after speed and configuration are stable.
```

In a stall-imminent slow-flight scenario, AOA reduction comes first (relax back pressure or push forward) before any of the above. See `proc-stall-recovery`.

### What is actually authoritative

In descending order:

1. **POH Section 4** -- normal procedures, including approach speeds, and Section 4 / 5 for slow-flight characteristics.
2. **AFH Chapter 4** -- the FAA's training profile.
3. **ACS task elements** -- examiner standards.

### location_skill

- AFH Chapter 4 -- read the slow-flight maneuver description.
- ACS task elements -- knows what tolerances will be graded.
- Your airplane's POH -- check the published approach speeds and flap-extension speeds.

## Practice

### Cards (spaced memory items)

- `card:sf-min-controllable" -- "What is minimum controllable airspeed?" -> "Slowest airspeed where the airplane is fully controllable; just above stall warning."
- `card:sf-back-side-of-curve" -- "Back side of the power curve definition?" -> "Airspeed range below Vmd (min drag) where reducing airspeed increases power required."
- `card:sf-pitch-power-back-side" -- "On the back side, what does adding pitch (without power) do?" -> "Decelerates the airplane; eventually descends because induced drag exceeds available thrust."
- `card:sf-rudder-demand" -- "Why does rudder demand increase in slow flight?" -> "P-factor (asymmetric thrust at high AOA) and slipstream effect on vertical stabiliser; both grow with power and AOA."
- `card:sf-recovery-sequence" -- "Slow-flight recovery sequence?" -> "Pitch down; full power; flaps up in stages; return to cruise."
- `card:sf-stall-imminent-recovery" -- "Recovery from imminent stall in slow flight?" -> "AOA reduction first (relax back pressure); then power; then return to controlled flight."
- `card:sf-pattern-connection" -- "Why does slow flight matter for the landing pattern?" -> "Approach speeds and short-field/soft-field operations are at or below upper-edge slow-flight regime."
- `card:sf-yaw-tendency" -- "Single-engine prop airplane yaw tendency at high AOA + high power?" -> "Yaws left (P-factor on right blade); requires right rudder."
- `card:sf-bank-limit-slow" -- "Maximum bank in slow-flight maneuver per ACS?" -> "30 degrees in coordinated turn."
- `card:sf-vmd-meaning" -- "What is Vmd?" -> "Velocity for minimum drag; bottom of the power-required curve."

### Reps (scenario IDs)

- `scenario:sf-altitude-bleed-correction" -- learner is in slow flight; altitude starts to bleed. They must correct using the back-side-of-curve mental model.
- `scenario:sf-uncoordinated-detection" -- learner has feet flat; ball is to the side; CFII asks why the airplane is in a slip.
- `scenario:sf-imminent-stall-recovery" -- airspeed drops below stall warning; recovery to slow-flight cruise.
- `scenario:sf-30-degree-banked-turn" -- learner must turn 90 degrees right at minimum controllable airspeed without stalling.
- `scenario:sf-recovery-from-slow-flight" -- learner must execute the full recovery to cruise; flap staging tested.
- `scenario:sf-short-field-approach" -- pattern application: short-field final at 1.1 Vso.

### Drills (time-pressured)

- `drill:sf-pitch-power-call" -- instructor calls "altitude bleeding" or "airspeed dropping"; learner identifies the correction (on the back side).
- `drill:sf-rudder-demand-feel" -- learner is in simulator slow flight; ball goes off-center; learner identifies and corrects within 5 seconds.
- `drill:sf-recovery-stage-recall" -- learner names the recovery sequence with flap staging in 30 seconds.

### Back-of-envelope calculations

**Calculation 1: stall speed at slow-flight target.**

C172, full flaps, MTOW: Vso = 40 KIAS.
Slow-flight target: 1.05 to 1.10 Vso = 42 to 44 KIAS (just above stall warning).

Standard slow-flight maneuver airspeed in a C172: about 45 KIAS.

**Calculation 2: power required at slow flight vs. cruise.**

C172 at cruise (110 KIAS, level): roughly 65-70% of full power.
C172 at slow flight (45 KIAS, full flaps, level): roughly 80-90% of full power, because induced drag dominates.

The airplane at 45 KIAS uses MORE power to stay level than at 110 KIAS. This is the back-side reality.

**Calculation 3: rudder demand at slow flight.**

C172 right rudder forward of neutral at slow-flight cruise (full power, full flaps, level):

- Approximately 1-2 inches forward of neutral pedal, varying with pilot leg position.
- Ball remains centered when rudder is correct.
- A pilot with neutral rudder at 90% power and 45 KIAS will have the ball to the right and the airplane in a left slip.

The number is illustrative; the principle is rudder demand is significant and continuous.

## Connect

### What changes if...

- **...you are in a tailwheel airplane?** Yaw sensitivity is higher; slow-flight rudder discipline is more demanding. Three-point landings are basically slow flight to touchdown.
- **...you are in a high-performance single?** P-factor is larger (more horsepower, larger prop). Right-rudder demand is correspondingly larger. Slow-flight handling is the same in concept but the rudder workload is real.
- **...you are at high density altitude?** Power available is reduced; slow flight may require near-full power even to maintain altitude. Margins are thinner; stall speed (TAS) is higher.
- **...you are aft CG?** Slow-flight handling becomes lighter on the controls; stall recovery is slower; back-side-of-curve dynamics are sharper. Marginally easier to control accurately, marginally harder to recover from inadvertent stall.
- **...you are forward CG?** Slow-flight feel is heavy; nose wants to drop; control input is more demanding. Stall recovery is benign.
- **...you are flying a multi-engine?** Slow flight on both engines is similar to single. Single-engine slow flight is much more demanding because asymmetric thrust adds complexity. Vmc / Vyse / blue line considerations apply.
- **...you are intentionally below 1.3 Vso on a short-field final?** You are deliberately in slow flight territory. Coordinated turns are out of the question without compromise; use a stable approach.

### Links

- `aero-angle-of-attack-and-stall` -- slow flight is approach to stall; same physics, recovery in stall section.
- `aero-cg-and-stability` -- CG affects slow-flight handling and stall recovery.
- `aero-coordination-rudder` -- rudder discipline at slow flight is the canonical training case.
- `aero-four-forces` -- equilibrium during slow flight is a different solution to the same equation.
- `proc-stall-recovery` -- when slow-flight technique fails and stall occurs.

## Verify

### Novel scenario (narrative)

> You are a primary student preparing for your private checkride. Today's lesson is slow flight. You are in a C172 at 3,500 AGL. The CFI asks for slow flight at minimum controllable airspeed, full flaps, with a 90-degree right turn to a 270 heading.
>
> Walk through your setup, the maneuver, and the recovery. Be specific about each control input and the airplane's expected behavior.

Scoring rubric:

- Setup: reduces power, raises pitch, deploys full flaps in stages, accepts altitude loss until at target altitude. (2)
- Establishes minimum controllable airspeed: 45-50 KIAS (varies); confirms by stall warning just above. (2)
- Holds altitude with rudder discipline (right rudder for P-factor); ball centered. (2)
- Initiates 30-degree banked right turn with coordinated aileron and rudder; airspeed and altitude maintained. (3)
- Rolls out on 270; airspeed and altitude maintained. (1)
- Recovery: pitch down, full power, flaps up in stages (20 -> 10 -> 0), return to cruise. (3)
- Identifies the back-side-of-curve dynamics during the maneuver. (1)
- Self-assesses any altitude or airspeed deviations and what caused them. (1)

15/15 is the bar. Below 11 is a redo.

### Teaching exercise (CFI)

> A student in slow flight consistently lets airspeed creep up by 5-7 KIAS during the maneuver. They are not letting it stall; they are simply unable to hold the slow target. Their explanation: "I keep adding pitch and the airplane accelerates."
>
> Diagnose the misunderstanding and write the in-flight cue plus the post-flight teaching point.

Evaluation criteria:

- Diagnosis: student is on the back side of the curve and applying front-side pitch-airspeed mental model. They pitch up to climb (because the airplane is sinking); the airplane accelerates because it has gained altitude potential and is now slightly above the target slow-flight airspeed. The student then pitches up more to fix it.
- In-flight cue: short, e.g., "Power."
- Post-flight teaching point: explicitly contrast front-side and back-side. On the back side, "to climb, add power; to descend, reduce power; pitch holds airspeed." Reverse from cruise.
- Drill assigned: 5 minutes of dedicated slow-flight altitude holds with the explicit "power = altitude, pitch = airspeed" rule, until the student internalises the inversion.
- The CFII names the trap: pitch-airspeed thinking is right for cruise and wrong for slow flight; many students do not learn the inversion and wander in the maneuver.

The pedagogical move is to identify the mental model, not the technique. The student's hands are correct; their model is wrong.
