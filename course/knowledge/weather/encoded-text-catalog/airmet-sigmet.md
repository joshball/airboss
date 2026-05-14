# AIRMET / SIGMET / Convective SIGMET catalog

Every realistic in-flight advisory shape a US pilot encounters, organized by product family. Each example carries both the raw FAX-form text (what a learner reads in a briefing) and the parsed polygon JSON shape the [`@ab/wx-charts`](../../../../libs/wx-charts/) overlay renderer consumes.

Three families share this catalog because they share a common operational role - in-flight hazard advisories with closed polygon rings, altitude bands, validity windows, and a phenomenon description:

- **AIRMET (WA)** - widespread hazards below FL180 (G-AIRMET in v6 onward). Three sub-products: Sierra (IFR + mountain obscuration), Tango (turbulence + low-level wind shear + strong surface winds), Zulu (icing + freezing levels).
- **SIGMET (WS)** - non-convective severe hazards anywhere from the surface to FL600 (volcanic ash, severe turbulence, severe icing, dust/sand storms reducing visibility, low-level wind shear in some regions).
- **Convective SIGMET (WST)** - thunderstorm-driven hazards. Three forms: area, line, and embedded; plus a two-hour outlook for developing convection.

Unlike METAR / TAF / PIREP / FB, AIRMET / SIGMET examples in the catalog do **not** round-trip through a parser - there is no AIRMET parser in `@ab/wx-charts` v1; the engine emits the `AirmetAdvisory` shape directly to the overlay renderer. The catalog's parsed JSON blocks are the load-bearing reference for that shape, not a re-parse target.

## Why a single catalog file

AIRMET, SIGMET, and Convective SIGMET share enough vocabulary (polygon, altitude band, validity window, phenomenon code) that splitting them into three files would force the reader to chase the same token family across three places. The grouping mirrors AIM 7-1-6 ("In-flight Weather Advisories"), which walks all three families in one section.

The corresponding teaching nodes live one level up:

- [product-airmets](../product-airmets/node.md)
- [product-sigmets](../product-sigmets/node.md)
- [product-convective-sigmets](../product-convective-sigmets/node.md)

## Group order

Every advisory in this family follows the same skeleton:

1. **Bulletin header** - issuing center (`KKCI` Aviation Weather Center for CONUS; `PAWU` Anchorage; `PHFO` Honolulu), product type, issuance time.
2. **Series + sequence** - AIRMETs use SIERRA / TANGO / ZULU; SIGMETs use a phonetic letter cycled through ALFA-NOVEMBER (KILO-XRAY for Convective SIGMETs).
3. **Validity** - `VALID UNTIL DDhhmm` (six hours for AIRMET, four for SIGMET, two for Convective SIGMET).
4. **FIR / region** - the area of responsibility (`CHI` Chicago, `MIA` Miami, `SLC` Salt Lake City, etc.).
5. **Polygon vertices** - latitude / longitude pairs traced as a closed ring. AIRMETs use VOR-relative shorthand (`60E LSE`); SIGMETs use lat/lon (`44N 85W`); both render to the same polygon JSON downstream.
6. **Altitude band** - `BTN FL080 AND FL240`, `BLW 060`, `SFC`, or `OTLK` (outlook, no altitude).
7. **Phenomenon description** - IFR / MTN OBSC / MOD TURB / SEV ICE / VA / CB DEVELOPING.
8. **Conditions clause** - what produces the hazard (e.g., `CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR`, `OCNL MOD TURB BTN FL240 AND FL360`).
9. **Forecast clause** - `CONDS CONTG BYD 21Z`, `CONDS IMPRG`, or `CONDS ENDG 19Z`.

The catalog walks the products family by family, then closes with a `yaml-catalog` manifest the build script reads.

## AIRMET Sierra - IFR + mountain obscuration

Sierra covers two phenomena: widespread IFR (ceilings under 1,000 ft AGL or visibility under 3 SM affecting >50% of the area) and mountain obscuration (clouds, precipitation, or fog hiding terrain). The bulletin issues four times daily (02 / 08 / 14 / 20 Z) with a six-hour validity.

### IFR area - low ceilings and visibility

The classic morning Sierra. Stratus and fog over a broad area of the Pacific Northwest under a stagnant cool-season pattern.

```text
SFOS WA 121445
AIRMET SIERRA UPDT 2 FOR IFR VALID UNTIL 122100
AIRMET IFR... WA OR
FROM 40NNE HQM TO 50WSW SEA TO 30SSE GEG TO 30W EUG TO 40NNE HQM
CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-sierra-ifr-pacnw-20120814",
  "kind": "airmet-sierra-ifr",
  "label": "AIRMET SIERRA - IFR",
  "rings": [[
    [-123.7, 47.7],
    [-122.7, 47.0],
    [-117.0, 47.0],
    [-122.5, 44.5],
    [-123.7, 47.7]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "ifr-pacnw-stratus"
}
```

### Mountain obscuration

Sierra Nevada and Cascades under an upslope flow with low cloud bases. Mountain obscuration is the hazard pilots underestimate most - VFR off-airport routing through the passes becomes IMC without warning.

