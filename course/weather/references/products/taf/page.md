---
id: wx-ref-taf
title: Terminal Aerodrome Forecast (TAF)
short_code: TAF
category: terminal-forecast
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Chapter on Aerodrome Forecasts (TAF)'
    note: 'Definitive product spec: format, change groups, amendment criteria.'
    verified: true
  - source: AIM
    section: '7-1-29 / 7-1-30 area (Aviation Weather Services -- TAF)'
    note: 'Operational description for pilots. Verify exact paragraph against current AIM.'
    verified: false
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook -- Aerodrome Forecasts chapter'
    note: 'Plain-English explainer; chapter number varies by handbook revision.'
    verified: true
related_knowledge_nodes:
  - wx-reading-tafs
related_products:
  - metar
  - speci
  - gfa
  - airmet
---

# Terminal Aerodrome Forecast (TAF)

> NWS forecast of expected weather within 5 statute miles of a TAF-issuing airport, issued four times a day, valid for the next 24 or 30 hours.

## What it is

A TAF is a National Weather Service forecast of meteorological conditions expected within a 5 statute mile radius of a TAF-issuing airport. It is issued four times daily at 0000Z, 0600Z, 1200Z, and 1800Z, and is valid for 24 hours at most airports or 30 hours at major hubs. The format mirrors the METAR -- same wind, visibility, weather, and sky condition codes -- with one critical addition: change groups that segment the valid period into a timeline of expected conditions. Only a subset of airports (roughly 700 in the US, mostly Class B / C / D fields with NWS service contracts) get a TAF. If your destination is not on the TAF list, you fall back to area forecast products (GFA) and the TAF for the nearest reporting airport.

## When you read it

Always paired with the current METAR during preflight. Read the METAR first to anchor reality, then read the TAF to project that reality forward across your ETA window.

- **Preflight, every flight.** The TAF for your departure, destination, and any planned alternate.
- **ETA inside the valid period?** Find the change groups that bracket your arrival time. Those are your operational forecast for the landing.
- **Compare TAF to current METAR.** If the airport is already busting the TAF -- reality already worse than the forecast -- the TAF is suspect for the rest of its valid period. Treat it as an optimistic floor, expect an amendment (TAF AMD), and watch for the next METAR.
- **Drives go/no-go, alternate selection, fuel reserves.** Part 91 IFR alternate rules (`1-2-3`) are evaluated against the TAF at the destination.

## How to read it

A TAF reads as a header followed by a base forecast, followed by zero or more change groups. The base forecast is what's expected for the entire valid period unless a change group overrides it for a slice of time.

### Header and base forecast fields

| Field         | Example      | Meaning                                                                                       |
| ------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Type          | `TAF`        | Routine TAF. Variants: `TAF AMD` (amended), `TAF COR` (corrected).                            |
| Station       | `KORD`       | ICAO identifier of the forecast airport.                                                      |
| Issuance time | `121720Z`    | DDHHMMZ -- day 12, issued 17:20 Zulu. Issuance is typically ~20-40 min before valid.          |
| Valid period  | `1218/1318`  | DDHH/DDHH -- valid day 12 18Z through day 13 18Z (24-hour TAF). 30-hour for major hubs.       |
| Wind          | `27015G25KT` | From 270 degrees true, 15 knots gusting 25. `VRB03KT` for variable light winds.               |
| Visibility    | `P6SM`       | Prevailing visibility in statute miles. `P6SM` means "greater than 6 SM."                     |
| Weather       | `-SHRA`      | Light rain showers. METAR codes apply: intensity (`-`/`+`), descriptor, phenomenon.           |
| Sky condition | `BKN040`     | Broken clouds, base 4,000 ft AGL. Layers stack lowest to highest. `CB` flag for cumulonimbus. |

A TAF does **not** include temperature, dewpoint, or altimeter setting. Those live in the METAR.

### Change groups

The change groups are where most TAF reading goes wrong. Four types, each with different semantics.

