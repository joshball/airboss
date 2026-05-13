---
name: Aviation Weather Products -- reference
status: in-progress
parent: ../README.md
---

# Aviation Weather Products

A reference page for every aviation weather product a pilot reads in a preflight briefing or in flight. Each page is a standalone encyclopedic entry: what the product is, how to read it, annotated examples, common gotchas, citations to the authoritative FAA document.

The pedagogical treatment of each product (Socratic discovery walk, mastery gating, drills) lives in the [knowledge graph](../../../knowledge/weather/) -- search for `product-*` nodes. The reference pages here are the *answer key*: when a scenario, a knowledge node, or a course section name-drops a product, this is where the reader follows the link.

## How to use this reference

- Browse alphabetically below.
- Or jump from any course section / scenario / knowledge node via the inline link to the product slug.
- Each page is self-contained. Read top-to-bottom for first contact; use the "How to read it" table as a cockpit lookup.

## Status legend

- **done** -- full treatment: decode, examples, gotchas, triage, citations.
- **draft** -- full treatment authored, awaiting review.
- **stub** -- page exists with frontmatter and a one-line description; full treatment pending.

## Product catalog

### Surface observations

| Product            | Code  | Page                                | Status |
| ------------------ | ----- | ----------------------------------- | ------ |
| METAR              | METAR | [metar](metar/page.md)              | draft  |
| Special observation| SPECI | [speci](speci/page.md)              | stub   |

### Terminal forecasts

| Product               | Code | Page                  | Status |
| --------------------- | ---- | --------------------- | ------ |
| Terminal Aerodrome Forecast | TAF  | [taf](taf/page.md) | draft  |

### Area products

| Product                       | Code | Page              | Status |
| ----------------------------- | ---- | ----------------- | ------ |
| Graphical Forecasts for Aviation | GFA  | [gfa](gfa/page.md) | draft  |

### Hazard advisories

| Product                        | Code     | Page                                              | Status |
| ------------------------------ | -------- | ------------------------------------------------- | ------ |
| AIRMET                         | WA       | [airmet](airmet/page.md)                          | draft  |
| SIGMET                         | WS       | [sigmet](sigmet/page.md)                          | draft  |
| Convective SIGMET              | WST      | [convective-sigmet](convective-sigmet/page.md)    | draft  |
| Center Weather Advisory        | CWA      | [cwa](cwa/page.md)                                | stub   |
| Graphical AIRMET               | G-AIRMET | [g-airmet](g-airmet/page.md)                      | stub   |
| Volcanic Ash Advisory          | VAA      | [volcanic-ash-advisory](volcanic-ash-advisory/page.md) | stub |
| Tropical Cyclone Advisory      | TCA      | [tropical-cyclone-advisory](tropical-cyclone-advisory/page.md) | stub |

### Pilot reports

| Product     | Code      | Page                | Status |
| ----------- | --------- | ------------------- | ------ |
| Pilot Report| UA / UUA  | [pirep](pirep/page.md) | draft |

### Winds and temperatures

| Product                  | Code | Page                                  | Status |
| ------------------------ | ---- | ------------------------------------- | ------ |
| Winds and Temperatures Aloft Forecast | FB   | [winds-temps-aloft](winds-temps-aloft/page.md) | draft |

### Charts

| Product                       | Code        | Page                                                  | Status |
| ----------------------------- | ----------- | ----------------------------------------------------- | ------ |
| Surface Analysis Chart        | (chart)     | [surface-analysis](surface-analysis/page.md)          | draft  |
| Prog Chart                    | (chart)     | [prog-chart](prog-chart/page.md)                      | draft  |
| Ceiling and Visibility Analysis | CVA       | [ceiling-visibility-analysis](ceiling-visibility-analysis/page.md) | stub |
| Freezing Level Chart          | FZLVL       | [freezing-level](freezing-level/page.md)              | stub   |
| Convective Outlook            | (SPC)       | [convective-outlook](convective-outlook/page.md)      | stub   |
| Significant Weather Prog (High) | SIGWX     | [sigwx-prog](sigwx-prog/page.md)                      | stub   |

### Radar and satellite

| Product       | Code    | Page                              | Status |
| ------------- | ------- | --------------------------------- | ------ |
| Radar Mosaic  | (chart) | [radar-mosaic](radar-mosaic/page.md) | stub |
| Satellite     | (chart) | [satellite](satellite/page.md)    | stub   |

### Icing and turbulence

| Product             | Code         | Page                              | Status |
| ------------------- | ------------ | --------------------------------- | ------ |
| Icing Forecast      | FIP / CIP    | [icing-fip-cip](icing-fip-cip/page.md) | stub |
| Turbulence Forecast | GTG          | [turbulence-gtg](turbulence-gtg/page.md) | stub |

### TFRs and weather NOTAMs

| Product               | Code        | Page                              | Status |
| --------------------- | ----------- | --------------------------------- | ------ |
| Weather-related TFR   | TFR         | [weather-tfr](weather-tfr/page.md) | stub  |
| Weather-related NOTAM | NOTAM-D wx  | [weather-notam](weather-notam/page.md) | stub |

## Authoring

New products: copy `_template.md` to `{slug}/page.md`, fill in the frontmatter, write the body. Update this index.
