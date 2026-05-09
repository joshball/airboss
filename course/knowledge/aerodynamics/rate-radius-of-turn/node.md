---
# === Identity ===
id: aero-rate-radius-of-turn
title: Rate and Radius of Turn
domain: aerodynamics
cross_domains:
  - performance
  - procedures

# === Knowledge character ===
# conceptual: turn rate (degrees per second) and turn radius (feet) are
#   linked through bank angle and true airspeed via two formulas. The
#   pilot can solve either if they know two of the three.
# factual: standard rate is 3 deg/sec (2-min turn). For a given bank,
#   doubling airspeed quadruples the radius and halves the rate.
# perceptual: in flight, the pilot reads turn rate from the turn coordinator
#   and infers radius from the ground track. The relationship between
#   bank, groundspeed, and ground radius is the basis of every ground
#   reference maneuver and every traffic pattern.
knowledge_types:
  - conceptual
  - factual
  - perceptual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-four-forces
  - aero-load-factor-and-bank-angle
deepens: []
applied_by:
  - proc-ground-reference-maneuvers
  - proc-traffic-pattern
taught_by: []
related:
  - aero-coordination-rudder
  - aero-load-factor-and-bank-angle
  - perf-crosswind-component

# === Content & delivery ===
modalities:
  - reading
  - cards
  - calculation
estimated_time_minutes: 35
review_time_minutes: 6

# === References ===
references:
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge -- Aerodynamics of Flight
    note: >-
      Authoritative on the bank-radius-rate relationships, with worked
      tables and the standard-rate-turn definition (3 degrees per second,
      requiring approximately 17 degrees of bank at 100 KIAS).
  - source: FAA-H-8083-3
    detail: Airplane Flying Handbook -- Performance Maneuvers and Ground Reference Maneuvers
    note: >-
      Practical application: how the bank-vs-groundspeed relationship
      drives the continuous bank variation in turns around a point.
  - source: FAA-H-8083-15
    detail: Instrument Flying Handbook -- Standard Rate Turns
    note: >-
      The standard-rate-turn convention used in IFR procedures (holding
      patterns, course reversals, climbs / descents in turn).

# === Assessment ===
assessable: true
assessment_methods:
  - calculation
  - recall
mastery_criteria: >-
  Learner can: (1) state the standard rate of turn (3 deg/sec, 2-min
  full circle); (2) compute the approximate bank for standard rate at
  any cruise airspeed (TAS / 10 + 7); (3) compute turn radius given
  bank and groundspeed using r = V^2 / (g * tan(bank)); (4) explain why
  doubling airspeed at constant bank doubles rate-period and quadruples
  radius; (5) apply the relationship to ground reference (constant
  ground radius requires varying bank with groundspeed); (6) apply the
  relationship to the traffic pattern (base-to-final geometry).
---

# Rate and Radius of Turn

## Context

Two airplanes both bank to 30 degrees. One is a Cessna 172 at 90 KIAS. The other is a Citation at 200 KIAS. They both make a 360-degree turn.

The Cessna's turn takes about 75 seconds and traces a circle roughly 1,400 feet in diameter. The Citation's turn takes about 170 seconds and traces a circle roughly 7,000 feet in diameter. Same bank. Different airplane. Vastly different geometry.

The pilot who does not know why these two airplanes turn so differently cannot:

- Plan a base-to-final turn that ends on centerline (the Citation needs more lead).
- Fly a holding pattern correctly (radius matters for racetrack length).
- Turn around a ground reference point in wind (the relationship between bank, airspeed, and ground radius is the entire maneuver).
- Pick a safe bank for an emergency descending turn at altitude (radius affects the time the airplane spends at risk).

This node is the math that anchors traffic pattern judgment, ground reference maneuvering, and IFR procedure turn planning. It composes on `aero-load-factor-and-bank-angle` (which gives load factor for a given bank); rate and radius give the time and space the bank produces.

## Problem

You are flying a Cessna 172 at 90 KIAS in a 30-degree banked level turn. Compute:

1. Your turn rate in degrees per second.
2. The time to complete a 360.
3. Your turn radius in feet.
4. Your turn diameter in feet.

