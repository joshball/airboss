---
pr: 134
date: 2026-04-24
title: "fix(workspace): resolve @ab/constants from nested files + fresh-worktree sync"
wp_id: null
bugs_fixed: []
summary: |
  Three convergent bugs (Bug #8, Bug #9, Friction #10 from the 2026-04-24 handoff) shared a root cause: bun's workspace resolution only walks up to the nearest workspace package.json, so @ab/* imports from deep-nested files (apps/study/src/lib/help/content/**.ts, every libs/bc/study/src/*.test.ts) failed to resolve. Fresh worktrees also lacked the generated .svelte-kit/tsconfig.json that each app's tsconfig.json extends.
---
