---
id: wx-ref-weather-tfr
title: Weather-related TFR (TFR)
short_code: TFR
category: tfr-notam
tier: 2
status: draft
authoritative_sources:
  - source: 14 CFR 91.137
    section: '(a)(1), (a)(2), (a)(3)'
    note: Legal basis. (a)(1) protects persons/property on the surface from an existing/imminent hazard, (a)(2) provides a safe environment for disaster/hazard relief aircraft, (a)(3) prevents unsafe congestion of sightseeing aircraft above an incident.
    verified: false
  - source: AIM
    section: 5-6-2
    note: Temporary Flight Restrictions. Operational description of TFR types, NOTAM dissemination, and pilot responsibilities.
    verified: false
  - source: FAA-H-8083-28
    section: Chapter 27 (NOTAMs and TFRs)
    note: Aviation Weather Handbook discussion of weather-driven flight restrictions within the NOTAM ecosystem.
    verified: false
  - source: tfr.faa.gov
    section: ''
    note: FAA's live TFR catalog. Convenient graphical view; the underlying NOTAM text is the legal product.
    verified: true
  - source: NOTAM Search
    section: notams.aim.faa.gov
    note: Authoritative source for the NOTAM text that creates the TFR.
    verified: true
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - weather-notam
  - airmet
  - sigmet
  - convective-sigmet
  - volcanic-ash-advisory
  - tropical-cyclone-advisory
---

# Weather-related TFR (TFR)

> Temporary Flight Restriction issued under 14 CFR 91.137 to protect aircraft and ground assets from a specific weather or hazard event (hurricane, wildfire smoke, volcanic eruption). Disseminated as a NOTAM; a hard airspace closure with regulatory and certificate consequences for violators.

## What it is

A Temporary Flight Restriction (TFR) is a defined volume of airspace where flight operations are restricted or prohibited for a specified period of time. Weather-related TFRs are issued under **14 CFR 91.137**, which gives the FAA Administrator authority to designate restricted airspace when there is a specific hazard. Three subparagraphs of 91.137(a) are the legal hooks:

- **91.137(a)(1)** -- to protect persons and property on the surface from an existing or imminent hazard.
- **91.137(a)(2)** -- to provide a safe environment for the operation of disaster relief aircraft.
- **91.137(a)(3)** -- to prevent an unsafe congestion of sightseeing and other aircraft above an incident or event that may generate a high degree of public interest.

In practice, weather-driven TFRs almost always cite **(a)(1)** plus **(a)(2)**: protect people on the ground from the hazard, and reserve the airspace for the response aircraft (air tankers, helicopters, hurricane relief flights, ash-monitoring research aircraft). The (a)(3) sightseeing prohibition rides along when the event draws public interest.

Triggering events:

- **Wildfires** producing dense smoke and active aerial firefighting -- by far the most common weather-related TFR in the lower 48.
- **Hurricanes and tropical cyclones** -- TFRs over and around landfall zones, often paired with the FAA-coordinated relief-flight regime.
- **Volcanic eruptions** -- ash plume and surface-hazard exclusions; coordinates with the volcanic ash advisory (VAA) and SIGMET.
- **Other natural disasters** -- flooding, tornado-disaster response, major industrial events with air-quality implications.

Weather TFRs are distinct from:

- **Sporting-event TFRs (14 CFR 91.145)** -- stadium overflights, sustained 3 NM lateral / 3,000 ft AGL vertical.
- **VIP / National Security TFRs (14 CFR 99.7)** -- Presidential movements, special-events airspace.
- **Space launch / re-entry TFRs** -- a separate authority class.

Each TFR has four defining attributes the pilot must extract from the NOTAM text:

- **Geographic shape** -- circle (center fix + radius), polygon (chain of fixes / lat-longs), or a named airspace.
- **Altitudes** -- surface up to a specified MSL or flight level.
- **Effective window** -- start and end times in UTC; can be open-ended ("UFN" = until further notice).
- **Operational rule** -- typically "no person may operate an aircraft in the designated area" with named exceptions (firefighting / relief flights, law enforcement, aircraft with prior ATC authorization).

## When you read it

Weather TFRs are caught at **NOTAM check time** during preflight planning. There is no separate weather product to subscribe to; the TFR is a NOTAM, and you find it the same way you find any other NOTAM that affects your departure, route, or destination.

