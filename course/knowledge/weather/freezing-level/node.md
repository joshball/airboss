---
id: wx-freezing-level
title: Freezing Level
domain: weather
cross_domains: [flight-planning]

knowledge_types: [conceptual, procedural]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-icing-types-and-avoidance
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-winds-aloft
  - wx-product-airmets-sigmets

modalities: [reading, cards]
estimated_time_minutes: 25
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Freezing Level chart section
    note: Format spec for the freezing-level forecast product including isotherm contour intervals.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Analysis, Sections 25.4 (Freezing Level Analysis) and 25.5 (Icing Analysis -- Current Icing Product CIP)
    note: Modern consolidated reference for the freezing-level analysis chart and its icing-analysis companion product.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 27 -- Forecasts, Sections 27.11 (Freezing Level Forecast Graphics) and 27.12 (Forecast Icing Product -- FIP)
    note: Modern consolidated reference for the freezing-level forecast chart and its FIP companion forecast.
  - source: AC 91-74B
    detail: Pilot Guide, Flight in Icing Conditions
    note: Operational treatment of freezing level in icing avoidance and escape decisions.
  - source: AIM
    detail: 7-1-21 -- Icing
    note: Operational guidance referencing the freezing level as part of the icing decision.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can read a freezing-level forecast chart, locate the height
  of the 0 deg C isotherm along a planned route, recognize when the
  freezing level intersects terrain (no climb-out, no descent-out),
  and integrate freezing-level position with CIP / FIP / temperature
  aloft to identify whether an out exists from the icing layer.
---

# Freezing Level

## Context

You're planning a winter cross-country in a non-deiced piston single.
The icing forecast (CIP / FIP) shows moderate icing along your route
between 4,000 and 10,000 feet. The decision rule from s6.1 says:
climb above the moisture, or descend below the freezing level, or
turn around. Climbing above is not an option in this airframe at this
weight. So everything depends on the third option -- where exactly is
the freezing level, and is it high enough above the terrain to give
you a below-freezing-level altitude that's both flyable and clear of
the icing layer?

## Problem

"Below the freezing level" is the canonical icing escape, but it is
only an escape when there's actually an above-freezing layer between
the ice and the ground. On a cold day in the mountains, the freezing
level can be at the surface. On a marine-air winter day at the coast,
it can be at 6,000 feet. Same icing forecast, two completely
different decisions. The freezing-level chart is the product that
turns "is there an out?" from a guess into a read.

## Discover

The freezing level is where the temperature of the air column passes
through 0 deg C. Two facts make it useful:

- It moves. Diurnally (warmer afternoons push it higher), seasonally,
  with airmass changes. The forecast chart is a snapshot in time.
- It varies by region. In a single forecast, the freezing level might
  be at the surface in the upper Midwest, at 4,000 feet in the
  mid-Atlantic, and at 10,000 feet over Florida.

For icing decisions, three position questions matter:

- Is the freezing level above the cloud bases? If yes, there is a
  below-freezing-level layer of cloud that's a candidate for icing.
- Is the freezing level above the highest terrain on the route? If
  no, the "descend below freezing level" out doesn't exist; you'd be
  flying into terrain.
- Is the freezing level above your ceiling? If yes, you cannot climb
  above the freezing level even if the airframe is capable -- you'd
  need to climb above the entire moist layer instead, which is a
  different and usually higher target.

The interaction with FB temperatures is direct: if the FB at your
cruise altitude shows -3 C, you are 3 C below freezing -- which is
within the structural icing band (+2 C to -20 C is the high-risk
band, with peak severity around -2 C to -10 C). The FB is the
station-by-station, altitude-by-altitude version of the same data
the freezing-level chart smooths into a contour.

## Reveal

The freezing-level chart is published as part of the AC 00-45H
graphical forecast suite. Standard contour interval is 4,000 feet
(SFC, 4,000, 8,000, 12,000, ...), with the surface-freezing region
shaded distinctly. Forecast horizons are typically same-day and 6 /
12 hours.

The pilot read is three numbers:

- Lowest freezing level along the route -- determines whether a
  below-freezing-layer descent is possible at any point.
