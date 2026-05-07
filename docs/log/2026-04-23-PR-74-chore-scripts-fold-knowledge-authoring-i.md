---
pr: 74
date: 2026-04-23
title: "chore(scripts): fold knowledge authoring into db dispatcher + fix skip-link"
wp_id: knowledge-graph
bugs_fixed: []
summary: |
  Consolidates knowledge-graph authoring commands into the db dispatcher: bun run db new <domain> <slug> scaffolds a node, bun run db build [--dry-run|--json|--fail-on-coverage] validates and writes the graph. bun run db seed cards seeds per-user cards. The old knowledge:new / knowledge:seed / build-knowledge top-level scripts were already gone; this wires the surviving scripts under the single discoverable entry point and updates every doc that still pointed at the dead commands (NOW.md, spec, design, PRD, tasks, test-plan, graph-index header, scripts/check.ts log string). Closes the "Script...
---