- **Always in preflight** -- pull NOTAMs for your departure, destination, all alternates, and the route (FDC NOTAMs by ARTCC if you're not on a published route). A weather TFR is an FDC NOTAM and shows up in the standard briefing.
- **Re-check before engine start** -- weather TFRs can be issued with very short notice. A wildfire that flared up 90 minutes before your departure may have a fresh TFR you didn't see at 0500 local. Re-pull NOTAMs.
- **En route awareness** -- listen for ATIS / Flight Service broadcasts; EFBs (ForeFlight, Garmin Pilot) pull live TFR overlays and will alert when your route intersects a new one.

What it decides:

- **Go / no-go** -- a TFR over your destination is a hard close. You go somewhere else or you don't go.
- **Route selection** -- a TFR on your filed route forces a deviation around it; for a circular 5 NM wildfire TFR that's usually a small adjustment, for a 30 NM hurricane TFR it can be a major reroute.
- **Altitude selection** -- many wildfire TFRs cap at 10,000 to 12,500 ft MSL to leave airspace above for transient traffic. If you can climb above the cap, you may legally pass over the polygon.

## How to read it

Weather TFRs are disseminated as FDC NOTAMs in fixed-format text. The structure follows the standard NOTAM format with a 91.137-specific body.

| Field             | Example                                                                                                                                         | Meaning                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| NOTAM ID          | `!FDC 4/8392`                                                                                                                                   | FDC NOTAM, sequence 4/8392. FDC = Flight Data Center, the office that publishes regulatory NOTAMs. |
| Affected area     | `ZOA CA..AIRSPACE`                                                                                                                              | ARTCC and state. ZOA = Oakland Center; CA = California. AIRSPACE flags this as an airspace item.   |
| Authority         | `TEMPORARY FLIGHT RESTRICTIONS`                                                                                                                 | This NOTAM is a TFR. The body will cite the specific 91.137 subparagraph.                          |
| Hazard            | `WILDFIRE FIREFIGHTING OPERATIONS`                                                                                                              | The triggering event. Identifies the type of TFR for triage.                                       |
| Effective times   | `EFFECTIVE 2511291800 UTC UNTIL 2512011800 UTC`                                                                                                 | Start and end in UTC. UFN = until further notice; open-ended cancellation by NOTAM.                |
| Center point      | `PURSUANT TO 14 CFR SECTION 91.137(A)(1) AND (A)(2) TEMPORARY FLIGHT RESTRICTIONS WITHIN AN AREA DEFINED AS 5NM RADIUS OF 38-45-30N 122-30-15W` | Citing legal authority; defining the geometry. Lat/long is degrees-minutes-seconds.                |
| Altitude band     | `SFC-12500FT MSL`                                                                                                                               | Surface to 12,500 ft MSL. Below this top, you're in the TFR; above it, you're clear.               |
| Operational rule  | `NO PILOT MAY OPERATE AN AIRCRAFT IN THE AREAS COVERED BY THIS NOTAM (EXCEPT AS DESCRIBED) ...`                                                 | The 91.137 prohibition.                                                                            |
| Exceptions        | `EXCEPT AIRCRAFT PARTICIPATING IN FIREFIGHTING OPERATIONS / RELIEF AIRCRAFT OPERATIONS UNDER THE DIRECTION OF...`                               | Named exempt categories. If you're not on this list, you're prohibited.                            |
| Coordinating fac. | `OAKLAND ARTCC TELEPHONE 510-745-3360`                                                                                                          | Who to call for clearance or coordination.                                                         |

Geographic reference variants you will see:

- **Lat/long + radius** -- `5NM RADIUS OF 38-45-30N 122-30-15W`. Most common for wildfires.
- **VOR/DME radial-distance** -- `15NM RADIUS OF THE OAKLAND VORTAC (OAK) 030 RADIAL AT 22 NM`. Older form; still used.
- **Polygon by lat/long points** -- `BOUNDED BY 38N 122W TO 38N 121W TO 37N 121W TO 37N 122W TO POINT OF ORIGIN`. Used for hurricane swath / large irregular shapes.
- **Named airspace** -- `WITHIN THE SAN FRANCISCO CLASS B SURFACE AREA`. Rare for weather TFRs.

Plot the polygon on a chart (sectional or low-altitude IFR) or pull it up on an EFB. The TFR overlay on ForeFlight / Garmin Pilot is generated from the same NOTAM text and is convenient, but **the NOTAM text is the legal product**. If an EFB and the NOTAM disagree, the NOTAM wins.

## Annotated example(s)

### Example 1 -- Wildfire TFR over Northern California (91.137(a)(1) + (a)(2))

Raw product text:

```text
!FDC 4/8392 ZOA CA..AIRSPACE..TEMPORARY FLIGHT RESTRICTIONS
PURSUANT TO 14 CFR SECTION 91.137(A)(1) AND (A)(2)
TEMPORARY FLIGHT RESTRICTIONS WITHIN AN AREA DEFINED AS
5NM RADIUS OF 38-45-30N 122-30-15W (SAC 015024.6) SFC-12500FT MSL
TO PROVIDE A SAFE ENVIRONMENT FOR FIRE FIGHTING AIRCRAFT
OPERATIONS. PACIFIC PEAK FIRE.
EFFECTIVE 2511291800 UTC (1100 PST) UNTIL FURTHER NOTICE.
THE FOLLOWING OPERATIONS ARE AUTHORIZED IN THE AREA:
AIRCRAFT PARTICIPATING IN FIREFIGHTING OPERATIONS AT THE
DIRECTION OF INCIDENT COMMANDER OPS BRANCH DIRECTOR (805-555-0142);
AIRCRAFT CARRYING LAW ENFORCEMENT OFFICIALS ON OFFICIAL BUSINESS;
AIRCRAFT CARRYING PROPERLY ACCREDITED NEWS REPRESENTATIVES WHO
HAVE FILED A FLIGHT PLAN WITH AT LEAST ONE HOUR ADVANCE NOTICE
WITH OAKLAND ARTCC.
OAKLAND ARTCC TELEPHONE 510-745-3360 IS THE COORDINATION FACILITY.
```

Decoded:

- **NOTAM ID** -- `!FDC 4/8392`. FDC NOTAM, sequence 4/8392. The exclamation mark prefix is the FAA NOTAM marker; FDC denotes Flight Data Center / regulatory NOTAM.
- **Affected ARTCC + state** -- `ZOA CA..AIRSPACE`. Oakland Center, California, an airspace restriction.
- **Authority** -- `PURSUANT TO 14 CFR SECTION 91.137(A)(1) AND (A)(2)`. Hazard on the surface plus relief-aircraft environment. Standard pairing for fire TFRs.
- **Geometry** -- `5NM RADIUS OF 38-45-30N 122-30-15W`. Center at 38 deg 45 min 30 sec N, 122 deg 30 min 15 sec W; the parenthetical `(SAC 015024.6)` gives the same point as a radial and distance from the Sacramento VORTAC (SAC), 015 radial at 24.6 NM. Either reference frame should plot to the same point; cross-check both on the chart.
- **Altitude band** -- `SFC-12500FT MSL`. Surface to 12,500 ft MSL. A non-deiced piston single can legally overfly at 13,000 ft (subject to oxygen rules above 12,500 for more than 30 min and 14,000 continuous).
- **Effective window** -- `EFFECTIVE 2511291800 UTC (1100 PST) UNTIL FURTHER NOTICE`. From 29 November 2025 at 1800Z. UFN means the TFR remains in force until the FAA cancels it by NOTAM; check at every preflight while it's active.
- **Hazard identifier** -- `PACIFIC PEAK FIRE`. The incident name. Useful for cross-referencing news reports and InciWeb.
- **Exception list** -- firefighting aircraft at incident commander's direction, law enforcement on official business, accredited news with prior flight plan + 1 hr notice via Oakland ARTCC. If you are not in one of these categories, you may not enter.
- **Coordinating facility** -- Oakland ARTCC at 510-745-3360. The number to call if you have a legitimate need to enter or transit.

What this is telling you: there is a 10 NM diameter cylinder of airspace from the surface to 12,500 ft over the Pacific Peak fire in Northern California, reserved for firefighting aircraft. A VFR cross-country planning to route through this lat/long is replanning. Either around the 5 NM circle (a small lateral deviation) or above the 12,500 ft cap with oxygen and the performance to get there. Calling the Oakland ARTCC number to "ask permission" is not how this works; the exception list is the exception list.

### Example 2 -- Hurricane relief TFR over Gulf coast (91.137(a)(1), (a)(2), and (a)(3))

Raw product text:

```text
!FDC 4/9214 ZHU LA..AIRSPACE..TEMPORARY FLIGHT RESTRICTIONS
PURSUANT TO 14 CFR SECTION 91.137(A)(1), (A)(2), AND (A)(3)
HURRICANE DISASTER RELIEF OPERATIONS. HURRICANE MARGARET.
TEMPORARY FLIGHT RESTRICTIONS WITHIN AN AREA DEFINED AS
30NM RADIUS OF 29-58-00N 090-15-00W (MSY 070009.4) SFC-18000FT MSL
EFFECTIVE 2509150000 UTC UNTIL 2509220000 UTC.

PURPOSE: TO PROVIDE A SAFE ENVIRONMENT FOR DISASTER RELIEF
AIRCRAFT OPERATIONS AND TO PREVENT UNSAFE CONGESTION OF
SIGHTSEEING AIRCRAFT OVER A SIGNIFICANT INCIDENT.

ONLY THE FOLLOWING OPERATIONS ARE AUTHORIZED:
DISASTER RELIEF AIRCRAFT OPERATING UNDER FAA AIR TRAFFIC CONTROL
APPROVED FLIGHT PLANS COORDINATED THROUGH FEMA OR THE STATE
EMERGENCY OPERATIONS CENTER; SCHEDULED PASSENGER CARRYING
OPERATIONS UNDER 14 CFR PARTS 121, 129, AND 135; LAW ENFORCEMENT
AND MILITARY AIRCRAFT ON OFFICIAL BUSINESS.

ALL OTHER FLIGHTS, INCLUDING NEWS MEDIA AND SIGHTSEEING, ARE
PROHIBITED. HOUSTON ARTCC TELEPHONE 281-230-5500.
```

Decoded:

- **NOTAM ID** -- `!FDC 4/9214 ZHU LA`. FDC sequence 4/9214, Houston Center (ZHU), Louisiana.
- **Authority** -- 91.137 (a)(1) + (a)(2) + (a)(3). All three subparagraphs: protect surface assets from continuing hazard, reserve airspace for relief, and prevent sightseeing congestion.
- **Geometry** -- `30NM RADIUS OF 29-58-00N 090-15-00W`. Centered on greater New Orleans (the lat/long is roughly downtown; cross-reference is MSY VORTAC 070 radial at 9.4 NM).
- **Altitude band** -- `SFC-18000FT MSL`. Surface to FL180. A large block of airspace; you cannot legally overfly under VFR.
- **Effective window** -- `EFFECTIVE 2509150000 UTC UNTIL 2509220000 UTC`. From 15 September 2025 00Z to 22 September 2025 00Z. A 7-day window with a hard end; if relief operations extend, expect an extension NOTAM.
- **Exception list** -- FEMA / state-coordinated relief flights, scheduled airline / commuter ops under Parts 121 / 129 / 135, law enforcement and military. Notably, news media is explicitly prohibited here (contrast with Example 1's fire TFR, where accredited news with prior notice was allowed); the (a)(3) sightseeing component has tightened the rule.
- **Coordinating facility** -- Houston ARTCC.

What this is telling you: a 60 NM diameter block of airspace from the surface to FL180 is closed over greater New Orleans for a week of hurricane relief operations. A Part 91 GA pilot transiting the Gulf coast routes well around or waits it out. Even with an aircraft capable of FL190+, you have not just to be above the TFR but also clear of any companion restrictions (oceanic, military operations supporting relief, etc.); plan the route from scratch rather than nudging the original.

## Common gotchas

- **TFRs are issued with very short notice.** A wildfire that flares up at noon can have a TFR by 1500Z. The NOTAM you pulled at 0500 may not exist when you launch at 1300. Re-check NOTAMs at engine start, not just at flight planning.
- **"No operations except authorized" means what it says.** 91.137 violations result in certificate suspension or revocation, civil penalties, and (in disaster TFRs) potential additional consequences. There is no informal "I'll just transit quickly" loophole; the enforcement posture for wildfire and disaster TFRs is severe because interference grounds the relief operation.
- **The NOTAM text is the legal product.** tfr.faa.gov and EFB overlays are convenient renderings. If an EFB shows a 5 NM circle but the NOTAM defines a 6 NM circle, the NOTAM wins. Read the NOTAM, not just the picture.
- **Lat/long is degrees-minutes-seconds (DDMMSS).** `38-45-30N 122-30-15W` is 38 deg 45' 30" N, not 38.4530 deg. Plot it correctly; a decimal-vs-DMS error is a 30+ NM mis-plot.
- **The MSL ceiling matters.** A wildfire TFR capped at 12,500 ft MSL over 7,000-ft terrain leaves only 5,500 ft of vertical column above the MSL terrain elevation. Performance / weather / oxygen feasibility may eliminate the overfly option even though the TFR doesn't reach your cruise.
- **"UFN" expirations require active re-check.** Until further notice means there is no scheduled end; the FAA cancels by issuing another NOTAM. Don't assume the TFR is over because you haven't heard about it; pull NOTAMs every preflight.
- **Polygon descriptions can be long.** Hurricane TFRs sometimes have 10+ vertex polygons. Don't skim. One unread vertex puts the TFR's eastern boundary 40 NM further than you assumed.
- **News media exceptions vary.** Wildfire TFRs sometimes allow accredited news with prior coordination; disaster-relief TFRs often prohibit news entirely under (a)(3). Read the exception list for each TFR; don't generalize from a previous one.
- **VFR flight following does not create an exception.** ATC providing you VFR advisories is not "ATC authorization to enter restricted airspace." If you're not on the exception list, talking to ATC doesn't get you in.

## Triage

When a weather TFR is on your route, the triage path is rarely "negotiate the entry"; it's "replan." A 60-second decision tree:

1. **Is my route inside the polygon?** Plot it. Be precise with the geometry; near-misses count as misses, but don't fudge. If yes, go to (2). If no, monitor the TFR as a hazard signal (smoke, turbulence, ash in the vicinity) but the airspace question is closed.
2. **Is my cruise altitude above the TFR ceiling?** If yes (and you have the aircraft / oxygen / weather to make that altitude), overfly. Confirm the lateral polygon doesn't extend further than you think and that descent profiles don't dip into the cylinder.
3. **Can I route laterally around?** Most wildfire TFRs (5-10 NM radius) allow a clean lateral deviation; most hurricane TFRs (30+ NM radius) require a major reroute or a wait.
4. **Can I delay until the TFR cancels?** Check the effective end. UFN expirations are pure uncertainty. A 6-hour wait for a known cancellation is a different decision than an open-ended wait on a UFN.

If you are on the exception list (relief flight, firefighting contractor, law enforcement on duty), the triage is different: you contact the coordinating facility and operate per the procedures named in the NOTAM. For a Part 91 pilot transiting, the answer is replan or wait, not "ask if it's OK."

Hard rule: TFR enforcement is taken seriously. The FSDO and ARTCC track intrusions, often with radar tape; the consequences are not theoretical.

## Related products

- [weather-notam](../weather-notam/page.md) -- the broader NOTAM family for weather (runway closures, ILS outages tied to weather damage). Weather TFRs are a specific FDC NOTAM subclass.
- [airmet](../airmet/page.md) -- the area-hazard advisory layer the TFR may share airspace with (an AIRMET ZULU often coexists with a winter-storm TFR; an AIRMET TANGO often surrounds a hurricane TFR).
- [sigmet](../sigmet/page.md) -- significant weather for all aircraft. A hurricane or volcanic eruption typically generates a SIGMET and a TFR; the SIGMET covers the weather hazard, the TFR covers the airspace closure.
- [convective-sigmet](../convective-sigmet/page.md) -- thunderstorm-specific advisory. Convective SIGMETs do not create TFRs by themselves; tornado-disaster response can produce a 91.137 TFR after the fact.
- [volcanic-ash-advisory](../volcanic-ash-advisory/page.md) -- VAA from the responsible Volcanic Ash Advisory Center. Pairs with both a SIGMET (ash plume aloft) and a TFR (surface hazard / response airspace).
- [tropical-cyclone-advisory](../tropical-cyclone-advisory/page.md) -- tropical forecast products that drive hurricane TFRs as a downstream consequence.

## Authoritative sources

- **14 CFR 91.137** -- Temporary flight restrictions in the vicinity of disaster/hazard areas. The legal basis for every weather-related TFR; subparagraphs (a)(1), (a)(2), and (a)(3) define the three triggers.
- **AIM 5-6-2** -- Temporary Flight Restrictions. Operational description of TFR types, NOTAM dissemination, pilot responsibilities, exception categories.
- **FAA-H-8083-28** -- Aviation Weather Handbook, NOTAM / TFR chapter (Chapter 27 in the current edition).
- **tfr.faa.gov** -- FAA's live TFR catalog with map view. Convenient for situational awareness; the underlying NOTAM is the legal product.
- **NOTAM Search (notams.aim.faa.gov)** -- authoritative source for the NOTAM text creating the TFR. Use this for the legal product.
- **AIM 5-1-3** -- Notice to Air Missions System. Broader NOTAM categorization (FDC, NOTAM(D), military) that places the TFR FDC in context.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of in-flight advisories that surround weather TFRs (SIGMETs / AIRMETs for the weather hazard itself), see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md)
