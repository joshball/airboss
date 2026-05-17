---
id: wx-ref-cwa
title: Center Weather Advisory (CWA)
short_code: CWA
category: hazard-advisory
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, In-flight Aviation Weather Advisories (Center Weather Advisory)'
    note: 'Format, trigger criteria, and valid time for the CWA product.'
    verified: true
  - source: AIM
    section: '7-1-7'
    note: 'Center Weather Service Unit (CWSU) products: CWA and Meteorological Impact Statement (MIS).'
    verified: false
  - source: FAA-H-8083-28
    section: 'Chapter 26 (CWSU products)'
    note: 'Aviation Weather Handbook, Advisories chapter, CWSU/CWA subsection.'
    verified: false
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - airmet
  - sigmet
  - convective-sigmet
  - pirep
---

# Center Weather Advisory (CWA)

> Short-fuse, ARTCC-scoped in-flight advisory issued by the Center Weather Service Unit (CWSU). Valid up to 2 hours. Bridges the gap between fresh PIREPs / radar / observations and the next formal SIGMET, AIRMET, or Convective SIGMET cycle.

## What it is

A Center Weather Advisory is an unscheduled in-flight aviation weather advisory issued by the **CWSU** (Center Weather Service Unit), a small NWS team co-located at each of the 21 CONUS Air Route Traffic Control Centers (ARTCCs). The CWSU's job is to support ATC inside one center's airspace, and the CWA is the primary product they issue for hazards that are happening *now* or imminently.

Three trigger categories per AC 00-45H and AIM 7-1-7:

- **Approaching, meeting, or exceeding the criteria for a SIGMET, Convective SIGMET, or AIRMET** when none is yet in force, or when the existing advisory does not adequately cover the conditions developing in this ARTCC.
- **Low-level wind shear (LLWS)** affecting aircraft operating within the ARTCC's airspace, typically below 10,000 ft.
- **Other conditions adversely affecting ATC operations** in the center -- for example, ceilings or visibilities driving widespread approach delays, a band of moderate rime ice across the arrival sector, or surface winds shifting the runway flow.

Three properties define how a CWA is used:

- **ARTCC-scoped.** A CWA covers one center's airspace (or a piece of it), not a national region. CWSU Memphis (ZME) issues for ZME; ZDV issues for ZDV. There is no concept of a "national CWA."
- **Short valid time.** Up to **2 hours**. The product is event-driven and amended or reissued as the situation evolves.
- **Pre-SIGMET tip.** When a CWA forecasts conditions that will meet SIGMET / AIRMET criteria, it is often the first advisory on the wire. The corresponding AWC-issued AIRMET or SIGMET typically follows, but the CWA leads by minutes to hours.

CWAs coexist with AIRMETs, SIGMETs, and Convective SIGMETs; they do not replace them. A pilot transiting the ZID and ZME boundary in a developing line of thunderstorms can have a Convective SIGMET, a ZID CWA, and a ZME CWA all active for the same weather system at the same time, each with a slightly different polygon, altitude band, and outlook.

## When you read it

- **En route through high-traffic ARTCC airspace** -- IFR transition through ZNY (New York), ZID (Indianapolis), ZAU (Chicago), ZME (Memphis), or any of the busy centers. Check the host center's CWA stream the same way you check ATIS for the destination.
- **Preflight, after the AIRMET / SIGMET scan** -- pull the CWAs for the centers your route crosses. They give you the freshest reading of what the ARTCC meteorologist is actually worried about.
- **When an existing AIRMET feels stale** -- if the AIRMET was issued at 1445Z and it's now 1830Z and conditions are clearly different on radar, the CWA is usually where the updated picture lives until the next AIRMET cycle at 2045Z.
- **As a pre-SIGMET tip** -- a CWA citing "approaching SIGMET criteria" is the early warning. Treat it as if the SIGMET is already out for routing decisions, even before the AWC bulletin lands.

What it decides:

