---
pr: 557
date: 2026-05-03
title: "chore(tests): sweep grandfathered .toBeTruthy() sites; clear test-lint ignore"
wp_id: null
bugs_fixed: []
summary: |
  Closes the long tail of the chunk-5 review concern about .toBeTruthy() as a weak/redundant assertion. PR #542 introduced the tools/test-lint rule with 89 existing sites grandfathered; this PR sweeps every grandfathered site (plus 1 that snuck in via PR #548) and clears tools/test-lint/ignore.txt to zero.
---
