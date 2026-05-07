---
pr: 559
date: 2026-05-03
title: "docs(wp): author hangar-review-queue work package"
wp_id: hangar-review-queue
bugs_fixed: []
summary: |
  Author full work package for hangar-review-queue (spec, design, tasks, test-plan, user-stories) at docs/work-packages/hangar-review-queue/ Three concentric surfaces: /docs (rich markdown viewer over docs/** with Postgres FTS), /review (kanban board with bucket aggregations to solve the 89-WP overwhelm), and per-kind review views (wp_spec tabs, wp_test_plan walker with persisted step state, reference_toc spot-check, knowledge_node discovery review, ad_hoc tasks) Frontmatter (status/review_status) stays authoritative; DB caches it; ephemeral session/step state DB-only In-scope: bucket admin UI...
---
