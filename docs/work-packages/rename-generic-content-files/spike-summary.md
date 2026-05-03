---
title: 'Spike summary: Rename generic content files (Option D)'
product: platform
feature: rename-generic-content-files
type: spike-summary
status: unread
review_status: pending
---

## Overview

This is the SPIKE output. The full work-package spec (acceptance criteria, script contract, test plan) is written via `/ball-wp-spec` after this analysis passes independent review and the user greenlights execution. Calling this `spec.md` would mislead `/ball-wp-build` into treating an analysis as actionable; it is renamed to `spike-summary.md` for that reason.

## What's here

- [analysis.md](./analysis.md): full analysis, decisions, audit, migration sketch, cost estimate, risk table.
- [spike-results/](./spike-results/): three sample chapters renamed by hand under Option D, with per-sample `_diff.md` listing every rename.

## Status

- Spike branch: `spike/rename-generic-content-files`
- All open questions resolved (analysis §8). No "consider for future work" left dangling.
- Analysis incorporates two rounds of independent review.

## Resolved decisions (informing the eventual spec)

1. Whole-doc filename: Option B, `<slug>-<edition>.md`.
2. AC filename: corpus-prefixed variant, `ac-<doc>-<rev>.md` (disambiguates hyphenated AC doc numbers; analysis §3.4).
3. AIM directory rename: slug both `chapter-N` and `section-N` layers.
4. AC corpus: folded into this WP.
5. CFR / regs: out of scope; flagged for follow-up `regs-derivative-cleanup` WP (analysis §2.7, §6.1).
6. AMT-G + AMT-P: included in the rename despite ingestion deferral.
7. AIM appendices and glossary: unchanged (already self-naming).
8. `tools/handbook-ingest/prompts-out/` archive snapshots: not rewritten (historical artifacts).
9. Migration is one squash-merge commit (analysis §5.6).

## Next step

Independent review of the analysis (post-fix). If approved:

1. Run `/ball-wp-spec rename-generic-content-files` to author the full spec from this analysis.
2. Implementation phase via `/ball-wp-build`.
3. Migration script lands and is deleted in the same PR (ADR-021 precedent).

## Anchors

- [ADR 018, Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [Source cache flat naming WP](../source-cache-flat-naming/spec.md): precedent for one-shot rename plus script-and-delete migration.
- [PHAK / AFH / AVWX manifest schema](../../../libs/bc/study/src/manifest-validation.ts): `body_path: z.string().min(1)`. Rename is schema-compatible.
- [Slug rule (Python ingest)](../../../tools/handbook-ingest/ingest/normalize.py): `_title_slug` lowercase / non-alnum -> hyphen / 48-char cap. Inherit verbatim.

## Follow-up: regs cleanup (do not forget)

The dead-code emitter paths in `libs/sources/src/regs/derivative-writer.ts:137`, `libs/sources/src/regs/resolver.ts:180`, `libs/sources/src/diff/body-hasher.ts:101`, and the comments in `libs/sources/src/bootstrap.ts:85,222` reference `index.md` for the regs corpus. Zero markdown files exist on disk for regs today. These references are dead. They are tracked in a separate future WP (`regs-derivative-cleanup`) and must not be lost.
