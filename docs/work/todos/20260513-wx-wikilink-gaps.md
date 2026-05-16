# Weather wiki-link gaps

Captured 2026-05-13 while wiki-linking the weather-comprehensive course (PR `feat/course-wikilinks-audit`). These are terms that appear in section prose with no canonical home in either the knowledge graph (`course/knowledge/weather/`) or the glossary (`libs/help/src/glossary/`). The course prose currently leaves them as plain text because the wiki-link convention forbids inventing a target.

Each gap is an authoring opportunity. Resolving a gap unblocks one or more course steps from "first occurrence sits plain in prose."

## Cloud-cover codes (METAR + plain English)

| Term                                        | Where it shows up                                    | Recommended home    |
| ------------------------------------------- | ---------------------------------------------------- | ------------------- |
| `BKN` / `SCT` / `OVC` / `FEW`               | s11 scenarios METAR plots, briefing intros           | Glossary entry each |
| `broken` / `scattered` / `overcast` / `few` | s1 intro ("4,000 broken"), s7 framing, several s11.x | Glossary entry each |

A single combined glossary entry "METAR cloud cover" with all four codes + plain-English forms also works. Cross-link from `wx-reading-metars-tafs` when authored.

## Flight-condition tiers

| Term   | Where it shows up                                         | Recommended home |
| ------ | --------------------------------------------------------- | ---------------- |
| `VFR`  | s11.2.1 ("VFR everywhere within 200 miles"), s10, s11.6.3 | Glossary entry   |
| `MVFR` | s11.6.3 ("LIFR vs IFR vs MVFR"), s11.5.2                  | Glossary entry   |
| `IFR`  | every s11.x (lake-effect / marine / radiation intro), s10 | Glossary entry   |
| `LIFR` | s11.6 intro + s11.6.3                                     | Glossary entry   |

These are the four flight-rule tiers (FAA usage). A combined entry "Flight-rule tiers" (or four separate entries cross-linked to one another) would resolve all four in one pass.

## METAR field standalones

| Term         | Where it shows up                                                                                                | Recommended home |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| `ceiling`    | s1, s3, s7, s8, s9, s10, s11 (basically every section)                                                           | Glossary entry   |
| `visibility` | when used as the standalone METAR field, not the broader concept covered by `wx-fog-and-visibility-obstructions` | Glossary entry   |

The `wx-fog-and-visibility-obstructions` node covers visibility as a meteorological phenomenon. A glossary entry for "ceiling" as a reported METAR field (cloud base AGL of BKN/OVC layers) would let course prose link both.

## Precipitation abbreviations

| Term   | Where it shows up                           | Recommended home |
| ------ | ------------------------------------------- | ---------------- |
| `TSRA` | s11.2 (Texas convection), s11.2.3           | Glossary entry   |
| `FZRA` | s11.3 (Great Lakes icing)                   | Glossary entry   |
| `SHRA` | could surface in s7 / s11 follow-on lessons | Glossary entry   |
| `FG`   | s11.6 (radiation fog METARs)                | Glossary entry   |
| `BR`   | not yet in course prose -- pre-emptive      | Glossary entry   |

The METAR weather phenomena codes deserve a single combined glossary entry "METAR weather phenomena" cross-linked from `wx-reading-metars-tafs`.

## Synoptic-scale concepts

