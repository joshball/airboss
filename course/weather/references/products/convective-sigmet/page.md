---
id: wx-ref-convective-sigmet
title: Convective SIGMET (WST)
short_code: WST
category: hazard-advisory
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services -- Convective SIGMET (WST) section'
    note: 'Canonical format spec: trigger thresholds, region split (E/C/W), issuance cycle, valid period, encoded layout.'
  - source: AIM
    section: '7-1-6 -- Inflight Aviation Weather Advisories'
    note: 'Pilot-pitch description of SIGMET, Convective SIGMET, AIRMET, and CWA, including how they relate.'
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Chapter 26 -- Inflight Aviation Weather Advisories, Convective SIGMET subsection'
    note: 'Operational treatment with sample WSTs and the reasoning behind each trigger.'
related_knowledge_nodes:
  - wx-product-sigmets
  - wx-thunderstorm-hazards
related_products:
  - sigmet
  - airmet
  - cwa
  - convective-outlook
  - radar-mosaic
  - satellite
  - pirep
---

# Convective SIGMET (WST)

> Inflight advisory issued for severe thunderstorm activity, lines of thunderstorms, or embedded thunderstorms meeting specific intensity and coverage thresholds. The single most important hazard product on a convective day.

## What it is

A Convective SIGMET (WST, for "Weather Significant -- Thunderstorm") is an inflight aviation weather advisory issued by the Aviation Weather Center (AWC) in Kansas City for thunderstorm activity that meets one of three triggers:

- **Severe thunderstorm** -- surface winds >= 50 kt, hail >= 3/4 inch in diameter, or a tornado.
- **Line of thunderstorms** -- at least 60 nautical miles long, with thunderstorms covering at least 40 percent of that length.
- **Embedded thunderstorms, or thunderstorms with tops above FL350, covering an area of at least 3,000 square miles where storms cover at least 40 percent of that area.**

WSTs are issued on a fixed hourly cycle at H+55 for three regions of the continental US (East, Central, West) and amended off-cycle as conditions change. Each WST is valid for **2 hours** from issuance. Each bulletin also carries an outlook for the following 2-6 hours, describing where convection is expected to develop. Alaska, Hawaii, and offshore areas are covered by their own convective products (CWAs and area SIGMETs) rather than the WST cycle.

The WST is encoded text, but it describes a polygon over a map. Modern EFBs render the polygon graphically, color-coded by region, with motion vectors and tops labeled. The raw text is what you cross-check against the chart, and what dispatchers and instructors quote when they want to be unambiguous about what a WST actually says.

## When you read it

- **Preflight, every flight during convective season** (broadly March through October in the continental US, year-round in the Gulf and Florida). The WST is a primary go/no-go input. If a current WST polygon sits over your route or your destination, the planning problem becomes "how do I avoid it?" before it becomes anything else.
- **En route, continuously when convection is active.** WSTs amend off-cycle as new cells meet trigger criteria, so the picture you launched with can be out of date within an hour. FIS-B uplinks current WSTs to ADS-B In receivers; EFBs render them on the moving map; Flight Service can read them to you on request.
- **A convective SIGMET implies the worst.** When a WST is in effect, the AWC treats severe turbulence, severe icing, IFR conditions, hail, lightning, and microbursts as **implicit** for that area. Those hazards are NOT separately issued as SIGMETs or AIRMETs inside the WST polygon -- the WST is the overriding product. If you see a WST and start looking for a SIGMET for severe turbulence to confirm it, you have misread the system.
- **The decision it informs.** Delay. Reroute. Divert. Cancel. A WST in your corridor at your arrival time is rarely a "press on with care" decision; it is a "what is plan B?" decision.

## How to read it

A convective SIGMET is a fixed-format text bulletin. Each WST in a bulletin run has a region letter (E / C / W) and a numeric designator that increments through the day.

