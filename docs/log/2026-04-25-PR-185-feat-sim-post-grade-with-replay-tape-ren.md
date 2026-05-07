---
pr: 185
date: 2026-04-25
title: "feat(sim): post grade with replay tape + render in debrief"
wp_id: null
bugs_fixed: []
summary: |
  PR #181 landed evaluateGrading as a pure function in libs/bc/sim. This wires it into the worker -> main-thread -> debrief flow so the in-session quality signal renders without waiting on the study-BC integration (which is still blocked on parallel-agent surfaces).
---
