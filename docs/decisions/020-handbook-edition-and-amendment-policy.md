---
title: 'ADR 020: Handbook edition and amendment policy'
date: 2026-04-27
status: accepted
participants: Joshua Ball, Claude
---

# ADR 020: Handbook edition and amendment policy

## Decision

Airboss adopts a three-tier policy for handbook revisions:

1. **Full edition** -- the FAA publishes a new bound PDF (e.g., PHAK 25B -> 25C). New `reference` row, new edition tree under `handbooks/<doc>/<new-edition>/`, fresh ingestion. Old edition's row gets `superseded_by_id` set; reader shows "newer edition available."
2. **Errata sheet** -- the FAA publishes a small correction PDF (typically 1-10 pages, replacing specific paragraphs in an existing edition). Folded into the existing edition's tree as a separate file (`handbooks/<doc>/<edition>/_errata/<date>-<slug>.md`) and linked from affected sections. No new `reference` row; the existing edition's content is re-extracted with errata applied.
3. **Continuous-revision documents (AIM)** -- explicitly out of scope for this ADR. AIM's change-pages model is fundamentally different (per-paragraph dated revisions to a single nominal edition); it gets its own ADR when ingestion lands.

For PHAK / AFH / AvWX / IFH / IPH and similar FAA handbooks, the edition+errata model below applies.

## Why this needs a decision

The original ingestion spec ([handbook-ingestion-and-reader/spec.md](../work-packages/handbook-ingestion-and-reader/spec.md)) handles only **full editions**. It assumes:

- One source PDF per edition.
- Edition succession is linear (`superseded_by_id` is a self-FK on `reference`).
- Re-ingestion of an unchanged edition is a no-op.

The FAA publishes errata between full editions. PHAK 25C has had at least one published errata sheet since release. The AFH has had several over the years. These are real corrections that affect citation accuracy: a `[learner cites PHAK Ch. 12 §3 (pp. 12-7..12-9)]` is *wrong* if the errata replaced that paragraph and the learner is reading the unrevised text.

Three failure modes if errata aren't handled:

1. **Citation drift.** A node cites PHAK Ch. 12 §3 with a quote. Errata silently rewords the paragraph. The quote in our DB no longer matches the FAA's current wording. The audit story breaks.
2. **Reader staleness.** The user opens PHAK Ch. 12 §3 in airboss and reads pre-errata text. The FAA's own PDF (post-errata) says something different. Worst-case: a regulatory ambiguity in one direction or the other.
3. **Unverifiable trust.** The platform's promise is "we cite the FAA's exact words." Without errata handling, that promise is silently broken between editions.

This ADR makes the model explicit so the pipeline handles all three.

## What an FAA errata looks like in practice

FAA errata for handbooks typically come as:

- A small PDF (1-10 pages) titled `errata-FAA-H-8083-25C-<date>.pdf` or similar.
- Format: each erratum is a triplet of `(page reference, original text, replacement text)`. Sometimes a paragraph-level rewrite, sometimes a single-word correction, occasionally a figure replacement.
- Cumulative across the lifespan of an edition (so the most recent errata sheet supersedes earlier ones for the same edition).
- Distributed via the same FAA handbook page that serves the bound PDF, but as a separate URL (e.g., `https://www.faa.gov/.../PHAK_FAA-H-8083-25C-errata.pdf`).

The FAA does NOT republish the bound PDF when errata are issued. The bound PDF stays at the original-publication SHA-256 forever. The errata sheet is the delta.

## The model

### Storage layout

Per [ADR 018](./018-source-artifact-storage-policy/decision.md), source PDFs live in the developer-local cache. Errata follow the same rule:

```text
$AIRBOSS_HANDBOOK_CACHE/
  handbooks/
    phak/
      FAA-H-8083-25C/
        source.pdf                          <- bound edition (74 MB; immutable)
        errata-2026-01-15.pdf               <- errata sheet 1 (cached; immutable)
        errata-2026-08-22.pdf               <- errata sheet 2 (if/when published)
```

In-repo (committed):

