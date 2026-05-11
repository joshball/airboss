---
id: wx-product-gfa
title: Graphical Forecasts for Aviation (GFA)
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, procedural]
technical_depth: working
stability: evolving

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
  - wx-product-airmets-sigmets
  - wx-product-surface-analysis-and-cva

modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Graphical Forecasts for Aviation section
    note: Format spec for the Aviation Forecast Discussion / GFA tool layers.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 28 -- Aviation Weather Tools, Section 28.2 (Graphical Forecasts for Aviation (GFA) Tool)
    note: GFA is the post-Area-Forecast replacement; Chapter 28 §28.2 defines the current GFA tool and its static-image suite, with the legacy FA product covered in Chapter 27 §27.5.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Operational use of the GFA in preflight briefing.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can navigate the GFA tool on aviationweather.gov, switch
  between observation and forecast time slices and the standard layer
  set (clouds, weather, ceiling/visibility, precipitation, icing,
  turbulence), and use the result to brief a route across multiple
  forecast hours.
---

# Graphical Forecasts for Aviation (GFA)

The GFA is the graphical-product cousin in the encoded-text family
(see [wx-reading-metars-tafs](../reading-metars-tafs/node.md)). The
three-stage skill ladder still applies, with the encoding shifted
from text symbols to color-coded layers:

- **Decode** -- the layer set (clouds, weather, cig/vis, precip,
  icing, turbulence, winds), the time scrubber semantics
  (observation / analysis / forecast windows), the categorical
  color conventions (VFR green, MVFR blue, IFR red, LIFR magenta).
  Like the FB, the conventions are arbitrary; like the METAR, they
  repeat across every read.
- **Understand** -- the GFA is a *front-end* over the underlying
  models (FIP / CIP for icing, GTG for turbulence, NDFD for cig /
  vis / wind / weather, plus AIRMET / SIGMET overlays). A color
  block is the rendering of a model output; understanding the GFA
  means knowing which model produced the picture and what its
  failure modes are.
- **Triage** -- the GFA invites layer-scrolling without depth.
  Pick the *one* layer that drives this flight (icing for a
  winter cross-country, cig/vis for a marginal-VFR planning
  question, turbulence for a known-rough route) and read it
  carefully across the time horizon you'll fly. Other layers are
  confirmation.

## Context

You're planning a 250 NM cross-country that takes you from clear coastal
air across a forecast frontal passage into clear continental air. The
TAFs at your departure and destination both look fine -- but the route
between them passes through an area with no terminal, and your METARs
are silent on what's happening there. Where do you look?

## Problem

METARs and TAFs are tied to airports. PIREPs are tied to where pilots
are flying. Surface analysis charts are point-in-time. None of them
answers "what will it look like 90 NM north of nothing in three hours?"
The Graphical Forecast for Aviation (GFA) was built to fill that gap --
a continuous 2D forecast field you can scrub through time.

## Discover

Open aviationweather.gov/gfa and walk the controls:

- A map of CONUS with overlays you can toggle: clouds, weather, ceiling
  and visibility, precipitation, icing, turbulence, winds.
- A time slider running from 14 hours in the past (observations) through
  the current hour (analysis) and forward to +15 hours (forecast).
- Layer-specific sub-options: clouds split into ceiling and tops; icing
  split into severity and altitude band; turbulence split into severity
  and altitude.

The interface is the product. There is no text equivalent the way there
once was for the Area Forecast (FA) -- the GFA replaced the textual FA
in 2017 because the spatial picture is the right form for area-scale
weather questions.

## Reveal

Layer summary:

| Layer      | What it shows                                    |
| ---------- | ------------------------------------------------ |
| Clouds     | Ceiling, tops, sky cover at selectable altitudes |
| Weather    | Forecast PCPN type and intensity                 |
| Cig/Vis    | Categorical CIG/VIS field (VFR/MVFR/IFR/LIFR)    |
| Precip     | Forecast precip rate / type / intensity          |
| Icing      | Severity + altitude band, sourced from FIP / CIP |
| Turbulence | Severity + altitude band                         |
| Winds      | Surface and aloft wind / temperature fields      |

