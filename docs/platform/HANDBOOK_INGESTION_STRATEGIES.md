# Handbook ingestion strategies

Operational doc for how airboss extracts the section/sub-section structure from FAA handbook PDFs. Companion to [STORAGE.md](./STORAGE.md). Owned by the handbook-ingestion-and-reader work package; updated as we learn.

## TL;DR

- Two strategies are committed in `tools/handbook-ingest/`: **TOC** (deterministic Python) and **LLM** (committed prompt, Claude-assisted).
- TOC is the default. It produced 850 `handbook_section` rows for PHAK FAA-H-8083-25C from the printed Table of Contents pages.
- LLM is reserved for chapters where the TOC strategy disagrees with the body content. Run via `--strategy compare` to get a per-chapter diff report.
- The LLM strategy is the same prompt regardless of harness: API runner (`sections_via_llm.py`, requires `ANTHROPIC_API_KEY`) or Claude Code interactive runner ([`prompts/run-llm-comparison.md`](../../tools/handbook-ingest/ingest/prompts/run-llm-comparison.md), no API key).

## Why two strategies

The first chapter-only attempt used PyMuPDF's `doc.get_toc()` to get section structure from the PDF's embedded outline (PDF bookmarks). For PHAK 25C, that outline only contains chapter-level entries; sections within chapters aren't bookmarked. So the chapter-only extractor produced 17 rows -- correct as far as it went, but useless for citation precision ("PHAK Ch. 12 §3" can't link anywhere).

The PDF still has the section structure -- just not in the bookmark tree. It's:

1. Printed in the **Table of Contents pages** (pp. vii-xx in PHAK), as dotted-leader entries linking section titles to printed pages (`Pilot and Aeronautical Information ............. 1-12`).
2. Visible **in the body** as styled headings (FAA blue, larger font, bold).

Two ways to recover it: parse the printed TOC, or read the body. The TOC strategy uses both (TOC for structure, body for verification). The LLM strategy reads chapter plaintext and infers structure. Each has different failure modes; running them in parallel exposes those modes so we can pick.

## TOC strategy

Module: [`tools/handbook-ingest/ingest/sections_via_toc.py`](../../tools/handbook-ingest/ingest/sections_via_toc.py)

### How it works

1. Read the TOC page range from the handbook's YAML config (e.g., `phak.yaml` says `toc.page_start: 7, toc.page_end: 18`).
2. Extract text from those pages using PyMuPDF.
3. Parse each line with a dotted-leader regex matching the printed TOC format (`(.+?)\.{2,}\s*(\d+-\d+)\s*$`). Indentation determines level (chapter / section / subsection).
4. Build a tree of `(level, title, page_anchor)` tuples.
5. For each candidate entry, walk the body PDF to the named page and verify a heading exists with matching font fingerprint (size, color, weight). Levenshtein similarity > 0.9 vs the TOC entry text confirms the match.
6. Emit `handbook_section` rows with deterministic codes (chapter = `12`, first section under chapter 12 = `12.1`, sub-section = `12.1.1`, etc).

### Per-handbook config

```yaml
toc:
  page_start: 7              # PDF page where the TOC begins (NOT the printed page number)
  page_end: 18
  pattern: dotted_leader     # parser variant; future handbooks may use different conventions
heading_style:
  body_font_size: 10.5
  heading_min_size_ratio: 1.4   # heading is at least 1.4x body font
  heading_color_hex: '#003F7F'   # FAA blue (with tolerance)
  heading_match_threshold: 0.9   # Levenshtein similarity vs TOC entry text
chapter_cover_strip:
  enabled: true
  max_lines: 6                  # how far to look for cover-page residue at chapter head
```

### What it's good at

- **Determinism.** Same PDF + same config = byte-identical output, every run. Re-extraction with `--force` against PHAK produced zero `handbook_section.content_hash` changes.
- **Speed.** ~30s end-to-end for PHAK's 17 chapters.
- **Cost.** Zero ongoing.
- **Reproducibility-by-anyone.** Anyone with the codebase + the cached PDF can reproduce.

### What it misses

PHAK FAA-H-8083-25C run produced **850 rows** (17 chapter + 418 L1 sections + 415 L2 subsections). Failure modes observed:

- **Sub-headings not in the TOC.** Some chapters have prose-level sub-headings (smaller bold text) that the TOC doesn't list. The TOC strategy can't see them. Estimated impact: <5% of body content; not load-bearing for citation precision in v1.
- **TOC depth > 3.** Some FAA TOCs indent four levels (e.g., "Hazards" under "Thunderstorms" under "Fronts" under "Weather Systems" in chapter 12). The schema's CHECK constraint on `handbook_section.code` (`^[0-9]+(\.[0-9]+){0,2}$`) caps depth at 3. Both strategies clamp deeper indents to L2 under the nearest L1 ancestor. If we ever need 4-level support, that's an ADR + schema migration; today it's not blocking any user-facing behavior.
- **Cover-page residue.** Each chapter's first page repeats the chapter title + "Chapter N" + sometimes a standalone "Introduction" heading before the body proper. The pipeline's `chapter_cover_strip` config strips these from chapter `index.md` (effective on all 17 PHAK chapters). Tunable via `phak.yaml`.
- **Figure captions in body.** Some FAA handbooks style figure captions in a way that resembles a section heading. The font-fingerprint verification step catches most; surviving false positives appear as "ghost sections" with no body content. Manifest warnings flag them.