```text
handbooks/phak/FAA-H-8083-25C/
  manifest.json                             <- updated to record errata SHAs + dates
  _errata/
    2026-01-15.md                           <- per-erratum extracted markdown
    2026-08-22.md
  12/
    03-atmospheric-pressure.md              <- post-errata body (regenerated when errata applied)
    03-atmospheric-pressure.errata.md       <- per-section errata note (linked from body)
```

### Manifest extension

The existing `manifest.json` schema gains an `errata` array:

```json
{
  "document_slug": "phak",
  "edition": "FAA-H-8083-25C",
  "source_url": "https://www.faa.gov/.../faa-h-8083-25c.pdf",
  "source_checksum": "247929cace0ab56b...",
  "fetched_at": "2026-04-27T11:51:35Z",
  "errata": [
    {
      "id": "errata-2026-01-15",
      "source_url": "https://www.faa.gov/.../PHAK-25C-errata-2026-01.pdf",
      "source_checksum": "<sha256>",
      "fetched_at": "2026-04-27T11:51:35Z",
      "page_range": "12-7..12-9",
      "affects_sections": ["12.3", "12.4"],
      "summary": "Corrected pressure-altitude formula in Ch. 12."
    }
  ]
}
```

### Schema (unchanged from current)

The current `study.reference` and `study.handbook_section` schema is sufficient. Errata are NOT modeled as separate `reference` rows because they are not independent citation sources -- they're patches to an existing edition. The audit story is "edition X with errata Y applied," not "edition X plus document Y."

What changes:

- `handbook_section.content_md` always reflects the **post-errata** text. A learner reading PHAK Ch. 12 §3 sees the corrected paragraph.
- `handbook_section.content_hash` is computed AFTER errata are applied, so a re-seed correctly detects errata-driven content changes and updates the row.
- Optionally (deferred to phase 2 of this work, not v1): per-section `handbook_section_errata` notes linking to the errata source URL and the original (pre-errata) text. This is what enables a "what changed in this section?" UI affordance. Not required for v1.

### Pipeline behavior

The Python ingestion pipeline (`tools/handbook-ingest/`) gains an `--apply-errata` mode:

```bash
# Initial ingestion of the bound edition (already supported):
bun run sources extract handbooks phak --edition FAA-H-8083-25C

# When new errata is published, fetch + apply:
bun run sources extract handbooks phak --edition FAA-H-8083-25C --apply-errata https://www.faa.gov/.../PHAK-25C-errata-2026-08.pdf

# Re-apply all known errata for this edition (deterministic re-run):
bun run sources extract handbooks phak --edition FAA-H-8083-25C --reapply-errata
```

`--apply-errata <url>`:

1. Downloads the errata PDF to `<cache>/handbooks/phak/FAA-H-8083-25C/errata-<date>-<slug>.pdf`.
2. Records SHA-256 + fetched_at in `manifest.json`'s `errata` array.
3. Extracts each erratum: parses the `(page reference, original text, replacement text)` triplets from the errata PDF.
4. For each erratum:
   - Identifies the affected `handbook_section` row by page reference.
   - Generates a per-section `<section>.errata.md` file with the original text, replacement text, and source URL.
   - Re-renders the section's `<chapter>/<section>.md` body markdown with the replacement applied.
   - Re-computes `content_hash`.
5. Commits the diff (errata sheet record + regenerated section markdown + per-section errata note).

### Re-seed behavior

`bun run db seed handbooks` reads the post-errata content from disk. Because `content_hash` changes when errata are applied, the seed's idempotency check correctly detects and updates affected rows. No special handling needed.

### Reader UI

For v1, the reader renders post-errata text without any explicit "this section was corrected" indicator. The text the learner sees IS the FAA's current authoritative version.

Phase 2 (deferred, separate work):

- A small badge next to a corrected section: "Corrected by 2026-01-15 errata."
- Click → modal showing original text, replacement text, errata source link.
- Surfaces the audit trail when the learner cares; doesn't clutter when they don't.

This is purely additive on top of v1. The data is already in `<section>.errata.md`; only the UI is missing.

## Edge cases considered

### Multiple errata sheets affecting the same paragraph

