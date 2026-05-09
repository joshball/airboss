---
id: wx-product-surface-analysis-and-cva
title: Surface Analysis and Ceiling/Visibility Charts
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, conceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires: []
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-airmasses-and-fronts
  - wx-product-gfa

modalities: [reading, cards]
estimated_time_minutes: 25
review_time_minutes: 4

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Surface Analysis Chart and CVA sections
    note: Format spec for symbols, contour intervals, and update cycle.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 23 -- Analyses
    note: Reading the synoptic picture from a surface analysis.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Where the products live and update cadence.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can identify high / low pressure centers, warm / cold / occluded
  fronts, and isobar spacing on a surface analysis chart, and can read the
  Ceiling and Visibility Chart (CVA) to extract observed ceiling and
  visibility along a planned route.
---

# Surface Analysis and Ceiling/Visibility Charts

## Context

Two pilots brief the same flight from KSAC to KRDD. One opens the METAR
strip and reads field-by-field; the other opens the surface analysis
chart, sees a cold front draped across the Sacramento Valley with
isobars packed tight on the back side, and immediately knows the
crosswind is going to be strong and gusty all afternoon. Same data,
different layer of abstraction.

## Problem

METARs / TAFs / PIREPs give you point observations and point forecasts.
Surface analysis and ceiling/visibility charts give you the whole field
-- pressure systems, frontal boundaries, where ceilings are low and
where they are not, in one image. They convert dozens of station
reports into a synoptic picture you can scan in seconds.

## Discover

Look at any surface analysis chart and ask: where is the energy?

- Closed isobars labeled `H` or `L` mark high / low centers. Pressure
  gradient (isobar spacing) drives wind speed: tightly packed = strong
  surface winds, widely spaced = light.
- Front symbols carry direction and character: blue triangles point
  the direction a cold front is moving; red half-circles point the
  direction a warm front is moving; alternating purple symbols mark
  occlusions; solid magenta with both = stationary.
- Station models around the chart show wind, temperature, dew point,
  visibility, weather, sky cover for individual reports -- in compact
  symbology that compresses a full METAR into a one-cell glyph.

The CVA (Ceiling and Visibility Chart, also called Ceiling and
Visibility Analysis) is the operational complement: it color-codes
observed ceiling and visibility into VFR / MVFR / IFR / LIFR categories
across CONUS with one-hour refresh. You can scan a route in seconds and
see if the white (VFR) wraps your full path or if you'll cross into
yellow (MVFR) or red (IFR) along the way.

## Reveal

Surface analysis update cadence: every 3 hours (00, 03, 06, 09, 12, 15,
18, 21Z) by the Weather Prediction Center. The chart is hand-analyzed,
not algorithmic, so a human meteorologist's interpretation of the
station network is what you see.

CVA update cadence: hourly, on the hour, with a near-real-time refresh.
Categories:

| Category | Ceiling     | Visibility |
| -------- | ----------- | ---------- |
| VFR      | > 3,000 ft  | > 5 SM     |
| MVFR     | 1,000-3,000 | 3-5 SM     |
| IFR      | 500-999 ft  | 1-3 SM     |
| LIFR     | < 500 ft    | < 1 SM     |

For VFR planning the CVA is the fastest "is the route open?" answer
available. For instrument planning the surface analysis is the fastest
"why is the route closed?" answer.

## Practice

Pull up an active surface analysis on aviationweather.gov. Find a low
pressure center. Trace the isobars outward and predict surface wind
direction (counterclockwise around a low in the northern hemisphere,
deflecting outward across the isobars due to friction). Find a frontal
boundary; predict the wind shift across it (typically backing as a cold
front passes). Now overlay the CVA: the lows and fronts almost always
correlate with the MVFR/IFR color shifts. The synoptic picture and the
ceiling picture are the same story told two ways.

## Connect

Surface analysis is the parent of K3e (air masses and fronts) -- it
shows fronts as a one-image picture. CVA is the parent of S3 -- it
answers "is the planned route VFR?" in seconds. K2 lists both as
required products; in practice they are the bookends to a serious
preflight (synoptic at the start, point forecasts in the middle, CVA
at the end as the integration check).

## Verify

Open a current surface analysis chart and a current CVA. Without
reading any METARs, write a one-paragraph story: where the highs and
lows are, what fronts are active, and where ceilings are low along
your planned route. Cross-check against the underlying METARs after.
The story should match.
