---
pr: 478
date: 2026-05-02
title: "refactor(ui): extract ActivityHost from study knowledge learn route"
wp_id: null
bugs_fixed: []
summary: |
  Move ActivityHost.svelte from apps/study/src/routes/(app)/knowledge/[slug]/learn/ to libs/ui/src/components/. Closes the chunk-1 architecture finding flagged for boundary correctness; single existing consumer updated.
---
