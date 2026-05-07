---
pr: 196
date: 2026-04-25
title: "feat(sim): sim_attempt schema + persistence BC for graded flights"
wp_id: null
bugs_fixed: []
summary: |
  Track 5 — BC + schema half. Adds the sim.attempt table, ID strategy, BC persistence helpers, and 12 integration tests. **The persistence call site is dormant**: the sim app has no auth (see apps/sim/src/hooks.server.ts "Sim has no auth"), so there's no user id to attach to a row. Wiring lands in a follow-up that adds sim auth.
---
