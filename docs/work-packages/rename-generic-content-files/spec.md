---
title: 'Spec: Rename generic content files (Option D)'
product: platform
feature: rename-generic-content-files
type: spec
status: unread
review_status: pending
---

# Spec: Rename generic content files (Option D)

This is a SPIKE-stage spec shell. The full spec is deferred until the user reviews [analysis.md](./analysis.md) and decides whether to proceed.

## Status

- Spike branch: `spike/rename-generic-content-files`
- Spike artifacts: [spike-results/](./spike-results/) (three sample chapters, before/after, with per-sample `_diff.md`)
- Decision needed before this spec is written: yes (see [analysis.md 8 Open questions](./analysis.md))

## Summary

One-pass rename of every `index.md` and `document.md` filename in the inline derivative tree to a self-describing form. Chapter directories embed the chapter slug (`<NN>-<chapter-slug>/`). AIM `paragraph-N.md` files become `<NN>-<paragraph-slug>.md`. Whole-doc handbooks' `document.md` becomes `<edition>-handbook.md` (or another option from 3.4 of the analysis). Errata pairings move as a unit. Manifest `body_path` fields are rewritten in lockstep. Two emitter pipelines (Python handbook ingest, TS AIM ingest) update their writers; ~6 test fixtures update. No schema change. No URL change.

See [analysis.md](./analysis.md) for the full breakdown:

- Status quo by corpus (sections 2.1-2.6)
- Naming rules and edge cases (sections 3.1-3.5)
- Code-side audit, every hit categorized (section 4)
- Migration plan sketch (section 5)
- Cost estimate by file count (section 6)
- Pros / cons (section 7)
- Open questions awaiting user decisions (section 8)

## Open decisions blocking the spec

1. Whole-doc filename choice (A/B/C/D/E from analysis 3.4).
2. AIM directory rename: slug both layers, or keep `chapter-N`/`section-M`?
3. Should AC's `document.md` be folded into this WP or punted to a sibling WP?
4. CFR / regs `index.md`: same WP, sibling WP, or no?

## Anchors

- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [Source cache flat naming WP](../source-cache-flat-naming/spec.md) -- precedent for a one-shot rename + script-and-delete migration pattern. Inspired the migration-script lifecycle (commit A adds, commit B deletes, in the same PR).
- [PHAK / AFH / AVWX manifest schema](../../../libs/bc/study/src/manifest-validation.ts) -- `body_path: z.string().min(1)`. No regex constraint; rename is schema-compatible.
- [Slug rule (Python ingest)](../../../tools/handbook-ingest/ingest/normalize.py) -- `_title_slug` lowercase / non-alnum -> hyphen / 48-char cap. Inherit verbatim.

## Out of Scope (spike-stage)

- Writing the migration script.
- Running the rename against the real corpus.
- Updating the production pipelines.
- Updating tests.

These all happen in the full WP, after sign-off.
