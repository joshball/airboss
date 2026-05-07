---
pr: 125
date: 2026-04-24
title: "feat(sim): detect crashes and stop the sim on impact"
wp_id: null
bugs_fixed: []
summary: |
  Crashing in the playground left the FDM running because playground is an endless scenario -- no criteria fired an outcome, so the worker loop kept stepping. A crash is a physical event, not a scoring event, and should halt the sim for every scenario.
---
