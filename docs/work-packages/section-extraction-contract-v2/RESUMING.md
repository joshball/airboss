---
title: 'Resuming -- Section extraction contract v2 follow-ups'
product: platform
feature: section-extraction-contract-v2
type: resuming
status: deferred
review_status: done
---

# How to resume LLM-mechanism work after the pause

The contract-v2 WP closed on 2026-04-30 in a production-ready state. The mutual-reviewer pipeline is shipping useful structured signal but the consumer side (TOC parser improvements) is deferred. This file is the entry point when someone returns to that work.

## State at close (2026-04-30)

- **Contract version:** 4. Source of truth at [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md).
- **Production phak run:** PR #366. 911 entries + 357 disagreements across 17 chapters under contract v4.
- **AFH + AVWX:** extracted under TOC-strategy only; LLM-strategy never run against them.
- **Other handbooks (handbooks-extras: risk-management, aviation-instructor, IFH, IPH, AMT-G, AMT-P):** cached PDFs, no extraction yet.

## What the disagreements signal contains

PR #366's 357 per-chapter disagreements (committed under `handbooks/phak/FAA-H-8083-25C/<NN>/_llm_disagreements.json`) are body-text-grounded reasoning about where the deterministic TOC parser is wrong. By type:

| Type              | Count | Pattern                                                                                                   |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `level_mismatch`  | 257   | TOC over-flattens subsections to L1; the LLM correctly nests them.                                        |
| `extra_in_toc`    | 67    | Real body headings the printed TOC doesn't list (e.g. "History of the FAA" with 8 nested children).       |
| `parent_mismatch` | 28    | Same heading, different parent. Often a downstream effect of `level_mismatch`.                            |
| `missing_in_body` | 5     | Pseudo-headings the contract's difficult-cases catalog says to skip (e.g. "Privileges:", "Limitations:"). |
| `anchor_mismatch` | 0     | Page anchors agreed everywhere this run.                                                                  |

Each entry includes a `reason` field with body-text citations. This is **structured input data** for fixing `sections_via_toc.py`, not just advisory output.

## Resume path A -- TOC parser improvement (highest leverage)

If you want to drive the deterministic parser closer to the LLM's structural understanding:

1. **Dump the dominant pattern.** Read [tools/handbook-ingest/ingest/sections_via_toc.py](../../../tools/handbook-ingest/ingest/sections_via_toc.py) -- particularly `_parse_toc_lines` and the `column_x` indent logic. The LLM consistently sees deeper nesting via PyMuPDF block coordinates than the parser's column-x heuristic captures.
2. **Pick one chapter as a canary.** PHAK ch 7 (Aircraft Systems) had 48 disagreements -- the most extreme over-flattening case. Use it as a test bed.
3. **Iterate on the parser.** A natural target: read the `Span.bbox.x0` (or `block.bbox`) from PyMuPDF dict output and use it as a finer-grained indent signal than the current single column-x. The LLM's `body_says.parent_title` for each `level_mismatch` tells you what hierarchy the parser should have produced.
4. **Re-run compare; expect disagreement count to drop.** A successful TOC-parser improvement reduces `level_mismatch` count by orders of magnitude on the same source.
5. **Bump CONTRACT VERSION** if any of the disagreement-type semantics shift; otherwise leave at v4.

This work is **all in** `tools/handbook-ingest/ingest/sections_via_toc.py` plus [its tests](../../../tools/handbook-ingest/tests/test_sections_via_toc.py). No template / contract / orchestrator surgery needed.

## Resume path B -- run another handbook through the prompt strategy

The current production run is phak-only. If you want LLM-assisted extraction on AFH or AVWX:

1. **Edit the YAML** at `scripts/sources/config/handbooks/<doc>.yaml` -- set `section_strategy: prompt` (or pass `--strategy prompt` at runtime).
2. **Run the orchestrator** the same way phak ran:

   ```bash
   bun run sources extract handbooks <doc> --strategy prompt
   # then: claude < tools/handbook-ingest/prompts-out/<doc>/<edition>/out/_run.md
   ```

3. **The orchestrator self-isolates, dispatches sub-agents, ships its own PR.** Same flow as PR #366.

AFH and AVWX caps already raised (Phase 1 PR #332). Templates already v4. No new code needed.

## Resume path C -- consume disagreements in tooling

Currently disagreements are surfaced in the compare report as a markdown digest. If you want structured downstream consumption:

- DB-side: a `handbook_section_disagreement` table keyed by `(doc, edition, chapter, type, title)` with the JSON body. Loader already exists at [`load_chapter_disagreements`](../../../tools/handbook-ingest/ingest/sections_via_sidecar.py).
- UI-side: the hangar admin app could surface "TOC parser disagreement queue" as a triage list. The aggregation primitives are in [`sections_compare.py:_render_disagreements_digest`](../../../tools/handbook-ingest/ingest/sections_compare.py).

## What NOT to do without thinking carefully

- **Don't bump CONTRACT VERSION speculatively.** The current contract is in production. Any v5 needs a real driver (a problem the v4 contract can't express) and an end-to-end re-run.
- **Don't re-run phak gratuitously.** PR #366's output is the production baseline. Re-runs cost a paste-driven session. Only re-run when (a) the PDF changes, (b) the contract changes, or (c) the prompt template changes.
- **Don't promote `extra_in_toc` headings to TOC parser output without verification.** The LLM is good but not perfect; some `extra_in_toc` finds may be body-text artifacts (callout boxes, captions). Cross-check before automating.
- **Don't expand the disagreement type set without a contract bump.** The five types in `_VALID_DISAGREEMENT_TYPES` are the contract's vocabulary; consumers depend on the closed set.

## Quickstart for the returning agent

1. Read [spec.md](spec.md) for the full design context.
2. Read [tasks.md](tasks.md) for what shipped (Phases 1-5 all green).
3. Pick a resume path above based on what's needed.
4. Branch off latest main; never touch `tools/handbook-ingest/ingest/prompts/` without re-running phak end-to-end as the validation gate.
5. The compare report regenerates with `bun run sources extract handbooks phak --strategy compare` -- use it as the validation surface.

## See also

- [docs/ingestion-pipeline/handbook-ingest-pipeline.md](../../ingestion-pipeline/handbook-ingest-pipeline.md) -- end-to-end pipeline overview
- [docs/ingestion-pipeline/section-extraction-strategies.md](../../ingestion-pipeline/section-extraction-strategies.md) -- TOC vs LLM deep dive
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md) -- the no-API-key paste flow
- [ADR 022](../../decisions/022-chapter-source-ingestion/decision.md) -- chapter-source ingestion (the cap-bypass companion)
