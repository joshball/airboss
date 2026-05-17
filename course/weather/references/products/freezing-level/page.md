---
id: wx-ref-freezing-level
title: Freezing Level Chart (FZLVL)
short_code: FZLVL
category: chart
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: Freezing Level chart section (often grouped with icing products)
    note: Format spec for the freezing-level analysis and forecast charts -- contour interval, MSL altitude convention, multi-level inversion handling.
    verified: true
  - source: AIM
    section: 7-1-21
    note: Icing -- operational use of the freezing level as part of the icing decision; the chart is the spatial picture of the 0 deg C isotherm.
    verified: true
  - source: FAA-H-8083-28
    section: Chapters 25 (Analysis) and 27 (Forecasts), Freezing Level sections
    note: Aviation Weather Handbook -- freezing-level analysis and forecast graphics, paired with CIP / FIP icing products in the same chapters.
    verified: true
related_knowledge_nodes:
  - wx-freezing-level
  - wx-icing-types-and-avoidance
related_products:
  - icing-fip-cip
  - airmet
  - sigmet
  - pirep
  - winds-temps-aloft
---

# Freezing Level Chart (FZLVL)

> Current and forecast altitude (MSL) of the lowest freezing level across the CONUS, plus the highest freezing level where an inversion exists. The spatial picture of the 0 deg C isotherm. Load-bearing for IFR cruise altitude selection and icing risk in winter.

## What it is

The Freezing Level Chart is an Aviation Weather Center (AWC) graphical product showing the altitude (MSL, in hundreds of feet) of the lowest freezing level over the CONUS, and -- where the atmosphere is inverted -- the altitude of the highest freezing level above the inversion. It is delivered as a contour chart: smooth isolines drawn through the 0 deg C surface, labeled in hundreds of feet MSL (e.g. `80` = 8,000 ft MSL). Areas where the freezing level is at the surface (cold air mass blanketing the ground) are shaded or labeled `SFC` / `0`.

The product publishes both a current-conditions analysis and short-range forecasts. Forecast horizons are typically the current valid time plus 3-hour, 6-hour, and 12-hour outlooks. The analysis is refreshed at sub-daily cadence; forecasts derive from the same numerical model family that feeds the Forecast Icing Product (FIP) and the winds-temps-aloft suite.

The chart answers one question with surgical precision: at what altitude does the air pass through 0 deg C along my planned route? That answer feeds the next two questions -- where will I be relative to the freezing level on my filed altitude, and where is the icing risk likely to live? -- which is why this chart almost always pairs with FIP / CIP and AIRMET Zulu in any winter IFR briefing.

## When you read it

- **Preflight, every cold-season flight that touches IMC or cloud-piercing climbs and descents.** If freezing temps exist anywhere between the surface and your cruise altitude, the freezing-level chart belongs in the briefing pack.
- **Preflight for high-altitude summer flights too** -- the freezing level sits around 10,000 to 14,000 ft MSL even in midsummer over the northern half of the CONUS. Anyone planning cruise at or above that altitude through cumulus or stratiform cloud is in the icing-risk band.
- **Preflight for terrain flights.** A freezing level of 8,000 ft MSL is benign over the plains and a planning constraint in the Rockies. The chart shows MSL altitudes; you do the AGL conversion.
- **Pair with FIP / CIP.** The freezing-level chart shows you where the icing-eligible air starts; FIP / CIP show you the probability, severity, and SLD potential inside that volume. One without the other is half a picture.
- **Pair with AIRMET Zulu and any active SIGMETs** for the regulatory advisory layer.

What it decides:

- **Cruise altitude selection** in winter IFR. "File 6,000 or 8,000?" turns on whether the freezing level is above or below the filed altitude along the route.
- **Climb / descent profile** for terrain and cloud crossings -- how long am I in the freezing band, and is it above or below a layer of cloud?
- **Icing escape options** -- where is warm air and where is cold-dry air? The chart shows both the layer to escape upward through and the layer to escape downward into.

## How to read it

The product is a chart. The symbology is sparse on purpose; almost all of the information is in the contour labels and the inversion annotation.

| Layer / element          | What it shows                                              | How to read it                                                                                              |
| ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Lowest freezing contour  | Altitude of the lowest 0 deg C surface, MSL                | Contour label is in hundreds of feet MSL. `80` = 8,000 ft MSL. Typical contour interval is 4,000 ft.        |
| Highest freezing contour | Where an inversion exists, altitude of the upper 0 deg C   | Drawn as a second, distinct line style. Label is again hundreds of feet MSL. Present only where applicable. |
| Surface freezing area    | Region where the freezing level is at or below the surface | Shaded or labeled `SFC` / `0`. Inside this region the entire air column is sub-freezing.                    |
| Forecast valid time      | Analysis time or +3 / +6 / +12 hour forecast               | Picked from a tab or selector on the AWC page. The chart frame changes; the symbology does not.             |

You read the chart by:

1. Tracing your route across the chart and noting the lowest freezing contour at each end and in the middle.
2. Checking whether any surface-freezing area covers part of the route. If yes, the air column under that area is entirely sub-freezing at all altitudes from the surface up to the labeled isotherm.
3. Checking for the inversion / second-contour annotation along the route. If a highest freezing contour is drawn, an inversion exists -- there is warm air sandwiched between two cold layers.
4. Comparing your filed altitude (or candidate altitudes) against the contour altitudes you just read.
5. Scrubbing the forecast tabs (+3, +6, +12) to see how the freezing level moves through your departure-to-arrival window.

The chart is a planning surface, not an instrument readout. Contour spacing of 4,000 ft means a route crossing one contour passes through a 4,000-ft step in freezing-level altitude; expect smooth gradients in between.

## Annotated example(s)

### Example 1 -- Deep cold air mass over the Upper Midwest

A January morning. A continental arctic air mass has settled over the upper Midwest behind a southward-pushing front. The freezing-level chart for the current analysis shows:

- An `SFC` / `0` shaded region covering all of Minnesota, Wisconsin, the Dakotas, and northern Iowa. The entire air column in that region is sub-freezing from the ground up.
- A lowest freezing contour labeled `50` (5,000 ft MSL) running through northern Missouri and southern Illinois.
- A lowest freezing contour labeled `80` through Oklahoma and Arkansas.
- A lowest freezing contour labeled `100` (10,000 ft MSL) across central Texas.
- A lowest freezing contour labeled `140` (14,000 ft MSL) along the Gulf coast.
- No inversion contours anywhere on the chart -- the cold air mass is the entire troposphere up to the labeled isotherm.

You are filing IFR from KMSP (Minneapolis) to KDFW (Dallas-Fort Worth), 700 NM, planned cruise altitude 8,000 ft.

Decision walk-through: The first third of the route is under the `SFC` shading -- you will be in sub-freezing air at 8,000 ft, period. If KMSP departure has any IMC, you are climbing through icing-eligible cloud all the way to the top of the cloud deck. The middle third of the route crosses the `50` and `80` contours; somewhere south of the Missouri-Iowa border, 8,000 ft drops below the freezing level, and you are in warm air for the remainder of cruise. The southern third is comfortably below freezing level. The decision is not "cruise altitude" -- it is "how do I manage the icing-eligible northern leg." Options: file higher (above any cloud tops, if FIP shows clean air there); file lower (below the cloud base, if terrain and MEAs allow); delay until the cold air retreats; or accept the climb-through icing exposure with a deiced aircraft and a planned continuous climb. Cross-reference FIP / CIP for severity and SLD potential before locking the plan.

### Example 2 -- Warm-front overrunning with inversion (the freezing-rain setup)

A February afternoon. A surface warm front is approaching from the south; warm, moisture-laden air aloft is overrunning a shallow cold dome at the surface. The freezing-level chart shows two distinct contours stacked over the same area:

- Lowest freezing contour labeled `30` (3,000 ft MSL) -- the top of the sub-freezing surface layer.
- Highest freezing contour labeled `80` (8,000 ft MSL) -- the top of the warm overrunning layer; above this altitude the air is sub-freezing again.

The temperature profile along this column reads, from the surface up:

| Altitude (MSL) | Temperature                              |
| -------------- | ---------------------------------------- |
| Surface        | Below 0 deg C (cold dome at surface)     |
| 3,000 ft       | 0 deg C (lowest freezing-level contour)  |
| 3,000-8,000 ft | Above 0 deg C (warm overrunning layer)   |
| 8,000 ft       | 0 deg C (highest freezing-level contour) |
| Above 8,000 ft | Below 0 deg C again                      |

Decision walk-through: This is the classic freezing-rain setup. Precipitation falling out of the warm layer aloft is liquid (above 0 deg C), then re-freezes as it descends through the sub-freezing surface layer -- either as freezing rain on contact, or as ice pellets if it has time to refreeze before reaching the ground. The aviation hazard is the layer from the surface to roughly 3,000 ft MSL: large supercooled droplets, freezing on contact, defeating most ice-protection systems. SLD risk is high in this layer; FIP / CIP will almost certainly paint the SLD overlay on. Cruise at 6,000 ft MSL sits squarely in the warm layer between the two contours -- above 0 deg C, so the airframe is not collecting ice at altitude -- but climbing through 3,000 ft on departure and descending through 3,000 ft on arrival traverses the SLD layer. For a non-SLD-certified airframe (almost all piston aircraft), the climb and descent exposures alone are disqualifying. Even a known-icing-certified airframe should treat this as a hard decision: SLD on the approach phase, when the aircraft is configured, slow, and committed to descending, is the worst exposure case. Cross-reference FIP / CIP, AIRMET Zulu, and any PIREPs from aircraft that have flown the column recently. If the warm-overrunning pattern is intensifying, this is a delay or divert.

