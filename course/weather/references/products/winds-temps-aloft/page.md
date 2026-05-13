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
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Where the FB lives in the briefing flow and how it pairs with the GFA, AIRMET Tango, and turbulence products.'
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Chapter 27 -- Forecasts, §27.2 (Winds and Temperatures Aloft) and §27.2.1 (FB Wind and Temperature Aloft Forecast)'
    note: 'Pilot-pitch treatment of FB generation, regional altitude coverage, and the operational reasoning for cruise-altitude selection.'
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

| Field        | Width  | Example  | Meaning                                                                                     |
| ------------ | ------ | -------- | ------------------------------------------------------------------------------------------- |
| Direction    | 2 char | `27`     | Tens of degrees true. `27` = 270°. Range 01--36 in the standard encoding.                   |
| Speed        | 2 char | `27`     | Wind speed in knots. `27` = 27 KT.                                                          |
| Temperature  | 2--3 char | `-15` / `15` | °C. Below 24,000 ft the sign is explicit (`+15` or `-15`). At/above 24,000 ft, implicit negative -- `15` decodes to -15°C. |

Special encodings to recognize on sight:

| Raw       | Meaning                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `9900`    | Light and variable. Wind below the threshold where direction can be reliably forecast.               |
| `7299`    | Speed > 99 KT trigger. Direction code 51+ signals: subtract 50 from direction, add 100 to speed. `72` -> 220° true; `99` -> 199 KT. |
| `731960`  | Combined high-altitude entry. `73` -> 230° true; `19` + 100 = 119 KT; `60` -> -60°C (above 24K).     |
| (omitted) | No forecast issued -- within 1,500 ft AGL of station elevation, or below the lowest published level. |

Standard CONUS altitudes (MSL):

| Altitude (MSL) | Temperature?           | Notes                                                                          |
| -------------- | ---------------------- | ------------------------------------------------------------------------------ |
| 3,000          | No                     | Lowest published level. Wind only.                                             |
| 6,000          | Yes (explicit sign)    | Skipped if station elevation is above 4,500 ft (1,500 AGL rule).               |
| 9,000          | Yes (explicit sign)    |                                                                                |
| 12,000         | Yes (explicit sign)    |                                                                                |
| 18,000         | Yes (explicit sign)    | At/above 18,000 the altitudes are effectively flight levels (FL180 = 18,000).  |
| 24,000         | Yes (explicit sign)    | Boundary level -- typically still rendered with explicit sign.                  |
| 30,000         | Yes (implicit negative) | Drop the sign; assume negative.                                                |
| 34,000         | Yes (implicit negative) |                                                                                |
| 39,000         | Yes (implicit negative) |                                                                                |

The >99 KT convention deserves a second look because it's the field-trip trap: a direction code in the range 51--86 is impossible as a true direction (max true direction is 36, i.e. 360°), so the encoder uses the unused range as a flag. When you see a direction `>= 51`, subtract 50 and add 100 KT to the speed. Speed > 199 KT is encoded as direction + 99 (i.e. capped).

## Annotated example(s)

### Example 1 -- Routine FB at KORD, valid 12Z

Header context (issued 0540Z, valid 1200Z, for use 0900Z--1800Z):

```text
FT   3000    6000    9000    12000   18000   24000   30000   34000   39000
ORD  2715    2725+08 2740+02 2750-04 2760-15 2770-26 277540  277948  278154
```

Decode altitude by altitude:

- **3,000 ft**: `2715` -- 270° at 15 KT. No temperature (too close to surface).
- **6,000 ft**: `2725+08` -- 270° at 25 KT, +8°C.
- **9,000 ft**: `2740+02` -- 270° at 40 KT, +2°C.
- **12,000 ft**: `2750-04` -- 270° at 50 KT, -4°C. Freezing level is just below this row; if you climb through 11,000-ish in visible moisture, brief icing.
- **18,000 ft**: `2760-15` -- 270° at 60 KT, -15°C.
- **24,000 ft**: `2770-26` -- 270° at 70 KT, -26°C.
- **30,000 ft**: `277540` -- direction code is 27 (< 51, no >99 KT trigger), so 270° at 75 KT. Temperature `40` at 30,000 ft is implicitly negative -> -40°C.
- **34,000 ft**: `277948` -- 270° at 79 KT, -48°C.
- **39,000 ft**: `278154` -- 270° at 81 KT, -54°C. Approaching the tropopause; the jet core is up here.

Synthesis: a textbook westerly column, accelerating with altitude. For an eastbound flight (true course ~090°), every row is a direct tailwind -- climb as high as the airplane and the day's icing/turbulence picture allow. At FL340 the tailwind buys you 79 KT over the ground; at 9,000 ft you only get 40. For a westbound flight (true course ~270°), the inverse is true: stay low to minimize the headwind, accept the longer climb-out and the slower TAS. The FB has answered the cruise-altitude question in three seconds.

### Example 2 -- Strong jet over the Midwest, >99 KT encoding

Issued 0540Z, valid 1200Z, station MKC (Kansas City):

```text
FT   3000    6000    9000    12000   18000   24000   30000   34000   39000
MKC  2520    2535+05 2550-02 2560-10 2580-22 730235  731745  731856  731957
```

Decode the upper levels carefully -- the >99 KT trigger fires:

- **3,000 ft**: `2520` -- 250° at 20 KT.
- **6,000 ft**: `2535+05` -- 250° at 35 KT, +5°C.
- **9,000 ft**: `2550-02` -- 250° at 50 KT, -2°C.
- **12,000 ft**: `2560-10` -- 250° at 60 KT, -10°C.
- **18,000 ft**: `2580-22` -- 250° at 80 KT, -22°C.
- **24,000 ft**: `730235` -- direction code `73` is >= 51, trigger fires. Direction = 73 - 50 = 23 (230° true). Speed = 02 + 100 = 102 KT. Temperature `35` at 24,000 ft -- 24,000 is the boundary; this encoder dropped the sign and used the implicit-negative convention -> -35°C. (Some FBs render 24,000 with an explicit sign instead; if you see `2402-35` for the same forecast it decodes identically. The trigger you actually rely on is direction code >= 51.)
- **30,000 ft**: `731745` -- 73 - 50 = 23 (230°), 17 + 100 = 117 KT, -45°C.
- **34,000 ft**: `731856` -- 230° at 118 KT, -56°C. Jet core.
- **39,000 ft**: `731957` -- 230° at 119 KT, -57°C.

Synthesis: a jet streak in the upper levels, axis around FL340. For an eastbound airplane on a 090° course, the wind at FL340 is from 230° -- about 50° off the right rear quarter, so still a strong tailwind component (~75 KT). For a westbound airplane on a 270° course, FL340 is brutal -- a ~75 KT headwind component. The westbound airplane stays low (9,000 or 12,000 ft) where the wind is half the speed; the eastbound airplane climbs as high as it can. Also: -56°C at FL340 puts you well below the airframe's typical limit and well into mechanical turbulence sensitivity; cross-check AIRMET Tango and the turbulence GTG before filing FL340.

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
