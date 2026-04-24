---
title: 'Spec: Hangar non-textual sources (sectional chart first)'
product: hangar
feature: hangar-non-textual
type: spec
status: unread
review_status: done
---

# Spec: Hangar non-textual sources

Extends the source pipeline in `wp-hangar-sources-v1` to cover raster/binary-visual source types. Seeds the **Denver VFR Sectional Chart** as the first non-textual source. Adds the minimum plumbing the rest of the non-textual family (plates, airport diagrams, NTSB CSV, AOPA HTML) will grow into: a `binary-visual` source flavour, checksum + FAA-edition metadata on ingest, and a thumbnail generated at fetch time so `/sources/[id]` renders a preview tile without streaming the full chart.

Orchestrator: [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
Locked plan: [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md)
Depends on: [wp-hangar-registry](../hangar-registry/spec.md), [wp-hangar-sources-v1](../hangar-sources-v1/spec.md)

## Scope map

| Doc                                  | Purpose                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| [spec.md](./spec.md)                 | This file: in-scope, out-of-scope, success criteria                    |
| [design.md](./design.md)             | Source-type contract, schema deltas, preview pipeline, route additions |
| [tasks.md](./tasks.md)               | Phased buckets, one PR each where sensible                             |
| [test-plan.md](./test-plan.md)       | Automated + manual gates                                               |
| [user-stories.md](./user-stories.md) | Operator-side stories for seed/register/download                       |

## Why sectional chart first

The user picked sectional. The Denver sectional is the highest-value specific seed for user zero: mountain / high-DA terrain drives most of their relearning scenarios (see `course/L05-Implementation/scenarios/module-2/SCN-hot-high-departure.md` and the A.5 question bank). One concrete chart proves the whole binary-visual pipeline; everything else downstream (Seattle, San Francisco, Chicago) is just additional registry rows.

## First source seeded

### Identity

- `id`: `sectional-denver`
- `type`: `sectional` (new source type, see design.md)
- `title`: `Denver VFR Sectional Chart`
- Region anchor: Denver-Centennial (KAPA) / Rocky Mountain front range
- `format`: `geotiff-zip` (the FAA ships the raster as a ZIP containing a georeferenced TIFF plus sidecars)

### Fetch target

FAA AeroNav publishes VFR sectionals on a 56-day cycle. The canonical download URL lives under the FAA AeroNav digital products page; the binary URL shape is:

```text
https://aeronav.faa.gov/visual/<YYYY-MM-DD>/sectional-files/Denver.zip
```

Where `<YYYY-MM-DD>` is the edition effective date. Editions are listed on the FAA AeroNav index page; the fetcher reads the index to resolve the current edition before download. The registry entry stores the **template URL** and the resolved edition; the fetch job captures the concrete URL that actually ran.

### DB mirror shape

Extends `hangar.source` (from `wp-hangar-registry`) with a new `media` column (jsonb) that holds the non-textual-specific metadata. `locator_shape` on a sectional describes the chart region + edition cadence; `media` captures the resolved edition + thumbnail path. See [design.md §Schema](./design.md#schema-deltas).

### Preview pipeline

Raster binaries (tens to hundreds of MB) cannot stream into `/sources/[id]` on every page load. The fetch job generates a **thumbnail** (<=256 KB JPEG, fixed dimensions) at ingest time, stores it under `data/sources/sectional/<id>/<edition>/thumb.jpg`, and writes its path into `media.thumbnailPath`. The detail page renders the thumbnail; the full chart is accessible via an explicit "Open full chart" link that streams from disk.

See [design.md §Preview pipeline](./design.md#preview-pipeline).

### Verification

Every ingest captures:

- `sha256` of the downloaded archive
- `sizeBytes` of the archive
- FAA edition effective date (from the index page + cross-checked with the archive manifest, when present)
- FAA edition number (e.g. `116`)
- Archive manifest entries (list of files inside the ZIP, recorded once so drift can be detected on re-fetch)

Drift detection on subsequent fetches: if the resolved edition date hasn't advanced but the archive sha256 differs from the committed `meta.json`, the fetch fails with `edition-drift` and surfaces both checksums. Operator decides whether to accept the new bytes as a correction to the current edition or investigate.

## In scope

### New source type: `sectional`

- Extend `REFERENCE_SOURCE_TYPES` in `libs/constants/src/reference-tags.ts` with `SECTIONAL: 'sectional'`.
- Add `SOURCE_TYPE_LABELS[SECTIONAL] = 'VFR Sectional'`.
- Extend `Source['format']` union with `'geotiff-zip'`.
- Add a `source-kind` classifier: `text` vs `binary-visual`. Drives preview pipeline routing + which job handlers run at ingest.

### Registry entry

- `libs/db/seed/sources.toml` gains one row: `sectional-denver`.
- Authored through the hangar UI, not hand-edited. The new-source form (shipped in `wp-hangar-registry` for the text case) gains a source-type-aware "non-textual details" panel: edition URL template, region label, expected file layout.
- Initial state: `PENDING_DOWNLOAD` until the first fetch completes (same sentinel as other sources).

### Schema delta

- Add `media jsonb` column to `hangar.source` (nullable; only populated for binary-visual types).
- Add `edition jsonb` column to `hangar.source` (nullable; captures effective-date + edition-number + resolved-url-at-fetch-time).

Both additive. Drizzle migration lives under `libs/db/migrations/`.

### Fetch handler extension

The `fetch` job handler from `wp-hangar-sources-v1` already shells out to `bun run references download --id <source-id>`. The `references` dispatcher gains awareness of `source-kind: binary-visual` and runs the chart-specific post-fetch steps:

1. Resolve current edition from the FAA AeroNav index page.
2. Download the archive to `data/sources/sectional/<id>/<edition>/chart.zip`.
3. Compute sha256 + size; write `meta.json` sidecar.
4. Extract archive manifest (list of entries + their sizes, not the bytes).
5. Generate thumbnail (see below).
6. Update `hangar.source.media` + `hangar.source.edition` + `hangar.source.checksum` + `hangar.source.downloaded_at`.

### Thumbnail generation

- New helper `libs/aviation/src/sources/thumbnail.ts`. Exports `generateSectionalThumbnail(archivePath, outPath) -> Promise<ThumbnailMeta>`.
- Implementation: shell out to a local raster tool (`gdal_translate` + `gdalwarp` if present, else `sips` on macOS for a fallback preview). The choice is detected at runtime; missing tools surface a clear error, not a silent placeholder.
- Output: 512x384 JPEG, quality 70, <=256 KB. Fixed dimensions so the detail page reserves layout space.
- Thumbnail lives under `data/sources/sectional/<id>/<edition>/thumb.jpg`. Committed `meta.json` records its path + sha256.

Dependency note: the host must have at least one of `gdal_translate` or `sips` on PATH. Setup docs updated accordingly (see tasks.md Phase 5).

### Source detail page: preview tile

- `/sources/[id]` gains a preview tile block when `media.thumbnailPath` is set.
- Layout: thumbnail (image) + metadata stack (edition date, edition number, archive size, sha256 short, downloaded-at). Click the thumbnail -> "Open full chart" action streams the archive from disk (content-disposition: attachment).
- Theme tokens only: `--surface-raised` for the tile background, `--edge-subtle` for the border, `--ink-2` for metadata labels, `--ink-1` for values. No hex anywhere.
- Alt-text on the thumbnail describes the edition + region (screen-reader friendly; not a silent image).

### Files browser extension

- `/sources/[id]/files` already lists files under `data/sources/<type>/`. For sectional, the browser renders the archive's outer directory (`<id>/<edition>/`) with three entries: `chart.zip`, `thumb.jpg`, `meta.json`.
- Per-extension preview dispatcher (from `wp-hangar-sources-v1` design) gains `zip` and `geotiff` handlers:
  - `zip`: lists archive manifest (entries + sizes) without extracting
  - `geotiff` and `tif`: "no inline preview available" + link to the generated thumbnail
  - `jpg`: inline `<img>` with theme-compliant frame

### Edition refresh flow

- Click `Fetch` on `sectional-denver` during a new 56-day cycle:
  - Index probe resolves a new edition.
  - Downloads the new archive to `data/sources/sectional/<id>/<new-edition>/chart.zip`.
  - Previous edition directory stays on disk (archived automatically; retention policy reuses `SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION` from `wp-hangar-sources-v1`, default 3).
  - Regenerates the thumbnail for the new edition.
  - Updates `hangar.source.edition` + `checksum`; marks row dirty; operator syncs as usual.

### Constants additions

- `SECTIONAL` source type + label (above).
- `SOURCE_KINDS = { TEXT: 'text', BINARY_VISUAL: 'binary-visual' } as const` in `libs/constants/src/sources.ts` (file extended from WP3).
- `AUDIT_TARGETS.HANGAR_SOURCE_SECTIONAL_*` for fetch / edition-refresh / thumbnail-regen.
- `SECTIONAL_THUMBNAIL` dimensions + JPEG quality + max bytes constants.

### Theme compliance

Same bar as WP2 + WP3. Every new component uses role tokens from [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md). Zero hex. Appearance toggle works. WCAG AA contrast holds. No FOUC.

## Out of scope

Explicitly out. Each is a **future source type that will extend this WP's shape** without rewriting it.

- **Instrument approach plates** (IAP PDFs). Same `binary-visual` kind, different locator (airport identifier + procedure name). A follow-up WP registers the first plate, pending user-zero choice of which airport's plates to seed.
- **Airport diagrams** (AD PDFs). Same pattern as plates; single-page PDF. Trivial once plates land.
- **NTSB CSV**. Already registered as a source (`ntsb-current`) but the CSV pipeline is not yet wired. Adds a `csv-tabular` preview path, reuses `CsvPreview.svelte` from WP3. Deferred; not part of this WP.
- **AOPA HTML** and similar crawled-HTML sources. Different fetch shape (follow-links + normalise). Deferred.
- **OCR on charts.** Charts are visual; extracting text from raster is out of scope forever (not just deferred). Sectional charts encode regulatory airspace through symbology, not through words; any OCR pretence would produce noise. The extraction pipeline stays skipped for `binary-visual` sources, full stop.
- **Chart overlay / learner-facing rendering.** The rendering surface for sectionals is `spatial/` when that app exists. This WP is hangar-only; the chart only has to be visible enough in the admin UI to verify ingest worked.
- **Georeference reuse / tiling / slippy-map.** All spatial tiling lives in `spatial/`. Hangar stores the raw archive + a thumbnail; anything else is spatial's job.
- **Automatic edition refresh on the 56-day cycle.** The registry knows the cadence; the fetch is operator-triggered. Cron-based auto-refresh is a post-MVP decision (same as `wp-hangar-registry`).

## Architecture notes

### Why a new `source-kind` classifier

Text sources (CFR XML, PHAK PDF, ACS PDF) run through the extraction pipeline to produce verbatim `*-generated.ts` blocks that feed the glossary. Binary-visual sources skip extraction entirely: there's no prose to capture. Trying to shoehorn "extract verbatim" on a chart would either produce nothing (handler no-ops) or produce garbage (OCR). `source-kind` makes the divergence explicit: the pipeline picks the right post-fetch steps by kind, no per-handler branching.

### Why thumbnails at ingest time

Admin UX. `/sources/[id]` must render quickly. Generating a thumbnail on demand on every page hit would drag the detail page below the "feels instant" bar and would complicate caching. Generating it once at fetch time is cheap (tens of seconds) and makes the detail page a static read from disk + one DB row. The same reasoning applies to plates and airport diagrams when they land.

### Why `media` + `edition` as separate jsonb columns

`media` is a grab-bag per-kind structure (thumbnail path, preview strategy, any rendering hints). `edition` is the version-tracking record that applies to any source with scheduled refreshes (sectionals, plates, ACS revisions, AIM quarterly updates). Keeping them separate avoids cramming everything into one column and makes future queries cleaner ("find all sources whose edition effective-date is older than 56 days").

### Why the archive stays on disk verbatim

Two reasons. One: the full chart is the artifact we actually trust; anything we derive (thumbnail, manifest listing) can be regenerated. Two: `spatial/` will need the georeferenced TIFF eventually, and the zip-on-disk keeps it available without a re-download. Storage cost is measured per chart in the hundreds of MB; trivial.

### Interplay with reference-system scripts

`bun run references download --id sectional-denver` works standalone (operator in a terminal). Hangar's fetch handler wraps it. Binary-visual sources skip the `scan` / `extract` / `build` / `diff` steps; those commands no-op with a clear message ("source kind is binary-visual; extraction does not apply") rather than failing.

### What this WP does not change

- `wp-hangar-registry` edit flow for text sources. New form tab / panel for non-textual details; existing text flow untouched.
- `wp-hangar-sources-v1` flow diagram. Sectional sources appear in the source registry panel with state (`pending download` / `downloaded` / `n/a` for extracted, since extraction does not apply).
- Any study / learner-facing surface.

## Dependencies

- `wp-hangar-registry` merged (schema, TOML codec, job queue, sync service)
- `wp-hangar-sources-v1` merged (fetch handler, upload handler, files browser, preview dispatcher)
- Host has `gdal_translate` or `sips` on PATH (setup docs updated)
- `libs/constants/`, `libs/aviation/`, `libs/db/` extended here

## Open questions

- **Thumbnail generator choice.** Starting with `gdal_translate` preferred, `sips` fallback. Decision deferred: if neither is available in CI, do we commit a pre-rendered thumbnail as the seed-time artifact? Captured; will decide when we wire CI against this WP.
- **Edition resolution strategy.** The FAA AeroNav index page is the canonical edition source; parsing it is a small HTML scrape. Alternative: hardcode the cadence + compute the current edition from today's date. Starting with the scrape because it survives calendar drift; fallback is the computation. Captured for the first implementation review.

## Success criteria

- [ ] `bun run check` clean
- [ ] `REFERENCE_SOURCE_TYPES.SECTIONAL` exists and round-trips through `toml-codec`
- [ ] `hangar.source.media` + `edition` columns live; existing rows unaffected
- [ ] New source form supports authoring a sectional entry (type picker reveals non-textual panel)
- [ ] Fetch on `sectional-denver` downloads a real archive, computes sha256, generates a thumbnail under 256 KB, updates the DB row
- [ ] `/sources/sectional-denver` renders the preview tile with the thumbnail inline
- [ ] `/sources/sectional-denver/files` lists archive + thumb + meta.json with correct per-extension previews
- [ ] Re-fetch during the same edition reports "no change" (sha matches)
- [ ] Re-fetch in a simulated next edition (override the resolver) archives the previous edition dir and ingests the new one
- [ ] Extract / scan / validate / build / diff on a sectional no-op with a clear "not applicable" log line
- [ ] Zero hardcoded colors in any new Svelte `<style>` block
- [ ] Contrast tests pass (WCAG AA) in light + dark
- [ ] Manual walkthrough from [test-plan.md](./test-plan.md) passes end to end
- [ ] PR opened via `gh pr create`; not self-merged
