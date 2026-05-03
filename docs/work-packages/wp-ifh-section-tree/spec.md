---
title: 'Spec: IFH section-tree promotion'
product: platform
feature: wp-ifh-section-tree
type: spec
status: unread
review_status: pending
shipped_at: '2026-05-03'
---

# Spec: IFH section-tree promotion

Promote the Instrument Flying Handbook (IFH, FAA-H-8083-15B) from whole-doc to section-tree shape so deep-link locators can target chapters / sections / subsections, matching the existing PHAK / AFH / AVWX precedent. IFH is the hardest of the five whole-doc handbooks queued for promotion: no embedded TOC, no chapter PDFs, and a structural quirk where chapters 6 and 7 each subdivide into Section I (analog instrumentation) and Section II (electronic flight display).

## Why this WP exists

IFH today lives in `handbooks-extras.yaml` as a Class C whole-doc-only entry. The manifest's `sections: []` means downstream consumers cannot deep-link by chapter/section. Per `docs/platform/REFERENCES.md` row 6, IFH promotion is the sixth step toward "everything readable as section-tree."

Per the research at [docs/work-packages/whole-doc-promotion/research.md §IFH](../whole-doc-promotion/research.md#ifh----instrument-flying-handbook-faa-h-8083-15b):

- `fitz.get_toc()` returns 0 entries -- bookmark strategy unavailable.
- No per-chapter PDFs (verified by URL probing).
- Printed TOC at PDF pp. 12-18 (printed pages `ix..xv`) is L4+ deep; existing `sections_via_toc.py` over-flattens per Pattern A risk in `section-extraction-strategies.md`.
- Three FAA amendment PDFs (`ifh_errata.pdf`, `ifh_addendum.pdf`, `ifh_addendum_b.pdf`) -- ADR 020 errata flow, OUT OF SCOPE for this WP.
- Chapters 6 and 7 each split into Section I / Section II.

## Strategy

The user has hand-extracted the printed TOC into [docs/work-packages/whole-doc-promotion/source-tocs/ifh.md](../whole-doc-promotion/source-tocs/ifh.md). That file is the section-tree definition. Implement a new `outline_strategy: toc-file-sidecar` mode that reads the markdown TOC sidecar and emits the chapter / section / subsection tree directly. The body slicing falls back to the existing page-range slicer once chapter and section boundaries are known.

The prompt-flow approach (`section_strategy: prompt`) is feasible but requires a separate fresh-session paste step. The TOC-file-sidecar approach is end-to-end runnable in the worktree with the user's hand-extracted TOC as the single source of truth for structure.

## Chapter 6 / 7 quirk -- decision

The IFH printed TOC carries:

```text
Chapter 6, Section I    Airplane Attitude Instrument Flying Using Analog Instrumentation     6-1
Chapter 6, Section II   Airplane Attitude Instrument Flying Using an Electronic Flight Display 6-15
Chapter 7, Section I    Airplane Basic Flight Maneuvers Using Analog Instrumentation         7-1
Chapter 7, Section II   Airplane Basic Flight Maneuvers Using an Electronic Flight Display   7-33
```

The schema (`tools/handbook-ingest/ingest/section_tree.py`) caps section depth at `chapter / section / subsection` (3 levels). Two ways to model the I / II split:

| Option | Description | Effect on schema | Effect on FAA semantics |
|--------|-------------|------------------|-------------------------|
| (a) Four chapters | Treat 6.I, 6.II, 7.I, 7.II as four standalone chapters with their own ordinals (6, 7, 8, 9), renumber subsequent chapters | Clean -- each chapter has its own subtree | Breaks -- FAA prints `8-1` for chapter 8, not what was the second half of chapter 6 |
| (b) Two chapters, two top-level sections each | Chapter 6 holds level-1 section `6.1` (Section I) and `6.2` (Section II); same for Chapter 7. Deeper TOC entries become subsections | Clean -- fits 3-level schema | Preserves -- FAA chapter ordinals 1-11 unchanged; FAA page anchors `6-1..6-32` map to chapter 6 unchanged |

**Decision: option (b).** Rationale:

- FAA chapter ordinals (1..11) and FAA page anchors (`6-1`, `6-15`, etc.) round-trip without renumbering. Re-running ingest after a future IFH amendment will not silently reshape the manifest.
- The Section I / Section II split is semantically a "presentation modality" choice (analog vs glass cockpit) that fits the "section" abstraction better than a chapter-level boundary.
- The deeper TOC entries that lived under each Section flatten to `subsection` (level 2 under the Section). The schema's 3-level cap means any L3+ TOC entry collapses to subsection -- same behavior as RMH (depth 4) and AIH (depth 5) where the existing flatten rule applies.

Section titles preserve the `Section I --` / `Section II --` prefix in the rendered title so the TOC's split is visible in chips, breadcrumbs, and the cited-by panel.

## Out of scope (explicitly punted, not deferred)

- **The 3 FAA amendment PDFs** (`ifh_errata.pdf`, `ifh_addendum.pdf`, `ifh_addendum_b.pdf`). Tracked under a follow-up WP using ADR 020 errata-flow. Surfacing as a `errata: []` placeholder in `ifh.yaml` keeps the field uniform with other handbooks; entries get added by the follow-up WP.
- **Re-running the prompt-flow as verification.** Optional follow-up to cross-check the deterministic TOC-file output against an LLM second opinion.

## Anchors

- [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md) -- the strategy spec.
- [docs/work-packages/whole-doc-promotion/source-tocs/ifh.md](../whole-doc-promotion/source-tocs/ifh.md) -- the user's hand-extracted TOC.
- [scripts/sources/config/handbooks/avwx.yaml](../../../scripts/sources/config/handbooks/avwx.yaml) -- Class C precedent (whole-doc only, no chapter PDFs).
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md) -- the LLM prompt-flow contract (used for optional verification only).
- [tools/handbook-ingest/ingest/sections_via_toc.py](../../../tools/handbook-ingest/ingest/sections_via_toc.py) -- existing TOC-page parser; extended here with a sidecar reader.
- [tools/handbook-ingest/ingest/outline.py](../../../tools/handbook-ingest/ingest/outline.py) -- chapter outline. Extended with a `toc-file-sidecar` strategy that reads chapters from the user's TOC markdown.

## Acceptance

- `bun run sources extract handbooks ifh --edition FAA-H-8083-15B` runs end-to-end with `outline_strategy: toc-file-sidecar` and `section_strategy: toc-file-sidecar`.
- Manifest emitted at `handbooks/ifh/FAA-H-8083-15B/manifest.json` contains `sections[]` with chapter / section / subsection rows.
- Chapter count = 11 (1..11), with 2 sections each under 6 and 7 modeling Section I / Section II.
- IFH row removed from `handbooks-extras.yaml`; IFH friendly mappings removed from `DOC_ID_TO_FRIENDLY` and `FRIENDLY_DISPLAY` in `libs/sources/src/handbooks-extras/ingest.ts`. The whole-doc derivative file `handbooks/ifh/FAA-H-8083-15B/ifh-FAA-H-8083-15B.md` removed.
- Smoke test count in `libs/sources/src/handbooks-extras/ingest.test.ts` updated from 5 to 4.
- `REFERENCES.md` IFH row updated to `✅ readable, section-tree`.
- `bun run check` clean. Vitest unit tests for the sidecar parser pass.
