---
title: 'User stories: Hangar non-textual sources'
product: hangar
feature: hangar-non-textual
type: user-stories
status: unread
review_status: done
---

# User stories: Hangar non-textual sources

Operator-side only. Hangar is an admin app; the stories are about the person who keeps the source registry current, not about a learner. Three stories cover the Denver-sectional seed; additional chart / plate / diagram stories reuse the same shape once the follow-on WPs land.

## Personas

- **Operator (user zero)**: content steward with `OPERATOR` role. Logs into hangar, keeps the source registry current. Knows what a sectional is and how the 56-day cycle works.
- **Author**: adds / edits references in the glossary. Relevant only at the edges of this WP (when a sectional is cited by a reference, the author needs the source to exist).

## US-1: Seed the Denver sectional as a registered source

**As** the operator,
**I want** to register the Denver VFR Sectional Chart as a source in hangar,
**so that** the registry knows how to find it and fetch-on-demand is a one-click action.

### Acceptance criteria

- The new-source form at `/glossary/sources/new` has a type picker that includes `VFR Sectional`.
- Selecting `VFR Sectional` reveals a "Non-textual details" panel with fields for region, cadence days (default 56), index URL, and URL template.
- Submitting the form creates a `hangar.source` row with `type = 'sectional'`, `locator_shape.kind = 'binary-visual'`, and the other fields persisted.
- The row is marked dirty; no filesystem I/O happens yet.
- "Sync all pending" writes the new entry to `libs/db/seed/sources.toml` and commits (or opens a PR, per env).
- After sync, the detail page `/sources/sectional-denver` renders with state `pending download`.

### Out of scope

- Any fetch of the actual chart - that's US-3.
- Automatic edition resolution at create time - editions resolve on fetch, not on create.

### Notes

- The form is kind-aware via the type picker. Adding a later type (e.g. `plate`) just needs another entry in `SOURCE_KIND_BY_TYPE` + label; no form rewrite.

## US-2: Understand what's registered without leaving the registry page

**As** the operator,
**I want** to see at a glance that a registered non-textual source is pending download versus downloaded,
**so that** I can prioritise which fetches to run before the next content pass.

### Acceptance criteria

- The source registry table on `/sources` (from WP3) lists `sectional-denver` with state `pending download` until the first successful fetch.
- After a successful fetch, the row state becomes `downloaded`; the `extracted` column shows `n/a` (with a tooltip explaining extraction does not apply to binary-visual sources).
- Counts of cited-by / verbatim-materialised are omitted for binary-visual rows (or shown as `-`), not zeroed out, so the table doesn't misrepresent the state.

### Out of scope

- Any learner-facing surface for the chart.
- Tiling, overlay, or georeference display.

### Notes

- The same table will list plates, airport diagrams, and CSVs later. The "binary-visual means no extract" idiom must be obvious at a glance or operators will keep asking why extract is grey.

## US-3: Download the Denver sectional set

**As** the operator,
**I want** one click on `Fetch` to download the current Denver sectional edition, generate a preview thumbnail, and record edition + checksum metadata,
**so that** the chart is on disk and verifiable with no terminal work.

### Acceptance criteria

- `Fetch` on `/sources/sectional-denver` enqueues a `fetch` job and redirects to `/jobs/[id]`.
- The job log streams progress through: resolve edition, download archive, compute sha256, read archive manifest, generate thumbnail, write meta.json, update DB row.
- On success, the DB row carries `checksum`, `size_bytes`, `media.thumbnailPath`, `media.archiveEntries`, `media.generator`, `edition.effectiveDate`, `edition.editionNumber`, `edition.resolvedUrl`, `edition.resolvedAt`.
- On re-fetch during the same edition with the same bytes, the job short-circuits with `no change (edition + bytes match)`; no new files written.
- On a next-edition fetch, the previous edition directory is archived under `<edition>@archived-<ts>/` and the new edition populated alongside; archive retention caps at the WP3 constant (default 3).
- On detected drift (same edition date, different sha), the job fails with a clear `edition-drift` error; both sha values appear in the log; DB row untouched.
- `/sources/sectional-denver` renders a preview tile with the thumbnail + edition metadata after a successful fetch.
- `/sources/sectional-denver/files` lists `chart.zip`, `thumb.jpg`, `meta.json` with per-extension previews.
- All of the above audits correctly: fetch, edition-resolved, thumbnail-generated, edition-drift (on failure) each produce an `audit.event` row with actor + target + metadata.

### Out of scope

- Rendering the chart itself (spatial concern, not hangar).
- OCR or any text extraction.
- Cron-based refresh on the 56-day cycle.
- Automatic PR-against-main when a new edition is available.

### Failure modes

- Index unreachable -> job fails with a clear network error; retry policy is the WP3 download library's retry.
- Index parseable but no current-cycle block found -> job fails with "could not locate current cycle in index"; operator investigates.
- No thumbnail generator on PATH -> job fails with install hint (`gdal_translate` or `sips`).
- Archive larger than the configured upload cap (for the upload path; fetch has no cap by default) -> does not apply here; fetch path streams to disk.

## US-4 (future, surfaced here for continuity)

Not implemented in this WP. Captured so the shape carries forward.

- **US-4 plates**: register a specific airport's plate set, fetch the FAA d-TPP bundle, render per-plate thumbnails.
- **US-5 airport diagrams**: register a single airport diagram PDF, fetch on cycle, thumbnail per diagram.
- **US-6 NTSB CSV**: fetch the accident CSV on demand; tabular preview, not a thumbnail.
- **US-7 AOPA HTML**: crawl a limited URL set, normalise, ingest.

Each reuses the binary-visual (or semi-structured) pattern this WP lands. See [spec.md §Out of scope](./spec.md#out-of-scope) for the explicit deferral.

## Non-goals explicitly stated

- No story for learners downloading or viewing the sectional through hangar. Hangar is admin-only; the rendering surface is `spatial/` when it exists.
- No story for bulk operations ("fetch all sectionals I've registered"). One at a time is fine; add a bulk action if the backlog ever grows.
- No story for cross-source diff (sectional vs sectional). Not a meaningful operation for binary-visual sources.
