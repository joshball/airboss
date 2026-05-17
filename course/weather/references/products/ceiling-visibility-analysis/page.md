---
id: wx-ref-ceiling-visibility-analysis
title: Ceiling and Visibility Analysis (CVA)
short_code: CVA
category: chart
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Ceiling and Visibility Analysis section'
    note: 'Product description, grid resolution, flight-category color scale, update cadence, ceiling/visibility-only views.'
    verified: true
  - source: AIM
    section: '7-1-7 -- Categorical Ceiling and Visibility Conditions'
    note: 'Pilot/controller glossary defines VFR / MVFR / IFR / LIFR flight-category brackets used by the CVA color scale.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Ceiling and Visibility chapter'
    note: 'Pilot-pitch treatment of how ceiling and visibility are measured, blended, and gridded; relationship to METAR/SPECI inputs.'
    verified: true
related_knowledge_nodes:
  - wx-product-surface-analysis-and-cva
  - wx-fog-and-visibility-obstructions
related_products:
  - metar
  - taf
  - surface-analysis
  - gfa
  - airmet
---

# Ceiling and Visibility Analysis (CVA)

> The "is the area VFR right now?" picture in one glance: a color-coded raster of flight-category coverage built from current METARs, refreshed continuously.

## What it is

A gridded current-conditions chart produced by the Aviation Weather Center (AWC) that depicts ceiling height and prevailing visibility across the contiguous United States. The product blends current METAR and SPECI observations with a model background field between reporting stations, then assigns each grid cell to a flight category (VFR, MVFR, IFR, LIFR) based on whichever of ceiling or visibility is more restrictive. The result is a color-coded raster image: green where the area is VFR, blue where it is MVFR, red where it is IFR, magenta where it is LIFR. The product is a chart, not encoded text. It updates continuously as new observations come in (roughly every five minutes), and exposes three layers a pilot can toggle: combined flight category (default), ceiling-only, and visibility-only. Any grid cell is queryable -- click the cell and the underlying ceiling height (in feet AGL) and visibility (in statute miles) are reported.

## When you read it

- **Preflight, as the first "where is the bad weather right now?" pass.** The CVA is the fastest way to see whether the area around your departure, route corridor, and destination is currently flyable VFR. It answers the question before you start reading individual METARs station-by-station, and it shows you the cells in between stations that no METAR covers.
- **Marginal-conditions triage.** On a clear high-pressure day the CVA is mostly green and adds nothing. On a marginal day -- a fog event, a low overcast deck, a stratus event pushing in from the coast -- the CVA is the one product that shows you the spatial shape of the marginal area at a glance.
- **The decision it informs.** Go/no-go on whether the area is even VFR right now, route selection to skirt MVFR/IFR patches, alternate selection to pick a destination on the right side of the category boundary, and which METARs to read first (the ones nearest the color transitions).
- **What it does NOT replace.** It is **current conditions, not a forecast**. Pair it with a TAF and the GFA to see whether the picture is improving, holding, or deteriorating across your flight window.

## How to read it

The default view is the combined flight-category raster. Every grid cell is painted one of four colors based on the more restrictive of ceiling and visibility.

### Flight-category color scale

| Category | Color   | Ceiling (AGL)         | Visibility (SM)  |
| -------- | ------- | --------------------- | ---------------- |
| VFR      | Green   | greater than 3000     | greater than 5   |
| MVFR     | Blue    | 1000 to 3000          | 3 to 5           |
| IFR      | Red     | 500 to less than 1000 | 1 to less than 3 |
| LIFR     | Magenta | less than 500         | less than 1      |

A cell falls into the worst category triggered by either field. A ceiling of 800 ft with 10 SM visibility is IFR; a ceiling of 5000 ft with 2 SM visibility is also IFR -- both paint the cell red. That is the whole symbology of the default view.

### Layer toggles

| View              | What it shows                                              | When to use it                                                                |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Combined category | Worst of ceiling / visibility, one color per cell          | The default scan. Is the area green, blue, red, magenta?                      |
| Ceiling only      | Cells colored by ceiling height alone, ignoring visibility | Fog-clear-aloft days where visibility tanks but cloud bases stay high.        |
| Visibility only   | Cells colored by visibility alone, ignoring ceiling        | Low-stratus days where the deck is the story and visibility underneath is OK. |

