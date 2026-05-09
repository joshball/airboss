---
# === Identity ===
id: proc-ground-reference-maneuvers
title: Ground Reference Maneuvers
domain: procedures
cross_domains:
  - aerodynamics
  - performance

# === Knowledge character ===
# procedural: there are three canonical maneuvers (rectangular course,
#   S-turns, turns around a point) with prescribed entry, geometry, and
#   correction techniques. The procedure is the entry-altitude check, the
#   reference selection, the wind assessment, then the maneuver itself.
# perceptual: ground reference is fundamentally about reading the ground
#   track from the cockpit. The pilot must see the track diverging from
#   the intended line and correct before the divergence becomes obvious.
# judgment: ground reference forces wind correction in real time. Bank
#   varies continuously through the maneuver as a function of relative
#   wind angle and groundspeed. The judgment is "how much bank, when?"
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
  - aero-rate-radius-of-turn
  - perf-crosswind-component
deepens:
  - proc-traffic-pattern
applied_by: []
taught_by: []
related:
  - proc-clear-the-area
  - proc-collision-avoidance
  - proc-attention-management

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 50
review_time_minutes: 8

# === References ===
references:
  - source: FAA-H-8083-3
    detail: Airplane Flying Handbook -- Ground Reference Maneuvers
    note: >-
      The canonical chapter on rectangular course, S-turns, turns around
      a point, and turns around two pylons. Includes entry geometry,
      altitude band (600-1,000 AGL), wind-correction logic, and the
      explicit purpose statement that ground reference teaches division
      of attention between the airplane, the ground, and traffic.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge -- Aerodynamics of Flight
    note: >-
      Background on the relationship between bank angle, groundspeed, and
      turn radius that the maneuvers exercise.
  - source: ACS PPL-A
    detail: Area V Task B -- Ground Reference Maneuvers (V.B.K1-V.B.S7)
    note: >-
      The performance standards (altitude ±100 ft, airspeed ±10 kt) and
      the assessable knowledge / risk / skill elements.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) state the purpose of ground reference (division of
  attention, wind awareness, ground-track control); (2) describe entry
  geometry for rectangular course, S-turns, and turns around a point
  (600-1,000 AGL, perpendicular or 45-deg entry per maneuver); (3)
  explain why bank varies continuously through the maneuver as a
  function of wind angle and groundspeed; (4) demonstrate at least one
  ground reference maneuver within ACS tolerances (altitude ±100 ft,
  airspeed ±10 kt); (5) reverse the turn directly over a reference line
  in S-turns; (6) maintain coordinated flight throughout.
---

# Ground Reference Maneuvers

## Context

Why does the FAA make a private pilot fly turns around a barn at 800 feet? The maneuver is not preparing them for any specific later flight skill. There is no real-world flight that requires concentric circles around a fixed point.

The maneuver is preparing them for every flight. It is a forcing function for three habits that no other maneuver builds as cleanly:

1. **Read the ground track** -- the maneuver only works if the pilot sees the airplane's actual path over the ground, not its heading. Most students confuse the two for years.
2. **Vary bank to compensate for wind** -- the maneuver only works if the pilot increases bank when groundspeed is high (downwind side) and decreases bank when groundspeed is low (upwind side). This is the same correction the pilot will use on every base-to-final turn for the rest of their flying career.
3. **Divide attention** -- the maneuver requires simultaneous control of bank, altitude, ground track, and traffic-watching. Pure inside-the-cockpit pilots fail. Pure outside pilots crash into the ground.

Ground reference is taught at private level because every later certificate assumes the pilot can do all three. Without these habits, the rectangular pattern at the home airport is a ground reference maneuver with worse consequences.

## Problem

You are setting up for turns around a point over a road intersection at 800 AGL. The wind is 270 at 15 knots. Your indicated airspeed is 90 KIAS. As you turn, your groundspeed varies between 75 and 105 KIAS depending on heading.

Where in the turn do you bank steepest, and why? At what bank angle? At what point in the turn do you bank shallowest, and why?

