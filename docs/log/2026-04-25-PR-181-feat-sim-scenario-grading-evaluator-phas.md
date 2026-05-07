---
pr: 181
date: 2026-04-25
title: "feat(sim): scenario grading evaluator (Phase 4 reps)"
wp_id: null
bugs_fixed: []
summary: |
  Pure function over a \ReplayTape\ that produces a 0..1 weighted grade across the six declared \GradingComponentKind\s. Pass/fail stays in the runner; this is the finer-grained quality signal that the spaced-rep scheduler will read once the study BC integration unblocks (separately tracked).
---