The FAA publishes cumulative errata: errata sheet 2 supersedes errata sheet 1 for any paragraph it touches. The pipeline applies errata in chronological order; the most recent erratum wins for any given paragraph. Manifest records the chain so the audit trail is preserved.

### Errata that remove a paragraph entirely

The replacement text is empty. The pipeline removes the paragraph from the section markdown. The `<section>.errata.md` records what was removed.

### Errata that add a paragraph (rare)

The "page reference" identifies a location relative to existing content. The pipeline inserts the new paragraph at that location. Same audit trail.

### Errata that affect a figure or table

Figures: the errata PDF may include a replacement figure. The pipeline detects this and replaces the inline figure PNG, recording the original-vs-replacement in `<section>.errata.md`. Tables: same. Both are rare in practice.

### Errata that add an entire section

Hasn't been observed in FAA practice. If it happens, the pipeline emits a new `handbook_section` row at the appropriate code position with a flag in `manifest.json` recording its provenance.

### Errata for a superseded edition

If PHAK 25D ships and the FAA later publishes errata for 25C, we apply it (the old edition's reader still works for users who pinned to it via `?edition=`). Same machinery.

### Errata SHA-256 mismatches

If the FAA replaces an errata sheet at the same URL (very rare), the `manifest.json` SHA mismatch surfaces it. The pipeline refuses to silently overwrite; user must explicitly `--reapply-errata` to take the new version.

## Operational policy

### How often to check for errata

Manual. The FAA doesn't publish to a feed or notification system we can subscribe to. Joshua periodically checks the FAA's PHAK / AFH / AvWX pages (no schedule -- at most monthly during active study; longer when not).

### How to discover new errata

For each handbook, the FAA's handbook page (e.g., `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak`) lists all related documents including errata sheets. Joshua checks this page when a new edition is suspected, and also when reading a section that "feels off" or contradicts other sources.

### How to verify errata are applied

`manifest.json`'s `errata` array is the truth. To confirm: `bun run sources extract handbooks phak --edition FAA-H-8083-25C --verify-errata` (planned, not yet implemented). Pipeline checks every entry in `manifest.errata` against the cached PDFs, recomputes section content hashes, confirms they match the post-errata version. Output: clean, OR list of mismatches.

### When the FAA publishes a new edition

Standard supersession flow:

1. New edition (`FAA-H-8083-25D`) gets a new tree under `handbooks/phak/FAA-H-8083-25D/`.
2. New `reference` row inserted; old row's `superseded_by_id` set.
3. Reader UI shows "newer edition available" banner on old-edition pages.
4. Old edition's content stays accessible via explicit `?edition=` query param.
5. Old edition's read-state (per-user `handbook_read_state` rows) is NOT migrated. Per the spec, opening the same section in the new edition creates a fresh row. (User might want a "carry my read-state forward" feature later; deferred.)
6. Errata for the OLD edition keep applying; the spec doesn't drop them.

## Why not the alternatives

### Alternative A — Each errata gets its own `reference` row

Considered. Rejected because:

- Errata are corrections to an edition, not independent citation sources. `[PHAK Ch. 12 §3]` should be a single citation, not "PHAK Ch. 12 §3 (per 25C as amended by errata 2026-01-15)."
- The schema's `(document_slug, edition)` unique constraint would break (you'd need errata-id in the key).
- The reader UI would need a notion of "applied errata stack" per page, which is heavier than the current "edition" notion.
- The audit story is muddier: which errata applies if a citation predates the errata?

### Alternative B — Re-publish the bound PDF as a new edition

The FAA doesn't do this. We can't choose to. Even if we could, we'd be inventing edition labels (`FAA-H-8083-25C-rev1`) that don't exist in the FAA's universe and would confuse users who consult primary sources.

### Alternative C — Treat errata as a pure UI overlay

Keep the original-edition text in `handbook_section.content_md`; render errata as inline overlays at read time.

Rejected because:

- The text the learner reads should be the authoritative current version. An overlay model means "default-wrong with an explainer," which is the opposite of what we want.
- Citations and quotes from the section would still match the original text, breaking the audit story for any node that quotes a corrected passage.
- Search would index the original text, making the corrected text un-findable.

