---
id: wx-product-airmets
title: AIRMETs (Sierra, Tango, Zulu)
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [factual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-reading-metars
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-sigmets
  - wx-product-pireps
  - wx-icing-types-and-avoidance
  - wx-turbulence-types
  - wx-fog-and-visibility-obstructions

modalities: [reading, cards, drill]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, In-flight Aviation Weather Advisories section -- AIRMETs (WA)
    note: Format spec for AIRMET product structure -- SIERRA / TANGO / ZULU letter taxonomy, polygon coding, altitude bands, valid times.
  - source: AIM
    detail: 7-1-6 -- Inflight Aviation Weather Advisories
    note: Operational use, valid times, the SIERRA / TANGO / ZULU AIRMET letter taxonomy.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 26 -- Advisories (Section 26.3, AIRMET)
    note: Modern consolidated reference for AIRMET use, including G-AIRMET (Graphical AIRMET).

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the three AIRMET families (SIERRA / TANGO / ZULU)
  and what each warns of, decode an AIRMET top to bottom (polygon
  coordinates, altitude band, valid time, hazard, motion), explain the
  AIRMET vs SIGMET severity distinction in plain language, and route
  the AIRMET picture into a go / no-go or altitude-selection decision
  for a light aircraft.
---

# AIRMETs (Sierra, Tango, Zulu)

AIRMETs are members of the encoded-text family (see
[`wx-reading-metars`](../reading-metars/node.md) for the full family
treatment). The three-stage ladder applies:

- **Decode** -- product type (AIRMET vs SIGMET), family letter (Sierra /
  Tango / Zulu), region (C / E / W), validity time, hazard, polygon
  coordinates, altitudes, motion vector.
- **Understand** -- which synoptic story produced the polygon, how it
  relates to the surface analysis and the GFA, and why this advisory
  fired now.
- **Triage** -- does the polygon intersect my route at my time, at my
  altitude? An AIRMET that ends two hours before I depart is a briefing
  artifact, not a flight input.

The family rule applies cleanly here: a learner who reads only the
hazard text and not the polygon-and-time has decoded but not triaged.
The polygon and validity are what tell you whether the advisory is
*yours*.

## Context

You're planning a 1430Z launch on a January VFR cross-country from
Cincinnati to Buffalo, KCVG to KBUF. The briefing pulls four AIRMETs:

- AIRMET SIERRA for IFR, Ohio Valley, valid 1200Z to 1800Z, ceiling
  below 1,000 / vis below 3 SM, polygon covering northern Kentucky
  and southern Ohio.
- AIRMET TANGO for moderate turbulence, Great Lakes, valid 1500Z to
  2100Z, surface to FL180, polygon covering Lake Erie and eastern
  Lake Ontario.
- AIRMET ZULU for moderate icing, Great Lakes, valid 1500Z to 2100Z,
  freezing level surface to 8,000 ft MSL, polygon covering the same
  area as the TANGO.
- G-AIRMET (graphical AIRMET) forecast extending the SIERRA polygon
  northward 6 hours from now into your destination terminal area.

Three of those AIRMETs are forecasts for an airplane like yours, in an
area like the one you're flying over. Decoding each is mechanical; the
decision is in the overlap with your route, altitude, and time.

## Problem

AIRMETs (Airmen's Meteorological Information) are the in-flight
advisory tier for hazardous-to-light-aircraft weather. The name gives
the audience away: airmen, plural, generally pilots in light aircraft.
The trigger thresholds describe the floor of "significance to a Cessna":
moderate turbulence, IFR, moderate icing.

The reading problem isn't decode (the format is short) -- it's
matching the polygon, altitude band, and valid time to *your* flight.
A pilot who reads only the family letter and the hazard text but skips
the geometry and timing makes two systematic mistakes:

1. Avoiding AIRMETs that don't intersect the route (over-conservatism).
2. Launching into AIRMETs that do intersect, because the alert level
   wasn't matched against the actual flight profile (under-conservatism).

Triage is the operational read; decode is the prerequisite.

## Discover

AIRMETs come in three families, each tagged with a phonetic letter
that maps to a hazard class:

- **AIRMET SIERRA** -- IFR conditions (ceiling below 1,000 ft AGL or
  visibility below 3 SM over more than 50 percent of an area) and
  mountain obscuration. The "visibility and ceiling" advisory.
- **AIRMET TANGO** -- moderate turbulence, sustained surface winds
  greater than 30 KT, and non-convective low-level wind shear. The
  "wind and turbulence" advisory.
- **AIRMET ZULU** -- moderate icing and freezing levels. The "icing"
  advisory.

Each AIRMET is issued every 6 hours (with amendments as needed) and
valid for 6 hours. They cover the contiguous US (three regions: West,
Central, East) plus Alaska, Hawaii, and the Gulf of Mexico. The G-AIRMET
(graphical AIRMET) extends the picture forward in 3-hour increments
out to 12 hours, giving a forecast trajectory the text AIRMET doesn't
provide on its own.

A text AIRMET reads as four operational parts:

1. **Identifier** -- letter family + region + sequence number.
   Example: `WA1` (AIRMET SIERRA, central region, first issuance of
   the day in this region).
2. **Polygon** -- a list of waypoints (VOR identifiers, latitude /
   longitude pairs, or three-letter station codes) that define the
   geographic boundary. Reading order is around the perimeter; the
   enclosed area is "inside the AIRMET."
3. **Altitude band** -- minimum and maximum altitudes the hazard
   applies through. SIERRA polygons are surface-to-cloud-top; TANGO
   polygons are surface-to-FL180 (light-aircraft typical max);
   ZULU polygons go from the freezing level to a top altitude where
   droplets glaciate (typically -20 to -40 deg C).
4. **Valid time** -- start and end Zulu times, typically a 6-hour
   block.

Reading a text AIRMET example:

```text
WAUS41 KKCI 121445
DFWS WA 121500
AIRMET SIERRA UPDT 3 FOR IFR AND MTN OBSCN VALID UNTIL 122100
AIRMET IFR...VA NC SC GA
FROM 60WNW PSK TO ORF TO ILM TO CHS TO 60ENE AHN TO 60WNW PSK
CIG BLW 010 / VIS BLW 3SM BR.
CONDS CONTG BYD 21Z THRU 03Z.
```

Decoded:

- `WAUS41 KKCI 121445` -- WAUS = Aviation Weather Advisory (US), 41 =
  sequence id, KKCI = issuing center (NWS Aviation Weather Center),
  121445 = 12th at 14:45Z (issuance time).
- `DFWS WA` -- DFWS area (DFW Sierra), WA = AIRMET.
- `121500` -- valid starting 12th at 1500Z.
- `AIRMET SIERRA UPDT 3 FOR IFR AND MTN OBSCN VALID UNTIL 122100` --
  update number 3 (this is the 4th SIERRA in this 6-hour cycle); covers
  IFR and mountain obscuration; valid through 12th at 2100Z.
- `AIRMET IFR...VA NC SC GA` -- the hazard is IFR; affected states are
  Virginia, North Carolina, South Carolina, Georgia.
- `FROM 60WNW PSK TO ORF TO ILM TO CHS TO 60ENE AHN TO 60WNW PSK` --
  polygon vertices. `60WNW PSK` = 60 nautical miles west-northwest of
  the PSK VOR. ORF = Norfolk VOR. ILM = Wilmington VOR. CHS =
  Charleston VOR. The polygon closes back to the start (`60WNW PSK`).
- `CIG BLW 010 / VIS BLW 3SM BR` -- ceiling below 1,000 ft AGL,
  visibility below 3 SM in mist.
- `CONDS CONTG BYD 21Z THRU 03Z` -- conditions continuing beyond 2100Z
  through 0300Z (the forecaster expects this advisory to renew on the
  next cycle).

## Reveal

### The three families in detail

#### AIRMET SIERRA (IFR + mountain obscuration)

Sierra fires when ceiling below 1,000 ft AGL or visibility below 3 SM
covers more than 50 percent of an area. Mountain obscuration is a
related trigger: when ridge tops are hidden by cloud or precipitation,
the polygon covers the mountain ranges affected.

Operational read for SIERRA:

- VFR-only pilots: the polygon is a "do not enter the white" area.
  Visual reference inside the polygon is unreliable; inadvertent IMC
  on departure into a SIERRA polygon is the canonical CFIT setup.
- IFR pilots: the polygon is workable but signals approach minima at
  destinations inside it. Check the destination METAR + TAF; if both
  are at or below approach minima, plan a credible alternate.
- Mountain obscuration: a SIERRA covering mountain ranges means
  visual passage through canyons or over ridges is closed. Plan around
  the polygon laterally, not vertically (cloud bases will rise above
  ridge tops if you go around the polygon to the lee side, often).

Worked SIERRA example (continuing the Context):

> The 1200-1800Z SIERRA over Ohio Valley covers ceiling-below-1,000 ft
> over a polygon that includes Cincinnati. Your 1430Z launch is in
> the middle of the SIERRA window. If you're VFR-only, you cannot
> launch into the polygon legally (less-than-VFR ceiling and
> visibility). If you're IFR-current with an instrument-equipped
> airplane, check KCVG's approach minima against the current METAR
> and the inbound TAF; a typical ILS at KCVG breaks out at 200 ft AGL
> and 1/2 SM, which beats a 1,000-and-3 SIERRA easily. The SIERRA is
> a "you'll be in the soup" forecast, not a "you can't fly" forecast,
> when you have IFR capability.

#### AIRMET TANGO (turbulence + wind + LLWS)

Tango fires when moderate turbulence over a broad area is forecast,
when sustained surface winds exceed 30 KT, or when non-convective
low-level wind shear is forecast. The "moderate" threshold is the
key word: severe turbulence triggers a SIGMET, not a TANGO; less
than moderate triggers nothing.

Operational read for TANGO:

- The altitude band matters. A TANGO polygon for moderate turbulence
  from surface to 12,000 ft says "the boundary layer is rough"; from
  12,000 to FL180 says "mid-level mixing"; from FL180 to FL450 says
  "jet-stream or wave-related upper-level chop." Your cruise altitude
  determines whether the TANGO is your problem.
- For LLWS (low-level wind shear, non-convective), the polygon
  typically covers an area where surface friction or terrain meets
  strong upper flow -- the classic mountain-wave airport-approach
  shear setup. Plan stabilised-approach criteria carefully.
- Sustained surface winds over 30 KT: think hard about ground
  handling, gust factor on takeoff and landing, and whether your
  airplane's POH crosswind limitation will be tight at the destination.

Worked TANGO example (continuing the Context):

> The 1500-2100Z TANGO over the Great Lakes covers moderate turbulence
> from surface to FL180. Your KCVG-to-KBUF route crosses Lake Erie in
> the middle of this window. At a typical light-aircraft cruise of
> 7,000 ft, you're squarely inside the altitude band. Moderate
> turbulence in a C172 is "objects unsecured in the cabin shift"
> level -- workable but tiring. The decision is between a workable
> rough ride vs climbing to find smoother air (FL120 might be above
> the boundary-layer mixing, but you'd need oxygen above FL125 in a
> non-pressurised airplane).

#### AIRMET ZULU (icing + freezing levels)

Zulu fires when moderate icing is forecast inside cloud or precipitation.
The Zulu polygon also carries the freezing-level information for the
area: where the 0 deg C isotherm sits, in feet MSL.

Operational read for ZULU:

- Non-deiced light aircraft: any moderate icing forecast is a "do not
  enter" advisory for the polygon at the listed altitudes. Moderate
  icing accumulates on the airframe faster than the typical light
  aircraft can climb or descend out of it; the airplane loses
  performance before the pilot completes the escape.
- Deiced light aircraft: moderate icing is workable but the deice
  system must be operational and the pilot must commit to the climb
  or descent decision before entering. Mixed and clear icing in a
  high-liquid-water-content cell can overwhelm boots.
- The freezing-level data on the Zulu chart is its own product. A
  freezing level at 12,000 ft means an airplane below that altitude
  is in above-freezing air; an airplane at 14,000 ft in cloud is in
  subfreezing cloud and at icing risk. The freezing-level line is
  where the air mass turns "icing-eligible."

Worked ZULU example (continuing the Context):

> The 1500-2100Z ZULU over the Great Lakes covers moderate icing
> from the freezing level (surface, per the polygon detail) up to
> 8,000 ft MSL. Cincinnati is at field elevation 877 ft; Buffalo at
> 728 ft. The freezing level at surface means any climb through cloud
> is into icing-eligible air. For a non-deiced C172 at 7,000 ft cruise
> in winter clouds over the Great Lakes, this ZULU is a hard "do not
> enter" advisory. Plan to descend below cloud (impossible if SIERRA
> ceilings are at 800 ft), climb above cloud (impossible if cloud tops
> are above 8,000 ft -- which they typically are in a lake-effect
> regime), or fly around the polygon laterally.

### Reading a polygon

Polygons are read around the perimeter, in order. The vertices use
three encoding styles:

1. **VOR identifier with offset** -- `60WNW PSK` = 60 NM west-northwest
   of the PSK VOR. The compass-style direction is 16-point (N, NNE,
   NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW).
2. **Three-letter station** -- `ORF` (Norfolk VOR), `JFK` (Kennedy
   airport / VOR), `CRP` (Corpus Christi). The position is the
   station's known coordinates.
3. **Latitude / longitude pair** -- `4030N09115W` (40 deg 30 min N,
   91 deg 15 min W). Less common in US AIRMETs (more common in
   international SIGMETs).

The polygon always closes: the last vertex is the same as the first.
A polygon with N vertices has N-1 unique points; you'll see the start
point repeated at the end of the list.

A pilot's plotting habit: pencil the polygon vertices onto the
sectional or the IFR chart, connect them, then overlay the planned
route. The visual is far easier to triage than the text. EFB apps
(ForeFlight, Garmin Pilot, Avare) plot AIRMETs as filled polygons by
default; the G-AIRMET layer animates the forecast trajectory across
the next 12 hours.

### Comparison table

| Family | Hazard                                                                   | Typical altitude band               | Typical valid time |
| ------ | ------------------------------------------------------------------------ | ----------------------------------- | ------------------ |
| SIERRA | IFR conditions (CIG below 1,000 / vis below 3) or mountain obscuration   | Surface to cloud tops               | 6 hours            |
| TANGO  | Moderate turbulence; sustained sfc winds over 30 KT; non-convective LLWS | Surface to FL180 (typical)          | 6 hours            |
| ZULU   | Moderate icing; freezing-level information                               | Freezing level to top of icing band | 6 hours            |

### G-AIRMET (graphical AIRMET)

The G-AIRMET is the graphical-product evolution of the text AIRMET.
Where the text AIRMET is a snapshot for a 6-hour window, the G-AIRMET
forecasts the AIRMET polygon's evolution out to 12 hours in 3-hour
increments. The forecaster commits to a polygon at the issuance time,
plus forecast polygons at +3, +6, +9, and +12 hours. The same families
(SIERRA / TANGO / ZULU) appear, plus icing severity bands, turbulence
intensity bands, and freezing-level contours.

The G-AIRMET is what most modern briefing tools (1800wxbrief.com, EFB
apps) display by default. The text AIRMET is the canonical product;
the G-AIRMET is the visualisation. Triage works the same way: does
the polygon intersect your route at your time?

### AIRMETs vs SIGMETs

The most common reading confusion is "AIRMET or SIGMET?" The
distinction is the severity threshold of the audience the advisory
targets:

- **AIRMET** = significant to **light** aircraft. The threshold is
  the floor of what hurts a Cessna: moderate turbulence, moderate
  icing, IFR ceilings and visibilities, mountain obscuration,
  surface winds over 30 KT.
- **SIGMET** = significant to **all** aircraft (light and heavy
  alike). The threshold is severe icing not associated with
  thunderstorms, severe or extreme turbulence not associated with
  thunderstorms, dust / sandstorms reducing visibility below 3 SM,
  and volcanic ash. The conditions are bad enough to threaten
  transport-category aircraft.

Mixing the two downgrades a real warning or inflates a routine one.
A SIGMET for severe icing is a "do not fly" event for any airplane;
an AIRMET ZULU for moderate icing is a "do not fly without deice or
without a credible escape altitude" event for a light airplane and
a "yes, plan around it" event for a transport category jet.

There's no separate "Convective AIRMET." Convection above the threshold
goes directly to Convective SIGMET (covered in the
[`wx-product-sigmets`](../product-sigmets/node.md) node); convection
below the threshold may trigger the surrounding TANGO (turbulence)
or ZULU (icing) but isn't itself advisory-flagged separately.

### Common gotchas

#### Altitude band is critical

An AIRMET TANGO from surface to FL180 covers most light-aircraft
cruise altitudes. The same advisory issued from FL180 to FL450 does
not. A pilot who reads "TANGO turbulence" without reading the altitude
band makes the wrong call in both directions (avoiding a flight that
was above the band; launching into one that was inside it).

#### Reading order: hazard first, polygon second, altitude third, time fourth

The natural reading order matches the operational triage. What does
it warn of? Where does it apply? At what altitudes? When? The pilot
who reads in that order and stops at the first "doesn't affect me"
checkpoint triages efficiently.

#### G-AIRMET trajectory beats text AIRMET snapshot

If the briefing tool offers both, prefer the G-AIRMET for planning.
The forecast trajectory is the answer to "where will this polygon be
during my arrival hour?" -- a question the text AIRMET (a snapshot
for one 6-hour window) doesn't answer directly.

