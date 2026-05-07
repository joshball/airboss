---
pr: 40
date: 2026-04-22
title: "fix(sim): dev launcher runs all apps by default, drop per-app scripts"
wp_id: null
bugs_fixed: []
summary: |
  bun run dev -- launches all apps in DEV_URLS (study + sim) concurrently with labeled, color-prefixed stdout/stderr. Ctrl-C terminates both cleanly. bun run dev <name> -- runs just that app, as before. bun run dev <unknown> -- clear error listing valid names; exits 1. Removed dev:study and dev:sim npm scripts that crept in with the sim scaffold. Single-script pattern now covers every case.
---
