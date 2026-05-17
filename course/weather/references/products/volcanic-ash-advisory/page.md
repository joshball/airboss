---
id: wx-ref-volcanic-ash-advisory
title: Volcanic Ash Advisory (VAA)
short_code: VAA
category: hazard-advisory
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, In-flight Aviation Weather Advisories -- Volcanic Ash Advisory'
    note: 'Format spec for VAA text bulletin and graphic, VAAC responsibilities, pairing with the VA SIGMET.'
    verified: true
  - source: AIM
    section: '7-1-15'
    note: 'Volcanic Ash, Smoke Plumes, and the Volcanic Ash Forecast Transport and Dispersion (VAFTAD) framework.'
    verified: false
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Volcanic Ash chapter (Hazards)'
    note: 'Engine and airframe damage mechanisms, encounter precedents, pilot procedures.'
    verified: true
  - source: ICAO Annex 3
    section: 'Meteorological Service for International Air Navigation, Volcanic Ash Watch'
    note: 'International framework establishing the nine VAACs and the VAA product.'
    verified: true
  - source: aviationweather.gov
    section: '/vaa'
    note: 'Service page with current advisories, graphical overlay, and bulletin archive.'
    verified: true
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - sigmet
  - convective-sigmet
  - surface-analysis
  - satellite
  - weather-tfr
---

# Volcanic Ash Advisory (VAA)

> A Volcanic Ash Advisory Center (VAAC) bulletin describing the observed position, altitude, and forecast 6/12/18-hour motion of a volcanic ash cloud. Advisory, not directive: ATC providers issue the paired Volcanic Ash SIGMET that actually routes traffic.

## What it is

A Volcanic Ash Advisory (VAA) is a text-plus-graphic bulletin issued by one of nine global Volcanic Ash Advisory Centers (VAACs) under the ICAO Annex 3 framework. Each VAAC owns a geographic area of responsibility and issues advisories whenever a volcano in that area is erupting or producing an ash cloud that could affect aviation.

The two VAACs relevant to US operations:

- **Washington VAAC** -- co-located at the AWC in Kansas City. Covers the central CONUS, Caribbean, Central America, and adjacent oceanic airspace.
- **Anchorage VAAC** -- Alaska, the North Pacific, and the Aleutian / Kamchatka great-circle corridor. High operational relevance for trans-Pacific traffic.

The other seven VAACs (London, Toulouse, Montreal, Buenos Aires, Darwin, Tokyo, Wellington) cover the rest of the globe. A flight crossing multiple VAAC areas will see advisories from each center for the segment of the cloud in that area.

The product itself is a fixed-format text bulletin. It states the observed position of the ash cloud at the analysis time plus three forecast positions at 6, 12, and 18 hours after analysis, each as a polygon with an altitude band. The text bulletin is paired with a graphical depiction on aviationweather.gov/vaa.

The VAA is advisory. It is not a clearance, a restriction, or a route directive. Translation into operational airspace closure is the job of the **Volcanic Ash SIGMET** (a SIGMET subtype, header `WS`, hazard code `VA`) issued by ATC providers for the affected FIRs. Treat the VAA as the meteorology layer; treat the VA SIGMET as the airspace layer.

## When you read it

- **Preflight, any flight whose route passes within an active VAAC area for an erupting volcano.** The Alaska eruption that's been quiet for 12 hours can re-erupt without warning; check the latest advisory in the briefing flow, not the one you saw yesterday.
- **En route, if a new VAA is issued for a sector ahead of you.** ATC will typically relay the paired VA SIGMET; the VAA is the underlying meteorological picture that explains why the SIGMET polygon has the shape and altitude band it does.
- **Decision it informs:** route selection, altitude selection, divert, and in the worst case, abort takeoff or land short. Ash is a no-go zone, not a degrade-and-press zone. Even thin ash damages turbine engines.
- **Where it fits the briefing pack:** with SIGMETs and Convective SIGMETs, in the hazard-advisory layer of the brief. Cross-reference with satellite imagery (ash plumes show on visible / infrared / ash-product RGB satellite channels) and with the surface analysis to understand which way the upper-level winds are pushing the cloud.

