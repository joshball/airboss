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

| slug                   | edition          | in scope |
| ---------------------- | ---------------- | -------- |
| `risk-management`      | `FAA-H-8083-2A`  | yes      |
| `ifh`                  | `FAA-H-8083-15B` | yes      |
| `iph`                  | `FAA-H-8083-16B` | yes      |
| `aviation-instructor`  | `FAA-H-8083-9`   | yes      |
| `tips-mountain-flying` | `MTN-2003`       | yes      |
| `amt-general`          | `FAA-H-8083-30B` | yes      |
| `amt-powerplant`       | `FAA-H-8083-32B` | yes      |

- One `document.md` per edition.
- One `manifest.json` per edition (whole-doc kind, with top-level `body_path`).
- `document.md` has NO frontmatter; just raw extracted text.

The brief mentioned "~271 of these total when AMT is included." **The actual count is 7.** Source of the 271 unknown; treating as a stale metric.

### 2.6 AC corpus (`ac/<doc>/<rev>/document.md`), in scope

Per the user decision (open question 6 resolved): AC is folded into this WP. Same `document.md` problem as whole-doc handbooks; same emitter pattern.

| count | item                                              |
| ----- | ------------------------------------------------- |
| 9     | `document.md` files across 9 AC docs/revisions    |
| 9     | `manifest.json` files (one per `ac/<doc>/<rev>/`) |
| 1     | TS emitter file (`libs/sources/src/ac/ingest.ts`) |

The "cheap addition" framing in the spike was understated. Corrected scope: 9 file moves + 9 manifest `body_path` rewrites + 1 emitter change + AC test updates + AC doc-comment updates + spike-style verification of one rename. Bundle into the same WP because the rename rule is identical to whole-doc handbooks; running this as a separate WP later means re-litigating the same rule and re-doing the same review pass.

### 2.7 CFR / regs (out of scope, with sequencing constraint)

CFR has zero markdown files on disk today. Verified: `find regulations -name '*.md'` returns empty. The brief's "JSON-based, NOT affected" claim is correct for the current on-disk state.

**However, the regs `index.md` writer is NOT dead code.** Independent review verified:

- `libs/sources/src/regs/derivative-writer.ts:137` writes `<part>/index.md` and is exercised by a passing test (`derivative-writer.test.ts`).
- It is called from `libs/sources/src/regs/ingest.ts:179`.
- The ingest is registered in the public CLI dispatcher at `scripts/sources.ts` (`bun run sources register cfr`).
- Default `outRoot = <repo>/regulations/`.

The first user to run `bun run sources register cfr` after this WP merges will write `index.md` files into the repo. The regs corpus uses `body_path: '<part>/<part>-<section>.md'` for sections (e.g. `91/91-103.md`) PLUS `index.md` per part for the part overview. The CI assertion in §5.5 step 7 (rejects `body_path` ending in `index.md`/`document.md`) does NOT cover this case because regs writes `index.md` as a side-channel filesystem write, not as a `body_path` value. The assertion must be updated to handle this, OR the regs corpus must be excluded from the assertion's scope, OR the regs cleanup must land before this WP.

**Sequencing constraint added:** before `bun run sources register cfr` is run again post-merge, a follow-up WP (`regs-derivative-cleanup`) must rewrite `derivative-writer.ts:137` and `resolver.ts:180` to use a self-describing filename (`<part>-overview.md` or similar). Until that lands, regs ingestion stays paused. The risk row in §6.1 captures this; the spec sign-off must include explicit acknowledgement of the regs sequencing.

### 2.8 ACS (out of scope, no rename needed)

ACS already self-describing: `acs/<doc>/area-<NN>/task-<L>.md`. No `index.md` or `document.md` files. Confirmed via `find acs -name 'index.md' -o -name 'document.md'`.

## 3. Option D, detailed

### 3.1 Naming rules (precise)

