---
pr: 551
date: 2026-05-03
title: "feat(interp): WP-CC v1 -- expand registry to 17 most-cited Chief Counsel interpretations"
wp_id: wp-cc
bugs_fixed: []
summary: |
  Expands libs/sources/src/interp/manifest.yaml with 16 new Chief Counsel interpretation entries the user vouched for in the task brief, plus Murphy (2014). Total: 20 chief-counsel + 1 NTSB Board order = 21 entries (up from 5). Registry-only v1 per WP-CC: citation chips and knowledge-node references that resolve to airboss-ref:interp/chief-counsel/<author>-<year> now have canonical short cites and fall back to the FAA AGC interpretations index page via the existing interp/ umbrella corpus and seedInterpFromManifest (seed-all phase 5a). No new corpus, seeder, or render route. Adds...
---
