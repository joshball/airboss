---
pr: 216
date: 2026-04-26
title: "refactor(sim): extract ControlInput.svelte for cross-surface reuse"
wp_id: null
bugs_fixed: []
summary: |
  New pure-prop component apps/sim/src/lib/cockpit/ControlInput.svelte. Owns keyboard listeners, the spring/ramp rAF loop, and resolution through the existing control-handler / control-ramp helpers. Emits patches via callback props (oninput, onspecial, ontoggleAutoCoordinate, onfirstgesture, intercept). Zero @ab/bc-sim imports beyond the shared FdmInputs type. No worker host, no scenario lookup, no audio cue dispatch, no gauge cross-imports. Drops into any page that hosts an FDM worker. Cockpit, dual, and window surfaces all wire the same component now. Dual + window were view-only before this;...
---
