---
title: Encoded-text coverage catalog (METAR / TAF / PIREP / FB / AIRMET-SIGMET)
date: 2026-05-14
status: draft
owner: jball
related:
  - 2026-05-14-wx-drill-and-practice.md
  - 2026-05-14-truth-model-v2-temporal.md
  - docs/work-packages/wx-engine/
  - course/knowledge/weather/reading-metars/
  - course/knowledge/weather/reading-tafs/
---

# Encoded-text coverage catalog

## Problem

The [reading-metars](../../../course/knowledge/weather/reading-metars/node.md)
node teaches METAR reading well, but examples are inline prose. There is no
**browsable, categorized catalog** of "every realistic METAR shape you can
encounter," and no machine-readable manifest tying each shape to:

- The token family it exercises (gust group, RVR, +TSRA, VV, CB, AO1/AO2, etc.)
- The synoptic situation that produces it
- The reference (AC 00-45H section, AIM 7-1-29 entry, FMH-1 chapter)
- The truth-model levers in [`libs/wx-engine/`][wxe] that can synthesize it

This catalog is the missing **coverage matrix**. It feeds:

1. The reader as a reference card (browsable on the study app).
2. The drill generator as a coverage checklist (am I producing every shape?).
3. The wx-engine roadmap as a gap list (which scenarios add which tokens?).

[wxe]: ../../../libs/wx-engine/

## Scope

Five products, one catalog file each. Each is course content authored to the
same standard as [reading-metars/node.md][rm], with a companion JSON manifest.

[rm]: ../../../course/knowledge/weather/reading-metars/node.md

```text
course/knowledge/weather/encoded-text-catalog/
  README.md                  Index, philosophy, how the catalog is structured
  metar.md                   METAR token families + canonical examples
  taf.md                     TAF token families + canonical examples
  pirep.md                   PIREP encoded form + variants
  fb.md                      Winds + temperatures aloft (FB) variants
  airmet-sigmet.md           AIRMET / SIGMET / Convective SIGMET shapes
  catalog.json               Machine-readable manifest (all 5 products merged)
```

### Out of scope

- NOTAMs, ATIS, clearance shorthand — same encoded-text family but separate
  catalog entries land later. Captured as named follow-ups in the README.
- Generation logic (lives in the [drill plan](2026-05-14-wx-drill-and-practice.md)).
- Page wiring (lives in the [drill plan](2026-05-14-wx-drill-and-practice.md)).

## METAR catalog structure (template for the others)

Each token family gets a heading + decode + at least three example METARs.
Examples are real-shape (round-trip parseable via
[`parseMetar`](../../../libs/wx-charts/src/wx/metar/parser.ts)) and are
written to also live in `catalog.json` so they're machine-consumable.

```text
## Wind group
### Calm                            00000KT
### Steady direction + speed        23015KT
### Gust                            23015G24KT
### Variable below 6 kt             VRB04KT
### Variable + nnnVnnn              23015KT 180V270
### Combined (rare)                 VRB04KT 180V230

## Visibility
### Above 10 SM                     10SM
### Whole-mile                      7SM
### Fractional                      1 1/2SM, 3/4SM, 1/4SM
### Less-than prefix                M1/4SM
### Above-10 with no plus           10SM (never reports >10)
### RVR                             R04R/2000FT, R04R/M0600FT, R04R/4000VP6000FT

## Weather phenomena
### Intensity prefixes              -, (none), +, VC
### Descriptors                     TS, SH, FZ, BL, DR, MI, BC, PR
### Phenomena                       RA, SN, BR, FG, HZ, FU, DU, SA, GR, PL, DZ, IC, SQ, FC, VA
### Common combos                   -RA BR, +TSRA, FZRA, -SHSN BLSN, VCTS, +TSGR, FZFG, MIFG

## Sky condition
### Clear variants                  SKC, CLR, NSC
### Layer covers                    FEW, SCT, BKN, OVC
### Convective suffix               BKN025CB, BKN040TCU
### Multi-layer                     FEW040 SCT080 BKN150 OVC250
### Obscured / VV                   VV002

## Temperature / dew point
### Both positive                   19/18
### Both negative                   M03/M05
### Cross-zero                      02/M01
### Wide spread                     14/M02
### Narrow spread                   18/17 (mist territory)

## Altimeter
### Standard                        A2992
### Low                             A2978
### High                            A3025

## Modifiers + station type
### AUTO                            AUTO
### COR                             COR
### AO1 vs AO2 (RMK)                AO1, AO2

## RMK token sampler (selective; full RMK is its own deep dive)
### SLPxxx                          SLP168 = 1016.8 mb
### T-group precise temps           T01940183
### Peak wind                       PK WND 23028/1735
### Variable vis                    VIS 1/2V3/4
### Precip onset                    RAB28, SNB47
### Hourly precip total             P0001
### Lightning                       LTG OCNL CG SE
### Station-specific                SLPNO (high-elevation airports)

## CAVOK (international form)        EDDF 121753Z 27010KT CAVOK 18/04 Q1023

## Composite canonical examples
(each one labelled with the token families it exercises)
```

