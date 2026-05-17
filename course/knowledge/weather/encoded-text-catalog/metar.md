# METAR catalog

Every realistic METAR shape a US pilot encounters, organized by token family. Each example is a real-shape METAR that round-trips through `parseMetar` from `@ab/wx-charts` with zero warnings. The catalog is the reference; the [reading-metars](../reading-metars/node.md) node is the teaching surface.

Group order (per AC 00-45H Ch 3 + AIM 7-1-29):

1. Type indicator (`METAR` or `SPECI`)
2. Station identifier (4-letter ICAO)
3. Date/time group (`DDhhmmZ`)
4. Modifier (`AUTO` or `COR`, omitted otherwise)
5. Wind (direction + speed + optional gust + optional variability)
6. Visibility (statute miles + optional RVR)
7. Weather phenomena (intensity + descriptor + phenomenon)
8. Sky condition (cover + height layers; `VV` when obscured)
9. Temperature / dew point
10. Altimeter setting
11. Remarks (`RMK`)

The catalog walks the groups in that order, family by family, and closes with composite canonical examples that exercise multiple families at once.

## Type indicator

Every METAR opens with `METAR` (routine, hourly near H+55) or `SPECI` (special, issued off-cycle when something changed enough to trigger a report between routine cycles). The presence of a SPECI is itself information.

### Routine METAR

The default. Issued at every staffed and most automated stations roughly every hour near minute 55.

```text
KORD 121153Z 24008KT 10SM SKC 12/04 A3010
```

```text
KDFW 121153Z 18012KT 10SM SKC 24/18 A3005
```

```text
KFLL 121553Z 09008KT 10SM SCT025 BKN250 26/22 A2992
```

### SPECI - special / off-cycle

Issued when an observed change crosses a reportable threshold (sky lowering through 3,000 / 1,500 / 500 ft, visibility crossing 3 SM / 1 SM, weather onset / cessation, wind shift > 45 deg with sustained > 10 KT, ...). The SPECI prefix is the operational tell: something just changed.

```text
SPECI KORD 121823Z 09015G28KT 2SM TSRA BKN035CB 22/20 A2978
```

```text
SPECI KMDW 121315Z 31022G35KT 5SM BKN025 OVC050 04/M02 A2965
```

```text
SPECI KSFO 121615Z 28010KT 2SM BR OVC008 14/13 A2998
```

## Station identifier

Four-letter ICAO codes. Continental US uses `K` prefix (`KJFK`, `KORD`, `KASE`). Alaska uses `PA` (`PANC`). Hawaii uses `PH` (`PHNL`). Non-US examples use their region's prefix (`EDDF` Frankfurt, `EGLL` Heathrow, `CYYZ` Toronto). The catalog uses real stations chosen to match each synoptic story (KFAR for radiation fog, KBUF for lake-effect, KASE for mountain).

## Date / time group

Six digits + `Z`: day-of-month, hour, minute, all UTC. `121753Z` = 12th of the month at 17:53 Zulu. The same DDhhmmZ format appears in every product in the encoded-text family.

```text
KJFK 121753Z 26010KT 10SM FEW250 22/12 A3003
```

```text
KMIA 010000Z 09010KT 10SM SCT040 BKN250 27/24 A3000
```

```text
KSEA 152353Z 18012KT 8SM OVC025 13/10 A2995
```

## Modifier

`AUTO` marks an automated station (no human observer). `COR` marks a corrected previous report. Either is omitted when neither applies.

### AUTO - automated station

Most ASOS / AWOS sites flag every observation `AUTO`. The flag matters operationally: see the `RMK` family below for the AO1 vs AO2 distinction (AO1 stations cannot tell rain from snow and cannot report thunderstorms).

```text
KSFO 121153Z AUTO 00000KT 10SM SKC 10/06 A3018
```

```text
KSMO 121553Z AUTO 24007KT 8SM OVC008 18/17 A2998
```

```text
KFAR 121753Z AUTO 36006KT 1/4SM FG VV002 M01/M02 A3025
```

### COR - corrected

The previous observation was wrong (transcription error, wind direction misread, missed weather group). The corrected report supersedes the prior.

```text
KJFK 121153Z COR 22010KT 10SM FEW250 18/12 A3000
```

```text
KORD 121253Z COR 24010G18KT 8SM SCT030 BKN080 14/08 A3005
```

```text
KDEN 121753Z COR 18020G32KT 10SM FEW080 SCT150 22/M02 A2985
```

## Wind group

Direction in degrees **true** + speed in knots + optional gust group + optional variability group. `KT` unit suffix. Variable wind below 6 KT uses `VRB`. Variable wind direction > 60 deg with speed > 6 KT adds a separate `nnnVnnn` group.

### Calm

`00000KT` - direction zero, speed zero. Often coincident with clear sky and large temperature / dew-point spread (overnight radiation cooling pattern).

```text
KSFO 121153Z 00000KT 10SM SKC 10/06 A3018
```

```text
KMSP 121253Z 00000KT 10SM FEW250 M01/M03 A3018
```

```text
KBOI 130653Z 00000KT 10SM CLR M02/M08 A3022
```

### Steady direction + speed

The bread-and-butter wind group. Three-digit direction, two-digit speed.

```text
KDFW 121153Z 18012KT 10SM SKC 24/18 A3005
```

```text
KORD 121153Z 24008KT 10SM SKC 12/04 A3010
```

```text
KJFK 121753Z 26010KT 10SM FEW250 22/12 A3003
```

### Gust group

`G` suffix + two-digit gust value. Convention: report gust when peak instantaneous wind in the previous 10 min exceeds the 2-min mean by 10+ KT.

```text
KMDW 121753Z 28019G31KT 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

```text
KJAN 121153Z 23008G14KT 6SM BR BKN012 19/18 A3002
```

```text
KDEN 122053Z 31015G28KT 10SM FEW150 SCT220 18/M04 A2992
```

### Variable direction (VRB) - low wind

Below ~6 KT the wind direction cannot be reliably resolved; the report uses `VRB`. ATC will assign a runway by preference, not by wind.

```text
KHWO 121253Z VRB04KT 10SM SKC 25/22 A3007
```

```text
KMIA 121553Z VRB03KT 10SM FEW040 28/24 A3004
```

```text
KTPA 121253Z VRB02KT 8SM SCT025 24/22 A3005
```

### Variable range (nnnVnnn) - higher speed

When the primary direction is established but oscillates more than 60 deg, an `nnnVnnn` group follows the wind group. Both endpoints are degrees true.

```text
KMDW 121753Z 28019G31KT 240V310 7SM FEW040 BKN150 06/M03 A2987
```

```text
KJAN 121153Z 23008G14KT 200V260 6SM BR BKN012 19/18 A3002
```

```text
KCYS 121953Z 26022G34KT 230V300 10SM FEW100 BKN200 18/M02 A2984
```

## Visibility

Statute miles in the US. Whole miles up to 10. Fractions for < 3 SM (`1 1/2SM`, `3/4SM`, `1/4SM`). `M` prefix means "less than" (`M1/4SM` = less than a quarter mile). Visibility at or above 10 SM always reports as `10SM` (METAR never reports higher).

### Above 10 SM

Always encoded `10SM`, never `15SM` or `P10SM`.

```text
KORD 121153Z 24008KT 10SM SKC 12/04 A3010
```

```text
KDFW 121153Z 18012KT 10SM SKC 24/18 A3005
```

```text
KMSP 121253Z 30010KT 10SM FEW250 M01/M03 A3018
```

### Whole-mile

```text
KMEM 121753Z 14010KT 5SM -RA BR BKN015 OVC035 18/16 A2995
```

```text
KORD 121153Z 24008KT 7SM SCT040 12/04 A3010
```

```text
KMCI 122153Z 19014KT 7SM VCTS FEW035 SCT100 BKN200 28/22 A2992
```

### Fractional - below 3 SM

The space between the whole and fractional parts is mandatory for the mixed form (`1 1/2SM`). Pure fractions get no leading whole number.

```text
KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
```

```text
KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
```

```text
KFAR 121853Z 36004KT M1/4SM FG VV001 M02/M02 A3025
```

### Less-than prefix (M)

`M1/4SM` = visibility less than a quarter mile. The lowest reportable prevailing visibility in the US system.

```text
KFAR 121853Z 36004KT M1/4SM FG VV001 M02/M02 A3025
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

