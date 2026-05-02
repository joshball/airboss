---
title: 'WP-AIM -- task list'
type: tasks
status: in-progress
---

# Tasks

## Phase 1 -- manifest schema

- [ ] Add `aimManifestSchema` to `libs/bc/study/src/manifest-validation.ts` (discriminator `kind: 'aim'`).
- [ ] Each entry: `kind` ('chapter' | 'section' | 'paragraph' | 'appendix' | 'glossary'), `code` (string), `title` (string), `body_path` (repo-relative), `content_hash` (sha256 hex).
- [ ] Add `subjects` (1-3 from `AVIATION_TOPIC_VALUES`, required) and `primary_cert` (nullable enum).
- [ ] Add to `manifestSchema = z.discriminatedUnion('kind', [...])`.
- [ ] Export `AimManifest` type.
- [ ] Add a smoke test in `manifest-validation.test.ts` that validates `aim/2026-04/manifest.json`.

## Phase 2 -- seed adapter

- [ ] Create `libs/bc/study/src/seeders/aim.ts` exporting `seedAimManifest(manifest, context, summary): Promise<string>`.
- [ ] Set `section_schema = { levels: ['chapter','section','paragraph','appendix','glossary'], strict_sequence: false }`.
- [ ] Build parent/child tree by parsing `code`:
  - Top-level: chapters (numeric code, no dash), appendices (`appendix-N`), glossary entries (special slug).
  - Section: parent is chapter matching code prefix before first dash.
  - Paragraph: parent is section matching `<chapter>-<section>` prefix.
- [ ] Two-pass seed: build code -> sectionId map as we go; raise if a child's parent isn't found.
- [ ] Write `reference_section` rows with `depth`, `level` (= entry.kind), `code`, `title`, `content_md` from the body file, `content_hash` from manifest.
- [ ] Idempotent on content_hash (existing pattern from section-tree adapter).

## Phase 3 -- dispatcher wiring

- [ ] Add `case 'aim'` to the discriminator switch in `scripts/db/seed-references-from-manifest.ts` -> calls `seedAimManifest`.
- [ ] Add `'aim'` to `CORPUS_DIRS` so the seeder walks `aim/` as well as `handbooks/`.

## Phase 4 -- manifest backfill + cleanup

- [ ] Backfill `aim/2026-04/manifest.json` with `subjects: ['regulations', 'procedures', 'navigation']` and `primary_cert: null`.
- [ ] Ensure `document_slug: 'aim'` is in the manifest (if absent).
- [ ] If `course/references/handbooks-noningested.yaml` (or similar) holds an AIM placeholder, drop it -- the pipeline now produces the real reference.

## Phase 5 -- verify

- [ ] `bun run db reset --force` clean.
- [ ] `bun run db seed` clean. One `reference` row + 745 `reference_section` rows.
- [ ] Spot-check: chapter 1 has 13 sections; section 1-1 has its paragraphs.
- [ ] `/library` shows the AIM card as readable; chapter/section/paragraph navigation works.
- [ ] `bun run check` clean.
- [ ] `bun test` green.

## Phase 6 -- ship

- [ ] Commit, push, PR, merge, pull main, clean up worktree.