### Reading order

1. **Scan the color field.** Where are the green areas? Where are the blue, red, magenta patches? Note the rough shape -- a coastal band, a river valley, a wide regional patch, isolated cells.
2. **Find your route corridor.** Trace departure to destination across the chart. What colors does the line pass through?
3. **Find the transitions.** The boundaries between colors are where the day's decisions live. Are you crossing them, or running parallel to them?
4. **Query the cell.** Click any cell near the transitions to read the underlying numbers -- a cell flagged IFR at "ceiling 900 / vis 6" is one to-be-watched gust of drizzle from staying IFR; a cell at "ceiling 500 / vis 1.5" is a different problem.
5. **Pair with TAFs.** The CVA tells you "right now." The TAFs at your route airports tell you "later." Read them together.

## Annotated example(s)

### Example 1 -- Morning radiation-fog event over Appalachian river valleys

The CVA at 13Z on a clear October morning shows a striking pattern over central West Virginia and eastern Kentucky. The bulk of the chart is green -- the area is VFR almost everywhere. But threaded through the green field is a network of magenta and red patches that trace, almost cell for cell, the river drainages: the Ohio River, the Kanawha, the New River gorge, the Greenbrier valley. The ridge tops between the rivers are uniformly green. The valley floors paint magenta (LIFR) along the narrowest, deepest cuts and red (IFR) where the valleys widen.

Querying a magenta cell over Charleston (KCRW) reads "ceiling 200 / visibility 0.25 SM." Querying a green cell on the ridge ten miles north reads "ceiling 12000 / visibility 10 SM." The visibility-only layer shows the same pattern; the ceiling-only layer shows it slightly muted -- meaning the magenta is being driven primarily by the visibility field, not the ceiling. This is radiation fog: clear-sky overnight cooling drained cold dense air into the valley bottoms, the temperature/dew-point spread collapsed, and the valleys filled with fog while the ridges stayed dry.

What the pilot reads from this picture: a flight planned out of a valley field like KCRW is LIFR right now and will not move until the sun burns the valley fog off, typically two to three hours after sunrise. A flight into a ridge-top field a few minutes' drive away is VFR with no issue. A route that descends into a destination valley is fine in the cruise and IFR in the approach -- the missed-approach plan and the alternate matter today. Cross-reference the destination TAF for the forecast clearing time; the CVA shows the shape of the problem, the TAF shows when it ends.

### Example 2 -- Coastal stratus pushing inland over California

The CVA at 16Z on a June afternoon shows a sharp east-west color boundary running roughly along the California coast. From the Pacific shoreline inland to about the foothills of the Coast Range, the chart paints solid blue (MVFR) with patches of red (IFR) along the immediate coastline -- a continuous band from San Francisco Bay down through Monterey and into the Santa Maria area. East of the foothills, the chart abruptly returns to green (VFR) across the Central Valley and the Sierra foothills. The transition is sharp -- one or two grid cells wide.

Querying a blue cell over Half Moon Bay (KHAF) reads "ceiling 1200 / visibility 4 SM." A red cell over Monterey (KMRY) reads "ceiling 600 / visibility 2.5 SM." A green cell over Salinas (KSNS), just inland and on the lee side of the coastal hills, reads "ceiling 8000 / visibility 10 SM." The ceiling-only layer shows the same coastal band almost identically; the visibility-only layer is paler. Today's story is the marine layer -- a stratus deck overrunning the coastal terrain.

What the pilot reads from this picture: a flight out of a coast-side field starts in MVFR or IFR with a low overcast deck. The deck has a known top (usually 1500-3000 ft MSL for a coastal stratus event); climbing through it returns the aircraft to clear air. Routing eastward across the foothills emerges into VFR conditions over the Central Valley within ten or fifteen minutes. A return into a coast-side destination late in the day requires confirming the stratus has eroded inland or has cleared back to the shoreline -- the TAF and the next CVA frame answer that. Choosing an inland alternate east of the foothills is trivial today.

## Common gotchas

