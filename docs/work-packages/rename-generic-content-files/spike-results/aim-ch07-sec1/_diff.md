# AIM chapter 7 / section 1 rename diff

Source: `aim/2026-04/chapter-7/section-1/`
Target: `aim/2026-04/07-safety-of-flight/01-meteorology/`

Chapter title: "Safety of Flight" (from `aim/2026-04/manifest.json` entry `code: '7'`).
Section title: "Meteorology" (from `aim/2026-04/manifest.json` entry `code: '7-1'`).
Chapter slug: `safety-of-flight`. Section slug: `meteorology`.

## Judgment call: AIM directory renaming

The brief's Option D directory rule (`<NN>-<chapter-slug>/`) is written for the handbooks shape. AIM has a deeper hierarchy: `chapter-N/section-M/paragraph-K`. The brief specifies the rename for paragraphs (`paragraph-N.md` -> `NN-<paragraph-slug>.md`) but is silent on the directories. Two consistent options:

1. **Rename both layers** (chosen here). Directories become `NN-<chapter-slug>/` and `NN-<section-slug>/`, the section index becomes `00-<section-slug>.md`.
2. **Keep `chapter-N` / `section-M` directories.** Only files are renamed; section index is `00-<section-slug>.md`.

Option 1 is consistent with the handbooks rename and produces fully self-describing paths. Option 2 keeps the existing `chapter-N` segment, which is already readable but not self-describing. Recommended for the analysis: Option 1, because the directory names are also user-zero-facing in IDE tabs and citations.

## Directory rename

| Before                                                      | After                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `aim/2026-04/chapter-7/`                                    | `aim/2026-04/07-safety-of-flight/`                                   |
| `aim/2026-04/chapter-7/section-1/`                          | `aim/2026-04/07-safety-of-flight/01-meteorology/`                    |

## File renames

| Before                  | After                                                          |
| ----------------------- | -------------------------------------------------------------- |
| `index.md` (section)    | `00-meteorology.md`                                            |
| `paragraph-1.md`        | `01-national-weather-service-aviation-weather-servic.md`       |
| `paragraph-2.md`        | `02-faa-weather-services.md`                                   |
| `paragraph-3.md`        | `03-use-of-aviation-weather-products.md`                       |
| `paragraph-4.md`        | `04-graphical-forecasts-for-aviation-gfa.md`                   |
| `paragraph-5.md`        | `05-preflight-briefing.md`                                     |
| `paragraph-6.md`        | `06-inflight-aviation-weather-advisories.md`                   |
| `paragraph-7.md`        | `07-categorical-outlooks.md`                                   |
| `paragraph-8.md`        | `08-telephone-information-briefing-service-tibs.md`            |
| `paragraph-9.md`        | `09-transcribed-weather-broadcast-tweb-alaska-only.md`         |
| `paragraph-10.md`       | `10-inflight-weather-broadcasts.md`                            |
| `paragraph-11.md`       | `11-flight-information-services-fis.md`                        |
| `paragraph-12.md`       | `12-weather-observing-programs.md`                             |
| `paragraph-13.md`       | `13-weather-radar-services.md`                                 |
| `paragraph-14.md`       | `14-atc-inflight-weather-avoidance-assistance.md`              |
| `paragraph-15.md`       | `15-runway-visual-range-rvr.md`                                |
| `paragraph-16.md`       | `16-reporting-of-cloud-heights.md`                             |
| `paragraph-17.md`       | `17-reporting-prevailing-visibility.md`                        |
| `paragraph-18.md`       | `18-estimating-intensity-of-rain-and-ice-pellets.md`           |
| `paragraph-19.md`       | `19-estimating-intensity-of-snow-or-drizzle-based-on.md`       |
| `paragraph-20.md`       | `20-pilot-weather-reports-pireps.md`                           |
| `paragraph-21.md`       | `21-pireps-relating-to-airframe-icing.md`                      |
| `paragraph-22.md`       | `22-definitions-of-inflight-icing-terms.md`                    |
| `paragraph-23.md`       | `23-pireps-relating-to-turbulence.md`                          |
| `paragraph-24.md`       | `24-wind-shear-pireps.md`                                      |
| `paragraph-25.md`       | `25-clear-air-turbulence-cat-pireps.md`                        |
| `paragraph-26.md`       | `26-microbursts.md`                                            |
| `paragraph-27.md`       | `27-pireps-relating-to-volcanic-ash-activity.md`               |
| `paragraph-28.md`       | `28-thunderstorms.md`                                          |
| `paragraph-29.md`       | `29-thunderstorm-flying.md`                                    |
| `paragraph-30.md`       | `30-key-to-aerodrome-forecast-taf-and-aviation-routi.md`       |
| `paragraph-31.md`       | `31-international-civil-aviation-organization-icao-w.md`       |

## Slug rule applied

Same as `tools/handbook-ingest/ingest/normalize.py:_title_slug`: lowercase, replace non-alphanumeric runs with `-`, strip leading/trailing `-`, truncate to 48 chars. Note the truncation is visible on paragraphs 1, 19, 30, 31.

## Numbering rule

`paragraph-N` -> `NN-` zero-padded. Paragraphs go up to 31 in this section, so 2-digit padding is sufficient. AIM never exceeds 99 paragraphs per section (verified across all 38 AIM sections).

## File count

| Before | After |
| ------ | ----- |
| 32     | 32    |
