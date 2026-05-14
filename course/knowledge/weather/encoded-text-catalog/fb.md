# FB catalog

Winds and Temperatures Aloft Forecast (FB). Each example is a real-shape FB bulletin that round-trips through `parseFbGrid` from `@ab/wx-charts` with zero warnings. The teaching node is [product-winds-aloft](../product-winds-aloft/node.md); this catalog is the reference card.

## FB encoding rules

Per AC 00-45H Ch 5 + FMH-1 Ch 6:

- Each per-altitude cell is 4 or 6 characters.
- The first two digits encode wind direction in tens of degrees true (`24` = 240 deg).
- The middle two digits encode wind speed in knots.
- The last two digits (when present) encode temperature in degrees C; sign is implied negative above FL240 (the bulletin header carries "TEMPS NEG ABV 24000").
- **Light and variable** (calm) is encoded `9900` - direction 99 + speed 00.
- **High wind trick:** if wind speed > 99 KT, the FAA adds 50 to the direction digit and subtracts 100 from the speed (`7190` decodes to direction 720-50=210 wait, the encoding is dir+50 and speed-100; e.g. `7190` is direction 21 -> 210 deg, speed encoded as 19 + 100 = 119 KT). Direction beyond 36 (>= 36) means the trick is in play; subtract 50 to recover the real direction.
- 4-char rows omit the temperature (typical at low altitudes within ~2,500 ft AGL).

## Bulletin header

The bulletin opens with a header that names the issuance source (`FB WBC` = Weather Prediction Center bulletin), the model-run timestamp the data is based on, and the validity window with a "FOR USE" range that's narrower than the validity itself.

```text
FB WBC
DATA BASED ON 121200Z
VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000
```

## Altitude columns

The grid header lists the standard FAA altitudes: 3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000 ft MSL. Not every station reports every altitude (stations below 3,000 ft MSL omit the 3000 column; mountain-airport stations may also omit lower columns).

```text
FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
```

## Per-row direction-speed-temperature

### Below 5,000 ft - 4-char (temp omitted)

The 3000 ft column for stations below ~2,500 ft AGL is 4 characters: direction + speed only. Temperature is not forecast (it tracks the surface trend).

```text
BOI 2417   2420+04 2425+00 2531-05 2545-15 2563-25 257139 257950 269161
```

### Standard mid-altitude (6-char)

6-character cells with explicit temperature. Below FL240 the temperature carries an explicit sign (`+04`, `-15`).

```text
ORD 2615   2620+02 2625-03 2630-08 2640-18 2655-28 266040 266248 266059
```

### Above FL240 - sign implied

At FL240 and above the temperature sign is implied negative; the bulletin header carries "TEMPS NEG ABV 24000" so the parser drops the sign character. `266040` at FL300 = direction 260, speed 60 KT, temp -40 C.

```text
JFK 2412   2418+05 2422+00 2428-05 2440-15 2452-26 265441 265450 264461
```

### Light and variable (9900)

When the forecast wind is calm or unrepresentable, the cell encodes `9900` (direction 99 + speed 00). The parser surfaces this as `directionDeg: null, speedKt: 0`.

```text
DEN 9900   9900+04 2710-05 2715-10 2725-22 2740-35 275747 275550 274961
```

### High wind (> 99 KT) - "add 50" trick

When wind speed exceeds 99 KT, FAA encoding adds 50 to the direction digit and subtracts 100 from the speed. Direction values >= 50 in the encoded cell are the tell. The parser handles the math; the pilot needs to recognize the shape to read it on paper.

The MSP example below shows the trick at FL340 (`718950` = direction 71-50=21 -> 210 deg, speed 89+100=189 KT, temp -50) and FL390 (`729060` = direction 72-50=22 -> 220, speed 90+100=190 KT, temp -60).

```text
MSP 3018   3022+02 3030-03 3038-08 3050-18 3070-28 307640 718950 729060
```

## Tropical / low-latitude station

Low-latitude stations (Florida, the Caribbean) typically show light easterlies at low altitudes (trade winds) and progressively stronger westerlies aloft (sub-tropical jet).

```text
MIA 1008   1012+18 1015+14 1018+10 1025+00 1035-15 105030 105540 106555
```

## Composite canonical FB bulletins

### Continental west-to-east profile (BOI single-station)

```text
FB WBC
DATA BASED ON 121200Z
VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
BOI 2417   2420+04 2425+00 2531-05 2545-15 2563-25 257139 257950 269161
```

Westerly flow at every level from the surface to FL390. Speed climbs from 17 KT at 3,000 ft to 91 KT at FL390. Temperature trace shows the standard atmosphere lapse rate. Triage: route winds, fuel planning, cruise altitude selection.

### Frontal regime (multi-station)

```text
FB WBC
DATA BASED ON 121200Z
VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
ORD 2615   2620+02 2625-03 2630-08 2640-18 2655-28 266040 266248 266059
JFK 2412   2418+05 2422+00 2428-05 2440-15 2452-26 265441 265450 264461
MIA 1008   1012+18 1015+14 1018+10 1025+00 1035-15 105030 105540 106555
```

Three stations across the eastern US showing the latitude gradient: NE flow easing south, with stronger jet-stream-related winds at the northern stations. MIA shows light easterlies at low levels (trade winds), strengthening westerlies aloft (sub-tropical jet). Triage: route-aware cruise wind selection.

### Mountain pre-frontal (light + variable at low altitudes)

```text
FB WBC
DATA BASED ON 121200Z
VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
DEN 9900   9900+04 2710-05 2715-10 2725-22 2740-35 275747 275550 274961
```

Denver pre-frontal: light-and-variable at low altitudes (col, light surface flow), westerly aloft sloping with altitude. Triage: vertical wind shear, mountain wave risk, cruise altitude.

