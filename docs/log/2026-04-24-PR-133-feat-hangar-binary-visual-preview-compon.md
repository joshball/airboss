---
pr: 133
date: 2026-04-24
title: "feat(hangar): binary-visual preview components (geotiff/jpeg/zip)"
wp_id: null
bugs_fixed: []
summary: |
  Closes wp-hangar-non-textual Phase 5 / deferred #6. /sources/[id]/files currently falls through to the generic BINARY preview for .tif / .jpg / .zip entries; this PR lands the three dedicated previewers the WP calls for and refactors the dispatcher so the next wave of text-format previewers (Chunk E: pdf/csv/markdown) drops in cleanly.
---
