---
id: wx-ref-surface-analysis
title: Surface Analysis Chart (chart)
short_code: SFC-ANL
category: chart
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Surface Analysis Chart section'
    note: 'Authoritative symbol set, isobar interval, frontal glyphs, station model layout, and 3-hourly issue cadence.'
    verified: true
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Operational role of the surface analysis in the preflight briefing flow.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Chapter 25 -- Analysis (Surface Analysis Chart subsection)'
    note: 'Modern pilot-pitch treatment of chart production at the Weather Prediction Center and the Unified Surface Analysis.'
    verified: true
  - source: AC 00-6B
    section: 'Aviation Weather, Surface Analysis section'
    note: 'Underlying meteorology -- pressure systems, frontal mechanics, wind around highs and lows.'
    verified: true
related_knowledge_nodes:
  - wx-product-surface-analysis-and-cva
  - wx-chart-type-surface-analysis
  - wx-airmasses-and-fronts
related_products:
  - prog-chart
  - metar
  - gfa
  - airmet
  - ceiling-visibility-analysis
---

# Surface Analysis Chart (chart)

> The synoptic story of the lower atmosphere across North America in one image: where the pressure centers are, where the fronts are, how strong the gradient is, and what every reporting station is observing right now.

## What it is

A hand-analyzed chart issued by the Weather Prediction Center (WPC) that depicts the state of the atmosphere at the surface at a specific valid time. It is updated every 3 hours, on the synoptic clock (00, 03, 06, 09, 12, 15, 18, 21 Zulu). The product is a single image, not encoded text, and it carries four classes of marks: **isobars** drawn at 4 mb intervals (every other isobar drawn heavier, at 8 mb), **high (H) and low (L) pressure centers** at the middle of closed isobars, **frontal symbols** along boundaries between dissimilar airmasses (cold, warm, stationary, occluded, plus troughs and drylines as dashed lines), and **station model observations** scattered around the chart at reporting stations across North America. The chart is hand-drawn by a meteorologist -- it is analyzed, not computed -- which means it reflects a forecaster's interpretation of the observation network, and there is typically 1-3 hours of latency between the valid time on the chart and when the chart actually posts.

## When you read it

- **Preflight, FIRST chart in the briefing flow.** The surface analysis frames the synoptic story before you read any airport-specific product. Pressure centers, fronts, and gradient orientation give you the big picture; METARs, TAFs, and PIREPs fill in the detail. Reading the analysis last is reading the briefing inside-out.
- **Paired with the same-day prog chart.** The analysis is a snapshot; the prog chart projects it forward 12, 24, 36, and 48 hours. Read both together to know where the synoptic features are headed during your flight window.
- **The decision it informs.** Go/no-go on the synoptic frame (a fast-moving cold front through the destination at ETA is a different decision than a stagnant high), route selection (skirting a deep low or detouring around a stalled stationary front), altitude planning relative to frontal slope, and which downstream products to scrutinize first.
- **What it does NOT replace.** It is a surface product. Upper-air troughs, jet stream position, and aloft features live on separate charts. It is also not a forecast -- for that, switch to the prog chart.

## How to read it

The chart is dense by design. Reading it well is a matter of walking the four classes of marks in order, then triaging which features matter for your route.

### Symbology

