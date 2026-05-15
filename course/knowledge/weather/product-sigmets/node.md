---
id: wx-product-sigmets
title: SIGMETs and Convective SIGMETs
domain: weather
cross_domains: [flight-planning, decision-making]

knowledge_types: [factual, judgment]
technical_depth: working
stability: stable

minimum_cert: private
study_priority: critical
requires:
  - wx-reading-metars
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-product-airmets
  - wx-thunderstorm-hazards
  - wx-icing-types-and-avoidance
  - wx-turbulence-types
  - wx-product-convective-outlook
  - wx-product-pireps

modalities: [reading, cards, drill]
estimated_time_minutes: 35
review_time_minutes: 6

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, In-flight Aviation Weather Advisories section -- SIGMETs (WS) and Convective SIGMETs (WST)
    note: Format spec for SIGMET / Convective SIGMET product structure -- trigger conditions, valid times, polygon coding.
  - source: AIM
    detail: 7-1-6 -- Inflight Aviation Weather Advisories
    note: Operational use, valid times, the distinction between non-convective SIGMET and Convective SIGMET.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Chapter 26 -- Advisories (Section 26.2, SIGMET; Convective SIGMET coverage)
    note: Modern consolidated reference for in-flight advisories at the SIGMET tier.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can name the four non-convective SIGMET hazards (severe icing,
  severe / extreme turbulence, dust / sandstorms reducing visibility
  below 3 SM, volcanic ash), state the Convective SIGMET trigger
  conditions (severe thunderstorms, embedded TS, lines of TS,
  thunderstorm areas covering more than 40 percent of an area at VIP 4
  or above), distinguish a SIGMET from an AIRMET on severity threshold,
  and use any SIGMET to inform a divert decision in flight.
---

# SIGMETs and Convective SIGMETs

SIGMETs are members of the encoded-text family (see
[`wx-reading-metars`](../reading-metars/node.md) for the full family
treatment). The same three-stage ladder applies:

- **Decode** -- product type (SIGMET vs Convective SIGMET), region
  (W / C / E for Convective SIGMETs), validity time, hazard, polygon,
  altitudes, motion vector.
- **Understand** -- what synoptic story produced the polygon, why
  the severity threshold cleared, and what hazard mechanism is in play.
- **Triage** -- does the polygon intersect my route at my time at my
  altitude? A SIGMET that fires for severe icing 200 NM north of my
  course at my altitude does not change my plan; the same SIGMET
  100 NM north might.

A SIGMET-tier advisory is always operationally significant. The
question is never "is this important?" -- it is "does this intersect
my flight?" The polygon and the validity are what tell you.

:::phase name="context"

You're 30 minutes into a flight, IFR-routed across central California
at 11,000 ft, when ATC says: "Cessna 345, advise you of Convective
SIGMET 32C, valid 1855Z, central California, line of embedded
thunderstorms 100 NM wide, tops to FL420, moving 040 at 25, hail 1
inch, wind gusts to 60 KT."

That single sentence carries enough information to decide the rest of
the flight. To act on it correctly you have to know what a Convective
SIGMET is, what it isn't, and how the four hazards it can cite each
disqualify penetration of the polygon on their own.

:::
:::phase name="problem"

SIGMETs are the in-flight advisory tier for hazardous-to-all-aircraft
weather. The threshold is the floor of "significance to any aircraft,
light or heavy alike." Where an AIRMET catches a moderate-icing forecast
that a Cessna pilot needs to plan around, a SIGMET catches the severe
icing that threatens a transport-category jet's deice system.

Two flavors:

- **Non-convective SIGMET (WS)** for four discrete hazards: severe
  icing, severe or extreme turbulence, dust / sandstorms reducing
  visibility below 3 SM, and volcanic ash.
- **Convective SIGMET (WST)** for active or imminent thunderstorm
  hazards meeting one of four trigger conditions.

The reading problem is the same as for AIRMETs: decoding the format
is the easy part; matching the polygon + altitude + valid time + motion
to your flight is the operational read. The difference is that with
SIGMETs, *if* the polygon intersects your flight, the operational
answer is almost always the same: stay clear, divert, or land. The
severity threshold of a SIGMET has already cleared "is this a
do-not-fly hazard?" -- the planning question is "how do I avoid it?"

:::
:::phase name="discover"

### Non-convective SIGMET (WS) -- four hazards

