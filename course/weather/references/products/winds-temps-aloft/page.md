---
id: wx-ref-winds-temps-aloft
title: Winds and Temperatures Aloft Forecast (FB)
short_code: FB
category: winds-temps
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Wind and Temperature Aloft Forecast section'
    note: 'Canonical decode spec including the >100 KT (direction+50/speed-100) convention and the implicit-negative temperature convention at and above 24,000 ft.'
    verified: true
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Where the FB lives in the briefing flow and how it pairs with the GFA, AIRMET Tango, and turbulence products.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Chapter 27 -- Forecasts, §27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)'
    note: 'Pilot-pitch treatment of FB generation, regional altitude coverage, and the operational reasoning for cruise-altitude selection.'
    verified: true
related_knowledge_nodes:
  - wx-product-winds-aloft
related_products:
  - metar
  - taf
  - airmet
  - turbulence-gtg
  - freezing-level
---

# Winds and Temperatures Aloft Forecast (FB)

> Forecast of wind direction (true), wind speed (kt), and temperature (°C) at standard altitudes for selected reporting stations, used to pick a cruise altitude that optimizes ground speed and to anticipate icing risk.

## What it is

The FB is an NWS forecast of wind and temperature aloft, issued for a list of reporting stations across the country. The product is produced four times daily (0000Z, 0600Z, 1200Z, 1800Z) and carries forecast valid times typically 6, 12, and 24 hours out from issue. For CONUS the standard MSL altitudes are 3,000, 6,000, 9,000, 12,000, 18,000, 24,000, 30,000, 34,000, and 39,000 ft. The format is encoded text: each station gets one row per valid time, with one fixed-width group per altitude.

Two coverage rules shape what you actually see in a given row:

- No forecast is issued for altitudes within 1,500 ft AGL of the station elevation. High-elevation stations (KASE, KTRK, KSLC at the low altitudes) drop the lower rows.
- No temperature is given at 3,000 ft.
- At and above 24,000 ft, the temperature is implicitly negative -- the leading minus sign is dropped to fit the column width.

Wind direction is **true**, not magnetic. Speeds are in knots. Temperatures are in degrees Celsius.

## When you read it

- **Preflight, for cruise-altitude selection.** This is the FB's primary job. You have a route and a true course; you want the altitude where the wind component gives you the best ground speed (or, for a given fuel load, the longest legal range). Read the FB once for the nearest reporting station; compare the wind component at each available altitude against your course; pick.
- **Preflight, for time-en-route and fuel-burn math.** Ground speed at the chosen altitude drives ETE, which drives fuel burn, which drives alternate / reserve compliance. The FB is the input.
- **Preflight, for icing brief.** The temperature column tells you where the freezing level sits and how cold it gets at cruise. Freezing temps plus visible moisture (from the METAR/TAF/GFA) = an icing decision.
- **En route, on long flights.** Refresh the FB if the leg crosses a 6-hour valid-time boundary or if you're considering a step climb / descent for a wind change.
- **What it does NOT replace.** PIREPs (actual reported wind at altitude), the GFA winds layer (gridded, finer spatial resolution), and AIRMET Tango / turbulence GTG (turbulence and low-level wind shear). The FB is sparse in space and time; the other products fill in the gaps.

## How to read it

Each altitude is encoded as a 4-character group (low altitude, no temperature), a 6-character group (mid altitude with explicit-sign temperature), or a 6-character group (high altitude with implicit-negative temperature). Reading left to right:

| Field       | Width     | Example      | Meaning                                                                                                                    |
| ----------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Direction   | 2 char    | `27`         | Tens of degrees true. `27` = 270°. Range 01--36 in the standard encoding.                                                  |
| Speed       | 2 char    | `27`         | Wind speed in knots. `27` = 27 KT.                                                                                         |
| Temperature | 2--3 char | `-15` / `15` | °C. Below 24,000 ft the sign is explicit (`+15` or `-15`). At/above 24,000 ft, implicit negative -- `15` decodes to -15°C. |

Special encodings to recognize on sight:

| Raw       | Meaning                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `9900`    | Light and variable. Wind below the threshold where direction can be reliably forecast.                                              |
| `7299`    | Speed > 99 KT trigger. Direction code 51+ signals: subtract 50 from direction, add 100 to speed. `72` -> 220° true; `99` -> 199 KT. |
| `731960`  | Combined high-altitude entry. `73` -> 230° true; `19` + 100 = 119 KT; `60` -> -60°C (above 24K).                                    |
| (omitted) | No forecast issued -- within 1,500 ft AGL of station elevation, or below the lowest published level.                                |

Standard CONUS altitudes (MSL):