| Element              | What it looks like                                          | What it tells you                                                                 |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Isobar               | Thin black line, contour of equal sea-level pressure        | Drawn every 4 mb. Shape shows where pressure is changing; spacing shows speed.    |
| Isobar emphasis      | Every other isobar drawn heavier (every 8 mb)               | Quick visual scan of the major contour lines.                                     |
| Tight isobar packing | Lines crammed close together                                | Strong pressure gradient = strong surface wind (25 kt+ when crammed).             |
| Loose isobar packing | Lines spread far apart                                      | Weak gradient = light and variable surface wind.                                  |
| H marker             | Capital H at the center of closed isobars                   | High pressure center. Northern-hemisphere flow clockwise, outward, subsiding.     |
| L marker             | Capital L at the center of closed isobars                   | Low pressure center. Northern-hemisphere flow counterclockwise, inward, rising.   |
| Cold front           | Blue line with triangles pointing direction of motion       | Cold air pushing under warm air. Sharp boundary, narrow band of intense wx.       |
| Warm front           | Red line with half-circles pointing direction of motion     | Warm air overrunning cold air. Shallow slope, broad stratiform overrun ahead.     |
| Stationary front     | Alternating red half-circles and blue triangles, opposed    | Airmasses balanced. Weather on both sides, slow to clear. Watch for cyclogenesis. |
| Occluded front       | Purple line with alternating triangles and half-circles     | Cold front caught up with warm front. Often the least intense active front.       |
| Trough / dryline     | Dashed line                                                 | Pressure trough without a full frontal character; can still focus weather.        |
| Station model        | Small circle with wind barb and surrounding numeric / glyph | Miniature METAR at one reporting station -- wind, T, Td, P, sky, weather.         |

### Station model layout

The station model is a compressed METAR drawn around a small circle. Once you know the convention, a learner who can read a METAR can read a station model with about ten minutes of practice.

| Position around the circle | Field                  | Notes                                                          |
| -------------------------- | ---------------------- | -------------------------------------------------------------- |
| Long shaft into circle     | Wind direction         | The shaft points the direction the wind is coming from.        |
| Barbs on the shaft         | Wind speed             | Half barb = 5 kt, full barb = 10 kt, pennant = 50 kt.          |
| Top-left of circle         | Temperature            | Degrees F on US charts, degrees C on international charts.     |
| Bottom-left of circle      | Dew point              | Same units as temperature.                                     |
| Top-right of circle        | Sea-level pressure     | Last three digits in tenths of mb (e.g. 134 = 1013.4 mb).      |
| Inside the circle          | Sky cover              | Fill amount encodes coverage (clear / few / scattered / etc.). |
| Left of the circle         | Current weather symbol | Standard WMO glyphs for rain, snow, fog, thunderstorm, etc.    |

### Reading order

1. **Find the pressure centers.** Every H and every L. Trace one isobar around each closed center. Predict rotation direction (counterclockwise around L, clockwise around H) and rough wind speed from isobar spacing.
2. **Audit the fronts.** Name each frontal symbol by type and direction of motion. For the front nearest your route, predict the weather signature on each side.
3. **Cross-check station models.** Pick three station models near a center or front and confirm the wind barbs agree with the rotation rule and that temperature / dewpoint match the expected airmass.
4. **Reduce to one operational sentence.** Trace your route across the chart. Which single feature is closest to your route at ETA? Which is irrelevant? If you cannot summarize the chart's effect on your flight in 15 words, you are still including features that do not matter.

## Annotated example(s)

### Example 1 -- Winter cold front sweeping through the Midwest

The chart, valid 12Z on a January morning, shows a deep low centered over Hudson Bay marked with an `L` at 988 mb. Isobars curl tightly around it, with the 992, 996, 1000, and 1004 mb contours stacked close on the south side. A cold front trails southward from the low's center, sweeping down through Minnesota, across Iowa and Missouri, and curving back to the southwest into Oklahoma. Blue triangles along the front point east-southeast -- the front is moving toward the Ohio Valley.

On the back side of the front (the side the triangles point away from), the isobars are packed tightest of all -- you can count five isobars across the state of Iowa, which means a 20 mb gradient over roughly 300 NM. Station models behind the front show 30-35 kt wind barbs out of the northwest, temperatures in the teens and low 20s F, dew points within a few degrees, and clearing skies (open or lightly filled circles). One station near Des Moines shows the current-weather glyph for snow showers tapering off.

