# Handbook ingest pipeline

End-to-end overview of how an FAA aviation publication becomes structured
content in the airboss repo. Read this first when you need to understand
*what `bun run sources extract` does*. Companion docs:

- [section-extraction-strategies.md](section-extraction-strategies.md) -- TOC vs LLM vs compare deep dive
- [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) -- the no-API-key paste-driven flow
- [handbook-onboarding-checklist.md](handbook-onboarding-checklist.md) -- adding a new handbook

## Path tokens used in this doc

To stay correct as the cache layout evolves, paths are written as
patterns. Substitute mentally:

| Token                  | Meaning                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `$HANDBOOK_CACHE_ROOT` | `~/Documents/airboss-handbook-cache/` (override via `AIRBOSS_HANDBOOK_CACHE`)    |
| `$REPO_ROOT`           | The repo root on your machine (e.g. `/Users/joshua/src/_me/aviation/airboss/`)   |
| `<doc>`                | Document slug (e.g. `phak`, `afh`, `avwx`)                                       |
| `<edition>`            | Edition tag (e.g. `FAA-H-8083-25C`)                                              |
| `<NN>`                 | Two-digit chapter ordinal (`01`..`17`)                                           |

Cache layout is governed by [ADR 021](../decisions/021-source-cache-flat-naming/decision.md).
Storage policy is governed by [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md).

## What the pipeline does

It turns one FAA PDF (or set of FAA assets) into a structured body of
content the rest of the platform can read:

```text
FAA URL  ->  cached source bytes  ->  outline  ->  per-section markdown
                                              \-> per-chapter sidecars  ->  LLM section trees
                                                                       \-> compare report
```

The output side falls into three trees:

1. **Source cache** (`$HANDBOOK_CACHE_ROOT`, gitignored, developer-local). Source PDFs and any chapter / errata variants. One directory per corpus: `handbooks/`, `ac/`, `acs/`, `aim/`, `regulations/`. Per-corpus or per-edition `manifest.json` records what's there.
2. **Inline derivative tree** (`$REPO_ROOT/handbooks/<doc>/<edition>/`, committed to git). Per-chapter directories named `<NN>-<chapter-slug>/` containing a chapter overview (`00-<chapter-slug>.md`), per-section markdown, figure PNGs, table HTML, and a `manifest.json` describing the extraction.
3. **Run artifacts** (`$REPO_ROOT/tools/handbook-ingest/prompts-out/<doc>/<edition>/`, committed). Prompt sets emitted for the no-API-key LLM flow, plus archived snapshots per run.

Comparison reports land at `$REPO_ROOT/tools/handbook-ingest/reports/`.

## CLI entry point

```bash
bun run sources extract handbooks <doc> [options]
```

That's a `bun` shim around the Python CLI at
[tools/handbook-ingest/ingest/cli.py](../../tools/handbook-ingest/ingest/cli.py).
The Python is invoked through a venv at `tools/handbook-ingest/.venv/`.
Options:

| Flag                     | Effect                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `--edition <e>`          | Override edition tag (defaults to the YAML's `edition`).                                                     |
| `--chapter <code>`       | Restrict to one chapter (e.g. `12`).                                                                         |
| `--strategy <s>`         | `toc` \| `prompt` \| `compare`. Defaults to YAML `section_strategy`.                                         |
| `--dry-run`              | Validate only; no writes. Not allowed with `--strategy prompt`.                                              |
| `--force`                | Re-extract even when source SHAs match.                                                                      |
| `--no-archive`           | Skip writing `prompts-out/<doc>/<edition>/archive/<run-id>/` (default is to archive).                        |
| `--apply-errata <id>`    | Apply one errata document (post-extraction patch step). Skips the full pipeline.                             |
| `--reapply-errata`       | Re-apply every errata in YAML order. Idempotent without `--force`.                                           |

## Per-handbook config

Each handbook has a YAML at
`$REPO_ROOT/scripts/sources/config/handbooks/<doc>.yaml` (consolidated by
[ADR 022](../decisions/022-chapter-source-ingestion/decision.md); the same
file is read by the TS downloader and the Python ingest tool). It pins:

- `source_url`, `expected_pages`, `page_offset` (PDF page 1 vs printed
  page 1-1).
- `outline_strategy: bookmark | content` -- how the chapter list is
  derived.
- `section_strategy: toc | prompt | compare` -- the default.
- `chapter_text_max_chars` -- the LLM-input truncation cap. **This is the
  load-bearing knob behind the truncation pitfall described later in
  this doc.**
- `chapter_overrides`, `title_overrides`, `errata`, etc.

Reading the YAML for the handbook you're touching is non-negotiable.
Don't guess.

## Phases (every strategy)

The first two phases run regardless of strategy.

### Phase 1 -- fetch source PDF

Module: [fetch.py](../../tools/handbook-ingest/ingest/fetch.py)

- Reads `$HANDBOOK_CACHE_ROOT/handbooks/<doc>/<edition>/<edition>.pdf` if
  it exists and the SHA matches.
- Otherwise downloads from `source_url` and writes the cached bytes.
- Returns `FetchResult{path, size_bytes, sha256}`. Every later phase is
  anchored to this SHA.

Failure modes: HTTP errors, hash mismatch under `--force`, missing cache
root env (defaults to `~/Documents/airboss-handbook-cache`).

### Phase 2 -- parse outline

Module: [outline.py](../../tools/handbook-ingest/ingest/outline.py)

- Derives a flat list of `OutlineNode{level, code, title, page_start, page_end, parent_code, ordinal}` from the PDF.
- Two strategies, set per-handbook in YAML:
  - `bookmark` -- reads PyMuPDF `get_toc()` (the PDF's built-in outline). Used when the publisher embeds reliable bookmarks.
  - `content` -- scans page text for chapter headings. Used when bookmarks are unreliable. PHAK uses this. (Side effect: the printed-TOC pages are skipped to avoid false positives -- see `_toc_page_set()` in [cli.py](../../tools/handbook-ingest/ingest/cli.py).)

Failure mode: `OutlineError` when neither strategy resolves chapter
boundaries.

After outline parsing, `chapter` rows are filtered out for downstream
strategy-specific processing. For PHAK that's 17 rows.

## Strategy: `toc` (the deterministic path)

Default for every shipped handbook. **No LLM involvement.** Produces the
in-repo derivative tree (markdown + figures + tables + manifest).

Sub-phases:

1. **`extract_sections`** ([sections.py](../../tools/handbook-ingest/ingest/sections.py)) -- PyMuPDF page-by-page extraction of per-chapter body text. Empty bodies are a hard fail.
2. **`extract_figures` + `extract_tables`** ([figures.py](../../tools/handbook-ingest/ingest/figures.py), [tables.py](../../tools/handbook-ingest/ingest/tables.py)) -- pull figure PNGs and table HTML. Figures are deduplicated by content hash.
3. **`sections_via_toc.extract_via_toc`** ([sections_via_toc.py](../../tools/handbook-ingest/ingest/sections_via_toc.py)) -- parse the printed Table of Contents (the `toc:` YAML block names which PDF pages hold it). Produces `SectionTreeNode{level, title, page_anchor, ordinal, chapter_ordinal}`. Emits warnings when a TOC line can't be fingerprinted to a body heading. **For PHAK FAA-H-8083-25C this is 833 nodes / 668 warnings.** Warnings end up in the manifest; they don't fail the run.
4. **`write_outputs`** ([normalize.py](../../tools/handbook-ingest/ingest/normalize.py)) -- writes the in-repo derivative tree:

   ```text
   $REPO_ROOT/handbooks/<doc>/<edition>/
     <NN>-<chapter-slug>/
       00-<chapter-slug>.md        # chapter intro
       <ordinal>-<slug>.md         # per-section markdown
     figures/                      # PNGs (corpus-level, not nested per-chapter)
     tables/                       # HTML fragments (corpus-level)
     manifest.json                 # records source SHA, warnings, derivative shape
   ```

Failure modes:

| Phase                  | Failure                                              | Resolution                                                            |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `extract_sections`     | Empty body for any section                           | Hard fail with chapter codes listed; check `page_offset` in YAML.     |
| `extract_figures`      | Mis-numbered figure                                  | Warning in manifest; check `figure_prefix_pattern` in YAML.           |
| `sections_via_toc`     | TOC line can't fingerprint to a body heading         | Warning; non-fatal. See [section-extraction-strategies.md](section-extraction-strategies.md). |

## Strategy: `prompt` (LLM input emit)

Used to generate inputs for the no-API-key LLM section-extraction flow.
**Does not call any LLM.** Stops after writing inputs; the user runs the
LLM in a separate paste-driven session, then runs `--strategy compare`.

The full how-to is in
[section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md).
Brief summary of what this strategy does on the Python side:

1. **`write_chapter_sidecars`** ([chapter_plaintext.py](../../tools/handbook-ingest/ingest/chapter_plaintext.py)) -- per chapter, write the PDF-extracted plaintext to `$REPO_ROOT/handbooks/<doc>/<edition>/<NN>/_chapter_plaintext.txt`. **Truncated from the END to `chapter_text_max_chars`** (per-handbook YAML).
2. **`emit_prompts`** ([prompt_emit.py](../../tools/handbook-ingest/ingest/prompt_emit.py)) -- substitute placeholders into 4 templates and write the run directory:

   ```text
   $REPO_ROOT/tools/handbook-ingest/prompts-out/<doc>/<edition>/
     out/                          # mutable, overwritten each run
       _run.md                     # orchestrator -- the paste target
       _parameters.md              # sub-agent rules
       _section_tree_contract.md   # JSON output spec
       _config.yaml                # snapshot of the handbook YAML
       meta.json                   # write-once replay record
       README.md
       01-<chapter-slug>.md        # per-chapter prompt
       ...
       NN-<chapter-slug>.md
     archive/                      # frozen per-run snapshot
       <run-id>/
         ... mirror of out/ ...
   ```

3. **Stops.** The strategy prints "NEXT STEP" guidance directing the user
   to a fresh Claude Code session. Section JSON files do NOT yet exist;
   no manifest rows are seeded.

The user then opens a fresh CC session, pastes `out/_run.md`, and that
session's sub-agents write per-chapter JSON to the inline derivative
tree:

```text
$REPO_ROOT/handbooks/<doc>/<edition>/<NN>/
  _llm_section_tree.json
  _model_self_report.txt
```

## Strategy: `compare` (diff TOC vs LLM)

Reads the LLM-side artifacts emitted by the paste-driven flow plus the
deterministic TOC parse, and writes a markdown diff report.

Sub-phases:

1. **Verify source PDF SHA-256** -- reads `prompts-out/<doc>/<edition>/out/meta.json` and compares its `source_pdf_sha256` to the just-fetched PDF's hash. Hard-fail on drift ("PDF changed since the prompt run -- re-emit prompts").
2. **`load_chapter_sidecars`** ([sections_via_sidecar.py](../../tools/handbook-ingest/ingest/sections_via_sidecar.py)) -- read each chapter's `_llm_section_tree.json` + `_model_self_report.txt`. Hard-fails on missing or malformed JSON (no skip-with-warning).
3. **`extract_via_toc`** -- runs the TOC strategy fresh. Does NOT touch the in-repo derivative tree.
4. **`compare_strategies`** ([sections_compare.py](../../tools/handbook-ingest/ingest/sections_compare.py)) -- greedy title-match within `(chapter, level)`, produces a markdown diff at `$REPO_ROOT/tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md`.

Failure modes:

| Phase                       | Failure                              | Resolution                                                       |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Verify SHA                  | PDF bytes changed since prompt run   | Re-run `--strategy prompt` first.                                |
| `load_chapter_sidecars`     | Missing `_llm_section_tree.json`     | Re-paste `out/_run.md` into a fresh CC session.                  |
| `load_chapter_sidecars`     | Malformed JSON                       | Re-paste that chapter's prompt manually.                         |
| `compare_strategies`        | Never fails; always renders          | Read the report.                                                 |

## Errata path (`--apply-errata` / `--reapply-errata`)

Module: [apply_errata.py](../../tools/handbook-ingest/ingest/apply_errata.py).
Edits already-extracted section markdown + `manifest.json` per the YAML
`errata:` list. Cache-side, errata documents live alongside the primary
PDF as `<edition>-errata-<id>.pdf` (per ADR 021). Skips the full
extraction pipeline. See [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md)
for the policy on errata across editions.

### Errata download is on-demand, not pre-fetched

Important boundary: `bun run sources download handbooks` does NOT
download errata files. The TS download path emits plans for whole-doc,
chapter PDFs, ancillaries, AIM HTML, AC/ACS, and regs -- but not errata.

Errata are fetched on-demand by `apply_errata.py` as a side-effect of
`--apply-errata <id>`. The Python module's `_download_errata_pdf()`
either reuses a cached `<edition>-errata-<id>.pdf` if present or
fetches from the YAML's `errata[].source_url`. Errata are deliberately
on-demand because:

- Not every operator needs every errata applied.
- The Python side owns the apply pipeline; bundling fetch with apply
  keeps "did the right bytes get applied" verifiable in one place.
- The Python module also reuses any pre-cached errata file (e.g. an
  operator-downloaded PDF placed at the canonical filename) without
  re-fetching.

Cache-side consequence: a fresh-clone operator who runs
`bun run sources download handbooks` will have the whole-doc and
chapter PDFs, but `<edition>-errata-<id>.pdf` is absent until they
actually invoke `--apply-errata`. This is by design, not a bug. If you
see a handbook config declaring errata but no errata PDF in the cache
for that handbook, run the apply command instead of treating it as a
download gap.

The handbook-side `manifest.json` carries the `errata[]` array with
applied timestamps, source SHA, and per-section `errata_note_path`
references. That manifest is owned by `apply_errata.py`, NOT by the
TS downloader; the TS downloader's `manifest.ts` documents this
boundary explicitly: "Errata entries on handbook manifests are managed
by the Python ingest pipeline; we preserve them across writes."

## Resolved issues

### LLM-input truncation on long chapters (RESOLVED)

The `chapter_text_max_chars` cap (originally 60000) silently truncated
long chapters mid-content. PHAK ch 7 produced 22 entries instead of 89
under v1 because the back half of the chapter was never in the input.

**Resolved by two layered fixes:**

1. PR #332 raised per-handbook caps empirically (PHAK 250000, AFH 200000,
   AVWX 150000 -- each set to longest_chapter * 1.2). PR #335 removed the
   silent default; `prompt`-mode handbooks must declare a cap explicitly.
2. PR #337 (chapter-source-ingestion, ADR 022) bypasses the cap entirely
   for handbooks that publish per-chapter PDFs (PHAK, AFH, IPH,
   helicopter, glider, balloon, instructors): the chapter PDF IS the
   input unit, no slicing, no truncation.
3. Contract v3 (PR #355) added a coverage self-check that catches output
   truncation explicitly: the LLM verifies the last entry's page anchor
   is on or after the chapter's last printed page (with v3.1 amendment
   for figure-only trailing pages).

**Verification:** PR #355 ran phak end-to-end. Ch 7 produced 89 entries.
Every chapter has populated page anchors and Chapter Summary boilerplate.

Re-measure caps with [tools/handbook-ingest/measure_chapter_sizes.py](../../tools/handbook-ingest/measure_chapter_sizes.py)
when adding a new handbook or after an FAA edition update.

### Stale agent worktrees

`git worktree list` may show many `worktree-agent-*` entries. Most are
locked. Don't touch them; they aren't yours. `git worktree prune` will
clean up entries whose directories no longer exist on disk -- safe.
