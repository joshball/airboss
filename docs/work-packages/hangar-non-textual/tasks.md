---
title: 'Tasks: Hangar non-textual sources'
product: hangar
feature: hangar-non-textual
type: tasks
status: unread
review_status: done
---

# Tasks: Hangar non-textual sources

Depends on `wp-hangar-registry` and `wp-hangar-sources-v1` merged to main. Serial phases. Each phase ends with `bun run check` clean + its own commit. Phases 1, 2, 3, 5 are each shippable in their own PR if the WP gets split; default plan is one PR for the whole thing.

## Phase 1 - Contract: source kind + constants + schema

Lands the contract so later phases can run against types that exist.

- [ ] Extend `REFERENCE_SOURCE_TYPES` in `libs/constants/src/reference-tags.ts` with `SECTIONAL: 'sectional'`. Extend `SOURCE_TYPE_LABELS`. Extend `SOURCE_TYPE_VALUES` automatically via the existing `Object.values` call.
- [ ] Extend `Source['format']` union in `libs/aviation/src/schema/source.ts` with `'geotiff-zip'`. Update `isSourceMeta` format check.
- [ ] Add `SOURCE_KINDS` + `SourceKind` + `SOURCE_KIND_BY_TYPE` in `libs/constants/src/sources.ts` (file introduced in WP3).
- [ ] Add `SECTIONAL_THUMBNAIL` constants (width, height, quality, min_quality, max_bytes).
- [ ] Extend `JOB_KINDS` (no new kinds; fetch handler dispatches by source kind internally; keep `fetch` as the single kind).
- [ ] Add new `AUDIT_TARGETS` entries: `HANGAR_SOURCE_EDITION_RESOLVED`, `HANGAR_SOURCE_EDITION_DRIFT`, `HANGAR_SOURCE_THUMBNAIL_GENERATED`.
- [ ] Extend `SourceMedia` + `SourceEdition` types in `libs/aviation/src/schema/source.ts`.
- [ ] Drizzle schema change: add `media jsonb` + `edition jsonb` to `hangar.source`. Generate migration via `bun run db generate`. Review SQL. Commit.
- [ ] Run `bun run db migrate` locally. `bun run db check`.
- [ ] Unit: round-trip a sectional `Source` through `toml-codec` (from WP2). Byte-identical.
- [ ] `bun run check` clean.

## Phase 2 - Edition resolver + thumbnail generator

Pure libs. No hangar routes yet.

- [ ] New file `libs/aviation/src/sources/sectional/resolve-edition.ts`. Exports `resolveCurrentSectionalEdition`.
- [ ] Commit `libs/aviation/src/sources/sectional/__fixtures__/aeronav-index.html` (small excerpt of the FAA AeroNav index containing the current-cycle block).
- [ ] Vitest: resolver against the committed HTML fixture. Happy path returns the right effective date + resolved URL. Missing selector throws with a clear message. Missing region link throws.
- [ ] New file `libs/aviation/src/sources/thumbnail.ts`. Exports `generateSectionalThumbnail`.
- [ ] Tool detection: try `gdal_translate --version`; fallback `sips --help`; throw clear error when neither present.
- [ ] Output enforcement: JPEG quality step-down until `<= SECTIONAL_THUMBNAIL.MAX_BYTES`; throw when below `MIN_QUALITY`.
- [ ] Commit `libs/aviation/src/sources/sectional/__fixtures__/tiny-chart.zip` (synthetic archive with a tiny PNG inside; used by the generator test with a PNG-path branch so the tests do not require GDAL).
- [ ] Vitest: generator happy path against the synthetic fixture. Size budget enforcement. Missing-tool error.

## Phase 3 - Fetch handler extension

Wires the binary-visual sub-handler into the existing `fetch` job.

