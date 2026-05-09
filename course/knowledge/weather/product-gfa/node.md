---
id: wx-product-gfa
title: Graphical Forecasts for Aviation (GFA)
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, procedural]
technical_depth: working
stability: evolving

minimum_cert: private
study_priority: critical
requires:
  - wx-reading-metars-tafs
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-airmets-sigmets
  - wx-product-surface-analysis-and-cva

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Graphical Forecasts for Aviation section
    note: Format spec for the Aviation Forecast Discussion / GFA tool layers.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Forecasts
    note: GFA is the post-Area-Forecast replacement; this chapter explains the migration and current format.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Operational use of the GFA in preflight briefing.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can navigate the GFA tool on aviationweather.gov, switch
  between observation and forecast time slices and the standard layer
  set (clouds, weather, ceiling/visibility, precipitation, icing,
  turbulence), and use the result to brief a route across multiple
  forecast hours.
---

# Graphical Forecasts for Aviation (GFA)

## Context

You're planning a 250 NM cross-country that takes you from clear coastal
air across a forecast frontal passage into clear continental air. The
TAFs at your departure and destination both look fine -- but the route
between them passes through an area with no terminal, and your METARs
are silent on what's happening there. Where do you look?

## Problem

METARs and TAFs are tied to airports. PIREPs are tied to where pilots
are flying. Surface analysis charts are point-in-time. None of them
answers "what will it look like 90 NM north of nothing in three hours?"
The Graphical Forecast for Aviation (GFA) was built to fill that gap --
a continuous 2D forecast field you can scrub through time.

## Discover

Open aviationweather.gov/gfa and walk the controls:

- A map of CONUS with overlays you can toggle: clouds, weather, ceiling
  and visibility, precipitation, icing, turbulence, winds.
- A time slider running from 14 hours in the past (observations) through
  the current hour (analysis) and forward to +15 hours (forecast).
- Layer-specific sub-options: clouds split into ceiling and tops; icing
  split into severity and altitude band; turbulence split into severity
  and altitude.

The interface is the product. There is no text equivalent the way there
once was for the Area Forecast (FA) -- the GFA replaced the textual FA
in 2017 because the spatial picture is the right form for area-scale
weather questions.

## Reveal

Layer summary:

| Layer      | What it shows                                    |
| ---------- | ------------------------------------------------ |
| Clouds     | Ceiling, tops, sky cover at selectable altitudes |
| Weather    | Forecast PCPN type and intensity                 |
| Cig/Vis    | Categorical CIG/VIS field (VFR/MVFR/IFR/LIFR)    |
| Precip     | Forecast precip rate / type / intensity          |
| Icing      | Severity + altitude band, sourced from FIP / CIP |
| Turbulence | Severity + altitude band                         |
| Winds      | Surface and aloft wind / temperature fields      |

GFA refresh cadence: hourly for observations / analyses, every three
hours for the forward forecast. The tool stitches together AIRMETs,
SIGMETs, the FIP/CIP icing model, the GTG turbulence model, and the
NDFD weather grids into one front-end. So when you read GFA you are
implicitly reading those underlying products at a higher abstraction.

## Practice

For tomorrow's flight, scrub the GFA at +6 hours over your planned
route at three layers: surface (winds), cruise altitude (clouds, icing,
turbulence), and the destination terminal area (cig/vis). Note any
color discontinuities along the route. Each one is a question to ask
the briefing or a hazard to plan around.

For a real "is this route flyable?" check, set the time to your planned
ETA and toggle the cig/vis layer. If the route passes through yellow
(MVFR) or red (IFR) blocks at any forecast hour you'll be airborne, the
GFA has just identified the hazard window.

## Connect

GFA is the spatial integration of the underlying weather products. It
inherits AIRMET / SIGMET hazards, the FIP/CIP icing forecast, the GTG
turbulence forecast, and NDFD weather grids. Reading the GFA without
understanding what feeds it produces overconfidence; the K2g node on
AIRMETs/SIGMETs is the depth complement to this node's breadth.

## Verify

Walk a real route on the GFA tool from the departure to the destination,
hour by hour from now to ETA. Identify every layer that changes color
along the path. For each change, name the underlying product or model
that drove the change. If you can't, you don't yet know what the GFA is
showing you -- you're just reading colors.