## How to read it

The VAA bulletin is fixed-format text. Field-by-field:

| Field            | Example                                                                                                     | Meaning                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Product header   | `FVXX21 KNES 141200`                                                                                        | `FV` = volcanic ash advisory, `XX21` = bulletin series, `KNES` = issuing VAAC (Washington VAAC at NESDIS / AWC), DDHHMM issue time UTC.       |
| VAAC name        | `VA ADVISORY`                                                                                               | Header line declaring the product. Followed by `DTG` (date-time group), VAAC name, advisory number.                                           |
| DTG              | `DTG: 20260514/1200Z`                                                                                       | Date-time group of the advisory, YYYYMMDD/HHMMZ.                                                                                              |
| VAAC             | `VAAC: WASHINGTON`                                                                                          | Center that issued the advisory.                                                                                                              |
| Volcano name     | `VOLCANO: CLEVELAND 311240`                                                                                 | Volcano common name and Smithsonian Global Volcanism Program number.                                                                          |
| Psn (position)   | `PSN: N5249 W16957`                                                                                         | Volcano latitude / longitude.                                                                                                                 |
| Area             | `AREA: ALEUTIAN IS`                                                                                         | Geographic region (used by Anchorage VAAC; Washington VAAC uses similar regional labels).                                                     |
| Summit elev      | `SUMMIT ELEV: 5676 FT`                                                                                      | Volcano summit elevation in feet MSL.                                                                                                         |
| Advisory nr      | `ADVISORY NR: 2026/048`                                                                                     | YYYY/sequence. Sequence resets each year per volcano.                                                                                         |
| Info source      | `INFO SOURCE: GOES-18. AVO.`                                                                                | Where the analysis came from (satellites, in-situ observers, the relevant volcano observatory, ground PIREPs).                                |
| Eruption details | `ERUPTION DETAILS: CONTINUOUS ASH EMISSION`                                                                 | Current eruption state: continuous emission, intermittent, paused, etc.                                                                       |
| Obs ash date     | `OBS VA DTG: 14/1145Z`                                                                                      | Date-time of the observed ash analysis.                                                                                                       |
| Obs ash cloud    | `OBS VA CLD: SFC/FL200 N5249 W16957 - N5300 W16800 - N5215 W16745 - N5215 W16930 - N5249 W16957 MOV E 30KT` | Observed polygon: altitude band (`SFC/FL200`), vertex list of lat/long pairs, motion vector.                                                  |
| Fcst ash +6 hr   | `FCST VA CLD +6 HR: 14/1745Z SFC/FL250 N5300 W16700 - ...`                                                  | Forecast polygon 6 hours after analysis: validity time, altitude band, vertices.                                                              |
| Fcst ash +12 hr  | `FCST VA CLD +12 HR: 14/2345Z ...`                                                                          | Forecast polygon 12 hours after analysis.                                                                                                     |
| Fcst ash +18 hr  | `FCST VA CLD +18 HR: 15/0545Z ...`                                                                          | Forecast polygon 18 hours after analysis.                                                                                                     |
| Remarks          | `RMK: ASH PLUME EXTENDING ENE FROM SUMMIT. CONTINUOUS EMISSION OBSERVED IN GOES-18 ASH RGB.`                | Free-text plain-language notes from the forecaster.                                                                                           |
| Next advisory    | `NXT ADVISORY: 14/1800Z`                                                                                    | When the next advisory is expected. VAAs typically run on a 6-hour cycle during active events, more often if conditions are changing rapidly. |

Each forecast block has the same shape as the observed block: validity time, altitude band, polygon vertices. Altitude bands are MSL (`SFC/FL200`) or flight levels (`FL150/FL350`). Multiple polygons in the same forecast block separated by `AND` indicate a fragmented or multi-layer cloud.

