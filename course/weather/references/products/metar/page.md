---
id: wx-ref-metar
title: METAR (METAR)
short_code: METAR
category: surface-obs
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Chapter 3 -- Surface Aviation Weather Observations (METAR / SPECI)'
    note: 'The canonical format spec for METAR and SPECI: group order, codes, intensity/descriptor/phenomenon table, RMK conventions.'
    verified: false
  - source: AIM
    section: '7-1-29 -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)'
    note: 'Decode key with worked examples. The reference most pilots actually open on the ramp.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Surface Observations chapter'
    note: 'Pilot-pitch treatment with sample METARs and the operational reasoning behind each group.'
    verified: true
related_knowledge_nodes:
  - wx-reading-metars
related_products:
  - taf
  - speci
  - pirep
---

# METAR (METAR)

> Routine surface weather observation issued hourly for an airport, encoded in a fixed-format text string covering wind, visibility, weather, sky, temperature/dew point, and altimeter at one point in time.

## What it is

A METAR (Meteorological Aerodrome Report) is a snapshot of conditions at a single airport, taken at a single time. The National Weather Service, contract observers, and automated stations (ASOS / AWOS) issue them once an hour, typically near the 55 minute mark and valid for the top of the hour. When conditions shift enough off-cycle to matter (a wind shift, a ceiling drop through a critical threshold, a thunderstorm onset), the same station issues a SPECI -- a special report -- in the same format. The product is a fixed-order encoded text string: every METAR you read has the same groups in the same sequence, which is what makes the format both compact and learnable. It covers surface conditions only; it says nothing about what's happening 500 ft up the slope of the air mass or 20 NM down the road, which is where related products (TAF, PIREP, area products) earn their keep.

## When you read it

- **Preflight, paired with the TAF.** The METAR tells you what is happening right now; the TAF tells you what the forecaster expects through your time-of-arrival. You read them together. A METAR with a fast-closing temperature/dew-point spread and a TAF that says fog is possible in three hours is one decision; a stable METAR and an upgrading TAF is another.
- **En route, via ATIS, ASOS/AWOS frequency, FIS-B, or your EFB.** ATIS rebroadcasts the most recent METAR-equivalent observation for towered airports; non-towered fields put the same data on a discrete AWOS/ASOS frequency. In flight, the question shifts from "should I launch?" to "is the destination still flyable?" and "do I need to start thinking about my alternate?"
- **The decision it informs.** Go/no-go before launch. Descent planning and approach selection inbound (ceiling and visibility set the approach floor; wind sets the runway). Divert vs continue when the destination METAR shifts during the flight.
- **What it does NOT replace.** It's a point observation, not a forecast. It does not cover the route between airports. Pair it with the TAF for terminal forecasts, the GFA / AIRMET / SIGMET for area hazards, and PIREPs for what's actually happening at altitude.

## How to read it

A METAR is a fixed-order sequence of groups. Read in order, every time. The full canonical sequence:

| #   | Group           | Example                    | Meaning                                                                                               |
| --- | --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Type indicator  | `METAR`                    | Routine hourly report. `SPECI` = special, off-cycle (something changed).                              |
| 2   | Station ID      | `KJFK`                     | Four-letter ICAO identifier. `K` prefix in the continental US.                                        |
| 3   | Date/time       | `121753Z`                  | Day of month (12) + hour (17) + minute (53), always Zulu.                                             |
| 4   | Modifier        | `AUTO`                     | `AUTO` = automated station, no human observer. `COR` = corrected previous report. Omitted if none.    |
| 5   | Wind            | `23015G24KT`               | Direction 230 true, speed 15 KT, gusting 24 KT. `VRB` for variable below 6 KT. `00000KT` = calm.      |
| 5a  | Variable wind   | `180V230`                  | Direction varying through more than 60 degrees, between 180 and 230. Appears after the wind group.    |
| 6   | Visibility      | `6SM`                      | Statute miles in the US. `M1/4SM` = less than 1/4 SM. Fractions like `1 1/2SM` are common.            |
| 6a  | RVR             | `R04R/2000FT`              | Runway visual range for runway 04R, 2,000 ft. Appears at instrument-approach airports when low vis.   |
| 7   | Present weather | `-RA BR`                   | Intensity (`-` light, none = moderate, `+` heavy) + descriptor + phenomenon. Multiple groups allowed. |
| 8   | Sky condition   | `BKN040`                   | Coverage + height in hundreds of feet AGL. Ascending. Multiple layers allowed. `CB`/`TCU` suffix.     |
| 9   | Temp / dew pt   | `19/18`                    | Degrees Celsius, slash-separated. `M` prefix for negative (`M03/M05` = -3 / -5).                      |
| 10  | Altimeter       | `A3002`                    | `A` prefix, four digits = inches of mercury times 100 (`A3002` = 30.02 inHg).                         |
| 11  | Remarks         | `RMK AO2 SLP168 T01940183` | Sea-level pressure, sensor type, hourly precip, pressure tendency, peak wind, free text.              |

