---
id: wx-equipment-and-data-limitations
title: Weather Equipment and Data Limitations
domain: weather
cross_domains: [decision-making]

knowledge_types: [conceptual, judgment]
technical_depth: working
stability: evolving

minimum_cert: private
study_priority: critical
requires:
  - wx-flight-deck-weather-displays
  - wx-product-airmets
  - wx-product-sigmets
deepens: []
applied_by:
  - wx-go-nogo-decision
taught_by: []
related:
  - wx-data-sources

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-63A
    detail: Use of Cockpit Displays of Digital Weather and Aeronautical Information
    note: Limitations of FIS-B / SiriusXM / EFB-mediated weather data.
  - source: NTSB Safety Alert SA-017
    detail: In-Cockpit NEXRAD Mosaic Imagery
    note: The reference accident-pattern document for tactical use of strategic data.
  - source: AC 00-45H
    detail: Aviation Weather Services
    note: Forecast confidence and the difference between observation, analysis, and forecast.
  - ref: airboss-ref:handbooks/avwx/27
    chapter_title: Forecasts
    redirected_from: airboss-ref:handbooks/avwx/FAA-H-8083-28/27
    note: >-
      Modern consolidated treatment of forecast skill, model resolution, and reporting gaps. Verify chapter -- the verified FAA-H-8083-28B ToC lists Chapter 27 as "Forecasts" with no standalone "Limitations" chapter; forecast-limitation discussion is folded into Chapter 3 (Overview of Aviation Weather Information, §3.2 Use of Aviation Weather Information) and into individual product subsections within Chapter 27.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can articulate the principal limitations of (a) onboard
  weather equipment (radar attenuation, NEXRAD age), (b) aviation
  weather reports and forecasts (point vs. area, model error, station
  spacing), and (c) inflight weather resources (datalink latency,
  ATC ride reports), and adjust briefing and divert decisions to
  account for each.
---

# Weather Equipment and Data Limitations

:::phase name="context"

You're departing on a 200 NM IFR cross-country in widely scattered
convection. Your EFB shows clear gaps between cells. Your onboard
radar shows the same gaps. ATC has no PIREPs and no ride reports.
You feel well-briefed. Three hours later you're on the ground at an
unplanned airport with hail dents in the leading edges and a
pacemaker installed because the "gap" you flew through closed
behind a 12-minute-old NEXRAD picture and an attenuated radar return.

:::
:::phase name="problem"

Every weather product in the cockpit and every forecast in the brief
has a documented failure mode. Knowing the failure modes -- not just
the products -- is what keeps the brief honest. The same NEXRAD
picture is information at a 30-NM stand-off and misinformation at a
3-NM penetration; the difference is whether the pilot understands
the latency.

:::
:::phase name="discover"

The limitations sort into three families per R2:

R2a -- onboard weather equipment limitations:

- Onboard radar (Bendix-King RDR, etc.) shows precipitation
  intensity, not turbulence. A dry hailshaft or a clear-air
  microburst is invisible.
- Onboard radar attenuates: the first heavy cell along the radar's
  line of sight reflects so much energy that whatever's behind it
  appears as a "shadow" of low return. Pilots have flown into the
  shadow expecting clear air and found a second equally severe cell.
- Lightning detection (Stormscope, FIS-B lightning) shows electrical
  activity, not precipitation. A heavy snow shower without lightning
  is invisible.
- ADS-B FIS-B requires a ground-station line of sight; coverage
  drops below 5,000 ft AGL and disappears in mountain shadows.

R2b -- weather report and forecast limitations:

- METARs are point observations. The airport reports clear; the
  surrounding 5 NM may have widely varying conditions, especially
  in convective or terrain-affected regimes.
- METAR sky condition is what's overhead the sensor: a single 100
  ft-wide hole over a sensor reads "BKN below" while reality is
  "OVC across the field."
- TAFs are issued for a 5 NM radius around the airport for 24-30
  hours. Confidence drops sharply with horizon. Probability groups
  (PROB30, PROB40) in the TAF body indicate the forecaster's own
  uncertainty.
- AIRMET / SIGMET areas are smoothed polygons drawn around forecast
  hazardous conditions. Real boundaries are fuzzy and shift; expect
  conditions inside the polygon and at least 25 NM beyond it.
- Convective forecasts (Day 1 outlook, Convective SIGMET) are
  ensemble-skill products. They tell you where convection is
  likely; they cannot tell you which specific cell will develop.
- Wind aloft forecasts are model output: the FB is a 12-hour-old
  forecast of the wind at your cruise altitude. In dynamic
  atmospheres (frontal passage, mountain wave) the actual wind
  diverges from forecast by 30-40 KT.

R2c -- inflight weather resource limitations:

- ATC ride reports are sparse and reporter-biased. "Smooth at 80"
  was reported by a 757 and means nothing for a Cessna 150 at the
  same altitude.
- Flight Service in-flight briefings depend on Leidos's coverage
  of your altitude and area; coverage gaps exist.
