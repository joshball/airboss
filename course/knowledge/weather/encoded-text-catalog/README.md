# Encoded-text coverage catalog

A browsable, categorized reference of every realistic shape you can encounter in the five canonical encoded-text products pilots read every flight:

- [METAR](metar.md) - Aviation Routine Weather Report
- [TAF](taf.md) - Terminal Aerodrome Forecast
- [PIREP](pirep.md) - Pilot Report
- [FB](fb.md) - Winds and Temperatures Aloft Forecast
- [AIRMET / SIGMET / Convective SIGMET](airmet-sigmet.md) - In-flight weather advisories

The corresponding teaching nodes (start there if you've never seen one of these products) live one level up:

- [reading-metars](../reading-metars/node.md) - the canonical encoded-text node
- [reading-tafs](../reading-tafs/node.md)
- [product-pireps](../product-pireps/node.md)
- [product-winds-aloft](../product-winds-aloft/node.md)
- [product-airmets](../product-airmets/node.md), [product-sigmets](../product-sigmets/node.md)

## Why this catalog exists

The reading-metars node teaches METAR reading well, but its examples are inline prose. There is no browsable, categorized index of "every realistic METAR shape you can encounter," and no machine-readable manifest tying each shape to:

- The **token family** it exercises (gust group, RVR, +TSRA, VV, CB, AO1/AO2, ...)
- The **synoptic situation** that produces it
- The **reference** (AC 00-45H section, AIM 7-1-29 entry, FMH-1 chapter)
- The **truth-model levers** in [`libs/wx-engine/`](../../../../libs/wx-engine/) that can synthesize it

This catalog is the missing **coverage matrix**. It feeds three downstream surfaces:

1. The reader, as a reference card browsable in the study app.
2. The drill generator, as a coverage checklist ("am I producing every shape?").
3. The wx-engine roadmap, as a gap list (which scenarios add which tokens?).

## How the catalog is structured

Each product file has the same skeleton:

1. **Token families** - each token group in the product gets a heading, a decode rule, references, and at least three real-shape examples.
2. **Composite canonical examples** - full products that exercise multiple families at once. Each carries a one-sentence synoptic story and a list of triage drivers.
3. **A trailing `yaml-catalog` fence** - structured metadata the build script reads. The metadata is the source of truth; the prose around it is authored to match.

### The `yaml-catalog` manifest format

Every product file closes with a single fenced block tagged `yaml-catalog`. The build script ([`tools/catalog-build/bin.ts`](../../../../tools/catalog-build/bin.ts)) parses this block as YAML and merges all five into `catalog.json`. Shape:

```yaml
product: metar | taf | pirep | fb | airmet-sigmet
references_default:
  - source: AC 00-45H
    detail: Chapter 3 - ...
token_families:
  - slug: wind-gust
    label: Gust group
    decode: G suffix + two-digit gust value when peak exceeds the 2-min mean by 10+ KT.
    references:
      - source: AC 00-45H
        detail: Chapter 3, wind gust threshold
    examples: [metar-mdw-gusty, metar-jan-gust, metar-den-gust]
examples:
  - slug: metar-mdw-gusty
    raw: KMDW 121753Z 28019G31KT 240V310 7SM FEW040 SCT080 BKN150 06/M03 A2987
    token_families: [wind-gust, wind-vrb-range, ...]
    synoptic: Midway in post-frontal cold sector...
    triage_drivers: [gust factor, crosswind, altimeter trend]
```

The `raw` field is a plain string for single-line products (METAR / TAF / FB / PIREP) and a multiline YAML scalar (`raw: |`) for AIRMET / SIGMET bulletins. Build script behavior:

1. Reads all five product markdown files.
2. Extracts the trailing `yaml-catalog` block from each.
3. Round-trip-parses every METAR / TAF / PIREP / FB example through the appropriate parser from `@ab/wx-charts`. Any parser warnings fail the build. AIRMET / SIGMET examples skip the round-trip (no parser in v1).
4. Emits `catalog.json` matching the `EncodedTextCatalog` shape consumed by `@ab/wx-explain` and the drill generator.

Run `bun run wx-scenario check-catalog` to validate without writing (the gate wired into `bun run check`). Run `bun tools/catalog-build/bin.ts` to regenerate `catalog.json` after editing any product markdown.

## Discovery-first pedagogy

The catalog is a reference surface, not a teaching surface. Teaching lives in the linked knowledge nodes; the catalog answers "show me what this looks like in the wild" once the learner already knows what they're looking at.

When you read the catalog, the question is never "what does this mean?" - it's "have I seen this shape before, and what does the synoptic situation behind it say?" That's the **understand** + **triage** layer of the encoded-text ladder, not the decode layer.

## The encoded-text family

These five products share the same three-stage skill (decode -> understand -> triage). Reading one of them well transfers to all of them:

- **Decode** - mechanical translation from symbols to facts (`BKN012` = broken layer at 1,200 ft AGL).
- **Understand** - placing the decoded facts into a synoptic picture (what kind of air mass produces this?).
- **Triage** - separating the lines that matter from the lines that don't (which three groups would change the decision if they shifted by one step?).

The ladder is identical across products. The variant space changes - PIREPs have icing severity codes, FBs have the "add 50 to direction" trick, AIRMETs carry validity windows and polygons - but the question is the same: decode every group, place it on the synoptic picture, triage the drivers.

## What's not (yet) in the catalog

- **NOTAMs, ATIS, clearance shorthand** - same encoded-text family but separate catalog entries are deferred to a later phase. They'll land here when the wx-engine grows scenarios that produce them.
- **Truth-model cross-links** (`generatedBy: { scenario, station, observationTime }` on each example, plus a reverse index `coversCatalogExamples` on every scenario bundle) - Phase 3 of [the catalog plan](../../../../docs/work/plans/2026-05-14-metar-taf-coverage-catalog.md).
- **Practice surface** - the `/practice/wx/drill` route that consumes this catalog interactively lives in the [drill plan](../../../../docs/work/plans/2026-05-14-wx-drill-and-practice.md), Phase 2-4.

## References used throughout

The catalog cites a small set of canonical sources on every token family:

- **AC 00-45H** - Aviation Weather Services (FAA Advisory Circular). The canonical format spec for every METAR / TAF / PIREP / FB / AIRMET token group.
- **AIM 7-1-29** - Key to Aerodrome Forecast (TAF) and Aviation Routine Weather Report (METAR). The decode key most pilots open on the ramp.
- **FMH-1** - Federal Meteorological Handbook No. 1. The observer-side manual; cited when a token's semantics live there (RMK conventions, station-type rules, AO1 vs AO2 capabilities).
- **AIM 7-1-21 / 7-1-22 / 7-1-23** - PIREP submission, icing intensity scale, turbulence intensity scale.

Each token family carries its own per-family references; this README lists the corpus once so the per-family blocks stay compact.
