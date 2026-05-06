---
id: handbook-figure-pairing
title: "Spec: Handbook Figure-Caption Pairing"
product: flightbag
category: feature
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-05
owner: agent
depends_on: []
unblocks: []
tags:
  - handbook
  - figures
legacy_fields:
  feature: handbook-figure-pairing
  type: spec
  review_status: done
---

# Spec: Handbook Figure-Caption Pairing

The handbook ingestion pipeline ([tools/handbook-ingest/ingest/figures.py](../../../tools/handbook-ingest/ingest/figures.py)) extracts figure images from FAA PDFs and pairs them with figure captions found in the body text. When pairing fails, an entry lands in `handbooks/<slug>/<edition>/warnings.json` under code `caption-without-figure`. Across the seven currently-ingested handbooks there are **1,435 such orphans**, with **347 unpaired images** on the other side of the same heuristic.

The flightbag reader surfaces these handbooks. Missing figures degrade the learning surface: body text references "Figure 2-5. Phonetic pronunciation guide." but the page renders without an image to look at. The e2e spec for IFH §2.5 was relaxed to a TODO during the [e2e-isolation cleanup](../../../tests/e2e/flightbag/reader.spec.ts) and tracking the strict-figure assertion getting flipped back on is a success criterion for this WP.

This WP does NOT replace the existing pipeline. It tightens the heuristic in `figures.py` so the orphan rate drops by an order of magnitude, fixes the upstream regex that admits sentence references as captions, and adds a regression-test harness so we can make further changes with confidence.

## Goals

