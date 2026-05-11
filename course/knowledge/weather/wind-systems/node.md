---
id: wx-wind-systems
title: Wind -- Crosswind, Tailwind, Shear, Mountain Wave
domain: weather
cross_domains: [aerodynamics, performance]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-go-nogo-decision
  - perf-crosswind-component
  - plan-vfr-cross-country
taught_by: []
related:
  - wx-airmasses-and-fronts
  - wx-turbulence-types

modalities: [reading, cards, calculation]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, chapters on wind and orographic effects
    note: Coriolis, friction layer, mountain-wave mechanics.
  - source: AC 00-54
    detail: Pilot Windshear Guide
    note: FAA reference on low-level windshear recognition and recovery.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 10 -- Wind
    note: Modern consolidated reference for wind systems and shear (forces in §10.3, local winds §10.6, adverse winds §10.7 including wind shear §10.7.5); mountain-wave detail in Chapter 16 (Mountain Weather).
  - source: AIM
    detail: 7-1-19 -- Microbursts; 7-5-2 -- Mountain Flying
    note: Operational guidance on the tactical wind hazards.

assessable: true
assessment_methods: [recall, scenario, calculation]
mastery_criteria: >
  Learner can compute crosswind / headwind components from wind
  direction and runway heading, identify low-level windshear cues from
  PIREPs and METARs, recognize mountain-wave conditions from synoptic
  setup (strong cross-ridge wind, stable layer above), and choose an
  altitude and route that mitigates each.
---

# Wind -- Crosswind, Tailwind, Shear, Mountain Wave

## Context

You're descending through 4,000 ft on the lee side of the Sierras in
late afternoon. Reported surface winds are 20 KT out of the west.
Without warning your airspeed drops 15 knots and your descent rate
spikes to 1,500 fpm. You add power, push the nose down, watch the VSI
recover at 2,000 ft below where you started losing altitude. Mountain
wave -- and you got the trough side, not the crest.

## Problem

Wind is the most operationally consequential weather phenomenon at the
GA scale. It dictates runway choice, ground speed, fuel reserve,
turbulence character, and -- in the worst cases -- aircraft
controllability. A weather brief that doesn't develop a clear picture
of the wind environment at every altitude of flight is incomplete.

## Discover

Build the wind picture from the ground up:

- Surface wind: friction-distorted, gustier than aloft, and shifted
  10-30 degrees toward the lower-pressure side of the gradient. Pulled
  from METARs.
- Wind aloft: the upper-air picture, geostrophic, parallel to isobars
  in the free atmosphere. Pulled from FB and Skew-Ts.
- The friction layer transition usually completes by 2,000-3,000 ft
  AGL. Below that, expect direction veer and speed change with
  altitude (a real wind shear, but a benign one as long as you expect
  it on climbout and approach).

Now overlay the special cases:

- Crosswind on landing: the operationally important component is the
  cross to the runway, not the absolute speed. Crosswind component =
  wind speed * sin(angle between wind and runway). Quick mental
  model: 30-degree offset = half cross, 60-degree offset = full cross,
  90-degree offset = pure cross.
- Tailwind on landing: forbidden in most operations above 10 KT
  because it inflates groundspeed at touchdown and ground roll
  catastrophically.
- Low-level windshear: surface wind to 2,000 ft AGL changing rapidly
  with altitude. Triggered by frontal passage, microburst, mountain
  wave, or convective outflow. The classic GA accident is the
  too-low base leg into a microburst's outflow boundary.
- Mountain wave: any time wind > 25 KT crosses a ridge perpendicular
  to its axis with stable air above, standing waves form downwind.
  Crests give updrafts; troughs give violent downdrafts and rotor
  turbulence below cap clouds.

## Reveal

Indicators by source:

- METAR: gust spread (G15+ above the steady value), variable wind
  groups (VRB), peak wind in remarks.
- TAF: wind groups in change blocks; FM groups for sharp shifts.
- PIREP: low-level windshear is one of the UUA triggers. Any PIREP
  reporting a > 10 KT airspeed loss/gain on approach is windshear by
  definition.
- AIRMET TANGO: surface winds > 30 KT, non-convective windshear.
- SIGMET: severe windshear (where it co-occurs with convection or
  severe turbulence not associated with thunderstorms).
- Synoptic: tight pressure gradient, mountain-wave setup (cross-ridge
  > 25 KT + stable layer aloft + visible lenticular or rotor cap
  clouds).

Mountain-wave avoidance: cross ridges at 50% above the highest peak
on the leeward side, cross at a 45-degree angle so that you can roll
out and escape in two seconds, and never trust your altimeter setting
in mountain-wave conditions (pressure can drop 100 mb on the lee side,
yielding a 1,000+ ft altimeter error).

Microburst avoidance: never penetrate a virga shaft or convective cell
on approach. The outflow boundary expands at 30+ KT for 5-10 minutes
after the descending column hits the ground. Standard guidance is to
stay 5 NM from any visible thunderstorm and to delay approach if a
cell is within 20 NM of the airport.

## Practice

For a flight tomorrow, compute the forecast crosswind component on
the active runway at your destination at your ETA. Then compute the
same for an alternate runway at the same airport. The pre-decision
work makes the day-of decision a math check, not a guess.

For mountain crossings, identify the worst-case lee-side wind from
the FB at planned cruise altitude. If that wind crossed perpendicular
to a ridge of comparable height to your cruise altitude, you'd be in
mountain-wave territory -- check your route against ridges and plan
the crossing geometry.

## Connect

Wind ties into the crosswind-component performance node and the
turbulence-types node. The shear and mountain-wave subsections feed
the go/no-go node directly. PIREPs are the primary truth-up for
forecast wind hazards; AIRMETs / SIGMETs are the forecast layer.

## Verify

For three flights this month, compute crosswind components by hand
before takeoff and again before landing. Cross-check against the
airplane's actual handling on the runway. The number-to-feel
mapping calibrates fast and is the foundation of competent crosswind
landings.
