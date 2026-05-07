---
pr: 212
date: 2026-04-26
title: "feat(sim): unauthenticated banner inviting sign-in"
wp_id: null
bugs_fixed: []
summary: |
  Add a server-rendered banner to the sim global layout for unauthenticated visitors. Copy: "Sign in via study to record your flights. Without an account, runs play but aren't saved." Authenticated visitors see nothing. Sim already reads the better-auth cross-subdomain cookie via hooks.server.ts and the /[scenarioId]/attempt endpoint 401s without a user, so anonymous flights produce no sim.attempt row. The banner makes that legible. Banner is dismissible to sessionStorage (SIM_STORAGE_KEYS.AUTH_BANNER_DISMISSED), so it reappears next session start (e.g. fresh tab) and the silent-no-record state...
---
