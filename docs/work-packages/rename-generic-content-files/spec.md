---
title: 'Spec: Rename generic content files (Option D)'
product: platform
feature: rename-generic-content-files
type: spec
status: unread
review_status: pending
---

# Spec: Rename generic content files (Option D)

This is a SPIKE-stage spec shell. The full spec is written from this once the analysis passes independent review and the user greenlights execution.

## Status

- Spike branch: `spike/rename-generic-content-files`
- Spike artifacts: [spike-results/](./spike-results/) (three sample chapters, before/after, with per-sample `_diff.md`)
- All open questions resolved in the analysis (see [analysis.md §8](./analysis.md))

## Summary

One-pass rename of every `index.md` and `document.md` filename in the inline derivative tree (`handbooks/`, `aim/`, `ac/`) to a self-describing form. Chapter directories embed the chapter slug (`<NN>-<chapter-slug>/`). AIM `paragraph-N.md` files become `<NN>-<paragraph-slug>.md`. Whole-doc handbooks' and AC's `document.md` become `<slug>-<edition>.md`. Errata pairings move as a unit. Manifest `body_path` fields are rewritten in lockstep. Three emitter pipelines (Python handbook ingest, TS AIM ingest, TS handbooks-extras+AC ingest) update their writers. ~25 test fixtures update. Two CI assertions added (forbidden filename, glossary collision). No schema change. No URL change.

See [analysis.md](./analysis.md) for the full breakdown:

- Status quo by corpus (sections 2.1 through 2.8)
- Naming rules and edge cases (sections 3.1 through 3.6)
- Code-side audit, every hit categorized (section 4)
- Migration plan sketch (section 5)
- Cost estimate by file count (section 6)
- Pros / cons (section 7)
- All decisions resolved (section 8)

## Resolved decisions (informing the full spec)

1. Whole-doc filename: Option B, `<slug>-<edition>.md`.
2. AIM directory rename: slug both `chapter-N` and `section-N` layers.
3. AC corpus: folded into this WP.
4. CFR / regs: out of scope; flagged for follow-up `regs-derivative-cleanup` WP.
5. AMT-G + AMT-P: included in the rename despite ingestion deferral.
6. AIM appendices and glossary: unchanged (already self-naming).
7. `tools/handbook-ingest/prompts-out/` archive snapshots: not rewritten (historical artifacts).

## Anchors

- [ADR 018, Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [Source cache flat naming WP](../source-cache-flat-naming/spec.md), precedent for a one-shot rename plus script-and-delete migration. Inspired the migration-script lifecycle (commit A adds, commit B deletes, in the same PR).
- [PHAK / AFH / AVWX manifest schema](../../../libs/bc/study/src/manifest-validation.ts), `body_path: z.string().min(1)`. No regex constraint; rename is schema-compatible.
- [Slug rule (Python ingest)](../../../tools/handbook-ingest/ingest/normalize.py), `_title_slug` lowercase / non-alnum -> hyphen / 48-char cap. Inherit verbatim.

## Out of Scope (spike stage)

- Writing the migration script.
- Running the rename against the real corpus.
- Updating the production pipelines.
- Updating tests.
- Adding the CI assertions.

These all happen in the full WP, after sign-off and independent review.

## Follow-ups (do not forget)

- **`regs-derivative-cleanup` WP:** the dead-code emitter paths in `libs/sources/src/regs/derivative-writer.ts:137`, `libs/sources/src/regs/resolver.ts:180`, and `libs/sources/src/diff/body-hasher.ts:101` reference `index.md` for the regs corpus. Zero markdown files exist on disk for regs today. These references are dead. Track separately.