| Concept               | Before                                        | After                                                                                           |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| chapter directory     | `<NN>/`                                       | `<NN>-<chapter-slug>/`                                                                          |
| chapter overview      | `<chapter-dir>/index.md`                      | `<chapter-dir>/00-<chapter-slug>.md`                                                            |
| section file (top)    | `<NN>-<section-slug>.md` (already conformant) | unchanged                                                                                       |
| section file (nested) | `<NN>-<MM>-<section-slug>.md` (conformant)    | unchanged                                                                                       |
| errata sibling        | `<basename>.errata.md`                        | unchanged (always pairs with `<basename>.md`)                                                   |
| AIM chapter dir       | `chapter-<N>/`                                | `<NN>-<chapter-slug>/`                                                                          |
| AIM section dir       | `section-<N>/`                                | `<NN>-<section-slug>/`                                                                          |
| AIM section overview  | `<section-dir>/index.md`                      | `<section-dir>/00-<section-slug>.md`                                                            |
| AIM paragraph         | `paragraph-<N>.md`                            | `<NN>-<paragraph-slug>.md`                                                                      |
| AIM appendix          | `appendix-<N>.md`                             | unchanged (already self-naming, file-not-dir scope)                                             |
| AIM glossary term     | `glossary/<term-slug>.md`                     | unchanged                                                                                       |
| whole-doc body        | `<doc>/<edition>/document.md`                 | `<doc>/<edition>/<slug>-<edition>.md` (Option B; see §3.4)                                      |
| AC body               | `ac/<doc>/<rev>/document.md`                  | `ac/<doc>/<rev>/ac-<doc>-<rev>.md` (corpus-prefixed; see §3.4 for the disambiguation rationale) |
| `figures/`, `tables/` | `<edition>/figures/`, `<edition>/tables/`     | unchanged (corpus-level dirs, not inside chapter dirs)                                          |
| Debug artifacts       | `<chapter-dir>/_*.txt`, `_*.json`             | unchanged (move with chapter dir, names preserved)                                              |

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

| Option | Example                                                    | Status                                                                                           |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A      | `<edition>-handbook.md`                                    | rejected: drops the readable slug, keeps unreadable edition number, redundant `-handbook` suffix |
| **B**  | `<slug>-<edition>.md` (`risk-management-FAA-H-8083-2A.md`) | **selected**                                                                                     |
| C      | `<slug>.md` (`risk-management.md`)                         | rejected: redundant with parent dir                                                              |
| D      | `<edition>.md` (`FAA-H-8083-2A.md`)                        | rejected: looks like a PDF filename                                                              |
| E      | `body.md`                                                  | rejected: still generic                                                                          |

Why B wins: maximally self-describing. A `grep -r 'risk-management-FAA-H-8083-2A'` returns the canonical body file with one query. The redundancy with parent-dir (slug appears twice in the path) is minor compared to the search and IDE-tab benefit.

**AC variant: corpus-prefixed.** AC doc numbers contain hyphens (`91-21-1`, `00-6`, `61-65`). Applying Option B verbatim produces `91-21-1-b.md`, where the filename alone cannot tell you whether `b` is the revision of doc `91-21-1` or a continuation of the doc number. The fix: prefix the corpus tag, producing `ac-91-21-1-b.md`. This:

- Matches the URI convention already used in `airboss-ref:ac/<doc>/<rev>/...` citations.
- Keeps the kebab-case separator consistent with the rest of the codebase (no `_` mixed in).
- Costs 3 characters of filename length, well under any practical cap.

The asymmetry with whole-doc handbooks (no `<corpus>-` prefix there) is intentional: handbook slugs (`risk-management`, `tips-mountain-flying`) do not contain hyphen-delimited segments that could be mistaken for the edition. The disambiguation is only needed where the doc identifier itself is hyphen-segmented.

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

  **AMT pipeline clarification:** AMT-G and AMT-P go through `libs/sources/src/handbooks-extras/ingest.ts` (the TS whole-doc pipeline), not the Python chapter-aware pipeline. When the emitter at `handbooks-extras/ingest.ts:294,307` is updated to write `<slug>-<edition>.md`, a future un-deferral that re-fetches the AMT PDFs and re-runs ingest will produce filenames matching what the migration script already put on disk. No orphan creation possible. The Python pipeline updates (`tools/handbook-ingest/ingest/normalize.py`, `apply_errata.py`) do not affect AMT.

- **`figures/` and `tables/` at corpus level:** stay where they are. The migration script's "move every file in the chapter dir to the new chapter dir" rule does not affect them because they are not inside chapter dirs.

### 3.6 Spike artifacts

Layout:

```text
spike-results/
  before/
    phak-ch02/      original PHAK chapter 02 files
    afh-ch02/       original AFH chapter 02 files
    aim-ch07-sec1/  original AIM chapter-7/section-1 files
  after/
    phak-ch02/02-aeronautical-decision-making/   renamed PHAK chapter 02
    afh-ch02/02-ground-operations/               renamed AFH chapter 02
    aim-ch07-sec1/07-safety-of-flight/01-meteorology/   renamed AIM section
  phak-ch02/_diff.md       per-sample rename manifest
  afh-ch02/_diff.md
  aim-ch07-sec1/_diff.md
```

The `_diff.md` for each sample lives at `spike-results/<sample>/_diff.md` (a sibling of the `before/<sample>` and `after/<sample>` content trees, NOT inside them). Counts:

- PHAK ch02: 65 entries (61 markdown + 4 debug artifacts). `index.md` -> `00-aeronautical-decision-making.md`.
- AFH ch02: 34 entries including errata pair. `index.md` -> `00-ground-operations.md`.
- AIM ch7/sec1: 32 entries. `index.md` -> `00-meteorology.md`. Paragraphs renumbered with title slugs.

## 4. Code-side audit

The audit was run against `libs/`, `scripts/`, `apps/`, `tools/handbook-ingest/`, and the test files. Hits are categorized as:

- **trivial**: a string change, no logic
- **logic**: the filename appears in conditionals, special-cases, or generated paths
- **external**: e.g. user-facing URLs, generated seed data the user has on disk

### 4.1 Hits referencing `index.md`

| File:Line                                                                  | Category | Notes                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/sources/src/aim/source-ingest.ts:227`                                | logic    | Writes the chapter `index.md`; must change to `00-<slug>.md` and accept the chapter title.                                                                                                                                                                                                   |
| `libs/sources/src/aim/source-ingest.ts:234`                                | logic    | Sets `body_path` to `aim/.../chapter-<N>/index.md`. New shape: `aim/.../<NN>-<slug>/00-<slug>.md`.                                                                                                                                                                                           |
| `libs/sources/src/aim/source-ingest.ts:243`                                | logic    | Section `index.md`; same change for sections.                                                                                                                                                                                                                                                |
| `libs/sources/src/aim/source-ingest.ts:250`                                | logic    | Section `body_path`.                                                                                                                                                                                                                                                                         |
| `libs/sources/src/aim/source-ingest.ts:259`                                | logic    | Paragraph `paragraph-<N>.md` -> `<NN>-<slug>.md`.                                                                                                                                                                                                                                            |
| `libs/sources/src/aim/source-ingest.ts:266`                                | logic    | Paragraph `body_path`.                                                                                                                                                                                                                                                                       |
| `libs/sources/src/aim/source-ingest.ts:29-31`                              | trivial  | Doc-comment example paths.                                                                                                                                                                                                                                                                   |
| `libs/sources/src/aim/derivative-reader.ts:7-9`                            | trivial  | Doc-comment example paths. The reader itself uses `body_path` from the manifest, so no logic change.                                                                                                                                                                                         |
| `libs/sources/src/handbooks/derivative-reader.ts:130`                      | trivial  | Comment about chapter `index.md`.                                                                                                                                                                                                                                                            |
| `libs/sources/src/regs/resolver.ts:180`                                    | flagged  | Dead-code reference to `regs/cfr-<title>/<edition>/<part>/index.md`. CFR not in scope; flag for cleanup in future regs WP.                                                                                                                                                                   |
| `libs/sources/src/regs/derivative-writer.ts:137`                           | flagged  | Same dead-code regs `index.md`. Flag for cleanup in future regs WP.                                                                                                                                                                                                                          |
| `libs/sources/src/diff/body-hasher.ts:101`                                 | flagged  | Hashes regs body via `<edition>/<part>/index.md`. Dead path. Flag.                                                                                                                                                                                                                           |
| `libs/sources/src/bootstrap.ts:85`                                         | flagged  | Comment about regs `<part>/index.md`. Dead-path doc. Update or remove in the regs cleanup follow-up WP.                                                                                                                                                                                      |
| `libs/sources/src/bootstrap.ts:222`                                        | flagged  | Comment about regs `<part>/index.md` title synthesis. Same follow-up.                                                                                                                                                                                                                        |
| `libs/bc/study/src/manifest-validation.ts:93`                              | trivial  | Comment: `NULL on a chapter-level index.md`.                                                                                                                                                                                                                                                 |
| `tools/handbook-ingest/ingest/normalize.py:182`                            | logic    | Python pipeline writes `<chapter>/index.md`. Must change to `<chapter-dir>/00-<slug>.md` and pass title in.                                                                                                                                                                                  |
| `tools/handbook-ingest/ingest/apply_errata.py:430`                         | logic    | Special-cases `if md_path.name == "index.md"`. Update to the structural-prefix-plus-semantic-slug check defined in §3.5.                                                                                                                                                                     |
| `tools/handbook-ingest/ingest/normalize.py:178`                            | trivial  | Docstring referencing `index.md`.                                                                                                                                                                                                                                                            |
| `tools/handbook-ingest/ingest/normalize.py:215`                            | trivial  | Comment about cover-page residue in `index.md`.                                                                                                                                                                                                                                              |
| `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md:73` | external | Prompt-out source instruction "Do NOT write the chapter's `index.md`". Update wording to match new chapter overview filename. **`tools/handbook-ingest/prompts-out/` archive snapshots are NOT rewritten** (per user decision, open question 9; they are historical artifacts of past runs). |
| `scripts/sources/config/handbooks/afh.yaml:113`                            | trivial  | Comment.                                                                                                                                                                                                                                                                                     |
| `scripts/sources/config/handbooks/avwx.yaml:95`                            | trivial  | Comment.                                                                                                                                                                                                                                                                                     |
| `scripts/sources/register/handbooks-extras.ts:21`                          | trivial  | Comment.                                                                                                                                                                                                                                                                                     |
| `scripts/sources/register/ac.ts:14`                                        | logic    | AC pipeline registration. Update to match new AC body filename.                                                                                                                                                                                                                              |
| `scripts/build-knowledge-index.ts:712`                                     | external | `course/knowledge/graph-index.md`; different file (knowledge graph, not handbook content). NOT affected.                                                                                                                                                                                     |
| `scripts/dev.ts:33,109,118`                                                | external | Same `graph-index.md`. NOT affected.                                                                                                                                                                                                                                                         |
| `tools/handbook-ingest/README.md:212`                                      | trivial  | Doc layout block.                                                                                                                                                                                                                                                                            |

### 4.2 Hits referencing `document.md`

| File:Line                                                   | Category | Notes                                                                        |
| ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `libs/sources/src/handbooks-extras/ingest.ts:294`           | logic    | Writes the whole-doc body. Change `document.md` -> `<slug>-<edition>.md`.    |
| `libs/sources/src/handbooks-extras/ingest.ts:307`           | logic    | Sets `body_path` to `handbooks/<slug>/<edition>/document.md`. Update string. |
| `libs/sources/src/handbooks-extras/ingest.ts:25`            | trivial  | Doc-comment.                                                                 |
| `libs/sources/src/handbooks-extras/ingest.ts:408`           | trivial  | Comment.                                                                     |
| `libs/sources/src/handbooks-extras/derivative-reader.ts:16` | trivial  | Doc-comment.                                                                 |
| `libs/sources/src/ac/ingest.ts:340`                         | logic    | AC pipeline writes `document.md`. Change to `<doc>-<rev>.md`.                |
| `libs/sources/src/ac/ingest.ts:357`                         | logic    | AC `body_path`. Update string.                                               |
| `libs/sources/src/ac/ingest.ts:14`                          | trivial  | Doc-comment.                                                                 |
| `libs/sources/src/ac/derivative-reader.ts:8`                | trivial  | Doc-comment.                                                                 |
| `libs/bc/study/src/manifest-validation.ts:344`              | trivial  | Comment: "Body lives in a single file (`document.md`)".                      |

### 4.3 Hits referencing `paragraph-N.md`, `chapter-N/`, `section-N/`

| File:Line                                           | Category | Notes                                                                                              |
| --------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `libs/sources/src/aim/source-ingest.ts:225,241,257` | logic    | Constructs `chapter-<N>` and `section-<M>` directories. Must change to slugged dir names per §3.3. |

The `chapter-N` / `section-N` strings exist in `apps/study/src/lib/help/content/bodies/...` and in `scripts/migrate-lessons.ts`, but those are eCFR URL fragments, not file paths. NOT affected.

### 4.4 Test-file hits (logic-equivalent updates)

Two categories of test impact: hardcoded path strings inside `*.test.ts` files (4.4.1), and committed test-fixture content trees that mirror the production layout (4.4.2). Both must be updated to match the new convention to keep the suite passing.

#### 4.4.1 Test code with hardcoded paths

| File:Line                                                                              | Category | Notes                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/sources/src/aim/source-ingest.test.ts:317-319,353-354`                           | logic    | Asserts on `chapter-1/index.md`, `paragraph-1.md`. Update to new shape.                                                                                                                                         |
| `libs/sources/src/aim/derivative-reader.test.ts:105`                                   | logic    | `chapter-5/section-1/paragraph-7.md` fixture path.                                                                                                                                                              |
| `libs/sources/src/handbooks-extras/ingest.test.ts:337`                                 | logic    | Asserts `document.md` written.                                                                                                                                                                                  |
| `libs/sources/src/handbooks-extras/ingest.test.ts:359`                                 | logic    | Asserts `body_path` ends with `document.md`.                                                                                                                                                                    |
| `libs/sources/src/ac/ingest-cli.test.ts`                                               | logic    | AC ingest-CLI tests; audit for `document.md` references during spec phase. (Note: there is no `libs/sources/src/ac/ingest.test.ts`; the AC test files are `ingest-cli`, `locator`, `resolver`, `smoke`, `url`.) |
| `libs/bc/study/src/manifest-validation.test.ts:44,68,75,82,116`                        | logic    | Test fixtures with hardcoded `body_path` strings.                                                                                                                                                               |
| `scripts/db/seed-references-from-manifest.test.ts:200,220,268-270,294,301,308,370,390` | logic    | Multiple hardcoded `body_path` and write-file paths. (The test creates its own throwaway tree, independent of real fixtures.)                                                                                   |

