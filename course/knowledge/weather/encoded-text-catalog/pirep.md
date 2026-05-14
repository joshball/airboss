# PIREP catalog

Every realistic Pilot Report (PIREP) shape, organized by token family. Each example round-trips through `parsePirep` from `@ab/wx-charts` with zero warnings. The teaching node is [product-pireps](../product-pireps/node.md); this catalog is the reference card.

PIREP body order (per AIM 7-1-21 + FMH-1 Ch 8):

```text
<STATION> UA|UUA /OV <position> /TM <hhmm> /FL<altitude> /TP <aircraft>
            /SK <sky-cover groups> /WX <weather> /TA <temp>
            /WV <wind> /TB <turb> /IC <icing> /RM <remarks>
```

Each `/XX` block is optional. The order is FAA-recommended but not enforced; pilots and FSS specialists routinely reorder them. The parser keys on the leading two-letter code, not position.

## Header (kind + station)

Every PIREP opens with a station identifier followed by either `UA` (routine) or `UUA` (urgent). The kind tells the reader how the report should be weighted in the briefing.

### UA - routine

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050
```

```text
KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02
```

```text
KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK SCT040-060 BKN090
```

### UUA - urgent

Reserved for severe / extreme conditions: severe icing, severe / extreme turbulence, hail, low-level wind shear, volcanic ash, tornadoes / waterspouts. UUA tells the briefer "drop everything else and read this."

```text
KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD RIME 050-070
```

```text
KDEN UUA /OV DEN180030 /TM 2030 /FL220 /TP CRJ7 /TB SEV 200-240
```

```text
KORD UUA /OV ORD180040 /TM 1820 /FL090 /TP B738 /TA M08 /IC SEV CLR 080-100
```

## Location (/OV)

The `/OV` block describes where the report applies. Three forms:

- Bare station ICAO (`/OV ORD`) - report at the station.
- Station + radial + distance (`/OV ORD090020`) - radial 090 at 20 NM from ORD.
- 4-letter ICAO + radial + distance (`/OV KCLE090030`) - rare, mostly Canadian / European stations.

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /TA M02
```

```text
KORD UA /OV ORD090020 /TM 1745 /FL080 /TP C172 /SK BKN050-080 /TA M02 /TB MOD
```

```text
KCLE UA /OV CLE090030 /TM 1745 /FL080 /TP C172
```

## Time (/TM)

Four-digit HHMM in UTC. No `Z` suffix in the encoded form.

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050
```

```text
KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK SCT040-060 BKN090
```

```text
KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02
```

## Altitude (/FL)

Flight level in hundreds of feet. `FL080` = 8,000 ft (in PIREPs, FL is used at any altitude, not just above the transition altitude). `DURC` (during climb) and `DURD` (during descent) appear when the report covers a vertical slice rather than a single altitude.

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050
```

```text
KORD UA /OV ORD /TM 1900 /FL350 /TP B752 /TB MOD 300-360 /RM CONTINUOUS LIGHT CHOP
```

```text
KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02
```

## Aircraft type (/TP)

