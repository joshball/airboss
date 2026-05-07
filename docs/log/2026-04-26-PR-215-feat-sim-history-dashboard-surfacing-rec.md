---
pr: 215
date: 2026-04-26
title: "feat(sim): history dashboard surfacing recent attempts"
wp_id: null
bugs_fixed: []
summary: |
  Adds /history and /history/[attemptId] routes to the sim app so the authenticated learner can browse recent flights and review per-component grading from a finished run. List page calls listRecentSimAttempts(userId, SIM_HISTORY.LIST_LIMIT) and intentionally excludes the heavy tape column. Detail page calls loadSimAttempt(id, userId) and renders the grade breakdown plus a per-component bar. Anonymous visits redirect to study sign-in on the sibling subdomain (study.<parent-host>/login); the bauth_session_token cookie is shared across the parent domain so the user lands back on sim signed in.
---
