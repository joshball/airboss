---
title: "Out of Scope: WP-MTN -- Tips on Mountain Flying pamphlet ingestion"
product: course
feature: wp-mtn-mountain-flying
type: out-of-scope
status: unread
---

# Out of Scope: WP-MTN -- Tips on Mountain Flying pamphlet ingestion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The sources are the "Out of scope" section + the "Surfaced bug -- separate follow-up" block in [spec.md](./spec.md), plus the "Out of scope" line in [test-plan.md](./test-plan.md).

## Summary

| Item                                                            | Status       | Trigger to revisit                                                                       |
| --------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Section-tree extraction for the pamphlet                        | Rejected     | Never -- see detail below                                                                |
| Figure / table extraction                                       | Rejected     | Never -- see detail below                                                                |
| Citation deep-links into the pamphlet                           | Rejected     | Never -- see detail below                                                                |
| `pamphlet` as a new `REFERENCE_KIND`                            | Deferred     | When 3+ non-handbook pamphlets are queued for ingest                                     |
| `handbooks-extras register` preserving authored manifest fields | Follow-on WP | Surfaced by WP-MTN; lands in its own WP (preserve-or-author `subjects` + `primary_cert`) |
| E2E test for the new `/library` card                            | Deferred     | When a stable e2e fixture for new-corpus card adds exists                                |

## Section-tree extraction for the pamphlet

Status: Rejected

What was rejected:
Producing a chapter / section / subsection tree for the *Tips on Mountain Flying* pamphlet. The pamphlet ships as a single `reference_section` row at depth 0, level `document`, with `content_md` holding the entire body (the `kind: whole-doc` manifest path).

Why:
Per [spec.md](./spec.md) "Out of scope" line 1 and the WP "Decisions" block: the pamphlet is `kind: whole-doc`, reusing the post-WP-SUB whole-doc seed adapter at [libs/bc/study/src/seeders/whole-doc.ts](../../../libs/bc/study/src/seeders/whole-doc.ts). The pamphlet is ~40 pages, has no chapter numbering grammar, and no internal cross-references -- there is no section-tree to extract. The whole-doc shape is the right shape; promoting it to section-tree later would mean re-authoring a tree that doesn't exist in the source.

Trigger to revisit:
Never. The pamphlet's structure does not warrant a section-tree. If a future revision of the pamphlet adopts numbered sections, that would spawn a new ingest WP (mirror WP-AIH-style section-tree promotion), not retroactive scope creep here.

References:

- [spec.md](./spec.md) -- "Out of scope" line 1, "Decisions" block
- [libs/bc/study/src/seeders/whole-doc.ts](../../../libs/bc/study/src/seeders/whole-doc.ts) -- the whole-doc seed adapter
- [docs/work-packages/library-completeness/spec.md §4.F](../library-completeness/spec.md) -- "treat as handbooks/<slug>, smallest possible win"

## Figure / table extraction

Status: Rejected

What was rejected:
Custom figure or table extraction for the *Tips on Mountain Flying* pamphlet beyond what the shared `extract handbooks` pipeline produces for the whole-doc shape.

Why:
Per [spec.md](./spec.md) "Out of scope" line 2: the pamphlet is whole-doc, and the whole-doc shape does not author per-figure or per-table rows. The pamphlet's diagrams are illustrative (mountain wave schematics, downdraft sketches) and the entire content_md is captured as a single body; figure handling for whole-doc references would add maintenance surface for marginal reading benefit.

Trigger to revisit:
Never. If a future content effort needs a specific MTN figure rendered with custom logic, that is a per-figure decision and a one-off extension of the shared pipeline, not a per-pamphlet fork.

References:

- [spec.md](./spec.md) -- "Out of scope" line 2
- The shared `extract handbooks` pipeline (governs figure / table behavior across whole-doc references uniformly)

## Citation deep-links into the pamphlet

Status: Rejected

What was rejected:
Deep-linkable citation URIs into the pamphlet (URIs targeting an internal anchor like a chapter, section, or paragraph).

Why:
Per [spec.md](./spec.md) "Out of scope" line 3: the pamphlet has no internal citation grammar. There are no section numbers, paragraph numbers, or numbered figures to anchor a citation against. The pamphlet is referenced as a whole-doc; the `/library` card opens the entire body. Inventing a synthetic anchor scheme (page numbers, header text) would be brittle and inconsistent with the rest of the citation grammar across the handbooks corpus.

Trigger to revisit:
Never. The decision is structural: the source does not carry citation anchors. If a future revision adds numbered sections, citation deep-links become possible -- but that's a property of the new source shape, not a retro-fit on this whole-doc manifest.

References:

- [spec.md](./spec.md) -- "Out of scope" line 3
- The citation grammar pattern: [docs/ingestion-pipeline/reference-citations-pattern.md](../../ingestion-pipeline/reference-citations-pattern.md)

## `pamphlet` as a new `REFERENCE_KIND`

Status: Deferred

What was deferred:
Adding `pamphlet` as a distinct member of `REFERENCE_KINDS` (currently the pamphlet is filed under `kind: handbook` with corpus `handbooks` and slug `tips-mountain-flying`).

