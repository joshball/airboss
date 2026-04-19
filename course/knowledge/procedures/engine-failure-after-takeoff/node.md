---
# === Identity ===
id: proc-engine-failure-after-takeoff
title: Engine Failure After Takeoff
domain: procedures
cross_domains:
  - aerodynamics
  - adm
  - emergency

# === Knowledge character ===
# procedural: there is a default action sequence (pitch for best glide, pick a
#   landing area within 30 degrees either side, fly the airplane).
# judgment: the core decision (land ahead vs. turn back vs. maneuver off-axis)
#   is a time-pressured risk trade made with incomplete information. No single
#   rule applies; the pilot integrates altitude, winds, terrain, aircraft, and
#   self-knowledge under 3-5 seconds of startle.
# perceptual: recognizing the failure fast (sound, RPM, yaw, acceleration cue),
#   and reading the actual glide path against the actual outside picture,
#   is a trained perception skill distinct from procedural recall.
knowledge_types:
  - procedural
  - judgment
  - perceptual
technical_depth: working
stability: stable

# === Cert relevance (multi-dimensional) ===
relevance:
  - cert: PPL
    bloom: apply
    priority: core
  - cert: PPL
    bloom: evaluate
    priority: core
  - cert: IR
    bloom: evaluate
    priority: core
  - cert: CPL
    bloom: evaluate
    priority: core
  - cert: CFI
    bloom: create
    priority: core
  - cert: CFI
    bloom: evaluate
    priority: core

# === Graph edges ===
requires:
  - aero-angle-of-attack-and-stall
  - aero-four-forces
  - perf-takeoff-landing-distance
deepens: []
applied_by:
  - scenario-efato-short-runway
  - scenario-efato-partial-power-loss
  - scenario-efato-high-density-altitude
taught_by:
  - teach-common-student-errors-stalls
  - teach-evaluating-student-judgment
related:
  - proc-emergency-authority
  - proc-adm-hazardous-attitudes
  - wx-density-altitude
  - perf-crosswind-component

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
  - scenario
estimated_time_minutes: 75
review_time_minutes: 10

# === References ===
references:
  - source: POH / AFM
    detail: Section 3 (Emergency Procedures) -- Engine Failure During Takeoff Run / Engine Failure Immediately After Takeoff / Engine Failure During Climb
    note: >-
      Authoritative for the specific airplane. POH numbers (best glide, flap
      setting, emergency checklist order) vary by aircraft and must be used
      instead of generic values. This node frames the decision; the POH
      supplies the numbers.
  - source: FAA Airplane Flying Handbook (FAA-H-8083-3B)
    detail: Chapter covering emergency procedures -- engine failure after takeoff discussion
    note: >-
      FAA's canonical guidance. Land essentially straight ahead within
      roughly 30 degrees of runway heading is the default. Turning back is
      discouraged unless altitude and conditions clearly support it.
      TODO(verify) exact chapter and edition -- AFH reorganizes across editions.
  - source: AOPA Air Safety Institute
    detail: Safety Advisor / Accident Case Study -- "The Impossible Turn" / engine failure on takeoff
    note: >-
      ASI's accident review work is the commonly cited lay source for why
      turnbacks kill. Loss of control in a steep, low-altitude turn at
      reduced airspeed is the dominant failure mode. Specific altitude
      guidance in ASI materials tends to say practice at altitude first and
      know your airplane's number. TODO(verify) exact title and URL for the
      current ASI publication on this topic.
  - source: NTSB
    detail: Safety Alerts and annual Nall Report data on loss-of-control-inflight (LOC-I) during initial climb
    note: >-
      LOC-I is the dominant fatal accident category in GA; stall/spin from a
      low-altitude turnback is a recurring subtype. TODO(verify) cite a
      specific NTSB safety alert number once confirmed.
  - source: Rogers, D. F.
    detail: "The Possible 'Impossible' Turn" (AIAA / Journal of Aircraft paper)
    note: >-
      Rogers modeled the turnback analytically and showed that with an
      optimum bank (around 45 degrees) and a teardrop rather than a 180,
      the maneuver can be flown with less altitude loss than pilots
      intuitively assume -- but the margin is small and degrades fast with
      delay. Useful as the physics-based counterpoint to blanket "never turn
      back" advice. TODO(verify) exact citation.

