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

:::cards

- front: "Mechanical turbulence: cause, forecast cue, and standard avoidance."
  back: |
    Cause: surface friction and obstacles disturb the flow. Strongest in
    low-level wind near terrain or buildings.
    Forecast cue: surface wind > 25 KT and rough terrain on the windward
    side.
    Avoidance: climb above the friction layer (typically 2,000-3,000 ft
    AGL). Above the layer the air smooths out as friction stops mixing.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, mechanical, friction-layer, faa-h-8083-28]
  source_ref: |
    FAA-H-8083-28 Ch 19.2.2; body Discover.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Convective turbulence: cause, forecast cue, and avoidance."
  back: |
    Cause: rising thermals and surrounding sinking air. Strongest on hot
    afternoons over heated surfaces.
    Forecast cue: unstable air column (steep lapse rate, cumulus building
    rapidly).
    Avoidance: fly early or late (before / after peak heating), or above
    the convective ceiling (typically cumulus tops + 1,000 ft).
  cardType: basic
  kind: recall
  tags: [weather, turbulence, convective, thermals, faa-h-8083-28]
  source_ref: |
    FAA-H-8083-28 Ch 19.2.1; body Discover.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Clear-air turbulence (CAT): cause, forecast cue, and avoidance."
  back: |
    Cause: wind shear in the upper troposphere, typically near jet
    streams. Strongest on the cold side of a jet core, in temperature
    gradient zones.
    Forecast cue: GTG (Graphical Turbulence Guidance) on the GFA, AIRMET
    TANGO at high altitude, jet stream maps.
    Avoidance: change altitude (1,000-2,000 ft up or down). CAT layers
    are typically thin in the vertical -- a small altitude change
    usually escapes them.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, cat, jet-stream, ac-00-30c]
  source_ref: |
    AC 00-30C Clear Air Turbulence Avoidance; body Discover.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Mountain-wave turbulence: cause, forecast cue, and the rotor warning."
  back: |
    Cause: standing waves form downwind of ridges when cross-ridge wind
    is strong and a stable layer caps the wave. Smooth in the wave
    itself; violent in the rotor under the wave's crest.
    Forecast cue: cross-ridge wind > 25 KT, stable layer aloft, visible
    lenticular or rotor cap clouds.
    Avoidance: cross at altitude, perpendicular, during low-wind windows.
    Never penetrate visible rotor -- the rotor is where airframes break.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, mountain-wave, rotor, lenticular, faa-h-8083-28]
  source_ref: |
    FAA-H-8083-28 Ch 16 Mountain Weather; body Discover.
  acs_codes: [PA.I.C.K3g, PA.I.C.K3b]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Wake turbulence: cause, the heavy-clean-slow rule, and avoidance."
  back: |
    Cause: wingtip vortices trailing from any aircraft generating lift.
    Strongest behind heavy / clean / slow airplanes -- the worst case is
    a heavy on takeoff or approach, low and slow with gear and flaps up.
    Forecast cue: traffic ahead of you.
    Avoidance: stay above the generating aircraft's flight path; on
    takeoff rotate before its rotation point and climb above its
    profile. ATC spacing is for separation; wake avoidance is the pilot's.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, wake, vortices, aim-7-3]
  source_ref: |
    AIM 7-3 Wake Turbulence; body Discover.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Wind-shear turbulence: where does it sit and what are the forecast cues?"
  back: |
    Cause: rapid change of wind with altitude over a few hundred to a
    few thousand feet. Common at frontal boundaries, in microburst
    outflow, and below the friction layer at sunrise / sunset.
    Forecast cue: PIREPs reporting airspeed loss / gain on approach
    (>=10 KT change is windshear by definition), strong low-level wind
    shifts in TAFs, AIRMET TANGO for non-convective shear.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, wind-shear, microburst, ac-00-54]
  source_ref: |
    AC 00-54 Pilot Windshear Guide; AIM 7-1-19 Microbursts; body Discover.
  acs_codes: [PA.I.C.K3g, PA.I.C.K3b]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Turbulence intensity definitions per AIM 7-1-23 -- light vs moderate vs severe vs extreme."
  back: |
    Light: slight, erratic changes in altitude / attitude.
    Moderate: definite jolts; aircraft remains in control.
    Severe: large abrupt changes; momentary loss of control.
    Extreme: aircraft tossed violently; structural damage possible.
    Severity is per-airplane: a Citation's 'moderate' can be a Cherokee's
    'severe.' This is why PIREPs include aircraft type -- the receiver
    weights the report by the difference between reporter and receiver.
  cardType: regulation
  kind: recall
  tags: [weather, turbulence, intensity, pirep, aim-7-1-23]
  source_ref: |
    AIM 7-1-23 Turbulence; body Reveal table.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "UUA (urgent PIREP) trigger thresholds for turbulence?"
  back: |
    Severe or extreme turbulence triggers UUA (urgent dissemination).
    Moderate turbulence is reportable as a routine UA and worth filing.
    The split matters because a UUA gets immediate distribution to Flight
    Service and ATC; a UA enters the normal product cycle. File the
    correct type when you encounter the conditions.
  cardType: regulation
  kind: recall
  tags: [weather, turbulence, uua, pirep, aim-7-1-19]
  source_ref: |
    AIM 7-1-19 Pilot Weather Reports; body Reveal.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Classification drill: AIRMET TANGO + low-level winds 35 KT + rough terrain on the windward side. What's the turbulence type?"
  back: |
    Mechanical. Surface wind > 25 KT plus terrain on the windward side is
    the classic mechanical-turbulence forecast cue. The friction layer
    extends 2,000-3,000 ft AGL; above it the air smooths out. Avoidance:
    climb above the friction layer, or wait for the wind to drop, or
    deviate around the rough-terrain segment.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, mechanical, classification]
  source_ref: |
    Body Verify drill.
  acs_codes: [PA.I.C.K3g]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence

- front: "Classification drill: cross-ridge wind 40 KT in a stable air column with lenticular clouds visible downwind. What's the turbulence type and what's the operational constraint?"
  back: |
    Mountain-wave. The 40 KT cross-ridge + stable air aloft + visible
    lenticulars is the textbook mountain-wave setup. Operational
    constraint: cross perpendicular, at altitude (50% above the highest
    peak on the leeward side), at a 45-degree angle so you can roll out
    and escape in two seconds, and never penetrate visible rotor. The
    wave itself is smooth; the rotor below the crest is where airframes
    fail.
  cardType: basic
  kind: recall
  tags: [weather, turbulence, mountain-wave, lenticular, classification]
  source_ref: |
    Body Verify + Discover.
  acs_codes: [PA.I.C.K3g, PA.I.C.K3b]
  source_authority:
    - kind: ac
      cite: AC 00-30C Clear Air Turbulence Avoidance
    - kind: aim
      cite: AIM 7-1-23 -- Turbulence; 7-3-1 to 7-3-9 -- Wake Turbulence
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 19 -- Turbulence
:::

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
