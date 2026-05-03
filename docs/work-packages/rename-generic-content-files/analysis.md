---
title: 'Analysis: Rename generic content files (Option D)'
product: platform
feature: rename-generic-content-files
type: analysis
status: unread
review_status: pending
---

# Analysis: Rename generic content files (Option D)

This is a SPIKE analysis. The actual work package spec is written from this analysis after sign-off. Spike artifacts (before/after sample chapters with `_diff.md` per sample) live under [spike-results/](./spike-results/).

## 1. Executive summary

Option D renames every `index.md` and `document.md` in the inline derivative tree (`handbooks/`, `aim/`, `ac/`) to a self-describing filename, and renames every chapter / section directory to embed its slug. AIM `paragraph-N.md` files are renamed to `NN-<paragraph-slug>.md`. Errata pairings (`<file>.md` + `<file>.errata.md`) are preserved as a unit. Cost: ~2,640 markdown files moved, every `body_path` in every committed `manifest.json` rewritten, ~15 lines of TS/Python rewritten in three ingest pipelines, ~25 test fixtures touched, and one large committed-content commit. Win: every IDE tab and every `find` / `rg` hit names what it is. The rename is mechanically simple but commit-large and crosses the source-of-truth boundary in three emitter pipelines (Python handbook ingest, TS AIM ingest, TS handbooks-extras + AC ingest), so all three must change in lockstep.

CFR is **not** in scope (verified zero markdown files exist on disk; the dead-code emitter paths are flagged for cleanup in a future regs WP).

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
  figures/                                       <- corpus-level (sibling of chapter dirs)
  tables/                                        <- corpus-level (sibling of chapter dirs)
```

- 17 chapter `index.md` files (one per chapter dir).
- 833 `NN-...md` section files across all chapters.
- Sample directory: PHAK chapter 02 contains **65 total entries**: 61 markdown files (1 chapter overview + 60 sections / errata) + 4 debug artifacts (`_chapter_plaintext.txt`, `_llm_disagreements.json`, `_llm_section_tree.json`, `_model_self_report.txt`).
- **Errata in 5 chapters**: `01`, `03`, `06`, `09`, `17`. Verified via `find handbooks/phak/FAA-H-8083-25C -name '*.errata.md' | awk -F/ '{print $4}' | sort -u`.
- `_*.txt` / `_*.json` files at chapter level are extraction debug outputs (not user-facing). Keep names as-is.
- Chapter `index.md` has YAML frontmatter (`handbook`, `edition`, `chapter_number`, `section_title`, `faa_pages`, `source_url`).
- Section `.md` files have YAML frontmatter (same fields plus `section_number`).
- `figures/` and `tables/` are at the corpus (edition) level, not nested in chapter dirs. Not affected by this rename.

### 2.2 AFH (`handbooks/afh/FAA-H-8083-3C/`)

Same chapter-aware shape as PHAK. 18 chapters. **Correction to the brief:** every AFH chapter directory does contain an `index.md`. The brief stated "AFH does NOT have an index.md, only sections", which is incorrect for the current state of the repo (verified by `find handbooks/afh -name 'index.md' | wc -l` returning 18). AFH and PHAK rename identically.

- 18 chapter `index.md`.
- 513 section `.md` files.
- Sample directory: AFH chapter 02 contains 34 markdown files including an errata pair.
- **Errata in 4 chapters**: `01`, `02`, `04`, `06`. Verified the same way as PHAK.
- Frontmatter: same shape as PHAK.
- `figures/` is at the corpus level. AFH has no `tables/` directory. Not affected.

### 2.3 AVWX (`handbooks/avwx/FAA-H-8083-28B/`)

Same shape. 28 chapters.

- 28 chapter `index.md`.
- 452 section `.md` files.
- **No errata files.** Verified via `find handbooks/avwx -name '*.errata.md'` returning empty. Matches `docs/work-packages/source-cache-flat-naming/spec.md` line 60 ("AVWX has no published errata as of 2026-04-29").
- Frontmatter: same shape.
- `figures/` and `tables/` at corpus level. Not affected.

**Errata distribution summary:** 5 (PHAK) + 4 (AFH) + 0 (AVWX) = **9 chapters total** with errata, **20 errata files** total in the repo.

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
- AIM `index.md` has NO frontmatter; the body is just `# <Title>`. Verified: `head -1 aim/2026-04/chapter-7/section-1/index.md` returns `# Meteorology` and that's the entire file or nearly so.
- Paragraph files have `# <Title>\n\n<body>` shape, no frontmatter.

The brief stated "~850 `index.md` files" for AIM. **The actual count is 48.** Source of the 850 number unknown; treating it as a stale or miscategorized metric.