- **Route selection** -- CWAs frequently drive ATC reroutes and gate holds; reading them aligns your expectations with what ATC is about to do.
- **Altitude selection** -- a CWA citing moderate-to-severe turbulence in a band drives the climb-through-or-stay-below call.
- **Time-shift** -- if the CWA outlook says conditions will clear in 90 minutes, holding short for a delayed departure may be cheaper than rerouting.

Where it fits the briefing pack: read alongside AIRMETs and SIGMETs as the **center-local layer**, between the national-scale AWC products and the airport-scale TAF / METAR.

## How to read it

A CWA is encoded text. The header identifies the issuing center and the advisory number; the body identifies the affected area (often as VOR radials), the hazard, the altitude band, the motion, and the outlook.

| Field           | Example                            | Meaning                                                                                                               |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Header          | `ZID01 CWA 211425`                 | Issuing ARTCC (`ZID` = Indianapolis), advisory number (`01` = first CWA of the day for this hazard), DDHHMM issuance. |
| Center ID       | `ZID`                              | ICAO-style ARTCC identifier. ZID = Indianapolis, ZME = Memphis, ZDV = Denver, ZNY = New York, ZSE = Seattle, etc.     |
| Advisory series | `CWA 01`                           | Two-digit series number, increments per hazard line within a calendar day.                                            |
| Valid period    | `VALID UNTIL 211625`               | DDHHMM expiry, UTC. Up to 2 hours from issuance.                                                                      |
| Hazard          | `TS DVLPG`, `MOD-SEV TURB`, `LLWS` | Free-text hazard description: developing thunderstorms, moderate-to-severe turbulence, low-level wind shear, etc.     |
| Area            | `FROM 30W BWG TO HNN TO ...`       | Polygon as a chain of VOR radials, named fixes, or FIR boundaries. Same convention as AIRMET / SIGMET.                |
| Altitude band   | `BLO FL250` / `SFC-100`            | Below FL250, or surface to 10,000 ft MSL, etc. CWAs frequently cover specific bands rather than the whole column.     |
| Motion          | `MOV E 30KT` / `LTL MOVMNT`        | Direction and speed; "little movement" for slow-moving features.                                                      |
| Outlook         | `CONDS CONTG BYD 1625Z`            | Continuation forecast past the valid time; signals whether a follow-on CWA or SIGMET is coming.                       |

CWAs do not use the AIRMET phonetic-letter taxonomy (SIERRA / TANGO / ZULU) and do not use the SIGMET designator taxonomy (NOVEMBER through YANKEE). The numbered series is local to the issuing center.

The polygon convention is the same as AIRMET / SIGMET: a chain of points expressed as VOR/DME radial-distance fixes or named navaids. Decoding the polygon requires a chart -- on an EFB this renders automatically; from raw text you walk the radials. A CWA that reads `FROM 30W BWG TO HNN TO HMV TO 20N BWG TO 30W BWG` traces a quadrilateral roughly bounded by Bowling Green KY (BWG), Henderson WV (HNN), Holston Mountain VA (HMV), and back.

## Annotated examples

### Example 1 -- developing thunderstorm line, ZME (Memphis)

Raw product text:

```text
ZME1 CWA 211845
ZME CWA 01 VALID UNTIL 212045
LN TS DVLPG ALG A LN FROM 30W MEM TO 20S MKL TO 30E LIT.
TOPS TO FL420. MOV E 30KT. CB INTSFG. CONDS CONTG BYD 2045Z.
```

Decoded:

- `ZME1 CWA 211845` -- issuing ARTCC Memphis (ZME), advisory series 1, issued the 21st at 1845Z.
- `ZME CWA 01 VALID UNTIL 212045` -- first CWA of this hazard line, valid until 21/2045Z. Two-hour window from issuance.
- `LN TS DVLPG ALG A LN` -- a line of developing thunderstorms organized along a line. "Developing" means cells are forming and intensifying, not just maintaining.
- Polygon: `FROM 30W MEM TO 20S MKL TO 30E LIT TO 30W MEM`. 30 NM west of Memphis (MEM), down to 20 NM south of Jackson TN (MKL), over to 30 NM east of Little Rock (LIT), back. Roughly a triangular band cutting northwest-to-southeast through northern Mississippi, western Tennessee, and eastern Arkansas.
- `TOPS TO FL420` -- echo tops to 42,000 ft. This is a strong line; tops above FL400 indicate vigorous convection capable of severe-category hazards (severe turbulence, hail, lightning) inside and downwind of each cell.
- `MOV E 30KT` -- the line moves east at 30 KT. In a two-hour window, the affected airspace shifts about 60 NM to the east.
- `CB INTSFG` -- cumulonimbus intensifying. Not steady-state; getting worse.
- `CONDS CONTG BYD 2045Z` -- expected to continue past the 2045Z expiration; a follow-on CWA, or a Convective SIGMET from AWC, is likely.

