---
pr: 24
date: 2026-04-22
title: "fix(reps-session): server-derived current slot so refresh resumes mid-session"
wp_id: null
bugs_fixed: []
summary: |
  Fixes the CRITICAL finding: /reps/session was losing progress on refresh/tab-close because state lived client-only. The newer /sessions/[id] flow already solved this by server-deriving "current slot = first unresolved slot." This ports that pattern to /reps/session.
---
