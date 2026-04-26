---
# === Identity ===
id: aero-load-factor-and-bank-angle
title: Load Factor and Bank Angle
domain: aerodynamics
cross_domains:
  - safety-accident-analysis

# === Knowledge character ===
# conceptual: load factor is the ratio of lift to weight; in level coordinated
#   turns it equals 1/cos(bank).
# perceptual: the body feels load factor as G; pilots learn the somatic
#   correlate of 1.41G (45 bank), 2G (60 bank), 3.8G (limit normal).
# factual: structural limits (3.8G normal, 4.4G utility, 6G aerobatic) and
#   operational implications (Vs scales as sqrt(load_factor)).
knowledge_types:
  - conceptual
  - perceptual
  - factual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - aero-four-forces
  - aero-angle-of-attack-and-stall
deepens: []
applied_by: []
taught_by: []
related:
  - proc-stall-recovery
  - proc-overspeed-recovery
  - proc-unusual-attitude-recovery
  - aero-cg-and-stability

# === Content & delivery ===
modalities:
  - reading
  - cards
  - calculation
  - drill
estimated_time_minutes: 45
review_time_minutes: 8

# === References ===
references:
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 5 -- Aerodynamics; load factor, V-G diagram, maneuvering
    note: >-
      Authoritative on load-factor math, bank-stall-speed relationship,
      and the V-G diagram (load factor as a function of airspeed).
  - source: AFH (FAA-H-8083-3B)
    detail: Chapter on maneuvers; steep turns; accelerated stalls
    note: >-
      Practical implications: how steep turns feel, why accelerated
      stalls happen, why pulling at high airspeed is dangerous.
  - source: 14 CFR 23
    detail: 'Airworthiness Standards: Normal, Utility, Acrobatic, and Commuter Category Aircraft'
    note: >-
      The structural limit-load specifications: normal 3.8G positive,
      utility 4.4G positive, acrobatic 6G positive.
  - source: AC 61-67C
    detail: Stall and Spin Awareness Training
    note: >-
      Connects load factor to stall regime; accelerated stall is the
      bank-induced stall above the unaccelerated stall airspeed.

# === Assessment ===
assessable: true
assessment_methods:
  - calculation
  - recall
  - demonstration
mastery_criteria: >-
  Learner can: (1) state the load-factor formula for a level coordinated
  turn (1/cos(bank)); (2) compute load factor and stall-speed multiplier
  for 30, 45, 60, and 75 degrees of bank; (3) describe what each load
  factor feels like; (4) cite the structural limits for normal, utility,
  and aerobatic categories; (5) explain why pulling at high airspeed in
  a steep bank can produce accelerated stall and structural overload;
  (6) at PPL level, demonstrate steep turns at 45 degrees with airspeed
  and altitude held within ACS tolerances.
---

# Load Factor and Bank Angle

## Context

A pilot in a 60-degree banked level turn is pulling 2 G. The airplane is producing twice the lift it does in level wings-level cruise. The wings are bent twice as hard. The pilot weighs twice their normal weight. The structure is doing real work.

A pilot in a 30-degree banked level turn is pulling 1.15 G. Barely noticeable. Most pilots do not feel the difference between 1.0 and 1.15 G; the airplane handles essentially the same.

The relationship is non-linear. Doubling bank from 30 to 60 degrees multiplies the load factor by 1.74 (1.15 to 2.0). Going to 75 degrees of bank takes the load factor to 3.86 -- right at the structural limit for a normal-category airplane. A pilot at 75 degrees of bank in level coordinated flight is one G away from breaking the airplane.

This non-linearity is the silent killer in maneuvers. A pilot who pulls a tighter base-to-final turn from 30 to 60 degrees of bank does not feel a "small additional pull"; they feel a doubling of the seat pressure. The airplane does not "tighten the turn slightly"; it doubles its effective weight, raises stall speed by 41%, and demands corresponding power and pitch attention.

This node is the math that anchors `proc-stall-recovery` (why bank produces stall), `proc-overspeed-recovery` (why pulling at high airspeed is dangerous), `proc-unusual-attitude-recovery` (why level wings before pulling), and the structural intuition behind every steep turn or aggressive maneuver.

## Problem

