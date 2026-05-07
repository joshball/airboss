---
pr: 296
date: 2026-04-28
title: "wp(cert-syllabus): sync tasks.md against shipped PRs #264 #270 #272 #274"
wp_id: cert-syllabus-and-goal-composer
bugs_fixed: []
summary: |
  The cert-syllabus-and-goal-composer work package shipped but its tasks.md still showed 0 of 201 checkboxes closed -- so nobody could see what's left or what \"PR 5\" should be. This PR walks the merged PRs commit-by-commit and marks tasks [x] where there's a name-the-commit-or-file level of evidence.
---