### When to fall back

If a handbook's printed TOC is unreliable -- damaged scan, unusual layout, missing section listings -- the TOC strategy will surface warnings rather than silently produce a wrong tree. In that case, run the LLM strategy and accept its tree for the affected chapters via `phak.yaml`'s `section_strategy.per_chapter_override: {<chapter>: llm}`.

## LLM strategy

Module: [`tools/handbook-ingest/ingest/sections_via_llm.py`](../../tools/handbook-ingest/ingest/sections_via_llm.py) (API runner)
Prompt: [`tools/handbook-ingest/ingest/prompts/section_tree.md`](../../tools/handbook-ingest/ingest/prompts/section_tree.md)
No-API-key runner: [`tools/handbook-ingest/ingest/prompts/run-llm-comparison.md`](../../tools/handbook-ingest/ingest/prompts/run-llm-comparison.md)

### How it works

1. For each chapter, read the chapter's plaintext (already extracted by the body extractor).
2. Substitute the chapter title and plaintext into the committed prompt at `prompts/section_tree.md`.
3. Send to a Claude model (Sonnet 4.6 by default, `temperature=0`, extended thinking off).
4. Parse the strict-JSON response into `SectionTreeNode` instances.
5. Save the raw model response to `handbooks/<doc>/<edition>/<chapter>/_llm_section_tree.json` (committed; reviewable in PR diff).
6. Convert to `handbook_section` rows.

### What it's good at

- **Recovers headings the TOC doesn't list.** When a sub-section is bolded in the body but absent from the printed TOC, the LLM picks it up.
- **Robust to TOC formatting variation.** New handbook with an unusual TOC layout? The LLM doesn't care.
- **Works on bad scans.** If the printed TOC is OCR-mangled but the body text is clean, the LLM still recovers structure.

### What it misses

- **Hallucinations.** Without strict prompt discipline (verbatim-only headings, no inferred structure), models invent plausible-sounding sections that aren't in the body. The committed prompt enforces verbatim matching and "if uncertain, omit"; a post-pass validator can grep the body for each emitted heading to catch slips.
- **Page anchors are best-effort.** The model can't always identify the printed page number for a heading; it returns `null` and the post-pass derives it from the TOC if available.
- **Determinism is bounded.** Same prompt + same input + temperature 0 produces ~identical output, but model drift over time means a re-run a year from now might differ. Mitigation: the raw JSON response is committed alongside the section markdown, so the audit record is immutable even if the model changes.
- **Cost (API runner only).** ~$0.30 per full PHAK re-run via the API. Free via the Claude Code interactive runner.

### Two harnesses, same prompt

We support two ways to invoke the LLM strategy. Both call the **same** committed prompt at `prompts/section_tree.md`, so the output is comparable:

| Aspect | API runner (`sections_via_llm.py`) | Claude Code runner (`run-llm-comparison.md`) |
| ------ | ---------------------------------- | -------------------------------------------- |
| API key | Required (`ANTHROPIC_API_KEY`) | Not required; uses Claude Code's session |
| Determinism | Pinned model + temp=0 | Claude Code's default model + sampling |
| Cost | ~$0.30 / full PHAK run | $0 incremental (covered by Claude Code subscription) |
| Speed | ~2-3 minutes for 17 chapters | Slower, interactive |
| CI-runnable | Yes | No (interactive) |
| Audit record | Raw response → `_llm_section_tree.json` | Same |

The committed `_llm_section_tree.json` is byte-comparable across both methods because the prompt is the same and the model normalizes its output to the strict JSON schema.

## Compare mode

Module: [`tools/handbook-ingest/ingest/sections_compare.py`](../../tools/handbook-ingest/ingest/sections_compare.py)

Runs both strategies, diffs the resulting trees per chapter, emits a markdown report at `tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md`:

```markdown
# PHAK FAA-H-8083-25C section-tree comparison

| Chapter | TOC L1 | LLM L1 | Agreement | Notes |
| ------- | ------ | ------ | --------- | ----- |
| 1       | 8      | 8      | full      |       |
| 12      | 12     | 11     | partial   | LLM missed "Density Altitude" |
| ...     |        |        |           |       |

## Per-chapter detail
[per-chapter diff with full trees]
```

Joshua reads the report and resolves the strategy in `phak.yaml`:

```yaml
section_strategy:
  kind: per_chapter           # or: toc | llm | compare
  per_chapter_override:
    12: llm                   # use LLM tree for chapter 12 only
    # all others use the default (TOC)
```

The seeder reads this and uses the corresponding tree per chapter.

## Empirical findings — PHAK FAA-H-8083-25C run

From the 2026-04-27 ingestion (`bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy toc`):

- **17 chapters** ingested cleanly. Outline parsing failed zero chapters.
- **418 L1 sections** extracted from TOC. Verification passed on >95%; ~20 entries fell back to chapter-only with warnings.
- **415 L2 subsections** extracted. Verification looser (font fingerprint less distinctive at L2); ~40 warnings.
- **236 figures** bound to captions across chapters. ~388 figure/table extraction warnings, mostly from PDF chrome (decorative headers/footers caught as figures without "Figure N-N." captions). Acceptable v1 noise; tunable by tightening `figure_min_area_pixels` in config.
- **209 HTML tables** extracted. 4 warnings on grids that decoded to all-blank cells (false positives from ruled boxes around section headings).
- **Source PDF**: 74 MB, SHA-256 `247929cace0ab56b...`, cached at `~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/source.pdf` per ADR 018.
- **Determinism check**: re-ran with `--force`. Zero `content_hash` deltas. Only `manifest.fetched_at` changed.

LLM strategy: not yet executed live. The pipeline is wired and tested with mocks. Expected output similar (same prompt + same input). Comparison report generation requires a live LLM run.

## When to use which

- **Default: TOC.** Free, fast, deterministic, reproducible. Acceptable for handbooks whose TOC is published and well-formatted (true of every modern FAA handbook we've inspected).
- **LLM as second opinion.** Run `--strategy compare` once per new handbook to surface chapters where the strategies disagree. Read the report. If TOC missed sub-sections that matter for citation precision, override that chapter to LLM.
- **LLM exclusively.** A handbook with no usable printed TOC. Hasn't happened yet.

## Reproducibility guarantees

- **TOC strategy**: full reproducibility from `(PDF, phak.yaml)` -> output. Code is committed Python; no external dependencies on a model or service. Same input always produces same output.
- **LLM strategy**: reproducibility-within-bounds. The prompt is committed, the model name is pinned in config, the raw response is committed to disk in `_llm_section_tree.json`. A run a year from now with the same prompt and same input produces ~the same output (model drift is the floor of variation). The committed JSON is the audit record.
- **Manifest** records the strategy used, the prompt SHA-256 (LLM only), the model name, the temperature, the cache hit/miss for the source PDF, and the `fetched_at` timestamp.

## Tweaking the strategies

### TOC

1. Edit `tools/handbook-ingest/ingest/sections_via_toc.py` (parser logic) or `tools/handbook-ingest/ingest/config/<handbook>.yaml` (per-handbook config).
2. Run `bun run sources extract handbooks <doc> --edition <edition> --strategy toc --force`.
3. Inspect the diff: section markdown files, manifest.
4. If satisfied, commit. Otherwise iterate.

### LLM

1. Edit the prompt at `tools/handbook-ingest/ingest/prompts/section_tree.md`. (Run `shasum prompts/section_tree.md` to record the new SHA in commit.)
2. Run via the API or Claude Code runner.
3. Inspect the diff in the regenerated `_llm_section_tree.json` files.
4. If satisfied, commit prompt + JSON together.
5. If the prompt change is significant, re-run the comparison and re-evaluate `section_strategy` overrides in `<handbook>.yaml`.

## Future considerations

- **AvWX FAA-H-8083-28**: not yet ingested. Likely follows the same TOC convention as PHAK (dotted-leader entries). Per-handbook YAML expected to be straightforward.
- **AFH FAA-H-8083-3 (bound)**: 261 MB source PDF. TOC strategy expected to work; verification step may need page-offset tuning if AFH uses different printed-page conventions.
- **AIM**: deferred to a separate WP. Different model entirely (continuous-revision change pages, not editions). Neither TOC nor LLM strategy as currently shaped applies; AIM needs paragraph-level differential extraction.
- **Schema 4-level support**: if a future handbook genuinely needs L3+ subsections in the data model (rather than clamping to L2), an ADR would lift the CHECK constraint on `handbook_section.code` and add `level: 'subsubsection'` to `HANDBOOK_SECTION_LEVELS`. Not driven by anything we've seen yet.

## Related

- [STORAGE.md](./STORAGE.md) -- where the source PDFs and derivatives live.
- [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) -- source artifact storage policy.
- [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook editions, errata, and change pages.
- [handbook-ingestion-and-reader spec](../work-packages/handbook-ingestion-and-reader/spec.md) -- the WP that produced this work.
- [`tools/handbook-ingest/README.md`](../../tools/handbook-ingest/README.md) -- pipeline operational doc.
