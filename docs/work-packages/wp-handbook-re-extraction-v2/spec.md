---
title: 'Spec: WP-HANDBOOK-RE-EXTRACTION-V2 -- fix what survived the first pass'
product: hangar
feature: wp-handbook-re-extraction-v2
type: spec
status: signed-off
review_status: done
---

# WP-HANDBOOK-RE-EXTRACTION-V2: fix what survived the first pass

Re-extract every ingested FAA handbook and AC against an upgraded extractor that captures front matter, converts HTML tables to markdown, pairs orphan figure captions, and produces actionable warnings instead of opaque counts. The flightbag reader in PR #554 + #567 is doing exactly what the data tells it to; the data is incomplete in known ways. This WP fixes the data.

## Why this WP exists

The user spent 30 minutes reading IFH in the flightbag and surfaced six concrete problems, all rooted in the same place:

- **Front matter is missing.** Cover, copyright, preface, acknowledgments, the *real* introduction ("Is an instrument rating necessary?"), table of contents -- none are in the DB. The extractor starts at "Chapter 1" and stops there. PDF pages 1-19 of IFH (and equivalent ranges in every handbook) are simply absent.
- **Tables render as raw HTML.** The first-pass extractor emits `<div class="handbook-table"><table>...</table></div>` blocks with extraneous markup, embedded directly in section markdown. The reader can be patched to render them, but they should be markdown tables (or at minimum, *clean* HTML tables) at the source. The current shape leaks extraction artifacts: `<th></th><th></th><th></th>` columns, scattered `<td></td>` cells from misread cell merges, and so on.
- **Figures are lost when prose reference is missing.** When an extractor's heuristic for "this caption goes with this image" misses, the figure ends up in `tables/` or in `figures/` but isn't paired with a section. The result: 2700+ "caption without paired figure" warnings sitting in the `manifest.json` `warnings[]` array, never surfaced.
- **OCR'd letter-shapes appear in section bodies.** The user saw "r R 0 q Q9 p P 8 o O7 n N6 z ZZ y Y Y x XX..." at the bottom of IFH 2/5 -- the phonetic alphabet figure rendered into prose because the figure-clipper failed. Any time a figure escapes detection, its OCR'd contents pollute the surrounding section.
- **Empty sections.** `01-introduction.md` for IFH chapter 1 is `# Introduction\n` with no body. The extractor split a heading into its own section but missed the paragraph that should have followed. Spelunking the PDF: there *is* an introduction paragraph; it's just sitting in `00-the-national-airspace-system.md` (the chapter preamble) instead. The "introduction" sub-section is a structural ghost the extractor created.
- **Warnings are summed, never seen.** The seed log says `phak FAA-H-8083-25C: 850 sections, 236 figures, 1050 warnings`. 1050 actionable items, totally invisible to anyone unless they grep manifest.json by hand. No dashboard, no triage path, no fix-on-merge gate.

The reader-UX work in `fix/flightbag-reader-round-2` (Bucket A) papers over what it can. This WP fixes the substrate.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md). Source PDFs in dev cache; derivatives inline.
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md)
- [docs/ingestion-pipeline/handbook-ingestion-strategies.md](../../ingestion-pipeline/handbook-ingestion-strategies.md). The current strategy taxonomy.
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md). The paste-to-Claude flow.
- [WP-HANGAR-REFS](../wp-hangar-references-dashboard/spec.md). The admin surface this WP feeds.
- [WP-TOC-VALIDATION-SCHEMA](../wp-toc-validation-schema/spec.md). Per-doc validation manifest shape, peer to the warnings surface.
- [WP-HANDBOOK-INGESTION-AND-READER](../handbook-ingestion-and-reader/spec.md). The original v1 ingestion design (2026-04). This WP is its v2.

## In Scope

### 1. Front-matter capture

Extend the extractor to capture the pages between the cover and chapter 1 as their own depth-0 sections under a synthetic `front-matter/` subdirectory:

- `front-matter/00-cover.md` — title page (handbook number, year, US DOT FAA branding, version).
- `front-matter/01-preface.md` — preface text if present.
- `front-matter/02-acknowledgments.md` — list of contributors / reviewers if present.
- `front-matter/03-introduction.md` — the substantive prose introduction (this is the "Is an instrument rating necessary?" content the user looked for in IFH).
- `front-matter/04-table-of-contents.md` — the TOC as a markdown list with anchors. Optional; we already have this structurally in the manifest's `sections[]`, but rendering the FAA-authored TOC verbatim is a UX win.

