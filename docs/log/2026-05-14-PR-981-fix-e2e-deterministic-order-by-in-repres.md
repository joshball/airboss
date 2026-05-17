---
pr: 981
date: 2026-05-14
title: "fix(e2e): deterministic ORDER BY in representative-pages.spec"
wp_id: null
bugs_fixed: []
summary: |
  representative-pages.spec.ts generates parameterised tests at module load from a DB query. The ORDER BY (depth, ordinal) had ties (CFR subpart-* wrappers share (0, 0) with the first numeric section; the mountain-flying handbook has many (1, N) ties across parents). Each Playwright worker re-imports the spec, Postgres returns ties in unspecified order, and the orchestrator's test list ends up different from the worker's. Playwright reports "Test not found in the worker process" for the divergent slots. Adding asc(code) as a final tiebreaker pins the sample identical across workers.
---