Then redo the calculation at 60 degrees of bank, same airspeed. What changed by what ratio?

Then redo at 30 degrees of bank, 180 KIAS. What changed by what ratio?

Write out the math before reading on.

## Discover

### Q1. What is the math behind turn rate?

Turn rate (in degrees per second) for a coordinated level turn:

```text
rate = (g * tan(bank)) / V
```

where:

- `g` = 32.2 ft/sec² (gravity)
- `bank` = bank angle (degrees, converted to radians for the tangent)
- `V` = true airspeed (ft/sec)

For a Cessna 172 at 90 KIAS (≈ 152 ft/sec), 30 degrees bank:

```text
rate = (32.2 * tan(30°)) / 152
     = (32.2 * 0.577) / 152
     = 18.6 / 152
     = 0.122 rad/sec
     ≈ 7.0 deg/sec
```

A 360-degree turn at 7 deg/sec takes 51 seconds.

### Q2. What is the math behind turn radius?

Turn radius (in feet):

```text
r = V² / (g * tan(bank))
```

For the same Cessna at 90 KIAS, 30 degrees bank:

```text
r = 152² / (32.2 * 0.577)
  = 23,104 / 18.6
  = 1,242 ft
```

Diameter ≈ 2,485 ft. About 0.41 NM.

### Q3. What is "standard rate of turn"?

Standard rate is 3 degrees per second. A full 360 takes exactly 2 minutes. This convention is used in IFR procedures (holding patterns, course reversals, descending turns) so that pilots and ATC can predict turn timing without computing for each airplane.

The bank required for standard rate depends on TAS. The rule of thumb:

```text
standard rate bank ≈ (TAS / 10) + 7
```

At 90 KIAS: bank ≈ 16 degrees.
At 120 KIAS: bank ≈ 19 degrees.
At 150 KIAS: bank ≈ 22 degrees.
At 200 KIAS: bank ≈ 27 degrees.

The turn coordinator (and the older turn-and-slip indicator) shows standard rate as a marked deflection. A pilot in IFR holding can fly the bank by reference to the turn coordinator without computing.

### Q4. What happens when bank changes (constant airspeed)?

Going from 30 to 60 degrees of bank at 90 KIAS:

```text
tan(30°) = 0.577
tan(60°) = 1.732   (3x)

rate doubles-plus: from 7.0 to 12.1 deg/sec
360 time halves-plus: from 51 sec to 30 sec
radius shrinks: from 1,242 ft to 414 ft
diameter: from 2,485 ft to 828 ft
```

So tripling tan(bank) triples rate and divides radius by 3. The relationship is linear in tan(bank), not in bank itself.

### Q5. What happens when airspeed changes (constant bank)?

Going from 90 to 180 KIAS at 30 degrees of bank:

```text
V doubles
rate halves: from 7.0 to 3.5 deg/sec
360 time doubles: from 51 sec to 102 sec
radius quadruples: from 1,242 to 4,968 ft
diameter: from 2,485 to 9,936 ft
```

So doubling airspeed at constant bank halves the rate and quadruples the radius. The radius is proportional to V², which is the surprise -- it is much faster than linear.

This is why faster airplanes need more lead in a turn-to-final. A jet pilot at 130 KIAS on base will track a much wider arc to centerline than a Cessna at 70 KIAS at the same bank. The jet's turn radius is roughly (130/70)² = 3.5 times larger.

### Q6. What is the practical implication for ground reference?

Turn radius depends on **groundspeed**, not airspeed, when measured over the ground:

```text
ground radius = groundspeed² / (g * tan(bank))
```

For a constant ground radius (e.g., turns around a point), as groundspeed changes through the turn (because of the wind), bank must change to compensate. Specifically:

- Heading downwind (high groundspeed): bank steeper to keep ground radius constant.
- Heading upwind (low groundspeed): bank shallower.

Quantitative example for a Cessna 172 at 90 KIAS true airspeed in a 15-knot wind:

| Heading           | Groundspeed | Bank for 1,200-ft ground radius |
| ----------------- | ----------- | ------------------------------- |
| Directly upwind   | 75 KIAS     | ~22°                            |
| Crosswind         | 90 KIAS     | ~30° (still-air baseline)       |
| Directly downwind | 105 KIAS    | ~40°                            |

