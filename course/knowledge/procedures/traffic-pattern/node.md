---
# === Identity ===
id: proc-traffic-pattern
title: Traffic Pattern
domain: procedures
cross_domains:
  - vfr-operations
  - adm-human-factors

# === Knowledge character ===
# procedural: there is a default rectangular pattern with named legs and standard
#   altitudes / speeds / gear/flap configurations.
# perceptual: spotting other traffic, judging the wind on base, picking the
#   right point to turn final. Most of the pattern is reading the airplane and
#   the air, not memorising rules.
# judgment: when do you extend downwind for a faster aircraft? When do you
#   reject a base entry that puts you nose-to-nose with someone on a long
#   straight-in? Pattern judgment is collision avoidance under social pressure.
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
  - aero-four-forces
  - aero-angle-of-attack-and-stall
deepens: []
applied_by: []
taught_by: []
related:
  - proc-180-degree-turn
  - aero-coordination-rudder

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - drill
estimated_time_minutes: 60
review_time_minutes: 8

# === References ===
references:
  - source: AIM
    detail: 4-3-3 -- Traffic Patterns
    note: >-
      The canonical guidance on standard pattern altitudes (typically 1,000 AGL
      for piston singles, 1,500 AGL for turbine), the rectangular pattern
      shape, left-traffic default, and entry / exit recommendations.
  - source: AC 90-66C
    detail: Non-Towered Airport Flight Operations
    note: >-
      Recommended pattern entries (45 to downwind), CTAF self-announce phrasing,
      and the long-running guidance against straight-in approaches at busy
      non-towered fields.
  - source: FAA Airplane Flying Handbook (FAA-H-8083-3B)
    detail: Chapter on airport traffic patterns and operations
    note: >-
      Practical pattern flying -- crosswind, downwind, base, final shaping;
      typical airspeeds and configurations; corrections for wind drift on
      each leg.
  - source: 14 CFR 91.126 / 91.127
    detail: Operations at airports without operating control towers / with operating control towers
    note: >-
      The legal floor: turn in the direction indicated by the segmented circle
      or the published pattern, otherwise to the left. ATC clears you into
      patterns that may differ from the published pattern at towered fields.

# === Assessment ===
assessable: true
assessment_methods:
  - scenario
  - demonstration
  - recall
mastery_criteria: >-
  Learner can: (1) draw a standard left-traffic rectangular pattern with leg
  names, default 1,000 AGL altitude, and the 45-degree downwind entry; (2)
  state the configuration and airspeed targets for each leg in their training
  airplane; (3) describe at least three wind corrections (crab on base, wider
  pattern with strong winds, tighter on base with tailwind upwind); (4) identify
  three situations that justify breaking pattern (collision avoidance, ATC
  instruction, emergency); (5) self-announce on CTAF in the standard order
  (airport / position / intentions / airport).
---

# Traffic Pattern

## Context

You are inbound to a non-towered airport on a Saturday morning. CTAF is busy; you have already heard six different aircraft self-announcing in the last few minutes. One of them is doing a straight-in from the east. Another is in the run-up area calling departure. A third just called downwind for the opposite runway. You are five miles out, at pattern altitude plus 500, and you have a decision to make about how you are going to fit yourself into a pattern that already has people in it.

The traffic pattern is not a rule; it is a contract. Pilots have agreed to fly in a predictable rectangle so other pilots know where to look. The moment you stop being predictable, every other pilot's mental model of the airspace breaks. The midair collisions in the NTSB database that happen at non-towered fields almost always involve at least one airplane doing something the other pilots could not have predicted: a straight-in across a downwind leg, a non-standard pattern at an airport that publishes left traffic, an opposite-direction landing without a CTAF call.

The pattern itself is not complicated. The skill that wraps the pattern is. You will fly thousands of patterns in your career; the muscle memory will become invisible. What stays visible is the constant scan for the airplane that did not announce, the airplane that announced but is not where they said they were, and the airplane that is doing the right thing but at the wrong field because their nav system is one runway off.

## Problem

You are entering the pattern at KAPA (towered) on a left base for runway 17L. Tower clears you to land. As you turn final you spot a Cirrus high and to your right that ATC has not called. The Cirrus is descending toward the same runway from a long straight-in that tower clearly intended to space behind you. The pilot is fixated on the runway and not looking left. You are at 800 AGL, 80 KIAS, half-flaps.

Your radio call to tower is going to take 4-6 seconds. Before you make it, what do you do with the airplane? After you make it, what do you say?

Write your answer before reading on. Then ask: how would the answer change if you were at a non-towered airport with no tower to call?

## Discover

