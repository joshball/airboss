---
pr: 620
date: 2026-05-04
title: "feat(ui): shared AppHeader across all apps (stacked brand, in-menu theme, global help)"
wp_id: null
bugs_fixed: []
summary: |
  Introduces a shared AppHeader component (libs/ui/src/components/AppHeader.svelte) that replaces the per-app brand+nav+identity bars previously copy-pasted across study, sim, hangar, flightbag, and avionics layouts. All five apps now use the same chrome with three zones: stacked brand on the left (small-caps "airboss" pretitle over uppercase APP NAME), app-specific nav slot in the center, fixed right cluster (Help / Help search / Flightbag / appearance toggle / account menu). ThemePicker moves into the account dropdown (theme = once-per-session). Light/dark/system appearance is a one-click...
---
