---
pr: 380
date: 2026-05-01
title: "fix(scripts): drain postgres pool on exit (kills ~20s reset hang)"
wp_id: null
bugs_fixed: []
summary: |
  bun run db reset --force printed seed: done. and then sat for ~20s before the next script ran. Same pattern affected every scripts/db/*.ts that touches @ab/db and exits naturally instead of force-exiting.
---
