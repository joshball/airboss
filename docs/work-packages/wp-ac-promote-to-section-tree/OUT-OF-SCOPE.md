---
title: 'Out of Scope: WP-AC-PROMOTE -- promote 9 existing ACs to section-tree'
product: course
feature: wp-ac-promote-to-section-tree
type: out-of-scope
status: unread
---

# Out of Scope: WP-AC-PROMOTE -- promote 9 existing ACs to section-tree

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) plus the surrounding per-AC strategy notes (specifically the AC 25-7D depth question).

## Summary

| Item                                                                     | Status       | Trigger to revisit                                                                     |
| ------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------- |
| The 12 link-only AC cards                                                | Follow-on WP | Already triggered -- covered by WP-AC-LINK-ONLY                                        |
| Removing `kind: 'whole-doc'` from manifest schema                        | Follow-on WP | When the handbooks-extras corpus is empty (covered by WP-EXTRAS-RETIRE)                |
| Deep section-tree for AC 25-7D (transport-category cert engineering doc) | Deferred     | When AC 25-7D earns pilot-facing course coverage that needs paragraph-level drill-down |

## The 12 link-only AC cards

Status: Follow-on WP

What was postponed:
Ingesting + section-tree extraction for the 12 link-only Advisory Circulars that have YAML rows but no on-disk manifest. WP-AC-PROMOTE only works on the 9 ACs that already shipped via WP-AC (#480) as whole-doc references; the link-only cards are a different cohort with different work (first-time ingest vs re-shape existing).

Why:
Per [spec.md](./spec.md) Out of scope line 1: keeping the two cohorts in separate WPs avoids conflating "ingest from zero" with "promote in place." Each WP stays small; each cohort gets its own per-AC extraction strategy decision.

Trigger that fires the follow-on:
Already fired. Tracked at [WP-AC-LINK-ONLY](../wp-ac-link-only-pipeline/spec.md) (Wave 6 stage-1 stubs shipped 2026-05-03; the heavier body-extraction work moved to WP-AC-FULL Wave 8 per `REFERENCES_ROADMAP.md`).

Implementation pattern when triggered:
See [WP-AC-LINK-ONLY spec.md](../wp-ac-link-only-pipeline/spec.md) Phases 1-6 -- the same download -> extract -> register -> seed pipeline as WP-AC, with section-tree extraction by default per the user's "no more whole-docs" direction. Per-AC strategy choice (embedded TOC / printed TOC / flat) mirrors the same playbook used in this WP for the 9 existing ACs.

References:

- [spec.md](./spec.md) -- Out of scope, item 1
- [WP-AC-LINK-ONLY](../wp-ac-link-only-pipeline/spec.md) -- the follow-on WP

## Removing `kind: 'whole-doc'` from manifest schema

Status: Follow-on WP

What was postponed:
Deleting the `wholeDocManifestSchema` discriminated-union member from `libs/bc/study/src/manifest-validation.ts` (and the corresponding `seeders/whole-doc.ts` adapter). After WP-AC-PROMOTE, the AC corpus no longer uses whole-doc shape; the only remaining whole-doc consumers live in the handbooks-extras corpus.

Why:
Per [spec.md](./spec.md) Out of scope line 2: the schema deletion is gated on every whole-doc consumer being migrated. Removing the schema while handbooks-extras still ships whole-doc rows would break that corpus's seed pipeline. The retirement happens only after the schema has zero live consumers.

Trigger that fires the follow-on:
When the handbooks-extras corpus is empty (every whole-doc handbook-extra has been re-extracted into a section-tree shape or moved to a different corpus). Tracked as WP-EXTRAS-RETIRE per the spec.

Implementation pattern when triggered:
A small dedicated WP (WP-EXTRAS-RETIRE per [spec.md](./spec.md)). Steps: confirm zero `reference` rows with whole-doc-shaped manifests in the active seed; delete `wholeDocManifestSchema` from the discriminated union; delete `libs/bc/study/src/seeders/whole-doc.ts`; remove the whole-doc dispatcher case from `scripts/db/seed-references-from-manifest.ts`; regenerate `0000_initial.sql` if any DB-side enum values change; update tests. Schema cleanup is one step (no phases) per the airboss "no Drizzle migrations" rule.

References:

- [spec.md](./spec.md) -- Out of scope, item 2
- `libs/bc/study/src/manifest-validation.ts` -- the discriminated union
- `libs/bc/study/src/seeders/whole-doc.ts` -- the adapter to retire

## Deep section-tree for AC 25-7D (transport-category cert engineering doc)

Status: Deferred

What was deferred:
Paragraph-level (or chapter-level) section-tree extraction for AC 25-7D. Per [spec.md](./spec.md) "Per-AC strategy" -> "AC 25-7D (600 pages, transport-category cert) is the outlier -- engineering doc that may not be pilot-facing enough to warrant deep section parsing." The spec leaves it open whether to fully section-tree it or leave at chapter-only depth (or even flat single-section), to be decided per-AC during the WP.

Why:
Per [spec.md](./spec.md) Per-AC strategy block: AC 25-7D is the Flight Test Guide for Transport Category Airplanes -- not a typical pilot-facing reference. Its 600-page engineering depth doesn't repay deep section-tree investment for the current product surface (study + flightbag for GA pilots). A flat or chapter-only shape is sufficient until pilot-facing coverage of transport-category certification appears.

Trigger to revisit:
When AC 25-7D earns pilot-facing course coverage that needs paragraph-level drill-down. Concretely: when a course step or knowledge node cites an AC 25-7D paragraph and the citation chip should resolve to that paragraph's section row, OR when a transport-category-focused product (ATP, type rating, dispatcher) earns its own surface that surfaces the AC's deeper structure.

Implementation pattern when triggered:
Run the embedded-TOC strategy (`fitz.get_toc()`) if the PDF has rich bookmarks; otherwise the printed-TOC parse, mirroring handbook precedents in [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md). The seeder (already shipped per Phase 2) supports `sections.length > 0` with no schema change -- only the per-AC manifest changes. Re-seed is idempotent on `body_sha256`.

References:

- [spec.md](./spec.md) -- Per-AC strategy, AC 25-7D outlier note
- [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md) -- handbook section-tree precedents
