---
pr: 378
date: 2026-04-30
title: "feat(scheduler): bootstrap scheduled-jobs + author 2 jobs"
wp_id: null
bugs_fixed: []
summary: |
  Local launchd-driven scheduler for repo-scoped scheduled work, installed from the scheduled-jobs skill. Each job runs in an isolated git worktree branched from main; the user's main checkout is never touched.
---
