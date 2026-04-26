---
# === Identity ===
id: nav-partial-panel
title: Partial Panel
domain: ifr-procedures
cross_domains:
  - emergency-procedures
  - aircraft-systems
  - adm-human-factors

# === Knowledge character ===
# procedural: there is a default scan rebuild (use the surviving instruments,
#   pitch references switch to airspeed-trend + altimeter, heading switches to
#   magnetic compass + turn coordinator, etc.).
# perceptual: identifying which instrument is lying takes a deliberate cross-
#   check. The fastest way to die is to trust the instrument that broke.
# judgment: when do you cover the failed instrument, when do you continue an
#   approach, when do you ask for vectors back to VFR conditions, when do you
#   declare an emergency? Partial panel is a workload management problem as
#   much as an instrument-flying problem.
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
  - proc-instrument-cross-check
deepens: []
applied_by: []
taught_by: []
related:
  - proc-pitot-static-failures
  - proc-alternate-static-source
  - proc-unusual-attitude-recovery
  - proc-spatial-disorientation
  - proc-180-degree-turn

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 75
review_time_minutes: 12

# === References ===
references:
  - source: Instrument Flying Handbook (FAA-H-8083-15B)
    detail: Chapter on the instrument flight rules (IFR) flight scan; partial-panel sections
    note: >-
      Authoritative for the FAA's framing of the six-pack scan and the
      degraded-scan rebuilds that follow loss of attitude indicator,
      directional gyro, or vacuum source.
  - source: AIM
    detail: 5-3-3 -- IFR Position Reporting; 6-2 -- Emergency Procedures
    note: >-
      Communication and emergency declaration framing. The "lost gyros"
      transmission to ATC and the implicit priority handling.
  - source: POH / AFM
    detail: System descriptions for vacuum, electrical, and pitot-static
    note: >-
      Aircraft-specific instrument power sources. Many singles have AI and
      DG on a vacuum pump; turn coordinator on electrical; airspeed and
      altimeter on pitot-static. A vacuum failure takes AI and DG. An
      alternator failure takes the turn coordinator.
  - source: ACS / PTS standards
    detail: Instrument rating practical test -- partial-panel maneuvers
    note: >-
      Examiners cover or fail the AI / DG and require the candidate to
      maintain heading, altitude, and timed turns using the surviving
      instruments. A partial-panel approach (typically a non-precision)
      is required.
  - source: AC 91-75
    detail: Attitude Indicator
    note: >-
      Discusses electric backup AIs and the rationale for redundancy in
      part-91 IFR flying. Increasingly common in glass aircraft as the
      conceptual replacement for the vacuum AI.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) identify which six-pack instruments share a power
  source in a typical light single (vacuum-driven AI/DG; electric turn
  coordinator; pitot-static airspeed/altimeter/VSI); (2) describe the
  partial-panel scan replacements when the AI fails (airspeed and altimeter
  for pitch; turn coordinator and magnetic compass for bank/heading) and
  when the DG fails (magnetic compass for heading); (3) demonstrate
  straight-and-level, climbs, descents, and timed turns to a heading on
  partial panel without exceeding ACS tolerances; (4) describe at least
  two failure-mode confusions (failed AI showing wings level, failed DG
  drifting slowly) and how cross-check catches them; (5) decide and
  articulate when partial panel triggers an emergency declaration vs.
  routine continuation.
---

# Partial Panel

## Context

You are 30 minutes into a real IFR flight at 8,000 in solid IMC. You have been hand-flying because the autopilot is acting up, and the workload is high but manageable. Your scan is steady; the airplane is in trim; ATC is reasonable. You glance at the attitude indicator. It shows about a 10-degree right bank. You roll left to correct. The AI does not move. You roll further. The turn coordinator now shows a half-deflection left turn. The airspeed is climbing. The altimeter is descending. Something has gone very wrong, and the most authoritative-looking instrument on the panel -- the one with the airplane symbol on it -- is the one that is lying to you.

This is the partial-panel emergency. It is not just an instrument failure. It is the moment when your scan, which you have been training on a six-pack, has to rebuild itself in real time around an instrument set you would never normally fly with. You need to do this while in IMC, while disoriented, while the airplane is already deviating from the assigned altitude, while ATC is calling you with a routine frequency change.