The pattern is a tool to make collision avoidance easier. Most of what we call "pattern technique" is actually answers to four underlying questions. Work through them in order.

### Q1. Why a rectangle, and why those specific legs?

Pilots circling for landing need to lose altitude, configure the airplane, see the runway, and adjust for wind. They also need other pilots to be able to predict where they are. A rectangle solves all of those:

- **Crosswind leg** -- you climb away from the runway perpendicularly, gaining the altitude you need before the airplanes on the ground rotate beneath you.
- **Downwind leg** -- you fly parallel to the runway in the opposite direction, at pattern altitude, with the runway in your peripheral vision. This is where you do the pre-landing checklist, judge the wind by drift, and look for the airplane that joined behind you.
- **Base leg** -- you turn perpendicular to the runway again, descending, and judge your final-turn point against the airplanes ahead of you.
- **Final leg** -- you align with the runway, manage energy, and land.

You could circle. Helicopters do. But a circle hides altitude separation cues, makes "where am I going to be in 30 seconds" hard to predict from the ground, and removes the natural pre-landing-checklist beat that downwind provides. The rectangle is a teaching aid baked into the airspace.

### Q2. Why pattern altitude is 1,000 AGL (most places) and not 800 or 1,500

A piston-single pattern altitude of 1,000 AGL falls out of three constraints simultaneously:

- High enough that an engine failure on downwind, abeam the numbers, gives you a glide back to a usable surface. A C172 at 1,000 AGL on downwind, abeam the numbers, can typically make the runway in a power-off glide.
- Low enough that you can lose altitude in a normal descending base and final without resorting to a slip or a steep approach. Standard descents on base and final at 70-80 KIAS lose roughly 500-700 fpm; from 1,000 AGL, that's 1.5-2 minutes to touchdown, which matches the geometry of a normal pattern.
- Low enough to stay below the floor of overlying airspace at most non-towered fields without bumping the bottom of Class B/C/D shelves.

Some patterns are 800 AGL (helicopter, light sport). Some are 1,500 AGL (turbine, jet, military). The number is not arbitrary; it is a compromise between glide return, descent geometry, and overlying airspace.

### Q3. What does the wind do to the pattern shape?

Imagine yourself flying a perfect rectangle in zero wind. Now add a 20-knot wind from the right side of the runway (90 degrees off the runway heading, blowing left to right when you are on final).

- **Upwind / crosswind** -- the wind blows you toward the downwind leg. Without correction, your downwind track creeps in toward the runway.
- **Downwind** -- you have a tailwind component on downwind (if the wind is from the upwind side) or a headwind (if from the downwind side). Either way, downwind groundspeed differs from your normal expectation. Pilots who fly the leg "by clock" rather than by ground reference end up turning base early or late.
- **Base** -- the wind is now on your tail or your nose. With a tailwind on base, you sail toward final faster than expected and overshoot the centerline. With a headwind on base, you crawl, you misread the geometry, and you sometimes pull the base-to-final turn into a steep, uncoordinated, low-altitude maneuver. The base-to-final stall-spin is the classic pattern killer; wind makes it worse.
- **Final** -- crosswind component shows up here as a crab or a wing-low slip. You already know how to fly a crosswind landing.

The fix is intentional: you crab on each leg, you accept asymmetric pattern shape, you turn base earlier when downwind is fast and later when it is slow. You do not fly the same pattern shape and then "fix it" on final. You fly a different shape that ends up in the same place over the runway.

### Q4. What is the social contract on the radio?

At a non-towered field, every pilot in the area is forming a mental model of every other pilot's position from the radio calls plus what they can see. You feed that model with calls. The standard order:

```text
[Airport] traffic, [aircraft type and tail number], [position and altitude], [intentions], [airport].
```

For example:

```text
Centennial traffic, Cessna 12345, ten miles north, two-thousand five-hundred,
inbound for landing runway one-seven left, will report two-mile forty-five entry,
Centennial.
```

The first and last "Centennial" frame the call -- pilots monitoring multiple CTAFs on the same frequency hear the field name twice and can ignore traffic at fields they are not flying to. The position and altitude let other pilots place you on a mental map. The intention lets them predict where you will be in the next few minutes.

What you do not say is everything that does not change the picture for another pilot. You do not need to announce taxi instructions to anyone but yourself; you do not need to say "any traffic in the area please advise" (it is explicitly discouraged in AC 90-66C); you do not need to use jargon that another pilot might not immediately decode.

### Q5. When do you break pattern?

Three reasons, in order of urgency:

