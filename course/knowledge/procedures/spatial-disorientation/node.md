---
# === Identity ===
id: proc-spatial-disorientation
title: Spatial Disorientation
domain: adm-human-factors
cross_domains:
  - emergency-procedures
  - ifr-procedures

# === Knowledge character ===
# perceptual: spatial disorientation is sensory misperception. Recognising
#   the conflict between vestibular cues and instrument indications is
#   the core skill.
# judgment: when do you trust the panel over your body? Always, in IMC.
#   But "always" is mechanical; the actual judgment is whether to land
#   sooner, declare emergency, ask for help.
# procedural: there is a recovery sequence for the developing graveyard
#   spiral and for the leans (the most common forms): trust the AI,
#   level the wings, pitch up, accept body discomfort, do not chase
#   the body's preferred attitude.
knowledge_types:
  - perceptual
  - judgment
  - procedural
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires:
  - proc-instrument-cross-check
deepens: []
applied_by: []
taught_by: []
related:
  - proc-180-degree-turn
  - proc-unusual-attitude-recovery
  - nav-partial-panel
  - aero-load-factor-and-bank-angle

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
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 17 -- Aeromedical Factors
    note: >-
      Authoritative on the vestibular system, illusions in flight, and the
      common forms of spatial disorientation (the leans, graveyard spiral,
      coriolis illusion, somatogravic, somatogyral).
  - source: AC 60-22
    detail: Aeronautical Decision Making
    note: >-
      Hazardous attitudes and decision-making frameworks; spatial
      disorientation is treated as a workload event that compounds with
      poor ADM.
  - source: AIM
    detail: 8-1-5 -- Illusions in Flight
    note: >-
      Visual and vestibular illusions in IMC and at night; recommended
      countermeasures.
  - source: NTSB
    detail: Loss-of-control-inflight (LOC-I) statistics; VFR-into-IMC accident reviews
    note: >-
      VFR-into-IMC is the canonical scenario; spatial disorientation
      kills within minutes, on average, of the unintended IMC entry.
      JFK Jr. is the famous case; many similar cases per year.
  - source: AOPA Air Safety Institute
    detail: Spatial Disorientation -- safety publications and case reviews
    note: >-
      Operational guidance and accident-derived training points.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - scenario
mastery_criteria: >-
  Learner can: (1) describe the vestibular system's basic operation
  (semicircular canals for rotation, otoliths for linear acceleration)
  and how each can be fooled; (2) name and describe at least three
  illusion types (the leans, graveyard spiral, somatogravic, coriolis,
  inversion); (3) execute the recovery from a developing graveyard
  spiral on instruments; (4) explain why the cognitive override (trust
  AI over body) is harder under stress and what training mitigates it;
  (5) describe at least three preventive measures (instrument scan
  discipline, autopilot use, declining flight in marginal VFR, the 180
  if inadvertent IMC entry occurs).
---

# Spatial Disorientation

## Context

Your inner ear lies. It evolved to keep upright primates from falling over while walking on flat ground. It works in a 1G environment with a visual horizon, where vestibular cues, body cues, and visual cues all agree most of the time. In an airplane in IMC at night, in cloud, in a slow turn, in turbulence, those cues disagree. Your body picks the one that feels most plausible. It is usually the wrong one. Pilots who follow it die in a graveyard spiral, a stalled climb, or a controlled flight into terrain.

The numbers are unforgiving. NTSB studies show that a non-instrument-rated pilot who enters IMC has, on average, less than three minutes before loss of control. Even instrument-rated pilots, distracted at the wrong moment, follow body cues into spirals during enroute IMC. JFK Jr. is the famous case. The annual aviation accident summary contains a dozen similar cases at much less famous N-numbers.

Spatial disorientation is the failure mode that the entire instrument-flying training apparatus exists to defeat. You do not get over disorientation by being a good pilot; you survive it by trusting the panel and overriding your body. The skill is the override.

This node covers the physiology (so you can predict which illusions to expect), the recovery (so you can survive them when they happen), and the prevention (so they happen less often).

## Problem

You are a 100-hour PPL with no instrument training, on a cross-country in late afternoon. The forecast was VFR but reports along the route showed deteriorating ceilings. About 80 NM from your destination, you encounter unexpected cloud below your cruise altitude. You climb to stay clear, and within five minutes you are in cloud. Your airplane has an attitude indicator and a turn coordinator. You have no autopilot.

