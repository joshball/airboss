---
# === Identity ===
id: proc-unusual-attitude-recovery
title: Unusual Attitude Recovery
domain: emergency-procedures
cross_domains:
  - aerodynamics
  - ifr-procedures
  - adm-human-factors

# === Knowledge character ===
# procedural: there is a memorised sequence for nose-high (power, pitch down,
#   wings level) and nose-low (power, wings level, pitch up) recoveries.
# perceptual: identifying which kind of unusual attitude you are in -- nose-
#   high or nose-low -- is the entry point. The first half-second is mostly
#   reading the AI under stress.
# judgment: when do you accept altitude loss, when do you ride out a steep
#   bank, when do you trust the AI in IMC over your body? Recovery is partly
#   willingness to override instinct.
knowledge_types:
  - procedural
  - perceptual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires:
  - aero-angle-of-attack-and-stall
  - aero-load-factor-and-bank-angle
  - proc-instrument-cross-check
deepens: []
applied_by: []
taught_by: []
related:
  - proc-stall-recovery
  - proc-overspeed-recovery
  - proc-spatial-disorientation
  - nav-partial-panel

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 60
review_time_minutes: 10

# === References ===
references:
  - source: Instrument Flying Handbook (FAA-H-8083-15B)
    detail: Chapter on Recovery from Unusual Flight Attitudes
    note: >-
      Authoritative for the FAA's standard recovery sequence -- nose-high
      and nose-low -- and the rationale for the order of control inputs.
  - source: AFH (FAA-H-8083-3B)
    detail: Recovery from unusual attitudes (visual)
    note: >-
      The visual analog of the IMC recovery procedure. Often used as the
      teaching baseline before adding the hood.
  - source: AC 61-67C
    detail: Stall and Spin Awareness Training
    note: >-
      Conceptual context for why unusual attitudes are not just wrong
      attitudes but high-AOA / high-load-factor regimes that demand
      specific stall-margin handling.
  - source: ACS / PTS standards
    detail: Instrument rating practical test -- recovery from unusual flight attitudes
    note: >-
      The candidate must demonstrate prompt and correct recovery from
      both nose-high and nose-low unusual attitudes without exceeding
      operating limitations.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) recite the nose-high recovery sequence (full power,
  pitch forward to break the climbing stall, level wings) and the
  nose-low recovery sequence (reduce power, level wings, pitch up to
  level) and explain the order; (2) identify the attitude type within
  3 seconds from the AI under partial-panel conditions; (3) demonstrate
  recoveries without exceeding load or airspeed limitations; (4) explain
  why the order differs between nose-high and nose-low; (5) connect
  unusual-attitude development to its precursors (scan breakdown,
  spatial disorientation, control-input error compounding).
---

# Unusual Attitude Recovery

## Context

An unusual attitude is the airplane in a configuration the pilot did not intend and is not normal for the maneuver they thought they were flying. The two cases are nose-high (climbing, slowing, often banked, often near stall) and nose-low (descending, accelerating, banked, often near Vne). Both happen in IMC after a scan breakdown -- a few seconds of distraction, a clearance amendment that pulled attention head-down, an instrument failure that fed the autopilot wrong data, a spatial disorientation episode where the pilot followed body cues into a banked dive.

The recovery is not complicated. It is two sequences, four moves each, drilled to muscle memory. The reason it kills pilots anyway is that the recovery requires overriding instincts at exactly the moment those instincts are screaming. In a nose-low spiral, the pilot's instinct is to pull. Pulling at high airspeed in a steep bank exceeds the limit load factor; the airplane comes apart, or the pilot stalls accelerated and rolls into the dive. In a nose-high near-stall, the pilot's instinct is to level the wings first because banked is wrong. Levelling stalled wings does not work; AOA reduction has to come first.

This node sits between `proc-stall-recovery` and `proc-overspeed-recovery`. Stall-recovery is when the wings have stopped flying. Overspeed-recovery is when speed has exceeded Vne. Unusual-attitude recovery is when neither has happened yet but is about to if the pilot does the wrong thing. The window is small.

The discipline that prevents unusual attitudes is `proc-instrument-cross-check`. The recovery is a backup plan for when the cross-check failed.

## Problem

You are hand-flying in IMC at 6,000, on a routine cruise leg. ATC clears you to descend to 4,000. You start the descent, retard the throttle, set the airplane up at 90 KIAS in a 500-fpm descent. Forty-five seconds in, you reach for a chart on the floor that slid off your kneeboard. You have your eyes off the panel for about 6 seconds. When you look up, the AI shows 30 degrees of right bank, nose 15 degrees below the horizon. Airspeed is 130 KIAS and rising. Altitude is showing 4,200 and falling at 2,000 fpm. The DG is rotating right at maybe 5 deg/sec.