# === Assessment ===
assessable: true
assessment_methods:
  - scenario
  - demonstration
mastery_criteria: >-
  Learner can, without hesitation: (1) state the default response (pitch for
  best glide, land within 30 degrees of runway heading, wings level) and
  justify it from physics; (2) state their specific aircraft's best-glide
  speed and a defensible personal turn-back altitude floor from their POH
  and documented practice, or state that they have not established one and
  therefore will not turn back; (3) demonstrate correct initial response in
  a simulator or scenario drill, with action initiated within 3 seconds of
  the failure cue and airspeed stabilized at best glide within 5 seconds;
  (4) articulate at least three factors (density altitude, wind, runway
  remaining, aircraft type, pilot currency) that shift the decision; (5)
  at CFI level, critique a student's post-flight debrief on a turnback
  without either endorsing an untested technique or undermining confidence.
---

# Engine Failure After Takeoff

## Context

Two hundred feet AGL. The runway is behind you. The stall warning is off, the airspeed is climbing through 70, the nose is up, the cowling is pointed at sky. Then the noise changes. Maybe the engine coughs. Maybe it goes quiet. Maybe it is still turning but the airplane is not climbing anymore and the VSI is bleeding through zero.

In the next three seconds you will make a decision that many pilots before you got wrong. The ones who got it wrong are not around to tell you why. The NTSB is. Loss-of-control-inflight during initial climb is one of the most lethal events in general aviation, and a disproportionate share of those accidents involve a pilot attempting to turn back to the runway and stall-spinning in the turn.

The instinct is overwhelming. The runway is right there, behind you, paved and familiar. Ahead is a field, or trees, or houses. Every part of your brain that got you onto a runway in the first place screams: go back to the runway. That instinct kills.

This node is about why it kills, when the turnback is actually defensible (rarely), and what the default response should be (almost always: land ahead, wings level, best glide). It is a reg-absent topic. No CFR tells you what to do. The answer comes from physics, POH procedures, safety research, and the accumulated pattern-recognition of thirty years of accident data.

## Problem

You are departing runway 27 in a Cessna 172, standard day, no wind. Rotation at 55 KIAS, Vy 74. At 200 feet AGL, roughly 2,000 feet of runway behind you, the engine loses power. You still have some noise but the airplane is clearly not going to climb. Ahead of you, within the next 3,000 feet of ground track, are low trees and then a housing development. The runway you just left is behind you and a gentle turn would put you back toward it.

What is your decision in the next three seconds, and why?

Write your answer before you read on. Pick one of:

- Pitch for best glide, within 30 degrees of runway heading into the best-available field, wings level, land.
- Turn back to the runway.
- Maneuver for the nearest clear area regardless of heading.

Then note why you picked it. Then read the Discover phase. Your job in Discover is not to find out if you were right; it is to find out how much you can actually know about the answer from physics alone, before anybody tells you the rule.

## Discover

Work through these questions in order. Do the math roughly; back-of-envelope is the point. The goal is to arrive at the answer yourself.

### Q1. How much altitude does a 180-degree turn actually cost?

A C172 in the clean glide descends at roughly 650 fpm at best glide (around 68 KIAS) with the prop windmilling. TODO(verify) exact sink rate -- POH figures vary with weight and prop condition.

If you bank 45 degrees, the turn rate in a coordinated turn is governed by:

```text
turn rate (deg/sec) = (1091 * tan(bank)) / TAS (kts)
```

At TAS ~= 68 kt and 45 degrees of bank, tan(45) = 1, so:

```text
turn rate = 1091 / 68 = ~16 deg/sec
```

A 180-degree turn therefore takes about 11 seconds. At 650 fpm, that is:

```text
650 fpm / 60 sec = ~10.8 fps
10.8 fps * 11 sec = ~119 feet
```