You are practising steep turns at 45 degrees of bank in a Cessna 172. You hold airspeed at 100 KIAS, altitude at 3,500 MSL. The CFI asks you to tighten the turn to 60 degrees of bank without losing altitude.

What changes about the airplane between 45 and 60 degrees of bank? What additional inputs do you need? What is your stall margin in each configuration?

Write your answer before reading on. Then ask: at what bank angle does the C172, at 100 KIAS, reach 1G of stall margin? At 90 KIAS? At 80?

## Discover

The relationship is from physics and trigonometry. Work through.

### Q1. What is load factor?

Load factor (n) is the ratio of total aerodynamic load on the airplane to the weight of the airplane:

```text
n = lift / weight
```

In wings-level steady flight, n = 1. The lift exactly equals the weight.

In a coordinated level turn, the lift vector tilts with the bank, so vertical component must equal weight. The total lift must be larger than weight by the cosine factor:

```text
n = 1 / cos(bank_angle)
```

Bank: 0 -> n = 1.0
Bank: 30 -> n = 1.15
Bank: 45 -> n = 1.41
Bank: 60 -> n = 2.00
Bank: 75 -> n = 3.86

The non-linearity comes from cos(bank) approaching zero as bank approaches 90 degrees. At 89 degrees of bank, n approaches infinity (which is why no airplane sustains a 90-degree bank in level flight).

### Q2. How does load factor relate to stall speed?

Stall speed scales with the square root of load factor:

```text
Vs_n = Vs_1 * sqrt(n)
```

So a 1G stall at Vs_1 = 48 KIAS becomes:

| Bank | n     | sqrt(n) | Vs_turn |
| ---- | ----- | ------- | ------- |
| 0    | 1.00  | 1.00    | 48      |
| 30   | 1.15  | 1.07    | 51      |
| 45   | 1.41  | 1.19    | 57      |
| 60   | 2.00  | 1.41    | 68      |
| 75   | 3.86  | 1.97    | 95      |

A C172 in a 60-degree banked level turn has its stall speed doubled-from-baseline minus 19%. At 100 KIAS, you have ~30 KIAS of stall margin. At 75 degrees, your stall speed is 95; at 100 KIAS, you have 5 KIAS of margin. One small pull and you are stalled.

### Q3. What does the structural envelope look like?

The V-G diagram plots load factor (vertical) against airspeed (horizontal). The envelope shows the safe combinations. Key features:

- **Stall line** (parabolic curve from low-airspeed origin upward): the wing stalls at any combination of airspeed and load factor on this line. Below the line, the airplane cannot fly.
- **Limit load factor lines** (horizontal at +3.8G normal, +4.4G utility, +6G aerobatic): structural limit. Pulling more G than this risks damage.
- **Vne line** (vertical): never-exceed speed.
- **Va (maneuvering speed)** is the airspeed at which the stall line and the limit load factor line meet. Below Va, the wing stalls before the structure breaks. Above Va, the structure breaks before the wing stalls.

The implication: at high airspeed, you cannot pull as hard. At low airspeed, you cannot pull as much without stalling.

### Q4. What does each load factor feel like?

| Load factor | Bank (level) | Body sensation                                                     |
| ----------- | ------------ | ------------------------------------------------------------------ |
| 1.0 G       | 0            | Normal seat pressure                                               |
| 1.15 G      | 30           | Slight increase; barely noticeable                                 |
| 1.41 G      | 45           | Noticeable; pilot leans into seat; "slight squish"                 |
| 2.0 G       | 60           | Strong; pilot definitely feels heavier; cheeks may sag              |
| 3.0 G       | 70           | Heavy; vision narrowing in some pilots                             |
| 3.8 G       | 75           | Limit-normal; full body pressure; vision can grey out              |
| 4.4 G       | 76+          | Limit-utility                                                       |
| 6.0 G       | ~80          | Limit-aerobatic; pilot must tense to maintain consciousness         |

Body sensitivity varies with G-tolerance, hydration, fitness, recent eating, and pulling technique. Aerobatic pilots train for higher G; normal pilots experience 1.5G as significant.

### Q5. What is an accelerated stall?

A stall at higher than published Vs_1, induced by load factor (i.e., G higher than 1).

