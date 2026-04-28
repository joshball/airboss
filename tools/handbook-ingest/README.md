# handbook-ingest

Python ingestion pipeline for FAA handbook PDFs. Produces the per-section
markdown + figure assets + manifest.json that the airboss seed loads into
the `study.reference` / `study.handbook_section` / `study.handbook_figure`
tables.

See `docs/work-packages/handbook-ingestion-and-reader/spec.md` for the full
contract.

## Setup

```bash
cd tools/handbook-ingest
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

The Bun root `package.json` exposes `bun run sources extract handbooks`
which shells to `python -m ingest` from this directory; you don't need to
source the venv to run it (the script does it).

## CLI

```bash
bun run sources extract handbooks <doc> --edition <e> [options]
```

Options:

| Flag                | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `--edition <e>`     | Override the YAML's edition tag                                           |
| `--chapter <code>`  | Restrict to a single chapter (e.g. `12`)                                  |
| `--dry-run`         | Validate without writing files (TOC strategy only)                        |
| `--force`           | Re-extract even if hashes match                                           |
| `--strategy <kind>` | `toc`, `prompt`, or `compare`. Default = read from `<doc>.yaml`           |
| `--no-archive`      | Skip writing `archive/<run-id>/` for `--strategy prompt` runs             |

`<doc>` is the document slug (`phak`, `afh`, `avwx`, etc.); the per-document
config in `ingest/config/<doc>.yaml` carries the source URL, edition tag,
TOC page range, heading-style fingerprint, and section-strategy default.

Examples:

```bash
# Default (reads section_strategy from phak.yaml)
bun run sources extract handbooks phak --edition FAA-H-8083-25C

# Single chapter
bun run sources extract handbooks phak --edition FAA-H-8083-25C --chapter 12

# Validate only (TOC strategy)
bun run sources extract handbooks phak --edition FAA-H-8083-25C --dry-run

# Force re-extract ignoring cached hashes
bun run sources extract handbooks phak --edition FAA-H-8083-25C --force

# Explicit TOC strategy (deterministic Python)
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy toc

# Prompt strategy: emit prompt set for paste-into-Claude-Code flow
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy prompt

# Compare strategy: read prompt-flow JSONs and diff vs TOC
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare
```

## Section-tree strategies

Section granularity (chapter -> section -> subsection) is extracted by one
of two strategies. The per-handbook YAML config picks the default; the
`--strategy` flag overrides per-run. See
[docs/agents/section-extraction-prompt-strategy.md](../../docs/agents/section-extraction-prompt-strategy.md)
for the full prompt-flow walkthrough.

### `--strategy toc` (deterministic Python)

Module: `ingest/sections_via_toc.py`.

1. Reads the printed Table of Contents page range from `<doc>.yaml -> toc`.
2. Parses each TOC page line-by-line via PyMuPDF's `dict` text blocks.
3. Resolves indent depth from each line's column-x; collapses to L1 / L2
   under the active chapter.
4. Verifies each TOC entry against the body PDF by walking to the named
   FAA page (`12-7`) and matching a heading-style text run whose font /
   color / size matches `<doc>.yaml -> heading_style`.

Determinism: same source PDF + same `<doc>.yaml` = byte-identical section
tree. The body-verify step's mismatches are surfaced as warnings in the
manifest; the section is still emitted.

### `--strategy prompt` (paste-and-run, no API key)

Module: `ingest/prompt_emit.py`. Templates:
`ingest/prompts/section-extraction/{parameters,orchestrator,chapter,run_readme}.md`.

1. For each chapter, the existing `sections.py` extracts plaintext.
2. Plaintext is written to
   `handbooks/<doc>/<edition>/<NN>/_chapter_plaintext.txt` (sidecar; the
   sub-agent's verbatim input).
3. The CLI emits a self-contained prompt set into
   `tools/handbook-ingest/prompts-out/<doc>/<edition>/out/` plus a frozen
   snapshot at `archive/<run-id>/`.
4. The user pastes `out/_run.md` into a fresh Claude Code session. Sub-
   agents fan out one-per-chapter and write
   `handbooks/<doc>/<edition>/<NN>/_llm_section_tree.json` plus
   `handbooks/<doc>/<edition>/<NN>/_model_self_report.txt`.
5. The user runs `--strategy compare` to diff vs TOC.

No `ANTHROPIC_API_KEY`, no model pin maintained in this tool. The fresh
Claude Code session provides the model.

### `--strategy compare`

Module: `ingest/sections_compare.py`.

Reads the per-chapter `_llm_section_tree.json` + `_model_self_report.txt`
files produced by the prompt flow, runs the deterministic TOC strategy,
diffs the two trees per chapter, and writes a markdown report at:

```text
tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md
```

The report shows:

- Per-chapter L1 / L2 counts for each strategy
- Agreement bucket (full / partial / low)
- Title-by-title diff: TOC-only entries, prompt-flow-only entries, level
  disagreements, parent-title disagreements

The user reads the report and updates `<doc>.yaml -> section_strategy`
based on which strategy wins. Compare mode does NOT seed section rows;
it only writes the report.

Hard-fails on missing or malformed JSON / `_model_self_report.txt`. The
user re-pastes the failing chapter's prompt manually if a retry is wanted
(no skip-with-warning).

## Module layout

```text
ingest/
  cli.py                      # click entry point with verbose narration
  fetch.py                    # download + checksum the source PDF
  outline.py                  # PDF outline -> chapter/section/subsection tree
  sections.py                 # PyMuPDF body extraction (source of truth)
  chapter_plaintext.py        # writes _chapter_plaintext.txt sidecars
  prompt_emit.py              # emits the per-run prompt set into prompts-out/
  section_tree.py             # shared SectionTreeNode + derive_codes contract
  sections_via_toc.py         # TOC strategy (deterministic Python)
  sections_via_sidecar.py     # prompt-flow JSON loader
  sections_compare.py         # diff TOC vs prompt-flow trees per chapter
  prompts/
    section_tree.md           # JSON output contract (snapshotted into runs)
    section-extraction/
      parameters.md           # sub-agent rules (single source of truth)
      orchestrator.md         # paste target template
      chapter.md              # per-chapter prompt template
      run_readme.md           # README skeleton emitted into each run
    README.md                 # prompt-versioning docs
  figures.py                  # figure detection + caption binder
  tables.py                   # table detection -> HTML
  normalize.py                # compose per-section markdown + manifest.json
  config/
    phak.yaml
    afh.yaml
    avwx.yaml
