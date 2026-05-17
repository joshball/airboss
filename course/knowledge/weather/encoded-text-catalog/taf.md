# TAF catalog

Every realistic Terminal Aerodrome Forecast (TAF) shape pilots encounter, organized by token family. Each example is a real-shape TAF that round-trips through `parseTaf` from `@ab/wx-charts` with zero warnings. The teaching surface is [reading-tafs](../reading-tafs/node.md); this is the reference card.

Header order (per AC 00-45H Ch 4 + AIM 7-1-29):

1. Type indicator (`TAF`, optionally `AMD` or `COR`)
2. Station identifier (4-letter ICAO)
3. Issuance time (`DDhhmmZ`)
4. Validity period (`DDHH/DDHH`)
5. Initial forecast body (wind / vis / weather / sky)
6. Zero or more change groups (`FM` / `TEMPO` / `PROB30` / `PROB40` / `BECMG`)

A TAF reads like a METAR with a validity window and change groups. The same token families - wind, visibility, weather, sky - appear in the initial body and in every change group, with one important departure: TAFs use `P6SM` shorthand for "visibility 6 SM or greater" at some stations, but our parser today expects the explicit `6SM` form. The catalog uses `6SM` throughout so every example round-trips clean.

## Header

The TAF header tells the pilot when the forecast was issued, the window it covers, and whether it's a routine issuance, an amendment (`AMD`), or a correction (`COR`).

### Routine TAF

Four-times-daily issuance at 00Z / 06Z / 12Z / 18Z, with a 24-hour validity window starting roughly an hour after issuance.

```text
TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
```

```text
TAF KBGR 121120Z 1212/1318 31010KT 6SM SKC
```

```text
TAF KMIA 121120Z 1212/1318 09010KT 6SM SCT040 BKN250
```

### Amended TAF (AMD)

Issued off-cycle when the existing forecast diverges enough from observed conditions that the forecaster needs to replace it. Acts as supersession; the prior TAF is dead.

```text
TAF AMD KDFW 121800Z 1218/1324 27020G30KT 6SM SCT030 BKN100
```

```text
TAF AMD KMSP 122000Z 1220/1324 33020G35KT 4SM -SN BKN030
```

```text
TAF AMD KSEA 121600Z 1216/1318 19015KT 5SM -RA OVC025
```

### Corrected TAF (COR)

Issued when the prior TAF was wrong (transcription error, missed group). Replaces the prior; window stays the same.

```text
TAF COR KJFK 121120Z 1212/1318 22014KT 6SM FEW250
```

```text
TAF COR KBOS 121120Z 1212/1318 24012KT 6SM SCT030 BKN100
```

```text
TAF COR KCLT 121120Z 1212/1318 19010KT 6SM FEW040 BKN200
```

## Validity window

`DDHH/DDHH` - day-of-month + hour, twice. First pair is start; second pair is end. `1212/1318` = valid from the 12th at 1200Z to the 13th at 1800Z (a 30-hour window common at major airports). Standard windows are 24 or 30 hours; shorter windows appear for less-traveled airports.

```text
TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
```

```text
TAF KMIA 121120Z 1212/0918 09010KT 6SM SCT040 BKN250
```

```text
TAF KBGR 121120Z 1212/1318 31010KT 6SM SKC
```

## Initial forecast body

The body following the validity range describes the prevailing forecast at the start of the window. Same token families as a METAR: wind, visibility, weather, sky. The forecast holds until the first `FM` group (if any); without `FM`, it holds through the validity end.

### Clean VFR (no change groups)

A confident forecast: the prevailing holds the entire window, no FM / TEMPO / PROB / BECMG. Common in dry post-frontal regimes or under strong highs.

```text
TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
```

```text
TAF KBGR 121120Z 1212/1318 31010KT 6SM SKC
```

```text
TAF KBOI 121120Z 1212/1318 28008KT 6SM FEW250
```

### Visibility conventions in TAFs

TAFs use the same `nSM` form as METARs for visibility under 6 SM. Visibility 6 SM or greater is often shown as `6SM` in our examples (rather than `P6SM`) for parser compatibility; the operational meaning is identical.

```text
TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
```

```text
TAF KFAR 121120Z 1212/1318 36006KT 6SM SKC TEMPO 1300/1306 1SM FG VV003
```

