---
title: 'ADR 022 -- Chapter source ingestion'
status: accepted
deciders: Joshua (user zero)
date: 2026-04-29
supersedes: null
extends: 021-source-cache-flat-naming
---

# ADR 022 -- Chapter source ingestion

Extends [ADR 021](../021-source-cache-flat-naming/decision.md) (source cache flat naming) with chapter-level source ingestion. ADR 021 receives no edits and remains immutable; this ADR adds the chapter / section / appendix layer on top.

## Context

The handbook section-extraction pipeline truncated 11 of 17 PHAK chapters at the 60K-character cap because input was sliced from the whole-doc PDF. The back half of those chapters (turbines, fuel, oxygen, surface markings, aeromedical second half) was silently dropped before the LLM saw it. The cap was the wrong fix; the right fix is chapter-scoped inputs.

The FAA distributes handbooks in three distinct shapes:

- **Class A1** -- chapter PDFs only, no separately-distributed ancillaries. PHAK is the sole A1 handbook (verified 2026-04-29). Index page lists per-chapter HTML pages; each chapter page contains one .pdf link. Two-hop scrape required.
- **Class A2** -- chapter PDFs plus ancillaries (front, glossary, index). AFH, IPH, helicopter, glider, balloon, instructors. Direct URL pattern; ancillaries listed explicitly in YAML.
- **Class B** -- section HTML, AIM only. Continuous-edition publication. Section files (`chap{C}_section_{S}.html`) carry semantic `<h4 class="paragraph-title" id="C-S-P">` per FAA paragraph; ~360 KB each. Appendices (`appendix_{N}.html`) are single-file with content under `<main class="main-content usa-content">`.
- **Class C** -- whole-doc only. AVWX, IFH, AMT (3 vols), seaplane.

We also wanted "all docs and locations should be config, not code" -- before this WP, the AC/ACS/AIM/handbooks-extras URL inventory was hardcoded in a TS array (`AC_TARGETS`, `ACS_TARGETS`, etc.).

## Decision

### Three publisher classes, one downloader

The downloader reads YAML config that lists every asset the publisher offers; iterating the list IS the mode. No `download_mode` flag.

### Cache layout (extends ADR 021)

Whole-doc PDFs are kept alongside chapter PDFs (additive, not replacement). Disk cost is negligible (~600 MB total across 7 chapter-PDF handbooks); whole-doc is the cross-chapter reference + the only source of front matter when the publisher doesn't split it.

```text
handbooks/<slug>/<edition>/<edition>.pdf                    # whole-doc (kept)
handbooks/<slug>/<edition>/<edition>-ch<NN>.pdf             # chapter PDFs (zero-padded ordinals)
handbooks/<slug>/<edition>/<edition>-front.pdf              # ancillaries (Class A2)
handbooks/<slug>/<edition>/<edition>-glossary.pdf
handbooks/<slug>/<edition>/<edition>-index.pdf
handbooks/<slug>/<edition>/<edition>-appendix-<a>.pdf       # if publisher splits
handbooks/<slug>/<edition>/<edition>-errata-<id>.pdf        # already exists (ADR 020)
handbooks/<slug>/<edition>/manifest.json                    # primary + chapters[] + ancillary[] + errata[]

aim/aim.pdf                                                 # bundled (kept)
aim/chap<CC>_section_<SS>.html                              # 72 section files (ch0 + 71)
aim/appendix_<NN>.html                                      # 5 appendix files
aim/manifest.json                                           # primary + sections[] + appendices[]
```

Chapter ordinals zero-padded to two digits (`ch01`, `ch07`, `ch10`); source URLs use the publisher's form. AIM chapter 0 ("General Information / Explanation of Changes") cached as `chap00_section_01.html` even though the publisher's URL is irregular (`chap0_info_eoc.html`).

### YAML config consolidation

Single source of truth at `scripts/sources/config/`:

```text
scripts/sources/config/
  ac.yaml                    # 12 ACs (was AC_TARGETS in plans.ts)
  acs.yaml                   # 5 ACSs (was ACS_TARGETS)
  aim.yaml                   # bundled PDF + section/appendix HTML
  regs.yaml                  # ECFR base + per-title list
  handbooks-extras.yaml      # 8 whole-doc-only handbooks (was HANDBOOKS_EXTRAS_TARGETS)
  handbooks/
    phak.yaml                # whole_doc + chapter_pdfs (two-hop, no ancillaries)
    afh.yaml                 # whole_doc + chapter_pdfs (direct, with ancillaries)
    avwx.yaml                # whole_doc only (Class C)
    (etc.)
```

Both the TS downloader and the Python ingest tool read from this single dir. Per-handbook YAML carries every field both tools need: cache/download metadata (whole_doc, chapter_pdfs, excluded_assets) AND ingest knobs (page_offset, outline_strategy, section_strategy, prompt, errata, ...).

`excluded_assets: []` on every handbook YAML is a documented field for the operator-controlled "skip even if the publisher serves it" gate (stale errata duplicates, addenda, etc.). Default empty.

### Two-hop scrape: ordinal-prefix-match

PHAK uses inconsistent kebab slugs (`chapter-1-introduction-flying`, `chapter-7-aircraft-systems`). The scraper finds chapter pages by matching `<a href="*chapter-{N}-*">`, ignoring whatever follows the ordinal. The YAML carries only `chapter_page_pattern: chapter-{N}-`; we don't maintain a slug list. Hard-fails on missing chapter (one missing chapter breaks downstream extraction; do not silently skip).

### TS owns network I/O; Python owns extraction