```text
SFOS WA 121445
AIRMET SIERRA UPDT 2 FOR MTN OBSCN VALID UNTIL 122100
AIRMET MTN OBSCN... CA NV
FROM 40W RNO TO 40NE FAT TO 50ESE BIH TO 40SSW LAS TO 40W RNO
MTNS OBSC BY CLDS/PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-sierra-mtn-obs-sierranv-20120814",
  "kind": "airmet-sierra-mtn-obs",
  "label": "AIRMET SIERRA - MTN OBSCN",
  "rings": [[
    [-120.4, 39.5],
    [-119.0, 37.4],
    [-117.7, 37.0],
    [-115.8, 35.7],
    [-120.4, 39.5]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "mtn-obs-sierra-nv"
}
```

### Combined IFR + MTN OBSCN

Both phenomena in one Sierra bulletin. Pacific Northwest pattern with stratus blanketing the coastal plain and the Cascades obscured by the same weather system.

```text
SFOS WA 121445
AIRMET SIERRA UPDT 1 FOR IFR AND MTN OBSCN VALID UNTIL 122100
AIRMET IFR AND MTN OBSCN... WA OR ID
FROM 40NNE HQM TO 50WSW SEA TO 30E GEG TO 30SE BOI TO 40W EUG TO 40NNE HQM
CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR. MTNS OBSC BY CLDS/PCPN/BR.
CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-sierra-combined-pacnw-20120814",
  "kind": "airmet-sierra-combined",
  "label": "AIRMET SIERRA - IFR + MTN OBSCN",
  "rings": [[
    [-123.7, 47.7],
    [-122.7, 47.0],
    [-117.0, 47.7],
    [-115.8, 43.3],
    [-123.0, 44.2],
    [-123.7, 47.7]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "ifr-mtn-pacnw-system"
}
```

## AIRMET Tango - turbulence + LLWS + strong surface winds

Tango covers moderate turbulence (above-FL180 turbulence stays on Tango until SEV; convective turbulence belongs in Convective SIGMET), low-level wind shear non-convective (LLWS BLW 020 with > 10 KT change per 100 ft), and sustained surface winds > 30 KT.

### Moderate turbulence band

The bread-and-butter Tango. Mid-level turbulence band along the jet stream entrance region.

```text
KCIT WA 121445
AIRMET TANGO UPDT 2 FOR TURB AND STG SFC WND VALID UNTIL 122100
AIRMET TURB... CO KS NE WY
FROM 30NW BFF TO 40E LBL TO 30S ALS TO 30NW BFF
OCNL MOD TURB BTN FL240 AND FL370.
CONDS DVLPG AFT 18Z. CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-tango-turb-highplains-20120814",
  "kind": "airmet-tango-turb",
  "label": "AIRMET TANGO - MOD TURB FL240-370",
  "rings": [[
    [-104.4, 42.4],
    [-100.0, 37.7],
    [-105.3, 37.6],
    [-104.4, 42.4]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "turb-jet-entrance-co-ks"
}
```

### Strong surface winds

Tango sustained-wind. Pacific cold front pushing through southern California, with 30+ KT surface winds in the lee of the Transverse Ranges.

```text
SFOT WA 121445
AIRMET TANGO UPDT 1 FOR STG SFC WND VALID UNTIL 122100
AIRMET STG SFC WND... CA
FROM 30N PRB TO 30E SBA TO 20W LAX TO 30N PRB
SUSTAINED SFC WND GTR THAN 30KT. CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-tango-stg-wnd-soca-20120814",
  "kind": "airmet-tango-stg-wnd",
  "label": "AIRMET TANGO - STG SFC WND > 30 KT",
  "rings": [[
    [-120.8, 35.7],
    [-119.4, 34.4],
    [-118.6, 33.7],
    [-120.8, 35.7]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "stg-wnd-soca-coldfront"
}
```

### Low-level wind shear (LLWS)

Non-convective LLWS - typically a low-level jet over a stable surface layer at night, producing > 10 KT shear in the lowest 2,000 ft AGL.

```text
KCIT WA 130845
AIRMET TANGO UPDT 1 FOR LLWS VALID UNTIL 131500
AIRMET LLWS... OK TX
FROM 30SW OKC TO 40NE ABI TO 40SW CDS TO 30SW OKC
LLWS PSBL BTN SFC AND 2000 FT AGL DUE TO LLJ.
CONDS ENDG BTN 12Z-15Z.
```

```json
{
  "id": "airmet-tango-llws-oktx-20120813",
  "kind": "airmet-tango-llws",
  "label": "AIRMET TANGO - LLWS SFC-2000 FT AGL",
  "rings": [[
    [-98.0, 35.0],
    [-99.5, 32.8],
    [-100.5, 34.4],
    [-98.0, 35.0]
  ]],
  "validFrom": "2026-05-13T08:45:00Z",
  "validTo": "2026-05-13T15:00:00Z",
  "fromHazardZoneId": "llws-llj-oktx-nightly"
}
```

## AIRMET Zulu - icing + freezing levels

Zulu covers moderate icing and the freezing-level surface (the operational input to ice-avoidance planning). Severe icing escalates to SIGMET.

### Moderate icing band

Cold-frontal overrunning. Mid-level supercooled liquid above the warm conveyor belt.

```text
KCIT WA 121445
AIRMET ZULU UPDT 2 FOR ICE AND FRZLVL VALID UNTIL 122100
AIRMET ICE... IL IN OH KY WV
FROM 30W ORD TO 30E DAY TO 30S HVQ TO 30S LOZ TO 30W EVV TO 30W ORD
MOD ICE BTN FRZLVL AND FL180. FRZLVL 060 SFC IN N TO 100 IN S.
CONDS CONTG BYD 21Z THRU 03Z.
```