```text
TAF KBUF 121120Z 1212/1318 27018G25KT 4SM -SN BKN020 PROB40 1218/1224 1SM +SN VV008
```

## Change groups

The four change-group keywords - `FM`, `TEMPO`, `PROB30` / `PROB40`, `BECMG` - mark how the forecast evolves through the validity window. Each carries its own validity range and its own body of wind / visibility / weather / sky tokens.

### FM (from) - definite shift

`FM` + `DDhhmm` (no slash). Marks a definite, lasting change at the given time. The body following `FM` replaces the prior prevailing forecast and holds until the next `FM` group (or the validity end). Used for frontal passages, sea-breeze onset, diurnal heating sequences.

```text
TAF KSTL 121120Z 1212/1318 18015G22KT 6SM BKN040 FM121900 27020G30KT 6SM SCT030 BKN100
```

```text
TAF KMSP 121120Z 1212/1318 18012KT 6SM SCT040 FM121800 21015G25KT 6SM BKN050 FM130200 28012KT 6SM SKC
```

```text
TAF KSMO 121120Z 1212/1318 24007KT 4SM BR OVC008 FM121800 25010KT 6SM SCT025 BKN150
```

### TEMPO - transient excursion

`TEMPO` + `DDHH/DDHH`. Brief, transient excursions from the prevailing forecast lasting less than an hour and covering less than half the period. The prevailing returns when the TEMPO window ends.

```text
TAF KDFW 121120Z 1212/1318 18015KT 6SM SCT040 TEMPO 1218/1222 4SM TSRA BKN035CB
```

```text
TAF KFAR 121120Z 1212/1318 36006KT 6SM SKC TEMPO 1300/1306 1SM FG VV003
```

```text
TAF KMIA 121120Z 1212/1318 09010KT 6SM SCT040 BKN250 TEMPO 1218/1223 9SM VCTS SCT040CB
```

### PROB30 - 30% probability

`PROB30` + `DDHH/DDHH`. The forecaster sees a 30-50% chance the condition will occur during the window. Reserved for thunderstorms and other significant weather where the forecaster's confidence is below the FM / BECMG threshold.

```text
TAF KICT 121120Z 1212/1318 19012KT 6SM SCT040 PROB30 1306/1310 1SM TSRA BKN025CB
```

```text
TAF KOKC 121120Z 1212/1318 18015G22KT 6SM SCT050 PROB30 1300/1306 4SM TSRA BKN035CB
```

```text
TAF KMSY 121120Z 1212/1318 14010KT 6SM SCT040 PROB30 1218/1224 3SM TSRA BKN030CB
```

### PROB40 - 40% probability

Same shape as `PROB30` but with a 40-50% confidence range. Used for windows where the forecaster expects significant weather to occur but cannot commit to a definite shift.

```text
TAF KBUF 121120Z 1212/1318 27018G25KT 4SM -SN BKN020 PROB40 1218/1224 1SM +SN VV008
```

```text
TAF KGRR 121120Z 1212/1318 09015G22KT 5SM -RA OVC020 PROB40 1218/1224 3SM -FZRA OVC008
```

```text
TAF KMSP 121120Z 1212/1318 33012G22KT 6SM BKN025 PROB40 1306/1312 1SM -SN BKN008
```

### BECMG - becoming

`BECMG` + `DDHH/DDHH`. A gradual transition over the named window; by the end of the window the new condition is the prevailing. Used when the forecaster sees a slow change (gradual front, gradual clearing) rather than a sharp one.

```text
TAF KMSP 121120Z 1212/1318 27015KT 6SM BKN040 BECMG 1306/1308 24010KT 6SM SCT050
```

```text
TAF KORD 121120Z 1212/1318 28012KT 6SM OVC020 BECMG 1218/1220 25008KT 6SM BKN060
```

```text
TAF KSEA 121120Z 1212/1318 19010KT 4SM -RA BKN015 BECMG 1218/1220 22008KT 6SM SCT025 BKN150
```

## Composite canonical TAFs

Each composite TAF exercises multiple change groups together. Read each one straight through, then look at the manifest below for the synoptic story and the triage drivers.

### Clean VFR - no change groups (confident calm)

```text
TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
```

Post-frontal cold sector under a strong surface high. Prevailing holds the entire window. Triage: wind, ceiling (none below 25,000 = non-operational), spread.

