---
# === Identity ===
id: proc-collision-avoidance
title: Collision Avoidance and See-and-Avoid
domain: procedures
cross_domains:
  - adm-human-factors
  - regulations

# === Knowledge character ===
# perceptual: scanning is the central skill -- where the eyes go, how long
#   they dwell, how head movement defeats the cabin posts.
# procedural: the right-of-way rules in 14 CFR 91.113 are non-negotiable
#   procedure once a conflict is identified.
# judgment: a target the size of a paperclip at arm's length on the
#   windshield, not moving relative to your reference point, is on a
#   collision course. Recognising "no relative motion = closing" before
#   the target grows is the survival skill.
knowledge_types:
  - perceptual
  - procedural
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - proc-clear-the-area
  - proc-traffic-pattern
taught_by: []
related:
  - proc-attention-management
  - proc-clear-the-area
  - proc-traffic-pattern

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
estimated_time_minutes: 30
review_time_minutes: 5

# === References ===
references:
  - source: 14 CFR 91.113
    detail: Right-of-way rules -- except water operations
    note: >-
      The legal framework: balloon, glider, airship, airplane order; head-on
      both turn right; converging slower has right-of-way; overtaking gives
      way; aircraft on final has right-of-way over aircraft in the pattern.
  - source: AC 90-48
    detail: Pilots' Role in Collision Avoidance
    note: >-
      The canonical guidance on visual scanning, time-sharing, blind-spot
      awareness, the geometry of constant relative bearing, and the
      cockpit / external collision-avoidance practices.
  - source: AIM
    detail: 4-4-15 -- Pilots' Visual Responsibility, 8-1-6 -- Vision in Flight
    note: >-
      Operational guidance on scan technique, off-center vision at night,
      target detection limits, and the responsibility to see and avoid
      regardless of ATC services.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge -- Aeromedical Factors
    note: >-
      Foveal-vision physiology, peripheral motion detection, and the
      effects of fatigue and hypoxia on scanning effectiveness.

# === Assessment ===
assessable: true
assessment_methods:
  - scenario
  - recall
mastery_criteria: >-
  Learner can: (1) state the constant-bearing collision rule (target with
  no relative motion is on a collision course); (2) describe the sector
  scan with foveal dwell (1-2 seconds per sector across 60-90 degree
  sweeps); (3) cite the right-of-way rules from 14 CFR 91.113 for head-on,
  converging, and overtaking situations; (4) name three blind spots in
  their training airplane and the head-and-eye movement that defeats each;
  (5) explain why "see and avoid" remains primary even with TIS / ADS-B
  In / flight following.
---

# Collision Avoidance and See-and-Avoid

## Context

Two airplanes on a collision course do not look like they are approaching each other. They look like they are sitting still on each other's windshield. The closing geometry that produces a midair is exactly the geometry that produces no relative motion: both pilots see a stationary speck that does not grow until the last few seconds, when it goes from invisible to filling the windshield.

This is the visual signature of every collision. It is also the signature of "I do not see anything; we are clear." A pilot who scans for moving targets misses the only target that matters.

The job of see-and-avoid is to detect the not-moving target before its visual angle grows large enough that recognition produces no useful response time. That requires a deliberate, sector-by-sector scan, head-and-eyes-together, with foveal dwell. It is the most underrated cockpit skill -- because when it works, nothing happens.

## Problem

You are at 4,500 MSL on a 270-degree heading in cruise. You see a small dark speck on your windshield, slightly above the horizon, about 2 inches to the right of your nose reference. You watch it for 30 seconds. It has not moved relative to the windshield reference. Its size has approximately doubled.

What is happening? What is your action plan in the next 30 seconds?

Write your answer before reading on. Then ask: how would the picture change if the target were moving 1 inch to the right of the reference per minute?

## Discover

### Q1. What is the collision geometry?

Two airplanes on a collision course converge at a constant relative bearing. From the cockpit of either airplane, the other appears at the same point on the windshield from the moment they become detectable until the moment of impact. The target does not drift left, right, up, or down. It only grows.

The math: if airplane A and airplane B are on a collision course, the line of sight between them is rotating at a constant rate (which becomes "constant" relative to A's heading because A's velocity vector is also constant). From A's frame of reference, B's bearing is fixed.

The implication: a target that is moving across your windshield is not on a collision course with you. A target that is fixed on your windshield is. This is the inverse of intuition; pilots instinctively look for movement, but the dangerous target is the still one.

### Q2. How does target growth work?

Visual angle subtended by an aircraft of size S at distance D is roughly:

```text
angle (radians) = S / D
```

For a 30-foot wingspan airplane at 5 NM (30,000 ft):

