---
id: wx-reading-metars-tafs
title: Reading METARs and TAFs
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, procedural]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: critical
requires: []
deepens: []
applied_by:
  - airspace-vfr-weather-minimums
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-thunderstorm-hazards

modalities: [reading, cards, drill]
estimated_time_minutes: 60
review_time_minutes: 10

references:
  - source: AC 00-45H
    detail: Aviation Weather Services
    note: The canonical reference for METAR, TAF, PIREP, and AIRMET/SIGMET formats.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Format guide with examples.
  - ref: airboss-ref:handbooks/phak/13
    chapter_title: Aviation Weather Services
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/13
    note: Introductory treatment with sample METARs and TAFs.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a METAR and TAF completely (wind, vis, wx phenomena,
  sky condition, temp/dew, altimeter, remarks), interpret probability and
  change groups in a TAF, and translate a report into go/no-go reasoning.
---

# Reading METARs and TAFs

The METAR / TAF pair is the most-read product in aviation. They're
also the canonical example of the **encoded-text family** -- compact,
mechanically encoded operational formats where reading well is a
three-stage skill, not a single skill. The pattern from this node
applies to every other encoded-text product you'll meet (PIREPs,
AIRMETs / SIGMETs, FB, ATIS, NOTAMs).

The three stages:

- **Decode** -- mechanical translation from symbols to facts. The
  alphabet level. "BKN040" means "broken layer at 4,000 feet AGL."
  Speed comes from repetition; correctness is a binary.
- **Understand** -- placing the decoded facts into the larger
  picture. What synoptic situation produces this report? What's
  upstream? What's typical for this airport in this season?
- **Triage** -- separating the lines that matter from the lines that
  don't. A decoded report has 12-20 elements. Three to five of them
  drive the go / no-go for any given flight. The rest are confirmation.

A pilot who decodes well but never advances to triage is the pilot
who reads every METAR and still misses the one trend that should
have stopped the flight. The decode is the alphabet; the goal is
the sentence.

## Context

You're standing on the ramp at 0530 with two hours of flight ahead
of you. ForeFlight is open. You've pulled the destination METAR.
The current report shows wind 230 at 8 gusting 14, visibility 6 SM
in mist, ceiling 1,200 broken, temperature 19, dew point 18,
altimeter 30.02. The TAF for the next four hours says BKN015,
PROB30 between 0900Z and 1200Z TEMPO BKN006 with vis 1 SM in fog.

What does the METAR tell you? What does the TAF tell you? And
which of those numbers is going to drive the call you make at the
fuel pump in the next ten minutes?

## Problem

The METAR is dense by design -- the format predates radio
bandwidth limits and got compact for transmission, and it stayed
compact because pilots read hundreds of them in a single planning
session. A learner who can't decode every group of every METAR
hits the same wall every flight: the report becomes unparseable
text instead of operational data, and the pilot defaults to the
graphical product (which abstracts away the trend signals the
METAR carries best).

The TAF is the same encoding rules with two additions: it's a
forecast (so the time groups matter more), and it carries change
indicators (FM / TEMPO / PROB / BECMG) that the METAR does not.
The TAF problem is two-fold: decode the change groups correctly,
and **interpret the forecaster's confidence** -- a TEMPO is a
different planning input from a FM, even when they describe the
same conditions.

The pilot question both products answer is the same: is the
weather flyable for me on this trip, and is it going to stay
that way long enough?

## Discover

### Stage 1: Decode

A METAR is a fixed-order sequence of groups. Read in order, every
time, the same way:

1. **Type indicator** -- METAR (routine) or SPECI (special, issued
   off-cycle when something changes). The presence of a SPECI is
   itself information: something changed enough to trigger an
   off-cycle report.
2. **Station identifier** -- four-letter ICAO. K-prefix in the
   continental US.
3. **Date/time group** -- six digits, day-of-month + hour + minute,
   always Zulu.
4. **Modifiers** -- AUTO (automated station, no human observer),
   COR (corrected previous report).
5. **Wind** -- direction (true) + speed + optional gust. Variable
   wind below 6 KT may show as VRB; gusts get a "G" suffix
   (16G24KT). Variable beyond 60 degrees gets a separate "vrb"
   group (180V230).
