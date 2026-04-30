# Handbook Onboarding Checklist

How to add a new FAA handbook to airboss. Sequence, decisions, verification commands, known quirks.

This is the operational companion to:

- [handbook-ingest-pipeline.md](handbook-ingest-pipeline.md) -- pipeline overview
- [section-extraction-strategies.md](section-extraction-strategies.md) -- TOC vs LLM deep dive
- [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) -- no-API-key paste flow

## Path tokens

| Token                   | Meaning                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `$HANDBOOK_CACHE_ROOT`  | `~/Documents/airboss-handbook-cache/` (override via `AIRBOSS_HANDBOOK_CACHE`) |
| `$REPO_ROOT`            | The repo root                                                                |
| `<doc>`                 | New document slug (e.g. `iph` for Instrument Procedures Handbook)            |
| `<edition>`             | Edition tag (e.g. `FAA-H-8083-16B`)                                          |
| `<NN>`                  | Two-digit chapter ordinal                                                    |

## 1. Before you start

Decisions to make before touching code.

| Question                                           | Where to look                                                          | Decision feeds into                              |
| -------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Is the document already in scope?                  | `course/` dir, `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md`          | Whether to onboard at all                        |
| Does the FAA offer chapter-level downloads?        | The FAA's index page for the doc                                       | Cache layout (whole-doc vs chapter PDFs vs HTML) |
| What's the slug?                                   | `scripts/sources/config/handbooks/` (existing slugs)                  | YAML filename, cache directory                   |
| Edition tag?                                       | The PDF's title page or FAA's URL                                      | YAML field, cache directory                      |
| Page offset (PDF page 1 vs printed 1-1)?           | Open the PDF, count cover/copyright pages                              | YAML `page_offset`                               |
| Outline strategy?                                  | Try `bookmark` first; if PDF outline is empty/wrong, use `content`    | YAML `outline_strategy`                          |
| Section strategy default?                          | `toc` if printed TOC is reliable; `prompt` if not                     | YAML `section_strategy`                          |
| Errata?                                            | FAA's index page (look for "addendum", "MOSAIC", "errata")            | YAML `errata:` list, ADR 020                     |

See [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md) for errata and edition policy. See [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) for storage policy.

## 2. Architecture rule

> Cache the smallest authoritative unit the publisher offers per document.

Three classes of FAA publication:

| Publisher offers       | Cache contains                       | Section extraction approach                                | Examples                                                  |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------- |
| Whole PDF only         | Whole PDF                            | TOC + LLM on page-range slices (with truncation cap)       | AVWX, IFH, AMT, seaplane                                  |
| Chapter PDFs           | Chapter PDFs (+ optional whole-doc)  | TOC + LLM on per-chapter plaintext (no cap)                | PHAK, AFH, IPH, helicopter, glider, balloon, instructors  |
| Chapter HTML           | Chapter HTML                         | HTML parse (deterministic) + LLM backstop                  | AIM                                                       |

Chapter-source ingestion is implemented (per [ADR 022](../decisions/022-chapter-source-ingestion/decision.md)). When the YAML carries a `chapter_pdfs` block AND the chapter PDFs are downloaded, section extraction runs on per-chapter plaintext directly with no truncation cap. Whole-doc handbooks (Class C: AVWX, IFH, AMT, seaplane) still use the page-range slicing path with the `prompt.chapter_text_max_chars` cap (raised per-handbook in YAML).

## 3. The checklist

### Step 1. Create the YAML config

Path: `$REPO_ROOT/scripts/sources/config/handbooks/<doc>.yaml` (single source of truth shared by the TS downloader and the Python ingest tool, per [ADR 022](../decisions/022-chapter-source-ingestion/decision.md))

Required fields: `document_slug`, `edition`, `title`, `publisher`, `kind`, `source_url`, `expected_pages`, `page_offset`, `outline_strategy`, `section_strategy`, `chapter_text_max_chars`.

Minimal example:

```yaml
document_slug: iph
edition: FAA-H-8083-16B
title: Instrument Procedures Handbook
publisher: FAA
kind: handbook
source_url: https://www.faa.gov/.../FAA-H-8083-16B.pdf
expected_pages: 412
page_offset: 6
outline_strategy: bookmark
section_strategy: toc
chapter_text_max_chars: 80000
```

Verify by listing alongside siblings:

```bash
ls $REPO_ROOT/scripts/sources/config/handbooks/
```

### Step 2. Verify the source URL

```bash
curl -I <source_url>
```

Expect HTTP 200. The cache-flat WP defines per-corpus manifests; new handbooks land at `$HANDBOOK_CACHE_ROOT/handbooks/<slug>/<edition>/<edition>.pdf` per [ADR 021](../decisions/021-source-cache-flat-naming/decision.md).

### Step 3. Run a dry-run extraction

```bash
bun run sources extract handbooks <doc> --strategy toc --dry-run
```

Verifies the YAML loads, the PDF downloads into the cache, and the outline parses. Catches `page_offset` errors early before any inline derivative tree gets written.

### Step 4. First real extraction

Drop `--dry-run`:

```bash
bun run sources extract handbooks <doc> --strategy toc
```

Inspect the in-repo derivative tree at `$REPO_ROOT/handbooks/<doc>/<edition>/`. Confirm chapter count matches the FAA's TOC.