A non-convective SIGMET fires when one of four hazards is present or
forecast, at a level severe enough to threaten any aircraft:

1. **Severe icing** not associated with thunderstorms. "Severe" means
   the rate of accumulation outpaces the aircraft's deice / anti-ice
   system; ice continues to accumulate even with deice operating.
   For transport-category jets, severe icing is a "exit the band
   immediately" event; for any non-deiced aircraft, severe icing in
   the polygon is essentially unrecoverable.
2. **Severe or extreme turbulence** not associated with thunderstorms.
   Severe = changes in aircraft attitude and altitude occur; aircraft
   may be momentarily out of control; loose objects fly about the
   cabin. Extreme = the aircraft may be impossible to control;
   structural damage possible. Severe / extreme not associated with
   TS is typically jet stream or mountain-wave turbulence.
3. **Dust / sandstorms** lowering visibility below 3 SM over a broad
   area. Most common in the desert southwest, north Africa, and the
   Middle East; rare in the eastern US.
4. **Volcanic ash** in the airspace. Ash is unique in the SIGMET
   trigger set because it remains a hazard even when other parameters
   look benign: ash plumes can sit in clear air with calm winds and
   destroy turbine engines on contact. SIGMETs for volcanic ash carry
   a longer valid time (6 hours instead of 4) to allow for the slow
   evolution of an ash cloud.

Valid time: 4 hours from issuance, **except** volcanic ash and
hurricane-related SIGMETs, which are valid for 6 hours.

Issued: as needed (no fixed schedule). When the forecaster sees
trigger conditions, the SIGMET issues; when the conditions clear,
the SIGMET cancels (or simply expires).

Read a non-convective SIGMET example:

```text
WSUS31 KKCI 121710
SFOI WS 121710
SIGMET INDIA 1 VALID UNTIL 122110
WA OR ID
FROM 30NE EPH TO 40W BOI TO 40S MWH TO 30NE EPH
SEV ICE BTN FL180 AND FL300 DUE TO SUPERCOOLED LIQUID WATER. CONDS
CONTG BYD 2110Z THRU 0210Z.
```

Decoded:

- `WSUS31 KKCI 121710` -- WSUS = SIGMET US, 31 = sequence id, KKCI =
  Aviation Weather Center, 121710 = 12th at 17:10Z.
- `SFOI WS` -- SFO Area I, WS = SIGMET (non-convective).
- `SIGMET INDIA 1` -- the SIGMET is identified by a phonetic letter
  (INDIA), allowing multiple concurrent SIGMETs in the same area to
  be distinguished. Numbers cycle (this is INDIA 1, next will be
  INDIA 2).
- `VALID UNTIL 122110` -- valid until 12th at 21:10Z (4-hour valid).
- `WA OR ID` -- covering Washington, Oregon, Idaho.
- `FROM ... TO ... TO ... TO ...` -- polygon vertices, same encoding
  style as AIRMET polygons (VOR + offset, station codes, lat / lon).
- `SEV ICE BTN FL180 AND FL300 DUE TO SUPERCOOLED LIQUID WATER` --
  severe icing between FL180 and FL300, attributed to supercooled
  liquid water (the icing mechanism is named, which tells the pilot
  the icing is in cloud, not freezing precipitation below cloud).
- `CONDS CONTG BYD 2110Z THRU 0210Z` -- conditions continuing beyond
  2110Z, expected to renew through 0210Z.

### Convective SIGMET (WST) -- four trigger conditions

A Convective SIGMET fires when active or expected thunderstorms meet
**any** of four triggers:

1. **Severe thunderstorms** -- surface wind gusts above 50 KT, hail
   3/4 inch diameter or larger, or tornadoes. Any of those three
   makes a thunderstorm "severe."
2. **Embedded thunderstorms** -- cells buried in stratiform cloud.
   You cannot see them visually; they only appear on radar. This is
   the deadliest of the four triggers for general aviation because
   pilots flying IFR through the stratiform deck have no visual cue
   to deviate around the cell.
3. **Lines of thunderstorms** -- continuous or nearly-continuous
   chains of cells. A squall line that extends 100 NM or more.
4. **Thunderstorm areas** covering 40 percent or more of an area at
   intensity VIP level 4 (very heavy precipitation, hail likely,
   strong updrafts and downdrafts) or above.

Issuance:

- **Hourly at H+55** for the next 2 hours. Convective SIGMET 25E
  issued at 1755Z is valid until 1955Z; the next one (26E or
  later, depending on regions and sequence) issues at 1855Z and is
  valid until 2055Z.
- **Special issuances** between scheduled cycles when conditions
  develop unexpectedly fast.

Three regions: **E** (eastern, east of the Mississippi), **C**
(central, Mississippi to the western edge of the Rockies), **W**
(western, west of the Rockies). The region letter follows the sequence
number: 32C = 32nd Convective SIGMET of the day in the central region.

Read a Convective SIGMET example:

```text
MKCC WST 121755
CONVECTIVE SIGMET 32C
VALID UNTIL 1955Z
KS OK TX
FROM 30W ICT TO 30E END TO 40SE CDS TO 40W ABI TO 30W ICT
LINE EMBD TS 100NM WIDE MOV FROM 22025KT. TOPS ABV FL420.
HAIL TO 1 IN POSS. WIND GUSTS TO 60 KT POSS.
OUTLOOK VALID 121955-122355Z
AREA 1...FROM 30W ICT TO 50NW OKC TO 40W CDS TO 50W INK TO 30W ICT
SCT TS ANTICIPATED.
```

Decoded:

- `MKCC WST 121755` -- MKCC = Kansas City AWC (issuing for the central
  region), WST = Convective SIGMET, 121755 = 12th at 17:55Z.
- `CONVECTIVE SIGMET 32C` -- 32nd Convective SIGMET of the day in
  the central region (C).
- `VALID UNTIL 1955Z` -- 2-hour valid, expires 12th at 19:55Z.
- `KS OK TX` -- covering Kansas, Oklahoma, Texas.
- `FROM ... TO ... TO ... TO ... TO ...` -- polygon vertices.
- `LINE EMBD TS 100NM WIDE MOV FROM 22025KT` -- line of embedded
  thunderstorms 100 NM wide, moving from the 220 direction at 25 KT
  (so the line is heading roughly northeast).
- `TOPS ABV FL420` -- cloud tops above flight level 420.
- `HAIL TO 1 IN POSS. WIND GUSTS TO 60 KT POSS` -- additional hazards
  possible: hail to 1 inch, surface gusts to 60 KT.
- `OUTLOOK VALID 121955-122355Z` -- the outlook section forecasts
  storm areas for the next 4-hour block after the current 2-hour
  valid window. AREA 1 is the forecast polygon for that outlook.

:::
:::phase name="reveal"

### Operational reads by hazard

#### Severe icing SIGMET

A pilot in any non-deiced light aircraft sees this and exits the
polygon immediately if airborne, never enters if planning. A pilot
in a deiced light aircraft (boots, hot prop, weeping wing) plans to
not be in the polygon during the valid time -- severe icing exceeds
the design certification of most light-aircraft deice systems.
Transport-category jets at the affected flight levels deviate
laterally or climb above the polygon when fuel and ATC allow.

#### Severe / extreme turbulence SIGMET

Mid-level cruise altitudes (FL180 - FL280) are most common; the cause
is typically a jet stream exit region or mountain-wave activity.
Light aircraft in a severe-turbulence polygon at cruise risk loss
of control; the operational answer is altitude change (climb or descend
out of the band) or route change to avoid the polygon. Severe turbulence
at low altitude (rare without TS) implies surface winds will be over
40 KT with gust factors above 20 KT -- ground-handling and approach
implications.

#### Dust / sandstorm SIGMET

Visibility below 3 SM over a broad area. The operational impact is
visual reference loss: VFR is impossible inside the polygon; IFR
operations through dust require careful approach planning because
ILS minima don't help if the runway visual environment is fully
obscured. Engine performance also degrades (filter clogging, sand
ingestion); a piston engine ingesting dust accumulates wear that
matters across maintenance cycles.

#### Volcanic ash SIGMET

Ash destroys turbine engines on contact. The Volcanic Ash Advisory
Center (VAAC) issues the underlying advisory; the SIGMET is the
flight-relevant subset. For piston-engine general aviation, ash
plumes also degrade visibility, clog air filters, and pit windscreens.
Avoid the polygon laterally; do not attempt to overfly an ash cloud
unless the SIGMET explicitly bounds the top altitude and your cruise
is clearly above it.

#### Convective SIGMET

The operational answer is almost always "stay out of the polygon."
Reasons (any one of which independently disqualifies penetration):