- Datalink products in the cockpit have the latency described in
  the flight-deck-displays node.
- PIREPs are voluntary; absence of PIREPs is not absence of
  hazard, especially at unusual altitudes or at non-peak hours.

:::
:::phase name="reveal"

Operational rules:

- Treat any in-cockpit NEXRAD picture as 10-15 minutes stale even
  when the age indicator says less.
- Stand off 20 NM from any cockpit-displayed echo for thunderstorm
  avoidance; 5 NM only when visually confirmed or onboard-radar
  confirmed.
- Build briefing margin: if the brief says VFR margins are tight,
  expect them to be tighter on arrival than the brief showed.
- Trust the truth-up: a PIREP confirming icing or turbulence
  outranks the AIRMET that forecasted absence; an absent PIREP does
  not refute a forecast hazard.
- Trust your eyes when they disagree with the data: every "but the
  radar showed clear" accident has the same quote in the
  toxicology report.

:::
:::phase name="practice"

For your next flight: identify, before takeoff, the limitation that
matters most for the day's brief. If convection is forecast, the
limit is NEXRAD latency. If frontal passage is forecast, the limit
is forecast wind error. If point IFR is forecast, the limit is METAR
station coverage. Pre-naming the dominant limitation lets you
calibrate the rest of the brief against it.

:::cards

