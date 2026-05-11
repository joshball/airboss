---
id: wx-clouds-and-precipitation
title: Clouds, Temperature/Moisture, and Precipitation
domain: weather
cross_domains: [flight-planning]

knowledge_types: [conceptual, factual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-stability-and-instability
deepens: []
applied_by:
  - wx-thunderstorm-hazards
  - wx-icing-types-and-avoidance
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-airmasses-and-fronts
  - wx-fog-and-visibility-obstructions

modalities: [reading, cards, visualization]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-6B
    detail: Aviation Weather, chapters on moisture, clouds, and precipitation
    note: Foundational treatment of dew point spread, cloud classification, precipitation formation.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation
    note: Modern consolidated reference.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 12 -- Weather Theory
    note: Pilot-pitch introduction to cloud classification and precipitation forms.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the four cloud families and the ten primary genera,
  estimate cloud bases from temperature / dew point spread, distinguish
  precipitation types (rain / drizzle / freezing rain / snow / hail) by
  formation mechanism, and read a METAR's sky condition + precipitation
  group as one unified picture.
---

# Clouds, Temperature/Moisture, and Precipitation

## Context

You taxi out at 0700Z on a humid morning. The METAR reports temperature
20C, dew point 18C, sky clear. By the time you reach the runway,
a thin scattered layer has formed at 600 ft. By the time you climb
through 2,000 ft you're in solid stratus. What changed? Nothing in the
synoptic picture: the sun heated the surface 1 degree, a parcel rose,
hit the LCL, and turned into cloud. The temperature/moisture state of
the column always determined where the cloud base would be.

## Problem

Clouds are visible water -- the optical signature of the atmospheric
moisture state crossing condensation. Reading them correctly requires
understanding what produces them. Precipitation is the next step --
visible water heavy enough to fall. Both are direct consequences of
the temperature / dew point relationship and the lifting mechanism in
play.

## Discover

Start with a basic equation: a parcel of air rising adiabatically cools
at ~3C / 1,000 ft (dry rate) until it reaches saturation -- when its
temperature equals its dew point. Above that altitude (the lifting
condensation level, LCL), excess moisture condenses into cloud and
the parcel cools at the slower moist rate (~1.5-2.5C / 1,000 ft
depending on temperature).

For a quick estimate of cloud base from a surface report:

LCL_AGL ≈ (T - Td) / 4.4 in thousands of feet (T and Td in C)

Or memorably: each 4-5 degrees C of temperature/dew-point spread is
~1,000 ft to cloud base. A 20/15 spread says 1,000 ft AGL bases. A
20/10 spread says ~2,500 ft AGL bases. A 20/-2 spread says clear
skies and dry air to high altitude.

Now classify what you see. Clouds organize into four families by
altitude and morphology:

- High clouds (above 20,000 ft): cirrus, cirrostratus, cirrocumulus.
  Ice crystals; non-threatening on their own.
- Middle clouds (6,500-20,000 ft): altostratus, altocumulus.
  Mixed-phase; mild icing risk in altostratus, mostly visual indicator.
- Low clouds (below 6,500 ft): stratus, stratocumulus, nimbostratus.
  Liquid water below the freezing level; major IFR / icing source.
- Vertical-development clouds (any altitude): cumulus, towering
  cumulus, cumulonimbus. Convective; turbulence + icing + lightning +
  hail in the worst cases.

The morphology is diagnostic. Stratus says stable air; cumulus says
unstable; towering cumulus says strongly unstable; cumulonimbus says
the unstable column has reached the tropopause.

## Reveal

Precipitation type follows from cloud type and the temperature
profile under it:

- Drizzle (DZ): tiny droplets from low stratus / stratocumulus.
- Rain (RA): liquid drops, anywhere convective or stratiform.
- Freezing rain (FZRA): rain falling through a sub-freezing surface
  layer, refreezing on impact. The most dangerous icing scenario in
  GA -- a warm layer aloft, cold below, the SLD problem ATR-72
  Roselawn made permanent.
- Snow (SN): ice crystals all the way down, surface temp at or
  below freezing.
- Ice pellets (PL / IP): rain that froze before reaching the surface;
  evidence of a sub-freezing surface layer with warm aloft.
- Hail (GR / GS): convective process; hailstones cycle through the
  updraft accreting layers.

Precipitation intensity in METARs: light (-), moderate (no prefix),
heavy (+). A `+TSRA` is a heavy thunderstorm with rain -- the
operational signal for "stay clear, expect violent IMC."

Visibility responds to precipitation in regular ways. Light rain
typically drops vis to 4-6 SM; moderate rain to 2-3 SM; heavy rain
to under 1 SM. Snow drops vis faster: light snow can already be
1-2 SM, moderate snow under 1 SM, heavy snow near zero.

## Practice

For your next flight, predict cloud base from the surface
temperature/dew point spread, then check actual against METAR or
visual observation after takeoff. Build the calibration that the
formula is reliable to about 500 ft for unstable air and 1,000 ft
for stable air.

For precipitation: check forecast type (TAF), forecast intensity, and
freezing level. Any time the freezing level is within 4,000 ft of
your cruise altitude in precipitation, icing is the active question
to brief.

## Connect

This node is the parent of K3i (icing -- which is "freezing
precipitation in cloud") and K3h (thunderstorms -- "convective
clouds with vertical development to the tropopause"). The stability
node feeds it; the airmasses-and-fronts node provides the lifting
mechanisms that drive cloud formation.

## Verify

Pick a METAR with sky condition and precipitation. Without seeing the
sky, describe the cloud type that produced the reported precipitation
form. Then describe the parent stability state. The chain METAR ->
clouds -> stability is the inverse of the brief-then-fly direction
and tests the same understanding.
