---
pr: 272
date: 2026-04-28
title: "docs(handbook-ingest): design + review for section-extraction prompt strategy"
wp_id: null
bugs_fixed: []
summary: |
  Design doc + reviewer findings for replacing the API-driven sections_via_llm.py path with a no-key, prompt-emitting flow. CLI emits per-chapter prompts + an orchestrator into prompts-out/<doc>/<edition>/. User pastes the orchestrator into a fresh Claude Code session; sub-agents fan out one-per-chapter and write _llm_section_tree.json + _model_self_report.txt. Archive-by-default for audit. Two rounds of agent review captured in review.md. Final verdict: ship.
---
