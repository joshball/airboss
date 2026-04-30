---
title: 'Spec: Extract provenance + per-section signoff'
product: platform
feature: extract-provenance-and-signoff
type: spec
status: unread
review_status: pending
---

# Spec: Extract provenance + per-section signoff

Per-section provenance trace + signoff workflow + automated drift detection for handbook / regulation / AC / ACS / AIM derivative content. Closes a class of silent-corruption failures uncovered during the 2026-04-30 library broad-extraction survey.

## Why this WP exists

The 2026-04-30 broad-extraction survey ran each configured corpus through its register pipeline and surfaced a real failure mode:

> Current main `handbooks/afh/FAA-H-8083-3C/01/02-role-of-the-faa.md` had its MOSAIC errata applied **twice** -- ~615 lines of duplicated paragraphs across 6 section files. The duplication landed on main when PR #277 ran `--apply-errata mosaic` and was apparently re-run without `--force` cleanup. **The duplicates went undetected for months** until a fresh re-extract surfaced the diff.

Today's invariants are not enough:

- The chapter `manifest.json` records the source PDF SHA but not per-section content hashes. There's no signal "this section's bytes have drifted from what we extracted."
- There's no signoff state. Every section is implicitly "good" because nobody flagged it.
- There's no drift detection. A re-extract that produces different bytes is just a diff; nothing surfaces it as "this might be a regression vs what we last verified."

The solution is per-section provenance + signoff state + automated drift detection + a render-time UI surface. **This is the right time to design it -- after a real corruption case, before the library doubles in size.**

## Anchors

- ADR 018 (storage policy)
- ADR 019 (CFR ingestion validators)
- ADR 020 (handbook edition + amendment policy)
- ADR 021 (cache flat naming)
- ADR 022 (chapter source ingestion)
- `docs/work-packages/library-broad-extraction-survey/findings.md` -- the motivating survey
- `docs/work-packages/section-extraction-contract-v2/RESUMING.md` -- the LLM mechanism this complements

## In Scope

### 1. Per-section provenance frontmatter

Each section markdown gains a stable provenance block in its YAML frontmatter:

```yaml
---
handbook: afh
edition: FAA-H-8083-3C
section_number: 2
section_title: 'Role of the FAA'

# Provenance (new):
provenance:
  source_pdf_sha256: 'abc123...'  # which bytes
  source_pdf_path: 'handbooks/afh/FAA-H-8083-3C/FAA-H-8083-3C.pdf'  # where in cache
  extracted_at: '2026-04-30T22:33:14Z'
  extract_strategy: 'toc'  # toc | prompt | compare
  extractor_version: 'sections_via_toc.py@a1b2c3d'  # commit SHA of the extractor
  contract_version: 4  # for prompt strategy only
  errata_applied:
    - id: 'mosaic'
      sha256: 'def456...'
      applied_at: '2026-04-30T22:35:21Z'
  body_sha256: 'ghi789...'  # SHA of THIS section's body bytes (excludes frontmatter)
---
```

Any field can be cross-referenced against the per-edition `manifest.json` for consistency. Tampering with the body shifts `body_sha256`; CI can warn.

### 2. Validation stats sidecar

Each section gets a `<section>.stats.json` sidecar:

```json
{
  "schema_version": 1,
  "section_path": "handbooks/afh/FAA-H-8083-3C/01/02-role-of-the-faa.md",
  "char_count": 3247,
  "word_count": 612,
  "paragraph_count": 8,
  "figure_refs": ["Figure 1-3", "Figure 1-4"],
  "table_refs": [],
  "expected_pages": ["1-2", "1-3"],
  "computed_at": "2026-04-30T22:33:14Z"
}
```

Used for:

- Drift detection: if a re-extract shifts char_count by >5%, surface it.
- Cross-validation: paragraph_count vs PDF text-extraction's paragraph count from the source.
- UI: site shows "612 words, 8 paragraphs" badge.

### 3. Per-section signoff state