#### 4.4.2 Committed test-fixture content trees

These are real markdown files and manifests committed under `tests/fixtures/` that the e2e suite loads. They mirror the production layout and must be migrated alongside the production rename, with their internal manifests rewritten in lockstep. Otherwise the new CI assertion (§5.5 step 7) will fire on these fixture manifests the moment it lands.

| Fixture path                                                                    | Category | Notes                                                                                                                 |
| ------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `tests/fixtures/handbooks/phak-fixture/phak/FAA-H-8083-25C/01/index.md`         | logic    | Chapter overview file. Renames to `01-<chapter-slug>/00-<chapter-slug>.md` per §3.1.                                  |
| `tests/fixtures/handbooks/phak-fixture/phak/FAA-H-8083-25C/manifest.json`       | logic    | 4 `body_path` strings include `01/index.md` and section paths. Rewrite all per §5.1.                                  |
| `tests/fixtures/aim/aim-fixture/aim/2026-09/chapter-5/index.md`                 | logic    | AIM chapter overview. Renames to `05-<chapter-slug>/00-<chapter-slug>.md`.                                            |
| `tests/fixtures/aim/aim-fixture/aim/2026-09/chapter-5/section-1/index.md`       | logic    | AIM section overview. Renames to `05-<chapter-slug>/01-<section-slug>/00-<section-slug>.md`.                          |
| `tests/fixtures/aim/aim-fixture/aim/2026-09/chapter-5/section-1/paragraph-7.md` | logic    | Renames to `<NN>-<paragraph-slug>.md`.                                                                                |
| `tests/fixtures/aim/aim-fixture/aim/2026-09/chapter-5/section-1/paragraph-8.md` | logic    | Same.                                                                                                                 |
| `tests/fixtures/aim/aim-fixture/aim/2026-09/manifest.json`                      | logic    | 6 fixture `body_path` strings (chapter overview, section overview, paragraphs, glossary, appendix). Rewrite per §5.2. |

