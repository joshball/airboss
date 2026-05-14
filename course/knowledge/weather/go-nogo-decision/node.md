---
id: wx-go-nogo-decision
title: Weather Go / No-Go Decision
domain: weather
cross_domains: [adm-human-factors, flight-planning]

knowledge_types: [judgment]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: critical
requires:
  - wx-reading-metars
  - wx-reading-tafs
  - airspace-vfr-weather-minimums
  - wx-thunderstorm-hazards
  - wx-icing-types-and-avoidance
deepens: []
applied_by:
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - proc-adm-hazardous-attitudes

modalities: [reading, reps]
estimated_time_minutes: 60
review_time_minutes: 10

references:
  - ref: airboss-ref:handbooks/phak/2
    chapter_title: Aeronautical Decision-Making
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/2
    note: DECIDE, PAVE, IMSAFE frameworks applied to weather calls.
  - source: AOPA Air Safety Institute
    detail: Weather-related safety resources
    note: Case studies and decision-making tools.
  - source: FAA-H-8083-2A
    detail: Risk Management Handbook
    note: Formal treatment of the risk-management matrix applied to weather.

assessable: true
assessment_methods: [scenario]
mastery_criteria: >
  Learner can walk through a full weather brief (FA/FB/METARs/TAFs/sig
  wx/AIRMETs/SIGMETs/PIREPs) and produce a defensible go / no-go / delay /
  divert decision with reasoning, and can articulate the specific hazard or
  uncertainty that drives each branch of the decision.
---

# Weather Go / No-Go Decision

## Context

The same trip that opened section 1 of the course: a friend asks
you to fly them to a wedding three states away on Saturday. You're
at the keyboard at 0500 with the brief in front of you. METARs at
departure are clean, METARs at destination show 4,000 broken with
6 SM in light rain, the surface analysis has a stationary front
draped across the middle leg, the GFA shows MVFR ceilings along a
100 NM stretch of the route, and the latest TAF amendment ran six
hours ago and predicted slightly better conditions than reality.

Three pilots could read this same brief and arrive at three
different defensible answers. The decision isn't "is the weather
flyable?" It's "is the weather flyable for me, in this airplane,
on this route, today?"

## Problem

The go/no-go decision is the synthesis target for everything else
in the weather course. Air masses, fronts, products, in-flight
displays -- all of them feed this single decision. Two failure
modes dominate:

- **Decoded but undecided.** The pilot reads every METAR / TAF /
  AIRMET correctly but can't synthesize them into a decision. The
  data is fluent; the call is paralyzed. Default action becomes
  "go and see," which is the decision the data was supposed to
  prevent.
- **Decided but uncalibrated.** The pilot makes the call from
  habit -- "I always fly this trip" or "the destination is fine,
  let's go" -- without integrating the variables that distinguish
  *this* day from average. Default action is the same flight
  every time, regardless of what the brief showed.

The pilot job is to convert the brief into a decision that names
the specific hazard or specific uncertainty that drives it. "I'm
going" or "I'm not going" without a named driver is a guess. The
named driver is what makes the decision defensible -- to yourself
when the trip-pressure builds, and to whoever was counting on the
trip if it doesn't happen.

## Discover

A go/no-go decision has three branches, not two:

- **Go** -- conditions and trends are within your personal
  minimums; the route's worst-case forecast is flyable; the out
  exists if conditions degrade.