6. **Visibility** -- statute miles in the US, with fractional
   notation (1 1/2SM, 1/4SM). M prefix means "less than"
   (M1/4SM = less than a quarter mile). Runway visual range (RVR)
   may follow on instrument approach airports.
7. **Weather phenomena** -- coded with intensity prefix (`-`
   light, none moderate, `+` heavy), descriptor (TS, SH, FZ, BL,
   DR, MI, BC, PR), and phenomenon (RA, SN, BR, FG, HZ, FU, DU,
   SA, etc.). Examples: -RA = light rain. +TSRA = heavy thunderstorm
   with rain. FZRA = freezing rain. BR = mist. FG = fog.
8. **Sky condition** -- in coverage / height pairs, ascending. SKC
   or CLR (clear), FEW (1-2 oktas), SCT (3-4), BKN (5-7), OVC
   (8). Heights in hundreds of feet AGL (BKN015 = 1,500 broken).
   CB or TCU after the height for thunderstorm-related cumulus.
9. **Temperature/dew point** -- in degrees Celsius, slash-
   separated, M prefix for negative (M03/M05).
10. **Altimeter** -- A-prefix, four digits, inches of mercury
    times 100 (A2992 = 29.92).
11. **Remarks** (RMK) -- automated supplementary data, sea-level
    pressure (SLPxxx), sensor health, precipitation amounts,
    pressure tendency, and free-text notes. Pilots routinely
    skip RMK and pilots routinely miss things hidden in RMK.

A TAF adds:

- **Validity period** -- two four-digit groups (date+hour for the
  start, date+hour for the end). 1218/1318 = valid 1800Z on the
  12th to 1800Z on the 13th, 24 hours.
- **FM groups** -- "from" this time, conditions become this. A
  hard reset; everything before the FM is replaced.
- **TEMPO groups** -- temporary (less than half the hour-window)
  excursion to the listed conditions. Don't replace the prevailing
  forecast; layer onto it.
- **PROB30 / PROB40** -- 30 % or 40 % probability of the listed
  conditions. PROB never appears with anything stronger than 40 %
  (50 % gets upgraded to TEMPO).
- **BECMG** -- becoming. Conditions transitioning over the listed
  window from current forecast to listed conditions. Less common
  than FM in modern US TAFs.

### Stage 2: Understand

Decoded facts have to land on a synoptic picture. The METAR
above (wind 230 at 8 gusting 14, vis 6 SM BR, ceiling 1,200,
temp 19 / dew 18, alt 30.02) tells one story:

- Wind from the southwest, light. Not a frontal-passage wind.
- Visibility 6 in mist (BR), not fog. The temperature/dew-point
  spread is 1 deg C, which is exactly when mist forms; another
  half degree of cooling and BR becomes FG (less than 5/8 SM).
- Ceiling 1,200 broken. Stratus, marine-air type, not convective.
- Altimeter 30.02. Modestly above standard; no strong system.

That's a humid, light-southerly, near-saturation morning. It
matches a maritime tropical air mass overnight without much
mixing. The synoptic frame says: this is what you get when warm
moist air sits on a cooler surface; it'll lift as the day warms,
but right now you're at the ragged edge of fog, and a light shift
in wind direction or temperature could close the airport.

### Stage 3: Triage

For *this flight* (you're at the fuel pump deciding whether to
launch), three of the eleven groups drive the decision and the
other eight are confirmation:

- **The temp / dew-point spread of 1 deg C.** This is the trend
  signal. If a fog forms in the next thirty minutes, you're
  IFR-only at departure even though the current METAR shows
  6 SM.
- **The TAF PROB30 TEMPO BKN006 vis 1 SM.** The forecaster
  agrees fog is possible. PROB30 is "this is unlikely but real."
- **The TAF BKN015.** The prevailing TAF says ceilings 1,500
  broken for the next four hours. Any visit to TEMPO BKN006 is
  brief.

If you're VFR-only on a non-IFR-current day, the spread alone
should stop the launch -- not because it's IFR right now, but
because the rate-of-change toward IFR is faster than your
rate-of-arrival at the destination. If you're IFR-current with
an instrument-equipped airplane, the picture is workable: the
prevailing forecast is a 1,500 ceiling, the worst case is a
30 % probability of brief BKN006/1SM, and you have legal IFR
fuel + alternates.

