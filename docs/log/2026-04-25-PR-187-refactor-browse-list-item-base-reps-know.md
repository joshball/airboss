---
pr: 187
date: 2026-04-25
title: "refactor(browse): list-item base + reps/knowledge feature parity"
wp_id: null
bugs_fixed: []
summary: |
  After PR #182 the three browse routes shared filter primitives but each still open-coded its list, its row card, and its view-controls; and each had a different feature surface. This finishes the extraction and brings reps + knowledge to parity with memory where it makes sense.
---
