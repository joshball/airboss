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
    note: Post-2022 consolidated handbook -- the modern reference for data sources. Verify chapter -- the verified FAA-H-8083-28B ToC lists Chapter 26 as "Advisories"; data-source coverage likely lives in Chapter 2 (Aviation Weather Service Program) or Chapter 3 (Overview of Aviation Weather Information).

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

### Cards (spaced repetition)

Cards mined from the body. The originator-vs-relayer split is the
foundation cog. Product-to-source mapping cards lock the K1 recall set.

```yaml-cards
- front: "Two-class split per the K1 element: 'NWS-originated' vs 'Flight Service mediated'. What's the operational difference?"
  back: |
    NWS-originated products are produced by the Aviation Weather Center
    (AWC), the regional CWSUs, and ASOS/AWOS observers -- METARs, TAFs,
    AIRMETs, SIGMETs, GFA, FB, Surface Analysis, Convective SIGMETs, CWAs.
    Flight Service (Leidos under contract) does not originate weather; it
    relays NWS products through 1800wxbrief.com, the standard/abbreviated/
    outlook briefings, and EFB integrations. It also collects PIREPs and
    files flight plans. K1 wants you to name the two classes, not vendors.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, nws, flight-service, PA.I.C.K1]
  source_ref: |
    AC 00-45H Aviation Weather Services; body Reveal "For the K1 element."

- front: "Who originates METARs, TAFs, AIRMETs, SIGMETs, Convective SIGMETs, GFA, FB, and Surface Analysis?"
  back: |
    All originate from the National Weather Service (NWS), specifically the
    Aviation Weather Center (AWC) in Kansas City and its supporting offices.
    METARs come from ASOS/AWOS automation + field observers (NWS-certified
    sensors); the rest are AWC-issued products. aviationweather.gov is the
    AWC's public face.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, nws, awc, PA.I.C.K1]
  source_ref: |
    AC 00-45H; body Reveal product-to-agency map.

- front: "Who originates CWAs (Center Weather Advisories)?"
  back: |
    The Center Weather Service Units (CWSUs) -- NWS units embedded in each
    ARTCC. CWAs cover terminal-radar areas and serve as the regional
    short-fuse hazard advisory between AIRMET and SIGMET timescales. They
    address conditions that don't yet meet SIGMET criteria but are
    affecting traffic in the Center's airspace right now.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, cwsu, cwa, PA.I.C.K1]
  source_ref: |
    AC 00-45H; body Reveal.

- front: "Who originates PIREPs, and through whom do they reach the system?"
  back: |
    Pilots originate PIREPs (routine UA or urgent UUA). They reach the
    system through Flight Service (1-800-WX-BRIEF or in-flight FSS frequency)
    or through an ATC controller forwarding the report. Once filed, they
    become an NWS-distributed product through the normal channels.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, pirep, flight-service, PA.I.C.K1]
  source_ref: |
    AC 00-45H; body Reveal.

- front: "ADS-B FIS-B vs. SiriusXM Aviation Weather: cost, coverage, freshness?"
  back: |
    ADS-B FIS-B: free, ground-uplinked, requires ADS-B In receiver, coverage
    requires line of sight to a ground station (drops below ~5,000 ft AGL,
    disappears in mountain shadows). Delivers METARs, TAFs, AIRMETs, SIGMETs,
    NEXRAD composite, winds aloft, TFRs.
    SiriusXM Aviation Weather: paid subscription, satellite-uplinked,
    broader / continuous coverage and somewhat fresher products.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, fis-b, siriusxm, ads-b, PA.I.C.K1]
  source_ref: |
    AC 00-45H; body Discover.

- front: "Flight Watch 122.0 -- what's its current status and what replaced it?"
  back: |
    Flight Watch on 122.0 was discontinued in 2015. The modern equivalent is
    Flight Service on the appropriate FSS frequency. The change matters for
    older training material that still references the dedicated en-route
    frequency.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, flight-service, PA.I.C.K1]
  source_ref: |
    Body Discover.

- front: "EFB weather (ForeFlight, Garmin Pilot, FlyQ) -- who originates the data?"
  back: |
    The data is NWS / FAA; the presentation is the EFB vendor's. EFBs re-render
    NWS products and add proprietary overlays. A TAF in ForeFlight is the
    same TAF as on aviationweather.gov; if one is more current, it's because
    that source pulled the latest cycle first, not because either originated it.
    This is why "but my EFB said..." stories are usually presentation drift,
    not data drift.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, efb, foreflight, PA.I.C.K1]
  source_ref: |
    Body Discover + Context.

- front: "Self-check: name the originating agency for METAR, TAF, AIRMET, SIGMET, GFA, FB, PIREP, CWA, Convective SIGMET, NEXRAD."
  back: |
    All ten are NWS-originated (within the NWS, AWC for most and CWSU for
    CWAs); PIREPs are pilot-originated but flow through Flight Service /
    ATC and are distributed as NWS products. NEXRAD radar mosaics are
    produced by the NWS Radar Operations Center; the composite imagery on
    your EFB is NWS data. If you can map all ten in under 60 seconds, you
    own K1.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, nws, PA.I.C.K1]
  source_ref: |
    Body Verify.
  rationale: |
    The body's Verify drill is the K1 floor. This card forces the learner
    to walk the full ten before declaring K1 done.

- front: "FAA-H-8083-28 (Aviation Weather Handbook) replaced which earlier publications, and what role does AC 00-45 still play?"
  back: |
    FAA-H-8083-28 (Aviation Weather Handbook, 2022) replaced AC 00-6
    (Aviation Weather) and is now the consolidated pilot reference. AC 00-45
    (Aviation Weather Services) is still the canonical reference for product
    *format* -- the symbol set, decoding conventions, and exact group
    layouts. Use the handbook for concepts; reach for AC 00-45 when you need
    the exact format.
  cardType: basic
  kind: recall
  tags: [weather, data-sources, reference, ac-00-45h, faa-h-8083-28, PA.I.C.K1]
  source_ref: |
    Body Reveal.
```

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