- front: "Three families of weather limitation per ACS R2 -- name them and one example each."
  back: |
    R2a -- onboard weather equipment: e.g. onboard radar shows precipitation,
    not turbulence; attenuates behind heavy returns.
    R2b -- aviation weather reports and forecasts: e.g. METAR is a point
    observation; the surrounding 5 NM may be very different.
    R2c -- inflight weather resources: e.g. datalink NEXRAD is 10-15 min
    stale; ATC ride reports are sparse and reporter-biased.
  cardType: basic
  kind: recall
  tags: [weather, limitations, acs-r2, ac-00-63a]
  source_ref: |
    AC 00-63A; body Discover R2 framework.
  acs_codes: [PA.I.C.R2]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Onboard weather radar (Bendix-King RDR etc.): what does it show and what does it miss?"
  back: |
    Shows precipitation intensity along its line of sight. Misses turbulence
    (dry hailshaft or clear-air microburst are invisible). Attenuates -- the
    first heavy cell reflects so much energy that whatever's behind appears
    as a low-return "shadow"; pilots have flown into the shadow expecting
    clear air and found a second equally severe cell. It's a real-time
    sensor but it's *not* a turbulence sensor.
  cardType: basic
  kind: recall
  tags: [weather, limitations, onboard-radar, attenuation, ac-00-63a]
  source_ref: |
    AC 00-63A; body Discover R2a.
  acs_codes: [PA.I.C.R2a]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "ADS-B FIS-B coverage gaps -- where does the data drop?"
  back: |
    FIS-B is ground-uplinked and requires line of sight to a ground station.
    Coverage drops below ~5,000 ft AGL (line-of-sight problem) and
    disappears in mountain shadows. The product list is correct when
    received; "not displayed" can be either "not happening" or "no signal,"
    which the cockpit can't always distinguish.
  cardType: basic
  kind: recall
  tags: [weather, limitations, fis-b, ads-b, ac-00-63a]
  source_ref: |
    AC 00-63A; body Discover R2a.
  acs_codes: [PA.I.C.R2c]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Lightning detection (Stormscope, FIS-B lightning) -- what does it show and what does it miss?"
  back: |
    Shows electrical activity. Misses non-electrical phenomena -- a heavy
    snow shower or rain shaft without lightning is invisible to the
    Stormscope. Its real-time strength is the inverse of NEXRAD's weakness:
    lightning maps the cell's location now (free of radar age), but says
    nothing about precipitation in non-electrical convection.
  cardType: basic
  kind: recall
  tags: [weather, limitations, stormscope, lightning]
  source_ref: |
    Body Discover R2a.
  acs_codes: [PA.I.C.R2a]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Why is a METAR a point observation and what does that imply for surrounding airspace?"
  back: |
    A METAR reports what's happening at the sensor location. The surrounding
    airspace can vary widely -- especially in convective or terrain-affected
    regimes. The METAR may report clear when scattered cells are 5 NM away,
    or report OVC when a single hole sits over the sensor. Treat the METAR
    as the truth at one location, not a 25-NM-radius snapshot.
  cardType: basic
  kind: recall
  tags: [weather, limitations, metar, ac-00-63a]
  source_ref: |
    AC 00-63A; body Discover R2b.
  acs_codes: [PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "TAF confidence horizon and what PROB groups encode about it."
  back: |
    TAFs are issued for a 5 NM radius around the airport for 24-30 hours.
    Confidence drops sharply with horizon -- a TAF good at +3 hours is
    much less reliable at +18. PROB30 / PROB40 groups encode the
    forecaster's *own* uncertainty: 30-40 percent probability of the
    listed conditions. PROB never appears above 40 percent (50 percent
    upgrades to TEMPO).
  cardType: basic
  kind: recall
  tags: [weather, limitations, taf, prob]
  source_ref: |
    AC 00-45H TAF; body Discover R2b.
  acs_codes: [PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "AIRMET / SIGMET polygons -- what's the smoothing problem and what buffer should you assume?"
  back: |
    AIRMET / SIGMET areas are smoothed polygons drawn around forecast
    hazardous conditions. Real boundaries are fuzzy and shift; expect
    conditions inside the polygon *and at least 25 NM beyond it*. The
    polygon is the planning shape, not a sharp edge. Treating the edge
    as a clean boundary is one of the canonical R2b failure patterns.
  cardType: basic
  kind: recall
  tags: [weather, limitations, airmet, sigmet, polygon]
  source_ref: |
    AC 00-45H; body Discover R2b.
  acs_codes: [PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Wind aloft forecast (FB) error in dynamic atmospheres -- how much divergence?"
  back: |
    FB is model output, typically 12-hour old at issue. In dynamic
    atmospheres -- frontal passage, mountain wave, jet shifts -- actual
    wind diverges from forecast by 30-40 KT. The smooth, calm-day forecast
    is reliable; the messy frontal-day forecast needs in-flight verification
    (groundspeed vs. TAS, PIREPs) and re-planning if it drifts.
  cardType: basic
  kind: recall
  tags: [weather, limitations, winds-aloft, fb]
  source_ref: |
    AC 00-45H FB; body Discover R2b.
  acs_codes: [PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Why are ATC ride reports an unreliable substitute for PIREPs at your altitude?"
  back: |
    Ride reports are sparse and reporter-biased. "Smooth at 80" reported by
    a 757 means nothing for a Cessna 150 at the same altitude -- a heavy
    aircraft's "smooth" is a light aircraft's "light chop." Use ride reports
    for trend signal, not absolute value, and never replace a PIREP at
    your category with a transport ride report.
  cardType: basic
  kind: recall
  tags: [weather, limitations, ride-reports, pirep, atc]
  source_ref: |
    Body Discover R2c.
  acs_codes: [PA.I.C.R2c]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "Operational rule: minimum stand-off distance from a cockpit-displayed NEXRAD echo for thunderstorm avoidance, and why is it larger than the visual rule?"
  back: |
    20 NM from any cockpit-displayed echo (vs. 5 NM with visual or onboard-
    radar separation). The 20 NM number explicitly accounts for NEXRAD age:
    a cell moving at 30 KT for 12 minutes has moved 6 NM since the displayed
    picture; 20 NM keeps the buffer even after that drift. The 5 NM rule
    relies on a real-time sensor (eyes or onboard radar) -- not the
    datalink picture.
  cardType: regulation
  kind: recall
  tags: [weather, limitations, nexrad, thunderstorm, 20nm]
  source_ref: |
    NTSB SA-017 In-Cockpit NEXRAD Mosaic Imagery; AC 00-63A; body Reveal.
  acs_codes: [PA.I.C.R2c]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts

- front: "For a forecast of widely scattered afternoon convection, what's the dominant limitation to pre-name in the brief?"
  back: |
    NEXRAD latency in the cockpit. The forecast itself (Convective SIGMET,
    GFA, Day-1 outlook) is reliable as a strategic input -- you know
    convection is coming. The tactical question (which specific gap to fly
    through right now) is what NEXRAD's 10-15 minute age can't answer.
    Pre-naming this limitation forces the brief to include a divert
    pre-decision and a minimum stand-off rule before the flight launches.
  cardType: basic
  kind: recall
  tags: [weather, limitations, nexrad, convection, briefing]
  source_ref: |
    Body Practice + Verify ("convection forecast over the mountains").
  rationale: |
    Scenario card from the body's Verify drill. The pre-naming habit is the
    body's operational deliverable; this card forces the learner to articulate
    it for the canonical convection case.
  acs_codes: [PA.I.C.R2c]
  source_authority:
    - kind: ac
      cite: AC 00-63A Use of Cockpit Displays of Digital Weather and Aeronautical Information
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 27 -- Limitations of Weather Forecasts
:::

:::
:::phase name="connect"

R2 in the ACS asks specifically about these three families of
limitation. This node is the umbrella; the flight-deck-displays
node, the airmets-sigmets node, and the data-sources node provide
the depth on each. The go/no-go node consumes this understanding to
weight the briefing inputs appropriately.

:::
:::phase name="verify"

For three different forecast scenarios, articulate the dominant
limitation in one sentence each:

- Tomorrow's flight: VFR forecast, ceiling 4000 ft, no convection
  expected -> dominant limitation: ceiling forecast skill (TAF
  confidence at +12 hr is moderate at best).
- Tomorrow's flight: convection forecast over the mountains in the
  afternoon -> dominant limitation: NEXRAD latency in the cockpit.
- Tomorrow's flight: night IFR through layer cloud -> dominant
  limitation: icing forecast at altitude (FIP/CIP grids vs. PIREP
  truth-up).

If you can name the limitation in a sentence, you are equipped to
brief against it.

:::