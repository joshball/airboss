---
pr: 208
date: 2026-04-26
title: "fix: revert #207 (rolled back five sim PRs by mistake)"
wp_id: null
bugs_fixed: []
summary: |
  PR #207 was meant to regenerate the auto-generated course/knowledge/graph-index.md banner. Instead it captured stale working-tree content from a recovered WIP branch and silently reverted PRs #201, #202, #204, #205, and parts of #206.
---