```json
{
  "id": "airmet-zulu-ice-ohvalley-20120814",
  "kind": "airmet-zulu-ice",
  "label": "AIRMET ZULU - MOD ICE FRZLVL-FL180",
  "rings": [[
    [-88.2, 41.5],
    [-83.7, 39.8],
    [-83.8, 37.2],
    [-84.9, 36.6],
    [-88.1, 37.8],
    [-88.2, 41.5]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "ice-warm-conveyor-ohvalley"
}
```

### Freezing level surface

Zulu also carries the freezing-level forecast - the altitude of the 0 deg C isotherm across the AIRMET region. Pilots read it as a "if I climb above this, I'm in icing-eligible air" floor.

```text
KCIT WA 121445
AIRMET ZULU UPDT 2 FRZLVL... CONUS
FRZLVL RANGING FROM SFC IN N WI/MN TO 120 IN SRN TX.
MULTIPLE FRZLVLS DUE TO INVERSIONS POSS IN ID/MT/WY.
```

```json
{
  "id": "airmet-zulu-frzlvl-conus-20120814",
  "kind": "airmet-zulu-frzlvl",
  "label": "AIRMET ZULU - FRZLVL CONUS",
  "rings": [[
    [-125.0, 49.0],
    [-67.0, 49.0],
    [-97.0, 25.5],
    [-125.0, 32.5],
    [-125.0, 49.0]
  ]],
  "validFrom": "2026-05-12T14:45:00Z",
  "validTo": "2026-05-12T21:00:00Z",
  "fromHazardZoneId": "frzlvl-surface-conus"
}
```

## SIGMET (non-convective) - WSnn

Non-convective SIGMETs cover severe phenomena outside thunderstorms: volcanic ash, severe turbulence, severe icing, dust/sand storms restricting visibility below 3 SM, and tropical cyclones. Issuance is event-driven; validity is four hours; the alphabetic series cycles ALFA - NOVEMBER for CONUS.

### Volcanic ash

The textbook ash SIGMET. Plume from a north-Pacific eruption advected into the Anchorage FIR.

```text
PAWU WS 130430
SIGMET INDIA 3 VALID UNTIL 130830
ANCHORAGE FIR VA ERUPTION OF MT REDOUBT VOLCANO LOC N6029 W15225
AT 0345Z. VA CLD OBS AT 0400Z LOC FROM N6030 W15230 TO N6045 W15145
TO N6115 W15030 TO N6045 W14930 SFC/FL250. MOV E 25KT.
CONDS NC.
```

```json
{
  "id": "sigmet-india-3-redoubt-va-20130430",
  "kind": "sigmet-va",
  "label": "SIGMET INDIA 3 - VOLCANIC ASH",
  "rings": [[
    [-152.50, 60.50],
    [-151.75, 60.75],
    [-150.50, 61.25],
    [-149.50, 60.75],
    [-152.50, 60.50]
  ]],
  "validFrom": "2026-05-13T04:30:00Z",
  "validTo": "2026-05-13T08:30:00Z",
  "fromHazardZoneId": "va-redoubt-eruption"
}
```

### Severe turbulence

Mountain-wave breaking off the lee of the northern Rockies. The Tango became Sierra-or-stronger; SEV TURB above FL180 escalates the advisory to SIGMET.

```text
KKCI WS 121800
SIGMET ALFA 2 VALID UNTIL 122200
SLC FIR SEV TURB FCST WI AREA BOUNDED BY
30NE GTF TO 50E HLN TO 60SE LWT TO 40N BIL TO 30NE GTF
BTN FL280 AND FL410. DUE TO MTN WAVE.
CONDS CONTG BYD 22Z.
```

```json
{
  "id": "sigmet-alfa-2-mtnwv-rockies-20121800",
  "kind": "sigmet-sev-turb",
  "label": "SIGMET ALFA 2 - SEV TURB FL280-410",
  "rings": [[
    [-110.7, 47.7],
    [-111.2, 46.4],
    [-108.0, 47.0],
    [-108.5, 45.8],
    [-110.7, 47.7]
  ]],
  "validFrom": "2026-05-12T18:00:00Z",
  "validTo": "2026-05-12T22:00:00Z",
  "fromHazardZoneId": "sev-turb-mtnwv-rockies"
}
```

### Severe icing

Warm-conveyor-belt SLW (supercooled large droplets) over a deep moist layer. Severe icing is rare enough that one of these per cold-season month is busy; when it issues, the routing decision is "go around the polygon."

```text
KKCI WS 121800
SIGMET LIMA 1 VALID UNTIL 122200
ZBW FIR SEV ICE FCST WI AREA BOUNDED BY
40W BUF TO 40N BDL TO 30S BDL TO 40SW BUF TO 40W BUF
BTN FL050 AND FL120. DUE TO SLW IN WARM CONVEYOR BELT.
CONDS CONTG BYD 22Z.
```

```json
{
  "id": "sigmet-lima-1-sev-ice-bos-20121800",
  "kind": "sigmet-sev-ice",
  "label": "SIGMET LIMA 1 - SEV ICE FL050-120",
  "rings": [[
    [-79.5, 42.9],
    [-73.5, 42.0],
    [-72.7, 40.4],
    [-79.5, 41.8],
    [-79.5, 42.9]
  ]],
  "validFrom": "2026-05-12T18:00:00Z",
  "validTo": "2026-05-12T22:00:00Z",
  "fromHazardZoneId": "sev-ice-warm-conv-bos"
}
```

