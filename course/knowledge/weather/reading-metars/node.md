---
id: wx-reading-metars
title: Reading METARs
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
requires: []
deepens: []
applied_by:
  - airspace-vfr-weather-minimums
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - plan-ifr-cross-country
taught_by: []
related:
  - wx-reading-tafs
  - wx-product-pireps
  - wx-thunderstorm-hazards

modalities: [reading, cards, drill]
estimated_time_minutes: 45
review_time_minutes: 8

references:
  - source: AC 00-45H
    detail: Aviation Weather Services, Chapter 3 -- Surface Aviation Weather Observations (METAR / SPECI)
    note: The canonical format spec for METAR and SPECI -- group order, codes, intensity/descriptor/phenomenon table, RMK conventions.
  - source: AIM
    detail: 7-1-29 -- Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)
    note: Decode key with worked examples. The reference most pilots actually open on the ramp.
  - source: FAA-H-8083-28
    detail: Aviation Weather Handbook, Surface Observations chapter
    note: Pilot-pitch treatment with sample METARs and the operational reasoning behind each group.
  - ref: airboss-ref:handbooks/phak/13
    chapter_title: Aviation Weather Services
    redirected_from: airboss-ref:handbooks/phak/FAA-H-8083-25C/13
    note: Introductory PHAK treatment with sample METARs.

assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >
  Learner can decode a METAR completely (type indicator, station, time,
  modifiers, wind, visibility, weather phenomena, sky condition,
  temperature / dew point, altimeter, remarks), explain why ceiling is
  reported from BKN or OVC layers only, translate a report into go / no-go
  reasoning, and identify the temperature / dew-point spread, weather group,
  and ceiling as the three triage drivers on a low-visibility morning.
---

# Reading METARs

The METAR is the most-read product in aviation and the canonical example
of the **encoded-text family** -- compact, mechanically encoded operational
formats where reading well is a three-stage skill, not a single skill.
The pattern from this node applies to every other encoded-text product
you'll meet (TAFs, PIREPs, AIRMETs, SIGMETs, FB, ATIS, NOTAMs).

The three stages:

- **Decode** -- mechanical translation from symbols to facts. The
  alphabet level. `BKN040` means "broken layer at 4,000 feet AGL."
  Speed comes from repetition; correctness is binary.
- **Understand** -- placing the decoded facts into the larger picture.
  What synoptic situation produces this report? What's upstream? What's
  typical for this airport in this season?
- **Triage** -- separating the lines that matter from the lines that
  don't. A decoded METAR has 10-15 elements. Three to five drive the
  go / no-go for any given flight. The rest are confirmation.

A pilot who decodes well but never advances to triage is the pilot who
reads every METAR and still misses the one trend that should have
stopped the flight. The decode is the alphabet; the goal is the sentence.

:::phase name="context"

You're standing on the ramp at 0530 with two hours of flight ahead.
ForeFlight is open. You've pulled the destination METAR:

```text
METAR KJAN 121153Z AUTO 23008G14KT 200V260 6SM BR BKN012 19/18 A3002
RMK AO2 SLP168 T01940183
```

Wind 230 at 8 gusting 14, visibility 6 SM in mist, ceiling 1,200
broken, temperature 19, dew point 18, altimeter 30.02. That's 11
groups of information. Which three would change your decision if they
shifted by one step? That's the triage question, and answering it is
the difference between reading the report and using it.

:::
:::phase name="problem"

The METAR is dense by design. The format predates radio bandwidth
limits and got compact for transmission; it stayed compact because
pilots read hundreds of them in a single planning session. A learner
who can't decode every group hits the same wall every flight: the
report becomes unparseable text instead of operational data, and the
pilot defaults to the graphical product (which abstracts away the
trend signals the METAR carries best).

The pilot question the METAR answers is direct: what is the airport
doing right now, and is the trend toward better or worse?

:::
:::phase name="discover"

### Stage 1: Decode

A METAR is a fixed-order sequence of groups. Read in order, every
time, the same way:

1. **Type indicator** -- `METAR` (routine, hourly near H+55) or
   `SPECI` (special, issued off-cycle when something changes). The
   presence of a SPECI is itself information: something at that
   station just shifted enough to trigger an off-cycle report.
2. **Station identifier** -- four-letter ICAO. `K`-prefix in the
   continental US (`KJFK`, `KORD`). Alaska is `PA`, Hawaii is `PH`.
3. **Date/time group** -- six digits, day-of-month + hour + minute,
   always Zulu. `121753Z` = 12th of the month at 17:53Z.
