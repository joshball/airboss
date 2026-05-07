---
pr: 630
date: 2026-05-04
title: "fix(tests): unit + e2e suite green again"
wp_id: null
bugs_fixed: []
summary: |
  **Unit suite**: all 5,373 tests pass (was 8 tests / 12 files failing). Root causes spanned schema additions (airboss_ref NOT NULL, audit target_type retired-constant churn), missing test allowlists for the cluster-E redirect guard, a stale extras-yaml expectation, a vitest.config.ts alias gap on @ab/bc-study/build, and a couple of source-side bugs (duplicate switch cases in source-pdf.ts, /%2f percent-encoded slash slipping past isSafeRedirect, backticks in a Svelte attribute breaking svelte-check). **E2e suite**: was 11 specs failing on the authed chromium project. After this PR the suite is...
---