Ahead of the front (the side the triangles point toward), the isobars spread further apart over Illinois and Indiana. Station models there show 10-15 kt south-southwest wind barbs, temperatures in the upper 30s and low 40s F, dew points lifting toward the temperature, overcast or broken circles, and a few current-weather glyphs for light rain transitioning to snow along the leading edge.

What the pilot reads from this picture: the synoptic engine is the Hudson Bay low; the cold front is the active boundary; the back side of the front is where the day's surface wind story lives, with strong gusty northwesterlies for the next 12-18 hours over the Midwest. A VFR flight planned across Iowa westbound this afternoon faces direct headwinds at the surface, deteriorating airframe icing risk in the post-frontal moist northwest flow, and runway crosswinds well into demonstrated-limit territory at small fields. A flight ahead of the front into Illinois has hours before the squall line arrives, but the timeline is set: when the front crosses, conditions flip from south wind / falling pressure / rain to northwest wind / rising pressure / clearing within an hour or two.

### Example 2 -- Summer stagnant pattern with a Bermuda high

The chart, valid 18Z on a July afternoon, shows a broad `H` centered offshore over the western Atlantic at roughly 32 N, marked at 1024 mb -- the classic Bermuda high. Isobars from the high spread westward over the entire eastern US in wide, lazy concentric arcs. The 1020 isobar covers the Carolinas and most of Georgia; the 1016 covers Tennessee and Kentucky; the next isobar is not crossed until the Ohio Valley. There is no front anywhere over the eastern half of the continent.

Station models across Georgia, the Carolinas, Tennessee, and the Mid-Atlantic show light and variable wind barbs (2-5 kt, many with no barb at all -- just the bare circle). Temperatures are uniformly in the upper 80s and low 90s F. Dew points are in the low 70s -- a very close temperature / dew-point spread that means high relative humidity and low density altitude. Sky cover circles are mostly scattered or broken (partly filled), and several stations show current-weather glyphs for thunderstorms (the cell-with-bolt symbol) or showers -- but scattered across the chart, not lined up along any boundary.