| #   | Field                | Example                                   | Meaning                                                                                                |
| --- | -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Bulletin header      | `MKCE WST 121955`                         | AWC office MKC, region letter `E` (East), product WST, issuance day/time 12 at 19:55Z.                 |
| 2   | Convective SIGMET ID | `CONVECTIVE SIGMET 21E`                   | 21st WST of the day in the East region.                                                                |
| 3   | Valid time           | `VALID UNTIL 2155Z`                       | 2-hour validity from issuance.                                                                         |
| 4   | States / area        | `KS MO`                                   | States covered by the polygon.                                                                         |
| 5   | Trigger type         | `LINE`, `AREA`, `ISOL`, `EMBD TS`         | `LINE` line of TS; `AREA` area of TS; `ISOL` isolated severe cell; `EMBD` embedded (IFR/IMC) TS.       |
| 6   | Polygon              | `FROM 50WNW MCI TO 30S COU ...`           | Vertex list, lat/long or VOR-radial-distance fixes, in order.                                          |
| 7   | Movement             | `MOV FROM 26035KT`                        | Motion vector in FROM/AT format: cells moving FROM 260 AT 35 kt.                                       |
| 8   | Tops                 | `TOPS TO FL450`                           | Echo tops in MSL hundreds of feet.                                                                     |
| 9   | Hazard summary       | `HAIL TO 1 IN. WIND GUSTS TO 60 KT POSS.` | Plain-language description of the worst expected hazards inside the polygon.                           |
| 10  | Outlook              | `OUTLOOK VALID 2155-0155Z`                | 2-6 hour forecast block describing expected development. Non-binding -- forecast intent, not advisory. |

The bulletin can also begin with one or more **OUTLOOK** sections that stand alone: forecasts of convective development for the next 2-6 hours, in areas not currently meeting WST criteria. These are advisory in tone, not operational ("watch this space"), and should not be read as current hazards.

**Trigger type details.**

- **LINE** -- a line of thunderstorms at least 60 NM long with TS covering >= 40 percent. The classic squall line.
- **AREA** -- thunderstorms (often embedded in stratiform precip) covering >= 40 percent of a 3,000 sq mi area, or any area with tops above FL350.
- **EMBD TS** -- embedded thunderstorms inside IMC, usually behind a frontal stratiform shield. The dangerous case: cell location is hidden from the eye and from onboard radar attenuation patterns.
- **ISOL** -- isolated severe cells meeting the severe-thunderstorm definition (>=50 kt winds, >=3/4 in hail, or tornado).

**Motion vector.** `MOV FROM 26035KT` is FROM/AT format, same as winds aloft: the cells are coming from 260 degrees true at 35 kt. To project forward, lay the vector ahead of the polygon along the 260-to-080 line and see where the polygon ends up in 30, 60, 90 minutes. That projection is what tells you whether a WST currently east of your departure is moving away from you or onto your arrival.

**Tops.** Always in MSL, in hundreds of feet. `TOPS TO 450` = tops to FL450. This is the radar echo top, not the cloud top -- visible cirrus blowoff and turbulence can extend several thousand feet higher. The bases are always at or near the surface for a thunderstorm; the cells fill the column.

## Annotated example(s)

### Example 1 -- LINE convective SIGMET, late-spring squall line crossing Kansas and Missouri

Raw product text:

```text
MKCE WST 122055
CONVECTIVE SIGMET 23E
VALID UNTIL 2255Z
KS MO
FROM 40WNW MCI-30W COU-50SW SGF-80WSW ICT-40WNW MCI
LINE TS 30 NM WIDE MOV FROM 26035KT. TOPS TO FL450.
HAIL TO 1 1/2 IN...WIND GUSTS TO 65 KT POSS.
```

Decoded:

- `MKCE WST 122055` -- Aviation Weather Center, Eastern region bulletin, issued day 12 at 20:55Z.
- `CONVECTIVE SIGMET 23E` -- 23rd Eastern-region WST of the day.
- `VALID UNTIL 2255Z` -- valid 2 hours from issuance.
- `KS MO` -- the polygon covers Kansas and Missouri.
- `FROM 40WNW MCI-30W COU-50SW SGF-80WSW ICT-40WNW MCI` -- polygon vertices: 40 NM west-northwest of Kansas City, then to 30 NM west of Columbia, MO, then to 50 NM southwest of Springfield, MO, then to 80 NM west-southwest of Wichita, KS, back to the start. A polygon roughly 200 NM long on its long axis, oriented southwest-to-northeast.
- `LINE TS 30 NM WIDE` -- trigger type LINE: a line of thunderstorms, 30 NM wide perpendicular to the long axis. (The line itself is the long axis of the polygon.)
- `MOV FROM 26035KT` -- moving from 260 at 35 kt. The line will sweep east-northeast about 35 NM per hour. In 2 hours the entire polygon is roughly 70 NM east of its current position, putting the leading edge into central Missouri and Illinois.
- `TOPS TO FL450` -- echo tops to 45,000 ft MSL. Well above any GA-attainable altitude; over-the-top is not an option in any aircraft a typical reader of this page is flying.
- `HAIL TO 1 1/2 IN...WIND GUSTS TO 65 KT POSS.` -- worst-case hazards inside the polygon: hail to 1.5 inch (well past the 3/4 inch severe threshold), surface gusts to 65 kt (past the 50 kt severe threshold).