Four-letter ICAO aircraft code: `C172`, `PA28`, `B738`, `A320`, `CRJ7`, `C402`. Type matters for the reader because turbulence and icing severity are relative to airframe size and mass; "moderate turbulence in a 172" and "moderate turbulence in a 738" feel very different.

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050
```

```text
KORD UA /OV ORD /TM 1900 /FL350 /TP B752 /TB MOD 300-360 /RM CONTINUOUS LIGHT CHOP
```

```text
KDEN UUA /OV DEN180030 /TM 2030 /FL220 /TP CRJ7 /TB SEV 200-240
```

## Sky cover (/SK)

Cloud-layer report. One or more `cover` + `base-top` pairs. Cover codes: `CLR`, `SKC`, `FEW`, `SCT`, `BKN`, `OVC`, `OVX` (X-rated obscured). `OVX` is unique to PIREPs.

### Single layer

```text
KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK BKN090
```

```text
KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050
```

```text
KCLE UA /OV CLE060015 /TM 1530 /FL050 /TP PA28 /SK SCT035
```

### Multi-layer with tops

```text
KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK SCT040-060 BKN090
```

```text
KORD UA /OV ORD180020 /TM 1900 /FL050 /TP B738 /SK OVC020-050
```

```text
KORD UA /OV ORD090020 /TM 1745 /FL080 /TP C172 /SK BKN050-080 /TA M02 /TB MOD
```

## Temperature (/TA)

Degrees Celsius, integer. `M` (or `-`) prefix for negative. `TA M02` = -2 deg C. Below freezing temperatures pair operationally with icing reports.

```text
KORD UA /OV ORD090020 /TM 1745 /FL080 /TP C172 /SK BKN050-080 /TA M02 /TB MOD
```

```text
KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD RIME 050-070
```

```text
KMSP UA /OV MSP /TM 1600 /FL070 /TP C172 /IC TRC RIME 060-080
```

## Wind (/WV)

Three-digit direction + two- or three-digit speed in knots, with optional `KT` suffix. Direction is always degrees true. PIREP wind reports are invaluable for forecast verification at altitude where there's no direct observation surface.

```text
KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02
```

```text
KDEN UUA /OV DEN240020 /TM 1900 /FL150 /TP C525 /TA M15 /WV 24065KT /TB SEV 120-160
```

```text
KORD UA /OV ORD060015 /TM 1700 /FL340 /TP A320 /WV 28085KT /TA M58
```

## Turbulence (/TB)

Intensity + optional altitude band. Intensity scale (AIM 7-1-23): `NEG` negative, `LGT` light, `MOD` moderate, `SEV` severe, `EXTM` extreme. `CHOP` may appear as a remark (light chop is a separate aerodynamic feel; not graded the same way).

### Light / moderate

```text
KJFK UA /OV JFK /TM 1500 /FL340 /TP A320 /TB LGT
```

```text
KORD UA /OV ORD090020 /TM 1745 /FL080 /TP C172 /SK BKN050-080 /TA M02 /TB MOD
```

```text
KORD UA /OV ORD /TM 1900 /FL350 /TP B752 /TB MOD 300-360 /RM CONTINUOUS LIGHT CHOP
```

### Severe / extreme - UUA territory

Severe and extreme turbulence reports are urgent (`UUA`) by definition. A severe turbulence report stays in the briefing for hours and triggers SIGMETs.

```text
KDEN UUA /OV DEN180030 /TM 2030 /FL220 /TP CRJ7 /TB SEV 200-240
```

```text
KORD UUA /OV ORD120015 /TM 2200 /FL310 /TP B738 /TB SEV 290-330
```

```text
KASE UUA /OV ASE240010 /TM 1830 /FL170 /TP C525 /TA M20 /TB EXTM 150-200
```

## Icing (/IC)

Intensity + optional type + altitude band. Intensity scale (AIM 7-1-22): `NEG`, `TRC` trace, `LGT` light, `MOD` moderate, `SEV` severe. Type: `RIME`, `CLR` clear, `MX` mixed. `SEV` icing is `UUA` by definition.

### Trace / light

```text
KMSP UA /OV MSP /TM 1600 /FL070 /TP C172 /IC TRC RIME 060-080
```

```text
KGRR UA /OV GRR /TM 1600 /FL050 /TP PA28 /IC LGT RIME 050-080
```

```text
KORD UA /OV ORD180010 /TM 1730 /FL060 /TP C402 /TA M02 /IC LGT MX 040-080
```

### Moderate / severe - operational drivers

Moderate icing forces a deviation for non-known-ice airframes. Severe icing is "stop everything and find clear air."

```text
KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD RIME 050-070
```

```text
KORD UUA /OV ORD180040 /TM 1820 /FL090 /TP B738 /TA M08 /IC SEV CLR 080-100
```

```text
KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD MX 050-070
```

## Composite canonical PIREPs

### Routine light-turbulence cruise

```text
KJFK UA /OV JFK /TM 1500 /FL340 /TP A320 /TB LGT
```

A320 at FL340 with light turbulence. Not a route-changing report; useful for the next aircraft along that track to know what to expect.

### Light icing in a 172 (decision point)

```text
KMSP UA /OV MSP /TM 1600 /FL070 /TP C172 /IC TRC RIME 060-080
```

Trace rime in a non-known-ice 172 at 7,000 ft. The PIREP is informational; trace ice on a 172 at this altitude means the pilot considered descending or turning around but hadn't crossed the threshold.

### Moderate icing - non-known-ice forced down (UUA)

```text
KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD RIME 050-070
```

PA-28 in moderate rime ice between 5,000 and 7,000. UUA. Triggers Zulu AIRMET activation if not already active.

### Severe clear ice in a 737 (rare, alarming)

```text
KORD UUA /OV ORD180040 /TM 1820 /FL090 /TP B738 /TA M08 /IC SEV CLR 080-100
```

737 with severe clear ice between 8,000 and 10,000. Very rare in transport aircraft; usually signals an unusual atmospheric profile (deep supercooled drizzle layer). Triggers SIGMET consideration.

### Severe turbulence in a regional (UUA)

```text
KDEN UUA /OV DEN180030 /TM 2030 /FL220 /TP CRJ7 /TB SEV 200-240
```

CRJ-700 in severe turbulence between FL200 and FL240. Stays in the briefing for hours.

### Mountain wave - wind shear (UUA)

```text
KDEN UUA /OV DEN240020 /TM 1900 /FL150 /TP C525 /TA M15 /WV 24065KT /TB SEV 120-160
```

Citation in severe mountain wave west of Denver. 65-kt cross-mountain wind + severe turbulence at flight levels = classic Rockies mountain-wave signature.

### Sky tops report

```text
KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK SCT040-060 BKN090
```

C402 west of MIA: scattered cumulus tops at 6,000, broken layer based at 9,000. Tops reports let the next aircraft pick a cruise altitude that clears the layer.

### Wind at altitude (forecast verification)

```text
KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02
```

737 at 5,000 ft south of SFO: wind 270/45. Used to verify or correct the winds-aloft forecast.

## Catalog manifest

```yaml-catalog
product: pirep
references_default:
  - source: AIM
    detail: 7-1-21 - Reporting Pilot Reports
  - source: AIM
    detail: 7-1-22 - Icing intensity scale
  - source: AIM
    detail: 7-1-23 - Turbulence intensity scale
  - source: FMH-1
    detail: Chapter 8 - PIREP format and submission
