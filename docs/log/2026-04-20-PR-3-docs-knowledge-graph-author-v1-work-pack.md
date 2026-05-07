---
pr: 3
date: 2026-04-20
title: "docs(knowledge-graph): author v1 work package with dual-gate mastery"
wp_id: knowledge-graph
bugs_fixed: []
summary: |
  Authors the complete v1 work package for the knowledge graph feature (spec, design, tasks, test-plan) Scopes v1 to the 30-node skeleton per ADR 011; content canary already shipped in PR #2 Hybrid storage (markdown canonical, Postgres projection via bun run build-knowledge) Four new tables: knowledge_node, knowledge_edge, knowledge_content_phase, knowledge_build Cards and scenarios gain optional node_id + content_phase columns (ON DELETE SET NULL) Seven-phase content model + CLI scaffolder + build pipeline v1 UI: /knowledge browse, /knowledge/[slug] detail, /knowledge/[slug]/learn phase stepper
---
