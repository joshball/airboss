---
title: 'Design: Hangar non-textual sources'
product: hangar
feature: hangar-non-textual
type: design
status: unread
review_status: done
---

# Design: Hangar non-textual sources

Concrete shape for the `binary-visual` source kind, seeded with `sectional-denver`. Every decision below ports cleanly to plates / airport diagrams / NTSB CSV when those land.

## Source kind classifier

```typescript
// libs/constants/src/sources.ts (extended from WP3)

export const SOURCE_KINDS = {
  TEXT: 'text',
  BINARY_VISUAL: 'binary-visual',
} as const;

export type SourceKind = (typeof SOURCE_KINDS)[keyof typeof SOURCE_KINDS];

export const SOURCE_KIND_BY_TYPE: Record<ReferenceSourceType, SourceKind> = {
  [REFERENCE_SOURCE_TYPES.CFR]: 'text',
  [REFERENCE_SOURCE_TYPES.AIM]: 'text',
  [REFERENCE_SOURCE_TYPES.PCG]: 'text',
  [REFERENCE_SOURCE_TYPES.AC]: 'text',
  [REFERENCE_SOURCE_TYPES.ACS]: 'text',
  [REFERENCE_SOURCE_TYPES.PHAK]: 'text',
  [REFERENCE_SOURCE_TYPES.AFH]: 'text',
  [REFERENCE_SOURCE_TYPES.IFH]: 'text',
  [REFERENCE_SOURCE_TYPES.POH]: 'text',
  [REFERENCE_SOURCE_TYPES.NTSB]: 'text',
  [REFERENCE_SOURCE_TYPES.GAJSC]: 'text',
  [REFERENCE_SOURCE_TYPES.AOPA]: 'text',
  [REFERENCE_SOURCE_TYPES.FAA_SAFETY]: 'text',
  [REFERENCE_SOURCE_TYPES.SOP]: 'text',
  [REFERENCE_SOURCE_TYPES.AUTHORED]: 'text',
  [REFERENCE_SOURCE_TYPES.DERIVED]: 'text',
  [REFERENCE_SOURCE_TYPES.SECTIONAL]: 'binary-visual',
} as const;
```

Callers that currently branch on `source.type` (extractors, validators, preview dispatcher) switch to branching on `SOURCE_KIND_BY_TYPE[source.type]` for anything pipeline-shaped. Type-level identity (what label to show, what locator_shape to expect) still keys off `source.type`.

## Schema deltas

Additive migration against `hangar.source` (introduced in `wp-hangar-registry`).

```typescript
// libs/db/src/schemas/hangar.ts (extended)

export const source = hangarSchema.table('source', {
  // ... existing columns from wp-hangar-registry
  media: jsonb('media').$type<SourceMedia | null>(),
  edition: jsonb('edition').$type<SourceEdition | null>(),
});
```

`SourceMedia` and `SourceEdition` types live in `libs/aviation/src/schema/source.ts`:

```typescript
// libs/aviation/src/schema/source.ts (extended)

export interface SourceMedia {
  /** Relative path under data/sources/<type>/<id>/<edition>/. */
  thumbnailPath: string;
  /** sha256 of the thumbnail file for integrity checks. */
  thumbnailSha256: string;
  /** Bytes. Enforced <= SECTIONAL_THUMBNAIL.MAX_BYTES at generate time. */
  thumbnailSizeBytes: number;
  /** Manifest of files inside the source archive, recorded at ingest. */
  archiveEntries: Array<{ name: string; sizeBytes: number }>;
  /** Tool used to generate the thumbnail (e.g., 'gdal_translate', 'sips'). */
  generator: string;
}

export interface SourceEdition {
  /** ISO-8601 date the edition became effective. */
  effectiveDate: string;
  /** FAA edition number (e.g., 116). May be null for sources without one. */
  editionNumber: number | null;
  /** Concrete URL the fetch actually ran against (after template resolution). */
  resolvedUrl: string;
  /** When this edition was resolved from the upstream index. */
  resolvedAt: string;
}
```

