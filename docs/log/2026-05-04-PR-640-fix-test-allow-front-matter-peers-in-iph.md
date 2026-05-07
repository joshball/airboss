---
pr: 640
date: 2026-05-04
title: "fix(test): allow front-matter peers in iph manifest assertions"
wp_id: null
bugs_fixed: []
summary: |
  The IPH manifest emits front-matter rows as depth-0 peers to chapters (per section-tree.ts), with codes like 0.1/0.2 and parent_code === null. Two assertions in iph-manifest.test.ts were written assuming chapters were the only depth-0 level, and broke once front-matter capture landed.
---
