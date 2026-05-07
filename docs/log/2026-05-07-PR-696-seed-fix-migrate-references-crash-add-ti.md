---
pr: 696
date: 2026-05-07
title: "seed: fix migrate-references crash, add timing/skip/heartbeat, parallelize corpora"
wp_id: null
bugs_fixed: []
summary: |
  Fix the trailing migrate-references crash on a freshly-seeded DB (undefined is not an object (evaluating 'legacy.source.trim') on aero-angle-of-attack-and-stall). The migration now recognises the ADR-019 ref: shape that build-knowledge emits and passes those entries through unchanged. Surface timing per phase and total at the end of seed-all. Tee each phase's stdout/stderr into .reports/seed/<phase>.log so the screen stays readable but full output is recoverable. Run a 5s heartbeat ticker on idle phases so the operator sees something is still happening. Parallelize the two...
---