But that is only the turn itself. You still need to roll in, roll out, correct for any offset from the runway centerline (you are not over the runway -- you are offset), and then glide the distance back. In practice, published turnback studies and demonstrations in type show total altitude loss for a useful teardrop turnback in a 172-class airplane landing back on the runway of at least 400-800 feet AGL under ideal conditions -- meaning a freshly-practiced pilot, known airplane, no startle delay, into-wind leg planned. TODO(verify) narrow this range against AOPA ASI and Rogers before publishing.

### Q2. What does banking do to stall speed?

Stall speed in a level coordinated turn scales as:

```text
Vs_turn = Vs_level * sqrt(1 / cos(bank))
```

At 45 degrees of bank, cos(45) = 0.707, so:

```text
Vs_turn = Vs_level * sqrt(1.414) = Vs_level * ~1.19
```

A 19% increase in stall speed. A 172 that stalls at 48 KIAS wings-level (clean, MTOW, TODO(verify) for specific model) stalls at roughly 57 KIAS in a 45-degree bank. And load factor goes to 1.414 G.

Why does this matter for a turnback? Because the pilot is already slow (just off takeoff), startled, looking behind them at the runway, and pulling. Pull plus bank equals AOA spike. If they tighten the turn to make the runway (the instinct is always to pull harder when the nose drops in the turn), they cross the stall AOA. Below 500 feet, there is no recovery.

### Q3. What does startle delay do to the math?

Research on surprise events in cockpits consistently shows 3-5 seconds of delay before effective action, and that is in pilots who have been trained in the scenario. TODO(verify) precise figures -- cite a specific study before publishing.

Five seconds at 650 fpm is:

```text
5 * 10.8 fps = ~54 feet
```

And during those 5 seconds, the airplane is also decelerating from climb speed toward stall unless the pilot promptly lowers the nose. If the nose is not lowered, airspeed can be below best glide (or below power-off stall) by the time the pilot acts. The altitude loss figure from Q1 assumed the pilot was already at best glide when the turn began. In reality, the first 3-5 seconds are spent recognizing, pitching down, and accepting that the runway is gone.

### Q4. When does the turnback become "safe"?

Define safe. There is no altitude at which the turnback becomes guaranteed; there is only an altitude below which it is reliably fatal. That altitude is aircraft-specific, pilot-specific, and conditions-specific. Published ranges in safety literature tend to cluster around 500-1000 feet AGL for 172-class singles under ideal conditions -- and "ideal" means specific, not hopeful. TODO(verify) confirm the current ASI-published range.

Answer the following about your own flying:

- Have you practiced a simulated turnback at altitude (with a safety buffer)?
- Do you know your airplane's measured altitude loss for a teardrop turnback?
- Are today's conditions (density altitude, wind, weight) within what you practiced?
- Did you brief "go/no-go turnback altitude" on the ground before this takeoff?

If the answer to any of those is no, the turnback is not available to you. Not because it is illegal. Because you have no data. Flying an untested emergency maneuver below 1,000 feet AGL is not a plan; it is an experiment with one subject.

### Q5. What is actually ahead?

Pilots who stall-spin in turnbacks almost always had a survivable option ahead of them. Trees stopped with wings level are survivable. A field at 20 degrees off-heading is survivable. A road, a fence, a crop -- with the airplane under control, wings level, pitch for best glide, touchdown at minimum safe speed -- is survivable. The airframe is designed to crumple. The pilot is not designed to survive a vertical impact from a stall-spin.

Look at the approach end obstacles for every runway you take off from. If you cannot name a plausible landing area within roughly 30 degrees either side of runway heading for the first 1,000 feet of climb, that is the planning problem -- not the turnback problem.

### What Discover should have led you to

- The default is land ahead, wings level, best glide, within about 30 degrees of runway heading.
- The turnback is physically possible but demands a specific combination of altitude, aircraft knowledge, recent practice, and conditions that most pilots do not have on any given day.
- The killer in the turnback is not the geometry; it is the stall in the bank, induced by startle, pull, and a pilot whose eyes are on the runway instead of the airspeed indicator.
- You cannot rule-follow your way to safety here. You reason, you pre-brief, you know your airplane, or you land ahead.

