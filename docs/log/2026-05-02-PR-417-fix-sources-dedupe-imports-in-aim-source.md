---
pr: 417
date: 2026-05-02
title: "fix(sources): dedupe imports in aim/source-ingest.test.ts after W7 merge"
wp_id: null
bugs_fixed: []
summary: |
  Post-W7-merge cleanup. The W1 + W7 test halves both opened with their own import block; merging them dropped the duplicates.
---
