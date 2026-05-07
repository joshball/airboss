---
pr: 182
date: 2026-04-25
title: "refactor(ui): extract FilterCard, FilterChips, Pager, ResultSummary"
wp_id: null
bugs_fixed: []
summary: |
  The same filter+chips+pager pattern was open-coded in three browse routes (memory, reps, knowledge) with subtly drifted CSS and chip-href logic. This extracts the visual primitives into @ab/ui and wires the three pages through the shared components.
---
