---
title: 'Out of Scope: Reference System Core'
product: platform
feature: reference-system-core
type: out-of-scope
status: unread
---

# Out of Scope: Reference System Core

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of Scope" section of [spec.md](./spec.md) (lines 44-51) and the bottom-of-file "Open Items -- Still open, not blocking this package (belong to follow-on packages)" subsection (lines 180-184). This WP is the platform substrate for the post-pivot reference system: a new `libs/aviation/` workspace with the `Reference` type, the 5-axis tags taxonomy, the wiki-link parser, the `/glossary` route, and the 175 ported entries from airboss-firc retagged under the new system.

The deferrals here are the boundaries this WP drew between "build the substrate + first content set" and "everything that ingests source documents, mirrors the substrate for help content, or layers more axes on top." Several items are explicit references to dedicated follow-on WPs (`wp-reference-extraction-pipeline`, `wp-help-library`); others are concrete content-domain items (FIRC carrier-metaphor vocabulary) and tagging-axis open questions that don't block the substrate ship.

## Summary

| Item                                                                              | Status       | Trigger to revisit                                                                                    |
| --------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Source extraction pipeline (CFR / AIM / POH parsers, `data/sources/`, refresh)    | Follow-on WP | When `wp-reference-extraction-pipeline` is in flight                                                  |
| Help library (`libs/help/`, `/help`, per-app help registration, search widget)    | Follow-on WP | When `wp-help-library` is in flight                                                                   |
| Materialized `cfr-generated.ts` / `aim-generated.ts` / `poh-generated.ts`         | Follow-on WP | When the extraction pipeline emits them (`wp-reference-extraction-pipeline`)                          |
| NTSB / AOPA / PCG / AC / FAA-Safety parsers (Phase 6 + 8 of architecture roadmap) | Deferred     | When a learner / lesson author cites a source from one of these corpora                               |
| Knowledge-graph phase content authoring                                           | Follow-on WP | When the knowledge-graph authoring workflow WP is in flight                                           |
| Carrier-metaphor / FIRC-specific vocabulary (Trap, Bolter, Greenie Board, etc.)   | Rejected     | Never -- belongs to the future `apps/firc/` surface if FIRC returns at all                            |
| ACS task codes axis (separate axis vs freeform keywords)                          | Deferred     | When ACS mapping work begins                                                                          |
| `governance` as an `aviationTopic` value for organization entries (FAA, ICAO)     | Deferred     | When the current `knowledgeKind: reference` + `sourceType: authored` shape proves awkward in practice |
| `data/sources/` size-by-source decision                                           | Follow-on WP | When `wp-reference-extraction-pipeline` chooses the storage layout                                    |

## Source extraction pipeline (CFR / AIM / POH parsers, `data/sources/`, refresh)

Status: Follow-on WP

What was postponed:
The CFR XML parser, AIM PDF parser, POH parser, the `data/sources/` corpus layout, `scripts/references/build.ts`, `scripts/references/extract.ts`, and the yearly refresh tooling. The `Source` / `SourceCitation` / `VerbatimBlock` types live in this WP (so the substrate compiles); the parsers that produce `VerbatimBlock` instances land in the follow-on.

Why:
Per [spec.md](./spec.md) Out of Scope: source extraction has its own review surface (parser correctness against the upstream document format, normalization rules, edition diffing) and its own cadence (yearly refresh, per-corpus). Bundling extraction into the substrate WP would conflate "build the type system + UI + first 175 entries" with "stand up a multi-corpus document-ingestion pipeline."

