---
pr: 969
date: 2026-05-14
title: "feat(tracking): track ship-pr merges + auto-emits log entry"
wp_id: tracking-system-overhaul
bugs_fixed: []
summary: |
  Adds bun run track ship-pr <pr> which merges a PR via gh pr merge --squash --delete-branch and immediately emits the docs/log/ entry via bun scripts/log-pr.ts <pr> in one step.
---
