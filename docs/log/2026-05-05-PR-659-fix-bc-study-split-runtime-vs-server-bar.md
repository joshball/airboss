---
pr: 659
date: 2026-05-05
title: "fix(bc-study): split runtime vs server barrels; client-error UX; lint guard"
wp_id: library-by-cert
bugs_fixed: []
summary: |
  Closes the /memory ReferenceError: Buffer is not defined regression that survived #656. The leak was transitive: @ab/bc-study's single barrel re-exported every server-only module, so Vite's deps optimizer dragged postgres (whose bytes.js references Buffer at module-eval) into the client bundle along with anything reachable from the barrel.
---
