---
pr: 646
date: 2026-05-05
title: "fix(e2e): repair test cluster after infra-isolation cutover"
wp_id: auth-rate-limit
bugs_fixed: []
summary: |
  Closes the e2e regression cluster from the post-#643 task list. Mix of real source bugs uncovered by the suite + stale assertions that pre-dated the route/auth changes the suite was meant to cover.
---