- Highest freezing level along the route -- determines how high you
  must climb to be reliably above-freezing.
- Freezing-level trend over the duration of the flight -- a falling
  freezing level during the flight (cold front passing in front of
  you) means your "out" is closing as you go.

Layer this against:

- CIP / FIP for where icing is currently / forecast. The freezing
  level tells you the bottom of the icing layer; CIP / FIP tells you
  the top.
- Cloud bases and tops from the GFA / METAR / PIREPs. Icing requires
  a cloud and below-freezing temperature. Either alone is fine.
- Terrain along the route. A freezing level at 5,000 feet over the
  Appalachian ridges is much different from one over the coastal
  plain.

## Practice

For a planned flight, walk the route on a freezing-level chart and
record three values: lowest freezing level, highest freezing level,
trend over the flight duration. Cross-check against the FB at the
nearest stations -- the FB temperatures should bracket the
freezing-level contours.

For each leg, ask: if I encountered icing at cruise, what altitude
would put me above-freezing without descending into terrain? Write
down the answer. If the answer is "no such altitude exists," that's
your no-go signal regardless of what the icing forecast itself says.

### Cards (spaced repetition)

Cards mined from the body. The three-question position framework is
the diagnostic core; the chart-spec card locks in the format; the
trend / FB cross-check cards integrate with the rest of the icing
brief.