Example: pilot in a 60-degree banked turn at 80 KIAS in a C172 (Vs_1 = 48). The accelerated stall speed is 48 * sqrt(2) = 68 KIAS. The pilot is at 80 KIAS, 12 KIAS of margin. They pull to tighten the turn, AOA increases, load factor goes up, accelerated stall onset.

The accelerated stall comes with no warning. The horn fires at the same AOA, but the airspeed is well above the published Vs_1, so a pilot looking only at airspeed thinks "I have margin" while AOA is already climbing.

This is the base-to-final stall pattern: pilot at approach speed, banked turn, pulling to make the runway, AOA spike, stall. Wings drop; if uncoordinated, spin.

### Q6. Why does the structure break above Va?

Below Va, the wing cannot generate enough lift to overload the airframe; it stalls first. Stalling is a pressure relief; the wing momentarily stops producing the higher G.

Above Va, the wing is in a regime where higher AOA can produce higher lift without stalling. The pilot can pull until the airframe structurally fails. Limit load factor (3.8G normal) is the certified limit; ultimate load factor is typically 1.5x limit (5.7G), beyond which structural damage or failure occurs.

The Va concept means: in turbulence, do NOT pull through it; the gust will spike load factor and you have no margin. Slow to Va or below.

### Q7. What does this mean for the pattern?

In the base-to-final turn:

- Approach speed in a C172: ~70 KIAS (1.3 Vso = 1.3 * 40 = 52, but most pilots fly 65-75).
- Bank in a coordinated base turn: 20-30 degrees.
- Stall speed at 30 bank: 1.07 * 48 (clean) or 1.07 * 40 (full flap) = 51 or 43.
- At 70 KIAS final, in a 30-degree banked turn, stall margin is 19-27 KIAS.
- At 70 KIAS in a 45-degree banked turn (overshooting and tightening): stall margin is 13-19 KIAS.
- At 70 KIAS in a 60-degree banked turn (severe overshoot): stall margin is 2 KIAS. Accelerated stall imminent.

The base-to-final stall is exactly this geometry: pilot tightens bank to make runway, stall margin collapses, AOA climbs from the pull, accelerated stall. Pattern fatal.

### Q8. What about coordination?

In a coordinated turn, the ball is centered, lift is perpendicular to the wings, and load factor follows 1/cos(bank).

In an uncoordinated turn (slip or skid), the ball is off-center. The airplane is not in a clean coordinated turn; load factor and stall speed depend on the specific configuration.

Skidding turn (rudder-induced overshoot): the airplane is yawed in the direction of turn beyond what coordinated bank would call for. This increases load factor on the inside wing and can produce a stall at lower airspeed than the coordinated stall speed -- the inside wing drops, the airplane snap-rolls into the turn, spin entry.

Slipping turn: yawed against the turn direction. Inside wing has lower AOA. Less stall risk but more drag.

The base-to-final skidding stall is a particular killer: pilot tightens with rudder rather than aileron, inside wing stalls, snap-roll into ground.

### What Discover should have led you to

- Load factor is non-linear with bank: 30->45 is small, 45->60 is large, 60->75 is severe.
- Stall speed scales with sqrt(load factor); at 60 bank, Vs is 41% higher.
- Va is the corner where stall protects the airframe. Below Va: stall first. Above Va: structure breaks first.
- Accelerated stalls happen with no airspeed warning; AOA does the work.
- The pattern's base-to-final turn at low airspeed in steep bank is the canonical killer geometry.
- Coordination matters; uncoordinated stalls roll into spins.

## Reveal

### The summary rule

> Load factor in a level coordinated turn is 1/cos(bank). Stall speed scales with sqrt(load factor). At 60 degrees of bank, load factor is 2G and stall speed is 41% higher than wings-level. The structural limit for normal-category airplanes is 3.8G; for utility 4.4G; for aerobatic 6G. Maneuvering speed (Va) is where the stall line meets the limit load factor line; below Va, stalling protects the airframe; above Va, the airframe breaks before the wing stalls. In turbulence, slow to Va or below. In banked turns at low airspeed, accelerated stall is the threat; the base-to-final overshoot tightening into a skidding stall is the canonical fatal accident geometry.

### The math