Discriminate by PDF page range: each handbook's manifest declares its `front_matter_page_range: [start, end]` (1-indexed inclusive); pages outside that range fall through to chapter detection.

These sections seed at depth 0 with `level: 'front-matter'` (new value, peer to `chapter`/`section`/`subsection`). They appear at the top of the chapter-list page in the reader, before chapter 1.

### 2. HTML-table → markdown-table conversion

The extractor currently emits HTML tables and writes a sibling `.html` file in `<doc>/<edition>/tables/`. Replace inline HTML in section markdown with markdown table syntax. Keep the standalone `.html` file as a fidelity fallback (linked from the rendered table caption -- "open original" -- via the existing `/handbook-asset/[...path]` streamer).

Rules:

- Convert simple HTML tables (1 thead row, no rowspans/colspans, no merged cells) to clean markdown tables.
- For complex tables (rowspans, colspans, captions with inline formatting, multi-line cells): emit as markdown table best-effort and keep the standalone HTML as the canonical render. The reader's "open original" link bridges the gap.
- Drop empty `<th></th>`, `<td></td>` that are pure column-padding artifacts (single-cell rows, all-empty rows) — these are extraction noise.
- Caption text becomes a markdown line above the table, prefixed with `**Table N-M.**` (matching the figure-caption convention).

### 3. Figure-caption pairing improvements

- When a figure caption is detected ("Figure N-M. <caption text>") but no image is paired within the surrounding clip rectangle, retry with a wider rectangle (the current heuristic is too tight). Empirical: the IPH 132/132 figure rate suggests this works well for some handbooks; PHAK's 1050 warnings suggest it fails badly for others. Tune.
- When a figure escapes detection AND its OCR'd contents end up in the surrounding section markdown (the IFH 2/5 phonetic-alphabet case), detect the OCR-leakage pattern (long string of single-letter tokens, often duplicated) and elide it from the body, recording a warning that says "figure OCR leaked into section §X.Y; manual review needed."
- Every successfully-paired figure ends up in `<doc>/<edition>/figures/fig-N-MM-<slug>.png` plus a `figures[]` entry in the section's manifest, and a `reference_figure` row when seeded. This already works for IPH; replicate the success rate.

### 4. Empty-section detection + remediation

- An "empty section" is one whose markdown body, after frontmatter strip and figure injection, contains zero paragraph-level prose. The extractor should detect this case at extraction time and decide:
  - **(a) Merge upward**: if the section has zero body and its parent chapter's preamble (`00-*.md`) doesn't explicitly link to it, the empty section is a structural ghost. Drop it from the section tree and emit a warning.
  - **(b) Keep with placeholder**: if the section is referenced from elsewhere (e.g. the TOC names it), keep the empty row but tag it with `extraction_status: 'no-body-content'` so the reader can show the placeholder + nav links from Bucket A's PR.
  - **(c) Best-effort fill**: if there's prose on the same PDF page that wasn't claimed by another section, attribute it to this section.

The extractor logs which path each empty section took. Default policy is (b) (keep with placeholder); (a) and (c) require operator opt-in via a per-doc rule.

### 5. Warning taxonomy + per-doc warning manifest

The existing `manifest.json` `warnings[]` field has free-form `{code, section_code, message}` shapes. The vocabulary is split into two families:

**Extraction-quality codes** (the v2 extractor improvements target these; counted toward the success criterion):

- `caption-without-figure` (existing)
- `figure-without-caption` (existing)
- `table-merge-failed` (existing)
- `table-empty` (existing)
- `cross-reference-unresolved` (existing)
- `table-cell-merge-ambiguity` (Phase 1B)
- `tablish-block-not-converted` (Phase 1B; HTML survived as-is because conversion failed)
- `ocr-leak-in-section-body` (Phase 1C)
- `empty-section-kept` (Phase 1C)
- `empty-section-merged` (Phase 1C)
- `front-matter-page-range-not-declared` (Phase 1C)

