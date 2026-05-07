---
pr: 113
date: 2026-04-24
title: "feat(hangar): wp-hangar-non-textual -- binary-visual source family + Denver VFR sectional"
wp_id: null
bugs_fixed: []
summary: |
  Extends the hangar source pipeline to cover raster/binary-visual source types, seeded by the **Denver VFR Sectional Chart**. Adds a source-kind classifier (text vs binary-visual) that drives fetch/extract/diff/validate routing: text sources keep the extraction pipeline; binary-visual sources skip extraction (no prose to capture from a raster), capture edition metadata + sha256 at ingest, and render a preview thumbnail tile on /sources/[id].
---
