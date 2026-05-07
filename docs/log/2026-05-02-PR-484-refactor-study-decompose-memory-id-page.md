---
pr: 484
date: 2026-05-02
title: "refactor(study): decompose memory/[id] page into _panels"
wp_id: null
bugs_fixed: []
summary: |
  The card detail page at apps/study/src/routes/(app)/memory/[id]/+page.svelte had grown to 1173 lines with seven distinct concerns living in one file. This PR splits it into six panels under a sibling _panels/ directory, matching the precedent set by apps/study/src/routes/(app)/dashboard/_panels/.
---
