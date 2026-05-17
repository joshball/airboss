---
id: wx-ref-gfa
title: Graphical Forecasts for Aviation (GFA)
short_code: GFA
category: area-product
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Graphical Forecasts for Aviation section'
    note: 'Format spec for the GFA tool layers. Verify exact chapter/section in current revision.'
    verified: true
  - source: AIM
    section: '7-1-4 -- Graphical Forecasts for Aviation (GFA)'
    note: 'Preflight briefing (7-1-5) and in-flight weather advisories (7-1-6). The GFA is the spatial integration of the in-flight advisory products.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Chapter 28 -- Aviation Weather Tools, §28.2 (Graphical Forecasts for Aviation (GFA) Tool); Ch 27 §27.6 (Area Forecasts) for non-CONUS regions'
    note: 'GFA is the post-Area-Forecast replacement for CONUS. Legacy textual FA still covered in Ch 27 §27.5 for non-CONUS regions.'
    verified: true
related_knowledge_nodes:
  - wx-product-gfa
related_products:
  - airmet
  - sigmet
  - surface-analysis
  - prog-chart
---

# Graphical Forecasts for Aviation (GFA)

> Interactive web-based area forecast at aviationweather.gov/gfa covering CONUS clouds, weather, turbulence, icing, surface conditions, and winds in scrubable time slices. Replaced the textual CONUS Area Forecast in 2017.

## What it is

The GFA is the National Weather Service's interactive web product at `aviationweather.gov/gfa`. It renders a continuous 2D forecast field over CONUS as a stack of toggleable layers: clouds, precipitation/weather, thunderstorms, ceiling and visibility, turbulence, icing, surface pressure and winds, and winds aloft. A time slider runs from roughly 14 hours of observations and analyses through the current hour and forward in 3-hour forecast steps out to +15 hours; some layers extend further.

The GFA is a front-end. The colors are renderings of underlying model output: FIP/CIP for icing, GTG for turbulence, NDFD for cig/vis/wind/weather grids, plus AIRMET / SIGMET overlays. Reading the GFA is implicitly reading those products at a higher abstraction.

The GFA replaced the legacy textual Area Forecast (FA) for CONUS in 2017. **The text FA still exists** for Alaska, Hawaii, and the Caribbean -- the GFA is not a universal replacement, it is the CONUS replacement.

## When you read it

- **Preflight, area-scale planning.** After you have METARs and TAFs for departure and destination but before you decode AIRMETs and SIGMETs by polygon. The GFA answers "what does the whole corridor look like?" -- the gap that point products leave open.
- **Decisions it informs.** Route selection (does the front sit across the planned path, or can you go around it?), altitude selection (where does the icing band start?), go/no-go on a marginal-VFR cross-country, divert planning before pushback.
- **Briefing-pack position.** Sits between airport-tied products (METAR / TAF / PIREP) and hazard polygons (AIRMET / SIGMET / Convective SIGMET). Treats the in-flight advisories as overlays on top of the synoptic picture.

## How to read it

The interface is the product. There is no encoded text form to decode field-by-field; instead, the skill is layer selection and time-slider control.

### Tabs

| Tab          | Time window               | What it shows                                                               |
| ------------ | ------------------------- | --------------------------------------------------------------------------- |
| Observations | -14 hr to current         | METAR-derived cig/vis, radar, satellite, PIREPs plotted on the map          |
| Forecasts    | current to +15 hr (+more) | Model-driven forecast layers (clouds, weather, icing, turbulence, winds)    |
| Warnings     | active                    | AIRMET / SIGMET / Convective SIGMET / CWA polygons overlaid on the base map |

### Standard layers

| Layer                  | Sub-options                            | What it answers                                         |
| ---------------------- | -------------------------------------- | ------------------------------------------------------- |
| Clouds                 | Ceiling, tops, sky cover by altitude   | Where are the layers and how thick are they?            |
| Precipitation/Weather  | Type, intensity                        | Where is it raining/snowing and how hard?               |
| Thunderstorms          | Probability, coverage                  | Where is convection forecast?                           |
| Ceiling and Visibility | Categorical (VFR/MVFR/IFR/LIFR)        | Is the route legal/comfortable for VFR?                 |
| Turbulence             | Severity, altitude band                | Where will it be rough, and at what altitudes?          |
| Icing                  | Severity, altitude band, SLD potential | Where is structural icing forecast, and what flavor?    |
| Surface Pressure/Winds | Isobars, surface wind barbs            | Where is the front, and how strong is the surface wind? |
| Winds Aloft            | Selectable flight level                | Headwind/tailwind picture by altitude                   |