### Low-level wind shear (severe / widespread)

LLWS that doesn't fit the AIRMET Tango envelope - severe non-convective shear (typically > 20 KT below 2,000 ft AGL) issued as a SIGMET in some FIRs.

```text
KKCI WS 121200
SIGMET MIKE 1 VALID UNTIL 121600
ZAB FIR SEV LLWS FCST WI AREA BOUNDED BY
40NW ABQ TO 40NE ABQ TO 30SE ABQ TO 30SW ABQ TO 40NW ABQ
BLW 020. DUE TO STG LLJ.
CONDS ENDG AFT 14Z.
```

```json
{
  "id": "sigmet-mike-1-llws-abq-20121200",
  "kind": "sigmet-sev-llws",
  "label": "SIGMET MIKE 1 - SEV LLWS BLW 2000 FT AGL",
  "rings": [[
    [-107.1, 35.5],
    [-105.9, 35.5],
    [-105.9, 34.4],
    [-107.1, 34.4],
    [-107.1, 35.5]
  ]],
  "validFrom": "2026-05-12T12:00:00Z",
  "validTo": "2026-05-12T16:00:00Z",
  "fromHazardZoneId": "llws-sev-llj-abq"
}
```

## Convective SIGMET (WST)

Convective SIGMETs issue hourly at H+55 from the Aviation Weather Center for thunderstorm-driven hazards over CONUS, with 2-hour validity. Three forms - area, line, embedded - plus an outlook for developing convection two to six hours ahead.

### Convective SIGMET area

A cluster of cells covering a contiguous area >= 3,000 sq mi (40% coverage of the polygon).

```text
MKCC WST 121955
CONVECTIVE SIGMET 23C VALID UNTIL 122155
KS NE OK
FROM 30NW ICT-30S TOP-50E AMA
AREA TS MOV FROM 24025KT. TOPS TO FL450. HAIL TO 1 IN PSBL. WIND GUSTS TO 50KT PSBL.
```

```json
{
  "id": "wst-23c-area-plains-20121955",
  "kind": "convective-sigmet-area",
  "label": "CONVECTIVE SIGMET 23C - AREA TS",
  "rings": [[
    [-97.8, 38.2],
    [-95.7, 38.7],
    [-101.6, 35.7],
    [-97.8, 38.2]
  ]],
  "validFrom": "2026-05-12T19:55:00Z",
  "validTo": "2026-05-12T21:55:00Z",
  "fromHazardZoneId": "ts-area-plains-driver-23c"
}
```

### Convective SIGMET line

A continuous line of cells >= 60 NM long with >= 40% coverage. Squall-line shape.

```text
MKCC WST 121955
CONVECTIVE SIGMET 24C VALID UNTIL 122155
TX OK
FROM 20NW SPS-30E ADM-20S ADM
LINE TS 50NM WIDE MOV FROM 26035KT. TOPS TO FL480. HAIL TO 2 IN PSBL.
TORNADOES PSBL. WIND GUSTS TO 65KT PSBL.
```

```json
{
  "id": "wst-24c-line-redriver-20121955",
  "kind": "convective-sigmet-line",
  "label": "CONVECTIVE SIGMET 24C - LINE TS",
  "rings": [[
    [-99.0, 34.2],
    [-96.8, 34.4],
    [-96.5, 34.0],
    [-98.6, 33.7],
    [-99.0, 34.2]
  ]],
  "validFrom": "2026-05-12T19:55:00Z",
  "validTo": "2026-05-12T21:55:00Z",
  "fromHazardZoneId": "ts-line-redriver-24c"
}
```

### Convective SIGMET embedded

Cells embedded within a broader stratiform area - the IFR-flight problem. Embedded thunderstorms cannot be visually avoided.

```text
MKCC WST 121955
CONVECTIVE SIGMET 25C VALID UNTIL 122155
AR LA MS
FROM 30W LIT-30E MEM-20S MLU-30W MLU-30W LIT
EMBD AREA TS MOV FROM 22020KT. TOPS TO FL400. HAIL TO 1 IN PSBL.
WIND GUSTS TO 50KT PSBL.
```

```json
{
  "id": "wst-25c-embed-arklamiss-20121955",
  "kind": "convective-sigmet-embedded",
  "label": "CONVECTIVE SIGMET 25C - EMBD TS",
  "rings": [[
    [-92.7, 34.9],
    [-89.5, 35.2],
    [-91.4, 32.3],
    [-92.6, 32.3],
    [-92.7, 34.9]
  ]],
  "validFrom": "2026-05-12T19:55:00Z",
  "validTo": "2026-05-12T21:55:00Z",
  "fromHazardZoneId": "ts-embd-arklamiss-25c"
}
```

### Convective SIGMET outlook

The two-to-six-hour outlook. Not an active advisory; a heads-up for developing convection so pilots can replan before the area SIGMET issues.

```text
MKCC WST 121955
CONVECTIVE SIGMET 1 OUTLOOK VALID 122200-130200
FROM 50NW DSM-30E DSM-30E STL-50W STL
WST ISSUANCES PSBL. REF AC. AREAS OF TS DVLPG IN ADVANCE OF FRONT.
```

