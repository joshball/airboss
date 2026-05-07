---
pr: 328
date: 2026-04-29
title: "feat(activities,sim): promote PFD to libs + mount in sim"
wp_id: extract-sim-instruments
bugs_fixed: []
summary: |
  Closes the deferred extract-sim-instruments work package. The PFD set was authored in apps/avionics/src/lib/pfd/ with this promotion in mind (token-driven colours, props-only inputs, no app-local imports). Sim mounting a Glass PFD demo is the second consumer that fires the trigger; the components now live at libs/activities/src/pfd/ and both apps import them through @ab/activities/pfd/<file>.
---