What this is telling you: a fast-moving severe squall line is sweeping eastbound across Kansas and Missouri at 35 kt, with tops to FL450 and severe-criteria hail and wind. If your flight plan has you crossing Missouri this afternoon, the line is your single biggest planning constraint. You are not flying through it, around it (it is 200 NM long and growing), or over it. You are delaying, diverting south of the southern tip, or holding well west until it clears your route.

### Example 2 -- AREA convective SIGMET, embedded summer thunderstorms over Florida

Raw product text:

```text
MKCE WST 151755
CONVECTIVE SIGMET 11E
VALID UNTIL 1955Z
FL
FROM 30NW ORL-60E ORL-40SE PIE-20NW PIE-30NW ORL
AREA EMBD TS MOV FROM 22015KT. TOPS TO FL480.
HAIL TO 1 IN...WIND GUSTS TO 55 KT POSS.
```

Decoded:

- `MKCE WST 151755` -- AWC Eastern bulletin, day 15 at 17:55Z.
- `CONVECTIVE SIGMET 11E` -- 11th Eastern WST of the day.
- `VALID UNTIL 1955Z` -- 2-hour validity.
- `FL` -- Florida.
- `FROM 30NW ORL-60E ORL-40SE PIE-20NW PIE-30NW ORL` -- polygon over central Florida from northwest of Orlando, east to offshore, south to southeast of St. Petersburg, back northwest.
- `AREA EMBD TS` -- trigger type AREA, with the embedded-thunderstorm sub-classification. Cells are inside broader IMC / stratiform precip, not standing alone in clear air.
- `MOV FROM 22015KT` -- moving from 220 at 15 kt. A slow-moving system: 30 NM per hour, classic summer Florida sea-breeze convection drifting north-northeast.
- `TOPS TO FL480` -- echo tops to 48,000 ft. The Florida warm-season troposphere is deep; FL480 tops in summer are routine, not exceptional.
- `HAIL TO 1 IN...WIND GUSTS TO 55 KT POSS.` -- severe-criteria hail and wind.

What this is telling you: embedded thunderstorms across central Florida, slow-moving, with severe-criteria hail and wind, tops above FL480. The "embedded" word is the load-bearing one: the cells are inside a broader IFR / IMC environment, so visual avoidance is unreliable and onboard weather radar attenuation will make cells beyond the first one look weaker than they are. A VFR flight into this is not on the table. An IFR flight without onboard radar plus datalink weather plus a willingness to deviate, hold, or divert is also not on the table. The slow motion is not a kindness; it means the polygon stays over the same Florida airports for hours, and a delayed launch may not solve anything until evening dissipation.

## Common gotchas

- **The WST is the overriding product for convective activity.** A non-convective SIGMET will not duplicate the severe turbulence, severe icing, hail, or wind shear hazards that are implicit inside a WST polygon. Do not look for a separate SIGMET to "confirm" what the WST already says; it is not coming.
- **The severe-thunderstorm definition is FAA / NWS aviation criteria, not the public severe-storm definition.** Aviation: >=50 kt surface winds, >=3/4 inch hail, or tornado. Some local NWS offices use a slightly different threshold for public severe-weather warnings (1 inch hail). The WST always uses the aviation criteria.
- **Tops are MSL, not AGL.** `TOPS TO 450` = FL450 MSL. For a thunderstorm with a near-surface base, MSL vs AGL is close enough that the gotcha rarely bites on tops -- but the convention matters when you compare against your filed altitude (also MSL) or against a satellite-derived cloud-top product (which may publish in either).
- **Motion is FROM/AT, like winds aloft.** `MOV FROM 26035KT` means the cells are moving FROM the southwest, i.e. toward the northeast. Reading it as "moving to 260" (toward the southwest) reverses your projection and is a common briefing mistake under time pressure.
- **The OUTLOOK section is forecast intent, not a current advisory.** A 2-6 hour outlook says "we expect development here." It is not a hazard polygon you must currently avoid. Treat it as planning input for the second half of your flight, not as a current restriction.
- **ISOL severe cells inside a broader area do not by themselves generate a WST.** Isolated thunderstorms that do not meet severe criteria live in the convective outlook (a separate product), not the WST. The WST triggers are area, line, or severe -- ordinary isolated cells are below the threshold.
- **AOA Alaska, Hawaii, and offshore areas use different products.** The WST cycle (E / C / W) is continental US only. Convective hazards in Alaska are covered via CWAs and SIGMETs issued by the Alaska Aviation Weather Unit; Hawaii and offshore via local SIGMETs and CWSU products. If you fly outside the CONUS, the WST is not your tool.