Migration under `libs/db/migrations/NNNN_hangar_source_media_edition.sql`. Two nullable jsonb columns; existing text-source rows stay `null` for both.

## Registry entry shape

Authored row in `libs/db/seed/sources.toml`:

```toml
[[source]]
id = 'sectional-denver'
type = 'sectional'
title = 'Denver VFR Sectional Chart'
version = 'edition-resolved-at-fetch'
format = 'geotiff-zip'
path = 'data/sources/sectional/sectional-denver'
url = 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/Denver.zip'
checksum = 'pending-download'
downloaded_at = 'pending-download'

[source.locator_shape]
kind = 'binary-visual'
region = 'Denver'
cadence_days = 56
index_url = 'https://aeronav.faa.gov/visual/'
```

The `url` field carries the template. The concrete URL used at fetch time is captured in `edition.resolvedUrl` on the DB row after a successful fetch.

## Fetch pipeline

```text
operator clicks Fetch on /sources/sectional-denver
        │
        ▼
form action: enqueueJob({ kind: 'fetch', target: { type: 'hangar.source', id: 'sectional-denver' }, actor })
        │
        ▼
worker picks the job, per-target lock prevents concurrent sectional-denver fetches
        │
        ▼
handler dispatches by SOURCE_KIND_BY_TYPE:
        │
        ├── 'text'          -> existing text handler (WP3)
        └── 'binary-visual' -> new binary-visual sub-handler
                                │
                                ├── 1. resolve edition from index URL
                                │      (HTML scrape -> { effectiveDate, editionNumber, resolvedUrl })
                                │
                                ├── 2. if resolvedUrl + editionDate match DB edition
                                │      AND on-disk archive sha matches DB checksum:
                                │      log "no change (edition + bytes match)"; return
                                │
                                ├── 3. download resolvedUrl -> tmp path
                                │      (libs/aviation/src/sources/download.ts, WP3)
                                │
                                ├── 4. compute sha256 + sizeBytes
                                │
                                ├── 5. drift check:
                                │      if editionDate matches DB but sha differs
                                │      -> fail with 'edition-drift'; surface both sha
                                │
                                ├── 6. archive previous edition directory
                                │      (rename .../<old-edition>/ -> .../<old-edition>@archived-<ts>/)
                                │      respecting ARCHIVE_RETENTION
                                │
                                ├── 7. move tmp -> data/sources/sectional/<id>/<edition>/chart.zip
                                │
                                ├── 8. read archive manifest
                                │      (entry names + sizes, no bytes extracted)
                                │
                                ├── 9. generateSectionalThumbnail(archivePath, outPath)
                                │      -> { thumbnailPath, thumbnailSha256, thumbnailSizeBytes, generator }
                                │
                                ├── 10. write meta.json sidecar with all of the above
                                │
                                └── 11. update hangar.source: checksum, downloaded_at, size_bytes,
                                        media, edition; mark dirty=true; audit
```

Every step emits a `ctx.log('event', ...)` line so the `/jobs/[id]` live view shows progress. Cancellation is checked between steps 2, 3, 7, and 9 (the expensive ones).

## Edition resolver

```typescript
// libs/aviation/src/sources/sectional/resolve-edition.ts

export interface ResolvedEdition {
  effectiveDate: string; // ISO date
  editionNumber: number | null;
  resolvedUrl: string;
  resolvedAt: string;
}

export async function resolveCurrentSectionalEdition(opts: {
  region: string; // e.g. 'Denver'
  indexUrl: string; // e.g. 'https://aeronav.faa.gov/visual/'
  urlTemplate: string; // e.g. 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip'
  fetchHtml: (url: string) => Promise<string>; // injected for tests
}): Promise<ResolvedEdition>;
```

Implementation: fetches the index HTML, parses a deterministic CSS selector for the current-cycle block, extracts the effective date (and the edition number where present), substitutes into the URL template. Failures are loud: missing selector, unparsed date, no matching region link each throw with a clear message so the fetch job fails with an actionable error instead of a silent wrong download.

Unit-tested against a committed HTML fixture under `libs/aviation/src/sources/sectional/__fixtures__/`.

