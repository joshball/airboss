---
title: 'Out of Scope: Section extraction contract v2'
product: platform
feature: section-extraction-contract-v2
type: out-of-scope
status: unread
---

# Out of Scope: Section extraction contract v2

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                | Status       | Trigger to revisit                                                                  |
| --------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| Chapter-source ingestion (per-chapter PDF/HTML)     | Follow-on WP | The `chapter-source-ingestion` WP (shipped PR #337); cap remains for whole-doc only |
| TOC parser improvements                             | Deferred     | When someone returns to grind down the 357-disagreement signal in PR #366           |
| Cache layout changes                                | Rejected     | Never -- ADR 021 settled the layout                                                 |
| Errata application                                  | Follow-on WP | The `apply-errata-and-afh-mosaic` WP                                                |
| `handbook_section` DB schema changes                | Rejected     | Never -- contract output is extract-time only, not DB-bound                         |
| API-driven LLM mode (`--strategy llm` API path)     | Rejected     | Never -- paste flow is the only supported mode                                      |
| Run other handbooks (AFH, AVWX) through prompt mode | Deferred     | When AFH or AVWX needs LLM-assisted section extraction beyond TOC strategy          |
| DB-side disagreements consumption                   | Deferred     | When TOC parser improvement work needs a triage queue surface                       |
| Hangar admin disagreements UI queue                 | Follow-on WP | When hangar admin surface lands and disagreements need triage tooling               |

## Chapter-source ingestion

Status: Follow-on WP

What was deferred:
Per-chapter PDF / HTML downloads that obviate the `chapter_text_max_chars` cap entirely.

Why:
Scope discipline. The truncation fix in this WP raises the cap as a transitional measure; the architectural fix is per-chapter ingestion, which is its own WP with its own cache-layout and download-mode surgery (ADR 022). Rolling it into the contract-rewrite WP would couple two unrelated risks.

Trigger to revisit:
The `chapter-source-ingestion` WP itself -- shipped in PR #337. The cap is now bypassed for handbooks in chapter mode (PHAK, AFH, IPH, helicopter, glider, balloon, instructors); it stays in YAML as a fallback for whole-doc-only handbooks like AVWX and IFH.

Implementation pattern when triggered:
Already implemented. Reference [ADR 022](../../decisions/022-chapter-source-ingestion/decision.md) and [docs/work-packages/chapter-source-ingestion/](../chapter-source-ingestion/) for the per-handbook `chapter_pdfs` YAML block and download path.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" listed chapter-source ingestion
- [tasks.md](./tasks.md) Phase 5 "Out-of-band: monitor post-merge" note
- [ADR 022](../../decisions/022-chapter-source-ingestion/decision.md) -- chapter-source ingestion ADR

## TOC parser improvements

Status: Deferred

What was deferred:
Fixing the deterministic Python parser at [tools/handbook-ingest/ingest/sections_via_toc.py](../../../tools/handbook-ingest/ingest/sections_via_toc.py) to stop over-flattening hierarchy and to catch real body headings the printed TOC omits. The parser has known bugs (668 warnings noted in spec, 485 parent-mismatches + 317 level-mismatches across 17 chapters in the compare report).

Why:
Surfacing parser bugs via the `disagreements` mutual-reviewer framing is in scope; fixing the parser is not. The disagreements signal is structured input data for a separate parser-improvement effort, but doing that surgery during the contract rewrite would have inflated scope past one reviewable unit.

Trigger to revisit:
When someone returns to drive the deterministic parser closer to the LLM's structural understanding. The 357 per-chapter disagreements committed under `handbooks/phak/FAA-H-8083-25C/<NN>/_llm_disagreements.json` (PR #366) are the input data.

Implementation pattern when triggered:
Follow [RESUMING.md](./RESUMING.md) "Resume path A". Read `_parse_toc_lines` and the `column_x` indent logic in [tools/handbook-ingest/ingest/sections_via_toc.py](../../../tools/handbook-ingest/ingest/sections_via_toc.py); read PyMuPDF `Span.bbox.x0` (or `block.bbox`) as a finer-grained indent signal than the current single column-x. PHAK ch 7 (48 disagreements) is the canary chapter. Success metric: `level_mismatch` count drops by orders of magnitude.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" listed TOC parser improvements
- [RESUMING.md](./RESUMING.md) -- Resume path A walks the work step by step
- [tools/handbook-ingest/ingest/sections_via_toc.py](../../../tools/handbook-ingest/ingest/sections_via_toc.py) -- the parser file

## Cache layout changes

Status: Rejected

What was rejected:
Reorganizing the source-cache directory layout under `~/Documents/airboss-handbook-cache/` as part of this WP.

Why:
ADR 021 settled the layout. Moving files would invalidate every downstream tool's assumptions about cache paths. The contract rewrite does not need a layout change; existing paths are correct.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" noted ADR 021 settled cache layout
- [ADR 021](../../decisions/021-handbook-cache-layout/decision.md) -- the cache layout decision

## Errata application

Status: Follow-on WP

What was deferred:
Applying handbook errata (FAA-published corrections) and the AFH mosaic reconstruction. These reshape source content before extraction.

Why:
Errata are handled separately by the `apply-errata-and-afh-mosaic` WP. The contract rewrite operates on whatever plaintext sidecar exists; errata correctness is a content-pipeline concern that runs upstream of section extraction.

Trigger to revisit:
The `apply-errata-and-afh-mosaic` WP itself.

Implementation pattern when triggered:
Reference the `apply-errata-and-afh-mosaic` WP directly.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" pointed at the errata WP

## `handbook_section` DB schema changes

Status: Rejected

What was rejected:
Adding columns, tables, or indexes to the `handbook_section` schema to carry contract-v2 output fields (`page_anchor`, `parent_title`, `line_offset`, `disagreements`).

Why:
The contract output is consumed by extract-time tools (`sections_compare.py`, `sections_via_sidecar.py`), not by the DB. The DB-facing pipeline reads `_llm_section_tree.json` as JSON; schema is unaffected. Any DB-side disagreements consumption is a separate, deferred concern (see "DB-side disagreements consumption" below).

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" stated no `handbook_section` changes

## API-driven LLM mode (`--strategy llm` API path)

Status: Rejected

What was rejected:
Reintroducing an API-key-driven `--strategy llm` path that would call the Anthropic API directly to run section extraction (as an alternative to the paste flow).

Why:
The paste flow is the only supported mode. The no-API-key paste-to-Claude flow is a deliberate architectural choice ([section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md)); re-adding an API path would split the contract surface across two implementations.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" forbade reintroducing `--strategy llm`
- [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md) -- the paste-flow design

## Run other handbooks (AFH, AVWX) through prompt mode

Status: Deferred

What was deferred:
Running the prompt-strategy extraction against AFH or AVWX. Today both default to `section_strategy: toc`; the contract change applies generically once phak is verified, but no other handbook has been pushed through the LLM strategy.

Why:
The contract rewrite was acceptance-tested against phak end-to-end (PR #355). Per-handbook prompt runs are independent units of work; running them all in one WP would conflate contract correctness with handbook-by-handbook ingest economics.

Trigger to revisit:
When AFH or AVWX needs LLM-assisted section extraction (e.g. TOC strategy proves insufficient for a specific consumer).

Implementation pattern when triggered:
Follow [RESUMING.md](./RESUMING.md) "Resume path B". Edit `scripts/sources/config/handbooks/<doc>.yaml` to set `section_strategy: prompt`, run `bun run sources extract handbooks <doc> --strategy prompt`, then dispatch sub-agents via `claude < tools/handbook-ingest/prompts-out/<doc>/<edition>/out/_run.md`. AFH and AVWX caps already raised (Phase 1 PR #332); templates already on contract v4.

References:

- [tasks.md](./tasks.md) -- Phase 5 "Out-of-band: monitor post-merge" notes AFH and AVWX defer
- [RESUMING.md](./RESUMING.md) -- Resume path B walks the run

## DB-side disagreements consumption

Status: Deferred

What was deferred:
A `handbook_section_disagreement` DB table keyed by `(doc, edition, chapter, type, title)` with the JSON body. Disagreements today live as committed JSON files surfaced through the compare report; they have no DB-side representation.

Why:
The disagreements signal is currently consumed only by the compare report (markdown digest). A DB representation only earns its keep when there's a consumer (TOC parser triage queue, hangar admin tile, dashboard); building it speculatively is premature.

Trigger to revisit:
When TOC parser improvement work (see "TOC parser improvements" above) needs a structured triage queue rather than reading per-chapter JSON files by hand.

Implementation pattern when triggered:
The loader already exists at [`load_chapter_disagreements`](../../../tools/handbook-ingest/ingest/sections_via_sidecar.py). Add a Drizzle schema entry for `handbook_section_disagreement` in `libs/bc/study/src/schema.ts` (or wherever ingestion schema lives at that time); follow the source-registry schema pattern in the same file.

References:

- [RESUMING.md](./RESUMING.md) -- Resume path C describes the DB-side and UI-side options
- [tools/handbook-ingest/ingest/sections_via_sidecar.py](../../../tools/handbook-ingest/ingest/sections_via_sidecar.py) -- existing loader

## Hangar admin disagreements UI queue

Status: Follow-on WP

What was deferred:
A hangar admin surface that renders the "TOC parser disagreement queue" as a triage list. Today disagreements are surfaced only in the markdown compare report.

Why:
The hangar admin app surface is itself scaffolded but not yet built out for source-management tiles. A disagreements UI is a downstream consumer of audit data and the disagreements file format, both of which exist; building the UI today would lack a host product.

Trigger to revisit:
When the hangar admin surface lands its first source-management tile and disagreements need user-facing triage tooling (mirrors `hangar-users-editing` dual-gate pattern).

Implementation pattern when triggered:
The aggregation primitives live in [`sections_compare.py:_render_disagreements_digest`](../../../tools/handbook-ingest/ingest/sections_compare.py). Mirror the dual-gate audit + form-action pattern established by `hangar-users-editing`. Author a separate WP `wp-hangar-disagreements-triage` (or similar) at that time.

References:

- [RESUMING.md](./RESUMING.md) -- Resume path C describes the UI-side option
- [tools/handbook-ingest/ingest/sections_compare.py](../../../tools/handbook-ingest/ingest/sections_compare.py) -- aggregation primitives
- [docs/work-packages/hangar-users-editing/spec.md](../hangar-users-editing/spec.md) -- the dual-gate pattern hangar admin writes follow