```text
KSFO 121355Z 24003KT M1/4SM FG VV001 11/11 A3010
```

## Weather phenomena

Coded as **intensity** + **descriptor** + **phenomenon**. Intensity: `-` light, none = moderate, `+` heavy, `VC` in the vicinity (5-10 SM from the field). Descriptors: `TS` thunderstorm, `SH` shower, `FZ` freezing, `BL` blowing, `DR` drifting, `MI` shallow, `BC` patches, `PR` partial. Phenomena: `RA` rain, `SN` snow, `BR` mist, `FG` fog, `HZ` haze, `FU` smoke, `DU` dust, `SA` sand, `GR` hail, `PL` ice pellets, `DZ` drizzle, `IC` ice crystals, `SQ` squalls, `FC` funnel cloud, `VA` volcanic ash, `GS` small hail / snow pellets. Multiple groups are allowed.

### Light intensity (-)

```text
KMEM 121753Z 14010KT 5SM -RA BR BKN015 OVC035 18/16 A2995
```

```text
KGRR 121753Z 09015G22KT 3SM -FZRA OVC008 M02/M03 A2989
```

```text
KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
```

### Moderate (no prefix)

```text
KORD 122153Z 21010KT 5SM RA OVC020 16/14 A2994
```

```text
KMIA 121753Z 14012KT 4SM TSRA BKN035CB OVC080 26/22 A2998
```

```text
KMSP 130753Z 35008KT 1SM SN BR OVC015 M04/M05 A3000
```

### Heavy intensity (+)

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

```text
KDFW 122253Z 16018G30KT 2SM +TSRA BKN030CB OVC080 26/23 A2982
```

### Vicinity (VC)

The phenomenon is observed within 5-10 SM of the station but not at the station itself. Common precursor signal.

```text
KMCI 122153Z 19014KT 7SM VCTS FEW035 SCT100 BKN200 28/22 A2992
```

```text
KFLL 122153Z 12012KT 9SM VCTS FEW035 SCT060 BKN200 28/23 A3001
```

```text
KMSY 122053Z 14010KT 9SM VCSH SCT040 BKN100 28/24 A3000
```

### Descriptor + phenomenon combos

The taxonomy is wide; these are the high-frequency combos to recognize on sight.

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

```text
KGRR 121753Z 09015G22KT 3SM -FZRA OVC008 M02/M03 A2989
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

### BR vs FG

`BR` (mist) is visibility 5/8 to under 7 SM. `FG` (fog) is visibility under 5/8 SM. The boundary matters for approach minima and for the regulatory definition of "fog conditions."

```text
KJAN 121153Z 23008G14KT 6SM BR BKN012 19/18 A3002
```

```text
KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

## Sky condition

One or more `cover + height` pairs, ascending. Cover: `SKC` / `CLR` clear (`SKC` from a human observer, `CLR` from an automated station meaning "no clouds below 12,000 ft"), `NSC` "no significant cloud" (international form), `FEW` 1-2 oktas, `SCT` 3-4 oktas, `BKN` 5-7 oktas, `OVC` 8 oktas. Height in hundreds of feet **AGL** (`BKN015` = 1,500 broken). The **ceiling** for regulatory purposes is the lowest `BKN` or `OVC` layer. A `CB` or `TCU` suffix marks convective cloud.

### Clear variants

```text
KSFO 121153Z 00000KT 10SM SKC 10/06 A3018
```

```text
KBOI 130653Z 00000KT 10SM CLR M02/M08 A3022
```

```text
KBGR 121253Z 31008KT 10SM SKC M08/M14 A3022
```

### Single-layer

```text
KFLL 121553Z 09008KT 10SM SCT025 BKN250 26/22 A2992
```

```text
KMSP 121253Z 30010KT 10SM FEW250 M01/M03 A3018
```

```text
KSMO 121553Z 24007KT 8SM OVC008 18/17 A2998
```

### Multi-layer

The ceiling is the lowest `BKN` or `OVC`. In the first example below `FEW040 SCT080 BKN150` the ceiling is at 15,000 ft - `FEW` and `SCT` are not ceilings.

```text
KMDW 121753Z 28019G31KT 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

```text
KMCI 122153Z 19014KT 7SM VCTS FEW035 SCT100 BKN200 28/22 A2992
```

```text
KASE 121953Z 26015G25KT 7SM FEW100 SCT150 BKN200 14/M02 A3019
```

### Convective suffix - CB

`CB` marks an active thunderstorm cell. Almost always accompanied by `TS`-flavored weather group.

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

```text
KDFW 122253Z 16018G30KT 2SM +TSRA BKN030CB OVC080 26/23 A2982
```

```text
KMIA 121753Z 14012KT 4SM TSRA BKN035CB OVC080 26/22 A2998
```

### Convective suffix - TCU

`TCU` (towering cumulus) marks a building cumulus that hasn't yet produced lightning. A `TCU` in the sky group while the weather group is still `-RA` (no `TS`) is the "convection is imminent" signal pilots watch before the official thunderstorm starts.

```text
KMCO 122053Z 11010KT 9SM SCT030TCU BKN090 30/24 A3001
```

```text
KMSY 122153Z 15012KT 8SM SCT035TCU BKN120 30/24 A3000
```

```text
KFLL 122153Z 12012KT 9SM VCTS FEW035 SCT060 BKN200 28/23 A3001
```

### Vertical visibility (VV)

When the sky is **obscured** (the observer cannot see a cloud layer at all - dense fog, heavy snow, volcanic ash) the report substitutes `VVnnn` for the sky-condition group. `VV002` = vertical visibility 200 ft.

```text
KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
```

```text
KFAR 121853Z 36004KT M1/4SM FG VV001 M02/M02 A3025
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

## Temperature / dew point

Celsius, slash-separated. `M` prefix marks negative values. Both fields always reported (when missing, the slash is omitted). The **spread** (temp minus dew point) is the trend signal: a 1 deg C spread is mist territory and a half-degree of cooling produces fog.

### Both positive

```text
KFLL 121553Z 09008KT 10SM SCT025 BKN250 26/22 A2992
```

```text
KMIA 121553Z VRB03KT 10SM FEW040 28/24 A3004
```

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

### Both negative

Both endpoints get the `M` prefix.

```text
KBGR 121253Z 31008KT 10SM SKC M08/M14 A3022
```

```text
KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
```

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

### Cross-zero

One side positive, the other negative. The dew-point side typically slips negative first overnight.