The dense parts in detail:

**Wind (group 5).** Direction is always **true**, not magnetic -- that's a trap when you compare to the AWOS broadcast, which gives magnetic. Speeds in knots. A `G` suffix marks the gust; `23015G24KT` = 230 true at 15 KT, gusts to 24 KT. Variable winds below 6 KT show as `VRB04KT`. If the direction varies by more than 60 degrees and the speed is over 6 KT, a separate variable-direction group `nnnVnnn` follows the wind group (e.g. `23015KT 180V270`).

**Visibility (group 6).** Statute miles in US METARs (`6SM`, `1 1/2SM`, `1/4SM`). The `M` prefix means "less than" (`M1/4SM` = below quarter mile). Visibility above 10 SM is reported as `10SM`. RVR (runway visual range) follows when vis is below 1 SM at airports with RVR equipment: `R04R/2000FT` is 2,000 ft RVR on runway 04R.

**Present weather (group 7).** Three-part code: **intensity** (`-` light, none = moderate, `+` heavy, or `VC` = in the vicinity, 5-10 SM from the field), **descriptor** (TS thunderstorm, SH shower, FZ freezing, BL blowing, DR drifting, MI shallow, BC patches, PR partial), and **phenomenon** (RA rain, SN snow, BR mist, FG fog, HZ haze, FU smoke, DU dust, SA sand, GR hail, PL ice pellets, DZ drizzle, IC ice crystals, SQ squalls). Examples: `-RA` light rain; `+TSRA` heavy thunderstorm with rain; `FZRA` freezing rain; `BR` mist; `FG` fog; `VCTS` thunderstorm in the vicinity.

**Sky condition (group 8).** Coverage code + height in hundreds of feet **AGL**, ascending. Coverage: `SKC`/`CLR` clear, `FEW` (1-2 oktas), `SCT` (3-4 oktas, scattered), `BKN` (5-7 oktas, broken), `OVC` (8 oktas, overcast). A `CB` or `TCU` suffix on a layer marks thunderstorm-related cumulus (cumulonimbus, towering cumulus). Multiple layers stack: `FEW015 BKN040 OVC080` = few at 1,500, broken at 4,000, overcast at 8,000. The **ceiling** for regulatory purposes is the lowest BKN or OVC layer (not FEW or SCT).

**Temperature / dew point (group 9).** Both in degrees Celsius, slash-separated. `M` prefix for negative values. `19/18` = +19 / +18 (1 deg spread, near saturation). `M03/M05` = -3 / -5.

**Altimeter (group 10).** `A` prefix followed by four digits representing inches of mercury times 100. `A2992` = 29.92 inHg, the standard.

**Remarks (RMK).** Free-form supplementary data after the `RMK` keyword. Common entries:

- `AO1` / `AO2` -- station type. AO1 = automated without a precipitation discriminator. AO2 = automated with one. AO2 stations can report rain vs frozen precip; AO1 cannot, and **AO1 stations cannot report thunderstorms** (no lightning detector). The presence of `AO1` is itself a caveat on the report.
- `SLPxxx` -- sea-level pressure in millibars, encoded. `SLP168` = 1016.8 mb.
- `T01940183` -- precise temp/dew point in tenths of a degree C. `T0194` = +19.4; `0183` = +18.3.
- `PK WND 23028/1735` -- peak wind: 230 at 28 KT, occurred at 17:35Z.
- `WSHFT 1720` -- wind shift at 17:20Z.
- `P0003` -- hourly precipitation: 0.03 inches.
- `LTG DSNT N` -- lightning observed in the distance, north.
- Sensor status (`PWINO` precipitation sensor inoperative, `TSNO` thunderstorm sensor inoperative, etc.).

Pilots routinely skip RMK. Pilots routinely miss things hidden in RMK.

## Annotated example(s)

### Example 1 -- routine clear-day METAR

Raw product text:

```text
METAR KJFK 121553Z 24008KT 10SM FEW250 22/14 A3002 RMK AO2 SLP168 T02220139
```

Decoded:

- `METAR` -- routine hourly report.
- `KJFK` -- John F. Kennedy International, New York.
- `121553Z` -- observed on the 12th day of the month at 15:53 Zulu.
- `24008KT` -- wind 240 true at 8 KT. No gusts. Light southwesterly.
- `10SM` -- visibility 10 SM or greater (the maximum reported value).
- `FEW250` -- few clouds at 25,000 ft AGL. High cirrus, operationally insignificant. No BKN or OVC layer means no ceiling at all.
- `22/14` -- temperature +22 C, dew point +14 C. 8 deg spread (comfortable, no fog risk).
- `A3002` -- altimeter 30.02 inHg.
- `RMK AO2` -- automated station with precip discriminator.
- `SLP168` -- sea-level pressure 1016.8 mb.
- `T02220139` -- precise temp +22.2 / dew +13.9.

What this is telling you: a calm, clear, dry late morning at JFK. Light southerly wind, unlimited visibility, no ceiling, big T/Td spread. Severe-clear VFR. Nothing in this report changes any decision; it's the kind of METAR you scan in three seconds and move on.

### Example 2 -- challenging METAR with crosswind gusts, thunderstorm in vicinity, and a meaningful RMK

Raw product text:

```text
SPECI KMEM 121847Z 21018G31KT 180V250 3SM TSRA BR BKN012CB OVC035 24/22 A2978 RMK AO2 PK WND 22035/1842 WSHFT 1825 LTG DSNT NE TS B25 RAB30 SLP074 P0023 T02390222
```

Decoded:

- `SPECI` -- special off-cycle report. Something changed enough at KMEM (Memphis) to trigger an off-hour observation.
- `KMEM` -- Memphis International.
- `121847Z` -- observed 12th day, 18:47 Zulu.
- `21018G31KT 180V250` -- wind 210 true at 18 KT, gusting 31 KT, direction varying between 180 and 250 (a 70 deg arc). This is a frontal or convective wind signature, not a steady prevailing flow.
- `3SM` -- visibility 3 SM. Below the 5 SM Class E daytime VFR ceiling/vis rule for many use cases. IFR-equivalent ceiling-and-vis territory for many ops.
- `TSRA BR` -- thunderstorm with moderate rain, plus mist. The `TS` confirms a thunderstorm is at the station (not just in the vicinity).
- `BKN012CB OVC035` -- broken layer at 1,200 AGL with cumulonimbus, overcast layer above at 3,500. The CB suffix is the loud one: there's a thunderstorm cell right there. Ceiling = 1,200 (lowest BKN).
- `24/22` -- temp +24 C, dew point +22 C. 2 deg spread (saturated, unstable, classic warm-sector convective air).
- `A2978` -- altimeter 29.78 inHg, low (frontal/low-pressure system).
- `RMK AO2` -- automated, precip-discriminating.
- `PK WND 22035/1842` -- peak wind 220 at 35 KT, occurred at 18:42Z (just 5 minutes before the report).
- `WSHFT 1825` -- wind shifted at 18:25Z (front passage).
- `LTG DSNT NE` -- lightning observed distant, northeast (cell moving away or another cell on that side).
- `TS B25 RAB30` -- thunderstorm began at 25 minutes past the hour (18:25Z); rain began at 30 past (18:30Z).
- `SLP074` -- sea-level pressure 1007.4 mb. Low.
- `P0023` -- 0.23 inches of rain this hour.
- `T02390222` -- precise temp +23.9, dew +22.2.

What this is telling you: a frontal passage with active convection at Memphis. The wind shifted 22 minutes ago, peak gust was 35 KT five minutes ago, a thunderstorm built directly over the field with a 1,200 ft cumulonimbus base, and 3 SM visibility in rain and mist. This is a "do not launch, hold or divert if airborne" report -- and the SPECI tag means it triggered an off-cycle, so it's the freshest picture available. Notice how much load-bearing information lives in the RMK section here: timing of the wind shift, peak gust, lightning bearing, and precip onset all live there.

## Common gotchas

