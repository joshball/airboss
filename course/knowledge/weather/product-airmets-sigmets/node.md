---
id: wx-product-airmets-sigmets
title: AIRMETs, SIGMETs, and Convective SIGMETs
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [factual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-reading-metars-tafs
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-thunderstorm-hazards
  - wx-icing-types-and-avoidance
  - wx-turbulence-types

modalities: [reading, cards, drill]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, In-flight Aviation Weather Advisories section
    note: Format spec for AIRMET / SIGMET / Convective SIGMET product structure.
  - source: AIM
    detail: 7-1-6 -- Inflight Aviation Weather Advisories
    note: Operational use, valid times, the SIERRA / TANGO / ZULU AIRMET letter taxonomy.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Forecasts
    note: Modern consolidated reference for in-flight advisories.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the three AIRMET types (SIERRA / TANGO / ZULU) and
  what each warns of, distinguish AIRMET from SIGMET by severity
  threshold, distinguish Convective SIGMET from non-convective SIGMET
  by trigger conditions, and use any of the three to inform a divert
  decision in flight.
---

# AIRMETs, SIGMETs, and Convective SIGMETs

## Context

You're 30 minutes into a flight when ATC says, "Cessna 345, advise you
of Convective SIGMET 32C, valid 1855Z, central California, line of
embedded thunderstorms 100 NM wide, tops to FL420, moving 040 at 25,
hail 1 inch, wind gusts to 60 KT." That single sentence is dense with
operational implication. To act on it correctly you have to know what
a Convective SIGMET is and what it isn't.

## Problem

Three families of in-flight advisory cover the spectrum from "be aware"
to "stop flying immediately": AIRMET (significant to small aircraft),
SIGMET (significant to all aircraft), Convective SIGMET (active or
imminent convection that's significant to all aircraft). They differ
in trigger threshold, valid time, issuing authority within the NWS,
and operational meaning. Mixing them up downgrades a real warning or
inflates a routine one.

## Discover

Start with AIRMET (Airmen's Meteorological Information). The naming
gives the audience away: airmen, plural, generally pilots in light
aircraft. AIRMETs come in three flavors, each tagged with a phonetic
letter:

- AIRMET SIERRA -- IFR conditions (ceiling < 1,000 / vis < 3 SM over
  > 50% of an area) and mountain obscuration.
- AIRMET TANGO -- moderate turbulence, sustained surface winds > 30
  KT, and non-convective low-level wind shear.
- AIRMET ZULU -- moderate icing and freezing levels.

Issued every 6 hours (with amendments as needed) and valid for 6
hours. The thresholds describe the floor of "significance to a Cessna":
moderate turbulence, IFR, moderate icing.

SIGMET (Significant Meteorological Information) is the next tier up:
significant to all aircraft, light and heavy alike. Trigger conditions
include severe icing not associated with thunderstorms, severe or
extreme turbulence not associated with thunderstorms, dust storms /
sandstorms reducing visibility below 3 SM, and volcanic ash. Valid for
4 hours (6 for volcanic ash / hurricanes). Updated as needed.

Convective SIGMET is the most operational of the three: active or
expected severe thunderstorms (surface winds > 50 KT, hail > 3/4
inch, tornadoes), embedded thunderstorms, lines of thunderstorms, or
thunderstorm areas covering > 40% of an area at level VIP 4 or above.
Issued hourly at H+55 for the next two hours, with special issuances
between regular times when conditions warrant.

## Reveal

Comparison table:

| Product           | Audience       | Severity threshold       | Valid time |
| ----------------- | -------------- | ------------------------ | ---------- |
| AIRMET SIERRA     | Light aircraft | IFR / mountain obscure   | 6 hr       |
| AIRMET TANGO      | Light aircraft | MOD turb / wind / shear  | 6 hr       |
| AIRMET ZULU       | Light aircraft | MOD icing / freezing lvl | 6 hr       |
| SIGMET            | All aircraft   | Severe turb / SVR icing  | 4 hr       |
| Convective SIGMET | All aircraft   | Active / expected TS     | 2 hr       |

Notable: there is no separate "Convective AIRMET." Convection above the
threshold goes directly to Convective SIGMET; convection below it
isn't advisory-flagged separately, though the surrounding turbulence
and icing may trigger the others.

Reading order during a brief: SPC convective outlook (strategic, days)
-> Convective SIGMET (tactical, hours) -> NEXRAD (real-time, minutes).
That sequence answers the same question -- "is convection a problem?"
-- at three time horizons.

## Practice

Decode the example from the Context section: "Convective SIGMET 32C,
valid 1855Z, central California, line of embedded thunderstorms 100 NM
wide, tops to FL420, moving 040 at 25, hail 1 inch, wind gusts to 60
KT."

- 32C: this is the 32nd Convective SIGMET issued today, central US
  region (C). The other two regions are E (eastern) and W (western).
- Valid 1855Z: expires 2 hours from issuance.
- Embedded means the storms are buried in stratiform cloud -- you
  can't see them visually until you're on top.
- Tops to FL420: way above any GA aircraft's reach. The line is not
  flyable around in the vertical.
- 100 NM wide: not flyable around in the lateral either, in any
  reasonable time.

Operational read: divert behind the line, land, wait. There is no
"thread the needle" option for an embedded line that wide.

## Connect

AIRMETs and SIGMETs are forecast products; PIREPs are the truth-up.
An AIRMET ZULU is a hypothesis until a PIREP confirms it -- but the
hypothesis is enough to plan around. The K2g element calls for these
products specifically; this node is the depth, the K2 GFA node is the
breadth (the GFA layer that displays them spatially).

## Verify

For tomorrow's planned route, pull every active and forecast AIRMET,
SIGMET, and Convective SIGMET. Identify which advisory type each one
is, what condition it warns of, when it expires, and how it intersects
your planned route in space and time. If any of the three intersect
your flight path, articulate the alternative action you'd take and
when you'd commit to it.
