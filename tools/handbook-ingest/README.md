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

Optional Anthropic SDK (the LLM strategy works without it via raw urllib;
install only if you want the official client on PATH):

```bash
pip install -e .[llm]
```

The Bun root `package.json` exposes `bun run handbook-ingest` which shells
to `python -m ingest` from this directory; you don't need to source the
venv to run it (the script does it).

## CLI

```bash
bun run handbook-ingest <doc> --edition <e> [options]
```

Options:

| Flag                   | What it does                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| `--edition <e>`        | Override the YAML's edition tag                                             |
| `--chapter <code>`     | Restrict to a single chapter (e.g. `12`)                                    |
| `--dry-run`            | Validate without writing files                                              |
| `--force`              | Re-extract even if hashes match                                             |
| `--strategy <kind>`    | `toc`, `llm`, or `compare`. Default = read from `<doc>.yaml`                |

`<doc>` is the document slug (`phak`, `afh`, `avwx`, etc.); the per-document
config in `ingest/config/<doc>.yaml` carries the source URL, edition tag,
TOC page range, heading-style fingerprint, and section-strategy default.

Examples:

```bash
# Default (reads section_strategy from phak.yaml)
bun run handbook-ingest phak --edition FAA-H-8083-25C

# Single chapter
bun run handbook-ingest phak --edition FAA-H-8083-25C --chapter 12

# Validate only
bun run handbook-ingest phak --edition FAA-H-8083-25C --dry-run

# Force re-extract ignoring cached hashes
bun run handbook-ingest phak --edition FAA-H-8083-25C --force

# Explicit TOC strategy (Option 3, deterministic Python)
bun run handbook-ingest phak --edition FAA-H-8083-25C --strategy toc

# LLM strategy (Option 4, Claude-assisted; requires ANTHROPIC_API_KEY)
bun run handbook-ingest phak --edition FAA-H-8083-25C --strategy llm

# Compare both, write a markdown diff under reports/, do not seed sections
bun run handbook-ingest phak --edition FAA-H-8083-25C --strategy compare
```

## Section-tree strategies

Section granularity (chapter -> section -> subsection) is extracted by one
of two strategies. The per-handbook YAML config picks the default; the
`--strategy` flag overrides per-run.

### Option 3: `--strategy toc` (deterministic Python)

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

### Option 4: `--strategy llm` (Claude-assisted)

Module: `ingest/sections_via_llm.py`. Prompt:
`ingest/prompts/section_tree.md` (committed; SHA-256 recorded in
`manifest.json`).

1. For each chapter, the existing `sections.py` extracts plaintext.
2. The plaintext + chapter title are injected into the committed prompt.
3. POST to the Anthropic Messages API with `model=claude-sonnet-4-5`,
   `temperature=0`, `max_tokens=4096`. `ANTHROPIC_API_KEY` env var
   required; missing key -> exit code 3.
4. Raw JSON response is saved at
   `handbooks/<doc>/<edition>/<chapter>/_llm_section_tree.json` (committed;
   PR-reviewable).
5. Parsed entries become `SectionTreeNode` rows with deterministic codes.

Determinism within model bounds. To tweak the prompt, edit
`section_tree.md`, re-run with `--strategy llm --force`, diff the saved
JSON files, and commit the prompt + regenerated trees together.

### Compare: `--strategy compare`

Module: `ingest/sections_compare.py`.

Runs both strategies, diffs the trees per chapter, writes a markdown
report at:

```text
tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md
```

The report shows:

- Per-chapter L1 / L2 counts for each strategy
- Agreement bucket (full / partial / low)
- Title-by-title diff: TOC-only entries, LLM-only entries, level
  disagreements, parent-title disagreements

Joshua reads the report and sets `section_strategy: per_chapter` plus
`per_chapter_section_strategy: { 1: toc, 12: llm, ... }` in the YAML.
Compare mode does NOT seed section rows; it only writes the report.

## Module layout

```text
ingest/
  cli.py                      # click entry point
  fetch.py                    # download + checksum the source PDF
  outline.py                  # PDF outline -> chapter/section/subsection tree
  sections.py                 # legacy chapter-only text extraction (used as fallback)
  section_tree.py             # shared SectionTreeNode + derive_codes contract
  sections_via_toc.py         # Option 3: deterministic TOC parser
  sections_via_llm.py         # Option 4: LLM-assisted via Anthropic Messages API
  sections_compare.py         # diff TOC vs LLM trees per chapter
  prompts/
    section_tree.md           # committed prompt (SHA-256 in manifest)
    README.md                 # prompt-versioning docs
  figures.py                  # figure detection + caption binder
  tables.py                   # table detection -> HTML
  normalize.py                # compose per-section markdown + manifest.json
  config/
    phak.yaml
    afh.yaml
    avwx.yaml
tests/                        # unit tests (pytest)
reports/                      # generated compare reports (gitignored except for examples)
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
    _llm_section_tree.json     (LLM-strategy raw response, committed for audit)
  figures/
    fig-<chapter>-<n>-<slug>.png
  tables/
    tbl-<chapter>-<n>-<slug>.html

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
| LLM API call fails or returns malformed JSON                         | warning  |
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
- `test_sections_via_llm.py` -- mocked Claude caller; markdown-fencing
  strip; invalid-entry filter; raw response file written.
- `test_sections_compare.py` -- agreement buckets; level / parent
  disagreements; markdown report shape.
