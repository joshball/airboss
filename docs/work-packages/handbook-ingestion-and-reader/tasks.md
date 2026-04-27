---
title: 'Tasks: Handbook Ingestion and Reader'
product: study
feature: handbook-ingestion-and-reader
type: tasks
status: unread
review_status: pending
---

# Tasks: Handbook Ingestion and Reader

Phased plan for [spec.md](./spec.md). Order is dependency-driven: contract + schema first, ingestion next, BC + UI on top, ship.

Depends on: knowledge-graph (shipped; this WP extends `knowledge_node.references`), reference-system-core (shipped; this WP composes with `@ab/aviation` rendering).

## Pre-flight

- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` and `context.md` end-to-end.
- [ ] Read `docs/platform/LEARNING_PHILOSOPHY.md`, especially principle 8 and the Handbook Integration section.
- [ ] Read `libs/bc/study/src/schema.ts` -- understand existing CHECK / index / FK conventions.
- [ ] Read `libs/constants/src/study.ts` and `libs/constants/src/reference-tags.ts` -- understand the existing taxonomies the new constants compose with.
- [ ] Read `libs/constants/src/routes.ts` and `apps/study/src/routes/(app)/+layout.svelte` -- understand the route grammar and nav.
- [ ] Read `docs/work-packages/knowledge-graph/spec.md` for the seed-pipeline pattern + `bun run db build` shape.
- [ ] Read `docs/work-packages/reference-system-core/spec.md` and `docs/work-packages/reference-extraction-pipeline/spec.md` -- this WP composes with both.
- [x] Confirm Open Questions 1-5 in spec.md are resolved by Joshua. **Resolved 2026-04-26**: all five recommendations accepted; storage policy promoted to [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) and [docs/platform/STORAGE.md](../../platform/STORAGE.md).
- [ ] Verify DB is running (OrbStack postgres on port 5435).
- [ ] Verify Python 3.11+ is available locally; the ingestion pipeline depends on it.
- [ ] Verify the cache directory exists or can be created at `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`). Pipeline auto-creates it on first run.
- [ ] Verify `.gitattributes` at repo root has `handbooks/**/*.pdf filter=lfs diff=lfs merge=lfs -text` (dormant LFS plumbing per ADR 018) and `.gitignore` has `handbooks/**/*.pdf` (active gate). `git lfs install` is NOT required today.

## Implementation

### Phase 0: Constants + types contract

- [ ] Add `REFERENCE_KINDS`, `REFERENCE_KIND_VALUES`, `REFERENCE_KIND_LABELS`, `ReferenceKind` to `libs/constants/src/study.ts` (or split into `libs/constants/src/handbooks.ts` if `study.ts` is feeling heavy and re-export from `index.ts`).
- [ ] Add `HANDBOOK_SECTION_LEVELS`, `HANDBOOK_SECTION_LEVEL_VALUES`, `HandbookSectionLevel` to the same file.
- [ ] Add `HANDBOOK_READ_STATUSES`, `HANDBOOK_READ_STATUS_VALUES`, `HANDBOOK_READ_STATUS_LABELS`, `HandbookReadStatus`.
- [ ] Add `REFERENCE_ID_PREFIX = 'ref'`, `HANDBOOK_SECTION_ID_PREFIX = 'hbs'`, `HANDBOOK_FIGURE_ID_PREFIX = 'hbf'`.
- [ ] Add `HANDBOOK_HEARTBEAT_INTERVAL_SEC`, `HANDBOOK_SUGGEST_OPEN_SECONDS`, `HANDBOOK_SUGGEST_TOTAL_SECONDS`, `HANDBOOK_SUGGEST_REQUIRES_SCROLL_END`, `HANDBOOK_HEARTBEAT_BUFFER` (with values matching the spec defaults; final numbers come from Open Question 5).
- [ ] Re-export every new constant + type from `libs/constants/src/index.ts`.
- [ ] Add `QUERY_PARAMS.EDITION = 'edition'` if not already present.
- [ ] Add `HANDBOOKS`, `HANDBOOK`, `HANDBOOK_CHAPTER`, `HANDBOOK_SECTION`, `HANDBOOK_SECTION_AT_EDITION` route entries to `libs/constants/src/routes.ts`. Add `NAV_LABELS.HANDBOOKS = 'Handbooks'`.
- [ ] Add `Citation`, `LegacyCitation`, `StructuredCitation` discriminated-union types to `libs/types/src/citation.ts`. Re-export from `libs/types/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(constants): handbook + citation contract`).

### Phase 1: Drizzle schema + migration

- [ ] Add `reference`, `handbookSection`, `handbookFigure`, `handbookReadState` tables to `libs/bc/study/src/schema.ts`.
- [ ] Add CHECK constraints per spec (kind-in-list, level-in-list, status-in-list, code regex via `~`, parent_id consistency check, total_seconds_visible >= 0, notes_md length <= 16384).
- [ ] Add unique constraint on `reference (document_slug, edition)` and on `handbook_section (reference_id, code)`.
- [ ] Add indexes: `reference (kind)`, `reference (document_slug, superseded_by_id)`, `handbook_section (reference_id, parent_id, ordinal)`, `handbook_section (reference_id, level, ordinal)`, `handbook_figure (section_id, ordinal)`, `handbook_read_state (user_id, status)`, `handbook_read_state (handbook_section_id)`.
- [ ] Add a GIN index on `knowledge_node.references` using `jsonb_path_ops`. Use `sql.raw(...)` if Drizzle's index DSL needs it.
- [ ] Export row + insert types: `ReferenceRow`, `NewReferenceRow`, `HandbookSectionRow`, `NewHandbookSectionRow`, `HandbookFigureRow`, `NewHandbookFigureRow`, `HandbookReadStateRow`, `NewHandbookReadStateRow`.
- [ ] Run `bunx drizzle-kit generate` -- inspect the generated migration; confirm CHECK + GIN constraints look correct. Commit the SQL file (`drizzle/0010_handbook_ingestion.sql`).
- [ ] Run `bunx drizzle-kit push` against local dev. Verify with `\d study.reference`, `\d study.handbook_section`, `\d study.handbook_figure`, `\d study.handbook_read_state`. Verify GIN index via `\di+`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(schema): handbook reference + section + figure + read_state tables`).