The graphical overlay on aviationweather.gov/vaa renders all four polygons (observed + 6/12/18) on the same map so the dispersal trajectory is visible at a glance.

## Annotated example(s)

### Example 1 -- Iceland eruption drifting across the North Atlantic

Raw product text:

```text
FVXX21 EGRR 141200
VA ADVISORY
DTG: 20260514/1200Z
VAAC: LONDON
VOLCANO: EYJAFJALLAJOKULL 372020
PSN: N6338 W01937
AREA: ICELAND
SUMMIT ELEV: 5466 FT
ADVISORY NR: 2026/124
INFO SOURCE: METEOSAT-11. ICELANDIC MET OFFICE.
ERUPTION DETAILS: CONTINUOUS ASH EMISSION TO FL350
OBS VA DTG: 14/1145Z
OBS VA CLD: FL200/FL350 N6338 W01937 - N6300 W01700 - N6230 W01500 -
N6200 W01700 - N6250 W01900 - N6338 W01937 MOV SE 45KT
FCST VA CLD +6 HR: 14/1800Z FL200/FL350 N6230 W01430 - N6100 W01100 -
N6000 W01300 - N6100 W01600 - N6230 W01430
FCST VA CLD +12 HR: 15/0000Z FL200/FL350 N6100 W01100 - N5900 W00700 -
N5700 W00900 - N5900 W01300 - N6100 W01100
FCST VA CLD +18 HR: 15/0600Z FL200/FL350 N5900 W00700 - N5600 W00200 -
N5400 W00500 - N5700 W00900 - N5900 W00700
RMK: SUSTAINED PLUME OBSERVED IN METEOSAT-11 ASH RGB. ASH CLOUD
TRACKING ENE-TO-SE INTO NORTH ATLANTIC TRACK SYSTEM (NATS) AIRWAYS.
PIREPS REQUESTED.
NXT ADVISORY: 14/1800Z
```

Decoded:

- `FVXX21 EGRR 141200` -- volcanic ash advisory bulletin, issued by London VAAC (`EGRR`, the UK Met Office) on the 14th at 1200Z.
- `DTG: 20260514/1200Z` -- analysis date-time. Everything in this advisory references this anchor.
- `VAAC: LONDON` -- London VAAC, the center responsible for the Iceland / North Atlantic / European area.
- `VOLCANO: EYJAFJALLAJOKULL 372020` -- the volcano by name and Smithsonian number. Eyjafjallajokull is the 2010 eruption that shut down European airspace for six days.
- `PSN: N6338 W01937` -- volcano location in southern Iceland.
- `SUMMIT ELEV: 5466 FT` -- summit elevation.
- `ADVISORY NR: 2026/124` -- the 124th advisory for this volcano in 2026. Long-running eruptions accumulate numbers fast.
- `INFO SOURCE: METEOSAT-11. ICELANDIC MET OFFICE.` -- analysis built from Meteosat-11 satellite ash-RGB imagery plus ground reports from the Icelandic Met Office.
- `ERUPTION DETAILS: CONTINUOUS ASH EMISSION TO FL350` -- ongoing eruption pushing ash to flight level 350.
- `OBS VA CLD: FL200/FL350 N6338 W01937 - N6300 W01700 - ... MOV SE 45KT` -- observed ash from FL200 to FL350, a five-vertex polygon anchored at the volcano and extending east-southeast over the ocean, moving SE at 45 KT.
- `FCST VA CLD +6 HR / +12 HR / +18 HR` -- three forecast polygons stepping the cloud SE across the North Atlantic. By +18 hr the leading edge is near N5400 W00500, approaching Ireland / UK airspace.
- `RMK: ... TRACKING ENE-TO-SE INTO NORTH ATLANTIC TRACK SYSTEM (NATS) AIRWAYS. PIREPS REQUESTED.` -- forecaster flags that the cloud is heading into the daily North Atlantic Track system, where the bulk of trans-Atlantic jet traffic flies; PIREPs requested means the VAAC wants pilot confirmation of what's actually there.
- `NXT ADVISORY: 14/1800Z` -- next update in 6 hours.

