---
pr: 110
date: 2026-04-24
title: "feat(study): adopt PageHelp on dashboard, reps, and knowledge route clusters"
wp_id: knowledge-graph
bugs_fixed: []
summary: |
  Adopts the <PageHelp> chicklet pattern (shipped in #77, refined in #107) on every study-app route that deserves one across three clusters: /dashboard, /reps/*, and /knowledge/*. Mirrors the wiring shape already live on /session/start and /memory/review. Three focused commits, one per cluster.
---
