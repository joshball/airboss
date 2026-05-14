---
id: wx-ref-g-airmet
title: Graphical AIRMET (G-AIRMET)
short_code: G-AIRMET
category: hazard-advisory
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: In-flight Aviation Weather Advisories
    note: G-AIRMET subsection within the In-flight Aviation Weather Advisories chapter; subtype taxonomy and time-slice structure.
  - source: AIM
    section: 7-1-6
    note: Inflight Aviation Weather Advisories -- the G-AIRMET as the graphical counterpart to the WA text bulletin.
  - source: FAA-H-8083-28
    section: Chapter 26
    note: Aviation Weather Handbook, Advisories chapter; G-AIRMET described alongside AIRMET / SIGMET / CWA.
related_knowledge_nodes:
  - wx-product-airmets
related_products:
  - airmet
  - sigmet
  - convective-sigmet
  - gfa
  - pirep
---

# Graphical AIRMET (G-AIRMET)

> The graphical, polygon-based, time-sliced forecast of AIRMET-class hazards. Same hazards as the text AIRMET (Sierra / Tango / Zulu), but split into finer subtypes, drawn as polygons, snapped to forecast times at 3-hour intervals out to 12 hours, with an outlook layer beyond.

## What it is

The G-AIRMET is the Aviation Weather Center's graphical forecast of AIRMET-class hazards. It covers the same three hazard families as the text [AIRMET](../airmet/page.md):

- **Sierra** -- IFR conditions and mountain obscuration.
- **Tango** -- turbulence, strong surface winds, and non-convective low-level wind shear (LLWS).
- **Zulu** -- icing and the freezing level.

Where the text AIRMET bundles all of "Sierra" or all of "Tango" into a single hazard line per polygon, the G-AIRMET breaks each letter into separate subtypes, each rendered as its own polygon layer. Sierra splits into IFR and mountain obscuration. Tango splits into turbulence, strong surface winds, and LLWS. Zulu splits into icing and freezing level. The result is a stack of layers a pilot can toggle independently.

Time is the second axis. The AWC issues a fresh G-AIRMET every **6 hours** at **0245Z, 0845Z, 1445Z, and 2045Z**. Each issuance contains forecast polygons snapped to **four time slices**: the **00**, **03**, **06**, and **09** hour points relative to issuance, plus a **12-hour outlook** layer that describes forecast intent beyond the regular valid period. The slider on aviationweather.gov/gairmet (and on every EFB that consumes the product) scrubs between these slices; polygons appear, grow, shrink, and disappear as the forecast evolves.

The text AIRMET and the G-AIRMET coexist. Both products are issued on the same cycle and cover the same hazards. The G-AIRMET is the modern primary picture used in EFB-driven briefings; the text WA bulletin remains the regulatory product cited in 14 CFR §91.103.

## When you read it

- **Preflight** -- pair the G-AIRMET with the text [AIRMET](../airmet/page.md). The text bulletin gives you the hazard prose; the G-AIRMET gives you the polygon shape, the time evolution, and the subtype breakdown. For a long cross-country, the G-AIRMET is usually the first picture pulled because the time slider lets you see what the hazards look like at departure, en route, and arrival, not just at issuance.
- **En route** -- limited. The product refreshes every 6 hours, not continuously; once airborne the picture is largely fixed until the next cycle. Use PIREPs and current observations to truth-up. The G-AIRMET on the EFB at hour 4 of a long flight is showing the same polygons it showed at hour 1; the next issuance is what changes the picture.

What it decides:

- **Time-of-day routing** -- the 03 / 06 / 09 slices answer "what will it look like when I get there?", not just "what is it now?"
- **Subtype-driven altitude / route** -- if Zulu icing covers the route but Zulu freezing-level toggles show the layer is high, the altitude question changes. Tango toggling between turbulence and LLWS distinguishes "rough en route" from "rough on approach."
- **Whether the outlook extends past the valid period** -- the 12-hour outlook layer is forecast intent, not an active advisory, but it tells you whether to expect a clean evening if you delay.