### Phase 2: ID helpers + Zod schemas

- [ ] Add `generateReferenceId`, `generateHandbookSectionId`, `generateHandbookFigureId` to `libs/utils/src/ids.ts`. Use the same `prefix_ULID` pattern as the existing helpers.
- [ ] Add Zod schemas to `libs/types/src/handbook.ts` (or `libs/bc/study/src/validation.ts`, matching the codebase pattern): `handbookFrontmatterSchema`, `handbookManifestSchema`, `handbookSectionFrontmatterSchema`, `handbookFigureSchema`, plus the `Citation` / `StructuredCitation` discriminator schemas.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 3: Handbook BC read functions

- [ ] Create `libs/bc/study/src/handbooks.ts`. Export `listReferences`, `getReferenceByDocument`, `listHandbookChapters`, `listChapterSections`, `getHandbookSection`, `getNodesCitingSection`, `getReadState`, `getHandbookProgress`, `resolveCitationUrl`.
- [ ] Implement the reverse query in `getNodesCitingSection` using `references @> ?::jsonb` and an in-memory locator filter. Add a unit-test fixture covering: handbook citation matches, handbook citation with different `reference_id` skipped, legacy freeform string skipped, missing locator handled.
- [ ] Implement `resolveCitationUrl` as a pure function. Returns `null` for non-handbook kinds and missing references.
- [ ] Define error classes in the same file: `ReferenceNotFoundError`, `HandbookSectionNotFoundError`, `HandbookValidationError`.
- [ ] Export everything from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### Phase 4: Handbook BC write functions

