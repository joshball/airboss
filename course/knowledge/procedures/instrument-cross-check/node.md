---
# === Identity ===
id: proc-instrument-cross-check
title: Instrument Cross-Check (Scan)
domain: ifr-procedures
cross_domains:
  - aircraft-systems
  - adm-human-factors

# === Knowledge character ===
# procedural: there is a default scan pattern (selective radial scan; primary
#   and supporting instruments per maneuver).
# perceptual: instrument flying is a perceptual skill. Most of the work is
#   visual sampling under load, not procedural recall.
# judgment: when do you slow the scan, when do you fixate intentionally, when
#   do you trust an instrument that disagrees with another? Cross-check is
#   a continuous calibration of trust, not a fixed routine.
knowledge_types:
  - procedural
  - perceptual
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires: []
deepens: []
applied_by: []
taught_by: []
related:
  - nav-partial-panel
  - proc-unusual-attitude-recovery
  - proc-spatial-disorientation
  - proc-pitot-static-failures

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 60
review_time_minutes: 10

# === References ===
references:
  - source: Instrument Flying Handbook (FAA-H-8083-15B)
    detail: Chapter 6 -- Airplane Basic Flight Maneuvers Using an Electronic Flight Display; Chapter 5 -- Airplane Attitude Instrument Flying Using an Analog Instrument Panel
    note: >-
      Authoritative on selective-radial-scan and primary/supporting framing.
      The IFH is more direct about the trade-offs between the older "control
      and performance" model and the "primary/supporting" model than most
      training texts.
  - source: AC 61-27C
    detail: Instrument Flying Handbook (predecessor / archived guidance)
    note: >-
      Historical context for the development of scan technique, including
      the attention-allocation literature. Useful as a teaching reference;
      the current IFH supersedes it.
  - source: ACS / PTS standards
    detail: Instrument rating practical test -- area of operation IV (flight by reference to instruments)
    note: >-
      Defines tolerances the candidate's scan must support: heading within
      10 degrees, altitude within 100 feet, airspeed within 10 KIAS during
      basic instrument maneuvers.
  - source: AOPA Air Safety Institute
    detail: Spatial disorientation training, scan breakdown
    note: >-
      Synthesises the cognitive failure modes -- fixation, omission, and
      emphasis errors -- that show up in accident reports and in pilots
      under stress.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - recall
mastery_criteria: >-
  Learner can: (1) describe the selective-radial-scan pattern and its
  rationale (AI is the centerpiece because it integrates pitch and bank);
  (2) name the primary and supporting instruments for pitch, bank, and
  yaw in straight-and-level, climb, descent, and turn; (3) identify the
  three common scan errors (fixation, omission, emphasis) and the
  symptoms they produce; (4) demonstrate a scan that holds instrument-
  rating tolerances during basic maneuvers; (5) at CFII level, diagnose
  a candidate's scan failure from observed control inputs without seeing
  the candidate's eyes.
---

# Instrument Cross-Check (Scan)

## Context

The scan is the entire skill of instrument flight. Approach plates, hold entries, ATC clearances -- all of it sits on top of the scan. If the scan does not work, nothing else matters. The airplane drifts off altitude, off heading, into an unusual attitude, into a stall, into terrain. Pilots in IMC die because the scan broke down, not because they did not know the procedure.

The scan is also the hardest thing to teach because it is mostly invisible. The student is sitting next to you flying an approach with a perfectly competent control feel and an apparently steady airplane. Then they get a clearance amendment, or a panel light flickers, or the autopilot disengages with a chirp, and within 15 seconds the airplane is 300 feet low and 20 degrees off heading. The thing that broke is not their procedural memory; it is their attention allocation.

The textbook framing -- selective radial scan, primary and supporting instruments -- captures the structure but misses the dynamic. Real scan is reading rate of change, weighting trust, intentionally not looking at the failed instrument, sampling more frequently when the workload spikes, and slowing down when nothing is changing. It is a continuous management of where the eye lands and for how long.

This node is the foundation under partial-panel, unusual-attitude recovery, and spatial-disorientation prevention. None of those work without a functioning scan.

## Problem

You are hand-flying ILS to runway 17R, three miles from the FAF, established on the localiser, glideslope alive but not yet centered, gear and approach flaps down. ATC calls: "Cessna 12345, contact tower 118.7 at the marker. Maintain 110 knots until five-mile final." You acknowledge.

