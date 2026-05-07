---
pr: 5
date: 2026-04-20
title: "docs(learning-dashboard): author work package -- 9 panels, consumer of graph + plan"
wp_id: learning-dashboard
bugs_fixed: []
summary: |
  Authors the complete work package for the learning dashboard (spec, design, tasks, test-plan) v1 panels in act -> orient -> correct -> reflect order: 1. Start-session CTA (gated on plan, falls back to per-tool entry) 2. Reviews due today 3. Scheduled reps 4. Calibration summary 5. Weak areas 6. Recent activity (7-day sparkline + streak) 7. Cert progress (gated on graph + plan) 8. Domain x cert map (gated on graph) 9. Active study plan (gated on plan) Aggregates existing BC data (cards, reviews, reps, calibration); consumer of graph + plan BCs when they ship No new schema -- read-only...
---
