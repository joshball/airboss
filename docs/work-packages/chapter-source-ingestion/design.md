---
title: 'Design: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: design
status: unread
review_status: pending
---

# Design: Chapter source ingestion

The non-obvious structural decisions behind the spec, captured for review. Spec answers *what we're building*; this doc answers *why we're building it that way*.

## Three publisher classes, one downloader

The FAA distributes aviation handbooks in three distinct shapes. Any architecture has to handle all three.

```text
                          publisher distribution shape
                          --------------------------------
Class A  chapter PDFs     PHAK, AFH, IPH, helicopter, glider, balloon, instructors
Class B  section HTML     AIM (only)
Class C  whole-doc only   AVWX, IFH, AMT (3 vols), seaplane

                          our cache stores
                          ----------------
Class A  whole-doc + N chapter PDFs + ancillary PDFs
Class B  bundled PDF + N section HTML files + M appendix HTML files
Class C  whole-doc PDF only
```

The downloader's contract: read a YAML config that lists every asset the publisher offers, fetch all of them, store them flat in the corpus cache directory.

**Why YAML drives everything.** The brief's opening rule was "all docs and locations should be config, not code, if we can avoid it." The current `plans.ts` hardcodes 12 ACs, 5 ACSs, 8 handbook extras, and 1 AIM URL as TS arrays. Every URL change is a code change. Migrating these to YAML achieves three things:

1. **Operator-edits-only paths.** When the FAA rotates an AC URL, the operator updates `scripts/sources/config/ac.yaml`, no code review.
2. **Inventory generation is mechanical.** `bun run sources inventory` walks YAML + manifests; no need to walk TS source.
3. **Tool boundaries stay clean.** TS-tool YAML lives at `scripts/sources/config/`; Python-tool YAML at `tools/handbook-ingest/ingest/config/`. Each tool owns its own config dir.

## Why "always grab everything" beats a download_mode flag

The earlier draft had `download_mode: whole | chapters_pdf | chapters_html`. User feedback rejected it -- "since we are doing both, we should grab whatever is available."

The mode flag was a false economy. The YAML already lists what's available; the downloader just iterates the list. A handbook with no `chapter_pdfs` key skips chapter download (because there's nothing to fetch); a handbook WITH the key fetches them. Configuration IS the mode.

Removing the flag also removes a class of bug ("I set `download_mode: chapters_pdf` but forgot the URL pattern"). The YAML can only be misconfigured by being wrong, not by being inconsistent.

## Why the whole-doc PDF stays even when chapters are available

Decided by user direction. Reasoning preserved here for review:

- **Cross-chapter answers.** Some questions need ch3 + ch7 context. The whole-doc PDF is a single file the operator can grep across.
- **Glossary / index / table-of-contents fallback.** When the publisher splits chapters but doesn't separately publish the front matter or glossary, the whole-doc is the only source.
- **Disk cost is negligible.** 80 MB per handbook × 7 chapter-PDF handbooks = ~600 MB. Less than a single GoPro video.
- **Per-section workflows don't depend on it.** Section-extraction reads chapter PDFs directly; whole-doc is shadow data.
- **No "which is canonical?" question.** The chapter PDF IS canonical for its chapter, derived from the same FAA template that produced the whole-doc. They're the same bytes, just sliced differently. Keeping both means we can verify against either.

Disk-cost-vs-completeness was the trade-off. We picked completeness.

## Why AIM gets section-level cache, not chapter-level

Empirical finding (verified 2026-04-29): AIM chapter HTML pages are JS-collapsible TOC stubs (~41 KB each, no content). The actual content is one level down at `chap<N>_section_<S>.html` (~360 KB each, semantic h4 + paragraph IDs).

If we cached chapter pages, we'd cache the wrong thing. The TOC stub is derivative info -- `ls aim/*.html` and the filename ordering already gives us the section list.

Cost: 71 section files instead of 11 chapter files. Worth it because:

- Each section file IS the parseable unit. h4 paragraph IDs (`7-1-1`, `7-1-2`) are FAA-canonical citation locators, exposed directly.
- Regenerating one section after an FAA edit is one HTTP request, not 1/11th of a chapter re-download.
- ETags are per-file. Per-section change detection > per-chapter.

## Why AIM appendices are single-file and chapters aren't

