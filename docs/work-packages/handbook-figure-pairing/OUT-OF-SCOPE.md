---
title: 'Out of Scope: Handbook Figure-Caption Pairing'
product: flightbag
feature: handbook-figure-pairing
type: out-of-scope
status: unread
---

# Out of Scope: Handbook Figure-Caption Pairing

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                 | Status   | Trigger to revisit                                                                                     |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Re-architecting the ingest pipeline                  | Rejected | Never -- see detail below                                                                              |
| OCR over the extracted figure PNGs                   | Deferred | When the residual long-tail of orphans cannot be closed by text-side heuristics in any single handbook |
| Manual override sidecar files                        | Deferred | When a specific handbook cannot reach its orphan budget through automated heuristics post Fixes 1-3    |
| Onboarding new handbooks                             | Rejected | Never -- see detail below                                                                              |
| Re-extraction of historical handbooks at first merge | Rejected | Never -- see detail below                                                                              |
| Wider page window for tiers 2 and 3 of pairing       | Rejected | Never -- see detail below                                                                              |

## Re-architecting the ingest pipeline

Status: Rejected

What was rejected:
A redesign of the three-tier same-page / prior-page / next-page geometric pairing in `tools/handbook-ingest/ingest/figures.py` (lines 124-135 at WP time).

Why:
The existing pipeline is broadly correct. The orphan problem is concentrated in three specific failure modes (regex false positives, per-section image dictionary, image-size floor) that are addressable by surgical fixes. Re-architecting would invent risk where the diagnostic evidence supports targeted edits.

References:

- [spec.md "Non-goals"](./spec.md)
- [spec.md "Failure-mode taxonomy"](./spec.md)

## OCR over the extracted figure PNGs

Status: Deferred

What was deferred:
Running OCR (tesseract / paddleocr or similar) on each extracted PNG to detect "Figure N-N" labels embedded as raster text, and using that label to confirm or correct pairing.

Why:
Adds a heavyweight binary dependency to the ingest pipeline, only some FAA figures embed their label as raster text (others use vector labels that are lost during image extraction), and the simpler text-side fixes hit the orphan budget. The cost / benefit does not justify the dependency for v1.

Trigger to revisit:
When the residual long-tail of orphans on any single handbook cannot be closed by further text-side heuristics, AND the orphan rate on that handbook materially degrades the flightbag reader experience for that handbook's surface.

Implementation pattern when triggered:
Author a follow-on WP that scopes OCR as an opt-in pass for a single handbook, gated behind a config flag. Mirror the per-handbook budget assertion pattern from `tools/handbook-ingest/tests/test_orphan_thresholds.py` so the OCR pass is measurable against the pre-OCR baseline before any dependency is added globally.

References:

- [spec.md "Non-goals"](./spec.md)
- [spec.md "Design alternatives: OCR-detect figure labels on extracted images"](./spec.md)

## Manual override sidecar files

Status: Deferred

What was deferred:
Per-edition `handbooks/<slug>/<edition>/figure-overrides.yaml` files listing manual caption to image pairings for the long tail.

Why:
At spec time the orphan count was ~1,400, which is too large to author by hand. Manual overrides also freeze authorial decisions against re-ingestion, which makes them brittle. The Fixes 1-3 heuristic work removes the majority of orphans without per-figure curation, so manual overrides are unnecessary for the bulk.

Trigger to revisit:
When a specific handbook cannot reach its `ORPHAN_BUDGET` through automated heuristics after Fixes 1-3 have landed, and the residual orphans on that handbook all share an irregular structural pattern that no general heuristic can capture.

Implementation pattern when triggered:
Author a follow-on WP scoped per-handbook. Add a `figure-overrides.yaml` loader to `_extract_for_node` that runs before the geometric tier passes. Format it so each override carries a re-ingest stability marker (`page_num` + `caption_text_hash`) so re-ingestion does not silently invalidate the override.

References:

- [spec.md "Non-goals"](./spec.md)
- [spec.md "Design alternatives: Manual override sidecar files"](./spec.md)

## Onboarding new handbooks

Status: Rejected

What was rejected:
Adding new handbook editions or new FAA publications to the ingestion fleet as part of this WP.

Why:
This is pure pipeline-correctness work. The ingest flow itself is unchanged and the seven currently-ingested handbooks are the measurement surface. Folding new-handbook onboarding into the same WP would blur the orphan-budget metric across heterogeneous content.

References:

- [spec.md "Non-goals"](./spec.md)

## Re-extraction of historical handbooks at first merge

Status: Rejected

What was rejected:
A bulk re-extraction of every existing handbook tree as part of the WP's first-merge PR.

Why:
The fix lands in the pipeline. Existing handbook trees re-ingest on the next routine refresh (Phase 6 in tasks.md handles the data refresh step explicitly). Coupling pipeline-merge to a bulk regeneration would create a giant PR that bundles code with regenerated derivative bytes, making review noisy and rollback expensive.

References:

- [spec.md "Non-goals"](./spec.md)
- [tasks.md "Phase 6: restore strict assertion + sweep"](./tasks.md)

## Wider page window for tiers 2 and 3 of pairing

Status: Rejected

What was rejected:
Extending the prior-page and next-page tiers in `_pair_caption_with_image` to look two pages back and two pages forward instead of one.

Why:
Mode B (real captions on overflow / cross-section pages) is not a "wrong window" problem. It is a "wrong dictionary" problem: the image is on a page outside the section's page range entirely, so widening the tier window inside a broken-scope dictionary would never reach it. Fix 2 (global cross-section image dictionary) attacks the actual root cause; widening the windows would only mask the real failure mode and risk false pairings within scope.

References:

- [spec.md "Design alternatives: Wider page window for tiers 2 and 3"](./spec.md)
