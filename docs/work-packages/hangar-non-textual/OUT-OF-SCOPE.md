---
title: 'Out of Scope: Hangar non-textual sources'
product: hangar
feature: hangar-non-textual
type: out-of-scope
status: unread
---

# Out of Scope: Hangar non-textual sources

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                      | Status       | Trigger to revisit                                                                    |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| Instrument approach plates                | Follow-on WP | When user zero picks an airport to seed plates for                                    |
| Airport diagrams                          | Follow-on WP | After plates land (trivial follow-up)                                                 |
| NTSB CSV ingest + tabular preview         | Deferred     | When NTSB accident analysis becomes a learner-facing surface                          |
| AOPA HTML crawl + ingest                  | Deferred     | When the first AOPA-sourced learning content is authored                              |
| OCR on charts                             | Rejected     | Never -- see detail below                                                             |
| Chart overlay / learner-facing rendering  | Follow-on WP | When `apps/spatial/` is created                                                       |
| Georeference reuse / tiling / slippy-map  | Follow-on WP | When `apps/spatial/` is created and needs the georeferenced TIFF                      |
| Automatic edition refresh on 56-day cycle | Deferred     | Post-MVP review of operator workload; same trigger as `wp-hangar-registry` auto-fetch |

## Instrument approach plates

Status: Follow-on WP

What was deferred:
A new source type for instrument approach plates (IAP PDFs). Same `binary-visual` kind as sectional, different locator shape (airport identifier + procedure name). Would register a first plate as the seed.

Why:
Pending user-zero choice of which airport's plates to seed. The shape this WP lands (binary-visual kind, edition tracking, preview-tile pipeline) extends to plates without rewriting; only the locator shape changes. No real authoring use yet because the seed airport hasn't been picked.

Trigger to revisit:
When user zero picks an airport to seed plates for (e.g. KAPA, or whatever airport drives the next set of learning scenarios).

Implementation pattern when triggered:
Mirror the sectional pattern landed by this WP: extend `REFERENCE_SOURCE_TYPES` with `IAP`, add a single-PDF-per-procedure locator shape, reuse `media` + `edition` columns on `hangar.source`, reuse the binary-visual branch in the fetch handler. Single-page PDF preview is simpler than the geotiff-zip pipeline; no archive manifest needed.

References:

- [spec.md "Out of scope"](./spec.md) -- "Instrument approach plates" bullet
- [tasks.md Phase 7](./tasks.md) -- IDEAS.md follow-on note
- [design.md](./design.md) -- binary-visual fetch pipeline

## Airport diagrams

Status: Follow-on WP

What was deferred:
A new source type for airport diagrams (AD PDFs). Same pattern as plates; single-page PDF.

Why:
Trivial once plates land. The shape is identical (binary-visual, single-page PDF, airport-identifier locator). Deferring keeps this WP scoped to sectional and avoids duplicating preview-pipeline work before plates have validated it.

Trigger to revisit:
After plates land. AD ingest is a copy-paste of the plate pattern with one constant change.

Implementation pattern when triggered:
Reuse whatever pattern lands for IAP plates. Add `AIRPORT_DIAGRAM` to `REFERENCE_SOURCE_TYPES`; reuse single-page-PDF preview.

References:

- [spec.md "Out of scope"](./spec.md) -- "Airport diagrams" bullet
- [tasks.md Phase 7](./tasks.md) -- IDEAS.md follow-on note

## NTSB CSV ingest + tabular preview

Status: Deferred

What was deferred:
Wiring the existing `ntsb-current` registry source through a CSV pipeline. Adds a `csv-tabular` preview path, reuses `CsvPreview.svelte` from `wp-hangar-sources-v1`.

Why:
The `ntsb-current` source is already registered but the CSV pipeline is not wired. NTSB accident analysis is not yet a learner-facing surface; there's no consumer for the ingested rows. Scope discipline: build the pipeline when there's a real use, not as speculative infra.

Trigger to revisit:
When NTSB accident analysis becomes a learner-facing surface (e.g. an accident-case-study lens for the study app, or a scenario-prompt feed for the sim app).

Implementation pattern when triggered:
Add `csv-tabular` as a third `SOURCE_KIND` peer to `text` and `binary-visual` in `libs/constants/src/sources.ts`. Mirror the binary-visual fetch branch in `apps/hangar/src/lib/server/jobs.ts`; emit row-level records instead of an archive. Reuse `CsvPreview.svelte` from WP3 for the files browser.

References:

- [spec.md "Out of scope"](./spec.md) -- "NTSB CSV" bullet
- [tasks.md Phase 7](./tasks.md) -- IDEAS.md follow-on note

## AOPA HTML crawl + ingest

Status: Deferred

What was deferred:
A crawl-and-normalise pipeline for AOPA HTML sources (Air Safety Institute articles, regulatory briefings, etc.).

Why:
Different fetch shape from the static-archive pattern landed here. Crawls follow internal links, normalise HTML to markdown, and need de-duplication across re-crawls. No authored learning content depends on AOPA HTML yet, so building the crawler is speculative.

