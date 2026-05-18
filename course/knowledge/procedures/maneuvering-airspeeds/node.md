---
# === Identity ===
id: proc-maneuvering-airspeeds
title: Maneuvering Airspeeds and Va
domain: procedures
cross_domains:
  - aerodynamics
  - performance

# === Knowledge character ===
# factual: Va, Vno, Vne, Vfe, Vlo, Vle are POH-published numbers. The
#   pilot must memorise the ones for their training airplane and look up
#   the rest.
# conceptual: Va is the corner where the stall line meets the limit-load
#   line on the V-G diagram. Below Va, the wing stalls before the airframe
#   breaks. Above Va, the airframe breaks first. Va decreases with weight.
# procedural: a manufacturer's recommended airspeed exists for many
#   maneuvers (stalls, steep turns, slow flight, ground reference). The
#   pilot uses the POH number; in absence, they default to "not faster
#   than Va."
knowledge_types:
  - factual
  - conceptual
  - procedural
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-load-factor-and-bank-angle
deepens: []
applied_by:
  - proc-execute-steep-turn
  - proc-ground-reference-maneuvers
taught_by: []
related:
  - aero-load-factor-and-bank-angle
  - aero-angle-of-attack-and-stall
  - perf-weight-and-balance

# === Content & delivery ===
modalities:
  - reading
  - cards
estimated_time_minutes: 25
review_time_minutes: 5

# === References ===
references:
  - source: POH / AFM Section 2
    detail: Limitations -- airspeed limitations, V-speeds, V-G diagram
    note: >-
      Authoritative for the airplane the pilot is flying. Va, Vno, Vne,
      Vfe, Vlo, Vle, and any maneuver-specific recommended airspeeds
      live here.
  - source: 14 CFR 23
    detail: 'Airworthiness Standards -- Normal, Utility, Acrobatic, and Commuter Category'
    note: >-
      The certification basis for airspeed limitations and the load-factor
      structural limits the V-speeds protect.
  - ref: airboss-ref:handbooks/phak
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25
    note: >-
      The V-G diagram and the meaning of each V-speed in plain language. Va explanation including weight scaling.
  - ref: airboss-ref:handbooks/afh
    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3
    note: >-
      Practical guidance: when no manufacturer's recommended airspeed exists for a maneuver, do not exceed Va.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - calculation
mastery_criteria: >-
  Learner can: (1) recite Va, Vno, Vne, Vfe, Vlo / Vle for their training
  airplane at MTOW; (2) explain why Va decreases with weight; (3) compute
  Va at a non-MTOW weight using Va_w = Va_max × sqrt(W/W_max); (4) state
  the manufacturer's recommended airspeed for steep turns in their POH
  (or default to Va if not published); (5) state the ACS-required
  practice for V.A.S2: "establish the manufacturer's recommended airspeed;
  or if one is not available, an airspeed not to exceed VA."
---

# Maneuvering Airspeeds and Va

:::phase name="context"

The ACS for steep turns requires you to "establish the manufacturer's recommended airspeed; or if one is not available, an airspeed not to exceed the maneuvering speed (VA)." Two questions arise immediately:

1. What does my POH say is the recommended airspeed for steep turns?
2. What is Va for my airplane, and why does it matter?

If you cannot answer either, you cannot start the maneuver legally. If you can answer the first but not the second, you do not understand why the recommended airspeed is what it is -- which means you cannot adapt when the conditions change (lower weight, higher altitude, turbulence in the practice area).

This node is the airspeed reasoning behind every maneuver in Area V (and most of Area VII as well). It composes on `aero-load-factor-and-bank-angle` (the V-G diagram) and feeds `proc-execute-steep-turn` (the practical execution).

:::
:::phase name="problem"

You are about to do steep turns in a Cessna 172 at MTOW. The POH gives Va = 99 KIAS at MTOW. The "Performance Maneuvers" section recommends 95 KIAS for steep turns. You are at 1,800 lb (well below MTOW of 2,300 lb).

What airspeed do you fly? Why? What is Va at 1,800 lb? Does the recommended airspeed change at lower weight?

Write your answer before reading on.

:::
:::phase name="discover"

### Q1. What is Va?

Va is the maneuvering speed -- the highest airspeed at which abrupt or full deflection of a single primary flight control will not exceed the airplane's limit load factor.

Equivalently: Va is the airspeed where the stall line and the limit-load line meet on the V-G diagram. Below Va, the wing stalls before the load factor reaches the structural limit -- so the airplane is protected against pilot-induced overload. Above Va, the wing can sustain higher load factors than the structure; pilot-induced overload becomes a real possibility.

