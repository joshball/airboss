---
pr: 479
date: 2026-05-02
title: "perf(bc-study): rewrite getCredentialIdsCoveredBy as single recursive CTE"
wp_id: null
bugs_fixed: []
summary: |
  Closes the chunk-2 perf minor finding flagged in the 2026-05-01 study-bc-domain review. The previous TS BFS loop made one DB round-trip per walk layer; Postgres WITH RECURSIVE does the entire walk in a single query.
---
