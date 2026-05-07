---
pr: 39
date: 2026-04-22
title: "feat(study): redirect /reps/session to preset gallery; retire REPS_SESSION constant (ADR 012 phase 3)"
wp_id: null
bugs_fixed: []
summary: |
  Phase 3 of ADR 012. Redirects /reps/session traffic onto /session/start (the preset gallery or in-plan session preview). Retires the ROUTES.REPS_SESSION constant since every first-party caller now links ROUTES.SESSION_START directly.
---