What it replaces or supplements: the G-AIRMET is the time-sliced spatial layer of the briefing pack. It sits alongside the text AIRMET (regulatory), the [GFA](../gfa/page.md) (broader spatial briefing with ceilings/visibility), the icing FIP/CIP, the turbulence GTG, and PIREPs.

## How to read it

The G-AIRMET is a chart product viewed in a web app or EFB, not a parsed text bulletin. The primary controls are the time slider, the layer toggles, the legend, and the polygon click-through.

### Time slider

| Slice         | Meaning                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| **00**        | Forecast valid at issuance time -- the "now" picture as the AWC drew it.                |
| **03**        | Forecast valid 3 hours after issuance.                                                  |
| **06**        | Forecast valid 6 hours after issuance (end of the regular AIRMET valid window).         |
| **09**        | Forecast valid 9 hours after issuance.                                                  |
| **12 outlook** | Outlook layer, 12 hours beyond issuance. Forecast intent, not an active advisory.       |

Polygons are time-stamped to a slice. They do **not** represent continuous validity between slices. A polygon at the 03 slice and the same-shaped polygon at the 06 slice are two separate forecast snapshots; the forecast between them is interpolated by the reader's judgment, not by the product.

### Layer toggles

Each AIRMET letter splits into independently toggleable subtypes:

| Parent     | G-AIRMET subtype     | Hazard                                                                              |
| ---------- | -------------------- | ----------------------------------------------------------------------------------- |
| **Sierra** | IFR                  | Ceilings below 1,000 ft AGL and/or visibility below 3 SM over more than 50% of area. |
| **Sierra** | Mountain obscuration | Mountains hidden by clouds, precipitation, or restrictions to visibility.           |
| **Tango**  | Turbulence           | Moderate turbulence at the listed altitude band.                                    |
| **Tango**  | Strong surface winds | Sustained surface winds at or above 30 KT.                                          |
| **Tango**  | LLWS                 | Non-convective low-level wind shear.                                                |
| **Zulu**   | Icing                | Moderate icing within the listed altitude band.                                     |
| **Zulu**   | Freezing level       | Forecast freezing-level altitude(s) across the polygon.                             |

Each subtype has its own polygon set per time slice. Read by toggling one subtype at a time so the map doesn't drown in overlapping fills.

### Polygon click-through

Clicking a polygon opens the hazard detail: hazard text (mirroring what the parallel text AIRMET would say for that condition), the altitude band when applicable (e.g. icing between FRZLVL and FL180), motion if forecast, and the underlying issuance time. The polygon's shape and time-slice tag, together with this detail, give the same operational read as a text AIRMET polygon plus its conditions block.

### Outlook layer

The 12-hour outlook is rendered as a separate, often differently-styled polygon set. It tells you "we expect these conditions in this area 12 hours from issuance" without committing to the same precision as the active slices. Treat outlook polygons as planning context, not as flight inputs at face value; they're the forecaster's intent.

## Annotated example(s)

### Example 1 -- Pacific Northwest morning, Sierra IFR stepping inland with Zulu icing aloft

Setting: 1445Z issuance, mid-winter. A trough is sliding east through the Pacific Northwest. You're planning a 1700Z departure from KSEA to KGEG (Spokane) at 9,000 ft.

Pull aviationweather.gov/gairmet. Default load shows the 00 slice with all layers stacked.

