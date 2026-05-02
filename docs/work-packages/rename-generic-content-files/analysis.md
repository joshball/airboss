---
title: 'Analysis: Rename generic content files (Option D)'
product: platform
feature: rename-generic-content-files
type: analysis
status: unread
review_status: pending
---

# Analysis: Rename generic content files (Option D)

This is a SPIKE analysis. The actual work package spec is deferred until the user signs off on the rename. Spike artifacts (before/after sample chapters with `_diff.md` per sample) live under [spike-results/](./spike-results/).

## 1. Executive summary

Option D renames every `index.md` and `document.md` in the inline derivative tree (`handbooks/`, `aim/`) to a self-describing filename, and renames every chapter / section directory to embed its slug. AIM `paragraph-N.md` files are renamed to `NN-<paragraph-slug>.md`. Errata pairings (`<file>.md` + `<file>.errata.md`) are preserved as a unit. Cost: ~2,600 markdown files moved, every `body_path` in every committed `manifest.json` rewritten, ~12 lines of TS/Python rewritten in two ingest pipelines, ~10 test fixtures touched, and one large committed-content commit. Win: every IDE tab and every `find` / `rg` hit names what it is. The rename is mechanically simple but commit-large and crosses the source-of-truth boundary in two emitter pipelines (Python handbook ingest + TS AIM ingest), so both must change in lockstep.

## 2. Status quo by corpus

### 2.1 PHAK (`handbooks/phak/FAA-H-8083-25C/`)

Chapter-aware shape. 17 chapters numbered `01..17`, each a directory.

```text
handbooks/phak/FAA-H-8083-25C/
  01/
    index.md                                     <- chapter overview, with frontmatter
    01-introduction.md                           <- top-level section (NN-<slug>)
    02-history-of-flight.md
    02-04-department-of-transportation-dot.md    <- nested section (NN-MM-<slug>)
    04-aircraft-classifications-and-ultralight-vehicles.errata.md   <- errata pair
    04-aircraft-classifications-and-ultralight-vehicles.md
    _chapter_plaintext.txt                       <- LLM debug artifact
    _llm_disagreements.json
    _llm_section_tree.json
    _model_self_report.txt
  02/
    ...
  manifest.json                                  <- handbook manifest (PR #242 schema)
  figures/
  tables/
```

- 17 chapter `index.md` files (one per chapter dir).
- 833 `NN-...md` section files across all chapters (sample: chapter 02 has 51 sections).
- Errata pairs in 9 chapters; total `*.errata.md` count for PHAK: a subset of the 20 errata files in the repo. Sibling `.md` always exists.
- `_*.txt` / `_*.json` files at chapter level are extraction debug outputs (not user-facing). Keep names as-is.
- Chapter `index.md` has YAML frontmatter (`handbook`, `edition`, `chapter_number`, `section_title`, `faa_pages`, `source_url`).
- Section `.md` files have YAML frontmatter (same fields plus `section_number`).

### 2.2 AFH (`handbooks/afh/FAA-H-8083-3C/`)

Same chapter-aware shape as PHAK. 18 chapters. **Correction to the brief:** every AFH chapter directory does contain an `index.md`. The brief stated "AFH does NOT have an index.md, only sections" -- that is incorrect for the current state of the repo (verified by `find handbooks/afh -name 'index.md' | wc -l` returning 18). AFH and PHAK rename identically.

- 18 chapter `index.md`.
- 513 section `.md` files.
- Errata pairs present (e.g. `02-preflight-assessment-of-the-aircraft.errata.md`). The errata convention is the same as PHAK.
- Frontmatter: same shape as PHAK.

### 2.3 AVWX (`handbooks/avwx/FAA-H-8083-28B/`)

Same shape. 28 chapters.

- 28 chapter `index.md`.
- 452 section `.md` files.
- No errata files (matches `docs/work-packages/source-cache-flat-naming/spec.md` line 60: "AVWX has no published errata as of 2026-04-29").
- Frontmatter: same shape.

