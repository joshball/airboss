---
pr: 268
date: 2026-04-28
title: "feat(sources/aim): Lane B -- AIM corpus end-to-end (ADR 019 phase 7)"
wp_id: null
bugs_fixed: []
summary: |
  Extends Phase 7 AIM scaffolding (resolver + manifest-walk ingest, originally landed against a hand-authored fixture) with the live **PDF -> derivatives -> registry** pipeline. The cached AIM PDF at $AIRBOSS_HANDBOOK_CACHE/aim/<edition>/source.pdf is now the input; one command extracts the structured tree and registers entries.
---