- **No-go** -- a specific hazard or trend exceeds your minimums.
  Name the driver. ("The freezing level is at the surface along
  60 NM of route" beats "weather looks bad.")
- **Delay** -- the brief shows the trip becomes flyable in N
  hours. Wait, then re-brief. The delay branch is the one most
  pilots underuse; it's not "no-go," it's "not yet."

Bring three categories of input to the decision:

- **The hazards** -- thunderstorms, icing, turbulence, IFR
  conditions, fog, terrain. Each comes from one or more products
  earlier in the course (s5, s6, s4, s3, s8). Each hazard either
  is present, is forecast, or isn't.
- **The trends** -- is the forecast getting better, getting
  worse, or holding? A good current condition with a deteriorating
  trend is more dangerous than a marginal current condition with
  an improving trend. Compare the latest METAR to the most recent
  TAF amendment; if reality is already running ahead of the
  forecast, the forecast is suspect for the rest of its valid
  period.
- **The personal limits** -- this airplane, this route, this
  pilot, this day. Personal minimums (wx-personal-minimums) are
  the floor.

Then run a structured framework. The two best-known are PAVE and
DECIDE.

**PAVE** asks four questions about pilot, aircraft, environment,
external pressures:

- **P** -- Pilot. Currency, fatigue, recent practice in this
  airplane, recent practice in this kind of weather.
- **A** -- Aircraft. Performance for this density altitude,
  equipment for this weather (anti-ice, instrument capability,
  autopilot status, fuel range with reserves).
- **V** (E in some texts) -- enVironment. The weather; the route;
  the terrain; the airports along the way; daylight or
  not-daylight.
- **E** -- External pressures. The wedding, the meeting, the
  passenger expectations, the rental clock. External pressures
  are the most-cited contributing factor in fatal weather
  accidents because they bias the call before the brief begins.

**DECIDE** is a six-step decision-cycle: Detect a change, Estimate
the need to react, Choose an outcome, Identify actions, Do, and
Evaluate. It's a continuous-loop framework, useful in flight as
much as in preflight.

A working pilot's compressed version: read the brief in synoptic
order (frame first, then hazards, then route, then airports last),
name the worst-case along the route, ask if the flight survives
the worst case with reserves, and ask what trend would change the
answer in the next two hours.

## Reveal

The go/no-go isn't a single moment; it's a sequence of moments,
each a chance to recommit or to reverse:

| Moment                    | What's available                                  |
| ------------------------- | ------------------------------------------------- |
| At the keyboard, day-of   | Full brief, full latitude, no money on the table  |
| At the airport, preflight | Updated brief, runup observations, last latitude  |
| Run-up complete           | Real airplane health; weather still on the ground |
| Climb-out                 | Real outside air, real ride, FIS-B coming online  |
| At top-of-climb / cruise  | Full in-flight picture, divert option still cheap |
| Descent / approach        | Decision window narrows; commit pressure rises    |

The discipline is to hold the decision lightly through every
moment until the sequence ends. Pilots who decide once and never
reopen the question are pilots who fly into weather that updated
underneath them.

The no-go conditions that don't need a framework -- the ones that
should produce immediate stop without negotiation:

- Thunderstorms or Convective SIGMET on the route at your time.
- Severe icing forecast or PIREP'd along the route at any usable
  altitude.
- Mountain wave / severe turbulence forecast or PIREP'd along the
  route in airplanes that aren't structurally rated for it.
- IFR conditions for a VFR pilot or non-instrument-rated pilot.
- Personal minimums exceeded and not recoverable by route or
  altitude change.

The trip pressure framework: every decision should produce a
specific named driver. "Embedded thunderstorms in convective SIGMET
on the middle leg" is a driver; "weather looks bad" is not.

## Practice

For your next planned cross-country, walk the brief from synoptic
to point. At each layer write down (a) the hazard or condition
present, (b) the trend (improving / steady / degrading), (c)
whether it crosses a personal minimum. At the end, write the
decision (go / no-go / delay) and the named driver. If you can't
name a driver, the decision isn't yet supported.

A more demanding version: brief tomorrow's flight today and write
your decision. Tomorrow morning, brief it again and compare. If
your decision changes between today and tomorrow, identify which
input drove the change. That input is the variable you most need
to monitor for that route.

### Cards (spaced repetition)

Cards mined from the body. The three-branch framing is the recall
core; PAVE and DECIDE are the named frameworks; the decision-moment
sequence is the in-flight discipline; the named-driver rule is the
test for whether the decision is actually defensible.

```yaml-cards
- front: "Three branches of a go/no-go decision (not two)?"
  back: |
    Go -- conditions and trends are within personal minimums; the worst-case
    forecast is flyable; the out exists if conditions degrade.
    No-go -- a specific hazard or trend exceeds your minimums. Name the
    driver. ("Convective SIGMET on the middle leg" beats "weather looks bad.")
    Delay -- the brief shows the trip becomes flyable in N hours. Wait, then
    re-brief. The delay branch is the one most pilots underuse; it's not
    'no-go,' it's 'not yet.'
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, decision, phak-2]
  source_ref: |
    PHAK Ch 2 Aeronautical Decision-Making; body Discover.
  rationale: |
    The body's central reframing -- two-branch thinking (go / no-go)
    excludes the most common defensible outcome.
  acs_codes: [PA.I.C.R1]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "PAVE checklist -- what does each letter ask about?"
  back: |
    P -- Pilot. Currency, fatigue, recent practice in this airplane and
    this kind of weather.
    A -- Aircraft. Performance for the density altitude, equipment for
    the weather (anti-ice, instrument, autopilot, fuel range with reserves).
    V (or E) -- enVironment. Weather, route, terrain, airports, daylight.
    E -- External pressures. Wedding, meeting, passenger expectations,
    rental clock. Most-cited contributing factor in fatal weather accidents.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, pave, adm, phak-2]
  source_ref: |
    PHAK Ch 2 ADM; FAA-H-8083-2A Risk Management Handbook; body Discover.
  acs_codes: [PA.I.C.R1]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "DECIDE model -- name the six steps and what makes the framework continuous."
  back: |
    Detect a change -> Estimate the need to react -> Choose an outcome ->
    Identify actions -> Do -> Evaluate. The Evaluate step loops back to
    Detect, making DECIDE continuous in flight, not just on the ground.
    Useful for in-flight re-briefs as much as preflight planning.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, decide, adm, phak-2]
  source_ref: |
    PHAK Ch 2; body Discover.
  acs_codes: [PA.I.C.R1]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Two go/no-go failure modes the body names -- 'decoded but undecided' and 'decided but uncalibrated'. What does each look like?"
  back: |
    Decoded but undecided: the pilot reads every METAR / TAF / AIRMET
    correctly but can't synthesise them into a decision. Data is fluent;
    call is paralysed. Default becomes 'go and see,' which is the decision
    the data was supposed to prevent.
    Decided but uncalibrated: the pilot decides from habit ('I always fly
    this trip') without integrating the variables that distinguish today
    from average. Default is the same flight every time, regardless of
    brief.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, failure-modes]
  source_ref: |
    Body Problem.
  acs_codes: [PA.I.C.R1]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Named-driver rule for go/no-go decisions."
  back: |
    Every decision should name the specific hazard or specific uncertainty
    that drives it. 'Embedded thunderstorms in convective SIGMET on the
    middle leg' is a driver; 'weather looks bad' is not. The named driver
    is what makes the decision defensible to yourself when trip-pressure
    builds, and to whoever was counting on the trip if it doesn't happen.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, named-driver, judgment]
  source_ref: |
    Body Problem + Reveal "trip pressure framework."
  acs_codes: [PA.I.C.R1]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "No-go conditions that should produce immediate stop without a framework cycle?"
  back: |
    Thunderstorms or Convective SIGMET on the route at your time.
    Severe icing forecast or PIREP'd along the route at any usable altitude.
    Mountain wave / severe turbulence forecast or PIREP'd in airframes
    that aren't structurally rated for it.
    IFR conditions for a VFR or non-instrument-rated pilot.
    Personal minimums exceeded and not recoverable by route or altitude
    change.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, no-go, immediate-stop]
  source_ref: |
    Body Reveal "no-go conditions that don't need a framework."
  acs_codes: [PA.I.C.R1c, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "The go/no-go is a sequence of moments, not one decision. Name the moments and what's available at each."
  back: |
    At the keyboard, day-of: full brief, full latitude, no money on the table.
    At the airport, preflight: updated brief, runup observations, last latitude.
    Run-up complete: real airplane health; weather still on the ground.
    Climb-out: real outside air, real ride, FIS-B coming online.
    Top-of-climb / cruise: full in-flight picture, divert option still cheap.
    Descent / approach: decision window narrows; commit pressure rises.
    Discipline: hold the decision lightly through every moment until the
    sequence ends.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, decision-moments, divert]
  source_ref: |
    Body Reveal sequence table.
  acs_codes: [PA.I.C.R1a, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Three categories of input to a go/no-go decision per the body?"
  back: |
    1. Hazards -- thunderstorms, icing, turbulence, IFR conditions, fog,
       terrain. Each comes from one or more products and is either present,
       forecast, or absent.
    2. Trends -- forecast getting better, getting worse, or holding. Compare
       latest METAR to most recent TAF amendment; if reality is running
       ahead of forecast, forecast is suspect for the rest of its valid period.
    3. Personal limits -- this airplane, this route, this pilot, this day.
       Personal minimums are the floor.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, hazards, trends, personal-minimums]
  source_ref: |
    Body Discover.
  acs_codes: [PA.I.C.R1, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Why is the *trend* (improving / steady / degrading) more important than the current value alone?"
  back: |
    A good current condition with a deteriorating trend is more dangerous
    than a marginal current condition with an improving trend. The current
    value is a snapshot; the trend is what the airplane will fly into. The
    standard cross-check is latest METAR vs. most recent TAF amendment --
    if reality is already running worse than forecast, the rest of the TAF
    is suspect, and you're flying into the surprise side of that error.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, trend, taf, metar]
  source_ref: |
    Body Discover "trends."
  acs_codes: [PA.I.C.R1, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Compressed working-pilot version of a go/no-go read?"
  back: |
    Read the brief in synoptic order (frame first, then hazards, then route,
    then airports last). Name the worst-case along the route. Ask if the
    flight survives the worst case with reserves. Ask what trend would
    change the answer in the next two hours. The compressed version produces
    a defensible decision faster than PAVE/DECIDE for repeated flights;
    PAVE/DECIDE remain the deeper structure for novel or marginal trips.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, framework, judgment]
  source_ref: |
    Body Discover (working-pilot compressed version).
  acs_codes: [PA.I.C.R1, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Friend asks you to fly them to a wedding three states away Saturday. METARs at destination show 4,000 broken with 6 SM light rain. GFA shows MVFR along 100 NM of route. Latest TAF amendment is six hours old and predicted better than reality. Walk the decision."
  back: |
    Frame the question correctly first: not 'is the weather flyable?' but
    'is the weather flyable for me, in this airplane, on this route, today?'
    Trend signal: reality is running worse than the TAF -- the forecast is
    suspect. MVFR ceiling on 100 NM is the named hazard. Branches: 'delay'
    until a fresh TAF amendment arrives is the underused option here;
    'go' requires margin for the deteriorating trend; 'no-go' requires a
    named driver (e.g., MVFR exceeds VFR personal minimum or no instrument
    fallback). External pressure (the wedding) is the bias to actively
    counter.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, scenario, mvfr, trip-pressure]
  source_ref: |
    Body Context + Discover.
  rationale: |
    Scenario card from the Context. Trains the full reframing the body teaches.
  acs_codes: [PA.I.C.R1, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook

- front: "Reverse: a flight ended worse than briefed. How does the body recommend you re-walk the brief?"
  back: |
    Walk the brief again. Identify which input would have changed your call
    if it had been weighted higher. That input is the variable the brief
    most needs to surface for you next time. The calibration loop is brief
    -> outcome -> retrospective brief -> updated weighting for the next
    similar setup. The discipline is doing the retrospective walk *every*
    time, not just after the bad outcomes.
  cardType: basic
  kind: recall
  tags: [weather, go-nogo, post-flight, calibration]
  source_ref: |
    Body Verify.
  acs_codes: [PA.I.C.R1, PA.I.C.S3]
  source_authority:
    - kind: other
      cite: FAA-H-8083-2A Risk Management Handbook
```

## Connect

This node is the synthesis target for the weather course. Every
preceding node feeds it: the synoptic story (s2), the hazards
(s3-s6), the products (s7-s8), the in-flight tools (s9). Personal
minimums (wx-personal-minimums) are the threshold the decision is
measured against; ADM hazardous attitudes (proc-adm-hazardous-
attitudes) are the framework for recognizing trip-pressure bias.

The decision is the same shape for every flight, but the inputs
shift. A summer afternoon flight is convection-dominated; a winter
cross-country is icing-dominated; a marginal-VFR night flight is
ceiling-dominated. The framework holds; the named drivers change.

## Verify

For a flight you have already flown, walk the brief from memory
and reconstruct the decision. Did you go because the brief
supported it, or because the trip was already on the calendar?
Was there a named driver? Did the flight expose a hazard the brief
either named or missed?

For a flight that turned out worse than briefed, walk the brief
again. What input would have changed your call if it had been
weighted higher? Whichever input that is, it's the variable the
brief most needs to surface for you next time.