### 2.4 AIM (`aim/2026-04/`)

Different shape: chapter / section / paragraph triplet in nested directories.

```text
aim/
  2026-04/
    appendix-1.md                                <- top-level appendix (3 of these)
    appendix-2.md
    appendix-3.md
    glossary/
      <slug>.md                                  <- 297 flat term files
    chapter-1/
      index.md                                   <- chapter overview, no frontmatter
      section-1/
        index.md                                 <- section overview, no frontmatter
        paragraph-1.md
        paragraph-2.md
        ...
        paragraph-31.md
      section-2/
        ...
    manifest.json
```

File count for AIM:

- 10 chapter dirs (`chapter-1` .. `chapter-10`).
- 38 section dirs (varies per chapter).
- 48 `index.md` (10 chapter + 38 section).
- 396 `paragraph-N.md` (max paragraph number observed: 31; 2-digit padding sufficient).
- 3 appendix files (flat siblings of chapter dirs).
- 297 glossary files (already self-named, not affected by Option D).
- AIM `index.md` has NO frontmatter -- the body is just `# <Title>`. Verified: `head -1 aim/2026-04/chapter-7/section-1/index.md` returns `# Meteorology` and that's the entire file or nearly so.
- Paragraph files have `# <Title>\n\n<body>` shape, no frontmatter.

The brief stated "~850 `index.md` files" for AIM. Actual is 48. The 850 figure appears to have been a miscount.

### 2.5 Whole-doc handbooks (`handbooks/<slug>/<edition>/document.md`)

Five in scope (AMT-G + AMT-P deferred per the brief):

| slug                  | edition         | bytes (approx)   |
| --------------------- | --------------- | ---------------- |
| `risk-management`     | `FAA-H-8083-2A` | ~plaintext body  |
| `ifh`                 | `FAA-H-8083-15B`| "                |
| `iph`                 | `FAA-H-8083-16B`| "                |
| `aviation-instructor` | `FAA-H-8083-9`  | "                |
| `tips-mountain-flying`| `MTN-2003`      | "                |

- One `document.md` per edition.
- One `manifest.json` per edition (whole-doc kind, with top-level `body_path`).
- `document.md` has NO frontmatter -- just raw extracted text.

The brief mentioned "~271 of these total when AMT is included." The actual count is 7 (5 + 2 deferred). The 271 figure is unrelated to whole-doc handbooks; perhaps it was a different metric.

### 2.6 Out of brief scope but adjacent (CFR / regs, AC, ACS)

For completeness (these are NOT renamed by this WP):

| corpus | shape                                                  | notes                                                    |
| ------ | ------------------------------------------------------ | -------------------------------------------------------- |
| CFR    | `regulations/cfr-<title>/<edition>/<part>/index.md`   | regs derivative writer also uses `index.md`. Out of scope per brief: "CFR / regulations: JSON-based, NOT affected." Treat as a future Option D extension. |
| AC     | `ac/<doc>/<rev>/document.md`                           | AC ingest writes `document.md` (`libs/sources/src/ac/ingest.ts:340`). Same generic-name issue. NOT in this WP per the brief, but worth flagging. |
| ACS    | `acs/<doc>/area-<NN>/task-<L>.md`                      | Already self-describing; no rename needed.               |

## 3. Option D, detailed

### 3.1 Naming rules (precise)