A `<section>.signoff.json` sidecar (separate file so signoff has its own audit trail and doesn't churn the markdown frontmatter):

```json
{
  "schema_version": 1,
  "section_path": "handbooks/afh/FAA-H-8083-3C/01/02-role-of-the-faa.md",
  "state": "verified",
  "body_sha256_verified": "ghi789...",
  "verified_at": "2026-04-30T22:40:00Z",
  "verified_by": "joshua",
  "method": "spot-check",
  "notes": "compared against PDF p1-2 and p1-3; matches verbatim.",
  "history": [
    { "state": "auto-extracted", "at": "2026-04-30T22:33:14Z" },
    { "state": "verified", "at": "2026-04-30T22:40:00Z", "by": "joshua", "method": "spot-check" }
  ]
}
```

States:

- `auto-extracted` -- the pipeline produced it; nobody has reviewed.
- `spot-checked` -- sampled comparison vs source; looks right.
- `verified` -- every paragraph compared vs source.
- `flagged` -- known issue; see `notes` for the reason.
- `errata-applied-verified` -- errata applied + correctness re-verified post-apply.

### 4. Drift detection

A `bun run sources verify-derivatives` command walks each derivative tree and compares:

- `provenance.source_pdf_sha256` against the cache's actual SHA.
- `provenance.body_sha256` against the section file's current body bytes.
- `signoff.body_sha256_verified` (if present) against current body.

Reports any mismatch. CI runs this; mismatches block PRs that would land regressions.

### 5. Render-time UI surfaces

The reader (study app) shows:

- Provenance footer: "Last extracted 2026-04-30 from FAA-H-8083-3C.pdf SHA abc123..."
- Signoff badge: green check (verified), yellow warning (auto-extracted), red flag (known issue).
- Word/paragraph count.
- "View source PDF" link with deep page-anchor.

The hangar admin app gets a signoff queue:

- "N sections need signoff" landing page.
- Per-section diff view: rendered markdown side-by-side with a PDF page image.
- One-click signoff with method dropdown (spot-check / full review).

### 6. Errata reapplication safety

When `--apply-errata <id>` runs:

- It checks `signoff.body_sha256_verified` BEFORE applying. If the user has signed off on the un-errata'd version, the apply downgrades signoff to `errata-applied-verified-pending`.
- It refuses to apply twice without `--force`. The AFH duplicate-application case is now structurally prevented.
- Post-apply, the section's `provenance.errata_applied[]` list grows; signoff history records the apply event.

## Out of Scope (explicit)

- **Re-extracting the existing corpora.** The provenance schema can backfill from current manifests + recompute `body_sha256` per file; no re-extract needed.
- **Auto-signoff via LLM.** The signoff workflow is human-in-the-loop. LLM-assisted spot-checking could be a follow-up WP.
- **Signoff at sub-section / paragraph granularity.** Section is the unit; sub-section signoff is overkill until proven necessary.
- **Cross-edition signoff inheritance.** When edition X+1 lands, signoff from X does NOT carry forward; everything starts at `auto-extracted`. This is correct (different content, different verification).

## Acceptance criteria

- Every committed section markdown carries the provenance frontmatter block.
- Every section has a `.stats.json` sidecar with the documented schema.
- Every section has a `.signoff.json` sidecar starting at `auto-extracted` until reviewed.
- `bun run sources verify-derivatives` walks the corpus and reports zero mismatch on a freshly-extracted state.
- `--apply-errata` updates signoff state correctly and rejects double-apply without `--force`.
- Reader shows provenance footer + signoff badge on every section.
- Hangar admin signoff queue lists all `auto-extracted` sections.

## Manual test plan

1. Run a fresh extract on PHAK (pre-WP). Verify every section gets provenance + stats + signoff sidecars.
2. Hand-sign-off one chapter (~50 sections) via the hangar UI.
3. Re-run `bun run sources verify-derivatives` -- expect zero mismatch.
4. Manually edit one section's body. Re-run verify -- expect a `body_sha256` mismatch on that file.
5. Run `--apply-errata mosaic` against AFH (the canonical case). Verify signoff state downgrades correctly.
6. Run `--apply-errata mosaic` again without `--force`. Verify it's rejected with a clear error.
7. Open the reader, navigate to a verified section. Verify provenance footer + green signoff badge render.
8. Open the hangar signoff queue. Verify count matches the auto-extracted file count.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Frontmatter churn breaks downstream consumers | Schema version on every block; consumers gate on schema_version match. |
| Per-file sidecars double the file count | They're tiny JSON; total disk impact ~10% of derivative tree. ADR 018 scale exception covers it. |
| LLM-extracted sections mix with TOC-extracted in same handbook | `extract_strategy` field per section; no mixing within one strategy invocation. |
| Errata sidecar (`<section>.errata.md`) interaction | Signoff state references the post-errata content; pre-errata signoff is preserved in `history[]`. |
| Duplicate-apply detection forces operators to think | Yes -- this is the point. The AFH case shouldn't have been silent for months. |

## Coordination

This WP unblocks:

- TOC parser improvements (RESUMING.md path A) -- drift detection means the iteration loop can re-extract and verify against signed-off references without losing reviewer attention.
- Library expansion (broad-extraction follow-up) -- new corpora come in at `auto-extracted`, get signed off as bandwidth permits, and the queue lets operators see what's been reviewed vs not.
- Reader citations: the page-anchor deep-link from a citation chip should resolve through provenance -- "this citation points at THIS section, last extracted at this version."

This WP does NOT block:

- Day-to-day extraction. The pipeline keeps working unchanged; sidecars are additive.

## Open questions

1. **Where do sidecars live?** Co-located (`02-role-of-the-faa.md` + `02-role-of-the-faa.stats.json` + `02-role-of-the-faa.signoff.json`) is straightforward but doubles file count. Alternative: a per-chapter `_signoff/` directory. Recommend co-located -- humans browsing the tree see the sidecars in context.
2. **Does the reader read sidecars per request?** Or does the seed-script bake sidecar fields into the DB row? Per-request keeps the source-of-truth on disk; baked is faster. Recommend baking with a regen trigger.
3. **Is signoff per-user?** Today the airboss platform is user-zero only (private, hosted-only). Signoff is single-user. Multi-user signoff is a future concern when the platform opens up.
