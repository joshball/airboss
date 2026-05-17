---
id: wx-ref-sigwx-prog
title: Significant Weather Prog (High Level) (SIGWX)
short_code: SIGWX
category: chart
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Significant Weather Prognostic Charts (High and Mid Level) section'
    note: 'Format, symbology, valid-time cadence, and altitude band for the SIGWX high-level prog issued by the World Area Forecast Centers.'
    verified: true
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Operational role of the SIGWX prog in international and high-altitude flight planning.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, High-Altitude Charts area (Significant Weather Prognostic Charts subsection)'
    note: 'Modern consolidated treatment of WAFC SIGWX outputs and how to read them.'
    verified: true
  - source: ICAO Annex 3
    section: 'Meteorological Service for International Air Navigation, WAFS appendix'
    note: 'International specification for World Area Forecast System products that underlies the SIGWX chart format.'
    verified: true
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - prog-chart
  - surface-analysis
  - convective-sigmet
  - sigmet
  - gfa
  - winds-temps-aloft
---

# Significant Weather Prog (High Level) (SIGWX)

> High-altitude significant weather forecast for international and turbine aviation: jet streams, tropopause heights, CB activity, turbulence and icing zones, volcanic ash, and tropical cyclones above FL250.

## What it is

The High-Level Significant Weather Prognostic Chart (SIGWX) is a forecast chart issued by the **World Area Forecast Centers (WAFCs)** under the ICAO World Area Forecast System (WAFS). The US WAFC is co-located with the Aviation Weather Center (AWC) in Kansas City; the second WAFC is at the UK Met Office in Exeter. The two centers cover the globe between them, and each issues SIGWX charts on a fixed schedule for fixed valid times.

The SIGWX high-level chart covers significant weather hazards in the altitude band **FL250 to FL630** -- the operating envelope of long-haul jet transport, business jets, and high-altitude turboprops. Each chart depicts the forecast atmosphere over a continental or oceanic region at a single valid time; the typical issuance cycle is **4x daily** with valid times at 00, 06, 12, and 18 UTC.

The chart depicts, all on one page:

- **Jet streams** -- as arrows with core wind speeds and the flight level of the core.
- **Tropopause heights** -- as boxed numbers in hundreds of feet (e.g. `390` = FL390).
- **Cumulonimbus (CB) activity** -- as scallop-edged polygons annotated with coverage (ISOL / OCNL / FRQ), top FLs, and severity hints (embedded, frequent).
- **Turbulence zones** -- as zigzag-edged polygons (or zigzag lines for boundaries), labeled with severity (MOD / SEV) and altitude band.
- **Icing zones** -- as inverted-triangle polygons with severity and altitude band (used less than turbulence because high-altitude icing is rarer than CAT).
- **Volcanic ash** -- as a plume polygon outlined with the volcano symbol, tagged with the ash plume's altitude band.
- **Sandstorms and dust storms** -- as polygons over arid regions when the storm reaches FL250+.
- **Tropical cyclones** -- as the standard cyclone symbol at the forecast position, with the storm's name and intensity.

The chart is a forecast product, not an observation. It is the high-altitude counterpart to the surface prog (see [prog-chart](../prog-chart/page.md)) -- a snapshot of what the model and forecaster expect at the valid time. Verification comes from PIREPs, satellite, and en-route observations.

## When you read it

- **Long-haul, high-altitude flight planning.** Airline dispatchers, business jet pilots, and Part 121 / 135 turbojet operators read the SIGWX prog as part of the international flight-plan package. The chart is essentially mandatory reading on any flight that crosses an ocean or operates above FL250 for any sustained portion.
- **Tactical pre-departure brief.** Pull the SIGWX chart whose valid time brackets your flight window, find your route on the map, and look at the jet stream, CB polygons, and CAT zones crossing the planned track.
- **Limited GA relevance.** Most GA flying happens below FL250. SIGWX is included in the catalog because pilots transition into turbine and high-altitude operations -- knowing how to read SIGWX is a precursor skill to airline / corporate flying.

What it decides:

- **Cruise altitude selection.** A jet stream sitting on top of your filed route is a tailwind opportunity *or* a turbulence trap, depending on where the core is and which side you're on. SIGWX shows both, and the altitude planning question becomes "ride the south side at FL360 or detour north at FL340?"
- **CB avoidance routing.** A polygon of ISOL embedded CB tops FL420 over Africa, the Caribbean, or the South Atlantic is a route-altering signal. The SIGWX shows the area; the planner uses it to file around the worst of it.
- **CAT exposure.** Areas of MOD or SEV CAT (clear-air turbulence) along the jet stream boundary drive seatbelt sign discipline, ride-quality discussion with the cabin, and sometimes altitude requests in flight.
- **Volcanic-ash diversion planning.** Volcanic plumes show up on SIGWX before they show up in NOTAMs (because the WAFC issues both); a SIGWX showing ash over your planned track is a re-route trigger.

What it replaces or supplements: SIGWX is the upper-air strategic forecast for hazards at jet altitudes. It sits alongside the surface prog (synoptic story at the surface), Convective SIGMETs (tactical convective hazards in the next 2 hours), SIGMETs (severe turbulence / icing / ash, all altitudes), and the winds-and-temps-aloft chart (winds at specific FLs along your route).

## How to read it

The SIGWX is a chart product, not encoded text. Reading it is a matter of walking the symbol classes in order, then triaging which features intersect your route at your altitude.

### Symbology key

| Symbol                                            | Meaning                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Heavy arrow (single hash on tail)                 | Jet stream with core speed greater than 80 KT but less than 120 KT. Hash marks indicate speed band; arrow points downwind.            |
| Heavy arrow (double hash on tail)                 | Jet stream with core speed greater than 120 KT. The strongest jet streams; the highest CAT risk along their flanks.                   |
| `FL360` (along jet arrow)                         | Flight level of the jet core at that point on the arrow. The jet altitude varies along its length; multiple FL labels are common.     |
| `380 KT` or similar (along jet arrow)             | Wind speed at the jet core, in knots.                                                                                                 |
| Boxed number (e.g. `390`)                         | Tropopause height in hundreds of feet at that point on the chart. `390` reads as FL390. Heights are interpolated between data points. |
| Scallop-edged polygon                             | Area of cumulonimbus (CB) activity. The polygon encloses where CB is forecast, not where individual cells will be.                    |
| `ISOL` (in CB polygon)                            | Isolated CBs -- less than 50% area coverage, individual cells separated.                                                              |
| `OCNL` (in CB polygon)                            | Occasional CBs -- 50% to 75% coverage, well-separated clusters or lines.                                                              |
| `FRQ` (in CB polygon)                             | Frequent CBs -- greater than 75% coverage, little separation. Often a line or solid area of convection.                               |
| `EMBD` (in CB polygon)                            | Embedded CBs -- buried in cloud, not visible from the cockpit until on top.                                                           |
| `XXX/YYY` (CB polygon altitude)                   | CB tops / bases as FLs. `XXX` = top, `YYY` = base. A polygon reading `450/200` means tops to FL450, bases at FL200.                   |
| Zigzag-edged polygon (or zigzag boundary line)    | Area of turbulence at the labeled severity and altitude band.                                                                         |
| `MOD` (in turbulence polygon)                     | Moderate turbulence forecast in the area.                                                                                             |
| `SEV` (in turbulence polygon)                     | Severe turbulence forecast in the area. SEV CAT polygons get the most attention -- they are route-altering.                           |
| `FL340/FL400` (in turbulence polygon)             | Altitude band of the forecast turbulence: base FL / top FL.                                                                           |
| Inverted-triangle polygon                         | Area of icing at altitude. Less common on high-level SIGWX than on mid-level charts.                                                  |
| `MOD ICE` / `SEV ICE` (in icing polygon)          | Severity of icing forecast within the polygon.                                                                                        |
| Volcano symbol (stylized erupting volcano)        | Active volcano producing an ash plume at altitude. Tagged with the plume's forecast altitude and extent.                              |
| Tropical cyclone symbol (open spiral with center) | Forecast position of a tropical cyclone (hurricane, typhoon, cyclone), with the storm name and pressure / wind intensity.             |
| Sandstorm symbol                                  | Dust or sand reaching FL250+. Tagged with altitude band.                                                                              |

### Reading order