Write your answer before reading on. Then ask: what happens to your turn radius if your bank stays constant at 30 degrees throughout the turn?

## Discover

### Q1. What is the actual purpose of ground reference maneuvers?

The FAA-H-8083-3 chapter is explicit: ground reference maneuvers develop the pilot's ability to **maneuver the airplane in relation to a fixed reference on the ground while dividing attention between the flight path, ground reference, traffic, and other potential hazards**.

In plain terms: the maneuvers exist to teach the pilot to fly a specific path over the ground (not just a heading) in the presence of wind, while also maintaining altitude, airspeed, coordination, and a traffic scan. They are a synthesis maneuver -- a stress test of every primary skill at once.

The downstream skill is the airport traffic pattern, which is a rectangular course flown around the runway with a wind. A pilot who can fly turns around a point in a 15-knot wind can fly a clean pattern in any wind they will encounter at the same airport. A pilot who cannot drift correct over a road intersection cannot drift correct on base-to-final.

### Q2. Why does the bank angle have to vary?

Constant bank produces constant turn radius (in still air). But ground track depends on **groundspeed**, not airspeed. With a wind:

- On the upwind side of the turn: groundspeed is low. A constant bank turns the airplane through a small ground arc.
- On the downwind side: groundspeed is high. A constant bank turns the airplane through a large ground arc.

The result is an oval ground track displaced downwind of the reference point, not a circle around it. The maneuver fails its premise.

To fly a true circle (constant ground radius), the airplane must turn faster (in heading-degrees-per-second) when groundspeed is high. Higher heading rate at constant airspeed requires more bank. So bank increases on the downwind side and decreases on the upwind side.

The math (from `aero-rate-radius-of-turn`):

```text
turn radius (ground) = groundspeed^2 / (g * tan(bank))
```

For a constant ground radius, as groundspeed increases, bank must increase to keep the ratio constant.

### Q3. What is the rectangular course?

The rectangular course is a closed pattern flown around a square or rectangular reference (a field, a city block) at 600-1,000 AGL. The legs are flown parallel to the sides of the reference at a chosen offset distance. The corners are 90-degree turns.

The wind makes each leg a different problem:

- **Upwind leg (heading into the wind):** the airplane is being pushed back; tracking the line is straightforward; no crab needed.
- **Downwind leg (heading with the wind):** same -- no crab needed; just heading parallel to the reference.
- **Crosswind leg (perpendicular):** the airplane is being pushed sideways; the pilot must crab into the wind to track parallel to the reference.
- **Base leg (also perpendicular but the other direction):** crab to the other side.

The 90-degree turns connecting the legs each require a different bank, because the airplane is at a different groundspeed entering and exiting each turn:

- Turn from downwind to base: high groundspeed, steep bank.
- Turn from base to upwind: medium groundspeed, medium bank.
- Turn from upwind to crosswind: low groundspeed, shallow bank.
- Turn from crosswind to downwind: medium-rising groundspeed, increasing bank.

Mastery of the rectangular course transfers directly to the airport traffic pattern.

### Q4. What are S-turns across a road?

S-turns are alternating semicircles flown across a straight reference line (a road, a railroad, a power line). The airplane crosses the reference perpendicular, banks one direction to a 180-degree turn, crosses the reference perpendicular again, banks the opposite direction to a 180-degree turn, and so on.

The geometry constraint: each semicircle must be the same size. The reversal point must be exactly over the reference line. Wind makes this hard:

- A semicircle on the downwind side of the line gets pushed away from the line. To finish the semicircle on the line, the pilot must bank steeper to tighten the arc.
- A semicircle on the upwind side gets pushed toward the line. To finish on the line, bank must be shallower.

The bank varies continuously through each semicircle. At the moment of crossing the reference line, the airplane is at maximum groundspeed (heading downwind, just rolling out of the previous semicircle) or minimum groundspeed (heading upwind), and the bank for the next semicircle starts steep or shallow accordingly.

### Q5. What are turns around a point?

Turns around a point are 360-degree turns around a single ground reference (a barn, a road intersection, a small lake). The radius is constant; the airplane traces a circle on the ground.

