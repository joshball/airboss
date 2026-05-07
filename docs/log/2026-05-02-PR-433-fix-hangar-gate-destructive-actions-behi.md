---
pr: 433
date: 2026-05-02
title: "fix(hangar): gate destructive actions behind ConfirmDialog"
wp_id: null
bugs_fixed: []
summary: |
  Closes the convergent destructive-action confirmation gap surfaced by the chunk-6 hangar-cluster review. Four call sites posted on the first click while the same product gated user-management hazards behind typed-confirmation ConfirmDialog. The asymmetry was the largest UX bug in the cluster and could destroy archived editions, soft-delete referenced regulations, commit unintended diffs, or kill long-running jobs with one mis-click.
---