```text
angle = 30 / 30000 = 0.001 rad ≈ 0.057° ≈ 3.4 arc-minutes
```

The human eye can resolve roughly 1 arc-minute under ideal conditions. So the airplane is barely visible at 5 NM as a speck.

At 1 NM (6,000 ft), angle = 0.005 rad ≈ 17 arc-minutes. Now clearly visible as a small shape.

At 0.25 NM (1,500 ft), angle = 0.02 rad ≈ 1.1°. Now obviously an airplane.

At 0.1 NM (600 ft), angle = 0.05 rad ≈ 2.9°. Filling a noticeable area of the windshield.

The dangerous fact: the target spends most of its detectable life as a barely-visible speck, then grows from "speck" to "filling the windshield" in the last 10-15 seconds of closure. If you do not see it as a speck, you may not see it in time as a recognisable airplane.

### Q3. Why does foveal vision matter so much?

The fovea -- the small central area of the retina with high cone density -- is the only part of the eye that resolves small distant targets. Outside the fovea, peripheral vision is excellent at motion detection but poor at spatial resolution. A speck at 5 NM is invisible in peripheral vision; you must look directly at it.

Foveal vision covers about 1 degree. The total visual field of one eye is about 120 degrees (combined: about 200 degrees). To examine the entire forward hemisphere, the eye must move sector by sector, dwelling on each sector long enough for the fovea to detect a small target (1-2 seconds), then move to the next.

A continuous sweep -- eyes moving smoothly across the windshield -- gives the fovea no time to detect anything small. The fovea must dwell.

### Q4. What is the standard scan pattern?

AC 90-48 describes a sector scan: divide the visible windshield into roughly 30-degree sectors, dwell on each sector for 1-2 seconds, move to the next sector with a deliberate eye saccade.

A typical pattern for an arc 60 degrees left to 60 degrees right:

```text
sector 1: 60L  -- dwell 1-2 sec
sector 2: 30L  -- dwell 1-2 sec
sector 3: 0    -- dwell 1-2 sec
sector 4: 30R  -- dwell 1-2 sec
sector 5: 60R  -- dwell 1-2 sec

Total scan time: ~10 seconds
Repeat continuously
```

A complete scan also includes high (above the horizon) and low (below the horizon). And the cabin-post sectors require head movement, not just eye movement.

### Q5. What are the right-of-way rules from 14 CFR 91.113?

The legal framework when two aircraft are converging:

- **Distress** -- aircraft in distress has right-of-way over all other air traffic.
- **Category** -- balloon, glider, airship, airplane (in that order). The lower category has right-of-way.
- **Converging at the same altitude** -- the aircraft to the other's right has right-of-way.
- **Approaching head-on** -- both aircraft alter course to the right.
- **Overtaking** -- the slower aircraft has right-of-way; overtaking aircraft passes well clear on the right.
- **Landing** -- aircraft on final approach has right-of-way over aircraft in the pattern; lower altitude has right-of-way over higher altitude when approaching to land (with an exception: the higher aircraft cannot cut in front).

Knowing the rules does not absolve you of seeing the conflict. The legal right-of-way is meaningless if both pilots are in the wreckage.

### Q6. What are the blind spots?

Every airframe creates blind spots. Common ones:

- **High-wing (Cessna):** lateral above sector during turns; forward-up around the wing root.
- **Low-wing (Piper):** lateral below sector during turns; forward-down around the wing root.
- **All:** cabin posts (A-pillars at the windshield edge); the cowling forward-down; the headrest behind.
- **Tandem (T-6, gliders):** the seat in front of you blocks forward.

Defeating blind spots requires head movement. Move your head left to look around the right cabin post. Lift a wing to expose what was hidden. Periodically wing-rock to expose the area directly behind.

### Q7. Why is "see and avoid" still primary?

Even with TIS, ADS-B In, traffic advisories from ATC (flight following), and TCAS-equipped aircraft, the regulatory and practical primary is the pilot's eyes. Reasons:

- **Coverage** -- not all aircraft transmit position. Gliders, balloons, ultralights, no-electrical-system aircraft are invisible to ADS-B.
- **Latency** -- traffic systems update at intervals (1-2 seconds typical for ADS-B); the actual visual conflict can develop faster.
- **Workload** -- looking at a traffic display is a head-down task; the speck on your windshield is the head-up reality.
- **Reliability** -- electronics fail. Eyes in the cockpit do not.

Use traffic services as a cue ("there should be traffic 12 o'clock 1 mile") that drives your visual scan to the right place. Do not substitute the display for the scan.

### Q8. What is the recovery action when you see a conflict?

Three rules of thumb:

1. **Visual contact first.** If you see the other airplane, you can see what they are doing. Make a definitive course-and-altitude change to clear them.
2. **Predictable maneuvers.** Turn right (per 91.113 head-on rule). Climb or descend by 500-1,000 feet. Make the maneuver visible to the other pilot.
3. **Communicate if able.** If you have the frequency and time, tell ATC or the other pilot. Communication is third-priority, not first.

Do not freeze. Do not assume the other pilot sees you. Do not split-the-difference (both turning the same direction is the canonical midair geometry).

### What Discover should have led you to

- Constant relative bearing is the collision signature. No motion = closing.
- Targets grow non-linearly; the last 10-15 seconds account for most of the visible growth.
- Foveal vision detects small targets only with deliberate sector-by-sector dwell.
- 14 CFR 91.113 governs right-of-way; head-on both turn right.
- Blind spots are airplane-specific; defeat with head and wing movement.
- ADS-B and TIS supplement the scan; they do not replace it.
- Recovery is visible, predictable, and definitive -- never split-the-difference.

## Reveal

### The summary rule

> Scan the sky in deliberate sectors with 1-2 seconds of foveal dwell per sector, head-and-eyes-together, including high and low. The collision target is the speck that does not move on your windshield -- detect it before it grows. Defeat blind spots with head movement and wing-lifting. Apply 14 CFR 91.113 right-of-way rules: head-on, both turn right; converging, the aircraft to the right has it; overtaking gives way. Treat ADS-B / TIS as a cue to drive your visual scan, never as a substitute. When you see a conflict, make a definitive, visible, predictable maneuver -- altitude change of 500+ feet or a clear turn. Never split-the-difference; the canonical midair is both pilots turning the same way.

### The scan pattern

```text
Sector scan, dwell 1-2 seconds per sector:

       (high sectors)
      \  |  /
       \ | /
60L --- 30L --- 0 --- 30R --- 60R
       / | \
      /  |  \
       (low sectors)

Add: head-rotation to clear cabin posts
Add: wing-lift to clear blind spots
Cycle time: 10-15 seconds per complete scan
Time-share with cockpit: 80% outside, 20% inside (cruise)
                          50/50 (maneuvering)
```

### The right-of-way rules (14 CFR 91.113)

| Situation                    | Rule                                             |
| ---------------------------- | ------------------------------------------------ |
| Aircraft in distress         | Has right-of-way over all                        |
| Different category           | Balloon > glider > airship > airplane            |
| Converging same altitude     | Aircraft to the right has right-of-way           |
| Head-on                      | Both alter course to the right                   |
| Overtaking                   | Slower aircraft has right-of-way; overtake right |
| Landing                      | Aircraft on final has right-of-way               |
| Two on final, different alt. | Lower altitude has right-of-way (no cutting in)  |

### Blind-spot defeat (general)

| Airframe        | Blind spot during right turn   | Defeat                               |
| --------------- | ------------------------------ | ------------------------------------ |
| High-wing (172) | Upper-right (wing covers)      | Lift wing momentarily                |
| Low-wing (PA28) | Lower-right (wing covers)      | Bank slightly left; lower nose       |
| Any             | Behind cabin posts             | Move head, not just eyes             |
| Any             | Directly behind                | Periodic 90/90 clearing or wing-rock |
| Any             | Forward-down (cowling/spinner) | Less critical except final           |

### What is actually authoritative

In descending order:

1. **14 CFR 91.113** -- right-of-way rules (legal floor).
2. **AC 90-48** -- Pilots' Role in Collision Avoidance (the canonical scanning guidance).
3. **AIM 4-4-15 and 8-1-6** -- visual responsibility and vision in flight.
4. **PHAK Aeromedical chapter** -- foveal vision, peripheral motion detection.

## Practice

### Cards (spaced memory items)

- `card:ca-constant-bearing` -- "What is the visual signature of a collision course?" -> "Target with constant relative bearing -- no movement on the windshield, only growth."
- `card:ca-foveal-dwell` -- "How long should the eye dwell on each scan sector?" -> "1-2 seconds, to give the fovea time to detect a small target."
- `card:ca-91-113-headon` -- "Two aircraft head-on -- who turns?" -> "Both turn right (14 CFR 91.113)."
- `card:ca-91-113-converging` -- "Two aircraft converging at the same altitude -- who has right-of-way?" -> "The aircraft to the right."
- `card:ca-91-113-overtaking` -- "Overtaking aircraft -- who has right-of-way?" -> "The slower aircraft. Overtake on the right."
- `card:ca-blind-spot-high-wing` -- "Worst blind spot in a high-wing airplane during a right bank?" -> "Upper-right (wing); lift the wing to expose."
- `card:ca-traffic-display` -- "Why is ADS-B not a substitute for see-and-avoid?" -> "Coverage gaps (no-electrical traffic), latency, workload, reliability."