- **CVA is current conditions, not a forecast.** Conditions can change between observation passes; the chart is a snapshot built from the latest METARs and SPECIs. For "where will the boundary be in three hours?" pair with the TAFs and the GFA.
- **Ceiling is AGL, not MSL.** A 1500 ft ceiling at a 6000 ft MSL airport is at 7500 ft MSL, not 1500 ft MSL. The chart reads it as 1500 ft -- the airport elevation is the reference. Translate to MSL yourself when you are planning a cruise altitude.
- **Between-station interpolation can hide micro-scale features.** The model background blends across data-sparse areas; a fog bank in one narrow valley with no METAR can be smoothed into the surrounding green, and a dry pocket between two foggy stations can be painted bluer than reality. Trust station-coincident cells; treat far-from-station cells as best-effort.
- **VFR threshold on the chart is not the regulatory VFR weather minimum.** The CVA's VFR/MVFR/IFR/LIFR brackets are FAA flight-category labels -- a coarse triage scale. Legal VFR weather minimums per 14 CFR 91.155 are altitude- and airspace-dependent (3 SM and 1000/500/2000 cloud clearance in most controlled airspace below 10000 MSL, different numbers above and in different airspace classes). A green cell does not guarantee 91.155 compliance; check the minimums for your altitude and airspace.
- **MVFR is not "marginal legal," it is "marginal operational."** A pilot can fly MVFR legally with appropriate cloud clearance. The blue color is a flag that the operating environment is closing in, not that the flight is illegal.
- **Worst-of rule means one field dominates.** A cell painted red can be IFR by ceiling, by visibility, or by both -- the default view does not distinguish. Use the ceiling-only and visibility-only layers to find out which.
- **Time stamp is the most recent observation pass.** Confirm the chart timestamp matches the time you are looking at it. A CVA more than 15-30 minutes old may already be out of date in a fast-changing pattern (an advancing fog bank, an approaching squall line).

## Triage

When you have 60 seconds to scan the CVA, the color says it all. The questions are:

- **Is my route corridor green, blue, red, or magenta?** Trace departure to destination across the chart. The dominant color is the headline.
- **Where do the categories transition?** Color boundaries are decision points -- they are where you are likely to cross from VFR into MVFR, or out the other side. Note their location and rough orientation relative to your route.
- **Is the bad area shrinking, holding, or growing?** The CVA itself does not tell you -- pair it with the TAFs at the affected airports. A TAF showing "BECMG VFR by 18Z" over a magenta cell is a different decision than a TAF showing "TEMPO 1/2SM FG" extending the LIFR through the afternoon.
- **One operational sentence.** "Coastal stratus blue/red from KSFO down to KMRY clearing inland by KSNS; route inland, no issue." If you can land on a sentence like that, you have read the chart.

## Related products

- [METAR](../metar/page.md) -- the point observations the CVA grids together. Read the METARs at and near color transitions to confirm the chart and read the trend.
- [TAF](../taf/page.md) -- the terminal forecast. CVA shows "now;" the TAF shows "later" at each airport.
- [Surface analysis](../surface-analysis/page.md) -- explains why. Pressure systems and fronts on the surface analysis almost always correlate with the MVFR/IFR boundaries on the CVA.
- [GFA](../gfa/page.md) -- Graphical Forecasts for Aviation. Wider hazard picture (icing, turbulence, ceilings, visibility) on the same map across a forecast time window.
- [AIRMET (Sierra)](../airmet/page.md) -- the area advisory for IFR ceilings/visibilities and mountain obscuration. The CVA shows the current footprint of the IFR area; AIRMET Sierra is the corresponding hazard polygon.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Ceiling and Visibility Analysis section. Product description, grid resolution, flight-category color scale, update cadence, ceiling- and visibility-only views.
- **AIM 7-1-29** -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR). Pilot/controller glossary defines the VFR / MVFR / IFR / LIFR flight-category brackets used by the CVA color scale.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Ceiling and Visibility chapter. Pilot-pitch treatment of how ceiling and visibility are measured, blended, and gridded; relationship to METAR/SPECI inputs.
- Service docs: [aviationweather.gov/data/cva](https://aviationweather.gov/data/cva) for the canonical AWC CVA product page and the live raster.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Surface Analysis and Ceiling/Visibility Charts](../../../../knowledge/weather/product-surface-analysis-and-cva/node.md) -- the chart's role in the product family and briefing workflow.
- [Fog and Visibility Obstructions](../../../../knowledge/weather/fog-and-visibility-obstructions/node.md) -- the meteorology behind the visibility patterns the CVA paints.
