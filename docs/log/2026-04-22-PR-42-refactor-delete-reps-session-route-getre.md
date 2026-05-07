---
pr: 42
date: 2026-04-22
title: "refactor: delete /reps/session route + getRepAttemptsForSession/getScenariosByIds helpers (ADR 012 phase 6)"
wp_id: null
bugs_fixed: []
summary: |
  Phase 6 of ADR 012. Final cleanup of the legacy rep-session surface area. The 308 redirect at /reps/session is removed; the BC helpers that existed only to power the old runner's resume flow are dropped.
---
