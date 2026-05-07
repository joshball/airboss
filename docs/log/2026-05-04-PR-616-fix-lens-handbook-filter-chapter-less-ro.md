---
pr: 616
date: 2026-05-04
title: "fix lens/handbook -- filter chapter-less rows + deterministic resolution"
wp_id: null
bugs_fixed: []
summary: |
  Fixes the duplicate-handbook-cards bug and the AFH "no chapters" bug on /lens/handbook. Both stem from course/references/handbooks-noningested.yaml seeding prior-edition citation-anchor rows (e.g. AFH 3B) that have no chapters but aren't marked superseded.
---