1. **Collision avoidance.** Another aircraft is converging. You break the pattern to deconflict. Anything goes; the goal is geometric separation, not procedural compliance.
2. **ATC instruction.** At a towered field, ATC may give you a non-standard pattern (right base, extended downwind, 360 for spacing). You comply, you read it back, you fly what they assigned.
3. **Emergency.** Engine roughness, smoke, gear problem, low fuel -- you tell tower (or self-announce) and you fly the airplane to a landing. You do not ask permission to fly an emergency pattern; you tell them what you are doing.

Otherwise, fly the published pattern. Predictability is the whole point.

### What Discover should have led you to

- The pattern is a contract that makes other pilots' positions predictable. The leg shapes are mnemonic carriers, not arbitrary geometry.
- Pattern altitude is set by glide-return, descent-geometry, and airspace constraints. There is a reason it is 1,000 AGL at most fields.
- Wind reshapes the pattern; you intentionally fly an asymmetric track to end up over the runway in the right place.
- Radio calls feed other pilots' mental models. The standard order exists because it loads the picture in the order that lets the listener place you fastest.
- Breaking pattern is for collision avoidance, ATC instruction, or emergency, not for convenience.

## Reveal

### The summary rule

> The standard traffic pattern is a left-hand rectangle flown at the published pattern altitude, entered on the 45 to downwind at non-towered fields and as cleared at towered fields. Self-announce position and intentions on CTAF at non-towered fields; comply with tower at towered fields. Predictability is the safety mechanism; deviate only for collision avoidance, ATC instruction, or emergency.

### The legs and their defaults

| Leg          | Configuration target (typical light single)              | Wind correction emphasis                                          |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Upwind       | Climb power, pitch for Vy                                | Maintain runway centerline track over the ground                  |
| Crosswind    | Climbing, level off as you approach pattern altitude     | Crab into wind so you do not blow into downwind                   |
| Downwind     | Pattern altitude, cruise or pre-landing config           | Crab away from runway side as needed; pre-landing checks abeam    |
| Base         | Reduce power, first-stage flaps, descending              | Tailwind on base = turn final early; headwind = turn final late   |
| Final        | Approach speed, full landing config, stabilised by 500   | Crab or wing-low slip for crosswind                               |

POH numbers always override these. A C172S downwind is roughly 90 KIAS, base 80 KIAS with first flaps, final 65 KIAS with full flaps for a normal landing. A PA28-181 is similar. Your airplane is not generic; check Section 4.

### Standard entries (non-towered)

- **45 to downwind** is the default. Approach the pattern from the upwind side at pattern altitude on a 45-degree intercept to the downwind leg, midfield. You see traffic on downwind ahead of you and you merge in like a freeway entrance.
- **Crosswind entry** is acceptable when the 45 is impractical -- enter midfield crosswind at pattern altitude, fly across the airport, and join downwind.
- **Straight-in** is discouraged at busy non-towered fields. AIM and AC 90-66C both reflect the consensus that straight-ins disrupt the mental model and are over-represented in midairs at non-towered fields. Towered fields are different -- if tower clears you straight in, that is the assigned pattern.

### Standard radio call format

```text
[airport] traffic, [aircraft type/tail], [position + altitude],
[intentions], [airport]
```

Frame the call with the field name twice. Position before intention. Field name last so a listener tuned to multiple CTAFs knows whether to listen.

### What is actually authoritative

In descending order:

1. **ATC instruction at towered fields.** They tell you the pattern; you fly it.
2. **Published pattern direction at non-towered fields.** Right traffic if the segmented circle / charts say so, otherwise left.
3. **AIM 4-3-3 + AC 90-66C** for entry and self-announce conventions.
4. **POH Section 4** for your aircraft's configuration and speed targets.
5. **Local pilot consensus.** Some fields have local conventions (a noise-abatement turn, a preferred 45 entry track over a specific landmark) that are not on a chart but are real. Listen on CTAF before entering, ask other pilots, read the airport's web page.

### location_skill

- AIM 4-3-3 (Traffic Patterns) -- official entry / leg geometry / pattern altitude guidance.
- AC 90-66C -- non-towered field operations; the closest thing the FAA has to a "how to behave" doc on CTAF.
- AFD / Chart Supplement entry for the airport -- pattern direction, pattern altitude, runway info.
- Sectional chart -- pattern altitude is published if non-standard; right traffic is shown by RP notation in the Chart Supplement.
- Foreflight (or equivalent) "airport info" page -- aggregates all of the above and shows recent NOTAMs.

## Practice

### Cards (spaced memory items)