## Reveal

There is no single regulation. That is the point of this node. The canonical answer is synthesized from POH, FAA guidance, safety research, and physics.

### The summary rule

> Default response to engine failure after takeoff: pitch for best glide, land essentially straight ahead within approximately 30 degrees either side of the runway heading, wings level. Turning back to the runway is not a default option. Treat the turnback as unavailable unless you have, for this specific aircraft under today's conditions, established an altitude floor through documented practice at altitude, and you are above that floor by a meaningful margin when the failure occurs.

### Why the default is "land ahead"

- You know the airplane is controllable wings-level at best glide. You do not know it is controllable in a steep low-altitude turn that you have not practiced.
- You know approximately where you will touch down if you glide straight. You do not know, with startle time factored in, where you will touch down if you turn.
- Wings-level crashes into manageable terrain are routinely survivable. Stall-spin from below 500 feet AGL is rarely survivable.
- The decision is binary enough to be made in 1-2 seconds, not 5. In a genuine emergency at 200 AGL, you do not have 5 seconds.

### The physics summary

| Effect                          | Magnitude at 45 deg bank | Implication                                                                     |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| Load factor                     | 1.414 G                  | Pilot feels heavier; airplane's effective weight is higher                      |
| Stall speed multiplier          | ~1.19x                   | A clean stall at 48 KIAS becomes ~57 KIAS in the turn                           |
| Turn rate at 68 KIAS TAS        | ~16 deg/sec              | 180-degree turn takes ~11 seconds in the turn itself                            |
| Altitude loss in the turn only  | ~120 feet                | Not counting startle, pitch-down, rollout, glide to runway, offset correction   |
| Realistic total loss            | 400-1000+ feet AGL       | Depends on aircraft, pilot, delay, conditions. TODO(verify) narrow this range.  |

### POH guidance (generic, not aircraft-specific)

Most light single POHs (Section 3) specify a sequence roughly like:

1. Airspeed: best glide (varies by type; 68 KIAS for a C172S, TODO(verify) by model).
2. Fuel selector: BOTH (or appropriate tank).
3. Mixture: RICH.
4. Ignition: BOTH.
5. Primer: IN and LOCKED.
6. If time and altitude permit, attempt restart per checklist.
7. If restart fails, select the best available landing site ahead and secure the airplane (fuel off, mags off, mixture idle cutoff, master off just before touchdown).

Your airplane's POH overrides any generic list. Read it, know it, brief it.

### AOPA ASI synthesis

AOPA Air Safety Institute's body of work on engine failure after takeoff converges on three points:

- Turnback accidents are overwhelmingly stall-spin, not "ran out of runway."
- Pilots consistently underestimate altitude loss in a turnback and overestimate their own performance.
- The maneuver is trainable, but only if treated as a trained maneuver with a specific number from practice at altitude. Not as an instinct. TODO(verify) this summary against the current ASI publication before citing.

### Rogers' analytical finding

David Rogers' modeling shows that an optimized turnback (roughly 45 degrees of bank, teardrop rather than pure 180, maintained at L/Dmax) can be flown with less altitude loss than naive intuition predicts -- but that this result is margin-sensitive, requires immediate response, and was derived analytically under optimistic assumptions. Rogers' conclusion is widely misread as "the turn back is fine." It is not. His conclusion is closer to "the turn is not physically impossible, but it is not a default." TODO(verify) exact citation and wording.

### What is actually authoritative

In descending order of weight for your specific decision today:

1. Your airplane's POH emergency procedures section.
2. Your own documented practice at altitude for this airplane.
3. The FAA Airplane Flying Handbook's emergency procedures guidance.
4. AOPA ASI safety publications on engine failure after takeoff.
5. Physics (stall speed in a bank, glide ratio, turn radius).

### location_skill

