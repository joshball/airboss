---
title: 'Out of Scope: WP-IFH-SECTION-TREE -- Instrument Flying Handbook section-tree promotion'
product: course
feature: wp-ifh-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-IFH-SECTION-TREE -- Instrument Flying Handbook section-tree promotion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The sources are the "Out of scope (explicitly punted, not deferred)" section of [spec.md](./spec.md), the "Out of scope (follow-up tracking)" section of [tasks.md](./tasks.md), and the "Non-goals" section of [test-plan.md](./test-plan.md). WP-IFH-SECTION-TREE shipped 2026-05-03, promoting IFH from whole-doc to section-tree (11 chapters, 587 sections, including the Chapter 6/7 Section I/II quirk). The items below are everything the WP explicitly left out.

## Summary

| Item                                                              | Status       | Trigger to revisit                                                                        |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| 3 FAA amendment PDFs (ifh_errata + ifh_addendum + ifh_addendum_b) | Follow-on WP | When the ADR-020 errata flow lands its first handbook and IFH is queued for that pipeline |
| LLM prompt-flow verification pass                                 | Deferred     | When a downstream consumer needs deeper-than-3-level section structure for IFH            |

## 3 FAA amendment PDFs (ifh_errata + ifh_addendum + ifh_addendum_b)

Status: Follow-on WP

What was postponed:
Ingestion + application of the three FAA-published amendment PDFs that supplement the IFH base edition: `ifh_errata.pdf`, `ifh_addendum.pdf`, `ifh_addendum_b.pdf`. The WP wrote placeholder `errata: []` and `dismissed_errata: []` arrays into `scripts/sources/config/handbooks/ifh.yaml` (Phase 1) so the field shape stays uniform with other handbooks; the actual amendment entries get filled in by the follow-on WP.

Why:
Per [spec.md](./spec.md) "Out of scope (explicitly punted, not deferred)" line 1: "Tracked under a follow-up WP using ADR 020 errata-flow." The errata-flow itself is a per-handbook authoring workflow defined by ADR 020 and not yet exercised end-to-end; landing IFH errata before that pipeline exists would force ADR 020's first instance through IFH-specific decisions rather than a generalised pattern. Both the IFH base edition and ADR 020 are ready in isolation; the follow-on WP is the bridge.

Trigger that fires the follow-on:
When the ADR-020 errata flow lands its first handbook (any handbook) and IFH is queued for that pipeline. Concretely: when the errata application path exists end-to-end (parse the FAA-published amendment PDF, reconcile against the section-tree manifest, emit `errata[]` rows on the YAML, surface in the rendered section view), IFH is the next candidate.

Implementation pattern when triggered:
Author a follow-on WP at `docs/work-packages/wp-ifh-errata/` (or similar) using the WP-spec template. The YAML placeholders at `scripts/sources/config/handbooks/ifh.yaml` already exist; the implementation work is filling them in per ADR 020's amendment-PDF parser + reconciliation logic. Mirror whichever shipped pattern the first ADR-020 handbook establishes.

References:

- [spec.md](./spec.md) -- "Out of scope" item 1
- [tasks.md](./tasks.md) -- "Out of scope (follow-up tracking)" item 1
- [test-plan.md](./test-plan.md) -- "Non-goals" item 1
- [ADR 020](../../decisions/020-handbook-errata-application/decision.md) -- the errata-flow plan
- `scripts/sources/config/handbooks/ifh.yaml` -- `errata: []` + `dismissed_errata: []` placeholders ready for the follow-on

## LLM prompt-flow verification pass

Status: Deferred

What was deferred:
A second-opinion verification pass using `section_strategy: prompt` against the same IFH PDF, cross-checking the deterministic TOC-file-sidecar output. The WP shipped the deterministic strategy end-to-end; the prompt-flow path is available in the codebase but not exercised for IFH.

Why:
Per [spec.md](./spec.md) "Out of scope" item 2: "Optional follow-up to cross-check the deterministic TOC-file output against an LLM second opinion." Per [tasks.md](./tasks.md) "Out of scope (follow-up tracking)" item 2: "the hand-extracted TOC strips printed-PDF column indentation, so the deterministic parser produces a flat L1 tree per chapter; option remains to re-run `--strategy prompt` later for verification." The deterministic output is correct against the user's hand-extracted TOC; the prompt-flow would primarily recover deeper hierarchy (L3+) that the printed-TOC parser flattens. Without a downstream consumer needing that depth, the verification pass earns no payoff.

Trigger to revisit:
When a downstream consumer needs deeper-than-3-level section structure for IFH. Concretely: when a citation chip, knowledge node, or reader UX needs to deep-link below the chapter/section/subsection (depth 2) cap that the deterministic parser produces -- and the printed TOC has the L3+ entries to support it -- run the prompt-flow as a second-opinion source of structure.

Implementation pattern when triggered:
Re-run extraction with `section_strategy: prompt` per [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md). The output gets compared against the existing `handbooks/ifh/FAA-H-8083-15B/manifest.json` -- net-new L3+ rows get inspected manually and folded back into the TOC sidecar at [docs/work-packages/whole-doc-promotion/source-tocs/ifh.md](../whole-doc-promotion/source-tocs/ifh.md), then re-run deterministic. The prompt-flow is the verification source, not a runtime swap.

References:

- [spec.md](./spec.md) -- "Out of scope" item 2
- [tasks.md](./tasks.md) -- "Out of scope (follow-up tracking)" item 2
- [test-plan.md](./test-plan.md) -- "Non-goals" item 2
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md) -- the prompt-flow contract
- [docs/work-packages/whole-doc-promotion/source-tocs/ifh.md](../whole-doc-promotion/source-tocs/ifh.md) -- the hand-extracted TOC that's the current source of truth
