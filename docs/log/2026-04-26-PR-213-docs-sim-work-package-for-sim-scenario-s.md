---
pr: 213
date: 2026-04-26
title: "docs(sim): work package for sim-scenario / study-card mapping"
wp_id: sim-card-mapping
bugs_fixed: []
summary: |
  Authors the work package for wiring getRecentSimWeakness (libs/bc/sim/src/persistence.ts) into the study spaced-rep scheduler. The function already produces per-scenario weakness signals; this WP defines the mapping that fans those signals out to the study cards each scenario exercises, and the engine touchpoint that turns them into card-level pressure.
---
