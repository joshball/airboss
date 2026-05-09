---
# === Identity ===
id: proc-clear-the-area
title: Clearing the Area Before Maneuvers
domain: procedures
cross_domains:
  - adm-human-factors

# === Knowledge character ===
# procedural: there is a standard pre-maneuver sequence: pick a maneuvering
#   altitude, select an entry heading, scan high-low-high through 180 degrees
#   in each direction with a clearing turn, only then enter the maneuver.
# perceptual: the actual scan -- where the eyes go, how long they dwell,
#   what blind spots a high-wing or low-wing creates -- is a learned skill
#   that takes deliberate practice.
# judgment: when do you reject a maneuver area entirely? Power lines below.
#   Mountains in the windward direction. A faster aircraft already practising
#   in your altitude block. The judgment to leave is more important than the
#   procedure to clear.
knowledge_types:
  - procedural
  - perceptual
  - judgment
technical_depth: working
stability: stable

# === Cert + study priority ===
minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by: []
taught_by: []
related:
  - proc-collision-avoidance
  - proc-attention-management
  - proc-traffic-pattern

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 20
review_time_minutes: 4

# === References ===
references:
  - source: FAA-H-8083-3
    detail: Airplane Flying Handbook -- Performance Maneuvers
    note: >-
      Calls out clearing turns and the requirement to clear the airspace
      before commencing any maneuver that involves changes in altitude,
      attitude, or heading.
  - source: AC 90-48
    detail: Pilots' Role in Collision Avoidance
    note: >-
      The canonical guidance on visual scanning techniques, blind spots
      created by aircraft structure, and the time-on-each-sector scan
      methodology.
  - source: AIM
    detail: 8-1-6 -- Vision in Flight (scanning for other aircraft)
    note: >-
      Off-center vision, scan sectors, the limitation that the human eye
      sees a small target only when looking directly at it.

# === Assessment ===
assessable: true
assessment_methods:
  - demonstration
  - recall
mastery_criteria: >-
  Learner can: (1) describe the standard clearing-turn procedure (two
  90-degree turns, or one 180, with high-low-high scan in both directions);
  (2) name the blind spots their training airplane creates (high-wing
  blocks lateral above; low-wing blocks lateral below; cabin posts block
  fixed sectors); (3) state the high-low-high scan rationale (different
  altitude blocks demand separate sweeps); (4) describe one situation in
  which they would reject a maneuver area and look for another.
---

# Clearing the Area Before Maneuvers

## Context

You are about to enter a 360-degree steep turn at 3,500 MSL. For the next 60 seconds, you will be turning continuously, your nose dropping in and out of every quadrant of the sky. Anywhere you look, the airplane will eventually be a few seconds later.

If another airplane is at 3,500 MSL within a mile or two of your position, you are about to drive through their airspace -- and they through yours -- without the geometry that makes a head-on conflict resolvable. You may not see each other until the closing speed has eaten the margin.

This is why every maneuver in the AFH starts with a clearing procedure. It is not a checkride box-tick. It is the only chance you have to claim the airspace before you stop being able to maintain a wings-level scan.

## Problem

You are at 3,500 MSL over a sparsely populated practice area. There is a Cherokee 1 NM east of you at an unknown altitude (you saw them earlier but lost track). You want to demonstrate a steep turn. Walk through what you do in the next 60 seconds before the turn.

What is your scan pattern? Which direction do you turn first, and why? What altitudes do you check, and how many separate scan sweeps do you make? At what point would you abort and find a new altitude?

## Discover

### Q1. Why does the FAA require clearing turns before performance maneuvers?

The performance maneuvers (steep turns, ground reference, slow flight, stalls) all share two properties: they hold the airplane in a non-cruise attitude for an extended period, and they reduce or eliminate the pilot's ability to maintain a wings-level traffic scan during the maneuver itself.

Cruise flight is its own clearing procedure: you are looking out the window, scanning for traffic, every minute of every leg. The moment you bank to 45 degrees, your visual field rotates with you, your blind spots shift, and you are dividing attention between the maneuver and the outside picture. The pre-maneuver clear is your last clean look at the sky before the maneuver compromises your ability to see.

