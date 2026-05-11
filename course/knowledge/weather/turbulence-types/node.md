---
id: wx-turbulence-types
title: Turbulence Types and Causes
domain: weather
cross_domains: [aerodynamics, safety-accident-analysis]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-thunderstorm-hazards
  - wx-wind-systems

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-30C
    detail: Clear Air Turbulence Avoidance
    note: FAA reference on CAT recognition and avoidance.
  - source: AIM
    detail: 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    note: Operational classification, intensity definitions, wake-turbulence avoidance.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 19 -- Turbulence
    note: Modern consolidated reference for the full turbulence taxonomy (convective §19.2.1, mechanical §19.2.2, wind shear §19.2.3-4).

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the primary turbulence types (mechanical / convective
  / clear-air / mountain-wave / wake / windshear), identify the synoptic
  or local trigger for each, distinguish reported intensities (light /
  moderate / severe / extreme) by their pilot-meaningful definitions, and
  predict turbulence character along a planned route from forecast and
  PIREP data.
---

# Turbulence Types and Causes

## Context

A line of cumulus runs perpendicular to your route at 6,000 ft. Below
them: light. Through them: bumpy. Above them: smooth. The next day at
the same altitude over the same terrain, the air is solidly smooth.
Same altitude, same airspeed, same airplane. The difference is what
type of turbulence was active and what its source was.

## Problem

"Turbulence" is a category, not a phenomenon. Mechanical, convective,
clear-air, mountain-wave, wake, and shear-induced turbulence have
different causes, different signatures, and different avoidance
strategies. Treating them all as one obscures the avoidance options
and the forecast cues.

## Discover

Mechanical turbulence: surface friction and obstacles disturb the
flow. Strongest in low-level wind, near terrain or buildings. Forecast
cue: surface wind > 25 KT and rough terrain on the windward side.
Avoidance: climb above the friction layer (typically 2,000-3,000 ft
AGL).

Convective turbulence: rising thermals and the surrounding sinking
air. Strongest on hot afternoons over heated surfaces. Forecast cue:
unstable air column (steep lapse rate, cumulus building). Avoidance:
fly early or late, or above the convective ceiling (typically the
cumulus tops + 1,000 ft).

Clear-air turbulence (CAT): wind-shear in the upper troposphere,
typically near jet streams. Strongest in the cold side of a jet
core, in temperature gradient zones. Forecast cue: GTG (Graphical
Turbulence Guidance) on the GFA, AIRMET TANGO, jet stream maps.
Avoidance: change altitude (1,000-2,000 ft up or down).

Mountain-wave turbulence: standing waves downwind of ridges. Smooth
in the wave itself, violent in the rotor under the wave's crest.
Forecast cue: cross-ridge wind > 25 KT, stable layer aloft, lenticular
or rotor cap clouds. Avoidance: cross at altitude, perpendicular,
during low-wind windows; never penetrate visible rotor.

Wake turbulence: vortices trailing from any aircraft generating lift.
Strongest behind heavy / clean / slow airplanes (the worst case is a
heavy on takeoff or approach, low and slow with gear and flaps up).
Forecast cue: traffic ahead of you. Avoidance: stay above the
generating aircraft's flight path; on takeoff rotate before its
rotation point and climb above its profile.

Wind-shear turbulence: rapid change of wind with altitude over a few
hundred to a few thousand feet. Common at frontal boundaries, in
microburst outflow, and below the friction layer at sunrise / sunset.
Forecast cue: PIREPs reporting airspeed loss/gain on approach,
strong low-level wind shifts in TAFs.

## Reveal

Intensity definitions per AIM 7-1-23 are aircraft-and-load relative,
not absolute. Roughly:

| Intensity | Pilot-meaningful definition                     |
| --------- | ----------------------------------------------- |
| Light     | Slight, erratic changes in altitude / attitude  |
| Moderate  | Definite jolts; aircraft remains in control     |
| Severe    | Large abrupt changes; momentary loss of control |
| Extreme   | Aircraft tossed violently, structural damage    |

Note that severity is per-airplane: a Citation's "moderate" can be a
Cherokee's "severe." This is why PIREPs include the reporting
aircraft type -- the receiver weights the report by the difference
between the reporter's airplane and her own.

Reporting thresholds for UUA (urgent PIREP): severe / extreme
turbulence triggers urgency. Moderate is reportable as a routine UA
and worth filing.

## Practice

Pull a current GFA. Toggle the turbulence layer. Identify the type
based on synoptic context: is the area shaded near terrain (likely
mechanical or mountain-wave), in a convective cell area (convective),
near a jet core (CAT), or in a frontal zone (shear)? Match the
forecast type to the appropriate AIRMET / SIGMET if any.

For your next flight: if any portion of the route is forecast for
moderate turbulence, identify the type, the avoidance option (climb,
descend, deviate, delay), and the cost. The pre-decided avoidance
beats the panicked one.

## Connect

Turbulence intersects every other K3 phenomenon: it's the kinetic
signature of unstable air (K3a), of strong wind systems (K3b), of
convective storms (K3h), of mountain wave (K3b again). The
go/no-go node consumes turbulence-type understanding to weight the
forecast appropriately.

## Verify

Identify the primary turbulence type associated with each of these
forecast scenarios, with a 5-second answer:

- AIRMET TANGO, low-level winds 35 KT, rough terrain.
- TCu building over the desert at 1500L.
- Cross-ridge wind 40 KT in a stable air column with lenticular
  clouds.
- Jet core 200 KT just above your filed altitude.
- 30 NM behind a Boeing 757 on approach.

(Mechanical, convective, mountain-wave, CAT, wake.) If the
classification is automatic, the avoidance choice flows.
