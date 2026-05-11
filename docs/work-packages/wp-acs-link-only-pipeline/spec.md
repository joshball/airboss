---
id: wp-acs-link-only-pipeline
title: "Spec: WP-ACS-LINK-ONLY -- link-only stubs for the 2 link-only ACS / PTS cards"
product: course
category: content
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - acs
  - link-only
legacy_fields:
  feature: wp-acs-link-only-pipeline
  type: spec
  review_status: done
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# WP-ACS-LINK-ONLY: link-only stubs for the 2 link-only ACS / PTS cards

> **Wave 6 scope (shipped 2026-05-03):** stage-1 (Sourced) stubs only. Both
> publications already carry `url:` fields in `course/references/acs-pts.yaml`
> pointing at the FAA-hosted PDFs (CFII PTS as `kind: pts`, ACS Companion
> Guide as `kind: other`), so citation chips and library cards already
> deep-link correctly. Wave 6 closes this WP by promoting status from
> "link-only" to "link-only stub (Sourced)" and noting the slug + edition
> alignment (`FAA-S-8081-9E` for the PTS, not `FAA-S-ACS-9E`).
>
> Body extraction + section-tree (the "full pipeline" originally scoped below)
> moves to **WP-ACS-FULL** when CFII training content needs the PTS body in
> app, or when the FAA promotes CFII to ACS. The text below is the original
> ambition; preserved as the design target for that future WP.

Build the download → extract → register → seed pipeline for the 2 ACS / PTS cards currently link-only on `/library`. Pattern established by WP-ACS-V (#501).

## In scope

| Card slug                   | FAA number   | Common name                                 | Status                 |
| --------------------------- | ------------ | ------------------------------------------- | ---------------------- |
| cfii-airplane-pts-9e        | FAA-S-ACS-9E | Flight Instructor – Instrument Airplane PTS | Still on PTS, not ACS  |
| faa-g-acs-2-companion-guide | FAA-G-ACS-2  | ACS Companion Guide for Pilots              | Not in download config |

## Decisions

### CFII is PTS not ACS — different doc shape

The PTS shape is older than the ACS shape. PTS sections are typically Areas of Operation → Tasks → Objective/Knowledge/Risk Management/Skills; ACS adds K/R/S codes per element. The current `kind: 'acs'` schema in `manifest-validation.ts` may not fit PTS verbatim.

Two paths:

- (a) Add a new `kind: 'pts'` discriminator. Different schema; different seeder. Cleanest separation.
- (b) Stretch the `kind: 'acs'` schema to cover both ACS and PTS shapes. The CFI ACS already has `elements: []` empty rows because FAA didn't carry K/R/S codes — so the existing schema can degrade gracefully for PTS too.

**Recommendation: (b)**. The acs schema with empty elements is exactly the PTS shape. Slug rename in YAML can stay (`cfii-airplane-pts-9e` reflects that it's PTS-shape) but it dispatches via the same seeder.

If FAA converts CFII to ACS in a future revision, the slug renames and the manifest gets richer — no schema change.

### FAA-G-ACS-2 Companion Guide — separate doc

The Companion Guide is a guide ABOUT the ACS, not an ACS itself. It's a single document (not publication → area → task → element). Should ingest as whole-doc → section-tree (chapter-level if it has chapters).

Per the user's "no more whole-docs" direction: ingest as section-tree. The Companion Guide has chapters per the FAA's published copy.

## Phases

### Phase 1: Add 2 entries to `scripts/sources/config/acs.yaml`

For CFII PTS: same shape as existing ACS entries, slug `cfii-airplane-pts-9e`.

For Companion Guide: probably a new entry shape, since it's not a publication → area → task → element doc. May need a different ingestion config — closer to a handbook.

Decision in spec phase: does the Companion Guide go in `acs.yaml` (with a flag) or move to `handbooks/`? **Lean: handbooks/** (it's a handbook-shaped doc), with `kind: 'handbook'` in the manifest.

### Phase 2: Download

```bash
bun run sources download --only acs
bun run sources download --only handbooks  # if Companion Guide moves here
```

### Phase 3: Extract

CFII PTS: existing ACS extraction pipeline (handles empty elements gracefully).

Companion Guide: handbook section-tree extraction.

### Phase 4: Register + seed

Verify both new references show readable on /library.

### Phase 5: Tests + docs

- Manifest validation tests
- Update REFERENCES.md: both rows flip to readable
- Update status.md

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchors

- [PR #501](https://github.com/joshball/airboss/pull/501) — WP-ACS-V pattern
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — ACS table
