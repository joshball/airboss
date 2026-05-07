---
pr: 641
date: 2026-05-05
title: "feat(db): add reset-login-attempts to clear auth rate-limit bucket"
wp_id: null
bugs_fixed: []
summary: |
  Adds bun run db reset-login-attempts -- TRUNCATEs bauth_rate_limit to clear the auth rate-limit bucket.
---
