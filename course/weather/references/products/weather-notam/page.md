---
id: wx-ref-weather-notam
title: Weather-related NOTAM (NOTAM-D wx)
short_code: NOTAM-D wx
category: tfr-notam
tier: 2
status: draft
authoritative_sources:
  - source: AIM
    section: '5-1-3 -- Notice to Air Missions (NOTAM) System'
    note: 'Authoritative pilot-pitch description of the NOTAM classes (D, FDC, Pointer, Military, International) and how the system is consumed. The reference most pilots actually open when a NOTAM line decodes weird.'
    verified: false
  - source: AIM
    section: '5-1-21 -- Pre-departure briefing -- area surrounding section on weather impacts and airport status'
    note: 'Ties NOTAM-D weather entries to the preflight briefing flow and reinforces that NOTAMs are pulled separately from METAR/TAF.'
    verified: false
  - source: FAA Order 7930.2
    section: 'Notices to Air Missions (NOTAM) -- current edition'
    note: 'Authoritative format manual. Defines the SUBJECT/CONDITION keyword tables, FICON encoding rules, RWYCC scale, and the abbreviations table used in every NOTAM-D line.'
    verified: true
  - source: AC 150/5200-30
    section: 'Airport Winter Safety and Operations -- current change'
    note: 'Defines FICON (Field Condition) reporting that replaces SNOWTAM for US runways. Contains the RWYCC matrix, contaminant taxonomy, and the mapping between contaminant/temperature and braking-action terms.'
    verified: true
  - source: FAA NOTAM Search
    section: 'notams.faa.gov -- public NOTAM distribution system'
    note: 'The authoritative live source. Every weather-related NOTAM you read in an EFB or briefing pack originates here.'
    verified: true
related_knowledge_nodes:
  - wx-product-sigmets
  - wx-fog-and-visibility-obstructions
related_products:
  - weather-tfr
  - metar
  - speci
  - taf
  - airmet
---

# Weather-related NOTAM (NOTAM-D wx)

> A Notice to Air Missions issued when weather has changed the operational status of an airport or facility -- contaminated runways, ice-shut navaids, weather-driven closures -- distributed under the NOTAM-D (Distant) classification.

## What it is

A NOTAM (Notice to Air Missions) is the FAA's mechanism for telling pilots that something on the ground or at a facility has changed in a way that matters for flight planning. The **NOTAM-D** (Distant) class covers airports and navaids on Part 95/97 and is the channel almost every weather-driven status change flows through. Common weather-related NOTAM-D entries include:

- Runway snow or ice contamination, reported in **FICON** (Field Condition) format with a **RWYCC** (Runway Condition Code) for each third of the runway.
- Full or partial airport closures during thunderstorms, low visibility, hurricane preparation, or volcanic ashfall.
- Navaid outages caused by lightning damage, antenna icing, or weather-driven facility evacuation (ILS off the air after a strike, VOR shut for ice on the cone, ATIS unmanned during a tornado warning).
- Service downgrades (tower operating reduced hours due to weather, approach control transferring sectors, fuel unavailable due to a flood).

