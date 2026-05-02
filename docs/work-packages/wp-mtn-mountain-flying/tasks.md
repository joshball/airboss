---
title: 'WP-MTN -- task list'
type: tasks
status: in-progress
---

# Tasks

## Phase A -- substrate prep

- [ ] Relax `EDITION_PATTERN` in `libs/sources/src/handbooks/locator.ts` to accept `<slug>-<year>` shapes alongside the FAA H-number shape.
- [ ] Add `tips-mountain-flying` to `HANDBOOK_DOC_SLUGS` in the same file.
- [ ] Add a positive locator test for `tips-mountain-flying/mtn-2003`.

## Phase B -- registry rows

- [ ] Add `tips-mountain-flying` row to `HANDBOOK_DOC_EDITIONS` in `libs/sources/src/handbooks/resolver.ts` (`{ 'mtn-2003': 'MTN-2003' }`).
- [ ] Add `tips-mountain-flying` to `HANDBOOK_LIVE_URLS` in `libs/sources/src/handbooks/url.ts`.
- [ ] Add `faa-mtn-tips` row to `DOC_ID_TO_FRIENDLY` + `FRIENDLY_DISPLAY` in `libs/sources/src/handbooks-extras/ingest.ts`.
- [ ] Add YAML entry for `faa-mtn-tips` in `scripts/sources/config/handbooks-extras.yaml`.

## Phase C -- fetch + extract + register

- [ ] Fetch the PDF into the cache (`~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf`) plus a `manifest.json` cache-side stub.
- [ ] Run the handbooks-extras ingest to produce the in-repo derivative + manifest at `handbooks/tips-mountain-flying/MTN-2003/`.

## Phase D -- post-WP-SUB metadata

- [ ] Backfill `subjects: ['performance', 'weather', 'emergencies']` into the produced manifest.
- [ ] Backfill `primary_cert: null` into the produced manifest.

## Phase E -- seed + verify

- [ ] `bun run db reset --force` clean.
- [ ] `bun run db seed` clean. New `reference` + 1 `reference_section` row at depth 0, level `document`, body populated.
- [ ] `/library` shows the new card as readable; click-through renders the body.

## Phase F -- ship

- [ ] `bun run check` clean.
- [ ] `bun test` green.
- [ ] Commit, push, PR, merge, pull main.