## Common gotchas

- **"Freezing level" means altitude where T = 0 deg C, not "altitude where icing occurs."** Icing requires liquid water at sub-freezing temperatures, which means cloud or precipitation in addition to cold air. A clear, dry day with a freezing level at 5,000 ft is not an icing day at 7,000 ft; the same altitude through stratus is.
- **With an inversion, the LOWEST freezing level is the BOTTOM of the freezing-rain layer**, not the top of the cold air. The cold air is below the lowest contour; the warm overrunning layer is between the contours; cold air resumes above the highest contour. Reading the lowest contour as "this is where cold ends" inverts the picture and misses the freezing-rain setup entirely.
- **Altitudes are MSL.** Over the plains a freezing level of 8,000 ft is workable for almost any aircraft; over the Rockies that same 8,000 ft MSL is below the terrain in many places. Convert to AGL for terrain and to flight level for cruise planning.
- **Forecast accuracy decays past 6 to 12 hours.** The +3 and +6 hour forecasts are tightly coupled to the analysis; the +12 hour is a planning hint, not a commitment. For a multi-hour cross-country, refresh the chart at fuel stops; don't trust an early-morning briefing to describe an afternoon picture.
- **A single contour does not describe a column.** The chart tells you the altitude of the 0 deg C isotherm; it does not tell you whether the air below is moist or dry, how thick any cloud layer is, or whether precipitation is reaching the ground. Pair with FIP / CIP, surface analysis, and area forecasts to get the full column.
- **The chart is CONUS.** Alaska, Hawaii, and oceanic routes use regional freezing-level products. The CONUS chart does not extend offshore beyond a narrow buffer.
- **Surface freezing areas are not "ground icing" warnings.** The `SFC` shading tells you the air column is sub-freezing from the ground up. Ground icing, frost, and runway contamination are surface-condition reports (METAR, NOTAMs, airport observations), not chart features.

## Triage

When you have 60 seconds with the freezing-level chart, your eyes go to four things in order:

1. **Trace your route.** Note the lowest freezing contour at departure, at midpoint, and at destination. Where does your filed altitude sit relative to each? The route changes the answer; one number for the whole route is rarely the right read.
2. **Check for surface-freezing shading along the route.** If any leg is under `SFC` / `0` shading, the air column in that region is fully sub-freezing -- climb-out and descent profiles all live in icing-eligible air if cloud is present.
3. **Look for a second contour (inversion annotation).** A highest freezing contour drawn alongside the lowest one is the freezing-rain / SLD setup. Pause and read the FIP / CIP SLD layer immediately; this is the highest-consequence pattern on the chart.
4. **Scrub the forecast tabs.** Does the freezing level rise or fall through your departure window? A 2,000-ft drop in the freezing level over 6 hours can put your filed altitude into icing-eligible air partway through the flight; an arrival timed for the trough of the freezing-level cycle is a different go/no-go from one timed for the peak.

The go/no-go drivers:

- **Inversion + SLD potential on the route at any altitude you will pass through** is a no-go for any non-SLD-certified aircraft.
- **Filed altitude sub-freezing along a route with stratiform cloud or precipitation** is a hard decision point: pair with FIP / CIP for severity, and with PIREPs for ground truth.
- **Filed altitude well above the freezing level along the route, with clear or dry air below it,** is the comfortable case -- the chart confirms there is no icing-eligible band in your column.

## Related products

- [icing-fip-cip](../icing-fip-cip/page.md) -- the icing field that lives above the freezing level; FZLVL says where the icing-eligible air starts, FIP / CIP grade what's in it.
- [airmet](../airmet/page.md) -- AIRMET Zulu carries the regulatory advisory for moderate icing and freezing levels; FZLVL is the spatial picture behind the Zulu text.
- [sigmet](../sigmet/page.md) -- SIGMETs flag severe icing; FZLVL sets the altitude context for any active severe-icing SIGMET on the route.
- [pirep](../pirep/page.md) -- pilot reports of cloud tops, icing, and observed freezing levels are the ground-truth check against the chart.
- [winds-temps-aloft](../winds-temps-aloft/page.md) -- the FB product gives point temperatures at standard altitudes; FZLVL is the contour view of the same temperature field.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Freezing Level chart section (format and interpretation, often grouped with the icing-products chapter).
- **AIM** -- 7-1-21 Icing (operational use of the freezing level as part of the icing decision).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapters 25 (Analysis) and 27 (Forecasts), Freezing Level sections (analysis and forecast graphics, paired with CIP / FIP).
- **aviationweather.gov/data/freezing** -- AWC product home; analysis plus +3, +6, +12 hour forecast tabs, contour overlay on a CONUS map.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the freezing level and its role in icing avoidance, see:

- [Freezing Level](../../../../knowledge/weather/freezing-level/node.md)
- [Icing Types and Avoidance](../../../../knowledge/weather/icing-types-and-avoidance/node.md)