The bank varies from 22 to 40 degrees over the course of the turn. This is why ground reference maneuvers feel busy.

### Q7. What is the practical implication for the traffic pattern?

Base-to-final is a 90-degree turn from a base leg perpendicular to the runway to a final lined up with it. The geometry constraint: the airplane must roll out on extended centerline, not before, not after.

Where the base-to-final turn starts depends on:

- Pattern altitude and descent rate (sets the airplane's vertical position).
- Groundspeed on base (sets the ground arc the airplane will trace).
- Bank chosen for the turn (sets the radius).

For a Cessna at 70 KIAS on base in calm wind, 30 degrees of bank, the radius is roughly:

```text
r = (118 ft/sec)² / (32.2 * tan(30°))
  = 13,924 / 18.6
  = 749 ft
```

So the airplane needs to start the turn about 750 feet before reaching the extended centerline (measured perpendicular to the centerline). Start the turn too late and the airplane overshoots; the pilot is then tempted to tighten with rudder (skidding stall geometry) or steepen bank (accelerated stall geometry).

A jet at 130 KIAS, same bank: radius ≈ (220)² / 18.6 ≈ 2,600 ft. Start the turn over 3 times further out.

### Q8. Why does the formula use tan(bank), not sin or cos?

The math comes from the centripetal force analysis of a coordinated turn. The horizontal component of lift provides the centripetal force. That horizontal component equals lift × sin(bank). The vertical component (lift × cos(bank)) equals weight (for level flight). Dividing the two gives:

```text
horizontal lift / vertical lift = tan(bank)
```

Centripetal acceleration is v² / r, equal to g × tan(bank). Solving for radius gives r = v² / (g tan(bank)). For rate (which is v/r), substitute and rearrange to get rate = g tan(bank) / v.

The tangent function captures the geometric relationship between the horizontal pull and the vertical support.

### What Discover should have led you to

- Rate = g tan(bank) / V; radius = V² / (g tan(bank)).
- Standard rate is 3 deg/sec, requires bank ≈ TAS/10 + 7 degrees.
- Doubling airspeed at constant bank quadruples radius (V² scaling).
- Tripling tan(bank) triples rate, divides radius by 3 (inverse linear in tan).
- Ground radius uses groundspeed; varies with wind in turns.
- Base-to-final geometry depends on radius from the pilot's airspeed.

## Reveal

### The summary rule

> Turn rate is g·tan(bank)/V; turn radius is V²/(g·tan(bank)). Standard rate is 3 deg/sec (2-min full turn), requiring approximately TAS/10 + 7 degrees of bank. Doubling airspeed at constant bank quadruples radius and halves rate. Doubling tan(bank) at constant airspeed doubles rate and halves radius. Ground radius uses groundspeed, so wind forces continuous bank variation in ground reference maneuvers. Faster airplanes need much wider turn radii in the pattern -- the V² scaling is the surprise.

### The formulas

```text
rate (rad/sec)  = g · tan(bank) / V
rate (deg/sec)  = (g · tan(bank) / V) × (180/π) ≈ 1091 · tan(bank) / V_kt
radius (ft)     = V² / (g · tan(bank))
                = V_kt² × (1.687)² / (32.2 · tan(bank))
                ≈ V_kt² × 0.0884 / tan(bank)
```

Where:

- g = 32.2 ft/sec²
- V is true airspeed (use groundspeed for ground-frame radius)
- 1.687 converts knots to ft/sec

### The standard-rate bank approximation

```text
standard rate bank (deg) ≈ TAS / 10 + 7
```

| TAS (kt) | Bank for standard rate |
| -------- | ---------------------- |
| 60       | 13°                    |
| 90       | 16°                    |
| 120      | 19°                    |
| 150      | 22°                    |
| 180      | 25°                    |
| 200      | 27°                    |
| 250      | 32°                    |

Beyond about 250 KIAS, half-standard rate (1.5 deg/sec) is the IFR convention because the bank for full standard rate becomes excessive.

### Worked turn-radius table for common GA cases

C172 in calm air:

| Bank | Airspeed (KIAS) | Radius (ft) | Diameter (ft) | 360 time |
| ---- | --------------- | ----------- | ------------- | -------- |
| 15°  | 90              | 2,683       | 5,366         | 119 sec  |
| 30°  | 90              | 1,242       | 2,485         | 51 sec   |
| 45°  | 90              | 717         | 1,434         | 30 sec   |
| 60°  | 90              | 414         | 828           | 17 sec   |
| 30°  | 70              | 750         | 1,500         | 40 sec   |
| 30°  | 130             | 2,584       | 5,168         | 75 sec   |

Citation cruise:

| Bank | Airspeed (KIAS) | Radius (ft) | Diameter (NM) |
| ---- | --------------- | ----------- | ------------- |
| 30°  | 200             | 6,128       | 2.0           |
| 30°  | 250             | 9,575       | 3.2           |

The diameter for a Citation at 250 KIAS at 30 bank exceeds the typical practice-area scale.

### What is actually authoritative

In descending order:

1. **POH** -- Va, Vne, and any maneuvering-bank limits for the airplane.
2. **PHAK Aerodynamics chapter** -- the math in plain language with tables.
3. **AFH Performance Maneuvers chapter** -- application to steep turns and GRM.
4. **IFH** -- standard-rate-turn convention for IFR work.

## Practice

### Cards (spaced memory items)

- `card:rrt-rate-formula` -- "Turn rate formula?" -> "rate = g · tan(bank) / V."
- `card:rrt-radius-formula` -- "Turn radius formula?" -> "r = V² / (g · tan(bank))."
- `card:rrt-std-rate` -- "Standard rate of turn?" -> "3 deg/sec, completes 360 in 2 minutes."
- `card:rrt-std-bank-rule` -- "Bank for standard rate at TAS V?" -> "Approximately V/10 + 7 degrees."
- `card:rrt-double-airspeed` -- "What happens to radius if airspeed doubles at constant bank?" -> "Radius quadruples (V² scaling); rate halves."
- `card:rrt-double-bank-tan` -- "What happens to rate if tan(bank) doubles at constant airspeed?" -> "Rate doubles; radius halves."
- `card:rrt-ground-frame` -- "What governs ground-frame turn radius?" -> "Groundspeed, not airspeed. Wind changes groundspeed during the turn."

### Reps (scenario IDs)

- `scenario:rrt-base-to-final-leadtime` -- pilot computes when to start a base-to-final turn given airspeed, bank, and base offset. Verifies rollout on centerline.
- `scenario:rrt-holding-pattern-radius` -- IFR pilot estimates inbound and outbound leg lengths in a holding pattern at standard rate.
- `scenario:rrt-jet-vs-ga-pattern` -- pilot compares Cessna and Citation pattern footprints; explains the radius difference.
- `scenario:rrt-grm-bank-variation` -- pilot computes the bank required at each quadrant of a turn around a point in a 15-knot wind to maintain a constant 1,200-ft ground radius.

### Drills (time-pressured)

- `drill:rrt-std-bank` -- given TAS, pilot calls the bank for standard rate in 5 seconds.
- `drill:rrt-radius-quick` -- given V_kt and bank, pilot estimates radius using the V² × 0.09 / tan(bank) shortcut in 10 seconds.
- `drill:rrt-radius-double-bank` -- given a baseline radius, pilot computes the radius after doubling tan(bank) without recomputing from scratch.

## Connect

### What changes if...

- **...you are at high altitude (high TAS, low IAS)?** True airspeed is what matters for radius; IAS is what the airspeed indicator shows. At 10,000 MSL, your TAS may be 15-20% higher than your IAS, so radius is larger than IAS-only intuition suggests.
- **...you are in a heavy airplane (high stall speed)?** Stall speed scales with sqrt(load factor). At 60 bank, your stall speed is 41% higher. Even at adequate airspeed for level flight, the stall margin in a steep turn shrinks. See `aero-load-factor-and-bank-angle`.
- **...you are doing a procedure turn (45/180)?** The procedure turn assumes standard rate (3 deg/sec) at the airspeed you are flying. The radius matters for whether you stay within the protected area. Faster airplanes need to slow before procedure turns.
- **...you are demonstrating a steep turn (45 bank)?** Radius is half the 30-degree-bank radius. Rate is double. Hold for 360 degrees -- the turn completes in roughly 30 seconds at 90 KIAS. This is fast.
- **...you are in a holding pattern?** Inbound leg is timed to 1 minute (or 1.5 above 14,000 MSL). The outbound leg is adjusted so total racetrack time is consistent. The 180-degree turns at each end take about 1 minute at standard rate.
- **...the wind is strong on a holding-pattern outbound?** Outbound leg duration is adjusted so the inbound leg comes out to 1 minute. The radius of the racetrack itself uses groundspeed, so a strong wind elongates the pattern.

### Links

- `aero-load-factor-and-bank-angle` -- bank produces load factor; the same bank produces this radius.
- `aero-coordination-rudder` -- coordinated turn is the assumption behind the formula.
- `proc-ground-reference-maneuvers` -- the maneuver where varying bank to hold ground radius is the entire point.
- `proc-traffic-pattern` -- where base-to-final geometry depends directly on this math.
- `nav-holding-pattern-entries` -- standard rate is the IFR turn convention.
- `perf-crosswind-component` -- wind affects groundspeed; groundspeed affects ground radius.

## Verify

### Novel scenario (narrative)

> You are flying a Cessna 172 at 70 KIAS on a base leg parallel to runway 27. Your base leg is offset 1,000 feet east of the extended centerline. The wind is calm. At what point relative to the centerline do you need to start your turn to final, assuming you bank 30 degrees? What if you choose 20 degrees of bank instead? What if the wind is from 270 at 15 knots (a headwind on final)?

Scoring rubric:

- Computes radius at 30 bank, 70 KIAS calm: r = 70² × 0.09 / tan(30°) ≈ 441 / 0.577 ≈ 764 ft. So the turn must start 764 ft before the centerline; with a 1,000 ft base offset, that's 236 ft past the centerline (the airplane will start the turn slightly past the centerline). (3)
- Recomputes at 20 bank: r = 70² × 0.09 / tan(20°) ≈ 441 / 0.364 ≈ 1,212 ft. The turn must start before reaching the centerline -- about 212 ft prior. Demonstrates that shallow bank requires earlier turn entry. (3)
- For wind 270 at 15 from the final direction: groundspeed on base (perpendicular to wind) is still 70; on final, groundspeed becomes 55. The base-leg geometry is unchanged for the turn entry; the final airspeed is just slower groundspeed. The turn radius is still computed from base groundspeed. (3)
- Notes the practical implication: 20-degree-bank base-to-final requires more discipline because the lead time is greater; pilots tend to delay the turn and overshoot. (1)
- Describes the corrective when overshooting: increase bank smoothly (not exceeding 30) or go around. Do not skid. (1)

11/11 is the bar. Below 8 is a redo.

### Teaching exercise (CFI)

> A student is consistently overshooting the centerline on base-to-final at the home airport, then tightening the turn with rudder to "make the runway." Diagnose using the rate-and-radius framework and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is starting the turn too late. Their bank-to-radius mental model is correct (they bank to 30) but their lead-distance mental model is wrong (they wait too long).
- Quantitative explanation: at their typical airspeed (70 KIAS) and bank (30), the turn radius is about 750 feet; the turn must start about 750 feet before reaching the centerline.
- Teaching point: the lead point is the visible cue, not the centerline crossing. Start the turn when the runway is at the wing-strut intersection (or whatever visual reference matches 750 ft).
- The rudder-tighten habit is the kill chain. Reframe: "If you find yourself reaching for rudder, GO AROUND. Never use rudder to recover the turn at low altitude."
- Drill: at altitude, fly base-to-final geometry with a road as the proxy "centerline." Practice both the lead-judgment and the go-around decision.
- The CFI is firm: the base-to-final stall is the dominant pattern fatality. The student's habit of "tighten with rudder" is the exact behavior NTSB describes in those reports. Fix it now.

The pedagogical move is to ground the lead-time judgment in the math (so the student sees why early turn entry matters) and to make the rudder-tighten habit a hard "no" (because the alternative is the canonical fatal accident).