prompts-out/                  # per-run prompt sets (committed)
  <doc>/<edition>/
    out/                      # mutable; overwritten each run
    archive/<run-id>/         # frozen snapshots
tests/                        # unit tests (pytest)
reports/                      # generated compare reports
```

## Output

Per [ADR 018](../../docs/decisions/018-source-artifact-storage-policy/decision.md)
(Flavor D), the source PDF lives in a developer-local cache **outside the
repo**; extracted derivatives stay inline.

```text
# In the repo (committed inline derivatives):
handbooks/<doc>/<edition>/
  manifest.json                (chapters, sections, figures, hashes, warnings, extraction metadata)
  <chapter>/
    index.md                   (chapter overview)
    <section>.md               (per-section markdown + frontmatter)
    _chapter_plaintext.txt     (prompt-flow sidecar; only when strategy=prompt|compare)
    _llm_section_tree.json     (prompt-flow output, written by sub-agents)
    _model_self_report.txt     (prompt-flow output, one line; e.g. "claude-opus-4-7")
  figures/
    fig-<chapter>-<n>-<slug>.png
  tables/
    tbl-<chapter>-<n>-<slug>.html

tools/handbook-ingest/prompts-out/<doc>/<edition>/
  out/                         (mutable; the paste target for --strategy prompt)
  archive/<run-id>/            (frozen snapshot per run; archive-by-default)

# On the developer's laptop (cached, gitignored):
$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/
  source.pdf                   (FAA-fetched; default cache root
                                ~/Documents/airboss-handbook-cache/)
```

The pipeline auto-creates the cache directory on first run and re-uses the
cached PDF on subsequent runs. Override the cache root via
`export AIRBOSS_HANDBOOK_CACHE=/path/to/somewhere/else`.

`.gitignore` blocks `handbooks/**/*.pdf` from staging so the source bytes
never land in a commit. The matching `.gitattributes` LFS filter line is
dormant plumbing for the day the policy flips.

## Validation gates

| Rule                                                                 | Severity |
| -------------------------------------------------------------------- | -------- |
| PDF outline parsed cleanly into chapter/section/subsection           | error    |
| Every chapter's text is non-empty                                    | error    |
| Every figure caption matching `Figure N-N.` binds to an image        | warning  |
| Every cross-page table merged without a gap                          | warning  |
| TOC entry verifies against body heading (font/color/size)            | warning  |
| Compare strategy: prompt-flow JSON missing or malformed              | error    |
| Compare strategy: source PDF SHA-256 differs from prompt-run record  | error    |
| Internal "see Chapter N" cross-reference resolves                    | warning  |

Errors fail the run; warnings print and continue. Manifest records counts
and detail.

## Testing

```bash
cd tools/handbook-ingest
source .venv/bin/activate
python -m pytest tests/
ruff check ingest/ tests/
```

Tests cover:

- `test_section_tree.py` -- `derive_codes` walks chapter / section /
  subsection without leaking counters across chapters.
- `test_sections_via_toc.py` -- TOC parser against synthetic indented
  fixtures; chapter-not-in-outline warnings; continuation-line coalescing;
  L3 indent collapse to L2.
- `test_chapter_plaintext.py` -- sidecar writer; truncation from end;
  strategy-gated writes.
- `test_prompt_emit.py` -- prompt set rendering; meta.json schema; archive
  vs no-archive; collision suffix.
- `test_sections_via_sidecar.py` -- JSON load; hard-fail on missing /
  malformed JSON or model-self-report.
- `test_sections_compare.py` -- agreement buckets; level / parent
  disagreements; markdown report shape.
- `test_config_loader.py` -- YAML migration errors (`llm` strategy,
  `per_chapter_section_strategy`, `llm:` block rename).
- `test_cli_integration.py` -- round-trip prompt -> compare; PDF-drift
  detection; archive-by-default.