- **Updraft turbulence** inside a cell can exceed structural limits.
- **Hail** in or near a cell can be 1-4 inch diameter -- windshield
  shatter, leading-edge damage, engine ingestion damage.
- **Lightning** in or near a cell can damage avionics and create
  pilot disorientation.
- **Downbursts / microbursts** at the leading edge can produce
  performance-limiting wind shear at low altitudes.
- **Embedded cells** in stratiform cloud are invisible to the eye;
  IFR pilots cannot deviate around them visually.
- **Tops above FL420** in active cells make overflight impossible
  for any GA aircraft and impractical for most transport jets.

Decode the Context example fully:

- 32C: 32nd Convective SIGMET of the day in the central US region.
- Valid 1855Z: expires 2 hours from issuance.
- Embedded: storms buried in stratiform cloud, invisible visually
  until you're inside them.
- Tops to FL420: way above any GA aircraft's reach. The line is not
  flyable around in the vertical.
- 100 NM wide: not flyable around in the lateral in any reasonable
  time at GA cruise speeds (4 hours of detour for a 100 NM lateral
  deviation at 120 KT).
- Hail 1 inch + wind gusts 60 KT: any cell penetration is structural
  damage + control loss.

Operational read: divert behind the line, land, wait. There is no
"thread the needle" option for an embedded line that wide. This
SIGMET maps to the "stop flying" decision unambiguously.

### Comparison table: AIRMET vs SIGMET vs Convective SIGMET

| Product           | Audience       | Severity threshold                                                                                             | Valid time                               |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| AIRMET SIERRA     | Light aircraft | IFR (CIG less than 1,000 / vis less than 3 SM over more than 50%); mountain obscuration                        | 6 hours                                  |
| AIRMET TANGO      | Light aircraft | Moderate turbulence; sustained surface winds over 30 KT; non-convective LLWS                                   | 6 hours                                  |
| AIRMET ZULU       | Light aircraft | Moderate icing; freezing-level information                                                                     | 6 hours                                  |
| SIGMET            | All aircraft   | Severe icing (non-TS), severe / extreme turbulence (non-TS), dust / sandstorm vis less than 3 SM, volcanic ash | 4 hours (6 for volcanic ash / hurricane) |
| Convective SIGMET | All aircraft   | Severe TS, embedded TS, lines of TS, TS areas covering more than 40% at VIP 4+                                 | 2 hours                                  |

Notable patterns in the table:

- **Shorter valid time = more tactical product.** AIRMETs are
  planning products (6 hours forward); SIGMETs are tactical
  warnings (4 hours); Convective SIGMETs are near-real-time (2
  hours). The valid time tracks the volatility of the hazard.
- **The severity threshold is the audience filter.** A pilot in a
  Cessna treats SIGMET-tier conditions as universally disqualifying;
  a transport-category jet pilot treats AIRMET-tier conditions as
  routine planning input but SIGMET-tier as serious.
- **No Convective AIRMET.** Active or imminent thunderstorms above
  the threshold go directly to Convective SIGMET because
  thunderstorms hazard every aircraft category. Below the threshold,
  the surrounding turbulence and icing trigger AIRMET TANGO or ZULU,
  but the convection itself isn't separately flagged at the AIRMET tier.

### Reading order in a convective brief

The same hazard answered at three time horizons:

1. **SPC Convective Outlook** (strategic, days): Marginal / Slight /
   Enhanced / Moderate / High risk categories for the next 1-3 days.
2. **Convective SIGMET** (tactical, hours): polygons + valid times
   for the next 0-2 hours, plus the outlook section for the following
   4 hours.
3. **NEXRAD** (real-time, minutes): cell positions and intensities
   right now.

Each refines the picture: the outlook tells you whether to plan around
convection; the Convective SIGMET tells you whether convection is in
your route this hour; NEXRAD tells you what's there this moment.

### Common gotchas

#### SIGMETs override AIRMETs in overlapping areas

When a SIGMET polygon overlaps an AIRMET polygon for the same hazard
(say, severe icing inside a moderate-icing band), the SIGMET dominates.
The AIRMET is still in force outside the SIGMET polygon; inside, the
SIGMET's higher severity is the operational read.

#### "POSS" is the forecaster's hedge

`HAIL TO 1 IN POSS. WIND GUSTS TO 60 KT POSS.` The "POSS" (possible)
means the forecaster is unwilling to commit -- the cell may or may
not produce those hazards. Treat "POSS" hazards in a Convective SIGMET
as expected for planning purposes; they're already strongly enough
hinted that they belong in the brief.