1. **Find the jet streams.** Single-hash vs double-hash, note the FL of each core. The strongest jet stream is the dominant feature on most high-level charts.
2. **Read the tropopause.** Boxed numbers across the chart. A tropopause well above your filed altitude is benign; a tropopause near or below your filed altitude means you may be cruising in stratospheric stability, with different turbulence and icing behavior than tropospheric cruise.
3. **Scan for CB polygons.** Find every scallop-edged area. Read the coverage code (ISOL / OCNL / FRQ), the altitude band (top / base), and whether they're embedded. Note which polygons intersect your route.
4. **Audit CAT zones.** Zigzag-edged polygons, especially anything tagged SEV. Most CAT lives along the flanks of the jet stream -- look for zigzag polygons adjacent to or just outside the jet arrows.
5. **Note other hazards.** Volcanic ash, tropical cyclones, sandstorms, icing zones. These are usually fewer in number but are route-altering when they appear.
6. **Cross-check valid time.** The chart is valid at a specific UTC. If your flight is hours away from that valid time, look at the SIGWX charts for adjacent cycles too.

## Annotated example(s)

### Example 1 -- North Atlantic SIGWX, polar-front jet at FL360

The SIGWX chart, valid 12 UTC, covers the North Atlantic from the eastern seaboard of the US across to western Europe. The dominant feature is a heavy double-hash arrow sweeping from the Gulf of Maine northeast across the Grand Banks, threading just south of Greenland's southern tip, and continuing across the Atlantic to a point west of Ireland where it curves north into the Norwegian Sea. The arrow is labeled `FL360` at the western end, `FL340` over the Grand Banks, and `FL380` near Ireland, with core wind speeds of `140 KT`, `160 KT`, and `120 KT` at those points. This is a classic polar-front jet at a typical winter strength.

North of the jet, between the jet arrow and Greenland, sits a zigzag-edged polygon labeled `MOD CAT FL320/FL400`. The polygon hugs the north (cold) side of the jet for most of its length over the open ocean. South of the jet, near the New England departure region, a smaller zigzag polygon is labeled `MOD CAT FL340/FL380` -- weaker and narrower than the polygon to the north.

Scattered CB symbols appear in a scallop-edged polygon over the eastern seaboard from the Carolinas through New Jersey, labeled `ISOL CB 380/200`. The polygon is small and the coverage code is isolated -- frontal convection ahead of an approaching cold front, with tops well above any flight's cruise altitude but isolated cells.

Boxed tropopause numbers across the chart read `390` over the eastern US, `360` over the central North Atlantic (lower over the cold air), and `380` again near western Europe. The tropopause dips with the jet stream and the polar air mass behind it.

How a Boston-to-London cruise crew reads this picture:

- The jet stream is essentially along the great-circle track. Filing FL360 puts the aircraft *in* the jet core for much of the crossing -- a strong tailwind, but the closest position to the jet shear.
- The MOD CAT polygon is on the *north* (cold) side of the jet at FL320 to FL400. Filing FL360 northbound of the jet axis exposes the aircraft to the polygon for hours.
- The safer ride is to file FL340 on the south (warm) side of the jet axis -- still tailwind, smaller CAT polygon, narrower altitude band.
- The CB polygon over the New Jersey departure area is ISOL with tops at FL380 -- climb out through it but expect some cell deviation. Not route-altering.
- The tropopause at FL360 over the central Atlantic means cruising near or above the tropopause -- expect different turbulence character (more shear-driven, less convective) than over the eastern US.

The synthesizing sentence: "Strong polar-front jet along the great-circle, MOD CAT on the cold side at filed altitude -- request a south-of-jet-axis ride at FL340 instead of FL360 for the cabin's sake, accept a slightly weaker tailwind."

### Example 2 -- Trans-Pacific SIGWX with a typhoon and a curved subtropical jet

The SIGWX chart, valid 06 UTC, covers the North Pacific from Japan east across to the Pacific Northwest. The dominant feature in the western quadrant is a tropical-cyclone symbol centered just south of Okinawa, tagged `TYPHOON SAOLA` with pressure `935 hPa` and surface winds `120 KT`. The cyclone symbol is a spiral with a clear center, and the SIGWX polygon enclosing the storm is scallop-edged with the label `FRQ EMBD CB 540/SFC` -- frequent embedded cumulonimbus from the surface to FL540. Tops are well above any flight's cruise altitude; bases are at the surface.

