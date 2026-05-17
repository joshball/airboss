---
id: wx-ref-tropical-cyclone-advisory
title: Tropical Cyclone Advisory (TCA)
short_code: TCA
category: hazard-advisory
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Tropical Cyclone Advisory'
    note: 'Format spec, TCAC issuing authorities, content of position / intensity / motion / forecast fields.'
    verified: true
  - source: AIM
    section: '7-1'
    note: 'In-flight Aviation Weather Advisories, tropical cyclone references and pairing with the TC SIGMET.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Tropical Weather chapter (cyclone structure, intensity scales, advisory products)'
    note: 'Modern consolidated treatment of tropical cyclones and the advisory products that describe them.'
    verified: true
related_knowledge_nodes:
  - wx-product-sigmets
related_products:
  - wx-ref-sigmet
  - wx-ref-weather-tfr
  - wx-ref-surface-analysis
  - wx-ref-satellite
  - wx-ref-prog-chart
---

# Tropical Cyclone Advisory (TCA)

> A TCAC-issued (or NHC-issued) advisory naming a tropical cyclone, giving its current position, intensity, and motion, plus forecast positions at +12 / +24 hours, so flight planners know where the storm is now and where it will be when you arrive.

## What it is

A Tropical Cyclone Advisory is the meteorological product describing a tropical cyclone (tropical depression, tropical storm, hurricane, typhoon, or cyclone, depending on basin). It is issued by a Tropical Cyclone Advisory Center (TCAC) under ICAO; in the United States the equivalent product is issued by the **National Hurricane Center (NHC)** for the Atlantic and eastern Pacific basins, and by the **Central Pacific Hurricane Center (CPHC)** for the central Pacific. The western Pacific is covered by the **Tokyo TCAC / RSMC Tokyo**.

A TCA carries:

- The storm name (when named) and the system's classification (TD / TS / hurricane / typhoon / category).
- Current center position in latitude and longitude, plus a fix time.
- Central pressure in millibars (or hPa).
- Maximum sustained surface winds in knots.
- Motion vector -- direction and speed of the center.
- Forecast positions at standard intervals (typically +12 and +24 hours; many issuers also publish +6, +18, +36, +48, +72).
- Wind radii (extent of 34 kt / 50 kt / 64 kt winds, when supplied).

The TCA is the meteorological description; a **tropical cyclone SIGMET** is the parallel operational product issued for the airspace where the cyclone affects flight operations. They coexist. The TCA tells you what the storm is doing; the SIGMET tells you which polygon is closed for flying.

TCAs are issued at fixed synoptic times -- typically every 6 hours (00Z, 06Z, 12Z, 18Z) -- with intermediate advisories every 3 hours when the storm threatens land, and special bulletins when the situation changes rapidly.

## When you read it

- **Preflight, any flight in or near the affected sector during tropical cyclone season.** Atlantic / Caribbean / Gulf June-November, eastern Pacific May-November, western Pacific year-round (peak Jul-Oct), southern hemisphere November-April. If a named system is on the map, the TCA is mandatory reading before any flight whose route or alternates sit inside its forecast cone.
- **En route, urgently,** if a TCA is issued or updated for a sector you are flying through. The forecast track can shift between advisories; a storm that was forecast to recurve safely offshore can move toward landfall in a single 6-hour cycle.
- **Decision it informs:** go / no-go, route selection, alternate selection (the alternate must still be VFR / above minimums during your time-on-station), and the wider question of whether to advance, hold, or evacuate the airplane out of the region entirely.
- **Where it fits the briefing pack:** read the TCA first to establish what the storm is and where it will be, then read the paired tropical cyclone SIGMET for the airspace polygon, then the area surface analysis and prog chart for the synoptic setup, then satellite for the current cloud structure, and finally NOTAMs / weather-TFRs for any airspace restrictions tied to the storm.

## How to read it

A TCA is fixed-format text. Field-by-field:

| Field             | Example                               | Meaning                                                                                                              |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Issuing center    | `NHC` / `RSMC TOKYO` / `KNHC`         | Authority issuing the advisory (NHC, CPHC, Tokyo TCAC, La Reunion, Nadi, etc.).                                      |
| Advisory number   | `ADVISORY NUMBER 17`                  | Running count for this storm's life. Intermediate advisories suffix with `A` (`17A`).                                |
| Storm identifier  | `HURRICANE FIONA`                     | Classification + name. TD = tropical depression, TS = tropical storm, HU = hurricane, TY = typhoon, MH = major hurr. |
| Fix / valid time  | `1500 UTC THU SEP 22 2026`            | UTC timestamp the fix is good for. The advisory itself is issued shortly after the fix time.                         |
| Position          | `LAT 24.3N LON 70.5W`                 | Center position in degrees and tenths. Lat then lon, hemisphere letters explicit.                                    |
| Intensity         | `MAX SUSTAINED WINDS 110 KT`          | Maximum 1-minute sustained surface winds at 33 ft (10 m) in knots. Use the basin's convention -- US is 1-min.        |
| Central pressure  | `MINIMUM CENTRAL PRESSURE 952 MB`     | Minimum sea-level pressure at the center. Lower = stronger; rapid drop signals intensification.                      |
| Motion            | `MOVEMENT NW OR 315 DEG AT 14 KT`     | Direction (compass + true bearing) and speed in knots. `STNR` = stationary.                                          |
| Wind radii        | `64 KT....... 25NE 20SE 15SW 20NW`    | Extent in NM of the 34 / 50 / 64 kt wind field by quadrant (NE / SE / SW / NW).                                      |
| Forecast position | `FORECAST VALID 23/0000Z 25.8N 72.3W` | Forecast center position at the named valid time. Issued for +12 and +24 hours minimum; often +6 / +18 / +36 / +48.  |
| Forecast wind     | `MAX WIND 115 KT...GUSTS 140 KT`      | Forecast max sustained wind at the forecast time. Use to track expected intensification or weakening.                |
| Discussion        | `KEY MESSAGES` / `DISCUSSION` block   | Prose paragraphs from the forecaster: uncertainty, ensemble spread, model disagreement, hazard call-outs.            |

Read the forecast positions as a list of (time, lat / lon, intensity) tuples. Plot them. That is the cone centerline. The cone itself, when published as a graphic, expands with forecast hour because uncertainty grows -- a 24-hour position is more uncertain than a 12-hour position, and a 72-hour position is much more uncertain than either.

Wind radii tell you how big the dangerous wind field is. A compact hurricane with 64 kt winds extending only 25 NM from the center is a very different hazard footprint than a sprawling system with 64 kt winds out to 100 NM in the NE quadrant. The radii are quadrant-specific because cyclones are not symmetric -- the strongest winds are typically on the right of the motion vector in the northern hemisphere.

## Annotated example(s)

### Example 1 -- Atlantic hurricane tracking toward south Florida

Raw advisory text:

```text
HURRICANE FIONA ADVISORY NUMBER  17
NWS NATIONAL HURRICANE CENTER MIAMI FL    AL062026
1500 UTC THU SEP 22 2026

SUMMARY OF 1500 UTC...1100 AM EDT...INFORMATION
LOCATION...24.3N 70.5W
ABOUT 470 MI...755 KM E OF MIAMI FLORIDA
MAXIMUM SUSTAINED WINDS...110 KT
PRESENT MOVEMENT...NW OR 315 DEGREES AT 14 KT
MINIMUM CENTRAL PRESSURE...952 MB...28.11 INCHES

FORECAST POSITIONS AND MAX WINDS
INIT  22/1500Z  24.3N  70.5W  110 KT  CATEGORY 3 HURRICANE
 12H  23/0000Z  25.8N  72.3W  115 KT  CATEGORY 4 HURRICANE
 24H  23/1200Z  27.2N  74.6W  110 KT  CATEGORY 3 HURRICANE
 36H  24/0000Z  28.0N  77.1W  100 KT  CATEGORY 3 HURRICANE
 48H  24/1200Z  28.4N  79.5W   90 KT  CATEGORY 2 HURRICANE

WIND RADII (NM)
 34 KT.....120NE  90SE  60SW 100NW
 50 KT......60NE  50SE  30SW  50NW
 64 KT......25NE  20SE  15SW  20NW

KEY MESSAGES
1. FIONA IS FORECAST TO REMAIN A MAJOR HURRICANE THROUGH FRIDAY
   WITH A PEAK NEAR CATEGORY 4. SLOW WEAKENING IS EXPECTED THEREAFTER.
2. HURRICANE-FORCE WINDS POSSIBLE ALONG THE EAST COAST OF FLORIDA
   FROM LATE FRIDAY THROUGH SATURDAY. RESIDENTS IN SOUTH FLORIDA
   SHOULD MONITOR THE PROGRESS OF FIONA AND FOLLOW LOCAL OFFICIALS.
3. UNCERTAINTY REMAINS IN THE 48-72 H TRACK. A WESTWARD SHIFT
   WOULD BRING THE CORE OVER MIAMI; AN EASTWARD SHIFT WOULD KEEP
   THE STRONGEST WINDS OFFSHORE.
```