## Thumbnail generator

```typescript
// libs/aviation/src/sources/thumbnail.ts

export interface ThumbnailResult {
  thumbnailPath: string;
  thumbnailSha256: string;
  thumbnailSizeBytes: number;
  generator: 'gdal_translate' | 'sips';
}

export async function generateSectionalThumbnail(opts: {
  archivePath: string; // .zip on disk
  outPath: string; // .jpg destination
  maxWidth: number; // from SECTIONAL_THUMBNAIL.WIDTH
  maxHeight: number; // from SECTIONAL_THUMBNAIL.HEIGHT
  jpegQuality: number; // from SECTIONAL_THUMBNAIL.QUALITY
  maxBytes: number; // from SECTIONAL_THUMBNAIL.MAX_BYTES
}): Promise<ThumbnailResult>;
```

Tool detection: check `gdal_translate --version` first; on success, use the GDAL path (extract the TIFF into a temp dir, downsample + encode JPEG). On failure, check `sips --help`; on success, use the macOS fallback path. On both failing, throw a descriptive error so the fetch job fails with "no thumbnail generator available on PATH; install gdal or run on macOS".

Output enforcement: if the encoded JPEG exceeds `maxBytes`, re-encode at lower quality until under budget, or throw if quality bottoms out and size still exceeds.

Constants:

```typescript
// libs/constants/src/sources.ts (extended)

export const SECTIONAL_THUMBNAIL = {
  WIDTH: 512,
  HEIGHT: 384,
  QUALITY: 70,
  MIN_QUALITY: 40,
  MAX_BYTES: 256 * 1024,
} as const;
```

## Preview dispatcher extensions

`apps/hangar/src/lib/components/preview/` (from WP3) gains:

```text
ZipPreview.svelte       Lists archive manifest (entries + sizes). No extraction.
GeotiffPreview.svelte   "No inline preview available." Links to the saved thumbnail.
JpegPreview.svelte      Inline <img> with role-token frame (--surface-raised, --edge-subtle).
```

Dispatch table in `/sources/[id]/files/+page.svelte` keyed on extension:

```typescript
const PREVIEW_BY_EXT: Record<string, typeof ComponentType> = {
  xml: XmlPreview,
  json: JsonPreview,
  md: MarkdownPreview,
  pdf: PdfPreview,
  csv: CsvPreview,
  zip: ZipPreview,
  tif: GeotiffPreview,
  tiff: GeotiffPreview,
  jpg: JpegPreview,
  jpeg: JpegPreview,
};
```

Unknown extensions fall through to `BinaryPreview.svelte` from WP3.

## `/sources/[id]` preview tile

Placed above the state cards on the detail page when `media.thumbnailPath` is set.

```svelte
<!-- apps/hangar/src/lib/components/SourcePreviewTile.svelte -->
<section class="tile" aria-label="Source preview">
  <a class="thumb" href={ROUTES.HANGAR.SOURCE_FULL_DOWNLOAD(source.id)}>
    <img src={thumbnailUrl} alt={`${source.title} - edition ${edition.effectiveDate}`} />
  </a>
  <dl class="meta">
    <dt>Edition</dt><dd>{edition.effectiveDate}{edition.editionNumber ? ` (#${edition.editionNumber})` : ''}</dd>
    <dt>Archive</dt><dd>{formatBytes(source.sizeBytes)} - {shortSha(source.checksum)}</dd>
    <dt>Downloaded</dt><dd>{formatRelative(source.downloadedAt)}</dd>
    <dt>Generator</dt><dd>{media.generator}</dd>
  </dl>
</section>

<style>
  .tile {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--surface-raised);
    border: 1px solid var(--edge-subtle);
    border-radius: var(--radius-2);
  }
  .thumb img {
    display: block;
    width: 256px;
    height: 192px;
    object-fit: cover;
    border-radius: var(--radius-1);
  }
  .meta dt { color: var(--ink-2); font-size: var(--font-size-sm); }
  .meta dd { color: var(--ink-1); margin: 0 0 var(--space-2); }