### Reps (scenario IDs)

- `scenario:ca-constant-bearing-detect` -- pilot sees a speck on windshield; verifies relative motion or lack thereof; takes action.
- `scenario:ca-converging-altitude` -- two airplanes at same altitude on converging tracks; pilot identifies right-of-way and takes the correct maneuver.
- `scenario:ca-overtaking` -- faster aircraft overtaking; pilot identifies overtake-on-right and clears.
- `scenario:ca-pattern-conflict` -- on final, another aircraft cuts in from base; pilot applies 91.113 final-priority rule plus go-around decision.
- `scenario:ca-night-scan` -- night cross-country; pilot demonstrates off-center scanning to defeat the night foveal blind spot.

### Drills (time-pressured)

- `drill:ca-91-113-recall` -- given a conflict scenario, pilot states the rule and the correct action in 5 seconds.
- `drill:ca-scan-tempo` -- CFI watches pilot's eyes for 30 seconds; pilot must demonstrate sector-by-sector dwell, not continuous sweep.
- `drill:ca-blind-spot-name` -- given an airplane and a turn direction, pilot names the blind spot and the defeat technique.

## Connect

### What changes if...

- **...you are at night?** Foveal cones are inactive in low light; rod-rich peripheral vision dominates. Look slightly off-center -- 5 to 10 degrees off the target -- to use the rod-rich area. Direct stare at a faint target makes it disappear.
- **...you are in IMC?** No visual scan is possible. ATC separation is your collision avoidance. Maintain assigned altitude and route precisely; ATC's vertical and lateral separation depends on it.
- **...you have ADS-B In?** Use it as a cue, not a substitute. When the display shows traffic, drive your eyes to that direction. When the display is clear, do not assume the sky is clear -- there are non-equipped aircraft.
- **...you have flight following?** ATC may call traffic. Acknowledge ("looking" or "in sight"). If you do not see it, say so; ATC may give you a vector or altitude change.
- **...you are doing aerobatics?** The maneuver area should be clear before entry; once aerobatic, you have no ability to scan. Pre-clear is the entire defense.
- **...you are in a traffic pattern?** The closing geometry is constrained by the pattern shape. Watch for non-standard entries (straight-ins, overheads). The biggest pattern hazard is the unannounced straight-in conflicting with you on base or final.

### Links

- `proc-clear-the-area` -- the pre-maneuver scan is the same skill compressed into 30 seconds before a maneuver.
- `proc-attention-management` -- the outside-for-traffic channel of the scan rotation.
- `proc-traffic-pattern` -- where collision avoidance is tested under real traffic load.
- `aero-load-factor-and-bank-angle` -- because a steep turn is a collision-avoidance maneuver if you spot traffic late.

## Verify

### Novel scenario (narrative)

> You are at 5,500 MSL westbound on a cross-country, with flight following. The controller calls "Cessna 12345, traffic 11 o'clock, 2 miles, opposite direction, indicating 5,500." You acknowledge. You scan 11 o'clock and see a small dark target slightly above the horizon, not moving relative to your windshield reference. Walk through your action plan in the next 30 seconds.

Scoring rubric:

- Identifies the constant relative bearing as the collision signature. (3)
- Recognises that "indicating 5,500" plus your 5,500 means co-altitude conflict if course doesn't change. (2)
- Per 14 CFR 91.113 head-on rule, executes a right turn (or descent). (2)
- Calls ATC: "Cessna 12345, traffic in sight, descending to 4,500 to clear." (1)
- Maintains visual contact through the resolution. (1)
- Verifies altitude separation has been established before resuming course. (1)

10/10 is the bar. Below 7 is a redo.

### Teaching exercise (CFI)

> A student is scanning continuously, sweeping their eyes across the windshield in smooth left-to-right and right-to-left motion. Their eyes never stop. Diagnose and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: continuous sweeping defeats foveal detection of small distant targets. The student is "scanning" without actually seeing.
- Teaching point: the eye must dwell. Sector by sector, 1-2 seconds each. The motion between sectors should be a deliberate saccade, not a smooth pursuit.
- Drill: have the student count out loud during the scan ("one-two, one-two") with their eyes moving only on the count. Build the saccade habit.
- Progression: hide a small object on the windshield (a piece of tape) and have the student detect it during a normal scan. Verifies the foveal dwell is actually working.
- The CFI is direct: the airplane that hits you will be the one you swept past without dwelling.

The pedagogical move is to make the discrete saccade visible as a deliberate motion, not a continuous one. Most students confuse "looking around" with "scanning."