### `catalog.json` shape

```typescript
interface EncodedTextCatalog {
  generatedAt: string;
  products: {
    metar: ProductCatalog;
    taf: ProductCatalog;
    pirep: ProductCatalog;
    fb: ProductCatalog;
    airmetSigmet: ProductCatalog;
  };
}

interface ProductCatalog {
  product: 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet-sigmet';
  tokenFamilies: TokenFamily[];
  examples: CatalogExample[];
}

interface TokenFamily {
  slug: string;                // 'wind-gust'
  label: string;               // 'Wind with gust'
  decode: string;              // markdown decode rule
  references: SourceRef[];     // AC 00-45H section, AIM 7-1-29 entry
  examples: string[];          // example slugs
}

interface CatalogExample {
  slug: string;                // 'metar-gusty-crosswind-kmdw'
  product: 'metar' | ...;
  raw: string;                 // full encoded string
  tokenFamilies: string[];     // ['wind-gust', 'sky-multi-layer', ...]
  synoptic: string;            // 1-line synoptic story
  triageDrivers: string[];     // ['gust-factor', 'crosswind', ...]
  references: SourceRef[];
  /** Optional pointer back to a generating scenario in the wx-engine. */
  generatedBy?: { scenario: string; station: string; observationTime: string };
}
```

Every example carries `tokenFamilies: string[]`. Reverse index (family → list of
examples) is computed at build time and surfaced both in the markdown catalog
and the runtime catalog API.

## TAF catalog (preview)

TAF adds change groups and validity windows that METAR doesn't have. The
catalog organizes around those:

```text
## Header + validity
### Routine                         TAF KDFW 121120Z 1212/1318 ...
### Amended                         TAF AMD KDFW ...
### Corrected                       TAF COR KDFW ...
### Origin time vs validity         issue 1120Z, valid 12/12Z through 13/18Z

## Wind / vis / weather in TAFs
(same families as METAR, with TAF-specific notes — e.g. P6SM for >6 SM)

## Change groups
### FM (from)                       FM131800 24015G25KT ...
### TEMPO                           TEMPO 1218/1222 4SM TSRA
### PROB30 / PROB40                 PROB30 1306/1310 1SM +TSRA
### BECMG                           BECMG 1306/1308 24010KT
### Wind-shear group                WS020/24050KT

## Composite canonical TAFs
- Clean VFR TAF
- TAF with TEMPO thunderstorm window
- TAF with PROB30 IFR window
- TAF with multiple FM groups (frontal passage)
- TAF AMD (issued because prior TAF was wrong)
```

## PIREP catalog (preview)

```text
## Header
### UA (routine) vs UUA (urgent)
### Location, time, altitude
### Aircraft type

## Body
### /SK sky condition
### /TA temp
### /WV wind
### /TB turbulence (LGT, MOD, SEV, EXTRM, CHOP)
### /IC icing (TRACE, LGT, MOD, SEV, MX = mixed)
### /RM remarks
```

## FB catalog (preview)

