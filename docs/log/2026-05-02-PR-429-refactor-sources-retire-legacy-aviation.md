---
pr: 429
date: 2026-05-02
title: "refactor(sources): retire legacy aviation SOURCES registry (Cluster A follow-on)"
wp_id: null
bugs_fixed: []
summary: |
  Moves the seed source catalog out of @ab/aviation and into @ab/bc-hangar (libs/bc/hangar/src/source-seed-registry.ts) so it lives next to the hangar.source schema that owns the live state machine. Drops the in-repo data/sources/<corpus>/<file> path layout flagged by the 2026-05-01 sources-content-pipeline architecture review (15 inline literals, ADR 018 violation); seed paths now resolve through resolveCacheRoot() per ADR 018.
---