Verified by curl: `appendix_<N>.html` (5 of them, 29-166 KB) are full content, not stubs. No `appendix_<N>_section_<S>.html` siblings exist.

Likely reason: appendices are reference material (acronym glossary, weather codes), not narrative chapters. The FAA template treats them differently. We mirror that: appendices = single cached file per appendix; chapters = multiple cached files per chapter.

This means the AIM YAML has TWO download patterns, not one. Code-side, the appendix loop is independent of the section loop.

## Two-hop scrape: PHAK only

Verified empirically: PHAK is the only handbook where the publisher's index page does NOT directly link chapter PDFs. PHAK's index links per-chapter HTML pages (`/chapter-7-aircraft-systems`), and each chapter page contains exactly one `.pdf` link.

Other Class A handbooks (AFH, IPH, helicopter, glider, balloon, instructors) link chapter PDFs directly from the index.

**Implementation choice:** the YAML schema admits both shapes:

```yaml
chapter_pdfs:
  # Direct: one URL pattern, substitute chapter ordinal
  direct_pattern: https://www.faa.gov/.../{NN}_afh_ch{N}.pdf
  chapter_count: 11

# OR (two-hop)
chapter_pdfs:
  index_url: https://www.faa.gov/.../phak
  chapter_page_pattern: /regulationspolicies/.../chapter-{N}-{slug}
  chapter_count: 17
```

The downloader branches on whether `direct_pattern` or `index_url` is present. Keep the branch shallow: two-hop just produces a list of resolved final-PDF URLs, then the rest of the pipeline (download, hash, manifest) is the same as direct.

Resolved URLs are cached in the manifest's `chapters[].source_url`. Re-runs do NOT re-scrape unless either:

- The manifest is missing entries (fresh cache).
- The index page's `Last-Modified` advances (FAA published a new chapter or re-versioned URLs).

Hard fail on individual chapter 404 -- one missing chapter breaks downstream extraction; do not silently skip.

## Why TS owns network I/O and Python owns extraction

Existing pipeline has this split. Keeping it.

- **TS:** `scripts/sources/download/` -- HTTP, retry, atomic writes, manifest, HEAD-cache. Has well-tested infrastructure for this.
- **Python:** `tools/handbook-ingest/ingest/` -- PDF text extraction (PyMuPDF), figure extraction, table detection, section-tree building, LLM prompting. PyMuPDF and BeautifulSoup are best-in-class for these jobs and are Python.

For AIM HTML specifically, "TS scrapes, Python parses" means:

- TS downloads `chap07_section_03.html` to the cache (treats it as a content blob; no parsing).
- Python's new `aim_html_extract.py` reads the cached HTML, runs BeautifulSoup, builds the section tree, hands it to the existing prompt-strategy pipeline.

Forking extraction into TS just because the source is HTML would create two parallel section-tree builders. That's worse than the small cost of teaching TS to fetch HTML.

## Manifest schema growth: extension, not break

PR #327's `HandbookCacheManifest` had `primary` + `errata[]`. We add `chapters[]` + `ancillary[]`. New fields, existing readers compatible (TS readers walk arrays they know about; the new arrays are additive).

Versioning rule: bump `schema_version` when an EXISTING field's shape changes. Adding new optional arrays does NOT bump the version. That preserves "old reader sees a manifest with chapters[] field, ignores it, still works for the primary + errata it cared about." This is desirable for the migration period when the implementation PR ships before all readers know about chapter assets.

AIM corpus manifest grows `sections[]` and `appendices[]` similarly.

## Inventory document: what makes it good

The brief asked for a markdown doc listing everything we download. Three properties matter:

1. **Regenerable.** Same input = same output bytes. No timestamps in section bodies; one timestamp at the top. Operator can `git diff` to see what changed.
2. **Sorted.** Per corpus, per doc, per asset. Alphabetical within each level. No "order matches YAML order" because YAML order is arbitrary.
3. **Linkable.** Every URL is a clickable markdown link. Every cache filename is rendered in code-quotes. The reader can jump to either.

Format choice: per-corpus tables. Tables compress well, scan well in a code review, and Markdown's `|` syntax is universally supported.

What NOT to put in the inventory:

- Total byte counts (would change per fetch)
- Last-extracted-at (different concern; lives in derivative manifests)
- LLM extraction status (different layer entirely)
- Errata details (they appear in the manifest; the inventory just lists them as "errata-mosaic")

