---
pr: 313
date: 2026-04-28
title: "feat(scripts): db build-all composite (knowledge + relevance)"
wp_id: null
bugs_fixed: []
summary: |
  Adds bun run db build-all: composite that runs every authored-content build phase in dependency order. Phase 1: scripts/build-knowledge-index.ts (knowledge graph from course/knowledge/**/node.md -> knowledge_node + knowledge_edge + graph-index.md). Phase 2: scripts/db/build-relevance-cache.ts (walks active syllabi, accumulates (cert, bloom, priority) per knowledge node, writes to knowledge_node.relevance JSONB). Each phase idempotent, live (no --dry-run). Phases live in a BUILD_ALL_PHASES table; adding a phase is a single append. Name is hyphenated (build-all, not build:all) -- this is a...
---