What the pilot reads from this picture: weak pressure gradient = light winds, which sounds friendly but is not. The hazards have shifted from synoptic to airmass. With a stagnant maritime tropical (mT) airmass parked over the southeast, the convective story is local -- afternoon air-mass thunderstorms popping up where heating and terrain provide the trigger. They do not march in lines; they appear and dissipate in place. Visibility is reduced by summer haze (the close T/Td spread reads as humidity, the chart's lack of front means no fresh airmass to scour it out). Density altitude at midday is high enough at any inland field to matter for takeoff performance. The flight planning question is no longer "where is the front?" -- it is "when does the afternoon convection peak, and can I be on the ground before it?" The chart's flatness is the story.

## Common gotchas

- **Isobars are in millibars, drawn at a 4 mb interval.** Pressures on station models are in tenths of mb truncated to the last three digits (134 = 1013.4 mb), not in inches of mercury. Translating mentally to inHg on the fly is a low-value detour -- read the mb directly.
- **Spacing matters more than absolute pressure.** A 992 mb low with widely spaced isobars produces lighter winds than a 1008 mb low with crammed isobars. The gradient is the operational signal, not the central pressure value.
- **This is a SURFACE chart.** Upper-air features -- the 500 mb trough, the jet stream, the upper-level low displaced from the surface low -- live on separate charts. A "clean" surface analysis can sit underneath an active upper-air pattern that drives convection and turbulence aloft. For the aloft picture, switch products.
- **Time stamps are Zulu (UTC).** Match the chart's valid time against the time you expect to be flying. A 12Z chart for a 21Z flight is 9 hours old at takeoff; pair it with the 12-hour prog or wait for the next 3-hourly analysis.
- **The chart has 1-3 hours of latency.** Even at the valid time, the chart is hand-drawn by a forecaster after the observations come in. By the time you see it, the fronts have moved further than they appear on the chart. Always cross-check the front position against the current radar mosaic and the latest METARs.
- **Frontal positions are interpretation, not truth.** Two analysts looking at the same data can place a front 50-100 NM apart. A front drawn through your destination on the analysis may be at the next airport over by the time you arrive. Treat the line as a probable boundary, not a hard line on the ground.
- **EFB renderings are often a subset.** Many EFB apps render only the isobars, pressure centers, and fronts, dropping the full station-model field. If your app is hiding the station models, you are flying with one eye closed -- the WPC raster on ocean.weather.gov or aviationweather.gov has the full chart.

## Triage

When you have 60 seconds to scan the surface analysis, the questions are:

- **Where is the pressure-gradient force strongest?** That is where the strongest surface winds are. Look for the tightest isobar packing along your planned route or near your destination.
- **Where are the fronts, and which way are they moving?** Cold fronts move fast and produce intense brief weather; warm fronts move slowly and produce long broad stratiform weather; stationary fronts are seeds of developing lows; occluded fronts are mature, often weakening. The arrow direction of the triangles or half-circles is the motion vector.
- **What synoptic story do the station observations tell?** Do the station models near a front actually show the airmass contrast (cold/dry behind a cold front, warm/humid ahead)? Do wind barbs near a low actually swirl counterclockwise? If the station obs disagree with the drawn analysis, trust the obs -- the chart is older than the data.
- **One operational sentence.** "Cold front through KORD at 21Z with tight gradient on the back side -- expect 30 kt northwest gusts, snow showers tapering, clearing after midnight." If you can land on a sentence like that, you have read the chart. Everything else fits inside that frame.

## Related products

- [Prog chart](../prog-chart/page.md) -- projects the surface analysis forward 12, 24, 36, and 48 hours. Read them as a pair; the analysis is "now," the prog is "later."
- [METAR](../metar/page.md) -- point observations at individual airports. The station-model network on the analysis is the chart-form of the METAR strip; the two should agree.
- [GFA](../gfa/page.md) -- Graphical Forecasts for Aviation layer the synoptic and airmass picture with aviation-specific hazards (ceilings, visibility, icing, turbulence) on the same map.
- [AIRMET](../airmet/page.md) -- the area hazards driven by the synoptic features on the analysis (IFR ceilings behind a warm front, mountain obscuration, icing).
- [Ceiling-visibility analysis](../ceiling-visibility-analysis/page.md) -- color-coded VFR/MVFR/IFR/LIFR map. The pressure systems and fronts on the analysis almost always correlate with the MVFR/IFR color shifts on the CVA; the analysis explains why, the CVA shows where.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Surface Analysis Chart section. Authoritative symbol set, isobar interval, frontal glyphs, station model layout, 3-hourly issue cadence.
- **AIM 7-1** -- National Weather Service Aviation Products. The operational role of the surface analysis in preflight briefing and the products that ship alongside it.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 25 (Analysis). Modern consolidated treatment of chart production at the Weather Prediction Center and the Unified Surface Analysis.
- **AC 00-6B** -- Aviation Weather, Surface Analysis section. Underlying meteorology -- pressure systems, frontal mechanics, wind rotation around highs and lows, the synoptic reasoning a pilot applies when reading the chart.
- Service docs: [ocean.weather.gov](https://ocean.weather.gov/) for the canonical North American surface analyses; [aviationweather.gov](https://aviationweather.gov/) for the same chart in the aviation product catalog.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Surface Analysis and Ceiling/Visibility Charts](../../../../knowledge/weather/product-surface-analysis-and-cva/node.md) -- the chart's role in the product family and briefing workflow.
- [Reading the Surface Analysis Chart](../../../../knowledge/weather/chart-type-surface-analysis/node.md) -- the mechanics of decoding the chart, drill by drill.
- [Air Masses and Fronts](../../../../knowledge/weather/airmasses-and-fronts/node.md) -- the meteorology the frontal symbols stand in for.