1. Drop the global `caption-without-figure` count from 1,435 to under 200 across the seven ingested handbooks.
2. Drop the global `figure-without-caption` count from 347 to under 100 (most fall as a side-effect of fixing #1, but a few are real and need their own fix).
3. Restore the strict figure assertion in `tests/e2e/flightbag/reader.spec.ts` (IFH Figure 2-5).
4. Add a regression test against `figures.py` that locks in the orphan-rate threshold per handbook so future ingest changes can't silently regress.
5. Make the failure modes diagnosable: warnings.json messages should distinguish a "real caption that we couldn't pair" from a "regex false positive" so future triage doesn't waste time on inline-text noise.

## Non-goals

- Re-architecting the ingest pipeline. The three-tier same-page/prior-page/next-page geometric pairing in [figures.py:124-135](../../../tools/handbook-ingest/ingest/figures.py#L124-L135) is broadly correct.
- OCR over the PDF. The orphan rate is high enough that text-based fixes cover most of it; OCR is a future option for the long tail (see [Risks](#risks)).
- Manual override sidecar files. Considered and rejected (see [Design alternatives](#design-alternatives)).
- Onboarding new handbooks. Pure pipeline correctness work; the ingest flow itself is unchanged.
- Re-extraction of historical handbooks at first merge. The fix lands in the pipeline; existing handbook trees re-ingest on the next routine refresh.

## Current state

### Orphan distribution

| Handbook            | `caption-without-figure` | `figure-without-caption` |
| ------------------- | ------------------------ | ------------------------ |
| IFH                 |                      353 |                       14 |
| Aviation Instructor |                      325 |                        0 |
| PHAK                |                      269 |                       67 |
| AFH                 |                      181 |                        6 |
| IPH                 |                      128 |                       49 |
| AvWX                |                       94 |                      149 |
| Risk Management     |                       85 |                       62 |
| **Total**           |                **1,435** |                  **347** |

Counts confirmed by `jq '[.warnings[] | select(.code == "caption-without-figure")] | length'` on each handbook's `warnings.json`.

### Failure-mode taxonomy

Sampled from `handbooks/ifh/FAA-H-8083-15B/warnings.json` and corroborated against the source markdown. Three modes account for nearly all orphans:

#### Mode A: regex false positives on sentence references

The regex used to detect captions is [figures.py:58](../../../tools/handbook-ingest/ingest/figures.py#L58):

```python
figure_pattern: str = r"Figure (\d+)-(\d+)\."
```

The trailing `\.` was meant to anchor on the period that ends a caption header ("Figure 2-5. Phonetic pronunciation guide."), but it also matches the period that ends a sentence containing a cross-reference ("...as illustrated in Figure 3-4.", "...shown in Figure 7-22."). These sentence references make up the majority of the IFH orphan list. Sample (verbatim from `warnings.json`):

```text
Caption `shown in Figure 7-22. The basic attitude is established and...` on page 170
Caption `pitch, roll, or yaw as illustrated in Figure 3-4. Each canal is...` on page 71
Caption `with maximum allowable ASIs like the one in Figure 5-14.  This...` on page 105
Caption `oil separator like the one in Figure 5-28.` on page 112
Caption `airspace, respectively, per Figure 1-3.` on page 25
```

In each case the body text mentioned a figure number; no image is supposed to live there; the warning is noise.

#### Mode B: real captions on overflow / cross-section pages

Per [figures_dedup.py:1-11](../../../tools/handbook-ingest/ingest/figures_dedup.py#L1-L11), section page ranges overlap. A page can back two sections (chapter intro and first sub-section), or a figure can flow across the boundary between sections (image on the last page of section A, caption on the first page of section B). In `_extract_for_node` ([figures.py:108-122](../../../tools/handbook-ingest/ingest/figures.py#L108-L122)) the `images_by_page` dict is built **only from this section's page range**. If the image's page falls outside `[node.page_start - 1, node.page_end)`, it is invisible to the pairing pass for this section, regardless of how clearly the caption resolves geometrically.

This is the cluster the agent's investigation identified late in its run. Affected most heavily: AvWX (149 unpaired images, 94 orphan captions — many are the *same figure* surfaced twice from opposite sides of the boundary).

#### Mode C: real captions whose paired image was filtered out

[figures.py:262-263](../../../tools/handbook-ingest/ingest/figures.py#L262-L263):

```python
if pix.width < 64 or pix.height < 64:
    continue
```

Small icons, inline glyphs, and tiny insets get dropped. If the FAA author used a 50px-wide icon as Figure N-N (rare but happens for symbol legends), the caption surfaces but the image is gone. The threshold is reasonable for the common case but is a silent dropper today.

### Why the existing dedup doesn't help

[figures_dedup.py](../../../tools/handbook-ingest/ingest/figures_dedup.py) collapses duplicate **PNG bytes** after extraction (the cross-section overlap *succeeds* at extracting the same figure twice, then dedup picks a canonical). It does not pair an orphan caption with an image extracted under a different section. Mode B persists.

## Approach

### Fix 1: stricter caption regex (addresses Mode A)

Replace the trailing `\.` anchor with a stronger caption-header signature. A caption header is "Figure N-N." followed by **(a) a space, then (b) a capitalized word, then (c) characters until end-of-line or a single sentence boundary**. Inline sentence references end with a period followed by a lowercase continuation or no continuation in the same line.

Proposed pattern:

```python
figure_pattern: str = r"^Figure (\d+)-(\d+)\.\s+[A-Z]"
```

Apply with `re.MULTILINE`. This anchors at line start and requires a capitalized word immediately after the period. In-sentence references like "shown in Figure 7-22." never match because they don't start the line. Caption headers always do (per FAA layout convention; verified across the seven handbook samples).

Risk: a small number of legitimate captions might break the line-start anchor due to PDF text-extraction artifacts (e.g. a leading space). Test plan covers this; if rate of regression is non-zero, fall back to a permissive line-start that allows leading whitespace: `r"^\s*Figure (\d+)-(\d+)\.\s+[A-Z]"`.

### Fix 2: cross-section image dictionary (addresses Mode B)

Build `images_by_page` **once per document**, not per section. Move the image extraction out of `_extract_for_node` and into `extract_figures` (the top-level call). Pass the global dict into each per-section pass; the per-section pass still walks captions only within its own page range, but the image lookup spans the whole document.

The `used_image_keys` set must also become document-global to keep an image from pairing twice. Today it is per-section, so the dedup pass had to clean up the resulting double-extraction; with global `used`, dedup becomes a safety net rather than a routine workhorse.

This change is small (~30 LOC) and preserves the existing pairing tier strategy intact. It does not affect Mode A or C.

### Fix 3: smaller image floor with allowlist (addresses Mode C)

Lower the size threshold from `64×64` to `32×32`. Add a separate allowlist: if a small image sits within ~50 pdf-units of a caption header (Tier 1's same-page geometric path), keep it regardless of size. This catches small symbol-legend figures without flooding the output with decorative inline glyphs.

### Fix 4: triage-friendly warning messages

Annotate each `caption-without-figure` warning with the **mode** the pipeline thinks it is:

```text
Caption `shown in Figure 7-22. ...` on page 170 had no paired image.
  -> mode: in-sentence-reference (regex saw a sentence-internal Figure N-N.)
```

For mode B (no image in section's page range): include a hint about the overlap with prior/next section. For mode C (image filtered out): include the rejected image's dimensions.

This makes future ingest tuning loops much shorter; right now every warning looks alike and triage requires opening the PDF.

### Fix 5: regression-test harness

New `tools/handbook-ingest/tests/test_orphan_thresholds.py`. For each handbook in the seven-handbook fleet, assert:

```python
assert orphan_count(handbook) <= ORPHAN_BUDGET[handbook]
```

`ORPHAN_BUDGET` is set per handbook based on this WP's measured post-fix counts. The test reads the live `warnings.json` and bails the build if a future ingest change pushes the rate back up. This is the durable guardrail; without it the fleet drifts back to today's numbers as the handbooks evolve.

## Success criteria

1. `caption-without-figure` total across the seven handbooks <= 200 (down from 1,435).
2. `figure-without-caption` total across the seven handbooks <= 100 (down from 347).
3. The flightbag reader spec `tests/e2e/flightbag/reader.spec.ts` test for IFH Figure 2-5 passes the strict assertion (TODO removed).
4. `tools/handbook-ingest/tests/test_orphan_thresholds.py` passes and is wired into `bun run check` (or its python sibling, see Tasks).
5. New warning messages distinguish modes A / B / C in their text, verified by sampling 10 messages per mode after the fix lands.
6. No fresh `figure-without-caption` regressions: re-extracting all seven handbooks against the new pipeline produces no more unpaired images than today.

## Design alternatives

### Manual override sidecar files

Considered: `handbooks/<slug>/<edition>/figure-overrides.yaml` listing caption -> image manual pairings for the long tail. Rejected for the bulk of the work because (a) ~1,400 entries is too many to author by hand, (b) it freezes manual decisions against re-ingestion, and (c) the regex fix alone removes the majority of orphans without any per-figure curation. Reserved as an option for the residual long-tail after Fixes 1-3 land if any handbook can't reach its orphan budget through automated heuristics.

### OCR-detect figure labels on extracted images

Considered: OCR over each extracted PNG, look for a "Figure N-N" label in the image itself, use that to confirm pairing. Rejected for v1 because (a) it adds a tesseract / paddleocr dependency to the ingest pipeline, (b) only some FAA figures embed their label as raster text (others use vector labels that would be lost in image extraction), and (c) the simpler text-side fixes hit the budget. Reserved as a future option if the residual long-tail justifies the dependency.

### Wider page window for tiers 2 and 3

Considered: extend the prior/next-page tiers in `_pair_caption_with_image` to look two pages back and two pages forward, instead of one. Rejected because Mode B isn't a "wrong window" problem — it's a "wrong dictionary" problem. The image is on a page outside the section's page range entirely. Widening tiers 2/3 within the broken-dictionary scope would not find them. Fix 2 (global image dictionary) is the correct attack on this mode.

## Risks

- **False positives from the stricter regex.** A genuine caption that doesn't start with `^Figure` due to PDF extraction quirks gets dropped silently. Mitigated by the regression-test harness — if the fix drops more captions than it picks up, the per-handbook budget assertion fails the build. Also test by per-handbook spot check during implementation.
- **Global image dict memory.** A 500-page handbook has thousands of embedded images. Holding the full PNG bytes in memory for the whole document is a measurable jump from the per-section approach. Mitigation: store image **references** (page_num + xref) in the global dict, defer PNG extraction until the pairing decision picks one. This is the natural shape and `extract_figures` already opens the doc context for the duration; no new file I/O is added.
- **The 32x32 floor lets in decorative glyphs.** The proximity allowlist gates this, but if the FAA layout uses inline icons (e.g. for warning-symbol callouts) close to a caption, those would slip in. Validate with the per-handbook orphan budget — if `figure-without-caption` rises post-fix, the floor was lowered too far for that book.
- **Reseeding effort.** Existing handbook trees on disk are extracted under the old pipeline. After the fix lands, those trees still carry the old orphan rate until each is re-ingested. The fix is in the **pipeline**; the data refresh is a separate operational step. Document the re-ingest command in this WP's tasks so the fleet gets refreshed in one pass once the fix is merged.

## Open questions for the user

- None at spec-author time. Decisions made in this WP that the user should affirm before build:
  - Targets of "<= 200 orphan captions" and "<= 100 unpaired images" total. Looser or tighter?
  - Floor lowering from 64 to 32. Acceptable risk of inline-icon noise vs gain from rescuing small legitimate figures?
  - Manual override sidecar deferred to "future option if budget unmet." OK to defer or want it in scope now?
