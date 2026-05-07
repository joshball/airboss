---
pr: 582
date: 2026-05-04
title: "perf(bc-study): 6 batch BC helpers + 6 route loaders close N+1 cluster (chunk-1)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-1 N+1 cluster (5 perf MAJOR + 6 backend MAJOR = 11 findings) at the root: six new batched read helpers in @ab/bc-study plus six route loader updates that swap .map(async ...) per-row patterns for one (or two) round trips that hand back a Map keyed by the input id.
---