Why:
Per [spec.md](./spec.md) "Out of scope" line 4 and the "Decisions" block: "deferred; revisit if/when we ship 3+ non-handbook pamphlets." The library-completeness spec at §4.F also recommended `handbooks/` for the single-doc case to avoid premature kind proliferation. With one pamphlet in the corpus, a dedicated `pamphlet` kind would carry no validation or rendering distinction from `handbook` + `kind: whole-doc`. The cost of the kind is non-zero (`REFERENCE_KIND` enum update, Zod validator branch, `/library` filter facet, citation URI grammar), and the benefit only materializes once the corpus has enough pamphlets to justify a separate facet.

Trigger to revisit:
When 3+ non-handbook pamphlets are queued for ingest (the threshold called out explicitly in the spec). Examples of candidate pamphlets: FAA *Pilots Handbook of Aeronautical Knowledge* errata supplements, FAA airport advisory pamphlets, NTSB safety alerts that ship as standalone documents.

Implementation pattern when triggered:
Add `pamphlet` to `REFERENCE_KIND` in [libs/constants/src/references.ts](../../../libs/constants/src/references.ts) (or wherever the enum lives post-WP-SUB). Re-classify the existing tips-mountain-flying row from `kind: handbook` to `kind: pamphlet` as part of the same WP that adds the second pamphlet. Mirror the handbook ingest pattern but skip handbook-specific affordances (chapter index, edition letter regex). The library-completeness spec §4.F and the post-WP-SUB whole-doc seed adapter ([libs/bc/study/src/seeders/whole-doc.ts](../../../libs/bc/study/src/seeders/whole-doc.ts)) are the templates.

References:

- [spec.md](./spec.md) -- "Out of scope" line 4, "Decisions" block (Corpus + Manifest shape)
- [docs/work-packages/library-completeness/spec.md §4.F](../library-completeness/spec.md) -- pipeline recommendation
- `project_library_subject_cap_revisit.md` -- the cap-of-3 subjects convention referenced in the WP author-time decisions

## `handbooks-extras register` preserving authored manifest fields

Status: Follow-on WP

What was postponed:
Teaching the `handbooks-extras register` step to preserve (or author from a per-doc YAML config) the post-WP-SUB authored manifest fields `subjects` and `primary_cert` when it rewrites manifests. Today, register rewrites every produced manifest cleanly each run and strips those fields from existing on-disk manifests. WP-MTN reverted the 6 collateral manifest edits it triggered (risk-management, aviation-instructor, IFH, IPH, AMT-G, AMT-P) and committed only the new tips-mountain-flying derivative + the index update.

Why:
Per [spec.md](./spec.md) "Surfaced bug -- separate follow-up": the fix lands in its own WP to avoid scope creep on WP-MTN, and there are two reasonable shapes that need a per-WP decision (read-merge-write vs per-doc YAML authoring). Folding either fix into WP-MTN would mix substrate change with content add, and the spec deliberately keeps WP-MTN as "smallest possible win."

Trigger that fires the follow-on:
This is already a known follow-on; it just needs a WP authored. Two candidate shapes from the spec:

1. Teach the extras ingest to preserve `subjects` + `primary_cert` if they already exist in the on-disk manifest (read-merge-write).
2. Have the extras ingest author them from a per-doc YAML config (similar to how `seed-references.ts` reads `course/references/*.yaml` for non-handbook references).

Implementation pattern when triggered:
Path 2 is cleaner long-term; path 1 is a smaller patch. The WP author picks one based on whether more authored-only fields are anticipated. Anchor file: [libs/sources/src/handbooks-extras/ingest.ts](../../../libs/sources/src/handbooks-extras/ingest.ts). Reference pattern for path 2: `scripts/db/seed-references.ts` reading `course/references/*.yaml`.

References:

- [spec.md](./spec.md) -- "Surfaced bug -- separate follow-up"
- [libs/sources/src/handbooks-extras/ingest.ts](../../../libs/sources/src/handbooks-extras/ingest.ts) -- the extras ingest module
- `scripts/db/seed-references.ts` -- the reference pattern for per-doc YAML authoring

## E2E test for the new `/library` card

Status: Deferred

What was deferred:
A Playwright E2E test that exercises the new *Tips on Mountain Flying* card on `/library` (card visible, click-through renders the body, topic-spine cross-check).

Why:
Per [test-plan.md](./test-plan.md) "Out of scope": "Defer until we have a stable e2e fixture for new-corpus adds; not worth one-off plumbing for a single card." The current e2e suite does not have a generic new-corpus card fixture; spinning one up just for this card would couple the fixture to the pamphlet's slug and not amortize across the queue of upcoming corpus adds (NTSB rulings, FAA Chief Counsel interps, SAFOs, InFOs, Order 8900.1, AC catalog) listed in [library-completeness §4](../library-completeness/spec.md).

Trigger to revisit:
When a stable e2e fixture for new-corpus card adds exists. Concrete signal: the next library-completeness corpus add (e.g. NTSB rulings WP, AC catalog WP) authors a generalizable card-rendering fixture that the MTN card can be slotted into without bespoke plumbing.

Implementation pattern when triggered:
Add a fixture call to whatever shared spec lands the new-corpus card pattern (canonical location is `tests/e2e/` under a name like `library-new-corpus-card.spec.ts` if/when authored). Until then, the manual test plan in [test-plan.md](./test-plan.md) is the verification.

References:

- [test-plan.md](./test-plan.md) -- "Out of scope" line
- [docs/work-packages/library-completeness/spec.md §4](../library-completeness/spec.md) -- queue of upcoming corpus adds that would share the fixture