#### AIRMETs renew; check the cycle

AIRMETs are issued at 0245Z, 0845Z, 1445Z, and 2045Z (with regional
variations). A polygon that "ends" at 2100Z often renews on the next
cycle as a similar polygon, sometimes expanded or shifted. The
"conditions continuing" clause at the bottom of the text AIRMET
(`CONDS CONTG BYD 21Z THRU 03Z`) is the forecaster's commitment to
renew.

#### AIRMETs are forecasts; PIREPs are the truth-up

An AIRMET ZULU is a hypothesis until a PIREP confirms it. The
forecaster sees the synoptic setup for moderate icing (cloud,
freezing level, lift) and fires the AIRMET; whether airframes are
actually accreting ice in the polygon comes from PIREPs filed by
pilots inside it. A confirming PIREP makes the AIRMET operationally
real; an absent PIREP does not refute it (pilots may not be flying
at that altitude). Plan to the AIRMET; weight the PIREPs as confirming
or non-confirming evidence.

#### Mountain obscuration is a hidden Sierra

When SIERRA fires for mountain obscuration only (without low ceilings
elsewhere in the polygon), valley airports often report VFR while
the surrounding ridges are in cloud. A pilot launching VFR from a
valley airport with a mountain-obscuration SIERRA in effect needs to
plan a route that stays in the valley, not one that climbs over the
nearest ridge.

