---
# === Identity ===
id: aero-cg-and-stability
title: Center of Gravity and Stability
domain: aerodynamics
cross_domains:
  - flight-planning
  - aircraft-systems

# === Knowledge character ===
# conceptual: stability is a balance of moments around the CG. Static and
#   dynamic stability are derived from CG position relative to the
#   aerodynamic center of the wing-tail system.
# factual: CG envelope is published in the POH as a graph or formula.
#   Forward CG is heavy-stable; aft CG is light-quick-and-fragile.
# perceptual: control feel is different at forward CG (stiff, requires
#   trim) vs. aft CG (twitchy, lower stick-force-per-G). Pilots learn to
#   read the airplane.
knowledge_types:
  - conceptual
  - factual
  - perceptual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: standard
requires:
  - aero-four-forces
deepens: []
applied_by: []
taught_by: []
related:
  - aero-slow-flight
  - aero-load-factor-and-bank-angle

# === Content & delivery ===
modalities:
  - reading
  - cards
  - calculation
estimated_time_minutes: 60
review_time_minutes: 10

# === References ===
references:
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 5 -- Aerodynamics; Chapter 9 -- Weight and Balance
    note: >-
      Authoritative on the longitudinal stability discussion (forward vs.
      aft CG, neutral point, stability margin) and the W&B math.
  - source: AFH (FAA-H-8083-3B)
    detail: Chapter on slow flight and stalls -- stability discussion
    note: >-
      Practical implications of CG position for slow-flight and stall
      handling.
  - source: POH / AFM
    detail: Section 6 -- Weight and Balance / Equipment List
    note: >-
      The CG envelope chart, loading limits, arms, and moments. Each
      type has its own envelope; older airplanes have tighter envelopes
      than newer ones.
  - source: 14 CFR 91.9
    detail: Operating limitations
    note: >-
      Pilot must comply with the operating limitations in the POH /
      type certificate. CG outside the envelope is a violation, not just
      a recommendation.

# === Assessment ===
assessable: true
assessment_methods:
  - calculation
  - recall
  - scenario
mastery_criteria: >-
  Learner can: (1) compute CG location given a loading scheme and
  the published arms; (2) identify whether a given CG is forward,
  aft, or out-of-envelope; (3) describe the handling differences
  between forward and aft CG (stick force, stall behavior, fuel
  burn moments); (4) explain why aft CG can produce uncontrollable
  stall behavior (decreased static stability margin, possible stall
  recovery failure if too far aft); (5) at PPL level, explain why
  loading the airplane near aft CG with full fuel that burns from
  forward tanks can produce an aft-CG migration in flight.
---

# Center of Gravity and Stability

## Context

Every airplane balances on its center of gravity. Push CG forward, and the airplane is heavy in the front -- stable, slow to respond, hard to flare. Push CG aft, and the airplane is light in the front -- quick, unstable, sensitive to stick input. Move CG outside the published envelope, and the airplane may not be controllable at all. Stalls may not recover. Pitching moments may exceed elevator authority. The airplane was certified inside an envelope; outside, certification did not test it.

Most pilots think about CG only during the preflight W&B calculation, and then mostly as a paperwork exercise. The number falls inside the envelope; that is the end of the analysis. The deeper truth is that CG position changes how the airplane handles, and the change is felt continuously throughout the flight. A C172 loaded near forward CG with two heavy front-seat occupants, no rear cargo, and full fuel feels stiff in pitch and floats long on landing flare. The same airplane loaded near aft CG with a back-seat passenger and a heavy bag in the aft baggage compartment feels light, twitchy, and willing to over-rotate on takeoff. Both are legal. Neither is the same airplane to fly.

For PPL students, CG is W&B math. For instrument students, CG plus turbulence is the airplane that wandered without obvious cause. For commercial students, CG and aerobatic certification limits become the same conversation. For CFIs, CG is the silent variable that explains why the airplane behaves differently from one lesson to the next.

This node is about the why. The math is in `perf-weight-and-balance`. The handling implications live here.

## Problem

You are scheduled to fly a Cessna 172 with three pilot friends to a destination 200 NM away. Total cabin weight: pilot 175, copilot 200, two back-seat passengers each 195. Baggage: 60 lb in the aft baggage compartment. Full fuel (40 gallons usable, 240 lb).

Before you fly, you compute weight and balance. The airplane comes in at 200 lb under MTOW. CG is just inside the aft limit at takeoff and migrates further aft as fuel burns from the forward-mounted tanks.