- TS (`scripts/sources/download/`): HTTP, retry, atomic writes, manifest, HEAD-cache. Adds `scrape.ts` (two-hop URL resolver) and `html-fetch.ts` (text/html download with content-type validation).
- Python (`tools/handbook-ingest/ingest/`): PyMuPDF for chapter-PDF mode, BeautifulSoup for AIM HTML extraction (`aim_html_extract.py`).

### Manifest schema extension

`HandbookCacheManifest` grows `chapters[]` and `ancillary[]`. AIM corpus manifest grows `sections[]` and `appendices[]`. Schema version is unchanged (additive arrays don't break existing readers).

`chapters[].chapter_page_url` carries the intermediate two-hop chapter HTML page URL for audit; null for direct-pattern handbooks. The renamed-from `resolved_via` is self-documenting.

### Boundary contract for chapter_plaintext.py

Per spec §H, the chapter-mode branch is an early-return at the top of `write_chapter_sidecars`:

```python
def write_chapter_sidecars(config, chapter_bodies):
    if config.chapter_pdfs is not None and _chapter_pdf_in_cache(config):
        return _build_from_chapter_pdfs(config, chapter_pdfs_in_cache(config))
    return _build_from_whole_doc_with_page_ranges(config, chapter_bodies)
```

The chapter-source-ingestion WP owns the early-return. The concurrent `section-extraction-contract-v2` WP owns the inside of `_build_from_whole_doc_with_page_ranges` (truncation logic, prompt template parameters). This boundary prevents merge conflict by structure: each WP's edits stay on its side of the early-return.

### URL discovery: hardcode + verifier, not scrape

Determinism beats resilience. Hardcoded URLs are auditable (git history). Scraped URLs are silent failures. The verifier (`bun run sources verify-urls`) HEADs every URL + re-runs two-hop scrapes + probes AIM section count beyond the configured value, surfacing 404s and structure changes with copy-pasteable remediation.

### Inventory document

`bun run sources inventory` regenerates `docs/ingestion-pipeline/inventory.md` from YAML config + cache manifests. Idempotent (byte-equal regen with same input + seed). Per-corpus tables; SHA-256 prefix 12 hex chars; date trimmed to YYYY-MM-DD so per-fetch timestamps don't thrash the diff. One timestamp at the top.

## Consequences

### Positive

- **Correctness fix:** PHAK ch7 sidecar (and the other 10 capped chapters) now contains the full chapter, including turbines / fuel / oxygen / pressurized aircraft / chapter summary.
- **Per-chapter SHAs:** re-extract one chapter without re-validating the whole document.
- **Authoritative chapter boundaries:** the FAA decides where ch7 ends, not our PDF outline parser.
- **Operator-edits-only paths:** FAA URL rotation = one YAML edit, no code review.
- **Inventory diff is meaningful:** `git diff docs/ingestion-pipeline/inventory.md` after a download shows exactly which sources changed.

### Negative

- **More HTTP traffic:** PHAK download grows from 1 file to ~17 (whole-doc + chapters). Bandwidth is similar; wall-clock is roughly equal because chapter fetches parallelize.
- **More files in cache:** 7 chapter-PDF handbooks * ~20 files each = ~140 PDFs. Plus 72 AIM section files + 5 appendices. Filesystems handle this fine; humans glance and move on.
- **YAML schema is wider:** chapter-aware fields are optional but every handbook YAML now carries `whole_doc` + `excluded_assets`. Documented; loader rejects malformed shapes.

### Neutral

- **Schema version unchanged:** new fields are additive arrays. Old readers walk what they know about; new arrays are invisible.
- **Whole-doc kept:** disk cost is negligible (~600 MB across all chapter-PDF handbooks). Removing it later is reversible.

## Alternatives considered

- **Raise the truncation cap to 250K instead of switching to chapter PDFs.** Rejected. The cap is whole-doc-PDF-specific; chapter PDFs eliminate the truncation question entirely. The contract-v2 WP raises the cap for Class C handbooks (where chapter PDFs aren't available) but chapter-PDF mode bypasses the cap.
- **Scrape the FAA index page for current URLs instead of hardcoding.** Rejected. Determinism + audit trail beat resilience; the verifier fills the gap.
- **One handbook YAML per tool** (Python YAML stays in tools/handbook-ingest/ingest/config/, TS YAML in scripts/sources/config/). Rejected. Single source of truth per logical entity beats single-tool-ownership-per-dir; both tools need the same fields.
- **Cache AIM chapter HTML stubs.** Rejected. They're TOC-only JS-collapsible pages; section files are the parseable unit and are self-describing. Filename ordering already gives us the section list.
- **Skip AIM appendices in v1.** Rejected. They're 30% of AIM content; deferring creates a known issue. Appendix shape is single-file (no per-section split), so the code path is independent of and simpler than chapter HTML.

## References

- [Spec: Chapter source ingestion](../../work-packages/chapter-source-ingestion/spec.md)
- [Design: Chapter source ingestion](../../work-packages/chapter-source-ingestion/design.md)
- [ADR 021 -- Source cache flat naming](../021-source-cache-flat-naming/decision.md) (the layout this ADR extends)
- [ADR 020 -- Handbook edition and amendment policy](../020-handbook-edition-and-amendment-policy.md) (errata flow, untouched here)
- [ADR 018 -- Source artifact storage policy](../018-source-artifact-storage-policy/decision.md) (cache vs derivative tier)
- Concurrent WP: [section-extraction-contract-v2](../../work-packages/section-extraction-contract-v2/spec.md)