Vacuum-pump failures in older singles are the canonical case. Six-pack airplanes typically lose attitude indicator (AI) and directional gyro (DG) together when the vacuum source fails, leaving the turn coordinator (electric), magnetic compass, airspeed, altimeter, and VSI as the surviving instruments. Glass-cockpit airplanes have different but analogous failures: an ADAHRS failure on a single-display, an electrical-bus failure, a backup AI swap. The principle is the same: you have lost the picture-instrument and must rebuild the picture from the rate-instruments and the static-pressure instruments that are still working.

Pilots die on partial panel for predictable reasons. They keep glancing at the failed instrument and trying to interpret the lie as truth. They miss the cross-check that would have caught the failure earlier. They get behind the airplane and let attitude wander into unusual-attitude territory. The training response is rote, but the in-flight response requires that the rote actions be available without thinking, because the brain that should be making them is busy being scared.

## Problem

You are a freshly-rated instrument pilot, 15 hours of actual since checkride. You are in IMC at 6,000 on a routine cross-country. ATC has cleared you direct to a fix and amended your altitude to 7,000. As you initiate the climb, you notice the AI shows a slight nose-up attitude (correct) but the DG is drifting slowly to the right despite no rudder input. The compass card is showing roughly the same heading. The turn coordinator shows wings level.

What do you do in the next 30 seconds, in order, and why?

Write your answer before reading on. Then ask: how would you have caught this failure earlier? What does your cross-check look like at this moment?

## Discover

The partial-panel response decomposes into four problems: detection, identification, scan rebuild, and management. Work through each.

### Q1. How does an instrument fail in a way you can detect?

A clean failure is rare. Instruments do not usually go dark; they drift, lock, or freeze. The drift is the dangerous failure mode because the instrument still looks plausible.

| Instrument        | Common failure modes                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| Attitude indicator| Slow precession (drifting bank or pitch); freezing; flag annunciation if equipped |
| Directional gyro  | Slow drift if uncaged or vacuum-degraded; lock if vacuum fails                    |
| Turn coordinator  | Battery/bus fail; tumbling on intense aerobatics                                  |
| Airspeed indicator| Pitot block (rises like an altimeter); drain/static leak; reading low             |
| Altimeter         | Static block (frozen); alternate-static cabin-pressure offset                     |
| VSI               | Static block (lags); rapid static change creates unreliable trend                 |
| Magnetic compass  | Northerly turning error (lead/lag); acceleration/deceleration error               |

Detection comes from cross-check, not from staring at one instrument. Two instruments that disagree means at least one is lying. Three that agree, with the suspect one disagreeing, identifies which.

### Q2. Which instruments share power, and why does that matter?

In a typical 1970s light single (C172, PA28):

- **Vacuum pump** drives AI and DG. A vacuum failure takes both, simultaneously, almost always at the worst time. The airplane keeps flying; only the gyros fail.
- **Electrical bus** drives turn coordinator (some airplanes), radios, lights. An alternator failure first puts you on battery; load-shedding becomes the next priority.
- **Pitot-static system** drives airspeed (pitot pressure compared to static), altimeter (static pressure), VSI (rate of static change). A pitot block freezes airspeed; a static block freezes altimeter and VSI; both blocked, all three lie.

So the failure modes are coupled. A vacuum failure means partial panel without AI/DG. A static block means partial panel of the pressure instruments. An alternator failure progressively degrades electrical instruments. Knowing what shares a power source tells you what to expect to fail together.

### Q3. What instruments replace what?

If the AI fails, you rebuild the picture from:

- **Pitch:** airspeed indicator + altimeter. If airspeed is increasing and altitude is decreasing, you are nose-low. If airspeed is decreasing and altitude is increasing or stable, you are nose-up.
- **Bank/turn:** turn coordinator (rate of turn) + magnetic compass (heading). If the TC is centered and the compass is steady, wings are level.
- **Trim:** by hand, paying attention to control pressures. Heavy nose-up pressure means trim away from where you want to be.

If the DG fails, you rebuild from:

- **Heading:** magnetic compass, with appropriate corrections for northerly turning error and acceleration error. Time and timed turns become more useful.

If the airspeed indicator fails (pitot block):

- **Airspeed:** by attitude (AI) plus power setting. A known pitch attitude and a known power setting produce a known airspeed in your airplane; you have memorised this from your standard rate climbs and descents.

If the altimeter and VSI fail (static block, no alternate static source):

- **Altitude:** by attitude + power; trend, not absolute. Use known cruise pitch attitude as the level reference; tolerate altitude drift until you can get out of IMC.

### Q4. What does the cross-check look like under partial panel?

Normal six-pack scan: AI is the centerpiece; you sweep out to airspeed, altimeter, DG, VSI, turn coordinator, then back to AI.

Partial-panel scan (no AI):

```text
turn coordinator (bank/yaw rate) ->
airspeed (pitch trend) ->
altimeter (pitch trend) ->
DG or compass (heading) ->
VSI (trend confirmation) ->
back to turn coordinator.
```

The scan is faster and more demanding because no single instrument synthesises bank and pitch for you. You are doing the synthesis manually.

Practice this with a hood at altitude before you need it.

### Q5. When do you cover the failed instrument?

Always, if you can do so without taking your hands off the controls. A failed AI sitting on the panel showing a plausible-but-wrong attitude is a continuous distraction. A blank space is honest. Partial panel is hard enough without your eye returning to the lying instrument every cycle.

In real life, that means a sticky note, a piece of cockpit tape, an iPad in the way, or a hand momentarily covering the face. Glass-cockpit failures may be self-cancelling (the failed display reverts to red X or shows clearly invalid data); that is helpful.

### Q6. When do you declare an emergency?

If the failure is in IMC, you declare. You do not have to use the word "emergency"; "lost gyros" or "instrument failure" plus a request for priority handling is enough. ATC will offer:

- Vectors to VFR conditions or to the nearest suitable airport.
- Headings (so you do not have to read the DG / compass and figure out what to fly).
- Block altitude (so you can stop flying altitude precisely).
- Frequency unchanged (so you do not have to re-tune).

You take all of those. You are not bothering them. They train for this. The PIC authority covers any deviation from your clearance you need.

### What Discover should have led you to

- Detection comes from cross-check; instruments that should agree, do not.
- The failure mode dictates what fails together. Vacuum loses AI + DG; static loses altimeter + VSI; pitot loses airspeed.
- Replacement is rote: pitch from airspeed + altimeter; bank from turn coordinator + compass; heading from compass and timed turns.
- Cover the failed instrument so it stops distracting.
- In IMC, declare. ATC will offload workload.

## Reveal

### The summary rule

> Partial panel: identify the failed instrument by cross-check; cover it; rebuild the scan from the surviving instruments (pitch from airspeed and altimeter, bank from turn coordinator, heading from magnetic compass with correction for northerly turning and acceleration error); reduce workload; declare an emergency in IMC if the situation degrades the safety margin; accept ATC offloads (vectors, block altitude, nearest airport).

### Common failure scenarios and replacement instruments

| Failed instrument        | Source                | Replace with                                 | Watch for                                                       |
| ------------------------ | --------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| Attitude indicator       | Vacuum (typical)      | Airspeed + altimeter (pitch); TC + compass (bank) | Pre-failure precession; flag annunciation if equipped       |
| Directional gyro         | Vacuum                | Magnetic compass; timed turns                | Drift over time; uncaged behavior                               |
| Turn coordinator         | Electrical            | AI bank reference; rudder ball still works  | Bank/yaw rate cues lost; harder in IMC                          |
| Airspeed                 | Pitot pressure        | Pitch attitude + power                       | Pitot block: airspeed rises with altitude; pitot ice common     |
| Altimeter                | Static pressure       | Pitch + power; alternate static if equipped | Static block: altimeter freezes; alt static raises indicated alt|
| VSI                      | Static pressure       | Trend from altimeter; pitch attitude         | Lag in normal operation; freezes with static block              |
| Magnetic compass         | Earth's field         | DG (if working); GPS heading                | Acceleration/deceleration errors; bank-induced errors           |

### The pitot-static failure subset