4. **Modifiers** -- `AUTO` (automated station, no human observer),
   `COR` (corrected previous report). Omitted when neither applies.
   An `AUTO` flag matters: see "Common gotchas" below.
5. **Wind** -- direction (true) + speed + optional gust. `23015KT` =
   230 true at 15 KT. Variable wind below 6 KT shows as `VRB04KT`.
   Gusts get a `G` suffix (`16G24KT`). Calm is `00000KT`. Variable
   wind beyond 60 degrees adds a separate `nnnVnnn` group after the
   wind block (e.g. `23015KT 180V270`).
6. **Visibility** -- statute miles in the US, with fractional notation
   (`1 1/2SM`, `1/4SM`). `M` prefix means "less than" (`M1/4SM` =
   less than a quarter mile). Visibilities above 10 SM report as
   `10SM`. RVR (runway visual range) follows when vis is below 1 SM
   at airports with RVR equipment: `R04R/2000FT` is 2,000 ft RVR on
   runway 04R.
7. **Weather phenomena** -- coded with intensity prefix (`-` light,
   none = moderate, `+` heavy, `VC` = in the vicinity 5-10 SM from
   the field), descriptor (`TS` thunderstorm, `SH` shower, `FZ`
   freezing, `BL` blowing, `DR` drifting, `MI` shallow, `BC` patches,
   `PR` partial), and phenomenon (`RA` rain, `SN` snow, `BR` mist,
   `FG` fog, `HZ` haze, `FU` smoke, `DU` dust, `SA` sand, `GR` hail,
   `PL` ice pellets, `DZ` drizzle, `IC` ice crystals, `SQ` squalls).
   Multiple phenomena groups are allowed (`-RA BR`). Examples: `-RA`
   light rain; `+TSRA` heavy thunderstorm with rain; `FZRA` freezing
   rain; `BR` mist (vis 5/8 to 6 SM); `FG` fog (vis under 5/8 SM);
   `VCTS` thunderstorm in the vicinity.
8. **Sky condition** -- coverage / height pairs, ascending. Coverage:
   `SKC` / `CLR` clear, `FEW` (1-2 oktas), `SCT` (3-4 oktas,
   scattered), `BKN` (5-7 oktas, broken), `OVC` (8 oktas, overcast).
   Heights in hundreds of feet **AGL** (`BKN015` = 1,500 broken).
   `CB` or `TCU` suffix after the height marks thunderstorm-related
   cumulus. The **ceiling** for regulatory purposes is the lowest
   `BKN` or `OVC` layer (not `FEW` or `SCT`).
9. **Temperature / dew point** -- degrees Celsius, slash-separated,
   `M` prefix for negative (`M03/M05` = -3 / -5). `19/18` = +19 / +18,
   a 1-degree spread (near saturation).
10. **Altimeter** -- `A` prefix, four digits = inches of mercury times
    100 (`A2992` = 29.92 inHg).
11. **Remarks (RMK)** -- automated supplementary data and free text.
    Common entries: `AO1` / `AO2` (station type -- AO2 stations have
    a precipitation discriminator and can report rain vs frozen
    precip; AO1 cannot, AND AO1 stations cannot report thunderstorms
    because they lack a lightning detector). `SLPxxx` = sea-level
    pressure in millibars (`SLP168` = 1016.8 mb). `T01940183` = precise
    temp / dew point in tenths of a deg C (+19.4 / +18.3). `PK WND
    23028/1735` = peak wind 230/28 at 17:35Z. Pilots routinely skip
    RMK and pilots routinely miss things hidden in RMK.

### Stage 2: Understand

Decoded facts have to land on a synoptic picture. The Context METAR
(wind 230 at 8 gusting 14, vis 6 SM BR, ceiling 1,200 broken, temp
19 / dew 18, alt 30.02) tells one story:

- Wind from the southwest, light. Not a frontal-passage wind. Not a
  sea-breeze-front signature either; too light, wrong direction.
- Visibility 6 in mist (`BR`), not fog. The temperature / dew-point
  spread is 1 degree C, which is exactly when mist forms; another
  half degree of cooling and `BR` becomes `FG` (visibility under 5/8
  SM, a fog event).
- Ceiling 1,200 broken. Stratus, marine-air type, not convective.
- Altimeter 30.02. Modestly above standard; no strong system.

That's a humid, light-southerly, near-saturation morning. It matches
a maritime tropical air mass overnight without much mixing. The
synoptic frame says: this is what you get when warm moist air sits on
a cooler surface; it'll lift as the day warms, but right now you're
at the ragged edge of fog, and a light shift in wind direction or
temperature could close the airport.