The fixtures use synthetic chapter/section titles, so the slugs in the renamed paths come from the fixture's own manifest titles, not from the production AIM corpus. The migration script must operate uniformly on production and fixture trees (driven by manifests), so this falls out of the existing rename plan as long as the script is pointed at both `handbooks/`, `aim/`, `ac/`, AND `tests/fixtures/`.

**Sequencing note:** the fixture rename and the CI assertion (§5.5 step 7) MUST land in the same commit, otherwise the assertion will fire on still-old-shape fixture manifests. See §5.5 step 7 for the explicit ordering rule.

### 4.5 Documentation hits

These describe the old layout in docs / READMEs and need updating in the same WP so docs and reality stay in sync (per "Update docs as part of the work, not as a separate task").

A repo-wide grep finds ~25 hits across documentation referencing `index.md` or `document.md` in the rename's scope (independent reviewer count). The high-confidence sites confirmed by audit:

- `tools/handbook-ingest/README.md:212`: chapter layout block.
- `docs/work-packages/handbook-ingestion-and-reader/`: spec / tasks / layout examples.
- `docs/work-packages/chapter-source-ingestion/`: spec / tasks / design / test-plan.
- `docs/work-packages/section-extraction-contract-v2/`: layout references.
- `docs/work-packages/section-extraction-prompt-strategy/design.md`: prompt-out path examples.
- `docs/ingestion-pipeline/pipeline.md` and `docs/ingestion-pipeline/handbook-ingest-pipeline.md`: code-block layout examples.
- `docs/ingestion-pipeline/section-extraction-strategies.md` and `docs/ingestion-pipeline/section-extraction-prompt-strategy.md`: same.
- Per-feature docs that show `index.md` paths in examples.

The spec phase MUST run a fresh `rg 'index\.md|document\.md' docs/ tools/` pass to enumerate the full set; this analysis surfaces the categories, not an exhaustive list.

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

