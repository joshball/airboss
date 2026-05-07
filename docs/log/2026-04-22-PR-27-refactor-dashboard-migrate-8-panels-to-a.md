---
pr: 27
date: 2026-04-22
title: "refactor(dashboard): migrate 8 panels to @ab/ui PanelShell + delete local shim"
wp_id: null
bugs_fixed: []
summary: |
  Completes the migration started in #22. PR #22 built @ab/ui/components/PanelShell.svelte and migrated one panel (CtaPanel) as proof. This PR migrates the remaining eight panels and deletes the local apps/study/src/routes/(app)/dashboard/_panels/PanelShell.svelte shim.
---
