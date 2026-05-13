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
    detail: Aviation Weather Handbook, Chapter 25 -- Analysis
    note: Reading the synoptic picture from a surface analysis (Surface Analysis Chart §25.2.3, Unified Surface Analysis §25.2.4).
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

The surface analysis is the synoptic-symbol cousin in the
encoded-text family (see
[wx-reading-metars-tafs](../reading-metars-tafs/node.md)). Same
three-stage skill ladder, different alphabet:

- **Decode** -- the chart symbols (H / L pressure centers, isobars,
  cold / warm / occluded / stationary front symbols, station models
  with their compressed METAR glyphs). The station model is itself a
  miniature METAR -- a learner who can read a METAR can read a
  station model with about ten minutes of practice.
- **Understand** -- what synoptic story produced this picture? Where
  is the energy, where is it going, what airmass is replacing what?
  This is the layer where the surface analysis stops being a chart
  and starts being a forecast in your head.
- **Triage** -- for a given route at a given time, which features
  on the chart matter? An occluded front 800 NM north of the route
  is irrelevant; a tight pressure gradient over the route's middle
  third is the operational signal. The CVA is the triage shortcut:
  it converts the whole synoptic picture into a single VFR / MVFR /
  IFR / LIFR color along the route.

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

### Cards (spaced repetition)

Cards mined from the body. CVA category cards lock the VFR/MVFR/IFR/
LIFR thresholds; cadence cards build the planning rhythm; the synoptic-
vs-ceiling card carries the bookend pedagogy.

```yaml-cards
- front: "CVA categories -- match each to its ceiling and visibility thresholds."
  back: |
    VFR: ceiling > 3,000 ft AND visibility > 5 SM.
    MVFR: ceiling 1,000-3,000 ft OR visibility 3-5 SM.
    IFR: ceiling 500-999 ft OR visibility 1-3 SM.
    LIFR: ceiling < 500 ft OR visibility < 1 SM.
    The thresholds are the same as the standard flight-category map; the
    CVA just renders them as one color per location across CONUS.
  cardType: basic
  kind: recall
  tags: [weather, cva, vfr, mvfr, ifr, lifr, ac-00-45h]
  source_ref: |
    AC 00-45H CVA section; body Reveal table.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Surface Analysis Chart update cadence and authoring authority?"
  back: |
    Every 3 hours (00, 03, 06, 09, 12, 15, 18, 21Z) by the Weather
    Prediction Center (WPC). The chart is hand-analyzed, not algorithmic
    -- a human meteorologist's interpretation of the station network is
    what you see. Two pilots reading the same data points can produce
    slightly different analyses, and the WPC product is the canonical
    one for flight planning.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, wpc, cadence, ac-00-45h]
  source_ref: |
    AC 00-45H; FAA-H-8083-28 Ch 25; body Reveal.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "CVA update cadence vs Surface Analysis update cadence?"
  back: |
    CVA: hourly, on the hour, with near-real-time refresh.
    Surface Analysis: every 3 hours.
    The CVA is the faster product because it consumes METAR / SPECI
    observations directly; the surface analysis takes additional time
    because it requires the human analyst's interpretation step.
  cardType: basic
  kind: recall
  tags: [weather, cva, surface-analysis, cadence, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "When is the CVA the right product to reach for, and when is the Surface Analysis?"
  back: |
    CVA: fastest 'is the route open?' answer for VFR planning. One scan
    along the route's color band and you know.
    Surface Analysis: fastest 'why is the route closed?' answer for
    instrument planning. The pressure systems, fronts, and isobar
    spacing explain *why* the CVA shows the colors it does.
    They're bookends: synoptic at the start of a serious brief, point
    forecasts in the middle, CVA at the end as the integration check.
  cardType: basic
  kind: recall
  tags: [weather, cva, surface-analysis, briefing-order, ac-00-45h]
  source_ref: |
    Body Reveal + Connect.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Northern-hemisphere surface wind rotation: around a Low vs around a High?"
  back: |
    Around a Low: counterclockwise, deflecting outward across the isobars
    due to friction (10-30 degrees of cross-isobar angle at the surface).
    Around a High: clockwise, deflecting outward.
    Tracing isobars around a center and applying the rotation rule gives
    you predicted wind direction at any station -- a cross-check against
    the station-model wind barbs on the chart.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, pressure-systems, wind, ac-00-6]
  source_ref: |
    AC 00-6B Wind chapter; body Practice.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Two pilots brief the same KSAC->KRDD flight. One opens the METAR strip and reads field-by-field; the other opens the surface analysis and sees a cold front draped across the valley with tight isobars on the back side. Why does the second pilot finish the brief faster and with more confidence?"
  back: |
    Layer of abstraction. METARs are point observations -- decoding them
    one at a time builds the picture from the inside out. The surface
    analysis converts dozens of station reports into one synoptic image,
    decoded in seconds. Same data, different layer; the second pilot
    knows immediately the crosswind will be strong and gusty on the
    back side of the front, because the isobar packing said so before
    any single METAR was read.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, synoptic, briefing-efficiency]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. Trains the reframing: the
    surface analysis isn't 'an extra product' -- it's a different layer
    of abstraction that compresses the same data.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Where does the Surface Analysis sit in the encoded-text family triage step?"
  back: |
    For a given route at a given time, which features on the chart matter?
    An occluded front 800 NM north of the route is irrelevant; a tight
    pressure gradient over the route's middle third is the operational
    signal. The CVA is the triage shortcut -- it converts the whole
    synoptic picture into a single VFR/MVFR/IFR/LIFR color along the
    route. Same triage discipline as METAR/TAF: decode is prerequisite,
    triage is the goal.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, cva, triage, encoded-text-family]
  source_ref: |
    Body Discover triage step.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Station model on a surface analysis chart -- what is it and what's the fast on-ramp to reading it?"
  back: |
    A station model is a miniature METAR: compact glyph showing wind
    direction (barb), speed (flags / barbs), temperature (top-left),
    dew point (bottom-left), sea-level pressure (top-right), sky cover
    (circle fill), current weather (left of circle). A learner who can
    read a METAR can read a station model with about ten minutes of
    practice -- the fields are the same, the rendering is graphical.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, station-model, metar, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "How does the CVA correlate with the surface analysis on a typical frontal-passage day?"
  back: |
    The lows and fronts on the surface analysis almost always correlate
    with the MVFR / IFR color shifts on the CVA. The synoptic picture
    (where the energy is) and the ceiling picture (where the visibility
    and ceiling fall below VFR) are the same story told two ways. When
    they don't correlate, the deviation is itself information -- maybe a
    local effect, station siting, or marine-layer pocket independent of
    the synoptic flow.
  cardType: basic
  kind: recall
  tags: [weather, surface-analysis, cva, correlation]
  source_ref: |
    Body Practice + Verify.
  acs_codes: [PA.I.C.K2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Surface Analysis Chart and CVA sections
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 25 -- Analysis
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products
```

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