Va is published in the POH limitations section (Section 2) as a single number for MTOW. It is **not** a Vne; you can fly faster than Va in smooth air if you do not pull abruptly. The protection Va provides is against gust loads and against pilot-induced load factor spikes.

### Q2. Why does Va decrease with weight?

A lighter airplane stalls at a lower load factor than a heavier airplane (the stall is a function of AOA, not absolute lift; lighter airplane needs less lift to fly, so it stalls at a lower aerodynamic loading).

Limit load factor is set by the airframe structure and does not change with weight (the wing is still the same wing). So if the stall line moves down (lower load factor for a given airspeed) but the limit load line stays fixed, the corner where they meet -- Va -- moves to a lower airspeed.

The math:

```text
Va_w = Va_max × sqrt(W / W_max)
```

For a Cessna 172 at MTOW = 2,300 lb, Va = 99 KIAS:

| Weight (lb) | sqrt(W/W_max) | Va (KIAS) |
| ----------- | ------------- | --------- |
| 2,300       | 1.000         | 99        |
| 2,100       | 0.955         | 95        |
| 1,900       | 0.909         | 90        |
| 1,800       | 0.884         | 88        |
| 1,500       | 0.808         | 80        |

A lightly loaded C172 has Va around 80-88 KIAS. A pilot using the MTOW Va of 99 in turbulence at 1,500 lb is exceeding the actual Va by ~12 knots. A turbulence gust at that combination can produce structural overload.

The implication: Va in the POH is the conservative upper bound. The actual Va decreases with weight. Some POHs publish Va at multiple weights (more recent airplanes); older POHs publish only the MTOW value, leaving the pilot to compute.

### Q3. What other V-speeds matter for maneuvering?

| V-speed | Meaning                                                  | Notes                                                    |
| ------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Vs      | Stall in landing configuration                           | Full flap, gear down                                     |
| Vs1     | Stall in clean configuration                             | No flaps, gear up                                        |
| Vno     | Maximum structural cruising speed                        | Above this only in smooth air                            |
| Vne     | Never exceed                                             | Hard limit                                               |
| Vfe     | Maximum flap extended                                    | Per flap setting                                         |
| Vlo     | Maximum landing-gear operating (extending or retracting) | Retractable gear only                                    |
| Vle     | Maximum landing-gear extended                            | Retractable gear only                                    |
| Va      | Maneuvering speed                                        | Below this, full control deflection is structurally safe |
| Vx      | Best angle of climb                                      | Obstacle clearance                                       |
| Vy      | Best rate of climb                                       | Most altitude per minute                                 |
| Vg      | Best glide                                               | Engine-out                                               |

Va and the stall speeds are the maneuvering-relevant ones. The others matter for cruise, takeoff, landing, and gear/flap operation.

### Q4. What does the manufacturer's "recommended airspeed" for a maneuver mean?

It is the POH-published target for that specific maneuver. Examples from the C172 POH (numbers vary by year / model):

- Steep turns: ~95 KIAS (no abrupt control inputs above this)
- Slow flight: 1.2 Vs (varies with configuration)
- Stalls: entry at 65-70 KIAS clean, 60-65 KIAS landing config
- Turns around a point: 80-90 KIAS

These airspeeds are chosen by the manufacturer to:

- Stay below Va for the maneuver's intended bank.
- Provide adequate stall margin for the bank angle and load factor involved.
- Provide adequate control authority for the maneuver.
- Be conservative for varying loadings.

A pilot following the POH-recommended airspeed is operating in the manufacturer's tested envelope. A pilot deviating must justify why.

### Q5. What if the POH does not publish a recommended airspeed?

The ACS V.A.S2 says: "establish the manufacturer's recommended airspeed; or if one is not available, an airspeed not to exceed the maneuvering speed (VA)."

In practice, default to:

- Stalls / slow flight: 1.2 to 1.3 Vs (below Va, gives stall margin).
- Steep turns: just below Va (typically Va - 5 KIAS).
- Ground reference: 80-90 KIAS in light singles (well below Va).

The "not to exceed Va" rule is the structural floor. Pilots operating at lower-than-MTOW weight should adjust Va down as well.

### Q6. What does the V-G diagram tell you?

The V-G diagram is a plot of load factor (vertical) against airspeed (horizontal). It shows the safe combinations:

```text
load factor (G)
  ^
  |
  +-- limit load factor (3.8G normal)
  |
  |          /------stall line (parabolic)
  |        /
  |       /        FLIGHT ENVELOPE
  |      /
  +-----+-------+----------+----> airspeed
        Vs      Va         Vne
```

Below Vs: stall, cannot fly.
Between Vs and Va: stalling protects the airframe; pilot can full-deflect with no risk of structural damage.
Between Va and Vno: full deflection can produce structural damage; smooth control inputs only.
Between Vno and Vne: smooth air only; gust loads can overstress.
Above Vne: never go there.