```json
{
  "id": "wst-outlook-1-iowamo-20121955",
  "kind": "convective-sigmet-outlook",
  "label": "CONVECTIVE SIGMET 1 - OUTLOOK",
  "rings": [[
    [-94.8, 42.0],
    [-93.1, 41.5],
    [-89.6, 38.9],
    [-91.5, 38.7],
    [-94.8, 42.0]
  ]],
  "validFrom": "2026-05-12T22:00:00Z",
  "validTo": "2026-05-13T02:00:00Z",
  "fromHazardZoneId": "ts-outlook-iowamo-1"
}
```

## Composite canonical examples

Real-shape advisories that exercise multiple families at once - the briefing reality where Sierra + Tango + Zulu + Convective SIGMET all overlap on the same hour.

### Spring frontal passage - Plains

A canonical springtime cold front. Sierra IFR ahead of the front, Tango turbulence at the jet entrance behind it, Zulu icing along the warm conveyor, and Convective SIGMET line right on the front.

```text
KCIT WA 121445
AIRMET SIERRA UPDT 2 FOR IFR VALID UNTIL 122100
AIRMET IFR... TX OK KS
FROM 30NW DFW TO 30SE OKC TO 50S ICT TO 60SW ABI TO 30NW DFW
CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR.
```

Triage drivers: closed ring covers all four states; altitude band SFC-implied (IFR); validity covers the front's transit.

### Pacific Northwest stagnant pattern

Sierra + Zulu overlapping. Stratus with embedded freezing drizzle off a stationary front.

```text
SFOZ WA 121445
AIRMET ZULU UPDT 1 FOR ICE AND FRZLVL VALID UNTIL 122100
AIRMET ICE... WA OR
FROM 40NNE HQM TO 50E SEA TO 30E PDX TO 40W EUG TO 40NNE HQM
MOD ICE BTN FRZLVL AND 100. FRZLVL SFC TO 040.
LCL SEV ICE PSBL IN SLW DUE TO FRZ DRIZZLE.
CONDS CONTG BYD 21Z THRU 03Z.
```

Triage drivers: ring overlaps a current Sierra IFR ring; altitude band straddles the freezing level; FZDZ in the conditions clause is the load-bearing word for the routing decision.

### Volcanic ash + severe turbulence (Alaska)

Anchorage FIR active SIGMET. Two non-convective phenomena overlap because the eruption column is producing both ash and turbulence.

```text
PAWU WS 130430
SIGMET INDIA 3 VALID UNTIL 130830
ANCHORAGE FIR VA ERUPTION OF MT REDOUBT VOLCANO LOC N6029 W15225
AT 0345Z. VA CLD OBS AT 0400Z LOC FROM N6030 W15230 TO N6045 W15145
TO N6115 W15030 TO N6045 W14930 SFC/FL250. MOV E 25KT.
ASSOCIATED SEV TURB POSS WI 30NM OF PLUME.
CONDS NC.
```

Triage drivers: ring is the ash plume; the SEV TURB clause adds an annular buffer; ASSUME no-fly inside the polygon at any altitude.

## Catalog manifest

The structured metadata below is the source of truth the catalog build script reads. AIRMET / SIGMET examples skip the round-trip parse (no parser in v1); the parsed polygon JSON blocks above are the load-bearing reference for the `AirmetAdvisory` shape downstream.