Within 60 seconds of entering cloud, you feel the airplane is in a slight left bank. You roll right to compensate. You feel the bank deepen. You roll further right. The AI is showing 30 degrees of right bank now. You feel the airplane is straight. The altimeter is dropping.

What has happened, and what do you do in the next 30 seconds?

Write your answer before reading on. Then ask: what did you do wrong before this moment that put you here? And what is the absolute floor for what you must do RIGHT NOW to survive?

## Discover

The illusions have specific physiologies. Knowing them lets you predict and resist them.

### Q1. What is the vestibular system?

The vestibular system has two organs:

- **Semicircular canals** (three pairs, oriented at right angles): detect rotational acceleration. Each canal is filled with fluid; rotation makes the fluid lag, bending hair cells that signal angular velocity to the brain. They detect onset and cessation of rotation -- not steady rotation. After 10-30 seconds of constant turn, the fluid catches up and the brain stops perceiving the turn.
- **Otoliths** (utricle and saccule): detect linear acceleration and the direction of gravity. Tiny calcium-carbonate crystals on a gelatinous mat shift with G; nerve cells signal the displacement.

Both work fine on the ground. Both fail in specific predictable ways in flight.

### Q2. What is "the leans"?

After a slow roll into a turn (less than the canals' detection threshold), the brain does not register the turn entry. After a few seconds in the turn, the canals catch up to "no rotation." A coordinated rollout from the turn now feels like a roll in the opposite direction (the canals detect the rollout, but the brain expected zero rotation). The pilot now feels "leaning" -- their body says they are banked even though the airplane is wings-level.

The leans is benign in itself but can lead to over-correction, secondary disorientation, and in IMC, a graveyard spiral.

### Q3. What is the graveyard spiral?

Most lethal illusion. The classic VFR-into-IMC killer.

- Pilot enters IMC.
- Airplane drifts into a slight bank (spiral instability + lack of horizon).
- Pilot's canals adapt to constant turn rate after 10-30 seconds; brain now perceives "wings level."
- Airplane is descending in a tightening spiral. Airspeed builds.
- Pilot may even feel like they are climbing (somatogravic illusion -- linear acceleration of the spiral feels like nose-up).
- Pilot pulls back on the elevator to correct the "climb" (which is actually the descent).
- Pulling in a banked descent tightens the turn, increases descent rate, accelerates the spiral.
- Continues until impact.

The recovery: trust the AI, level the wings, smooth pitch-up. Override the body's report.

### Q4. What is the somatogravic illusion?

Linear acceleration is interpreted as pitch by the otoliths (because they detect the gravity vector). A forward acceleration (like climbing power application) produces a backward shift of the otolith crystals; the brain interprets this as the airplane pitching up.

Critical case: night takeoff with no visual horizon, full power applied. The forward acceleration produces a strong "pitch up" feeling. Pilot pushes nose down to compensate. Airplane is now in nose-low climb-out. Common cause of fatal accidents on departure from over-water or unlit airports.

Reverse case: deceleration on landing -- the otoliths sense backward, brain interprets as nose-down, pilot pulls back. At low altitude this could stall.

### Q5. What is the coriolis illusion?

Triggered by head movement during a constant turn. The canals are detecting "no rotation" (adapted), and a head turn introduces rotation in a different axis. The brain interprets this as the airplane rolling, pitching, and yawing simultaneously. Severe disorientation.

In IMC, instructors warn: do not bend over to retrieve a chart, do not turn to look at a passenger, do not look up sharply. Move slowly; keep the head still during turns; let the airplane catch up to your sense of orientation rather than vice versa.

### Q6. What is the inversion illusion?

A sudden pitch-down maneuver after a steady climb. The otoliths shift; the brain interprets the negative-G transition as inversion (the airplane being upside down). Pilot pushes harder forward (continuing the "right way up" perception) and dives.

Less common in light singles than in transport-category aircraft, but possible.

### Q7. Why is the recovery hard?

Because your body is screaming at you. The AI says wings-level; your body says 45 degrees of bank. Trusting the AI requires actively rejecting the body's report -- under stress, in IMC, possibly already partially disoriented.

The training move is to make the cognitive override automatic. CFIIs deliberately put students in disorientation-inducing scenarios under the hood to practice it. The first time is alarming. The tenth time is procedural. The hundredth time is muscle memory.

A non-instrument-rated pilot has zero practice at the cognitive override. Their default response to "AI says one thing, body says another" is to follow the body. That is why the survival window in IMC is measured in minutes.

### Q8. What is the prevention?

In descending order of effectiveness:

1. **Don't fly into conditions you cannot handle.** VFR pilot with marginal forecast: ground the flight or pick a different route. Instrument-rated pilot in non-equipped airplane: same.
2. **Use the autopilot.** Even the simplest wing-leveler defeats the graveyard spiral. Glass-cockpit GFC500 / KFC150 / equivalents prevent ~all the lethal illusions.
3. **Maintain the scan.** A working instrument scan keeps the airplane stable; without it, all the illusions become risk.
4. **Avoid head movements in IMC during turns.** Coriolis prevention.
5. **Trust the panel over your body.** Always. Without exception. In every illusion.
6. **180-degree turn out of inadvertent IMC.** The escape route. See `proc-180-degree-turn`.
7. **Declare and ask for help.** ATC will offer vectors out of cloud, vectors to a clear airport, anything you ask. The pride that prevents asking is the same pride that crashes the airplane.

### What Discover should have led you to

- The vestibular system has predictable failure modes; knowing them lets you anticipate.
- The leans, graveyard spiral, somatogravic, coriolis, inversion -- each has a different physiology and a different scenario.
- The graveyard spiral is the canonical killer; recovery is trust AI, level wings, smooth pitch.
- The cognitive override -- trusting the panel over your body -- is the survival skill.
- Prevention is not just better technique; it is choosing the right flight in the first place.

## Reveal

### The summary rule

> Spatial disorientation is sensory misperception. Trust the panel; override the body. The graveyard spiral is the most common lethal form: airplane enters cloud, drifts into bank, canals adapt to the turn, pilot perceives "wings level" while spiraling and descending, follows body cues into impact. Recovery: trust AI, level wings, smooth pitch-up. Prevention: do not fly into conditions you cannot handle; use autopilot; maintain working scan; turn 180 if inadvertent IMC; declare and accept ATC help. The skill is the cognitive override, drilled to muscle memory.

### Common illusion types

| Illusion         | Trigger                                          | Body's report                  | Real situation              |
| ---------------- | ------------------------------------------------ | ------------------------------ | --------------------------- |
| The leans        | Slow roll into turn, then rollout                | Banked the wrong way           | Wings actually level        |
| Graveyard spiral | Constant turn in IMC, canals adapt               | Wings level                    | In a tightening descending spiral |
| Somatogravic     | Linear acceleration / deceleration               | Pitched up (accel) or down (decel) | Pitch unchanged       |
| Coriolis         | Head turn during constant rotation               | Roll/pitch/yaw simultaneously  | Just a head turn            |
| Inversion        | Sudden negative-G after climb                    | Inverted                       | Just decelerating climb     |
| Elevator         | Updraft / downdraft                              | Pitch change                   | Vertical airmass movement   |
| False horizon    | Sloping clouds, terrain, lights                  | Bank or pitch reference        | No real horizon             |
| Autokinesis      | Steady light against dark background (night)     | Light is moving                | Light is fixed              |

### The graveyard spiral recovery

```text
1. Identify on instruments: bank > 30, descending, airspeed building.
2. Trust AI (cross-check briefly with TC, altimeter, ASI).
3. Level the wings with coordinated aileron + rudder.
4. Smooth pitch-up to level flight (not a snatch).
5. Apply power as needed.
6. Re-establish the scan.
7. Notify ATC if applicable.
```

The pilot's body will continue to feel banked-the-other-way for 30+ seconds after recovery. Ignore. The body lags the airplane; the panel is current.

### The somatogravic countermeasure

On takeoff into IMC or at night without horizon: pre-brief that the climb feeling will exaggerate; trust the AI; do NOT push the nose down based on body-felt pitch. Eyes inside until you have a stable scan.

### Why training works

CFII training under the hood (Foggles or equivalent) puts the candidate in disorientation-inducing scenarios in safe conditions. The candidate practices the cognitive override -- "AI says level, body says banked, AI wins" -- repeatedly. Over hundreds of repetitions, the override becomes automatic.

The non-instrument pilot has no such training. Their first encounter with strong vestibular conflict is the first time they are in cloud, and they do not have the override skill. The accident reports are predominantly non-instrument pilots who entered IMC.

### What is actually authoritative

In descending order:

1. **PHAK Chapter 17** -- the physiology and the illusions.
2. **AIM 8-1-5** -- operational guidance.
3. **AC 60-22** -- decision-making framing.
4. **AOPA ASI safety publications** -- accident-derived insights.

### location_skill

- PHAK Chapter 17 -- read once, all the way through.
- AIM 8-1-5 -- operational countermeasures.
- AOPA ASI's spatial disorientation course (online; free) -- specific accident reviews.
- Your CFII's debriefs -- the candidate's lived experience under the hood, named.

## Practice

### Cards (spaced memory items)

- `card:sd-leans-define" -- "What is 'the leans'?" -> "After slow turn entry then coordinated rollout, body feels banked the other way; wings actually level."
- `card:sd-graveyard-spiral" -- "What is the graveyard spiral?" -> "Bank in IMC; canals adapt; pilot perceives wings level; airplane descends in tightening spiral; pilot pulls and tightens further; impact."
- `card:sd-somatogravic" -- "What is the somatogravic illusion?" -> "Linear acceleration interpreted as pitch by otoliths; forward accel feels like pitch-up (often on takeoff at night)."
- `card:sd-coriolis-trigger" -- "Coriolis illusion trigger?" -> "Head movement during a constant turn; produces severe roll/pitch/yaw misperception."
- `card:sd-otoliths-vs-canals" -- "Difference between otoliths and semicircular canals?" -> "Otoliths sense linear acceleration / gravity direction; canals sense rotational acceleration."
- `card:sd-cognitive-override" -- "Survival skill in IMC disorientation?" -> "Trust the AI, override body cues, recover by instruments."
- `card:sd-180-out-of-IMC" -- "Standard escape from inadvertent IMC?" -> "180-degree turn back to known VMC, on instruments, declared with ATC."
- `card:sd-vfr-into-imc-window" -- "Average survival window for non-instrument pilot in IMC?" -> "Less than 3 minutes (NTSB studies)."
- `card:sd-prevention-hierarchy" -- "Prevention priorities?" -> "1) Do not fly conditions you cannot handle; 2) Use autopilot; 3) Maintain scan; 4) Avoid head movements in IMC turns; 5) 180 if needed; 6) Declare emergency."
- `card:sd-recovery-from-spiral" -- "Recovery from graveyard spiral?" -> "Trust AI; level wings (coord); smooth pitch up; do not snatch elevator."

### Reps (scenario IDs)

- `scenario:sd-vfr-into-imc-graveyard" -- the opening scenario; PPL pilot enters IMC, body cues lead to spiral.
- `scenario:sd-night-takeoff-somatogravic" -- night takeoff over water; pilot feels nose-up climb, pushes nose down inadvertently.
- `scenario:sd-coriolis-chart-retrieval" -- in IMC, pilot bends to retrieve dropped chart; severe disorientation.
- `scenario:sd-leans-rollout" -- IFR pilot rolls out of turn; body feels still-banked; pilot resists urge to re-bank.
- `scenario:sd-AP-out-of-disorientation" -- pilot turns on autopilot in IMC to recover from leans/disorientation.

### Drills (time-pressured)

- `drill:sd-illusion-name" -- learner is given a description; identifies which illusion.
- `drill:sd-recovery-call" -- instructor cues a developing graveyard spiral; learner verbalises the recovery sequence in 5 seconds.
- `drill:sd-cognitive-override" -- in simulator, learner practices flying through misleading vestibular cues (deliberately disorienting maneuvers); rated on whether they trusted instruments.

### Back-of-envelope calculations

**Calculation 1: spiral instability time.**

Typical light single, untrimmed, in IMC, no autopilot:

- 5 degrees initial bank.
- Doubles to 10 degrees in 30-60 seconds.
- Doubles again to 20 degrees in another 30-60 seconds.
- Continues until pilot intervention or terrain.

From 5-degree bank to 60-degree spiral in 2-3 minutes typical. Airspeed builds from cruise to Vne in this window.

**Calculation 2: VFR-into-IMC accident statistics.**

Per NTSB:

- 9 in 10 VFR-into-IMC accidents result in fatal outcome.
- Median time from IMC entry to impact: ~2-3 minutes for non-instrument pilots.
- Majority involve loss of control rather than CFIT (controlled flight into terrain).

The fatal accident rate per VFR-into-IMC encounter is ~90%. The pilot has not "had a bad day"; they have had a fatal day.

**Calculation 3: cognitive override training requirement.**

CFII estimate (informal): ~20-30 hours of hood time, with deliberate disorientation drills, for the override to become automatic. Less than that, and the override is "I remember to do this" rather than reflex.

Initial instrument training builds the foundation. Currency keeps it sharp. Out-of-currency instrument-rated pilots in IMC are at higher risk than current ones, even though both have the rating.

## Connect

### What changes if...

- **...you are non-instrument-rated and enter IMC?** Survival is not assured. Best move: 180 turn back to VMC, immediately, on partial-panel discipline (TC + ASI + altimeter, ignore the AI if untrained on it). If terrain or weather precludes, declare emergency and ask ATC to vector you out.
- **...you are instrument-rated and enter IMC?** Continue with the scan. Engage autopilot if available. The illusion risk is lower because the override is trained.
- **...you have an autopilot?** Use it. Autopilot defeats the graveyard spiral and the leans entirely. The panic of disorientation is hugely reduced.
- **...you are at night without horizon (over water, over unpopulated terrain)?** Same as IMC for the body; same prevention; somatogravic on takeoff is the specific risk.
- **...you are tired or dehydrated?** Vestibular tolerances drop. Caffeine helps marginally. Pre-flight rest is the real fix.
- **...you have an inner-ear infection or a cold?** Vestibular system is malfunctioning baseline. Flying with active ENT issues is a known disorientation risk. Most professional pilots ground themselves; part-91 should too.
- **...you have done the 180 and you are still in IMC?** Continue the 180; you may have entered IMC at a turn; keep on the gauges; declare. A 270 might exit if a 180 did not.

### Links

- `proc-instrument-cross-check` -- the active discipline that prevents disorientation from forming.
- `proc-180-degree-turn` -- the standard escape from inadvertent IMC.
- `proc-unusual-attitude-recovery` -- if disorientation has produced an unusual attitude, the recovery merges.
- `nav-partial-panel` -- if AI is failed, recovery from disorientation is harder; rate-instrument flying.
- `aero-load-factor-and-bank-angle` -- the spiral builds load factor as it tightens; pulls become unsafe.

## Verify

### Novel scenario (narrative)

> You are a 600-hour instrument-rated pilot, current. You have been in cruise for 90 minutes in IMC, hand-flying because the autopilot is out for service. You become aware that you are tilting your head to the right, as if compensating for something. You glance at the AI: wings level, slight nose-up. The TC agrees. The DG is on the assigned heading. The altimeter is steady.
>
> What is happening, and what do you do?

Scoring rubric:

- Identifies the leans: head-tilt feeling without panel evidence of bank. (2)
- Trusts the panel; resists the urge to re-bank to "correct." (2)
- Verbalises the override: "Body says I'm banked; panel says level; panel wins." (2)
- Continues the scan; does not get drawn into chasing body cues. (2)
- Considers fatigue and time-in-IMC; decides whether to request a frequency-only break or a vector to VMC. (2)
- Makes a small head movement deliberately and waits for the canals to recalibrate (eyes-on-AI throughout). (1)
- If symptoms persist or worsen, considers requesting an early descent or asking ATC for an alternate. (1)

12/12 is the bar. Below 9 is a redo.

### Teaching exercise (CFI)

> A primary student, in their first 5 hours of hooded instrument introduction, becomes physically nauseous after about 12 minutes under the hood. They tell you they think they "just don't have the right kind of inner ear" and want to skip the instrument introduction.
>
> Write your response as the CFI. Address: the physiology (this is normal, not a defect), the training pathway (it gets better with exposure), and the safety case (the skill being trained is what saves their life if they enter IMC by accident).

Evaluation criteria:

- Does not minimise; the student's discomfort is real.
- Names the physiology: the vestibular system is in conflict with the visual reference (instruments) and the body has not yet adapted; nausea is normal under-hood symptom for early students.
- Names the training pathway: most students adapt within 5-10 hooded hours; CFI techniques (slower hood time progression, ginger root, fresh air, scan technique focus) help.
- Reframes the safety case: the cognitive override being trained is not a tool for IFR work alone; it is the survival skill if VFR-into-IMC happens. Skipping it is choosing not to have the survival skill.
- Offers concrete next-lesson adjustments: shorter hood time, more breaks, focus on partial-panel work which is less disorienting initially.
- Does not discharge the student; assigns a self-study reading on AC 60-4A and PHAK Ch 17 before the next lesson.

The pedagogical move is to convert "I quit" into "I need a different approach" by separating the physiology (normal, addressable) from the willingness (which is the actual gating issue). The student who is willing to retry with a different cadence will adapt; the student who has been talked out of retrying will not.
