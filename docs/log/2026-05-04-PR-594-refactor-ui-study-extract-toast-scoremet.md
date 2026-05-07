---
pr: 594
date: 2026-05-04
title: "refactor(ui,study): extract Toast / ScoreMeta / BadgeStatus from study routes (chunk-1 svelte cluster)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-1 svelte review's MAJOR convergent finding: route-level visual CSS proliferation across 65 study routes. Three primitives lifted into libs/ui/, six study-app consumer sites rewired, no token migration in this pass (token sweep runs LAST per project rule).
---