| Group               | Example            | Meaning                                                                                                                                                                                   |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FM` (FroM)         | `FM131200`         | Abrupt change at a specific time (day 13, 12:00Z). Everything after `FM` replaces the prevailing forecast and becomes the new prevailing forecast until the next `FM`.                    |
| `TEMPO`             | `TEMPO 1220/1224`  | Temporary conditions, 50% probability, expected to last less than 1 hour at a time within the window (day 12, 20Z-24Z). Does NOT replace the prevailing forecast -- overlay on top of it. |
| `PROB30` / `PROB40` | `PROB30 1304/1308` | 30% or 40% probability of the listed conditions during the window. Never `PROB50` or higher -- those become `FM` or `TEMPO`.                                                              |
| `BECMG` (BECoMinG)  | `BECMG 1216/1218`  | Gradual change over a 2-hour window. Older format, less common in current US TAFs; conditions transition smoothly across the window.                                                      |

After a `FM` group, the new line is the prevailing forecast. A subsequent `TEMPO` or `PROB` group sits on top of that prevailing forecast, not on top of the original base. Read the TAF as a stack of timeline overlays, not as a wall of text.

## Annotated example(s)

### Example 1 -- clean TAF, one `FM`, no probability groups

Raw product text:

```text
TAF KMDW 121720Z 1218/1318 27008KT P6SM SCT040
     FM130000 24005KT P6SM SKC
     FM131400 20010KT P6SM BKN050
```

Decoded:

- **Header** -- routine TAF for Chicago Midway (`KMDW`), issued day 12 at 17:20Z, valid day 12 18:00Z through day 13 18:00Z (24 hours).
- **Base forecast** (1218 onward) -- wind 270 at 8 knots, visibility better than 6 SM, scattered clouds at 4,000 ft AGL.
- **`FM130000`** -- at 00:00Z on day 13, conditions change to wind 240 at 5 knots, visibility better than 6 SM, sky clear. This is the new prevailing forecast until the next `FM`.
- **`FM131400`** -- at 14:00Z on day 13, wind shifts to 200 at 10 knots, visibility better than 6 SM, broken at 5,000 ft AGL. New prevailing forecast through the end of the valid period at 1318Z (day 13 18Z).

What this is telling you: a quiet 24 hours at Midway. VFR throughout. Winds back through south overnight, a broken layer rolls in by mid-morning day 13 but well above pattern altitude. Nothing in here changes a go decision.

### Example 2 -- complex TAF, frontal passage at KORD with `FM`, `TEMPO`, and `PROB30`

Raw product text:

```text
TAF KORD 121720Z 1218/1324 22012G22KT P6SM BKN040
     TEMPO 1219/1222 4SM -SHRA BR BKN025
     FM130000 25015G25KT 5SM -TSRA BR BKN030CB
     PROB30 1302/1306 2SM +TSRA BR OVC020CB
     FM130700 28012KT P6SM SCT025 BKN060
     FM131500 30008KT P6SM SKC
