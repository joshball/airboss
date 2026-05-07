---
pr: 222
date: 2026-04-26
title: "chore(db): collapse 11 drizzle migrations into 0000_initial"
wp_id: null
bugs_fixed: []
summary: |
  Replaces drizzle/0000_*.sql through drizzle/0010_*.sql (plus the misaligned meta/ snapshots — journal had 11 entries but only 9 snapshot files existed) with one drizzle/0000_initial.sql + matching snapshot + 1-entry journal.
---