## Practice

For tomorrow's planned route, pull every active and forecast AIRMET.
For each one, answer: what does it warn of, where does it apply
(plot the polygon), at what altitudes, when, and how does it
intersect your route in space and time? If any of the three intersect
your flight path, articulate the alternative action you'd take and
when you'd commit to it.

A focused drill: open the G-AIRMET viewer for a winter weather day
(any day mid-January in the northeast US works). Watch the 0-3-6-9-12
hour trajectory animate. Identify the polygon that moves the most;
ask, "what synoptic feature is driving that polygon?" The answer is
usually a front, a low-pressure center, or an upper-level wave; the
G-AIRMET is the visualisation of those features' weather impact.

Pair drill: pull the G-AIRMET, the surface analysis, and the latest
PIREPs for a single area. Do they agree? The surface analysis is the
synoptic story, the G-AIRMET is the forecaster's read on that story's
weather impact, and the PIREPs are pilots' confirmation or denial.
Three independent products agreeing on a polygon is the
high-confidence operational signal.

:::cards

- front: "AIRMET SIERRA -- what does it warn of, and what altitudes does the polygon typically cover?"
  back: |
    IFR conditions (ceiling below 1,000 ft AGL or visibility below 3 SM
    over more than 50 percent of an area) and mountain obscuration. The
    SIERRA polygon flags the airspace where ceiling / visibility falls
    below VFR for light aircraft. Altitude band is typically surface to
    cloud tops (variable by synoptic regime). Valid 6 hours.
  cardType: basic
  kind: recall
  tags: [weather, airmet, sierra, ifr, ac-00-45h, aim-7-1-6]
  source_ref: |
    AC 00-45H In-flight Aviation Weather Advisories; AIM 7-1-6.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "AIRMET TANGO -- what does it warn of?"
  back: |
    Moderate turbulence, sustained surface winds greater than 30 KT, and
    non-convective low-level wind shear. TANGO is the wind-and-turbulence
    advisory for light aircraft. Valid 6 hours. The altitude band varies
    by polygon and is essential to triage: surface to FL180 is a
    light-aircraft cruise problem; FL180 and above is a high-altitude
    problem.
  cardType: basic
  kind: recall
  tags: [weather, airmet, tango, turbulence, wind, ac-00-45h, aim-7-1-6]
  source_ref: |
    AC 00-45H; AIM 7-1-6.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "AIRMET ZULU -- what does it warn of, and what's the operational rule for non-deiced light aircraft?"
  back: |
    Moderate icing and freezing levels. The ZULU is the icing advisory.
    For non-deiced light aircraft, moderate icing inside the polygon is a
    hard "do not enter" -- ice accumulates on the airframe faster than the
    typical light aircraft can climb or descend out of it; performance
    degrades before the escape completes. Valid 6 hours. Read alongside
    the freezing-level chart and PIREPs.
  cardType: basic
  kind: recall
  tags: [weather, airmet, zulu, icing, freezing-level, ac-00-45h, aim-7-1-6]
  source_ref: |
    AC 00-45H; AIM 7-1-6; body Reveal.
  acs_codes: [PA.I.C.K2g, PA.I.C.K3i]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Decode the polygon vertex 60WNW PSK in an AIRMET."
  back: |
    60 nautical miles west-northwest of the PSK VOR. The compass direction
    is on the 16-point scale (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW,
    SW, WSW, W, WNW, NW, NNW). The distance is in NM. Vertices like this
    are typical AIRMET polygon coding; alternatives are three-letter station
    identifiers (ORF, JFK) or lat / lon pairs (more common in international
    SIGMETs).
  cardType: basic
  kind: recall
  tags: [weather, airmet, polygon, decode, ac-00-45h]
  source_ref: |
    AC 00-45H AIRMET polygon coding; body Reveal.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "AIRMET vs SIGMET -- what's the severity-threshold distinction?"
  back: |
    AIRMET threshold = significant to *light* aircraft: moderate turbulence,
    moderate icing, IFR conditions. SIGMET threshold = significant to *all*
    aircraft (light and heavy): severe icing not associated with thunderstorms,
    severe or extreme turbulence not associated with thunderstorms, dust or
    sandstorms reducing visibility below 3 SM, and volcanic ash. SIGMET is
    the next tier up. Mixing the two downgrades a real warning or inflates a
    routine one.
  cardType: basic
  kind: recall
  tags: [weather, airmet, sigmet, severity, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover + Reveal "AIRMETs vs SIGMETs."
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Why is there no 'Convective AIRMET'?"
  back: |
    Convection above the threshold (severe thunderstorms, embedded
    thunderstorms, lines, or thunderstorm areas covering 40% of an area at
    VIP 4+) goes directly to Convective SIGMET -- there's no light-aircraft
    tier for thunderstorms because they're hazardous to every aircraft
    category. Convection below the Convective SIGMET threshold isn't
    advisory-flagged separately, though the surrounding turbulence and icing
    may trigger AIRMET TANGO or ZULU. The skipped-tier reflects the universal
    severity of any active thunderstorm to general aviation.
  cardType: basic
  kind: recall
  tags: [weather, airmet, convective-sigmet, ac-00-45h]
  source_ref: |
    Body Reveal "AIRMETs vs SIGMETs"; AC 00-45H section on Convective SIGMET trigger.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "What does the G-AIRMET add over a text AIRMET?"
  back: |
    A G-AIRMET (graphical AIRMET) is the forecast trajectory of the AIRMET
    polygon over the next 12 hours, in 3-hour increments (+0, +3, +6, +9,
    +12 hours). The text AIRMET is a snapshot for one 6-hour window. The
    G-AIRMET answers "where will this polygon be at my arrival hour?" -- a
    question the text AIRMET doesn't answer directly. Most modern briefing
    tools default to G-AIRMET; the text AIRMET remains the canonical product.
  cardType: basic
  kind: recall
  tags: [weather, airmet, g-airmet, briefing-tools]
  source_ref: |
    Body Reveal G-AIRMET subsection; AC 00-45H.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "AIRMETs are forecasts; PIREPs are the truth-up. How does that interact in a brief?"
  back: |
    An AIRMET ZULU is a hypothesis until a PIREP confirms it -- but the
    hypothesis alone is enough to plan around (you'd never wait for a PIREP
    to confirm an icing forecast before adjusting the route). A confirming
    PIREP makes the AIRMET operationally real; an absent PIREP does not
    refute the AIRMET because pilots may not be flying at that altitude.
    PIREPs sharpen the picture but the forecast remains the planning input.
  cardType: basic
  kind: recall
  tags: [weather, airmet, pirep, truth-up, judgment]
  source_ref: |
    Body Connect / Discover; common gotcha.
  acs_codes: [PA.I.C.K2g, PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "When does AIRMET SIERRA fire for mountain obscuration only, and what's the catch for a valley airport launch?"
  back: |
    Mountain-obscuration SIERRA fires when ridge tops are hidden by cloud or
    precipitation even though valley airports may report VFR ceiling and
    visibility. A pilot launching VFR from a valley airport into a
    mountain-obscuration SIERRA needs to plan a route that stays in the
    valley -- climbing toward the nearest ridge enters cloud at ridge height,
    which is the CFIT setup the SIERRA is calling out. The polygon defines
    "where the mountains are obscured"; the airport METAR underneath the
    polygon may still read VFR.
  cardType: basic
  kind: recall
  tags: [weather, airmet, sierra, mountain-obscuration, cfit, judgment]
  source_ref: |
    Body Reveal SIERRA operational read; body gotchas.
  acs_codes: [PA.I.C.K2g, PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Valid time for an AIRMET, and how often is it reissued?"
  back: |
    AIRMETs are valid for 6 hours from issuance and are issued at fixed
    times (typically 0245Z, 0845Z, 1445Z, 2045Z, with regional variation),
    with amendments as needed. A polygon ending at 2100Z often renews on
    the next cycle; the "CONDS CONTG BYD" clause at the bottom of the text
    AIRMET is the forecaster's commitment to renew.
  cardType: basic
  kind: recall
  tags: [weather, airmet, valid-time, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal table.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories
:::

## Connect

AIRMETs are forecast products; PIREPs are the truth-up. The K2g element
of the airman certification standards calls for AIRMET / SIGMET use
specifically; this node carries the AIRMET half, and
[`wx-product-sigmets`](../product-sigmets/node.md) carries the SIGMET
half.

The AIRMET picture pairs with:

- **METARs / TAFs** at airports inside the polygon (the SIERRA + the
  destination TAF are the same forecast in different shapes).
- **PIREPs** as the airframe-level truth-up.
- **GFA** as the graphical context that displays the AIRMET polygons
  spatially against the synoptic picture.
- **Freezing-level chart** as the ZULU companion product.

## Verify

For tomorrow's planned route, pull every active and forecast AIRMET.
Identify each by family (SIERRA / TANGO / ZULU), what condition it
warns of, when it expires, and how its polygon intersects your planned
route in space and time. If any of the three intersect your flight
path, articulate the alternative action you'd take and when you'd
commit to it.

For a winter route through the Great Lakes or northern mountains:
plot the ZULU polygon and the freezing level on the same chart. Note
where the freezing level rises (warm advection) and falls (cold
advection); the icing-risk altitude band moves with it. The
freezing-level shape is the synoptic-frame answer to "where exactly
is the icing setup?"