## URL discovery: hardcode + verifier, not scrape

Decided by user direction. Reasoning:

- **Determinism beats resilience.** Scraping the index page introduces a brittle pattern-matching layer ("find the link whose text matches 'Full Version'"). The FAA can change anchor text any time.
- **Hardcoded URLs are auditable.** Git history shows when a URL changed. Scraped URLs have no audit trail.
- **Failure mode quality.** A 404 on a hardcoded URL is loud and points at a YAML field. A failed scrape is silent or matches the wrong link.
- **FAA URL rotation is rare.** Edition cadence is years. Operator burden is one YAML edit when an edition cuts.

The verifier (`bun run sources verify-urls`) closes the gap: HEAD every URL, surface 404s before download time. Run weekly via cron or before any release.

## Why chapter ordinals are zero-padded

Per project rule ("always zero pad if there is a chance of overlap and sorting matters"). PHAK has 17 chapters; AFH has 11; helicopter has 14. `ch10` next to `ch2` sorts wrong without padding. `ch01`...`ch17` sort correctly via plain `ls`.

Source URLs use whatever the publisher ships (PHAK uses `09_phak_ch7.pdf` -- no padding). Cache filenames use the padded form (`FAA-H-8083-25C-ch07.pdf`). Mapping from URL ordinal to cache ordinal is mechanical: parse the URL pattern's `{N}` capture, format with `.padStart(2, '0')`.

## What's NOT changing

To make the WP review easier, the explicit no-touch list:

- **Inline derivative tree** (`<repo>/handbooks/`, `<repo>/aim/`, `<repo>/ac/`, etc.). Per-section markdown, figure PNGs, table HTML, derivative manifests. Out of scope.
- **DB schema.** No `handbook_section`, `reference`, or related changes. Cache layout is invisible to the DB tier.
- **Citation system.** Locators are still `<chapter>-<page>` for handbooks; `<chapter>-<section>-<paragraph>` for AIM. Both already work.
- **Errata pipeline.** Already correct via #327; this WP doesn't touch errata.
- **Section-extraction contract.** Owned by the concurrent WP. Coordination, not modification.

## Implementation order (recommended)

The implementation PR has logical groupings that minimize merge friction. Suggested commit shape:

1. **Config migration.** `scripts/sources/config/*.yaml` files + loader. Delete the corresponding TS arrays. Test that loaded config produces the same `DownloadPlan[]` as before.
2. **YAML schema for chapter assets.** Extend handbook configs (PHAK, AFH, IPH, AVWX, AIM at minimum) with `whole_doc` + `chapter_pdfs` / `chapter_html` keys.
3. **TS download path: chapter PDFs.** Direct + two-hop variants. Manifest extension. Tests.
4. **TS download path: AIM HTML.** Section + appendix. Manifest extension. Tests.
5. **Python ingest: chapter-PDF mode.** `fetch.py` + `chapter_plaintext.py` chapter-mode branch. Verify against PHAK end-to-end.
6. **Python ingest: AIM HTML extraction.** `aim_html_extract.py`. Verify against AIM end-to-end.
7. **CLI: verify-urls + inventory.** Both commands. Generate `docs/sources/INVENTORY.md`.
8. **ADR 022.** Records the decisions above.
9. **Doc sweep.** STORAGE.md, ADR 020, related work-packages.

Each commit must pass `bun run check`. Tests added with the commit, not after.

## Phase ordering: Phase 7 vs Phase 6 dependency

Tasks Phase 7 (verify-urls + inventory) does NOT depend on Phase 6 (AIM HTML extraction). The inventory walks the **download manifest tier**, not the extraction status. AIM section files appear in the inventory the moment they're cached, regardless of whether `aim_html_extract.py` has parsed them.

Practical implication: Phase 7 can land before Phase 6 if scope splits across PRs. The implementation PR ships them as adjacent phases for ergonomic reasons (one logical unit), not for dependency reasons.

## Open questions for review

None remaining as of this draft. All four pitfalls (front matter dup, pagination drift, figure numbering, AIM HTML structure) verified empirically. All three answers from the user (Q5/6/7) locked. The new "config not code" + inventory feature integrated.

If the reviewer finds a question this design doesn't answer, log it in `review.md`.