### Time-slider mechanics

- **OBS time = "now" snapshot.** On the Observations tab the slider scrubs through hourly observations and analyses. What you see is what happened.
- **FCST time = forecast snapshot.** On the Forecasts tab the slider scrubs in 3-hour steps. Each step is a *snapshot at that time*, not a "valid for the period" summary. If you need conditions at +4.5 hours, you interpolate between the +3 and +6 frames.
- **Refresh cadence.** Observations and analyses refresh hourly. The forward forecast refreshes every three hours.

### Point-and-click

Click a coordinate on the map to pull the underlying gridded forecast values at that point and time (cig, vis, wind, temp, weather). The popup is the most precise read on any layer; the colors are the at-a-glance.

### Color conventions (cig/vis)

Standard category map: **VFR = green, MVFR = blue, IFR = red, LIFR = magenta**. Used on the cig/vis layer and inherited by overlays that reference categorical flight conditions.

## Annotated example(s)

This product is interactive and image-based. There is no raw text to paste. The examples below describe representative GFA scenarios in prose -- imagine sitting at aviationweather.gov/gfa with the layer panel open.

### Example 1 -- clear-skies cross-country

> Planned route: 180 NM, mid-morning departure, VFR cross-country across a high-pressure ridge. TAFs at both terminals call CAVOK and light surface winds.
>
> **Step 1 -- Observations tab, time set to current.** Cig/vis layer: solid green corridor along the planned track. Clouds layer: scattered to few coverage at 8,000 to 12,000 ft, no overcast. Radar: dry. PIREPs (if any): nothing relevant within 50 NM of the route.
>
> **Step 2 -- Forecasts tab, time set to +3 hr (planned mid-route position).** Cig/vis still solid green. Clouds layer still SCT/FEW at the same band. Weather layer: no precipitation. Turbulence and icing layers: blank or light over the route corridor.
>
> **Step 3 -- Warnings tab, time set to current.** No AIRMET Sierra, Tango, or Zulu polygons over the route. SIGMET / Convective SIGMET: none.
>
> **Step 4 -- Winds aloft layer at planned cruise altitude (say 6,500 ft).** Light westerly tailwind component along the path. Note expected groundspeed gain.

Read it as: the synoptic picture is benign. The GFA's job here is *confirming* that the gap between the two TAFs holds no surprise. Total time on the GFA: under two minutes.

### Example 2 -- frontal-passage day

> Planned route: same 180 NM cross-country, but a cold front is forecast to cross the route corridor during the planned flight time. TAFs at both terminals are ambiguous: departure says VFR shifting to MVFR by ETA-2, destination says VFR with TEMPO IFR conditions in showers.
>
> **Step 1 -- Observations tab, time set to current.** Cig/vis: green at departure, yellow (MVFR) just east of the front, red (IFR) west of the front. Radar: a line of returns oriented north-south, west of the destination, moving east. Surface pressure layer: the front position is visible as a kink in the isobars.
>
> **Step 2 -- Forecasts tab, time set to ETA (+3 hr).** Cig/vis: the yellow/red boundary has marched east and now overlaps the destination terminal. Weather layer: shaded precipitation along and behind the front. Thunderstorm layer: probability shading ahead of the front (the warm side).
>
> **Step 3 -- Warnings tab, time set to ETA.** **AIRMET Sierra** polygon: covers the IFR conditions along and behind the front. **AIRMET Zulu** polygon: covers the post-frontal cold air mass, with the freezing level depicted by an isoline overlay (cold air rides up the back of the front, freezing level drops, icing is forecast for the cruise altitude). **Convective SIGMET** (if issued): covers the line ahead of the front. Cross-check against the dedicated Convective SIGMET page.
>
> **Step 4 -- Icing layer, +3 hr, altitude set to planned cruise.** Light-to-moderate icing forecast on the back side of the front above the new freezing level. SLD potential indicator (if shown): note its position.
>
> **Step 5 -- Turbulence layer, +3 hr, same altitude.** Moderate turbulence band along the front and post-frontal in the lee of any terrain.

Read it as: the route crosses a frontal boundary during the planned flight time. The GFA has identified three separate hazard windows (IFR cigs, icing aloft, convective activity ahead of the front) and located them in time and space. The next briefing step is to decode each underlying polygon (AIRMET Sierra, AIRMET Zulu, Convective SIGMET) for severity, valid time, and altitudes, and to cross-check with current PIREPs along the front. The go/no-go conversation starts here.

