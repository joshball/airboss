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