| Altitude (MSL) | Temperature?            | Notes                                                                         |
| -------------- | ----------------------- | ----------------------------------------------------------------------------- |
| 3,000          | No                      | Lowest published level. Wind only.                                            |
| 6,000          | Yes (explicit sign)     | Skipped if station elevation is above 4,500 ft (1,500 AGL rule).              |
| 9,000          | Yes (explicit sign)     |                                                                               |
| 12,000         | Yes (explicit sign)     |                                                                               |
| 18,000         | Yes (explicit sign)     | At/above 18,000 the altitudes are effectively flight levels (FL180 = 18,000). |
| 24,000         | Yes (explicit sign)     | Boundary level -- typically still rendered with explicit sign.                |
| 30,000         | Yes (implicit negative) | Drop the sign; assume negative.                                               |
| 34,000         | Yes (implicit negative) |                                                                               |
| 39,000         | Yes (implicit negative) |                                                                               |

The >99 KT convention deserves a second look because it's the field-trip trap: a direction code in the range 51--86 is impossible as a true direction (max true direction is 36, i.e. 360°), so the encoder uses the unused range as a flag. When you see a direction `>= 51`, subtract 50 and add 100 KT to the speed. Speed > 199 KT is encoded as direction + 99 (i.e. capped).

## Annotated example(s)

### Example 1 -- Routine FB at SPI (Springfield, IL)

Header context:

```text
DATA BASED ON 170000Z
VALID 170600Z   FOR USE 0200-0900Z. TEMPS NEG ABV 24000
FT   3000    6000    9000    12000   18000   24000   30000   34000   39000
SPI  2128    2324+16 2126+09 2125+02 1917-14 2426-24 271938  292848  294861
```

Decode altitude by altitude:

- **3,000 ft**: `2128` -- 210° at 28 KT. No temperature (too close to the surface).
- **6,000 ft**: `2324+16` -- 230° at 24 KT, +16°C.
- **9,000 ft**: `2126+09` -- 210° at 26 KT, +9°C.
- **12,000 ft**: `2125+02` -- 210° at 25 KT, +2°C. Freezing level is just above this row; if you climb through the mid-teens in visible moisture, brief icing.
- **18,000 ft**: `1917-14` -- 190° at 17 KT, -14°C.
- **24,000 ft**: `2426-24` -- 240° at 26 KT, -24°C.
- **30,000 ft**: `271938` -- direction code is 27 (< 51, no >99 KT trigger), so 270° at 19 KT. Temperature `38` at 30,000 ft is implicitly negative -> -38°C (the header says temps are negative above 24,000).
- **34,000 ft**: `292848` -- 290° at 28 KT, -48°C.
- **39,000 ft**: `294861` -- 290° at 48 KT, -61°C. Approaching the tropopause.

Synthesis: a moderate southwesterly-to-westerly column, light through the middle altitudes and only modestly stronger up high. For an eastbound flight (true course ~090°) the low and middle rows give a useful tailwind component; for a westbound flight (true course ~270°) the headwind never gets severe at any level, so the cruise-altitude choice is driven more by terrain, oxygen, and the icing/turbulence picture than by wind. Note the temperature column: +2°C at 12,000 means the freezing level sits in the mid-teens, so an IFR climb that high in cloud is an icing question.

Source: NOAA Aviation Weather Center FB bulletin FBUS31 KWNO (aviationweather.gov), valid 2026-05-17 06:00Z, station SPI.

### Example 2 -- Strong wind aloft over the eastern Great Lakes, >99 KT encoding

Header context, station ECK (Peck, MI):

```text
DATA BASED ON 170000Z
VALID 170600Z   FOR USE 0200-0900Z. TEMPS NEG ABV 24000
FT   3000    6000    9000    12000   18000   24000   30000   34000   39000
ECK  2724    2823+14 2730+06 2736+00 2941-15 2955-25 286642  289051  780560
```

Decode the column -- the >99 KT trigger fires at the top:

- **3,000 ft**: `2724` -- 270° at 24 KT.
- **6,000 ft**: `2823+14` -- 280° at 23 KT, +14°C.
- **9,000 ft**: `2730+06` -- 270° at 30 KT, +6°C.
- **12,000 ft**: `2736+00` -- 270° at 36 KT, 0°C. Freezing level is right at this row.
- **18,000 ft**: `2941-15` -- 290° at 41 KT, -15°C.
- **24,000 ft**: `2955-25` -- 290° at 55 KT, -25°C.
- **30,000 ft**: `286642` -- direction code 28 (< 51), so 280° at 66 KT, -42°C.
- **34,000 ft**: `289051` -- 280° at 90 KT, -51°C.
- **39,000 ft**: `780560` -- direction code `78` is >= 51, the trigger fires. Direction = 78 - 50 = 28 (280° true). Speed = 05 + 100 = 105 KT. Temperature -60°C. The encoded `0560` would otherwise read as a 5 KT wind; the >= 51 direction code is the flag that tells you to add 100.