### Q2. What does a clearing turn actually accomplish?

Three things:

1. **It clears your blind spots.** Every airplane has them: the wing (high or low), the cabin posts, the engine cowling, the spinner area. Banking 90 degrees in each direction sweeps the sky into your central vision.
2. **It exposes the airplane.** A clearing turn is a banked airplane visible from a wider sector than a wings-level airplane. Other pilots in your area can see your wings flash. You become a participant in shared airspace, not a stationary object.
3. **It buys you a time slice of certainty.** The two minutes you spent clearing told you that, two minutes ago, the airspace within a mile was empty. That is not a guarantee for the next 60 seconds. It is a baseline.

### Q3. What is the standard clearing-turn procedure?

The AFH-canonical pattern is one of two forms:

- **Two 90-degree turns** in opposite directions: roll right 90, roll left 180, return to original heading. This sweeps both sides of the airplane through the central vision arc.
- **One 180-degree turn** if airspace constraints prevent the two-90 pattern: roll either direction 180 degrees, scan continuously, return.

During each turn, scan high-low-high:

```text
1. Look high (above the horizon, where higher traffic flies)
2. Look at horizon level (most likely target band for cruise traffic)
3. Look low (where lower traffic flies)
```

Repeat the high-low-high scan as the airplane sweeps through the turn. Each sector of the sky gets a deliberate look.

### Q4. What are the blind spots in your training airplane?

This depends on the airframe. Examples:

- **Cessna 172 (high wing):** the wing blocks the lateral-above sector during turns. When you bank right, the right wing covers the upper-right quadrant. Solution: lift the wing momentarily before scanning that sector.
- **Piper Cherokee (low wing):** the wing blocks the lateral-below sector. Banking right hides the lower-right quadrant. Solution: bank slightly opposite before scanning, or lower the nose to expose the area.
- **All airplanes:** the cabin posts (A-pillars) create fixed-direction blind spots that move with your head. Move your head, not just your eyes, to clear the post-blocked sectors.
- **All airplanes:** the engine cowling and propeller arc block the direct-forward-down sector. This is the least critical blind spot in cruise (you would not be flying into someone in level flight if they were in front and below) but matters during descent and final approach.

A pilot who knows their airplane's blind spots scans differently from one who does not.

### Q5. Why does the high-low-high scan matter?

Different traffic types fly at different altitude bands relative to you:

- Above your altitude: faster traffic at a higher cruise altitude (jets, turboprops). Closing speed is higher.
- At your altitude: other practice-area users, fellow students, maneuvering traffic.
- Below your altitude: slower traffic, helicopters, ag aircraft, descending traffic from the practice area to the airport.

A scan that only checks horizon-level misses the descending Citation. A scan that only looks down misses the climbing Cessna joining the practice area from below. The high-low-high pattern is the price of completeness.

### Q6. What is the human visual constraint?

PHAK and AC 90-48 both emphasise that the human eye sees small distant targets only in central vision -- the foveal area of the retina, roughly a 1-degree cone. Outside the fovea, peripheral vision is excellent at motion detection but poor at target resolution.

The implication: a moving scan is more effective than a stationary stare. The eye must dwell on each sector long enough for the fovea to register a target (roughly 1-2 seconds) and then move to the next sector. A continuous sweep of the eyes across the windshield (head fixed, eyes moving) leaves no time for the fovea to register a small target. The discipline is sector-by-sector, head-and-eyes-together, with deliberate dwell.

### Q7. When do you abort the maneuver area entirely?

The clear is not just an "is it safe right now" check. It is also an "is this the right place" decision. You abort and relocate when:

- You see another airplane practising in your altitude block within 1-2 NM.
- You hear self-announce calls on the area frequency from someone in your practice altitude.
- The wind has changed and your maneuver area is now over rising terrain or populated area.
- You realise you are too close to airspace edges (Class B, restricted, MOA).
- You are below the FAR-required altitude (1,500 AGL for stalls, 1,500 AGL for chandelles -- check the AFH minimums for the maneuver).