**Toggle off everything except Sierra IFR.** The 00 slice shows a Sierra IFR polygon that hugs the western Washington coast and the Puget Sound lowlands, with another polygon offshore. Step the slider to **03** (forecast valid 1745Z, around the time you'd be airborne). The IFR polygon has pushed inland: it now covers western Washington up to the Cascade crest. Step to **06** (forecast valid 2045Z, near your ETA). The polygon has crossed the Cascades and now sits over the eastern Washington plateau, including KGEG. Step to **09**. The polygon is still there; it has thickened, not cleared. The 12 outlook layer shows the same general area, still IFR.

The Sierra IFR story: low ceilings are not a Seattle problem this morning, they're a Spokane problem by arrival. You'll be flying into the weather, not out of it. The outlook says it doesn't clear by evening.

**Toggle Sierra IFR off, Sierra mountain obscuration on.** A second polygon at the 00 slice sits over the Cascade crest. Step to 03 / 06 / 09 -- the mountain obscuration polygon is stable across the slices, sitting on the Cascades the entire day. VFR-over-the-top is not an option through the pass; the mountains are in cloud all day.

**Toggle Zulu icing on.** A Zulu icing polygon covers the same western Washington area at 00, with altitude band labeled FRZLVL to FL180. Step to 03 / 06. The icing polygon has moved inland with the IFR polygon, now covering the Cascades and the eastern plateau. Click a polygon: freezing level 4,000-6,000 ft MSL across the polygon. Your planned 9,000 ft cruise sits squarely in the icing layer.

**Toggle Zulu freezing level on.** Freezing-level contours confirm 040 along the coast rising to 060 east of the Cascades. The icing band has real depth.

Operational read: this flight is in forecast moderate icing in IFR conditions across the whole route at your planned altitude, with the outlook saying it persists. For a non-deiced piston single, this is "don't go this morning." For a deiced or non-piston aircraft, the call is "fly through, file an altitude that gets you out of the layer, plan a no-icing alternate." The G-AIRMET's value here is the time evolution: looking at the 00 slice alone, KGEG looks fine; the 06 slice tells the real story.

### Example 2 -- Spring afternoon, Tango turbulence expanding behind a Plains cold front

Setting: 1445Z issuance, mid-spring. A cold front pushed through the central Plains overnight and is now east of the Mississippi. Strong post-frontal northwest flow aloft is forecast to build through the afternoon. You're planning a 1900Z departure KMCI to KICT (Wichita) at 8,000 ft.

Pull aviationweather.gov/gairmet.

**Toggle off everything except Tango turbulence.** The 00 slice shows a small Tango turbulence polygon over western Kansas and eastern Colorado, altitude band labeled SFC to FL180. Step to **03** (1745Z). The polygon has grown east; it now covers most of western and central Kansas including the area between KMCI and KICT. Step to **06** (2045Z, near your arrival). The polygon now covers eastern Kansas as well -- the whole route is in moderate turbulence. Step to **09**. The polygon is still there, slightly broader, still SFC to FL180.

The Tango turbulence story: it's not bad now, but it's building all afternoon as the post-frontal flow accelerates. By the time you arrive at KICT, the whole en-route segment is in forecast moderate turbulence at every altitude up to FL180.

**Toggle Tango turbulence off, Tango strong surface winds on.** The 00 slice shows no strong-surface-winds polygon. Step to 03, 06. At 06, a polygon appears over far western Kansas with sustained surface winds at or above 30 KT. KICT is not in that polygon, but it's adjacent. Click for detail -- the polygon edge clips airports just west of your destination.

**Toggle Tango LLWS.** No LLWS polygon on the route at any slice. Good.

**Toggle Sierra and Zulu (sanity check).** Sierra (IFR / mountain obscuration) -- nothing in the area, this is a post-frontal clear-and-windy day. Zulu icing -- a polygon over the upper Midwest but not over Kansas. Freezing level is high (above 12,000 ft).

Operational read: VFR is workable, IMC and icing aren't issues, but the flight is in growing forecast moderate turbulence at every altitude through your arrival. KICT's surface winds may be at the AIRMET threshold by 06. The G-AIRMET's value here is showing the **growth** of the Tango turbulence polygon across the slices: at issuance it's a small western-Kansas polygon, by your arrival it covers the entire route. A pilot reading only the 00 slice would underestimate the en-route ride; the 06 slice is the one that matters.

## Common gotchas

- **G-AIRMET subtypes are finer than the parent text AIRMET.** Sierra (text) -> Sierra IFR + Sierra mountain obscuration (graphical). Tango (text) -> Tango turbulence + Tango strong surface winds + Tango LLWS (graphical). Zulu (text) -> Zulu icing + Zulu freezing level (graphical). A text AIRMET that says "Sierra for IFR and mountain obscuration" maps to two separate G-AIRMET layers. Don't expect them to overlap perfectly; the graphical product can draw them as different polygons because they describe different conditions.
- **Time slices, not continuous validity.** Polygons are forecast snapshots at the 00 / 03 / 06 / 09 hour points. The product does not claim a polygon is valid between slices. Scrub the slider; don't assume one slice's polygon covers the gap to the next.
- **Outlook polygons are forecast intent, not active advisories.** The 12-hour outlook layer is rendered separately and tells you what the forecaster expects beyond the regular valid window. It carries less weight than the 00-09 slices. Read it for planning context; don't quote it as if it were a current advisory.
- **The text AIRMET remains the regulatory product.** 14 CFR §91.103 preflight requirements reference the WA bulletin. The G-AIRMET is the primary picture in modern briefings, but the text product is the one cited in regulation. Both should be reviewed; neither replaces the other.
- **Layer toggles default to noisy.** Opening aviationweather.gov/gairmet typically shows every subtype stacked on the map. The disciplined read is one subtype at a time. Stacking everything at every time slice produces a wall of polygons that buries the signal.
- **Subtype-by-letter, not letter-only.** Don't think "Tango is on, so it's rough" -- read which Tango subtype is on. Tango turbulence over my route at my altitude is a ride question. Tango strong surface winds at my destination is a crosswind question. Tango LLWS on the approach is a wind shear question. They're different decisions and different mitigations.
- **Below FL180.** Like the text AIRMET, the G-AIRMET covers below FL180. Anything significant above that is SIGMET territory.

## Triage

When you have 60 seconds with the G-AIRMET, the workflow is:

1. **Scrub the time slider to your departure window** -- 03 if you're going within a few hours, 06 if mid-afternoon. The 00 slice is rarely the slice that matters; it's where the map opens.
2. **Toggle Sierra first.** Sierra (IFR + mountain obscuration) is the VFR / IFR / no-go driver. If a Sierra polygon sits on the route at your time, decide IFR / wait / cancel before touching the other layers.
3. **Toggle Tango by altitude.** Tango turbulence at your cruise altitude is a ride question. Tango strong surface winds at the destination is a crosswind question. Tango LLWS is an approach question. Pick the subtype your decision needs.
4. **Toggle Zulu by altitude and capability.** Zulu icing in your cruise band in a non-deiced aircraft is the answer. Cross-check Zulu freezing level to see how thick the layer is and where the top might be.
5. **Step to your ETA slice** and repeat. The forecast at arrival is usually different from the forecast at departure; the time slider is the whole point of the product.
6. **Glance at the 12-hour outlook** only after deciding on the active slices. The outlook is context, not decision input.

The re-plan trigger: polygon over my route, at my altitude, at my arrival window -> re-plan or don't go.

## Related products

- [airmet](../airmet/page.md) -- the text WA bulletin that the G-AIRMET parallels. Same hazards, same valid times, same cycle; text remains the regulatory product.
- [sigmet](../sigmet/page.md) -- next severity tier up; significant to all aircraft. Separate text product, no graphical equivalent in the AIRMET-letter sense.
- [convective-sigmet](../convective-sigmet/page.md) -- thunderstorm-specific SIGMET. Convection above threshold skips AIRMET / G-AIRMET entirely.
- [gfa](../gfa/page.md) -- Graphical Forecasts for Aviation, the broader spatial briefing layer that displays G-AIRMET polygons alongside ceilings, visibility, and surface analysis.
- [pirep](../pirep/page.md) -- pilot reports, the truth-up. Use PIREPs to validate whether the G-AIRMET polygons are verifying.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, In-flight Aviation Weather Advisories chapter (G-AIRMET subsection: subtype taxonomy, time-slice structure, relationship to text AIRMET).
- **AIM** -- 7-1-6 Inflight Aviation Weather Advisories (the G-AIRMET as graphical counterpart to the WA text bulletin; same hazard families).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 26 Advisories (G-AIRMET described alongside AIRMET / SIGMET / CWA).
- **aviationweather.gov/gairmet** -- AWC product home; time slider, layer toggles, polygon click-through, outlook layer.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the AIRMET family alongside the SIGMETs, see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md)