- **Zulu time, not local.** `121553Z` is 15:53 UTC on the 12th. A pilot reading this at 09:00 local in Memphis may be looking at a report from five hours ago without noticing. Always confirm the time group against current Zulu.
- **Statute miles, not nautical.** Visibility in US METARs is statute. Speeds in the wind group are knots. Mixing these up is one of the classic decode traps.
- **Wind direction is true, not magnetic.** ATIS / AWOS voice broadcasts give magnetic; the encoded METAR gives true. The numbers differ by your local variation.
- **Ceiling is AGL, not MSL.** `BKN040` is 4,000 feet **above ground**, not above sea level. Subtract this from your cruise altitude logic only if you remember to add the field elevation.
- **Ceiling = lowest BKN or OVC.** A `SCT012 BKN025` layer has a ceiling of 2,500, not 1,200, because SCT doesn't count. This matters for regulatory thresholds.
- **`M` prefix means "less than" in visibility, "minus" in temperatures.** Same letter, two completely different meanings. Context (which group you're in) disambiguates.
- **Dew-point spread is the fog precursor.** A 1 deg C spread with BR (mist) is one half-degree of cooling away from FG (fog, < 5/8 SM). The current visibility number is a snapshot; the spread is the trend signal.
- **`VC` vs station-on.** `VCTS` is "thunderstorm in the vicinity" (5-10 SM from the field, not on it). `TS` alone means it's at the station. The operational implication is huge: VCTS is a watch-this; TS is do-not-launch.
- **AO1 stations cannot report thunderstorms.** An `RMK AO1` station has no lightning detector. The absence of a thunderstorm group at an AO1 station does not mean there isn't one nearby. Cross-reference with radar.
- **AUTO reports miss some phenomena.** Automated stations also struggle with funnel clouds, virga, and tornadic activity. The `AUTO` modifier is a caveat on what's encoded.
- **RMK gets skipped.** The most decision-relevant items at the most active stations (peak wind, wind shift timing, thunderstorm begin/end, lightning bearing, hourly precip) live in RMK. Read it.

## Triage

You have 60 seconds. Where do your eyes go first?

1. **Time group.** Is this report current, or did you pull it five hours ago? If older than ~75 minutes for a routine hourly station, treat it as stale.
2. **Sky condition -- lowest BKN/OVC.** This is your ceiling. Below your personal minimums or below VFR/IFR threshold? Below the lowest approach minimum at the destination? That's the headline.
3. **Visibility.** Same question, same thresholds. Together with ceiling, this is the IFR/VFR call.
4. **Wind.** Direction and speed. Does it match a usable runway? Are gusts pushing your crosswind component over the airplane / pilot limit?
5. **Temperature / dew-point spread.** Less than 3 deg C with any moisture present (BR, FG, low ceiling) = fog risk. Less than 2 deg C in winter with precipitation = freezing/icing risk.
6. **Present weather.** TS, FZRA, +RA, GR -- any of these change the calculation. A `VC*` is a watch-this. A station-on `TS` is do-not-launch.
7. **Altimeter.** Anomalously low (below ~29.80) signals a deep low; anomalously high (above ~30.30) signals a strong high. Both inform what kind of synoptic system you're working in.
8. **RMK on the active reports.** Peak wind, wind shift, lightning bearing, precip rate. Skip on a calm-day METAR; read on a frontal-passage METAR.

The question you're asking the whole time: **which of these numbers, if it shifted by one step, would change my decision?** Those are the drivers. The rest is confirmation.

What changes the go/no-go: ceiling and visibility below your minimums, wind beyond your crosswind/gust limits, present weather your airplane or rating cannot handle (thunderstorm anywhere on the field, freezing precip, low-vis snow), or a trend signal (closing spread, falling pressure, freshening wind ahead of a front) the static numbers haven't caught up to yet.

## Related products

- [TAF](../taf/page.md) -- the forecast paired with the METAR; one tells you now, the other tells you next.
- [SPECI](../speci/page.md) -- an off-cycle METAR in the same format. The presence of a SPECI is itself a signal that conditions just shifted.
- [PIREP](../pirep/page.md) -- a pilot's eyes-on report from the air; fills in what the surface METAR cannot see (icing, turbulence, cloud tops, en-route conditions).

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Chapter 3, Surface Aviation Weather Observations (METAR / SPECI). The canonical format spec: group order, codes, intensity/descriptor/phenomenon table, RMK conventions, and the rules stations follow when generating reports.
- **AIM** -- 7-1-29, Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR). Decode key with worked examples. The reference most pilots actually open on the ramp.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Surface Observations chapter. Pilot-pitch treatment with sample METARs and the operational reasoning behind each group.
- **Service docs** -- [aviationweather.gov/data/metar](https://aviationweather.gov/data/metar) for current US METARs, raw and decoded; FIS-B and ADS-B weather products rebroadcast the same observations in flight.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Reading METARs](../../../../knowledge/weather/reading-metars/node.md) -- the three-stage decode / understand / triage ladder that this reference page is the answer key for.