- [ ] In `apps/hangar/src/lib/server/jobs.ts` (from WP3), add a dispatcher inside the `fetch` handler that branches on `SOURCE_KIND_BY_TYPE[source.type]`. Existing text path stays intact; new branch handles `binary-visual`.
- [ ] Binary-visual branch implements steps 1 through 11 from [design.md §Fetch pipeline](./design.md#fetch-pipeline).
- [ ] `edition-drift` failure path writes both sha values into the job log + returns a structured error.
- [ ] `no change` path short-circuits after step 2 with a clear log line.
- [ ] Archive retention: previous edition dirs rotated using `SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION` (from WP3).
- [ ] Audit writes at each of: edition resolved, thumbnail generated, edition-drift detected, successful fetch.
- [ ] Extend `scripts/references/download.ts` (the CLI command the handler shells out to) with a `--kind binary-visual` path doing the same steps, so the terminal CLI and the hangar UI behave identically.
- [ ] No-op branches in `scripts/references/scan.ts`, `extract.ts`, `validate.ts`, `build.ts`, `diff.ts`: early-return with a clear "not applicable for binary-visual sources" log line when passed a sectional.
- [ ] Unit: binary-visual fetch handler with injected resolver + injected generator + in-memory fs (or tmp dir). Happy, no-change, edition-drift, missing-tool.
- [ ] Integration: end-to-end fetch job against the committed `tiny-chart.zip` served from a local HTTP mock. Verify DB row updated, `meta.json` written, thumbnail file present.

## Phase 4 - Registry editing: new-source form extension

Extends the `/glossary/sources/new` form from WP2 with a kind-aware panel.

- [ ] Add `source-kind` aware form logic to `/glossary/sources/new/+page.svelte`. When `type === 'sectional'`, reveal the "Non-textual details" panel (region, cadence days, index URL, URL template).
- [ ] Zod schema in `/glossary/sources/new/+page.server.ts` validates the non-textual block when `source-kind` is `binary-visual`.
- [ ] Submit writes `locator_shape` correctly (region, cadence_days, index_url, kind).
- [ ] Mirror edits on `/glossary/sources/[id]/+page.svelte`.
- [ ] Seed `sectional-denver` through the UI in dev (not as a code migration). Commit the resulting `libs/db/seed/sources.toml` addition via a sync-to-disk job.
- [ ] Unit: Zod schema rejects missing region + missing index URL when kind is binary-visual.

## Phase 5 - Detail page preview tile + files browser

- [ ] New component `apps/hangar/src/lib/components/SourcePreviewTile.svelte`. Role tokens only.
- [ ] `/sources/[id]/+page.svelte`: render `SourcePreviewTile` above the state cards when `media?.thumbnailPath` is set.
- [ ] `/sources/[id]/download/+server.ts`: stream the archive with `content-disposition: attachment`; role-gated.
- [ ] `ROUTES.HANGAR.SOURCE_FULL_DOWNLOAD(id)` constant.
- [ ] Preview dispatcher extensions in `apps/hangar/src/lib/components/preview/`:
  - [ ] `ZipPreview.svelte` - lists archive manifest entries + sizes from `media.archiveEntries`, no extraction.
  - [ ] `GeotiffPreview.svelte` - "no inline preview available" + link to generated thumbnail.
  - [ ] `JpegPreview.svelte` - inline `<img>` with role-token frame.
- [ ] Extend `PREVIEW_BY_EXT` in `/sources/[id]/files/+page.svelte` with the new extensions.
- [ ] Audit pass: every new Svelte file runs the token-enforcement lint clean.

## Phase 6 - Operator walkthrough

End-to-end manual exercise on dev. Covered in detail in [test-plan.md](./test-plan.md). Tasks-side items:

- [ ] Seed `sectional-denver` through the UI.
- [ ] Trigger fetch; watch `/jobs/[id]` stream the pipeline.
- [ ] Verify detail page renders the preview tile with the thumbnail inline.
- [ ] Verify files browser lists archive + thumb + meta.json with correct per-extension previews.
- [ ] Re-fetch; confirm "no change".
- [ ] Simulate a next-edition by injecting an override into the resolver (or by pointing the resolver fixture at a newer edition); confirm archive rotation + new thumbnail.

## Phase 7 - Docs + setup

- [ ] Update `docs/agents/reference-sveltekit-patterns.md` (if it has a sources section) with a binary-visual note.
- [ ] Update `scripts/setup.ts` to check for `gdal_translate` or `sips` on PATH; print an install hint when missing.
- [ ] Update the finish-plan status table entry for `wp-hangar-non-textual` to `ready` (not `drafted`) once Phase 1 lands; `shipped` when merged.
- [ ] Note in `docs/platform/IDEAS.md` (or follow-on spot) that plates + airport diagrams + NTSB CSV + AOPA HTML are the next binary-visual / semi-structured sources to wire; they reuse the shape this WP lands.

## Phase 8 - Gates

- [ ] `bun run check` clean.
- [ ] All tests pass (`bun test`).
- [ ] Manual walkthrough: every step in [test-plan.md](./test-plan.md) passes.
- [ ] Token-enforcement lint from [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md): zero violations in new files.
- [ ] Contrast tests pass (WCAG AA) in light + dark for the new components.
- [ ] No FOUC on the detail page + files browser.
- [ ] PR opened via `gh pr create`; not self-merged.

## Deferred (surface only; not implemented here)

- Instrument approach plates (new source type, same pattern)
- Airport diagrams (new source type, same pattern)
- NTSB CSV ingest + tabular preview
- AOPA HTML crawl + ingest
- Cron-based auto-refresh on 56-day cycle
- Spatial rendering / overlay (belongs to `apps/spatial/` when it exists)
- Automatic PR-against-main edition refresh (the fetch is operator-triggered for now)