token_families:
  - slug: kind-ua
    label: UA (routine)
    decode: Routine pilot report. Not safety-critical; informational for the next aircraft along that track.
    references:
      - source: AIM
        detail: 7-1-21 routine vs urgent
    examples: [pirep-ua-cruise, pirep-ua-sfo-wind, pirep-ua-mia-sky]
  - slug: kind-uua
    label: UUA (urgent)
    decode: Urgent pilot report. Severe icing / turbulence / hail / shear / volcanic ash / tornadoes / waterspouts.
    references:
      - source: AIM
        detail: 7-1-21 urgent report criteria
    examples: [pirep-uua-grr-icing, pirep-uua-den-turb, pirep-uua-ord-sev-icing]
  - slug: location-bare-station
    label: Bare station ICAO
    decode: /OV STATION - report at the station itself.
    references:
      - source: AIM
        detail: 7-1-21 position encoding
    examples: [pirep-ua-cruise, pirep-ua-msp-trc-icing, pirep-ua-jfk-cruise]
  - slug: location-radial-distance
    label: Station + radial + distance
    decode: /OV STA + 3-digit radial + 2-3 digit distance NM. Position relative to a known fix.
    references:
      - source: AIM
        detail: 7-1-21 position encoding
    examples: [pirep-ua-ord-radial, pirep-ua-sfo-wind, pirep-uua-den-turb]
  - slug: location-icao-radial
    label: 4-letter ICAO + radial + distance
    decode: /OV KSTA + radial + distance. Less common; Canadian / European cross-border reports.
    references:
      - source: AIM
        detail: 7-1-21 position encoding
    examples: [pirep-loc-icao-radial, pirep-loc-kbos, pirep-loc-kyyz]
  - slug: time-hhmm
    label: HHMM (Z)
    decode: Four-digit UTC time. No Z suffix in the encoded form.
    references:
      - source: AIM
        detail: 7-1-21 time encoding
    examples: [pirep-ua-cruise, pirep-ua-mia-sky, pirep-ua-sfo-wind]
  - slug: altitude-fl
    label: Altitude (FL or DURC/DURD)
    decode: FLnnn in hundreds of feet. DURC = during climb; DURD = during descent (vertical slice).
    references:
      - source: AIM
        detail: 7-1-21 altitude encoding
    examples: [pirep-ua-cruise, pirep-ua-jfk-cruise, pirep-uua-ord-sev-icing]
  - slug: aircraft-type
    label: Aircraft type
    decode: 4-letter ICAO aircraft code. Type matters because turbulence / icing severity is relative to airframe.
    references:
      - source: AIM
        detail: 7-1-21 aircraft type
    examples: [pirep-ua-cruise, pirep-ua-jfk-cruise, pirep-uua-den-turb]
  - slug: sky-single-layer
    label: Sky single layer
    decode: One cover + base-top pair. /SK BKN090 = broken at 9,000 ft, no top reported.
    references:
      - source: AIM
        detail: 7-1-21 sky cover encoding
    examples: [pirep-ua-mia-sky-single, pirep-ua-cruise, pirep-ua-cle-sct]
  - slug: sky-multi-layer
    label: Sky multi-layer with tops
    decode: Multiple cover + base-top pairs. /SK SCT040-060 BKN090 = scattered 4,000-6,000, broken 9,000 base.
    references:
      - source: AIM
        detail: 7-1-21 multi-layer + tops
    examples: [pirep-ua-mia-sky, pirep-ua-ord-tops, pirep-ua-ord-radial]
  - slug: temp-ta
    label: Temperature (Celsius)
    decode: /TA + integer C. M (or -) prefix for negative. /TA M02 = -2 C.
    references:
      - source: AIM
        detail: 7-1-21 TA group
    examples: [pirep-ua-ord-radial, pirep-uua-grr-icing, pirep-ua-msp-trc-icing]
  - slug: wind-wv
    label: Wind (direction + speed)
    decode: /WV 3-digit dir + 2-3 digit speed + optional KT. Direction is degrees true.
    references:
      - source: AIM
        detail: 7-1-21 WV group
    examples: [pirep-ua-sfo-wind, pirep-uua-den-shear, pirep-ua-ord-jet]
  - slug: turb-light
    label: Turbulence - LGT
    decode: Light turbulence. Brief erratic changes in altitude / attitude / less than 1/3 G excursions.
    references:
      - source: AIM
        detail: 7-1-23 LGT
    examples: [pirep-ua-jfk-cruise, pirep-ua-cruise-mod, pirep-ua-light-chop]
  - slug: turb-mod
    label: Turbulence - MOD
    decode: Moderate turbulence. Loose objects rattle; 1/3 to 1 G excursions; difficulty walking.
    references:
      - source: AIM
        detail: 7-1-23 MOD
    examples: [pirep-ua-ord-radial, pirep-ua-cruise-mod, pirep-ua-jet-mod]
  - slug: turb-sev
    label: Turbulence - SEV (UUA)
    decode: Severe turbulence. Aircraft thrown violently about; momentary loss of control; > 1 G excursions. UUA.
    references:
      - source: AIM
        detail: 7-1-23 SEV
    examples: [pirep-uua-den-turb, pirep-uua-ord-sev-turb, pirep-uua-den-shear]
  - slug: turb-extm
    label: Turbulence - EXTM (UUA)
    decode: Extreme turbulence. Aircraft practically impossible to control; structural damage likely. UUA.
    references:
      - source: AIM
        detail: 7-1-23 EXTM
    examples: [pirep-uua-ase-extm, pirep-uua-den-rockies-extm, pirep-uua-asp-mtn]
  - slug: icing-trc
    label: Icing - TRC (trace)
    decode: Trace icing. Ice perceptible; rate of accumulation slightly greater than sublimation. Not hazardous unless prolonged.
    references:
      - source: AIM
        detail: 7-1-22 TRC
    examples: [pirep-ua-msp-trc-icing, pirep-ua-ord-trc-rime, pirep-ua-clt-trc]
  - slug: icing-lgt
    label: Icing - LGT
    decode: Light icing. May create problem if flight in icing prolonged > 1 hr; pilot can manage with deicing / heat / altitude change.
    references:
      - source: AIM
        detail: 7-1-22 LGT
    examples: [pirep-ua-grr-light, pirep-ua-ord-light-mx, pirep-ua-clt-light]
  - slug: icing-mod
    label: Icing - MOD
    decode: Moderate icing. Encounters become potentially hazardous; even short encounters need course / altitude change.
    references:
      - source: AIM
        detail: 7-1-22 MOD
    examples: [pirep-uua-grr-icing, pirep-uua-grr-mx, pirep-uua-clt-mod]
  - slug: icing-sev
    label: Icing - SEV (UUA)
    decode: Severe icing. Deicing / anti-icing fails to control; immediate diversion is necessary. UUA.
    references:
      - source: AIM
        detail: 7-1-22 SEV
    examples: [pirep-uua-ord-sev-icing, pirep-uua-mke-sev-icing, pirep-uua-cle-sev-icing]
  - slug: icing-type
    label: Icing type (RIME / CLR / MX)
    decode: RIME = white opaque (small droplets, slow accretion). CLR = clear (large droplets, fast). MX = mixed.
    references:
      - source: AIM
        detail: 7-1-22 icing type
    examples: [pirep-ua-msp-trc-icing, pirep-ua-ord-light-mx, pirep-uua-ord-sev-icing]
