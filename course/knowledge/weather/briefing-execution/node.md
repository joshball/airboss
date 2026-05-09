---
id: wx-briefing-execution
title: Weather Briefing Execution
domain: weather
cross_domains: [flight-planning]

knowledge_types: [procedural]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-data-sources
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-airmets-sigmets
  - wx-personal-minimums

modalities: [reading, drill]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AIM
    detail: 7-1-4 -- Preflight Briefing
    note: The standard / abbreviated / outlook briefing types and what each delivers.
  - source: AIM
    detail: 7-1-3 -- Use of Aviation Weather Products
    note: Operational guidance on weather brief composition.
  - source: FAA-H-8083-25
    detail: Pilot's Handbook of Aeronautical Knowledge, Chapter 13 -- Aviation Weather Services
    note: Pilot-pitch reference on briefing types and use.
  - source: 14 CFR 91.103
    detail: Preflight Action
    note: The regulatory minimum for preflight weather information for any flight.

assessable: true
assessment_methods: [demonstration, scenario]
mastery_criteria: >
  Learner can request a standard, abbreviated, or outlook briefing
  appropriately to the planning horizon, walk a self-briefing on
  aviationweather.gov + ForeFlight that covers all 91.103 elements,
  and produce a defensible go / no-go / delay / divert plan from the
  resulting picture.
---

# Weather Briefing Execution

## Context

You're flying tomorrow morning. You open ForeFlight, glance at the
METAR strip and the TAF, see "VFR all day," and call it briefed. Your
CFI watches you do this and asks: "what's the freezing level along
your route at cruise?" You don't know. The brief was incomplete --
not because the products were unavailable, but because the procedure
wasn't.

## Problem

A weather brief is a procedure, not a glance. The pilot who runs the
procedure consistently catches the hazards a glance misses: the
forecast deterioration outside the destination's TAF window, the
AIRMET that runs perpendicular to the planned cross-country, the
freezing level that drops across a frontal boundary at the same
altitude that becomes IFR on the back side. Procedure beats vibes.

## Discover

Three briefing types per AIM 7-1-4, each appropriate to a different
planning horizon:

- Standard briefing: a complete brief for an imminent flight (within
  the next 6 hours). Includes adverse conditions, synopsis, current
  conditions, en route forecast, destination forecast, winds aloft,
  NOTAMs, ATC delays. Request from Flight Service when planning
  inside the standard window.
- Abbreviated briefing: an update to a previously obtained standard
  briefing, or to fill in one or two specific gaps. Faster; assumes
  prior context.
- Outlook briefing: forecast picture for a flight more than 6 hours
  out. No current conditions; just the forecast. Use for next-day
  planning.

The actual self-brief procedure on aviationweather.gov + an EFB
follows the AIM standard-briefing structure:

1. Adverse conditions: convective outlook, AIRMETs, SIGMETs,
   Convective SIGMETs, TFRs along route or at destination.
2. Synopsis: surface analysis chart, current and forecast positions
   of fronts, highs, lows.
3. Current conditions: METARs along the route + at destination. PIREPs
   in the route corridor.
4. En route forecast: GFA scrubbed from now to ETA, layered on the
   route. Cig/vis, clouds, icing, turbulence, weather.
5. Destination forecast: TAF for destination + alternate.
6. Winds aloft: FB at planned cruise altitude.
7. NOTAMs: airport NOTAMs (departure, destination, alternate),
   FDC NOTAMs along route, GPS NOTAMs if applicable.
8. ATC delays: relevant Center / TRACON / TFR notes.

For a Flight Service phone briefing (1-800-WX-BRIEF / 1800wxbrief.com)
the same eight buckets show up in the same order. Walk the briefer
through your route once and the brief flows.

## Reveal

The 91.103 floor is "all available information concerning that
flight." For any flight not in the vicinity of the airport this
includes: weather reports and forecasts, fuel requirements,
alternatives if planned flight cannot be completed, and any known
traffic delays. The brief satisfies most of this; the rest is
nav planning + fuel planning.

A good brief produces three written outputs:

1. The route's forecast picture, in order.
2. A go / delay / divert / no-go plan with explicit triggers.
3. Personal minimums comparison: which numbers in the brief are
   inside or outside your written floor.

The third output is the bridge to the personal-minimums node and the
go/no-go decision.

## Practice

For your next flight, run the eight-bucket brief on aviationweather.gov
and your EFB. Time it. The first time it'll take 25-30 minutes; the
fifth time it'll take 12-15. The discipline is in the repetition until
the buckets are automatic.

For the briefing-types element on the checkride: when the examiner
asks "what kind of briefing would you request for [scenario]?", the
question is really "what's the planning horizon?" An outlook briefing
for tomorrow; a standard for today's afternoon flight; an abbreviated
to update a brief from this morning before a 1500L departure.

## Connect

This node serves S1 directly: the skill is "use available aviation
weather resources to obtain an adequate weather briefing." It feeds
S3 (correlate to make a go/no-go decision) by producing the input the
go/no-go node consumes. The data-sources node tells you who publishes
what; this node tells you how to walk through them in order.

## Verify

Run a brief end-to-end for a 200 NM cross-country tomorrow. Produce
the three outputs above. Show the result to another pilot or CFI. If
they can defend the go/no-go decision from your written brief alone,
the procedure produced a usable artifact. If they can't, find the
missing bucket.
