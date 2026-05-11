---
title: 'Out of Scope: WP-AC -- Advisory Circulars as readable library cards'
product: course
feature: wp-ac
type: out-of-scope
status: unread
---

# Out of Scope: WP-AC -- Advisory Circulars as readable library cards

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md), [tasks.md](./tasks.md), and [test-plan.md](./test-plan.md), plus the surrounding decisions on manifest shape, section-level, and seed adapter.

## Summary

| Item                                                   | Status       | Trigger to revisit                                                                            |
| ------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------- |
| Section-level extraction of AC PDFs                    | Follow-on WP | When the user wants section-tree drill-down on the 9 whole-doc ACs (covered by WP-AC-PROMOTE) |
| Importing the 8 (now 12) ACs without on-disk manifests | Follow-on WP | When the link-only AC PDFs are downloaded + ingested (covered by WP-AC-LINK-ONLY)             |
| AC paragraph citation reverse-lookup                   | Deferred     | When citations need to deep-link into specific AC paragraphs / locators                       |
| Section-level navigation within an AC (test-plan)      | Follow-on WP | When AC chapter / paragraph rows exist (lands with WP-AC-PROMOTE)                             |

## Section-level extraction of AC PDFs

Status: Follow-on WP

What was postponed:
Per-paragraph or per-chapter extraction of AC PDFs. The Phase 8 ingest in `libs/sources/src/ac/ingest.ts` extracts each AC as a single whole-doc body file. The manifest's `sections: []` and `changes: []` arrays stay empty. The seed adapter (`libs/bc/study/src/seeders/ac.ts`) writes exactly ONE `reference_section` row per AC at depth 0, level `'circular'`.

Why:
Per [spec.md](./spec.md) Decisions 2 and 4: the WP's contract is "9 ACs land as readable single-section references." Adding chapter / paragraph extraction would require per-AC TOC analysis, multi-level section schema, and a different seed adapter shape. That work is large enough to deserve its own WP rather than expand WP-AC's scope.

Trigger that fires the follow-on:
When the user wants section-tree drill-down on the 9 whole-doc ACs. This trigger has already fired and is being addressed by [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md).

Implementation pattern when triggered:
Mirror the handbook section-tree promotion patterns documented in [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md). Strategies: embedded TOC via `fitz.get_toc()`, printed TOC parse, hand-written TOC file, or flat single-section fallback for short ACs. The seeder branches on `sections.length === 0` (whole-doc behavior preserved) vs `sections.length > 0` (new section-tree behavior). See [WP-AC-PROMOTE spec.md](../wp-ac-promote-to-section-tree/spec.md) Phase 2.

References:

- [spec.md](./spec.md) -- the "Out of scope" line for section-level extraction
- [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) -- the follow-on WP
- [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md) -- handbook precedent

## Importing the 8 (now 12) ACs without on-disk manifests

Status: Follow-on WP

What was postponed:
Downloading + ingesting the AC PDFs that have YAML rows but no on-disk manifest. WP-AC ships 9 readable + 12 link-only (the spec text says 8; the YAML backfill in Decision 6 lifts it to 12 link-only after the corrections). Those link-only cards stay link-only until their PDFs are fetched, the manifests are written, and the seed mapping registry gains entries for them.

Why:
Per [spec.md](./spec.md) Decision 4 + 5 + 6: the WP's contract is "9 readable today; the rest stay link-only." Importing the missing PDFs requires per-AC source URLs in `scripts/sources/config/ac.yaml`, a download pass, an extraction pass, manifest writes, and seed-mapping registry updates -- each is a small but real piece of work that doesn't share scope with the manifest-shape + adapter work in WP-AC.

Trigger that fires the follow-on:
When the link-only AC PDFs are downloaded + ingested. This trigger has already fired and is being addressed by [WP-AC-LINK-ONLY](../wp-ac-link-only-pipeline/spec.md).

Implementation pattern when triggered:
Mirror the WP-AC pipeline (Phases 1-6 in WP-AC-LINK-ONLY's [spec.md](../wp-ac-link-only-pipeline/spec.md)): add entries to `scripts/sources/config/ac.yaml`, run `bun run sources download --only ac`, extract per-AC (use section-tree shape per the user's "no more whole-docs" direction), run `bun run sources register ac`, reseed, verify. The seed-mapping registry at `libs/sources/src/ac/seed-mapping.ts` gains one entry per newly-ingested AC.

References:

- [spec.md](./spec.md) -- the "Out of scope" line for importing the missing ACs
- [WP-AC-LINK-ONLY](../wp-ac-link-only-pipeline/spec.md) -- the follow-on WP
- `libs/sources/src/ac/seed-mapping.ts` -- the registry that grows with each ingest

## AC paragraph citation reverse-lookup

Status: Deferred

What was deferred:
Locator-level citation filtering for AC paragraphs. The citation BC already has an `ac` kind, so chips and references can point at an AC document. What's missing is the reverse-lookup that resolves an in-text paragraph reference (e.g., "AC 61-98D 5.3") back to a specific section row and surfaces it on `/library/handbook/ac-61-98/5.3` (or equivalent route).

Why:
Per [spec.md](./spec.md) Out of scope line 3: "the citation BC already has an `ac` kind; locator-level filtering happens in a separate pass." Without per-paragraph section rows (which require section-level extraction -- the first item above), there's nothing to filter against. The two are gated on the same upstream work.

Trigger to revisit:
When citations need to deep-link into specific AC paragraphs / locators. Concretely: when a knowledge node or course step uses `cite('ac', 'ac-61-98', '5.3')` and the rendered chip should resolve to the matching section row, not the AC's whole-doc landing.

Implementation pattern when triggered:
Wait for WP-AC-PROMOTE (or a successor) to land the section rows for each AC. Once the section rows exist, extend the citation BC's `ac` resolver (likely in `libs/bc/study/src/citations/` -- see existing handbook resolvers for the pattern) to filter by `code` against the AC's `reference_section` rows. Mirror the FAR / handbook locator resolution code paths.

References:

- [spec.md](./spec.md) -- the "Out of scope" line for AC paragraph citation reverse-lookup
- The citation BC's `ac` kind (already shipped at WP-AC merge time)
- [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) -- the prerequisite that lands the section rows

## Section-level navigation within an AC (test-plan)

Status: Follow-on WP

What was postponed:
A `/library/<ac-slug>` reader UI that surfaces in-document chapter / paragraph navigation. The test-plan explicitly lists "Section-level navigation within an AC (no chapter / paragraph rows yet)" as out of scope, because the WP's adapter writes one row per AC and the reader has nothing to navigate to within that single row.

Why:
Per [test-plan.md](./test-plan.md) Out of scope: the navigation is downstream of the section rows. With one whole-doc row per AC, there's no in-document tree to render. The reader spot-check confirms the body renders end-to-end as a single document; chapter drill-down is not part of WP-AC's contract.

Trigger that fires the follow-on:
When AC chapter / paragraph rows exist. This trigger lands with [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md), which writes multi-row section trees per AC and unlocks the in-document navigation UI.

Implementation pattern when triggered:
Reuse the handbook reader's section-tree navigation (the same component renders FAA-H-8083-25 chapter drill-down today). The AC reader is a thin variant: same `RenderedSection` primitive, same nav tree, AC-specific chrome only if WP-AC's `level: 'circular'` label drives a different header. See `libs/library/` for the rendering primitives.

References:

- [test-plan.md](./test-plan.md) -- Out of scope, item 1
- [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) -- the follow-on WP that lands the section rows
- `libs/library/` -- shared reader primitives