This is the canonical "vary bank with groundspeed" maneuver:

- Downwind side of the circle: highest groundspeed, steepest bank (typically 45 degrees max).
- Upwind side of the circle: lowest groundspeed, shallowest bank (often 15-20 degrees).
- Crosswind sectors: intermediate bank.

The pilot must continuously adjust. There is no point in the turn where the bank is "set and held."

### Q6. What is the entry geometry?

From the AFH:

- **Rectangular course:** enter on the downwind side at 45 degrees to the downwind leg, 600-1,000 AGL. This puts the airplane on a high-groundspeed leg first, immediately exposing the wind problem.
- **S-turns:** enter perpendicular to the reference line, downwind, 600-1,000 AGL. The first semicircle is therefore on the downwind side.
- **Turns around a point:** enter at the steepest bank point (downwind), 600-1,000 AGL, parallel to the upwind direction. The first quadrant of the turn is downwind; the airplane immediately demands the steepest bank.

All three entries put the airplane in the high-workload sector first, on purpose. If the pilot can handle the steepest bank on entry, the rest of the maneuver gets easier.

### Q7. What is the altitude band, and why?

600-1,000 AGL. The reasoning:

- Below 600 AGL: too low for safety in light singles. Engine failure leaves no time for an off-airport landing decision. Also too low to see the reference clearly without nose-down attitude.
- Above 1,000 AGL: the ground reference becomes visually too small to read accurately. The maneuver loses its perceptual purpose.
- 800 AGL is the typical sweet spot.

The exception: turns around a point in dense terrain or near power lines may need 1,000 AGL minimum. Use the higher end of the range when in doubt.

### Q8. What does coordinated flight look like through these maneuvers?

The ball stays centered. Bank is generated with aileron and held with aileron; the rudder is used only for coordination, not to tighten the turn.

A common student error is to use rudder to tighten the turn when overshooting (a skidding turn). At low altitude, this is the canonical kill-chain: skidding turn, inside wing stalls, snap-roll, ground impact. See `aero-coordination-rudder` and `aero-load-factor-and-bank-angle`.

Coordination is checked via the inclinometer (the ball) and via seat-of-the-pants feel (no sideways slip). At 800 AGL, the consequences of a skidding stall are unrecoverable. Coordination is non-negotiable.

### What Discover should have led you to

- Ground reference maneuvers exist to teach division of attention, wind compensation, and ground-track reading -- not as ends in themselves.
- Bank must vary continuously because turn radius depends on groundspeed, and groundspeed varies with the wind.
- Three canonical maneuvers: rectangular course, S-turns, turns around a point.
- Entry is at the high-workload sector (downwind), 600-1,000 AGL.
- Coordination is non-negotiable; skidding at low altitude is the canonical kill chain.

## Reveal

### The summary rule

> Ground reference maneuvers develop division of attention between airplane control, ground track, and traffic, while building the wind-correction habit (steeper bank downwind, shallower bank upwind) that every later traffic pattern depends on. The three canonical maneuvers (rectangular course, S-turns, turns around a point) are flown at 600-1,000 AGL with continuous bank variation throughout. Entry is on the downwind side at the maneuver's highest workload point. ACS tolerances are altitude ±100 ft and airspeed ±10 kt. Coordinated flight is non-negotiable -- skidding at low altitude is the canonical accelerated-stall fatal accident geometry.

### The bank-vs-groundspeed table

For a Cessna 172 at 90 KIAS (typical maneuver airspeed) with various wind components:

| Position relative to wind | Groundspeed | Bank required for ground-radius constant |
| ------------------------- | ----------- | ---------------------------------------- |
| Headed directly upwind    | Lowest      | Shallowest (15-20°)                      |
| Headed crosswind          | Medium      | Medium (25-30°)                          |
| Headed directly downwind  | Highest     | Steepest (~45°)                          |
| Crosswind opposite        | Medium      | Medium (25-30°)                          |