### TEMPO thunderstorm window

```text
TAF KDFW 121120Z 1212/1318 18015KT 6SM SCT040 TEMPO 1218/1222 4SM TSRA BKN035CB
```

Afternoon convective trigger inside a pre-frontal southerly surge. Triage: TEMPO window timing, TSRA, CB.

### PROB30 IFR window

```text
TAF KICT 121120Z 1212/1318 19012KT 6SM SCT040 PROB30 1306/1310 1SM TSRA BKN025CB
```

Pre-frontal southerly flow with overnight convection possible but not certain. Triage: PROB30 window, IFR risk, alternate planning.

### Frontal passage - multiple FM groups

```text
TAF KMSP 121120Z 1212/1318 18012KT 6SM SCT040 FM121800 21015G25KT 6SM BKN050 FM130200 28012KT 6SM SKC
```

Cold front through MSP: pre-frontal southerly flow at the start, frontal passage at 18Z with wind backing to 210 with gusts, then post-frontal NW clearing at 02Z. Triage: FM timing accuracy, wind shift, ceiling lifts.

### TAF AMD - issued because prior was wrong

```text
TAF AMD KDFW 121800Z 1218/1324 27020G30KT 6SM SCT030 BKN100
```

Off-cycle amendment: the morning TAF underplayed the post-frontal wind. New prevailing covers 1218 through 1324. Triage: amendment trigger (what changed), wind, ceiling.

### Lake-effect TAF with PROB40

```text
TAF KBUF 121120Z 1212/1318 27018G25KT 4SM -SN BKN020 PROB40 1218/1224 1SM +SN VV008
```

Buffalo in active lake-effect off Lake Erie: light shower snow most of the window, with a 40% chance of a heavier band cutting visibility to 1 SM and obscuring the sky. Triage: PROB40 window, visibility floor, ceiling.

### Mountain airport - downslope FM

```text
TAF KASE 121120Z 1212/1318 26020G35KT 6SM FEW100 SCT150 BKN200 FM122200 28015G28KT 6SM SCT100 BKN180
```

Aspen with strong westerly downslope through the day, easing slightly after 22Z. Triage: gust factor across the window, mountain-wave timing, ceiling (operationally non-binding at 20,000+ ft).

### Marine layer dissipation

```text
TAF KSMO 121120Z 1212/1318 24007KT 4SM BR OVC008 FM121800 25010KT 6SM SCT025 BKN150
```

Santa Monica Pacific marine stratus burning off mid-morning; FM at 18Z marks the inversion mix-out. Triage: FM accuracy (deck typically clears 1-3 hours late or early), ceiling lift, visibility.

### Freezing rain transition - BECMG

```text
TAF KGRR 121120Z 1212/1318 09015G22KT 5SM -RA OVC020 PROB40 1218/1224 3SM -FZRA OVC008
```

Grand Rapids overrunning warm air; light rain at the surface with a 40% chance the warm nose erodes and freezing rain develops. Triage: PROB40 window, FZRA risk, ceiling.

## Scenario-derived examples

The TAFs below are emitted verbatim by the wx-engine truth-model scenarios under `libs/wx-engine/`. Each is the terminal forecast a scenario derives from its synoptic truth, so the `generatedBy` pointer in the manifest is literal: the catalog example *is* the scenario's output. They round-trip through `parseTaf` because the engine enforces that on every product it emits.

### Frontal passage - VCSH with an FM wind shift

```text
TAF KSTL 191820Z 1919/2007 20014KT 5SM VCSH BKN045 FM192000 32020G30KT 5SM VCSH OVC025
```

St Louis in the `frontal-xc-march` scenario: pre-frontal southerly flow with showers in the vicinity, then an `FM` group at 2000Z marking the cold-front passage - wind veers to 320 with gusts to 30 and the ceiling drops to 2,500 ft overcast.

### Summer thunderstorm - PROB30 with CB

```text
TAF KIAH 152020Z 1521/1609 13010KT 3SM OVC015 PROB30 1521/1605 4SM -TSRA BKN045CB
```

Houston in the `summer-thunderstorms-tx` scenario: a low overcast initial body with a long `PROB30` window for light thunderstorm with rain and a cumulonimbus layer - the forecaster's 30% confidence in convective coverage over the terminal.

### Mountain downslope - clean strong-wind forecast