In the 15 seconds it took to copy and read back the clearance, your altitude has dropped 80 feet and the localiser needle has drifted half-deflection right.

What broke about your scan during those 15 seconds? What do you do in the next 5 to recover?

Write your answer before reading on. Then ask: what would you do differently next time you anticipate a frequency change at a busy point in the approach?

## Discover

The scan rests on three ideas: what to look at, in what order, and how to know when it is broken. Work through each.

### Q1. Why is the attitude indicator the centerpiece?

Because the AI is the only instrument that integrates pitch, bank, and (indirectly) yaw into a single picture in the time domain you fly the airplane in (sub-second). Every other instrument is a rate or a derived value:

- Airspeed indicator: ratio of dynamic to static pressure -> a number, not a picture.
- Altimeter: static pressure -> a number, not a picture.
- VSI: rate of change of static pressure -> a rate, lagging by 6-9 seconds in mechanical VSIs.
- DG: gyro-stabilised heading -> a number.
- Turn coordinator: rate of bank/yaw -> a rate, no attitude.
- Magnetic compass: heading -> a number, with errors.

You can fly an airplane on those instruments alone (and partial panel proves it). It is much harder. The AI as centerpiece lets you fly the airplane between scan cycles; it is what your peripheral vision returns to between targeted sweeps.

### Q2. What is selective radial scan?

The scan radiates out from AI in cycles tuned to the maneuver:

```text
AI -> ASI -> AI -> ALT -> AI -> DG -> AI -> VSI -> AI -> TC -> AI ...
```