## Common gotchas

- **The GFA is graphical, not regulatory.** AIRMETs / SIGMETs / Convective SIGMETs are the regulatory hazard products. The GFA overlays them but does not replace the requirement to read the polygon text for severity, altitudes, and valid period.
- **CONUS only.** The textual Area Forecast (FA) is retired for CONUS but still issued for **Alaska, Hawaii, and the Caribbean**. Flying outside CONUS = read the legacy text FA, not the GFA.
- **Forecast slices are snapshots, not period valids.** A +3 hr cig/vis frame is the model's best guess at that single instant. It is not a "valid 0000Z-0300Z" summary. Interpolate between frames for in-between times.
- **The GFA icing layer is not the FIP/CIP product.** It is the FIP/CIP *rendered through the GFA front-end* at the layer's resolution. For altitude-detailed icing planning, especially SLD potential, open the dedicated FIP/CIP product.
- **Cig/vis without the AIRMET Sierra overlay misses mountain obscuration.** Mountain obscuration is encoded in Sierra and may not be visible as a cig/vis color block. Toggle the Warnings tab before declaring a route VFR-clean.
- **Refresh cadence mismatch.** The observation side updates hourly, the forecast side every three hours. A "fresh" GFA load can still be looking at a forecast frame that's almost three hours old relative to its valid time.
- **Slow connections lag the render.** Layer toggles can appear to do nothing while tiles load. Wait for the layer panel state indicator before declaring "no AIRMET in this area" -- the polygon may not have rendered yet.
- **Categorical color = airport-style cig/vis only.** VFR/MVFR/IFR/LIFR refers to ceiling and visibility, not to turbulence or icing severity. Don't read "green = safe" across all layers.

## Triage

When you have 60 seconds on the GFA:

1. **Set the time slider to your departure time, then scrub to ETA.** The motion across the time range is what tells you whether conditions are improving, holding, or deteriorating.
2. **Toggle Clouds + Precipitation + Thunderstorms first.** That's the synoptic story -- what kind of weather day is this?
3. **Switch to the Warnings tab.** AIRMET / SIGMET / Convective SIGMET polygons over the route are the hazards.
4. **Toggle Winds Aloft + Turbulence + Icing at planned cruise altitude.** Altitude-band planning lives here.
5. **The "what changes the go/no-go" answer is usually visible in the first two minutes.** If it isn't, you're scrolling layers without a question. Pick the *one* layer that drives this flight (icing for a winter cross-country, cig/vis for a marginal-VFR planning question, turbulence for a known-rough route) and read it carefully across the time horizon.

## Related products

- [airmet](../airmet/page.md) -- the hazard polygons that overlay the GFA's Warnings tab. Read the GFA to find where the polygons sit relative to the route; read the AIRMET text for severity, altitudes, and valid period.
- [sigmet](../sigmet/page.md) -- severe hazard polygons. The GFA overlays them; the SIGMET text is the regulatory product.
- [surface-analysis](../surface-analysis/page.md) -- the surface chart that explains *why* the GFA's clouds and precipitation layers look the way they do. Read it alongside the GFA on any frontal day.
- [prog-chart](../prog-chart/page.md) -- the forecast surface and significant-weather chart. The prog is a hand-analyzed forecast, the GFA is a model-rendered forecast; they should agree, and disagreement is a question to ask the briefer.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Graphical Forecasts for Aviation section. Format spec for the GFA tool layers. Verify exact chapter in the current revision.
- **AIM** -- 7-1-5 (Preflight Briefing), 7-1-6 (In-Flight Aviation Weather Advisories). Operational use of the GFA in the briefing flow and as the spatial integration of the in-flight advisory products.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 28 (Aviation Weather Tools), §28.2 (Graphical Forecasts for Aviation (GFA) Tool). Defines the current GFA tool and its static-image suite. The legacy textual FA, still issued for Alaska / Hawaii / Caribbean, is covered in Ch 27 §27.5.
- **Service docs** -- `aviationweather.gov/gfa` is the product home and the most current reference for layer set, time-slider behavior, and known limitations.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Graphical Forecasts for Aviation (GFA)](../../../../knowledge/weather/product-gfa/node.md) -- the three-stage decode/understand/triage walk, the front-end-over-models framing, and the spaced-repetition card set.