You depart, fly the trip, descend for landing. On final, you flare. The airplane balloons higher than expected. You correct, but the response is sharper than your usual landing.

Why? What changed about the airplane between calm cruise and the flare? And what would you have noticed at takeoff if you had been paying attention?

Write your answer before reading on. Then ask: what would happen if a fifth pilot had been added (assume MTOW is still respected via fuel reduction)?

## Discover

The relationship between CG and handling is mostly elegant once you see it. Work through.

### Q1. What is CG, exactly?

CG is the point at which the airplane's weight is mathematically concentrated for purposes of analysing moments. If you took the airplane and balanced it on a single pivot, the pivot would be at CG.

CG is computed by:

```text
CG = sum(weight_i * arm_i) / sum(weight_i)
```

Each item (pilot, fuel, baggage, etc.) has a weight and an "arm" (distance from a reference datum, typically the firewall or a forward fuselage station). Multiplying weight by arm gives moment. Sum moments, divide by total weight, get CG arm (distance from datum).

The POH publishes:

- Empty weight and empty CG arm (from the latest weighing).
- Arms for each loading station (front seat, rear seat, baggage area, fuel tank).
- The CG envelope: a chart showing acceptable CG range as a function of total weight.

### Q2. What is stability?

Stability is the airplane's response to disturbance.

**Static stability** is the initial tendency to return to equilibrium after a disturbance. Positive static stability: airplane tends to return. Neutral: stays disturbed. Negative: tends to diverge.

**Dynamic stability** is what happens over time. Positive dynamic stability: oscillations damp out. Neutral: oscillations continue at constant amplitude. Negative dynamic stability: oscillations grow.

A typical light single is statically and dynamically stable in pitch with the CG inside the envelope. Disturb the pitch (a gust nudges the nose up); the airplane oscillates a few times and settles back to trimmed pitch.

### Q3. What does CG do to stability?

The airplane's CG and the airplane's neutral point (the aerodynamic center of the entire wing-tail system) define the stability margin:

```text
stability_margin = neutral_point - CG  (measured aft of CG)
```

- CG forward of neutral point: positive static stability. Larger margin = more stable, harder to maneuver.
- CG at neutral point: neutral stability.
- CG aft of neutral point: negative static stability. The airplane diverges from disturbance.

Forward CG = stable, sluggish, heavy on the controls, harder to flare.
Aft CG = quick, twitchy, lighter on the controls, easier to over-rotate.

Beyond the aft CG limit, stability becomes negative; the airplane may not recover from a stall or an uncommanded pitch excursion.

### Q4. What does forward CG feel like?

- Stick (yoke) forces are higher to maintain pitch deviation. Trim use is heavy.
- Stall recovery is easier (the airplane wants to drop the nose to recover).
- Landing flare requires more elevator authority; risk is "running out of elevator" -- the elevator is fully aft and the airplane still wants to land hard.
- Cruise stick force per knot of airspeed change is higher. Pilots feel this as "stiff."
- Fuel burn that draws from aft-mounted tanks moves CG further aft over time, so a forward-CG takeoff may end up center-CG in cruise.

### Q5. What does aft CG feel like?

- Stick forces are lower for the same pitch change.
- Trim is barely needed.
- Stall recovery becomes more dangerous; the airplane has less natural pitch-down tendency, recovery may be slow, and beyond a critical CG, may not happen at all (stick forces required to lower the nose may exceed elevator authority).
- Landing flare is easy -- almost too easy. Tendency to over-rotate or balloon.
- Cruise pilots feel "smooth" or "twitchy" depending on temperament. Aft CG is favoured for fuel economy (less induced drag from tail downforce).
- Fuel burn that draws from forward-mounted tanks moves CG further aft over time. A center-CG takeoff with forward-tank fuel can become aft-CG in cruise.

### Q6. Why does fuel burn matter?

Fuel weighs roughly 6 lb / gallon (avgas). A 40-gallon tank is 240 lb. If the tank arm is forward of CG, burning fuel moves CG aft as the load shifts. If the tank is aft of CG, burning fuel moves CG forward.

Most light singles have wing tanks roughly at CG; fuel burn does not shift CG much. Some have tanks well forward (high-wing 172 / 182 with forward-mounted wing tanks) or well aft (older types). Multi-engine airplanes often have multiple tanks at different arms; fuel sequencing matters.