Returns shapes like `airboss-ref:handbooks/phak/8083-25C/12` and `airboss-ref:acs/ppl-airplane-acs-6c/area-05/task-a/elem-k01`. The URI is `<corpus>/<slug>/<edition-slug>/<chapter-or-area>/...`, using structural identifiers (`12`, `area-05`, `elem-k01`), NOT filename strings. Renaming `12/index.md` to `12-emergency-procedures/00-emergency-procedures.md` does not change the chapter code `12` that the URI uses. Citation databases stay valid.

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
3. After all chapters renamed, rewrite `manifest.json`. The schema includes THREE path fields per section, all of which must be rewritten in lockstep:
   - **`body_path`** (every section): replace the `<NN>/` segment with `<NN>-<slug>/` and replace `index.md` with `00-<slug>.md` if applicable.
   - **`section_path`** (every section): same rewrite rule. Verified shape via `libs/bc/study/src/manifest-validation.ts:193`. Production scope: 21 entries in PHAK manifest, 7 in AFH manifest (AVWX TBD; check during implementation). Critical: leaving these stale silently breaks the section locator at the resolver layer.
   - **`errata_note_path`** (errata-bearing sections only): same rewrite rule. Schema at `libs/bc/study/src/manifest-validation.ts:200`. Critical: leaving these stale breaks the errata audit trail UI.

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
- `tools/handbook-ingest/ingest/apply_errata.py:409` constructs `chapter_dir = edition_root(...) / patch.chapter` from the bare 2-digit code. After the rename, chapter directories carry slugs (`01-introduction-to-flying`); `is_dir()` returns False on the first errata reapply attempt. Must derive `chapter_dir` from the manifest's chapter `code` plus title-slug, not from `patch.chapter` alone. Concretely: read the manifest, look up the chapter slug by code, build `<NN>-<slug>` directory name.
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
7. **CI assertion** added to `libs/bc/study/src/manifest-validation.ts`: every path-bearing field (`body_path`, `section_path`, `errata_note_path`) must NOT match `/(?:^|/)(index|document)\.md$`. Rejects any future regression.

   **Sequencing rule:** this assertion lands in the same single squash-merge commit as the file moves and fixture migration (§4.4.2). It MUST NOT land first; if it lands before fixture manifests are rewritten, the fixture validation fires and blocks the merge. The migration script is responsible for moving production AND fixture trees in one pass.

   **Regs side-channel exclusion:** the regs corpus writer (`libs/sources/src/regs/derivative-writer.ts:137`) writes `<part>/index.md` to the filesystem WITHOUT recording the path in any `body_path` field (regs uses `<part>/<part>-<section>.md` for `body_path`, plus `index.md` as a part overview). The CI assertion at the manifest level cannot catch this; a separate filesystem-walk assertion (or the regs cleanup landing first; see §2.7) is required. Until regs cleanup lands, the assertion explicitly carves out paths under `regulations/`.

8. **CI assertion** added to detect AIM glossary slug collisions: every glossary file's slug must be unique within `aim/<edition>/glossary/`. Rejects future content that would collide under the 48-char truncation rule.

The Python pipeline being paste-to-Claude (per `docs/ingestion-pipeline/section-extraction-prompt-strategy.md`) means step 4 may require a fresh-session prompt run for the toc strategy. Either strategy must produce the new shape. The acceptance criterion is byte-equality, not "the script ran."

### 5.6 Atomic squash-merge, with explicit multi-commit feature branch

The migration lands as **one squash-merge commit on main**. Acceptance criterion: `git log --oneline main` shows exactly one commit for this WP.

**On the feature branch, multi-commit is REQUIRED**, not optional, for review readability and bisect granularity. Suggested commit grouping (independent reviewer requirement):

1. Migration script (added).
2. Production file moves + manifest rewrites for `handbooks/`.
3. Production file moves + manifest rewrites for `aim/` and `ac/`.
4. Test fixture moves + fixture manifest rewrites.
5. Emitter code changes (Python + TS).
6. Test code path-string updates.
7. CI assertions.
8. Doc updates.
9. Migration script removal (per `source-cache-flat-naming` precedent).

Each commit on the feature branch is reviewable in isolation; the squash collapses them on merge.

All path-bearing fields rewrite in lockstep across these commits:

- File moves (production + fixtures)
- Manifest path rewrites: `body_path`, `section_path`, `errata_note_path` (all three together)
- Emitter code changes (Python + TS, three pipelines)
- Test fixture content updates
- Test code path-string updates
- CI assertions
- Doc updates

This matters because:

- Mid-PR commits on the feature branch must each pass `bun run check` (so the multi-commit structure is testable, not just review-friendly).
- A revert of the squash commit on main reverses the entire WP cleanly.
- The CI assertion (§5.5 step 7) must not fire during the migration; it lands in the same squash-merge boundary as the fixture rewrites.

### 5.7 Mid-run failure recovery (within the migration script)

The migration script itself runs as a single process; mid-script failure must be handled cleanly:

1. **Plan phase (no writes):** Build a `Map<oldPath, newPath>` for every move, including all `mv` operations and every manifest rewrite as a queued JSON patch. Validate the plan before any FS write:
   - Every old path exists.
   - No new path already exists (if any does, abort with the specific path; this is the half-migrated detection).
   - Every old path appears exactly once as a source.
   - Every new path appears exactly once as a destination.
