---
id: wx-ref-speci
title: Special Surface Aviation Weather Report (SPECI)
short_code: SPECI
category: surface-obs
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Chapter 3 -- Observations, §3.1 (Aviation Routine Weather Reports (METAR) and Special Weather Reports (SPECI))'
    note: 'Defines the SPECI type indicator, the trigger criteria a station applies to fire an off-cycle report, and the encoded-text format SPECI shares with METAR.'
    verified: true
  - source: AIM
    section: '7-1-2 -- FAA Weather Services (SPECI Issuance Table)'
    note: 'Pilot-pitch summary of routine and special observations, including who issues them and what triggers a SPECI.'
    verified: true
  - source: AIM
    section: '7-1-28 -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)'
    note: 'Decode key. Because SPECI uses the same format as METAR, the same decode rules apply field for field.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Surface Observations chapter'
    note: 'Pilot-pitch treatment of METAR/SPECI with worked examples and the operational reasoning behind off-cycle reports.'
    verified: true
related_knowledge_nodes:
  - wx-reading-metars
related_products:
  - metar
  - taf
  - pirep
---

# Special Surface Aviation Weather Report (SPECI)

> An off-cycle METAR fired when conditions shift through a published trigger between the routine hourly reports. The presence of a SPECI is itself the signal: something at this airport just changed enough to matter.

## What it is

A SPECI (Special Surface Aviation Weather Report) is a surface observation in the exact same encoded format as a METAR, issued **between** the routine hourly reports when one of a published list of trigger criteria fires. The type indicator at the front of the report is `SPECI` instead of `METAR`; everything after that follows the same field order, the same codes, and the same RMK conventions described on the [METAR reference](../metar/page.md). SPECIs are issued by automated stations (ASOS / AWOS) when their sensors detect a triggering change, and by human observers when they observe one directly. A SPECI does not replace the next hourly METAR; it inserts an extra snapshot between them. If conditions are unstable, you may see several SPECIs stacked between two hourly reports.

## When you read it

- **En route, watching the destination.** This is where SPECIs earn their keep. The hourly METAR you pulled at the fuel pump is now an hour stale. A fresh SPECI from your destination is the closest thing to real-time you can get without calling the tower.
- **Near approach.** Inside the last 30 minutes of flight, a SPECI is the difference between flying an approach to minimums on stale wind data and knowing the front just blew through.
- **When the synoptic picture says conditions should move fast.** Frontal passage, convective onset, marine-layer burn-off, post-frontal pressure recovery -- in any of these regimes, the next data point may not wait for the top of the hour.
- **As a flag, not just as data.** A SPECI between two hourly METARs is itself a signal: the airport is changing fast enough that the station felt obliged to file. Treat the report's existence as information independent of the numbers it carries.
- **What it does NOT change.** SPECI does not change the briefing flow or the decision logic; it changes the freshness of the data feeding that logic. Pair with the [TAF](../taf/page.md) for what's expected next and with [PIREPs](../pirep/page.md) for what's actually happening upstream.

## How to read it

**The decode is identical to METAR.** Every group -- station, time, wind, visibility, weather, sky, temp/dew, altimeter, RMK -- follows the same rules in the same order. For the field-by-field table, the dense-group walkthroughs (wind, visibility, weather phenomena, sky condition), and the RMK conventions, see the [METAR reference page](../metar/page.md). That table is the decode key for SPECI as well; do not learn it twice.

Two things are unique to SPECI:

### The `SPECI` type indicator

The first group of the report is `SPECI` instead of `METAR`. That single token carries operational weight: it tells you the station fired this report off-cycle because a trigger condition was met. A station does not file a SPECI to confirm calm conditions; the existence of the report says "something at this airport crossed a published threshold within the last few minutes." When you see `SPECI`, read with the next question in mind: **which field tripped the trigger?**

### The trigger criteria

A station fires a SPECI when any of the following changes occur from the most recently reported conditions. These are the criteria worth memorizing -- they tell you what to look for when a SPECI appears:

| Element          | SPECI trigger                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ceiling          | Forms, dissipates, or crosses 3,000 / 1,500 / 1,000 / 500 ft AGL                                                   |
| Visibility       | Decreases to or crosses below 3 SM, 2 SM, 1 SM, or the lowest published instrument-approach minimum (often 1/2 SM) |
| Wind shift       | Direction change of 45 deg or more **and** sustained speed at least 10 KT before / after the shift                 |
| Thunderstorm     | Begins, ends, or moves to or from the station                                                                      |
| Tornado / funnel | Observed, disappears, or first reported in the vicinity                                                            |
| Hail             | Begins or ends                                                                                                     |
| Freezing precip  | Freezing rain, freezing drizzle, or ice pellets begin or end                                                       |
| Volcanic ash     | Begins or ends                                                                                                     |
| Squall           | Observed                                                                                                           |
| Aircraft mishap  | Observed at the field                                                                                              |
| Pressure         | Rapid pressure rise or fall                                                                                        |