What this is telling you: a sustained Iceland eruption with an ash cloud from FL200 to FL350 drifting SE at 45 KT, projected to reach the NATS jet airways within 18 hours. For trans-Atlantic operators, any westbound NAT track passing under the polygon at any of the four time stamps is a re-plan, either lateral (move the track south of the polygon) or vertical (descend below FL200 if the track economics allow, which they usually do not). For US-departing or US-bound traffic, the operational decision is made via the paired VA SIGMETs issued by Reykjavik / Shanwick / Gander oceanic centers; the VAA is the meteorology behind those SIGMETs.

### Example 2 -- Alaska eruption affecting the Anchorage-Tokyo great circle

Raw product text:

```text
FVAK20 PAWU 091800
VA ADVISORY
DTG: 20260509/1800Z
VAAC: ANCHORAGE
VOLCANO: PAVLOF 312030
PSN: N5525 W16142
AREA: ALEUTIAN IS
SUMMIT ELEV: 8261 FT
ADVISORY NR: 2026/067
INFO SOURCE: GOES-18. AVO.
ERUPTION DETAILS: EXPLOSIVE ERUPTION 09/1745Z. ASH TO FL400.
OBS VA DTG: 09/1755Z
OBS VA CLD: FL150/FL400 N5525 W16142 - N5600 W16000 - N5630 W15800 -
N5500 W15700 - N5430 W15900 - N5525 W16142 MOV E 60KT
FCST VA CLD +6 HR: 10/0000Z FL150/FL400 N5630 W15800 - N5700 W15300 -
N5530 W15100 - N5400 W15400 - N5630 W15800
FCST VA CLD +12 HR: 10/0600Z FL150/FL400 N5700 W15300 - N5730 W14600 -
N5530 W14300 - N5400 W14800 - N5700 W15300
FCST VA CLD +18 HR: 10/1200Z FL200/FL400 N5730 W14600 - N5700 W13900 -
N5500 W13500 - N5400 W14200 - N5730 W14600
RMK: EXPLOSIVE ASH CLOUD VISIBLE IN GOES-18 ASH RGB. CLOUD CROSSES
ANC-NRT GREAT CIRCLE AT FCST +6 AND +12 HR. PAIRED VA SIGMET ISSUED
BY ANCHORAGE FIR. PIREPS REQUESTED.
NXT ADVISORY: 10/0000Z
```

Decoded:

- `FVAK20 PAWU 091800` -- VAA bulletin, AK regional series, issued by Anchorage VAAC (`PAWU`, NWS Alaska Region) on the 9th at 1800Z.
- `VAAC: ANCHORAGE` -- Anchorage VAAC, responsible for Alaska / Aleutians / North Pacific.
- `VOLCANO: PAVLOF 312030` -- Pavlof, a frequently active stratovolcano on the Alaska Peninsula.
- `ADVISORY NR: 2026/067` -- the 67th Pavlof advisory of 2026.
- `INFO SOURCE: GOES-18. AVO.` -- GOES-18 satellite ash-RGB plus the Alaska Volcano Observatory.
- `ERUPTION DETAILS: EXPLOSIVE ERUPTION 09/1745Z. ASH TO FL400.` -- discrete explosive event, ash column to FL400 (40,000 ft). Explosive eruptions are particularly dangerous because the ash cloud goes vertical fast and can intersect cruise altitudes before a VA SIGMET can be issued.
- `OBS VA CLD: FL150/FL400 ... MOV E 60KT` -- observed ash band 15,000 ft to 40,000 ft, moving east at 60 KT. The polygon hugs the volcano and extends ENE.
- `FCST VA CLD +6 HR / +12 HR / +18 HR` -- three steps east at roughly 60 KT. By +18 hr the cloud has translated roughly 1,000 NM east, and the lower base has lifted from FL150 to FL200 as the lower-altitude ash settles out.
- `RMK: ... CLOUD CROSSES ANC-NRT GREAT CIRCLE AT FCST +6 AND +12 HR. PAIRED VA SIGMET ISSUED BY ANCHORAGE FIR.` -- the forecaster has explicitly called out that the cloud intersects the Anchorage-Tokyo great-circle corridor (a major North Pacific cargo and trans-Pacific passenger route) at both the +6 and +12 hour forecast positions, and the paired VA SIGMET has been issued by Anchorage FIR.
- `NXT ADVISORY: 10/0000Z` -- next update in 6 hours; expect it sooner if the eruption changes character.

