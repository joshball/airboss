---
title: 'WP-MTN -- Tips on Mountain Flying pamphlet ingestion'
product: study
feature: wp-mtn-mountain-flying
type: spec
status: unread
review_status: pending
created: 2026-05-02
---

# WP-MTN -- Tips on Mountain Flying

First post-WP-SUB corpus add. Smallest possible win: one short FAA pamphlet, whole-doc shape, plumbed through the existing `handbooks-extras` pipeline.

Source spec: [library-completeness §4.F](../library-completeness/spec.md) (sequence position 2).

## Goal

Land the FAA *Tips on Mountain Flying* pamphlet as a readable `/library` card, validating the post-WP-SUB whole-doc path with a non-FAA-H-numbered document.

## Source

- URL: `https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/tips_on_mountain_flying.pdf`
- Length: ~40 pages
- Publisher: FAA
- Edition: undated on the cover; treated as `mtn-2003` for slug purposes (current FAA-hosted version traces to early 2000s; no version letters issued).

## Decisions (taken at WP author time)

- **Corpus**: `handbooks` (per spec §4.F: "treat as `handbooks/<slug>`, smallest possible win"). No new `pamphlet` kind.
- **Manifest shape**: `kind: whole-doc`. Reuses the post-WP-SUB whole-doc seed adapter at [libs/bc/study/src/seeders/whole-doc.ts](../../../libs/bc/study/src/seeders/whole-doc.ts).
- **Slug**: `tips-mountain-flying`.
- **doc_id**: `faa-mtn-tips` (synthetic; the pamphlet has no FAA H-number).
- **Edition slug**: `mtn-2003`.
- **`subjects`**: `['performance', 'weather', 'emergencies']` (3, under the cap-of-3 from `project_library_subject_cap_revisit.md`).
- **`primary_cert`**: `null` (cert-agnostic; relevant from PPL through CFI mountain endorsements).

## Substrate change required

The pamphlet exposes one assumption in the handbooks substrate: the `EDITION_PATTERN` regex at [libs/sources/src/handbooks/locator.ts:47](../../../libs/sources/src/handbooks/locator.ts#L47) currently forces `^[0-9]{4}-[0-9]{1,3}[a-z]?$` (i.e. `8083-25C`-shaped). Mountain Flying is not an FAA-H document.

**Fix**: relax `EDITION_PATTERN` to also accept `<slug>-<year>` style (`mtn-2003`). One regex edit + tests. The handbooks corpus is no longer strictly H-8083 (it already holds AVWX); the regex just hadn't caught up to that.

## Touch list

- `scripts/sources/config/handbooks-extras.yaml` -- new entry for `faa-mtn-tips`.
- `libs/sources/src/handbooks-extras/ingest.ts` -- one row in `DOC_ID_TO_FRIENDLY` + `FRIENDLY_DISPLAY`.
- `libs/sources/src/handbooks/locator.ts` -- relax `EDITION_PATTERN` + add slug.
- `libs/sources/src/handbooks/resolver.ts` -- one entry in `HANDBOOK_DOC_EDITIONS`.
- `libs/sources/src/handbooks/url.ts` -- one entry in `HANDBOOK_LIVE_URLS`.
- Cache: `~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf` + `manifest.json` (created by the fetch step).
- Inline derivative: `handbooks/tips-mountain-flying/MTN-2003/document.md` + `manifest.json` (created by `bun run sources register --include-handbooks-extras`).
- Manifest backfill: `subjects` + `primary_cert` (per post-WP-SUB convention; the ingest pipeline doesn't author these, the WP author does).

## Acceptance

- `bun run check` clean.
- `bun test` green (locator regex change, registry tests).
- `bun run db reset --force && bun run db seed` runs clean and produces 1 `reference_section` row at depth 0, level `document` for the new reference.
- `/library` shows the *Tips on Mountain Flying* card as readable; clicking opens the body in-app.
- `getReadableReferenceIds()` returns the new reference id.

## Out of scope

- Section-tree extraction (the pamphlet is whole-doc per the post-WP-SUB whole-doc shape).
- Figure/table extraction.
- Citation deep-links (the pamphlet has no internal citation grammar).
- `pamphlet` as a new `kind` (deferred; revisit if/when we ship 3+ non-handbook pamphlets).