A pitot block (drain hole open, ram air blocked) makes airspeed read like an altimeter (rises with climb, falls with descent). A pitot block with the drain also blocked makes airspeed read whatever it was when the block formed.

A static block (no alternate static source open) freezes altimeter and VSI at the value when the block formed. Indicated airspeed becomes unreliable.

Alternate static (where equipped) admits cabin static pressure. Cabin static is typically lower than outside static at altitude (cabin is somewhat sealed; pressure is closer to ground level inside than outside at altitude); so altimeter reads higher and airspeed reads higher when alternate static is selected. POHs publish a correction for this.

If alternate static is not equipped, breaking the VSI face glass admits cabin static pressure to the static system. This is a memory item in some POHs and a last-resort improvisation; the VSI is sacrificed but altimeter and airspeed return to readable accuracy with the cabin-static error.

### The vacuum-loss procedure (typical light single, no electric backup AI)

1. Recognise the failure (cross-check; AI/DG diverge from turn coordinator and compass; vacuum gauge in the red).
2. Verify by checking suction gauge if equipped.
3. Cover the failed AI and DG.
4. Establish straight-and-level using turn coordinator (centered) + airspeed and altimeter (steady).
5. Tell ATC: "Center, Cessna 12345, vacuum failure, lost gyros, request vectors to nearest VFR conditions, declaring emergency." Or equivalent.
6. Take vectors. Fly the airplane. Do not attempt non-essential maneuvers (no precision approaches if a vector to VFR is available).
7. Plan a partial-panel non-precision approach if vectoring out of IMC is not available.
8. Land. Document. Maintenance.

### What is actually authoritative

In descending order:

1. **POH Section 3 (Emergency Procedures)** for your specific airplane's instrument-failure procedures, alternate static source guidance, and vacuum failure response.
2. **AIM 6-2** and **5-3** for ATC interaction and emergency declaration.
3. **AFM / IFH** for technique on partial-panel scan rebuild.
4. **Your CFII's syllabus** for the practice profile you trained on. The maneuvers you can do partial-panel are the maneuvers you have practised partial-panel.

### location_skill

- POH Section 3 -- emergency procedures for vacuum failure, electrical failure, alternate static source. Read all three before flying IFR.
- IFH chapter on partial-panel maneuvers and scan rebuild.
- ACS / PTS task elements for the instrument rating -- they tell you what an examiner will test, which is also what an instrument pilot should be able to do.
- Your airplane's panel -- map which instrument has which power source. Know what fails together.

## Practice

### Cards (spaced memory items)

