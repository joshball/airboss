---
# === Identity ===
id: nav-localiser-and-glide-slope-tracking
title: Localiser and Glide Slope Tracking
domain: ifr-procedures
cross_domains:
  - aircraft-systems

# === Knowledge character ===
# procedural: there is a standardised way to fly an ILS -- intercept the
#   localiser at the assigned heading, capture, configure for descent,
#   intercept the glide slope, manage power and pitch through the
#   approach to DA.
# perceptual: needles indicate course deviation; rate-of-deviation
#   reading is a learned skill. Bracketing the needles in wind drift
#   takes practice.
# judgment: when do you go missed, when do you tighten the correction,
#   when do you accept a slight deviation? ILS minimums are unforgiving.
knowledge_types:
  - procedural
  - perceptual
  - judgment
technical_depth: working
stability: evolving
# Stability is "evolving" because LPV approaches and other RNAV-based
# procedures are progressively replacing localiser-only procedures at
# many airports. The tracking principles transfer; the radio receiver
# and ILS specifically are slowly being supplemented and replaced.

# === Cert + study priority ===
minimum_cert: instrument
study_priority: critical
requires:
  - nav-instrument-approach-structure
  - proc-instrument-cross-check
deepens: []
applied_by: []
taught_by: []
related:
  - nav-marker-beacon-recognition
  - nav-vor-tracking
  - nav-missed-approach-procedure

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
  - source: Instrument Procedures Handbook (FAA-H-8083-16B)
    detail: Chapter 4 -- Approaches; ILS specifically
    note: >-
      Authoritative on the ILS approach structure: localiser, glide
      slope, marker beacons (where present), categorisation (CAT I,
      II, III).
  - source: AIM
    detail: 1-1-9 -- Instrument Landing System (ILS)
    note: >-
      ILS components, accuracy specifications, and operational
      considerations.
  - source: FAA Order 8260.3
    detail: ILS procedure design criteria (TERPS)
    note: >-
      The design spec; rarely consulted by line pilots but explains
      why the approach has the geometry it does.
  - source: ACS / PTS standards
    detail: Instrument rating practical test -- ILS approach task
    note: >-
      Tolerances: full deflection one-side allowed only briefly;
      candidate tracking within half-scale on localiser and glide
      slope is the standard.
  - source: POH / AFM
    detail: Approach configurations -- airspeed, flap, gear targets
    note: >-
      Aircraft-specific: ILS-stable configuration in your airplane
      (e.g., C172: 75 KIAS, gear (n/a), flaps 20 by FAF, full flaps
      at MAP visual or earlier).

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) identify the localiser and glide slope antennas
  on a typical ILS-equipped airport and explain their broadcast
  patterns; (2) describe localiser and glide slope sensitivity
  (~700 ft full-scale localiser at threshold; full-scale GS
  ~140 ft at FAF, ~25 ft at threshold for CAT I); (3) execute an
  ILS approach within ACS tolerances (half-scale needle deflection
  primarily, with brief excursions allowed); (4) recognise when
  to fly the missed (one-needle excursion past full deflection,
  loss of glide slope, weather below minimums); (5) explain the
  difference between LOC-only, LPV, and ILS, and how the tracking
  technique transfers; (6) at CFII level, diagnose a candidate's
  tracking failure (over-correcting, lagging needle, ignoring
  trend).
---

# Localiser and Glide Slope Tracking

## Context

The ILS is the single most important precision approach in aviation. It is the approach that most jet, turboprop, and IFR-rated GA pilots fly on a regular basis. Its design is elegant: two narrow radio beams cross in space, defining a final-approach corridor down to a runway threshold, and a third (the marker beacons in older installations) tells you when you have crossed defined fixes along the corridor. A pilot who is in the beams is in the corridor; a pilot who is out of the beams is somewhere else. There is no ambiguity, no interpretation, no judgment about position. The beams say where you are.

The beams are also more sensitive close to the runway than far away. A localiser needle that shows half-scale at 5 NM out represents about 1,000 feet of lateral offset; the same half-scale needle at 0.5 NM represents about 80 feet. The same is true vertically. As you fly down the approach, the same needle deflection means you are getting closer to going off the corridor in absolute terms. The discipline is to tighten the tolerance as you descend.

