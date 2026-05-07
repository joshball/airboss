---
pr: 256
date: 2026-04-27
title: "docs(handbook-ingest): commit Claude Code LLM prompt runner (orphan salvage)"
wp_id: handbook-ingestion-and-reader
bugs_fixed: []
summary: |
  Salvages tools/handbook-ingest/ingest/prompts/run-llm-comparison.md -- the no-API-key Claude Code variant of sections_via_llm.py. Was authored during the handbook-ingestion-and-reader WP work but never made it into a prior commit. Found as untracked in the WP worktree before destroying it; copying to main here so the file isn't lost. Same committed prompt at section_tree.md, same _llm_section_tree.json output target -- byte-comparable across API runner and Claude Code runner.
---