#### Outlook section is forecast, not warning

A Convective SIGMET ends with an "OUTLOOK VALID ..." section that
forecasts thunderstorm areas for the 4 hours after the current 2-hour
valid window. The outlook is informational; it's the next cycle's
preview. Planning a flight through the outlook polygon is workable
if the cells haven't developed yet; planning into the in-force
Convective SIGMET polygon is not.

#### Convective SIGMET letters cycle daily

Sequence numbers (32C, 33C, 34C) reset at the start of each UTC day.
The first Convective SIGMET of a new UTC day is "1" + region letter.
A Convective SIGMET 60E means the eastern region has been very busy
that UTC day.

#### Motion matters

A Convective SIGMET that says `MOV FROM 22025KT` is moving from 220
(southwest) at 25 KT. At the listed motion, the polygon is northwest
of your present position in 30 minutes, north of you in 60 minutes,
etc. A "stationary" Convective SIGMET ("STNR" or "MOV LTL") is a
self-perpetuating thunderstorm system -- often a training squall line
in a strong wind regime -- that will not move out of your path.

#### Severity descriptions matter

"Severe" in a SIGMET is the structured FAA severity (loose objects fly
about, deice cannot keep up, etc.). It is not a colloquial "severe."
A pilot reporting "severe chop" in a PIREP may or may not match the
forecast severity criteria; the PIREP severity is calibrated to the
reporting airframe and pilot. SIGMETs apply the structured definition;
PIREPs are normalised per airframe by the reading pilot.

#### Volcanic ash extends to 6 hours

The 6-hour valid time for volcanic-ash SIGMETs is the operational
hint: ash clouds evolve slowly compared to a typical 4-hour SIGMET
hazard. Plan around an ash polygon for the whole valid window; the
hazard is unlikely to clear before then.

:::
:::phase name="practice"

For tomorrow's planned route, pull every active SIGMET and Convective
SIGMET. Identify each by type (non-convective / convective), what
hazard it warns of, when it expires, polygon, motion, altitude band,
and how it intersects your planned route in space and time. If any
intersect your flight path, articulate the alternative action you'd
take and when you'd commit to it.

A focused drill: pull the most recent Convective SIGMET on a summer
afternoon (any Texas / Oklahoma / Florida route works). Plot the
polygon. Plot the motion vector forward 60 and 120 minutes. The new
polygon (translated by motion) is the operational forecast for where
the line will be at the end of the valid window. Plan accordingly.

Pair drill: watch the SPC Convective Outlook, the Convective SIGMET,
and the NEXRAD mosaic for the same area over a 6-hour active-weather
window. Note which advisories the forecaster fires first (outlook
risk category up), then which SIGMETs appear, then which cells show
on NEXRAD. The sequence builds intuition for "lead time before
convection."

:::cards