**Strategy / parser instrumentation** (audit signal; surfaced separately, NOT counted toward this WP's success criterion -- see "Success criteria" below):

- `toc` -- TOC parser issues (orphan entry, indent ambiguity)
- `toc-verify` -- heading-fingerprint mismatch between TOC and body
- `llm` -- Claude API errors / malformed responses (legacy; no current handbook uses this)
- `section-strategy` -- catch-all for parser-instrumentation messages without a more specific class
- `page-label` -- printed FAA header walk-back failures

Each warning stays in `manifest.json`. The v2 extractor also emits a sibling `warnings.json` (normalized triage-input file matching `handbookWarningsFileSchema` in `libs/bc/study/src/manifest-validation.ts`). Every warning has a stable `id` (16 hex chars; hash of `<code>|<section_code or "">|<message[:50]>`) so triage state can be persisted against it across re-extractions. The `id` is optional on `manifest.json` warnings (back-compat with pre-WP manifests) and required on `warnings.json` entries.

### 6. Hangar warning-triage surface (WP-HANGAR-REFS dependency)

The hangar already has WP-HANGAR-REFS in flight as a sibling spec. This WP delivers the **data contract** for the warnings dashboard:

- Per-doc `validation/<corpus>/<doc>/<edition>/warnings-triage.json` records `{warning_id: triage_status}` where `triage_status` ∈ `{'open', 'wontfix', 'fixed', 'duplicate'}`. Mirrors the validation file shape from WP-TOC-VALIDATION-SCHEMA.
- BC function `getOpenWarningsForReference(referenceId)` reads both the warnings.json and the triage file, returns only `'open'`.
- Hangar UI consumes the BC function; rendering is WP-HANGAR-REFS scope, not this WP's.

### 7. Re-run the 7 chapter-aware ingested handbooks against v2

After v2 ships, re-run the extractor against every chapter-aware ingested doc:

- PHAK (FAA-H-8083-25C)
- AFH (FAA-H-8083-3C)
- AVWX (FAA-H-8083-28B)
- IFH (FAA-H-8083-15B)
- IPH (FAA-H-8083-16B)
- AIH (FAA-H-8083-9)
- RMH (FAA-H-8083-2A)

…plus all 9 promoted ACs. The 12 link-only ACs from Wave 6 stay link-only for now (their full ingestion is WP-AC-FULL).

**Strategy carve-out.** This WP covers the 7 handbooks using `section_strategy: toc`, `toc-file-sidecar`, and `override-md` in the chapter-aware `scripts/sources/config/handbooks/<slug>.yaml` registry. `tips-mountain-flying` is explicitly out of scope: it lives in the `handbooks-extras` `body_override` pipeline, not the chapter-aware registry, so it does not consume the v2 substrate's per-doc YAML keys (`front_matter_page_range`, `empty_section_policy`, etc.). Porting `body_override` onto the chapter-aware pipeline is a separate work package (WP-EXTRAS-RETIRE follow-up), not this WP. If a future handbook uses `section_strategy: prompt` (the paste-to-Claude flow per [section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md)), re-extracting it falls under a separate WP: `prompt` is human-interactive (memory rule: `run-llm-comparison.md` is human-interactive, not a sub-agent target) and doesn't fit the headless re-run shape this WP assumes.

**Front-matter page-range methodology (per-doc, empirical).** For each handbook in Phase 1C, inspect the source PDF's bookmark tree + the first page that bears the FAA-style `<chapter>-<page>` body header to find the boundary between front matter and chapter 1. Commit the `front_matter_page_range: [start, end]` (1-indexed PDF pages, inclusive) to the per-doc YAML at `scripts/sources/config/handbooks/<slug>.yaml`. Surface the value in the Phase 2 PR body so the user can spot-check against the PDF.

**Warning-count contract.** The original Phase-1A modeling assumed the v2 fixable-warnings universe would be a small triage queue (target: <300 across all handbooks combined). Real-world cardinality of the new 1B/1D emitters is much higher than that estimate (e.g. IFH alone went 370 -> 764 fixable, dominated by 157 `empty-section-kept` placeholders, 116 `tablish-block-not-converted` + 116 paired `table-cell-merge-ambiguity` rows, plus 4 OCR-leak elisions including the canonical IFH 2/5 phonetic-alphabet bug). This is intentional triage data, not a regression. The contract for this WP is therefore not a hard total but a per-warning shape: every fixable warning has a stable id (already enforced by Phase 1A's `compute_warning_id`) and is consumable by the Phase 3 / WP-HANGAR-REFS triage surface.

### 8. AIM, ACS, CFR — same treatment

The AIM extractor (744 entries) and the CFR section extractor are different code paths but have analogous gaps:

- AIM front matter (preface, change record).
- AIM table conversion (a smaller surface; less critical).
- CFR section bodies are text-only (no figures, no tables to speak of) — but the CFR extractor doesn't capture Subpart preamble paragraphs. Add them.
- ACS publications already have section-tree but no front matter; add the practical-test-standard front matter (introduction, abbreviations, applicant references).

## Out of Scope (explicit)

- **OCR re-pass on the original PDFs.** We're not re-OCR'ing — we're using the existing extractor's text output and fixing the structural and table conversion layers above it.
- **The 12 link-only ACs full ingestion.** That's WP-AC-FULL, separately scheduled.
- **Bucket C reader UX work.** Prev/next, breadcrumbs, reading-progress UI — separate WP.
- **Adding new corpora.** Wave 7 already shipped SAFO/InFO/CC/NTSB-ALJ; this WP only fixes what's already ingested.
- **Errata application.** WP-APPLY-ERRATA is a separate, related WP that overlaps the chapter-aware path; we'll resolve any pipeline conflicts as they arise but neither blocks the other.

## Phases

Phase 1 is split into three sub-phases (one PR each) so review stays tractable and the WP can ship incrementally without holding the warning-emission contract hostage to the table-conversion or front-matter work.

### Phase 1A: warning-taxonomy normalization + `warnings.json` emission (one PR)

1. Extend `handbookManifestWarningSchema` with the new code vocabulary (`table-cell-merge-ambiguity`, `tablish-block-not-converted`, `ocr-leak-in-section-body`, `empty-section-kept`, `empty-section-merged`, `front-matter-page-range-not-declared`).
2. Add `id` (16 hex chars; optional on manifest, required on `warnings.json`) computed from `<code>|<section_code or "">|<message[:50]>`.
3. Author the sibling `warnings.json` schema (`handbookWarningsFileSchema`) + Python emitter in `tools/handbook-ingest/ingest/normalize.py`. Sorted entries for byte-stable diffs.
4. Classify codes as fixable vs. parser-instrumentation (`WP_FIXABLE_WARNING_CODES`). `toc-verify`, `toc`, `llm`, `page-label`, `section-strategy` are NOT fixable.
5. Hard-fail the writer when it sees an emitter code outside the closed vocabulary so the validator and emitter never drift silently.
6. Spec edits: per-strategy scope carve-out, `toc-verify` reclassification, sub-phase plan.

Tests: TS validator + Python emitter unit tests. No re-extraction yet.

### Phase 1B: HTML-to-markdown table conversion + figure-pairing retry (one PR)

1. Convert simple HTML tables (1 thead row, no rowspans/colspans) to clean markdown tables in section bodies.
2. Keep the standalone `.html` file as fidelity fallback (linked via "open original" through `/handbook-asset/[...path]`).
3. Emit `table-cell-merge-ambiguity` for complex tables that survive as best-effort markdown + HTML fallback; emit `tablish-block-not-converted` for raw-HTML survivors.
4. Figure-pairing wider-rectangle retry: when a caption is detected but no image is paired, retry with a relaxed rectangle.

### Phase 1C: front-matter capture + empty-section policy + OCR-leak detection (one PR)

1. Add `front_matter_page_range: [start, end]` per-doc YAML key (commit empirical values for each handbook in this PR's body).
2. Emit synthetic `level: 'front-matter'` sections (depth 0; ordinals before chapter 1's preamble) for cover, preface, acknowledgments, the substantive prose introduction, optional TOC.
3. Empty-section policy: per-doc YAML `empty_section_policy: { merge_upward: [...], best_effort_fill: [...] }` keyed by section code. Default for unlisted = keep with placeholder + `metadata.extraction_status: 'no-body-content'` on the section row.
4. OCR-leak detection: long string of single-letter tokens in a section body -> elide + emit `ocr-leak-in-section-body`.

Tests: extractor unit tests against known good/bad fixtures.

### Phase 2: re-run + diff (one PR per doc; 9 PRs total)

1. Run the v2 extractor against each of the 8 handbooks (one PR per handbook) + one consolidated PR for the 9 promoted ACs.
2. Diff the new derivative tree against the old; commit the new tree, archive the old where it's been superseded.
3. Re-seed the DB and verify section counts haven't regressed (apart from intentional empty-section merges).
4. Per-doc warning-count delta in the PR body (target: <300 fixable warnings across all handbooks combined).

### Phase 3: hangar triage data contract (separate small PR)

1. `warnings.json` consumer contract (Phase 1A wrote the producer; Phase 3 wires the BC reader).
2. `validation/.../warnings-triage.json` shape + BC reader (`getOpenWarningsForReference`).
3. Hand-off to WP-HANGAR-REFS for the UI.

## Risks

- **Re-extraction changes content_hash for many sections.** The seeder is content-hash idempotent; a hash change triggers re-seeding figures and re-rendering. This is fine but the diff will be enormous on PR review. Strategy: one-doc-per-PR for Phase 2 (8 handbook PRs + 1 ACs PR = 9 PRs) to keep diffs tractable.
- **Front-matter capture might pick up false positives** (legal disclaimers, distribution lists). Per-doc opt-in via `front_matter_page_range` (committed empirically per handbook in Phase 1C).
- **Markdown table conversion is lossy for complex tables.** Documented above; fallback HTML mitigates.
- **AIM and CFR extractors are different code paths.** Don't try to unify them in this WP -- fix each in place.
- **`toc-verify` reclassification could surprise PHAK reviewers.** The 668 PHAK `toc-verify` warnings stay surfaced via the hangar dashboard but are explicitly out of this WP's success-criteria scope. They're a separate triage item: the TOC parser disagreed with the body heading-fingerprint matcher, which is real signal but doesn't fit any of this WP's improvements. A future WP can revisit them.
- **1B/1D emitters' real-world cardinality is empirically much higher than initial Phase-1A modeling assumed** (e.g. IFH 370 -> 764 fixable, with 157 `empty-section-kept` placeholders dominating, plus 116 + 116 paired table warnings and 4 OCR-leak elisions). This is intentional triage data, not a regression. The original "<300 fixable" warning-count target was retired in favor of the per-warning-id triage contract: every fixable warning has a stable id and feeds the Phase 3 / WP-HANGAR-REFS triage surface, where the queue is worked down through `wontfix`/`fixed` triage decisions rather than by suppressing emitter output at the source.

## Success criteria

- Every ingested handbook + AC has front-matter sections in the DB. The reader renders preface / introduction / etc. as part of the doc's reading order.
- Zero raw HTML table blocks in section markdown bodies. Tables render as markdown tables with the original HTML linked as "open original."
- Figure pairing rate ≥ 95% per handbook (measured: figures successfully bound to their sections / total figures detected).
- **Every fixable warning has a stable id and feeds the Phase 3 / WP-HANGAR-REFS triage surface.** "Fixable" = the closed set on `WP_FIXABLE_WARNING_CODES` (see `libs/bc/study/src/manifest-validation.ts`): the figure-pairing, table-conversion, OCR-leak, empty-section, table-cell-merge-ambiguity, tablish-block-not-converted, and front-matter-page-range-not-declared codes. The id is computed by Phase 1A's `compute_warning_id` (16 hex chars; hash of `<code>|<section_code or "">|<message[:50]>`) and is durable across re-extractions, so triage state attaches to a warning and survives substrate runs. Parser-instrumentation codes (`toc`, `toc-verify`, `llm`, `page-label`, `section-strategy`) are tracked separately and surfaced via the hangar dashboard for review but are NOT on this WP's hook. PHAK's 668 `toc-verify` warnings are an example of the latter.
- The original "<300 fixable warnings across all handbooks combined" target has been retired. Real-world cardinality of the 1B/1D emitters is much higher than that initial estimate (e.g. IFH alone is 764 fixable). The substrate is operating as Phase 1B/1D specified; the queue is worked down through Phase 3 / WP-HANGAR-REFS triage decisions, not by suppressing emitter output at the source.
- IFH chapter 1 page renders the chapter preamble + the "Introduction" sub-section is no longer empty (or is correctly merged upward).

## Anchors back to user-visible bugs this resolves

| User report | Resolved by |
|-------------|-------------|
| "front matter -- preface, acknowledgments, real introduction -- missing" | Phase 1 #1 |
| "tables render as raw HTML" | Phase 1 #2 (and Bucket A's HTML pass-through covers the interim) |
| "strange OCR letter-shapes at bottom of IFH 2/5" | Phase 1 #3 (OCR-leak detection) |
| "no images loading" — if root cause is figure pairing failure | Phase 1 #3 (figure-pairing improvements) |
| "Introduction section is empty" | Phase 1 #4 (empty-section policy) |
| "2700 warnings, no triage" | Phase 1 #5 + Phase 3 |
