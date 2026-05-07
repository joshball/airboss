---
pr: 524
date: 2026-05-03
title: "feat(flightbag): scaffold apps/flightbag + libs/library + URL helpers"
wp_id: null
bugs_fixed: []
summary: |
  Scaffolds the new apps/flightbag/ reader app and libs/library/ rendering primitives lib, with ROUTES.FLIGHTBAG_* URL templates and the urlForReference() URI -> URL bridge helper. Per docs/platform/REFERENCES.md, flightbag becomes the canonical references reader so other apps (study/sim/firc/avionics) can deep-link to a single canonical URL space rather than each shipping their own reader.
---