A double-hash jet arrow enters the chart from the west over central China, curves around the northern flank of the typhoon (an obvious deflection north of the storm center), and continues east across the central Pacific at roughly 40 N. The arrow is labeled `FL340` over China, `FL380` over the Sea of Japan north of the typhoon, and `FL360` mid-Pacific, with core speeds of `160 KT` rising to `200 KT` over the Sea of Japan -- the typhoon outflow is enhancing the jet -- before easing to `140 KT` mid-Pacific.

Two CAT polygons sit along the jet flanks: a `SEV CAT FL340/FL400` polygon over the Sea of Japan immediately north of the typhoon (the high-shear region where typhoon outflow meets the polar jet), and a `MOD CAT FL320/FL400` polygon stretching east across the central Pacific along the south side of the jet axis.

Tropopause heights read `540` near the typhoon (extremely high tropopause -- typical of tropical convection), `360` over the polar air north of the jet, and `400` mid-Pacific. The tropopause is dramatically distorted by the storm.

How a Tokyo-to-Los Angeles dispatcher reads this picture:

- The typhoon's CB shield (`FRQ EMBD CB 540/SFC`) is a no-go. No filed route penetrates the polygon at any altitude up to FL540.
- The jet stream over the Sea of Japan is at FL380 with core 200 KT and SEV CAT in the FL340 / FL400 band immediately north. The northbound climb-out from Tokyo would normally ride that jet east -- with SEV CAT in the way, the dispatch options are to climb to FL400 or above the CAT polygon, file a route south to avoid the typhoon flanks entirely (longer track but smoother), or accept the rough ride in exchange for the tailwind.
- Mid-Pacific, the MOD CAT polygon along the south side of the jet at FL320 / FL400 means filed cruise of FL340 sits *in* the polygon. Climbing to FL400 puts the aircraft on top of the CAT polygon and closer to the jet core for tailwind.
- The very high tropopause near the typhoon (FL540) confirms the depth of the convective shield -- this is one of those situations where every available altitude is in the storm.

The synthesizing sentence: "Typhoon Saola is a southern-route diversion, not a thread; the jet's outflow has spiked SEV CAT north of the storm and MOD CAT for hundreds of miles east -- file high and south of the jet axis, accept a slower track, and brief the cabin for the CAT band on climb-out."

## Common gotchas

- **All altitudes on SIGWX are flight levels (FL), not MSL or AGL.** A `380` boxed number is FL380. A CB polygon labeled `450/200` is tops FL450, bases FL200. There is no AGL on a high-level chart; the chart starts at FL250.
- **CB polygons enclose AREAS of CB, not individual cells.** A `FRQ EMBD CB 450/200` polygon does not mean every square mile is a cell -- it means within that area, expect frequent CB occurrence. Cells are below the chart's resolution; pair with NEXRAD, satellite, and onboard radar for cell-by-cell picture.
- **ISOL / OCNL / FRQ are coverage descriptors, not severity descriptors.** An ISOL CB cell can still have an FL450 top and produce severe turbulence in the cell -- the descriptor is about how many cells exist, not how bad each one is. The altitude band is the severity proxy.
- **Tropopause heights are interpolated between sparse data points.** The boxed numbers are forecast values at the chart's gridpoints, not measurements at every position. The actual tropopause in the air can be 2,000 to 4,000 ft off the charted value.
- **SIGWX is forecast, not observed.** Pair with PIREPs and satellite imagery to verify what the chart says is happening. A SIGWX MOD CAT polygon with zero PIREPs of bumpy rides through it may be a model that ran hot; a polygon with three PIREPs of SEV is real.
- **Jet stream arrows are simplified.** The jet itself is a 3D ribbon with multiple cores and varying altitude; the arrow on the chart is a 2D centerline at one or two representative altitudes. The actual jet may meander 50 to 100 NM either side of the drawn line, and the core altitude may vary by several thousand feet.
- **WAFC charts use ICAO conventions, which differ slightly from US-only AWC products.** Unit conventions, polygon styles, and altitude bands follow ICAO Annex 3 / WAFS specifications. Crews flying domestic US routes mostly see AWC-styled products; the moment the flight crosses an ocean, ICAO-styled SIGWX charts take over.
- **The valid time on the chart is a single instant, not a window.** Each chart is valid at one specific UTC. If your flight is mid-cycle, look at both the chart whose valid time is just past and the chart whose valid time is just ahead; trends between them are part of the read.

