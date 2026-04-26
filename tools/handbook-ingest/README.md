# handbook-ingest

Python ingestion pipeline for FAA handbook PDFs. Produces the per-section
markdown + figure assets + manifest.json that the airboss seed loads into the
`study.reference` / `study.handbook_section` / `study.handbook_figure` tables.

See `docs/work-packages/handbook-ingestion-and-reader/spec.md` for the full
contract.

## Setup

```bash
cd tools/handbook-ingest
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

The Bun root `package.json` exposes `bun run handbook-ingest` which shells to
`python -m ingest` from this directory; you don't need to source the venv to
run it (the script does it).

## CLI

```bash
bun run handbook-ingest <doc> --edition <e> [--chapter N] [--dry-run] [--force]
```

Examples:

```bash
bun run handbook-ingest phak --edition FAA-H-8083-25C
bun run handbook-ingest phak --edition FAA-H-8083-25C --chapter 12
bun run handbook-ingest phak --edition FAA-H-8083-25C --dry-run
bun run handbook-ingest phak --edition FAA-H-8083-25C --force
```

`<doc>` is the document slug (`phak`, `afh`, `avwx`, etc.); the per-document
config in `ingest/config/<doc>.yaml` carries the source URL, edition tag,
page-offset map, and figure-prefix conventions.

## Module layout

```text
ingest/
  cli.py         click entry point
  fetch.py       download + checksum the source PDF
  outline.py     PDF outline -> chapter/section/subsection tree
  sections.py    per-section text extraction (PyMuPDF)
  figures.py     figure detection + caption binder
  tables.py      table detection -> HTML
  normalize.py   compose per-section markdown + manifest.json
  config/
    phak.yaml
    afh.yaml
    avwx.yaml
```

## Output

Per [ADR 018](../../docs/decisions/018-source-artifact-storage-policy/decision.md)
(Flavor D), the source PDF lives in a developer-local cache **outside the repo**;
extracted derivatives stay inline.

```text
# In the repo (committed inline derivatives):
handbooks/<doc>/<edition>/
  manifest.json              (chapters, sections, figures, hashes, warnings)
  <chapter>/
    index.md                 (chapter overview)
    <section>.md             (per-section markdown + frontmatter)
  figures/
    fig-<chapter>-<n>-<slug>.png
  tables/
    tbl-<chapter>-<n>-<slug>.html

# On the developer's laptop (cached, gitignored):
$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/
  source.pdf                 (FAA-fetched; default cache root
                              ~/Documents/airboss-handbook-cache/)
```

The pipeline auto-creates the cache directory on first run and re-uses the
cached PDF on subsequent runs. Override the cache root via
`export AIRBOSS_HANDBOOK_CACHE=/path/to/somewhere/else`.

`.gitignore` blocks `handbooks/**/*.pdf` from staging so the source bytes
never land in a commit. The matching `.gitattributes` LFS filter line is
dormant plumbing for the day the policy flips.

## Validation gates

| Rule                                                        | Severity |
| ----------------------------------------------------------- | -------- |
| PDF outline parsed cleanly into chapter/section/subsection. | error    |
| Every section's text is non-empty.                          | error    |
| Every figure caption that matches `Figure N-N.` binds to an image. | warning |
| Every cross-page table merged without a gap.                | warning  |
| Every internal "see Chapter N" cross-reference resolves.    | warning  |

Errors fail the run; warnings print and continue. Manifest records counts.
