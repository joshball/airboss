---
pr: 317
date: 2026-04-28
title: "feat(handbook-errata): bullet-edits parser archetype + PHAK MOSAIC apply (R5 PHAK)"
wp_id: apply-errata-and-afh-mosaic
bugs_fixed: []
summary: |
  New errata parser archetype bullet-edits (tools/handbook-ingest/ingest/errata_parsers/bullet_edits.py) handles the PHAK October 2025 MOSAIC addendum's richer instruction grammar (comma-delimited chapter anchors, bullet-level state changes, list reorderings, a removal directive, composite title-and-paragraph revisions). PHAK MOSAIC now applies cleanly via bun run sources extract handbooks phak --apply-errata mosaic: 21 patches land across 13 sections in chapters 1, 3, 6, 9, and 17. Apply pipeline gains a sibling-section positional tie-break for shared section titles (e.g. Limitations: under...
---
