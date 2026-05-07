---
pr: 218
date: 2026-04-26
title: "fix(routes): move group-by enums out of +page.server.ts"
wp_id: null
bugs_fixed: []
summary: |
  /knowledge and /reps/browse exported KNOWLEDGE_GROUP_BY_OPTIONS / REPS_GROUP_BY_OPTIONS from +page.server.ts and imported them into the page component. SvelteKit refuses that:
---
