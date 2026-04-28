# Storage policy

This is the canonical rule for where content artifacts live in the airboss repo. Established by [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md). Every new content corpus follows it.

## The three tiers

| Tier                      | What it is                                                                                                              | Where                                                                  | Tracked how                                    | Renders to user? |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| **Source documents**      | The original artifact published by an outside authority. Bytes are kept locally for re-extraction; not in the repo.     | `$AIRBOSS_HANDBOOK_CACHE/<corpus>/<doc>/<edition>/source.<ext>`        | Local cache + gitignore + LFS plumbing dormant | No               |
| **Extracted derivatives** | What the ingestion pipeline produces from the source: markdown, images, tables, transcripts, the manifest.              | Alongside the corpus root inside the repo                              | Inline git                                     | Yes (after seed) |
| **Generated artifacts**   | What the seed pipeline produces from the derivatives: DB rows, search indexes, computed graph data.                     | Postgres / app runtime                                                 | Not in repo at all                             | Yes (live)       |

## Cache location

Source documents live in a developer-local cache directory outside the repo. Default: `~/Documents/airboss-handbook-cache/`. Overridable via the `AIRBOSS_HANDBOOK_CACHE` env var.

Cache layout mirrors the in-repo derivative tree:

```text
$AIRBOSS_HANDBOOK_CACHE/
  handbooks/
    phak/
      8083-25C/
        source.pdf                   <- 74 MB FAA-fetched
    afh/
      8083-3C/
        source.pdf                   <- 261 MB FAA-fetched
  regulations/ac/
    61-65/
      source.pdf
  aim/
    2025-09/
      source.pdf
  audio/
    phak/
      8083-25C/12-3/
        source.wav
```

The cache is **not in the repo**. It is not gitignored because it lives outside the repo entirely. Each ingestion pipeline auto-creates its own subdirectory in the cache on first run, downloads the source from the publisher's URL, and re-uses it on subsequent runs.

## Repo layout (derivatives only)

The repo contains only the extracted derivatives:

```text
handbooks/phak/8083-25C/
  manifest.json                <- audit metadata (source_url, source_sha256, fetched_at)
  12/index.md                  <- inline (chapter overview)
  12/03-atmospheric-pressure.md
  figures/fig-12-7-...png
  tables/tbl-12-3-...html

regulations/ac/61-65/
  manifest.json
  paragraphs/...md

aim/2025-09/
  manifest.json
  5-1-7.md                     <- per AIM paragraph

audio/phak/8083-25C/12-3/
  transcript.md
  segments.json
```

## Why LFS plumbing is in `.gitattributes` even though no LFS bytes ever flow through it

`.gitattributes` carries an LFS filter line for every source-document corpus. Today this line is dormant because `.gitignore` prevents matching files from ever being staged. The line is in place so the future flip to real LFS storage (if/when triggered) is a one-line `.gitignore` removal, not a re-architecture.

Walk-through of `git add handbooks/phak/8083-25C/source.pdf` today:

1. **gitignore check.** `.gitignore` matches `handbooks/**/*.pdf`. Git refuses to stage the file. Pipeline stops.
2. **`.gitattributes` filter check.** Never reached.

Walk-through of the same `git add` if `.gitignore` is later relaxed:

1. **gitignore check.** No match. File proceeds.
2. **`.gitattributes` filter.** `filter=lfs` activates. File goes through LFS clean filter; bytes stored in `.git/lfs/objects/`; pointer file (130 bytes) committed.
3. **`git push`.** LFS uploads bytes to whatever LFS server is configured at that point.

`git lfs install` is **not** a developer prerequisite under this policy. The filter is dormant. README documents `git lfs install` as a *future* prerequisite for the day the policy flips.

## Adding a new corpus

When an ingestion WP for a new corpus lands:

1. Pick the corpus root. Top-level directory, kebab-case, plural noun (`handbooks/`, `regulations/`, `aim/`, `audio/`, `pohs/`).
2. Add the LFS filter line to `.gitattributes`:
   ```text
   <corpus-root>/**/*.<source-ext> filter=lfs diff=lfs merge=lfs -text
   ```
3. Add the gitignore line to `.gitignore`:
   ```text
   <corpus-root>/**/*.<source-ext>
   ```
4. Pipeline writes source to `$AIRBOSS_HANDBOOK_CACHE/<corpus-root>/<doc-slug>/<edition-tag>/source.<ext>`.
5. Pipeline writes derivatives inline at `<corpus-root>/<doc-slug>/<edition-tag>/...` in the repo.
6. Seed pipeline reads inline derivatives and writes DB rows.
7. Update this doc's per-corpus table with a one-line entry.

