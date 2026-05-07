---
pr: 481
date: 2026-05-02
title: "perf(bc-study): batch reads in applyCertGoalsToPrimaryGoal"
wp_id: null
bugs_fixed: []
summary: |
  Closes the chunk-2 perf finding \docs/work/reviews/2026-05-01-study-bc-domain-perf.md:174\: \applyCertGoalsToPrimaryGoal\ was a serial \for (const certSlug of certs)\ loop doing three awaits per cert (\getCredentialBySlug\ -> \getCredentialPrimarySyllabus\ -> \addGoalSyllabus\).
---
