---
id: wx-airmasses-and-fronts
title: Air Masses and Fronts
domain: weather
cross_domains: [flight-planning]

knowledge_types: [conceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-stability-and-instability
deepens: []
applied_by:
  - wx-go-nogo-decision
  - wx-clouds-and-precipitation
  - plan-vfr-cross-country
taught_by: []
related:
  - wx-product-surface-analysis-and-cva
  - wx-thunderstorm-hazards

modalities: [reading, cards, visualization]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, Air Masses and Fronts chapter
    note: Foundational treatment of source regions, frontal structure, and lift mechanisms.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 11 -- Air Masses, Fronts, and Other Boundaries
    note: Modern consolidated reference.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
    note: Pilot-pitch introduction including weather typically associated with each front type.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the principal air mass source regions, distinguish
  cold / warm / occluded / stationary fronts by symbol and weather
  signature, predict the cloud sequence and precipitation pattern that
  precedes each front type, and time a frontal passage from surface
  pressure trace.
---

# Air Masses and Fronts

## Context

You're looking at a surface analysis chart with a cold front draped
across your planned route, expected to pass through your destination
right at your ETA. Should you go? It depends on what kind of front,
what's on the back side, what season, and what airmasses are colliding.
A late-summer Pacific cold front produces a 30-minute squall line and
clears beautifully behind. A late-winter Arctic cold front produces a
day of low ceilings, snow showers, and blowing dust. Same chart symbol,
totally different decision.

## Problem

Synoptic-scale weather patterns are the framework underneath every
local product. Air masses set the character of the air; fronts are
where those characters fight. Knowing which front type is approaching,
what airmass is replacing what, and what sequence of weather to expect
turns a chart into a story you can plan against.

## Discover

Air masses get their character from their source region:

- Continental Polar (cP): cold, dry. Sourced from the Canadian
  interior. Brings clear, cold, stable air with shallow visibility
  reductions from haze or fog.
- Maritime Polar (mP): cool, moist. Sourced from the North Atlantic
  / Pacific. Brings stratocumulus, low ceilings, drizzle.
- Continental Tropical (cT): hot, dry. Sourced from northern Mexico /
  desert SW. Brings clear skies, dust, severe density-altitude
  problems.
- Maritime Tropical (mT): warm, very moist. Sourced from Gulf of
  Mexico / Atlantic / Pacific tropics. Brings convective potential
  when lifted, heavy precipitation, low cloud bases.

Fronts are the boundaries between dissimilar air masses. Four types,
each with a distinct symbol and weather signature:

- Cold front (blue triangles pointing direction of motion): cold air
  pushing under warm air. Steep frontal slope, vigorous lifting,
  often a narrow band of intense weather (squall line) along the
  front. Passes quickly. Behind: cooler, drier, often clear.
- Warm front (red half-circles pointing direction of motion): warm
  air overrunning cold air. Shallow frontal slope, gradual stratiform
  lift, broad band of stratiform clouds and continuous precipitation
  ahead of the surface front for hundreds of miles. Behind: warmer,
  more humid.
- Occluded front (alternating purple symbols): cold front catching
  up with warm front, warm air aloft. Cold-type or warm-type
  occlusion depending on which advancing air is colder. Often the
  least intense of the active fronts.
- Stationary front (alternating red and blue): essentially balanced
  airmasses; weather on both sides, slow to clear. Often the seed of
  a developing low.

## Reveal

Cold-front pre/post weather table:

| Phase   | Clouds       | Precip           | Wind             | Pressure        |
| ------- | ------------ | ---------------- | ---------------- | --------------- |
| Pre     | Cu, TCu, CB  | Showers, +TS     | Veering, gusty   | Falling         |
| Passage | CB / line    | Heavy, brief     | Rapid wind shift | Min then rising |
| Post    | Sc, then CLR | Showers tapering | Steady, cool     | Rising          |

Warm-front pre/post:

| Phase   | Clouds               | Precip          | Wind                | Pressure |
| ------- | -------------------- | --------------- | ------------------- | -------- |
| Pre     | Ci -> Cs -> As -> Ns | Steady RA / SN  | Backing, increasing | Falling  |
| Passage | Stratus / fog        | Drizzle / FZRA  | Slow shift          | Steady   |
| Post    | Lifting Sc           | Showers / clear | Steady warm         | Steady   |

Cold-front weather is intense and brief. Warm-front weather is mild
but extensive. The IFR approach in warm-frontal stratus may be
flyable; the VFR approach through a cold-front squall line is not.

## Practice

Find a current surface analysis with at least one front. For each
front: identify the type, the airmasses on either side, the direction
of motion (perpendicular to the front, in the direction of warm-front
half-circles or cold-front triangles), and predict the weather
signature on each side. Cross-check against the METARs at airports on
each side of the front.

For a planned flight, identify whether your route or ETA crosses any
front. If yes, build a timeline: when does the front cross the
airport? What conditions before, during, after? Match to the table
above.

## Connect

This node parents almost every weather-route decision. The clouds and
precipitation node tells you what specifically forms; this node tells
you why and where. The convective-outlook and thunderstorm nodes
inherit the frontal trigger mechanism. The surface-analysis node is
the visual diagnostic.

## Verify

Watch a frontal passage on a real surface analysis sequence (the
3-hourly archive on aviationweather.gov). Track how the front moved,
how the METARs along its path responded, and whether the textbook
sequence (above) actually played out. Real frontal passages don't
always match the schematic; the calibration of "how much is the
textbook reliable" comes from watching real ones.