```bash
ls $REPO_ROOT/handbooks/<doc>/<edition>/
```

### Step 5. Inspect the manifest

Path: `$REPO_ROOT/handbooks/<doc>/<edition>/manifest.json`

Look for:

- `section_extra_warnings`
- `figure_warnings`
- `table_warnings`

Most warnings are non-fatal but worth reading. Systematic patterns hint at config gaps.

### Step 6. Spot-check chapters

Pick 3 chapters. Open `$REPO_ROOT/handbooks/<doc>/<edition>/<NN>/index.md` and a per-section markdown. Verify the body text looks correct (not garbled, not truncated, not empty).

### Step 7. Run the LLM strategy if appropriate

```bash
bun run sources extract handbooks <doc> --strategy prompt
bun run sources extract handbooks <doc> --strategy compare
```

Follow [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) for the no-API-key paste flow.

### Step 8. Read the compare report

Per [section-extraction-strategies.md](section-extraction-strategies.md). Look for input-truncation symptoms (LLM total much smaller than TOC total). Adjust `chapter_text_max_chars` if needed.

### Step 9. Errata

If the doc has errata, configure the YAML `errata:` list and run:

```bash
bun run sources extract handbooks <doc> --apply-errata <id>
```

Follow [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md).

Errata download is on-demand: `bun run sources download` does NOT fetch
the errata PDF. The Python apply path fetches it as a side-effect when
you run `--apply-errata`. See the "Errata path" section in
[handbook-ingest-pipeline.md](handbook-ingest-pipeline.md) for the
boundary explanation. If you onboard a handbook with errata in YAML
but skip Step 9, the cache will be missing `<edition>-errata-<id>.pdf`
until apply runs -- that's expected, not a gap.

### Step 10. Commit

Branch + PR. Stage by name (no `git add -A`). Verify the manifest looks clean before committing the inline derivative tree. The cache bytes stay developer-local per [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md); only the in-repo derivatives get committed.

## 4. Per-handbook quirks

Current as of 2026-04-29.

| Handbook                  | Quirk                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PHAK** FAA-H-8083-25C   | Long chapters; `chapter_text_max_chars: 60000` is too small for 11 of 17 chapters (truncates). Chapter PDFs available via two-hop scrape. MOSAIC errata published. |
| **AFH** FAA-H-8083-3C     | Chapter PDFs available directly on index page. MOSAIC errata published.                                                                              |
| **AVWX** FAA-H-8083-28B   | Whole-doc only. PDF has internal TOC bookmarks if needed. No errata yet.                                                                             |
| **IPH** FAA-H-8083-16B    | Chapter PDFs available with `FAA-H-8083-16B_Chapter_<N>.pdf` pattern.                                                                                |
| **AIM**                   | Per-chapter HTML at `aim_html/chap_<N>.html`. No edition cycle; per-chapter Last-Modified is the change boundary.                                    |
| **IFH** FAA-H-8083-15     | Whole-doc only. No chapter splits.                                                                                                                   |

## 5. Common gotchas

- **`page_offset` is wrong.** The PDF's page 1 is "1-1" in the printed body. If they're off by 5 (cover, copyright, dedication, foreword, introduction = 5 front-matter pages), set `page_offset: 5`. Symptom: empty section bodies.
- **`outline_strategy: bookmark` returns garbage.** PDF has bookmarks but they're auto-generated and wrong. Switch to `content` and configure `chapter_overrides` if needed.
- **Chapter heading detection misses a chapter.** Symptom: 16 outline nodes when the book has 17 chapters. Add a `chapter_overrides` entry to force-include.
- **`chapter_text_max_chars` truncates real content.** Symptom: LLM strategy produces incomplete section trees on long chapters; compare report shows large "TOC only" lists at the end of page ranges. Raise the cap or wait for chapter-source-ingestion.
- **TOC strategy emits 100s of warnings.** Most are fingerprint-not-found ("TOC line couldn't match a body heading"). Non-fatal; review for systematic mismatches that hint at a `heading_style` config gap.
- **Errata applied twice.** `apply_errata` is idempotent without `--force`. If you see "already applied" messages, that's correct behavior.

## 6. When to ask for help

Stop and ask, don't push through:

- The PDF outline doesn't match the printed TOC and you can't tell which is right.
- Section bodies are non-empty but contain garbled text (encoding issues; PyMuPDF version drift).
- The LLM strategy hits the truncation cap on more than 2 chapters; raising the cap to fit causes other problems.
- The handbook has a structure no other handbook has (per-section appendices, multi-volume, runtime-generated content).
- Errata are bigger than the WP-spec'd scope (re-numbered chapters, removed sections, large-scale rewrites).

## 7. See also

- [handbook-ingest-pipeline.md](handbook-ingest-pipeline.md) -- pipeline overview
- [section-extraction-strategies.md](section-extraction-strategies.md) -- TOC vs LLM deep dive
- [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) -- no-API-key paste flow
- [common-pitfalls.md](common-pitfalls.md) -- general airboss pitfalls (always check before writing code)
- [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) -- storage policy
- [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md) -- edition / errata policy
- [ADR 021](../decisions/021-source-cache-flat-naming/decision.md) -- cache layout
