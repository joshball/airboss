---
id: wx-ref-airmet
title: AIRMET (WA)
short_code: WA
category: hazard-advisory
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: In-flight Aviation Weather Advisories
    note: Format specification for AIRMET / SIGMET / Convective SIGMET text bulletins.
    verified: true
  - source: AIM
    section: 7-1-6
    note: Inflight Aviation Weather Advisories -- operational use, valid times, SIERRA / TANGO / ZULU taxonomy.
    verified: true
  - source: FAA-H-8083-28
    section: Chapter 26, §26.3
    note: Aviation Weather Handbook, Advisories chapter, AIRMET subsection.
    verified: false
related_knowledge_nodes:
  - wx-product-airmets
related_products:
  - sigmet
  - convective-sigmet
  - g-airmet
  - gfa
  - pirep
---

# AIRMET (WA)

> Inflight Aviation Weather Advisory issued by the Aviation Weather Center warning of widespread weather hazards below severe thresholds, affecting aircraft below FL180. Three letter types: SIERRA (IFR / mountain obscuration), TANGO (turbulence / surface winds), ZULU (icing / freezing level).

## What it is

An AIRMET (Airmen's Meteorological Information, product code **WA**) is a text-format in-flight advisory issued by the NWS Aviation Weather Center (AWC) for hazardous weather conditions that are significant primarily to light aircraft and aircraft operating below FL180. The name signals the audience: airmen, generally pilots in single- and twin-engine GA aircraft, where "moderate" turbulence or "moderate" icing is operationally consequential even though heavier transport aircraft might shrug it off.

AIRMETs come in three flavors, each tagged with a phonetic letter:

- **SIERRA (S)** -- IFR conditions (ceilings below 1,000 ft and/or visibility below 3 SM over more than 50% of an area) and mountain obscuration.
- **TANGO (T)** -- moderate turbulence, sustained surface winds at or above 30 KT, and non-convective low-level wind shear.
- **ZULU (Z)** -- moderate icing and the location of the freezing level.

The AWC issues a complete set every **6 hours** at **0245Z, 0845Z, 1445Z, and 2045Z**, valid for **6 hours**, with **amendments** as needed when conditions change. One AIRMET text bulletin is produced per region (Boston, Chicago, Miami, Salt Lake City, San Francisco -- the AWC issues for the CONUS plus offshore areas). Each region's bulletin contains separate sections for whichever of SIERRA / TANGO / ZULU are active.

The graphical counterpart, **G-AIRMET**, is a separate product covering the same hazards as time-sliced polygons (see [g-airmet](../g-airmet/page.md)). The regulatory product, the one referenced in 14 CFR §91.103 preflight requirements, is this text WA bulletin.

## When you read it

- **Preflight** -- every cross-country, every IFR flight, every flight over terrain or with any chance of low ceilings or icing. AIRMETs tell you which large-area hazards your route punches through.
- **En route** -- via EFB (ForeFlight, Garmin Pilot), Flight Service (1-800-WX-BRIEF), Flight Information Service - Broadcast (FIS-B over ADS-B In), or HIWAS where still available. Refresh on the 6-hour cycle and listen for amendments.

What it decides:

- **Go / no-go** -- an AIRMET SIERRA over your VFR route is often the call.
- **Altitude selection** -- AIRMET ZULU's freezing level and icing band drive cruise altitude in cold-season IFR.
- **Route selection** -- AIRMET TANGO over the mountains may push the route around or below the terrain.
- **Time-shift** -- if the AIRMET expires before your ETA and the outlook clears, delay; if the outlook extends it, don't bet on improvement.

What it replaces or supplements: AIRMETs are the area-hazard layer of the briefing pack. They sit alongside the GFA (which displays them spatially), the freezing level chart, the icing forecast (FIP/CIP), the turbulence forecast (GTG), and PIREPs (the truth-up).

## How to read it

An AIRMET bulletin is structured text. The header identifies which region and which AIRMET type; the body identifies the affected area, the hazard, the altitude band, the motion, and the outlook.

| Field           | Example                                                         | Meaning                                                                                          |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Header          | `WAUS41 KKCI 131445`                                            | Product code WA, US region 41, issuing office KKCI (AWC Kansas City), issuance day/time 131445Z. |
| Type + region   | `SFOS WA 131445`                                                | SIERRA AIRMET for the San Francisco region, issued 131445Z.                                      |
| Reference       | `AIRMET SIERRA UPDT 3 FOR IFR AND MTN OBSCN VALID UNTIL 132100` | Update number 3, hazards SIERRA covers, valid until 132100Z.                                     |
| Affected area   | `FROM 60WSW YQB TO ...`                                         | A series of VOR/fix radials and distances defining the polygon boundary.                         |
| Conditions      | `CIG BLW 010 VIS BLW 3SM BR`                                    | Ceiling below 1,000 ft, visibility below 3 SM in mist.                                           |
| Altitude band   | `BTN 060 AND 100`                                               | Between 6,000 ft and 10,000 ft MSL (when applicable, e.g. icing layer).                          |
| Motion          | `MOV E 15KT` or `STNRY`                                         | Moving east at 15 KT, or stationary.                                                             |
| Condition trend | `CONDS CONTG BYD 21Z THRU 03Z`                                  | Conditions continuing beyond the valid time -- this is the outlook.                              |

A bulletin can contain multiple AIRMETs (e.g. SIERRA for IFR plus SIERRA for mountain obscuration), each in its own block with its own polygon, altitude band, and motion.

The polygon is described as a chain of points relative to VOR/DME stations or named fixes (`FROM 60WSW YQB TO 40NW MSS TO ...`). On an EFB, this renders as a filled polygon overlay. From the raw text, you walk the chain on a chart.

## Annotated example(s)

### Example 1 -- AIRMET SIERRA, Pacific Northwest IFR + mountain obscuration

Raw product text:

```text
WAUS46 KKCI 131445
SFOS WA 131445
AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN VALID UNTIL 132100

AIRMET IFR...WA OR
FROM 30NE HQM TO YKM TO 30SE DLS TO EUG TO ONP TO 30NE HQM
CIG BLW 010/VIS BLW 3SM BR/-RA. CONDS CONTG BYD 21Z THRU 03Z.

AIRMET MTN OBSCN...WA OR
FROM 30NE HQM TO YKM TO 30SE DLS TO EUG TO ONP TO 30NE HQM
MTNS OBSC BY CLDS/PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
```

Decoded:

- **Header** -- `WAUS46 KKCI 131445`: WA bulletin, region 46 (San Francisco AWC desk), issued by Kansas City AWC on the 13th at 1445Z.
- **Type line** -- `SFOS WA 131445`: SIERRA AIRMET for the SFO region, this issuance dated 131445Z.
- **Reference** -- `AIRMET SIERRA UPDT 2 FOR IFR AND MTN OBSCN VALID UNTIL 132100`: this is the 2nd update of today's SIERRA cycle; it covers IFR conditions and mountain obscuration; valid until 132100Z (6 hours and change from issuance, aligned with the next regular cycle).
- **First polygon (IFR)** -- affects Washington and Oregon. The polygon corners are described by VOR radials: from 30 NM northeast of Hoquiam (HQM), to Yakima (YKM), to 30 SE of The Dalles (DLS), to Eugene (EUG), to Newport (ONP), back to the start. Roughly: western WA / OR.
- **Conditions** -- ceilings below 1,000 ft AGL and/or visibility below 3 SM in mist (BR) and light rain (-RA).
- **Outlook** -- `CONDS CONTG BYD 21Z THRU 03Z`: the same conditions continue beyond the 2100Z expiry, through 0300Z the following day. Don't expect clearing tonight.
- **Second polygon (mountain obscuration)** -- same shape, same area. Mountains in this polygon obscured by clouds, precipitation, or mist. The Cascades and the Coast Range are in this box.

What this is telling you: the entire I-5 corridor and the Cascades are in IFR with mountains hidden in the clag. A VFR pilot eastbound from KSEA to KGEG cannot legally cross the Cascades VFR; the only options are IFR with an aircraft and pilot capable, wait it out, or coastal/Columbia Gorge low-altitude routing under careful eyeball -- and even that has the mountain obscuration AIRMET sitting on top of it. The outlook says it doesn't clear today.

### Example 2 -- AIRMET ZULU, Great Lakes icing

Raw product text:

```text
WAUS43 KKCI 131445
CHIZ WA 131445
AIRMET ZULU UPDT 1 FOR ICE AND FRZLVL VALID UNTIL 132100

AIRMET ICE...WI MI IL IN OH
FROM 50NW MSN TO YQT TO YYZ TO CLE TO IND TO 30W SPI TO 50NW MSN
MOD ICE BTN FRZLVL AND FL180. FRZLVL 030-060.
CONDS CONTG BYD 21Z THRU 03Z.
```

Decoded:

- **Header** -- `WAUS43 KKCI 131445`: WA bulletin, region 43 (Chicago AWC desk).
- **Type line** -- `CHIZ WA 131445`: ZULU AIRMET for the Chicago region.
- **Reference** -- `AIRMET ZULU UPDT 1 FOR ICE AND FRZLVL VALID UNTIL 132100`: 1st update of today's ZULU cycle, covers icing and freezing level.
- **Polygon** -- WI, MI, IL, IN, OH. Corners walk from 50 NW of Madison (MSN), to Thunder Bay (YQT), to Toronto (YYZ), to Cleveland (CLE), to Indianapolis (IND), to 30 W of Springfield IL (SPI), back to start. Roughly: upper Midwest and Great Lakes.
- **Conditions** -- moderate icing between the freezing level and FL180. The icing layer's bottom is the freezing level (varies across the polygon), the top is FL180 (the AIRMET ceiling).
- **Freezing level** -- 3,000 ft to 6,000 ft MSL across the polygon. That's the bottom of the icing layer; surface to FRZLVL is plus-temps with no icing.
- **Outlook** -- conditions continue past 2100Z through 0300Z. Overnight stays icy.

What this is telling you: any IFR cruise altitude between roughly 3,000 ft MSL and FL180 in this polygon is in forecast moderate ice. For a non-deiced piston single, that's "no thanks." Workable options: stay below the freezing level (impractical IFR east of the Mississippi where MEAs and terrain push you up), file VFR underneath if ceilings allow (cross-check with the SIERRA AIRMET if it exists), file climbing through quickly to a temperature inversion above (rarely available in this synoptic pattern), or don't go. Cross-check with PIREPs to see whether the forecast is verifying.

## Common gotchas

- **AIRMET is not a SIGMET.** AIRMET is the *light-aircraft* tier: moderate ice, moderate turbulence, IFR. SIGMET ([sigmet](../sigmet/page.md)) is the *all-aircraft* tier: severe ice / severe or extreme turbulence not associated with thunderstorms, dust/sandstorm, volcanic ash. Don't downgrade a SIGMET by reading it as "just another advisory."
- **"Widespread" means more than 50% of the area.** AIRMETs flag conditions covering greater than 50% of the bounded area. Localized pockets below that threshold don't trigger an AIRMET, but they may still be in the GFA, in PIREPs, or in TAFs. Absence of an AIRMET is not absence of hazard.
- **Below FL180.** AIRMETs cover from the surface up to but not including FL180. Anything significant above that is SIGMET territory; for icing aloft on a turbojet climb, AIRMET ZULU isn't the right product anyway -- it doesn't try to be.
- **The outlook section matters.** `CONDS CONTG BYD <hr>Z THRU <hr>Z` extends the picture beyond the 6-hour valid window. Read it. If conditions continue overnight and you're planning an early-morning launch, you're flying into the same weather.
- **SIERRA mountain obscuration is the killer.** It's easy to mentally bucket SIERRA as "low IFR" and skip the second half. Mountain obscuration is critical for VFR over terrain -- the ceiling at the airport can be 1,500 ft and the pass can still be solid IMC.
- **TANGO surface-wind threshold is sustained, not gust.** The 30-KT rule is sustained surface wind. A 25G40 KT report doesn't trigger TANGO's wind component (though it might still be in TANGO for turbulence).
- **ZULU's freezing level is the FRZLVL altitude, not "the icing layer bottom" by definition.** They usually coincide (icing forecast lives between FRZLVL and FL180), but the freezing level itself is published as a value -- useful for IFR cruise altitude selection independent of the icing forecast.
- **One bulletin can contain multiple AIRMETs of the same letter.** A single SIERRA bulletin may carry one AIRMET for IFR over one polygon and a separate AIRMET for mountain obscuration over another. Don't read the first block and stop.
- **AWC issues for CONUS regions.** Alaska and Hawaii have their own products. If you're flying outside the lower 48, check the regional advisory products.

## Triage

When you have 60 seconds with an AIRMET bulletin, your eyes go to four things in order:

1. **Does any polygon intersect my route corridor?** If no, move on -- this AIRMET is briefing context, not a flight input.
2. **If it intersects the corridor, does it intersect my altitude band?** ZULU between 3,000 and FL180 doesn't touch a VFR flight at 2,500 ft. SIERRA mountain obscuration ignores the surface category.
3. **Does the valid time bracket my ETA?** An AIRMET expiring 2 hours before I depart is a briefing artifact unless the outlook extends it. An AIRMET starting 2 hours after I land doesn't concern me.
4. **What does the outlook say?** If "CONDS CONTG BYD ... THRU ...", the picture lasts longer than the valid window. Plan accordingly.

The go/no-go drivers:

- **AIRMET SIERRA over a corridor I plan to fly VFR** is often the call. VFR into IMC is the #1 killer of GA pilots; SIERRA explicitly forecasts the conditions that create it.
- **AIRMET ZULU at my cruise altitude in winter** is the altitude-selection driver. For a non-deiced piston, the answer is below FRZLVL or don't go. For a deiced aircraft, it's still a "fly through, don't loiter" call.
- **AIRMET TANGO with sustained surface winds >= 30 KT at my destination** is a crosswind / landing-technique question, not a weather avoidance question. Decide whether the runway alignment + your demonstrated crosswind is in bounds.

## Related products

- [sigmet](../sigmet/page.md) -- next severity tier up: significant to all aircraft (severe turb, severe ice, dust, volcanic ash). Different valid time (4 hr), different trigger.
- [convective-sigmet](../convective-sigmet/page.md) -- thunderstorm-specific SIGMET, issued hourly at H+55, valid 2 hr. Convection above threshold skips AIRMET entirely.
- [g-airmet](../g-airmet/page.md) -- the graphical / polygon time-sliced counterpart to the text AIRMET. Same hazard data, presented as a map you can scrub through in 3-hour steps.
- [gfa](../gfa/page.md) -- Graphical Forecasts for Aviation, the spatial layer that displays AIRMET polygons alongside ceilings, visibility, and surface analysis.
- [pirep](../pirep/page.md) -- pilot reports, the truth-up. PIREPs confirm or refute what an AIRMET forecasts; absence of confirming PIREPs is not evidence the AIRMET is wrong.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, In-flight Aviation Weather Advisories chapter (format spec for AIRMET / SIGMET / Convective SIGMET text bulletins).
- **AIM** -- 7-1-6 Inflight Aviation Weather Advisories (operational use, valid times, SIERRA / TANGO / ZULU taxonomy).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 26 Advisories, §26.3 AIRMET.
- **aviationweather.gov/airmet** -- AWC product home; current AIRMET bulletins, decoded view, polygon overlay.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of AIRMETs and their sibling SIGMET advisories, see:

- [AIRMETs (Sierra, Tango, Zulu)](../../../../knowledge/weather/product-airmets/node.md)
- [SIGMETs and Convective SIGMETs](../../../../knowledge/weather/product-sigmets/node.md)
