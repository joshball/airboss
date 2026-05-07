---
pr: 345
date: 2026-04-30
title: "docs(WP): engine-goal-cutover + evidence-kind-gating (deferred from cert-syllabus WP)"
wp_id: engine-goal-cutover
bugs_fixed: []
summary: |
  The session engine's targeting filter is rewritten to read from the user's primary goal + goal_syllabus rows instead of study_plan.cert_goals. After this WP, cert_goals is dead column metadata that can be dropped. Resolves Open Question 4 from the cert-syllabus WP.
---
