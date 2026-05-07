---
pr: 665
date: 2026-05-06
title: "drop \"(prior edition)\" suffix from afh 3b + add 3b ingestion wp"
wp_id: afh-3b-ingestion
bugs_fixed: []
summary: |
  AFH 3B's title in course/references/handbooks-noningested.yaml was hardcoded as Airplane Flying Handbook (prior edition). The supersedes chain now expresses "older edition" structurally (3B -> 3C wired by the YAML seeder per PR #662), so the suffix is redundant. Drop it; the row's title now matches 3C. New work package docs/work-packages/afh-3b-ingestion/spec.md capturing the deferred work to bring AFH 3B into the canonical section-tree pipeline (manifest + extracted chapters + figures), at which point the YAML row goes away entirely. File-level comment in the YAML updated to point at the new...
---