```text
Load factor in a level coordinated turn:
n = 1 / cos(bank)

Stall speed in a banked turn:
Vs_turn = Vs_level * sqrt(n)
        = Vs_level * sqrt(1 / cos(bank))
```

Numerical values:

| Bank (deg) | cos(bank) | n     | sqrt(n) | Vs multiplier |
| ---------- | --------- | ----- | ------- | ------------- |
| 0          | 1.000     | 1.00  | 1.00    | 1.00          |
| 15         | 0.966     | 1.04  | 1.02    | 1.02          |
| 30         | 0.866     | 1.15  | 1.07    | 1.07          |
| 45         | 0.707     | 1.41  | 1.19    | 1.19          |
| 60         | 0.500     | 2.00  | 1.41    | 1.41          |
| 75         | 0.259     | 3.86  | 1.97    | 1.97          |
| 80         | 0.174     | 5.76  | 2.40    | 2.40          |

### Structural limits

| Category   | Positive limit | Negative limit | Typical certified for                  |
| ---------- | -------------- | -------------- | -------------------------------------- |
| Normal     | +3.8 G         | -1.52 G        | Most light singles (PA28, C172)        |
| Utility    | +4.4 G         | -1.76 G        | Some light singles (C172 in utility category, lighter weight) |
| Aerobatic  | +6.0 G         | -3.0 G         | Aerobatic singles (Decathlon, Pitts)   |

Ultimate load factor is typically 1.5x limit. Exceeding ultimate produces structural damage or failure.

### V-G diagram and Va

```text
load factor (G)
 ^
 +3.8 ---+----stall line (parabolic)
 |       /
 +1   ./        normal flight envelope
 |    /
   --+---+------+---+----> airspeed
    Vs   Va    Vno  Vne

      ^ stall    ^ limit-load    ^ never exceed
        before     vs. stall
        structure
```

Va is the airspeed where the stall line crosses the limit-load line. Below Va, full elevator deflection produces a stall; the airframe is protected. Above Va, full elevator can produce structural damage.

Va decreases with weight (lighter airplane stalls at lower load factor; therefore Va is lower).

### Accelerated stall geometry

In a 45-degree banked turn at 70 KIAS in a C172 (Vs_1 = 48):

```text
Vs_turn = 48 * 1.19 = 57 KIAS
margin = 70 - 57 = 13 KIAS
```

A pilot pulling to tighten the turn raises AOA; if they pull through the new Vs (57), accelerated stall.

In a 60-degree banked turn at 70 KIAS:

```text
Vs_turn = 48 * 1.41 = 68 KIAS
margin = 70 - 68 = 2 KIAS
```

Almost no margin. Any pull produces stall.

### What is actually authoritative

In descending order:

1. **POH Section 2** -- limitations: limit load factor, Va, V-G diagram if published.
2. **POH Section 4** -- stall speeds at various bank angles (some POHs publish a table).
3. **PHAK Chapter 5** -- the load-factor math.
4. **AC 61-67C** -- accelerated stall awareness.

### location_skill

- POH Section 2 -- find Va and limit load factor for your airplane.
- POH Section 5 -- stall speeds at various banks (if published; many do not, but some do).
- PHAK Chapter 5 -- read the load-factor section.

## Practice

### Cards (spaced memory items)

