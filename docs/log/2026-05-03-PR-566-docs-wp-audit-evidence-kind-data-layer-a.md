---
pr: 566
date: 2026-05-03
title: "docs(wp): audit evidence-kind-data-layer against current code (2026-05-03)"
wp_id: evidence-kind-data-layer
bugs_fixed: []
summary: |
  Pre-build audit pass on the evidence-kind-data-layer WP. The WP was authored before PR #361 (evidence-kind-gating) landed and before PR #445 collapsed the migration baseline; line refs, migration filenames, and tooling notes had drifted. This commit re-aligns spec/tasks/design/test-plan against current main.
---