(See AC 00-45H Chapter 3 for the canonical list. The thresholds above are the ones a pilot reads SPECIs against.)

When you decode a SPECI, glance at this list as you read. The trigger field is usually obvious: a `BKN008` where the prior METAR had `BKN025` (crossed both the 1,500 and the 1,000 thresholds); a `TSRA` where there was none; a wind shifted from `21015KT` to `33018KT` (a 120 deg shift at 15 KT). Read it like a METAR but **with extra weight on the field that triggered it.**

## Annotated example(s)

### Example 1 -- wind-shift / frontal-passage trigger

Raw product text:

```text
SPECI KDFW 160600Z 23009G19KT 10SM -RA FEW120 BKN150 BKN250 26/19 A2989 RMK AO2 WSHFT 0540 RAB0555 P0000 T02560194
```

Decoded:

- `SPECI` -- off-cycle report. KDFW fired this between hourly METARs.
- `KDFW` -- Dallas/Fort Worth International.
- `160600Z` -- 16th day, 06:00 Zulu.
- `23009G19KT` -- wind 230 true at 9 KT, gusting 19 KT. The gust spread is the visible part of the trigger; the `WSHFT` remark below is the rest of the story.
- `10SM` -- visibility 10 SM, still unrestricted.
- `-RA` -- light rain. Rain onset is itself a SPECI trigger; the `RAB` remark below times it.
- `FEW120 BKN150 BKN250` -- few at 12,000, broken at 15,000, broken at 25,000. Mid- and high-level cloud associated with the front; no low ceiling yet.
- `26/19` -- temperature +26 C, dew point +19 C. 7 deg spread.
- `A2989` -- altimeter 29.89 inHg.
- `RMK AO2` -- automated, precip-discriminating station.
- `WSHFT 0540` -- wind shifted at 05:40Z. **This is the trigger of record** -- a frontal wind shift fires an off-cycle observation.
- `RAB0555` -- rain began at 05:55Z, five minutes before this report. The precip onset is the second trigger; the wind shift fired first and the rain confirmed the front.
- `P0000` -- a trace of rain so far this hour (less than 0.01 inches).
- `T02560194` -- precise temp +25.6, dew +19.4.

What this is telling you: a front passed Dallas/Fort Worth twenty minutes before this report. The wind shifted at 05:40Z, gusts picked up to 19 KT, and light rain began at 05:55Z. The SPECI exists because **the field changed character in the last half hour;** if you were inbound, the wind shift means the runway you planned to use may no longer be the right one, and the crosswind picture is new. This is a comparatively benign frontal passage -- no thunderstorm, visibility still 10 SM -- but the SPECI did its job: it put the wind shift and rain onset in front of you the moment they happened, instead of making you wait for the next hourly METAR.

Source: NOAA Aviation Weather Center API (aviationweather.gov), KDFW SPECI observed 2026-05-16 06:00Z.

### Example 2 -- ceiling-drop trigger (marine-layer fog encroaching)

Raw product text:

```text
SPECI KMRY 121415Z 32003KT 1SM R10R/P6000FT BR OVC002 11/11 A2996 RMK AO2 T01110106
```

Decoded:

- `SPECI` -- off-cycle report from KMRY (Monterey, CA).
- `121415Z` -- 12th day, 14:15 Zulu (07:15 local in summer). Early-morning marine layer.
- `32003KT` -- wind 320 true at 3 KT. Light.
- `1SM` -- visibility 1 SM in the body of the report. Visibility crossed below the 3 SM, 2 SM, and 1 SM thresholds. **This and the ceiling are the triggers.**
- `R10R/P6000FT` -- runway visual range for Runway 10R is more than (`P`) 6,000 ft. The transmissometer down the runway sees farther than the prevailing-visibility sensor: the fog is patchy, denser away from the runway centerline.
- `BR` -- mist. Visibility is at or above 5/8 SM, so it is coded mist, not fog (`FG`).
- `OVC002` -- overcast at 200 ft AGL. The ceiling crossed below 500 ft AGL (and below 1,000, 1,500, and 3,000).
- `11/11` -- temperature +11 C, dew point +11 C. **Zero spread.** The air is saturated.
- `A2996` -- altimeter 29.96 inHg.
- `RMK AO2` -- automated, precip-discriminating.
- `T01110106` -- precise temp +11.1, dew +10.6.

What this is telling you: the marine layer dropped onto Monterey. Both the ceiling and the visibility crossed multiple SPECI thresholds, which is why the station fired off-cycle. With a near-zero dew-point spread, there is no margin for cooling; this airport is IFR for the near term. The `R10R/P6000FT` group is worth noticing -- the RVR being much better than the 1 SM prevailing visibility tells you the fog is uneven, so what you see on the approach may differ from what the body of the report implies. If you are inbound VFR, this SPECI is your divert trigger. If you are inbound IFR, brief the approach with the lowest minimums and pick an alternate that has not gone into the same marine layer.