```text
KMDW 121753Z 28019G31KT 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

```text
KMSP 121253Z 30010KT 10SM FEW250 M01/M03 A3018
```

```text
KASE 121953Z 26015G25KT 7SM FEW100 SCT150 BKN200 14/M02 A3019
```

### Narrow spread

Spread of 1-2 deg C. Saturation-adjacent: mist forms, ceilings lower, low-visibility risk follows quickly.

```text
KJAN 121153Z 23008G14KT 6SM BR BKN012 19/18 A3002
```

```text
KSMO 121553Z 24007KT 8SM OVC008 18/17 A2998
```

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

## Altimeter

`A` prefix + four digits = inches of mercury times 100. `A2992` = 29.92 inHg (standard). `A3010` = 30.10. International form uses `Qnnnn` (hectopascals; `Q1023` = 1023 hPa).

### Standard / near-standard

```text
KFLL 121553Z 09008KT 10SM SCT025 BKN250 26/22 A2992
```

```text
KJFK 121753Z 26010KT 10SM FEW250 22/12 A3003
```

```text
KORD 121153Z 24008KT 10SM SKC 12/04 A3010
```

### Low (deepening low / trough nearby)

```text
KMDW 121753Z 28019G31KT 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

```text
KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
```

### High (strong surface high)

```text
KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
```

```text
KBGR 121253Z 31008KT 10SM SKC M08/M14 A3022
```

```text
KMSP 121253Z 30010KT 10SM FEW250 M01/M03 A3018
```

### International form (Q-group)

European-style reports and most non-US stations use `Q` + four digits of hectopascals (the SI pressure unit).

```text
EDDF 121753Z 27010KT CAVOK 18/04 Q1023
```

```text
EGLL 121750Z 22014KT CAVOK 15/08 Q1018
```

```text
LFPG 121730Z 26008KT 9999 FEW040 BKN250 16/09 Q1019
```

## CAVOK (international)

A single token meaning "Ceiling And Visibility OK": visibility 10 km or greater, no cloud below 5,000 ft (or below the highest minimum sector altitude, whichever is greater), no significant weather. Replaces the visibility + weather + sky-condition groups together when those conditions are met. Used internationally; rare on US METARs.

```text
EDDF 121753Z 27010KT CAVOK 18/04 Q1023
```

```text
EGLL 121750Z 22014KT CAVOK 15/08 Q1018
```

```text
EDDM 121620Z 24008KT CAVOK 22/12 Q1018
```

## Composite canonical examples

Each of these is a real-shape METAR; decode every group, then read the synoptic story. The catalog manifest below pairs each composite with its triage drivers.

### Calm clear morning - radiation cooling

```text
KSFO 121153Z AUTO 00000KT 10SM SKC 10/06 A3018
```

Calm, clear, 4-deg spread. Textbook benign morning under a high. Fog isn't imminent (spread is wide enough); the clear sky means radiation cooling didn't drop the surface to saturation. Triage drivers: spread (4 = safe), sky (SKC), wind (calm).

### Gusty crosswind post-front

```text
KMDW 121753Z 28019G31KT 240V310 7SM FEW040 SCT080 BKN150 06/M03 A2987
```

Post-frontal cold sector. 12-kt gust spread plus 70-deg directional variability is the classic well-mixed boundary-layer signature. Triage drivers: gust factor, crosswind component, altimeter trend.

### Thunderstorm

```text
KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
```

Every decision driver fires at once. `+TSRA` is stop-flying; `BKN025CB` puts cells at field elevation; 2-deg spread keeps the column saturated. Triage drivers: weather group, sky (`CB`), peak wind.

### Low IFR - radiation fog with RVR-adjacent shape

```text
KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
```

Radiation fog under a strong high (30.25 inHg, light wind, clear cooling overnight). 1/4 SM with VV002 = no usable ceiling; column from surface to 200 ft is the visibility. Triage drivers: VV002, 1/4 SM visibility, freezing temp (rime fog risk).

### Mountain airport - downslope

```text
KASE 121953Z 26015G25KT 7SM FEW100 SCT150 BKN200 14/M02 A3019
```

Aspen at 7,820 ft MSL. Westerly downslope flow in a dry post-frontal regime. 16-deg spread = density altitude is the limiter, not icing. Triage drivers: gust factor, density altitude, mountain-wave wind direction.

### Marine layer

```text
KSMO 121553Z AUTO 24007KT 8SM OVC008 18/17 A2998
```

Santa Monica with the classic Pacific marine stratus. 1-deg spread + 800-ft overcast + onshore 240 wind = the deck is reinforcing, not breaking up. Triage drivers: ceiling OVC008, spread, wind direction.

### Lake-effect snow shower

```text
KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
```

Buffalo in active lake-effect off Lake Erie. 3-deg spread keeps liquid water available; OVC015 holds while lake-induced lift continues. Triage drivers: visibility (1 1/2 SM with two phenomena), ceiling, peak wind / gust factor.

### Heavy snow with fog

```text
KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
```

Plains snow storm with freezing fog. `+SN` (heavy snow) + `FZFG` (freezing fog, visibility under 5/8 SM with subfreezing temp) + `VV003` = airport is operationally closed for VFR. Triage drivers: weather group, VV003, freezing temp (taxi-ice risk).

### Frontal passage line - shifting wind

```text
KDFW 122253Z 16018G30KT 2SM +TSRA BKN030CB OVC080 26/23 A2982
```

Cold front passing through DFW. Pre-frontal southerly wind 160/18 G30, thunderstorm line at the front, ceiling drops to 3,000 broken CB. Triage drivers: weather group, sky CB, gust factor.

### International CAVOK

```text
EDDF 121753Z 27010KT CAVOK 18/04 Q1023
```

Frankfurt under a surface high. `CAVOK` collapses visibility + weather + sky-condition into one token; pressure reported in hectopascals (Q1023 = 1023 hPa). Triage drivers: pressure pattern, wind direction, temperature.

## Scenario-derived examples

The METARs below are emitted verbatim by the wx-engine truth-model scenarios under `libs/wx-engine/`. Each is the surface observation a scenario derives from its synoptic truth, so the `generatedBy` pointer in the manifest is literal: the catalog example *is* the scenario's output. They round-trip through `parseMetar` because the engine enforces that on every product it emits.

### Summer air-mass thunderstorm over the field

```text
KIAH 152153Z 13010KT 3SM BR +TSRA OVC025 BKN015 OVC060 35/24 A2992
```

Houston in the `summer-thunderstorms-tx` scenario: a heavy thunderstorm with rain over the field, mist cutting visibility to 3 SM, a ragged broken layer at 1,500 ft under deep overcast. The 11-deg spread at 35 deg C is plenty of low-level moisture for the cell.

### Frontal-passage rain with gusty wind shift

```text
KSPI 191953Z 32020G33KT 3SM BR -RA OVC015 OVC070 04/M03 A2963
```

Springfield in the `frontal-xc-march` scenario, behind the cold front: wind has shifted to 320 with gusts to 33, light rain plus mist holds visibility at 3 SM, overcast at 1,500 ft, and the altimeter has fallen to 29.63 in the post-frontal trough.

### Lake-effect / upslope snow regime - subfreezing both ends

```text
KCLE 221553Z 32020G27KT 3SM BR OVC015 OVC080 M10/M15 A2974
```

Cleveland in the `winter-icing-great-lakes` scenario: NW flow at 320 gusting 27, both temperature and dew point well below freezing, overcast at 1,500 ft with mist. The 5-deg spread in subfreezing air is the icing-and-snow signature.

### Mountain downslope - dry post-frontal

```text
KASE 122153Z 27025KT 10SM FEW060 OVC140 02/M12 A3003
```

Aspen in the `mountain-wave-rockies` scenario: strong westerly downslope flow at 25 KT, a 14-deg spread (very dry), high overcast at 14,000 ft. Density altitude and mountain-wave turbulence are the limiters, not visibility.

