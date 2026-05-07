---
pr: 267
date: 2026-04-28
title: "docs(handbook-ingest): clarify LLM runner scope + how-to-run"
wp_id: null
bugs_fixed: []
summary: |
  Add scope banner to tools/handbook-ingest/ingest/prompts/run-llm-comparison.md -- the runner is **handbook-only** (PHAK / AFH / AvWX / IFH / IPH). Hard-coded to handbook layout, two-axis <doc>+<edition> paths, printed-page anchors, and bun run sources extract handbooks. Not applicable to CFRs / ACs / ACS / AIM, which have different structures and would need their own runner. Add a "How to run" section: fresh Claude Code session, paste prompt block, expect 15-30 min interactive. Captures why a fresh session matters (context-heavy per-chapter loop). Add venv prereq line. The dispatcher already...
---