| Concept              | Before                                          | After                                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| chapter directory    | `<NN>/`                                         | `<NN>-<chapter-slug>/`                                     |
| chapter overview     | `<chapter-dir>/index.md`                        | `<chapter-dir>/00-<chapter-slug>.md`                       |
| section file (top)   | `<NN>-<section-slug>.md` (already conformant)   | unchanged                                                  |
| section file (nested)| `<NN>-<MM>-<section-slug>.md` (conformant)      | unchanged                                                  |
| errata sibling       | `<basename>.errata.md`                          | unchanged (always pairs with `<basename>.md`)              |
| AIM chapter dir      | `chapter-<N>/`                                  | `<NN>-<chapter-slug>/`                                     |
| AIM section dir      | `section-<N>/`                                  | `<NN>-<section-slug>/`                                     |
| AIM section overview | `<section-dir>/index.md`                        | `<section-dir>/00-<section-slug>.md`                       |
| AIM paragraph        | `paragraph-<N>.md`                              | `<NN>-<paragraph-slug>.md`                                 |
| AIM appendix         | `appendix-<N>.md`                               | unchanged (already self-naming, file-not-dir scope)        |
| AIM glossary term    | `glossary/<term-slug>.md`                       | unchanged                                                  |
| whole-doc body       | `document.md`                                   | `<edition>-handbook.md`  (proposed; alternatives in 3.4)   |

### 3.2 Slug rule

Inherit from `tools/handbook-ingest/ingest/normalize.py:_title_slug`:

1. Lowercase the title.
2. Replace runs of non-`[a-z0-9]` with `-`.
3. Strip leading/trailing `-`.
4. Truncate to 48 characters.
5. If the result is empty, use `'section'`.

Articles ARE kept (`03-the-role-of-the-faa.md`, `08-the-decision-making-process.md` -- existing convention).

The 48-char truncation is already in the wild and produces some visible truncations (`05-11-how-to-choose-a-certificated-flight-instructor-c.md`). Option D inherits this; revisiting the cap is out of scope (would require renaming every existing section file, not just the index/document files).

### 3.3 Numbering rule for AIM paragraphs

Zero-pad to 2 digits. Max observed paragraph number is 31 across all 38 AIM sections (verified). `paragraph-1.md` -> `01-<slug>.md`, `paragraph-31.md` -> `31-<slug>.md`. If a future AIM publishes >99 paragraphs in a section, bump to 3-digit padding (revisit at that point; not a today problem).

### 3.4 Whole-doc filename: alternatives

`document.md` is generic. Five options considered:

| Option | Example                                          | Pros                                  | Cons                                        |
| ------ | ------------------------------------------------ | ------------------------------------- | ------------------------------------------- |
| A      | `<edition>-handbook.md`                          | self-describing, sortable             | edition is already in parent dir            |
| B      | `<slug>-<edition>.md` (`risk-management-FAA-H-8083-2A.md`) | most self-describing                  | redundant w/ parent                         |
| C      | `<slug>.md` (`risk-management.md`)               | concise                               | redundant w/ parent dir                     |
| D      | `<edition>.md` (`FAA-H-8083-2A.md`)              | matches handbook PDF cache convention | not obvious it's markdown body, not a PDF   |
| E      | `body.md`                                        | follows the pattern in the test files | still generic                               |

Recommendation in the spec, when written: **Option A (`<edition>-handbook.md`)**. It mirrors how the handbook source cache is named (`<edition>.pdf`), suffix `-handbook` makes the role obvious, and the edition is self-referential without parent-dir context (`grep -r 'FAA-H-8083-2A-handbook'` finds it).

### 3.5 Edge cases addressed

- **Errata pairing:** `<basename>.md` + `<basename>.errata.md` move together. Pairs identified by basename equality minus `.errata` infix. The migration script must validate that no `.errata.md` is stranded.
- **Chapter with no index.md (claimed for AFH):** does not exist in the current repo. All AFH chapters have `index.md`. If a future chapter ingest produces no overview, the rename rule for that chapter is "rename directory only, no `00-*.md` to create."
- **AIM paragraph with no slug:** every observed paragraph in `aim/2026-04/manifest.json` has a non-empty `title`. The slug rule's empty-result fallback (`'section'`) is sufficient if a future AIM ever publishes a numbered-only paragraph.
- **Whole-doc handbooks with no chapters:** they have one body file (`document.md`); the chapter rename rules do not apply. Only the body filename changes.
- **Cross-doc markdown links between content files:** `grep -rn '](\./|](../' handbooks/ aim/` returns zero hits. Content files do not link to other content files via relative paths. Safe.
- **Frontmatter:** PHAK / AFH / AVWX have YAML frontmatter; the rename does not touch file contents (only the filename), so frontmatter is preserved verbatim. AIM and whole-doc files have no frontmatter, also unaffected.
- **`_*.txt` / `_*.json` debug files in chapter dirs:** Not renamed. They live alongside the renamed `00-<slug>.md` and continue to work because the ingest pipeline does not depend on their names being a particular shape.
- **AIM appendices and glossary:** not affected. Already self-naming.
- **AIM chapter dir vs section dir rename (judgment call):** the brief is silent on AIM directory naming. Two consistent choices (rename both layers vs keep `chapter-N`/`section-M`). The spike artifact picks "rename both layers" for consistency with handbooks. See `spike-results/aim-ch07-sec1/_diff.md` for the full reasoning. The user should decide before the spec is written.