## Triage

On a convective day, the WST is the single most important hazard product. Eyes go in this order:

1. **Is there a polygon over my route corridor or destination, right now?** Yes -- this is now the planning problem. No -- check the OUTLOOK section for the next 2-6 hours.
2. **What is the motion vector?** Project the polygon forward 30, 60, 90 minutes along the FROM/AT line. Does the projection put it over my route during my arrival window? If yes, the WST and my flight are on a collision course; the question becomes whether departure time shift, route shift, or delay solves it.
3. **What is the trigger type?** LINE means a wall to go around or wait out (rarely "through"). AREA EMBD means visual avoidance is unreliable and even radar-equipped avoidance is hard. ISOL means there is a defined cell, possibly with clear air between adjacent cells, where a deviating IFR or VFR routing might thread through with margin.
4. **What are the tops?** Tops above your filed altitude (almost always; FL450 is above 99 percent of GA flight levels) mean over-the-top is not an option. The cells extend from the surface; you are not flying through them at any altitude.
5. **Cross-check against radar mosaic and satellite.** The WST polygon is the AWC's official call; the radar mosaic shows actual current returns; satellite shows the cloud-top temperature picture. If radar shows the line already past the polygon's eastern edge, the next WST amendment is imminent; do not plan against a stale polygon.

A WST in the corridor at the wrong time is a delay-or-cancel decision. Press-on-and-deviate is a strategy for isolated cells, not for a WST line or area.

## Related products

- [SIGMET (WS)](../sigmet/page.md) -- non-convective hazards (severe icing, severe/extreme turbulence, dust/sand storms, volcanic ash). Read alongside the WST for hazards that are not implicit in convection.
- [AIRMET (WA)](../airmet/page.md) -- below-severe hazards (moderate icing/turbulence, IFR, mountain obscuration). The WST overrides AIRMETs inside its polygon; read AIRMETs for the rest of the route.
- [CWA](../cwa/page.md) -- Center Weather Advisory, issued by individual ARTCC CWSUs for hazards developing inside their airspace, often before a WST amendment catches up. Read for nowcast on a developing situation.
- [Convective outlook](../convective-outlook/page.md) -- SPC product describing the convective potential 1-3 days out. Sets the strategic expectation; the WST is the tactical current advisory.
- [Radar mosaic](../radar-mosaic/page.md) -- ground-truth current returns. Cross-check the WST polygon against where the cells actually are right now.
- [Satellite](../satellite/page.md) -- cloud-top imagery, especially IR. Useful for confirming top heights and finding overshooting tops the radar may not catch.
- [PIREP](../pirep/page.md) -- pilot reports of actual conditions in or near convection. The only product that tells you what someone flying through that air just experienced.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Convective SIGMET (WST) section. Format spec, trigger thresholds, region cycle.
- **AIM** -- 7-1-6, Inflight Aviation Weather Advisories. Pilot-pitch description of WST, SIGMET, AIRMET, CWA, and how they relate.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 26, Convective SIGMET subsection. Operational treatment with sample WSTs.
- Service docs: <https://aviationweather.gov/cwsu> for the convective products area, including current WSTs, amendments, and the regional outlooks.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [SIGMETs and Convective SIGMETs](../../../../knowledge/weather/product-sigmets/node.md) -- the product family, where the WST sits inside it, and why the trigger thresholds are what they are.
- [AIRMETs (Sierra, Tango, Zulu)](../../../../knowledge/weather/product-airmets/node.md) -- the lower-severity tier; the AIRMET vs SIGMET threshold distinction lives here.
- [Thunderstorm hazards](../../../../knowledge/weather/thunderstorm-hazards/node.md) -- the underlying physics of what makes a convective cell dangerous to a flight, which is what the WST is encoding into a polygon.