- front: "Non-convective SIGMET trigger conditions -- name the four hazards."
  back: |
    1. Severe icing not associated with thunderstorms.
    2. Severe or extreme turbulence not associated with thunderstorms.
    3. Dust / sandstorms lowering visibility below 3 SM over a broad area.
    4. Volcanic ash in the airspace.
    Each triggers a non-convective SIGMET (WS). Valid 4 hours, except
    volcanic-ash and hurricane-related SIGMETs which are valid 6 hours.
  cardType: basic
  kind: recall
  tags: [weather, sigmet, ac-00-45h, aim-7-1-6]
  source_ref: |
    AC 00-45H In-flight Aviation Weather Advisories; AIM 7-1-6; body Discover.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Convective SIGMET trigger conditions -- name the four."
  back: |
    1. Severe thunderstorms (surface winds over 50 KT, hail 3/4 inch or
       larger, or tornadoes).
    2. Embedded thunderstorms (cells buried in stratiform cloud, invisible
       visually).
    3. Lines of thunderstorms (continuous or nearly continuous chains of
       cells).
    4. Thunderstorm areas covering 40 percent or more of an area at level
       VIP 4 or above.
    Issued hourly at H+55 for the next 2 hours, with special issuances
    between regular times when conditions warrant.
  cardType: basic
  kind: recall
  tags: [weather, convective-sigmet, thunderstorm, ac-00-45h, aim-7-1-6]
  source_ref: |
    AC 00-45H; AIM 7-1-6 Inflight Aviation Weather Advisories.
  acs_codes: [PA.I.C.K2g, PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "AIRMET vs SIGMET vs Convective SIGMET -- audience, severity threshold, valid time?"
  back: |
    AIRMET: light aircraft; moderate turbulence / IFR / moderate icing / sfc
    winds over 30 KT; 6 hours.
    SIGMET (non-convective): all aircraft; severe icing (non-TS), severe /
    extreme turbulence (non-TS), dust / sandstorm visibility below 3 SM,
    volcanic ash; 4 hours (6 for volcanic ash and hurricane).
    Convective SIGMET: all aircraft; active or expected severe TS / embedded
    TS / lines of TS / TS areas at VIP 4+ covering more than 40 percent; 2
    hours.
    Shorter valid time tracks higher volatility; severity threshold tracks
    the audience the advisory targets.
  cardType: basic
  kind: recall
  tags: [weather, airmet, sigmet, convective-sigmet, severity, valid-time, ac-00-45h]
  source_ref: |
    AC 00-45H; body Reveal comparison table.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Decode the Convective SIGMET identifier 32C."
  back: |
    32C: the 32nd Convective SIGMET issued today in the central US region
    (C). The other two regions are E (eastern) and W (western). Convective
    SIGMETs are issued by region; the running number resets at the start
    of each UTC day. The region letter tells you which AWC desk authored
    the polygon and roughly where to look for it on the map.
  cardType: basic
  kind: recall
  tags: [weather, convective-sigmet, decode, region, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover Convective SIGMET issuance.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "ATC reports: 'Cessna 345, advise you of Convective SIGMET 32C, line of embedded thunderstorms 100 NM wide, tops to FL420, moving 040 at 25, hail 1 inch.' Operational read?"
  back: |
    Divert behind the line, land, wait. There is no 'thread the needle'
    option. The line is 100 NM wide (not flyable around laterally in any
    reasonable time), embedded in stratiform cloud (you can't see cells
    visually until you're on top), tops at FL420 (way above any GA
    aircraft's reach), and contains hail and 60 KT gusts. Each property
    independently disqualifies penetration; the conjunction is unambiguous.
  cardType: basic
  kind: recall
  tags: [weather, convective-sigmet, divert, scenario, ac-00-45h]
  source_ref: |
    Body Context + Reveal operational read.
  rationale: |
    Scenario card from the body's Context. Trains the read 'every property
    independently disqualifies penetration' the body makes explicit.
  acs_codes: [PA.I.C.K2g, PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Why is volcanic-ash SIGMET valid 6 hours instead of 4?"
  back: |
    Volcanic-ash clouds evolve slowly compared to typical 4-hour SIGMET
    hazards (icing, turbulence, dust storms). A 4-hour window would force
    re-issuance every 4 hours for an ash cloud that may persist days; the
    6-hour valid window matches the operational reality. Plan around an
    ash polygon for the whole valid window; the hazard is unlikely to
    clear early. Hurricane-related SIGMETs use the same 6-hour window for
    the same reason.
  cardType: basic
  kind: recall
  tags: [weather, sigmet, volcanic-ash, valid-time, ac-00-45h]
  source_ref: |
    AC 00-45H; body Discover -- Volcanic ash SIGMET.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "What makes 'embedded' thunderstorms the most dangerous Convective SIGMET trigger for general aviation?"
  back: |
    Embedded thunderstorms are cells buried in stratiform cloud -- invisible
    visually until you fly into them. A pilot operating VFR in clear air
    can deviate around a visible cumulonimbus by sight; a pilot operating
    IFR through a stratiform deck has no visual cue to deviate, so unless
    the airplane has onboard radar or NEXRAD weather datalink, the
    embedded cell is undetected until penetration. The Convective SIGMET
    is the only product calling out the embedded-cell hazard; treat any
    Convective SIGMET citing 'EMBD TS' as a hard "do not penetrate"
    advisory.
  cardType: basic
  kind: recall
  tags: [weather, convective-sigmet, embedded, ifr, judgment]
  source_ref: |
    Body Discover Convective SIGMET; common gotchas.
  acs_codes: [PA.I.C.K2g, PA.I.C.K3h, PA.I.C.R2b]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "Reading order during a brief for convective weather: three products in three time horizons."
  back: |
    SPC convective outlook (strategic, days) -> Convective SIGMET (tactical,
    hours) -> NEXRAD (real-time, minutes). The sequence answers the same
    question -- 'is convection a problem?' -- at three time horizons,
    each refining the picture from planning-horizon to tactical-horizon.
  cardType: basic
  kind: recall
  tags: [weather, convection, briefing-sequence, ac-00-45h]
  source_ref: |
    Body Reveal "Reading order in a convective brief."
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "What does 'severe' mean in a non-convective SIGMET, and how does it differ from a pilot's 'severe' in a PIREP?"
  back: |
    SIGMET 'severe' is the structured FAA severity: severe icing means
    accretion rate outpaces deice systems; severe turbulence means changes
    in aircraft attitude and altitude occur, loose objects fly about the
    cabin. PIREP 'severe' is normalised to the reporting airframe -- a
    Citation pilot's 'severe' is calibrated to a Citation, not to a
    Cessna. A SIGMET-tier hazard is structured; a PIREP-tier hazard is
    relative. Use the SIGMET to plan; use the PIREP to corroborate,
    weighted by the reporting aircraft type.
  cardType: basic
  kind: recall
  tags: [weather, sigmet, pirep, severity, judgment]
  source_ref: |
    Body gotchas + AC 00-45H severity definitions.
  acs_codes: [PA.I.C.K2g, PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories

- front: "A Convective SIGMET ends with 'OUTLOOK VALID 121955-122355Z AREA 1...SCT TS ANTICIPATED.' What is the outlook section, and how do you plan against it?"
  back: |
    The outlook is a forecast of thunderstorm areas for the 4-hour block
    after the current 2-hour valid window. It's informational, not a
    warning -- the storms haven't developed yet. Planning a flight through
    the outlook polygon is workable IF the cells haven't actually appeared
    by your route time; check NEXRAD when you reach the area. Planning a
    flight into the IN-FORCE Convective SIGMET polygon (above the outlook
    section) is the do-not-enter advisory. Distinguish the two: outlook =
    plan; in-force = warning.
  cardType: basic
  kind: recall
  tags: [weather, convective-sigmet, outlook, planning, ac-00-45h]
  source_ref: |
    Body Discover Convective SIGMET example; common gotchas.
  acs_codes: [PA.I.C.K2g]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services, In-flight Aviation Weather Advisories section
    - kind: aim
      cite: AIM 7-1-6 -- Inflight Aviation Weather Advisories
    - kind: other
      cite: FAA-H-8083-28 Aviation Weather Handbook, Chapter 26 -- Advisories
:::

:::
:::phase name="connect"

SIGMETs are forecast and observation products at the most-severe tier;
PIREPs are the truth-up. A SIGMET for severe icing is operationally
real on issuance (the forecaster commits to the polygon); confirming
PIREPs from inside the polygon strengthen the read but are not the
threshold for action. Plan to the SIGMET; use PIREPs to refine.

The SIGMET tier pairs with:

- **Surface analysis + GFA** -- the synoptic source of the hazard.
- **AIRMETs** for the same hazard family at the lower severity tier
  (a SIGMET inside an AIRMET ZULU is a severe-icing pocket inside a
  moderate-icing band).
- **PIREPs** as airframe-level confirmation.
- **NEXRAD** for Convective SIGMETs as the real-time complement.
- **SPC Convective Outlook** for Convective SIGMETs as the strategic
  upstream product.

The K2g element of the airman certification standards calls for SIGMET
and Convective SIGMET decoding and use; this node carries the depth,
[`wx-product-airmets`](../product-airmets/node.md) carries the AIRMET
half, and [`wx-product-convective-outlook`](../product-convective-outlook/node.md)
carries the strategic outlook.

:::
:::phase name="verify"

For tomorrow's planned route, pull every active SIGMET. Identify each by
type (non-convective / convective), what hazard it warns of, when it
expires, polygon and motion vector, altitude band, and how it intersects
your planned route in space and time. If any intersect your flight path,
articulate the alternative action you'd take and when you'd commit to
it.

For a summer afternoon route through Texas / Oklahoma / Florida (or any
convective-prone region), pull the SPC outlook, the Convective SIGMETs,
and the latest NEXRAD. Compare them. Do they agree? When they don't,
where does the disagreement live -- is the outlook overestimating, are
the SIGMETs lagging the cells, is NEXRAD ahead of the SIGMET? The
disagreement is operational signal: it tells you which product to weight
most heavily for *this* flight.

:::