### 3.6 Spike artifacts

- `spike-results/before/phak-ch02/` -- 65 files, the full PHAK chapter 02 directory.
- `spike-results/after/phak-ch02/02-aeronautical-decision-making/` -- same 65 files, `index.md` -> `00-aeronautical-decision-making.md`.
- `spike-results/before/afh-ch02/` -- 34 files, the full AFH chapter 02 directory (with errata pair).
- `spike-results/after/afh-ch02/02-ground-operations/` -- same 34 files, `index.md` -> `00-ground-operations.md`.
- `spike-results/before/aim-ch07-sec1/` -- 32 files, the full AIM chapter-7/section-1 directory.
- `spike-results/after/aim-ch07-sec1/07-safety-of-flight/01-meteorology/` -- same 32 files, `index.md` -> `00-meteorology.md`, paragraphs renumbered with title slugs.

Each sample has a `_diff.md` next to its before/after pair listing every rename.

## 4. Code-side audit

The audit was run against `libs/`, `scripts/`, `apps/`, `tools/handbook-ingest/`, and the test files. Hits are categorized as:

- **trivial** -- a string change, no logic
- **logic** -- the filename appears in conditionals, special-cases, or generated paths
- **external** -- e.g. user-facing URLs, generated seed data the user has on disk

### 4.1 Hits referencing `index.md`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.ts:227` | logic | Writes the chapter `index.md` -- must change to `00-<slug>.md` and accept the chapter title. |
| `libs/sources/src/aim/source-ingest.ts:234` | logic | Sets `body_path` to `aim/.../chapter-<N>/index.md`. New shape: `aim/.../<NN>-<slug>/00-<slug>.md`. |
| `libs/sources/src/aim/source-ingest.ts:243` | logic | Section `index.md` -- same change for sections. |
| `libs/sources/src/aim/source-ingest.ts:250` | logic | Section `body_path`. |
| `libs/sources/src/aim/source-ingest.ts:259` | logic | Paragraph `paragraph-<N>.md` -> `<NN>-<slug>.md`. |
| `libs/sources/src/aim/source-ingest.ts:266` | logic | Paragraph `body_path`. |
| `libs/sources/src/aim/source-ingest.ts:29-31` | trivial | Doc-comment example paths. |
| `libs/sources/src/aim/derivative-reader.ts:7-9` | trivial | Doc-comment example paths. The reader itself uses `body_path` from the manifest, so no logic change. |
| `libs/sources/src/handbooks/derivative-reader.ts:130` | trivial | Comment about chapter `index.md`. |
| `libs/sources/src/regs/resolver.ts:180` | logic | `regs/cfr-<title>/<edition>/<part>/index.md`. Out of brief scope (regs is JSON-derived per the brief), but flagged for completeness; see open question 6. |
| `libs/sources/src/regs/derivative-writer.ts:137` | logic | Same regs `index.md`. Out of brief scope. |
| `libs/sources/src/diff/body-hasher.ts:101` | logic | Hashes regs body via `<edition>/<part>/index.md`. Out of brief scope. |
| `libs/bc/study/src/manifest-validation.ts:93` | trivial | Comment: `NULL on a chapter-level index.md`. |
| `tools/handbook-ingest/ingest/normalize.py:182` | logic | Python pipeline writes `<chapter>/index.md`. Must change to `<chapter-dir>/00-<slug>.md` and pass title in. |
| `tools/handbook-ingest/ingest/apply_errata.py:430` | logic | Special-cases `if md_path.name == "index.md"` (errata-vs-overview branch). Must update to `00-<slug>.md`. |
| `tools/handbook-ingest/ingest/normalize.py:178` | trivial | Docstring referencing `index.md`. |
| `tools/handbook-ingest/ingest/normalize.py:215` | trivial | Comment about cover-page residue in `index.md`. |
| `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md:73` | external | Prompt-out instruction "Do NOT write the chapter's `index.md`". Must update wording to match new chapter overview filename. |
| `scripts/sources/config/handbooks/afh.yaml:113` | trivial | Comment. |
| `scripts/sources/config/handbooks/avwx.yaml:95` | trivial | Comment. |
| `scripts/sources/register/handbooks-extras.ts:21` | trivial | Comment. |
| `scripts/sources/register/ac.ts:14` | trivial | Comment for AC pipeline (out of scope but mentioned). |
| `scripts/build-knowledge-index.ts:712` | external | `course/knowledge/graph-index.md` -- different file (not a content `index.md`). NOT affected. |
| `scripts/dev.ts:33,109,118` | external | Same `graph-index.md`. NOT affected. |
| `tools/handbook-ingest/README.md:212` | trivial | Doc layout block. |