### 2.5 Whole-doc handbooks (`handbooks/<slug>/<edition>/document.md`)

All seven (AMT-G + AMT-P **included** despite ingestion-priority deferral; see §3.5 and §6.1):

| slug                  | edition         | in scope |
| --------------------- | --------------- | -------- |
| `risk-management`     | `FAA-H-8083-2A` | yes      |
| `ifh`                 | `FAA-H-8083-15B`| yes      |
| `iph`                 | `FAA-H-8083-16B`| yes      |
| `aviation-instructor` | `FAA-H-8083-9`  | yes      |
| `tips-mountain-flying`| `MTN-2003`      | yes      |
| `amt-general`         | `FAA-H-8083-30B`| yes      |
| `amt-powerplant`      | `FAA-H-8083-32B`| yes      |

- One `document.md` per edition.
- One `manifest.json` per edition (whole-doc kind, with top-level `body_path`).
- `document.md` has NO frontmatter; just raw extracted text.

The brief mentioned "~271 of these total when AMT is included." **The actual count is 7.** Source of the 271 unknown; treating as a stale metric.

### 2.6 AC corpus (`ac/<doc>/<rev>/document.md`), in scope

Per the user decision (open question 6 resolved): AC is folded into this WP. Same `document.md` problem as whole-doc handbooks; same emitter pattern.

| count | item                                          |
| ----- | --------------------------------------------- |
| 9     | `document.md` files across 9 AC docs/revisions|
| 9     | `manifest.json` files (one per `ac/<doc>/<rev>/`)|
| 1     | TS emitter file (`libs/sources/src/ac/ingest.ts`)|

The "cheap addition" framing in the spike was understated. Corrected scope: 9 file moves + 9 manifest `body_path` rewrites + 1 emitter change + AC test updates + AC doc-comment updates + spike-style verification of one rename. Bundle into the same WP because the rename rule is identical to whole-doc handbooks; running this as a separate WP later means re-litigating the same rule and re-doing the same review pass.

### 2.7 CFR / regs (out of scope, with cleanup flag)

CFR has zero markdown files on disk today. Verified: `find regulations -name '*.md'` returns empty. The brief's "JSON-based, NOT affected" claim is correct for the current state.

The reviewer flagged that `libs/sources/src/regs/derivative-writer.ts:137` and `libs/sources/src/regs/resolver.ts:180` reference `index.md` in their code. Those are **dead-code paths**: the regs ingestion pipeline does not currently exercise them. They will be cleaned up in a separate future WP (`regs-derivative-cleanup` or similar). This WP's spec MUST flag those lines so they are not forgotten.

### 2.8 ACS (out of scope, no rename needed)

ACS already self-describing: `acs/<doc>/area-<NN>/task-<L>.md`. No `index.md` or `document.md` files. Confirmed via `find acs -name 'index.md' -o -name 'document.md'`.

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
| whole-doc body       | `<doc>/<edition>/document.md`                   | `<doc>/<edition>/<slug>-<edition>.md` (Option B; see §3.4) |
| AC body              | `ac/<doc>/<rev>/document.md`                    | `ac/<doc>/<rev>/<doc>-<rev>.md` (same Option B rule)       |
| `figures/`, `tables/`| `<edition>/figures/`, `<edition>/tables/`       | unchanged (corpus-level dirs, not inside chapter dirs)     |
| Debug artifacts      | `<chapter-dir>/_*.txt`, `_*.json`               | unchanged (move with chapter dir, names preserved)         |

### 3.2 Slug rule

Inherit from `tools/handbook-ingest/ingest/normalize.py:_title_slug`:

1. Lowercase the title.
2. Replace runs of non-`[a-z0-9]` with `-`.
3. Strip leading/trailing `-`.
4. Truncate to 48 characters.
5. If the result is empty, use `'section'`.

Articles ARE kept (`03-the-role-of-the-faa.md`, `08-the-decision-making-process.md` are existing convention).

The 48-char truncation is already in the wild and produces some visible truncations (`05-11-how-to-choose-a-certificated-flight-instructor-c.md`). Option D inherits this; revisiting the cap is out of scope.

**Glossary collision check:** verified zero AIM glossary slug collisions today via `find aim/2026-04/glossary -name '*.md' | awk -F/ '{print $NF}' | sort | uniq -d`. The slug rule's 48-char truncation is safe for the current corpus. Adding a CI assertion to detect future collisions: see §5.5.

### 3.3 Numbering rule (per-corpus)

Different corpora have different code shapes. The numeric prefix in directory and filename comes from each corpus's manifest:

- **Handbooks (PHAK / AFH / AVWX):** chapter `code` is a single integer (`1`..`28`). Zero-pad to 2 digits. Section `code` for nested sections is `<chapter>-<section>` or `<chapter>-<section>-<subsection>`; the full code is encoded in the existing `<NN>-<MM>-<slug>.md` filename and stays unchanged.
- **AIM chapters:** numbered `1`..`10`. Use the chapter ordinal, zero-padded to 2: `chapter-1` -> `01-<slug>`, `chapter-10` -> `10-<slug>`.
- **AIM sections:** the manifest lists section codes like `7-1` (chapter 7 section 1). For the directory rename, use the **section ordinal within its parent chapter** (zero-padded to 2): `section-1` inside `chapter-7` -> `01-<slug>` inside `07-<chapter-slug>`. The chapter prefix is implicit in the parent dir; the section dir uses only its own ordinal.
- **AIM paragraphs:** the manifest has paragraph codes like `7-1-2`. Use the paragraph ordinal within its section, zero-padded to 2: `paragraph-1.md` -> `01-<slug>.md`. Max observed paragraph number is 31; 2-digit padding sufficient.
- **AIM appendices:** stay flat-named (`appendix-1.md`, `appendix-2.md`, `appendix-3.md`). Per user decision (open question 4).
- **Whole-doc handbooks and AC:** no numeric prefix needed (single body file per edition).

Example AIM paths after rename (chapter 7, section 1, paragraph 1):

```text
before: aim/2026-04/chapter-7/section-1/paragraph-1.md
after:  aim/2026-04/07-safety-of-flight/01-meteorology/01-altimetry.md
```

If a future AIM publishes >99 paragraphs in a section (none today), bump to 3-digit padding at that point.

### 3.4 Whole-doc filename: decision

Five options were considered in the initial spike. **Per user decision (open question 1): Option B, `<slug>-<edition>.md`** (e.g. `risk-management-FAA-H-8083-2A.md`, `tips-mountain-flying-MTN-2003.md`).

| Option | Example | Status |
| ------ | ------- | ------ |
| A | `<edition>-handbook.md` | rejected: drops the readable slug, keeps unreadable edition number, redundant `-handbook` suffix |
| **B** | `<slug>-<edition>.md` (`risk-management-FAA-H-8083-2A.md`) | **selected** |
| C | `<slug>.md` (`risk-management.md`) | rejected: redundant with parent dir |
| D | `<edition>.md` (`FAA-H-8083-2A.md`) | rejected: looks like a PDF filename |
| E | `body.md` | rejected: still generic |

Why B wins: maximally self-describing. A `grep -r 'risk-management-FAA-H-8083-2A'` returns the canonical body file with one query. The redundancy with parent-dir (slug appears twice in the path) is minor compared to the search and IDE-tab benefit. Same rule applies to AC: `ac/61-65/j/61-65-j.md`.

### 3.5 Edge cases addressed

- **Errata pairing:** `<basename>.md` + `<basename>.errata.md` move together. Pairs identified by basename equality minus `.errata` infix. The migration script must validate that no `.errata.md` is stranded.

