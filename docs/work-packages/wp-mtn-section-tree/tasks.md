---
title: 'WP-MTN-section-tree -- tasks'
product: study
feature: wp-mtn-section-tree
type: tasks
status: unread
review_status: pending
created: 2026-05-03
---

# Tasks

Phased implementation. One commit per phase.

## Phase 0 -- Spec docs (this commit)

- [x] Spec: `docs/work-packages/wp-mtn-section-tree/spec.md`
- [x] Tasks: `docs/work-packages/wp-mtn-section-tree/tasks.md`
- [x] Test plan: `docs/work-packages/wp-mtn-section-tree/test-plan.md`

## Phase 1 -- Markdown-to-section-tree parser

- [ ] Add `parseOverrideToSectionTree(markdown: string)` in `libs/sources/src/handbooks-extras/section-tree-parser.ts`
  - Input: full override markdown string
  - Output: `{ title: string; chapters: ParsedChapter[] }` where `ParsedChapter` carries `slug`, `title`, `body` (overview prose), `sections: ParsedSection[]`. `ParsedSection` carries `slug`, `title`, `body`.
  - Slug shape: lowercase ASCII, hyphen-separated, derived from heading text (lowercased, punctuation stripped, whitespace -> hyphen, collapsed).
  - Reject `####` and deeper headings (parser strict-mode error).
  - Reject duplicate chapter slugs within the doc; reject duplicate section slugs within a chapter.
  - Pure function; no IO.
- [ ] Unit tests for the parser in `libs/sources/src/handbooks-extras/section-tree-parser.test.ts`:
  - Happy path: 12 chapters with mixed subsections (the actual mtn-tips override).
  - Heading hierarchy: `#`, `##`, `###`, with body prose between.
  - Empty chapter (heading + no body) is allowed.
  - Chapter with no sections (only overview body) is allowed.
  - Reject H4 (`####`) heading.
  - Reject duplicate chapter slug.
  - Reject zero `#` heading (no document title).
  - Reject zero `##` headings (parser says "not a section-tree, fall back").

## Phase 2 -- Extend `handbooks-extras` ingest with section-tree branch

- [ ] In `libs/sources/src/handbooks-extras/ingest.ts`:
  - When `bodyOverridePath !== null`, parse the override. If `parseOverrideToSectionTree` reports "no section structure" (zero `##` headings), fall through to existing whole-doc behaviour.
  - Otherwise:
    - Build `manifest.sections[]` (chapter rows + section rows).
    - Slugify each chapter / section heading. Chapter dir: `<NN>-<chapter-slug>`. Chapter overview file: `00-<chapter-slug>.md`. Section file: `<NN>-<section-slug>.md`.
    - Write per-chapter overview + per-section bodies via `writeIfChanged`.
    - Compute SHA-256 per file; populate `content_hash` on each section row.
    - Emit a `kind: 'handbook'` manifest matching `sectionTreeManifestSchema`.
    - Remove any pre-existing whole-doc `<slug>-<faaDir>.md` body file that the previous ingest run wrote.
- [ ] Update `ExtrasManifestFile` (or introduce a parallel `ExtrasSectionTreeManifestFile`) so `derivative-reader.ts` can describe the new shape if any internal consumer touches it. Audit consumers: `handbooks-extras-index.json` writer (no change -- it reads `title` + `slug` + `manifest_path` only).
- [ ] Unit tests in `libs/sources/src/handbooks-extras/ingest.test.ts`:
  - Fixture with a structured override emits `kind: 'handbook'` manifest with non-empty `sections[]`.
  - Per-chapter + per-section markdown files exist on disk.
  - Idempotent (re-run produces byte-equal output).
  - Fixture with a flat override (no `##`) emits `kind: 'whole-doc'` manifest unchanged.
  - Stale single-body file is cleaned up when promoting from whole-doc to section-tree.

## Phase 3 -- Re-ingest mtn-tips and commit derivatives

- [ ] Run `bun run sources register handbooks-extras --include-handbooks-extras` (or the equivalent CLI invocation) against the live cache.
- [ ] Inspect `handbooks/tips-mountain-flying/MTN-2003/manifest.json` -- verify `kind: 'handbook'`, sections array, body paths, content hashes.
- [ ] Inspect per-chapter markdown -- verify content split, no missing prose, no duplicate body.
- [ ] Stage the new files.
- [ ] Verify the old `tips-mountain-flying-MTN-2003.md` is deleted.

## Phase 4 -- Manifest validation + seed adapter sanity

- [ ] Run `bun test libs/bc/study/src/manifest-validation.test.ts` -- existing schema covers the new manifest unchanged. If any test asserts whole-doc-only behaviour for tips-mountain-flying (none expected), update it.
- [ ] Run `bun test libs/bc/study/src/seeders/` -- the section-tree seeder is unchanged, but the integration suite (if any) covering manifest dispatch should still pass.

## Phase 5 -- DB reseed + acceptance probe

- [ ] `bun run db reset --force && bun run db seed`
- [ ] Query `study.reference` for `document_slug='tips-mountain-flying'`: assert one row, `kind='handbook'`, `section_schema = { levels: ['chapter','section','subsection'], strict_sequence: true }`, subjects `[performance, weather, emergencies]`, primary_cert null.
- [ ] Query `study.reference_section WHERE reference_id = <mtn-id>`: assert > 12 rows (12 chapters + N sections).
- [ ] Run `getReadableReferenceIds([mtn-id])` -- assert it returns the id.
- [ ] Visit `/library` and `/library/handbook/tips-mountain-flying/mtn-2003`: chapter drill-down renders, individual chapter / section bodies render.

## Phase 6 -- Doc updates

- [ ] Flip the mtn-tips row in `docs/platform/REFERENCES.md` from "⚠️ readable, whole-doc" to "✅ readable, section-tree" with chapter / section count.
- [ ] Update `docs/work-packages/library-completeness/status.md` row 2 (WP-MTN) to note the section-tree promotion shipped.
- [ ] Update spec frontmatter to `status: shipped`, `review_status: done` after merge.

## Phase 7 -- Final verification

- [ ] `bun run check` -- 0 errors, 0 warnings.
- [ ] `bun test libs/sources/src/` -- all green.
- [ ] `bun test libs/bc/study/src/` -- all green.
- [ ] Push branch and open PR.
- [ ] After review, squash-merge.