### 4.2 Hits referencing `document.md`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/handbooks-extras/ingest.ts:294` | logic | Writes the whole-doc body. Change `document.md` -> `<edition>-handbook.md`. |
| `libs/sources/src/handbooks-extras/ingest.ts:307` | logic | Sets `body_path` to `handbooks/<slug>/<edition>/document.md`. Update string. |
| `libs/sources/src/handbooks-extras/ingest.ts:25` | trivial | Doc-comment. |
| `libs/sources/src/handbooks-extras/ingest.ts:408` | trivial | Comment. |
| `libs/sources/src/handbooks-extras/derivative-reader.ts:16` | trivial | Doc-comment. |
| `libs/sources/src/ac/ingest.ts:340` | logic | AC pipeline writes `document.md`. Out of brief scope (AC not in the renaming list), but the same generic-name issue. See open question 6. |
| `libs/sources/src/ac/ingest.ts:357` | logic | AC `body_path`. |
| `libs/sources/src/ac/ingest.ts:14` | trivial | Doc-comment. |
| `libs/sources/src/ac/derivative-reader.ts:8` | trivial | Doc-comment. |
| `libs/bc/study/src/manifest-validation.ts:344` | trivial | Comment: "Body lives in a single file (`document.md`)". |

### 4.3 Hits referencing `paragraph-N.md`, `chapter-N/`, `section-N/`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.ts:225,241,257` | logic | Constructs `chapter-<N>` and `section-<M>` directories. Must change to slugged dir names. |

The `chapter-N` / `section-N` strings exist in `apps/study/src/lib/help/content/bodies/...` and in `scripts/migrate-lessons.ts` -- but those are eCFR URL fragments, not file paths. NOT affected.

### 4.4 Test-file hits (logic-equivalent updates)

