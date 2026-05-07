---
pr: 173
date: 2026-04-25
title: "feat(sim): PA-28 aircraft profile + registry (Phase 6 C1)"
wp_id: null
bugs_fixed: []
summary: |
  Adds the second aircraft to the sim. The hand-rolled FDM was already aircraft-agnostic (everything reads from AircraftConfig), so the PA-28 ships as a config record + registry entry without touching the physics. Introduces an AIRCRAFT_REGISTRY keyed by SIM_AIRCRAFT_IDS, parallel to SCENARIO_REGISTRY. Scenarios pick their airframe via aircraft: SIM_AIRCRAFT_IDS.PA28; the FDM worker resolves through getAircraftConfig(def.aircraft) instead of a hardcoded C172_CONFIG. Adds Playground (PA-28) scenario - free flight in the Warrior at the same field, so a learner can feel the difference between...
---
