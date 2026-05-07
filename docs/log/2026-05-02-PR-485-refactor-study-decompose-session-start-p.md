---
pr: 485
date: 2026-05-02
title: "refactor(study): decompose session/start page into _panels"
wp_id: null
bugs_fixed: []
summary: |
  Decompose the 883-line apps/study/src/routes/(app)/session/start/+page.svelte into a thin orchestrator + four panel components under _panels/. Closes the chunk-1 architecture finding (monolithic route).
---
