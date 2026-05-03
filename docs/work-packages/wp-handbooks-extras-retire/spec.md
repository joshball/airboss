---
title: 'Spec: WP-EXTRAS-RETIRE -- slim the handbooks-extras corpus to mtn-tips only'
product: study
feature: wp-handbooks-extras-retire
type: spec
status: shipped-partial
review_status: done
---

> **Outcome (2026-05-03):** SLIM, not full retire. Retiring the whole corpus would require porting `body_override` + section-tree parser to the chapter-aware pipeline for one document (mtn-tips). That's bad ROI. The corpus is slimmed to its minimum: one entry (mtn-tips), historical-context comments preserved, archived WP dirs.

**Original goal:** after the 5 whole-doc promotions (WP-MTN, WP-RMH, WP-AIH, WP-IPH, WP-IFH) ship, every entry in `scripts/sources/config/handbooks-extras.yaml` will have been migrated to the regular `handbooks/` corpus. The `handbooks-extras` corpus becomes empty and can be retired entirely.

**What actually happened:** WP-MTN's design call (PR #527) kept mtn-tips in handbooks-extras with section-tree shape rather than moving it. mtn-tips is the unique case: scanned 1999 pamphlet with unusable OCR + hand-curated `body_override` markdown. The chapter-aware pipeline doesn't support `body_override`, so the only way to fully retire handbooks-extras is to either port body_override to the chapter-aware pipeline (one consumer, real work) or delete mtn-tips entirely (no — it's a useful pilot-training pamphlet).

**This WP slims handbooks-extras to its minimum** and defers full retirement to a future WP that ports `body_override` to the chapter-aware path.

## Why retire (rather than leave empty)

Per the user's "no legacy in airboss — retire on sight" rule (memory: `feedback_no_legacy_in_airboss.md`), an empty corpus + dead emitter pipeline is exactly the kind of cruft that should be deleted. Reasons:

- The handbooks-extras shape was a stopgap (whole-doc only); now that section-tree is universal, the stopgap retires
- One less corpus + dispatcher case + schema discriminator to maintain
- Cleaner mental model: every reference is section-tree

## What to delete

After all 5 promotion WPs land, `handbooks-extras.yaml` has zero entries. Then:

### Code

- `libs/sources/src/handbooks-extras/` — entire directory
  - `ingest.ts`
  - `derivative-reader.ts`
  - `seed-mapping.ts`
  - associated tests
- `scripts/sources/config/handbooks-extras.yaml` — the YAML
- `scripts/sources/config/handbooks-extras-overrides/` — override dir + remaining files (mtn-tips override moves to its handbook dir per WP-MTN)
- `scripts/sources/register/handbooks-extras.ts` — register sub-command
- `libs/bc/study/src/seeders/whole-doc.ts` — only consumer was handbooks-extras
- `kind: 'whole-doc'` discriminator from `manifest-validation.ts`
- `whole-doc` references in dispatcher
- `body_override` field — was only used by mtn-tips through handbooks-extras; now lives in handbook YAML if needed

### Configs

- `scripts/sources.ts` help text mentioning handbooks-extras
- Test fixtures for handbooks-extras

### Docs

- `docs/ingestion-pipeline/handbook-ingestion-strategies.md` — remove Class C / handbooks-extras references
- `docs/work-packages/handbooks-extras-ingestion/` — archive (move to `.archive/`)
- `docs/work-packages/handbooks-extras-yaml-metadata/` — archive
- Update REFERENCES.md to remove the handbooks-extras section
- Update CLAUDE.md if it mentions handbooks-extras

## What to KEEP

- The `handbooks/` corpus stays (it's the everything-handbook home now)
- The chapter-aware section-tree pipeline stays
- Class C handling stays (single PDF without chapter PDFs is still a real shape, just under handbooks/)
- AVWX (already Class C in handbooks/) is the canonical example

## Phases

### Phase 1: Verify handbooks-extras.yaml is empty

After all 5 promotion WPs ship:

```bash
yq '.entries | length' scripts/sources/config/handbooks-extras.yaml
```

Expected: 0

If non-zero, abort — there's still a doc in handbooks-extras that wasn't promoted.

### Phase 2: Delete code

`git rm -rf` the directories listed above. Update the dispatcher (`scripts/db/seed-references-from-manifest.ts`) to remove the `case 'whole-doc':` branch. Update `manifest-validation.ts` to remove `wholeDocManifestSchema` from the discriminator union.

### Phase 3: Delete configs + tests

### Phase 4: Update docs

- REFERENCES.md
- CLAUDE.md
- ingestion-pipeline docs
- Archive WP dirs

### Phase 5: Verify

```bash
bun run check    # 0 errors
bun test         # all green
bun run db reset --force && bun run db seed
# Compare /library reference count before/after — should be unchanged
```

## Risks

- **Some other consumer uses `kind: 'whole-doc'` shape.** Audit before deletion. If a consumer exists that genuinely needs whole-doc shape (no internal structure), keep the schema discriminator but rename the corpus.
- **mtn-tips body_override**: WP-MTN should move the override into the handbook YAML config; if not, that file's home goes away with handbooks-extras-overrides.
- **Citations that reference `airboss-ref:handbooks-extras/...`**: ADR 019 should never have allowed this — handbooks-extras is internal config, not a corpus URI. If any exist, they're bugs to fix BEFORE this WP.

## Anchors

- [whole-doc-promotion/sequence.md](../whole-doc-promotion/sequence.md) — the 5 promotion WPs that prerequisite this
- [PR #489 body_override mechanism](https://github.com/joshball/airboss/pull/489) — only consumer of the handbooks-extras override system
- Memory: `feedback_no_legacy_in_airboss.md`