What this is telling you: an explosive eruption put ash up to FL400 in the past 15 minutes; the cloud will sit on the ANC-NRT great circle for the next 12 hours; cruise altitudes (FL340 to FL400 typical for that route) are in the band. For a trans-Pacific cargo flight already airborne, the operational answer is to descend below FL150 (below the ash) or route well north or south of the polygon, coordinated through the paired VA SIGMET and Anchorage Center. For a flight not yet departed, hold for the next advisory. Pavlof's explosive eruptions can be short-duration (hours, not days), so the +18 hr forecast may be the worst of it.

## Common gotchas

- **VAACs advise; they do not clear or route.** The VAA tells you where the ash is. The paired Volcanic Ash SIGMET (issued by the ATC service provider for the FIR -- ZAN for Anchorage, the AWC for CONUS, NATS / Shanwick / Gander for North Atlantic) is the operational product that restricts airspace and that ATC actually routes traffic around. Both products use the same polygon shapes; the VAA explains the meteorology, the VA SIGMET enforces the airspace.
- **Altitudes are flight levels, not AGL.** `FL150/FL400` means 15,000 ft to 40,000 ft MSL above the standard datum, not above the volcano summit and not above the ground. Read the altitude band against your filed flight level, not against the terrain you're crossing.
- **Forecast polygons have high uncertainty.** The cloud's actual trajectory depends on wind shear, eruption rate, particle size, and atmospheric stability, all of which the VAAC models with a dispersion code (HYSPLIT, NAME, or similar). Subsequent advisories often re-shape the polygon as the model is re-anchored to fresh satellite observations and PIREPs. Plan on the polygon you see, but expect the +12 hr and +18 hr shapes to be wrong in detail.
- **A new explosive eruption can outpace the advisory cycle.** VAAs run on a 6-hour nominal cycle. An explosive eruption that begins between advisories can put ash at cruise altitude before the next bulletin is issued. The mitigations: monitor satellite ash RGB imagery on the dispatch / EFB side, watch for the airline's own ash-cloud product feeds, and trust the paired VA SIGMET (which can be issued or amended off-cycle) to be more current than the VAA.
- **ANY ash encounter is a safety-of-flight emergency.** Volcanic ash is finely ground glass and rock. At the temperature of a jet engine combustor it melts, coats the turbine, and can flame the engine out. **British Airways Flight 9** (1982) lost all four engines after flying through Mount Galunggung ash near Java; restarted three after gliding below the cloud. **KLM Flight 867** (1989) lost all four engines flying through Mount Redoubt ash near Anchorage; restarted them after losing 14,000 feet. Both crews recovered; the precedent is that **thin, almost invisible ash is enough to flame out a turbine**. Treat the polygon as a firm boundary, not a probabilistic suggestion.
- **Eruption alert level is not in the VAA.** The volcano's alert level (Green / Yellow / Orange / Red on the US Geological Survey color code, or equivalent in other countries) is published by the relevant volcano observatory, not in the VAA. A volcano on Orange that's not currently emitting won't have a VAA, but is positioned to emit one in the next hours. Cross-reference the USGS Volcanic Hazard Program or AVO color-code dashboard for the regional alert state, not just the active advisories.
- **No `FL000` or "surface" alarmism.** `SFC/FL200` means the ash is in contact with the ground at the source -- expected for an active vent -- and extends up to FL200. Read the polygon shape: the surface contact will be a small footprint near the vent; the FL200 cap is the airspace ceiling of concern.
- **Subsequent advisories supersede prior advisories.** Each VAA is numbered by year/sequence; the latest number is authoritative. Don't read a 6-hour-old VAA without checking whether a newer one has reshaped the polygon. The service page on aviationweather.gov/vaa always shows the current bulletin.

