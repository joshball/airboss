---
id: wx-ref-sigmet
title: SIGMET (WS)
short_code: WS
category: hazard-advisory
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, In-flight Aviation Weather Advisories (SIGMET)'
    note: 'Format spec, trigger thresholds, valid times for non-convective SIGMET.'
    verified: true
  - source: AIM
    section: '7-1-6'
    note: 'Inflight Aviation Weather Advisories -- operational use of SIGMET.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Chapter 26 (Section 26.2 -- SIGMET)'
    note: 'Modern consolidated treatment of the SIGMET product.'
    verified: false
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - wx-ref-airmet
  - wx-ref-convective-sigmet
  - wx-ref-cwa
  - wx-ref-volcanic-ash-advisory
  - wx-ref-tropical-cyclone-advisory
  - wx-ref-pirep
---

# SIGMET (WS)

> The non-convective SIGMET is an AWC-issued in-flight advisory warning of severe-and-up hazards (severe icing, severe or extreme turbulence, volcanic ash, widespread duststorm/sandstorm) significant to **all** aircraft, light or heavy.

## What it is

A SIGMET (Significant Meteorological Information) is an unscheduled in-flight advisory issued by the Aviation Weather Center (AWC) when non-convective weather meets a severe-or-greater threshold over a defined area, at altitudes above **and** below FL180. The non-convective SIGMET (header `WS`) covers four hazard categories:

- Severe icing not associated with thunderstorms.
- Severe or extreme turbulence (including clear-air turbulence) not associated with thunderstorms.
- Widespread duststorm or sandstorm reducing surface visibility below 3 SM.
- Volcanic ash.

Valid for up to **4 hours** (6 hours for volcanic ash and tropical cyclones). SIGMETs are event-driven -- they are issued only when conditions warrant, not on a fixed cycle, and they update as the hazard evolves. Convective SIGMETs are a separate product (header `WST`) and have their own page.

The product is encoded text with a polygon (lat/long vertex list) and an altitude band. The AWC also publishes graphical SIGMET overlays on aviationweather.gov.

## When you read it

- **Preflight, every flight.** A SIGMET in or near your route at your altitude is a re-plan trigger before you ever taxi.
- **En route, urgently.** A new SIGMET intersecting your flight path requires immediate evaluation: divert, climb/descend out of the band, or land.
- **Decision it informs:** go/no-go, altitude selection, route selection, divert. AIRMETs are an awareness item; **SIGMETs are a stop** unless your aircraft and your pilot capability defensibly handle severe-category weather, which for a private pilot in a piston single is almost never the answer.
- **Where it fits the briefing pack:** read after METARs/TAFs and the GFA, alongside AIRMETs and Convective SIGMETs. Pair with PIREPs for confirmation of what pilots are actually seeing.

## How to read it

The non-convective SIGMET is fixed-format encoded text. Field-by-field:

| Field          | Example                              | Meaning                                                                                                                                              |
| -------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product header | `WSUS01 KKCI`                        | `WS` = SIGMET, `US01` = US region/series, `KKCI` = issuing office (AWC, Kansas City).                                                                |
| Bulletin name  | `SIGC` / `SIGE` / `SIGW`             | Region the SIGMET applies to: Central, Eastern, Western US. (Convective uses `WST` / `MKCC`/`MKCE`/`MKCW`.)                                          |
| Designator     | `SIGMET PAPA 2`                      | Alphabetic name (NOVEMBER through YANKEE, excluding SIERRA / TANGO / ZULU which are AIRMET letters) plus sequence number for that designator series. |
| Valid period   | `VALID 131800/132200`                | DDHHMM start / DDHHMM end, UTC. Up to 4 hours (6 for volcanic ash / tropical cyclone).                                                               |
| FIR (intl)     | `KZDV DENVER FIR`                    | For international ICAO SIGMETs the Flight Information Region is named. US SIGMETs use the AWC region letter instead.                                 |
| Hazard         | `SEV TURB`                           | `SEV ICE`, `SEV TURB`, `SEV MTN WAVE`, `VA` (volcanic ash), `DS` (duststorm), `SS` (sandstorm).                                                      |
| Area / polygon | `FROM 40N110W TO 42N108W TO 38N104W` | Vertex list defining the affected polygon. Read carefully -- the polygon can be irregular.                                                           |
| Altitude band  | `BTN FL280 AND FL410`                | Affected altitudes, MSL/flight levels. May say `SFC/FL180`, `FRZLVL/FL120`, etc.                                                                     |
| Intensity      | `SEV`                                | Severity word repeated for clarity (`SEV` severe, `EXTRM` extreme).                                                                                  |
| Motion         | `MOV E 40KT`                         | Direction and speed of the hazard polygon. `STNR` = stationary.                                                                                      |
| Outlook        | `CONDS CONTG BYD 22Z`                | Continuation forecast past the valid time, when the issuer expects the hazard to persist.                                                            |

