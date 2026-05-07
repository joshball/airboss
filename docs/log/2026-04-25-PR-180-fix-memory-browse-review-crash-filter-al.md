---
pr: 180
date: 2026-04-25
title: "fix(memory-browse): review crash, filter alignment, density, facets, paging, grouping"
wp_id: null
bugs_fixed: []
summary: |
  **Fixes a runtime crash on /memory/review** — getDueCards interpolated a JS Date directly into a raw sql\\` template; postgres-js sent it as Date.toString() and rejected the param with ERR_INVALID_ARG_TYPE. Same bug existed in the snooze auto-suspend path. Both now use .toISOString(), matching the working pattern in scenarios.ts. **Filter row alignment** — Status sat on a different baseline from Search/Domain/Type/Source, and Apply/Reset hung below the filter card. Unified every filter block under a phantom-label spacer so the row reads as a single visual baseline. **Card density** — replaced...
---
