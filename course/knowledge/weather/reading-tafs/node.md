---
id: wx-reading-tafs
title: Reading TAFs
domain: weather
cross_domains: [flight-planning]

knowledge_types: [factual, procedural]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: critical
requires:
  - wx-reading-metars
deepens: []
applied_by:
  - airspace-vfr-weather-minimums
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-reading-metars
  - wx-product-pireps
  - wx-thunderstorm-hazards

modalities: [reading, cards, drill]
estimated_time_minutes: 45
review_time_minutes: 8

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Chapter 4 -- Aerodrome Forecasts (TAF)
    note: The canonical format spec for the TAF -- validity windows, change groups (FM / TEMPO / PROB / BECMG), amendment + correction rules.
  - source: AIM
    detail: 7-1-29 -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)
    note: Decode key with worked examples; the reference pilots open at the FBO.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Forecasts chapter (TAF)
    note: Pilot-pitch treatment with sample TAFs and the operational reasoning behind change groups.
  - ref: airboss-ref:handbooks/phak/13
    chapter_title: Aviation Weather Services
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/13
    note: Introductory PHAK treatment with sample TAFs.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a TAF completely (validity window, prevailing
  forecast, FM / TEMPO / PROB / BECMG change groups), distinguish
  forecaster-confidence levels among the change groups, read TAF AMD
  vs COR, identify when the prevailing forecast does not survive a
  TEMPO or PROB excursion, and translate a TAF into go / no-go +
  alternate reasoning.
---

# Reading TAFs

A TAF (Terminal Aerodrome Forecast) is a member of the encoded-text
family (see [`wx-reading-metars`](../reading-metars/node.md) for the
full family treatment). It uses the same group encoding as the METAR
with two key additions: it's a forecast (so the time groups carry
operational weight) and it carries change indicators (`FM` / `TEMPO` /
`PROB` / `BECMG`) that a METAR doesn't have.

The same three-stage ladder applies:

- **Decode** -- mechanical translation. The validity window, the
  prevailing forecast, each change group.
- **Understand** -- the forecaster's confidence vocabulary. An `FM`
  group says "I'm sure of this." A `TEMPO` says "briefly, plausibly."
  A `PROB30` says "I see it but I don't expect it." Decoding the
  symbol isn't enough; you have to read the confidence signal.
- **Triage** -- what is the worst case the forecast allows, and does
  my flight survive it? A pilot who reads the prevailing TAF and
  skips the change groups misses the embedded `TEMPO` blocks that
  drive most fuel and alternate decisions.

The TAF is shorter than the METAR family, but it's denser in
decision-relevant content per word -- almost every line, change-group
or not, is operationally load-bearing.

## Context

You're standing at the fuel pump at 0530. You've just decoded the
destination METAR (wind 230 at 8 gusting 14, vis 6 SM in mist, ceiling
1,200 broken, temp 19, dew point 18, altimeter 30.02). Now you pull
the TAF:

```text
TAF KJAN 121120Z 1212/1318 22008KT 6SM BR BKN015
     FM121800 23010KT P6SM SCT040 BKN150
     PROB30 1212/1215 1SM FG BKN006
     FM130000 25008KT P6SM SCT080
     PROB30 1308/1312 3SM BR BKN008
```

The prevailing TAF is workable; the worst case is unworkable. Which
parts of the forecast are you flying through? Is the PROB block during
your planned hour, or before it? Does your alternate fuel cover the
worst-case TEMPO?

This is the forecast-reading habit: don't read the TAF as a single
forecast. Read it as a *probability distribution over time*, and check
whether your flight survives every credible draw.

## Problem

A METAR is one number per group at one time. A TAF is a forecast across
a 24- or 30-hour window, partitioned into time blocks, each with its
own confidence level. That's three additional axes the METAR doesn't
have: time, change-group type, and forecaster confidence.

Pilots routinely struggle here because the format compresses all three
into a few extra group prefixes (`FM`, `TEMPO`, `PROB30`, `BECMG`) that
look mechanical but carry distinct meanings:

- An `FM` group **replaces** the prevailing forecast at the listed time.
- A `TEMPO` group **layers** a temporary excursion on top of the
  prevailing forecast.
- A `PROB30` / `PROB40` group flags conditions the forecaster sees as
  possible but **unlikely**.
- A `BECMG` group marks a **gradual transition** over the listed window.

Mixing those up changes the operational read. A TEMPO that the pilot
reads as a FM treats a brief excursion as a hard reset and over-plans
fuel; a PROB30 read as a FM aborts a flight that should have launched.

## Discover

### Stage 1: Decode

A TAF reads in fixed order, same alphabet as the METAR, with TAF-specific
additions at the head and the change groups in the body.

1. **Type indicator** -- `TAF` (routine) or `TAF AMD` (amendment, issued
   because the forecaster's confidence dropped on the in-force forecast)
   or `TAF COR` (correction to a previously issued TAF).
2. **Station identifier** -- four-letter ICAO, same as METAR.
3. **Issuance time** -- `121120Z` = 12th at 11:20Z. The issuance is the
   time the forecaster authored the product; the validity window comes
   next.
4. **Validity period** -- two four-digit groups separated by a slash:
   `1212/1318` = valid from the 12th at 1200Z to the 13th at 1800Z, a
   30-hour window. Earlier TAFs used a single eight-digit form; the
   slash form is standard since 2008. Validity is typically 24 hours
   at smaller fields and 30 hours at larger ones, issued every 6 hours
   (00Z, 06Z, 12Z, 18Z) and routinely amended in between.
5. **Prevailing forecast (initial)** -- wind, visibility, weather,
   sky condition. Same encoding as a METAR but no temp / dew point and
   no altimeter (the TAF doesn't forecast those at the terminal level).
   Visibility uses `P6SM` ("plus six statute miles") for visibilities
   that exceed 6 SM -- TAFs don't forecast specific high vis numbers.
6. **Change groups** -- in order of start time, layering or replacing
   the prevailing forecast:
   - `FMHHMMSS` (`FM121800`) -- **from** this time, conditions become
     this. A hard reset; the prevailing forecast is replaced. New wind,
     vis, weather, sky in the FM line.
   - `TEMPO YYHH/YYHH` (`TEMPO 1212/1215`) -- **temporary** excursion
     during this window. Conditions hold for less than half the period
     at any one time (less than 90 minutes in a 4-hour TEMPO).
   - `PROB30` / `PROB40 YYHH/YYHH` -- **probability** 30 or 40 percent
     of the listed conditions during the listed window. PROB never
     appears with values stronger than 40 percent: a 50 percent
     probability gets upgraded to a TEMPO or an FM.
   - `BECMG YYHH/YYHH` -- **becoming**. Gradual transition over the
     listed window from the prevailing forecast to the listed
     conditions. Less common in modern US TAFs; common in international
     TAFs.

Walk the Context TAF:

- `TAF KJAN 121120Z 1212/1318` -- routine TAF for Jackson, issued 12th
  at 1120Z, valid 12th at 1200Z to 13th at 1800Z (30 hr).
- `22008KT 6SM BR BKN015` -- prevailing forecast at the start of the
  validity window: wind 220 at 8, 6 SM in mist, ceiling 1,500 broken.
  Matches the morning METAR.
- `FM121800 23010KT P6SM SCT040 BKN150` -- from 12th at 1800Z, wind
  shifts slightly to 230 at 10, visibility lifts above 6 SM, scattered
  4,000 broken 15,000. The morning marine layer burns off; the day
  conditions are good.
- `PROB30 1212/1215` -- between 12th 1200Z and 12th 1500Z, 30 percent
  chance of 1 SM fog with ceiling 600 broken. Forecaster sees fog as
  plausible but unlikely; expect a 3-hour window where it could happen.
- `FM130000 25008KT P6SM SCT080` -- from 13th at 0000Z (after sunset),
  wind 250 at 8, visibility above 6 SM, scattered at 8,000.
- `PROB30 1308/1312` -- between 13th 0800Z and 13th 1200Z, 30 percent
  chance of 3 SM mist with ceiling 800 broken. The morning marine
  layer might return.

### Stage 2: Understand

The TAF is the forecaster's confidence narrative in 80 words. Reading
it as a story:

> "I'm confident the morning has 6 SM in mist with a 1,500 ceiling.
> I'm confident the day clears after 1800Z. I'm worried about fog in
> the first three hours but not enough to commit; I'll flag it as
> PROB30. Overnight I expect another marine-layer return, again at
> PROB30."

The two PROB30 blocks are the operational interest. They're identical
in shape (3- and 4-hour windows of marginal visibility / ceiling), and
they bracket the workable day. Triage asks: when do you fly, and what
margin does the flight need to survive the PROB30?

The forecaster's confidence levels in operational terms:

| Confidence | Group  | Operational read                                                                              |
| ---------- | ------ | --------------------------------------------------------------------------------------------- |
| Certain    | FM     | The conditions on the listed line are the working forecast from that time on -- plan to them. |
| Likely     | TEMPO  | Temporary excursions to the listed conditions; plan as if they happen briefly within window.  |
| Possible   | PROB40 | 40% chance; plan an alternative if the flight cannot survive the listed conditions.           |
| Unlikely   | PROB30 | 30% chance; informational flag; if the flight cannot survive it, build margin or move time.   |
| Transition | BECMG  | Gradual change over the window; the new condition is the post-window expectation.             |

### Stage 3: Triage

For *this flight*, the triage is the worst-case excursion within the
window you actually fly. If you launch at 1500Z and arrive at 1700Z,
your relevant window is 1500-1700Z; the PROB30 1212/1215 ends at
1500Z and is no longer your problem. If you launch at 1300Z and arrive
at 1430Z, you're flying through the PROB30 1212/1215 -- and a 1 SM
fog with 600 ft ceiling at the destination is a hold-or-divert flight,
not a landing flight.

Triage habit:

1. Mark your **arrival hour** on the TAF timeline.
2. Read the **prevailing forecast** for that hour.
3. Check for **TEMPO / PROB** blocks active at that hour.
4. Ask: does the flight (fuel + alternates + currency + airplane
   capability) survive every excursion that block allows? If yes,
   launch; if no, build margin or move the flight time.

A pilot who reads only the prevailing forecast for the arrival hour
launches into surprises. A pilot who reads only the worst-case block
over-plans every flight. The middle is the right read: the prevailing
is the working number, and the change groups are the credible
deviations to test against.

## Reveal

### Worked examples

#### Example 1: steady-state forecast (no change groups)

```text
TAF KORD 121120Z 1212/1318 27015G25KT P6SM FEW250
```

Prevailing forecast holds the entire window: wind 270 at 15 gust 25,
visibility above 6 SM, few high cirrus at 25,000. No FM, no TEMPO, no
PROB. The forecaster is confident: no weather changes through the 30-hour
window. Operational read: plan to the prevailing every hour.

A TAF with no change groups is a calm-confidence forecast. They appear
in dry post-frontal regimes (the air mass behind a passed cold front is
clean and stable) or in the middle of a strong high. They almost never
appear ahead of an approaching front.

#### Example 2: front passing during the window

```text
TAF KSTL 121120Z 1212/1318 18015G22KT P6SM BKN040
     FM121900 27020G30KT P6SM SCT030 BKN100
     TEMPO 1218/1222 4SM TSRA BR BKN025CB
     FM130200 30010KT P6SM SCT100
```

Pre-frontal warm sector through 1900Z (180/15 gusting 22, broken 4,000).
At 1900Z the cold front passes: wind veers to 270, gusts to 30, the
ceiling lifts and breaks. Embedded in the frontal passage is a TEMPO
1218/1222 -- thunderstorms with rain, 4 SM, broken cumulonimbus at 2,500
-- the forecaster expects active convection during the 4-hour window.
After the front clears (FM130200), wind shifts northwest and the air
clears.

Operational read: launching at 1700Z to arrive at 2000Z puts the flight
directly in the TEMPO TS window. Either launch earlier (arrive 1800Z
before the front) or later (after 0200Z, post-frontal clear air). The
TEMPO is a hard "do not arrive in this window" signal because
thunderstorms are a stop-flying condition.

#### Example 3: deteriorating ceiling

```text
TAF KJFK 121120Z 1212/1318 24010KT P6SM SCT200
     FM121700 22012G20KT 6SM BR SCT020 BKN080
     FM122100 20015G25KT 3SM BR OVC008
     FM130200 19012G20KT 1SM -RA BR OVC004
     FM131200 22010KT P6SM SCT080
```

A textbook deteriorating sequence as a warm front approaches. The
prevailing morning is good (above 6 SM, scattered at 20,000). At 1700Z
mist arrives, ceiling drops to 8,000 broken. At 2100Z visibility drops
to 3 SM and ceiling drops to 800 overcast (the warm front is overhead).
At 0200Z conditions are at minimums (1 SM in light rain and mist, 400
ft overcast -- below most ILS minima at most airports). Recovery doesn't
arrive until 1200Z the next day.

Operational read: the window is open through 1700Z and reopens at
1200Z the following day. The 19 hours in between are unflyable for
most operations. Any flight in this window needs an IFR-current pilot,
an instrument-equipped airplane, and serious alternate planning -- and
even then the 0200Z minimums are a divert-or-hold proposition.

#### Example 4: improving conditions

```text
TAF KSEA 121120Z 1212/1318 18012KT 2SM -RA OVC005
     FM121500 19010KT 4SM BR OVC012
     FM121900 20008KT P6SM SCT020 BKN050
     FM130200 24006KT P6SM SCT040
```

The inverse of Example 3. The morning starts in active rain and a 500-ft
overcast (1212Z). Improvement begins at 1500Z (4 SM, ceiling 1,200) and
the frontal system clears entirely by 1900Z (above 6 SM, scattered at
2,000 and broken at 5,000). Overnight conditions stay clear.

Operational read: launch after 1500Z if VFR, after 1900Z for a relaxed
margin. The improving sequence is easier to plan around than a
deteriorating one because you only need to wait for the right window;
the deteriorating sequence requires arriving before the window closes.

#### Example 5: PROB30 vs PROB40

```text
TAF KATL 121120Z 1212/1318 21008KT P6SM SCT040
     PROB30 1218/1222 1SM TSRA BR BKN020CB
     FM122200 22010KT P6SM SCT060 BKN200
     PROB40 1300/1304 2SM BR BKN008
```

Prevailing forecast benign. PROB30 between 1800-2200Z flags a 30%
chance of afternoon thunderstorms (consistent with summer Georgia
climatology -- the forecaster sees the convective potential but isn't
yet confident enough for a TEMPO). PROB40 overnight flags a 40%
chance of marine-layer fog returning.

The PROB30 vs PROB40 distinction matters: PROB30 is "informational --
build margin if you can"; PROB40 is "expect this excursion -- plan an
alternative." Operationally the threshold many pilots use is "PROB30
informs route planning; PROB40 informs go / no-go."

#### Example 6: BECMG (becoming) transition

```text
TAF EGLL 121120Z 1212/1318 24015KT 9999 SCT040
     BECMG 1216/1218 27020G30KT 9999 SCT025
     TEMPO 1218/1222 7000 -RA BKN020
     BECMG 1300/1302 31015KT 9999 SCT050
```

(EGLL = London Heathrow; international TAFs use BECMG more heavily
than US TAFs and use vis in meters: `9999` = 10+ km, `7000` = 7 km.)
Prevailing morning is steady. Between 1600-1800Z a BECMG block marks
a gradual transition: by 1800Z the wind has shifted to 270 at 20 gust

30. The TEMPO 1218/1222 carries the post-front rain showers. Another
BECMG between 0000-0200Z transitions to dry northwesterly flow.

Operational read for BECMG: by the end of the window, the new
conditions are in force; during the window, conditions transition
gradually. Plan to the new conditions for any arrival after the
window's end.

#### Example 7: AMD (amended TAF)

```text
TAF AMD KMIA 121730Z 1218/1324 17015G22KT 5SM TSRA BKN020CB
     FM122000 18010KT P6SM SCT040 BKN150
     PROB30 1220/1300 3SM TSRA BR BKN015CB
     FM130600 20008KT P6SM FEW040
```

The `AMD` indicator says this TAF was issued off-cycle, between routine
issuances. The forecaster's confidence shifted (in this case,
thunderstorms arrived earlier than the previous TAF expected) and the
forecast needed updating. Always read the amendment time stamp -- 1730Z
here -- and use the amended forecast in preference to the prior routine
TAF.

`TAF COR` would mean the previous TAF had an error (typo, wrong
station, missing group); the COR replaces it for the same validity
window. Both AMD and COR override the prior TAF; the difference is the
forecaster changed their mind (AMD) vs corrected a mistake (COR).

### Common gotchas

#### TEMPO does not replace the prevailing forecast

A `TEMPO 1218/1222 4SM TSRA BR BKN025CB` block on top of a prevailing
`P6SM SCT040` does NOT mean the airport will be at 4 SM continuously
from 1800-2200Z. It means: during that window, expect occasional dips
to 4 SM with thunderstorms, for less than half the window at any one
time. The prevailing forecast is still the working baseline; the TEMPO
is brief excursions away from it.

The "less than half the window" rule is the TEMPO contract: a 4-hour
TEMPO means under 2 hours of total excursion time, in one or more
discrete blocks. A 1-hour TEMPO means under 30 minutes.

#### FM and TEMPO can overlap

A TAF can have an `FM121800 22008KT P6SM SCT040` followed by a
`TEMPO 1218/1222 2SM TSRA OVC025CB`. The FM is the new prevailing
from 1800Z; the TEMPO 1218/1222 starts at 1800Z (same as the FM) and
flags brief excursions away from the new prevailing during its window.
This is common when a front passes during the forecast period.

#### PROB never appears above 40 percent

The PROB scale stops at 40 percent. A 50% confidence either gets
upgraded to a TEMPO (if the duration is brief) or to an FM (if the
duration is the rest of the window). When you see no PROB groups in
a TAF but you do see TEMPO groups, the forecaster is more confident,
not less; PROB is the language for low-confidence outcomes.

#### Validity window arithmetic

`1212/1318` = valid from day 12 at 1200Z to day 13 at 1800Z. The first
two digits are the day of month, the second two are the Zulu hour. A
common bust: reading `1218/1300` as "1218Z to 1300Z" (a 45-minute
window) instead of "day 12 at 1800Z to day 13 at 0000Z" (a 6-hour
window). When in doubt, the slash separates start from end and each
half is `DDHH`.

#### TAFs cover a 5 SM terminal area only

A TAF is for the airport plus a 5-statute-mile radius. It does **not**
forecast en-route conditions or conditions 20 NM down the road. For
the en-route picture, use the GFA, the surface analysis, AIRMETs /
SIGMETs, and PIREPs. A pilot who treats the destination TAF as a
forecast for "everywhere along the route" misses the upwind weather
that's actually about to arrive.

#### Wind direction is true, not magnetic

Same convention as the METAR: TAF wind direction is **true** north
reference. The runway numbers are magnetic. Compute crosswind using
true wind against true runway heading, or convert wind to magnetic
before pairing with the runway number.

#### Visibility coding: P6SM is the cap

TAFs report visibility above 6 SM as `P6SM` (plus 6 SM). They do not
forecast 7 SM, 8 SM, 10 SM, etc. -- the forecast resolution drops off
above 6 SM. International TAFs use meters: `9999` = 10+ km. When you
see `P6SM`, that's good visibility; no further numerical detail will
appear.

#### Amendment lag

A TAF AMD is issued when the forecaster recognizes the in-force forecast
no longer matches reality. There's typically a 10-30 minute lag between
the change in conditions and the amendment going out. If the METAR has
diverged from the prevailing TAF for more than half an hour and no
amendment has arrived, expect one soon and plan as if the METAR is the
new working forecast.

#### TEMPO has no probability

A TEMPO is not a "70% probability of TEMPO conditions" -- it's an
expected brief excursion. The forecaster is committing that during
the window, the listed conditions WILL appear briefly. The contract
is duration (less than half the window), not probability.

### Reference table -- change groups

| Group     | Meaning                                                                   | Reads as                                         |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| FMHHMMSS  | From this time forward, the prevailing forecast becomes the listed line.  | Hard reset at the listed time.                   |
| TEMPO ... | Temporary excursions to the listed conditions during the window.          | Less than half the window in brief blocks.       |
| PROB30    | 30 percent probability of the listed conditions during the window.        | Possible but unlikely; informational flag.       |
| PROB40    | 40 percent probability of the listed conditions during the window.        | Plan an alternative if flight cannot survive it. |
| BECMG ... | Gradual transition over the window from the prevailing to the listed.     | By window end, new conditions are in force.      |
| TAF AMD   | Amended TAF (off-cycle issuance because the in-force forecast was wrong). | Use in preference to the prior routine TAF.      |
| TAF COR   | Corrected TAF (replaces a previously issued TAF for the same validity).   | Use in preference to the prior TAF.              |

## Practice

For each of the next ten TAFs you read, mark the arrival hour for a
hypothetical flight and answer two questions: (1) what is the prevailing
forecast for the arrival hour, and (2) what is the worst-case TEMPO or
PROB block active at that hour? Both questions matter, and both have
to be answered before launch.

A focused drill: pull the TAF for an airport in active weather (a
warm-front airport in winter, a Florida airport in summer). Decode
every change group, sequence them on a timeline, and identify the
transition hour where the forecast shifts from "go" to "no-go" or
back. Plot that on a piece of paper -- the act of writing the
timeline trains the reading habit faster than reading alone.

Pair drill: pull the TAF and the most recent METAR for the same
station. Compare them. Is the METAR running ahead of, lagging, or
tracking the TAF? Persistent disagreement (more than 30 minutes
off) means an amendment is overdue; trust the METAR until it
arrives. Persistent agreement means the forecaster has a good read
on the local regime -- their next change group is probably
trustworthy.

### Cards (spaced repetition)

Cards mined from the body. Validity-window and decode cards build the
floor; change-group precedence and triage cards train the operational
read.

```yaml-cards
- front: "TAF change groups: a {{c1::FM}} group hard-replaces the prevailing forecast; a {{c2::TEMPO}} group layers a temporary excursion onto it; {{c3::PROB30 / PROB40}} indicates an unlikely-but-possible alternate."
  back: |
    FM, TEMPO, and PROB are the TAF's forecaster-confidence vocabulary.
    FM = a hard reset at the listed time. TEMPO = brief excursions (less than
    half the window). PROB30 / 40 = 30 or 40 percent probability of the listed
    conditions. PROB never appears above 40 percent (50 percent gets upgraded
    to TEMPO). BECMG = gradual transition (less common in modern US TAFs).
  cardType: cloze
  kind: recall
  question_tier: faa-written
  source_authority:
    - kind: ac
      cite: AC 00-45H Chapter 4
    - kind: aim
      cite: AIM 7-1-29
  acs_codes: [PA.I.C.K2c]
  tags: [weather, taf, change-groups]
  source_ref: |
    AC 00-45H Chapter 4 -- TAF change-group precedence.
  rationale: |
    The body explicitly distinguishes FM (replace) from TEMPO (layer) from PROB
    (probability). Cloze format because the three together form one rule.

- front: "Decode the TAF validity window 1212/1318."
  back: |
    Valid from day 12 of the month at 1200Z to day 13 at 1800Z -- a 30-hour
    window. The slash separates start from end; each half is DDHH (two-digit
    day-of-month + two-digit Zulu hour). TAFs are issued every 6 hours (00Z,
    06Z, 12Z, 18Z); validity is typically 24 hours at smaller fields and 30
    hours at larger ones.
  cardType: basic
  kind: recall
  tags: [weather, taf, decode, validity, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4 -- TAF validity-window format.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Your TAF reads BKN015 PROB30 1200/1500 TEMPO BKN006 1SM FG. What does the worst-case scenario look like and how should it drive planning?"
  back: |
    Prevailing forecast: ceiling 1,500 broken. From 1200Z to 1500Z, a 30
    percent chance of brief (less than half the window) excursions to 600 ft
    broken with 1 SM visibility in fog. Plan to the worst case: if the flight
    cannot survive a brief BKN006 / 1SM block during 1200-1500Z (legal
    alternates, fuel, currency), don't launch into that window. PROB30 is
    "unlikely but real" -- the forecaster is flagging it because it's
    plausible.
  cardType: basic
  kind: recall
  tags: [weather, taf, change-groups, triage, go-nogo, ac-00-45h]
  source_ref: |
    AC 00-45H TAF format; body Stage 3 triage.
  rationale: |
    Scenario card built directly from the Context + Stage 3 example in the
    body. Trains the "worst-case TEMPO / PROB" triage habit the Practice
    section calls out.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Distinguish TEMPO from FM in a TAF: what does each do to the prevailing forecast, and how does that change planning?"
  back: |
    FM hard-replaces the prevailing forecast at the listed time -- everything
    after the FM is the new working forecast. TEMPO layers brief excursions
    on top of the prevailing forecast during a listed window, for less than
    half the window in total. Plan to the FM line for any arrival after the
    FM time. Plan to the prevailing as the baseline, with awareness of TEMPO
    excursions, for any arrival within a TEMPO window. Mixing them up over- or
    under-plans fuel and alternates.
  cardType: basic
  kind: recall
  tags: [weather, taf, change-groups, fm, tempo, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4; body Discover Stage 2 + gotcha.
  rationale: |
    The body explicitly contrasts FM (replace) and TEMPO (layer). The pilot
    bust this card addresses is reading a TEMPO as if it were a FM.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What's the operational difference between PROB30 and PROB40 in a TAF, and where does most pilots' decision threshold sit?"
  back: |
    PROB30 = 30 percent probability of the listed conditions during the
    window; informational flag, build margin if you can. PROB40 = 40 percent
    probability; treat as expected and plan an alternative if the flight
    can't survive it. PROB never appears above 40 percent (50 percent gets
    upgraded to TEMPO or FM). Many pilots' personal threshold: PROB30 informs
    route planning; PROB40 informs go / no-go.
  cardType: basic
  kind: recall
  tags: [weather, taf, change-groups, prob, go-nogo, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4 -- PROB scale; body Stage 2 confidence-table.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What does TAF AMD signify, and how does it relate to the previously issued TAF for the same airport?"
  back: |
    TAF AMD = amended TAF, issued off-cycle (between routine 6-hour issuances)
    because the forecaster's confidence in the in-force forecast dropped --
    typically because the METAR has diverged from the prevailing forecast and
    a new forecast is needed. The AMD overrides the prior routine TAF for the
    remainder of its validity. Always use the most recent AMD in preference
    to a prior TAF for the same station.
  cardType: basic
  kind: recall
  tags: [weather, taf, amd, amendments, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4 -- TAF AMD / COR; body Example 7.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What's the difference between TAF AMD and TAF COR?"
  back: |
    Both override the previously issued TAF for the same validity window. AMD
    (amended) means the forecaster changed their mind: the in-force forecast
    no longer reflects reality and a new forecast is needed. COR (corrected)
    means the previously issued TAF had a mistake (typo, missing group,
    wrong station identifier) and the COR fixes it. AMD = "forecaster
    updated"; COR = "forecaster fixed an error."
  cardType: basic
  kind: recall
  tags: [weather, taf, amd, cor, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4; body Example 7.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What does P6SM mean in a TAF visibility group?"
  back: |
    P6SM = "plus 6 statute miles" -- visibility greater than 6 SM. TAFs cap
    their visibility forecasts at 6 SM; they do not forecast specific values
    above that. P6SM signals "good visibility, no further detail." (International
    TAFs use meters and report 9999 for 10+ km, with the same "cap" concept.)
  cardType: basic
  kind: recall
  tags: [weather, taf, decode, visibility, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4; AIM 7-1-29.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "A TAF carries a TEMPO block 1218/1222 with 4SM TSRA BR BKN025CB. How much of that 4-hour window will actually carry those conditions?"
  back: |
    Less than half the window total. The TEMPO contract is brief excursions
    that occupy under half the period at any one time -- under 2 hours total
    across a 4-hour TEMPO. The conditions may appear in one block or
    multiple shorter blocks, but the cumulative excursion is bounded. The
    prevailing forecast (or the in-force FM line) remains the working
    baseline; the TEMPO is the deviation.
  cardType: basic
  kind: recall
  tags: [weather, taf, tempo, change-groups, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4 -- TEMPO duration contract; body gotcha.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "A TAF covers a 5-SM radius around the airport. What does that mean for using the destination TAF as your en-route weather product?"
  back: |
    The TAF forecasts terminal-area conditions only -- the airport plus a
    5-statute-mile circle around it. It does NOT forecast conditions on the
    route 20 NM, 50 NM, or 100 NM away. For en-route weather, use the GFA,
    the surface analysis, AIRMETs / SIGMETs, and PIREPs. A pilot who treats
    the destination TAF as a forecast for "everywhere along the route" misses
    the upwind weather that's actually about to arrive at the destination.
  cardType: basic
  kind: recall
  tags: [weather, taf, terminal-area, route-planning, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 4 -- TAF terminal-area scope; body gotcha.
  acs_codes: [PA.I.C.K2c]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "The METAR has diverged from the prevailing TAF for 45 minutes; no amendment has been issued. What does that tell you, and how should you plan?"
  back: |
    There's an amendment lag: forecasters issue an AMD typically 10-30
    minutes after recognising the in-force forecast no longer matches the
    METAR. 45 minutes of divergence with no AMD is overdue. Operational read:
    trust the METAR as the working forecast for the next hour; an amendment
    is probably imminent. Don't anchor planning on a stale TAF; the trend
    direction matters more than the published forecast in this state.
  cardType: basic
  kind: recall
  tags: [weather, taf, amd, divergence, judgment]
  source_ref: |
    Body gotchas + Verify.
  rationale: |
    Practical judgment card: pilots who religiously stick to the published
    TAF when the METAR has clearly walked away from it make worse decisions
    than pilots who weight the most recent observation.
  acs_codes: [PA.I.C.K2c, PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key
```

## Connect

The TAF lives in the encoded-text family alongside the METAR; the same
three-stage ladder applies, with the TAF's additions concentrated in
the forecaster-confidence vocabulary (`FM` / `TEMPO` / `PROB` / `BECMG`).
A pilot who masters METAR triage inherits most of the TAF reading habit
for free.

The TAF feeds:

- **Go / no-go decision** -- the prevailing + worst-case TEMPO / PROB
  is the planning baseline.
- **Alternate selection** -- a TAF that allows the destination to drop
  below approach minima during the arrival hour triggers an alternate
  requirement (FAR 91.169 IFR, FAR 91.155 / 91.157 VFR).
- **Fuel planning** -- a TAF with credible TEMPO blocks for approach
  minima or thunderstorms changes the reserve fuel calculation.
- **Departure time selection** -- improving sequences allow waiting
  for the window; deteriorating sequences require arriving before
  the window closes.

The TAF also pairs structurally with:

- **METAR** -- the observation is the truth-up for the forecast.
- **PIREPs** -- the airframe-level truth-up at altitude (TAFs don't
  forecast flight-level turbulence or icing; they forecast surface
  conditions only).
- **AIRMETs / SIGMETs / GFA** -- the en-route + above-the-surface
  picture the TAF doesn't cover.

## Verify

Pull the TAF for an airport you fly often and watch it across a 24-hour
period. Note when amendments arrive, what triggered them (compare to
the METAR sequence), and how far the prevailing forecast lagged or led
reality. Forecaster skill is real and varies by station, season, and
synoptic regime; the pilot habit of "compare the latest METAR to the
most recent TAF amendment" is grounded in this awareness.

For a TAF in active weather (warm front in winter, summer afternoon
convection), write the timeline on paper. Each change group on its
own line, with start and end Zulu hours. Mark your planned arrival
hour. Confirm the worst-case excursion at that hour. The hand-drawn
timeline is the fastest reading drill that exists for TAFs.