## Triage

You have 60 seconds. Where do your eyes go?

1. **Polygon vs route, at each of the four time stamps.** Does the observed polygon or any of the +6 / +12 / +18 forecast polygons intersect your filed route or a reasonable corridor around it? Use a generous corridor; ash dispersal models are imperfect, and the cloud often sits a bit wider than the printed polygon.
2. **Altitude band vs filed altitude.** A `FL150/FL400` band catches every jet operating in normal cruise. A `SFC/FL100` band is mostly a problem for piston and turboprop traffic plus departure / arrival profiles for jets. Read your filed altitude (or the climb / descent profile you'll fly through) against the band.
3. **Time-on-station vs forecast validity.** Compare your time over each segment of the route to the validity time on each forecast polygon. The relevant polygon is the one whose validity time brackets your arrival in that geography.
4. **Motion vector.** A polygon drifting toward your route at 60 KT changes the picture even between advisories. Add the motion vector forward from the observed analysis time to your time-on-station for a rough updated polygon.
5. **Next advisory time.** If you're not yet airborne and the next advisory is within an hour, wait for it. Ash polygons can change shape significantly between issuances, especially during explosive eruptions or wind-shear shifts.
6. **Paired VA SIGMET.** Pull the VA SIGMET for the affected FIR. The SIGMET is the airspace-closure product; if it's tighter than the VAA polygon (sometimes the ATC provider buffers the cloud for safety), the SIGMET is the operational boundary.

If the polygon intersects your route at your altitude at your time-on-station, the answer is reroute around or below the cloud, not through it. There is no "thin ash is probably fine" option. Two transport-category jets have lost all engines flying through what looked like nothing.

## Related products

- [SIGMET](../sigmet/page.md) -- the paired Volcanic Ash SIGMET (header `WS`, hazard code `VA`) is the airspace-restriction product the ATC provider issues from the VAA. Read both; the VAA explains the meteorology, the SIGMET enforces the boundary.
- [Convective SIGMET](../convective-sigmet/page.md) -- separate hazard product for thunderstorms. Sometimes co-occurs with ash advisories when convection re-lofts settled ash; not the operational product for the ash itself.
- [Surface Analysis](../surface-analysis/page.md) -- the synoptic chart that explains the upper-level wind pattern pushing the ash. Useful to sanity-check the VAA's motion vector against the prevailing flow.
- [Satellite](../satellite/page.md) -- the ash RGB product (and visible / infrared channels) is what the VAAC analyst is looking at. For en-route awareness ahead of the next advisory, satellite imagery is more current than the bulletin.
- [Weather TFR](../weather-tfr/page.md) -- in extreme cases the FAA may issue a TFR for ash-affected airspace; treat as airspace closure, not advisory.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, In-flight Aviation Weather Advisories chapter, Volcanic Ash Advisory section. Format spec, VAAC responsibilities, pairing with the VA SIGMET.
- **AIM 7-1-15** -- Volcanic Ash, Smoke Plumes, and Other Hazards. Operational pilot procedures and the VAFTAD dispersion framework.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Volcanic Ash chapter (Hazards). Engine and airframe damage mechanisms, encounter precedents (BA 9, KLM 867), pilot procedures for inadvertent encounter.
- **ICAO Annex 3** -- Meteorological Service for International Air Navigation, Volcanic Ash Watch. International framework for the nine VAACs and the standard advisory format.
- Service page: aviationweather.gov/vaa (current advisories, graphical overlay, bulletin archive).

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of in-flight advisories, see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md) -- the in-flight advisory family. Volcanic ash is one of the four non-convective SIGMET hazards; this node frames the VAA against its SIGMET sibling and the broader advisory ladder.
