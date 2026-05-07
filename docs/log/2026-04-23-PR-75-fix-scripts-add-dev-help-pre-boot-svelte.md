---
pr: 75
date: 2026-04-23
title: "fix(scripts): add dev --help + pre-boot svelte-kit sync"
wp_id: null
bugs_fixed: []
summary: |
  \bun run dev --help\ prints usage + app list + examples. Was exiting with \"Unknown app: '--help'\". Runs \svelte-kit sync\ in every app workspace before vite boots. Removes the first-run \"Cannot find base config file ./.svelte-kit/tsconfig.json\" warning that hit hangar on its first boot.
---
