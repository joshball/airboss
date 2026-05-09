---
id: wx-equipment-and-data-limitations
title: Weather Equipment and Data Limitations
domain: weather
cross_domains: [decision-making]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: evolving

minimum_cert: private
study_priority: critical
requires:
  - wx-flight-deck-weather-displays
  - wx-product-airmets-sigmets
deepens: []
applied_by:
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-data-sources

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-63A
    detail: Use of Cockpit Displays of Digital Weather and Aeronautical Information
    note: Limitations of FIS-B / SiriusXM / EFB-mediated weather data.
  - source: NTSB Safety Alert SA-017
    detail: In-Cockpit NEXRAD Mosaic Imagery
    note: The reference accident-pattern document for tactical use of strategic data.
  - source: AC 00-45H
    detail: Aviation Weather Services
    note: Forecast confidence and the difference between observation, analysis, and forecast.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts
    note: Modern consolidated treatment of forecast skill, model resolution, and reporting gaps.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can articulate the principal limitations of (a) onboard
  weather equipment (radar attenuation, NEXRAD age), (b) aviation
  weather reports and forecasts (point vs. area, model error, station
  spacing), and (c) inflight weather resources (datalink latency,
  ATC ride reports), and adjust briefing and divert decisions to
  account for each.
---

# Weather Equipment and Data Limitations

## Context

You're departing on a 200 NM IFR cross-country in widely scattered
convection. Your EFB shows clear gaps between cells. Your onboard
radar shows the same gaps. ATC has no PIREPs and no ride reports.
You feel well-briefed. Three hours later you're on the ground at an
unplanned airport with hail dents in the leading edges and a
pacemaker installed because the "gap" you flew through closed
behind a 12-minute-old NEXRAD picture and an attenuated radar return.

## Problem

Every weather product in the cockpit and every forecast in the brief
has a documented failure mode. Knowing the failure modes -- not just
the products -- is what keeps the brief honest. The same NEXRAD
picture is information at a 30-NM stand-off and misinformation at a
3-NM penetration; the difference is whether the pilot understands
the latency.

## Discover

The limitations sort into three families per R2:

R2a -- onboard weather equipment limitations:

- Onboard radar (Bendix-King RDR, etc.) shows precipitation
  intensity, not turbulence. A dry hailshaft or a clear-air
  microburst is invisible.
- Onboard radar attenuates: the first heavy cell along the radar's
  line of sight reflects so much energy that whatever's behind it
  appears as a "shadow" of low return. Pilots have flown into the
  shadow expecting clear air and found a second equally severe cell.
- Lightning detection (Stormscope, FIS-B lightning) shows electrical
  activity, not precipitation. A heavy snow shower without lightning
  is invisible.
- ADS-B FIS-B requires a ground-station line of sight; coverage
  drops below 5,000 ft AGL and disappears in mountain shadows.

R2b -- weather report and forecast limitations:

- METARs are point observations. The airport reports clear; the
  surrounding 5 NM may have widely varying conditions, especially
  in convective or terrain-affected regimes.
- METAR sky condition is what's overhead the sensor: a single 100
  ft-wide hole over a sensor reads "BKN below" while reality is
  "OVC across the field."
- TAFs are issued for a 5 NM radius around the airport for 24-30
  hours. Confidence drops sharply with horizon. Probability groups
  (PROB30, PROB40) in the TAF body indicate the forecaster's own
  uncertainty.
- AIRMET / SIGMET areas are smoothed polygons drawn around forecast
  hazardous conditions. Real boundaries are fuzzy and shift; expect
  conditions inside the polygon and at least 25 NM beyond it.
- Convective forecasts (Day 1 outlook, Convective SIGMET) are
  ensemble-skill products. They tell you where convection is
  likely; they cannot tell you which specific cell will develop.
- Wind aloft forecasts are model output: the FB is a 12-hour-old
  forecast of the wind at your cruise altitude. In dynamic
  atmospheres (frontal passage, mountain wave) the actual wind
  diverges from forecast by 30-40 KT.

R2c -- inflight weather resource limitations:

- ATC ride reports are sparse and reporter-biased. "Smooth at 80"
  was reported by a 757 and means nothing for a Cessna 150 at the
  same altitude.
- Flight Service in-flight briefings depend on Leidos's coverage
  of your altitude and area; coverage gaps exist.
- Datalink products in the cockpit have the latency described in
  the flight-deck-displays node.
- PIREPs are voluntary; absence of PIREPs is not absence of
  hazard, especially at unusual altitudes or at non-peak hours.

## Reveal

Operational rules:

- Treat any in-cockpit NEXRAD picture as 10-15 minutes stale even
  when the age indicator says less.
- Stand off 20 NM from any cockpit-displayed echo for thunderstorm
  avoidance; 5 NM only when visually confirmed or onboard-radar
  confirmed.
- Build briefing margin: if the brief says VFR margins are tight,
  expect them to be tighter on arrival than the brief showed.
- Trust the truth-up: a PIREP confirming icing or turbulence
  outranks the AIRMET that forecasted absence; an absent PIREP does
  not refute a forecast hazard.
- Trust your eyes when they disagree with the data: every "but the
  radar showed clear" accident has the same quote in the
  toxicology report.

## Practice

For your next flight: identify, before takeoff, the limitation that
matters most for the day's brief. If convection is forecast, the
limit is NEXRAD latency. If frontal passage is forecast, the limit
is forecast wind error. If point IFR is forecast, the limit is METAR
station coverage. Pre-naming the dominant limitation lets you
calibrate the rest of the brief against it.

## Connect

R2 in the ACS asks specifically about these three families of
limitation. This node is the umbrella; the flight-deck-displays
node, the airmets-sigmets node, and the data-sources node provide
the depth on each. The go/no-go node consumes this understanding to
weight the briefing inputs appropriately.

## Verify

For three different forecast scenarios, articulate the dominant
limitation in one sentence each:

- Tomorrow's flight: VFR forecast, ceiling 4000 ft, no convection
  expected -> dominant limitation: ceiling forecast skill (TAF
  confidence at +12 hr is moderate at best).
- Tomorrow's flight: convection forecast over the mountains in the
  afternoon -> dominant limitation: NEXRAD latency in the cockpit.
- Tomorrow's flight: night IFR through layer cloud -> dominant
  limitation: icing forecast at altitude (FIP/CIP grids vs. PIREP
  truth-up).

If you can name the limitation in a sentence, you are equipped to
brief against it.