```

Decoded:

- **Header** -- routine TAF for Chicago O'Hare (`KORD`), issued day 12 at 17:20Z, valid day 12 18Z through day 13 24Z (30-hour TAF -- O'Hare is a major hub).
- **Base forecast** (1218 onward) -- wind 220 at 12 gusting 22, visibility better than 6 SM, broken at 4,000 ft AGL. VFR but breezy, ceiling marginal for the unfamiliar.
- **`TEMPO 1219/1222`** -- between 19Z and 22Z on day 12, temporarily expect visibility 4 SM in light rain showers and mist, broken at 2,500 ft. Each occurrence under 1 hour, 50% probability. Overlay on the base forecast: the rest of the time during that window the base still applies.
- **`FM130000`** -- at 00:00Z on day 13, frontal passage. Wind veers to 250 at 15 gusting 25, visibility 5 SM in light thunderstorms and rain plus mist, broken at 3,000 ft AGL with cumulonimbus. This is now the prevailing forecast -- thunderstorms are the expected condition, not the exception.
- **`PROB30 1302/1306`** -- between 02Z and 06Z on day 13, 30% probability the conditions get worse: visibility 2 SM in heavy thunderstorms and rain plus mist, overcast at 2,000 ft AGL with cumulonimbus. Overlay on the post-`FM130000` prevailing forecast.
- **`FM130700`** -- at 07:00Z, front clears. Wind 280 at 12, visibility better than 6 SM, scattered at 2,500 ft AGL with a broken layer at 6,000. Improving but still post-frontal.
- **`FM131500`** -- at 15:00Z, wind 300 at 8, visibility better than 6 SM, sky clear. Clean VFR through the end of the valid period.

What this is telling you: a cold front moves through ORD around midnight Zulu. Late afternoon and evening day 12 are VFR with passing showers; the actual frontal passage drops conditions to MVFR with embedded thunderstorms; there's a 30% chance the small hours of day 13 go IFR with heavy storms. By dawn the front is gone and the day clears out. If your ETA is 02-06Z, this TAF says "plan for thunderstorms, file an alternate, and watch the radar."

## Common gotchas

- **Valid period is `DDHH/DDHH`, not `HHMM`.** `1218/1318` is a 24-hour window starting day 12 at 18Z. New readers confuse this with `12:18` clock time.
- **`FM` time is when the new conditions START, not when the change began.** `FM130000` means "from 00:00Z on day 13 forward." Conditions before that time follow the previous line.
- **`TEMPO` does not replace the prevailing forecast.** It's an overlay -- a 50% chance of intermittent conditions within the window. The base or most recent `FM` line is still the prevailing forecast for the rest of the time during that window.
- **`PROB` never exceeds 40%.** A 50%+ probability becomes a `TEMPO` or `FM` group. If you ever read `PROB50`, it's a transcription error.
- **The 30-hour TAF is a hub-only thing.** Major airports (typically large Class B fields) get 30-hour TAFs; everywhere else is 24. Don't assume `1218/1324` is a typo -- it's a 30-hour valid period.
- **Ceiling is AGL, surface visibility is statute miles.** Same as METAR. Don't confuse cloud bases (`BKN030` = 3,000 ft AGL) with the field elevation.
- **`TAF AMD` and `TAF COR` replace the most recent regular TAF.** An amendment is issued when the forecast no longer matches reality or expected reality. If you have a TAF AMD, throw away the previous TAF -- it's stale.
- **Missing TAF.** If your airport's TAF doesn't show up in the briefing, look at the GFA and the TAFs from neighboring fields. Don't assume "no TAF" means "no concern."
- **Read it as a timeline, not a wall of text.** Find the line that brackets your ETA. Work outward from there. Don't try to absorb the whole thing at once.

## Triage

Sixty-second TAF scan, in order:

1. **Find your ETA on the timeline.** Which `FM` block does it fall inside? That's your prevailing forecast for landing.
2. **Read that line's wind, visibility, ceiling.** Is anything below your personal minimums? Below legal minimums for the planned approach?
3. **Look for `TEMPO` or `PROB` groups that overlap your ETA.** What's the worst case those bracket? Can you live with it?
4. **Sanity check against the current METAR.** Is reality already running ahead of the TAF (already worse than the forecast)? If yes, expect a TAF AMD and treat the current TAF as an optimistic floor.
5. **Check the TAF age.** When was it issued? A 12-hour-old TAF with active weather moving through is suspect; look for an amendment.

Load-bearing fields: wind direction and gust, visibility, lowest ceiling, any `TS` or `+` intensity, any `CB` flag. Everything else is context.

## Related products

- [METAR](../metar/page.md) -- the current surface observation. Always read alongside the TAF to anchor reality.
- [SPECI](../speci/page.md) -- off-cycle surface observation issued when conditions change between hourly METARs; often the first signal a TAF amendment is coming.
- [GFA](../gfa/page.md) -- Graphical Forecasts for Aviation; the fallback when your destination has no TAF, and the area-scale context behind any TAF.
- [AIRMET](../airmet/page.md) -- area hazard advisories (IFR, turbulence, icing) that often explain why a TAF forecasts what it does.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, chapter on Aerodrome Forecasts (TAF). Definitive product spec: format, change groups, amendment criteria.
- **AIM** -- 7-1-29 / 7-1-30 area, Aviation Weather Services -- TAF. Operational description for pilots. Verify the exact paragraph against the current AIM edition.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Aerodrome Forecasts chapter. Plain-English explainer; chapter number varies by handbook revision.
- **Product home:** [aviationweather.gov/data/taf](https://aviationweather.gov/data/taf)

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of TAFs (and the companion METAR node), see:

- [Reading TAFs](../../../../knowledge/weather/reading-tafs/node.md)
- [Reading METARs](../../../../knowledge/weather/reading-metars/node.md)