Maximum bank in PPL ground reference is typically 45 degrees. If the wind would require steeper bank to hold the radius, choose a larger reference radius instead.

### The entry geometry

```text
Rectangular course:
  - Enter at 45° to the downwind leg
  - 600-1,000 AGL
  - First leg is downwind (highest groundspeed)

S-turns across a road:
  - Enter perpendicular to the road
  - 600-1,000 AGL
  - First semicircle is on the downwind side

Turns around a point:
  - Enter parallel to the upwind direction (so the first quadrant is downwind)
  - 600-1,000 AGL
  - Bank is steepest at entry
```

### The ACS tolerances

| Standard                         | Value                                              |
| -------------------------------- | -------------------------------------------------- |
| Altitude                         | ±100 ft                                            |
| Airspeed                         | ±10 kt                                             |
| Coordinated                      | Required (ball centered)                           |
| Bank                             | Up to ~45° max for PPL ground reference            |
| Reverse over reference (S-turns) | Reversal occurs over the line, not before or after |

### Coordination

The ball stays centered throughout. Use rudder to coordinate, never to tighten the turn. At 600-1,000 AGL, an uncoordinated stall is unrecoverable.

### What is actually authoritative

In descending order:

1. **FAA-H-8083-3 (AFH)** -- the canonical ground reference chapter.
2. **ACS PPL-A Area V Task B** -- the performance standards.
3. **PHAK Aerodynamics chapter** -- the math of bank-vs-radius.
4. **POH** -- maneuvering speed (Va) -- maintain airspeed below Va during the maneuver.

## Practice

### Cards (spaced memory items)