What do you do, in order, in the next 5 seconds?

Write your answer before reading on. Then ask: what would the recovery look like if instead, you had looked up to see 25 degrees nose-high, 30 degrees of bank, airspeed dropping through 60 KIAS?

## Discover

The recovery decomposes into four steps that differ by direction. Work through each.

### Q1. Why is the nose-high vs. nose-low distinction important?

Because the dangers differ.

Nose-high, slowing: stall is imminent. AOA is climbing. Power is needed to extend the airspeed margin and the bank must come down -- but pulling on the elevator (the instinct to "level off") deepens the AOA problem. The danger is the stall.

Nose-low, accelerating: overspeed is imminent. Vne is approaching. Load factor is climbing as the airplane spirals (the bank is producing G even before the pilot pulls). The danger is structural overload from a high-airspeed pull.

Same airplane, very different problem. Recovery sequences are designed around the dominant danger.

### Q2. What is the nose-high recovery sequence?

```text
1. Add full power (extend stall margin; reduce required AOA for level flight).
2. Pitch forward (reduce AOA actively; nose toward horizon).
3. Level the wings with coordinated aileron and rudder.
4. Return to assigned altitude / heading.
```

Why power before pitch? Adding power reduces the AOA needed to maintain altitude (it provides thrust component along the longitudinal axis, which subtracts from the lift demand). Power also accelerates the airplane, which raises the stall margin. With more power and more airspeed, the pitch reduction does not produce excessive altitude loss because the airplane is being held up.

If you reduced AOA first without adding power, the airplane would un-stall but begin to descend rapidly while still slow. Adding power simultaneously is the standard.

In some POHs and training texts, the sequence is "power, pitch, bank" said as one unit. The actions may be near-simultaneous in practice; the priority is power early, AOA reduction next, wings third.

### Q3. What is the nose-low recovery sequence?

```text
1. Reduce power (slow the airspeed increase; do not aggravate overspeed).
2. Level the wings with coordinated aileron and rudder.
3. Pitch up smoothly to level flight (do not snatch the elevator).
4. Return to assigned altitude / heading.
```

Why bank before pitch? Two reasons.

First, in a steep bank, the airplane's lift vector has a horizontal component pulling the airplane around the turn. Pulling on the elevator in a steep bank does not produce vertical lift; it tightens the turn and adds load factor. You must level the wings before pulling, or you overload the airframe.

Second, the airplane is spiraling -- altitude is bleeding off because the lift vector is tilted. Levelling the wings stops the spiral and converts the lift vector to vertical. Then the pitch-up is effective.

The sequence "reduce power, level wings, pitch up" is the answer to "why does the airplane keep accelerating even after I started pulling?" -- because the bank makes the pull ineffective. Level first.

### Q4. Why is power management different between the two?

Nose-high: more power, less AOA. The airplane is slow and climbing into a stall; you need to convert thrust into airspeed and reduce demand on the wing simultaneously.

Nose-low: less power, more pitch (after wings level). The airplane is fast and descending; reducing power slows the energy gain and avoids structural overload from the pull-up.

Get the power direction right and the rest follows. Get it wrong and you make the situation worse on both axes.

### Q5. How do you avoid making it worse?

Three traps:

| Trap                                  | Symptom                                                          | Fix                                          |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Pull in a steep nose-low bank          | Load factor spikes; accelerated stall; or G-loading airframe     | Level wings BEFORE pull                      |
| Pull at high airspeed nose-low         | Airframe overload (Vne / Va exceeded by maneuvering)             | Reduce power first; gentle pull              |
| Drop the nose hard nose-high           | Negative G; pilot lifts out of seat; control authority confusion | Smooth forward pressure, not push           |
| Trust body over instruments in IMC     | Pilot recovers to the wrong attitude (the felt one)              | Trust AI; ignore vestibular cues             |
| Forget the AI is failed (vacuum out)   | Pilot recovers to a "level" indication that is itself wrong      | Verify AI agreement with TC + ASI + altimeter |

### Q6. How does scan failure produce an unusual attitude in the first place?

Three common pathways:

1. **Distraction.** Pilot goes head-down for 5-10 seconds (chart, frequency change, autopilot programming, passenger). Trim is not perfect; airplane wanders. By the time pilot looks up, the airplane has drifted past nominal into noticeable deviation.
2. **Autopilot failure.** AP disengages or drifts; pilot does not catch it for 30+ seconds. The unusual attitude develops while the pilot believed the airplane was being flown.
3. **Spatial disorientation.** Pilot follows body cues into a banked descent (graveyard spiral) without realising. The AI shows the bank but the pilot does not see it because the body says "wings level."