### Alternative D — Don't handle errata at all

Considered for v1. Rejected because the cert-syllabus WP and the citation-precision goals depend on quote-level accuracy. Skipping errata means citations silently drift.

## Migration

This ADR is forward-looking. PHAK 25C has been ingested without errata applied (Phase 8 of the handbook-ingestion-and-reader WP, 2026-04-27). The first errata application is a one-time follow-up:

1. Identify any published errata sheets for PHAK 25C (FAA's PHAK page).
2. Run `bun run sources extract handbooks phak --edition FAA-H-8083-25C --apply-errata <url>` for each.
3. Commit the regenerated section markdown + manifest update.
4. Re-seed: `bun run db seed handbooks`.

For AFH and AvWX (Phase 15 of the WP), errata application is part of initial ingestion: ingest the bound edition first, then immediately apply any known errata in the same run.

## Out of scope

The following are explicitly not addressed by this ADR:

- **AIM ingestion.** AIM's continuous-revision change-pages model is fundamentally different. AIM gets its own ADR when its WP lands. The change-pages-per-paragraph model needs a different schema (likely a `handbook_section_revision` table tracking paragraph-level history) and a different reader UI (showing change-page dates inline).
- **Pilot/Controller Glossary.** Published with the AIM. Same WP.
- **Advisory Circulars.** Each AC is published as a single document at a fixed revision number; AC errata are rare. When a new revision drops, it's effectively a new edition (same model as full handbook editions). The AC ingestion WP can compose with this ADR; no extension needed.
- **NTSB reports.** Reports are published once and effectively immutable; they don't have errata in any meaningful sense. NTSB ingestion ignores this ADR.
- **POH excerpts.** Per-aircraft, per-manufacturer; revisions are manufacturer-specific. Out of scope; future WP.
- **Carrying read-state forward across editions.** Mentioned in the spec; deferred to a future feature when there's actual user friction.
- **Errata UI affordances** (badges, modals, "what changed" diffs in the reader). Phase 2 of this work; not required for v1.

## Acceptance criteria

- [ ] [docs/platform/HANDBOOK_INGESTION_STRATEGIES.md](../platform/HANDBOOK_INGESTION_STRATEGIES.md) cross-references this ADR (already in place).
- [ ] [handbook-ingestion-and-reader/spec.md](../work-packages/handbook-ingestion-and-reader/spec.md) updated to reference ADR 020 in its "Migration considerations" or "Edge cases" section.
- [ ] [tools/handbook-ingest/README.md](../../tools/handbook-ingest/README.md) documents the `--apply-errata` flag (or notes it as not-yet-implemented).
- [ ] `manifest.json` schema documented to include the `errata` array; the seed reader is forward-compatible (ignores unknown fields, accepts errata-shaped manifests).
- [ ] When the first FAA errata is published for a handbook airboss has ingested, this ADR is consulted and the documented process is followed.

## Future considerations (resolved per CLAUDE.md "no undecided")

- **AIM ADR.** Will reference this ADR for the parts that overlap (manifest shape, source-PDF caching) but document the change-pages-per-paragraph model independently. Trigger: AIM ingestion WP starts.
- **Errata UI** (badges, "what changed" modals). Trigger: a real learner asks "did this section change?" or quote-level citation drift becomes visible. Not before.
- **Auto-detection of new errata.** Trigger: Joshua tires of manually checking FAA pages, or a reliable RSS/notification source for errata becomes available. Not before.

## Related

- [ADR 016](./016-cert-syllabus-goal-model/decision.md) -- the broader citation/cert/syllabus model this slots into.
- [ADR 018](./018-source-artifact-storage-policy/decision.md) -- where source PDFs (and now errata PDFs) live.
- [HANDBOOK_INGESTION_STRATEGIES.md](../platform/HANDBOOK_INGESTION_STRATEGIES.md) -- TOC vs LLM extraction strategies.
- [STORAGE.md](../platform/STORAGE.md) -- the three-tier storage policy.
- [handbook-ingestion-and-reader spec](../work-packages/handbook-ingestion-and-reader/spec.md) -- the WP that ingests handbooks.