```yaml-cards
- front: "What does 'freezing level' mean and why does its position drive the icing-escape decision?"
  back: |
    The freezing level is the altitude where the temperature of the air
    column passes through 0 deg C. The 'descend below the freezing level'
    icing escape requires that an above-freezing layer actually exists
    between the ice and the ground. On a cold mountain day the freezing
    level can be at the surface (no escape exists); on a coastal winter
    day it can be at 6,000 ft (escape available). The freezing-level chart
    is what turns 'is there an out?' from a guess into a read.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, ac-91-74b, PA.I.C.K3i]
  source_ref: |
    AC 91-74B Flight in Icing; FAA-H-8083-28 Ch 25.4; body Problem + Discover.

- front: "Three position questions to ask of the freezing level for icing decisions."
  back: |
    1. Is the freezing level above the cloud bases? If yes, there is a
       below-freezing-level layer of cloud that's a candidate for icing.
    2. Is the freezing level above the highest terrain on the route? If
       no, the 'descend below freezing level' out doesn't exist; you'd be
       flying into terrain.
    3. Is the freezing level above your airframe's ceiling? If yes, you
       cannot climb above it; you must climb above the entire moist
       layer instead -- usually a higher target.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, escape, PA.I.C.K3i]
  source_ref: |
    Body Discover ("three position questions").

- front: "Freezing-level chart format per AC 00-45H: contour interval and shaded region?"
  back: |
    Standard contour interval is 4,000 ft (SFC, 4,000, 8,000, 12,000, ...).
    The surface-freezing region (freezing level at or below surface) is
    shaded distinctly. Forecast horizons are typically same-day and 6 / 12
    hours, published as part of the graphical forecast suite.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, chart, ac-00-45h, PA.I.C.K3i]
  source_ref: |
    AC 00-45H Freezing Level chart section; body Reveal.

- front: "Three numbers to extract from a freezing-level chart for a planned route."
  back: |
    1. Lowest freezing level along the route -- determines whether a
       below-freezing-layer descent is possible at any point.
    2. Highest freezing level along the route -- determines how high you
       must climb to be reliably above-freezing.
    3. Trend over the duration of the flight -- a falling freezing level
       (cold front passing in front of you) means your out is closing as
       you go.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, route-analysis, PA.I.C.K3i]
  source_ref: |
    Body Reveal "the pilot read is three numbers."
  rationale: |
    The body's operational deliverable. This card forces the learner to walk
    the three-number read every brief instead of glancing at the chart.

- front: "Structural icing temperature band -- where is it widest and where is it most severe?"
  back: |
    The structural icing band is roughly +2 C to -20 C. Peak severity sits
    around -2 C to -10 C. Above +2 C, warmer air prevents accumulation.
    Below about -20 C, water in clouds is mostly already ice crystals and
    won't freeze further on contact. The freezing-level chart marks the
    +0 isotherm; the band extends ~2 C warmer and ~20 C colder than that
    line in altitude terms.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, temperature-band, ac-91-74b, PA.I.C.K3i]
  source_ref: |
    AC 91-74B; body Discover.

- front: "Why is the FB (winds-and-temperatures-aloft) the station-by-station check for the freezing-level chart?"
  back: |
    The FB shows wind and temperature at specific stations and altitudes;
    the freezing-level chart smooths those points into contours across a
    region. When a precise altitude / station temperature matters (your
    cruise altitude at the nearest station), the FB wins -- a point-source
    read beats a contour-smoothed estimate. For the synoptic picture and
    trend across the route, the chart wins.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, fb, winds-aloft, PA.I.C.K3i]
  source_ref: |
    Body Connect "When the chart and the FB disagree..."

- front: "FB temperature at cruise altitude shows -3 C. Where does that put you in the icing-risk band?"
  back: |
    -3 C is squarely inside the peak-severity zone (-2 C to -10 C) of the
    structural icing band. In visible moisture at -3 C, expect ice
    accumulation if cloud is present. The decision input: is there an out
    -- a layer above the moist layer, or a layer below the freezing level
    that's clear of terrain?
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, fb, PA.I.C.K3i]
  source_ref: |
    Body Discover (-3 C example).

- front: "A falling freezing level during the flight (front passing in front of you) -- what does it mean for your icing 'out'?"
  back: |
    Your out is closing as you go. The altitude that was 'descend below
    freezing level' at takeoff may be inside the icing band by the time you
    reach it. The trend value of the freezing-level read is what catches
    this -- a static read at brief time misses the in-flight closure. If
    the trend is falling, the brief must include a divert with a closer
    freezing level than the destination's.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, trend, icing, divert, PA.I.C.K3i]
  source_ref: |
    Body Reveal "trend over the duration."

- front: "Why does icing require both moisture and below-freezing temperature, and which products tell you about each?"
  back: |
    Ice forms only when supercooled liquid water (or freezing rain)
    contacts an airframe at below-freezing temperatures. Either ingredient
    alone is fine. Moisture comes from GFA cloud layers, METAR/PIREP cloud
    reports, and the cloud tops product. Temperature comes from the FB
    (point) and the freezing-level chart (region). Brief both; brief them
    together.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, moisture, ac-91-74b, PA.I.C.K3i]
  source_ref: |
    AC 91-74B; body Reveal "icing requires a cloud and below-freezing temperature."

- front: "Winter cross-country in a non-deiced single. CIP/FIP shows moderate icing 4,000-10,000 ft. Climbing above is not an option. What does the freezing-level chart need to show to make the trip flyable?"
  back: |
    The freezing level needs to be (a) above the highest terrain on the
    route by enough margin for a safe below-freezing-level cruise, and
    (b) below the bottom of the icing layer (so a descent escape clears
    the ice). If the freezing level intersects terrain anywhere on the
    route, the 'descend below freezing level' out is gone for that segment
    and the trip is a no-go regardless of what CIP/FIP shows.
  cardType: basic
  kind: recall
  tags: [weather, freezing-level, icing, go-nogo, ac-91-74b, PA.I.C.K3i]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. The non-deiced single is the
    canonical case where the freezing level is the deciding variable.
```

## Connect

The freezing-level chart is one input to the icing go/no-go that the
icing-types-and-avoidance node frames. CIP / FIP tell you where icing
is; the freezing-level chart tells you where the boundary of the
below-freezing region is. Together they shape the "is there an out?"
question.

The temperature aloft from the FB is the same data sampled at
specific stations and altitudes. When the chart and the FB
disagree, the FB wins for point-source decisions and the chart wins
for the synoptic picture.

## Verify

Pick a recent winter day and pull the freezing-level forecast that
was valid for that day. Compare it to the actual radiosonde
soundings (KIAD, KOMA, KFFC, etc.) for that day. How accurate was
the freezing-level forecast? Where did it err? In which kind of
synoptic setup is the chart most reliable, and in which is it
something to verify against PIREPs as you fly?
