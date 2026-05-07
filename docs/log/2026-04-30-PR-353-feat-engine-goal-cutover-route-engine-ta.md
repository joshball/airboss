---
pr: 353
date: 2026-04-30
title: "feat(engine-goal-cutover): route engine targeting through primary goal"
wp_id: engine-goal-cutover
bugs_fixed: []
summary: |
  Closes the loop on ADR 016 phase 6: the session engine now reads cert / focus / skip from the user's primary goal (with study-plan fallback) instead of study_plan.cert_goals directly. The goal composer that PR #324 shipped finally drives what the next session contains.
---