```yaml-catalog
product: airmet-sigmet
references_default:
  - source: AC 00-45H
    detail: Chapter 7 - In-flight Weather Advisories (AIRMET / SIGMET / Convective SIGMET)
  - source: AIM
    detail: 7-1-6 - In-flight Weather Advisories
  - source: AIM
    detail: 7-1-12 - Pilot Weather Reports and AIRMET / SIGMET broadcast services
token_families:
  - slug: sierra-ifr
    label: AIRMET Sierra - IFR
    decode: Widespread IFR (ceiling under 1,000 ft AGL or visibility under 3 SM) over more than 50% of an area. Six-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, AIRMET Sierra phenomena
      - source: AIM
        detail: 7-1-6 d.1 - AIRMET Sierra
    examples: [airmet-sierra-ifr-pacnw, airmet-sierra-combined-pacnw, composite-frontal-plains]
  - slug: sierra-mtn-obs
    label: AIRMET Sierra - mountain obscuration
    decode: Clouds, precipitation, or fog obscuring mountains across an area. Six-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, mountain obscuration phenomenon
    examples: [airmet-sierra-mtn-obs-sierranv, airmet-sierra-combined-pacnw]
  - slug: tango-turb
    label: AIRMET Tango - moderate turbulence
    decode: Widespread moderate turbulence below FL180 (or above when not convective). Six-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, AIRMET Tango phenomena
      - source: AIM
        detail: 7-1-6 d.2 - AIRMET Tango
    examples: [airmet-tango-turb-highplains]
  - slug: tango-stg-wnd
    label: AIRMET Tango - strong surface winds
    decode: Sustained surface winds > 30 KT over an area. Six-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, sustained surface winds threshold
    examples: [airmet-tango-stg-wnd-soca]
  - slug: tango-llws
    label: AIRMET Tango - low-level wind shear
    decode: Non-convective LLWS below 2,000 ft AGL, typically from a low-level jet over a stable surface layer.
    references:
      - source: AC 00-45H
        detail: Chapter 7, LLWS reporting
    examples: [airmet-tango-llws-oktx]
  - slug: zulu-ice
    label: AIRMET Zulu - moderate icing
    decode: Moderate icing between the freezing level and FL180. Six-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, AIRMET Zulu phenomena
      - source: AIM
        detail: 7-1-6 d.3 - AIRMET Zulu
    examples: [airmet-zulu-ice-ohvalley, composite-pacnw-stagnant]
  - slug: zulu-frzlvl
    label: AIRMET Zulu - freezing levels
    decode: Forecast altitude of the 0 deg C isotherm across the AIRMET region.
    references:
      - source: AC 00-45H
        detail: Chapter 7, freezing-level surface
    examples: [airmet-zulu-frzlvl-conus, composite-pacnw-stagnant]
  - slug: sigmet-va
    label: SIGMET - volcanic ash
    decode: Volcanic ash cloud erupted or forecast, with location and forecast motion. Four-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, non-convective SIGMET phenomena - volcanic ash
      - source: AIM
        detail: 7-1-6 c.1 - SIGMET
    examples: [sigmet-india-3-redoubt-va, composite-va-sevturb-alaska]
  - slug: sigmet-sev-turb
    label: SIGMET - severe turbulence (non-convective)
    decode: Severe turbulence due to mountain wave, clear-air, or other non-convective driver. Four-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, severe-turbulence SIGMET
    examples: [sigmet-alfa-2-mtnwv-rockies, composite-va-sevturb-alaska]
  - slug: sigmet-sev-ice
    label: SIGMET - severe icing
    decode: Severe icing forecast, typically due to supercooled large droplets in a warm conveyor belt.
    references:
      - source: AC 00-45H
        detail: Chapter 7, severe-icing SIGMET
    examples: [sigmet-lima-1-sev-ice-bos]
  - slug: sigmet-sev-llws
    label: SIGMET - severe / widespread LLWS
    decode: LLWS that exceeds the AIRMET Tango envelope. Issued by some FIRs (ZAB / ZLA / etc.) when LLJ shear is severe.
    references:
      - source: AC 00-45H
        detail: Chapter 7, severe-LLWS SIGMET
    examples: [sigmet-mike-1-llws-abq]
  - slug: wst-area
    label: Convective SIGMET - area
    decode: Cluster of cells covering >= 3,000 sq mi with >= 40% coverage. Hourly issuance at H+55, 2-hour validity.
    references:
      - source: AC 00-45H
        detail: Chapter 7, Convective SIGMET area form
      - source: AIM
        detail: 7-1-6 b - Convective SIGMET
    examples: [wst-23c-area-plains, composite-frontal-plains]
  - slug: wst-line
    label: Convective SIGMET - line
    decode: Continuous line of cells >= 60 NM long with >= 40% coverage. Squall-line shape.
    references:
      - source: AC 00-45H
        detail: Chapter 7, Convective SIGMET line form
    examples: [wst-24c-line-redriver]
  - slug: wst-embedded
    label: Convective SIGMET - embedded
    decode: Cells embedded in a broader stratiform area; not visually avoidable. The IFR-flight problem.
    references:
      - source: AC 00-45H
        detail: Chapter 7, Convective SIGMET embedded form
    examples: [wst-25c-embed-arklamiss]
  - slug: wst-outlook
    label: Convective SIGMET - outlook
    decode: Two-to-six-hour outlook for developing convection. Heads-up, not an active advisory.
    references:
      - source: AC 00-45H
        detail: Chapter 7, Convective SIGMET outlook
    examples: [wst-outlook-1-iowamo]
examples:
  - slug: airmet-sierra-ifr-pacnw
    raw: |
      SFOS WA 121445
      AIRMET SIERRA UPDT 2 FOR IFR VALID UNTIL 122100
      AIRMET IFR... WA OR
      FROM 40NNE HQM TO 50WSW SEA TO 30SSE GEG TO 30W EUG TO 40NNE HQM
      CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [sierra-ifr]
    synoptic: Stagnant cool-season pattern over the Pacific Northwest; stratus and fog dropping ceiling under 1,000 ft over a broad area.
    triage_drivers: [polygon overlap with route, ceiling threshold, validity vs ETA]
  - slug: airmet-sierra-mtn-obs-sierranv
    raw: |
      SFOS WA 121445
      AIRMET SIERRA UPDT 2 FOR MTN OBSCN VALID UNTIL 122100
      AIRMET MTN OBSCN... CA NV
      FROM 40W RNO TO 40NE FAT TO 50ESE BIH TO 40SSW LAS TO 40W RNO
      MTNS OBSC BY CLDS/PCPN/BR. CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [sierra-mtn-obs]
    synoptic: Upslope flow against the Sierra Nevada / White Mountains hiding terrain under low cloud bases.
    triage_drivers: [terrain clearance, off-airport routing, conditions trend]
  - slug: airmet-sierra-combined-pacnw
    raw: |
      SFOS WA 121445
      AIRMET SIERRA UPDT 1 FOR IFR AND MTN OBSCN VALID UNTIL 122100
      AIRMET IFR AND MTN OBSCN... WA OR ID
      FROM 40NNE HQM TO 50WSW SEA TO 30E GEG TO 30SE BOI TO 40W EUG TO 40NNE HQM
      CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR. MTNS OBSC BY CLDS/PCPN/BR.
      CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [sierra-ifr, sierra-mtn-obs]
    synoptic: Pacific Northwest cool-season system with stratus over the lowlands and obscured Cascades and Bitterroots.
    triage_drivers: [polygon overlap, terrain, ceiling]
  - slug: airmet-tango-turb-highplains
    raw: |
      KCIT WA 121445
      AIRMET TANGO UPDT 2 FOR TURB AND STG SFC WND VALID UNTIL 122100
      AIRMET TURB... CO KS NE WY
      FROM 30NW BFF TO 40E LBL TO 30S ALS TO 30NW BFF
      OCNL MOD TURB BTN FL240 AND FL370.
      CONDS DVLPG AFT 18Z. CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [tango-turb]
    synoptic: Jet stream entrance region over the High Plains; mid-level turbulence along the upper-level jet.
    triage_drivers: [altitude band, jet axis, validity]
  - slug: airmet-tango-stg-wnd-soca
    raw: |
      SFOT WA 121445
      AIRMET TANGO UPDT 1 FOR STG SFC WND VALID UNTIL 122100
      AIRMET STG SFC WND... CA
      FROM 30N PRB TO 30E SBA TO 20W LAX TO 30N PRB
      SUSTAINED SFC WND GTR THAN 30KT. CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [tango-stg-wnd]
    synoptic: Pacific cold front clearing southern California with strong post-frontal NW flow in the lee of the Transverse Ranges.
    triage_drivers: [surface wind, crosswind component, gust factor]
  - slug: airmet-tango-llws-oktx
    raw: |
      KCIT WA 130845
      AIRMET TANGO UPDT 1 FOR LLWS VALID UNTIL 131500
      AIRMET LLWS... OK TX
      FROM 30SW OKC TO 40NE ABI TO 40SW CDS TO 30SW OKC
      LLWS PSBL BTN SFC AND 2000 FT AGL DUE TO LLJ.
      CONDS ENDG BTN 12Z-15Z.
    token_families: [tango-llws]
    synoptic: Nightly low-level jet over the southern Plains with > 10 KT shear in the lowest 2,000 ft.
    triage_drivers: [departure timing, LLJ axis, LLWS termination]
  - slug: airmet-zulu-ice-ohvalley
    raw: |
      KCIT WA 121445
      AIRMET ZULU UPDT 2 FOR ICE AND FRZLVL VALID UNTIL 122100
      AIRMET ICE... IL IN OH KY WV
      FROM 30W ORD TO 30E DAY TO 30S HVQ TO 30S LOZ TO 30W EVV TO 30W ORD
      MOD ICE BTN FRZLVL AND FL180. FRZLVL 060 SFC IN N TO 100 IN S.
      CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [zulu-ice, zulu-frzlvl]
    synoptic: Warm conveyor belt over the Ohio Valley with supercooled liquid above the warm air aloft.
    triage_drivers: [icing-eligible altitudes, freezing level, exit routing]
  - slug: airmet-zulu-frzlvl-conus
    raw: |
      KCIT WA 121445
      AIRMET ZULU UPDT 2 FRZLVL... CONUS
      FRZLVL RANGING FROM SFC IN N WI/MN TO 120 IN SRN TX.
      MULTIPLE FRZLVLS DUE TO INVERSIONS POSS IN ID/MT/WY.
    token_families: [zulu-frzlvl]
    synoptic: Continental freezing-level surface sloping from surface in the upper Midwest to 12,000 ft over south Texas.
    triage_drivers: [climb floor, multi-FRZLVL terrain, inversion latitude]
  - slug: sigmet-india-3-redoubt-va
    raw: |
      PAWU WS 130430
      SIGMET INDIA 3 VALID UNTIL 130830
      ANCHORAGE FIR VA ERUPTION OF MT REDOUBT VOLCANO LOC N6029 W15225
      AT 0345Z. VA CLD OBS AT 0400Z LOC FROM N6030 W15230 TO N6045 W15145
      TO N6115 W15030 TO N6045 W14930 SFC/FL250. MOV E 25KT.
      CONDS NC.
    token_families: [sigmet-va]
    synoptic: Mt Redoubt eruption producing an ash plume drifting east through the Anchorage FIR.
    triage_drivers: [ring avoidance, plume motion, altitude band SFC-FL250]
  - slug: sigmet-alfa-2-mtnwv-rockies
    raw: |
      KKCI WS 121800
      SIGMET ALFA 2 VALID UNTIL 122200
      SLC FIR SEV TURB FCST WI AREA BOUNDED BY
      30NE GTF TO 50E HLN TO 60SE LWT TO 40N BIL TO 30NE GTF
      BTN FL280 AND FL410. DUE TO MTN WAVE.
      CONDS CONTG BYD 22Z.
    token_families: [sigmet-sev-turb]
    synoptic: Strong westerly flow over the northern Rockies producing breaking mountain wave aloft.
    triage_drivers: [altitude band, mountain-wave geometry, route reroute]
  - slug: sigmet-lima-1-sev-ice-bos
    raw: |
      KKCI WS 121800
      SIGMET LIMA 1 VALID UNTIL 122200
      ZBW FIR SEV ICE FCST WI AREA BOUNDED BY
      40W BUF TO 40N BDL TO 30S BDL TO 40SW BUF TO 40W BUF
      BTN FL050 AND FL120. DUE TO SLW IN WARM CONVEYOR BELT.
      CONDS CONTG BYD 22Z.
    token_families: [sigmet-sev-ice]
    synoptic: Warm conveyor belt over the Northeast with SLW producing severe icing in the FL050-120 layer.
    triage_drivers: [polygon avoidance, altitude band, conveyor-belt orientation]
  - slug: sigmet-mike-1-llws-abq
    raw: |
      KKCI WS 121200
      SIGMET MIKE 1 VALID UNTIL 121600
      ZAB FIR SEV LLWS FCST WI AREA BOUNDED BY
      40NW ABQ TO 40NE ABQ TO 30SE ABQ TO 30SW ABQ TO 40NW ABQ
      BLW 020. DUE TO STG LLJ.
      CONDS ENDG AFT 14Z.
    token_families: [sigmet-sev-llws]
    synoptic: Strong overnight LLJ over central New Mexico producing severe shear below 2,000 ft AGL.
    triage_drivers: [departure timing, climb profile, shear axis]
  - slug: wst-23c-area-plains
    raw: |
      MKCC WST 121955
      CONVECTIVE SIGMET 23C VALID UNTIL 122155
      KS NE OK
      FROM 30NW ICT-30S TOP-50E AMA
      AREA TS MOV FROM 24025KT. TOPS TO FL450. HAIL TO 1 IN PSBL. WIND GUSTS TO 50KT PSBL.
    token_families: [wst-area]
    synoptic: Cluster of thunderstorms over the southern Plains moving NE in the warm sector ahead of a cold front.
    triage_drivers: [polygon avoidance, cell motion, hail / wind threats]
  - slug: wst-24c-line-redriver
    raw: |
      MKCC WST 121955
      CONVECTIVE SIGMET 24C VALID UNTIL 122155
      TX OK
      FROM 20NW SPS-30E ADM-20S ADM
      LINE TS 50NM WIDE MOV FROM 26035KT. TOPS TO FL480. HAIL TO 2 IN PSBL.
      TORNADOES PSBL. WIND GUSTS TO 65KT PSBL.
    token_families: [wst-line]
    synoptic: Squall line along the dryline across north Texas with severe surface threats.
    triage_drivers: [line orientation, hail / tornado threats, line motion]
  - slug: wst-25c-embed-arklamiss
    raw: |
      MKCC WST 121955
      CONVECTIVE SIGMET 25C VALID UNTIL 122155
      AR LA MS
      FROM 30W LIT-30E MEM-20S MLU-30W MLU-30W LIT
      EMBD AREA TS MOV FROM 22020KT. TOPS TO FL400. HAIL TO 1 IN PSBL.
      WIND GUSTS TO 50KT PSBL.
    token_families: [wst-embedded]
    synoptic: Embedded thunderstorms within stratiform precipitation over the lower Mississippi Valley.
    triage_drivers: [embedded - cannot visually avoid, IFR routing, deviation budget]
  - slug: wst-outlook-1-iowamo
    raw: |
      MKCC WST 121955
      CONVECTIVE SIGMET 1 OUTLOOK VALID 122200-130200
      FROM 50NW DSM-30E DSM-30E STL-50W STL
      WST ISSUANCES PSBL. REF AC. AREAS OF TS DVLPG IN ADVANCE OF FRONT.
    token_families: [wst-outlook]
    synoptic: Developing convection forecast ahead of an approaching cold front over the upper Midwest.
    triage_drivers: [pre-issuance heads-up, departure replanning, frontal timing]
  - slug: composite-frontal-plains
    raw: |
      KCIT WA 121445
      AIRMET SIERRA UPDT 2 FOR IFR VALID UNTIL 122100
      AIRMET IFR... TX OK KS
      FROM 30NW DFW TO 30SE OKC TO 50S ICT TO 60SW ABI TO 30NW DFW
      CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR.
    token_families: [sierra-ifr, wst-area]
    synoptic: Springtime cold front through the southern Plains with broad pre-frontal IFR and post-frontal convection.
    triage_drivers: [overlapping rings, altitude band, frontal motion]
  - slug: composite-pacnw-stagnant
    raw: |
      SFOZ WA 121445
      AIRMET ZULU UPDT 1 FOR ICE AND FRZLVL VALID UNTIL 122100
      AIRMET ICE... WA OR
      FROM 40NNE HQM TO 50E SEA TO 30E PDX TO 40W EUG TO 40NNE HQM
      MOD ICE BTN FRZLVL AND 100. FRZLVL SFC TO 040.
      LCL SEV ICE PSBL IN SLW DUE TO FRZ DRIZZLE.
      CONDS CONTG BYD 21Z THRU 03Z.
    token_families: [zulu-ice, zulu-frzlvl]
    synoptic: Stagnant Pacific Northwest pattern with stratus, embedded freezing drizzle, and surface-skimming freezing level.
    triage_drivers: [SLW risk, freezing level proximity to surface, conditions trend]
  - slug: composite-va-sevturb-alaska
    raw: |
      PAWU WS 130430
      SIGMET INDIA 3 VALID UNTIL 130830
      ANCHORAGE FIR VA ERUPTION OF MT REDOUBT VOLCANO LOC N6029 W15225
      AT 0345Z. VA CLD OBS AT 0400Z LOC FROM N6030 W15230 TO N6045 W15145
      TO N6115 W15030 TO N6045 W14930 SFC/FL250. MOV E 25KT.
      ASSOCIATED SEV TURB POSS WI 30NM OF PLUME.
      CONDS NC.
    token_families: [sigmet-va, sigmet-sev-turb]
    synoptic: Mt Redoubt active eruption with overlapping ash and severe-turbulence advisories.
    triage_drivers: [ring avoidance, buffer for SEV TURB, plume motion]
```