2. **Execute phase:** Apply moves in dependency order (deeper paths first to avoid moving a parent before its children), then write manifests last. Write a `<repo>/.rename-progress.json` checkpoint after every successful phase so a crashed run can resume.
3. **Atomic FS sweep:** Use `git mv` for everything (preserves history) within the working tree, all in one Node process. No subprocess per move.
4. **Post-execute validation:** Re-walk the filesystem, assert every `body_path` in every manifest exists on disk, assert no `index.md` or `document.md` remains in scope, assert no `.errata.md` is stranded.
5. **Cleanup:** Delete `.rename-progress.json`. Delete the migration script itself in the same commit (per ADR-021 precedent of script-and-delete).

The "skip if new path exists, fail if both old + new exist" rule from earlier drafts is replaced by this two-phase approach, because the partial-state detection happens in the plan phase before any moves, not at each move.

### 5.8 Directory move strategy

Step 2 of §5.1 says "for every other file under `<NN>/`: mv to the new chapter dir." In practice this is a directory rename, not a per-file mv:

```bash
git mv handbooks/phak/FAA-H-8083-25C/01 handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying
git mv handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying/index.md \
       handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying/00-introduction-to-flying.md
```

`git mv` on a directory recursively renames every file inside, including `figures/`, `tables/`, `_*.txt`/`_*.json` debug files, errata pairs. No glob necessary; directory move is the natural atomic unit.

The earlier mitigation about "all files in the chapter dir" (§6.1) is satisfied: a `git mv <dir>` moves all contents (files AND nested directories) regardless of pattern. If a future ingest puts `figures/` inside a chapter dir (none today), it moves with the parent.

### 5.9 Mechanical vs human-review

- **Mechanical:** every file `mv`, every manifest `body_path` rewrite, every test fixture update, every comment update. Driven by the migration script + a small codemod for tests.
- **Human review:** the spike's before/after artifacts (already produced); the validation procedure outputs (steps 4-6 byte diffs); the CI assertion patches.

## 6. Cost estimate

NO TIME ESTIMATES. Scope by counts:

| Item                                                                       | Count                                                                                              |                           |               |                     |         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------- | ------------- | ------------------- | ------- |
| Markdown files moved                                                       | ~2,640 (every `.md` in `handbooks/` + `aim/` + `ac/`)                                              |                           |               |                     |         |
| Chapter directories renamed (handbooks)                                    | 17 + 18 + 28 = 63                                                                                  |                           |               |                     |         |
| AIM chapter directories renamed                                            | 10                                                                                                 |                           |               |                     |         |
| AIM section directories renamed                                            | 38                                                                                                 |                           |               |                     |         |
| `index.md` -> `00-<slug>.md` renames                                       | 17 + 18 + 28 + 48 = 111                                                                            |                           |               |                     |         |
| `document.md` -> `<slug>-<edition>.md` renames                             | 7 (whole-doc) + 9 (AC) = 16                                                                        |                           |               |                     |         |
| AIM `paragraph-N.md` -> `<NN>-<slug>.md` renames                           | 396                                                                                                |                           |               |                     |         |
| Errata files moved (no rename, just dir change)                            | 20                                                                                                 |                           |               |                     |         |
| Manifest path-field rewrites (body_path + section_path + errata_note_path) | ~2,680 entries across 13+ manifests (verified by `find handbooks/ aim/ ac/ -name 'manifest.json' \ | xargs grep -h 'body_path\ | section_path\ | errata_note_path' \ | wc -l`) |
| Production TS/Python emitter LOC changed                                   | ~15 (concentrated in 4 files)                                                                      |                           |               |                     |         |
| Test fixture updates                                                       | ~25 hardcoded path strings across 7 test files                                                     |                           |               |                     |         |
| Doc-comment updates                                                        | ~17 sites                                                                                          |                           |               |                     |         |
| CI assertions added                                                        | 2 (forbidden filename + glossary collision)                                                        |                           |               |                     |         |

### 6.1 Risk areas

