---
title: 'Whole-doc promotion sequence and parallel dispatch'
product: study
feature: whole-doc-promotion
type: meta
status: in-flight
review_status: pending
snapshot_date: 2026-05-03
---

# Whole-doc promotion sequence

Tracks the parallel dispatch of 7 background agents on 2026-05-03. Once these land, `apps/flightbag/` is scaffolded, the 5 whole-doc handbooks become section-trees, and the cleanup sweep closes the rename WP follow-ups.

## In-flight (dispatched 2026-05-03 ~18:50 UTC)

| WP | Agent | Status | Owns |
|----|-------|--------|------|
| WP-MTN | `ad53e2924cc7ac8af` | running | Tips on Mountain Flying — parse existing override markdown into section-tree manifest |
| WP-RMH | `a6f89de74e673b35b` | running | Risk Management Handbook — bookmark extraction (rich embedded TOC) |
| WP-AIH | `a230bb467fb2b983a` | running | Aviation Instructor's Handbook — Class A2 chapter PDFs + bookmark extraction |
| WP-IPH | `ac25854c8c0f35e9a` | running | Instrument Procedures Handbook — Class A2 chapter PDFs + separate TOC PDF |
| WP-IFH | `ad943cc1f49a14907` | running | Instrument Flying Handbook — TOC-file parser (no embedded TOC, no chapter PDFs) |
| Cleanup | `a2080e29ab0a23d53` | running | AC YAML reconciliation, dupe-row delete, PCG decision, AIM `current` orphan delete |
| Flightbag | `ab4621b611269614c` | running | Scaffold `apps/flightbag/` + `libs/library/` + `urlForReference()` helper |

## Coordination

All 5 promotion agents touch:

- `scripts/sources/config/handbooks-extras.yaml` (deleting their entry)
- `libs/sources/src/handbooks-extras/ingest.ts` `DOC_ID_TO_FRIENDLY` and `FRIENDLY_DISPLAY` maps (deleting their entry)
- The smoke test that counts active handbooks-extras entries

Each agent's deletes are independent (different doc_ids). After all 5 ship, `handbooks-extras.yaml` has zero active entries — the corpus retires.

The cleanup agent and flightbag agent don't touch handbooks-extras; they coexist cleanly.

## Expected post-merge state

If all 7 land:

- 5 whole-doc handbooks become section-tree handbooks under `handbooks/<slug>/<edition>/`
- `handbooks-extras` corpus retires (zero entries)
- AC YAML grows by ~4 cards
- 2-3 dupe rows in `handbooks-noningested.yaml` deleted
- PCG umbrella card resolved (deleted or refactored to fallback)
- AIM `current` orphan row gone
- `apps/flightbag/` scaffolded + working build
- `libs/library/` exists with stub primitives
- `libs/constants/src/routes.ts` has `ROUTES.FLIGHTBAG_*` constants
- `libs/sources/src/url-for-reference.ts` helper exists

Total readable references after this batch: **36 + RMH/AIH/IFH/IPH/mtn-tips section-tree depth = ~36 with massively richer drill-down**. The count doesn't grow much because the same docs were already readable as whole-doc; what grows is the section-level navigation and citation precision.

## Next after all 7 land

1. Update `docs/platform/REFERENCES.md` to reflect the new state (every row should be section-tree)
2. Author the migration WP for study's `/library/...` routes → `apps/flightbag/`
3. Author the hangar references admin dashboard WP
4. Author the 12 link-only AC pipeline WP (download config + extract + section-tree)
5. Author the 2 link-only ACS pipeline WP

## Anchors

- [research.md](research.md) — per-handbook strategy
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — canonical references roadmap
- [docs/work-packages/library-completeness/](../library-completeness/) — substrate WP
- [source-tocs/](source-tocs/) — user-extracted TOC files for IFH, RMH, AVWX (reference)
