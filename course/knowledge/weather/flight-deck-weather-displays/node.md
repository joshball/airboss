---
id: wx-flight-deck-weather-displays
title: Flight Deck Weather Displays
domain: weather
cross_domains: [decision-making, flight-planning]

knowledge_types: [factual, judgment]
technical_depth: working
stability: evolving

minimum_cert: private
study_priority: critical
requires:
  - wx-reading-metars-tafs
  - wx-product-airmets-sigmets
deepens: []
applied_by:
  - wx-go-nogo-decision
  - wx-equipment-and-data-limitations
taught_by: []
related:
  - wx-data-sources

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-63A
    detail: Use of Cockpit Displays of Digital Weather and Aeronautical Information
    note: FAA's primary reference on operational use, latency, and limitations of cockpit weather displays.
  - source: AIM
    detail: 7-1-11 -- Weather Observing Programs (FIS-B); 7-1-12 -- Datalink Weather
    note: Source descriptions and operational guidance for FIS-B and other datalink products.
  - source: NTSB Safety Alert SA-017
    detail: In-Cockpit NEXRAD Mosaic Imagery
    note: The canonical industry warning about NEXRAD age vs. age indicator.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the principal cockpit weather data sources (ADS-B
  FIS-B, SiriusXM Aviation Weather, ARINC datalink, EFB cellular),
  state the actual age of "current" NEXRAD mosaic imagery (vs. the
  displayed age), articulate the latency hazard for tactical
  thunderstorm avoidance, and use cockpit weather displays as
  strategic confirmation rather than tactical avoidance.
---

# Flight Deck Weather Displays

## Context

You're 30 NM south of a building line of cumulonimbus that your EFB
shows as a cluster of yellow and orange returns -- moderate to heavy
precipitation, but discrete cells with gaps. You pick a heading
through a gap. As you commit, ATC calls: "advise you of Convective
SIGMET, line of severe thunderstorms, hail and severe turbulence,
moving 050 at 30." You glance back at the EFB; the cells now block
your chosen path. The picture you flew into was 8 minutes old.

## Problem

In-cockpit weather displays are the most operationally consequential
weather technology of the past 20 years -- and the most dangerous
when misused. They invite tactical thunderstorm penetration when the
data they present is too old for tactical use. The NTSB has named
the misuse pattern explicitly. Understanding what the displays are
and what they aren't is foundational risk management for any modern
GA pilot.

## Discover

The age problem in one paragraph: ADS-B FIS-B NEXRAD mosaic imagery
is delivered to the cockpit on a refresh cycle of 5-10 minutes, but
the underlying NEXRAD radar sweep itself takes 4-6 minutes plus
processing time. Add data-uplink batching and you can be looking at
a "current" radar picture that depicts what the atmosphere was doing
12-15 minutes ago. The displayed age indicator on most EFBs shows
the data-link age, not the original radar sweep age. A "1 minute"
age indicator can correspond to data that is 11 minutes old at the
sensor.

For a thunderstorm cell moving at 30 KT, 12 minutes is 6 NM of
displacement. The cell you see in the cockpit is 6 NM behind where
the cell actually is. The "gap" you flew toward closed before you
got there. This is the core mechanism of NEXRAD-induced thunderstorm
penetrations.

## Reveal

Display sources by data freshness:

| Source         | Coverage                       | Latency                            | Cost         |
| -------------- | ------------------------------ | ---------------------------------- | ------------ |
| ADS-B FIS-B    | Within ~250 NM of ground sites | 5-10 min upload + radar age        | Free         |
| SiriusXM Wx    | CONUS-wide                     | 1-3 min upload + radar age         | Subscription |
| ARINC datalink | Global                         | Plan-specific (text products)      | Subscription |
| EFB cellular   | Surface-only                   | Real-time at last cellular contact | Data plan    |
| Onboard radar  | ~80 NM range                   | Real-time, line of sight           | Hardware     |

Onboard radar (Bendix-King RDR series, etc.) is the only datalink-free
real-time weather sensor most GA aircraft can carry, and it's still
not real-time tactical: it shows precipitation, not turbulence; it
attenuates behind the first heavy cell; it requires interpretation
training to be useful at all.

NTSB SA-017 (2012) summarized the operational rule: NEXRAD mosaic
imagery is for strategic situational awareness, not tactical
avoidance. The recommended distance from any echo on a cockpit
display is 20 NM minimum -- larger than the 5 NM thunderstorm
avoidance rule that applies to visual or onboard-radar separation,
explicitly because the displayed picture is too old to support the
shorter distance.