What this is telling you: a developing, intensifying line of thunderstorms with tops above FL400 is moving east across the ZME boundary. For any GA flight in or near the polygon at any altitude, this is a divert / hold / wait. The CWA is the early warning; expect a Convective SIGMET on the next H+55 issuance to cover the same line as an AWC product. Cross-check radar mosaic and PIREPs; PIREPs from aircraft skirting the line will confirm severity faster than the next forecast cycle.

### Example 2 -- moderate-to-severe lee-wave turbulence, ZDV (Denver)

Raw product text:

```text
ZDV3 CWA 211615
ZDV CWA 03 VALID UNTIL 211815
MOD-SEV TURB BLO FL250 ALG AND E OF THE FRONT RANGE
FROM 30N DEN TO 40SW LAR TO 30S COS TO 30N DEN.
LEE WAVE ACT WITH STG WLY FLOW AT MTN TOPS. RPRTD BY ACFT.
CONDS CONTG BYD 1815Z.
```

Decoded:

- `ZDV3 CWA 211615` -- Denver ARTCC, advisory series 3, issued the 21st at 1615Z.
- `ZDV CWA 03 VALID UNTIL 211815` -- third CWA of the day for this hazard, valid until 21/1815Z, two hours.
- `MOD-SEV TURB BLO FL250` -- moderate-to-severe turbulence below FL250. Spans the typical GA cruise band (8,000-18,000 ft) and the low-flight-level turboprop band (FL200-FL250).
- `ALG AND E OF THE FRONT RANGE` -- along and east of the Front Range of the Rockies. Classic lee-wave geometry: strong westerly flow over the ridge produces standing mountain waves and rotor turbulence in the lee.
- Polygon: `FROM 30N DEN TO 40SW LAR TO 30S COS TO 30N DEN`. 30 NM north of Denver (DEN), down to 40 NM southwest of Laramie WY (LAR), to 30 NM south of Colorado Springs (COS), back. A triangular band across the Front Range / I-25 corridor.
- `LEE WAVE ACT WITH STG WLY FLOW AT MTN TOPS` -- the mechanism: strong westerly flow at mountain-top level (roughly FL140-FL200 for the Front Range) producing active lee-wave turbulence. Mountain-top winds drive the wave; the rotor and downwash extend well east of the ridge.
- `RPRTD BY ACFT` -- pilots are already reporting it. PIREP-confirmed, not just forecast.
- `CONDS CONTG BYD 1815Z` -- expected to continue past expiration.

What this is telling you: the lee of the Front Range is in a mountain-wave event with moderate-to-severe turbulence reported by aircraft, below FL250. For a piston single eastbound across the Front Range, the altitude options are limited -- climbing above FL250 is not available, and the band covers the practical GA cruise altitudes. Workable choices: route around the polygon to the south or north, delay until the wave breaks (often after sunset or with a wind shift), or accept severe turbulence with proper aircraft and pilot capability (rarely the answer in a GA single). A SIGMET for severe turbulence above FL250 may be on the wire separately; the CWA is the below-FL250 layer the AWC product does not always cover at center-local resolution.

## Common gotchas