- `card:lf-formula" -- "Load factor in a level coordinated turn?" -> "1 / cos(bank_angle)."
- `card:lf-30-bank" -- "Load factor at 30-degree bank?" -> "1.15 G."
- `card:lf-45-bank" -- "Load factor at 45-degree bank?" -> "1.41 G."
- `card:lf-60-bank" -- "Load factor at 60-degree bank?" -> "2.0 G."
- `card:lf-75-bank" -- "Load factor at 75-degree bank?" -> "3.86 G (near limit-normal)."
- `card:lf-vs-formula" -- "Stall speed in a banked turn?" -> "Vs_turn = Vs_level * sqrt(load_factor) = Vs_level * sqrt(1/cos(bank))."
- `card:lf-vs-multiplier-45" -- "Stall speed multiplier at 45 bank?" -> "1.19x."
- `card:lf-vs-multiplier-60" -- "Stall speed multiplier at 60 bank?" -> "1.41x."
- `card:lf-normal-limit" -- "Limit load factor for normal-category aircraft?" -> "+3.8 G positive, -1.52 G negative."
- `card:lf-aerobatic-limit" -- "Limit load factor for aerobatic-category aircraft?" -> "+6.0 G positive, -3.0 G negative."
- `card:lf-va-meaning" -- "Maneuvering speed (Va)?" -> "Airspeed where stall line meets limit load factor; below Va, stall protects airframe; above, structure breaks before wing stalls."
- `card:lf-va-with-weight" -- "Va with decreasing weight?" -> "Decreases (lighter airplane stalls at lower load factor)."
- `card:lf-base-final-stall" -- "Why is base-to-final the canonical pattern stall?" -> "Low airspeed in banked turn; pilot pulls to tighten; AOA spike; stall margin collapses; accelerated stall."

### Reps (scenario IDs)

- `scenario:lf-steep-turn-tightening" -- learner is in a 45 banked turn at 100 KIAS; tightens to 60 to make a target; stall margin tested.
- `scenario:lf-base-overshoot-tighten" -- pilot overshoots base-to-final centerline and tightens with rudder; skidding stall prevention.
- `scenario:lf-turbulence-cruise" -- pilot in turbulence at 130 KIAS in a normal-category C172; should they slow to Va?
- `scenario:lf-aerobatic-vs-normal" -- the same maneuver in an aerobatic-category vs. normal-category airplane; structural margin difference.
- `scenario:lf-emergency-pull-up" -- pilot in nose-low at 150 KIAS, must pull to recover; smooth vs. abrupt and load-factor implications.

### Drills (time-pressured)

- `drill:lf-bank-to-load" -- given a bank angle, learner calculates load factor in 5 seconds.
- `drill:lf-stall-margin-calc" -- given Vs_1 and bank, learner computes Vs_turn and stall margin from current airspeed.
- `drill:lf-va-from-poh" -- learner recites Va for the training airplane at MTOW and at typical operating weight.

### Back-of-envelope calculations

**Calculation 1: stall margin at 60 bank, 80 KIAS, in a C172.**

```text
Vs_1 (clean, MTOW) = 48 KIAS
Vs at 60 bank = 48 * 1.41 = 67.7 KIAS