Other cockpit weather products and their gotchas:

- METAR / TAF text: refresh cycle minutes; reliable but airport-tied.
- Winds aloft: forecast product; refresh by FB cycle (12 hr) but the
  underlying forecast may be 6 hr old at issuance.
- AIRMET / SIGMET text: reliable; refresh cycle of the issuance.
- Lightning detection (Stormscope, FIS-B lightning): real-time
  electrical activity. The single most useful tactical thunderstorm
  cue available in the cockpit because it's free of the radar age
  problem. Lightning maps a cell's location now, not 10 minutes ago.
- Pilot reports: if visible on the display, near-current; small N
  problem (depends on whether anyone has flown nearby recently).

## Practice

On your next EFB session, find the data age indicator for the NEXRAD
overlay. Read the EFB's documentation: does the indicator show the
radar sweep age, the FIS-B uplink age, or the time since your tablet
last received the uplink? The answer is almost certainly "uplink age,"
not "radar age" -- and that's the latency you have to add in your
head to interpret what you're seeing.

Before any flight where convection is forecast: pre-decide your
divert, your minimum stand-off distance from any cockpit-displayed
echo (20 NM is the standard), and your "I'm landing if X" trigger.
The pre-decided rules survive the moment when the cockpit picture
disagrees with the windshield.

### Cards (spaced repetition)

Cards mined from the body. The age-problem cards are the safety floor;
display-source cards build the comparison set; strategic-vs-tactical
is the operational rule the NTSB makes explicit.