These test files have hardcoded paths that match the on-disk filenames. They must be updated to match the new convention to keep the suite passing.

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.test.ts:317-319,353-354` | logic | Asserts on `chapter-1/index.md`, `paragraph-1.md`. Update to new shape. |
| `libs/sources/src/aim/derivative-reader.test.ts:105` | logic | `chapter-5/section-1/paragraph-7.md` fixture path. |
| `libs/sources/src/handbooks-extras/ingest.test.ts:337` | logic | Asserts `document.md` written. |
| `libs/sources/src/handbooks-extras/ingest.test.ts:359` | logic | Asserts `body_path` ends with `document.md`. |
| `libs/bc/study/src/manifest-validation.test.ts:44,68,75,82,116` | logic | Test fixtures with hardcoded `body_path` strings. |
| `scripts/db/seed-references-from-manifest.test.ts:200,220,268-270,294,301,308,370,390` | logic | Multiple hardcoded `body_path` and write-file paths. |

### 4.5 Documentation hits

These describe the old layout in docs / READMEs and need updating in the same WP so docs and reality stay in sync (per "Update docs as part of the work, not as a separate task").

- `tools/handbook-ingest/README.md:212` -- chapter layout block.
- `docs/work-packages/handbook-ingestion-and-reader/` spec / tasks may mention the old layout.
- Any per-feature docs that show `index.md` paths in examples.

### 4.6 Hits considered and discarded as not load-bearing

- `course/knowledge/graph-index.md` (`scripts/build-knowledge-index.ts`, `scripts/dev.ts`) -- different `index.md` (knowledge graph, not handbook content). Not affected.
- `apps/study/src/lib/help/content/bodies/...` `chapter-I` / `section-NN` URL fragments -- eCFR external URL paths, not file paths.
- `scripts/sources/inventory.ts` `chapter-${n}-` -- URL anchor fragment for the FAA handbook scraping page, not a file path.
- `tools/handbook-ingest/ingest/aim_html_extract.py` `class="paragraph-title"` -- HTML class name, unrelated to filenames.

## 5. Migration plan sketch

The rename script (TS, throwaway, deleted in same PR like `source-cache-flat-naming` did with `migrate-cache-flat.ts`) does:

### 5.1 For each chapter-aware handbook (PHAK, AFH, AVWX)

1. Read `<doc>/<edition>/manifest.json`.
2. For each `sections[]` entry where `level === 'chapter'`:
   - Extract `code` and `title`.
   - Derive `slug` from `title` via the slug rule.
   - Compute new dir: `<doc>/<edition>/<NN>-<slug>/` (NN = `code` zero-padded to 2).
   - Compute new overview filename: `00-<slug>.md`.
   - `mv <doc>/<edition>/<NN>/index.md <doc>/<edition>/<NN>-<slug>/00-<slug>.md`.
   - For every other file under `<NN>/` (sections, errata, debug `_*` files, `figures/`, `tables/`): `mv` to the new chapter dir, keeping the basename.
3. After all chapters renamed, rewrite `manifest.json`:
   - For every `body_path`, replace the `<NN>/` segment with `<NN>-<slug>/` and replace `index.md` with `00-<slug>.md` if applicable.

### 5.2 For AIM

1. Read `aim/<edition>/manifest.json`.
2. For each `entries[]` entry, derive new `body_path` based on entry kind (chapter / section / paragraph / appendix / glossary). Build a mapping from old path to new path.
3. Rename directories `chapter-<N>` -> `<NN>-<chapter-slug>` and `section-<N>` -> `<NN>-<section-slug>` (using titles from the manifest).
4. Rename files: `index.md` (chapter) -> `00-<chapter-slug>.md`; `index.md` (section) -> `00-<section-slug>.md`; `paragraph-<N>.md` -> `<NN>-<paragraph-slug>.md`.
5. Rewrite `manifest.json` `body_path` fields.

### 5.3 For whole-doc handbooks

For each of the 5 in-scope handbooks (`risk-management`, `ifh`, `iph`, `aviation-instructor`, `tips-mountain-flying`):

1. Read manifest's `body_path` and `edition`.
2. New filename: `<edition>-handbook.md` (or whatever option 3.4 lands on).
3. `mv <doc>/<edition>/document.md <doc>/<edition>/<edition>-handbook.md`.
4. Rewrite manifest `body_path`.

### 5.4 Code changes (in lockstep with the file moves)

- `tools/handbook-ingest/ingest/normalize.py:_resolve_output_path` rewrites the chapter overview path. Must accept `node.title` to produce `00-<slug>.md`.
- `tools/handbook-ingest/ingest/apply_errata.py:430` updates the special-case from `if md_path.name == "index.md"` to a regex/equality check against the new shape.
- `libs/sources/src/aim/source-ingest.ts:225-266` -- rewrite the path construction and `body_path` strings.
- `libs/sources/src/handbooks-extras/ingest.ts:294,307` -- rewrite the `document.md` writer.
- All affected test files updated to match the new fixture shapes.
- The doc-comment trivial hits updated for accuracy.

### 5.5 Mechanical vs human-review

- **Mechanical:** every file `mv`, every manifest `body_path` rewrite, every test fixture update, every comment update. Driven by the migration script + a small codemod for tests.
- **Human review:** the chosen whole-doc filename (Option A vs B/C/D/E in 3.4), the AIM directory-rename judgment call (rename both layers vs keep `chapter-N`/`section-M`), whether to extend Option D to AC and CFR (4.6, open question 6).

## 6. Cost estimate

NO TIME ESTIMATES. Scope by counts:

| Item                                               | Count                                         |
| -------------------------------------------------- | --------------------------------------------- |
| Markdown files moved                               | ~2,630 (every `.md` in `handbooks/` + `aim/`) |
| Chapter directories renamed (handbooks)            | 17 + 18 + 28 = 63                             |
| AIM chapter directories renamed                    | 10                                            |
| AIM section directories renamed                    | 38                                            |
| `index.md` -> `00-<slug>.md` renames               | 17 + 18 + 28 + 48 = 111                       |
| `document.md` -> `<edition>-handbook.md` renames   | 5                                             |
| AIM `paragraph-N.md` -> `<NN>-<slug>.md` renames   | 396                                           |
| Errata files moved (no rename, just dir change)    | 20                                            |
| Manifest `body_path` rewrites                      | ~3,500 entries across 12 manifests            |
| Production TS/Python emitter LOC changed           | ~12 (concentrated in 2 files)                 |
| Test fixture updates                               | ~25 hardcoded path strings across 6 test files|
| Doc-comment updates                                | ~15 sites                                     |

### 6.1 Risk areas

| Risk | Mitigation |
| --- | --- |
| Migration runs partial, half the tree is renamed and the other half not | Migration script must be idempotent (skip if new path exists, error if both old + new exist). Same pattern as `source-cache-flat-naming`'s `migrate-cache-flat.ts`. |
| Manifests + filesystem out of sync after migration | Migration script writes manifests last, and only after all `mv`s succeed. The script asserts `existsSync` on every new path before writing the manifest. |
| Two emitter pipelines (Python ingest + TS AIM) drift | They already drift today (separate paths, no shared library). Same risk as ADR-021. Acceptance criteria: re-running ingest from scratch reproduces the new layout exactly. |
| `_*.txt` / `_*.json` debug artifacts accidentally lost in the rename | Migration script does a glob-mv of all files in the old chapter dir to the new chapter dir, not just `*.md`. |
| AIM glossary or appendix files accidentally renumbered | Migration script special-cases AIM: only files matching `paragraph-N.md` are renumbered; `glossary/*.md` and `appendix-N.md` are untouched. |
| User has uncommitted lesson seed data referencing old paths | `body_path` is sourced from manifests during seeding; after the rename, manifests carry the new paths, so re-seeding produces correct rows. |
| Open PRs in flight referencing old paths | The rename is one large commit. Open PRs rebase against it. The user runs solo, so coordination cost is minimal. |

## 7. Pros and cons

| Aspect                            | Pro                                                                               | Con                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| IDE tab readability               | Every tab title says what it is; no more 5 tabs all named `index.md`              | --                                                                           |
| `find` / `rg` UX                  | `rg ground-operations` returns the right file directly                            | Slug-truncation makes `rg`'s exact matches less reliable for long titles     |
| Git history readability           | `git log <new-path>` follows file moves cleanly; renames preserved by `git`       | One commit-large rename creates a 2,600-file diff that's hard to review     |
| Citation stability                | None of the user-facing URLs (`airboss-ref:`, `ROUTES.LIBRARY_HANDBOOK_*`) change | --                                                                           |
| Schema impact                     | None -- `body_path` is `z.string().min(1)`                                        | --                                                                           |
| Cross-doc internal links          | None to break (no relative MD links exist)                                        | --                                                                           |
| Pipeline complexity               | Same number of writes per ingest run; no new fields                               | Two emitters (Python + TS) must change in lockstep                          |
| Migration risk                    | Idempotent script + manifest rewrite is well-trodden territory (ADR-021 precedent) | A bug in the rename map silently corrupts citation lookups (mitigated by post-run verification) |
| Onboarding / discoverability      | New developer reading the tree understands the corpus structure without docs     | --                                                                           |
| Errata pairing                    | Simple rule (basename equality minus `.errata`) is automatable                   | --                                                                           |
| Whole-doc filename                | `<edition>-handbook.md` echoes cache-side `<edition>.pdf`, very symmetric        | Five filenames to bikeshed; no obviously-best choice                         |
| AIM directory rename              | Self-describing dir names mirror the file rename                                  | Adds the slug-stability concern (if a section renames in a future AIM edition, the dir path changes too) |
| Slug stability over editions      | --                                                                                | If a chapter title shifts (e.g. AIM 2026-04 vs 2026-08), the dir renames; downstream tooling that hardcodes a path breaks. Mitigation: hardcode by `code`, not path. |

## 8. Open questions

- **Whole-doc filename:** which of A / B / C / D / E in 3.4? Recommendation in the doc: A (`<edition>-handbook.md`).
- **AIM directory rename:** rename `chapter-N` / `section-N` to slugged dirs, or keep them and only rename the index file? The spike picks the slugged-dir variant; user should confirm.
- **AIM glossary scope:** brief is silent. Glossary files are already self-named (`<term-slug>.md`). Confirmed: not affected, unless the user wants to renumber them too (which makes no sense -- they're alphabetic, not ordinal).
- **AIM appendix scope:** `appendix-1.md` / `appendix-2.md` / `appendix-3.md` -- are these flat siblings of `chapter-N` dirs? Currently yes. Brief is silent. Recommendation: leave them as-is (they're already self-naming with their ordinal). If the user wants them slugged, the same rule applies -- but the title would need to be sourced from the AIM publisher's appendix label.
- **CFR / regs:** the brief excludes regs ("JSON-based, NOT affected"), but `regs/cfr-<title>/<edition>/<part>/index.md` exists in the inline derivative tree and has the same generic-name issue (`libs/sources/src/regs/derivative-writer.ts:137`). Should this be a follow-up WP? Recommendation: yes, but as its own WP -- regs is on a different ingest pipeline and has different schema constraints.
- **AC corpus:** `ac/<doc>/<rev>/document.md` has the same generic-name problem (`libs/sources/src/ac/ingest.ts:340`). Brief excluded AC explicitly. Should this WP extend to AC, or follow up separately? Recommendation: same WP, since the whole-doc rule from 3.4 applies cleanly. Adds 9 file moves and ~3 LOC.
- **Doc tree count discrepancy in the brief:** brief said "850 `index.md` in AIM" and "271 `document.md`". Actual values are 48 and 7 (5 in scope). Worth confirming the brief's source for these numbers (possibly stale or a different measure) before spec sign-off.
- **AMT deferral trigger:** brief says AMT-G + AMT-P are deferred. The same rename rules apply trivially when they're un-deferred. Should the WP include a one-liner stating "running the rename script after AMT lands re-renames AMT in place," or is that out of scope?
- **`tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md:73`** is a stored prompt that says "Do NOT write the chapter's `index.md`". After the rename, the new instruction is "Do NOT write `00-<slug>.md`." The prompts-out archives under `tools/handbook-ingest/prompts-out/` will keep the old wording in their snapshot, which is correct (those are historical artifacts of past runs). Confirm: do not rewrite archived prompts.
