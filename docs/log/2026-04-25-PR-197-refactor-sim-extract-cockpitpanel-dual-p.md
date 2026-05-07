---
pr: 197
date: 2026-04-25
title: "refactor(sim): extract CockpitPanel + dual page renders full panel"
wp_id: null
bugs_fixed: []
summary: |
  Item #1 of the sim continuation. Extracts a pure-prop CockpitPanel.svelte from the cockpit page and wires it into the dual page so both surfaces use the same component. Mirrors the loose-coupling contract from ADR 015: components are dumb, pages own the worker host.
---