A loaded-near-aft-limit takeoff in an airplane with forward-mounted fuel produces an aft-CG migration as fuel burns. The pilot who computed W&B correctly at takeoff and not in cruise can cross the aft limit during the flight without realising.

### Q7. What is the consequence of being out of envelope aft?

If too far aft:

- Static stability becomes neutral or negative.
- Stall recovery elevator authority may be insufficient.
- Pitch oscillations may grow rather than damp.
- In extreme cases, an unrecoverable spin or stall is possible.

NTSB accident reports include cases of pilots loading the airplane outside the aft CG limit (often by carrying heavy baggage in an aft baggage compartment), encountering an inadvertent stall, and failing to recover. The airplane was outside its certification.

### Q8. What about forward of envelope?

Out of envelope forward:

- Stick forces excessive at low airspeeds.
- Elevator authority insufficient to flare for landing; airplane lands hard.
- Stall behaviour benign but airplane is sluggish.
- Less common as a fatal accident cause, but airworthiness violation.

Most light-single forward CG limits are set by elevator authority during landing flare. The airplane physically cannot rotate enough to flare softly.

### What Discover should have led you to

- CG is the balance point; computed by weight times arm.
- Stability comes from CG position relative to the airplane's neutral point.
- Forward CG: stable, stiff, heavy on controls.
- Aft CG: quick, light, twitchy; recovery becomes harder; out-of-envelope aft is dangerous.
- Fuel burn shifts CG depending on tank position relative to CG.
- A legal takeoff CG can become an illegal cruise CG if loading is near limits and fuel burns asymmetrically.

## Reveal

### The summary rule

> CG inside the envelope produces certified handling. Forward CG is stable and stiff, aft CG is quick and twitchy. Out-of-envelope is uncertified territory: forward, you may not be able to flare; aft, you may not be able to recover from a stall. Fuel burn shifts CG; check W&B for both takeoff and worst-case fuel burn. The envelope is a legal and a structural limit, not a recommendation.

### The forward / aft CG handling table

| Aspect                       | Forward CG                         | Aft CG                               |
| ---------------------------- | ---------------------------------- | ------------------------------------ |
| Static stability             | Strong positive                    | Weak positive (or negative if out)   |
| Stick force per G            | High                               | Low                                  |
| Stall behaviour              | Pronounced break, easy recovery    | Mild break, slow / hard recovery     |
| Landing flare                | Difficult; risk of running out of elevator | Easy; risk of over-rotation / balloon |
| Cruise speed                 | Slightly slower (more tail downforce, more induced drag) | Slightly faster |
| Trim usage                   | Heavy                              | Light                                |
| Pitch sensitivity            | Sluggish                           | Quick                                |

### CG envelope shape (typical)

CG envelope is plotted as gross weight (vertical) vs. CG arm (horizontal). The envelope is roughly trapezoidal:

- Forward limit narrows as weight increases (more weight = more nose-down moment, requires CG further aft to compensate).
- Aft limit narrows as weight decreases (lighter aircraft can tolerate less aft CG before becoming unstable; some envelopes have the aft limit further forward at low weights).
- Top: MTOW.
- Bottom: minimum operating weight (rare to hit; usually empty + minimal pilot).

A flight that starts with full fuel loaded near aft limit and burns down to minimum fuel may exit the envelope at the aft-light corner. Compute both ends.

### W&B as a sequence problem

For a typical flight:

```text
1. Empty weight + empty arm (from latest weighing, in POH or weight log).
2. Add pilot, copilot weights at front-seat arm.
3. Add rear-seat passengers at rear-seat arm.
4. Add baggage at baggage-area arm.
5. Add fuel at fuel-tank arm (full fuel for takeoff CG).
6. Sum weights, sum moments, divide -> takeoff CG.
7. For landing CG: subtract fuel burn (gallons x 6 lb) at fuel arm.
8. Verify both takeoff and landing CG inside envelope.
```

If only one was checked, the other can be out. Double-check.

### What is actually authoritative

In descending order:

1. **POH Section 6** -- the W&B chart, arms, envelope, and equipment list.
2. **POH Section 2** -- limitations including W&B operating envelope.
3. **PHAK Chapters 5 and 9** -- the underlying aerodynamics and W&B math.
4. **AFM supplements** -- post-modification weight changes (avionics installed, paint job, interior changes).

### location_skill

- POH Section 6 -- W&B sample problems, arms table, envelope chart.
- The latest weighing (usually an inspection record or AFM page); empty weight changes over time.
- Type-specific W&B apps (Foreflight, Garmin Pilot) for fast computation; verify against POH numbers periodically.

