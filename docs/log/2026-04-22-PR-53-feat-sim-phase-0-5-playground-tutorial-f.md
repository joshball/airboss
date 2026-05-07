---
pr: 53
date: 2026-04-22
title: "feat(sim): Phase 0.5 -- playground, tutorial, full six-pack, lateral axis"
wp_id: null
bugs_fixed: []
summary: |
  FDM gets a real lateral axis (roll, yaw, coordinated turn, adverse yaw, auto-coordinate), trim, parking brake, flaps, wind, and AoA-based stall warning. Cockpit goes from three instruments to a full six-pack + tach, plus always-visible V-speeds / WX / control-input panels and a keybindings help overlay. Three scenarios ship: Playground, First Flight (9-step tutorial), Departure Stall (rewritten with scripted trim drift above 200 ft AGL). Tap-based keyboard model with OS autorepeat, centering keys (X/C/Z), trim on [ and ], parking brake on .. Stall horn via Web Audio API, gesture-started to...
---
