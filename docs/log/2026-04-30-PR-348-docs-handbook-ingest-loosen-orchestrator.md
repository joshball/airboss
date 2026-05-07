---
pr: 348
date: 2026-04-30
title: "docs(handbook-ingest): loosen orchestrator prompt's invocation guard"
wp_id: null
bugs_fixed: []
summary: |
  The orchestrator prompt (tools/handbook-ingest/ingest/prompts/section-extraction/orchestrator.md) insisted on a \"fresh Claude Code session the user opened specifically\" and STOP'd if anything else looked to be the case. That guard forbade legitimate invocation paths -- claude < _run.md piping, \"execute this file at \\<path\\>\" instructions in a working session -- just to defend against a hypothetical unsolicited Agent-dispatch by a working dev session.
---