This node is about reading the needles, bracketing them in wind, knowing when to go missed, and (to a lesser extent) the equipment behind the indications. The receiver in the airplane decodes a 90 Hz / 150 Hz tone pair from the localiser ground station and a similar pair from the glide slope. The needle is a deflection signal, not a position signal -- it shows which way you should fly to recapture the course, not where you are in space.

LPV approaches (RNAV / GPS-based vertical guidance) increasingly supplement and replace ILS at many airports. The tracking technique is similar; the equipment differs. This node covers ILS specifically; LPV concepts overlap in `nav-gps-rnav-concepts`.

## Problem

You are vectored for the ILS to runway 17 at a Class D airport. ATC has cleared you for the ILS, gave you a heading of 110, and asked you to intercept the localiser. You are inbound at 4,000, configured for the approach, 110 KIAS, on autopilot heading mode. You see the localiser needle alive (deflecting from one side toward center) and the glide slope still parked above (you are below the GS). The intercept is at 4,000 MSL; the FAF is published at 3,000 MSL.

What is your sequence as you intercept the localiser? When do you start the descent? How do you watch for capture issues?

Write your answer before reading on. Then ask: what do you do if the localiser needle slews past center and pegs at full deflection on the other side?

## Discover

The ILS decomposes into geometry (the beams), equipment (the receiver), technique (bracketing), and judgment (when to go missed). Work through.

### Q1. What is the localiser, geometrically?

A narrow azimuth beam pointed up the runway from the far end. The beam is roughly 5 degrees wide at full scale (CDI deflection from center to peg). The beam centerline is the runway's extended centerline (with some installation-specific offset).

Mathematically: full-scale needle deflection at the threshold corresponds to about 700 feet either side. At 5 NM from threshold, the same full-scale corresponds to about 2,300 feet either side. So the beam IS narrowing as you approach -- in absolute terms, the corridor gets tighter.

Localiser broadcast frequency: 108-112 MHz (paired with the glide slope frequency).

### Q2. What is the glide slope, geometrically?

A vertical-plane beam pointed down the approach path from the far end of the runway, tilted upward at the published glide angle (typically 3 degrees, sometimes 2.5 to 3.5 depending on terrain). The beam is roughly 1.4 degrees thick at full scale.

At the FAF (typically 5-7 NM from threshold, intercepting at 1,500-3,000 AGL), full-scale GS deflection corresponds to about 50-150 feet vertically. At the threshold, full-scale corresponds to about 25 feet (CAT I).

Glide slope broadcast: 329-335 MHz, paired with localiser by ID.

### Q3. What does the needle actually mean?

The CDI (Course Deviation Indicator) shows deflection from beam center, not position. The needle deflects toward the side where you should fly to return to the beam. So:

- Needle right of center: fly right to return to beam.
- Needle left: fly left.
- Needle below center on GS: fly up to recapture.
- Needle above center on GS: fly down.

"Fly to the needle." If you are tracking and your needle deflects, fly slightly toward the needle to bring it back to center. Don't chase; brackets are smaller corrections than instinct suggests.

### Q4. How do you intercept the localiser?

Standard intercept: fly the assigned vector heading at the assigned altitude. The localiser will be alive (deflecting) from the deflected side toward center. As it approaches center:

1. Begin a turn to align with the localiser inbound heading. Lead the turn slightly (start when needle is one needle's width from center, not at center) to avoid overshooting.
2. Roll out on the localiser's published inbound course (or assigned heading; for an offset localiser, those differ).
3. Cross-check needle: is it tracking? If you overshot, you need a small correction back; if you undershot, you need to wait or correct gently.
4. Maintain assigned altitude until clearance for descent.

Do not begin the descent until you are stabilised on the localiser. A descent during an unstabilised intercept compounds errors.

### Q5. How do you intercept the glide slope?

The glide slope alive (needle deflecting from above to center) means you are approaching the GS. Typically this occurs at the FAF.

1. As GS needle approaches center (one needle's width from center), reduce power, configure for the approach descent (flaps, gear if applicable, target airspeed), and pitch slightly nose-down to begin descent.
2. Hold the pitch attitude and trim that produces ~500 fpm descent at your target speed.
3. Once on GS, small pitch corrections to maintain centered needle.

The descent is on glide slope; corrections are pitch-centric (assuming power is set to maintain airspeed). For each axis (LOC and GS), the airplane needs a primary control:

- Power: airspeed.
- Pitch: glide slope tracking.
- Bank: localiser tracking.

### Q6. How do you bracket in wind?

Wind drifts the airplane. Without correction, a crosswind blows you off the localiser. The bracket:

1. Note the wind direction (METAR / ATIS / forecast).
2. Initial intercept heading factors the crab automatically (ATC vector accounts for wind).
3. On the localiser, monitor needle drift. If the needle drifts left, wind is pushing you right; correct by turning slightly right of the inbound course (crab into wind).
4. The crab angle is small at long range and grows as the airplane gets closer (because the lateral excursion needed to keep needles centered is proportionally larger near the threshold).
5. On the GS, monitor descent rate. If wind shear is changing your descent profile, adjust power and pitch.

The skill is bracketing: a small, persistent crab held while monitoring needle stability. Avoid chasing the needle (small overshoots in both directions); lock in a heading offset and verify the needle stops drifting.

### Q7. When do you go missed?

Standard triggers:

- One needle (LOC or GS) past full-scale deflection at any time during the approach.
- Either needle approaching full-scale deflection in conditions where you cannot recover before DA.
- Loss of GS signal (red flag on the GS receiver / loss of GS warning).
- Weather below published minimums (visibility or RVR).
- Aircraft not stabilised by 1,000 AGL (general industry standard).
- Encountering go-around guidance: "Approach lights or runway environment in sight by DA" -- if not, missed.

Going missed is the safe choice. Continuing a non-stabilised approach into IMC is the unsafe choice.

### Q8. What is "stabilised" on the ILS?

Specific definitions vary by operator and airplane, but for a typical light single:

- On localiser within half-scale.
- On glide slope within half-scale.
- Configuration set: gear and flaps as required.
- Airspeed at target +/- 5 KIAS.
- Power set; descent rate stable.
- All of the above by 1,000 AGL.

If any one is not met by 1,000 AGL, go missed.

### What Discover should have led you to

- Localiser is a horizontal beam, glide slope is a vertical beam; both are sensitive at the runway and less sensitive farther out.
- The needle shows deflection (where to fly), not position.
- Intercept the localiser before glide slope; descend only when stabilised on LOC.
- Bracket in wind; small crab, hold, verify needle.
- Go missed at full-scale deflection, loss of signal, below minimums, or non-stabilised by 1,000 AGL.

## Reveal

### The summary rule

> ILS approach: intercept the localiser at assigned vector and altitude; lead the turn; roll out on inbound course. At the FAF / GS-alive, configure for descent and intercept glide slope. Pitch tracks GS; bank tracks LOC; power tracks airspeed. Bracket in wind with small crab corrections. Go missed if one needle pegs full-scale, GS signal is lost, weather is below minimums, or you are not stabilised by 1,000 AGL. CAT I ILS minimums are typically 200 feet HAT and 1/2 SM visibility.

### The ILS structure

```text
Runway threshold (RWY)
    |
    v---- localiser broadcast (108-112 MHz)
   /
  /        glide slope antenna
 /          broadcasts up the
/            approach path at
              ~3 deg
              (329-335 MHz)

Localiser beam:
   ~5 deg wide full-scale

Glide slope beam:
   ~1.4 deg thick full-scale

Marker beacons (older installations):
   OM (Outer Marker) ~5-7 NM from threshold (purple light, 400 Hz tone)
   MM (Middle Marker) ~3,500 ft from threshold (amber light, 1,300 Hz)
   IM (Inner Marker, CAT II/III only) (white light)
```

### The intercept and descent in detail

```text
1. ATC vector intercepting localiser at 30-45 deg.
2. Localiser alive (CDI deflecting). Lead the turn (one CDI needle's
   width from center).
3. Roll out on inbound course; verify CDI stable.
4. Maintain altitude assigned (typically published intercept altitude).
5. Glide slope alive (GS needle deflecting from above).
6. As GS needle approaches center, configure: flaps, gear (if RG),
   power reduction, target airspeed.
7. As GS needle centers, pitch nose-down slightly; trim; verify
   descent rate ~500 fpm at target speed.
8. Maintain LOC and GS centered with small bank and pitch corrections.
9. Bracket wind with small heading offset.
10. At DA, look outside: runway environment in sight = continue;
    not in sight = missed approach.
```

### Tolerance scaling

| Position from threshold | Full-scale LOC | Full-scale GS |
| ----------------------- | -------------- | ------------- |
| 5 NM                    | ~2,300 ft      | ~140 ft       |
| 1 NM                    | ~470 ft        | ~30 ft        |
| Threshold               | ~700 ft (special)| ~25 ft (CAT I)|

Half-scale at 5 NM: ~1,150 ft / 70 ft. Half-scale at 1 NM: ~235 ft / 15 ft.

The needle's meaning tightens as the airplane approaches the runway. A "minor" half-scale at 5 NM out is a major deviation by 1 NM out.

### Bracketing in wind -- specifics

Crosswind component on final affects localiser tracking. For a 10-knot crosswind at 90 KIAS:

- Crab angle = atan(10/90) = ~6.3 degrees.
- Heading offset from runway: 6.3 degrees into wind.

On the ILS at 90 KIAS in 10-kt crosswind, the airplane's heading is ~6 degrees off runway heading (crab) but ground track is on the localiser. CDI shows centered.

If wind shifts (gusts, frontal passage), the bracket must update. Pilots note CDI drift and re-bracket.

### CAT categories

| CAT | DA / DH         | Visibility / RVR              | Equipment                             |
| --- | --------------- | ----------------------------- | ------------------------------------- |
| I   | 200 ft HAT      | 1/2 SM (or 1,800 RVR)         | Standard ILS receiver, marker beacon  |
| II  | 100 ft HAT      | 1,200 RVR                     | Augmented; lower mins; specific equip |
| III | <100 ft HAT     | <1,200 RVR / 0 RVR (CAT IIIc) | Auto-land or fail-operational systems |

CAT II and III are airline / operator-specific. Most GA flies CAT I.

### Going missed

If approach is not stabilised, go missed. Specifically:

- Pitch up to climb attitude.
- Power: full or as published.
- Configure: gear up (if RG), flaps as required.
- Climb to published missed approach altitude.
- Fly the published missed approach course.
- Notify ATC.

Better to go missed unnecessarily than to land off-runway. The missed is forgiving; the unstabilised landing is not.

### What is actually authoritative

In descending order:

1. **The published approach plate** -- frequencies, courses, altitudes, FAF/MAP, missed approach procedure, minimums.
2. **AIM 1-1-9** -- ILS framework.
3. **IPH Chapter 4** -- approach procedures.
4. **POH Section 4** -- approach configurations.
5. **ACS task elements** -- candidate tolerances.

### location_skill

- Approach plates -- read every plate before the approach. Brief out loud.
- AIM 1-1-9 -- read once, all the way through.
- IPH Chapter 4 -- the FAA reference.
- Foreflight or Garmin Pilot for plate retrieval; verify against the FAA chart database.

## Practice

### Cards (spaced memory items)

- `card:ils-localiser-frequency" -- "Localiser broadcast frequency band?" -> "108-112 MHz."
- `card:ils-glide-slope-frequency" -- "Glide slope broadcast frequency band?" -> "329-335 MHz."
- `card:ils-needle-meaning" -- "What does CDI / GS needle deflection indicate?" -> "Direction to fly to recapture course (not position)."
- `card:ils-cat-i-mins" -- "Typical CAT I ILS minimums?" -> "200 ft HAT and 1/2 SM visibility (or 1,800 RVR)."
- `card:ils-stabilised-criteria" -- "Stabilised approach criteria?" -> "Half-scale on LOC and GS; configuration set; airspeed +/- 5; descent stable; all by 1,000 AGL."
- `card:ils-go-missed-trigger" -- "Triggers for missed approach?" -> "One needle full-scale deflection; loss of GS signal; weather below mins; not stabilised by 1,000 AGL; runway not in sight by DA."
- `card:ils-pitch-power-roles" -- "ILS axis-control assignments?" -> "Pitch -> GS; bank -> LOC; power -> airspeed."
- `card:ils-bracket-wind" -- "How to bracket the localiser in crosswind?" -> "Hold a small heading offset (crab) into wind; verify needle stops drifting; do not chase."
- `card:ils-loc-width" -- "Approximate localiser beam width full-scale?" -> "5 degrees wide; ~700 ft at threshold; ~2,300 ft at 5 NM."
- `card:ils-gs-thickness" -- "Approximate glide slope beam thickness full-scale?" -> "1.4 degrees; ~25 ft at threshold; ~140 ft at FAF."

### Reps (scenario IDs)

- `scenario:ils-vector-intercept" -- standard ATC vector for ILS; learner intercepts LOC then GS with proper sequencing.
- `scenario:ils-overshoot-localiser" -- learner intercepts at 45 degrees, fails to lead the turn, overshoots; must recover.
- `scenario:ils-crosswind-bracket" -- 15-knot crosswind on final; learner brackets and tracks centered.
- `scenario:ils-non-stabilised-by-1000" -- approach not stabilised at 1,000 AGL; learner goes missed.
- `scenario:ils-gs-signal-loss" -- glide slope flag appears at 800 AGL; learner goes missed.
- `scenario:ils-partial-panel" -- AI failed during ILS; learner flies the approach on partial panel using HSI / DG and pitch+power.

### Drills (time-pressured)

- `drill:ils-intercept-and-track" -- 5 simulated approaches; rated on intercept smoothness, half-scale tracking, and stabilised criteria.
- `drill:ils-go-around-decision" -- learner is shown approach scenarios; identifies which warrant missed approach in 5 seconds.
- `drill:ils-bracket-corrections" -- in simulator with shifting wind, learner brackets needle drift and verbalises each correction.

### Back-of-envelope calculations

**Calculation 1: glide slope descent rate.**

3-degree GS at 90 KIAS ground speed:

```text
Descent rate (fpm) = ground_speed (kt) * 5.16
                   ≈ 90 * 5.16
                   ≈ 465 fpm
```

(The 5.16 factor approximates feet-per-NM at 3-degree slope, divided by minute-per-NM.)

For 80 KIAS: 413 fpm.
For 110 KIAS: 568 fpm.

Higher ground speeds require steeper descent (more fpm). Pilots compute target VSI at typical ground speeds for their airplane.

**Calculation 2: bracket angle for 10-kt crosswind at 90 KIAS.**

```text
crab_angle = atan(crosswind / TAS)
           = atan(10 / 90)
           = ~6.3 degrees
```

Heading offset 6.3 degrees into wind keeps ground track aligned with localiser.

For 20-kt crosswind: ~12.5 degrees crab. Significant; airplane visually appears to be flying sideways.

**Calculation 3: needle deflection meaning at threshold vs. FAF.**

C172 ILS at 90 KIAS:
- FAF at 1,800 AGL, 5 NM from threshold.
- Threshold at 50 AGL (TCH).

Half-scale LOC at FAF: ~1,150 ft lateral.
Half-scale LOC at threshold: ~350 ft lateral.

Half-scale GS at FAF: ~70 ft vertical.
Half-scale GS at threshold: ~12 ft vertical.

The 70-foot deviation at FAF that you tolerated becomes a 12-foot deviation at threshold -- but the same needle position. A pilot who lets the GS sag half-scale at FAF is fine; lets it sag half-scale at threshold lands short.

## Connect

### What changes if...

- **...you are flying a glass cockpit?** PFD has integrated CDI / GS. Often easier to read. Same principles.
- **...you are flying an LPV?** RNAV-based vertical guidance via WAAS. Tracking is similar; the receiver is a GPS unit, not an ILS receiver. Sensitivity scales similarly. CDI / GP needles work the same way.
- **...you are using autopilot in approach mode?** AP captures and tracks LOC and GS. Pilot monitors. AP can fail; pilot must be ready to intervene. Disconnect at DA to flare manually (light singles); some autopilots couple through landing in transport-category aircraft.
- **...the approach is offset?** Some localisers offset from runway centerline (typically 3-5 degrees) due to terrain or buildings. Localiser inbound course differs from runway heading; circle-to-land may be required.
- **...you are doing a circling approach?** Localiser tracks the inbound course; once below MDA visual, you circle for a different runway. See `nav-circling-approach`.
- **...the airplane is partial-panel?** ILS on partial panel is harder than checkride; in real IMC, often go missed and request a non-precision approach if available. See `nav-partial-panel`.
- **...you encounter wind shear on final?** Shear can blow you off LOC or GS in seconds. Aggressively bracket; if shear is severe, go missed.
- **...the runway lighting is out?** ILS continues; you may not see the runway at DA. Missed approach.

### Links

- `nav-instrument-approach-structure` -- the parent IFR-approach knowledge.
- `nav-marker-beacon-recognition` -- marker beacons confirm position along the approach.
- `nav-vor-tracking` -- the conceptual cousin; VOR is similar in needle-deflection logic, less precise.
- `nav-missed-approach-procedure` -- what you do after deciding to go missed.
- `proc-instrument-cross-check` -- the scan that supports the ILS in IMC.
- `nav-partial-panel` -- the ILS becomes much harder partial panel.

## Verify

### Novel scenario (narrative)

> You are vectored for the ILS to runway 35L at a Class B airport. Cleared for the approach at 4,000 with intercept at 070 heading. Your airplane is configured: 90 KIAS, 10 flaps, gear (n/a -- C172). You see localiser alive at 5 NM. ATC issues a 30-degree intercept heading and clears you for the approach. Wind is 320 at 12 (right crosswind on final).
>
> Walk through the next 5 minutes: intercept, descent, tracking, decision at minimums.

Scoring rubric:

- Acknowledges the wind: 12 kt right crosswind on a 350 final is a ~7 degree crab. (1)
- Leads the localiser turn (one needle's width before center). (2)
- Rolls out on inbound course; cross-checks CDI and DG. (1)
- Notes the bracket: crab to the right of inbound course. (2)
- At GS alive, configures: 75 KIAS, full flaps as appropriate, power reduction. (2)
- Pitches into the descent at GS center; verifies VSI ~450-500 fpm at 80 ground speed. (2)
- Cross-checks: airspeed 75, on LOC and GS, descent rate stable. (1)
- Brackets the LOC throughout descent; small heading adjustments. (2)
- At 1,000 AGL, verifies stabilised criteria: half-scale, configuration set, airspeed +/- 5, descent stable. (2)
- At DA (200 AGL): runway environment in sight = continue; not in sight = missed. (2)
- After landing: documents the approach; self-debriefs the bracket and any deviations. (1)

18/18 is the bar. Below 13 is a redo.

### Teaching exercise (CFII)

> An instrument-rating candidate is flying an ILS in the simulator. They consistently track the localiser well but consistently let the glide slope sag below half-scale low between the FAF and DA. Their power management is fine; their pitch attitude is "about right" but they are not actively correcting GS deviation.
>
> Diagnose and write the in-flight cue plus the post-flight teaching point.

Evaluation criteria:

- Diagnosis: candidate is treating GS as a "set and forget" axis; they pitched into descent at FAF and have not adjusted since. The GS is drifting because (a) wind, (b) airspeed change, or (c) imprecise initial pitch.
- In-flight cue: short, e.g., "GS." or "Pitch."
- Post-flight teaching point: GS is an active control axis, not a set-and-forget. Pitch corrections every 10-15 seconds during descent are normal. Sagging below GS means not enough pitch up; pull slightly to bring GS back to center.
- Drill assigned: 5 ILS approaches with explicit verbalisation: "GS, on; LOC, on; airspeed, 75; descent rate, 500." Repeat every 10 seconds during descent. Builds the active GS-monitoring habit.
- The CFII names the trap: many candidates conflate "stable" with "ignored." Stable means actively maintained, not left alone.

The pedagogical move is to convert GS from a passive reference (pitch was set, now forgotten) into an active control axis. The candidate's hands are good; their attention is elsewhere.