Trigger that fires the follow-on:
The `wp-reference-extraction-pipeline` WP is in flight. As of 2026-05-10, ADR 019 ships a different reference-system architecture (the `airboss-ref:` URI scheme + `libs/sources/` registry + per-corpus phases shipped in PRs #241, #246, #247, #249, #250). The follow-on may now live there rather than in the original `wp-reference-extraction-pipeline` slot; surface the divergence for a decision when the trigger fires rather than re-litigating it here.

Implementation pattern when triggered:
The follow-on WP adds a new `libs/sources/src/<corpus>/` directory per corpus (the pattern `reference-cfr-ingestion-bulk` shipped in PR #247 is the canonical example): an XML/PDF walker, a normalizer, per-edition derivative tree under `data/<corpus>/<edition>/`, and a `CorpusResolver` registration. The substrate's `Source` / `SourceCitation` / `VerbatimBlock` types are the contract the follow-on populates.

References:

- [spec.md](./spec.md) Out of Scope -- "Source extraction pipeline"
- [reference-cfr-ingestion-bulk/](../reference-cfr-ingestion-bulk/) (the ADR-019-era analogue that shipped)
- [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md) (the original architecture doc this WP signed off against)

## Help library (`libs/help/`, `/help`, per-app help registration, search widget)

Status: Follow-on WP

What was postponed:
The `libs/help/` workspace, the `/help` route, the per-app help-content registration mechanism, and the cross-library faceted-search widget. The `/glossary` search in this WP is aviation-only; the cross-library widget is a separate primitive.

Why:
Per [spec.md](./spec.md) Out of Scope: help content has different concerns from aviation references (plain-language docs, per-app registration, drawer / inline-tooltip surfaces) and benefits from mirroring the tag taxonomy this WP establishes rather than co-living in `libs/aviation/`.

Trigger that fires the follow-on:
The `wp-help-library` WP is in flight. As of 2026-05-10, `libs/help/` exists in the monorepo (per CLAUDE.md), so the follow-on may have already shipped under a different WP slug; surface the divergence and update this OUT-OF-SCOPE entry when the trigger fires.

Implementation pattern when triggered:
Mirror this WP's tag taxonomy + faceted-search primitives in `libs/help/src/`. The components (`HelpFilter`, `HelpCard`, `HelpSidebar`) are help-side analogues of the `Reference*` components shipped here. The cross-library search widget composes both libraries' indexes.

References:

- [spec.md](./spec.md) Out of Scope -- "`libs/help/` workspace"
- [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md) (mirroring guidance)

## Materialized `cfr-generated.ts` / `aim-generated.ts` / `poh-generated.ts`

Status: Follow-on WP

What was postponed:
The materialized per-corpus generated reference files (`cfr-generated.ts`, `aim-generated.ts`, `poh-generated.ts`). These are outputs of the extraction pipeline; this WP ships only the hand-authored `aviation.ts` (175 ported entries).

Why:
Per [spec.md](./spec.md) Out of Scope: generated files require the extraction pipeline to produce them. Authoring placeholder generated files in this WP would create a phantom "complete" surface that hides the actual gap (no extraction pipeline yet).

Trigger that fires the follow-on:
The extraction pipeline (or the ADR 019 corpus ingestion phases that supersede it) emits these files. As of 2026-05-10, ADR 019's `libs/sources/src/regs/`, `libs/sources/src/handbooks/`, etc. are the analogous output paths under the post-pivot architecture.

Implementation pattern when triggered:
The extraction pipeline writes per-corpus reference files. Each generated file appends to the registry's `byId` map alongside the hand-authored `aviation.ts` entries; the validator gates ensure no duplicate IDs.

References:

- [spec.md](./spec.md) Out of Scope -- "Materialized `cfr-generated.ts`..."
- [reference-cfr-ingestion-bulk/](../reference-cfr-ingestion-bulk/) (post-pivot analogue)

## NTSB / AOPA / PCG / AC / FAA-Safety parsers

Status: Deferred

What was deferred:
Parsers for less-cited corpora -- NTSB accident reports, AOPA articles, the Pilot/Controller Glossary (PCG), Advisory Circulars (AC), FAA Safety briefings. Phase 6 + 8 of the original architecture roadmap; the substrate type system supports them, the parsers are not in this WP.

Why:
Per [spec.md](./spec.md) Out of Scope: these are later packages in the original architecture roadmap. The substrate ships first; parsers ship per-corpus when there's a learner / lesson author cite that needs the corpus.

Trigger to revisit:
A learner or lesson author cites a source from one of these corpora. The validator surfaces the gap; the operator authors the per-corpus parser (or, post-ADR-019, the per-corpus `CorpusResolver` registration).

Implementation pattern when triggered:
Per-corpus parser/resolver. AC has its own ADR-019-era WP slot (`reference-ac-ingestion`, currently a Phase 8 placeholder). PCG, NTSB, AOPA each get a new corpus enumeration in ADR 019 §1.2 + a resolver registration. The pattern is `reference-cfr-ingestion-bulk` (PR #247) and `reference-handbook-ingestion`.

References:

- [spec.md](./spec.md) Out of Scope -- "NTSB, AOPA, PCG, AC, FAA-Safety parsers"
- [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md) Phase 6 + 8 of the roadmap

## Knowledge-graph phase content authoring

Status: Follow-on WP

What was postponed:
The phase content authoring workflow for the knowledge graph. Phase content consumes `@ab/aviation` (specifically `ReferenceText` and the wiki-link syntax); the authoring workflow that produces phase content is its own package.

Why:
Per [spec.md](./spec.md) Out of Scope: this WP ships the substrate the phase content consumes, not the phase content itself or the authoring workflow that produces it.

Trigger that fires the follow-on:
The knowledge-graph authoring workflow WP is in flight (per ADR 011 -- knowledge graph learning system).

Implementation pattern when triggered:
The phase content authoring WP defines the per-phase content shape (markdown sections, embedded `[[DISPLAY::id]]` wiki-links, citation requirements). Authors write phase content; the substrate's wiki-link parser validates references at build time.

References:

- [spec.md](./spec.md) Out of Scope -- "Knowledge-graph phase content authoring"
- [docs/decisions/011-knowledge-graph-learning-system/decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md)

## Carrier-metaphor / FIRC-specific vocabulary (Trap, Bolter, Greenie Board, etc.)

Status: Rejected

What was rejected:
The carrier-metaphor feature names and FIRC-specific vocabulary (Trap, Bolter, Greenie Board, etc.) from the old airboss-firc `VOCABULARY.md`. These do not port into the post-pivot `aviation.ts` registry.

Why:
Per [spec.md](./spec.md) Out of Scope and the glossary port plan: the post-pivot platform is broader than FIRC (per [PIVOT.md](../../platform/PIVOT.md)) and the carrier metaphor is a FIRC-product brand choice, not a piece of aviation knowledge. Mixing brand vocabulary into the aviation glossary would dilute the glossary's job (be a registry of aviation knowledge that any product surface cites).

A re-decision would have to clear: the FIRC product surface returns (`apps/firc/` is created per the multi-product architecture) AND the carrier metaphor is the chosen brand language for that surface AND there's a real need to surface those terms in the cross-product glossary rather than only inside `apps/firc/`. Even then, the better answer is likely a per-product vocabulary that doesn't land in `@ab/aviation`.

References:

- [spec.md](./spec.md) Out of Scope -- "Carrier-metaphor feature names and FIRC-specific vocabulary"
- [docs/work/todos/20260422-glossary-port-plan.md](../../work/todos/20260422-glossary-port-plan.md)
- [docs/platform/PIVOT.md](../../platform/PIVOT.md) (post-pivot framing)
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) (`apps/firc/` future surface)

## ACS task codes axis (separate axis vs freeform keywords)

Status: Deferred

What was deferred:
A first-class `acsTaskCodes` axis on `ReferenceTags` (vs the current pattern of stuffing ACS codes into freeform `keywords`). The substrate's tag taxonomy ships without an ACS axis.

Why:
Per [spec.md](./spec.md) Open Items: the ACS-mapping shape (single code per reference, multi-code, hierarchical area-of-operation mapping) is undecided. Adding the axis before the shape is settled would lock in a guess.

Trigger to revisit:
ACS mapping work begins. Concrete signal: a WP authors the certs / syllabus surface that needs to query references by ACS task code (e.g., "show me every reference for ACS PA.III.B.K1").

Implementation pattern when triggered:
Add `acsTaskCodes?: readonly AcsTaskCode[]` to `ReferenceTags` (the axis is conditional, not required). Author the `AcsTaskCode` enum from the published ACS area-of-operation/task structure. Migrate any references that currently encode ACS codes via freeform `keywords` into the new axis. Add a validator gate to reject ACS codes in `keywords` going forward.

References:

- [spec.md](./spec.md) Open Items -- "ACS task codes"
- [docs/work/todos/20260422-tagging-architecture-research.md](../../work/todos/20260422-tagging-architecture-research.md)

## `governance` as an `aviationTopic` value for organization entries (FAA, ICAO)

Status: Deferred

What was deferred:
A `governance` enum value on the `aviationTopic` axis for organization entries (FAA, ICAO, EASA). Current entries use `knowledgeKind: reference` + `sourceType: authored`; this works but may be awkward in practice when the glossary is filtered or queried.

Why:
Per [spec.md](./spec.md) Open Items: the current shape works for the 175 entries shipped; whether it's awkward is empirical and depends on real glossary use. Premature axis-extension based on a hypothetical awkwardness would lock in a guess.

Trigger to revisit:
The current `knowledgeKind: reference` + `sourceType: authored` shape proves awkward in practice -- e.g., the operator finds that organization entries don't filter cleanly under any existing axis, or a faceted-search use case can't express "show me every organization governance reference" without contortion.

Implementation pattern when triggered:
Add `governance` to the `aviationTopic` enum. Re-tag existing organization entries (FAA, ICAO, EASA, etc.) to set `aviationTopic[0] = 'governance'`. Update the validator gate's enum check.

References:

- [spec.md](./spec.md) Open Items -- "`governance` as an `aviationTopic` value"

## `data/sources/` size-by-source decision

Status: Follow-on WP

What was postponed:
The decision about how `data/sources/` is laid out per source -- single-file vs per-section, JSON vs markdown derivatives, edition versioning shape. The substrate's `Source` / `SourceCitation` types do not encode the storage layout.

Why:
Per [spec.md](./spec.md) Open Items: the layout is owned by the extraction pipeline package because the layout is shaped by extraction concerns (per-source parser output shape, derivative size, refresh granularity). Pre-deciding it in the substrate WP would constrain the pipeline.

Trigger that fires the follow-on:
The extraction pipeline WP (or the ADR-019-era equivalent) chooses the storage layout. As of 2026-05-10, the post-pivot answer per ADR 018 is "developer-local cache for source bytes; extracted derivatives committed inline" -- so the deferred decision may have effectively been answered downstream; surface the divergence and resolve when the trigger fires.

Implementation pattern when triggered:
The extraction pipeline WP picks per-corpus layout per ADR 018 (source bytes in `~/Documents/airboss-handbook-cache/` by default, derivatives at `handbooks/<doc>/<edition>/manifest.json` style for handbooks, `regs/<title>/<part>/sections.json` style for regs).

References:

- [spec.md](./spec.md) Open Items -- "`data/sources/` size-by-source decision"
- [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md)
- [docs/platform/STORAGE.md](../../platform/STORAGE.md)
