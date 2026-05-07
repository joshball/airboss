---
pr: 436
date: 2026-05-02
title: "fix(hangar-jobs): atomic terminal-state, heartbeat, recovery audit, cancel-poll error handling"
wp_id: null
bugs_fixed: []
summary: |
  Closes 8 chunk-6 review findings against the hangar job worker, all converging on the same root cause: terminal-state writes are non-atomic with their audit emissions, the cancel-overwrite race silently loses user cancellations, the cancel-poll has no error handling, and there's no liveness signal.
---