- `card:pp-vacuum-fails-what` -- "What does a vacuum-pump failure typically take in a light single?" -> "Attitude indicator and directional gyro."
- `card:pp-pitch-replacement` -- "Partial-panel pitch references after AI failure?" -> "Airspeed (rate) + altimeter (rate); confirm with VSI trend."
- `card:pp-bank-replacement` -- "Partial-panel bank reference after AI failure?" -> "Turn coordinator (rate of turn); magnetic compass for heading."
- `card:pp-cover-it` -- "What do you do with a failed instrument once identified?" -> "Cover it -- sticky note, hand, tape -- so the wrong information stops drawing your eye."
- `card:pp-emergency-declare` -- "When do you declare emergency on partial panel?" -> "In IMC, immediately; in VMC, if the failure compounds with weather or terrain."
- `card:pp-static-block-effect` -- "What happens to airspeed and altimeter on a static block, level cruise?" -> "Both freeze at value when block formed; airspeed becomes unreliable as conditions change."
- `card:pp-alternate-static-effect` -- "What happens to indicated airspeed when alternate static (cabin) is selected?" -> "IAS reads higher than actual (cabin static is lower than outside static at altitude); POH publishes correction."
- `card:pp-pitot-block-effect" -- "What happens to airspeed on pitot block (drain open) in a climb?" -> "Reads higher (acts like an altimeter)."
- `card:pp-northerly-turning-error` -- "Magnetic compass error when turning to north?" -> "Compass leads turn; under-reads (you stop the turn early); UNOS rule -- Undershoot North, Overshoot South."
- `card:pp-acceleration-error` -- "Magnetic compass error on east/west when accelerating?" -> "ANDS -- Accelerate North, Decelerate South."

### Reps (scenario IDs)

- `scenario:pp-vacuum-fail-imc-cruise` -- vacuum gauge in red at 8,000 IMC; AI and DG drifting; turn coordinator shows level. Walk through detection, cover, scan rebuild, ATC call.
- `scenario:pp-static-block-climbing-into-icing` -- static port iced; altimeter and VSI freeze on climb; airspeed unreliable. Pilot reaches for alternate static.
- `scenario:pp-pitot-block-cruise` -- airspeed indicator climbing past the yellow arc despite stable cruise; pitot drain open. Diagnose and proceed.
- `scenario:pp-electrical-fail-in-imc` -- alternator out, battery degrading; pilot must shed loads and divert before total bus failure.
- `scenario:pp-glass-adahrs-fail` -- single-display G1000 with ADAHRS failure; backup AI takes over. Different drill than vacuum panel; same conceptual response.
- `scenario:pp-partial-panel-non-precision-approach` -- vacuum failure at 1,500 AGL on a non-precision approach to a 1,000-and-3 ceiling. Continue or go missed?

### Drills (time-pressured)

- `drill:pp-cross-check-30-seconds` -- learner is shown a six-pack snapshot with one or two instruments showing wrong values. They have 30 seconds to identify which has failed and what they would replace it with.
- `drill:pp-call-out-replacement` -- instructor calls out "AI failed" or "DG failed" or "static blocked" and the learner calls back the replacement scan and the first ATC call.
- `drill:pp-timed-turn-no-DG` -- learner flies timed turns to assigned headings using the magnetic compass plus stopwatch, holding altitude within 100 ft.

### Back-of-envelope calculations

**Calculation 1: timed turn at standard rate.**

Standard rate is 3 deg/sec. To turn from 360 to 090 (east):

```text
heading change = 90 deg
time = 90 / 3 = 30 seconds
```

Roll to a bank that produces standard-rate turn (turn coordinator showing the standard-rate index, typically L or R triangle). For a C172, that is roughly 17 degrees of bank at 100 KIAS. Hold for 30 seconds. Roll out.

**Calculation 2: partial-panel pitch attitude for level cruise.**

C172 at 100 KIAS cruise, 2,400 RPM:

- Pitch attitude on AI: roughly 0 deg (cowling on horizon).
- Without AI: 100 KIAS at 2,400 RPM with altimeter steady = level. Reference is power + airspeed = attitude.

If altitude starts to fall while airspeed climbs, you are nose-low. If altitude rises while airspeed falls, you are nose-up. Apply 1-2 deg pitch correction by control feel and re-stabilise.

**Calculation 3: alternate static correction (typical light single).**

POH typical correction at 6,000 MSL:

- Indicated airspeed reads roughly 4-8 KIAS high with alternate static.
- Altimeter reads roughly 50-100 feet high with alternate static.

Apply both: subtract 5 KIAS from indicated, subtract 75 feet from indicated altimeter. Cross-check against ATC altitude assignments and request altimeter setting.

POH numbers override these illustrative figures.

## Connect

### What changes if...

- **...you have an electric backup AI?** AC 91-75 increasingly common. Backup AI on a separate bus / battery means partial-panel of vacuum failure is much less hostile -- you still have an attitude reference. Glass cockpits with reversionary mode on a second display do similar work.
- **...you are flying glass (G1000 / Avidyne)?** ADAHRS failure cascades differently. A single-display airplane reverts to backup AI; a dual-display airplane reverts to the surviving display. The cross-check is between primary and backup. The IMC-emergency framing is the same.
- **...you are in VMC?** Partial panel is much easier; you have the horizon. Use it. Continue VFR; land at the nearest airport with a mechanic.
- **...the failure happened during an approach?** Default is to go missed and accept vectors. Continuing a non-precision approach partial-panel is checkride-territory; in real IMC at minimums, the workload is severe and the missed is the safer choice unless terrain or fuel preclude it.
- **...both vacuum AI and electric backup AI fail?** Compound failure. You are in serious trouble in IMC. Declare immediately, request vectors out of cloud, fly the airplane on partial panel from the surviving instruments, and accept whatever altitude / heading deviations it takes to stay upright.
- **...the autopilot was on when the AI failed?** Some autopilots reference AI directly and will follow the failed instrument into an unusual attitude. Some have independent attitude sources. Know your specific autopilot's behavior. Default to disconnect at the first sign of disagreement.
- **...you are at the end of a long flight, tired, in night IMC?** Workload tolerance is much lower. Set the bar lower for declaring; ATC vectors are cheap.

### Links

- `proc-instrument-cross-check` -- the scan that detects the failure. Without a working cross-check, partial panel is undetected partial panel until the airplane is in an unusual attitude.
- `proc-pitot-static-failures` -- the airspeed/altimeter/VSI failure family. Distinct from vacuum but coupled to partial-panel decision-making.
- `proc-alternate-static-source` -- the procedural fix for static block.
- `proc-unusual-attitude-recovery` -- the failure mode that develops if partial panel is unmanaged. The AI lying about wings level until the airplane is in 60 degrees of bank is the canonical lead-in to a real-IMC unusual attitude.
- `proc-spatial-disorientation` -- without working AI, the pilot's body provides false attitude cues. Partial-panel discipline is also disorientation discipline.
- `proc-180-degree-turn` -- if an instrument failure happens on a marginal-VFR-into-IMC inadvertent flight, the 180 may be the way out.
- `nav-localiser-and-glide-slope-tracking` -- partial-panel ILS is the harder-than-checkride exercise. Vectoring to a non-precision approach is usually preferable in real IMC.
- `nav-marker-beacon-recognition` -- on partial panel, every workload-reducing cue helps. The OM/MM beep tells you where you are without map work.

## Verify

### Novel scenario (narrative)

> You are at 7,000 in IMC, hand-flying, on a victor airway. Your flight has been routine. As you scan, the attitude indicator shows wings level and slight nose-up; the turn coordinator shows a half-needle right turn; the DG is rotating slowly to the right; the magnetic compass is also indicating a right turn; airspeed is steady at 110 KIAS; altimeter shows you have lost 200 feet in the last minute; VSI shows 200 fpm down. ATC has not called.
>
> Diagnose what has failed and what you do in the next 60 seconds, in order.

Scoring rubric:

- Identifies the AI as failed: it shows wings level and slight nose-up while three other instruments (TC, DG, compass) show a right turn and the altimeter shows descent. (3)
- Covers the AI immediately. (1)
- Levels wings using turn coordinator. (2)
- Pitches up to stop the descent (control feel + altimeter rate + airspeed dropping back from 110). (2)
- Calls ATC: "Center, Cessna 12345, partial panel, lost attitude indicator, declaring emergency, request vectors to nearest VMC." (2)
- Accepts ATC vectors and altitude assignment. (1)
- Continues partial-panel scan; does not get drawn back to the failed AI. (2)
- Plans the approach: nearest field with a non-precision approach the pilot has flown before; if VMC closer, vectors there. (2)

15/15 is the bar. Below 11 is a redo.

### Teaching exercise (CFI)

> An instrument-rating candidate is flying a partial-panel non-precision approach in the simulator. They are correctly maintaining altitude on the FAF-to-MAP segment, but their heading is drifting 5-10 degrees right of course. They are using the DG (which is failed and they have correctly identified) and not cross-referencing the magnetic compass.
>
> Write the in-flight cue you give and the post-flight teaching point. The cue must be short enough to land in their working memory without breaking the scan.

Evaluation criteria:

- The cue is one sentence: "Compass."
- The post-flight teaching point names the trap: "You identified the DG as failed but you kept reading it. The DG is on the panel and the eye returns to it; the compass is small and below the panel and the eye does not. Cover the DG; then your eye finds the compass on its own."
- The exercise the CFII assigns: hood time with the DG covered (literal sticky note) for the next 30 minutes of the lesson, including timed turns and an approach.
- The CFII uses the moment as a partial-panel discipline lesson, not a competence rebuke; the candidate did identify the failure correctly, they just did not commit to the rebuilt scan.
- The candidate leaves the lesson with a physical artifact (a sticky note, a piece of cockpit tape) to keep in their iPad case for real-world use.