Va is the elbow of the envelope. The pilot's structural protection.

### Q7. What is the practical implication for steep turns?

Steep turns at 45 degrees of bank produce 1.41 G. The structural limit is 3.8 G (normal category). Plenty of margin in steady level flight.

The risk is not steady flight; it is the dynamic part. If the airplane is at 110 KIAS in a steep turn (above Va = 99) and the pilot pulls abruptly to recover from a sag, the load factor can spike past 3.8 G before the wing stalls. The structure may or may not survive.

If the airplane is at 95 KIAS (just below Va) and the pilot pulls abruptly, the wing stalls at 3.8 G; the airplane shudders and unloads. No structural damage.

This is exactly why the POH recommends 95 KIAS for steep turns. The airspeed leaves Va as a "ceiling for full pull" so that a pilot's instinctive correction does not break the airplane.

### What Discover should have led you to

- Va is the corner of the V-G envelope; below it, stalling protects the airframe.
- Va decreases with weight (Va_w = Va_max × sqrt(W/W_max)).
- Manufacturer's recommended airspeed for a maneuver is just below Va.
- ACS default in absence of POH guidance: do not exceed Va.
- Steep turns at recommended airspeed protect against pilot-induced structural overload.
- The pilot must know Va for their airplane and adjust for weight.

:::
:::phase name="reveal"

### The summary rule

> Va is the maneuvering speed -- the highest airspeed at which full control deflection produces a stall before structural overload. It is the corner where the stall line meets the limit-load line on the V-G diagram. Va decreases with weight as Va_w = Va_max × sqrt(W/W_max). The manufacturer's recommended airspeed for a performance maneuver is generally just below Va, sized for the maneuver's load factor and a margin for pilot input. ACS V.A.S2 says: use the manufacturer's recommended airspeed; if none is published, do not exceed Va. The POH is the authoritative source. Pilots who fly above Va in turbulence or pull abruptly above Va risk structural damage; below Va, the wing stalls first and the airframe is protected.

### Va by weight (Cessna 172 example)

| Weight (lb)  | Va (KIAS) | Notes                    |
| ------------ | --------- | ------------------------ |
| 2,300 (MTOW) | 99        | POH-published            |
| 2,100        | 95        | Computed                 |
| 1,900        | 90        | Computed                 |
| 1,800        | 88        | Computed                 |
| 1,500        | 80        | Computed (light loading) |

Always check the POH for your airplane and year.

### V-speed reference

| Speed          | Use                                        |
| -------------- | ------------------------------------------ |
| Vs / Vs1       | Stall (landing / clean)                    |
| Va             | Maneuvering speed                          |
| Vno            | Max structural cruising (smooth air above) |
| Vne            | Never exceed                               |
| Vfe (per flap) | Max flap extended                          |
| Vlo / Vle      | Gear operating / extended (retractable)    |
| Vx / Vy        | Best angle / rate of climb                 |
| Vg             | Best glide                                 |

### The maneuver-airspeed default

```text
1. Open POH Section 4 (Normal Procedures) or Section 5 (Performance Maneuvers).
2. Find the recommended airspeed for the maneuver.
3. If none, use Va (adjusted for current weight).
4. Verify your weight and compute Va_w if not at MTOW.
5. Brief the airspeed before entering the maneuver.
```

### What is actually authoritative

In descending order:

1. **POH Section 2** -- limitations and V-speeds for the airplane.
2. **POH Section 4 / 5** -- recommended airspeeds for normal and performance maneuvers.
3. **ACS PPL-A V.A.S2** -- the regulatory floor (use POH or do not exceed Va).
4. **PHAK Aerodynamics chapter** -- the V-G diagram and Va explanation.

:::
:::phase name="practice"

### Cards (spaced memory items)

- `card:va-def` -- "What is Va?" -> "Maneuvering speed -- highest airspeed at which full control deflection causes stall before structural overload."
- `card:va-weight-formula` -- "Va at non-MTOW weight?" -> "Va_w = Va_max × sqrt(W / W_max)."
- `card:va-c172-mtow` -- "Va for a Cessna 172 at MTOW (typical)?" -> "Approximately 99 KIAS (check the specific POH)."
- `card:va-poh-priority` -- "What is the airspeed for a maneuver if the POH publishes one?" -> "Use the POH-recommended airspeed."
- `card:va-default` -- "Default airspeed for a maneuver if POH does not publish one?" -> "Do not exceed Va."
- `card:va-vg-corner` -- "What does Va represent on the V-G diagram?" -> "The corner where the stall line meets the limit-load factor line."
- `card:va-turbulence` -- "What airspeed is appropriate in turbulence?" -> "Va or below for the current weight."