## Practice

### Cards (spaced memory items)

- `card:cg-formula" -- "Formula for CG arm?" -> "CG = sum(weight x arm) / sum(weight)."
- `card:cg-forward-stability" -- "Forward CG handling tendency?" -> "Stable, sluggish, heavy on controls; flare can run out of elevator."
- `card:cg-aft-stability" -- "Aft CG handling tendency?" -> "Quick, light, twitchy; stall recovery becomes harder; over-rotation risk."
- `card:cg-stability-margin" -- "Stability margin formula?" -> "neutral_point - CG (positive = stable, larger = more stable)."
- `card:cg-out-of-envelope-aft" -- "Danger of operating aft of CG envelope?" -> "Stall recovery may fail; static stability may go negative; airplane outside certification."
- `card:cg-out-of-envelope-forward" -- "Danger of operating forward of CG envelope?" -> "Insufficient elevator authority for flare; hard landing; airplane outside certification."
- `card:cg-fuel-burn-effect" -- "How does fuel burn affect CG?" -> "Depends on tank arm: forward tank burn shifts CG aft; aft tank burn shifts CG forward."
- `card:cg-envelope-shape" -- "Why does the aft CG limit move forward at low weights in the envelope?" -> "Lighter airplane has less stability margin; aft limit is tightened to preserve recoverable behavior."
- `card:cg-static-vs-dynamic" -- "Difference between static and dynamic stability?" -> "Static = initial tendency to return; dynamic = behavior over time (oscillation damping or growth)."
- `card:cg-pre-and-post-flight-check" -- "Why check both takeoff and landing CG?" -> "Fuel burn shifts CG; legal at takeoff does not guarantee legal at landing if loading is near limits and tanks are off-CG."

### Reps (scenario IDs)

- `scenario:cg-aft-with-baggage" -- the opening problem; airplane loaded with rear-seat passengers and aft baggage; CG near aft limit at takeoff and migrates further aft.
- `scenario:cg-forward-empty-back" -- two heavy front-seat occupants, no rear-seat or baggage, full fuel; CG near forward limit; flare requires extended back-elevator hold.
- `scenario:cg-fuel-burn-out-of-envelope" -- legal takeoff CG, but fuel burn from aft tank moves CG forward; pilot lands with aircraft now near forward limit.
- `scenario:cg-stall-aft-cg-fail-recovery" -- training scenario in the simulator: aft-CG configuration, deep stall, recovery elevator authority insufficient.
- `scenario:cg-w-b-error-discovered-in-cruise" -- pilot realises mid-flight that baggage compartment was overloaded; assesses handling and decides whether to continue or divert.

### Drills (time-pressured)

- `drill:cg-w-b-recall" -- learner is given a loading scheme; computes CG and identifies envelope position in 60 seconds.
- `drill:cg-handling-prediction" -- given a CG position (forward / center / aft), learner predicts handling characteristics and one risk.
- `drill:cg-takeoff-vs-landing" -- learner computes CG at both takeoff and landing for a given fuel burn; identifies the worst case.

### Back-of-envelope calculations

**Calculation 1: CG with 4 passengers and aft baggage in a C172.**

Empty weight: 1,650 lb at arm 39.0 (illustrative).
Front seats (pilot + copilot at 175 + 200 = 375 lb) at arm 37.0.
Rear seats (195 + 195 = 390 lb) at arm 73.0.
Baggage (60 lb) at arm 95.0.
Fuel (40 gal x 6 = 240 lb) at arm 48.0.

```text
Total weight = 1650 + 375 + 390 + 60 + 240 = 2,715 lb (over MTOW 2,300?
   illustrative figures; real C172S MTOW is 2,550 lb -- this loading
   wouldn't be legal but the math demonstrates the principle.)

Total moment = (1650*39) + (375*37) + (390*73) + (60*95) + (240*48)
             = 64,350 + 13,875 + 28,470 + 5,700 + 11,520
             = 123,915

CG = 123,915 / 2,715 = 45.6
```

CG arm 45.6 -- compare to envelope chart for that weight. (Actual C172S envelope is forward 35-37, aft 47-48 depending on weight.)

**Calculation 2: CG migration from fuel burn.**

Burn 30 gallons (180 lb) from a fuel tank at arm 48.0 during the flight:

Moment removed: 180 * 48 = 8,640.