```text
TAF KASE 122020Z 1221/1309 27025G38KT 6SM FEW060
```

Aspen in the `mountain-wave-rockies` scenario: a clean forecast with no change groups, but strong westerly downslope wind at 25 gusting 38 across the whole window. The gust factor and mountain-wave turbulence are the entire story.

### Marine layer - SKC clearing to a BKN deck via FM

```text
TAF KSCK 181520Z 1816/1904 03006KT 6SM SKC FM181900 30008G12KT 6SM BKN008
```

Stockton in the `marine-stratus-pacific-nw` scenario: clear early, then an `FM` group at 1900Z as the marine push arrives - wind backs onshore and an 800-ft broken deck moves in.

### Winter icing regime - low IFR overcast forecast

```text
TAF KCLE 221420Z 2215/2303 32020G30KT 3SM OVC015
```

Cleveland in the `winter-icing-great-lakes` scenario: a single-body forecast holding low IFR the whole window - NW gales at 320G30, 3 SM, overcast at 1,500 ft. The forecaster sees no break in the upslope/lake-effect regime.

## Catalog manifest

The structured metadata below is what the catalog build script reads. Every example round-trips through `parseTaf` with zero warnings; failing examples block `bun run check`.

```yaml-catalog
product: taf
references_default:
  - source: AC 00-45H
    detail: Chapter 4 - Aerodrome Forecasts (TAF)
  - source: AIM
    detail: 7-1-29 - Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)
token_families:
  - slug: header-routine
    label: Routine TAF
    decode: Four-times-daily issuance at 00 / 06 / 12 / 18 Z with a 24-30 hour validity window.
    references:
      - source: AC 00-45H
        detail: Chapter 4, TAF issuance cycle
    examples: [taf-ord-vfr, taf-bgr-cold-clear, taf-mia-vfr]
  - slug: header-amd
    label: Amended TAF (AMD)
    decode: Off-cycle issuance superseding the prior TAF because conditions diverged enough to require a new forecast.
    references:
      - source: AC 00-45H
        detail: Chapter 4, amendment triggers
    examples: [taf-amd-dfw, taf-amd-msp, taf-amd-sea]
  - slug: header-cor
    label: Corrected TAF (COR)
    decode: The prior TAF was wrong (transcription / missed group). The COR replaces it, validity unchanged.
    references:
      - source: AC 00-45H
        detail: Chapter 4, correction handling
    examples: [taf-cor-jfk, taf-cor-bos, taf-cor-clt]
  - slug: validity-window
    label: DDHH/DDHH validity window
    decode: Day + hour, twice. First pair = start; second pair = end. 24-30 hour window at major airports.
    references:
      - source: AC 00-45H
        detail: Chapter 4, validity-period encoding
    examples: [taf-ord-vfr, taf-mia-21h, taf-bgr-cold-clear]
  - slug: initial-vfr
    label: Initial body (prevailing) - VFR
    decode: The body following the validity range describes the prevailing forecast at window start. Holds until first change group.
    references:
      - source: AC 00-45H
        detail: Chapter 4, prevailing forecast structure
    examples: [taf-ord-vfr, taf-bgr-cold-clear, taf-boi-vfr, taf-scenario-ase-mtnwave, taf-scenario-cle-icing]
  - slug: fm-from
    label: FM (from) - definite shift
    decode: FM + DDhhmm marks a definite lasting change. The new body replaces the prevailing until the next FM (or validity end).
    references:
      - source: AC 00-45H
        detail: Chapter 4, FM group
    examples: [taf-fm-stl, taf-fm-multi, taf-marine-fm, taf-scenario-stl-frontal-fm, taf-scenario-sck-marine-fm]
  - slug: tempo-transient
    label: TEMPO - transient excursion
    decode: TEMPO + DDHH/DDHH marks brief excursions (< 1 hour, less than half the period). The prevailing returns when the window ends.
    references:
      - source: AC 00-45H
        detail: Chapter 4, TEMPO group
    examples: [taf-tempo-tsra, taf-tempo-fog, taf-tempo-mia-vcts]
  - slug: prob30
    label: PROB30 - 30% probability
    decode: PROB30 + DDHH/DDHH marks a 30-50% chance of the named condition during the window. Reserved for significant weather where confidence is below the FM threshold.
    references:
      - source: AC 00-45H
        detail: Chapter 4, PROB groups
    examples: [taf-prob30-ict, taf-prob30-okc, taf-prob30-msy, taf-scenario-iah-prob30]
  - slug: prob40
    label: PROB40 - 40% probability
    decode: PROB40 + DDHH/DDHH. Same shape as PROB30 with a 40-50% confidence range.
    references:
      - source: AC 00-45H
        detail: Chapter 4, PROB groups
    examples: [taf-prob40-buf, taf-prob40-grr, taf-prob40-msp]
  - slug: becmg
    label: BECMG - becoming
    decode: BECMG + DDHH/DDHH marks a gradual transition. By window end the new condition is prevailing. Used for slow changes (gradual fronts / clearing).
    references:
      - source: AC 00-45H
        detail: Chapter 4, BECMG group
    examples: [taf-becmg-msp, taf-becmg-ord, taf-becmg-sea]
examples:
  - slug: taf-ord-vfr
    raw: TAF KORD 121120Z 1212/1318 27015G25KT 6SM FEW250
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: ORD post-frontal cold sector under a surface high; clean VFR with no change groups.
    triage_drivers: [wind, ceiling, spread]
  - slug: taf-bgr-cold-clear
    raw: TAF KBGR 121120Z 1212/1318 31010KT 6SM SKC
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Bangor in continental polar air; calm-confidence clear forecast.
    triage_drivers: [temperature, wind, sky]
  - slug: taf-mia-vfr
    raw: TAF KMIA 121120Z 1212/1318 09010KT 6SM SCT040 BKN250
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Miami in trade-wind easterlies under a Bermuda high; scattered cumulus and high cirrus.
    triage_drivers: [wind, ceiling, sea-breeze timing]
  - slug: taf-amd-dfw
    raw: TAF AMD KDFW 121800Z 1218/1324 27020G30KT 6SM SCT030 BKN100
    token_families: [header-amd, validity-window]
    synoptic: DFW afternoon amendment; morning TAF underplayed the post-frontal wind.
    triage_drivers: [amendment trigger, wind, ceiling]
  - slug: taf-amd-msp
    raw: TAF AMD KMSP 122000Z 1220/1324 33020G35KT 4SM -SN BKN030
    token_families: [header-amd, validity-window]
    synoptic: Twin Cities amendment after onset of light snow with NW gusts to 35.
    triage_drivers: [amendment trigger, weather, ceiling]
  - slug: taf-amd-sea
    raw: TAF AMD KSEA 121600Z 1216/1318 19015KT 5SM -RA OVC025
    token_families: [header-amd, validity-window]
    synoptic: Seattle amendment after stratiform rain arrived earlier than the morning TAF predicted.
    triage_drivers: [amendment trigger, ceiling, visibility]
  - slug: taf-cor-jfk
    raw: TAF COR KJFK 121120Z 1212/1318 22014KT 6SM FEW250
    token_families: [header-cor, validity-window]
    synoptic: JFK correction; prior had wind direction transposed.
    triage_drivers: [wind, sky, spread]
  - slug: taf-cor-bos
    raw: TAF COR KBOS 121120Z 1212/1318 24012KT 6SM SCT030 BKN100
    token_families: [header-cor, validity-window]
    synoptic: Boston correction; prior missed the broken layer.
    triage_drivers: [ceiling, wind, route]
  - slug: taf-cor-clt
    raw: TAF COR KCLT 121120Z 1212/1318 19010KT 6SM FEW040 BKN200
    token_families: [header-cor, validity-window]
    synoptic: Charlotte correction; prior had a transcription error in the sky group.
    triage_drivers: [sky, wind, ceiling]
  - slug: taf-mia-21h
    raw: TAF KMIA 121120Z 1212/0918 09010KT 6SM SCT040 BKN250
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Miami with a 22-hour window spanning a calendar boundary (12-1212 to 13-0918 captured here within the FAA DDHH convention; parser anchors month).
    triage_drivers: [wind, ceiling, spread]
  - slug: taf-boi-vfr
    raw: TAF KBOI 121120Z 1212/1318 28008KT 6SM FEW250
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Boise under a surface high with light westerlies; clean VFR.
    triage_drivers: [wind, sky, spread]
  - slug: taf-fm-stl
    raw: TAF KSTL 121120Z 1212/1318 18015G22KT 6SM BKN040 FM121900 27020G30KT 6SM SCT030 BKN100
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: St Louis cold-front passage at 19Z; pre-frontal southerly flow shifts to NW with stronger gusts.
    triage_drivers: [FM timing, wind shift, gust factor]
  - slug: taf-fm-multi
    raw: TAF KMSP 121120Z 1212/1318 18012KT 6SM SCT040 FM121800 21015G25KT 6SM BKN050 FM130200 28012KT 6SM SKC
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: 'Twin Cities with two FM groups: pre-frontal back to 210/15G25 at 18Z, then post-frontal clearing at 02Z.'
    triage_drivers: [FM timing, wind sequence, ceiling]
  - slug: taf-marine-fm
    raw: TAF KSMO 121120Z 1212/1318 24007KT 4SM BR OVC008 FM121800 25010KT 6SM SCT025 BKN150
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: Santa Monica marine layer dissipates at 18Z as surface heating mixes out the inversion.
    triage_drivers: [FM accuracy, ceiling lift, visibility]
  - slug: taf-tempo-tsra
    raw: TAF KDFW 121120Z 1212/1318 18015KT 6SM SCT040 TEMPO 1218/1222 4SM TSRA BKN035CB
    token_families: [header-routine, validity-window, initial-vfr, tempo-transient]
    synoptic: DFW afternoon convective trigger inside a pre-frontal southerly surge.
    triage_drivers: [TEMPO window, TSRA, CB]
  - slug: taf-tempo-fog
    raw: TAF KFAR 121120Z 1212/1318 36006KT 6SM SKC TEMPO 1300/1306 1SM FG VV003
    token_families: [header-routine, validity-window, initial-vfr, tempo-transient]
    synoptic: Fargo with overnight radiation fog forming around 00-06Z then lifting.
    triage_drivers: [TEMPO window, fog timing, alternate planning]
  - slug: taf-tempo-mia-vcts
    raw: TAF KMIA 121120Z 1212/1318 09010KT 6SM SCT040 BKN250 TEMPO 1218/1223 9SM VCTS SCT040CB
    token_families: [header-routine, validity-window, initial-vfr, tempo-transient]
    synoptic: Miami afternoon TEMPO for vicinity thunderstorm in tropical maritime air.
    triage_drivers: [TEMPO window, VCTS, CB]
  - slug: taf-prob30-ict
    raw: TAF KICT 121120Z 1212/1318 19012KT 6SM SCT040 PROB30 1306/1310 1SM TSRA BKN025CB
    token_families: [header-routine, validity-window, initial-vfr, prob30]
    synoptic: Wichita pre-frontal southerly flow with overnight convection possible but not certain.
    triage_drivers: [PROB30 window, IFR risk, alternate]
  - slug: taf-prob30-okc
    raw: TAF KOKC 121120Z 1212/1318 18015G22KT 6SM SCT050 PROB30 1300/1306 4SM TSRA BKN035CB
    token_families: [header-routine, validity-window, initial-vfr, prob30]
    synoptic: Oklahoma City overnight with 30% chance of thunderstorm at the head of a mesoscale convective complex.
    triage_drivers: [PROB30 window, TSRA, CB]
  - slug: taf-prob30-msy
    raw: TAF KMSY 121120Z 1212/1318 14010KT 6SM SCT040 PROB30 1218/1224 3SM TSRA BKN030CB
    token_families: [header-routine, validity-window, initial-vfr, prob30]
    synoptic: New Orleans afternoon PROB30 for sea-breeze-trigger thunderstorm.
    triage_drivers: [PROB30 window, TSRA, ceiling]
  - slug: taf-prob40-buf
    raw: TAF KBUF 121120Z 1212/1318 27018G25KT 4SM -SN BKN020 PROB40 1218/1224 1SM +SN VV008
    token_families: [header-routine, validity-window, initial-vfr, prob40]
    synoptic: Buffalo lake-effect with light snow most of the window; PROB40 for a heavier band.
    triage_drivers: [PROB40 window, visibility floor, ceiling]
  - slug: taf-prob40-grr
    raw: TAF KGRR 121120Z 1212/1318 09015G22KT 5SM -RA OVC020 PROB40 1218/1224 3SM -FZRA OVC008
    token_families: [header-routine, validity-window, initial-vfr, prob40]
    synoptic: Grand Rapids overrunning warm air; 40% chance the warm nose erodes and FZRA develops.
    triage_drivers: [PROB40 window, FZRA risk, ceiling]
  - slug: taf-prob40-msp
    raw: TAF KMSP 121120Z 1212/1318 33012G22KT 6SM BKN025 PROB40 1306/1312 1SM -SN BKN008
    token_families: [header-routine, validity-window, initial-vfr, prob40]
    synoptic: Twin Cities with PROB40 for snow band lowering ceiling to 800 ft overnight.
    triage_drivers: [PROB40 window, ceiling, visibility]
  - slug: taf-becmg-msp
    raw: TAF KMSP 121120Z 1212/1318 27015KT 6SM BKN040 BECMG 1306/1308 24010KT 6SM SCT050
    token_families: [header-routine, validity-window, initial-vfr, becmg]
    synoptic: Twin Cities gradual clearing overnight as cold sector ridges in.
    triage_drivers: [BECMG window, ceiling, wind shift]
  - slug: taf-becmg-ord
    raw: TAF KORD 121120Z 1212/1318 28012KT 6SM OVC020 BECMG 1218/1220 25008KT 6SM BKN060
    token_families: [header-routine, validity-window, initial-vfr, becmg]
    synoptic: Chicago gradual mid-afternoon lift as deck rises and breaks.
    triage_drivers: [BECMG window, ceiling lift, wind easing]
  - slug: taf-becmg-sea
    raw: TAF KSEA 121120Z 1212/1318 19010KT 4SM -RA BKN015 BECMG 1218/1220 22008KT 6SM SCT025 BKN150
    token_families: [header-routine, validity-window, initial-vfr, becmg]
    synoptic: Seattle gradual clearing after light rain pushes inland.
    triage_drivers: [BECMG window, visibility, ceiling]
  - slug: taf-ase-mountain
    raw: TAF KASE 121120Z 1212/1318 26020G35KT 6SM FEW100 SCT150 BKN200 FM122200 28015G28KT 6SM SCT100 BKN180
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: Aspen westerly downslope through the day, easing slightly after 22Z.
    triage_drivers: [gust factor, mountain wave, ceiling (operationally non-binding)]
  - slug: taf-scenario-stl-frontal-fm
    raw: TAF KSTL 191820Z 1919/2007 20014KT 5SM VCSH BKN045 FM192000 32020G30KT 5SM VCSH OVC025
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: St Louis cold-front passage in the frontal-xc-march scenario; an FM group at 2000Z veers the wind to 320G30 and drops the ceiling.
    triage_drivers: [FM timing, wind shift, ceiling]
  - slug: taf-scenario-iah-prob30
    raw: TAF KIAH 152020Z 1521/1609 13010KT 3SM OVC015 PROB30 1521/1605 4SM -TSRA BKN045CB
    token_families: [header-routine, validity-window, initial-vfr, prob30]
    synoptic: Houston in the summer-thunderstorms-tx scenario; a long PROB30 window for light thunderstorm with a CB layer over the terminal.
    triage_drivers: [PROB30 window, TSRA, CB]
  - slug: taf-scenario-ase-mtnwave
    raw: TAF KASE 122020Z 1221/1309 27025G38KT 6SM FEW060
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Aspen in the mountain-wave-rockies scenario; a clean no-change-group forecast with strong westerly downslope gusts to 38.
    triage_drivers: [gust factor, mountain wave, wind direction]
  - slug: taf-scenario-sck-marine-fm
    raw: TAF KSCK 181520Z 1816/1904 03006KT 6SM SKC FM181900 30008G12KT 6SM BKN008
    token_families: [header-routine, validity-window, initial-vfr, fm-from]
    synoptic: Stockton in the marine-stratus-pacific-nw scenario; an FM group at 1900Z brings the marine push and an 800-ft broken deck.
    triage_drivers: [FM timing, ceiling, wind shift]
  - slug: taf-scenario-cle-icing
    raw: TAF KCLE 221420Z 2215/2303 32020G30KT 3SM OVC015
    token_families: [header-routine, validity-window, initial-vfr]
    synoptic: Cleveland in the winter-icing-great-lakes scenario; a single-body forecast holding low IFR with NW gales the whole window.
    triage_drivers: [ceiling, gust factor, visibility]
```