Decoded:

- `HURRICANE FIONA ADVISORY NUMBER 17` -- 17th regular advisory for this storm. Atlantic basin identifier `AL062026` (sixth Atlantic storm of 2026).
- `1500 UTC THU SEP 22 2026` -- fix is good for 1500Z on 22 Sep; advisory issued shortly after.
- `LOCATION 24.3N 70.5W` -- center is about 470 statute miles east of Miami, sitting over warm Atlantic water with no land friction to weaken it.
- `MAX SUSTAINED WINDS 110 KT` -- 110-knot 1-minute sustained winds at the surface. That is mid-Category-3 on the Saffir-Simpson scale (96-112 kt = Cat 3; the storm is at the upper edge).
- `MOVEMENT NW OR 315 DEG AT 14 KT` -- moving northwest at 14 knots. At 14 kt the storm covers roughly 335 NM per day; the 470 NM gap to Miami closes in about 34 hours absent any track shift.
- `MINIMUM CENTRAL PRESSURE 952 MB` -- deep central pressure consistent with a strong Cat 3. Watch for further drops in successive advisories; rapid pressure falls signal rapid intensification.
- Forecast positions: 24/0000Z 75 NM closer and intensifying to Cat 4; 24-h forecast puts the center 27.2N 74.6W (about 250 NM east of West Palm Beach). 48-h forecast puts it 28.4N 79.5W, just offshore south Florida, weakening to Cat 2 -- but still a hurricane making a close approach.
- Wind radii: 64 kt winds extend only 25 NM NE / 20 SE / 15 SW / 20 NW from the center (a relatively compact core). 34 kt tropical-storm-force winds extend 120 NM NE / 90 SE / 60 SW / 100 NW. The footprint is asymmetric -- the NE quadrant is the dangerous half.
- Key Messages: explicit forecaster call-out that a westward track shift puts the core over Miami; eastward keeps the worst winds offshore. The cone is wide at 48-72 h.

What this is telling you: a Category 3 hurricane is 470 NM offshore moving toward south Florida at 14 kt, with the forecast track threading just east of the coastline at 48 hours. Even with the storm tracking offshore, KMIA falls inside the 34 kt wind radius for some portion of the +24 to +48 hour window, and inside the 50 kt radius if the track shifts west by even one cone width. Operationally: any GA flight into or through KMIA, KFLL, KFXE, KPBI between Friday afternoon and Saturday night is canceled or rescheduled; the paired tropical cyclone SIGMET will define the closed polygon for IFR routing. Aircraft based at affected fields should be flown out (or hangared / tied down) before tropical-storm-force winds arrive -- typically 24-36 hours before forecast landfall, when the airfield is still flyable but the surface wind hasn't started to climb.

### Example 2 -- western Pacific typhoon (Tokyo TCAC)

Raw advisory text:

```text
WTPQ20 RJTD 240600
TC ADVISORY
DTG:                   20260924/0600Z
TCAC:                  TOKYO
TC:                    HINNAMNOR
ADVISORY NR:           2026/14
OBS PSN:               24/0600Z N2310 E13420
CB:                    WI 250NM OF TC CENTRE
                       TOP FL550
MOV:                   NNW 12KT
INTST CHANGE:          INTSF
C:                     935HPA
MAX WIND:              115KT
FCST PSN +6 HR:        24/1200Z N2350 E13350
FCST MAX WIND +6 HR:   120KT
FCST PSN +12 HR:       24/1800Z N2435 E13310
FCST MAX WIND +12 HR:  120KT
FCST PSN +18 HR:       25/0000Z N2520 E13240
FCST MAX WIND +18 HR:  115KT
FCST PSN +24 HR:       25/0600Z N2600 E13200
FCST MAX WIND +24 HR:  105KT
RMK:                   POSSIBLE INTERACTION WITH UPPER LEVEL TROUGH
                       AFTER 18 HR MAY ACCELERATE TRACK NE.
NXT MSG:               20260924/1200Z
```

Decoded:

- `WTPQ20 RJTD 240600` -- WMO header. `WT` = tropical cyclone bulletin, `RJTD` = Tokyo issuing office, 24th at 0600Z. ICAO-format TCA.
- `TCAC: TOKYO` -- RSMC Tokyo issuing center, the western Pacific authority.
- `TC: HINNAMNOR` -- storm name. Western-Pacific naming list, maintained by the WMO Typhoon Committee.
- `ADVISORY NR: 2026/14` -- 14th advisory for this system in 2026.
- `OBS PSN: 24/0600Z N2310 E13420` -- observed center position on 24th at 0600Z: 23.1N 134.2E. Open ocean east of the Philippines and well south of Japan.
- `CB: WI 250NM OF TC CENTRE / TOP FL550` -- cumulonimbus (deep convection associated with the eyewall and outer bands) within 250 NM of the center, tops to FL550. That's the convective hazard polygon -- 250 NM of CBs reaching 55,000 ft is a no-fly zone for any aircraft.
- `MOV: NNW 12KT` -- moving north-northwest at 12 knots.
- `INTST CHANGE: INTSF` -- intensifying. The forecaster expects the storm to strengthen in the next forecast period.
- `C: 935HPA` -- central pressure 935 hectopascals (millibars). Very deep -- consistent with a strong typhoon.
- `MAX WIND: 115KT` -- 115-knot maximum sustained winds. Note: Tokyo TCAC reports **10-minute** sustained winds, not 1-minute (US convention). The 10-minute average is typically about 88 percent of the 1-minute average. A 115 kt 10-minute corresponds to roughly 130 kt 1-minute -- in Saffir-Simpson terms this is a Category 4 storm even though the headline number reads lower.
- Forecast positions at +6 / +12 / +18 / +24 hours: storm tracks NNW then begins to curve, intensifying to a peak of 120 kt at +6 / +12 hours before slow weakening. Position at +24 (25/0600Z) is 26.0N 132.0E -- about 200 NM closer to Okinawa.
- `RMK: POSSIBLE INTERACTION WITH UPPER LEVEL TROUGH AFTER 18 HR MAY ACCELERATE TRACK NE.` -- forecaster note: a mid-latitude trough may grab the storm and turn it northeast (recurvature). If that happens earlier than forecast, the track moves over Japan sooner; if later, the storm tracks farther west toward the Ryukyu chain.
- `NXT MSG: 20260924/1200Z` -- next advisory due at 1200Z on the 24th -- standard 6-hour cycle.

What this is telling you: a strong typhoon (1-minute-equivalent intensity ~130 kt, Cat-4 territory) is in the western Pacific, intensifying, tracking NNW at 12 kt with a convective shield 250 NM wide topping FL550. Any trans-Pacific route passing through the Philippine Sea / east of Okinawa in the next 24-48 hours needs to be re-evaluated against this advisory and the paired SIGMET. Operationally for the cargo and passenger jet routings that thread this airspace, the path of least exposure swings well north or south of the cone; for any GA flight at the relevant latitudes there is no path at all, and the SIGMET will be issued as the polygon closes.

## Common gotchas

- **TCAs and SIGMETs for tropical cyclones COEXIST.** The TCA is the meteorological product -- it describes the storm itself, its position, intensity, motion, and forecast track. The tropical cyclone SIGMET is the operational product for ATC -- it defines the polygon of airspace where the storm affects flight operations and the altitudes inside. Pilots need both: the TCA to understand the system; the SIGMET to know which airspace is closed. Reading only one of the two gives an incomplete picture.
- **Intensity conventions differ between basins.** US (NHC, CPHC) reports **1-minute sustained winds** at 33 ft (10 m). RSMC Tokyo, Hong Kong, and most other WMO centers report **10-minute sustained winds**. A 115 kt 10-minute wind is roughly equivalent to 130 kt 1-minute. Saffir-Simpson categories were defined against 1-minute winds; a "Cat 3" headline number from one basin does not mean the same thing as a "Cat 3" from another basin without the conversion. The pressure value (mb / hPa) is a basin-independent intensity proxy and is often more useful for cross-basin comparison.
- **Saffir-Simpson is an Atlantic / eastern-Pacific scale.** The western Pacific uses "typhoon / severe typhoon / super typhoon"; the southern hemisphere uses "tropical cyclone / severe tropical cyclone" with its own category numbering. Don't translate a category number between scales without looking it up.
- **The cone is uncertainty, not impact.** The forecast cone (when graphical) widens with forecast hour because track error grows. The centerline is the most likely path, not the only one. Hazardous winds and weather extend well outside the cone; the cone shows where the **center** is likely to be, not where the storm's effects end. A coastal field 100 NM outside the cone can still be in the 34 kt wind radius.
- **Forecast tracks shift between advisories.** A storm that looks like a clean offshore recurve in advisory 17 can show a westward shift in advisory 18 that puts the core over your destination. Re-read each advisory cycle and update your plan; don't lock in a decision on a 24-hour-old track.
- **Intermediate advisories matter near land.** Once a storm threatens land, NHC issues intermediate advisories every 3 hours (between the regular 6-hour synoptic times), suffixed with `A`. These exist precisely because the situation is changing fast. Read every one of them when the storm is within 72 hours of a coastline you care about.
- **Wind radii by quadrant.** The four numbers `NE / SE / SW / NW` are the extent in NM of that wind threshold in each quadrant. A storm with `64 KT....25NE 20SE 15SW 20NW` has a roughly symmetric inner core; a storm with `64 KT....80NE 50SE 30SW 40NW` is strongly asymmetric with the dangerous half on the NE side of the motion vector. The right-front quadrant (relative to motion) is almost always the strongest in the northern hemisphere; reverse for the southern hemisphere.
- **A weakening storm is still a hazard.** "Forecast to weaken to a tropical storm" does not mean "safe to fly." Tropical-storm winds (34-63 kt) still close airports and ground GA aircraft, and the rainband structure produces severe turbulence, wind shear, and embedded thunderstorms well after the central winds drop below hurricane strength.

