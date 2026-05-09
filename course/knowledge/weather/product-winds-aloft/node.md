---
id: wx-product-winds-aloft
title: Wind and Temperature Aloft Forecast (FB)
domain: weather
cross_domains: [flight-planning, performance]

knowledge_types: [factual, procedural]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires: []
deepens: []
applied_by:
  - plan-vfr-cross-country
  - plan-ifr-cross-country
  - perf-takeoff-landing-distance
taught_by: []
related:
  - wx-product-gfa

modalities: [reading, cards, calculation]
estimated_time_minutes: 25
review_time_minutes: 4

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Wind and Temperature Aloft Forecast section
    note: Encoding rules including the >100 KT and inverted-temperature conventions.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Forecasts
    note: How the FB is generated and what altitudes it covers for which regions.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Where the FB lives in the briefing flow.

assessable: true
assessment_methods: [recall, calculation]
mastery_criteria: >
  Learner can decode an FB entry at any altitude including the >100 KT
  (subtract 50 / add 100) convention and the implicit-negative
  temperature convention above 24,000 ft, choose a cruise altitude that
  optimises ground speed for a given course, and identify when a
  forecast wind would push a fuel reserve below legal minimums.
---

# Wind and Temperature Aloft Forecast (FB)

## Context

You're flying KMRY -> KSAC with a 220-degree course at 5,500 ft. The
winds-aloft forecast for the nearest reporting station says: 6,000 ft
2730+10. You decode that as 270 at 30, +10C. Your true airspeed is
115 KT. Quick mental math: that's a strong tailwind component, your
ground speed is going to be ~140 KT, your fuel burn drops, your ETA
shifts left. Now do the same flight at 9,000 ft where the wind is
2860+05 -- different decision.

## Problem

Wind aloft drives ground speed, fuel burn, ETA, and en route weather
exposure. The FB encodes the forecast in a compact format that, once
read fluently, takes seconds to convert to an altitude choice. The
encoding has two traps: the >100 KT convention and the inverted-temp
convention. Both bite on checkrides and in real flight planning if not
internalized.

## Discover

Decode this FB entry for the 30,000 ft level: `731960`. Six digits.
First three are direction + speed; last two (or three) are temperature.

- `73` -- direction. But: when the speed exceeds 100 KT, the encoder
  adds 50 to the direction code (so direction `73` decodes to 230 deg)
  and adds 100 to the speed. So: direction is 230, speed is `19` + 100
  = 119 KT.
- Last two: `60`. Temperature. Above 24,000 ft, all temps are negative
  by convention -- the leading minus sign is omitted. So: -60C.

Result: 230 at 119 KT, -60C.

Why the conventions? Because the original FB was teletype-format with
strict 6-character columns. The encoding choices were teletype-era
compromises that survived. The rules are arbitrary; the format is not.

## Reveal

Decoding rules in full:

- Direction: 2-digit, in tens of degrees, true (not magnetic).
- Speed: 2-digit, in knots.
- Temperature: 2-digit Celsius, signed below 24,000 ft, implicitly
  negative at and above 24,000 ft.
- Speed > 100 KT: add 50 to direction, add 100 to speed. Example: a
  raw `7350` decoded standardly would be 230 at 50 KT, but the
  presence of `73` (direction values run 01-36 in the standard
  encoding, so anything 51+ signals the convention) means direction is
  73 - 50 = 23 (i.e. 230 true) and speed is 50 + 100 = 150 KT.
- Direction code `99` and speed `00`: light and variable.
- Temperatures absent at 3,000 ft (the lowest level published) and
  for the level closest to station elevation.

Forecast altitudes vary by region: 3,000, 6,000, 9,000, 12,000,
18,000, 24,000, 30,000, 34,000, 39,000 ft for CONUS. Issued twice
daily (FB1 / FB2) with valid times across 6, 12, and 24 hour blocks.

## Practice

Decode this FB for KOAK at the time of your 1500Z departure to KSEA:

```text
3000  9000  12000  18000  24000
1815  2530  2545+05 264310 264922
```

- 3,000: 180 at 15, no temperature (too close to surface).
- 9,000: 250 at 30, no temperature (lowest level above station elev).
- 12,000: 250 at 45, +5C.
- 18,000: 260 at 43, -10C (signed; -10 because below 24K but column
  format keeps explicit sign).
- 24,000: 260 at 49, -22C (signed at exactly 24K).

For cruise climb to 9,000 you have a 250-degree wind aloft. KOAK -> KSEA
is roughly a 350 course. That's 100 degrees of cross, about half
crosswind / half tailwind component -- modest help. At 18,000 the wind
shifts and accelerates; for a turbocharged airplane the math becomes a
serious tailwind problem.

## Connect

The FB feeds the navigation log: every leg's ground speed and ETE
depends on the forecast wind at the planned altitude. It also feeds
the alternate-fuel decision, because if the headwind at altitude is
strong enough to push you below the legal reserve, you reroute or
refuel. The K2 element calls out the FB; this node is its decode
discipline.

## Verify

Decode an FB for a route you'd actually fly tomorrow at three
candidate altitudes. Compute ground speed at each. Pick the altitude
that optimizes ground speed within the airplane's performance and the
day's icing / turbulence picture. If you do this for every flight, the
encoding becomes muscle memory.
