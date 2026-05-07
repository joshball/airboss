---
pr: 330
date: 2026-04-29
title: "refactor(ui): adopt PageHeader/EmptyState/ScoreCard across 27 routes"
wp_id: route-style-extraction
bugs_fixed: []
summary: |
  Mechanical adoption pass for the three layout primitives extracted in PR #315 (PageHeader, EmptyState, ScoreCard). 27 routes migrated across all four apps (study, sim, hangar, avionics). Net -507 lines: 785 deletions of duplicated header/empty/stat blocks + their now-dead local CSS, 278 insertions of primitive imports + snippet wiring.
---