New weight: 2,715 - 180 = 2,535 lb.
New moment: 123,915 - 8,640 = 115,275.
New CG: 115,275 / 2,535 = 45.5.

CG barely shifts because fuel arm (48) is near the loaded CG (45.6). If fuel were at arm 35 (forward) or 60 (aft), the migration would be larger.

## Connect

### What changes if...

- **...you fly a tail-dragger?** Geometry changes: fuel may be at a different arm; baggage area placement differs. Otherwise, same physics.
- **...you fly a twin?** Two engines plus their fuel produce a more complex CG calculation. Some twins have CG that shifts during single-engine operation as imbalance moments come into play.
- **...you fly with full or near-full fuel and a rear-seat passenger?** Most likely combination for a legal but near-aft-limit CG. Common in the 4-seat single fleet. Make sure post-burn CG is still inside envelope.
- **...you fly aerobatics?** CG envelope is much tighter for aerobatic maneuvers; some airplanes have a separate "aerobatic CG envelope" inside the normal one. Sloppy loading defeats the certified maneuvering envelope.
- **...the airplane was recently re-painted or had avionics added?** Empty weight and empty CG arm changed. Get the latest weighing; do not use stale numbers.
- **...you load a heavy bag forward?** CG migrates forward (more nose-heavy). May solve an aft CG problem; verify against forward limit.
- **...you fly with a passenger who later moves to a different seat?** CG changes mid-flight. In a small airplane, a passenger swapping front to back shifts CG measurably; you can feel the change.

### Links

- `aero-four-forces` -- the equilibrium being shaped by CG-modulated tail downforce.
- `aero-load-factor-and-bank-angle` -- stability margin affects how the airplane responds to G in turns and pulls.
- `aero-slow-flight` -- CG affects slow-flight handling (stick forces, stall behaviour).
- `perf-weight-and-balance` -- the parent W&B node; this node is the handling and stability part.

## Verify

### Novel scenario (narrative)

> You are a freshly-rated commercial pilot, flying a Cessna 182 to deliver a passenger and 80 lb of cargo. The 182 has a flexible aft baggage compartment. You compute W&B: empty weight 1,750, fuel 360, pilot 180, passenger 195, cargo 80 in aft baggage. Total: 2,565 lb. CG arm: 49.3. The 182's envelope at this weight runs from forward 38.0 to aft 49.0.
>
> You are 0.3 inches aft of the aft limit.
>
> What do you do? Walk through the options and pick one.

Scoring rubric:

- Identifies the airplane is OUT of envelope, not just close. (1)
- Rejects "just go" -- this is illegal under 91.9 and unsafe. (2)
- Considers options:
  - Move 80 lb of cargo to a more forward position (front passenger seat, lap, forward cargo area if equipped). (2)
  - Reduce fuel; less fuel at fuel arm slightly aft of CG would shift CG forward. (1)
  - Swap passenger position (if there's a more forward seat). (1)
- Computes the new CG after the rearrangement and verifies inside envelope. (2)
- Considers the landing CG: as fuel burns, CG migration in this airplane is forward (in the C182 fuel arm is roughly at CG); landing CG should also be checked. (2)
- States that an honest preflight catch like this is good airmanship; bringing 80 lb of cargo without a planned forward stowage location is the planning lesson. (1)
- Documents the calculation in a kneeboard W&B form. (1)

12/12 is the bar. Below 9 is a redo.

### Teaching exercise (CFI)

> A student in a high-performance airplane (PA28R Arrow) consistently makes ballooning landings. They report the airplane "feels easy to land but it always wants to balloon." Their W&B form shows takeoffs near aft CG (single pilot, full fuel, no passenger).
>
> Diagnose the connection between CG and the ballooning, and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: aft CG produces low stick-force-per-G; in the flare, the student is using the same elevator force they would use at center CG, but the airplane responds more sharply, producing the balloon.
- Teaching point: aft CG handling is real; the student is not flaring wrong, the airplane is more responsive than they expect.
- Drill assigned: chair-fly the flare with explicit awareness that "when I'm aft, lighter touch on the yoke." Practice with a different loading (front passenger added, weight forward) to demonstrate the contrast.
- The CFII does not blame the student; the airplane's loading is the variable, and the student needs the calibration data point.
- Discusses W&B planning: students often fly near-aft-CG by accident; a forward-loaded reference flight per type would help calibrate handling expectations.

The pedagogical move is to convert "ballooning" from a flare-technique problem into a CG-feel problem. The fix is awareness, not more flare practice in the same loading.