That's the whole procedure. No ADR needed per corpus once this policy is in place.

## Rules of thumb

- **If it was published by someone else, it's a source. Cache it locally; don't commit it.** FAA, manufacturer, NTSB, ICAO, third-party authorized translation -- all source.
- **If our pipeline produced it from a source, it's a derivative. Commit it inline.** Markdown, figure PNGs, HTML tables, manifest.json, transcripts, segment timings.
- **If the seed produced it from a derivative, it's a generated artifact.** Postgres-only. DB rows, indexes, materialized views, computed mastery scores.
- **If you can't tell which tier something is**, ask: "would I want this byte-identical for an audit five years from now?" Yes -> source. "Would I want to re-render this if I improved the extractor?" Yes -> derivative. "Would I want this regenerable from the seed?" Yes -> generated.

## What goes where, in practice

Sources expected today and as airboss grows. Each gets a `.gitattributes` filter + `.gitignore` block at the corpus root.

| Corpus              | Repo root        | Cache root                                      | Source ext | Status                |
| ------------------- | ---------------- | ----------------------------------------------- | ---------- | --------------------- |
| Handbooks           | `handbooks/`     | `$AIRBOSS_HANDBOOK_CACHE/handbooks/`            | `.pdf`     | First WP shipping     |
| Advisory Circulars  | `regulations/ac/`| `$AIRBOSS_HANDBOOK_CACHE/regulations/ac/`       | `.pdf`     | Deferred WP           |
| ACS / PTS           | `acs/`           | `$AIRBOSS_HANDBOOK_CACHE/acs/`                  | `.pdf`     | Phase 1+ of ADR 016   |
| AIM                 | `aim/`           | `$AIRBOSS_HANDBOOK_CACHE/aim/`                  | `.pdf`     | Deferred WP           |
| NTSB reports        | `ntsb/`          | `$AIRBOSS_HANDBOOK_CACHE/ntsb/`                 | `.pdf`     | Deferred WP           |
| POH excerpts        | `pohs/`          | `$AIRBOSS_HANDBOOK_CACHE/pohs/`                 | `.pdf`     | Per aircraft profile  |
| Audio masters       | `audio/`         | `$AIRBOSS_HANDBOOK_CACHE/audio/`                | `.wav`     | Future audio surface  |

Anything not on this list is *not* under the source-artifact policy. Random PDFs dropped into a doc folder, scratch test fixtures, etc. should land in the existing `data/sources/**` gitignore tier (which is gitignored entirely; never committed).

## When to flip out of Flavor D

The current configuration assumes single-developer airboss. Triggers that re-open the policy decision:

1. **Second active contributor.** Cache-on-laptop breaks at the moment "where do I get the PDFs?" becomes a non-trivial question.
2. **CI starts running ingestion.** Cache-on-laptop doesn't transfer to a CI runner.
3. **An FAA URL breaks and an edition becomes unrecoverable** for some reason that matters.
4. **Joshua acquires a second machine he wants to dev on.**

The flip itself, when triggered:

1. Choose an LFS storage target (GitHub Free LFS, GitHub paid, self-hosted, S3-backed, etc.).
2. Remove the corpus's gitignore line.
3. `git add <corpus>/<doc>/<edition>/source.<ext>` -- the dormant `.gitattributes` filter activates, files go through LFS clean filter, pointer files get committed.
4. `git push` uploads bytes to the LFS server.
5. Update this STORAGE.md doc to reflect the new storage location.
6. Document the LFS server endpoint in the README.

## Pre-flight for contributors

Today (Flavor D):

```bash
# Clone normally. No LFS extension required.
git clone https://github.com/joshball/airboss

# Run the handbook ingestion pipeline -- it auto-creates the cache and downloads from FAA.
cd airboss
bun run sources extract handbooks phak --edition 8083-25C
```

The cache lives at `~/Documents/airboss-handbook-cache/` by default. Override via env var:

```bash
export AIRBOSS_HANDBOOK_CACHE=/path/to/somewhere/else
bun run sources extract handbooks phak --edition 8083-25C
```

If/when Flavor D is flipped to real LFS later:

```bash
git lfs install         # Becomes a prerequisite at the flip
git clone https://github.com/joshball/airboss
# OR if you don't need source PDFs:
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/joshball/airboss
git lfs fetch --recent  # later, when you do need them
```

## Related

- [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) -- the decision and alternatives.
- [handbook-ingestion-and-reader/spec.md](../work-packages/handbook-ingestion-and-reader/spec.md) -- first WP to land under this policy.