examples:
  - slug: pirep-ua-cruise
    raw: 'KORD UA /OV ORD /TM 1745 /FL080 /TP C172 /SK BKN050'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, sky-single-layer]
    synoptic: GA aircraft west of ORD reporting broken cumulus base 5,000 ft.
    triage_drivers: [sky cover, altitude vs ceiling, time]
  - slug: pirep-ua-sfo-wind
    raw: 'KSFO UA /OV SFO180015 /TM 2200 /FL050 /TP B738 /WV 27045KT /TA 02'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, wind-wv]
    synoptic: 737 south of SFO at 5,000 ft; westerly 45-kt wind verifying the FB forecast.
    triage_drivers: [wind direction, wind speed, temp]
  - slug: pirep-ua-mia-sky
    raw: 'KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK SCT040-060 BKN090'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-multi-layer]
    synoptic: C402 west of MIA reporting scattered cumulus tops at 6,000 with broken layer above.
    triage_drivers: [tops, ceiling, route]
  - slug: pirep-uua-grr-icing
    raw: 'KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD RIME 050-070'
    token_families: [kind-uua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-mod, icing-type]
    synoptic: PA-28 in moderate rime ice between 5,000 and 7,000 ft west of Lake Michigan.
    triage_drivers: [icing intensity, icing band, temp]
  - slug: pirep-uua-den-turb
    raw: 'KDEN UUA /OV DEN180030 /TM 2030 /FL220 /TP CRJ7 /TB SEV 200-240'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, turb-sev]
    synoptic: CRJ-700 south of Denver in severe turbulence between FL200 and FL240.
    triage_drivers: [turbulence intensity, altitude band, route]
  - slug: pirep-uua-ord-sev-icing
    raw: 'KORD UUA /OV ORD180040 /TM 1820 /FL090 /TP B738 /TA M08 /IC SEV CLR 080-100'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-sev, icing-type]
    synoptic: 737 south of ORD with severe clear ice 8,000-10,000 ft; deep supercooled drizzle layer.
    triage_drivers: [icing intensity, type (clear), altitude band]
  - slug: pirep-loc-icao-radial
    raw: 'KCLE UA /OV CLE090030 /TM 1745 /FL080 /TP C172'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type]
    synoptic: GA aircraft east of CLE; minimal block coverage (no weather group).
    triage_drivers: [position, altitude, type]
  - slug: pirep-loc-kbos
    raw: 'KBOS UA /OV BOS240020 /TM 1500 /FL060 /TP PA28 /SK BKN050'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-single-layer]
    synoptic: PA-28 southwest of BOS at 6,000; broken stratus base 5,000.
    triage_drivers: [ceiling, altitude vs ceiling, route]
  - slug: pirep-loc-kyyz
    raw: 'KYYZ UA /OV YYZ090040 /TM 1600 /FL090 /TP CRJ2 /SK OVC080'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-single-layer]
    synoptic: CRJ east of Toronto Pearson; overcast base 8,000 with cruise at 9,000.
    triage_drivers: [ceiling, route, IFR planning]
  - slug: pirep-ua-msp-trc-icing
    raw: 'KMSP UA /OV MSP /TM 1600 /FL070 /TP C172 /IC TRC RIME 060-080'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, icing-trc, icing-type]
    synoptic: C172 at MSP reporting trace rime ice 6,000-8,000; non-known-ice airframe at decision point.
    triage_drivers: [icing intensity, type, decision point]
  - slug: pirep-ua-jfk-cruise
    raw: 'KJFK UA /OV JFK /TM 1500 /FL340 /TP A320 /TB LGT'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, turb-light]
    synoptic: A320 at FL340 over JFK reporting light turbulence; informational only.
    triage_drivers: [turbulence intensity, altitude, route]
  - slug: pirep-ua-cruise-mod
    raw: 'KORD UA /OV ORD /TM 1900 /FL350 /TP B752 /TB MOD 300-360 /RM CONTINUOUS LIGHT CHOP'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, turb-mod]
    synoptic: 757 at FL350 over ORD reporting moderate turbulence with continuous light chop in remarks.
    triage_drivers: [turbulence intensity, altitude band, remarks]
  - slug: pirep-ua-ord-radial
    raw: 'KORD UA /OV ORD090020 /TM 1745 /FL080 /TP C172 /SK BKN050-080 /TA M02 /TB MOD'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-multi-layer, temp-ta, turb-mod]
    synoptic: 172 east of ORD; tops 8,000 in moderate turbulence with -2 C.
    triage_drivers: [turbulence, tops, temp]
  - slug: pirep-ua-ord-tops
    raw: 'KORD UA /OV ORD180020 /TM 1900 /FL050 /TP B738 /SK OVC020-050'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-multi-layer]
    synoptic: 737 climbing through OVC020 with tops at 5,000 ft south of ORD.
    triage_drivers: [tops, ceiling, climb planning]
  - slug: pirep-ua-cle-sct
    raw: 'KCLE UA /OV CLE060015 /TM 1530 /FL050 /TP PA28 /SK SCT035'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-single-layer]
    synoptic: PA-28 east of CLE; scattered base 3,500 ft, VFR-friendly cumulus.
    triage_drivers: [sky cover, altitude, route]
  - slug: pirep-ua-mia-sky-single
    raw: 'KMIA UA /OV MIA270030 /TM 1600 /FL090 /TP C402 /SK BKN090'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, sky-single-layer]
    synoptic: C402 west of MIA at 9,000 ft; single broken layer at cruise altitude.
    triage_drivers: [sky cover, altitude vs ceiling, route]
  - slug: pirep-ua-ord-jet
    raw: 'KORD UA /OV ORD060015 /TM 1700 /FL340 /TP A320 /WV 28085KT /TA M58'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, wind-wv, temp-ta]
    synoptic: A320 at FL340 east of ORD with 85-kt jet-stream wind; FB verification report.
    triage_drivers: [wind speed, altitude, temp]
  - slug: pirep-uua-den-shear
    raw: 'KDEN UUA /OV DEN240020 /TM 1900 /FL150 /TP C525 /TA M15 /WV 24065KT /TB SEV 120-160'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, wind-wv, turb-sev]
    synoptic: Citation in mountain-wave severe turbulence west of Denver; 65-kt cross-mountain wind at FL150.
    triage_drivers: [turbulence, wind shear, mountain wave]
  - slug: pirep-uua-ord-sev-turb
    raw: 'KORD UUA /OV ORD120015 /TM 2200 /FL310 /TP B738 /TB SEV 290-330'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, turb-sev]
    synoptic: 737 at FL310 east of ORD in severe turbulence; jet-stream upper-trough signature.
    triage_drivers: [turbulence, altitude band, route]
  - slug: pirep-uua-ase-extm
    raw: 'KASE UUA /OV ASE240010 /TM 1830 /FL170 /TP C525 /TA M20 /TB EXTM 150-200'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, turb-extm]
    synoptic: Citation in extreme turbulence in Aspen mountain wave; structural-damage territory.
    triage_drivers: [turbulence (EXTM), mountain wave, altitude band]
  - slug: pirep-uua-den-rockies-extm
    raw: 'KDEN UUA /OV DEN270040 /TM 1845 /FL200 /TP B752 /TB EXTM 180-220'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, turb-extm]
    synoptic: 757 in extreme turbulence west of Denver; deep lee wave signature.
    triage_drivers: [turbulence, mountain wave, altitude band]
  - slug: pirep-uua-asp-mtn
    raw: 'KASE UUA /OV ASE020012 /TM 2000 /FL160 /TP CRJ2 /TB EXTM 140-180'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, turb-extm]
    synoptic: CRJ east of Aspen in extreme rotor turbulence; downstream of mountain crest.
    triage_drivers: [turbulence, rotor, altitude band]
  - slug: pirep-ua-light-chop
    raw: 'KORD UA /OV ORD /TM 1900 /FL360 /TP B752 /TB LGT'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, turb-light]
    synoptic: 757 reporting persistent light chop at FL360 over ORD.
    triage_drivers: [turbulence, altitude, route]
  - slug: pirep-ua-jet-mod
    raw: 'KDEN UA /OV DEN /TM 2100 /FL330 /TP B738 /TB MOD'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, turb-mod]
    synoptic: 737 at FL330 over Denver reporting moderate turbulence in jet-stream area.
    triage_drivers: [turbulence, altitude, route]
  - slug: pirep-ua-ord-trc-rime
    raw: 'KORD UA /OV ORD180010 /TM 1730 /FL060 /TP C402 /TA M02 /IC TRC RIME 040-080'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-trc, icing-type]
    synoptic: C402 south of ORD with trace rime ice 4,000-8,000; non-known-ice airframe.
    triage_drivers: [icing, temp, altitude band]
  - slug: pirep-ua-clt-trc
    raw: 'KCLT UA /OV CLT /TM 1800 /FL080 /TP PA28 /TA M03 /IC TRC RIME 070-090'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-trc, icing-type]
    synoptic: PA-28 over CLT with trace rime in cool-side overrunning warm air.
    triage_drivers: [icing, temp, altitude]
  - slug: pirep-ua-grr-light
    raw: 'KGRR UA /OV GRR /TM 1600 /FL050 /TP PA28 /IC LGT RIME 050-080'
    token_families: [kind-ua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, icing-lgt, icing-type]
    synoptic: PA-28 over Grand Rapids with light rime ice 5,000-8,000.
    triage_drivers: [icing intensity, altitude band, type]
  - slug: pirep-ua-ord-light-mx
    raw: 'KORD UA /OV ORD180010 /TM 1730 /FL060 /TP C402 /TA M02 /IC LGT MX 040-080'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-lgt, icing-type]
    synoptic: C402 south of ORD with light mixed ice 4,000-8,000; supercooled liquid + ice crystals.
    triage_drivers: [icing intensity, type (mixed), altitude]
  - slug: pirep-ua-clt-light
    raw: 'KCLT UA /OV CLT060015 /TM 1900 /FL060 /TP PA28 /IC LGT RIME 060-080'
    token_families: [kind-ua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, icing-lgt, icing-type]
    synoptic: PA-28 east of CLT in light rime icing band.
    triage_drivers: [icing intensity, altitude, type]
  - slug: pirep-uua-grr-mx
    raw: 'KGRR UUA /OV GRR /TM 1530 /FL060 /TP PA28 /TA M04 /IC MOD MX 050-070'
    token_families: [kind-uua, location-bare-station, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-mod, icing-type]
    synoptic: PA-28 with moderate mixed ice 5,000-7,000; forced descent for non-known-ice airframe.
    triage_drivers: [icing intensity, type, altitude band]
  - slug: pirep-uua-clt-mod
    raw: 'KCLT UUA /OV CLT270025 /TM 2030 /FL090 /TP PA32 /TA M02 /IC MOD RIME 080-110'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-mod, icing-type]
    synoptic: PA-32 west of CLT in moderate rime icing band overrunning warm air.
    triage_drivers: [icing intensity, altitude, route]
  - slug: pirep-uua-mke-sev-icing
    raw: 'KMKE UUA /OV MKE270015 /TM 1530 /FL060 /TP C402 /TA M06 /IC SEV MX 050-090'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-sev, icing-type]
    synoptic: C402 west of MKE in severe mixed ice 5,000-9,000; lake-effect freezing drizzle layer.
    triage_drivers: [icing severity, mixed, immediate diversion]
  - slug: pirep-uua-cle-sev-icing
    raw: 'KCLE UUA /OV CLE090030 /TM 1700 /FL070 /TP CRJ2 /TA M06 /IC SEV CLR 060-090'
    token_families: [kind-uua, location-radial-distance, time-hhmm, altitude-fl, aircraft-type, temp-ta, icing-sev, icing-type]
    synoptic: CRJ east of CLE with severe clear ice 6,000-9,000; SLD layer over Lake Erie.
    triage_drivers: [icing severity, type (clear), immediate diversion]
```
