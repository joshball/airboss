---
pr: 553
date: 2026-05-03
title: "test(e2e): per-suite withFreshUser fixture; remove data-shape-dependent test.skip calls"
wp_id: library-by-cert
bugs_fixed: []
summary: |
  5 e2e specs were calling \test.skip(...)\ whenever the shared dev-seed user (Abby) didn't happen to expose the row shape they expected. Those branches never ran in CI -- a populated seed silently hid the empty-state assertions, and the skipped specs failed open.
---