The first two are scan failures. The third is sensory failure under IMC conditions; the recovery is the same but the cognitive override is harder.

### What Discover should have led you to

- Nose-high and nose-low differ by which limit is closer (stall vs. overspeed/structural).
- Nose-high recovery: power, pitch, bank.
- Nose-low recovery: power-reduce, bank, pitch.
- Power direction is the key tell -- add power for nose-high, reduce for nose-low.
- Pulling in a steep bank tightens the turn; level wings first.
- Body cues lie in IMC; trust the AI, but verify it is not the failed instrument.

## Reveal

### The summary rule

> Unusual-attitude recovery: identify the attitude (nose-high vs. nose-low) from the AI within 3 seconds. Nose-high: full power, pitch forward to break stall margin, level wings. Nose-low: reduce power, level wings, pitch up smoothly. Do not pull in a steep bank; do not snatch the elevator at high airspeed. Verify the AI agrees with the rate instruments before committing the recovery; if AI is suspect, recover on partial panel from airspeed + altimeter + turn coordinator.

### Recovery sequences side by side

| Step | Nose-high                                  | Nose-low                                    |
| ---- | ------------------------------------------ | ------------------------------------------- |
| 1    | Power: full                                | Power: reduce                               |
| 2    | Pitch: forward (break AOA)                 | Wings: level (coordinated)                  |
| 3    | Wings: level (coordinated)                 | Pitch: up smoothly                          |
| 4    | Return to assigned altitude / heading      | Return to assigned altitude / heading       |

The order of steps 2 and 3 is the only structural difference. It matters because the dominant danger differs.

### Limits to respect during recovery

- Stall speed in a banked turn: Vs * sqrt(load factor). Pulling at high bank in nose-low recovery accelerates stall. Wings level first.
- Vne: never exceed in any flight regime. Power reduction in nose-low first prevents Vne penetration.
- Va (maneuvering speed): full or abrupt control inputs can exceed structural limits above Va. In nose-low recovery, smooth pull, not abrupt.
- Limit load factor: 3.8 G positive for normal-category aircraft (utility 4.4, aerobatic 6). Pulling in a 60-degree bank with a snatch on the elevator can exceed this.

### Why "smooth" matters

In a real recovery, the pilot is startled, fast, banked, and descending. The instinct is to pull hard. Hard pulls produce:

- Accelerated stall (if the airplane is also banked).
- Structural overload (above Va).
- G-induced grayout in extreme cases.

"Smooth" is not "slow." It is "without surprise to the airplane." The pull-up after wings-level should be confident and continuous, taking the airplane to level in 2-4 seconds, not in 10 seconds and not in 0.5 seconds.

### Verifying the AI

Before committing the recovery, take half a second to verify the AI:

- Turn coordinator: should agree with the AI on bank direction.
- Airspeed: should agree with AI on pitch (rising for nose-low, falling for nose-high).
- Altimeter: should agree with AI on pitch (descending for nose-low, climbing or stable for nose-high).
- Magnetic compass: should agree with AI / DG on turn rate direction.

If two or more disagree with the AI, the AI is the suspect instrument. Recover on partial panel: airspeed and altimeter for pitch, turn coordinator for bank, until you have time to diagnose. See `nav-partial-panel`.

### What is actually authoritative

In descending order:

1. **POH Section 4 / Section 3** for your specific airplane's recovery procedure (some have type-specific notes, especially in twins or high-performance).
2. **IFH chapter on unusual-attitude recovery** for the FAA framing.
3. **AFH equivalent chapter** for the visual-conditions analog.
4. **AC 61-67C** for the stall-margin context.

### location_skill

- IFH, chapter on recovery from unusual flight attitudes. Read it; the FAA's specific wording is what the examiner uses.
- POH Section 4 -- "Maneuvering Speeds" and "Limit Load Factor" -- the limits you must respect during recovery.
- ACS / PTS instrument rating standards -- task elements specifying recovery tolerances.

## Practice

### Cards (spaced memory items)

