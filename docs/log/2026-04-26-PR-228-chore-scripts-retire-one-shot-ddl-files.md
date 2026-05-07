---
pr: 228
date: 2026-04-26
title: "chore(scripts): retire one-shot DDL files now folded into 0000_initial.sql"
wp_id: null
bugs_fixed: []
summary: |
  After PR #222 collapsed every drizzle migration into a single initial, three standalone SQL helpers became redundant on fresh DBs. Plus one one-shot frontmatter migration that ran once and is no longer needed.
---