| Term                   | Where it shows up                                    | Recommended home                                                         |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `outflow boundary`     | s11.2 (intro + s11.2.1 + s11.2.3), s11.5 (loose ref) | Knowledge node OR section under `wx-thunderstorm-hazards`                |
| `subsidence inversion` | s11.5 (marine stratus, multiple sub-steps)           | Knowledge node OR section under `wx-fog-and-visibility-obstructions`     |
| `mixing height`        | s11.6 (radiation fog, multiple sub-steps)            | Knowledge node OR section under `wx-fog-and-visibility-obstructions`     |
| `lapse rate`           | s2.2                                                 | Section under `wx-stability-and-instability`                             |
| `nocturnal inversion`  | s11.6.1, s11.6.3                                     | Section under `wx-fog-and-visibility-obstructions`                       |
| `mountain obscuration` | s8.5, s11.4.3, s11.5.2, s11.6.2                      | Section under `wx-product-airmets-sigmets` (it's a Sierra-family hazard) |

These show up across multiple scenarios with consistent meaning. They're meaty enough to deserve nodes, not glossary entries.

## Equipment / source-specific

| Term                            | Where it shows up      | Recommended home                                     |
| ------------------------------- | ---------------------- | ---------------------------------------------------- |
| `ForeFlight` (as planning tool) | s8.1                   | Distinct from `ForeFlight weather` in-flight display |
| `Garmin Pilot` / `SkyVector`    | s8.1                   | Glossary entries (one per EFB / planning app)        |
| `1800wxbrief`                   | s8.1                   | Glossary entry                                       |
| `FIKI`                          | s11.3 (icing scenario) | Glossary entry                                       |
| `non-FIKI`                      | s11.3                  | Same entry as FIKI                                   |

The line between "flight-planning aggregator" and "in-flight display" is product-specific. `wx-flight-deck-weather-displays` covers the in-flight side; the planning side has no canonical home yet.

## Scenario-named features

These show up in s11 scenarios as named TruthModel features. They're scenario-local (not a general concept) and probably do NOT deserve canonical homes; flagged here for completeness so a future author doesn't try to link them.

- `cP` / `mT` / `cT` / `mP` (air-mass classifications) - could earn a section under `wx-airmasses-and-fronts`, low priority
- `F-cold-main` / `L-upper-midwest` / `H-great-basin` (TruthModel ids) - scenario-local, NOT linkable
- `HZ-lake-effect-zulu` / `HZ-postfrontal-tango` (hazard polygon ids) - scenario-local, NOT linkable

## Closing notes

- Adding glossary entries is the lowest-friction path. One `libs/help/src/glossary/content/<key>.md` + one row in `libs/help/src/glossary/entries.ts` per term.
- Adding sections to existing knowledge nodes is the second-lowest path -- no new node, just a new heading in the node body.
- Adding new knowledge nodes is the heaviest path. Worth it for "outflow boundary," "subsidence inversion," "mixing height" which are concept-meaty.

Once each gap is filled, walk the affected course sections and add the wiki-link in a follow-up commit. The authoring convention (`docs/agents/wiki-links.md`) makes this a mechanical pass.

## Resolution (PR `feat/wx-gaps`, 2026-05-15)

Canonical homes authored. The wiki-link wiring into course section files is NOT done here -- it is the follow-up mechanical pass described above.

### Glossary entries (key in `libs/help/src/glossary/entries.ts`, content in `content/<key>.md`)

| Gap term                                    | Canonical home                        |
| ------------------------------------------- | ------------------------------------- |
| `BKN` / `SCT` / `OVC` / `FEW` + plain forms | Glossary `metar-cloud-cover`          |
| `VFR` / `MVFR` / `IFR` / `LIFR`             | Glossary `flight-rule-tiers`          |
| `ceiling`                                   | Glossary `ceiling`                    |
| `visibility` (METAR field)                  | Glossary `metar-visibility`           |
| `TSRA` / `FZRA` / `SHRA` / `FG` / `BR`      | Glossary `metar-weather-phenomena`    |
| `ForeFlight` (planning tool)                | Glossary `foreflight`                 |
| `Garmin Pilot`                              | Glossary `garmin-pilot`               |
| `SkyVector`                                 | Glossary `skyvector`                  |
| `1800wxbrief`                               | Glossary `flight-service-1800wxbrief` |
| `FIKI` / `non-FIKI`                         | Glossary `fiki`                       |

### Sections added to existing knowledge nodes

| Gap term               | Canonical home                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| `lapse rate`           | `wx-stability-and-instability` -- new "Lapse rate" section                |
| `nocturnal inversion`  | `wx-fog-and-visibility-obstructions` -- new "Nocturnal inversion" section |
| `mountain obscuration` | `wx-product-airmets` -- new "Mountain obscuration" section                |

### New knowledge nodes

| Gap term               | Canonical home                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `outflow boundary`     | New node `wx-outflow-boundary` (`course/knowledge/weather/outflow-boundary/`)         |
| `subsidence inversion` | New node `wx-subsidence-inversion` (`course/knowledge/weather/subsidence-inversion/`) |
| `mixing height`        | New node `wx-mixing-height` (`course/knowledge/weather/mixing-height/`)               |

### Not resolved (intentionally -- scenario-local, NOT linkable)

The "Scenario-named features" section terms (`cP` / `mT` / `cT` / `mP`, the `F-` / `L-` / `H-` TruthModel ids, the `HZ-` hazard polygon ids) keep no canonical home. They are scenario-local and were flagged in this todo precisely so a future author does not try to link them.