```text
## Header (issue, valid, station)
## Altitude columns
## Direction-speed-temperature group
### Below 5000 ft (temp omitted)
### Above 24000 ft (encoded as 5xx for negative — the "drop 50" trick)
### Light-and-variable convention (9900)
### Out-of-range high winds (direction encoded by adding 5 — confusing edge)
```

## AIRMET / SIGMET catalog (preview)

```text
## AIRMET family (S — IFR, T — turbulence, Z — icing)
### Polygon (lat/lon vertices)
### Altitude band
### Phenomena description
### Validity period

## SIGMET (non-convective)
### Volcanic ash
### Severe turbulence
### Severe icing
### Low-level wind shear

## Convective SIGMET (WST)
### Area
### Embedded thunderstorms
### Line of thunderstorms
### Outlook
```

## Phases

### Phase 1 — Authoring

- [ ] `catalog/README.md`: index + philosophy + cross-family link to encoded-text ladder
- [ ] `catalog/metar.md`: token families + ≥3 examples each + composite canonicals
- [ ] `catalog/taf.md`
- [ ] `catalog/pirep.md`
- [ ] `catalog/fb.md`
- [ ] `catalog/airmet-sigmet.md`
- [ ] Add catalog links to the `Reveal` and `Connect` sections of [reading-metars][rm] and [reading-tafs](../../../course/knowledge/weather/reading-tafs/node.md)

### Phase 2 — Machine-readable manifest

- [ ] `tools/catalog-build.ts` reads the five markdown files, extracts code-fenced examples + their metadata (token families, synoptic story, references) from a frontmatter-style sidecar block, and writes `course/knowledge/weather/encoded-text-catalog/catalog.json`
- [ ] Round-trip validation: every METAR/TAF example in the catalog must parse cleanly through `parseMetar` / `parseTaf` (no warnings)
- [ ] Validator wired into `bun run check`

### Phase 3 — Cross-link to wx-engine

- [x] For each catalog example that one of the 6 existing scenarios can produce, fill in `generatedBy: { scenario, station, observationTime }` (via `tools/catalog-build/match-scenarios.ts` + sidecar at `course/knowledge/weather/encoded-text-catalog/scenario-matches.json`)
- [x] Reverse index: each scenario's bundle output gains a `coversCatalogExamples: string[]` field (written to `data/wx-scenarios/<slug>/coverage.json` by `bun run wx-scenario build`, sourced from the matcher sidecar)
- [x] Coverage report: `bun run wx-scenario coverage` prints totals + per-scenario contribution + uncovered token families. Also accepts `--format json` for machine-readable output.
- [x] `bun run wx-scenario check-catalog` warns (non-blocking) when scenario bundles are newer than the matcher sidecar

Note: with the current six scenarios + 135 catalog examples, the matcher reports 0 matches at first run. Catalog examples use stations + dates (KORD, day 12) that don't overlap the scenario synoptics (KSTL/KORD/etc., day 19). The cross-link infrastructure is in place; growing the overlap is a content-authoring task for future catalog + scenario work.

## Authoring rules

- Every example is **real-shape and parseable**. No textbook-only / wrong-form
  examples. If we want to teach a malformed METAR (rare), it lives in a clearly
  labeled "malformed examples" section and is flagged in the manifest with
  `parseable: false`.
- Every token family cites AC 00-45H + AIM 7-1-29 minimum. FMH-1 cited when
  the family lives there (RMK conventions, station-type semantics).
- Synoptic-story lines stay one sentence each. The catalog is a reference
  surface, not a teaching surface — teaching lives in the node body.
- No invented stations. Pick real ICAO codes that match the synoptic story
  (KASE for mountain, KFAR for radiation fog, KBUF for lake-effect, KDFW
  for southerly flow, etc.).

## Open questions

- Should airmet-sigmet examples be raw text (FAX form) or the parsed polygon
  JSON shape the AIRMET overlay renderer consumes? Probably both — the raw is
  what a learner reads in a briefing; the parsed is what drives the chart.
  Decision: include both, side by side.
- Catalog examples are static markdown today. When the drill plan lands, the
  catalog page becomes a live filter ("show me every METAR with VV") rather
  than a static document. Confirm at the start of Phase 3.
