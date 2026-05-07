---
pr: 542
date: 2026-05-03
title: "chore(test-lint): add no-toBeTruthy-on-existence rule with grandfathered ignore"
wp_id: null
bugs_fixed: []
summary: |
  Closes the chunk-5 review concern about .toBeTruthy() as a weak assertion at PR time, without burning a one-shot codemod that produces 89 visual-cleanup commits with near-zero behavior change.
---
