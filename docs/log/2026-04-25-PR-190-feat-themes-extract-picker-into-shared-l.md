---
pr: 190
date: 2026-04-25
title: "feat(themes): extract picker into shared lib, wire study, sim, hangar"
wp_id: null
bugs_fixed: []
summary: |
  Phase 9 (#183) shipped the theme picker in study only. The cookie / parser / override rule / /theme endpoint / pre-hydration script were one copy then -- but the override rule (/sim/* lock + sim/glass forces dark) is safety-critical, and the inline allow-list of theme ids in app.html can't import from the bundle. Triplicating that bundle across study, sim, and hangar would create three drift sites for "must stay in sync with listThemes()."
---