- `card:grm-purpose` -- "What is the purpose of ground reference maneuvers?" -> "Develop division of attention between airplane control, ground track, and traffic, while building the wind-correction habit."
- `card:grm-altitude` -- "What is the altitude band for ground reference?" -> "600-1,000 AGL."
- `card:grm-bank-rule` -- "How does bank vary with wind in ground reference?" -> "Steeper on the downwind side (high groundspeed), shallower on the upwind side (low groundspeed)."
- `card:grm-tolerances" -- "ACS tolerances for ground reference?" -> "Altitude ±100 ft, airspeed ±10 kt, coordinated flight throughout."
- `card:grm-rect-entry` -- "Rectangular course entry?" -> "45° to the downwind leg, 600-1,000 AGL."
- `card:grm-stur-entry` -- "S-turns entry?" -> "Perpendicular to the reference line, downwind side first."
- `card:grm-tap-entry` -- "Turns around a point entry?" -> "Parallel to upwind direction so the first quadrant is downwind (steepest bank at entry)."
- `card:grm-skid-warning` -- "Why is skidding at 800 AGL the canonical kill chain?" -> "Inside wing stalls; snap-roll into ground; no recovery altitude."

### Reps (scenario IDs)

- `scenario:grm-rectangular-15kt` -- pilot flies rectangular course in 15-kt wind; demonstrates correct crab on each leg and bank variation through corners.
- `scenario:grm-sturns-reversal` -- pilot demonstrates S-turns where the reversal happens precisely over the reference line in both directions.
- `scenario:grm-tap-bank-variation` -- pilot demonstrates turns around a point with continuously varying bank; ground track is a circle, not an oval.
- `scenario:grm-traffic-conflict` -- mid-maneuver, traffic appears in the practice area; pilot exits, clears, and resumes (or relocates).
- `scenario:grm-skid-recover` -- pilot catches themselves using rudder to tighten the turn; recognises and corrects.

### Drills (time-pressured)

- `drill:grm-bank-direction` -- given wind direction and current heading in a turn, pilot calls out whether bank should be increasing or decreasing.
- `drill:grm-altitude-hold` -- pilot demonstrates altitude hold within ±100 ft for a full 360 turn around a point.
- `drill:grm-coordination` -- CFI watches the ball; pilot must maintain ball-center for the full maneuver.

## Connect

### What changes if...

- **...the wind is calm?** Ground track is a circle for any constant bank. The maneuver loses most of its difficulty -- and most of its teaching value. Calm-day GRM is a warm-up, not a checkride.
- **...the wind is 25+ knots?** The bank required on the downwind side may exceed 45 degrees for a small reference radius. Choose a larger radius. If the wind is too strong even for that, postpone the maneuver.
- **...you are at 1,500 AGL instead of 800?** The ground reference becomes visually small. Tracking the line is harder. The maneuver loses its perceptual challenge. Drop to the prescribed band.
- **...you are doing this in the actual traffic pattern?** It is the same skill at lower altitude, with traffic and a runway constraint. The base-to-final turn is the most consequential ground reference turn you fly. Treat it with the same discipline.
- **...you are an instructor?** Watch the student's eyes more than the panel. Time spent inside the cockpit is time the maneuver is failing. The maneuver is fundamentally an outside-the-window task.
- **...you are in a high-wing vs. low-wing airplane?** The reference is harder to see in a high-wing during banked turns; the wing covers the ground. Tilt the airplane briefly or use a forward reference. Low-wing airplanes have continuous downward visibility but lateral blind spots.

### Links

- `aero-rate-radius-of-turn` -- the math behind why bank must vary with groundspeed.
- `perf-crosswind-component` -- the wind-vector reasoning for crab and drift.
- `proc-traffic-pattern` -- the rectangular course is a traffic pattern.
- `proc-clear-the-area` -- the pre-maneuver clear is required.
- `proc-collision-avoidance` -- the in-maneuver scan must continue.
- `proc-attention-management` -- the maneuver is fundamentally a division-of-attention exercise.
- `aero-coordination-rudder` -- coordination is non-negotiable; skidding kills.
- `aero-load-factor-and-bank-angle` -- the physics of the bank tradeoff.

## Verify

### Novel scenario (narrative)

> You are flying turns around a point over a barn at 800 AGL. The wind is 290 at 18 knots. You enter parallel to a 290 heading (so your first quadrant is heading 020, downwind side). At entry, you bank to 30 degrees. As you continue the turn, you notice you are drifting away from the barn -- the radius is growing on the downwind side. Diagnose and correct.

Scoring rubric:

- Diagnoses the cause: bank is too shallow for the high groundspeed on the downwind side; ground track is an oval displaced downwind of the barn. (3)
- Corrects: increase bank to ~40-45 degrees while on the downwind half of the turn. (2)
- Anticipates: bank must shallow-out as the turn progresses through the upwind side; plan to roll out to 15-20 degrees by the time the airplane is heading 290 (directly upwind). (2)
- Maintains altitude ±100 ft throughout the correction; trims if necessary as bank changes affect required pitch. (2)
- Maintains coordinated flight; ball stays centered (no rudder-induced "tighten"). (2)
- After completing the turn, evaluates whether the next turn needs a different starting bank or a different radius. (1)

12/12 is the bar. Below 8 is a redo.

### Teaching exercise (CFI)

> A student flies turns around a point with a constant 30-degree bank in a 15-knot wind. The ground track is a clear oval, displaced downwind of the reference point. The student insists they are doing it correctly because the bank is steady. Diagnose and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is treating bank as the controlled variable instead of ground track. They have the procedural input correct (steady bank) but not the perceptual goal (constant ground radius).
- Teaching point: the maneuver is named "turns around a point," not "turns at constant bank." The point is the goal; the bank is the tool. Vary the tool to hit the goal.
- Drill: have the student verbalise the groundspeed direction throughout the turn ("I am heading downwind now... groundspeed is high... bank is increasing"). Build the perceptual link.
- Drawing exercise on the ground: draw the wind vector, draw the airplane around a circle, and have the student annotate where bank is steepest and shallowest. Verify they understand the geometry before re-flying.
- The CFI is patient: this is the first time the student has had to control to a perceptual reference, not a number on the panel. It takes several flights to internalise.

The pedagogical move is to convert the goal from "bank to a number" to "make the airplane do this thing on the ground." The shift is from inside-the-cockpit thinking to outside-the-window thinking, and that shift is the entire point of the maneuver.