### Jet-stream entrance (high-wind encoding)

```text
FB WBC
DATA BASED ON 121200Z
VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
MSP 3018   3022+02 3030-03 3038-08 3050-18 3070-28 307640 718950 729060
```

Twin Cities entering the jet stream. Surface NW flow strengthens with altitude through FL300 (60 KT), then crosses into the >100-KT range at FL340 and FL390 (the "add 50" trick is engaged in the last two cells). Triage: cruise altitude selection, fuel planning, jet-stream entrance turbulence.

## Catalog manifest

The structured metadata below drives the build script. Each FB example is a full bulletin; `parseFbGrid` consumes the whole grid and reports per-station rows.

```yaml-catalog
product: fb
references_default:
  - source: AC 00-45H
    detail: Chapter 5 - Winds and Temperatures Aloft Forecast (FB)
  - source: FMH-1
    detail: Chapter 6 - FB encoding
token_families:
  - slug: header
    label: Bulletin header
    decode: "FB WBC issuance source + 'DATA BASED ON' model run + 'VALID' window + 'FOR USE' range + 'TEMPS NEG ABV 24000' sign-convention banner."
    references:
      - source: AC 00-45H
        detail: Chapter 5 bulletin structure
    examples: [fb-boi-single, fb-multi-station, fb-mountain-pre-frontal]
  - slug: altitude-columns
    label: Altitude columns
    decode: Standard FAA set 3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000 ft MSL. Not every station reports every altitude.
    references:
      - source: AC 00-45H
        detail: Chapter 5 altitude column convention
    examples: [fb-boi-single, fb-multi-station, fb-jet-stream]
  - slug: row-4-char
    label: 4-char row (temp omitted)
    decode: Below ~5,000 ft AGL the 3000 column drops temperature; cell is direction + speed only (4 chars).
    references:
      - source: AC 00-45H
        detail: Chapter 5 low-altitude reporting
    examples: [fb-boi-single, fb-multi-station, fb-mountain-pre-frontal]
  - slug: row-6-char
    label: 6-char row (with temperature)
    decode: Standard cell. Below FL240 temp carries explicit sign (+/-); at FL240 and above sign is implied negative.
    references:
      - source: AC 00-45H
        detail: Chapter 5 standard cell
    examples: [fb-boi-single, fb-multi-station, fb-jet-stream]
  - slug: light-variable
    label: Light and variable (9900)
    decode: Direction 99 + speed 00 = wind cannot be pinned (calm or weakly defined). Parser surfaces directionDeg null, speedKt 0.
    references:
      - source: AC 00-45H
        detail: Chapter 5 light-and-variable convention
    examples: [fb-mountain-pre-frontal]
  - slug: high-wind-trick
    label: High wind (> 99 KT) - add-50 encoding
    decode: When wind speed > 99 KT, FAA adds 50 to direction digit and subtracts 100 from speed. Direction values >= 50 in the encoded cell are the tell.
    references:
      - source: AC 00-45H
        detail: Chapter 5 high-wind encoding
    examples: [fb-boi-single, fb-jet-stream, fb-multi-station]
  - slug: tropical-pattern
    label: Tropical / low-latitude profile
    decode: Light easterlies at low altitudes (trade winds), strengthening westerlies aloft (sub-tropical jet).
    references:
      - source: AC 00-45H
        detail: Chapter 5 typical patterns
    examples: [fb-multi-station]
examples:
  - slug: fb-boi-single
    raw: |
      FB WBC
      DATA BASED ON 121200Z
      VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

      FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
      BOI 2417   2420+04 2425+00 2531-05 2545-15 2563-25 257139 257950 269161
    token_families: [header, altitude-columns, row-4-char, row-6-char, high-wind-trick]
    synoptic: Boise single-station westerly profile in zonal flow; speeds climb to jet-level 90+ KT at FL390.
    triage_drivers: [route winds, cruise altitude, fuel]
  - slug: fb-multi-station
    raw: |
      FB WBC
      DATA BASED ON 121200Z
      VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

      FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
      ORD 2615   2620+02 2625-03 2630-08 2640-18 2655-28 266040 266248 266059
      JFK 2412   2418+05 2422+00 2428-05 2440-15 2452-26 265441 265450 264461
      MIA 1008   1012+18 1015+14 1018+10 1025+00 1035-15 105030 105540 106555
    token_families: [header, altitude-columns, row-4-char, row-6-char, high-wind-trick, tropical-pattern]
    synoptic: Three-station eastern US profile showing the latitude gradient; MIA shows tropical easterlies at low levels.
    triage_drivers: [route-aware winds, cruise altitude, fuel]
  - slug: fb-mountain-pre-frontal
    raw: |
      FB WBC
      DATA BASED ON 121200Z
      VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

      FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
      DEN 9900   9900+04 2710-05 2715-10 2725-22 2740-35 275747 275550 274961
    token_families: [header, altitude-columns, row-4-char, row-6-char, light-variable]
    synoptic: Denver pre-frontal col; light-and-variable at low altitudes, westerly aloft strengthening with altitude.
    triage_drivers: [vertical wind shear, mountain wave, cruise]
  - slug: fb-jet-stream
    raw: |
      FB WBC
      DATA BASED ON 121200Z
      VALID 121800Z  FOR USE 1700-2100Z. TEMPS NEG ABV 24000

      FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
      MSP 3018   3022+02 3030-03 3038-08 3050-18 3070-28 307640 718950 729060
    token_families: [header, altitude-columns, row-4-char, row-6-char, high-wind-trick]
    synoptic: Twin Cities entering the jet stream; FL340 and FL390 cells engage the add-50 high-wind encoding.
    triage_drivers: [jet entrance turbulence, cruise altitude, fuel]
```