The maneuver area is a choice, not a default. A good pilot picks a fresh location every flight rather than always returning to the same spot.

### What Discover should have led you to

- Performance maneuvers compromise your ability to scan; the pre-maneuver clear is the last clean look.
- Two 90-degree turns or one 180-degree turn is the canonical clear.
- High-low-high scan covers traffic from multiple altitude bands.
- Blind spots are airplane-specific; the pilot must know theirs.
- Foveal vision requires sector-by-sector dwell, not continuous sweeping.
- The clear is also a relocate-or-stay decision, not just a sky-check.

## Reveal

### The summary rule

> Before any performance or ground reference maneuver, clear the airspace with two 90-degree opposite turns (or one 180), scanning high-low-high in each direction with deliberate sector-by-sector dwell. Lift a wing or move your head to expose blind spots. The clear has three purposes: to find traffic, to expose your airplane, and to confirm that this is still the right place to maneuver. If anything is wrong -- traffic in your altitude block, ridge below, airspace too close -- relocate before entering. The clear is not a checkride box; it is the final decision point before you trade away your ability to see.

### The procedure

```text
1. Check altimeter -- am I above the maneuver minimum altitude?
   - Stalls / slow flight: 1,500 AGL minimum (recovery by 1,500 AGL)
   - Steep turns: practical minimum ~1,500 AGL
   - Ground reference: 600-1,000 AGL (per the AFH for GRM)

2. Pick an entry heading toward a recognisable visual reference
   (a road, a town, a lake). You will use this to verify you rolled
   out cleanly.

3. Clear with two 90-degree turns (right then left, or left then right):
   - Roll into the turn
   - Scan: high (above horizon), level (horizon), low (below horizon)
   - Repeat the scan as the turn progresses
   - At 90 degrees, level wings briefly, then roll opposite

4. Lift the wing (high-wing) or look around the wing root
   (low-wing) to expose blind spots.

5. Listen on the area frequency for self-announce calls.

6. Decide: am I clear? Is this the right place? GO or RELOCATE.

7. If GO: roll into the maneuver smoothly.
```

### Blind-spot map (general)

| Airplane class      | Worst blind spot during right bank | Mitigation                       |
| ------------------- | ---------------------------------- | -------------------------------- |
| High-wing (172)     | Upper-right (wing covers it)       | Lift wing momentarily            |
| Low-wing (Cherokee) | Lower-right (wing covers it)       | Bank slightly left; lower nose   |
| All                 | Behind the cabin posts             | Move head; do not just move eyes |
| All                 | Directly behind                    | Periodic 360 turn or wing-rock   |
| All                 | Directly forward-down              | Less critical in cruise          |

### What is actually authoritative

In descending order:

1. **AC 90-48** -- Pilots' Role in Collision Avoidance.
2. **AIM 8-1-6** -- Vision in Flight (scanning techniques).
3. **FAA-H-8083-3 (AFH)** -- the maneuver chapters specify clearing requirements per maneuver.
4. **POH** -- minimum altitudes for specific airplane (some POHs publish recovery-altitude guidance).

## Practice

### Cards (spaced memory items)

- `card:clear-purpose` -- "What three purposes does a clearing turn serve?" -> "Find traffic, expose your airplane, decide whether to stay or relocate."
- `card:clear-procedure` -- "Standard clearing turn pattern?" -> "Two 90-degree turns in opposite directions (or one 180), scanning high-low-high in each."
- `card:clear-foveal` -- "Why sector-by-sector dwell, not continuous sweep?" -> "Foveal vision (1 degree) needs 1-2 seconds dwell to detect a small target."
- `card:clear-high-wing-blind` -- "Where does a high-wing 172 blind spot fall during a right bank?" -> "Upper-right; lift the wing to expose it."
- `card:clear-low-wing-blind` -- "Where does a low-wing Cherokee blind spot fall during a right bank?" -> "Lower-right; bank slightly left or lower nose to expose."
- `card:clear-relocate-cue` -- "Name two reasons to relocate the practice area, not just continue the clear?" -> "Another airplane in your altitude block; airspace edge too close; rising terrain downwind; below maneuver minimum altitude."