### Denver lee-side - mountain wave

```text
KDEN 122153Z 27025KT 10SM FEW060 OVC140 02/M12 A2999
```

Denver in the same `mountain-wave-rockies` scenario: identical synoptic regime to Aspen, on the lee side of the Front Range. The 25-KT westerly across the Rockies feeds the wave train the scenario's PIREPs report as severe turbulence aloft.

### Tule fog at saturation

```text
KFAT 081053Z 00002KT 1/2SM FG OVC003 04/04 A3010
```

Fresno in the `dense-fog-radiation-central-valley` scenario: calm wind, zero spread (4/4), fog at 1/2 SM under a 300-ft overcast. Classic Central Valley tule fog under a strong, stagnant surface high.

### Hot-and-high summer VFR

```text
KAUS 152153Z 13010KT 10SM SCT045 OVC120 35/24 A2994
```

Austin in the `summer-thunderstorms-tx` scenario, away from the cells: 35 deg C, scattered cumulus at 4,500 ft under high overcast, clear 10 SM visibility. The benign side of a convective afternoon - the triage driver is density altitude, not weather.

## Catalog manifest

The structured metadata below is the source of truth the catalog build script reads. Each token family carries its examples by slug; each example carries its raw text, the families it exercises, a one-sentence synoptic story, and source references. The build script validates every example round-trips through `parseMetar` with zero warnings.