| Risk                                                                                                 | Mitigation                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration runs partial, half the tree is renamed and the other half not                              | Migration script must be idempotent (skip if new path exists, error if both old + new exist). Same pattern as `source-cache-flat-naming`'s `migrate-cache-flat.ts`.                                                                              |
| Manifests + filesystem out of sync after migration                                                   | Migration script writes manifests last, and only after all `mv`s succeed. The script asserts `existsSync` on every new path before writing the manifest.                                                                                         |
| Three emitter pipelines (Python ingest + TS AIM + TS handbooks-extras+AC) drift                      | They already drift today (separate paths, no shared library). Acceptance criteria in §5.5 step 4-6: byte-diff one chapter / section / whole-doc / AC each, expect zero diffs.                                                                    |
| `_*.txt` / `_*.json` debug artifacts accidentally lost in the rename                                 | Migration script does a glob-mv of all files in the old chapter dir to the new chapter dir, not just `*.md`.                                                                                                                                     |
| AIM glossary or appendix files accidentally renumbered                                               | Migration script special-cases AIM: only files matching `paragraph-N.md` are renumbered; `glossary/*.md` and `appendix-N.md` are untouched.                                                                                                      |
| User has uncommitted lesson seed data referencing old paths                                          | `body_path` is sourced from manifests during seeding; after the rename, manifests carry the new paths, so re-seeding produces correct rows.                                                                                                      |
| Open PRs in flight referencing old paths                                                             | The rename is one large commit. Open PRs rebase against it. The user runs solo, so coordination cost is minimal.                                                                                                                                 |
| Future edition ingest produces old-shape filenames (regression)                                      | CI assertion in `manifest-validation.ts` (§5.5 step 7) rejects any `body_path` ending in `index.md` or `document.md`. Catches at validate-time, before merge.                                                                                    |
| AMT un-deferral re-creates orphan files                                                              | AMT files renamed in this WP (per §3.5). The next AMT ingest run will produce new-shape filenames matching what's already on disk; no orphan creation possible.                                                                                  |
| Future glossary term truncates to a colliding slug                                                   | CI assertion (§5.5 step 8) rejects merge if any two glossary slugs collide.                                                                                                                                                                      |
| Regs writer is live, not dead; first post-merge `register cfr` writes `index.md` files into the repo | §2.7 documents the constraint. Regs ingest must stay paused until `regs-derivative-cleanup` WP rewrites the writer. CI assertion explicitly carves out `regulations/` paths until that WP lands. Sign-off requires explicit acknowledgement.     |
| `section_path` and `errata_note_path` rewrites missed                                                | §5.1 step 3 explicitly enumerates ALL three path-bearing fields. The migration script must rewrite all three; production scope is 28+ entries (PHAK 21, AFH 7) for `section_path` plus errata pairs for `errata_note_path`.                      |
| `apply_errata.py` chapter_dir lookup breaks after rename                                             | §5.4 calls out lines 409 AND 430 explicitly. The script update derives chapter dirs from the manifest's title-slug, not from the bare 2-digit chapter code. Tested by re-applying one errata patch end-to-end as part of validation §5.5 step 4. |

## 7. Pros and cons

| Aspect                       | Pro                                                                                  | Con                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDE tab readability          | Every tab title says what it is; no more 5 tabs all named `index.md`                 | -                                                                                                                                                                    |
| `find` / `rg` UX             | `rg ground-operations` returns the right file directly                               | Slug-truncation makes `rg`'s exact matches less reliable for long titles                                                                                             |
| Git history readability      | `git log <new-path>` follows file moves cleanly; renames preserved by `git`          | One commit-large rename creates a 2,640-file diff that's hard to review                                                                                              |
| Citation stability           | `airboss-ref:` URIs unchanged (verified §4.7); `ROUTES.LIBRARY_HANDBOOK_*` unchanged | -                                                                                                                                                                    |
| Schema impact                | None; `body_path` is `z.string().min(1)`                                             | -                                                                                                                                                                    |
| Cross-doc internal links     | None to break (no relative MD links exist)                                           | -                                                                                                                                                                    |
| Pipeline complexity          | Same number of writes per ingest run; no new fields                                  | Three emitters (Python + TS AIM + TS handbooks-extras+AC) must change in lockstep                                                                                    |
| Migration risk               | Idempotent script + manifest rewrite is well-trodden territory (ADR-021 precedent)   | A bug in the rename map silently corrupts citation lookups (mitigated by post-run verification §5.5)                                                                 |
| Onboarding / discoverability | New developer reading the tree understands the corpus structure without docs         | -                                                                                                                                                                    |
| Errata pairing               | Simple rule (basename equality minus `.errata`) is automatable                       | Chapter-overview errata special-case needs the structural+semantic check (§3.5)                                                                                      |
| Whole-doc filename           | `<slug>-<edition>.md` is maximally self-describing                                   | Slug appears twice in path (slug dir + slug filename)                                                                                                                |
| AIM directory rename         | Self-describing dir names mirror the file rename                                     | Adds the slug-stability concern (mitigated by edition-scoped paths)                                                                                                  |
| Slug stability over editions | -                                                                                    | If a chapter title shifts (e.g. AIM 2026-04 vs 2026-08), the dir renames; downstream tooling that hardcodes a path breaks. Mitigation: hardcode by `code`, not path. |
| Future-regression prevention | CI assertions (forbidden filename + glossary collision) catch at validate-time       | Two new assertions to maintain                                                                                                                                       |
| AC inclusion                 | Same rule applies cleanly; one WP instead of two                                     | Adds 9 file moves + 9 manifest rewrites + tests; not free                                                                                                            |

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
