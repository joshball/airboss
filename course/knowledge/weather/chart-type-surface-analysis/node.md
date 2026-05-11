---
id: wx-chart-type-surface-analysis
title: Reading the Surface Analysis Chart
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, conceptual, perceptual]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: standard
requires:
  - wx-airmasses-and-fronts
deepens:
  - wx-product-surface-analysis-and-cva
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
taught_by: []
related:
  - wx-product-gfa

modalities: [reading, cards, visualization]
estimated_time_minutes: 30
review_time_minutes: 5

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Surface Analysis Chart section
    note: Authoritative symbol set, isobar interval, frontal glyphs, station model layout, and 3-hourly update cadence.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 25 -- Analysis (Surface Analysis Chart subsection)
    note: Modern consolidated treatment of surface analysis production, the WPC role, and the Unified Surface Analysis.
  - source: AIM
    detail: 7-1 -- National Weather Service Aviation Products
    note: Operational use of the surface analysis in preflight briefing and the products that ship alongside it.
  - source: AC 00-6B
    detail: Aviation Weather, Surface Analysis section
    note: Earlier reference still widely cited; covers the synoptic reasoning a pilot applies when reading the chart.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a surface analysis chart: identify H / L pressure
  centers, label every frontal symbol on the chart by type and direction
  of motion, estimate surface wind speed from isobar spacing, and read
  one station model's wind, temperature, dew point, visibility, and sky
  cover. Given a planned route and ETA, the learner can name which
  features on the chart are operationally relevant and which are not.
---

# Reading the Surface Analysis Chart

This node is about the **reading skill** -- the mechanics of decoding what's drawn on a surface analysis chart and converting it into a flight-relevant picture. For the role of the surface analysis in the broader product family (alongside the CVA, prog charts, and the briefing workflow), see [wx-product-surface-analysis-and-cva](../product-surface-analysis-and-cva/node.md).

## Context

You open today's briefing and the first thing on the screen is a surface analysis chart. Black isobars curling around a closed `L` over the Great Lakes, blue triangles marching east across Iowa, station-model circles scattered along the coasts with their tiny wind barbs and temperatures. Two pilots look at the same chart. One sees clutter and clicks past it to the METAR strip. The other reads the chart for ninety seconds and walks away with a sentence: "low pressure deepening over Michigan, cold front sweeping through tonight, tight gradient on the back side -- expect strong gusty northwest winds tomorrow at the destination." Same image, two completely different briefings. The difference is whether the pilot has the reading skill.

## Problem

A surface analysis chart compresses the state of the lower atmosphere across a whole continent into one image. Pressure centers, frontal boundaries, isobars, dozens of station observations. Read it well and it is the fastest way to build the synoptic picture for a flight. Read it poorly and it is impossible to know what to do with -- so most low-time pilots skip it, brief from METARs and TAFs alone, and miss the structural reason the weather is doing what it is doing.

The chart is dense by design. The skill is knowing which marks to look at first and what each one is telling you.

## Discover

Look at a current surface analysis. Before you read anything, ask: what are the four kinds of marks on this chart?

:::chart slug="wx-surface-analysis-2024-12-23-12z"
:::

1. **Pressure centers** -- letters `H` and `L` at the middle of closed isobars. These are the engines of the synoptic flow. A deep low pulls air in at the surface and lifts it; a strong high pushes air out and subsides it.
2. **Isobars** -- thin black lines, each one a contour of equal sea-level pressure, drawn at a fixed interval (commonly 4 mb on the U.S. surface analysis). Their *shape* tells you where pressure is changing; their *spacing* tells you how fast. Tight packing = strong pressure gradient = strong surface wind. Loose packing = light wind.
3. **Frontal symbols** -- the colored glyphs draped along boundaries between dissimilar airmasses. Blue triangles point the way a **cold front** is moving. Red half-circles point the way a **warm front** is moving. Alternating purple symbols mark an **occluded front**. Alternating red half-circles and blue triangles facing opposite directions mark a **stationary front**.
4. **Station models** -- the small circles scattered around the chart, each one a compressed point observation. Wind barb on the upwind side (the long shaft points the way the wind is *coming from*). Temperature top-left, dew point bottom-left, sea-level pressure top-right, sky cover encoded inside the circle, current weather to the left of the circle. The station model is a miniature METAR; a pilot who can read a METAR can learn to read a station model in an afternoon.

Now the reading drill. Pick a low pressure center. Trace one isobar all the way around it. Note: in the northern hemisphere, surface flow around a low is **counterclockwise** and angled slightly inward (friction deflects the geostrophic flow across the isobars by 10-30 degrees at the surface). Around a high it is **clockwise** and angled slightly outward. The wind barbs on station models near the low should agree -- if they don't, the chart is older than the obs, or the chart is wrong.

Pick a frontal symbol. Look at the symbols on each side. Cold front: behind the front (the side the triangles point *away* from) the air is **colder and drier** -- expect rising pressure, clearing skies, gusty wind shift. Ahead of it (the side the triangles point *toward*) the air is **warmer and more humid** -- expect falling pressure, building cumulus, possibly a squall line at the boundary. The same logic mirrored applies to a warm front.

