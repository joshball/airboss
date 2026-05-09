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
    detail: Aviation Weather Handbook, Chapter 22 -- Observations and Pilot Reports
    note: Modern pilot-facing reference for PIREP shape and use.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a UA / UUA PIREP without a key, distinguish routine
  from urgent reports, name the conditions that mandate an urgent report,
  and articulate when filing a PIREP is the right next radio call.
---

# PIREPs -- Reading and Filing

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

Decode the example above field by field, deriving the encoding from
context rather than memorizing a key:

- `UA` -- routine pilot report (vs. `UUA` -- urgent).
- `/OV PXN360010` -- over Panoche VOR, 360 radial, 10 NM (a position
  fix encoded as VOR / radial / distance).
- `/TM 1845` -- time 1845Z.
- `/FL085` -- flight level 8,500 ft (above 18,000 it would be `FL180`).
- `/TP C172` -- aircraft type Cessna 172. The reporter's airplane is the
  context for any turbulence / icing severity claim.
- `/TB MOD CHOP` -- moderate chop (intensity + character).
- `/RM CONTINUOUS` -- remarks: continuous (vs. occasional / intermittent).

Now ask: why does the type matter? Because a Citation's "light chop" is a
Cherokee's "moderate." Severity is encoded relative to the reporting
airplane.

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