The AI appears between every other instrument. The cycle hits the most-needed supporting instruments more often (in cruise, that's altimeter and DG; in climb, that's airspeed and VSI; in turn, that's turn coordinator and DG/compass).

Crucially, you are not staring at any one instrument. The eye lands, samples, moves on. Two principles:

- **Time on each instrument is short.** ~0.5 seconds is plenty for a value or trend.
- **Time between samples on critical instruments is short.** In cruise, altitude should be re-sampled every 2-3 seconds. In an approach with vertical guidance, every 1-2 seconds.

### Q3. What is "primary and supporting"?

A different framing for the same problem: per maneuver, identify which instrument is the primary reference for each axis of control (pitch, bank, power) and which are supporting. Examples for a typical maneuver:

| Maneuver         | Primary pitch | Primary bank | Primary power | Supporting                                |
| ---------------- | ------------- | ------------ | ------------- | ----------------------------------------- |
| Straight-level   | Altimeter     | DG           | Airspeed      | AI, VSI, TC, MP / RPM                     |
| Constant-airspeed climb | Airspeed | DG          | MP / RPM      | AI, VSI, altimeter (trend)                |
| Constant-rate descent | VSI       | DG          | MP / RPM      | AI, airspeed, altimeter                   |
| Standard-rate turn | Altimeter   | TC           | Airspeed      | AI, DG, compass                           |

In practice, primary instruments are the ones you look at most often. Supporting instruments confirm the trend. The AI is always present (because it is the centerpiece for the radial scan); it just plays a supporting role for any specific axis.

The two framings are complementary, not competing. Selective radial scan tells you the visit order; primary/supporting tells you which instrument is the source of truth for the current task.

### Q4. What does a broken scan look like?

Three classic failure modes (FAA literature; AOPA materials):

| Failure   | What happens                                                | Symptom in flight                                                  |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Fixation  | Eye locks onto one instrument; rest of panel goes ignored  | Altitude bleeds while pilot stares at localiser; or vice versa     |
| Omission  | Instrument never gets sampled in a cycle                   | Drift or trend goes unnoticed for 30-60 seconds                    |
| Emphasis  | One instrument is over-weighted; trend confirmation skipped| Pilot chases AI bank changes that VSI and altimeter do not confirm |

All three are caused by attention overload. The fix is not "scan harder" -- the brain cannot scan harder under load. The fix is to reduce load (autopilot on, ATC vectors instead of own-nav, slow the airplane down, ask for a hold so you can think) and to use trim aggressively so the airplane does not need micro-corrections during the scan failure window.

### Q5. What does the scan look like during high workload?

When the workload spikes (clearance amendment, course change, frequency change at a busy point on the approach), the scan compresses. You should:

- Trim the airplane perfectly before the workload starts (anticipate). A trimmed airplane stays put for 10-20 seconds without your input.
- Sample altitude and bank explicitly before the head-down task. ("Two-three thousand, wings level, on heading. OK, copying.")
- Keep peripheral vision on the AI while head-down. The brain extracts roll cues from peripheral vision better than pitch cues.
- Resample altitude and bank explicitly after. ("Two-three thousand, wings level, on heading. OK, back to scan.")

The verbalisation is the trick. You are forcing yourself to commit a trend to memory before the interruption so you can compare on return. Without the verbalisation, the brain remembers what it saw before the interruption only fuzzily, and a 100-foot drop blends into "about where I was."

### What Discover should have led you to

- The AI is the centerpiece because it integrates pitch and bank into a picture; the rest of the panel provides confirmation, rate, and number.
- Selective radial scan and primary/supporting are two views of the same thing: where to look, when, and for how long.
- Scan errors come from attention overload. The fix is load reduction (trim, autopilot, ATC offload), not effort.
- High workload demands explicit pre/post sampling with verbalisation; trust your scan less when the brain is busy elsewhere.

## Reveal

### The summary rule

> Instrument flight is the management of attention across a panel. The selective radial scan returns to the AI between samples of supporting instruments at a frequency tuned to the maneuver. Primary instruments per axis dictate where to look first; supporting instruments confirm trend. Scan errors (fixation, omission, emphasis) are diagnostic of attention overload, not effort failure -- the fix is load reduction. Trim aggressively, verbalise altitude and bank before head-down tasks, and trust the rebuilt scan after.

### The selective radial scan

The eye returns to the AI between every supporting-instrument sample. In cruise:

```text
AI (0.4s) -> Alt (0.4s) -> AI (0.3s) -> DG (0.4s) -> AI (0.3s) ->
ASI (0.3s) -> AI (0.3s) -> VSI (0.3s) -> AI (0.3s) -> TC (0.3s) ->
AI (0.4s) -> ...
```

Approximate, not literal. The point is the AI is the recurring node. Each cycle is ~3 seconds; altitude and DG are re-sampled twice per cycle. In an approach with vertical guidance, the cycle compresses; in straight cruise, it stretches.

### Primary / supporting per maneuver

| Maneuver               | Pitch primary       | Bank primary | Power primary |
| ---------------------- | ------------------- | ------------ | ------------- |
| Straight-level         | Altimeter           | DG           | Airspeed      |
| Climb (Vy)             | Airspeed            | DG           | MP / RPM      |
| Climb (rate)           | VSI                 | DG           | MP / RPM      |
| Cruise descent         | VSI                 | DG           | Airspeed      |
| Approach descent       | Glideslope (or VSI) | Localiser    | Airspeed      |
| Standard-rate turn     | Altimeter           | TC           | Airspeed      |
| Steep turn (50+ bank)  | Altimeter           | AI           | Airspeed      |

The pattern: in any maneuver, identify what controls each axis (pitch, bank, power), and what number you are trying to hold or change on each axis. The number defines the primary instrument.

### The three scan errors and their fixes

| Error    | Recognition                                       | Fix                                                                |
| -------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Fixation | One instrument worth a 5-second stare             | Force the eye away; trim, then verbalise current state             |
| Omission | An instrument has not been sampled in 30+ sec     | Slow the workload; reduce inputs; engage AP if available           |
| Emphasis | Acting on AI alone without confirming with rate   | Add a half-second on VSI / altimeter as confirmation               |

### What a working scan produces

- Altitude held within 50-100 feet without conscious correction.
- Heading held within 5-10 degrees without conscious correction.
- Rate-of-change cues (VSI trend, ASI rate, glideslope rate) used to anticipate, not react.
- Spare attention for ATC, planning, and weather updates.

If the airplane is wandering by 100+ feet or 10+ degrees during basic IMC cruise, the scan is broken. The first response is load reduction, not scan effort.

### What is actually authoritative

In descending order:

1. **IFH chapters 5 and 6** for the FAA's current pedagogical framing.
2. **ACS instrument task elements** for the tolerances your scan must support.
3. **Your CFII's syllabus** -- the maneuvers you can scan are the maneuvers you have practised scanning.
4. **AOPA / FAA Safety Team accident reviews** for the failure modes that show up in real cockpits.

### location_skill

- IFH chapter 5 (analog) and chapter 6 (electronic display). Both, even if you fly only one type. The principles transfer.
- ACS task IV elements -- the candidate must hold tolerances. The tolerance is also the operational standard.
- AC 61-27 (archived) for the historical depth on scan development; not authoritative today but contextually rich.

## Practice

### Cards (spaced memory items)

- `card:cc-ai-centerpiece` -- "Why is the AI the centerpiece of the scan?" -> "It integrates pitch and bank into a picture in real time; other instruments are derived rates or numbers."
- `card:cc-radial-scan-pattern` -- "Selective radial scan structure?" -> "AI -> supporting -> AI -> supporting -> ..., with AI between every two supporting-instrument samples."
- `card:cc-cruise-primary-pitch` -- "Primary pitch instrument in straight-and-level cruise?" -> "Altimeter."
- `card:cc-vy-primary-pitch` -- "Primary pitch instrument in a Vy climb?" -> "Airspeed indicator."
- `card:cc-standard-rate-turn-primary-bank` -- "Primary bank instrument in a standard-rate turn?" -> "Turn coordinator."
- `card:cc-three-scan-errors` -- "Three scan errors?" -> "Fixation, omission, emphasis."
- `card:cc-fixation-fix" -- "Fix for scan fixation?" -> "Reduce load (trim, autopilot, ATC offload), then re-establish scan; effort does not solve fixation."
- `card:cc-pre-clearance-trim` -- "What do you do before copying a clearance amendment in cruise?" -> "Trim, sample altitude/bank/heading, verbalise, then go head-down."
- `card:cc-peripheral-vision-roll` -- "Why does peripheral vision matter during head-down tasks?" -> "Brain extracts roll/yaw cues from peripheral better than pitch; AI in the corner of vision still gives bank info."
- `card:cc-tolerance-altitude` -- "ACS instrument tolerance for altitude during basic maneuvers?" -> "Within 100 feet."

### Reps (scenario IDs)

- `scenario:cc-clearance-amendment-on-approach` -- the opening problem; pilot must verbalise before going head-down.
- `scenario:cc-fixation-on-localiser` -- pilot is fighting a localiser deviation and altitude bleeds 200 feet without notice.
- `scenario:cc-omission-asi-icing` -- pilot fails to sample ASI for 60 seconds; airframe ice has dropped airspeed without their notice.
- `scenario:cc-cruise-AP-handoff` -- AP disengages with a chirp; pilot must re-establish scan from a one-second head-down moment.
- `scenario:cc-glass-failure-reversion` -- PFD reverts to backup display; cross-check pattern adapts.

### Drills (time-pressured)

- `drill:cc-call-out-primary-supporting` -- instructor names a maneuver; learner calls out primary and supporting instruments for each axis.
- `drill:cc-trend-from-rate` -- instructor changes one instrument; learner identifies which axis is changing and which supporting instruments confirm.
- `drill:cc-pre-clearance-verbalise` -- on simulated clearance amendments, learner is graded on whether they trim, verbalise current state, copy, and re-establish.
- `drill:cc-fixation-detection` -- instructor cues a fixation by manipulating one instrument; learner is graded on detection time.

### Back-of-envelope calculations

**Calculation 1: scan cycle vs. drift rate.**

A trimmed C172 in cruise, no turbulence, will deviate altitude by ~50 feet in 30 seconds without input. If the scan re-samples altitude every 3 seconds, you catch the deviation at 5 feet -- a single-knob altimeter trim is enough. If altitude is sampled every 30 seconds, you catch it at 50 feet -- now you need a noticeable correction.

The scan frequency is not arbitrary. It is set by how much drift you can tolerate vs. how often you can sample.

**Calculation 2: work budget under high workload.**

If a clearance amendment takes 10 seconds head-down and the airplane drifts 30 feet/altitude, 5 degrees/heading in those 10 seconds (un-trimmed; turbulence), your post-amendment correction budget is one half-second on each axis. Trim before, anticipate the workload, sample after.

If the airplane drifts more than 100 feet during the head-down moment, the trim was not adequate or the amendment took too long. Recovery is harder than prevention.

## Connect

### What changes if...

- **...you fly glass cockpit?** The PFD compresses the scan; AI, ASI, altimeter, DG are all on one screen. Selective radial scan still applies, but the spatial sweeps are smaller. Engine instruments and other gauges may be on a separate screen; they need explicit visits. The principles are unchanged.
- **...the autopilot is on?** The scan continues; the load drops. You are now monitoring instead of flying. Scan errors are still possible (and dangerous, because the AP may be flying into the wrong altitude or heading and you have to catch it).
- **...the airplane is in turbulence?** Cycle compresses; sampling becomes more frequent because rates are higher. Tolerate larger excursions; the scan is reading rates, not absolute deviations.
- **...you have lost AI (vacuum failure)?** The scan rebuild is the partial-panel scan; see `nav-partial-panel`.
- **...you are flying single-pilot in a complex airplane (gear, prop, mixture, fuel pump, cowl flaps)?** Workload is higher; scan must compete with system management. Reduce load aggressively (autopilot, ATC vectors).
- **...you are flying in IMC at night?** Spatial disorientation risk is higher; trust the panel even when the body says otherwise. Scan discipline replaces the visual horizon.
- **...you have a passenger asking questions?** Talking degrades the scan. Politely set the expectation pre-flight: you do not chat in IMC.

### Links

- `nav-partial-panel` -- the scan rebuild when one or more instruments fail.
- `proc-spatial-disorientation` -- the cognitive failure that trained scan prevents and, when it occurs, that scan can recover from.
- `proc-unusual-attitude-recovery` -- if scan failed, you recover from the resulting unusual attitude. The recovery itself relies on a working scan.
- `proc-pitot-static-failures` -- many failures show up first as a scan inconsistency.
- `proc-stall-recovery` -- low-airspeed scan must include a check for the imminent stall before the airplane is in it.

## Verify

### Novel scenario (narrative)

> You are at 5,000 in IMC, just inside the IAF for an ILS approach. ATC clears you down to 3,000 and assigns a frequency change to tower at the FAF. You are hand-flying, no autopilot. Your trim is a click off but flyable.
>
> Walk through the next 30 seconds of your scan and your action sequence. Be specific about when your eye is on each instrument and when your hands are doing what.

Scoring rubric:

- Trims first -- "click of nose-down trim, I want this stable." (1)
- Initiates the descent: throttle reduction, pitch slightly nose-down, primary pitch shifts to VSI / altimeter. (2)
- Verbalises before frequency change copy: "Out of five for three, on heading 17R inbound, wings level, copying tower frequency 118.7." (2)
- Head-down for 3-4 seconds for frequency tune; peripheral vision still on AI. (2)
- Resamples after head-up: "Wings level, heading on, descending through forty-five-hundred." (2)
- Stabilises descent and re-establishes the scan with primary pitch on VSI. (2)
- Identifies the trap that would catch a less-disciplined pilot: 200-300-foot bust from prolonged head-down without pre-trim. (1)
- Anticipates the next workload peak (FAF crossing) and plans to retrim and re-verbalise before it. (2)

14/14 is the bar. Below 10 is a redo.

### Teaching exercise (CFI)

> A student preparing for the instrument practical test is flying an ILS in the simulator. Their localiser tracking is good, but they consistently descend 100-150 feet below glideslope between the FAF and DA. The deviation is symmetric -- it does not follow a turbulence pattern, and they are not high before they are low. Their scan visibly slows on the altimeter as they get below 1,000 AGL.
>
> Diagnose the scan failure and write the in-flight cue plus the post-flight teaching point.

Evaluation criteria:

- Diagnosis: emphasis error -- the student is over-weighting the localiser (because deviating off centerline feels worse than deviating on glideslope) and under-sampling the glideslope as ground rises in their peripheral field.
- In-flight cue: short and on-axis, e.g., "GS." (one word, scan-compatible).
- Post-flight teaching point: discusses the perceptual trap, the symmetry of the deviation as evidence (random would scatter; symmetric points to attention), and the fix (explicit GS sample at every localiser sample, paired).
- Drill assigned: chair-fly two ILSs verbalising "loc, GS, alt" each cycle for the next training session.
- The CFII does not chastise; the trap is universal and known. The lesson is calibration, not effort.

The pedagogical move is to read scan from control inputs alone -- the candidate's eye behavior is invisible from the right seat, but the airplane's behavior reveals what got under-sampled.