### Stage 3: Triage

For *this flight* (you're at the fuel pump deciding whether to launch),
three of the eleven groups drive the decision and the other eight are
confirmation:

- **The temp / dew-point spread of 1 deg C.** This is the trend signal.
  If fog forms in the next thirty minutes, you're IFR-only at departure
  even though the current METAR shows 6 SM.
- **The weather group `BR`.** Confirmation of the spread story. `BR`
  with a 1-degree spread is "you're at the ragged edge of fog -- watch
  the trend."
- **The ceiling `BKN012`.** 1,200 ft broken is well above legal VFR
  but only a few hundred feet of margin if a stratus deck lowers.

If you're VFR-only on a non-IFR-current day, the spread alone should
stop the launch -- not because it's IFR right now, but because the
rate-of-change toward IFR is faster than your rate-of-arrival at the
destination. If you're IFR-current with an instrument-equipped airplane,
the picture is workable: legal IFR fuel + alternates, the cloud deck is
stratiform (predictable), no convection.

The other eight groups are confirmation: station ID, time, wind,
altimeter, RMK all support the story but none would change the
decision if they shifted by one step. Triage is the habit of asking:
which of these numbers, if it changed by a step, would change my
decision? Those are the drivers. Watch them.

:::
:::phase name="reveal"

### Worked examples

Each of these is a real-shape METAR; decode every group, then read
the synoptic story.

> Browse the full catalog of every realistic METAR shape (52 examples
> across 39 token families, each round-tripped through `parseMetar`):
> [encoded-text catalog -- METAR](../encoded-text-catalog/metar.md).

#### Example 1: calm clear morning

```text
METAR KSFO 121153Z AUTO 00000KT 10SM SKC 10/06 A3018
RMK AO2 SLP218 T01000061
```

Calm winds, 10 SM, clear sky, 10/06 (4-degree spread, well off
saturation), 30.18 inHg, AO2 (precipitation discriminator present).
A textbook benign morning. The 4-degree spread tells you fog isn't
imminent; the clear sky tells you radiation cooling overnight didn't
drop the surface to saturation. Triage drivers: spread (4 = safe),
sky (`SKC`), wind (calm = use whichever runway is preferred).

#### Example 2: gusty crosswind

```text
METAR KMDW 121753Z 28019G31KT 240V310 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

Wind 280 at 19, gusts 31, varying 240-310. Vis 7 SM. Sky scattered
clouds at 8,000 and broken at 15,000 (no ceiling -- `FEW` and `SCT`
don't count; the broken layer at 15,000 is the operational ceiling).
Temp / dew 6 / -3 (9-degree spread, dry). Altimeter 29.87 (low,
deepening low or trough nearby).

Synoptic story: post-frontal regime. Strong cold-sector wind, dry
air behind the front, broken stratocumulus aloft. The 12-degree spread
between wind direction extremes (240V310, a 70-degree variability)
plus 12-knot gust spread (19 to 31) is the classic post-frontal
boundary-layer mixing signature -- the air mass is well-mixed and
the surface wind shifts as turbulent eddies arrive.

Triage drivers: gust factor (31 vs steady 19 = 12-knot gust),
crosswind component for the runway in use, altimeter trend (is the
low still deepening?).

#### Example 3: thunderstorm

```text
METAR KOKC 122253Z 17012G24KT 4SM +TSRA SQ BKN025CB OVC050 24/22 A2978
RMK AO2 PK WND 18036/2247 TSB47 LTG OCNL CG SE SLP076 T02390222
```

Wind 170 at 12, gusts 24. Visibility 4 SM. Heavy thunderstorm rain
(`+TSRA`) plus squall (`SQ`). Sky broken cumulonimbus at 2,500
(`BKN025CB`), overcast at 5,000. Temp / dew 24 / 22 (2-degree spread,
saturated). 29.78 inHg. Peak wind 180/36 at 22:47Z. Thunderstorm began
22:47Z (`TSB47`). Lightning cloud-to-ground occasional to the SE.

Every decision driver fires at once: `+TSRA` is "heavy thunderstorm
with rain" -- stay on the ground. Wind 170/12 G24 with a peak of 36 is
volatile. `BKN025CB` is broken cumulonimbus at 2,500 -- the cells are
at field elevation. Squall (`SQ`) is a wind speed change of 16+ KT
sustained for at least 1 minute. This METAR is a stop-flying report
end to end.

Triage drivers: weather group (`+TSRA SQ`), sky condition (`CB`),
peak wind. The 2-degree spread tells you the air is saturated; further
cooling produces more rain, not less convection.

#### Example 4: low IFR

```text
METAR KFAR 121753Z 36006KT 1/4SM R36/1800FT FG VV002 M01/M02 A3025
RMK AO2 VIS 1/2V3/4 SLP268 T10061017
```

Wind 360 at 6. Visibility 1/4 SM with RVR 1,800 ft on runway 36.
Weather: fog (`FG`, vis under 5/8 SM, distinct from `BR` mist).
**Vertical visibility 200 ft** (`VV002` -- when sky is obscured and
the observer can't see a ceiling, the report gives VV in hundreds of
feet, which substitutes for the ceiling group). Temp / dew -1 / -2
(1-degree spread, at saturation in subfreezing air -- ice-fog risk).
Altimeter 30.25. Visibility varying 1/2 to 3/4 SM (`VIS 1/2V3/4` in
RMK, which signals the prevailing visibility is unstable).

Synoptic story: radiation fog under a high (30.25 inHg, light wind,
clear cooling overnight). The variable visibility in RMK is the
operational tell: the fog is patchy, which means brief lifts to 3/4
SM are possible but the trend is bouncing. The temp at -1 makes this
freezing fog -- droplets can supercool on contact with the airframe,
creating rime ice on a taxi.

Triage drivers: VV002 (no ceiling -- this is "vertical visibility 200
ft," meaning the sky is obscured and the entire vertical column from
surface to 200 ft is the visibility), the 1/4 SM visibility, the
freezing temperature (rime risk).

#### Example 5: mountainous airport

```text
METAR KASE 121953Z 26015G25KT 7SM FEW100 SCT150 BKN200 14/M02 A3019
RMK AO2 PK WND 27030/1947 SLPNO T01441017
```

Aspen at 7,820 ft MSL. Wind 260 at 15 gust 25. Visibility 7 SM. Sky
few at 10,000 (above field by only 2,000 ft), scattered at 15,000,
broken at 20,000. Temp / dew 14 / -2 (16-degree spread, very dry).
Altimeter 30.19. Peak wind 270/30 at 19:47Z. `SLPNO` means sea-level
pressure not available (a station-specific limitation: high-elevation
airports can't extrapolate SLP reliably and omit it).

Synoptic story: a westerly downslope wind in a dry post-frontal regime.
The 25-knot gust at field elevation 7,820 ft means turbulence will
extend several thousand feet AGL on the downwind side of nearby
ridges (mountain rotor / wave). The dry air (16-degree spread) means
density altitude is the takeoff / climb concern, not icing.

Triage drivers: gust factor (10-knot spread), density altitude
(temp 14 deg C at a 7,820 ft field equals a density altitude near
10,300 ft -- climb performance is the limiter), mountain-wave wind
direction. Ceiling (`BKN200`) is non-operational at 20,000 ft.

#### Example 6: marine layer

```text
METAR KSMO 121553Z AUTO 24007KT 8SM OVC008 18/17 A2998
RMK AO2 SLP155 T01830172
```

Santa Monica with a coastal stratus deck. Wind 240 at 7. Visibility
8 SM. Overcast at 800 ft. Temp / dew 18 / 17 (1-degree spread).
Altimeter 29.98. `AO2` station.

The 800-ft overcast at a 1-degree spread is the classic Pacific
marine layer in the SoCal basin -- the cool moist marine air settled
in overnight beneath a temperature inversion, capped by warmer dry
air above. The deck typically burns off mid-morning as surface heating
mixes the inversion out; until it does, vis under the deck is good
(8 SM) but ceilings are at minimums for most VFR operations.

Triage drivers: ceiling `OVC008` (800 ft is below the 1,000 ft floor
for many class-airspace VFR thresholds), spread (1 = the deck won't
lift until heating arrives), wind direction (onshore 240 = the deck
is reinforcing, not breaking up).

#### Example 7: snow shower

```text
METAR KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
RMK AO2 PK WND 29031/1448 SNB28 P0001 SLP054 T10391072
```

Buffalo in active lake-effect. Wind 280 at 18, gusts 29. Visibility
1 1/2 SM. Weather: light snow shower (`-SHSN`) plus blowing snow
(`BLSN`). Overcast 1,500. Temp / dew -4 / -7 (3-degree spread).
Altimeter 29.65. Peak wind 290/31 at 14:48Z. Snow began 14:28Z (`SNB28`).
Precipitation amount 0.01 inch (`P0001`).

Synoptic story: arctic air over Lake Erie. The 3-degree spread keeps
liquid water available in the cloud layer above the snow; the OVC015
ceiling holds while the lake-induced lift continues. Blowing snow
(`BLSN`) at this wind speed is a visibility-and-density-altitude
issue independent of the falling snow.

Triage drivers: visibility (1 1/2 SM -- legal but operationally
marginal), weather group (`-SHSN BLSN` -- two phenomena, both reducing
vis), ceiling (1,500 broken in snow showers is workable for IFR, not
for VFR), peak wind (a 31-knot gust at 5 minutes past observation
suggests the lake-effect band is still strengthening).

### Common gotchas

These are the missed reads that cost pilots most often.

#### Wind direction is true, not magnetic

The METAR wind direction is **true** north reference. The AWOS / ASOS
broadcast on the discrete frequency at the airport reports **magnetic**.
At a 10-degree magnetic variation, that's a 10-degree difference between
the METAR you read and the broadcast you hear at the field. Don't mix
them when computing crosswind.

#### Variable wind direction

Two flavors. `VRB04KT` (literal `VRB`) means the wind speed is below
6 KT and the direction can't be pinned -- the controller will tell you
the runway preference. A separate `nnnVnnn` group after the main wind
group (`23015KT 180V270`) means the direction is varying by more than
60 degrees and the speed is over 6 KT -- the wind has a primary direction
but is shifting; expect gust-front-style direction changes during the
takeoff roll.

#### Prevailing visibility vs RVR

Visibility in the main METAR is **prevailing** -- the visibility seen
through half or more of the horizon circle. RVR in the RMK is the
specific runway visual range, measured by transmissometer on a specific
runway. RVR is more relevant for approach minima; prevailing visibility
is more relevant for VFR cross-country planning. On a 1/4 SM prevailing
day with RVR 4,000 ft on the ILS runway, the prevailing is the bad news;
the RVR is the operational news.

#### Ceiling is BKN or OVC only

A `FEW040 SCT080 BKN150 OVC250` sky has the **ceiling at 15,000**, not
at the first layer (4,000 `FEW`) or the second (8,000 `SCT`). Few and
scattered layers do not constitute a ceiling because more than half the
sky is still visible through them. This matters for VFR weather minimums
under class airspace (1,000 ft ceiling, 3 SM vis) and for approach
minima. A pilot who reads "ceiling" as "the first cloud layer" busts
both regularly.

#### BR vs FG

`BR` (mist) is visibility 5/8 SM to under 7 SM. `FG` (fog) is
visibility under 5/8 SM. The boundary matters for approach minima and
for the regulatory definition of "fog conditions." A `BR` with a closing
spread is the pre-fog warning; once it transitions to `FG`, you've
crossed into a different regulatory regime.

#### AUTO and AO1

An `AUTO` modifier plus an `AO1` station means automated, **without** a
precipitation discriminator. AO1 stations cannot tell rain from snow
from ice pellets, and AO1 stations **cannot report thunderstorms** (no
lightning detector). If an AO1 METAR shows `-RA` near freezing, the
real condition could be `-FZRA`, ice pellets, or wet snow. Treat AO1
weather group as a hint, not a fact, near 0 deg C.

#### Time matters

A METAR is the observation at the time stamped in the date / time group,
not at the time you read it. A 1153Z METAR read at 1230Z is 37 minutes
stale. In a dynamic system (advancing front, lake-effect band, building
convection), 37 minutes can change the report category. Always note
the gap between observation time and reading time.

#### Variable visibility in RMK

When the prevailing visibility is unstable, the RMK carries `VIS
1/2V3/4` (varying between 1/2 and 3/4 SM) or similar. This is operational
truth: a 1/2 SM minimum with intermittent 3/4 SM lifts is a different
flight than a steady 1/2 SM. Always check RMK for visibility variability
on low-visibility days.

#### CB vs TCU

`CB` (cumulonimbus) marks an active thunderstorm cell. `TCU` (towering
cumulus) marks a cell that's building toward thunderstorm but hasn't
produced lightning yet. A `BKN025TCU` is a "watch this layer" report;
within 30-60 minutes a TCU often becomes a CB. The presence of `TCU`
in the sky group while the weather group still reads `-RA` (no `TS`)
is a sequence the pilot watches before convective activity is officially
underway.

### Reference table -- full group order

| #   | Group          | Example                    | Meaning                                                                       |
| --- | -------------- | -------------------------- | ----------------------------------------------------------------------------- |
| 1   | Type indicator | `METAR`                    | Routine hourly report; `SPECI` = special, off-cycle (something changed).      |
| 2   | Station ID     | `KJFK`                     | Four-letter ICAO; `K` prefix in the continental US.                           |
| 3   | Date / time    | `121753Z`                  | Day of month + hour + minute, always Zulu.                                    |
| 4   | Modifier       | `AUTO`                     | `AUTO` = automated; `COR` = corrected. Omitted when neither applies.          |
| 5   | Wind           | `23015G24KT`               | Direction (true) + speed + optional gust; `VRB` below 6 KT, `00000KT` = calm. |
| 5a  | Variable wind  | `180V230`                  | Direction varying through more than 60 deg.                                   |
| 6   | Visibility     | `6SM`                      | Statute miles; `M1/4SM` = less than 1/4 SM; fractions like `1 1/2SM` common.  |
| 6a  | RVR            | `R04R/2000FT`              | Runway visual range; appears at instrument airports when low vis.             |
| 7   | Weather group  | `-RA BR`                   | Intensity + descriptor + phenomenon; multiple groups allowed.                 |
| 8   | Sky condition  | `BKN040`                   | Coverage + height (hundreds ft AGL); `CB` / `TCU` suffix for convective.      |
| 9   | Temp / dew     | `19/18`                    | Celsius, slash-separated; `M` prefix for negative.                            |
| 10  | Altimeter      | `A3002`                    | `A` + four digits = inches Hg x 100.                                          |
| 11  | Remarks        | `RMK AO2 SLP168 T01940183` | Sea-level pressure, station type, hourly precip, free text.                   |

:::
:::phase name="practice"

For each of the next ten METARs you read, force-rank the groups by
impact on a hypothetical flight. Which three would change your decision
if they shifted by one step? The act of ranking trains triage; the
decoding is the prerequisite.

A focused decode drill: pull a current METAR for a Class B airport
(busy, all groups populated) and decode it without reference. Time
yourself. The goal is under 60 seconds for a clean decode of a
well-formed METAR. Speed without correctness is fluency; correctness
without speed is comprehension. Both matter.

Pair drill: pull the METAR for an airport you fly often plus the
METAR for the airport upwind by 100 NM. The upwind report is your
preview -- whatever is hitting them now hits you in roughly the time
it takes the synoptic system to cover 100 NM. The pair-read habit
is how pilots build forecasting intuition that beats the TAF.

:::cards

- front: "What does the SPECI type indicator on a METAR tell you (vs. plain METAR)?"
  back: |
    SPECI = a special, off-cycle observation, issued because something changed
    enough to trigger a report between the routine hourly METARs. The presence
    of a SPECI is itself information: conditions just shifted at that station.
  cardType: basic
  kind: recall
  question_tier: both
  source_authority:
    - kind: ac
      cite: AC 00-45H
    - kind: aim
      cite: AIM 7-1-29
  acs_codes: [PA.I.C.K2a]
  tags: [weather, metar, decode]
  source_ref: |
    AC 00-45H, Chapter 3 -- METAR / SPECI format; AIM 7-1-29 decode key.
  rationale: |
    The body calls out SPECI as "information by its presence." Pilots who decode
    METAR vs SPECI as the same thing miss the trend signal.

- front: "Decode the METAR wind group: 23015G24KT"
  back: |
    Wind from 230 degrees true, 15 knots, gusting to 24 knots. Direction is
    always true (not magnetic) in METARs. The G prefix marks the gust value;
    no G means no gust report.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, wind, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR wind group; AIM 7-1-29.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Decode VRB04KT 180V230 in a METAR"
  back: |
    Wind variable in direction at 4 knots (VRB used for speeds below 6 KT
    when direction can't be pinned). The 180V230 group reports the wind
    direction is varying through more than 60 degrees -- between 180 and 230.
    A combined VRB + nnnVnnn is rare and signals a very gust-prone surface
    flow.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, wind, variable, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR variable-wind reporting (VRB below 6 KT; nVm group when
    variation exceeds 60 deg).
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What does M1/4SM mean in a METAR visibility group, and how does it differ from the RVR group on the same report?"
  back: |
    M1/4SM = prevailing visibility less than one quarter statute mile (the M
    prefix means "less than"). RVR is runway visual range from a
    transmissometer on a specific runway. Prevailing visibility (M1/4SM)
    drives VFR cross-country planning; RVR drives approach minima. On a low
    visibility day, both numbers appear and they answer different operational
    questions.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, visibility, rvr, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 3, prevailing visibility convention + RVR reporting.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Decode the METAR weather group: +TSRA"
  back: |
    Heavy thunderstorm with rain. Coding is intensity + descriptor + phenomenon:
    + = heavy intensity, TS = thunderstorm descriptor, RA = rain phenomenon.
    A bare RA is moderate; -RA is light. FZRA = freezing rain (FZ descriptor).
    VCTS = thunderstorm in the vicinity (5-10 SM from the station).
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, weather-phenomena, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR present-weather group: intensity / descriptor / phenomenon.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What does BR mean in a METAR weather group, and what's the temperature / dew-point signal that goes with it?"
  back: |
    BR = mist (visibility 5/8 SM to under 7 SM). It forms when the temperature /
    dew-point spread closes to ~1 deg C. Another half degree of cooling and BR
    becomes FG (fog, visibility under 5/8 SM). BR plus a 1-degree spread is a
    "you're at the ragged edge of fog" signal -- watch the trend, not the
    current number.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, fog, weather-phenomena, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR weather phenomena (BR vs FG); body Stage 2 example.
  rationale: |
    Triage card: pairs the decoded fact (BR) with its synoptic meaning
    (mist + small spread = pre-fog) so the learner doesn't stop at decode.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Decode BKN015 in a METAR sky-condition group, and explain why a FEW040 SCT080 BKN150 OVC250 sky has its ceiling at 15,000."
  back: |
    BKN015 = broken layer (5-7 oktas of coverage) at 1,500 feet AGL. The
    ceiling for regulatory purposes is the lowest BKN or OVC layer -- FEW
    (1-2 oktas) and SCT (3-4 oktas) are not ceilings because more than half
    the sky remains visible through them. In FEW040 SCT080 BKN150 OVC250,
    the ceiling is the BKN150 layer at 15,000 ft.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, sky-condition, ceiling, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR sky-condition coding; gotcha "Ceiling is BKN or OVC only."
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Decode M03/M05 and A2992 in a METAR"
  back: |
    Temperature -3 deg C, dew point -5 deg C (M prefix = minus / negative);
    altimeter setting 29.92 inches of mercury (A prefix, four digits = inches
    Hg x 100). Temperature and dew point are slash-separated, in deg C. A
    2-degree spread at subfreezing temperatures is the icing setup: cloud
    droplets are supercooled and ready to freeze on the airframe.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, temperature, altimeter, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR temp / dew point and altimeter groups.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Read the groups of a METAR in order. What's the canonical sequence?"
  back: |
    Type indicator -> Station ID -> Date / time (DDHHMMZ) -> Modifiers
    (AUTO / COR) -> Wind -> Visibility -> Weather phenomena -> Sky condition
    -> Temp / dew point -> Altimeter -> Remarks (RMK). Reading in fixed order
    every time is the discipline that makes decode automatic.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, ac-00-45h]
  source_ref: |
    AC 00-45H Chapter 3; AIM 7-1-29 decode key.
  rationale: |
    Foundation card: the body opens Stage 1 with the fixed group order.
    Without this sequence the rest of the decode cards have nothing to
    anchor to.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Why does a temperature / dew-point spread of 1 deg C drive the go / no-go decision more than the current visibility number?"
  back: |
    Current visibility is a snapshot; the spread is the rate-of-change signal.
    A 1 deg C spread means a half degree of cooling forms fog (visibility
    under 5/8 SM). If the flight launches now and the spread closes during
    climb-out, the pilot loses the destination to fog before arrival -- even
    though the departure METAR showed legal VFR. Triage asks "which number,
    if it shifted by one step, would change my decision?" The spread is that
    number on a near-saturation morning.
  cardType: basic
  kind: recall
  tags: [weather, metar, triage, fog, go-nogo, ac-00-45h]
  source_ref: |
    Body Stage 3 (Triage) -- the "rate-of-change toward IFR" reasoning.
  rationale: |
    Triage card. The body's central pedagogical point is that decode is
    prerequisite, triage is the goal. This card forces the learner to
    articulate the trend logic, not just the static decode.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What does AUTO AO1 tell you about a METAR's weather and sky reports, especially near freezing?"
  back: |
    AUTO = automated station, no human observer. AO1 = automated WITHOUT a
    precipitation discriminator. AO1 stations cannot tell rain from snow from
    ice pellets, and AO1 stations cannot report thunderstorms (no lightning
    detector). Near 0 deg C, an AO1 -RA could really be -FZRA, IP, or wet SN.
    Treat the AO1 weather group as a hint, not a fact, when temperatures are
    near freezing. AO2 stations have the discriminator and can be trusted at
    face value.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, auto, ao1, ao2, gotcha]
  source_ref: |
    AC 00-45H, METAR remarks (AO1 vs AO2 station types); body gotchas.
  rationale: |
    The AO1 / AO2 distinction is a common reading gap -- pilots assume the
    weather group is observed regardless of station type.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Decode VV002 in a METAR. When does it appear, and what does it tell you?"
  back: |
    VV002 = vertical visibility 200 ft. The VV group replaces the sky-condition
    group when the sky is OBSCURED (the observer cannot see a cloud layer at
    all) -- usually in dense fog, heavy snow, or volcanic ash. It reports how
    far up the observer can see vertically before the obscuration cuts off
    visibility. Operationally: when you see VV in a METAR, the ceiling
    concept doesn't apply -- the column from surface up to VV height IS the
    visibility.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, sky-condition, obscured, fog]
  source_ref: |
    AC 00-45H, sky-condition group: VV reporting for obscured skies.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "What's the difference between CB and TCU in a METAR sky group, and what should TCU prompt you to watch for?"
  back: |
    CB = cumulonimbus (active thunderstorm cell -- the weather group will
    typically carry TS as well). TCU = towering cumulus (cell building toward
    thunderstorm but not yet producing lightning). When a METAR carries TCU
    in the sky group but no TS in the weather group, watch the next two SPECI
    issuances -- TCU often transitions to CB within 30-60 minutes as the
    updraft cycle completes. TCU is the "convection is imminent" report.
  cardType: basic
  kind: recall
  tags: [weather, metar, decode, sky-condition, convective, ac-00-45h]
  source_ref: |
    AC 00-45H, METAR sky-condition coding (CB / TCU suffix); body gotchas.
  acs_codes: [PA.I.C.K2a, PA.I.C.K3h]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key

- front: "Why is METAR wind direction reported relative to true north when AWOS / ASOS at the airport broadcasts magnetic?"
  back: |
    METAR is a structured product issued by the NWS for use across regulatory
    systems (forecasts, climatology, ATC products) -- those systems
    standardise on true north. AWOS / ASOS broadcasts at the airport are
    pilot-facing operational tools -- pilots use magnetic for runway
    selection, so the broadcast converts to magnetic. The gap is the local
    magnetic variation (5-20 degrees in the continental US). Don't mix the
    two when computing crosswind: use METAR true winds against true runway
    headings, or AWOS magnetic against magnetic runway numbers.
  cardType: basic
  kind: recall
  tags: [weather, metar, wind, true-vs-magnetic, gotcha]
  source_ref: |
    AC 00-45H Chapter 3 conventions; body gotchas.
  acs_codes: [PA.I.C.K2a]
  source_authority:
    - kind: ac
      cite: AC 00-45H Aviation Weather Services
    - kind: aim
      cite: AIM 7-1-29 -- METAR / TAF Decode Key
:::

:::
:::phase name="connect"

This node is the foundation of the encoded-text family. The same
three-stage ladder (decode -> understand -> triage) applies to:

- **TAFs** -- the same encoding rules in forecast form, with change
  groups (FM / TEMPO / PROB / BECMG). See `wx-reading-tafs`.
- **PIREPs** -- decode the encoded location / altitude / aircraft type /
  weather; understand the conditions that produced the report; triage
  what matters for your route.
- **AIRMETs / SIGMETs / Convective SIGMETs** -- decode the polygon, valid
  time, and phenomenon; understand whether the conditions match a
  synoptic story; triage which advisory intersects your route at your
  time.
- **Winds and Temperatures Aloft (FB)** -- decode the encoded station /
  altitude / direction-speed-temperature; understand the trend across
  altitudes; triage the cruise altitude that best fits the flight.

Every encoded-text product invites the same wall: the learner gets
stuck at decode and the report becomes ambient noise. Spending the
time to drill triage on the most-read product makes the rest of the
family inherit the habit.

The METAR also feeds:

- **Go / no-go decision** -- METAR + TAF + personal minimums is the
  most direct decision input.
- **VFR weather minimums** -- the METAR ceiling + visibility maps to
  airspace VFR minimums for any airport you're transiting.
- **Airframe icing risk** -- temperature + dew-point spread + sky
  condition in winter is the first signal for in-flight icing setup.

:::
:::phase name="verify"

Pull three METARs from three airports across one synoptic system
(west-to-east across a frontal passage, or north-to-south across a
marine layer). Read them in order. Do they tell a coherent synoptic
story that matches the surface analysis from the same hour? When they
don't, where does the disagreement live, and what does that tell you
about local effects, station siting, or report timing?

For your home airport, watch the METAR sequence across a 12-hour
period spanning sunrise and sunset. Note where the diurnal cycle
shows: temperature trace, ceiling lift-and-fall, wind shift at sunset.
Familiarity with the home-airport rhythm is what makes the away-airport
report parseable on the first read.

:::