- POH Section 3 (Emergency Procedures): engine failure during takeoff run, engine failure immediately after takeoff, engine failure during climb, forced landing without engine power. Read all four. The transitions between them are the decision you are training.
- FAA Airplane Flying Handbook, chapter covering emergency procedures. TODO(verify) chapter number for FAA-H-8083-3B current edition.
- AOPA Air Safety Institute -- search "engine failure after takeoff" or "impossible turn" on aopa.org/asi.
- Ask a CFI who flies your specific type: "At what altitude AGL, for this airplane at this weight and density altitude, would you personally consider the turnback an available option? And have you flown it at altitude recently?"

If their answer is vague or enthusiastic without numbers, trust the default: land ahead.

## Practice

### Cards (spaced memory items)

- `card:efato-default-response` -- "Engine fails at 200 AGL after takeoff. Default response?" -> "Pitch best glide, land within 30 deg of runway heading, wings level."
- `card:efato-stall-speed-45-bank` -- "Stall speed multiplier at 45-degree bank?" -> "1.19x level stall (sqrt of load factor 1.414)."
- `card:efato-load-factor-45` -- "Load factor at 45-degree bank, level turn?" -> "1.414 G."
- `card:efato-best-glide-172s` -- "Best glide speed, C172S clean?" -> "68 KIAS. TODO(verify) per POH."
- `card:efato-turnback-precondition` -- "Three preconditions for considering a turnback?" -> "Specific altitude established through practice at altitude, this aircraft, today's conditions."
- `card:efato-dominant-failure-mode` -- "Dominant fatal failure mode in turnback attempts?" -> "Stall-spin in the turn due to pulling at reduced airspeed with high AOA."
- `card:efato-startle-delay` -- "Typical startle delay in surprise cockpit events?" -> "3-5 seconds before effective action. TODO(verify) citation."
- `card:efato-poh-sequence` -- "POH engine-failure-after-takeoff sequence (generic)?" -> "Airspeed to best glide; fuel selector BOTH; mixture RICH; ignition BOTH; pick landing site; secure."
- `card:efato-30-degree-cone` -- "Default landing area after EFATO?" -> "Within ~30 deg either side of runway heading."
- `card:efato-altitude-loss-turn-only` -- "Altitude loss for a 180 turn at 45 bank, 68 KTAS, 650 fpm sink?" -> "~120 feet in the turn itself; several times more once startle, rollout, and glide back are included."

### Reps (scenario IDs)

- `scenario:efato-200-agl-short-runway-trees-ahead` -- standard case, 172, 200 AGL, short field, trees ahead, no wind. Learner picks decision and narrates reasoning.
- `scenario:efato-600-agl-long-runway-open-field` -- higher altitude, long runway behind, clear field ahead. Tests whether learner still defaults to land-ahead or is tempted by the turnback.
- `scenario:efato-high-density-altitude-climbing` -- Leadville or similar, already high DA, poor climb, engine roughens at 300 AGL with marginal terrain. Tests integration of DA into the decision.
- `scenario:efato-partial-power-loss` -- engine loses some but not all power. Ambiguous. Tests whether learner commits to a decision or waffles while altitude bleeds away.
- `scenario:efato-crosswind-component` -- 15 kt direct crosswind. Does learner consider turning into the wind for a shorter return leg, and how does that trade against stall-speed margin?
- `scenario:efato-400-agl-runway-remaining` -- engine quits at 400 AGL with runway still ahead. Tests the under-appreciated case where landing on remaining runway is the obvious choice.

### Drills (time-pressured)

- `drill:efato-3-second-response` -- 10 randomized scenarios. Scenario appears, learner has 3 seconds to select land-ahead, turnback, or off-axis. Score is correctness and response time.
- `drill:efato-pre-takeoff-brief` -- before each simulated takeoff, learner must state aloud their abort point, their turnback altitude floor, and their land-ahead options. Scored on completeness and specificity.
- `drill:efato-startle-inoculation` -- audio drill. Learner is flying an unrelated profile. Engine failure cue fires without warning. Time to first correct action measured.

### Back-of-envelope calculations

**Calculation 1: altitude loss in a 45-degree 180-degree turn in a C172.**

Given:

```text
TAS at best glide         = 68 kt
bank                      = 45 deg
sink rate (windmilling)   = 650 fpm  (TODO(verify) for C172S)
```

