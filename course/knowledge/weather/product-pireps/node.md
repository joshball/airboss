---
id: wx-product-pireps
title: PIREPs -- Reading and Filing
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [factual, procedural, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires: []
deepens:
  - wx-reading-metars-tafs
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-data-sources
  - wx-product-airmets-sigmets

modalities: [reading, cards, drill]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Section 5 -- PIREPs
    note: Format spec, encoding rules, distinction between UA (routine) and UUA (urgent).
  - source: AIM
    detail: 7-1-19 -- Pilot Weather Reports
    note: When to file a PIREP; reporting urgent (UUA) conditions.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))
    note: Modern pilot-facing reference for PIREP shape and use.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a UA / UUA PIREP without a key, distinguish routine
  from urgent reports, name the conditions that mandate an urgent report,
  and articulate when filing a PIREP is the right next radio call.
---

# PIREPs -- Reading and Filing

PIREPs are members of the encoded-text family (see
[wx-reading-metars-tafs](../reading-metars-tafs/node.md) for the full
treatment of the family pattern). Read them through the same
three-stage ladder:

- **Decode** -- mechanical translation of the slash-delimited fields
  to facts.
- **Understand** -- placing the report into the synoptic picture
  and the reporting aircraft's perspective. A 737's "light chop" is
  a Cherokee's "moderate."
- **Triage** -- separating the reports that matter for *this flight*
  from the ones that don't. Type, altitude, position relative to your
  route, and time-since-report all gate relevance.

PIREPs are the only weather product authored by another pilot in
flight, which makes them the highest-fidelity record of what an
airframe is actually feeling at altitude. The pilot habit is to grow
the system by filing as well as consuming.

## Context

You're climbing to your filed altitude over the central valley and the
ride goes from glassy-smooth to a series of jolts that pop your kneeboard
off the yoke. You ask Center for ride reports; the controller comes back
with: "UA /OV PXN360010/TM 1845/FL085/TP C172/TB MOD CHOP/RM CONTINUOUS."
What did she just tell you?

## Problem

PIREPs are the only weather product authored by pilots, and the only
real-time turbulence / icing / cloud-base report that matches the actual
conditions an airplane is flying through. Forecasts (AIRMETs / SIGMETs)
predict; observations (METARs) describe ground-level state; PIREPs
describe what flight-level air is actually doing right now. To use them
you have to read them quickly and to grow them you have to file them.

## Discover

### Stage 1: Decode

Walk the example field by field, deriving the encoding from context
rather than memorizing a key:

- `UA` -- routine pilot report (vs. `UUA` -- urgent).
- `/OV PXN360010` -- over Panoche VOR, 360 radial, 10 NM (a position
  fix encoded as VOR / radial / distance).
- `/TM 1845` -- time 1845Z.
- `/FL085` -- flight level 8,500 ft (above 18,000 it would be `FL180`).
- `/TP C172` -- aircraft type Cessna 172. The reporter's airplane is the
  context for any turbulence / icing severity claim.
- `/TB MOD CHOP` -- moderate chop (intensity + character).
- `/RM CONTINUOUS` -- remarks: continuous (vs. occasional / intermittent).

### Stage 2: Understand

Now ask why the type matters: because a Citation's "light chop" is a
Cherokee's "moderate." Severity is encoded relative to the reporting
airplane, and that's the most-missed reading skill on PIREPs.

The Panoche position at 8,500 with continuous moderate chop in a
C172 places the report in the boundary-layer altitudes over the
California Central Valley -- a classic afternoon thermal-turbulence
setup over hot inland terrain on a sunny day. The synoptic frame
explains the report: convective mixing in unstable air over warm
ground, smoothing out above the convective-layer top.

### Stage 3: Triage

