---
pr: 533
date: 2026-05-03
title: "docs(wp): citation surface audit for migration to flightbag URLs"
wp_id: null
bugs_fixed: []
summary: |
  Inventory of every site referencing ROUTES.LIBRARY_* or constructing /library/... URLs. 20+ files, categorized: route definitions (keep), citation chips (rewire to urlForReference()), BC helpers (inspect), constants (add flightbag/keep library during transition), tests (update lockstep). Sequencing: chip rewires first, then tests, then soak, then deprecate study /library/.
---
