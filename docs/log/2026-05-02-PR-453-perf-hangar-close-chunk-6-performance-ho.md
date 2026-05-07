---
pr: 453
date: 2026-05-02
title: "perf(hangar): close chunk-6 performance hot spots"
wp_id: null
bugs_fixed: []
summary: |
  **/sources tile sourcing** -- the loader was reading libs/aviation/src/references/aviation.ts (~160 KB, 4095 lines) and running two regex sweeps on every page hit just to render two integer tiles. Replaced with countLiveReferences() and a new countVerbatimReferences() aggregate over hangar.reference WHERE deletedAt IS NULL AND verbatim IS NOT NULL. Loader now runs every independent read concurrently in one Promise.all instead of 7 sequential awaits. **listRunningJobs unbounded** -- SELECT * with no LIMIT, leaking full payload / result jsonb to every /sources load. Capped at the new...
---
