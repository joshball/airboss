---
id: wx-stability-and-instability
title: Atmospheric Stability and Instability
domain: weather
cross_domains: [aerodynamics]

knowledge_types: [conceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-thunderstorm-hazards
  - wx-clouds-and-precipitation
  - wx-turbulence-types
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-airmasses-and-fronts

modalities: [reading, cards, visualization]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, Stability chapter
    note: Foundational treatment of dry vs moist adiabatic lapse and stability classes.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 5 -- Stability of the Atmosphere
    note: Modern reference for absolute / conditional / neutral stability.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
    note: Pilot-pitch introduction to stability and its operational consequences.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can define stable / unstable / conditionally unstable
  atmospheres in terms of lapse rate vs. dry and moist adiabatic
  reference rates, predict the cloud type / turbulence character /
  precipitation form for each stability class, and read a temperature
  trend on a METAR strip to infer stability without a sounding.
---

# Atmospheric Stability and Instability

## Context

Two flights leave the same airport at the same hour. One pilot reports
a glass-smooth climb to cruise; the other, an hour later, gets pummeled
in cumulus to 8,000 ft. The difference isn't pilot technique or
airplane. The atmosphere stabilized at sunset and destabilized at
sunrise. Stability is the parameter that controls almost everything
else weather-related you'll experience aloft.

## Problem

Cloud type, precipitation pattern, turbulence character, visibility,
and the convective hazard inventory all depend on whether the air
column is stable or unstable. To brief weather competently you need to
read stability from the products available -- METARs, soundings,
graphics -- and to predict what the day is going to feel like at 5,000
ft from what the surface tells you at 1,500 ft.

## Discover

A parcel of air rising adiabatically (no heat exchanged with its
surroundings) cools at a fixed rate -- about 3 degrees C per 1,000 ft
when dry, about 1.5 degrees C per 1,000 ft when saturated. The
atmosphere's actual temperature profile (the environmental lapse rate,
ELR) determines whether a displaced parcel keeps rising or sinks back.

Three cases:

- ELR < moist adiabatic rate (~1.5C/1000 ft): a displaced parcel ends
  up cooler than its surroundings, sinks back. The atmosphere is
  absolutely stable. Air resists vertical motion.
- ELR > dry adiabatic rate (~3C/1000 ft): a displaced parcel ends up
  warmer than surroundings, keeps rising. Absolutely unstable. Air
  wants to convect.
- Moist adiabatic < ELR < dry adiabatic: the parcel's behavior depends
  on whether it's saturated. Conditionally unstable -- stable for dry
  air, unstable once moisture condenses and the slower moist rate
  takes over.

Most "interesting" weather happens in conditionally unstable air. A
small lifting trigger (heating, frontal lift, orographic forcing) can
push a parcel past saturation, after which it accelerates upward on
the difference between the moist adiabatic rate and the steeper ELR.
Cumulus, towering cumulus, cumulonimbus -- the convective cloud
sequence -- is the visible signature of conditional instability.

## Reveal

Operational table:

| Stability   | Cloud type     | Precip          | Turb           | Vis       |
| ----------- | -------------- | --------------- | -------------- | --------- |
| Stable      | Stratiform     | Continuous      | Smooth         | Reduced   |
| Unstable    | Cumuliform     | Showery         | Bumpy / strong | Excellent |
| Conditional | Mixed / sudden | Showery if lift | Building       | Variable  |

Surface signs of instability available in any METAR strip: large
diurnal temperature swings, gusty winds, scattered cumulus growing
through the day, dust devils, cumulus tops well above the haze
inversion. Surface signs of stability: stratus / fog at sunrise,
smooth winds, narrow temperature spread, thick haze layer.

Cooler weather comes after sunset because radiational cooling
re-stabilizes the surface; thunderstorms that built all afternoon often
fade after dark precisely because the stability profile shifts.

## Practice

Pull a current sounding (Skew-T) for any airport from the Storm
Prediction Center site. Trace the environmental temperature curve and
the dew point curve. Find the LCL (where they converge) and the LFC
(where the parcel becomes positively buoyant against the environment).
The area between the parcel ascent and the environment curve from LFC
upward -- the CAPE -- is the energy available for convection. A CAPE
above ~1,000 J/kg is meaningful; above 2,500 J/kg is severe-storm
territory.

If reading a Skew-T isn't yet fluent, fall back to the surface signs:
on a hot afternoon with cumulus building rapidly through the morning
and reports of dust devils, the air column is unstable to whatever
height the cloud bases reach. That's enough to brief and enough to
predict the ride at altitude.

## Connect

Stability is the parent concept under almost every other K3 leaf:
clouds (K3f), precipitation (K3d), turbulence (K3g), thunderstorms
(K3h), and visibility / fog (K3j) all change behavior between stable
and unstable atmospheres. The frontal-passage node depends on
stability change across the front. Recognizing stability is the meta
skill that makes the rest of the weather phenomena interpretable.

## Verify

For three different days this week, predict cloud type and turbulence
character from the morning METAR before takeoff. Cross-check against
the actual cruise-altitude experience. Calibrate. The skill develops
fast once predicted vs actual is your own data.
