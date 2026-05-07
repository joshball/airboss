---
pr: 589
date: 2026-05-04
title: "docs(reviews): note chunk-1 effect-mirror finding closed by #568"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Verify-and-close on the wave-2 effect-mirror remainder cluster (chunk-1 svelte 1 MAJOR + 1 MINOR). Confirmed PR #568's chunk-5 close-out audit shipped the convergent fix for apps/study/src/routes/(app)/+layout.svelte — it was one of 5 layouts migrated from \\$effect(() => { themePref = data.theme })\ to the optimistic-override \\$derived(override ?? data.theme ?? DEFAULT)\ pattern. The forward-reference MINOR (\selection\ referenced before declaration in the document-mirror effect) closed by the same dependency-order rework.
---