Synthesis: a steadily strengthening westerly column with the jet core above FL340 -- the wind crosses 100 KT only at the very top. For an eastbound airplane on a 090° course, FL390 is a 105 KT direct tailwind; for a westbound airplane on a 270° course, FL390 is a 105 KT direct headwind and the airplane stays low (9,000-12,000 ft) where the wind is a third of that. The lesson the >99 KT encoding teaches: read the direction code first. If it is 51 or greater, subtract 50 from the direction and add 100 to the speed before you do anything else, or you will plan a cruise leg around a wind that is 100 KT stronger than you think.

Source: NOAA Aviation Weather Center FB bulletin FBUS31 KWNO (aviationweather.gov), valid 2026-05-17 06:00Z, station ECK.

## Common gotchas

- **Direction is TRUE, not magnetic.** For ground-speed and wind-triangle math you want true (that's what TAS and true course already are), so do not convert. For runway selection or VOR navigation cross-checks, convert with the local variation.
- **The >99 KT trigger is the direction code, not the speed.** If you see direction `73` and read it as "230° at 19 KT" you've just missed a 100-KT jet. Any direction code 51 or higher means subtract 50 and add 100 to speed. Speed > 199 KT pegs the encoding at direction + 99.
- **Above 24,000 ft, temperature is implicitly negative.** A `60` at FL300 is -60°C, not +60°C. Below 24,000 the sign is explicit (`+10` or `-10`). The 24,000 ft boundary itself is sometimes rendered with an explicit sign and sometimes not -- read the sign if it's there, else assume negative.
- **No temperature at 3,000 ft.** Don't go looking for it.
- **Altitudes are MSL, not flight levels.** Below 18,000 ft, MSL and indicated (with proper altimeter setting) are the same. At and above 18,000 ft you're on flight levels in the standard altimetry block; the FB row labelled `18000` is FL180.
- **The 1,500-ft-AGL coverage rule.** High-elevation reporting stations skip the lower rows. KASE (Aspen, ~7,800 MSL) won't have a 9,000 ft row. Don't read a blank as zero wind.
- **`9900` is light and variable, not "missing".** Treat as ~5 KT or less. Pick altitude on other criteria (icing, turbulence, fuel burn).
- **The FB is a forecast, sampled at coarse altitudes at one station.** Real wind interpolates between rows, varies between stations, and can diverge 30--40 KT from forecast in dynamic atmospheres (frontal passage, mountain wave, jet shift). Cross-check with PIREPs and the GFA winds layer.

## Triage

When you have 60 seconds with a fresh FB and a planned route:

1. **Find your planned cruise altitude row.** What's the wind direction and speed? What's the angle between the wind direction and your true course?
2. **Wind component, ballpark.** Use the 30-60-90 rule: wind within 30° of nose/tail is ~all headwind/tailwind; wind 60° off is ~half-and-half; wind 90° off is ~all crosswind. Refine with the E6B if the decision is tight.
3. **Compare two or three candidate altitudes.** What does climbing or descending one level buy or cost in ground speed? Factor the climb fuel burn and the time-to-climb against the cruise savings.
4. **Read the temperature column for icing and density altitude.** Where's the freezing level? How cold at cruise? Cold temps aloft inform climb performance (better TAS at altitude in colder air) and the icing brief (freezing + moisture = icing).
5. **Spot the jet.** Big jumps in wind speed between adjacent rows mark a jet axis -- and a clear-air turbulence layer just above and below. Cross-check AIRMET Tango and the turbulence GTG before filing through it.

Eastbound at FL340 in a 100 KT jet tailwind is a different flight from westbound at the same altitude. The FB tells you which one you're flying.

## Related products

- [METAR](../metar/page.md) -- surface observation, the right-now anchor for the day's pressure pattern and surface wind.
- [TAF](../taf/page.md) -- terminal forecast through your time-of-arrival; pair the FB cruise wind with the TAF terminal wind for the full descent picture.
- [AIRMET Tango / turbulence](../airmet/page.md) -- area advisory for moderate turbulence; cross-check before filing into a jet core flagged by the FB.
- [Turbulence GTG](../turbulence-gtg/page.md) -- gridded turbulence forecast at altitude; finer spatial resolution than AIRMET Tango.
- [Freezing level](../freezing-level/page.md) -- chart product for the freezing-level surface; cross-check against the FB temperature column for the icing brief.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Wind and Temperature Aloft Forecast section. Canonical decode rules: column format, >99 KT convention, implicit-negative temperature convention above 24,000 ft.
- **AIM** -- 7-1 area, National Weather Service Aviation Products. Where the FB sits in the briefing flow and how it pairs with adjacent products.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 27 (Forecasts), §27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast). How the FB is generated, what altitudes it covers for which regions, and the pilot-pitch operational reasoning.
- Service docs: <https://aviationweather.gov/data/winds> -- product home with current FB data and station list.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product -- with worked decodes of the >100 KT and implicit-negative-temperature traps and a spaced-repetition card set -- see:

- [Wind and Temperature Aloft Forecast (FB)](../../../../knowledge/weather/product-winds-aloft/node.md)
