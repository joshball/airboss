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
