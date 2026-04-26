---
# === Identity ===
id: proc-stall-recovery
title: Stall Recovery
domain: procedures
cross_domains:
  - aerodynamics
  - emergency-procedures

# === Knowledge character ===
# procedural: there is a default sequence (pitch down to reduce AOA, level the
#   wings, add power, recover to level flight) shared across most light singles.
# perceptual: recognising the imminent stall (buffet, sink, slowing, mushy
#   controls, stall horn) before it becomes a full break is the skill that keeps
#   you alive. The procedural recovery is the backup plan.
# judgment: when do you accept altitude loss, when do you trade altitude for
#   AOA reduction, when do you stop adding power because you are about to roll?
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
  - aero-angle-of-attack-and-stall
  - aero-four-forces
deepens: []
applied_by: []
taught_by: []
related:
  - proc-unusual-attitude-recovery
  - aero-load-factor-and-bank-angle
  - aero-coordination-rudder
  - aero-slow-flight

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
  - source: AC 61-67C
    detail: Stall and Spin Awareness Training
    note: >-
      The FAA's canonical guidance on stall awareness, recovery technique,
      and the change from the older "minimum altitude loss" wording to a
      "reduce angle of attack first" framing.
  - source: FAA Airplane Flying Handbook (FAA-H-8083-3B)
    detail: Chapter on Slow Flight, Stalls, and Spins
    note: >-
      Practical recovery procedure in light singles. Reduce AOA by relaxing
      back pressure or pushing forward; level the wings with coordinated
      aileron and rudder; add power as appropriate; return to level flight
      while not exceeding limits.
  - source: POH / AFM Section 4
    detail: Normal procedures -- stall recovery / approach to stall recovery
    note: >-
      Aircraft-specific approach speeds, stall warning system description,
      and recovery wording. Some POHs explicitly call out which control
      moves first; obey the POH for your airplane.
  - source: ACS / PTS standards
    detail: Power-off stall, power-on stall, accelerated stall task elements
    note: >-
      Examiners look for prompt and correct recovery; AOA reduction comes
      first, secondary actions follow. The standard tolerates altitude loss
      so the candidate does not pull during recovery.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) recite the stall-recovery sequence (reduce AOA first,
  level the wings, add power as appropriate, return to level flight); (2)
  recognise three pre-stall cues (buffet, mushy controls, stall warning,
  high sink rate) and act on the earliest one; (3) demonstrate a power-off
  stall recovery and a power-on stall recovery from the imminent and full-
  break stages without exceeding bank or pitch limits; (4) explain why
  "recovering with minimum altitude loss" was deprecated in favour of
  "reduce AOA first"; (5) at CFI level, identify common student errors
  (insufficient AOA reduction, premature power application leading to
  P-factor roll, over-rotation in recovery).
---

# Stall Recovery

## Context

A stall is the simplest emergency in aviation and the one student pilots are most likely to mishandle. The simplicity is deceptive. Stall is exceeding critical angle of attack; recovery is reducing angle of attack. That is two sentences, and they fit on a card. The thing they leave out is the half-second of disorientation in which a pilot looking at the altimeter, with the stall horn screaming and the airplane buffeting and the nose dropping unexpectedly, has to override two strong instincts at the same time: the instinct to pull up on the controls (because the nose is low) and the instinct to add power (because the airplane is sinking).

Pilots who pull during stall recovery do not recover. They deepen the stall. If they were turning when it happened, they spin. The NTSB's loss-of-control-inflight (LOC-I) accident category is dominated by exactly this failure: a pilot in a high-AOA regime (slow, climbing, turning, distracted) who responded to the symptoms (nose drop, sink, buffet) with the wrong control input.

The FAA acknowledged this in the 2010s by formally changing the recovery guidance from "minimum altitude loss" to "reduce AOA first." That sounds like a small change. It is the difference between a recovery culture that says "don't lose 50 feet" and one that says "trade as much altitude as you have to in order to fly again." The first culture trains pilots to pull during recovery. The second culture trains pilots to push.

This node is about the recovery itself, the cues that should trigger it before the airplane stalls (every recovery from an imminent stall is cheaper than recovery from a full break), and the muscle memory that has to win the next time the airplane goes mushy and the stall horn fires.

## Problem

You are at 3,500 AGL practising power-on stalls in a Cessna 172S. You set takeoff configuration (10 degrees of flap), pitch up, and add full power. As the airspeed bleeds toward stall, the airplane buffets, the stall horn sounds, and the left wing drops about 10 degrees. The nose continues to fall through level. The altimeter shows 3,400.