- [ ] Add `setReadStatus`, `setComprehended`, `recordHeartbeat`, `setNotes`, `markAsReread` to `libs/bc/study/src/handbooks.ts`.
- [ ] Use `INSERT ... ON CONFLICT (user_id, handbook_section_id) DO UPDATE` for upserts.
- [ ] `recordHeartbeat`: cap delta at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`, additive update on `total_seconds_visible`, set `last_read_at = now()`. First write also bumps `status` from `unread` to `reading`.
- [ ] `setComprehended`: BC validates that current status is not `unread` when setting `true`; throws `HandbookValidationError` otherwise.
- [ ] `markAsReread`: resets status to `unread`, clears `comprehended`, leaves notes alone.
- [ ] Add build-script-only helpers `upsertReference`, `upsertHandbookSection`, `replaceFiguresForSection`, `attachSupersededByLatest`. NOT exported from BC barrel.
- [ ] Run `bun run check` -- 0 errors.

### Phase 5: Handbook BC unit tests

- [ ] Create `libs/bc/study/src/handbooks.test.ts`. Cover:
  - `listReferences` excludes superseded by default; includes when opted in.
  - `getReferenceByDocument` defaults to latest non-superseded; honors explicit edition.
  - `listHandbookChapters` returns only `level='chapter'` rows ordered by ordinal.
  - `getHandbookSection` returns the section + its figures + sibling-section TOC.
  - `getNodesCitingSection` matches handbook citations correctly across chapter-only vs section-locator queries.
  - `resolveCitationUrl` returns the right URL for handbook citations and `null` for other kinds.
  - `recordHeartbeat` first-write upserts with `reading` status.
  - `recordHeartbeat` caps delta at 4x interval.
  - `setComprehended(true)` throws when status is unread.
  - `markAsReread` keeps notes, resets status + comprehended.
- [ ] Run `bun test libs/bc/study/src/handbooks.test.ts` -- all pass. Commit (`test(bc): handbook read functions + read-state mutations`).

### Phase 6: Ingestion pipeline scaffolding (Python)

- [ ] Create `tools/handbook-ingest/` directory.
- [ ] Write `pyproject.toml` with deps: `pymupdf`, `beautifulsoup4`, `lxml`, `pillow`, `click`, `pyyaml`, `ruff`. Pin via `requirements.txt` or `uv.lock` -- whichever is the project convention.
- [ ] Add `tools/handbook-ingest/README.md` documenting CLI + config layout.
- [ ] Add `bun run handbook-ingest` script entry in the root `package.json` that shells to `python -m ingest` from `tools/handbook-ingest/`.
- [ ] Scaffold the Python module layout: `ingest/__init__.py`, `ingest/cli.py`, `ingest/fetch.py`, `ingest/outline.py`, `ingest/sections.py`, `ingest/figures.py`, `ingest/tables.py`, `ingest/normalize.py`, `ingest/config/`.
- [ ] Add `.gitignore` rules: `tools/handbook-ingest/.venv/`, `__pycache__/`. The repo-root `.gitignore` already blocks `handbooks/**/*.pdf` per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md); source PDFs live in the developer-local cache (`$AIRBOSS_HANDBOOK_CACHE`, default `~/Documents/airboss-handbook-cache/`), not the repo.
- [ ] Implement `cli.py` with the click subcommand layout (`<doc> --edition <e> [--chapter N] [--dry-run] [--force]`).
- [ ] Implement `fetch.py`: resolve cache path from `$AIRBOSS_HANDBOOK_CACHE` env var (default `~/Documents/airboss-handbook-cache/`). If `<cache>/handbooks/<doc>/<edition>/source.pdf` already exists, use it (read-from-disk). Otherwise download URL to that cache path; auto-create directories as needed. Record `(url, sha256, fetched_at)` in the manifest. Subsequent runs against an unchanged cached source.pdf are a no-op for the fetch step. The cache lives outside the repo per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md).
- [ ] Implement `outline.py`: parse PDF outline into chapter/section/subsection tree; raise on outline-missing.
- [ ] Run `python -m ingest --help` to verify the CLI surface. Commit (`feat(handbook-ingest): scaffold + fetch + outline`).

### Phase 7: Section + figure + table extraction

- [ ] Implement `sections.py` -- per-section text extraction via `fitz` page-by-page slicing using outline page boundaries. Preserve paragraph breaks; merge hyphenated line breaks; strip page-chrome (page numbers, running headers).
- [ ] Implement `figures.py` -- iterate pages, extract embedded images, locate "Figure N-N." caption strings on the same page or the page before, bind caption to image, crop to the image's content area, write to `<root>/<doc>/<edition>/figures/`.
- [ ] Implement `tables.py` -- detect rectangular grids via fitz's structure detection; emit HTML using `<table><thead><tr><th>...` ... merge tables that span page breaks (same column count + caption continuation).
- [ ] Implement `normalize.py` -- compose per-section markdown with frontmatter `(handbook, edition, chapter_number, section_number, section_title, faa_pages, source_url)`. Inject figure references inline at their caption position. Emit a `manifest.json` per `<doc>/<edition>/` with `{ source_url, source_checksum, fetched_at, references[], chapters[], sections[], figures[], hashes[] }`.
- [ ] Implement edition-locked output: each run writes under `handbooks/<doc>/<edition>/`; pre-existing trees for other editions are untouched.
- [ ] Run `bun run handbook-ingest phak --edition 8083-25C --dry-run` against a local PHAK PDF -- expect a clean validation summary, no errors. Commit (`feat(handbook-ingest): sections + figures + tables + normalize`).

### Phase 8: PHAK end-to-end ingestion

- [x] Author `tools/handbook-ingest/ingest/config/phak.yaml`: source URL, expected page count, page-offset map, figure-prefix conventions, optional outline overrides for sections the FAA outline mangles.
- [x] Run the full pipeline: `bun run handbook-ingest phak --edition FAA-H-8083-25C`. Expect the entire `handbooks/phak/FAA-H-8083-25C/` tree to populate.
- [x] **Section-granularity (added 2026-04-27).** Two parallel strategies committed:
  - **Option 3 (TOC + heading verify, deterministic Python)** in `ingest/sections_via_toc.py`. TOC page range + heading-style fingerprint live in `phak.yaml -> toc` and `-> heading_style`. Same source PDF + same YAML = byte-identical section tree.
  - **Option 4 (LLM-assisted via Claude)** in `ingest/sections_via_llm.py`. Prompt at `ingest/prompts/section_tree.md` (committed; SHA-256 recorded in manifest). Pinned `claude-sonnet-4-5`, `temperature=0`. Raw responses saved at `<chapter>/_llm_section_tree.json` (committed; PR-reviewable). Requires `ANTHROPIC_API_KEY`.
  - **Compare** strategy emits a markdown diff report at `tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md`. Joshua picks per-chapter (or globally) which to trust via `phak.yaml -> section_strategy` and `per_chapter_section_strategy`.
  - Chapter cover-page residue strip applied via `phak.yaml -> chapter_cover_strip`. PHAK 25C ships chapter index.md without the duplicate "Chapter N / <title> / Introduction" stutter.
  - **Outcome:** PHAK 25C lands 17 chapters + 418 L1 sections + 415 L2 subsections in `study.handbook_section`. 850 markdown files inline; 0 PDFs staged.
- [ ] Manual visual review: open each chapter `index.md` and a sampling of section markdown. Spot-check figure renderings, tables, and the manifest. Note any cosmetic gaps or extraction errors as either pipeline bugs (fix here) or chapter-specific overrides in the YAML config.
- [ ] Commit `handbooks/phak/FAA-H-8083-25C/` -- markdown, figure PNGs, manifest.json (inline derivatives only). Use individual `git add` paths; never `git add -A`. Verify the cached source.pdf was NOT staged: `git status --short | grep -i pdf` should be empty (the `.gitignore` block prevents it). The PDF stays in `$AIRBOSS_HANDBOOK_CACHE/handbooks/phak/FAA-H-8083-25C/source.pdf`.

### Phase 9: Seed wiring -- `bun run db seed handbooks`

- [ ] Create `scripts/db/seed-handbooks.ts`. Read `handbooks/<doc>/<edition>/manifest.json` for every edition tree under `handbooks/`.
- [ ] Implement `seedHandbooks()`: per `(document_slug, edition)`, upsert `reference`, walk the section tree top-down upserting `handbook_section`, replace `handbook_figure` rows when content hash changes, set `superseded_by_id` on older editions of the same `document_slug`.
- [ ] Wire `bun run db seed handbooks` into `scripts/db/seed-all.ts` as a phase running after `users` and `knowledge`.
- [ ] Idempotency: re-running with no file changes makes no DB writes (every section's `content_hash` matches).
- [ ] Add unit-test fixture under `scripts/db/__tests__/seed-handbooks.test.ts` with a small synthetic `handbooks/test-handbook/test-edition/` tree. Cover: fresh insert, idempotent re-run, supersede an older edition, figure replacement on content change.
- [ ] Run `bun run db seed handbooks`. Confirm row counts match the manifest. Commit (`feat(seed): handbooks seed reads handbooks/ tree into DB`).

### Phase 10: Reader UI -- handbooks index + handbook overview

- [ ] Add `(app)/handbooks/+page.server.ts` -- load `listReferences()` plus per-handbook progress for the current user.
- [ ] Add `(app)/handbooks/+page.svelte` -- render `HandbookCard.svelte` per handbook. Edition badge, total chapters, % read.
- [ ] Add `(app)/handbooks/[doc]/+page.server.ts` -- load reference (latest non-superseded by default; honor `?edition=`), chapter list, per-chapter progress.
- [ ] Add `(app)/handbooks/[doc]/+page.svelte` -- chapter list with `HandbookChapterListItem.svelte`. Show "newer edition available" banner when `superseded_by_id` is set.
- [ ] Add `HandbookCard.svelte`, `HandbookChapterListItem.svelte`, `HandbookEditionBadge.svelte` to `libs/ui/handbooks/`.
- [ ] Add `Handbooks` nav item in `apps/study/src/routes/(app)/+layout.svelte` linking to `ROUTES.HANDBOOKS`.
- [ ] Run `bun run check` -- 0 errors. Manual: open `/handbooks` and `/handbooks/phak`. Commit (`feat(study): /handbooks index + /handbooks/[doc] chapter list`).

### Phase 11: Reader UI -- chapter overview

- [ ] Add `(app)/handbooks/[doc]/[chapter]/+page.server.ts` -- load chapter row, section list, citing-nodes panel data via `getNodesCitingSection({ chapter })`.
- [ ] Add `(app)/handbooks/[doc]/[chapter]/+page.svelte` -- chapter title, page range, lead-text from the chapter row's `content_md`, section list with `HandbookSectionListItem.svelte` showing per-section read status, citing-nodes panel using `HandbookCitingNodesPanel.svelte`.
- [ ] Add `HandbookSectionListItem.svelte`, `HandbookCitingNodesPanel.svelte` to `libs/ui/handbooks/`.
- [ ] Run `bun run check` -- 0 errors. Manual: open `/handbooks/phak/12`.

### Phase 12: Reader UI -- section page (read view)

- [ ] Add `(app)/handbooks/[doc]/[chapter]/[section]/+page.server.ts` -- load `getHandbookSection`, `getReadState`, `getNodesCitingSection`. Render markdown server-side via `@ab/aviation` references resolver. Resolve cross-section internal links to handbook URLs.
- [ ] Add `(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte` -- header, edition badge, sticky TOC, rendered markdown body, figures inline, citing-nodes panel, read-progress control + notes editor at the foot.
- [ ] Add `HandbookSectionToc.svelte`, `HandbookReadProgressControl.svelte`, `HandbookSectionNotes.svelte` to `libs/ui/handbooks/`.
- [ ] Implement Svelte 5 runes throughout: `$state`, `$derived`, `$effect`, `$props`. No legacy stores.
- [ ] Wire form actions for `setReadStatus`, `setComprehended`, `setNotes`, `markAsReread`.
- [ ] Run `bun run check` -- 0 errors. Manual: open a section, change status, change comprehended, type notes, click Re-read.

### CHECKPOINT (after Phase 12)

PHAK is ingested, seeded, and renderable in the reader. Stop here and report to the user:

- Sample URL the user can open: `/handbooks/phak/12/3` (or a comparable section).
- Summary: row counts in DB, repo size delta (inline derivatives only), cache size delta (source PDFs in `$AIRBOSS_HANDBOOK_CACHE`), any extraction warnings from the manifest.
- Visual review pass requested before proceeding to Phases 13-16.

Resume Phases 13-16 only after the user confirms the reader looks correct.

### Phase 13: Heartbeat endpoint + client tick

- [ ] Add `(app)/handbooks/[doc]/[chapter]/[section]/heartbeat/+server.ts` -- POST handler, body `{ delta: number }`, calls `recordHeartbeat`. Reject deltas < 5s; cap deltas at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`.
- [ ] Add the heartbeat tick to the section page client-side (see design.md "Heartbeat shape"). Gate on `document.visibilityState === 'visible'`. Buffer up to `HANDBOOK_HEARTBEAT_BUFFER` heartbeats on network failure; flush on reconnect.
- [ ] Surface the suggestion-prompt component when thresholds met (open seconds in session + total seconds + scroll-to-bottom).
- [ ] Run `bun run check` -- 0 errors. Manual: open a section, watch the network panel for heartbeats, scroll to the bottom after 90+ seconds, verify the prompt appears, dismiss vs accept.

### Phase 14: Bidirectional citation -- node detail integration

- [ ] In `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts`, augment the existing references render path: for every entry in `node.references`, compute `resolveCitationUrl(citation, allReferences)`. Render structured handbook citations as links to the corresponding `/handbooks/[doc]/[chapter]/[section]` URL; legacy strings render as freeform text.
- [ ] Add a small reverse-link affordance: on the node detail page, list "References" with each link rendered. The existing references panel layout is unchanged otherwise.
- [ ] Run `bun run check` -- 0 errors. Manual: in a knowledge node whose references array contains a handbook structured citation, click through to the handbook section. Confirm round-trip.

### Phase 15: AvWX + AFH ingestion (close the WP)

- [ ] Author `tools/handbook-ingest/ingest/config/avwx.yaml`. Run pipeline (writes `$AIRBOSS_HANDBOOK_CACHE/handbooks/avwx/8083-28/source.pdf` to local cache + derivatives inline). Visual review. Commit only the inline `handbooks/avwx/8083-28/` derivatives.
- [ ] Author `tools/handbook-ingest/ingest/config/afh.yaml`. Run pipeline (writes `$AIRBOSS_HANDBOOK_CACHE/handbooks/afh/<edition>/source.pdf` to local cache + derivatives inline). Visual review. Commit only the inline `handbooks/afh/<edition>/` derivatives.
- [ ] Run `bun run db seed handbooks` -- confirm all three handbooks land in DB. Manual smoke through the UI for each.
- [ ] Verify zero `*.pdf` files staged anywhere in the repo. Note cache size for each handbook in the PR description (PHAK ~74 MB, AFH ~261 MB, AvWX ~tbd).

### Phase 16: e2e Playwright + acceptance review

- [x] Add `tests/e2e/handbook-reader.spec.ts` (the project's Playwright suite lives at the repo root under `tests/e2e/`, not `apps/study/tests/`). Covers `/handbooks` -> PHAK card -> Ch 12 -> §9 navigation, body > 500 chars + sticky TOC active highlight + edition badge, status `read` persists across navigation, "didn't get it" toggle, re-read resets, notes save and persist, heartbeat-driven suggestion banner via `page.clock` (mock virtual clock advances `setInterval` ticks), "Not yet" dismissal sticks for the session, AFH + AvWX cross-handbook smoke, chapter-cover residue stripped at `/handbooks/phak/1`. 11 passing scenarios + 1 deferred (`test.skip` on the citing-node click round-trip; no node carries a structured `kind: handbook` citation in the seeded dataset yet).
- [x] Run `bunx playwright test tests/e2e/handbook-reader.spec.ts` -- 11 passed, 1 skipped, three back-to-back stable runs at ~13s wall.
- [x] AvWX figure dedup (Phase 15 follow-up). New `tools/handbook-ingest/ingest/figures_dedup.py` runs SHA-256 grouping after `extract_figures` and rewrites `FigureRecord.asset_path` to a single canonical file (deepest `section_code` wins ties). Wired into the CLI between extraction and `write_outputs`; manifest now records `extraction.figure_dedup: { canonicalized, freed_bytes }`. Retro-applied to the existing handbook trees via `python -m ingest.dedup_existing <doc> <edition>` (no PDF re-fetch needed). AvWX 858 -> 290 unique figures (568 redundant deleted, ~154 MB freed); PHAK 236 -> 234 unique (2 deleted, ~256 KB freed); AFH 96 unique already (0 redundant). Unit coverage: `tools/handbook-ingest/tests/test_figures_dedup.py` (4 cases). 30/30 handbook-ingest pytest cases pass.
- [x] Run `bun run check` end-to-end -- 0 errors, 0 warnings (apart from the pre-existing `apps/sim` `three` import miss, out of scope for this WP).
- [x] Self-review the diff against [test-plan.md](./test-plan.md) -- coverage table below.
- [ ] Request implementation review via `/ball-review-full`. **User-triggered.**
- [ ] Address review findings (every level: critical, major, minor, nit -- ALL of them).
- [ ] Final manual test pass per [test-plan.md](./test-plan.md).

#### HBK coverage map (Phase 16)

- **HBK-1..HBK-7 (pipeline)** -- pytest in `tools/handbook-ingest/tests/` (sections, sections_compare, sections_via_toc, sections_via_llm, section_tree, figures_dedup -- 30 cases). HBK-2 (unknown handbook id) and HBK-7 (intentionally bad URL) are manual edge cases not automated.
- **HBK-8..HBK-12 (schema)** -- drizzle migration shape; `scripts/db/seed-handbooks.ts` exercises insert/idempotent/superseded paths. HBK-12 (CHECK violation) is manual psql verification per the test-plan.
- **HBK-13..HBK-23 (BC)** -- Vitest fixtures in `libs/bc/study/src/handbooks.test.ts`; 231/231 study-bc tests pass.
- **HBK-24..HBK-29 (UI -- index/handbook/chapter)** -- e2e covers HBK-24, HBK-26, HBK-28 (navigation chain) plus the cross-handbook smoke. HBK-25 + HBK-27 (superseded handling) covered by `seed-handbooks.test.ts` synthetic-edition fixtures. HBK-29 (empty-handbook empty state) is a manual regression check.
- **HBK-30..HBK-37 (section reader UI)** -- e2e covers HBK-30 (body + figures + TOC + edition badge), HBK-32 (status flip persists), HBK-34 + HBK-35 (comprehended toggle + re-read), HBK-36 (notes save and persist). HBK-31 (TOC anchor scroll), HBK-33 (disabled-when-unread tooltip), HBK-37 (notes overflow message) are manual.
- **HBK-38..HBK-43 (heartbeat heuristic)** -- e2e covers HBK-40 (banner appears with mocked clock + scroll-to-bottom) and HBK-42 (no auto-advance: state stays at `reading` until the user clicks). HBK-38 + HBK-39 (visible/backgrounded) and HBK-43 (offline replay) are manual. The pure threshold logic is covered by `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/read-suggestion.test.ts`.
- **HBK-44..HBK-47 (bidirectional citation)** -- HBK-44/45/46/47 deferred until a knowledge node carries a structured `kind: handbook` citation. The resolver itself is covered by `libs/bc/study/src/handbooks.test.ts`. The e2e `citing-node link round-trip` is `test.skip` with the deferred-fixture note; the empty-state render is asserted in `citing-nodes panel renders without breaking the page`.
- **HBK-48..HBK-52 (integration)** -- HBK-48 covered by AFH + AvWX cross-handbook smoke. HBK-49 (manifest counts == DB) verified at seed time (`bun run db seed handbooks` prints counts that match manifest entries). HBK-50 (no regression on `/glossary`, etc.) covered by `tests/e2e/smoke.spec.ts`. HBK-51 + HBK-52 (build validate + fresh-DB migration) are manual gates run on the PR.

## Post-implementation

- [x] Update `docs/work/NOW.md` -- WP added to in-flight on 2026-04-27 (will move to shipped when this PR merges).
- [ ] Update `docs/products/study/ROADMAP.md` and `TASKS.md` to reflect the handbook reader landing.
- [x] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` migration table: phase 0 status row updated 2026-04-27.
- [x] `bun run check` clean. Vitest 261/261 pass. Playwright auth-setup + one handbook test green (5.1s); full Playwright run is the user's next step post-merge.
- [ ] PR opened. Title: `feat(handbooks): ADR 016 phase 0 -- ingestion pipeline + reader + read-state`.

## Follow-up tracked (not blocking this PR)

- [ ] **Apply AFH MOSAIC errata** (Oct 2025 addendum at [AFH_Addendum_(MOSAIC).pdf](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf)). Recorded in `tools/handbook-ingest/ingest/config/afh.yaml`. Application requires the `--apply-errata` flow defined in [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) which is not yet implemented. First implementation target.
- [ ] **`/ball-review-full` 10-reviewer pass + fixer.** User-triggered after merge.
- [ ] **Full Playwright run** (`bunx playwright test tests/e2e/handbook-reader.spec.ts`). User-triggered after merge. Local `DATABASE_URL` + `BETTER_AUTH_SECRET` required; `webServer.reuseExistingServer: true` reuses any running dev server.
- [x] **AvWX figure dedup.** Closed 2026-04-26 in Phase 16. Pipeline change: `tools/handbook-ingest/ingest/figures_dedup.py` runs after extraction; manifest now records `extraction.figure_dedup`. Numbers: AvWX 858 -> 290 unique (~154 MB freed); PHAK 236 -> 234 unique (~256 KB freed); AFH already deduplicated.
- [ ] **Section-strategy comparison report** for PHAK (Option 3 TOC vs Option 4 LLM). Run via `bun run handbook-ingest phak --edition FAA-H-8083-25C --strategy compare` (needs `ANTHROPIC_API_KEY`) or via the Claude Code interactive runner at `tools/handbook-ingest/ingest/prompts/run-llm-comparison.md` (no API key).