## Triage

You have 60 seconds. Where do your eyes go?

1. **Current position vs my flight area.** Is the storm anywhere near my route, alternate, or destination? Use the lat / lon, not the headline name; the same name on different days is a different problem.
2. **Forecast position at my flight time.** Find the forecast tuple closest to my ETD-to-ETA window. That is the storm's expected location during the flight, not its current location. A 6-hour-old TCA needs an extrapolation to the time of flight.
3. **Wind radii vs my airfield and route.** Is the airfield inside the 34 / 50 / 64 kt radius for any quadrant during my time-on-station? Inside 34 kt = surface winds at or above tropical-storm force = airport closes for GA. Inside 50 kt = serious; inside 64 kt = hurricane-force, airfield is shut.
4. **Motion direction relative to my position.** A storm moving toward me at 14 kt closes a 100 NM gap in 7 hours. A storm moving away at the same speed buys me time. Compute the closing rate; don't eyeball it.
5. **Compare against the paired SIGMET polygon.** The SIGMET defines the airspace closure. If the SIGMET polygon intersects my route at my altitude during my flight time, the route is closed regardless of how the TCA reads.
6. **Look at the Key Messages / discussion.** Forecasters write these because something is uncertain or load-bearing. A note that the track may shift west by a cone width is the kind of statement that turns a "probably fine" plan into a divert plan.

A TCA whose forecast track puts the storm's 34 kt radius over my destination during my time-on-station is a no-go. A TCA whose forecast track keeps the 34 kt radius well clear of my route and destination, paired with no intersecting SIGMET, is informational -- but check the next advisory before takeoff.

## Related products

- [SIGMET](../sigmet/page.md) -- the paired operational product. A tropical cyclone SIGMET (header `WS`) defines the closed airspace polygon for ATC routing; valid up to 6 hours for tropical cyclones (extended from the standard 4).
- [Weather TFR](../weather-tfr/page.md) -- temporary flight restrictions tied to hurricane response operations (relief flights, presidential visits to disaster areas, restricted airspace around storm damage assessment).
- [Surface Analysis](../surface-analysis/page.md) -- the synoptic chart showing the cyclone's pressure pattern and the steering currents around it.
- [Satellite](../satellite/page.md) -- visible / infrared imagery showing the current cloud structure, eye definition, and convective intensity. The TCA describes what; satellite shows what.
- [Prog Chart](../prog-chart/page.md) -- the forecast surface chart out 12 / 24 / 36 / 48 hours, showing where the low-pressure center is forecast to be, consistent with the TCA forecast tuples.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Tropical Cyclone Advisory section (format spec, TCAC authorities, field content, advisory cycle).
- **AIM 7-1** -- In-flight Aviation Weather Advisories area, tropical cyclone references and the pairing of TCA with the tropical cyclone SIGMET.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Tropical Weather chapter (cyclone formation, structure, intensity scales, advisory products).
- Service pages:
  - nhc.noaa.gov -- National Hurricane Center, Atlantic and eastern Pacific TCAs.
  - cphc.noaa.gov -- Central Pacific Hurricane Center, central Pacific TCAs.
  - jma.go.jp -- RSMC Tokyo, western Pacific TCAs.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the in-flight advisory family and how tropical cyclone advisories fit alongside SIGMETs, see:

- [AIRMETs, SIGMETs, and Convective SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md)
