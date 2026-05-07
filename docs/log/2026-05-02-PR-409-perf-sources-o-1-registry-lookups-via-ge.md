---
pr: 409
date: 2026-05-02
title: "perf(sources): O(1) registry lookups via generation-invalidated index"
wp_id: null
bugs_fixed: []
summary: |
  Fixes Cluster F (registry linear-scan-per-id + N+1 at render time, major) from the sources & content pipeline 10x review (perf chunk).
---
