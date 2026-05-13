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
    detail: Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
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

The FB is a member of the encoded-text family (see
[wx-reading-metars-tafs](../reading-metars-tafs/node.md) for the full
family pattern). The three-stage ladder applies, with the FB's own
twist on each stage:

- **Decode** -- the six-digit groups, the >100 KT convention, the
  implicit-negative temperature convention above 24,000 ft. The
  decode is more arbitrary than the METAR's, and the conventions
  bite checkrides because they're rare in everyday flying.
- **Understand** -- the FB is a *forecast* sampled at coarse
  altitudes (3,000 / 6,000 / 9,000 / 12,000 / 18,000 / 24,000 / ...
  ft). Real wind interpolates between rows; real wind also varies
  spatially between stations. The grid is a sparse approximation of
  a continuous field.
- **Triage** -- two operational questions drive the read: which
  cruise altitude maximizes groundspeed (or minimizes fuel burn,
  often the same thing), and at which altitude does the temperature
  column put you below freezing. The other rows are confirmation.

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

### Cards (spaced repetition)

Cards mined from the body. The encoding-convention cards (>100 KT,
implicit-negative temperature) are the decode traps the body explicitly
flags; calculation cards walk the format; the triage card connects to
altitude selection.

```yaml-cards
- front: "Decode an FB entry: 731960 at the 30,000 ft level."
  back: |
    Speed > 100 KT convention triggers: direction code 73 means add 50
    has been applied (raw direction 73 - 50 = 23, so 230 deg true).
    Speed: 19 + 100 = 119 KT.
    Temperature: 60 is implicitly negative above 24,000 ft -> -60 C.
    Final: 230 at 119 KT, -60 C.
  cardType: basic
  kind: calculation
  tags: [weather, fb, winds-aloft, decode, ac-00-45h]
  source_ref: |
    AC 00-45H FB section; body Discover worked example.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "FB encoding: the >100 KT convention. What's the rule and why does it exist?"
  back: |
    When speed exceeds 100 KT, the encoder adds 50 to the direction code
    and adds 100 to the speed. Direction values normally run 01-36; any
    value 51+ signals the convention. Decode: direction - 50 = true
    direction, speed + 100 = true speed. The convention exists because
    the original FB was teletype-format with strict 6-character columns;
    teletype-era constraints survived into the modern encoding.
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, encoding, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover and Reveal.
  rationale: |
    The body explicitly flags this as a checkride trap. Cloze/recall card
    forces the learner to articulate both the rule and the signal value.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "FB temperature convention above 24,000 ft -- what's omitted and what's implied?"
  back: |
    Above 24,000 ft (and at 24,000 ft itself in some renderings), all
    temperatures are negative by convention -- the leading minus sign is
    omitted. So a `60` at FL300 decodes to -60 C, not +60 C. Below
    24,000 the sign is explicit. The convention catches pilots who
    learned the FB on low-altitude examples and never internalised the
    high-altitude rule.
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, temperature, encoding, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover and Reveal.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "FB forecast altitudes for CONUS -- list the standard levels."
  back: |
    3,000 / 6,000 / 9,000 / 12,000 / 18,000 / 24,000 / 30,000 / 34,000 /
    39,000 ft. Temperatures are absent at 3,000 ft (the lowest level)
    and at the level closest to station elevation (where the lower
    levels collapse). Issued twice daily (FB1 / FB2) with valid times
    across 6, 12, and 24 hour blocks.
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, altitudes, cadence, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Decode the FB entry 2545+05 at 12,000 ft."
  back: |
    250 deg true at 45 KT, +5 C. Standard decoding (speed < 100 KT, below
    24,000 ft): direction = 25 (250 deg true, in tens of degrees);
    speed = 45 KT; temperature explicit-sign = +5 C.
  cardType: basic
  kind: calculation
  tags: [weather, fb, winds-aloft, decode, calculation, ac-00-45h]
  source_ref: |
    AC 00-45H; body Practice.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "FB direction code 99 with speed 00 -- what does it mean?"
  back: |
    Light and variable. The 99/00 special code is used when wind speed
    is below the threshold where direction can be reliably forecast (and
    below the threshold where the wind matters for altitude choice).
    Treat as ~5 KT or less; pick cruise altitude on other criteria
    (icing, turbulence, fuel burn).
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, light-and-variable, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Two triage questions to ask of an FB read before picking a cruise altitude."
  back: |
    1. Which cruise altitude maximises ground speed (or minimises fuel
       burn -- usually the same answer)? Compare wind component against
       the route's true course at each altitude.
    2. At which altitude does the temperature column put you below
       freezing? Freezing temperature at cruise + visible moisture =
       icing brief.
    Other rows are confirmation.
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, triage, altitude-selection]
  source_ref: |
    Body Discover triage step.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "KMRY -> KSAC, 220-degree course, TAS 115 KT. FB at 6,000 ft is 2730+10. Estimate the wind effect on ground speed."
  back: |
    Decode: 270 deg at 30 KT, +10 C.
    Course 220, wind from 270 -> wind 50 degrees right of nose.
    50 degrees ~= 64% headwind component, ~77% crosswind component.
    Wait -- 270 is FROM, so the wind goes TOWARD 090. Relative to a
    220 course, the wind blows from the right rear -- a tailwind/cross
    combo. Use the 30-60-90 mental rule: 50 deg off the tail ~= ~half
    crosswind, ~half tailwind. Tailwind component ~= 30 * cos(50) =
    ~19 KT, giving ground speed ~115 + 19 = ~134 KT. Body says ~140 KT;
    the rough mental math is in the ballpark.
  cardType: basic
  kind: calculation
  tags: [weather, fb, winds-aloft, ground-speed, calculation]
  source_ref: |
    Body Context worked example.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "Why is the FB called a 'sparse approximation of a continuous field'?"
  back: |
    The FB is a *forecast* sampled at coarse altitudes (3K / 6K / 9K /
    12K / 18K / 24K / ...) at specific stations. Real wind interpolates
    between rows; real wind also varies spatially between stations. The
    grid is a sparse snapshot of a continuous field. Operational impact:
    use the FB for cruise-altitude selection but expect real wind to
    diverge from forecast by 30-40 KT in dynamic atmospheres (frontal
    passage, mountain wave, jet shifts).
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, limitations, ac-00-45h]
  source_ref: |
    Body Discover; equipment-and-data-limitations node.
  acs_codes: [PA.I.C.K2e, PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products

- front: "How does the FB feed the alternate-fuel decision?"
  back: |
    Every leg's ground speed and ETE depend on the forecast wind at the
    planned altitude. If the headwind at altitude is strong enough to
    push you below the legal reserve (or your personal reserve), you
    reroute, refuel, or change altitude. The FB is one of the two
    products that gates 'is this trip fuel-feasible?' alongside the
    GFA winds layer.
  cardType: basic
  kind: recall
  tags: [weather, fb, winds-aloft, fuel-planning, alternate]
  source_ref: |
    Body Connect.
  acs_codes: [PA.I.C.K2e]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Wind and Temperature Aloft Forecast section
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)
    - kind: aim
      cite: AIM 7-1 -- National Weather Service Aviation Products
```

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