Trigger to revisit:
When the first AOPA-sourced learning content is authored (e.g. an ASI safety brief becomes a citation in a knowledge node).

Implementation pattern when triggered:
New `SOURCE_KIND` (`html-crawl` or similar) with its own fetch sub-handler. Reuse the `media` + `edition` shape on `hangar.source` for crawl-snapshot metadata. Likely needs a `crawled_pages` child table for per-URL state; design at decision time.

References:

- [spec.md "Out of scope"](./spec.md) -- "AOPA HTML" bullet
- [tasks.md Phase 7](./tasks.md) -- IDEAS.md follow-on note

## OCR on charts

Status: Rejected

What was rejected:
Running OCR over raster chart bytes to produce extracted text that would feed the glossary or knowledge graph the way text sources do.

Why:
Charts encode regulatory airspace through symbology, not through words. Any OCR attempt would either produce nothing (no glyphs to find at chart-density) or produce noise (mis-OCR'd labels with no semantic relationship to the regulatory features they sit near). The extraction pipeline stays explicitly skipped for `binary-visual` sources; this is not just deferred but a permanent design boundary. Reconsidering would require a new pedagogy argument plus a credible signal-extraction story, not just an OCR library.

Trigger to revisit:
Never -- see Why above.

References:

- [spec.md "Out of scope"](./spec.md) -- "OCR on charts" bullet
- [spec.md "Why a new source-kind classifier"](./spec.md#why-a-new-source-kind-classifier) -- explains the text vs binary-visual divergence

## Chart overlay / learner-facing rendering

Status: Follow-on WP

What was deferred:
Rendering charts in a learner-facing surface (overlays, decode-the-symbology drills, route plotting on the chart raster).

Why:
This WP is hangar-only. The admin UI only needs the chart visible enough to verify ingest worked (the preview tile satisfies that). Learner-facing chart rendering belongs to `apps/spatial/` per the surface-typed architecture in [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md); building a chart renderer in hangar would either be throwaway or would muddy the surface boundary.

Trigger to revisit:
When `apps/spatial/` is created. The follow-on WP belongs in that app, not in hangar.

Implementation pattern when triggered:
Author the WP in `docs/work-packages/spatial-<feature>/spec.md`. The hangar side already stores the archive + thumbnail + edition metadata; the spatial app reads it from `hangar.source` and the on-disk archive. No hangar-side changes needed.

References:

- [spec.md "Out of scope"](./spec.md) -- "Chart overlay / learner-facing rendering" bullet
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- spatial surface

## Georeference reuse / tiling / slippy-map

Status: Follow-on WP

What was deferred:
Generating slippy-map tiles from the georeferenced TIFF, serving them through a tile endpoint, and consuming them from a Leaflet/MapLibre surface.

Why:
All spatial tiling lives in `apps/spatial/`. Hangar stores the raw archive plus a thumbnail; tiling is downstream. Building tile generation here would either be throwaway when spatial lands or would force spatial to consume tiles from the wrong surface.

Trigger to revisit:
When `apps/spatial/` is created and the first map view needs the georeferenced TIFF as a basemap.

Implementation pattern when triggered:
The archive on disk (`data/sources/sectional/<id>/<edition>/chart.zip`) already contains the georeferenced TIFF. Spatial extracts and tiles it; hangar exposes the archive path via `hangar.source.media`. Follow the spatial app's WP template at the time.

References:

- [spec.md "Out of scope"](./spec.md) -- "Georeference reuse / tiling / slippy-map" bullet
- [spec.md "Why the archive stays on disk verbatim"](./spec.md#why-the-archive-stays-on-disk-verbatim) -- archive-on-disk rationale

## Automatic edition refresh on 56-day cycle

Status: Deferred

What was deferred:
A cron-style auto-fetch that triggers on the FAA 56-day cycle without operator action.

Why:
The registry already knows the cadence; operator-triggered fetch is the MVP boundary. Auto-refresh adds scheduling infrastructure, failure-mode handling (what if the FAA endpoint is down at the scheduled minute?), and notification surface (how does the operator know what changed?). Same trigger boundary as `wp-hangar-registry` for cron-based work.

Trigger to revisit:
Post-MVP review of operator workload. If the operator finds manual refresh cadence painful on a real 56-day cycle, lift the lever; otherwise keep manual.

Implementation pattern when triggered:
Reuse `scripts/scheduled-jobs/` infrastructure. The fetch handler is already operator-callable; the scheduled job calls the same handler. The hard work is the failure-mode UX (job log surfaced to the operator, edition-drift detection on auto-fetch), not the scheduling.

References:

- [spec.md "Out of scope"](./spec.md) -- "Automatic edition refresh" bullet
- [tasks.md Phase 7](./tasks.md) -- "Automatic PR-against-main edition refresh" deferred item
- `wp-hangar-registry` for the same cron-deferred decision
