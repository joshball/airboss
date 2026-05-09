---
id: wx-data-sources
title: Weather Data Sources for Flight Planning
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, conceptual]
technical_depth: working
stability: evolving

minimum_cert: private
study_priority: critical
requires: []
deepens: []
applied_by:
  - wx-briefing-execution
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-reading-metars-tafs
  - wx-product-airmets-sigmets

modalities: [reading, cards]
estimated_time_minutes: 25
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services
    note: The canonical reference for who publishes what aviation weather product, and where it comes from.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Briefing requestor's view of NWS / FSS-mediated products.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 26 -- Sources of Weather Information
    note: Post-2022 consolidated handbook -- the modern reference for data sources.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the principal aviation weather data sources (NWS / AWC,
  Flight Service via Leidos, FAA Weather Cameras, ADS-B FIS-B in flight),
  state which products each one originates vs. relays, and select an
  appropriate source for a given preflight or in-flight question.
---

# Weather Data Sources for Flight Planning

## Context

You sit down the night before a 200 NM cross-country and open three tabs:
1800wxbrief.com (Leidos Flight Service), aviationweather.gov (the Aviation
Weather Center), and ForeFlight. They each show overlapping but slightly
different pictures: a TAF on one site is current, on another is one cycle
old. Why? Whose product is whose?

## Problem

The "weather" you read is never raw atmosphere; it's an artifact produced
by a specific agency, on a specific schedule, with a specific intent.
Confusing the publisher of a product with its relayer is the source of
half the "but my EFB said..." anecdotes. To brief well you need a mental
map of who originates what, who relays it, and where each link can fail.

## Discover

Start with the question: which of those three tabs publishes original
weather, and which only re-render it?

- The National Weather Service (NWS) operates the Aviation Weather Center
  (AWC) in Kansas City and the regional Center Weather Service Units
  (CWSUs) embedded in ARTCCs. NWS issues METARs (with field observers and
  ASOS / AWOS automation), TAFs, AIRMETs, SIGMETs, Convective SIGMETs,
  Area Forecast Discussions, the Graphical Forecast for Aviation (GFA),
  Winds and Temperatures Aloft (FB), Center Weather Advisories (CWAs),
  Surface Analysis and Prog Charts. AWC is the canonical source for
  aviation weather products; aviationweather.gov is its public face.
- Flight Service (operated under contract by Leidos) does not originate
  weather. It relays NWS products through preflight briefings (standard,
  abbreviated, outlook), 1800wxbrief.com, and EFB integrations. It also
  takes PIREPs (which then become NWS products) and files flight plans.
- EFBs (ForeFlight, Garmin Pilot, FlyQ) re-render NWS products and add
  proprietary overlays. The data is NWS; the presentation is theirs.

In flight your sources change again: ADS-B FIS-B (free, ground-uplinked)
delivers METARs, TAFs, AIRMETs, SIGMETs, NEXRAD composite, winds aloft,
and TFRs. Sirius/XM Aviation Weather is a paid satellite alternative with
broader coverage and somewhat fresher products. Flight Watch (122.0) was
discontinued in 2015; the modern equivalent is Flight Service on the
appropriate frequency.

## Reveal

Map the agency to the product:

- AWC / NWS originates: METAR, SPECI, TAF, AIRMET, SIGMET, Convective
  SIGMET, GFA, FB, Surface Analysis, Prog Charts, Convective Outlook (AC).
- CWSU originates: CWAs (Center Weather Advisories) for terminal-radar
  coverage areas.
- Pilots originate: PIREPs (UA / UUA), filed via Flight Service or by an
  ATC controller forwarding the report.
- Flight Service relays everything above plus picks up your PIREPs and
  NOTAMs and AIRMETs.
- AC 00-45 is the regulatory inventory; FAA-H-8083-28 (Aviation Weather
  Handbook, 2022) replaced AC 00-6 + AC 00-45 as the consolidated pilot
  reference -- but AC 00-45 still defines product format.

For the K1 element on the checkride, the examiner wants you to name two
classes of source ("NWS-originated" vs "Flight Service mediated"), not
recite vendor names.

## Practice

Walk a real preflight: you're flying KPAO -> KMRY tomorrow, departing at
1500Z.

1. What's the current departure weather? -> METAR (NWS, observed via ASOS;
   relayed by Leidos / aviationweather.gov / EFBs).
2. What's the forecast at the destination at your arrival? -> TAF (NWS,
   issued 4x daily).
3. Are there hazards along the route? -> AIRMET (NWS, issued 4x daily;
   amended as conditions change), SIGMET (issued as needed), Convective
   SIGMET (issued hourly for active or expected convection).
4. What's the en-route picture? -> GFA (NWS, replaces the old Area
   Forecast text product since 2017).
5. What altitude has the best winds? -> FB (NWS, twice-daily forecast).

Each answer is one product, one source, one cycle. The decision quality
is bounded by the staleness of whichever product you trust.

## Connect

Sources feed every other Task C node: K2 is "what each product looks like
when you read it," K3 is "the underlying meteorology each product
encodes," R2 is "where each product lies to you," and S1 is "actually
running through a briefing." This node is the index that ties them
together.

## Verify

Self-check: name the originating agency for each of METAR, TAF, AIRMET,
SIGMET, GFA, FB, PIREP, CWA, Convective SIGMET, NEXRAD. Then name the
mechanism that delivers it to your aircraft both pre-flight and in-flight.
If you can map all ten products in under 60 seconds, you own K1.