Source: NOAA Aviation Weather Center API (aviationweather.gov), KMRY SPECI observed 2026-05-12 14:15Z.

## Common gotchas

- **The SPECI tag is the headline.** A pilot who reads it as "just another METAR" misses the signal embedded in the report's existence. Train yourself to ask, on every SPECI: which threshold did this cross?
- **Memorize the trigger thresholds.** Ceiling crossing 3,000 / 1,500 / 1,000 / 500 AGL. Visibility crossing 3 / 2 / 1 SM (and the lowest published approach minimum). Wind shift of at least 45 deg with at least 10 KT sustained before and after. Beginning or ending of thunderstorms, freezing precip (FZRA, FZDZ, PL), hail, tornadic activity, squalls, volcanic ash. Without the thresholds in your head, the report reads as ordinary numbers.
- **AO1 stations miss things.** An `AO1` station has no thunderstorm sensor. It will not fire a SPECI for thunderstorm onset, because it cannot detect lightning. The absence of a thunderstorm-related SPECI at an `AO1` field is not evidence of absence. Cross-reference with radar and PIREPs.
- **AUTO reports also miss tornadoes, funnel clouds, and virga.** Automated SPECIs can fire for ceiling, vis, wind, and (at AO2) thunderstorm onset, but a tornado in the vicinity may go unreported until a human observer or pilot calls it in.
- **SPECI does NOT cancel the next hourly METAR.** If a SPECI fires at 14:08Z, the routine 14:55Z METAR still issues. Keep reading the hourly cadence; the SPECI is an insert, not a replacement.
- **Multiple SPECIs in a row mean unstable conditions.** If you see two or three SPECIs between two routine METARs, the airport is moving fast enough that you should treat any single report (even the SPECI) as a snapshot of a moving target.
- **Same time-group / vis / temp / altimeter pitfalls as METAR.** Zulu time, statute miles, true wind, AGL ceilings, `M` prefix meaning different things in different groups -- all of these apply identically. See the [METAR gotchas](../metar/page.md#common-gotchas) for the full list.

## Triage

**The SPECI is itself the triage signal.** Routine METARs require you to scan all eleven groups and decide which three drive the decision. A SPECI tells you, by its existence, that **at least one field already drove a station decision.** Read it like a METAR, but anchor your scan on the question: which group tripped the trigger?

A quick scan:

1. **Confirm the type indicator.** `SPECI` -- yes, off-cycle.
2. **Compare to the prior METAR.** What changed? Ceiling? Visibility? Wind direction or speed? Weather phenomena? That delta is the trigger.
3. **Read the triggering field with extra weight.** A new `BKN008` is a different report from a steady `BKN008`; a `33024G35KT` after a `21015KT` is a different wind from a `33024G35KT` you've been watching for an hour.
4. **Read the rest as confirmation.** The non-triggering fields are still useful (temp/dew spread, altimeter trend, RMK timing), but they are secondary to the question the SPECI was filed to answer.
5. **Ask what is upstream.** A frontal-passage SPECI at your destination means the front has already arrived there. PIREPs upstream and the surface analysis tell you whether more is coming or whether the post-frontal recovery has started.

The go/no-go question SPECIs sharpen: **has the airport just crossed a threshold that pushes my flight into a different decision space?** Ceiling below an approach minimum, vis below your personal minimum, wind beyond your crosswind limit, freezing precip onset, thunderstorm on the field -- any of those, fresh from a SPECI, is a divert trigger or a hold trigger, not a continue trigger.

## Related products

- [METAR](../metar/page.md) -- the routine hourly report. SPECI is a METAR fired off-cycle; the decode and reading habits are identical.
- [TAF](../taf/page.md) -- the forecast paired with the observation. A SPECI that confirms a TAF prediction (e.g., a forecast TEMPO becoming reality) is different operationally from a SPECI that exceeds the TAF (an unforecast condition).
- [PIREP](../pirep/page.md) -- pilot-eye reports from the air. A SPECI tells you what happened on the surface; PIREPs tell you what's happening at altitude and along the route, which often explains why the SPECI fired.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Chapter 3, Surface Aviation Weather Observations (METAR / SPECI). The canonical specification for the SPECI type indicator and the published trigger criteria a station applies.
- **AIM 7-1-12** -- Reporting Weather Information. Pilot-facing summary of routine and special observations, including who issues them and what triggers an off-cycle report.
- **AIM 7-1-29** -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR). Decode key for the encoded format; the same key applies to SPECI.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Surface Observations chapter. Pilot-pitch treatment with sample METARs / SPECIs and operational reasoning.
- **Service docs** -- [aviationweather.gov/data/metar](https://aviationweather.gov/data/metar) returns SPECIs in the same feed as routine METARs; the type indicator distinguishes them.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Reading METARs and TAFs](../../../../knowledge/weather/reading-metars-tafs/node.md) -- the three-stage decode / understand / triage ladder that applies to SPECI as well, plus the discussion of why the type indicator itself is operational information.