```yaml-catalog
product: metar
references_default:
  - source: AC 00-45H
    detail: Chapter 3 - Surface Aviation Weather Observations (METAR / SPECI)
  - source: AIM
    detail: 7-1-29 - Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR)
token_families:
  - slug: type-routine
    label: METAR (routine)
    decode: Routine hourly observation, issued near H+55.
    references:
      - source: AC 00-45H
        detail: Chapter 3, METAR vs SPECI distinction
    examples: [metar-routine-ord, metar-routine-dfw, metar-routine-fll]
  - slug: type-speci
    label: SPECI (special / off-cycle)
    decode: Off-cycle observation issued when a reportable change occurs between routine reports.
    references:
      - source: AC 00-45H
        detail: Chapter 3, SPECI triggers
    examples: [metar-speci-ord-tsra, metar-speci-mdw-front, metar-speci-sfo-fog]
  - slug: modifier-auto
    label: AUTO (automated station)
    decode: Automated station with no human observer; pair with RMK AO1 / AO2 to know if precipitation can be discriminated.
    references:
      - source: AC 00-45H
        detail: Chapter 3, modifier group + RMK station type
      - source: FMH-1
        detail: AO1 / AO2 capability matrix
    examples: [metar-auto-sfo, metar-auto-smo, metar-auto-far]
  - slug: modifier-cor
    label: COR (corrected)
    decode: The previous observation was wrong; this report supersedes it.
    references:
      - source: AC 00-45H
        detail: Chapter 3, correction handling
    examples: [metar-cor-jfk, metar-cor-ord, metar-cor-den]
  - slug: wind-calm
    label: Calm
    decode: Direction zero, speed zero. Encoded `00000KT`.
    references:
      - source: AC 00-45H
        detail: Chapter 3, wind group, calm convention
    examples: [metar-routine-sfo-calm, metar-msp-calm, metar-boi-calm]
  - slug: wind-steady
    label: Steady direction + speed
    decode: Three-digit direction (degrees true) + two-digit speed (knots) + `KT`.
    references:
      - source: AC 00-45H
        detail: Chapter 3, wind group
    examples: [metar-routine-dfw, metar-routine-ord, metar-jfk-cruise]
  - slug: wind-gust
    label: Gust group
    decode: G suffix + two-digit gust value when peak in last 10 min exceeds the 2-min mean by 10+ KT.
    references:
      - source: AC 00-45H
        detail: Chapter 3, wind gust reporting threshold
    examples: [metar-mdw-gusty, metar-jan-gust, metar-den-gust, metar-scenario-spi-frontal-rain]
  - slug: wind-vrb-low
    label: Variable direction (VRB) - low wind
    decode: Speed below 6 KT and direction cannot be resolved. Encoded `VRB` + two-digit speed.
    references:
      - source: AC 00-45H
        detail: Chapter 3, variable wind below 6 KT
    examples: [metar-hwo-vrb, metar-mia-vrb, metar-tpa-vrb]
  - slug: wind-vrb-range
    label: Variable range (nnnVnnn)
    decode: Primary direction varies > 60 deg with speed > 6 KT. Separate group `dirVdir` follows the wind group.
    references:
      - source: AC 00-45H
        detail: Chapter 3, variable wind range
    examples: [metar-mdw-vrb-range, metar-jan-vrb-range, metar-cys-vrb-range]
  - slug: visibility-above-10
    label: Above 10 SM
    decode: Always encoded `10SM`; US METARs never report higher.
    references:
      - source: AC 00-45H
        detail: Chapter 3, visibility group
    examples: [metar-routine-ord, metar-routine-dfw, metar-msp-clear-cold]
  - slug: visibility-whole
    label: Whole-mile
    decode: Statute miles, integer, with `SM` suffix.
    references:
      - source: AC 00-45H
        detail: Chapter 3, visibility group
    examples: [metar-mem-rain, metar-ord-vis7, metar-mci-vcts, metar-scenario-iah-tsra, metar-scenario-aus-summer-vfr]
  - slug: visibility-fractional
    label: Fractional - below 3 SM
    decode: Pure fractions or mixed whole-plus-fraction with mandatory space. `1 1/2SM`, `3/4SM`, `1/4SM`.
    references:
      - source: AC 00-45H
        detail: Chapter 3, fractional visibility
    examples: [metar-buf-snow, metar-far-fog, metar-far-fog-mless, metar-scenario-fat-tule-fog]
  - slug: visibility-m-less-than
    label: Less-than (M) prefix
    decode: 'The `M` prefix means "less than." `M1/4SM` = visibility less than 1/4 SM (the lowest reportable prevailing visibility).'
    references:
      - source: AC 00-45H
        detail: Chapter 3, low-visibility reporting convention
    examples: [metar-far-fog-mless, metar-ict-heavy-snow, metar-sfo-dense-fog]
  - slug: wx-light
    label: Light intensity (-)
    decode: 'The `-` prefix marks light intensity. Common with `-RA`, `-SN`, `-SHSN`, `-FZRA`.'
    references:
      - source: AC 00-45H
        detail: Chapter 3, weather group intensity prefix
    examples: [metar-mem-rain, metar-grr-fzra, metar-buf-snow]
  - slug: wx-moderate
    label: Moderate intensity (no prefix)
    decode: Bare phenomenon = moderate intensity. `RA`, `TSRA`, `SN`.
    references:
      - source: AC 00-45H
        detail: Chapter 3, weather group intensity defaults
    examples: [metar-ord-rain-moderate, metar-mia-tsra, metar-msp-moderate-snow]
  - slug: wx-heavy
    label: Heavy intensity (+)
    decode: 'The `+` prefix marks heavy intensity. `+TSRA`, `+SN`, `+FC`.'
    references:
      - source: AC 00-45H
        detail: Chapter 3, weather group intensity prefix
    examples: [metar-okc-tsra, metar-ict-heavy-snow, metar-dfw-front, metar-scenario-iah-tsra]
  - slug: wx-vicinity
    label: Vicinity (VC)
    decode: 'The `VC` prefix = phenomenon observed within 5-10 SM of the station but not at the station.'
    references:
      - source: AC 00-45H
        detail: Chapter 3, vicinity prefix
    examples: [metar-mci-vcts, metar-fll-vcts, metar-msy-vcsh]
  - slug: wx-descriptor-combo
    label: Descriptor + phenomenon combos
    decode: 'Descriptors `TS`, `SH`, `FZ`, `BL`, `DR`, `MI`, `BC`, `PR` compose with the phenomenon list. Common combos memorized on sight (`+TSRA`, `FZRA`, `+FC`, `MIFG`).'
    references:
      - source: AC 00-45H
        detail: Chapter 3, weather group descriptor + phenomenon table
    examples: [metar-okc-tsra, metar-grr-fzra, metar-ict-heavy-snow]
  - slug: wx-br-vs-fg
    label: BR vs FG (mist vs fog boundary)
    decode: BR (mist) = visibility 5/8 to 7 SM. FG (fog) = visibility under 5/8 SM. The boundary matters for approach minima.
    references:
      - source: AC 00-45H
        detail: Chapter 3, mist vs fog reporting threshold
    examples: [metar-jan-mist, metar-far-fog, metar-ict-heavy-snow]
  - slug: sky-clear
    label: Clear variants (SKC / CLR)
    decode: SKC = human-observer clear sky. CLR = automated station reporting no clouds below 12,000 ft. NSC = international "no significant cloud."
    references:
      - source: AC 00-45H
        detail: Chapter 3, sky condition - clear coding
    examples: [metar-routine-sfo-calm, metar-boi-calm, metar-bgr-cold]
  - slug: sky-single-layer
    label: Single-layer
    decode: One cover + height pair. Cover ascending; height in hundreds of feet AGL.
    references:
      - source: AC 00-45H
        detail: Chapter 3, sky condition layers
    examples: [metar-routine-fll, metar-msp-clear-cold, metar-smo-marine]
  - slug: sky-multi-layer
    label: Multi-layer
    decode: Multiple cover + height pairs, ascending. The ceiling is the lowest BKN or OVC layer.
    references:
      - source: AC 00-45H
        detail: Chapter 3, sky condition - ceiling definition
    examples: [metar-mdw-gusty, metar-mci-vcts, metar-ase-mountain, metar-scenario-ase-mtnwave, metar-scenario-den-mtnwave]
  - slug: sky-cb
    label: Cumulonimbus (CB) suffix
    decode: 'A `CB` suffix after the layer height marks an active thunderstorm cell. Almost always paired with TS in the weather group.'
    references:
      - source: AC 00-45H
        detail: Chapter 3, convective cloud annotation
    examples: [metar-okc-tsra, metar-dfw-front, metar-mia-tsra]
  - slug: sky-tcu
    label: Towering cumulus (TCU) suffix
    decode: 'A `TCU` suffix after the layer height marks a cell building toward thunderstorm but not yet producing lightning.'
    references:
      - source: AC 00-45H
        detail: Chapter 3, convective cloud annotation
    examples: [metar-mco-tcu, metar-msy-tcu, metar-fll-vcts]
  - slug: sky-vv
    label: Vertical visibility (VV)
    decode: Substitutes for the sky-condition group when the sky is obscured (dense fog, heavy snow, volcanic ash). `VV002` = vertical visibility 200 ft.
    references:
      - source: AC 00-45H
        detail: Chapter 3, obscured-sky reporting
    examples: [metar-far-fog, metar-far-fog-mless, metar-ict-heavy-snow]
  - slug: temp-positive
    label: Both positive
    decode: Temp / dew point both > 0 deg C. Slash-separated, no M prefix.
    references:
      - source: AC 00-45H
        detail: Chapter 3, temperature / dew point group
    examples: [metar-routine-fll, metar-mia-vrb, metar-okc-tsra]
  - slug: temp-negative
    label: Both negative
    decode: Both endpoints get the M prefix. `M08/M14` = -8 / -14 deg C.
    references:
      - source: AC 00-45H
        detail: Chapter 3, temperature / dew point group
    examples: [metar-bgr-cold, metar-buf-snow, metar-ict-heavy-snow, metar-scenario-cle-icing]
  - slug: temp-cross-zero
    label: Cross-zero (one side +, one side -)
    decode: Temperature positive, dew point negative (or vice versa). Common around frontal passages.
    references:
      - source: AC 00-45H
        detail: Chapter 3, temperature / dew point group
    examples: [metar-mdw-gusty, metar-msp-clear-cold, metar-ase-mountain]
  - slug: temp-narrow-spread
    label: Narrow spread (saturation)
    decode: Temp - dew point of 1-2 deg C. Mist territory; a half-degree of cooling produces fog.
    references:
      - source: AC 00-45H
        detail: Chapter 3, operational reading of the temp / dew spread
    examples: [metar-jan-mist, metar-smo-marine, metar-okc-tsra]
  - slug: altimeter-standard
    label: Standard / near-standard
    decode: A + four digits = inHg x 100. A2992 = 29.92 inHg (standard).
    references:
      - source: AC 00-45H
        detail: Chapter 3, altimeter group
    examples: [metar-routine-fll, metar-jfk-cruise, metar-routine-ord]
  - slug: altimeter-low
    label: Low (deepening low / trough)
    decode: Sub-standard altimeter signals approaching or deepening low pressure.
    references:
      - source: AC 00-45H
        detail: Chapter 3, altimeter group
    examples: [metar-mdw-gusty, metar-okc-tsra, metar-buf-snow]
  - slug: altimeter-high
    label: High (strong surface high)
    decode: Above-standard altimeter signals a building or established surface high.
    references:
      - source: AC 00-45H
        detail: Chapter 3, altimeter group
    examples: [metar-far-fog, metar-bgr-cold, metar-msp-clear-cold]
  - slug: altimeter-q-group
    label: International Q-group (hectopascals)
    decode: 'A `Q` group + four digits = pressure in hectopascals (e.g., Q1023 = 1023 hPa).'
    references:
      - source: AC 00-45H
        detail: Chapter 3, international altimeter forms
    examples: [metar-eddf-cavok, metar-egll-cavok, metar-lfpg-international]
  - slug: cavok
    label: CAVOK (international)
    decode: Single token replacing visibility + weather + sky-condition when visibility >= 10 km, no cloud below 5000 ft (or MSA), no significant weather.
    references:
      - source: AC 00-45H
        detail: Chapter 3, international CAVOK
    examples: [metar-eddf-cavok, metar-egll-cavok, metar-eddm-cavok]
examples:
  - slug: metar-routine-ord
    raw: KORD 121153Z 24008KT 10SM SKC 12/04 A3010
    token_families: [type-routine, wind-steady, visibility-above-10, sky-clear, temp-positive, altimeter-standard]
    synoptic: ORD under a surface high in cool dry air; standard altimeter, calm-confidence morning.
    triage_drivers: [spread, wind, altimeter]
  - slug: metar-routine-dfw
    raw: KDFW 121153Z 18012KT 10SM SKC 24/18 A3005
    token_families: [type-routine, wind-steady, visibility-above-10, sky-clear, temp-positive, altimeter-standard]
    synoptic: DFW with steady southerly flow in maritime tropical air ahead of an upper trough.
    triage_drivers: [wind, spread, altimeter]
  - slug: metar-routine-fll
    raw: KFLL 121553Z 09008KT 10SM SCT025 BKN250 26/22 A2992
    token_families: [type-routine, wind-steady, visibility-above-10, sky-single-layer, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Subtropical air over south Florida; 4-deg spread + scattered cumulus is a typical pre-convective morning.
    triage_drivers: [spread, sky cover, altimeter]
  - slug: metar-speci-ord-tsra
    raw: SPECI KORD 121823Z 09015G28KT 2SM TSRA BKN035CB 22/20 A2978
    token_families: [type-speci, wind-gust, visibility-whole, wx-moderate, wx-descriptor-combo, sky-cb, temp-positive, altimeter-low]
    synoptic: Off-cycle issuance triggered by thunderstorm onset at ORD with sub-VFR visibility.
    triage_drivers: [weather, sky CB, gust factor]
  - slug: metar-speci-mdw-front
    raw: SPECI KMDW 121315Z 31022G35KT 5SM BKN025 OVC050 04/M02 A2965
    token_families: [type-speci, wind-gust, visibility-whole, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: SPECI at frontal passage - wind shift to 310 with 35-kt gusts, ceiling drops to 2,500 broken.
    triage_drivers: [gust factor, ceiling, wind shift]
  - slug: metar-speci-sfo-fog
    raw: SPECI KSFO 121615Z 28010KT 2SM BR OVC008 14/13 A2998
    token_families: [type-speci, wind-steady, visibility-whole, wx-br-vs-fg, sky-single-layer, temp-narrow-spread, altimeter-standard]
    synoptic: SPECI issued as visibility crosses 3 SM downward at SFO under the marine layer.
    triage_drivers: [visibility trend, spread, ceiling]
  - slug: metar-auto-sfo
    raw: KSFO 121153Z AUTO 00000KT 10SM SKC 10/06 A3018
    token_families: [type-routine, modifier-auto, wind-calm, visibility-above-10, sky-clear, temp-positive, altimeter-high]
    synoptic: Calm clear morning at SFO under a building surface high.
    triage_drivers: [spread, sky, wind]
  - slug: metar-auto-smo
    raw: KSMO 121553Z AUTO 24007KT 8SM OVC008 18/17 A2998
    token_families: [type-routine, modifier-auto, wind-steady, visibility-whole, sky-single-layer, temp-narrow-spread, altimeter-standard]
    synoptic: Santa Monica marine stratus deck reinforced by onshore flow.
    triage_drivers: [ceiling, spread, wind direction]
  - slug: metar-auto-far
    raw: KFAR 121753Z AUTO 36006KT 1/4SM FG VV002 M01/M02 A3025
    token_families: [type-routine, modifier-auto, wind-steady, visibility-fractional, wx-br-vs-fg, sky-vv, temp-cross-zero, altimeter-high]
    synoptic: Fargo radiation fog under a strong surface high with subfreezing temps.
    triage_drivers: [visibility, VV002, freezing temp]
  - slug: metar-cor-jfk
    raw: KJFK 121153Z COR 22010KT 10SM FEW250 18/12 A3000
    token_families: [type-routine, modifier-cor, wind-steady, visibility-above-10, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: Corrected JFK report; prior had wind direction transposed.
    triage_drivers: [wind direction, spread, altimeter]
  - slug: metar-cor-ord
    raw: KORD 121253Z COR 24010G18KT 8SM SCT030 BKN080 14/08 A3005
    token_families: [type-routine, modifier-cor, wind-gust, visibility-whole, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Corrected ORD report; prior missed the gust group.
    triage_drivers: [gust factor, ceiling, spread]
  - slug: metar-cor-den
    raw: KDEN 121753Z COR 18020G32KT 10SM FEW080 SCT150 22/M02 A2985
    token_families: [type-routine, modifier-cor, wind-gust, visibility-above-10, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: Denver corrected report; pre-frontal southerly surge with wide spread (dry).
    triage_drivers: [gust factor, density altitude, altimeter trend]
  - slug: metar-routine-sfo-calm
    raw: KSFO 121153Z 00000KT 10SM SKC 10/06 A3018
    token_families: [type-routine, wind-calm, visibility-above-10, sky-clear, temp-positive, altimeter-high]
    synoptic: SFO under a surface high; calm wind + clear sky = radiation cooling overnight.
    triage_drivers: [spread, sky, wind]
  - slug: metar-msp-calm
    raw: KMSP 121253Z 00000KT 10SM FEW250 M01/M03 A3018
    token_families: [type-routine, wind-calm, visibility-above-10, sky-single-layer, temp-cross-zero, altimeter-high]
    synoptic: Twin Cities calm clear cold morning; high cirrus + cold dome.
    triage_drivers: [temperature, wind, altimeter]
  - slug: metar-boi-calm
    raw: KBOI 130653Z 00000KT 10SM CLR M02/M08 A3022
    token_families: [type-routine, wind-calm, visibility-above-10, sky-clear, temp-negative, altimeter-high]
    synoptic: Boise pre-dawn calm clear under a strong winter high.
    triage_drivers: [temperature, wind, altimeter]
  - slug: metar-jfk-cruise
    raw: KJFK 121753Z 26010KT 10SM FEW250 22/12 A3003
    token_families: [type-routine, wind-steady, visibility-above-10, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: New York with steady SW flow under a passing ridge; mid-summer cumulus aloft.
    triage_drivers: [wind, spread, altimeter]
  - slug: metar-mdw-gusty
    raw: KMDW 121753Z 28019G31KT 240V310 7SM FEW040 SCT080 BKN150 06/M03 A2987
    token_families: [wind-gust, wind-vrb-range, visibility-whole, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: Midway in post-frontal cold sector; well-mixed boundary-layer turbulence with directional variability.
    triage_drivers: [gust factor, crosswind, altimeter trend]
  - slug: metar-jan-gust
    raw: KJAN 121153Z 23008G14KT 6SM BR BKN012 19/18 A3002
    token_families: [wind-gust, wind-vrb-range, visibility-whole, wx-br-vs-fg, sky-single-layer, temp-positive, temp-narrow-spread, altimeter-standard]
    synoptic: Jackson MS in maritime tropical air; mist + 1-deg spread at the ragged edge of fog.
    triage_drivers: [spread, BR, ceiling]
  - slug: metar-den-gust
    raw: KDEN 122053Z 31015G28KT 10SM FEW150 SCT220 18/M04 A2992
    token_families: [wind-gust, visibility-above-10, sky-multi-layer, temp-cross-zero, altimeter-standard]
    synoptic: Denver afternoon with NW boundary-layer mixing on the lee of the Rockies.
    triage_drivers: [gust factor, density altitude, altimeter]
  - slug: metar-hwo-vrb
    raw: KHWO 121253Z VRB04KT 10SM SKC 25/22 A3007
    token_families: [wind-vrb-low, visibility-above-10, sky-clear, temp-positive, altimeter-standard]
    synoptic: South Florida pre-dawn calm; variable light wind under a tropical air mass.
    triage_drivers: [wind, spread, runway choice]
  - slug: metar-mia-vrb
    raw: KMIA 121553Z VRB03KT 10SM FEW040 28/24 A3004
    token_families: [wind-vrb-low, visibility-above-10, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: Miami mid-morning with sub-6-kt wind in tropical air; sea-breeze front not yet established.
    triage_drivers: [wind, spread, sea-breeze timing]
  - slug: metar-tpa-vrb
    raw: KTPA 121253Z VRB02KT 8SM SCT025 24/22 A3005
    token_families: [wind-vrb-low, visibility-whole, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: Tampa early morning with variable light wind and tropical humidity (8 SM in HZ-class haze).
    triage_drivers: [spread, ceiling, wind]
  - slug: metar-mdw-vrb-range
    raw: KMDW 121753Z 28019G31KT 240V310 7SM FEW040 BKN150 06/M03 A2987
    token_families: [wind-gust, wind-vrb-range, visibility-whole, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: Variant of the Midway gusty crosswind exemplar without the SCT080 layer; same post-frontal story.
    triage_drivers: [gust factor, crosswind, wind variability]
  - slug: metar-jan-vrb-range
    raw: KJAN 121153Z 23008G14KT 200V260 6SM BR BKN012 19/18 A3002
    token_families: [wind-gust, wind-vrb-range, visibility-whole, wx-br-vs-fg, sky-single-layer, temp-narrow-spread, altimeter-standard]
    synoptic: Jackson with mist + directional variability at the ragged edge of fog.
    triage_drivers: [spread, wind variability, ceiling]
  - slug: metar-cys-vrb-range
    raw: KCYS 121953Z 26022G34KT 230V300 10SM FEW100 BKN200 18/M02 A2984
    token_families: [wind-gust, wind-vrb-range, visibility-above-10, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: Cheyenne with strong westerlies in a deepening low; mountain-lee directional unsteadiness.
    triage_drivers: [gust factor, density altitude, wind variability]
  - slug: metar-msp-clear-cold
    raw: KMSP 121253Z 30010KT 10SM FEW250 M01/M03 A3018
    token_families: [wind-steady, visibility-above-10, sky-single-layer, temp-cross-zero, altimeter-high]
    synoptic: Twin Cities cold-dome morning; NW flow + cold dry air under a winter high.
    triage_drivers: [temperature, wind, spread]
  - slug: metar-mem-rain
    raw: KMEM 121753Z 14010KT 5SM -RA BR BKN015 OVC035 18/16 A2995
    token_families: [wind-steady, visibility-whole, wx-light, wx-br-vs-fg, sky-multi-layer, temp-positive, temp-narrow-spread, altimeter-standard]
    synoptic: Memphis stratiform rain with overrunning warm air; 2-deg spread keeps the column saturated.
    triage_drivers: [ceiling, visibility, spread]
  - slug: metar-ord-vis7
    raw: KORD 121153Z 24008KT 7SM SCT040 12/04 A3010
    token_families: [wind-steady, visibility-whole, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: Chicago with hazy 7 SM under cool dry NW flow; no precipitation, no IFR risk.
    triage_drivers: [spread, sky cover, wind]
  - slug: metar-mci-vcts
    raw: KMCI 122153Z 19014KT 7SM VCTS FEW035 SCT100 BKN200 28/22 A2992
    token_families: [wind-steady, visibility-whole, wx-vicinity, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Kansas City with thunderstorm in the vicinity; pre-frontal southerly surge.
    triage_drivers: [VC thunderstorm, ceiling, spread]
  - slug: metar-buf-snow
    raw: KBUF 121453Z 28018G29KT 1 1/2SM -SHSN BLSN OVC015 M04/M07 A2965
    token_families: [wind-gust, visibility-fractional, wx-light, wx-descriptor-combo, sky-single-layer, temp-negative, altimeter-low]
    synoptic: Buffalo in active lake-effect snow off Lake Erie; OVC015 in light shower + blowing snow.
    triage_drivers: [visibility, weather, gust factor]
  - slug: metar-far-fog
    raw: KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025
    token_families: [wind-steady, visibility-fractional, wx-br-vs-fg, sky-vv, temp-cross-zero, altimeter-high]
    synoptic: Fargo radiation fog under a strong surface high; 1/4 SM with VV002 + freezing-edge temp.
    triage_drivers: [visibility, VV, freezing temp]
  - slug: metar-far-fog-mless
    raw: KFAR 121853Z 36004KT M1/4SM FG VV001 M02/M02 A3025
    token_families: [wind-steady, visibility-m-less-than, wx-br-vs-fg, sky-vv, temp-negative, altimeter-high]
    synoptic: Fargo fog tightening; visibility under 1/4 SM and VV001 (100 ft).
    triage_drivers: [visibility, VV, freezing temp]
  - slug: metar-grr-fzra
    raw: KGRR 121753Z 09015G22KT 3SM -FZRA OVC008 M02/M03 A2989
    token_families: [wind-gust, visibility-whole, wx-light, wx-descriptor-combo, sky-single-layer, temp-cross-zero, altimeter-standard]
    synoptic: Grand Rapids freezing rain on overrunning warm air; warm nose aloft, subfreezing surface.
    triage_drivers: [weather (FZRA), ceiling, surface temp]
  - slug: metar-ord-rain-moderate
    raw: KORD 122153Z 21010KT 5SM RA OVC020 16/14 A2994
    token_families: [wind-steady, visibility-whole, wx-moderate, sky-single-layer, temp-positive, altimeter-standard]
    synoptic: Chicago stratiform moderate rain in advance of an organized low; OVC020 holds steady.
    triage_drivers: [ceiling, visibility, spread]
  - slug: metar-mia-tsra
    raw: KMIA 121753Z 14012KT 4SM TSRA BKN035CB OVC080 26/22 A2998
    token_families: [wind-steady, visibility-whole, wx-moderate, wx-descriptor-combo, sky-cb, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Miami afternoon air-mass thunderstorm in tropical maritime air.
    triage_drivers: [weather (TSRA), CB, ceiling]
  - slug: metar-msp-moderate-snow
    raw: KMSP 130753Z 35008KT 1SM SN BR OVC015 M04/M05 A3000
    token_families: [wind-steady, visibility-whole, wx-moderate, wx-br-vs-fg, sky-single-layer, temp-negative, altimeter-standard]
    synoptic: Twin Cities moderate snow with mist; cyclonic system over the Upper Midwest.
    triage_drivers: [visibility, weather, ceiling]
  - slug: metar-okc-tsra
    raw: KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978
    token_families: [wind-gust, visibility-whole, wx-heavy, wx-descriptor-combo, sky-cb, sky-multi-layer, temp-positive, temp-narrow-spread, altimeter-low]
    synoptic: Oklahoma City heavy thunderstorm with rain; mesoscale convective system in southerly surge.
    triage_drivers: [+TSRA, CB, peak wind]
  - slug: metar-ict-heavy-snow
    raw: KICT 121953Z 02006KT M1/4SM +SN FZFG VV003 M08/M09 A2985
    token_families: [wind-steady, visibility-m-less-than, wx-heavy, wx-descriptor-combo, wx-br-vs-fg, sky-vv, temp-negative, altimeter-standard]
    synoptic: Wichita heavy snow with freezing fog; arctic air mass under a deep upper trough.
    triage_drivers: [+SN, FZFG, VV003]
  - slug: metar-dfw-front
    raw: KDFW 122253Z 16018G30KT 2SM +TSRA BKN030CB OVC080 26/23 A2982
    token_families: [wind-gust, visibility-whole, wx-heavy, wx-descriptor-combo, sky-cb, sky-multi-layer, temp-positive, altimeter-low]
    synoptic: DFW frontal passage line; pre-frontal southerly surge with thunderstorm line at the front.
    triage_drivers: [+TSRA, gust factor, CB]
  - slug: metar-fll-vcts
    raw: KFLL 122153Z 12012KT 9SM VCTS FEW035 SCT060 BKN200 28/23 A3001
    token_families: [wind-steady, visibility-whole, wx-vicinity, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Ft Lauderdale with thunderstorm in the vicinity; sea-breeze convection over the Everglades.
    triage_drivers: [VC thunderstorm, ceiling, route]
  - slug: metar-msy-vcsh
    raw: KMSY 122053Z 14010KT 9SM VCSH SCT040 BKN100 28/24 A3000
    token_families: [wind-steady, visibility-whole, wx-vicinity, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: New Orleans with showers in the vicinity; afternoon convective trigger but cells not over the field.
    triage_drivers: [VCSH, ceiling, spread]
  - slug: metar-jan-mist
    raw: KJAN 121153Z 23008G14KT 6SM BR BKN012 19/18 A3002
    token_families: [wind-gust, visibility-whole, wx-br-vs-fg, sky-single-layer, temp-positive, temp-narrow-spread, altimeter-standard]
    synoptic: Jackson maritime tropical air; mist + 1-deg spread at the ragged edge of fog.
    triage_drivers: [spread, BR, ceiling]
  - slug: metar-mco-tcu
    raw: KMCO 122053Z 11010KT 9SM SCT030TCU BKN090 30/24 A3001
    token_families: [wind-steady, visibility-whole, sky-tcu, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Orlando afternoon with towering cumulus over the field; convective imminence signal.
    triage_drivers: [TCU, spread, ceiling]
  - slug: metar-msy-tcu
    raw: KMSY 122153Z 15012KT 8SM SCT035TCU BKN120 30/24 A3000
    token_families: [wind-steady, visibility-whole, sky-tcu, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: New Orleans late afternoon TCU; sea-breeze convergence with maritime instability.
    triage_drivers: [TCU, spread, route]
  - slug: metar-bgr-cold
    raw: KBGR 121253Z 31008KT 10SM SKC M08/M14 A3022
    token_families: [wind-steady, visibility-above-10, sky-clear, temp-negative, altimeter-high]
    synoptic: Bangor under a continental polar air mass; NW flow, deep cold dome, no clouds.
    triage_drivers: [temperature, wind, spread]
  - slug: metar-ase-mountain
    raw: KASE 121953Z 26015G25KT 7SM FEW100 SCT150 BKN200 14/M02 A3019
    token_families: [wind-gust, visibility-whole, sky-multi-layer, temp-cross-zero, altimeter-high]
    synoptic: Aspen with westerly downslope flow in dry post-frontal air; 16-deg spread = dry.
    triage_drivers: [gust factor, density altitude, mountain wave]
  - slug: metar-smo-marine
    raw: KSMO 121553Z 24007KT 8SM OVC008 18/17 A2998
    token_families: [wind-steady, visibility-whole, sky-single-layer, temp-positive, temp-narrow-spread, altimeter-standard]
    synoptic: Santa Monica Pacific marine stratus; onshore flow reinforcing the deck.
    triage_drivers: [ceiling, spread, wind direction]
  - slug: metar-sfo-dense-fog
    raw: KSFO 121355Z 24003KT M1/4SM FG VV001 11/11 A3010
    token_families: [wind-steady, visibility-m-less-than, wx-br-vs-fg, sky-vv, temp-positive, altimeter-standard]
    synoptic: San Francisco advection fog at saturation (0-deg spread); VV001 closes the field for VFR.
    triage_drivers: [visibility, VV, spread]
  - slug: metar-eddf-cavok
    raw: EDDF 121753Z 27010KT CAVOK 18/04 Q1023
    token_families: [wind-steady, cavok, temp-positive, altimeter-q-group]
    synoptic: Frankfurt under a surface high; CAVOK collapses three groups into one, pressure in hPa.
    triage_drivers: [pressure pattern, wind, temperature]
  - slug: metar-egll-cavok
    raw: EGLL 121750Z 22014KT CAVOK 15/08 Q1018
    token_families: [wind-steady, cavok, temp-positive, altimeter-q-group]
    synoptic: London Heathrow under a passing ridge with SW flow; CAVOK + hectopascals.
    triage_drivers: [wind, pressure, runway preference]
  - slug: metar-eddm-cavok
    raw: EDDM 121620Z 24008KT CAVOK 22/12 Q1018
    token_families: [wind-steady, cavok, temp-positive, altimeter-q-group]
    synoptic: Munich afternoon under a slack pressure pattern; CAVOK + warm dry air.
    triage_drivers: [pressure, wind, spread]
  - slug: metar-lfpg-international
    raw: LFPG 121730Z 26008KT 9999 FEW040 BKN250 16/09 Q1019
    token_families: [wind-steady, sky-multi-layer, temp-positive, altimeter-q-group]
    synoptic: Paris CDG with 9999 visibility group (international form for >= 10 km) and Q-pressure.
    triage_drivers: [pressure, wind, ceiling]
  - slug: metar-scenario-iah-tsra
    raw: KIAH 152153Z 13010KT 3SM BR +TSRA OVC025 BKN015 OVC060 35/24 A2992
    token_families: [type-routine, wind-steady, visibility-whole, wx-heavy, wx-descriptor-combo, wx-br-vs-fg, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Houston heavy air-mass thunderstorm over the field in the summer-thunderstorms-tx scenario; mist plus +TSRA at 3 SM.
    triage_drivers: [+TSRA, ceiling, visibility]
  - slug: metar-scenario-spi-frontal-rain
    raw: KSPI 191953Z 32020G33KT 3SM BR -RA OVC015 OVC070 04/M03 A2963
    token_families: [type-routine, wind-gust, visibility-whole, wx-light, wx-br-vs-fg, sky-multi-layer, temp-cross-zero, altimeter-low]
    synoptic: Springfield behind the cold front in the frontal-xc-march scenario; NW wind shift to 320G33 with light rain and mist.
    triage_drivers: [gust factor, visibility, altimeter trend]
  - slug: metar-scenario-cle-icing
    raw: KCLE 221553Z 32020G27KT 3SM BR OVC015 OVC080 M10/M15 A2974
    token_families: [type-routine, wind-gust, visibility-whole, wx-br-vs-fg, sky-multi-layer, temp-negative, altimeter-low]
    synoptic: Cleveland in the winter-icing-great-lakes scenario; NW flow with subfreezing temp and dew point under low overcast.
    triage_drivers: [icing risk, ceiling, gust factor]
  - slug: metar-scenario-ase-mtnwave
    raw: KASE 122153Z 27025KT 10SM FEW060 OVC140 02/M12 A3003
    token_families: [type-routine, wind-steady, visibility-above-10, sky-multi-layer, temp-cross-zero, altimeter-standard]
    synoptic: Aspen westerly downslope flow in the mountain-wave-rockies scenario; 14-deg spread keeps it dry.
    triage_drivers: [density altitude, mountain wave, wind direction]
  - slug: metar-scenario-den-mtnwave
    raw: KDEN 122153Z 27025KT 10SM FEW060 OVC140 02/M12 A2999
    token_families: [type-routine, wind-steady, visibility-above-10, sky-multi-layer, temp-cross-zero, altimeter-standard]
    synoptic: Denver lee-side westerly flow in the mountain-wave-rockies scenario; the 25-KT cross-Rockies wind drives the wave train.
    triage_drivers: [mountain wave, density altitude, wind direction]
  - slug: metar-scenario-fat-tule-fog
    raw: KFAT 081053Z 00002KT 1/2SM FG OVC003 04/04 A3010
    token_families: [type-routine, wind-calm, visibility-fractional, wx-br-vs-fg, sky-single-layer, temp-positive, temp-narrow-spread, altimeter-standard]
    synoptic: Fresno Central Valley tule fog at saturation in the dense-fog-radiation-central-valley scenario; calm wind, zero spread.
    triage_drivers: [visibility, ceiling, spread]
  - slug: metar-scenario-aus-summer-vfr
    raw: KAUS 152153Z 13010KT 10SM SCT045 OVC120 35/24 A2994
    token_families: [type-routine, wind-steady, visibility-above-10, sky-multi-layer, temp-positive, altimeter-standard]
    synoptic: Austin away from the cells in the summer-thunderstorms-tx scenario; hot VFR afternoon where density altitude is the limiter.
    triage_drivers: [density altitude, sky cover, wind]
```
