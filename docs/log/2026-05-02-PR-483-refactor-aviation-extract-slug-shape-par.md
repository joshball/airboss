---
pr: 483
date: 2026-05-02
title: "refactor(aviation): extract slug-shape parsers from study route loaders"
wp_id: null
bugs_fixed: []
summary: |
  Extracts the inline slug-validation patterns scattered across eight /library/* route loaders into a single pure module (libs/aviation/src/slugs.ts). Each parser returns the typed value when the URL fragment matches the expected shape, or null for a mismatch -- DB lookups stay in the route loader.
---