margin = 80 - 67.7 = 12.3 KIAS
```

12 KIAS of margin. Tightening the turn (more pull = more G = more Vs) eats the margin fast. A pull from 60 to 65 bank takes Vs to 48 * sqrt(2.37) = 74 KIAS, leaving 6 KIAS of margin.

**Calculation 2: Va at lower weight.**

C172 at MTOW (2,300 lb): Va = 99 KIAS.
C172 at 1,800 lb (near min): Va = 99 * sqrt(1800/2300) = 99 * 0.884 = 88 KIAS.

A lightly loaded C172 in turbulence should be at 88 KIAS or below, not 99.

**Calculation 3: structural margin in a steep turn.**

C172 normal-category limit: 3.8 G.
60-degree banked level coordinated turn: 2 G.
Margin: 1.8 G of additional pull before reaching limit-load.

That sounds like a lot. But: at 100 KIAS in a 60-bank turn, pulling to 3.8 G means the wing is producing nearly twice the lift of the level-turn baseline; AOA is climbing fast; you may stall before reaching limit-load (which is exactly what Va is designed to ensure).

If you're at 130 KIAS (above Va = 99) in a 60-bank turn pulling to 3.8 G: you might exceed limit-load before the wing stalls. Slow before pulling.

## Connect

### What changes if...

- **...you are flying an aerobatic airplane?** Higher structural limits (6 G normal, 3 G negative). Same physics; just more margin. Aerobatic pilots regularly fly 4-5 G; cardiovascular tolerance is the limit, not the airframe.
- **...you are in a glider?** Different stall and load behavior; no engine to add power. Bank-stall-speed relationship is the same.
- **...you are in turbulence?** Slow to Va or below for the current weight. Gust loading can spike load factor; pre-loading the airplane via airspeed reduces the gust-induced spike.
- **...you are pulling up from a dive?** Smooth pull below Va is structural-safe. Smooth pull above Va: still safe if pull rate is moderate. Abrupt pull above Va: can exceed limit load factor.
- **...you are in a steep turn checkride?** ACS specifies 45 banked steep turn for PPL. Tolerance: altitude +/- 100 ft, airspeed +/- 10 KIAS, bank +/- 5 degrees. Hold for 360 degrees of turn.
- **...you are in unusual attitude recovery?** Wings level before pulling. The reason is exactly this: pulling in steep bank produces accelerated stall and structural overload; level wings first.
- **...you are demonstrating to a student?** Be deliberate about the load-factor explanation. Many students learn the math but do not feel the body cue; deliberate steep turns with attention to body sensation builds the perceptual side.

### Links

- `aero-angle-of-attack-and-stall` -- the stall is AOA-based; load factor changes Vs but the underlying mechanism is unchanged.
- `aero-four-forces` -- the equilibrium being modified by lift exceeding weight.
- `proc-stall-recovery` -- the procedural response to accelerated stall; first action is AOA reduction.
- `proc-overspeed-recovery` -- limit load factor matters during recovery from high-speed dive.
- `proc-unusual-attitude-recovery" -- nose-low recovery requires wings-level before pull because of this physics.
- `aero-coordination-rudder" -- coordinated turns follow the cos-formula; uncoordinated turns are non-standard and more dangerous.
- `aero-cg-and-stability` -- CG position affects stick-force-per-G during pulls, the perceptual side of load factor.

## Verify

### Novel scenario (narrative)

> You are a primary student preparing for your private checkride. The CFI asks you to demonstrate steep turns at 45 degrees of bank, both directions, while holding altitude +/- 100 ft and airspeed +/- 10 KIAS. You execute the right turn well; on the left turn, you over-bank to 50 degrees about 270 degrees through the turn, lose 80 feet of altitude, and slow to 87 KIAS (your target was 100).
>
> Diagnose what happened, the load-factor implications, and what you do on the next turn.

Scoring rubric:

- Identifies the cause: over-bank to 50 produced 1.56 G; pulling to hold altitude raised AOA further; airspeed bled to 87. (3)
- Computes Vs at 50 bank: 48 * sqrt(1.56) = ~60 KIAS. Margin at 87 KIAS: ~27 KIAS, still safe but tighter than at 100 KIAS / 45 bank (margin 43). (2)
- Identifies that altitude loss came from insufficient back-pressure (not enough G to maintain altitude at the steeper bank). (2)
- Plans the next turn: roll to 45 deliberately, hold, watch for over-bank, use rudder to counter overshoot rather than bank. (2)
- Notes that next over-bank toward 60 would push margin to: Vs_60 = 48 * 1.41 = 68; at 87 KIAS, only 19 KIAS of margin; danger zone if the pull continues. (2)
- Resets and demonstrates a clean 45-bank turn within tolerances. (2)

13/13 is the bar. Below 9 is a redo.

### Teaching exercise (CFI)

> A student demonstrates correct steep turns at altitude but is consistently uncoordinated in pattern turns at lower altitudes. They use rudder to "tighten" the turn when overshooting the centerline; the ball is to the left during right turns and to the right during left turns -- a skidding pattern.
>
> Diagnose the load-factor and accelerated-stall implications and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: skidding turn at low altitude in pattern is the canonical accelerated stall geometry. The student's habit will get them killed.
- Teaching point: in a skid (uncoordinated), the inside wing has higher effective AOA; if the pilot pulls (instinct when the bank doesn't tighten the turn fast enough), the inside wing stalls first and snap-rolls. With low altitude, no recovery.
- The fix: when overshooting centerline, REDUCE bank (not increase rudder). Coordinate every turn. Use rudder to counter adverse yaw, not to tighten the turn.
- Drill assigned: 10 simulated pattern turns with explicit ball-watching; CFII calls "ball" the moment it goes off-center. Build the coordination habit.
- Discusses the broader pattern: "tighten with rudder" is a habit that comes from primary students who learned to use rudder as a yaw control rather than a coordination control. Aggressive correction.
- The CFII is firm: this is not a comfort-level issue, it is a will-it-kill-me issue. The student adjusts their behavior or they do not pass the checkride.

The pedagogical move is to convert "skidding to make the runway" from a tactical response into a kill-chain. The student must understand they are practicing the exact maneuver that NTSB statistics describe as the dominant pattern fatality. That changes the urgency.