Turn rate:

```text
turn_rate = 1091 * tan(45) / 68
          = 1091 * 1 / 68
          = 16.04 deg/sec
```

Time for 180 degrees:

```text
t_180 = 180 / 16.04 = 11.22 sec
```

Altitude lost in the turn only:

```text
sink_fps = 650 / 60 = 10.83 fps
alt_lost = 10.83 * 11.22 = 121.6 feet
```

This is the turn itself. Add:

- 3-5 sec of startle and pitch-down (~35-55 ft at 650 fpm, and more if airspeed decays first),
- rollout time,
- the glide back to runway from the downwind offset the turn creates (runways are not a point; the turnback is a teardrop),
- and weight/density altitude degradation of the sink rate.

Realistic total: 400-800+ feet AGL under good conditions for a 172-class airplane. TODO(verify) narrow this band against ASI and Rogers.

**Calculation 2: stall speed in a banked turn.**

Given Vs (level, clean, MTOW, C172) = 48 KIAS (TODO(verify) per POH).

```text
Vs_turn(bank) = Vs * sqrt(1 / cos(bank))
```

| Bank (deg) | cos(bank) | load factor | Vs multiplier | Vs_turn for 172 clean (KIAS) |
| ---------- | --------- | ----------- | ------------- | ---------------------------- |
| 0          | 1.000     | 1.00        | 1.00          | 48                           |
| 30         | 0.866     | 1.15        | 1.07          | 52                           |
| 45         | 0.707     | 1.41        | 1.19          | 57                           |
| 60         | 0.500     | 2.00        | 1.41          | 68                           |

Note: at 60 degrees of bank, the C172's clean level stall speed equals best-glide. If the pilot is gliding at best glide and rolls to 60 degrees of bank to tighten the turn back to the runway, they are on the stall.

## Connect

### What changes if...

- **...there is a strong headwind on takeoff?** The runway is closer (less ground covered in the climb), which helps a turnback slightly, but the return leg is now downwind -- higher groundspeed, tighter reversal needed, overshoot risk if you misjudge. And the landing on the runway would be downwind. The turnback is typically worse with wind, not better.
- **...density altitude is 6,000 feet?** Climb rate is lower, true airspeed for a given IAS is higher (larger turn radius), sink rate in the glide is similar in IAS but worse in ground reference. Everything degrades. Raise the floor, lower the threshold for committing to land-ahead.
- **...the airplane is 200 pounds over gross?** Stall speeds go up, climb degrades, glide ratio degrades slightly (more energy bled per foot). And the flight is illegal; you should not be there.
- **...the engine has partial power rather than total failure?** The most dangerous case. Pilots bleed altitude and airspeed trying to coax climb from an engine that will not deliver, instead of committing to a forced landing while still high and fast. Default: if the airplane is not climbing normally, treat it as a forced landing and commit to a landing site. Do not chase phantom power.
- **...you are in a twin?** Different decision tree entirely. Vmc, drag of the feathered or windmilling engine, pitch for blue line, identify-verify-feather, positive rate of climb (or not) determines whether you fly it out or commit to landing. Out of scope here; see `proc-multi-engine-efato` when that node exists.
- **...you are in a turbocharged single at high altitude?** Turbo bootstrapping and partial-power scenarios are common; the engine may roughen rather than quit. Treat as partial-power loss above. Climb margins at altitude are thin; turnback is worse, not better.
- **...you have not practiced the turnback?** The turnback is unavailable. Full stop. You do not get to invent it under startle.

### Links

