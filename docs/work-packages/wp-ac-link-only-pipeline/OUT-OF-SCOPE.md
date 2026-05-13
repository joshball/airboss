---
title: 'Out of Scope: WP-AC-LINK-ONLY -- link-only stubs for the 12 link-only AC cards'
product: course
feature: wp-ac-link-only-pipeline
type: out-of-scope
status: unread
---

# Out of Scope: WP-AC-LINK-ONLY -- link-only stubs for the 12 link-only AC cards

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) plus the surrounding Wave 6 framing (the WP shipped stage-1 stubs only; the original full-pipeline ambition moved to WP-AC-FULL).

## Summary

| Item                                                             | Status       | Trigger to revisit                                                                 |
| ---------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| Promoting the existing 9 ACs from whole-doc to section-tree      | Follow-on WP | Already triggered -- covered by WP-AC-PROMOTE                                      |
| Discovery of additional ACs beyond these 12                      | Follow-on WP | When the AC corpus needs to expand past the YAML-listed 21 (covered by WP-AC-FULL) |
| AC 61-27 ingest (superseded by FAA-H-8083-15)                    | Rejected     | Never -- superseded; cite FAA-H-8083-15 instead. Keep link-only card if needed.    |
| Body extraction + section-tree for the 12 link-only ACs (Wave 8) | Follow-on WP | When WP-AC-FULL Wave 8 is reopened per `REFERENCES_ROADMAP.md`                     |

## Promoting the existing 9 ACs from whole-doc to section-tree

Status: Follow-on WP

