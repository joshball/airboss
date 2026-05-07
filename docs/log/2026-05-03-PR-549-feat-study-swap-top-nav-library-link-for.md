---
pr: 549
date: 2026-05-03
title: "feat(study): swap top-nav Library link for cross-app Flightbag link"
wp_id: null
bugs_fixed: []
summary: |
  Replaces the study app's top-nav Library entry with a Flightbag link that points at the cross-subdomain flightbag app. Flightbag origin is computed server-side via siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG) so dev (*.airboss.test) and prod (*.air-boss.org) both work without hardcoded URLs. Adds NAV_LABELS.FLIGHTBAG = 'Flightbag'. Drops the libraryActive derived + aria-current since the link now crosses into a different app. Deep /library/* route subtree stays untouched (different agent owns the flightbag reader). Sim, hangar, and avionics layouts had no Library nav link, so nothing to...
---
