---
pr: 645
date: 2026-05-05
title: "add app-switcher dropdown to global header brand"
wp_id: null
bugs_fixed: []
summary: |
  AppHeader brand becomes a dropdown when appOrigins is supplied. Current app on top (clicking goes to brandHref, marked current); other surface apps follow in alpha order, each linking to that app's origin. New appOrigins(url) helper in @ab/constants derives all surface origins from the live request URL via existing siblingOrigin + HOST_PREFIXES (no magic strings; works for airboss.test, air-boss.org, or localhost+ports). Wired in all five app layouts: study, sim, hangar, flightbag, avionics. Each +layout.server.ts returns appOrigins(event.url); each layout passes appOrigins={data.appOrigins}...
---