In US operations, **FICON** has replaced the international **SNOWTAM** format on the domestic NOTAM-D stream. Distribution is via the FAA NOTAM Search system at [notams.faa.gov](https://notams.faa.gov), the Leidos / 1800wxbrief Pilot Briefing, every commercial EFB (ForeFlight, Garmin Pilot, FltPlan), and FIS-B in flight (with caveats on coverage and freshness).

Weather-related NOTAMs are operational reality, not advisory text. A destination shown VFR on the METAR may be NOTAM-closed for snow removal; a precision approach shown on the chart may be NOTAM-out for ice on the localizer antenna. The METAR does not know what's happening on the surface of the runway, and the chart does not know what's happening to the avionics on the ground.

## When you read it

- **Preflight, always, for every airport in the flight plan.** Departure, destination, and every filed or planned alternate. NOTAMs are pulled separately from METAR / TAF; a complete briefing must include them or it is not complete (14 CFR 91.103).
- **The decision they inform.** Whether the runway you planned to use exists for your aircraft today. Whether the approach you planned to fly is in service. Whether the airport is open at all. Whether your alternate is actually a usable alternate. Whether braking action vs aircraft and runway length leaves you adequate stopping margin.
- **What they do NOT replace.** A NOTAM tells you the *status* of the facility; the METAR tells you the *weather* at the facility. A FICON NOTAM saying RWY 28L is 1-inch dry snow with RWYCC 3 does not tell you the visibility is 3 SM in BR -- you need both. NOTAMs do **not** pull from METARs; cross-check each independently.
- **En route, via FIS-B and EFB updates.** New FICON updates roll in as field-condition assessments rerun (typically after the previous one expires or the runway state changes). A late-arriving FICON downgrade is the inbound-leg equivalent of a SPECI METAR -- the surface just changed under you.

## How to read it

A NOTAM-D entry is a structured-but-cryptic line. The fixed format starts with an exclamation-mark header and walks through facility, keyword, condition, and validity. Field-by-field:

| Field             | Example                           | Meaning                                                                                                                  |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Header            | `!ORD 12/045`                     | `!` + Accountability ID (ORD = Chicago O'Hare FSDO area) + serial. The serial format is `MM/NNN` (month / sequence).     |
| Affected facility | `ORD`                             | Three-letter or four-letter facility ID for the airport / navaid the NOTAM applies to.                                   |
| Keyword (SUBJECT) | `RWY`, `AD`, `NAV`, `SVC`, `OBST` | What kind of thing changed. `RWY` runway, `AD` aerodrome (whole field), `NAV` navaid, `SVC` service, `OBST` obstruction. |
| Identifier        | `10L/28R`                         | The specific runway, approach, navaid, or service.                                                                       |
| CONDITION         | `FICON 5/3/3 100PCT 1IN DRY SN`   | What is wrong (or what changed). For weather: FICON line, closure statement, navaid OTS, service downgrade.              |
| Validity          | `1411150900-1411151600`           | UTC start and end. Format: `YYMMDDhhmm`. `PERM` for permanent. `UFN` for "until further notice".                         |
| Modifier          | `EST`                             | `EST` estimated end (subject to revision). `WIE` with immediate effect.                                                  |
| Schedule          | `DLY 0900-1600`                   | Optional recurring schedule (daily window, day-of-week pattern).                                                         |

### FICON / runway condition lines

For runway contamination, the line uses the FICON format defined in AC 150/5200-30 and FAA Order 7930.2. The structure is:

`FICON <RWYCC by third> <% coverage by third> <depth> <contaminant type>`

The **RWYCC** (Runway Condition Code) is a single-digit 0-6 number that maps a contaminant + temperature combination to a deceleration / directional-control prediction. It is reported as three digits separated by slashes, one for each third of the runway in the direction of operation (touchdown / mid / rollout). The scale:

| RWYCC | Braking action term | Surface condition (examples)                                                                    | Operational read                                                                                                     |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 6     | DRY                 | Dry runway. No measurable contamination.                                                        | Normal performance numbers apply.                                                                                    |
| 5     | GOOD                | Wet (less than 1/8 in water), frost, slush <= 1/8 in, or <= 1/8 in dry snow on dry pavement.    | Performance close to dry. Crosswind limits unchanged but apply margin.                                               |
| 4     | GOOD TO MEDIUM      | Compacted snow at -15 C or colder.                                                              | Modest reduction. Crosswind component starts to bite.                                                                |
| 3     | MEDIUM              | Wet ("slippery when wet" surface), > 1/8 in dry snow, slush, or compacted snow warmer than -15. | Noticeable stopping distance increase. Crosswind component reduced. Most operators apply contaminated-runway tables. |
| 2     | MEDIUM TO POOR      | Greater than 1/8 in water, slush, or wet snow on the surface.                                   | Stopping distance significantly increased. Many ops manuals require operational restrictions.                        |
| 1     | POOR                | Ice (not wet).                                                                                  | Stopping distance very long. Many turbine ops manuals prohibit takeoff/landing without additional margin or de-ice.  |
| 0     | NIL                 | Wet ice, water on top of compacted snow, dry snow or wet snow over ice.                         | No braking. Operations prohibited under most operator rules.                                                         |

The CONDITION line additionally reports **percent coverage** (in 25 percent increments: 25, 50, 75, 100) and **depth** of the contaminant for each third. A canonical FICON line reads `FICON 3/3/3 100PCT 1IN DRY SN OBSERVED AT 1430Z`: RWYCC 3 in all three thirds, 100 percent coverage, 1 inch of dry snow, observation timestamped 14:30 Zulu.

The CONDITION line may also carry a **braking-action term** from a pilot report after the FICON: `BA POOR PIREP B737 14:42Z`. Pilot-reported braking action is logged separately and can prompt an updated FICON if it disagrees with the most recent ground assessment.

### Closure and OTS lines

Whole-field weather closures use the AD keyword: `AD AP CLSD WX`. Service / navaid weather outages use `SVC` or `NAV`: `NAV ILS RWY 10L OTS DUE WX`. These are short and load-bearing; treat any AD / NAV / SVC weather line as a hard operational gate until the validity expires.

## Annotated example(s)

### Example 1 -- FICON on a contaminated runway

Raw NOTAM:

```text
!ORD 12/045 ORD RWY 10L/28R FICON 3/3/3 100PCT 1IN DRY SN OBSERVED AT 1430Z BA FAIR. 1411151430-1411152000EST
```

Decoded:

- `!ORD 12/045` -- accountability ORD, December issue 045.
- `ORD` -- O'Hare International, Chicago.
- `RWY 10L/28R` -- runway 10L/28R affected (both directions of the same physical strip).
- `FICON` -- Field Condition report follows.
- `3/3/3` -- RWYCC 3 (MEDIUM, braking action FAIR) in the touchdown third, mid third, and rollout third.
- `100PCT` -- contamination covers 100 percent of the reported portion (the same coverage in each third unless reported otherwise).
- `1IN DRY SN` -- 1 inch of dry snow.
- `OBSERVED AT 1430Z` -- the field-condition assessment was performed at 14:30 Zulu.
- `BA FAIR` -- corresponding braking-action term reported as FAIR (MEDIUM, ties to RWYCC 3).
- `1411151430-1411152000EST` -- valid 14 November 2014 (in the historical example date format) from 14:30Z to 20:00Z, end time estimated.

What this is telling you: O'Hare's 10L/28R has uniform 1-inch dry-snow coverage on a MEDIUM (RWYCC 3) braking-action surface, freshly assessed at the top of the half hour. For a turboprop on a 6,000-ft runway, RWYCC 3 typically increases unfactored landing distance by 30 to 50 percent vs dry; pilots should run the contaminated-runway table in the AFM/POH and confirm landing distance available exceeds the corrected requirement with the crosswind component the surface still supports. The `EST` modifier on the end time means the FICON may be revised earlier or extended if the surface changes.

### Example 2 -- weather-driven airport closure

Raw NOTAM:

```text
!MIA 10/118 MIA AD AP CLSD DUE WX HURRICANE PREPARATION. 1810081200-1810112359EST
```

Decoded:

- `!MIA 10/118` -- accountability MIA, October issue 118.
- `MIA` -- Miami International.
- `AD` -- aerodrome SUBJECT (whole airport).
- `AP CLSD DUE WX HURRICANE PREPARATION` -- airport closed due to weather, with the cause given in plain text (hurricane preparation operations on the field).
- `1810081200-1810112359EST` -- valid 8 October 12:00Z through 11 October 23:59Z, end time estimated.

What this is telling you: Miami is closed for inbound and outbound operations across the entire validity window because the airfield is being secured for an approaching hurricane (aircraft evacuated, jet bridges retracted, equipment relocated, terminal access restricted). VFR weather at the time of departure planning is irrelevant -- the field is administratively shut. Any flight plan filed to MIA in this window must replan to a different destination. Note that the validity end is `EST` (estimated); the actual reopening depends on storm track, post-storm damage assessment, and FAA / airport authority decision -- expect either an extension NOTAM or an early-reopening NOTAM, not a clean expiration.

## Common gotchas

- **RWYCC is per third, not per runway.** `5/3/3` means RWYCC 5 in the touchdown third, 3 in the middle, 3 in the rollout. Take the worst case for your performance calculation, not the first digit.
- **The thirds are in the direction of intended operation.** A FICON published for `10L/28R` reports thirds for the lower-numbered end first; the reverse-direction landing reads them in opposite order. Confirm which end you're using.
- **Braking-action terms changed under FICON.** The old terms (GOOD, FAIR, POOR, NIL) still appear; the FICON system added GOOD TO MEDIUM and MEDIUM TO POOR for finer granularity. FAIR is the legacy term that maps to MEDIUM (RWYCC 3). Treat any "FAIR" you read as "MEDIUM" in your performance calc.
- **SNOWTAM vs FICON.** Internationally (ICAO Annex 15), the format is SNOWTAM. In the US, the equivalent on the domestic NOTAM-D stream is FICON. Reading a SNOWTAM at a Canadian or European alternate uses a different but adjacent encoding -- do not assume the US RWYCC mapping applies one-for-one.
- **NOTAMs do not pull from METARs.** A METAR can report clear and a million while a NOTAM reports the field closed for snow removal. Pull both, cross-check both. Neither is the master.
- **Cryptic abbreviations are the rule, not the exception.** WIP (work in progress), OTS (out of service), AD (aerodrome), AP (airport), RWY (runway), TWY (taxiway), DLY (daily), EST (estimated), UFN (until further notice), WIE (with immediate effect), BA (braking action), CLSD (closed), CTC (contact), AUTH (authorized), AVBL (available), UNAVBL (unavailable). The full abbreviation table lives in AIM 5-1-3 and Pilot/Controller Glossary.
- **The validity window is UTC, not local.** A NOTAM valid `1411151430-1411152000` is in Zulu; the same window in local time at the affected facility depends on the time zone and DST.
- **An `EST` end time is provisional.** A FICON marked `EST` may be cancelled early or extended; do not plan as if it expires on the clock. Recheck before takeoff.
- **A `PERM` NOTAM is not a weather NOTAM.** Permanent NOTAMs eventually get incorporated into the Chart Supplement; if you see `PERM` on something weather-related, suspect a misformat or a long-duration closure being treated as effectively permanent.
- **Pilot-reported braking action overrides nothing automatically.** A pilot PIREP of "braking POOR" on a runway with a FICON of MEDIUM triggers a re-evaluation but does not change the published RWYCC until the airport reruns the field assessment.

## Triage

You have 60 seconds. The NOTAM dump for an airport can be 60 to 200 lines; the weather-relevant subset is usually 5 to 20. Where do your eyes go first?

1. **Filter to weather-relevant SUBJECT keywords.** AD (aerodrome), RWY (runway), NAV (navaid), SVC (service). Skip OBST (obstruction), procedural-only FDC NOTAMs, and pointer NOTAMs unless time allows.
2. **AD AP CLSD first.** Any aerodrome closure -- weather or otherwise -- is a hard gate. If the field is closed for the time window of your operation, every other line is moot.
3. **FICON / RWYCC on the runway you plan to use.** Read each third. Worst-case RWYCC drives the performance number. Confirm contaminant type and depth.
4. **Braking-action terms and pilot reports.** A "BA POOR" PIREP on the field is a leading indicator that the FICON may be downgraded shortly.
5. **NAV / SVC OTS due WX.** Is the ILS in service? The ATIS? The approach control sector? An ILS-out at minimums-weather destination is a hard divert trigger.
6. **Validity windows.** Cross-check every relevant entry against your ETA window. A NOTAM expiring 20 minutes before your arrival is operationally a non-event; one whose `EST` end is 2 hours before arrival is a probable extension.
7. **Cross-check the alternate.** Apply the same scan. The whole point of an alternate is that it's a usable airport when the destination isn't; a contaminated-runway NOTAM at the alternate can dissolve that assumption.

What changes the go/no-go: aerodrome closure during the operation window; FICON RWYCC at or below the operator-permitted minimum for the aircraft; runway-length-plus-RWYCC requiring more runway than available; loss of the approach you needed because of a NAV/SVC OTS; the same set of conditions degrading the alternate. The rest of the NOTAM dump is informational background.

## Related products

- [Weather-related TFR](../weather-tfr/page.md) -- the parallel FDC channel for airspace restrictions tied to weather hazards (hurricanes, wildfire smoke). NOTAM-D weather covers facility status; TFRs cover the surrounding airspace.
- [METAR](../metar/page.md) -- the surface observation that tells you the *weather* at the field. Pair with the NOTAM for facility status.
- [SPECI](../speci/page.md) -- the off-cycle METAR. A late-arriving SPECI plus a late-arriving FICON often arrive together when conditions shift.
- [TAF](../taf/page.md) -- the terminal forecast. A TAF predicting heavy snow at your ETA window plus a current FICON near limit equals a downgrade-coming alert.
- [AIRMET](../airmet/page.md) -- area hazards (icing, IFR, turbulence, mountain obscuration) that frequently drive the surface conditions reported in a FICON.

## Authoritative sources

- **AIM 5-1-3** -- Notice to Air Missions (NOTAM) System. Defines the classes (D, FDC, Pointer, Military, International), distribution, and the pilot-pitch decoding key.
- **AIM 5-1-21 (preflight briefing area)** -- ties NOTAM consumption into the standard preflight briefing flow and reinforces that NOTAMs do not pull from METAR/TAF.
- **FAA Order 7930.2** -- Notices to Air Missions. The format manual: SUBJECT/CONDITION keyword tables, FICON encoding rules, RWYCC scale and contaminant taxonomy, abbreviations table.
- **AC 150/5200-30** -- Airport Winter Safety and Operations. The RWYCC matrix, FICON reporting standards, and the contaminant/temperature/braking-action mapping used by airport operators on the ground.
- **FAA NOTAM Search** -- [notams.faa.gov](https://notams.faa.gov). The live authoritative source. Every weather-related NOTAM you read in any EFB originates from this system.
- **Pilot/Controller Glossary** -- the abbreviation reference for the cryptic short codes used inside CONDITION lines.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of adjacent operational concepts, see:

- [Area-product AIRMETs and SIGMETs](../../../../knowledge/weather/product-airmets-sigmets/node.md) -- the area-hazard products that frequently set up the surface conditions a FICON later reports on.
- [Fog and visibility obstructions](../../../../knowledge/weather/fog-and-visibility-obstructions/node.md) -- the visibility-degradation mechanisms that drive weather-driven facility closures and ATIS / tower service disruptions.