What was postponed:
Re-extraction of the 9 ACs already seeded by WP-AC (PR #480) from whole-doc shape (one `reference_section` per AC at depth 0) into section-tree shape (multi-row tree with chapter / paragraph rows). The promotion is a separate effort because the 12 link-only ACs in this WP are a different cohort -- they have no manifests at all, so the work is "ingest from zero," not "re-shape existing rows."

Why:
Per [spec.md](./spec.md) Out of scope line 1: the 9 already-seeded ACs and the 12 link-only ACs are two distinct cohorts with distinct work. Bundling them would conflate "first-time ingest" with "re-shape existing." Splitting keeps each WP small and avoids cross-cohort coordination.

Trigger that fires the follow-on:
Already fired. Tracked at [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) (Wave 4 cleanup, depends on the 5 handbook section-tree promotions landing first).

Implementation pattern when triggered:
See [WP-AC-PROMOTE spec.md](../wp-ac-promote-to-section-tree/spec.md) Phase 1-5: per-AC strategy decision (embedded TOC / printed TOC / TOC-file parser / flat fallback), seeder branching on `sections.length`, idempotent re-extraction. Mirror handbook precedents documented in [docs/.archive/work-packages/2026-05/whole-doc-promotion/research.md](../../.archive/work-packages/2026-05/whole-doc-promotion/research.md).

References:

- [spec.md](./spec.md) -- Out of scope, item 1
- [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) -- the follow-on WP

## Discovery of additional ACs beyond these 12

Status: Follow-on WP

What was postponed:
Expanding the cached AC corpus past the 21 AC YAML rows (9 from WP-AC + 12 from this WP). The FAA publishes hundreds of Advisory Circulars; the YAML and cache cover only those flagged as relevant for the active courses. A separate WP-AC-FULL spec exists that scopes expansion to roughly 50 ACs.

Why:
Per [spec.md](./spec.md) Out of scope line 2: discovery is a content-curation question (which ACs warrant cards?), not a pipeline question (how does an ingest run?). The pipeline is what this WP ships; expansion picks the next batch using the proven pipeline.

Trigger that fires the follow-on:
When the AC corpus needs to expand. Concretely: when a course author requests an AC not yet in the YAML, OR when a knowledge node cites an AC that should resolve to a readable card, OR when REFERENCES_ROADMAP.md flags AC coverage as a gap.

Implementation pattern when triggered:
Reuse this WP's pipeline (Phases 1-6 in [spec.md](./spec.md)): add YAML rows, source URLs in `scripts/sources/config/ac.yaml`, download via `bun run sources download --only ac`, extract section-tree per the per-AC strategy decision, register, reseed. The WP-AC-FULL spec exists as the design target for this expansion.

References:

- [spec.md](./spec.md) -- Out of scope, item 2
- The shared WP-AC-FULL design target (referenced in spec.md's framing block)

## AC 61-27 ingest (superseded by FAA-H-8083-15)

Status: Rejected

What was rejected:
Ingesting AC 61-27 (the original Instrument Flying Handbook AC) as a readable section-tree card. AC 61-27 has been superseded by FAA-H-8083-15; the spec's Decision section recommends dropping the YAML card entirely and rewriting any citation pointing at AC 61-27 to reference FAA-H-8083-15 instead.

Why (Never -- see detail below):
Per [spec.md](./spec.md) Decisions -> "AC 61-27 -- superseded; ingest or drop?": ingesting a superseded document into the readable corpus would actively mislead learners. Citations pointing at AC 61-27 are stale and should be cleaned up to reference FAA-H-8083-15. The recommendation in the spec is option (b) -- drop. The only acceptable retention path is link-only (regulatory-historical reference); ingestion is rejected outright.

Trigger to revisit:
Never. A re-decision would have to clear a high bar: a regulatory-historical use case where the superseded text is materially different from FAA-H-8083-15 AND the difference matters pedagogically. If that case appears, treat it as a separate WP with explicit re-justification.

References:

- [spec.md](./spec.md) Decisions -> AC 61-27 question
- FAA-H-8083-15 (Instrument Flying Handbook) -- the active replacement

## Body extraction + section-tree for the 12 link-only ACs (Wave 8)

Status: Follow-on WP

What was postponed:
The original Wave 6 ambition for this WP was the full download -> extract -> register -> seed pipeline for the 12 link-only ACs, landing them as readable section-tree cards. That ambition was deliberately scoped down to "stage-1 stubs only" -- the WP shipped FAA Document Library PDF URLs in the YAML so chips and library cards deep-link directly to the source PDF, but did not extract bodies or build section trees. Body extraction + section-tree for the 12 ACs moves to WP-AC-FULL (Wave 8 deferred per `REFERENCES_ROADMAP.md`).

Why:
Per [spec.md](./spec.md) Wave 6 framing block: shipping the cheap stubs first unblocks chips and library cards immediately (the user-visible win) while deferring the heavier extraction work to a separate WP. The stage-1 / stage-2 split keeps both efforts small and avoids the failure mode where the heavier work blocks the cheaper win.

Trigger that fires the follow-on:
When WP-AC-FULL Wave 8 is reopened per `REFERENCES_ROADMAP.md`. Concretely: when `docs/platform/REFERENCES_ROADMAP.md` (or the successor sequencing doc) marks AC body extraction as the next priority, OR when course content authoring depends on AC chapter / paragraph drill-down for the 12 currently-stub-only cards.

Implementation pattern when triggered:
Resume the original Phase 1-6 pipeline preserved in [spec.md](./spec.md) below the framing block: add per-AC source URLs to `scripts/sources/config/ac.yaml`, run `bun run sources download --only ac`, decide per-AC extraction strategy (embedded TOC / printed TOC / flat single-page-per-section per the spec's "Section-tree vs whole-doc" Decision), run `bun run sources register ac`, reseed, verify, doc updates. The pipeline mirrors WP-AC + WP-AC-PROMOTE patterns.

References:

- [spec.md](./spec.md) -- Wave 6 framing block + the preserved Phase 1-6 ambition
- `docs/platform/REFERENCES_ROADMAP.md` -- the sequencing source of truth
- [WP-AC-PROMOTE](../wp-ac-promote-to-section-tree/spec.md) -- pattern for section-tree extraction