- **Chapter overview errata** (the reviewer's #6): A chapter overview's errata file is `00-<chapter-slug>.errata.md`. The rule for `apply_errata.py` (currently `if md_path.name == "index.md"`) becomes:

  ```python
  is_chapter_overview = (
      md_path.name.startswith("00-")
      and md_path.stem.removeprefix("00-") == chapter_slug
  )
  ```

  This pairs the structural prefix (`00-`) with semantic equality against the chapter slug from the manifest. Robust against a future chapter that has a section coincidentally numbered `00`.

- **Chapter with no index.md (claimed for AFH):** does not exist in the current repo; all AFH chapters have `index.md`. If a future chapter ingest produces no overview, the rename rule for that chapter is "rename directory only, no `00-*.md` to create."

- **AIM paragraph with no slug:** every observed paragraph in `aim/2026-04/manifest.json` has a non-empty `title`. The slug rule's empty-result fallback (`'section'`) is sufficient if a future AIM ever publishes a numbered-only paragraph.

- **Whole-doc handbooks with no chapters:** they have one body file (`document.md`); the chapter rename rules do not apply. Only the body filename changes.

- **Cross-doc markdown links between content files:** `grep -rn '](\./|](../' handbooks/ aim/` returns zero hits. Content files do not link to other content files via relative paths. Safe.

- **Frontmatter:** PHAK / AFH / AVWX have YAML frontmatter; the rename does not touch file contents (only the filename), so frontmatter is preserved verbatim. AIM and whole-doc files have no frontmatter, also unaffected.

- **`_*.txt` / `_*.json` debug files in chapter dirs:** Not renamed. They live alongside the renamed `00-<slug>.md` and continue to work because the ingest pipeline does not depend on their names being a particular shape.

- **AIM appendices and glossary:** not affected. Appendices already self-naming with their ordinal (`appendix-1.md` style) per user decision. Glossary already alphabetic-slug-named.

- **AMT inclusion despite ingestion deferral:** AMT-G and AMT-P `document.md` files exist on disk today. Per user decision (open question 8): include in the rename. Deferral is about ingestion priority (whether the content drives study cards), not file naming. Keeping deferred docs in worse shape than active ones would be artificial. The YAML-level deferral (commenting out the AMT entries in `handbooks-extras.yaml` so download does not re-fetch) is unaffected by the rename.

- **`figures/` and `tables/` at corpus level:** stay where they are. The migration script's "move every file in the chapter dir to the new chapter dir" rule does not affect them because they are not inside chapter dirs.

### 3.6 Spike artifacts

- `spike-results/before/phak-ch02/`: 65 entries, the full PHAK chapter 02 directory.
- `spike-results/after/phak-ch02/02-aeronautical-decision-making/`: same 65 entries, `index.md` -> `00-aeronautical-decision-making.md`.
- `spike-results/before/afh-ch02/`: 34 entries, the full AFH chapter 02 directory (with errata pair).
- `spike-results/after/afh-ch02/02-ground-operations/`: same 34 entries, `index.md` -> `00-ground-operations.md`.
- `spike-results/before/aim-ch07-sec1/`: 32 entries, the full AIM chapter-7/section-1 directory.
- `spike-results/after/aim-ch07-sec1/07-safety-of-flight/01-meteorology/`: same 32 entries, `index.md` -> `00-meteorology.md`, paragraphs renumbered with title slugs.

Each sample has a `_diff.md` next to its before/after pair listing every rename.

## 4. Code-side audit

The audit was run against `libs/`, `scripts/`, `apps/`, `tools/handbook-ingest/`, and the test files. Hits are categorized as:

- **trivial**: a string change, no logic
- **logic**: the filename appears in conditionals, special-cases, or generated paths
- **external**: e.g. user-facing URLs, generated seed data the user has on disk

### 4.1 Hits referencing `index.md`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.ts:227` | logic | Writes the chapter `index.md`; must change to `00-<slug>.md` and accept the chapter title. |
| `libs/sources/src/aim/source-ingest.ts:234` | logic | Sets `body_path` to `aim/.../chapter-<N>/index.md`. New shape: `aim/.../<NN>-<slug>/00-<slug>.md`. |
| `libs/sources/src/aim/source-ingest.ts:243` | logic | Section `index.md`; same change for sections. |
| `libs/sources/src/aim/source-ingest.ts:250` | logic | Section `body_path`. |
| `libs/sources/src/aim/source-ingest.ts:259` | logic | Paragraph `paragraph-<N>.md` -> `<NN>-<slug>.md`. |
| `libs/sources/src/aim/source-ingest.ts:266` | logic | Paragraph `body_path`. |
| `libs/sources/src/aim/source-ingest.ts:29-31` | trivial | Doc-comment example paths. |
| `libs/sources/src/aim/derivative-reader.ts:7-9` | trivial | Doc-comment example paths. The reader itself uses `body_path` from the manifest, so no logic change. |
| `libs/sources/src/handbooks/derivative-reader.ts:130` | trivial | Comment about chapter `index.md`. |
| `libs/sources/src/regs/resolver.ts:180` | flagged | Dead-code reference to `regs/cfr-<title>/<edition>/<part>/index.md`. CFR not in scope; flag for cleanup in future regs WP. |
| `libs/sources/src/regs/derivative-writer.ts:137` | flagged | Same dead-code regs `index.md`. Flag for cleanup in future regs WP. |
| `libs/sources/src/diff/body-hasher.ts:101` | flagged | Hashes regs body via `<edition>/<part>/index.md`. Dead path. Flag. |
| `libs/bc/study/src/manifest-validation.ts:93` | trivial | Comment: `NULL on a chapter-level index.md`. |
| `tools/handbook-ingest/ingest/normalize.py:182` | logic | Python pipeline writes `<chapter>/index.md`. Must change to `<chapter-dir>/00-<slug>.md` and pass title in. |
| `tools/handbook-ingest/ingest/apply_errata.py:430` | logic | Special-cases `if md_path.name == "index.md"`. Update to the structural-prefix-plus-semantic-slug check defined in §3.5. |
| `tools/handbook-ingest/ingest/normalize.py:178` | trivial | Docstring referencing `index.md`. |
| `tools/handbook-ingest/ingest/normalize.py:215` | trivial | Comment about cover-page residue in `index.md`. |
| `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md:73` | external | Prompt-out source instruction "Do NOT write the chapter's `index.md`". Update wording to match new chapter overview filename. **`tools/handbook-ingest/prompts-out/` archive snapshots are NOT rewritten** (per user decision, open question 9; they are historical artifacts of past runs). |
| `scripts/sources/config/handbooks/afh.yaml:113` | trivial | Comment. |
| `scripts/sources/config/handbooks/avwx.yaml:95` | trivial | Comment. |
| `scripts/sources/register/handbooks-extras.ts:21` | trivial | Comment. |
| `scripts/sources/register/ac.ts:14` | logic | AC pipeline registration. Update to match new AC body filename. |
| `scripts/build-knowledge-index.ts:712` | external | `course/knowledge/graph-index.md`; different file (knowledge graph, not handbook content). NOT affected. |
| `scripts/dev.ts:33,109,118` | external | Same `graph-index.md`. NOT affected. |
| `tools/handbook-ingest/README.md:212` | trivial | Doc layout block. |

### 4.2 Hits referencing `document.md`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/handbooks-extras/ingest.ts:294` | logic | Writes the whole-doc body. Change `document.md` -> `<slug>-<edition>.md`. |
| `libs/sources/src/handbooks-extras/ingest.ts:307` | logic | Sets `body_path` to `handbooks/<slug>/<edition>/document.md`. Update string. |
| `libs/sources/src/handbooks-extras/ingest.ts:25` | trivial | Doc-comment. |
| `libs/sources/src/handbooks-extras/ingest.ts:408` | trivial | Comment. |
| `libs/sources/src/handbooks-extras/derivative-reader.ts:16` | trivial | Doc-comment. |
| `libs/sources/src/ac/ingest.ts:340` | logic | AC pipeline writes `document.md`. Change to `<doc>-<rev>.md`. |
| `libs/sources/src/ac/ingest.ts:357` | logic | AC `body_path`. Update string. |
| `libs/sources/src/ac/ingest.ts:14` | trivial | Doc-comment. |
| `libs/sources/src/ac/derivative-reader.ts:8` | trivial | Doc-comment. |
| `libs/bc/study/src/manifest-validation.ts:344` | trivial | Comment: "Body lives in a single file (`document.md`)". |

### 4.3 Hits referencing `paragraph-N.md`, `chapter-N/`, `section-N/`

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.ts:225,241,257` | logic | Constructs `chapter-<N>` and `section-<M>` directories. Must change to slugged dir names per §3.3. |

The `chapter-N` / `section-N` strings exist in `apps/study/src/lib/help/content/bodies/...` and in `scripts/migrate-lessons.ts`, but those are eCFR URL fragments, not file paths. NOT affected.

### 4.4 Test-file hits (logic-equivalent updates)

These test files have hardcoded paths that match the on-disk filenames. They must be updated to match the new convention to keep the suite passing.

| File:Line | Category | Notes |
| --- | --- | --- |
| `libs/sources/src/aim/source-ingest.test.ts:317-319,353-354` | logic | Asserts on `chapter-1/index.md`, `paragraph-1.md`. Update to new shape. |
| `libs/sources/src/aim/derivative-reader.test.ts:105` | logic | `chapter-5/section-1/paragraph-7.md` fixture path. |
| `libs/sources/src/handbooks-extras/ingest.test.ts:337` | logic | Asserts `document.md` written. |
| `libs/sources/src/handbooks-extras/ingest.test.ts:359` | logic | Asserts `body_path` ends with `document.md`. |
| `libs/sources/src/ac/ingest.test.ts` | logic | AC tests that assert on `document.md` paths. Audit to find specific lines once spec is being written. |
| `libs/bc/study/src/manifest-validation.test.ts:44,68,75,82,116` | logic | Test fixtures with hardcoded `body_path` strings. |
| `scripts/db/seed-references-from-manifest.test.ts:200,220,268-270,294,301,308,370,390` | logic | Multiple hardcoded `body_path` and write-file paths. |

### 4.5 Documentation hits

These describe the old layout in docs / READMEs and need updating in the same WP so docs and reality stay in sync (per "Update docs as part of the work, not as a separate task").

- `tools/handbook-ingest/README.md:212`: chapter layout block.
- `docs/work-packages/handbook-ingestion-and-reader/` spec / tasks may mention the old layout.
- `docs/ingestion-pipeline/pipeline.md` and `docs/ingestion-pipeline/handbook-ingest-pipeline.md`: both reference `index.md` and `document.md` in code blocks. Update.
- Any per-feature docs that show `index.md` paths in examples.

### 4.6 Hits considered and discarded as not load-bearing

- `course/knowledge/graph-index.md` (`scripts/build-knowledge-index.ts`, `scripts/dev.ts`); different `index.md` (knowledge graph, not handbook content). Not affected.
- `apps/study/src/lib/help/content/bodies/...` `chapter-I` / `section-NN` URL fragments; eCFR external URL paths, not file paths.
- `scripts/sources/inventory.ts` `chapter-${n}-`; URL anchor fragment for the FAA handbook scraping page, not a file path.
- `tools/handbook-ingest/ingest/aim_html_extract.py` `class="paragraph-title"`; HTML class name, unrelated to filenames.

### 4.7 Citation-stability verification

The most load-bearing safety claim of this WP: **none of the user-facing `airboss-ref:` URIs change.** Verified:

```bash
grep -rh "airboss-ref:" --include="*.ts" --include="*.test.ts" | grep -oE "airboss-ref:[a-z0-9/-]+"
```

Returns shapes like `airboss-ref:handbooks/phak/8083-25C/12` and `airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-k01`. The URI is `<corpus>/<slug>/<edition-slug>/<chapter-or-area>/...`, using structural identifiers (`12`, `area-05`, `elem-k01`), NOT filename strings. Renaming `12/index.md` to `12-emergency-procedures/00-emergency-procedures.md` does not change the chapter code `12` that the URI uses. Citation databases stay valid.

`ROUTES.LIBRARY_HANDBOOK_*` follow the same pattern: keyed by chapter/section codes, not filenames. Verified at `libs/constants/src/routes.ts`.

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
   - For every other file under `<NN>/` (sections, errata, debug `_*` files): `mv` to the new chapter dir, keeping the basename. Errata sibling files move with their primary by basename equality.
3. After all chapters renamed, rewrite `manifest.json`:
   - For every `body_path`, replace the `<NN>/` segment with `<NN>-<slug>/` and replace `index.md` with `00-<slug>.md` if applicable.

### 5.2 For AIM

1. Read `aim/<edition>/manifest.json`.
2. For each `entries[]` entry, derive new `body_path` based on entry kind (chapter / section / paragraph / appendix / glossary). Build a mapping from old path to new path using the per-corpus numbering rule from §3.3.
3. Rename directories `chapter-<N>` -> `<NN>-<chapter-slug>` and `section-<N>` -> `<NN>-<section-slug>` (using titles from the manifest, ordinal-based numbering).
4. Rename files: `index.md` (chapter) -> `00-<chapter-slug>.md`; `index.md` (section) -> `00-<section-slug>.md`; `paragraph-<N>.md` -> `<NN>-<paragraph-slug>.md`.
5. Rewrite `manifest.json` `body_path` fields.
6. Appendices and glossary untouched.

### 5.3 For whole-doc handbooks and AC

For each of the 7 whole-doc handbooks (`risk-management`, `ifh`, `iph`, `aviation-instructor`, `tips-mountain-flying`, `amt-general`, `amt-powerplant`) and each of the 9 AC document-revisions:

1. Read manifest's `body_path`, `slug`, and `edition`.
2. New filename: `<slug>-<edition>.md` (per §3.4 Option B). For AC: `<doc>-<rev>.md`.
3. `mv <doc>/<edition>/document.md <doc>/<edition>/<slug>-<edition>.md`.
4. Rewrite manifest `body_path`.

### 5.4 Code changes (in lockstep with the file moves)

- `tools/handbook-ingest/ingest/normalize.py:_resolve_output_path` rewrites the chapter overview path. Must accept `node.title` to produce `00-<slug>.md`.
- `tools/handbook-ingest/ingest/apply_errata.py:430` updates the special-case to the structural-prefix-plus-semantic-slug check defined in §3.5.
- `libs/sources/src/aim/source-ingest.ts:225-266`: rewrite the path construction and `body_path` strings per the AIM numbering rule from §3.3.
- `libs/sources/src/handbooks-extras/ingest.ts:294,307`: rewrite the body filename writer.
- `libs/sources/src/ac/ingest.ts:340,357`: same change for AC.
- All affected test files updated to match the new fixture shapes.
- The doc-comment trivial hits updated for accuracy.

### 5.5 Validation procedure

Beyond "the script runs and reports success," the WP needs a concrete verification that the rename is correct end-to-end:

1. **Pre-migration baseline:** capture `find handbooks/ aim/ ac/ -name '*.md' | sort` and `find ... -name 'manifest.json' -exec sha256sum {} \;`. Save as `baseline.txt`.
2. **Run migration script.** Idempotent: re-running is a no-op (script asserts: skip if new path exists, fail if both old + new exist simultaneously).
3. **Post-migration inventory:** capture the same find output. Diff against expected mapping. Every old path maps to exactly one new path; every new path is reached.
4. **Re-extract one chapter end-to-end** to validate emitter changes:
   - Pick PHAK chapter 2 (smallest section count of the larger chapters; covers the index/section/errata trifecta).
   - Wipe `handbooks/phak/FAA-H-8083-25C/02-aeronautical-decision-making/`.
   - Re-run `bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy toc` (or the prompt-flow if TOC strategy fails for this run; both pipelines must produce the new shape).
   - Byte-diff the regenerated chapter against the post-migration tree. Expect zero diffs.
5. **Re-extract one AIM section end-to-end** to validate the AIM emitter:
   - Pick AIM chapter-7 section-1 (used for the spike artifact).
   - Wipe `aim/2026-04/07-safety-of-flight/01-meteorology/`.
   - Re-run `bun run sources register aim`.
   - Byte-diff. Expect zero.
6. **Re-extract one whole-doc and one AC** to validate those emitters:
   - Wipe `handbooks/tips-mountain-flying/MTN-2003/`.
   - Re-run `bun run sources register handbooks-extras` (or the equivalent for this corpus).
   - Byte-diff.
   - Same for one AC doc.
7. **CI assertion** added to `libs/bc/study/src/manifest-validation.ts`: every `body_path` must NOT match `/(?:^|/)(index|document)\.md$`. Rejects any future regression.
8. **CI assertion** added to detect AIM glossary slug collisions: every glossary file's slug must be unique within `aim/<edition>/glossary/`. Rejects future content that would collide under the 48-char truncation rule.

The Python pipeline being paste-to-Claude (per `docs/ingestion-pipeline/section-extraction-prompt-strategy.md`) means step 4 may require a fresh-session prompt run for the toc strategy. Either strategy must produce the new shape. The acceptance criterion is byte-equality, not "the script ran."

### 5.6 Mechanical vs human-review

- **Mechanical:** every file `mv`, every manifest `body_path` rewrite, every test fixture update, every comment update. Driven by the migration script + a small codemod for tests.
- **Human review:** the spike's before/after artifacts (already produced); the validation procedure outputs (steps 4-6 byte diffs); the CI assertion patches.

## 6. Cost estimate

NO TIME ESTIMATES. Scope by counts:

| Item                                               | Count                                         |
| -------------------------------------------------- | --------------------------------------------- |
| Markdown files moved                               | ~2,640 (every `.md` in `handbooks/` + `aim/` + `ac/`) |
| Chapter directories renamed (handbooks)            | 17 + 18 + 28 = 63                             |
| AIM chapter directories renamed                    | 10                                            |
| AIM section directories renamed                    | 38                                            |
| `index.md` -> `00-<slug>.md` renames               | 17 + 18 + 28 + 48 = 111                       |
| `document.md` -> `<slug>-<edition>.md` renames     | 7 (whole-doc) + 9 (AC) = 16                   |
| AIM `paragraph-N.md` -> `<NN>-<slug>.md` renames   | 396                                           |
| Errata files moved (no rename, just dir change)    | 20                                            |
| Manifest `body_path` rewrites                      | ~3,500 entries across 13+ manifests           |
| Production TS/Python emitter LOC changed           | ~15 (concentrated in 4 files)                 |
| Test fixture updates                               | ~25 hardcoded path strings across 7 test files|
| Doc-comment updates                                | ~17 sites                                     |
| CI assertions added                                | 2 (forbidden filename + glossary collision)   |

### 6.1 Risk areas

| Risk | Mitigation |
| --- | --- |
| Migration runs partial, half the tree is renamed and the other half not | Migration script must be idempotent (skip if new path exists, error if both old + new exist). Same pattern as `source-cache-flat-naming`'s `migrate-cache-flat.ts`. |
| Manifests + filesystem out of sync after migration | Migration script writes manifests last, and only after all `mv`s succeed. The script asserts `existsSync` on every new path before writing the manifest. |
| Three emitter pipelines (Python ingest + TS AIM + TS handbooks-extras+AC) drift | They already drift today (separate paths, no shared library). Acceptance criteria in §5.5 step 4-6: byte-diff one chapter / section / whole-doc / AC each, expect zero diffs. |
| `_*.txt` / `_*.json` debug artifacts accidentally lost in the rename | Migration script does a glob-mv of all files in the old chapter dir to the new chapter dir, not just `*.md`. |
| AIM glossary or appendix files accidentally renumbered | Migration script special-cases AIM: only files matching `paragraph-N.md` are renumbered; `glossary/*.md` and `appendix-N.md` are untouched. |
| User has uncommitted lesson seed data referencing old paths | `body_path` is sourced from manifests during seeding; after the rename, manifests carry the new paths, so re-seeding produces correct rows. |
| Open PRs in flight referencing old paths | The rename is one large commit. Open PRs rebase against it. The user runs solo, so coordination cost is minimal. |
| Future edition ingest produces old-shape filenames (regression) | CI assertion in `manifest-validation.ts` (§5.5 step 7) rejects any `body_path` ending in `index.md` or `document.md`. Catches at validate-time, before merge. |
| AMT un-deferral re-creates orphan files | AMT files renamed in this WP (per §3.5). The next AMT ingest run will produce new-shape filenames matching what's already on disk; no orphan creation possible. |
| Future glossary term truncates to a colliding slug | CI assertion (§5.5 step 8) rejects merge if any two glossary slugs collide. |
| CFR dead-code emitter paths not cleaned up | Spec MUST include a flag-for-followup section listing `regs/derivative-writer.ts:137`, `regs/resolver.ts:180`, `diff/body-hasher.ts:101`. Tracked separately as `regs-derivative-cleanup` follow-up WP. |

## 7. Pros and cons

| Aspect                            | Pro                                                                               | Con                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| IDE tab readability               | Every tab title says what it is; no more 5 tabs all named `index.md`              | -                                                                            |
| `find` / `rg` UX                  | `rg ground-operations` returns the right file directly                            | Slug-truncation makes `rg`'s exact matches less reliable for long titles     |
| Git history readability           | `git log <new-path>` follows file moves cleanly; renames preserved by `git`       | One commit-large rename creates a 2,640-file diff that's hard to review     |
| Citation stability                | `airboss-ref:` URIs unchanged (verified §4.7); `ROUTES.LIBRARY_HANDBOOK_*` unchanged | -                                                                            |
| Schema impact                     | None; `body_path` is `z.string().min(1)`                                          | -                                                                            |
| Cross-doc internal links          | None to break (no relative MD links exist)                                        | -                                                                            |
| Pipeline complexity               | Same number of writes per ingest run; no new fields                               | Three emitters (Python + TS AIM + TS handbooks-extras+AC) must change in lockstep |
| Migration risk                    | Idempotent script + manifest rewrite is well-trodden territory (ADR-021 precedent) | A bug in the rename map silently corrupts citation lookups (mitigated by post-run verification §5.5) |
| Onboarding / discoverability      | New developer reading the tree understands the corpus structure without docs     | -                                                                            |
| Errata pairing                    | Simple rule (basename equality minus `.errata`) is automatable                   | Chapter-overview errata special-case needs the structural+semantic check (§3.5) |
| Whole-doc filename                | `<slug>-<edition>.md` is maximally self-describing                                | Slug appears twice in path (slug dir + slug filename)                        |
| AIM directory rename              | Self-describing dir names mirror the file rename                                  | Adds the slug-stability concern (mitigated by edition-scoped paths)         |
| Slug stability over editions      | -                                                                                 | If a chapter title shifts (e.g. AIM 2026-04 vs 2026-08), the dir renames; downstream tooling that hardcodes a path breaks. Mitigation: hardcode by `code`, not path. |
| Future-regression prevention      | CI assertions (forbidden filename + glossary collision) catch at validate-time   | Two new assertions to maintain                                               |
| AC inclusion                      | Same rule applies cleanly; one WP instead of two                                  | Adds 9 file moves + 9 manifest rewrites + tests; not free                    |

## 8. Decisions resolved (formerly open questions)

1. **Whole-doc filename:** Option B, `<slug>-<edition>.md` (e.g. `risk-management-FAA-H-8083-2A.md`). Section 3.4.
2. **AIM directory rename:** rename both `chapter-N` and `section-N` to slugged dirs. Section 3.1, 3.3.
3. **AIM glossary scope:** unchanged; already self-naming. Section 3.5.
4. **AIM appendix scope:** unchanged; already self-naming with ordinal. Section 3.1, 3.5.
5. **CFR / regs:** out of scope. Dead-code emitter paths flagged for future regs WP. Section 2.7, 4.1, 6.1.
6. **AC corpus:** in scope. Folded into this WP. Section 2.6, 3.4, 5.3.
7. **Doc tree count discrepancies (850 / 271 in original brief):** confirmed stale. Actual values 48 (AIM `index.md`) and 7 (whole-doc `document.md`); both used throughout this analysis. Section 2.4, 2.5.
8. **AMT deferral:** include AMT-G + AMT-P in the rename. Deferral is ingestion-priority concern, not file-naming concern. Section 2.5, 3.5, 6.1.
9. **`tools/handbook-ingest/prompts-out/` archive snapshots:** do NOT rewrite. Historical artifacts of past runs. Section 4.1.

All decisions baked into the analysis. No open questions remain at sign-off time.
