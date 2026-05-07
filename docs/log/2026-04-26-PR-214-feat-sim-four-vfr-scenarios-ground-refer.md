---
pr: 214
date: 2026-04-26
title: "feat(sim): four VFR scenarios -- ground reference, short-field, slow flight, crosswind"
wp_id: null
bugs_fixed: []
summary: |
  Adds four new horizon-view VFR scenarios that mirror the structure of steep-turns.ts + ils-approach.ts. Each is a small file under libs/bc/sim/src/scenarios/, registered in SIM_SCENARIO_IDS, the registry, and the BC index. Pedagogy + grading rationale below.
---