## Triage

When you have 60 seconds with a SIGWX chart, your eyes go to four things:

- **Is the jet stream along my route, and which side of it am I on?** Jet stream position vs filed track determines tailwind / headwind. The flank you're on (cold vs warm side) determines CAT risk -- the cold side of the jet typically holds the bigger CAT polygons.
- **Do any CB polygons cross my route at my altitude?** A `FRQ EMBD CB` polygon at your cruise altitude is a re-route. An `ISOL CB` polygon with tops below your cruise altitude is a non-event.
- **Are there CAT zones at my filed altitude?** Look at the altitude band on every turbulence polygon along the route. A polygon at FL320 / FL400 with you cruising at FL340 is hours of bumps; the same polygon with you at FL420 is irrelevant.
- **Is the tropopause near my cruise altitude?** A tropopause within a few thousand feet of cruise changes the character of expected weather -- stratospheric cruise is smoother on average but the boundary zone is shear-prone.

The route-altering signals:

- **A volcanic-ash polygon across the planned track** is an immediate re-route trigger -- ash engine damage is catastrophic.
- **A tropical cyclone on the route** is a re-route at minimum; SIGWX usually shows the closed CB shield, which is impenetrable at jet altitudes.
- **A SEV CAT polygon at the planned cruise altitude** drives an altitude request or a track shift to put the polygon off the route.
- **A FRQ EMBD CB polygon with tops above the service ceiling** is a south-or-north detour decision -- you cannot top frequent embedded convection at FL450+ in a typical jet.

GA pilots usually look at SIGWX and think "all of this is above me." That's right for most piston flying -- but it's the wrong instinct for the day you climb into a turbocharged piston at FL250+, a turboprop at FL280, or a turbine type at FL350+. The chart shows the operating environment of the next aircraft up.

## Related products

- [prog-chart](../prog-chart/page.md) -- surface prognostic chart; the synoptic forecast at the surface that complements SIGWX's upper-air forecast.
- [surface-analysis](../surface-analysis/page.md) -- the current surface snapshot the SIGWX upper-air forecast is built on top of.
- [convective-sigmet](../convective-sigmet/page.md) -- short-fuse convective advisory; the tactical 2-hour follow-up to a SIGWX CB polygon you're now flying through.
- [sigmet](../sigmet/page.md) -- in-flight advisory for severe turbulence, severe icing, ash, and other all-altitude hazards; SIGMETs are the in-flight tactical version of what SIGWX forecasts strategically.
- [gfa](../gfa/page.md) -- Graphical Forecasts for Aviation, the surface-to-FL480 hazards layer for US airspace; overlap with SIGWX in the FL250 to FL480 band.
- [winds-temps-aloft](../winds-temps-aloft/page.md) -- specific wind and temperature forecasts at jet altitudes along the route; pair with SIGWX's jet-arrow placement to get the actual wind component on track.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Significant Weather Prognostic Charts (High and Mid Level) section. Authoritative format, symbology, and valid-time cadence for SIGWX products.
- **AIM 7-1** -- National Weather Service Aviation Products. Operational role of SIGWX in international and high-altitude flight planning.
- **FAA-H-8083-28** -- Aviation Weather Handbook, High-Altitude Charts area. Modern consolidated pilot-pitch reference for reading SIGWX charts.
- **ICAO Annex 3** -- Meteorological Service for International Air Navigation, WAFS appendix. International specification for World Area Forecast System products that the SIGWX chart format implements.
- Service docs: [aviationweather.gov/wafs](https://aviationweather.gov/wafs) for the US WAFC SIGWX charts; the UK WAFC equivalent at the Met Office for the other half of global coverage.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the in-flight advisory family SIGWX feeds into (SIGMETs for severe turbulence, icing, ash, and convective hazards), see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md) -- the advisory ladder that turns SIGWX-forecast hazards into in-flight warnings.