The other eight METAR groups (station ID, time, wind, weather
phenomena = BR, sky condition = BKN012, altimeter, RMK) are
confirmation, not drivers. Wind 230 at 8 gusting 14 is fine;
altimeter 30.02 is normal; the BR confirms the spread story.

Triage is the habit of asking: which of these numbers, if it
changed by a step, would change my decision? Those are the
drivers. Watch them.

## Reveal

The format spec is canonical:

- **METAR / SPECI / TAF format and group order:** AC 00-45H,
  Aviation Weather Services, Sections 3 and 4. The reference
  pilots actually own.
- **Operational use and reading guidance:** AIM 7-1 (National
  Weather Service Aviation Products) -- format guide with
  examples and an explanation of the codes most pilots see.
- **Pilot-pitch introduction:** PHAK Chapter 13, Aviation
  Weather Services. Lighter weight, useful as a first pass.

The intensity / descriptor / phenomenon coding (the weather
group) is the densest part of the format and the place
unfamiliar combinations most often show up. Memorize the
descriptors (TS thunderstorm, SH shower, FZ freezing, BL
blowing, DR drifting, MI shallow, BC patches, PR partial), the
intensity prefixes (`-` `+`, none = moderate), and the
common phenomena (RA SN BR FG HZ FU DU SA GR PL DZ IC), and
you can decode any combination on first read.

The TAF change-group precedence: FM hard-replaces; BECMG
gradually replaces; TEMPO layers a temporary excursion; PROB
30 / 40 indicates an unlikely but possible alternate. Read
the prevailing TAF first, then layer the changes in order of
their start times.

## Practice

For each of the next ten METARs you read, force-rank the groups
by impact on a hypothetical flight. Which three would change
your decision if they shifted by one step? The act of ranking
is what trains triage; the decoding is the prerequisite.

For each of the next ten TAFs, do the same with change groups.
Read the prevailing forecast first; then ask, "what is the
worst-case TEMPO or PROB block, and would my flight survive
it?" Pilots who triage TAFs by reading FM groups in order miss
the embedded TEMPO / PROB excursions that drive most fuel and
alternate decisions.

A focused decode drill: pull a current METAR for a Class B
airport (busy, all groups populated) and decode it without
reference. Time yourself. The goal is under 60 seconds for a
clean decode of a well-formed METAR. Speed without correctness
is fluency; correctness without speed is comprehension. Both
matter.

## Connect

This node is the foundation of the encoded-text family. The same
three-stage ladder (decode -> understand -> triage) applies to:

- **PIREPs** -- decode the encoded location / altitude / aircraft
  type / weather; understand the conditions that produced the
  report; triage what matters for your route.
- **AIRMETs / SIGMETs / Convective SIGMETs** -- decode the polygon,
  valid time, and phenomenon; understand whether the conditions
  match a synoptic story; triage which advisory intersects your
  route at your time.
- **Winds and Temperatures Aloft (FB)** -- decode the encoded
  station / altitude / direction-speed-temperature; understand
  the trend across altitudes; triage the cruise altitude that
  best fits the flight.

Every encoded-text product invites the same wall: the learner
gets stuck at decode and the report becomes ambient noise.
Spending the time to drill triage on the most-read product
(METAR / TAF) makes the rest of the family inherit the habit.

The METAR also feeds:

- **Go / no-go decision** -- METAR + TAF + personal minimums is
  the most direct decision input.
- **VFR weather minimums** -- the METAR ceiling + visibility maps
  to airspace VFR minimums for any airport you're transiting.
- **Airframe icing risk** -- temperature + dew-point spread + sky
  condition in winter is the first signal for in-flight icing
  setup.

## Verify

Pull three METARs from three airports across one synoptic system
(west-to-east across a frontal passage, or north-to-south across
a marine layer). Read them in order. Do they tell a coherent
synoptic story that matches the surface analysis from the same
hour? When they don't, where does the disagreement live, and
what does that tell you about local effects, station siting, or
report timing?

For a TAF you've been watching for several hours, compare the
sequence of TAF amendments to the sequence of METARs that
followed. Did the TAF run ahead of, lag, or track reality?
Forecaster skill is real and varies by station, season, and
synoptic regime; the pilot habit of "compare the latest METAR
to the most recent TAF amendment" is grounded in this.