```yaml-cards
- front: "Why is NEXRAD mosaic imagery in the cockpit actually older than the displayed age indicator suggests?"
  back: |
    Three latency layers stack: (1) NEXRAD radar sweep itself takes 4-6
    minutes plus processing; (2) ADS-B FIS-B uplink batches and pushes the
    composite every 5-10 minutes; (3) the EFB age indicator usually shows
    *uplink* age, not the original radar sweep age. A "1 minute" indicator
    can correspond to data 11-12 minutes old at the sensor. Real ceiling:
    treat any cockpit NEXRAD as 10-15 minutes stale even when the indicator
    says less.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, nexrad, latency, ac-00-63a, PA.I.C.K4]
  source_ref: |
    AC 00-63A; NTSB SA-017; body Discover.
  rationale: |
    The body's central pedagogical point. Without this card the rest of the
    K4 vocabulary has nothing to anchor to.

- front: "Thunderstorm cell at 30 KT, NEXRAD age 12 minutes: how far has the cell moved since the displayed picture?"
  back: |
    30 KT x (12/60) hr = 6 NM. The cell on your screen is 6 NM behind where
    the cell actually is. A "gap" 3 NM wide on the display can close
    completely before you fly through it. This is the mechanism behind the
    canonical NEXRAD-induced thunderstorm penetration accident.
  cardType: calculation
  kind: calculation
  tags: [weather, flight-deck-displays, nexrad, thunderstorm, latency, PA.I.C.K4]
  source_ref: |
    NTSB SA-017; body Discover worked example.

- front: "ADS-B FIS-B vs SiriusXM Aviation Weather: latency, coverage, and cost?"
  back: |
    FIS-B: 5-10 min uplink batching + radar age; coverage within ~250 NM of
    a ground site (line-of-sight, drops below ~5,000 ft AGL); free with
    ADS-B In receiver.
    SiriusXM Aviation Weather: 1-3 min uplink + radar age; CONUS-wide
    satellite coverage; subscription. SiriusXM is somewhat fresher and
    has broader geographic coverage.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, fis-b, siriusxm, ads-b, PA.I.C.K4]
  source_ref: |
    AC 00-63A; AIM 7-1-11; body Reveal table.

- front: "Onboard radar (Bendix-King RDR series) -- range, what it shows, and three things it doesn't tell you."
  back: |
    Range about 80 NM, real-time along line of sight. Shows precipitation
    intensity. Doesn't show: (1) turbulence (dry hailshaft and clear-air
    microburst are invisible), (2) what's behind the first heavy cell
    (attenuation creates a "shadow" of low return that hides a second
    cell), (3) anything outside the radar's selected tilt band (active
    tilt management is required to interrogate altitudes).
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, onboard-radar, attenuation, PA.I.C.K4]
  source_ref: |
    AC 00-63A; body Reveal.

- front: "Per NTSB SA-017, what is the operational rule for NEXRAD mosaic imagery in the cockpit?"
  back: |
    Strategic situational awareness, not tactical avoidance. The recommended
    minimum distance from any cell on a cockpit display is 20 NM -- larger
    than the 5 NM thunderstorm rule that applies to visual or onboard-radar
    separation, explicitly because the displayed picture is too old to
    support the shorter distance.
  cardType: regulation
  kind: recall
  tags: [weather, flight-deck-displays, nexrad, ntsb, 20nm, PA.I.C.K4]
  source_ref: |
    NTSB Safety Alert SA-017 (2012) In-Cockpit NEXRAD Mosaic Imagery.

- front: "Why is lightning detection (Stormscope, FIS-B lightning) the most useful tactical thunderstorm cue in the cockpit?"
  back: |
    Lightning detection shows electrical activity in real time -- free of
    the NEXRAD age problem. The display maps a cell's *current* electrical
    footprint, not where it was 10 minutes ago. The weakness: it shows
    only electrical activity, so a heavy snow shower or non-electrical
    convection is invisible. But for thunderstorm avoidance specifically,
    it's the cockpit's best now-picture.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, stormscope, lightning, tactical, PA.I.C.K4]
  source_ref: |
    AC 00-63A; body Reveal lightning bullet.

- front: "EFB cellular weather: when is it real-time and when does it stop being useful?"
  back: |
    Real-time at the last cellular contact -- which is on the ground or at
    very low altitude near urban areas. The moment the tablet loses
    cellular signal (most cruise altitudes, most of the route), the
    "current" data freezes at the last fetch. Treat cellular weather as a
    ground-level briefing tool, not an in-flight data source.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, efb, cellular, PA.I.C.K4]
  source_ref: |
    Body Reveal table.

- front: "ARINC datalink weather: coverage and what kind of products does it deliver?"
  back: |
    Global coverage (satellite). Delivers plan-specific text products
    (METARs, TAFs, AIRMETs, SIGMETs) on subscription, typically used in
    high-end GA and transport aircraft. Latency is governed by the text
    issue cycle, not radar-sweep age. Less common in light GA than FIS-B
    or SiriusXM but the only practical en-route weather option for
    transoceanic flight.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, arinc, datalink, PA.I.C.K4]
  source_ref: |
    AC 00-63A; body Reveal table.

- front: "30 NM south of a building line of CB. EFB shows discrete cells with gaps; ATC then calls a Convective SIGMET for severe TS along that line. Why does the picture you flew toward fail you?"
  back: |
    The displayed picture is 5-15 minutes old. In the time between the
    radar sweep and your read, the line organised, cells filled the gaps,
    and the front edge advanced. The cockpit display showed yesterday's
    truth; the Convective SIGMET is the now-truth. The operational rule:
    use the cockpit picture for strategic positioning (the 30 NM stand-off
    decision) and use the SIGMET / onboard radar / eyes for tactical
    penetration decisions, which is to say: don't penetrate.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, nexrad, convective-sigmet, PA.I.C.K4]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. Walks the canonical "EFB-showed-clear,
    SIGMET-said-stop" accident pattern.

- front: "Pre-flight EFB drill before a flight with forecast convection -- three things to pre-decide?"
  back: |
    (1) Your divert airport(s) along the route.
    (2) Your minimum stand-off distance from any cockpit-displayed echo
        (20 NM is the standard).
    (3) Your "I'm landing if X" trigger.
    The pre-decided rules survive the moment in flight when the cockpit
    picture disagrees with the windshield. Decisions made on the ramp are
    cleaner than decisions made under workload at 5,000 ft.
  cardType: basic
  kind: recall
  tags: [weather, flight-deck-displays, pre-flight, go-nogo, PA.I.C.K4, PA.I.C.R1]
  source_ref: |
    Body Practice.
```

## Connect

This node directly serves K4. It also serves R2a (limitations of
onboard weather equipment) -- the equipment-limitations node names
the gotchas; this node names the displays. Both are operationally
upstream of the go/no-go node, which has to integrate cockpit
display data alongside the rest of the brief.

## Verify

For three minutes the next time you fly: track an aviationweather.gov
real-time radar in a separate browser while the cockpit ADS-B feed
updates. Note the discrepancies in cell position. The discrepancy
size in minutes is your personal calibration of how stale the
cockpit data is.