US SIGMET designator letters (NOVEMBER through YANKEE, excluding SIERRA / TANGO / ZULU) are reserved per region and reused across the alphabet as the day progresses. The letter is not a hazard tag -- it's a serial label so that updates ("SIGMET PAPA 2" supersedes "PAPA 1") can be tracked.

## Annotated example(s)

### Example 1 -- severe mountain-wave turbulence in the lee of the Rockies

Raw product text:

```text
WSUS01 KKCI 131755
SIGC
SIGMET PAPA 2 VALID 131800/132200 KKCI-
DENVER FIR
FROM 60WNW BIL TO 30SW BIL TO 60S COD TO 90NE LAR TO 90E DEN TO
50ENE DEN TO 60WNW BIL
SEV TURB BTN FL280 AND FL410 RPRTD BY ACFT AND FCST DUE TO STG
MTN WAVE AND CAT. CONDS MOV E 40KT. CONDS CONTG BYD 22Z.
```

Decoded:

- `WSUS01 KKCI 131755` -- non-convective SIGMET bulletin, US series 01, issued by AWC Kansas City on the 13th at 1755Z.
- `SIGC` -- Central US region SIGMET bulletin.
- `SIGMET PAPA 2` -- designator PAPA, update #2 (supersedes PAPA 1). Reserved for this hazard line until it dissipates.
- `VALID 131800/132200` -- valid from 13/1800Z to 13/2200Z, four hours.
- `DENVER FIR` -- Flight Information Region named for ICAO-style reference; the polygon sits in ZDV airspace.
- Polygon: a six-vertex shape from northwest of Billings (BIL) down through southwestern Wyoming and across to east of Denver (DEN) and back. Lee of the northern Rockies -- classic mountain-wave terrain.
- `SEV TURB BTN FL280 AND FL410` -- severe turbulence between FL280 and FL410. Severe = airspeed swings >25 KT, momentary loss of control. Above the band you're clear; below it you're in lower mountain-wave territory but not the SIGMET-flagged severe layer.
- `RPRTD BY ACFT AND FCST` -- pilots have already reported it (PIREP-confirmed) **and** the forecast expects it to persist. Both legs of the truth-up are lit.
- `DUE TO STG MTN WAVE AND CAT` -- strong mountain wave with clear-air turbulence. CAT means the turbulence is in clear air, no cloud cue to dodge.
- `MOV E 40KT` -- the affected polygon drifts east at 40 KT.
- `CONDS CONTG BYD 22Z` -- expected to continue past the 2200Z expiration; a follow-on SIGMET is likely.

What this is telling you: severe CAT in the high-30s/low-40s flight levels east of the Rockies, persistent, drifting east. For a piston single this is not a "your altitude" hazard, but for any aircraft transiting at FL280-410 (turbojets and turboprops on jet airways) it's a re-plan. If you were filed through the polygon in the band, the SIGMET is the document that justifies the route or altitude change to dispatch and ATC.

### Example 2 -- severe icing in a freezing-rain event over the upper Midwest

Raw product text:

```text
WSUS02 KKCI 080435
SIGE
SIGMET QUEBEC 1 VALID 080435/080835 KKCI-
CHICAGO FIR DETROIT FIR
FROM 30NNW MSP TO 30E DLH TO 50SE ESC TO 40SSE GRR TO 40SSW
FWA TO 50W BRL TO 30NNW MSP
SEV MXD ICGICIP FRZLVL/FL120. FRZ RAIN AND FRZ DRZL RPRTD BY
ACFT. CONDS DVLPG. CONDS CONTG BYD 0835Z.
```

Decoded:

- `WSUS02 KKCI 080435` -- non-convective SIGMET, US series 02, AWC Kansas City, 08th at 0435Z.
- `SIGE` -- Eastern US region SIGMET bulletin.
- `SIGMET QUEBEC 1` -- designator QUEBEC, first issuance.
- `VALID 080435/080835` -- valid 08/0435Z to 08/0835Z, four hours.
- `CHICAGO FIR DETROIT FIR` -- two FIRs because the polygon crosses the ZAU/ZOB boundary.
- Polygon: a hexagon roughly bounded by Minneapolis (MSP), Duluth (DLH), Escanaba (ESC), Grand Rapids (GRR), Fort Wayne (FWA), Burlington IA (BRL). Covers Wisconsin, Michigan, northern Illinois, northern Indiana, eastern Iowa, and parts of Minnesota / Ohio.
- `SEV MXD ICGICIP FRZLVL/FL120` -- severe mixed icing (rime + clear combined) in cloud (ICGIC) and in precipitation (ICGICIP) from the freezing level up to FL120. `MXD` is the icing-type code for mixed.
- `FRZ RAIN AND FRZ DRZL RPRTD BY ACFT` -- pilots are reporting freezing rain and freezing drizzle. This is the supercooled large droplet (SLD) signature -- no certified airframe is approved to operate in it, including FIKI airplanes.
- `CONDS DVLPG` -- the hazard is developing (worsening or expanding), not steady-state.
- `CONDS CONTG BYD 0835Z` -- expected to continue past expiration; a follow-on SIGMET is likely.