- **CWAs are ARTCC-specific, not nationwide.** A CWA from ZID does not cover the rest of the country. If your route crosses three centers, check three CWA streams. The boundary between ZID and ZME is a paperwork seam, not a weather seam -- the weather doesn't stop at the FIR boundary, but the CWA does.
- **Valid 2 hours.** Shorter than every other in-flight advisory. A CWA you read 90 minutes ago is nearly expired. Re-pull before takeoff and at least once per hour en route through the issuing center.
- **Often the tip of the iceberg.** A CWA citing "approaching SIGMET criteria" or "TS DVLPG" frequently precedes a Convective SIGMET or AIRMET. Reading it as a complete picture of the hazard is wrong; the rest of the picture is coming on the AWC cycle.
- **VOR-radial polygons need a chart.** The polygon is text; the geometry is on the chart. `FROM 30W BWG TO HNN` is two points on a sectional or low-altitude IFR chart. On an EFB it renders automatically; from raw text alone, you have to walk it.
- **CWAs coexist with AIRMETs / SIGMETs, not replace them.** The same weather event can have a CWA, an AIRMET, and a SIGMET active simultaneously, each with slightly different polygons, altitudes, and times. The CWA is the freshest, smallest-area read. Cross-check, do not pick one.
- **No phonetic-letter taxonomy.** Unlike AIRMET (SIERRA / TANGO / ZULU) or SIGMET (NOVEMBER through YANKEE), CWAs are numbered per center per day. The number is a serial, not a hazard tag.
- **LLWS CWAs are altitude-specific.** A CWA for low-level wind shear typically affects the approach and departure corridors; "below 10,000 ft" usually means the affected layer is well below that. Read the altitude band.
- **Distinct from Meteorological Impact Statement (MIS).** The CWSU also issues MIS products for longer-fuse planning impacts (typically 2-12 hours ahead). MIS is planning, CWA is now. Don't confuse them.

## Triage

Sixty seconds with a CWA stream and a route:

1. **Which centers does my route cross?** Identify the ARTCC IDs (ZID, ZME, ZDV, etc.). Pull CWAs only for those.
2. **Does any active CWA polygon intersect my route corridor?** Out-of-corridor = informational; intersecting = action.
3. **Does the altitude band intersect my filed altitude?** A `BLO FL250` band covers everything below FL250; a `SFC-100` band covers a piston single at 8,000 ft but not a turboprop at FL220.
4. **Does the valid time bracket my time-on-station?** A CWA expiring in 30 minutes when I'm 90 minutes away is a "wait for the follow-on" read; one valid through my transit window is a current input.
5. **Outlook -- is it continuing or clearing?** `CONDS CONTG BYD ...` says the hazard outlives the valid window; expect a successor CWA. Absence of an outlook line suggests the issuer expects the hazard to abate by expiry.
6. **Cross-check with PIREPs.** A CWA backed by recent PIREPs is fully real; a CWA from forecast alone is still real, but PIREPs sharpen the picture.

Because CWAs are short-fuse and center-local, they are frequently the most current advisory for the airspace you're actually flying through. When the AIRMET cycle is mid-window and conditions are changing, the CWA is where the change shows up first.

## Related products

- [AIRMET](../airmet/page.md) -- the AWC-issued moderate-tier sibling. AIRMET is national, 6-hour cycle; CWA is ARTCC-local, 2-hour cycle.
- [SIGMET](../sigmet/page.md) -- the AWC-issued severe-tier sibling for non-convective hazards. A CWA citing "approaching SIGMET criteria" frequently leads a SIGMET issuance.
- [Convective SIGMET](../convective-sigmet/page.md) -- thunderstorm-specific AWC SIGMET, issued hourly at H+55. CWAs for developing convection often precede the Convective SIGMET cycle.
- [PIREP](../pirep/page.md) -- pilot reports. CWAs frequently cite "RPRTD BY ACFT" when PIREPs have already confirmed the hazard; PIREPs are the truth-up against any CWA forecast.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, In-flight Aviation Weather Advisories chapter, Center Weather Advisory section.
- **AIM 7-1-7** -- Center Weather Service Unit (CWSU) Products: CWA and Meteorological Impact Statement (MIS).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 26 Advisories, CWSU/CWA subsection.
- Service page: aviationweather.gov product index (CWA bulletins; ARTCC-indexed).

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of CWAs alongside their sibling AWC advisories, see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md)