- `card:tp-default-altitude` -- "Standard pattern altitude for piston singles?" -> "1,000 AGL unless published otherwise."
- `card:tp-default-direction` -- "Default traffic pattern direction at a non-towered field?" -> "Left, unless published right (RP notation in Chart Supplement)."
- `card:tp-standard-entry` -- "Recommended entry at a non-towered field?" -> "45 to midfield downwind at pattern altitude."
- `card:tp-radio-call-order` -- "Order of elements in a CTAF self-announce?" -> "Airport, aircraft, position+altitude, intentions, airport."
- `card:tp-leg-names` -- "Name the five legs of a standard rectangular pattern in order of flight from takeoff." -> "Upwind, crosswind, downwind, base, final."
- `card:tp-base-final-stall` -- "Dominant fatal failure mode in the base-to-final turn?" -> "Skidding, low-altitude, accelerated stall (cross-controlled stall) when overshooting the centerline."
- `card:tp-pre-landing-abeam-numbers` -- "When abeam the numbers on downwind, what changes?" -> "Reduce power, begin descent, first-stage flaps; pre-landing checklist complete."
- `card:tp-when-break-pattern` -- "Three reasons to break the pattern?" -> "Collision avoidance, ATC instruction, emergency."
- `card:tp-tailwind-base-effect` -- "Tailwind on base leg, what happens?" -> "Faster groundspeed, overshoot risk on final; turn base earlier and accept a longer final."
- `card:tp-cirrus-90-66c-straight-in` -- "AC 90-66C guidance on straight-in approaches at busy non-towered fields?" -> "Discouraged; pattern entry preferred unless straight-in is unavoidable and announced well in advance."

### Reps (scenario IDs)

- `scenario:tp-cirrus-on-final-conflict` -- the opening problem above. Tower clears you to land; an unannounced Cirrus on long straight-in is converging. You must react.
- `scenario:tp-strong-crosswind-pattern` -- 18-knot direct crosswind at a non-towered field. Pattern shape and self-announce content tested.
- `scenario:tp-opposite-traffic-non-towered` -- another aircraft has called in for opposite-direction landing on the same runway. Decision: comply with the wind side (more or less) versus accept a tailwind landing for separation.
- `scenario:tp-go-around-on-final` -- a deer crosses the runway at 200 AGL on short final. Go-around procedure, climb-out path, re-entry into pattern.
- `scenario:tp-extended-downwind-jet` -- tower asks you to extend downwind for a Citation on a 6-mile final. You comply, but at what point do you ask for a base turn?

### Drills (time-pressured)

- `drill:tp-radio-call-50-sec` -- 10 randomised position/intention pairs. Learner has 5 seconds per pair to compose the correct CTAF call out loud.
- `drill:tp-pattern-shape-recognition` -- top-down moving-map snapshots of an airport with multiple traffic targets. Learner identifies which aircraft is on which leg and any pattern-conflict.
- `drill:tp-leg-config-targets` -- learner is shown a leg name; must call out airspeed, configuration, and the next checklist item appropriate for their training aircraft.

### Back-of-envelope calculations

**Calculation 1: pattern leg lengths.**

A typical light-single pattern downwind leg is flown roughly half a mile to one mile from the runway. At 90 KIAS (downwind, no wind) that is 90 nm/hour, or 1.5 nm/min. A 1.5-mile downwind leg at 90 kt takes:

```text
1.5 / 1.5 = 1.0 minute
```

That is one minute from "abeam the numbers" to "turning base." Add 30 seconds of base, 30-45 seconds of final, plus any extension for traffic. Total time downwind-to-touchdown: 2 to 3 minutes. That sets the rhythm.

**Calculation 2: pattern altitude vs. glide-back.**

A C172 at 1,000 AGL on downwind, abeam the numbers, has roughly:

- Glide ratio (clean) ~9:1 -> 9,000 feet of glide range from 1,000 AGL.
- Distance from downwind track to runway centerline ~3,000-4,000 feet (half a mile to two-thirds of a mile).
- Distance back along the runway to the threshold ~3,000-5,000 feet depending on where on downwind you are.

Total glide need is therefore 6,000-9,000 feet (roughly), comfortably inside the 9,000-foot glide range from pattern altitude -- which is exactly why pattern altitude is set there. If you reduce altitude by 200 feet, the glide range drops to ~7,200 feet and the math gets uncomfortable.

## Connect

### What changes if...

