---
pr: 435
date: 2026-05-02
title: "refactor(hangar): break 3-way bc-hangar/hangar-jobs/hangar-sync package cycle"
wp_id: null
bugs_fixed: []
summary: |
  Closes the **critical #3 architecture finding** from docs/work/reviews/2026-05-02-hangar-cluster-INDEX.md: a three-way circular dependency between @ab/bc-hangar, @ab/hangar-jobs, and @ab/hangar-sync. Workspace path aliases were hiding the cycle from the TypeScript resolver, but the package.json graph was structurally circular:
---