- `card:ua-nose-high-sequence` -- "Nose-high unusual-attitude recovery sequence?" -> "Full power; pitch forward to break stall margin; level wings; return to altitude."
- `card:ua-nose-low-sequence` -- "Nose-low unusual-attitude recovery sequence?" -> "Reduce power; level wings; pitch up smoothly; return to altitude."
- `card:ua-why-power-up-high` -- "Why full power for nose-high recovery?" -> "Extends stall margin and reduces AOA needed to hold altitude during the recovery."
- `card:ua-why-power-down-low" -- "Why reduce power for nose-low recovery?" -> "Slows airspeed gain; prevents Vne penetration; reduces airframe load during pull-up."
- `card:ua-why-bank-before-pitch-low" -- "Why level wings before pulling in nose-low recovery?" -> "In a steep bank, the lift vector is tilted; pulling tightens the turn rather than lifting the nose, and risks accelerated stall or structural overload."
- `card:ua-AI-verification" -- "Before committing recovery, what do you verify on the AI?" -> "Agreement with TC (bank), ASI (pitch trend), altimeter (pitch trend); if 2+ disagree, AI is suspect."
- `card:ua-smooth-not-slow" -- "What does 'smooth' mean during recovery pull-up?" -> "Continuous and confident, 2-4 seconds to level; not abrupt, not slow."
- `card:ua-three-precursors" -- "Three precursors to unusual attitudes in IMC?" -> "Distraction / scan breakdown; autopilot drift or failure; spatial disorientation."
- `card:ua-cross-check-protect" -- "Best protection against unusual attitudes?" -> "Working selective-radial-scan with primary/supporting awareness."
- `card:ua-Va-recovery" -- "Why is Va relevant during nose-low recovery?" -> "Full or abrupt elevator inputs above Va can exceed structural limits; smooth recovery below Va is the protected regime."

### Reps (scenario IDs)

- `scenario:ua-IMC-distraction-nose-low" -- the opening scenario; pilot looks up after a 6-second distraction to find a nose-low spiraling dive.
- `scenario:ua-IMC-distraction-nose-high" -- pilot looks up to find airspeed dropping through 60 KIAS, 25 nose-high, 30 banked.
- `scenario:ua-AP-disengage-spiral" -- autopilot disengages with a chirp; pilot does not catch it for 45 seconds; airplane is in a 60-degree spiral.
- `scenario:ua-vacuum-fail-AI-lying" -- AI showing wings level; airplane is actually in 30 banked nose-low. Pilot must recover on partial panel.
- `scenario:ua-spatial-dis-graveyard-spiral" -- pilot's vestibular system says wings-level; AI shows 40 banked descent. Recovery is mostly cognitive override.
- `scenario:ua-recovery-from-near-Vne" -- airspeed at 150 KIAS in a 50-degree banked nose-low descent; pilot must reduce power before levelling and pulling.

### Drills (time-pressured)

- `drill:ua-3-second-identify` -- 20 randomised AI snapshots; learner identifies nose-high vs. nose-low and calls the first action within 3 seconds.
- `drill:ua-recovery-sequence-recall" -- instructor cues an unusual attitude type; learner recites the sequence in order naming each control input.
- `drill:ua-AI-verification" -- learner is shown the full panel with one or more instruments disagreeing with the AI; identifies which is the trustworthy reference.
- `drill:ua-IMC-recovery-simulator" -- simulator drill with random unusual-attitude entries; recoveries graded on time, sequence, and limit observance.

### Back-of-envelope calculations

**Calculation 1: stall speed at 60 degrees of bank.**

C172 stall (clean, MTOW): 48 KIAS at 1G.
Load factor at 60 bank: 1 / cos(60) = 2.0 G.
Vs at 60 bank: 48 * sqrt(2) = ~68 KIAS.

In a nose-low spiral with airspeed at 70 KIAS and 60 bank, a hard pull spikes load factor and stalls the airplane. Level the wings first to drop load factor before pulling.

**Calculation 2: structural limit pull at high airspeed.**

Limit load factor (normal category): 3.8 G.
At 130 KIAS in a 30-degree bank, level: 1.15 G.
Pull to 3.8 G: airplane eats limit; one more G margin and structural damage occurs.

Reducing power first lets airspeed bleed during the pull, keeping the dynamic-pressure G product within limits.

**Calculation 3: time to recover from nose-low spiral.**

If at 130 KIAS, 30-degree bank, 1,500 fpm down, the recovery takes:

- 1 second: identify, retard power.
- 1-2 seconds: level wings.
- 2-3 seconds: pitch up to level.

Total ~5 seconds. Altitude lost: roughly 125 feet at 1,500 fpm. That is the budget. Slower recovery, more altitude lost, eventually below terrain or below MEA.

## Connect

### What changes if...