- **...you fly a high-performance airplane?** Pattern altitude may be 1,500 AGL. Downwind speed may be 110+ kt. The rectangle is bigger and the timing is faster, but the contract is the same.
- **...you are at a Class D field?** ATC clears you into the pattern; you fly what they assign. Right traffic, right base, extended downwind, 360 for spacing -- their call. You do not self-announce; you read back assignments.
- **...you fly a noise-abatement procedure?** Some fields publish a non-standard climb path or pattern entry to avoid noise-sensitive areas. The legal default does not apply; you fly the noise-abatement procedure unless safety requires otherwise. Read the AFD entry before going.
- **...you have a partial flap failure on downwind?** Recompute approach speed and stopping distance. Extend downwind for time to think. Self-announce that you are extending. Land on a longer runway if you can.
- **...you are on a checkride?** The DPE will watch for stabilised, predictable, by-the-book pattern flying. Standardness is graded. Improvisation that works at home is suspicious here.
- **...you are flying a glider or ultralight?** The pattern altitude and shape may differ; mixed traffic at gliderports is its own discipline. Listen on CTAF and watch.
- **...you are at a field with intersecting runways and CTAF traffic on both?** Pick one runway and stay on its pattern; do not freelance. Mid-field crossings between two patterns are exactly the kind of unpredictable that gets people hit.

### Links

- `aero-coordination-rudder` -- the base-to-final turn is where uncoordinated flight kills. Skid plus pull plus low altitude equals stall-spin. The pattern is where you live or die by rudder discipline.
- `aero-angle-of-attack-and-stall` -- approach speed margins on base and final are AOA margins. Tightening a base turn at low airspeed is what kills.
- `proc-180-degree-turn` -- if you are inadvertently in IMC on climb-out, the pattern is the geometry you were leaving. The 180 is your way back.
- `proc-engine-failure-after-takeoff` -- the runway you just left is the airplane you might be returning to. Brief the abort point and the turnback altitude floor before takeoff. The pattern is the recovery geometry; do not redesign it under stress.
- `aero-load-factor-and-bank-angle` -- the steep base turn is the canonical place where a pilot cranks bank and pull, not realising the load factor is climbing the stall speed up to their indicated airspeed.

## Verify

### Novel scenario (narrative)

> You are joining the 45 for runway 35 at a non-towered field at 1,000 AGL. Three miles out, you hear an aircraft self-announce: "Mountain View traffic, Cherokee 22A, ten-mile final straight-in for runway three-five, full stop, Mountain View." You estimate the Cherokee is descending through 2,000 AGL at 90 kt -- about three minutes from threshold. You are 90 seconds from being abeam the numbers on downwind. There is one other aircraft, a Cessna, on a base leg ahead of you that is about to turn final.
>
> What is your pattern plan, and what is your CTAF call in the next 10 seconds?

Scoring rubric (self-assessed or CFI-assessed):

- Recognises that the Cherokee's straight-in is contrary to AC 90-66C guidance but is announced and predictable. (1)
- Builds a mental sequence: Cessna lands first, then the geometry asks whether the Cherokee or the learner is next. (2)
- Self-announces position, intentions, and explicit acknowledgement of the Cherokee. Example: "Mountain View traffic, Cessna 12345, two-mile forty-five for runway three-five, will follow Cessna on base, looking for Cherokee on long final, Mountain View." (2)
- Has a fallback plan: if the geometry breaks down, extend upwind and re-enter rather than turn base in front of the Cherokee. (2)
- Watches the Cherokee visually -- announced does not equal where they said they were. (1)
- Does not get drawn into telling the Cherokee they should not have done a straight-in. The radio is for separation, not enforcement. (2)

10/10 is the bar. Below 7 is a redo.

### Teaching exercise (CFI)

> A primary student flies a competent pattern in calm wind but consistently overshoots the centerline on the base-to-final turn in a 10-knot direct crosswind. They correct with bank rather than with planning -- they steepen the base turn instead of starting it earlier or wider.
>
> Write the first three sentences of your CFI debrief. You must: (1) name the specific risk (skidding stall-spin in the turn), (2) connect their mistake to a concrete change in pattern planning rather than just "more rudder," (3) give them a measurable correction they can try next pattern.

Evaluation criteria:

- Identifies the specific kill chain: tailwind-on-base -> overshoot -> steeper-than-planned turn -> pull and skid -> accelerated stall.
- Points the fix at planning (turn base earlier when downwind is fast / extend downwind to widen the geometry) rather than at "more rudder in the turn."
- Gives the student something they can measure: e.g., "When you turn base, the runway should appear at roughly your 8 o'clock position. If it's already past your 6 o'clock when you turn, you'll overshoot every time."
- Avoids "never bank past 30 degrees" type rules without context. The learning is to plan the turn earlier, not to limit the bank angle in the abstract.

The pedagogical move is to convert the symptom (overshoot) into the cause (planning) so the student starts treating downwind-to-base wind correction as an active flying skill, not a checklist item.