What this is telling you: severe icing with confirmed freezing rain across a five-state polygon from the surface freezing level up to 12,000 feet. For any GA aircraft, this is a stop. Climb-out through it is not an option -- the band extends to FL120 -- and "duck under" is freezing rain at the surface. The SIGMET says do not depart into this airspace; if airborne, divert clear of the polygon immediately and land somewhere with surface temperatures above freezing.

## Common gotchas

- **Severe is the trigger.** Moderate hazards belong in AIRMET, not SIGMET. If a SIGMET is out, the hazard has been classified as severe-or-greater -- treat it that way, do not negotiate.
- **Non-convective only.** Convective SIGMETs (header `WST`) are a separate product with their own triggers (thunderstorms, hail, tornadoes) and live on a separate page. Don't conflate the two.
- **Volcanic ash and tropical cyclone are special.** They are SIGMET hazards but get extended 6-hour validity and have their own standalone advisory products too (Volcanic Ash Advisory, Tropical Cyclone Advisory) issued by VAACs and the NHC respectively. See those pages.
- **International (ICAO) vs US format.** ICAO SIGMETs name the FIR explicitly and use slightly different field ordering. US AWC SIGMETs reference FIRs but also use a region letter (`SIGC`/`SIGE`/`SIGW`). If you're flying internationally, read the FIR / ICAO format with the same field meaning but expect cosmetic differences.
- **Polygon vertices can be irregular.** When rendering manually from a text-only product, read every vertex carefully -- a six-vertex polygon is not the same as a bounding box, and visual interpolation between two points across mountains can hide an excursion that pulls the polygon over your route.
- **Stale SIGMETs are not a cleared hazard.** A SIGMET past its valid period is not proof the hazard cleared -- check the issuance time and look for a successor SIGMET with the same designator (PAPA 2 supersedes PAPA 1). If there's no successor and the underlying synoptic story (mountain wave, freezing rain band, ash plume) is still in place, treat the hazard as ongoing until a fresh product or fresh PIREPs say otherwise.
- **Event-driven cycle.** SIGMETs do not have a fixed issuance time. Don't assume "I just looked, there's nothing" means nothing will appear in the next hour. Re-check before takeoff and again en route.

## Triage

You have 60 seconds. Where do your eyes go?

1. **Polygon vs route.** Does the polygon intersect your filed route, including a reasonable corridor either side? Out-of-corridor = informational. Intersecting = action.
2. **Altitude band vs filed altitude.** A SEV TURB BTN FL280/FL410 advisory does not affect a piston single at 8,000 feet. A SEV ICE FRZLVL/FL120 advisory absolutely does.
3. **Valid time vs your time-on-station.** A SIGMET that expires before you reach the area is a planning artifact, but check for outlook (`CONDS CONTG`) and the chance of a follow-on.
4. **Motion vector.** If the polygon is moving toward your route at speed, the intersection window may open during your flight even if it's clear now.
5. **PIREP cross-check.** A SIGMET backed by recent PIREPs is fully real; a SIGMET issued from forecast alone is still real, but PIREPs sharpen the picture and tell you whether the hazard is steady, building, or weakening.

A SIGMET that intersects your route corridor at your altitude during your time-on-station is a re-plan, a divert, or a no-go. For a private pilot, "fly through severe" is essentially never the right answer.

## Related products

- [AIRMET](../airmet/page.md) -- the moderate-tier sibling. AIRMETs are awareness; SIGMETs are stop.
- [Convective SIGMET](../convective-sigmet/page.md) -- separate product for thunderstorm hazards (header `WST`), issued hourly at H+55.
- [CWA](../cwa/page.md) -- Center Weather Advisory, issued by the CWSU at an ARTCC for shorter-fuse / smaller-area hazards that don't quite meet SIGMET criteria.
- [Volcanic Ash Advisory](../volcanic-ash-advisory/page.md) -- VAAC product for ash plumes, paired with the VA SIGMET.
- [Tropical Cyclone Advisory](../tropical-cyclone-advisory/page.md) -- NHC product for tropical systems, paired with the tropical cyclone SIGMET.
- [PIREP](../pirep/page.md) -- the truth-up. PIREPs confirm or refute the SIGMET hypothesis with what pilots actually see.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, In-flight Aviation Weather Advisories section (SIGMET format, trigger thresholds, valid times).
- **AIM 7-1-6** -- Inflight Aviation Weather Advisories (operational use, designator taxonomy, SIGMET vs AIRMET distinction).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 26, §26.2 (SIGMET).
- Service page: aviationweather.gov/sigmet (current SIGMETs, graphical overlay, text bulletins).

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [SIGMETs and Convective SIGMETs](../../../../knowledge/weather/product-sigmets/node.md)
- [AIRMETs (Sierra, Tango, Zulu)](../../../../knowledge/weather/product-airmets/node.md)