### Reps (scenario IDs)

- `scenario:clear-shared-area` -- pilot enters practice area; hears another self-announce at same altitude. Decision: continue clearing here or relocate?
- `scenario:clear-blind-spot-failure` -- right-bank clearing turn in a 172, pilot does not lift the wing. Mid-maneuver, traffic appears from upper-right.
- `scenario:clear-altitude-floor` -- pilot intends steep turns at 1,800 AGL near a class-B floor of 2,000 AGL. Tight margin; should they relocate?

### Drills (time-pressured)

- `drill:clear-procedure` -- pilot recites the full procedure (altitude check, entry heading, two 90s, scan pattern, decision) in 30 seconds.
- `drill:clear-blind-spot-name` -- given an airplane class and a turn direction, pilot names the worst blind spot and the mitigation.

## Connect

### What changes if...

- **...you are in a high-traffic practice area?** Increase the clearing time. Make the turns slower. Listen on the area frequency before entering. Consider relocating.
- **...you are doing a stall (1,500 AGL minimum)?** The clear is even more important because you will be uncoordinated, low airspeed, with reduced control authority during the recovery. Add a 360-degree clearing turn for full visibility.
- **...you are doing ground reference at 800 AGL?** The traffic at your altitude is mostly other practice-area users in the same maneuver. Listen and self-announce. The high-low-high scan still applies but lower-down dominates.
- **...you are at night?** Clearing turns are still required but the scan technique changes -- look slightly off-center because the night-vision foveal blind spot is exactly where you would normally look. AC 90-48 covers night scanning.
- **...you are IFR in the soup?** No visual clear is possible. ATC is your clearing tool. Do not attempt VFR practice maneuvers in IMC.
- **...you are flying with a student?** Make them call out the clear. "Clearing right, looking high...level...low. Clearing left, looking high...level...low. Area is clear, entering steep turn." Verbalisation builds the habit.

### Links

- `proc-collision-avoidance` -- the in-flight scan that continues after the clear is the same scan compressed into the maneuver.
- `proc-attention-management` -- the clear is a deliberate prefix to a maneuver; attention-management is the running cost.
- `proc-traffic-pattern` -- pattern flying does not have "clearing turns" but the same see-and-be-seen discipline applies on every leg.

## Verify

### Novel scenario (narrative)

> You are entering the practice area at 3,500 MSL in a Cessna 172. You hear another pilot self-announce on 122.85: "Cessna 8RX, practice area, 3,500, ground reference." You are 2 NM from the announced position. Walk through your decision and your clearing actions.

Scoring rubric:

- Recognises that 8RX is at the same altitude and within visual range; potential conflict. (2)
- Describes contacting the other pilot to coordinate altitude or area separation. (2)
- Performs a clearing turn that emphasises the direction of the other airplane (find them visually first). (2)
- Lifts the wing to expose the upper-right blind spot during the right-clearing turn. (1)
- Decides to either climb to 4,500 MSL (vertical separation) or relocate to a different practice area. (2)
- Self-announces own intentions on 122.85 before maneuvering. (1)

10/10 is the bar. Below 7 is a redo.

### Teaching exercise (CFI)

> A student performs the verbal checklist of "clearing left, clearing right" but their eyes do not actually move during the call. They look forward, say the words, then enter the maneuver. Diagnose and write the post-flight teaching point.

Evaluation criteria:

- Diagnosis: the student has memorised the words but not internalised the purpose. They are paying lip service to the procedure.
- Teaching point: the clear is for the eyes, not the mouth. If the eyes do not move, the clear did not happen.
- Drill on the next flight: CFI watches the student's eyes during the clear. CFI calls out where the student is looking ("you are looking forward, you are looking forward, you are looking at the panel"). Student adjusts in real time.
- Progression: CFI plants a "traffic" call (verbal hint that traffic is in a specific direction). Student must demonstrate that they actually scanned that direction by reporting whether they saw it.
- The CFI is direct: "If the maneuver kills you because you did not see the other airplane, the verbal procedure did not save you. Move your eyes."

The pedagogical move is to convert "doing the procedure" from a narration habit into a perceptual one.
