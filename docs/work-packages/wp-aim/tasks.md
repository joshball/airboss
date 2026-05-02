---
title: 'WP-AIM -- task list'
type: tasks
status: done
---

# Tasks

## Phase 1 -- manifest schema

- [x] Add `aimManifestSchema` to `libs/bc/study/src/manifest-validation.ts` (discriminator `kind: 'aim'`).
- [x] Each entry: `kind` ('chapter' | 'section' | 'paragraph' | 'appendix' | 'glossary'), `code` (string), `title` (string), `body_path` (repo-relative), `content_hash` (sha256 hex).
- [x] Add `subjects` (1-3 from `AVIATION_TOPIC_VALUES`, required) and `primary_cert` (nullable enum).
- [x] Add to `manifestSchema = z.discriminatedUnion('kind', [...])`.
- [x] Export `AimManifest` type.
- [x] Add a smoke test in `manifest-validation.test.ts` that validates `aim/2026-04/manifest.json`.

## Phase 2 -- seed adapter

- [x] Create `libs/bc/study/src/seeders/aim.ts` exporting `seedAimManifest(manifest, context, summary): Promise<string>`.
- [x] Set `section_schema = { levels: ['chapter','section','paragraph','appendix','glossary'], strict_sequence: false }`.
- [x] Build parent/child tree by parsing `code`:
  - Top-level: chapters (numeric code, no dash), appendices (`appendix-N`), glossary entries (`glossary/<term>`).
  - Section: parent is chapter matching code prefix before first dash.
  - Paragraph: parent is section matching `<chapter>-<section>` prefix.
- [x] Two-pass seed: build code -> sectionId map as we go; raise if a child's parent isn't found.
- [x] Write `reference_section` rows with `depth`, `level` (= entry.kind), `code`, `title`, `content_md` from the body file, `content_hash` from manifest.
- [x] Idempotent on content_hash (existing pattern from section-tree adapter).

## Phase 3 -- dispatcher wiring

- [x] Add `case 'aim'` to the discriminator switch in `scripts/db/seed-references-from-manifest.ts` -> calls `seedAimManifest`.
- [x] Add `'aim'` to `CORPUS_DIRS` so the seeder walks `aim/` as well as `handbooks/`.
- [x] Generalize the dispatcher to support both layouts: multi-doc (`<corpus>/<slug>/<edition>/manifest.json`) and single-doc (`<corpus>/<edition>/manifest.json`).

## Phase 4 -- manifest backfill + cleanup

- [x] Backfill `aim/2026-04/manifest.json` with `subjects: ['regulations', 'procedures', 'navigation']` and `primary_cert: null`.
- [x] Ensure `document_slug: 'aim'` is in the manifest (if absent).
- [x] Drop the AIM placeholder row from `course/references/aim-pcg.yaml` -- the pipeline now produces the real reference.

## Phase 5 -- verify

- [x] `bun run db reset --force` clean.
- [x] `bun run db seed` clean. One `reference` row + 744 `reference_section` rows (10 chapters / 38 sections / 396 paragraphs / 3 appendices / 297 glossary).
- [x] Spot-check: chapter 1 has its sections (1-1, 1-2); section 1-1 has its paragraphs (1-1-1..1-1-20).
- [x] `bun run check` clean.
- [x] `bun test` green (545 tests across libs/bc/study + scripts/db).

## Phase 6 -- ship

- [x] Commit, push, PR, merge, clean up worktree.

## Notes

- Manifest entry count is 744 (not 745 as the spec estimated): 10 chapters, 38 sections, 396 paragraphs, 3 appendices, 297 glossary terms. Chapter 1 has 2 sections (1-1, 1-2), not 13 -- the spec's "13 sections" line was an estimate.
- Glossary entries use `code: "glossary/<term-slug>"` (not `pilot-controller-glossary-...`); resolver-side concerns are deferred since this WP doesn't touch `libs/sources/src/aim/`.
- Added `paragraph`, `appendix`, `glossary` to `REFERENCE_SECTION_LEVELS` constants so the per-corpus level vocabulary stays declared in `libs/constants/`.
