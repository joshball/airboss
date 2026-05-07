---
pr: 41
date: 2026-04-22
title: "refactor(schema): drop rep_attempt + REP_DEDUPE_WINDOW_MS + RepAttemptRow types (ADR 012 phase 4)"
wp_id: null
bugs_fixed: []
summary: |
  Phase 4 of ADR 012. Drops the now-orphaned rep_attempt table and every related symbol. Phase 5 moved all reads + writes onto session_item_result; Phase 3 redirected /reps/session to the gallery; this PR removes the surface area those two left behind.
---