### Reps (scenario IDs)

- `scenario:va-poh-lookup` -- pilot finds Va and the steep-turn recommended airspeed in their POH.
- `scenario:va-weight-correction` -- pilot computes Va_w for a specific load (no passengers, half fuel) and adjusts the maneuvering airspeed.
- `scenario:va-turbulence` -- in cruise turbulence at MTOW, pilot identifies the correct airspeed reduction (slow to Va).
- `scenario:va-checkride-call` -- examiner asks "what airspeed are you going to use for steep turns and why?" Pilot states POH-recommended (or Va default), why that's the correct number, and how it adjusts for weight.

### Drills (time-pressured)

- `drill:va-recall` -- pilot states Va for their airplane at MTOW in 5 seconds.
- `drill:va-weight-recall` -- given a weight, pilot computes Va_w in 10 seconds.

:::
:::phase name="connect"

### What changes if...

- **...you are at MTOW?** Va is the published number. Use it.
- **...you are well below MTOW?** Va is lower. Use the formula. The actual margin in turbulence shrinks if you fly the MTOW Va.
- **...you are flying a different airplane next week?** Look up the new POH. Do not assume Va or Vne are the same. Different make / model / year, different numbers.
- **...you are operating in turbulence?** Slow to Va or below. The gust load on top of your steady G can spike past limit-load above Va.
- **...you are doing aerobatic maneuvers?** Aerobatic-category airplanes have higher Va (because higher limit-load) and you may legitimately operate above the normal-category Va of the same airframe. Read the POH carefully.
- **...you are demonstrating slow flight (1.2 Vs1)?** Far below Va; structural margin is not the constraint. Stall margin is. The recommended airspeed is selected to leave 20% above stall, which is a perceptual / control-margin choice.

### Links

- `aero-load-factor-and-bank-angle` -- the V-G diagram and the limit-load reasoning behind Va.
- `aero-angle-of-attack-and-stall` -- the stall side of the Va-corner.
- `proc-execute-steep-turn` -- where Va is the airspeed ceiling.
- `proc-ground-reference-maneuvers` -- where airspeed selection is below Va.
- `perf-weight-and-balance` -- the weight that determines Va_w.

:::
:::phase name="verify"

### Novel scenario (narrative)

> You are flying a Cessna 172 with one passenger, half fuel. Total weight is 1,950 lb. The POH gives Va = 99 KIAS at 2,300 lb (MTOW) and lists steep turns at 95 KIAS recommended. You enter steep turns at 95 KIAS and hit moderate turbulence. What airspeed should you actually be at, and why?

Scoring rubric:

- Computes Va at 1,950 lb: Va_w = 99 × sqrt(1950/2300) = 99 × 0.921 = ~91 KIAS. (3)
- Recognises that 95 KIAS is now above the actual Va (91), so the manufacturer's recommended airspeed for steep turns at MTOW is too fast at this weight. (2)
- Slows to 88-90 KIAS to stay under Va_w. (2)
- Recognises that the stall margin at 88-90 KIAS in a 45-bank turn (Vs at 45 bank ≈ 57 KIAS) is still adequate (~30 KIAS margin). (2)
- For the turbulence: confirms staying at or below Va_w; gust loads on top of steady 1.41 G could spike past limit-load above Va. (2)
- Notes that the POH-recommended steep-turn airspeed assumes MTOW; below MTOW the pilot must do the math. (1)

12/12 is the bar. Below 8 is a redo.

### Teaching exercise (CFI)

> A student insists on flying steep turns at the POH-recommended 95 KIAS regardless of weight. They argue: "the POH says 95, so I fly 95." Diagnose and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student is treating the POH number as a constant when it is actually a function of weight. They have memorised the rule but not the reasoning.
- Teaching point: the POH-recommended airspeed is sized to be just below MTOW Va. At lower weight, Va is lower; the recommended airspeed should track downward.
- Whiteboard the V-G diagram. Show the student where Va sits and how the corner moves with weight.
- Drill: have the student compute Va_w for three different weights (MTOW, 1,900, 1,500). Build the muscle memory for the formula.
- Scenario discussion: turbulence at 1,800 lb, MTOW Va of 99 vs. actual Va of 88. The 11-knot difference is the structural margin the student is throwing away.
- The CFI is patient: this is a depth-of-understanding gap, not a procedural error. The student is not going to hurt anyone immediately by flying 95 at 1,950 lb in smooth air. But they will get caught when the next airplane has different numbers, or when turbulence hits, or when an examiner asks "why 95?"

The pedagogical move is to convert a memorised number into a derived one. Once the student computes Va themselves, the airspeed is not arbitrary -- it is owned.

:::