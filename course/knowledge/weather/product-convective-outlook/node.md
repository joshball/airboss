---
id: wx-product-convective-outlook
title: Convective Outlook (AC)
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, conceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires:
  - wx-thunderstorm-hazards
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-airmets-sigmets

modalities: [reading, cards]
estimated_time_minutes: 20
review_time_minutes: 4

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Convective Outlook section
    note: Format spec for the SPC Day 1 / 2 / 3-8 outlooks.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Forecasts
    note: Convective outlook context within the broader forecast suite.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Operational use of convective outlooks for flight planning.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can read the SPC convective outlook risk categories
  (general / marginal / slight / enhanced / moderate / high), state the
  forecast horizon of each day's product, and use it as the strategic
  layer above same-day Convective SIGMET / radar tactics.
---

# Convective Outlook (AC)

The convective outlook is a graphical product, not encoded text in the
strict METAR / TAF sense -- but the same three-stage skill applies:

- **Decode** -- the categorical risk tiers (TSTM / MRGL / SLGT / ENH /
  MDT / HIGH), the day-window the outlook covers, the percent-
  probability convention used in the Day 4-8 product. The convention
  is small but the categories repeat across every issuance and
  recognizing them at a glance is the floor.
- **Understand** -- the synoptic setup that drove the polygons. The
  text discussion is where the forecaster explains why a trough,
  dryline, instability budget, or shear environment justified the
  category. The map without the discussion is a guess about a guess.
- **Triage** -- a categorical risk over the route within the day's
  window is a "this flight needs more weather attention" trigger,
  not yet a no-go. The triage question is: at what tier do I shift
  from monitoring to actively planning around convection? For a
  light single, that line is around SLGT; for a turboprop with
  onboard radar, ENH.

(Family pattern reference:
[wx-reading-metars-tafs](../reading-metars-tafs/node.md).)

## Context

It's Tuesday night and you're planning a Saturday flight. METARs and
TAFs only cover ~30 hours; the GFA caps at +15. You can't get a tactical
forecast for Saturday. But you can get a strategic one: the Storm
Prediction Center's Day 4-8 Convective Outlook (AC) will tell you
roughly where severe storms are most likely four to eight days out.

## Problem

Convective weather is the single biggest cause of weather-related GA
accidents. The SIGMETs and Convective SIGMETs that warn you operate on a
1-6 hour horizon. The convective outlook is the strategic complement: a
1-8 day horizon picture of where convective activity is likely. It
doesn't tell you "go" or "no-go" -- it tells you "this trip merits
extra caution starting now," which is its own kind of decision.

## Discover

Open spc.noaa.gov and look at today's Day 1 outlook (now -> 12Z
tomorrow). It's a categorical map with five tiers of severe-weather
risk overlaid on CONUS:

- General Thunderstorms (TSTM) -- ordinary convection expected.
- Marginal (MRGL, 1) -- isolated severe possible.
- Slight (SLGT, 2) -- scattered severe.
- Enhanced (ENH, 3) -- numerous severe.
- Moderate (MDT, 4) -- widespread severe likely.
- High (HIGH, 5) -- widespread severe and intense.

The categories grade two things together: probability of severe weather
within 25 miles of any point, and expected intensity (hail size, wind
gust speed, tornado density).

Now compare to the Day 2 (12Z tomorrow -> 12Z day after) and Day 3
(12Z day after -> 12Z next day) outlooks. The categories are the same;
the confidence is lower. The Day 4-8 outlook is a single product with
a percent-probability map rather than categorical labels because the
forecast skill is too soft for clean categories that far out.

## Reveal

Update cadence:

| Product       | Issued                                            |
| ------------- | ------------------------------------------------- |
| Day 1 outlook | 0600, 1300, 1630, 2000, 0100Z (5 issuances daily) |
| Day 2 outlook | 0600, 1730Z                                       |
| Day 3 outlook | 0830Z                                             |
| Day 4-8       | 0830Z (one issuance, 5-day band)                  |

The product is text plus a graphic. The text discussion explains the
synoptic setup the SPC forecaster sees: shortwave troughs, dryline
position, instability budget, shear environment. Reading the discussion
calibrates how to weight the categorical map -- a high-confidence MDT
risk reads differently from a low-confidence one inside the same
category.

For routine VFR cross-countries, the relevant question is: does the
day's outlook show categorical convection risk over the planned route?
If yes, the rest of the convective tools (Convective SIGMET, NEXRAD,
storm-scale interrogation) move from background reading to active
monitoring, ideally before the wheels leave the ground.

## Practice

For your next planned cross-country: pull the Day 1, Day 2, Day 3 SPC
outlooks. Identify whether the route or destination falls under any
risk category. If yes, read the discussion text. If you can't articulate
why the SPC drew the polygons where they did, you don't yet trust the
forecast -- you're just reading a colored map.

## Connect

The convective outlook is the strategic layer above the Convective
SIGMET (tactical, 0-2 hour) and NEXRAD radar (real-time). All three are
talking about the same convection at three time horizons. The
thunderstorm-hazards node covers what to do when convection is present;
this node covers when to start watching for it.

## Verify

Compare yesterday's Day 1 convective outlook to yesterday's actual
Convective SIGMETs. The polygons should overlap heavily (the SPC's
Day 1 forecast is generally skillful). When they don't, the discussion
text should explain the surprise. Building a sense of when SPC is
right and when SPC is wrong is the meta-skill behind using this
product well.