- **...you are visual?** Use the horizon. Same control sequence, but identification is faster and the body's cues align with the picture.
- **...you are on partial panel?** Identify the attitude from airspeed (rising = nose-low, falling = nose-high) and altimeter (descending = nose-low, climbing = nose-high). Bank from turn coordinator. Recovery sequence unchanged.
- **...you are in a high-performance airplane (Cirrus, Bonanza)?** Time budget is shorter; airspeed builds faster; Vne is closer. Power reduction in nose-low must be aggressive. Some POHs add specific notes (e.g., immediate gear extension to add drag in some twins).
- **...the autopilot is on?** Disengage immediately. AP may be the cause (servo runaway, failed input source) or may compete with your inputs.
- **...you are at minimums on an approach?** Unusual attitude near minimums in IMC is essentially fatal if not recovered immediately. Go missed if you have any altitude; otherwise the recovery is the same and you accept whatever ground impact happens. The lesson is do not let it develop.
- **...you have just stalled?** The recovery is the stall recovery (`proc-stall-recovery`); if it overshoots into a steep nose-low or nose-high, you are now in the unusual-attitude case. Sequences merge: AOA reduction first, then attitude recovery.
- **...you are over Vne?** That is `proc-overspeed-recovery`. Power reduction is the same first move; recovery sequence largely the same with additional emphasis on smooth pull-up to avoid breaking the airplane.

### Links

- `aero-angle-of-attack-and-stall` -- AOA is the first thing managed in the nose-high case; the stall is the closest danger.
- `aero-load-factor-and-bank-angle` -- explains why pulling in a steep bank increases load factor instead of altitude. The structural and stall implications drive the order.
- `proc-stall-recovery` -- when the unusual attitude tipped over into actual stall, the procedure merges.
- `proc-overspeed-recovery` -- when the unusual attitude tipped over into actual Vne penetration.
- `proc-spatial-disorientation` -- the cognitive failure that produces unusual attitudes in IMC. Trained recovery is the backup plan to disorientation prevention.
- `proc-instrument-cross-check` -- the active discipline that prevents the unusual attitude from forming.
- `nav-partial-panel` -- if the AI is the failed instrument, recovery happens on the rate instruments.

## Verify

### Novel scenario (narrative)

> You are at 7,000 in IMC, hand-flying. You are programming a fix on the GPS while ATC has been quiet. You glance up after about 8 seconds head-down. The AI shows roughly 40 degrees of right bank, nose 20 degrees below the horizon. Airspeed is 145 KIAS and rising. Altitude is 6,400 and dropping. The DG is rotating right at maybe 8 deg/sec. The turn coordinator agrees with the AI on right bank. The altimeter and ASI agree with AI on pitch.
>
> Walk through the next 5 seconds of action and call out each input.

Scoring rubric:

- Identifies as nose-low unusual attitude. (1)
- Cross-checks AI with TC + ASI + altimeter; confirms agreement; commits the recovery. (2)
- Step 1: reduces power to idle (or near-idle). (2)
- Step 2: levels the wings with coordinated aileron and rudder, slightly leading with rudder against the spiral. (3)
- Step 3: smooth pitch-up to level flight; mentions that pitch-up only after wings level prevents structural overload. (3)
- Returns to assigned altitude (climb back to 7,000); re-establishes the scan. (1)
- Calls ATC: "Center, Cessna 12345, encountered unusual attitude, recovered, request altimeter setting." (1)
- Self-debriefs the precursor: extended head-down GPS programming during quiet ATC; will use a kneeboard timer or a glance-up cadence next time. (2)

15/15 is the bar. Below 11 is a redo.

### Teaching exercise (CFI)

> An instrument-rating candidate, in their first hooded unusual-attitude lesson, recovers from nose-low correctly but, on the nose-high case, levels the wings before adding power. Their nose-high recovery is procedurally backwards. Airspeed bleeds toward stall before they get power in. They self-correct after the stall warning fires.
>
> Diagnose the cognitive trap and write the in-flight cue plus the post-flight teaching point.

Evaluation criteria:

- Diagnosis: candidate has memorised "level wings first" as the universal first move (probably from the nose-low case, which is the more dramatic recovery). The nose-high case differs because the dominant danger is stall, not bank.
- In-flight cue: short, e.g., "Nose-high: power first." Single sentence, scan-compatible.
- Post-flight teaching point: explicitly contrasts the two cases. Power direction is the tell. Order of bank vs. pitch is the consequence. Drill both cases in a single lesson so the contrast is fresh.
- Drill assigned: 10 randomised entries, alternating nose-high and nose-low, until the candidate's first move is determined by the attitude type, not by habit.
- The CFII names the trap: "memorised one sequence and applied it both ways" is a classic teaching failure mode; it is the reason both sequences must be drilled together with the contrast explicit.

The pedagogical move is to teach both recoveries against each other, not in sequence. The contrast is the lesson.