</style>
```

Every colour, spacing, radius, and font-size pulled from role tokens. No hex, no magic numbers except the fixed thumbnail dimensions (which are the enforced constants on the generator side).

## Routes additions

```typescript
// libs/constants/src/routes.ts (extended)

export const ROUTES = {
  // ...existing
  HANGAR: {
    // ...existing from WP2/WP3
    SOURCE_FULL_DOWNLOAD: (id: string) => `/sources/${id}/download` as const,
  },
} as const;
```

Handler at `/sources/[id]/download/+server.ts` streams the archive with `content-disposition: attachment`; route gated to `AUTHOR | OPERATOR | ADMIN`.

## New-source form delta

Only the create form at `/glossary/sources/new` changes. When the type picker selects a `binary-visual` type (currently just `sectional`), a "Non-textual details" panel reveals:

| Field          | Control                                              | Persists to                  |
| -------------- | ---------------------------------------------------- | ---------------------------- |
| Region         | text                                                 | `locator_shape.region`       |
| Cadence (days) | number, default 56                                   | `locator_shape.cadence_days` |
| Index URL      | url                                                  | `locator_shape.index_url`    |
| URL template   | text with `{edition-date}` / `{region}` placeholders | `url` (top-level)            |

Submit path is identical to text: validate with Zod, write to `hangar.source`, mark dirty, redirect to detail page.

## Audit

Every mutating action writes to `audit.event` via `auditWrite`. New target subtypes:

- `hangar.source.fetch.binary-visual` (fetch job handler)
- `hangar.source.thumbnail-generated`
- `hangar.source.edition-resolved`
- `hangar.source.edition-drift-detected` (failure case)

## Test fixture strategy

Downloading the real Denver archive in unit tests is out of bounds. Fixtures:

- `libs/aviation/src/sources/sectional/__fixtures__/aeronav-index.html` (copy of the relevant FAA index section, small, committed)
- `libs/aviation/src/sources/sectional/__fixtures__/tiny-chart.zip` (synthetic zip containing a 16x12 PNG + a tiny sidecar, committed; used by thumbnail tests with a PNG-path branch)

Integration tests use the synthetic archive + an injected HTML fetcher. The real Denver archive is exercised only in the manual walkthrough.

## Non-extraction contract

`scripts/references/extract.ts` and friends gain an early return:

```typescript
if (SOURCE_KIND_BY_TYPE[source.type] === 'binary-visual') {
  console.log(`[extract] ${source.id}: binary-visual source, skipping extraction (not applicable).`);
  return { skipped: true };
}
```

Same for `scan` (the wiki-link scanner does not scan binary-visual sources; they have no prose), `validate` (no verbatim to validate), `build`, `diff`. Each logs a clear "not applicable" message so operators running the CLI against a sectional see why nothing happened.

## Concurrency

Same per-target-id worker lock as WP3. Two fetches against `sectional-denver` serialise; `sectional-denver` fetch + `sectional-seattle` fetch (when seattle is added) run in parallel. Thumbnail generation is inline with the fetch handler; it does not spawn a separate job row.

## Theme token audit checklist

Before merge, every file touched here passes:

- No `#[0-9a-f]{3,8}` in any `<style>` block
- No `rgb(`, `rgba(`, `hsl(`, or CSS named colour in any `<style>` block
- Every spacing value is a `--space-*` token
- Every radius is a `--radius-*` token
- Every font-size is a `--font-size-*` token
- Contrast AA on `(--ink-1, --surface-raised)` and `(--ink-2, --surface-raised)` in both appearances

If a role is missing from [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md), stop and add it there first; do not invent a local name.

## Notes for the implementing agent

- The edition resolver is the riskiest moving part. Write the fixture-backed test first, then the scraper, then the fetch handler wiring.
- `gdal_translate` is not available in every dev environment. Fail loud with a clear install hint rather than faking a placeholder.
- Treat the Denver archive as opaque bytes end-to-end. Do not unzip more than the manifest listing; do not parse the TIFF; do not attempt any overlay. Spatial owns all of that.