For your own flight at 8,500 over the same area, the relevant
questions are time-since-report (15 minutes is current; 90 minutes
is stale because thermals don't sit still), aircraft-type match
(C172 to your C182 is close enough for a near-direct read), and
whether climbing above the convective-layer top is feasible. If
the answer is yes, the PIREP is a strong "climb to 11,500" cue.

For a Citation pilot reading the same report, triage flips: a C172
moderate is a Citation light, the time-of-day is the strong cue,
and the report shifts from "climb out of it" to "expect bumps for
five minutes; ride them out."

## Reveal

Standard PIREP fields, ordered:

| Field | Meaning                                              |
| ----- | ---------------------------------------------------- |
| UA    | Routine pilot report                                 |
| UUA   | Urgent pilot report (one of the trigger conditions)  |
| /OV   | Over -- position relative to a navaid or fix         |
| /TM   | Time (UTC, 4 digits)                                 |
| /FL   | Flight level (always 3 digits, hundreds of feet MSL) |
| /TP   | Aircraft type                                        |
| /SK   | Sky cover (e.g. SCT040 OVC100)                       |
| /WX   | Weather phenomena (RA, SN, FZRA, etc.)               |
| /TA   | Outside air temperature (Celsius)                    |
| /WV   | Wind velocity (direction/speed, e.g. 27045)          |
| /TB   | Turbulence (intensity + character + duration)        |
| /IC   | Icing (intensity + type)                             |
| /RM   | Remarks (free text)                                  |

UUA (urgent) triggers per AIM 7-1-19: tornadoes, funnel clouds, or
waterspouts; severe or extreme turbulence; severe icing; hail; low-level
windshear (an airspeed change of 10 KT or more); volcanic ash. Any one
of these makes the report urgent and prompts immediate dissemination.

Per AIM 7-1-20, pilots are encouraged to file PIREPs in any case "even
when no hazardous conditions exist." Flight Service ingests the report;
it then becomes a public NWS product and feeds back into briefings,
EFB displays, and ATC ride-report queries.

## Practice

Decode this PIREP yourself, then check:

> UUA /OV ABE090020/TM 2147/FL120/TP B737/IC SEV CLR/RM TOPS 14000 LWR
> 11000

- UUA: urgent.
- Position: ABE VOR 090 radial, 20 NM east.
- Time: 2147Z.
- Altitude: 12,000 MSL.
- Type: 737.
- Icing: severe clear.
- Remarks: cloud tops 14,000, bases 11,000.

A 737 reporting severe clear icing in a 3,000 ft cloud layer is a
rebriefable event for any GA airplane on the route. This is the moment to
re-evaluate descent / climb path.

### Cards (spaced repetition)

Cards mined from the body. Field-decode cards build the decode floor;
UA vs UUA + trigger cards are the urgency rule; the aircraft-type-
relativity card carries the central understand step.

```yaml-cards
- front: "PIREP vs forecast: what's the operational difference between a PIREP and an AIRMET/SIGMET?"
  back: |
    PIREP = observation, authored in flight by another pilot, describing
    what an airframe is actually feeling at altitude right now. AIRMET /
    SIGMET = forecast, predicting hazardous conditions over a polygon
    valid for a window. PIREPs are the only real-time turbulence / icing /
    cloud-base reports that match actual flight-level conditions; they
    are the truth-up for the forecast products.
  cardType: basic
  kind: recall
  tags: [weather, pirep, observation, ac-00-45h, aim-7-1-19]
  source_ref: |
    AC 00-45H Section 5 PIREPs; AIM 7-1-19; body Problem.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Decode PIREP field by field: UA /OV PXN360010 /TM 1845 /FL085 /TP C172 /TB MOD CHOP /RM CONTINUOUS"
  back: |
    UA = routine pilot report.
    /OV PXN360010 = over Panoche VOR, 360 radial, 10 NM (VOR / radial /
    distance encoding).
    /TM 1845 = time 1845Z.
    /FL085 = flight level 8,500 ft.
    /TP C172 = aircraft type Cessna 172.
    /TB MOD CHOP = moderate chop (intensity + character).
    /RM CONTINUOUS = remarks: continuous (vs. occasional / intermittent).
  cardType: basic
  kind: recall
  tags: [weather, pirep, decode, ac-00-45h]
  source_ref: |
    AC 00-45H Section 5; body Discover decode walkthrough.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Standard PIREP field codes -- match each to its meaning: /OV, /TM, /FL, /TP, /SK, /WX, /TA, /WV, /TB, /IC, /RM."
  back: |
    /OV = Over (position relative to a navaid or fix).
    /TM = Time (UTC, 4 digits).
    /FL = Flight level (3 digits, hundreds of feet MSL).
    /TP = Aircraft type.
    /SK = Sky cover (e.g. SCT040 OVC100).
    /WX = Weather phenomena (RA, SN, FZRA, etc.).
    /TA = Outside air temperature (Celsius).
    /WV = Wind velocity (direction/speed).
    /TB = Turbulence (intensity + character + duration).
    /IC = Icing (intensity + type).
    /RM = Remarks (free text).
  cardType: basic
  kind: recall
  tags: [weather, pirep, decode, fields, ac-00-45h]
  source_ref: |
    AC 00-45H Section 5; body Reveal field table.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "UA vs UUA -- what's the distinction and what triggers UUA?"
  back: |
    UA = routine pilot report (default). UUA = urgent pilot report,
    triggering immediate dissemination. UUA triggers per AIM 7-1-19:
    tornadoes, funnel clouds, or waterspouts; severe or extreme
    turbulence; severe icing; hail; low-level windshear (airspeed change
    of 10 KT or more); volcanic ash. Any one trigger makes the report
    urgent.
  cardType: regulation
  kind: recall
  tags: [weather, pirep, uua, urgent, aim-7-1-19]
  source_ref: |
    AIM 7-1-19 Pilot Weather Reports; body Reveal.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Why does aircraft type (/TP) matter for reading turbulence and icing severity in a PIREP?"
  back: |
    Severity is encoded relative to the reporting airframe. A 737's 'light
    chop' is a Cherokee's 'moderate.' A Citation's 'severe icing' arrives
    in a Cessna far before the Citation pilot would call it severe. The
    /TP field is the calibration context for any severity claim; the
    most-missed reading skill on PIREPs is normalising severity to your
    own airframe instead of taking it at face.
  cardType: basic
  kind: recall
  tags: [weather, pirep, severity, aircraft-type, judgment]
  source_ref: |
    Body Discover Stage 2.
  rationale: |
    The body's central understand-step pitch: severity is relative to
    aircraft, not absolute. This card forces the learner to internalise
    the calibration.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Triage a turbulence PIREP for your flight: what three properties gate relevance?"
  back: |
    1. Time-since-report (15 minutes is current; 90 minutes is stale --
       thermals and convective cells don't sit still).
    2. Aircraft-type match (C172 to your C182 is a near-direct read; C172
       to your B737 is several severity levels different).
    3. Position relative to your route + altitude (PIREP at 8,500 over
       Panoche is informative for your 8,500 cruise through that area;
       a 28,000 ft Citation PIREP isn't).
  cardType: basic
  kind: recall
  tags: [weather, pirep, triage, currency, aircraft-type]
  source_ref: |
    Body Discover Stage 3.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Decode this urgent PIREP: UUA /OV ABE090020/TM 2147/FL120/TP B737/IC SEV CLR/RM TOPS 14000 LWR 11000"
  back: |
    UUA = urgent. Over ABE VOR, 090 radial, 20 NM east. Time 2147Z.
    Altitude 12,000 MSL. Aircraft B737. Icing: severe clear. Remarks:
    cloud tops 14,000, bases 11,000. A 737 reporting severe clear icing
    in a 3,000 ft cloud layer is a rebriefable event for any GA airplane
    on that route -- a Cessna would see the same icing arrive much
    earlier than the 737 did. Re-evaluate descent / climb path.
  cardType: basic
  kind: recall
  tags: [weather, pirep, uua, icing, scenario]
  source_ref: |
    Body Practice decode example.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Per AIM 7-1-20, when should pilots file a PIREP?"
  back: |
    Even when no hazardous conditions exist. The AIM encourages routine
    filing because Flight Service ingests the report; it becomes a public
    NWS product that feeds back into briefings, EFB displays, and ATC
    ride-report queries. A 'UA /OV xxx /TM xxxx /FL xxx /TP xxx /SK CLR
    /RM SMOOTH' is a valid and useful report -- the smoothness reading is
    the same kind of data point as a turbulence reading.
  cardType: regulation
  kind: recall
  tags: [weather, pirep, filing, aim-7-1-20]
  source_ref: |
    AIM 7-1-19/7-1-20; body Reveal.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Climb-out and the ride goes from glassy to jolts that pop your kneeboard off. You ask Center for ride reports. The controller comes back with a UA /OV PXN360010 /TM 1845 /FL085 /TP C172 /TB MOD CHOP. What's the synoptic story?"
  back: |
    Boundary-layer altitudes (8,500 ft) over hot inland terrain (California
    Central Valley) in the afternoon = classic thermal-turbulence setup.
    Convective mixing in unstable air over warm ground, smoothing out
    above the convective-layer top. Operational read for a similar
    airplane (C172 / C182): climb above the convective layer (often
    11,500 or higher) for smooth air; the moderate chop will continue
    until you do.
  cardType: basic
  kind: recall
  tags: [weather, pirep, thermal-turbulence, scenario]
  source_ref: |
    Body Context + Discover Stage 2.
  rationale: |
    Scenario card from the body's Context. Trains the synoptic-frame step
    -- not 'what did the PIREP say' but 'what produced the report.'
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))

- front: "Calibration drill: how many PIREPs in how much time, and what filing rate?"
  back: |
    Decode three random PIREPs from aviationweather.gov without a key in
    under three minutes total -- that establishes decode fluency. File one
    PIREP yourself in the next 10 hours of flight, even if conditions are
    benign -- that establishes contribution. Both habits compound: pilots
    who file PIREPs read PIREPs better, because they've thought about how
    severity claims feel from the cockpit side.
  cardType: basic
  kind: recall
  tags: [weather, pirep, drill, filing]
  source_ref: |
    Body Verify.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, Section 5 -- PIREPs
    - kind: aim
      cite: AIM 7-1-19 -- Pilot Weather Reports
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 24 -- Observations, Section 24.5.1 (Pilot Weather Reports (PIREP))
```

## Connect

PIREPs ground every other weather product. An AIRMET ZULU (icing) becomes
real when a PIREP confirms it; absent confirming PIREPs an AIRMET is a
forecast hypothesis. The go/no-go node depends heavily on PIREPs as the
"truth-up" check on the forecast picture. The K1 source map shows where
PIREPs come from; this node shows what they look like and when to file.

## Verify

Decode three random PIREPs from aviationweather.gov without a key in
under three minutes total. File one PIREP yourself in the next 10 hours
of flight, even if conditions are benign -- a `UA /OV xxx/TM xxxx/FL xxx
/TP xxx/SK CLR/RM SMOOTH` is a valid, useful report.