GFA refresh cadence: hourly for observations / analyses, every three
hours for the forward forecast. The tool stitches together AIRMETs,
SIGMETs, the FIP/CIP icing model, the GTG turbulence model, and the
NDFD weather grids into one front-end. So when you read GFA you are
implicitly reading those underlying products at a higher abstraction.

## Practice

For tomorrow's flight, scrub the GFA at +6 hours over your planned
route at three layers: surface (winds), cruise altitude (clouds, icing,
turbulence), and the destination terminal area (cig/vis). Note any
color discontinuities along the route. Each one is a question to ask
the briefing or a hazard to plan around.

For a real "is this route flyable?" check, set the time to your planned
ETA and toggle the cig/vis layer. If the route passes through yellow
(MVFR) or red (IFR) blocks at any forecast hour you'll be airborne, the
GFA has just identified the hazard window.

### Cards (spaced repetition)

Cards mined from the body. Layer-set and color-convention cards are
the decode floor; the front-end model card is the understand layer;
the triage card pinpoints the dominant layer for each flight.

```yaml-cards
- front: "Layers in the GFA tool -- name the seven and one thing each shows."
  back: |
    Clouds: ceiling, tops, sky cover at selectable altitudes.
    Weather: forecast precipitation type and intensity.
    Cig/Vis: categorical CIG/VIS field (VFR / MVFR / IFR / LIFR).
    Precip: forecast precip rate / type / intensity.
    Icing: severity + altitude band, sourced from FIP / CIP.
    Turbulence: severity + altitude band (sourced from GTG model).
    Winds: surface and aloft wind / temperature fields.
  cardType: basic
  kind: recall
  tags: [weather, gfa, layers, ac-00-45h, PA.I.C.K2d]
  source_ref: |
    AC 00-45H GFA section; body Reveal layer table.

- front: "GFA categorical color conventions for cig/vis: VFR / MVFR / IFR / LIFR."
  back: |
    VFR = green, MVFR = blue, IFR = red, LIFR = magenta. Same color
    convention as the standard category map. The encoding is arbitrary
    but it repeats across every read; once your eye locks the four
    colors, the cig/vis layer is decode-by-glance.
  cardType: basic
  kind: recall
  tags: [weather, gfa, cig-vis, color-convention, PA.I.C.K2d]
  source_ref: |
    AC 00-45H; body Discover (color-coded layers).

- front: "GFA time-slider span -- from how far in the past to how far in the future?"
  back: |
    14 hours of observations / analyses (past) through the current hour
    through +15 hours of forecast. Past windows are observation-grade;
    future windows are model-grade. The forward forecast refreshes every
    three hours; the observation/analysis side updates hourly.
  cardType: basic
  kind: recall
  tags: [weather, gfa, time-slider, ac-00-45h, PA.I.C.K2d]
  source_ref: |
    AC 00-45H; body Discover.

- front: "What product did the GFA replace, and when?"
  back: |
    The textual Area Forecast (FA), in 2017. The spatial forecast picture
    is the right form for area-scale weather questions; the FA's text-
    paragraph rendering of the same data lost too much spatial detail.
    The GFA tool is the modern equivalent and there is no text-only
    counterpart in current production.
  cardType: basic
  kind: recall
  tags: [weather, gfa, area-forecast, history, PA.I.C.K2d]
  source_ref: |
    AC 00-45H; FAA-H-8083-28 Ch 28.2; body Discover.

- front: "GFA is a *front-end* over which underlying models?"
  back: |
    FIP / CIP for icing (Forecast Icing Product / Current Icing Product).
    GTG for turbulence (Graphical Turbulence Guidance).
    NDFD for cig/vis/wind/weather (National Digital Forecast Database).
    Plus AIRMET / SIGMET overlays.
    Reading the GFA is implicitly reading those underlying products at a
    higher abstraction; understanding which model produced a color block
    is what separates 'reading colors' from 'reading the GFA.'
  cardType: basic
  kind: recall
  tags: [weather, gfa, fip, cip, gtg, ndfd, ac-00-45h, PA.I.C.K2d]
  source_ref: |
    AC 00-45H; body Reveal.

- front: "GFA refresh cadence: observations / analyses vs forward forecast."
  back: |
    Hourly for observations and analyses (the past 14 hours of the slider).
    Every three hours for the forward forecast (now through +15 hours).
    The cadence mismatch matters when you scrub a long route: the future
    side of the slider is older relative to its forecast time than the
    past side is to its observation time.
  cardType: basic
  kind: recall
  tags: [weather, gfa, cadence, refresh, ac-00-45h, PA.I.C.K2d]
  source_ref: |
    AC 00-45H; body Reveal.

- front: "Triage rule: how do you keep a GFA brief from devolving into layer-scrolling?"
  back: |
    Pick the *one* layer that drives this flight (icing for a winter
    cross-country, cig/vis for a marginal-VFR planning question, turbulence
    for a known-rough route) and read it carefully across the time horizon
    you'll fly. Other layers are confirmation. The GFA invites
    layer-scrolling without depth; pre-naming the dominant layer is the
    discipline that makes the brief converge.
  cardType: basic
  kind: recall
  tags: [weather, gfa, triage, briefing, PA.I.C.K2d]
  source_ref: |
    Body Discover triage step.
  rationale: |
    The body's central triage instruction. This card forces the learner
    to pick a dominant layer rather than scroll all seven.

- front: "250 NM cross-country across a forecast frontal passage. METARs/TAFs at endpoints look fine but the route between has no terminal. Where in the brief do you look?"
  back: |
    GFA -- the spatial forecast field that fills the gap between point
    products. METARs / TAFs are airport-tied; the GFA is a continuous 2D
    field you can scrub through time. Set the time slider to your ETA
    over the mid-route segment, toggle cig/vis + clouds + weather, and
    read the colors along the planned path. Color discontinuities = the
    front you're flying through.
  cardType: basic
  kind: recall
  tags: [weather, gfa, route-analysis, frontal-passage, PA.I.C.K2d]
  source_ref: |
    Body Context scenario.
  rationale: |
    Scenario card from the body's Context. The mid-route gap is the GFA's
    canonical use case.

- front: "MVFR or IFR blocks appear along your planned route at the GFA forecast time you'll be airborne. What has the GFA just done?"
  back: |
    Identified the hazard window -- the time and place where the cig/vis
    forecast crosses the legality boundary for VFR. The blocks tell you
    *where* the hazard sits along the route and *when* it's forecast. The
    next briefing step: decode the underlying NDFD model + AIRMET SIERRA
    to understand confidence; cross-check with TAFs and PIREPs along the
    edge of the polygon.
  cardType: basic
  kind: recall
  tags: [weather, gfa, mvfr, ifr, hazard-window, PA.I.C.K2d, PA.I.C.S2]
  source_ref: |
    Body Practice "real 'is this route flyable?' check."

- front: "Reading the GFA without understanding what feeds it produces what kind of error?"
  back: |
    Overconfidence. The colors are the *output*; the underlying model has
    failure modes (FIP/CIP can underforecast SLD; GTG can miss
    mountain-wave turbulence; NDFD smooths terrain effects). A pilot who
    treats the GFA as ground truth misreads the picture's confidence
    boundary. The K2g node on AIRMETs/SIGMETs and the equipment-and-data-
    limitations node are the depth complement to the GFA's breadth.
  cardType: basic
  kind: recall
  tags: [weather, gfa, limitations, judgment, PA.I.C.K2d, PA.I.C.R2b]
  source_ref: |
    Body Connect.
```

## Connect

GFA is the spatial integration of the underlying weather products. It
inherits AIRMET / SIGMET hazards, the FIP/CIP icing forecast, the GTG
turbulence forecast, and NDFD weather grids. Reading the GFA without
understanding what feeds it produces overconfidence; the K2g node on
AIRMETs/SIGMETs is the depth complement to this node's breadth.

## Verify

Walk a real route on the GFA tool from the departure to the destination,
hour by hour from now to ETA. Identify every layer that changes color
along the path. For each change, name the underlying product or model
that drove the change. If you can't, you don't yet know what the GFA is
showing you -- you're just reading colors.