- `aero-angle-of-attack-and-stall` -- the stall is AOA, not airspeed; the bank raises stall speed by raising load factor; the pilot who pulls in the turn crosses critical AOA.
- `proc-adm-hazardous-attitudes` -- macho ("I can make it back") and impulsivity ("the runway is RIGHT THERE") are the decision failures behind most fatal turnbacks. Invulnerability ("not me") is why pilots do not brief it before takeoff.
- `wx-density-altitude` -- every term in the turnback math degrades with DA.
- `perf-takeoff-landing-distance` -- the runway behind you is a function of rotation speed, climb rate, and wind. Brief it before takeoff.
- `perf-crosswind-component` -- crosswind shifts the upwind/downwind asymmetry of the turnback.
- `proc-emergency-authority` -- you are PIC. You deviate from anything you need to deviate from. Say it out loud before takeoff so you will say it out loud when it matters.
- `teach-common-student-errors-stalls` -- the CFI-side of this node; the stall-in-a-turn is the pattern that connects student training failures to the EFATO graveyard.
- `teach-evaluating-student-judgment` -- how a CFI tests whether a student's turnback reasoning is real or performative.

## Verify

### Novel scenario (narrative)

> You are departing a 3,000-foot runway at 2,000 feet density altitude, 200 pounds over gross (the airplane was at MTOW on the ramp and you did not account for the extra passenger's bag before engine start -- post-flight problem, you will deal with it after you land), in a Cessna 172S. You rotate at 55 KIAS and accelerate slowly. At 400 AGL the engine RPM suddenly drops to 1,200 and will not recover despite mixture, carb heat, and throttle manipulation. Trees 200 feet tall stand about a half mile ahead. An open, plowed field extends perpendicular to the runway heading (roughly 90 degrees off your nose), past the trees. The runway is behind you. Wind is calm.
>
> Walk through your decision sequence for the next 10 seconds. State each action and the reason for it.

Scoring rubric (self-assessed or CFI-assessed):

- Identifies partial-power loss as a committed forced-landing case rather than a fly-it-out case. (2 points)
- Pitches for best glide immediately; does not chase airspeed trying to out-climb the problem. (2 points)
- Rejects the turnback without extended analysis -- 400 AGL over-gross at 2,000 DA is not a turnback scenario for a 172. (2 points)
- Rejects the perpendicular field -- 90 degrees off heading at 400 AGL requires a turn larger than a turnback and lands the airplane cross-wind into unknown furrow direction. Not better. (2 points)
- Commits to a landing within roughly 30 degrees of runway heading, accepting the trees, with wings level, minimum safe speed, and full flaps as appropriate, and secures the airplane before impact. (3 points)
- States the fuel selector off / mixture cutoff / mags off / master off sequence for after-impact fire mitigation. (2 points)
- States "I am PIC, I am declaring an emergency" or equivalent without waiting for permission. (1 point)

14/14 is the bar. Below 10 is a redo.

### Teaching exercise (CFI)

> A commercial student demonstrated a turnback at 600 AGL in their last checkride-prep flight. They landed successfully on the runway. They are proud of it. They tell you during the debrief that they now "have the turnback in their pocket" and plan to use it if they ever need to.
>
> Write the first three sentences of your response as the CFI. You must: (1) not undermine their confidence in a maneuver they just flew well; (2) not endorse the turnback as a technique they should rely on; (3) redirect toward the actual lesson (one successful execution at one altitude in one set of conditions is not a technique -- it is one data point).
>
> Then write the debrief question you would ask them to get them to realize this themselves, rather than telling them.

Evaluation criteria:

- Response leads with acknowledgment of what they did well (flew the airplane, recognized the failure, did not stall).
- Response does not say "never turn back" -- which is both false and triggers defensive resistance.
- Response introduces the variables they have not tested (different altitude, different weight, DA, wind, startle, distraction, different airplane).
- The debrief question is open-ended ("what would change if...") rather than leading ("don't you think you should...").
- Final instructional move is to schedule practice at altitude to measure their actual altitude loss, turning the anecdote into data.

Example of the debrief question (not the only right answer):

> "You just flew a turnback from 600 AGL in a 172 at roughly 1,800 pounds, into a 5-kt headwind, fully briefed, expecting the failure. What altitude would you want to be at to fly that same maneuver at 2,300 pounds, 6,500 feet density altitude, at the end of a long cross-country when you are tired, with a passenger on board, and no warning? Let's go measure it together next flight."

That move -- turning the anecdote into a measurement -- is the pedagogical point of the whole node at CFI level.