What are your control inputs in the next 2 seconds, and in what order? Be specific about each control surface.

Write your answer before reading on. Then ask yourself: what would change if you were 600 AGL instead of 3,500 AGL? What would change if instead of practising you were on a base-to-final turn?

## Discover

The recovery is dictated by the physics. Work through these in order.

### Q1. What is actually happening at the stall?

Lift coefficient (CL) is a function of angle of attack (AOA). On a typical airfoil, CL rises with AOA up to a maximum at roughly 16-20 degrees, called critical AOA, and then falls off rapidly. At any AOA below critical, the airplane can fly. At critical AOA, lift is maximum but the airfoil is on the edge. Beyond critical AOA, lift collapses, drag spikes, and the airplane is in a stall.

The pilot does not control AOA directly. They control elevator. Elevator changes pitch attitude relative to the relative wind. The relative wind changes with airspeed, with bank, with load factor, and with sink rate. AOA is the angle between the chord line and the relative wind, not between the chord line and the horizon.

So the pilot can have a normal-looking pitch attitude and still be stalled (high sink rate, low airspeed, high AOA). The stall is not "the nose was too high." The stall is "AOA was too high." Same word, very different meaning.

### Q2. Why is "reduce AOA" the first action and not "level the wings"?

If the wings are stalled, ailerons are partially or fully ineffective. The aileron deflection that should roll the airplane right may instead increase AOA on the down-going aileron's wing tip and stall it further -- or it may simply not produce enough roll because the surrounding wing is in separated flow. Levelling the wings before reducing AOA is asking unstalled aerodynamics from a stalled wing.

Reduce AOA first. The wing un-stalls. Now the ailerons work normally, and you can roll wings level. Now you can add power without yawing into a wing-low recovery. Order matters because each step depends on the previous one.

### Q3. Why do most stall accidents happen in turns and climbs, not in straight-and-level practice?

Three reasons stack:

1. **Load factor.** A 30-degree-banked level turn is 1.15 G; 45 degrees is 1.41 G; 60 is 2.0 G. Every G multiplies stall speed by sqrt(G). A turning airplane stalls at a higher airspeed than a wings-level airplane. Pilots who fly the pattern speed in a steep base-turn cross critical AOA at "approach speed."
2. **Pulling.** Pilots in turns pull. They pull to hold altitude in a banked turn. They pull to tighten a turn that is going wide. They pull on base-to-final to "get the runway." Pulling raises AOA. At low altitude, low airspeed, banked, pulling -- you can be at critical AOA in 2 seconds.
3. **Distraction.** The pilot in straight-and-level practice is watching for the stall. The pilot turning final is watching for traffic, looking at the runway, double-clicking PTT, raising flaps, leaning the mixture, talking on the radio, and not looking at the airspeed indicator. The stall comes from blind side.

That is why "reduce AOA" beats "minimum altitude loss" in the FAA's culture change. A pilot who has internalised "reduce AOA first" does not pull when the airplane buffets in a turn. A pilot trained to "minimise altitude loss" does pull, because the nose dropped and they want it back.

### Q4. What is the correct recovery sequence?

Aligned with AC 61-67C and AFH:

1. **Reduce AOA.** Pitch forward to break the stall. The amount depends on the situation; in a developed stall, that may be a positive forward movement on the yoke / stick. In an approach-to-stall, a relax of back pressure may be enough. The intention is to unload the wing.
2. **Level the wings.** Coordinated aileron and rudder. If a wing is dropping, recover bank to level using ailerons (the wing has un-stalled in step 1, so ailerons work) and apply rudder as needed to keep the ball centered.
3. **Add power.** Smoothly. Excessive sudden power in a high-AOA, low-airspeed regime causes left-yawing P-factor and roll, especially in single-engine propeller airplanes turning a clockwise propeller (from the pilot's view). Add what you need, not what's available.
4. **Return to level flight.** Pitch up gently to stop the descent. Avoid the secondary stall -- pulling too hard on recovery so that you re-enter critical AOA at lower airspeed. Wait for airspeed to recover before pulling.

Some POHs add specific items (raise flaps in stages once positive rate of climb is established, lower nose pitch attitude to a specific value, retract gear after going-around-from-stall). The skeleton above is the sequence; airplane-specific steps overlay it.

### Q5. What are the cues you act on before the break?

Pre-stall cues, in roughly the order they appear:

| Cue                          | What it feels like                                                       |
| ---------------------------- | ------------------------------------------------------------------------ |
| Mushy controls               | Yoke pressure required is increasing for the same response               |
| Reduced control authority    | Aileron and rudder feel sluggish; the airplane is slow to respond        |
| Buffet                       | Tail buffet first in many singles; then airframe and yoke buffeting      |
| Stall warning horn / light   | Activated by the stall vane on the leading edge; precedes break          |
| Sink rate increasing         | VSI moving down even with attitude high                                  |
| Airspeed below 1.3 Vso       | The number that approach speed is built around                           |

A pilot who recovers at the first cue (mushy controls or buffet) loses 0-10 feet. A pilot who recovers at the stall warning horn loses 30-100 feet. A pilot who recovers at the break loses 200+ feet. A pilot who pulls at the break is in a developing spin.

### What Discover should have led you to

- A stall is exceeding critical AOA. Recovery is reducing AOA. Everything else is secondary.
- Order of recovery is AOA, wings, power, level flight. Every step depends on the previous.
- Most stalls happen in turns or climbs because load factor and pulling combine with low airspeed and distraction.
- Pre-stall cues let you recover with negligible altitude loss. Recovery from full break costs hundreds of feet.
- The FAA shifted from "minimum altitude loss" to "reduce AOA first" because the old wording trained the wrong instinct.

## Reveal

### The summary rule

> Recovery from an approach-to-stall or stall: reduce angle of attack first, then level the wings, then add power as appropriate, then return to level flight without inducing a secondary stall. Trade altitude for airspeed and unstalled flow before doing anything else. Recognise pre-stall cues (mushy controls, buffet, stall warning) and act on the earliest one available.

### The recovery sequence in detail

```text
1. AOA reduction
   - Relax back pressure or push forward on the yoke / stick
   - The yoke movement amount depends on stage: imminent (small) vs. full (positive forward)
   - Wing un-stalls; ailerons regain authority

2. Wings level
   - Coordinated aileron + rudder
   - Don't try to roll while still stalled
   - In a wing-drop stall, expect to need rudder against the drop

3. Power
   - Smooth advance to full power (or as required by procedure)
   - Watch for P-factor / torque yaw on a clockwise propeller (right rudder)
   - Don't slam the throttle; sudden full power on a high-AOA wing risks roll

4. Pitch up to level flight
   - Smooth, progressive
   - Stop the descent when airspeed permits
   - Do not pull through critical AOA again (secondary stall)
```

### Imminent vs. full-break

| Stage                  | Cue triggering recovery                       | Typical altitude loss (light single)            |
| ---------------------- | --------------------------------------------- | ----------------------------------------------- |
| Mushy controls         | Yoke effort increasing, airframe slow         | 0-20 ft                                         |
| Stall warning horn     | Audible / visual warning                      | 30-80 ft                                        |
| Buffet                 | Tail or airframe shake                        | 50-150 ft                                       |
| Full break, wings level| Nose drops; airframe shudders                 | 100-300 ft                                      |
| Full break with wing drop | Rapid roll toward dropped wing             | 200-500+ ft, spin risk if uncoordinated         |

Numbers vary by aircraft, weight, altitude, and pilot. The trend is the point: every step further into the stall costs more altitude and more workload to recover.

### Why the wording changed

Before AC 61-67C, the FAA training emphasis was "recover with minimum altitude loss." Pilots trained on that wording learned to flatten the recovery -- pitch attitude held low only briefly, power added immediately, and a smooth pull back to level flight. In the simulator, with the controls primed, this works. In the real airplane, with surprise and low altitude and a banked attitude, this trains the pilot to pull during recovery. Pulling during recovery is exactly the input that causes the secondary stall, the cross-controlled spin, and the LOC-I accident.

The change is not about altitude. It is about which input the pilot's hands make first. "AOA first" trains the push. "Minimum altitude loss" trained the pull. The change saves lives by changing what the muscle memory does in the half-second after surprise.

### What is actually authoritative

In descending order:

1. **Your specific airplane's POH Section 4** for the exact recovery procedure your airplane is certified to.
2. **AC 61-67C** for the FAA's current pedagogical framework.
3. **AFH chapter on stalls** for the practical procedure and the demonstration profile your CFI uses.
4. **ACS / PTS task elements** for what the examiner will grade you on.

### location_skill

- POH Section 4 -- Normal Procedures -- "Approach to Landing" or "Stalls" subsection. Recovery wording is there.
- AC 61-67C -- read it once, all the way through. It is short and authoritative.
- AFH -- the chapter covering stalls. Read the demonstration profiles for your training stalls so you know what your CFI is asking for.
- POH Section 5 -- Performance, for stall speed table at various weight, configuration, and bank.

## Practice

### Cards (spaced memory items)

- `card:sr-first-action` -- "First control input on stall recognition?" -> "Reduce AOA -- relax back pressure or push forward."
- `card:sr-sequence` -- "Stall recovery sequence?" -> "AOA, wings, power, level flight."
- `card:sr-why-aoa-first` -- "Why reduce AOA before levelling wings?" -> "Stalled wings have reduced aileron authority; un-stall first, then roll."
- `card:sr-pre-stall-cues` -- "Three pre-stall cues?" -> "Mushy controls, buffet, stall warning horn, high sink rate."
- `card:sr-secondary-stall` -- "What causes a secondary stall during recovery?" -> "Pulling too hard on recovery, re-entering critical AOA before airspeed builds."
- `card:sr-power-application` -- "Why smooth power application matters in stall recovery?" -> "Sudden full power on a high-AOA wing causes P-factor / torque roll; rudder demand spikes."
- `card:sr-altitude-loss-imminent` -- "Typical altitude loss recovering from an imminent stall in a light single?" -> "0-50 feet."
- `card:sr-altitude-loss-full` -- "Typical altitude loss recovering from a full-break stall in a light single?" -> "100-300+ feet."
- `card:sr-old-vs-new-wording` -- "Why did the FAA shift from 'minimum altitude loss' to 'reduce AOA first'?" -> "The old wording trained pilots to pull during recovery; pulling causes secondary stalls and cross-controlled spins."
- `card:sr-base-final-stall-mode` -- "Dominant low-altitude stall failure mode?" -> "Skidded, accelerated stall in the base-to-final turn."

### Reps (scenario IDs)

- `scenario:sr-power-on-departure-stall` -- 800 AGL on initial climb, full power, slowing toward stall as you continue to pitch up. Recover.
- `scenario:sr-base-to-final-skidding-stall` -- in the base turn at 700 AGL, you are overshooting the centerline and tightening with rudder while pulling. Stall horn fires.
- `scenario:sr-go-around-low-altitude-stall` -- you initiate a go-around at 50 AGL with full flaps and add full power. Airplane pitches up aggressively; stall warning fires.
- `scenario:sr-secondary-stall-recovery` -- recovering from an initial stall, you pulled too aggressively and re-entered critical AOA. What now?
- `scenario:sr-cross-controlled-stall-pattern` -- on a long base, you slip to lose altitude, then forget the rudder is in. Stall.
- `scenario:sr-accelerated-stall-aerobatic` -- in a 60-degree banked steep turn at maneuvering speed minus 10 kt, you pull to maintain altitude. Buffet.

### Drills (time-pressured)

- `drill:sr-30-stall-cues-3-second` -- 30 randomised cue scenes (mushy / buffet / horn / break / break-with-wing-drop). Learner has 3 seconds to call out the appropriate first action.
- `drill:sr-recovery-sequence-recall` -- learner is given a stall stage and must call the sequence aloud in order, naming the control input for each step.
- `drill:sr-secondary-stall-detection` -- in simulator, learner recovers from a stall. Instructor cues secondary stall onset; learner identifies and corrects.

### Back-of-envelope calculations

**Calculation 1: stall speed in a banked turn.**

For a coordinated level turn:

```text
Vs_turn = Vs_level * sqrt(load_factor)
load_factor = 1 / cos(bank)
```

For a C172 with Vs (clean, MTOW) = 48 KIAS:

| Bank (deg) | Load factor | Vs multiplier | Vs_turn (KIAS) |
| ---------- | ----------- | ------------- | -------------- |
| 0          | 1.00        | 1.00          | 48             |
| 30         | 1.15        | 1.07          | 51             |
| 45         | 1.41        | 1.19          | 57             |
| 60         | 2.00        | 1.41          | 68             |

If you fly the pattern at 70 KIAS in a 60-degree bank, you are 2 KIAS above stall.

**Calculation 2: altitude loss from an unrecognised stall in a 45-degree bank.**

If pre-stall cues are missed, full break in a 45-degree bank typically dumps the airplane into 30-60 degrees of bank further. Recovery requires:

- Roll level (1-2 sec; the airplane has un-stalled in step 1).
- Add power, return to level flight.

Total altitude loss in this regime is commonly 200-500 ft. At 700 AGL on a base turn, that is enough to put the airplane into the trees.

## Connect

### What changes if...

- **...you stall in a turn?** Reduce AOA first, just like wings level. Once unstalled, level the wings with coordinated aileron and rudder. Add power. The temptation to lead with rolling out is exactly wrong; the wings are still stalled until AOA reduces.
- **...the airplane stalls with one wing dropping?** Same first move. The dropping wing is more deeply stalled. Levelling first will fail; reducing AOA first un-stalls both wings, and then roll authority returns.
- **...you are in IMC?** Same recovery, but the pilot is also fighting spatial disorientation and instrument-only roll references. The push is harder mentally because you cannot see the horizon. Trust the attitude indicator. See `proc-spatial-disorientation` and `proc-unusual-attitude-recovery`.
- **...you are at altitude (10,000+)?** Same procedure, but the airplane has more recovery margin and the altitude loss is a non-event. Practice here is cheap.
- **...you are 200 AGL on departure?** Same procedure, but the altitude budget is small. This is why pre-stall cue recognition matters more than full-break recovery technique. Below 500 AGL, you are recovering from imminent or you are not recovering.
- **...you are flying a high-performance single (Cirrus, Bonanza)?** Stall behavior is benign in some, sharp in others. Recovery sequence is identical; the time available between cue and break may be shorter. POH wording matters.
- **...you are flying a light sport / experimental?** POH overrides everything. Some experimentals have unconventional stall behavior; some have AOA-limiting devices. Read the AFM.

### Links

- `aero-angle-of-attack-and-stall` -- the conceptual basis. Stall is an AOA event; recovery is an AOA action.
- `aero-load-factor-and-bank-angle` -- why stall speed climbs with bank. The base-turn killer.
- `aero-coordination-rudder` -- why uncoordinated stall (skidded turn) breaks faster and rolls into spin geometry.
- `proc-unusual-attitude-recovery` -- if recovery from stall lets the airplane develop into a full nose-low or wing-down attitude, you have an unusual attitude. The recovery merges with that procedure.
- `proc-engine-failure-after-takeoff` -- the EFATO turnback's signature kill is a skidded stall in the turn back. Stall recovery technique is the muscle memory you wish you had practised.
- `aero-slow-flight` -- slow flight is sustained operation near stall. The control feel and rudder discipline learned in slow flight train the AOA awareness needed for recovery.

## Verify

### Novel scenario (narrative)

> You are in a Cessna 172S on a downwind-to-base turn at 800 AGL. You see another aircraft turning base ahead of you and decide to extend downwind. As you fly past your normal base point, your attention is on the radio and traffic; you do not notice that you have not reduced power and the airplane has slowed to 70 KIAS in level flight. You initiate a 30-degree bank to start your base. The stall horn fires. The airplane buffets and the right wing drops about 10 degrees as the nose falls.
>
> Walk through your control inputs and call out the cause and the recovery aloud, including expected altitude loss.

Scoring rubric:

- Identifies the cause: extended downwind without power reduction, pulling through bank, AOA exceeded with stall horn ignored. (2)
- Reduces AOA first: relaxes back pressure or pitches forward; verbalises that the first input is forward, not roll. (3)
- Levels wings with coordinated aileron and rudder once unstalled; identifies that rudder against the drop is appropriate. (2)
- Adds power smoothly; identifies that sudden full power risks P-factor roll. (2)
- Returns to level flight without inducing a secondary stall (does not pull immediately). (2)
- Identifies likely altitude loss: 100-200 feet from this stage; recovers above 600 AGL. (1)
- Self-debriefs the trigger: distraction during pattern extension. (2)

14/14 is the bar. Below 10 is a redo.

### Teaching exercise (CFI)

> A pre-solo student in their fourth power-off stall lesson consistently recovers by adding power before reducing AOA. The result is a secondary stall about half the time. They are following a sequence they remember from ground school, in which "add power" was emphasised heavily. They are not listening to your in-flight cue ("reduce angle of attack").
>
> Write the first three sentences of your in-flight reset (after taxi-back), and the chair-flying exercise you assign before the next attempt.

Evaluation criteria:

- Does not mock the existing sequence; the student is doing what they were taught.
- Names the physics: "if the wing is stalled, power against a stalled wing produces yaw and roll, not climb. We have to un-stall first."
- Replaces the muscle memory with a single first move: "yoke forward, then everything else." Make the first action specific so it overrides the older, wrong, first action.
- Assigns chair-flying with the call-out: student says "stall, AOA," moves the imaginary yoke forward, says "wings, power, level," in that order, before the next flight. The verbal cue runs interference against the older mental model.
- Plans the next flight to deliberately set up imminent stalls (not full break) so the student can rehearse the new first move at low cost.

The pedagogical move is to recognise that the wrong sequence is more durable than no sequence -- the only fix is to deliberately overwrite it, not to add to it.
