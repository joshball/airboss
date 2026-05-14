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
  - wx-product-sigmets

modalities: [reading, cards]
estimated_time_minutes: 20
review_time_minutes: 4

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Convective Outlook section
    note: Format spec for the SPC Day 1 / 2 / 3-8 outlooks.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
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
[wx-reading-metars](../reading-metars/node.md).)

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

:::cards

- front: "SPC convective outlook risk categories -- list the five tiers in order of severity."
  back: |
    1. General Thunderstorms (TSTM) -- ordinary convection expected.
    2. Marginal (MRGL, 1) -- isolated severe possible.
    3. Slight (SLGT, 2) -- scattered severe.
    4. Enhanced (ENH, 3) -- numerous severe.
    5. Moderate (MDT, 4) -- widespread severe likely.
    6. High (HIGH, 5) -- widespread severe and intense.
    The categories grade probability of severe weather within 25 miles of
    any point AND expected intensity (hail size, wind gust speed, tornado
    density) together.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, spc, categories, ac-00-45h]
  source_ref: |
    AC 00-45H Convective Outlook section; body Discover.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "What does each Day-N SPC outlook cover, and what's the issue cadence?"
  back: |
    Day 1: now -> 12Z tomorrow. Issued 5 times daily (0600, 1300, 1630,
    2000, 0100Z).
    Day 2: 12Z tomorrow -> 12Z day after. Issued twice (0600, 1730Z).
    Day 3: 12Z day after -> 12Z next day. Issued once (0830Z).
    Day 4-8: single product, percent-probability map (not categories),
    issued once at 0830Z covering a 5-day band.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, spc, cadence, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal cadence table.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Why is the Day 4-8 outlook published as percent probabilities instead of categorical labels?"
  back: |
    Forecast skill is too soft that far out for clean categorical bins.
    Percent probabilities communicate the underlying uncertainty more
    honestly -- a 30% probability is meaningful information; calling it
    'Slight' would imply a confidence the model doesn't have. The
    categorical labels reappear as confidence rises in the Day 1-3
    products.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, spc, day-4-8]
  source_ref: |
    AC 00-45H; body Discover.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Why does the SPC discussion text matter as much as the categorical map?"
  back: |
    The map is the rendering; the discussion is the reasoning. The text
    explains the shortwave troughs, dryline position, instability budget,
    and shear environment that drove the polygons. A high-confidence MDT
    risk reads differently from a low-confidence one inside the same
    category -- the discussion is where that distinction lives. 'The map
    without the discussion is a guess about a guess.'
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, spc, discussion, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover and Practice.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Convective outlook in the convective-brief layering: where does it sit relative to Convective SIGMET and NEXRAD?"
  back: |
    Strategic layer (1-8 days) above Convective SIGMET (tactical, 0-2 hours)
    and NEXRAD (real-time, minutes). All three describe the same convection
    at three time horizons. The convective outlook says 'this trip merits
    extra caution starting now'; the Convective SIGMET says 'a polygon is
    active in the next two hours'; NEXRAD says 'a cell is here right now.'
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, convective-sigmet, nexrad, layering]
  source_ref: |
    Body Connect; body Discover ("strategic complement").
  acs_codes: [PA.I.C.K2f, PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "At what convective-outlook tier does monitoring shift to active planning for a light single?"
  back: |
    Around SLGT (Slight, tier 2 = scattered severe). Below that (TSTM /
    MRGL), light singles can usually plan with normal background
    monitoring. SLGT and above means the route or destination has a
    meaningful probability of severe convection, and the rest of the
    convective tools (SIGMET watching, NEXRAD interrogation, divert
    pre-planning) move from background to active. For a turboprop with
    onboard radar, the equivalent threshold is ENH.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, planning-threshold, light-aircraft]
  source_ref: |
    Body Discover ("at what tier do I shift...").
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Tuesday night planning a Saturday flight. METARs and TAFs cover only ~30 hours; GFA caps at +15. What product gives you the strategic convective picture for Saturday?"
  back: |
    SPC Day 4-8 Convective Outlook (AC). It uses percent-probability of
    severe weather (rather than categories) because forecast skill is
    soft that far out, but it does identify roughly where severe storms
    are most likely. Read alongside the synoptic prog charts for the same
    days to build the strategic story for the trip. The output isn't 'go'
    or 'no-go'; it's 'this trip merits extra caution starting now.'
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, day-4-8, planning-horizon]
  source_ref: |
    Body Context.
  rationale: |
    Scenario card from the body's Context. Trains the planning-horizon
    selection: which product fills the gap when METARs/TAFs/GFA can't reach.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Calibration drill: how do you build a sense of when SPC is right and when SPC is wrong?"
  back: |
    Compare yesterday's Day 1 convective outlook to yesterday's actual
    Convective SIGMETs. The polygons should overlap heavily (Day 1 is
    generally skillful). When they don't, read the discussion text -- it
    should explain the surprise. Building a sense of when SPC is right
    and when SPC is wrong is the meta-skill behind using the product
    well.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, spc, calibration]
  source_ref: |
    Body Verify.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Convective outlook category 'Marginal' (MRGL, 1) -- what does it mean operationally for a VFR cross-country?"
  back: |
    Isolated severe weather possible. The outlook is flagging that
    *somewhere* in the polygon a severe cell may develop, but the
    probability is low and the coverage sparse. For a VFR cross-country,
    MRGL is 'background monitoring' -- check the SIGMETs on departure
    morning, watch NEXRAD en route, but no need to alter the plan in
    advance. Above MRGL (SLGT and up), the plan adjusts in advance.
  cardType: basic
  kind: recall
  tags: [weather, convective-outlook, mrgl, planning]
  source_ref: |
    AC 00-45H; body Discover and Connect.
  acs_codes: [PA.I.C.K2f]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Convective Outlook section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC))
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products
:::

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
