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
2. **Inline derivative tree** (`$REPO_ROOT/handbooks/<doc>/<edition>/`, committed to git). Per-chapter directories with `index.md`, per-section markdown, figure PNGs, table HTML, and a `manifest.json` describing the extraction.
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
     <NN>/
       index.md                    # chapter intro
       <ordinal>-<slug>.md         # per-section markdown
       figures/                    # PNGs
       tables/                     # HTML fragments
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

## Known issues (current as of 2026-04-29)

### LLM-input truncation on long chapters

`chapter_text_max_chars` defaults to 60000 for PHAK. **11 of 17 PHAK
chapters hit the cap on the most recent run** (verified by `wc -c` on
each chapter's `_chapter_plaintext.txt`). The truncation drops the back
half of those chapters from the LLM's input, which silently produces
incomplete section trees on chapters 1, 2, 5, 7, 8, 11, 12, 13, 14, 16,
17.

**Symptoms in the compare report:** chapters with low entry counts on
the LLM side and a large set of "TOC only" headings clustered at the
end of the page range. Chapter 7 is the worst case (22 LLM entries vs
88 TOC entries).

**Root cause:** `chapter_text_max_chars` is too low for long chapters.
Truncation is from the END (per [chapter_plaintext.py](../../tools/handbook-ingest/ingest/chapter_plaintext.py))
to preserve the chapter intro. Fix is two-layered:

1. **Cheap fix:** raise the cap to a value that fits every chapter
   (~300K for PHAK), or remove it entirely.
2. **Right fix:** chapter-level source ingestion (per-chapter PDFs from
   the FAA, where available). Eliminates the cap and gives authoritative
   chapter boundaries. Tracked in `docs/work-packages/chapter-source-ingestion/`
   (in flight at time of writing).

### Migration script survival

[scripts/migrate-cache-flat.ts](../../scripts/migrate-cache-flat.ts) was
intended as a one-shot migration tool deleted in commit B of PR #327
per the cache-flat-naming WP spec. It survived. Either an artifact of
PR ordering or the deletion commit was dropped. **Verify in your tree
before running anything cache-related.** If it's there, the cache may
or may not have been migrated; check the cache layout against ADR 021.

### Stale agent worktrees

`git worktree list` may show many `worktree-agent-*` entries. Most are
locked. Don't touch them; they aren't yours. `git worktree prune` will
clean up entries whose directories no longer exist on disk -- safe.