Pick the isobar spacing along your planned route. Mentally measure: are isobars one or two route-widths apart, or are they crammed together? Crammed = expect 25 kt+ surface winds along that segment. Spread out = light and variable.

## Reveal

The chart's authoritative spec lives in **AC 00-45H, Aviation Weather Services** -- the Surface Analysis Chart section defines the symbol set, isobar interval, station model layout, and the 3-hourly issue schedule. **FAA-H-8083-28B Chapter 25 (Analysis)** is the modern handbook treatment; it walks through chart production at the Weather Prediction Center and introduces the Unified Surface Analysis (the WPC product extended to the full continental and oceanic domain). **AIM 7-1** lists the surface analysis among the operational National Weather Service Aviation Products consumed during preflight briefing.

The chart is **hand-drawn by a human meteorologist** -- it is *analyzed*, not computed. Two consequences: the frontal positions and pressure-center placements reflect a forecaster's interpretation of an imperfect observation network, and the chart has a published issue time but takes additional time to draw and post. By the time you see it, the atmosphere has moved on by 1-3 hours.

| Element              | Spec                                                       | Reading cue                                                            |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Isobar interval      | 4 mb on U.S. surface analysis                              | Count isobars across your route to estimate gradient.                  |
| Isobar emphasis      | Every 8 mb (every other isobar) drawn heavier              | Quick visual scan of major contour lines.                              |
| `H` / `L` markers    | Centered on closed isobar at sea-level pressure extremum   | Engine of the local flow; everything spirals around or away from it.   |
| Cold-front glyph     | Blue line + triangles pointing direction of motion         | Sharp boundary; expect narrow band of intense weather.                 |
| Warm-front glyph     | Red line + half-circles pointing direction of motion       | Shallow boundary; expect broad stratiform overrun ahead of it.         |
| Occluded-front glyph | Purple line + alternating triangles and half-circles       | Mature system; warm air aloft, often the least intense active front.   |
| Stationary glyph     | Alternating red half-circles and blue triangles, opposed   | Balanced boundary; weather on both sides, slow to clear.               |
| Station model        | Circle + wind barb + temp / dewpoint / pressure / sky / wx | Miniature METAR; reads exactly the same fields.                        |
| Update cadence       | Every 3 hours (00, 03, 06, 09, 12, 15, 18, 21Z)            | Match the chart's issue time against the time you expect to be flying. |

## Practice

Pull up the **current surface analysis** on aviationweather.gov. Without reading any METARs first, do the following three drills in order:

1. **One-minute orient.** Find every `H` and every `L`. Trace one isobar around each closed center. Predict the rotation direction (counterclockwise around `L`, clockwise around `H`) and the rough wind speed (tight isobars = stronger wind). Then check three station models near each center; the wind barbs should agree.
2. **Front audit.** For every frontal symbol on the chart, name the type and the direction of motion. For the front nearest your route, predict the wind shift on each side and the weather signature (use the cold/warm/occluded/stationary signatures from [wx-airmasses-and-fronts](../airmasses-and-fronts/node.md)).
3. **Route triage.** Trace your planned route across the chart. Which feature is closest to the route at your ETA? Which is irrelevant? Reduce the entire chart to one operational sentence: "expect [gradient / front / pressure trend] along [segment] at [time]." If the sentence is more than 15 words, you're including features that don't matter.

A useful self-test: cover the METAR strip. Predict the surface wind and rough sky condition at three airports along your route from the surface analysis alone. Then uncover the METARs and check. The agreement (or disagreement) is the calibration on your reading skill.

## Connect

This node sits below [wx-product-surface-analysis-and-cva](../product-surface-analysis-and-cva/node.md), which covers the chart's role in the briefing workflow (paired with the CVA, the prog chart, and the rest of the family). It requires [wx-airmasses-and-fronts](../airmasses-and-fronts/node.md) -- you cannot triage frontal symbols on a chart if you don't know what each front type does to the weather. It is applied by every cross-country planning node ([plan-vfr-cross-country](../../flight-planning/vfr-cross-country/node.md)) and the [wx-go-nogo-decision](../go-nogo-decision/node.md), because the surface analysis is where the synoptic frame is built and the synoptic frame drives the decision.

The deeper progression: once the chart-reading is automatic, the next layer is **time integration** -- comparing the current surface analysis against the 12-hour and 24-hour prog charts and seeing the system propagate. That is where the chart stops being a snapshot and starts being a forecast you build in your head. The prog charts and GFA layers ([wx-product-gfa](../product-gfa/node.md)) carry that forward.

## Verify

Pick a real cross-country flight (yours, or one you find in an example briefing). Pull the surface analysis for the planned departure time and the prog chart for the ETA. Without reading any METAR or TAF, write a one-paragraph weather story: where the pressure centers are at departure, where the fronts are, which way the gradient is oriented along the route, what shifts between departure and arrival. Then read the METARs and TAFs in order along the route and check. If the chart-derived story matches the point observations and forecasts within reason, the reading skill is calibrated. If not, look at which step broke: did you miss the front, mis-call the gradient, or mis-read a station model? Fix the specific decoding gap and run the drill again next briefing.
